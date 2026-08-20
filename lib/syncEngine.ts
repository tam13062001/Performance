import { pool } from './db';
import { getSheetValues } from './googleSheets';
import { indexByHeader, makeFieldGetter } from './syncHelpers';

export interface SyncResult {
  projectCode: string;
  table?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  deletedRows?: number;
  skippedEmpty?: boolean;
  errorMessage?: string;
  sampleErrors?: string[];
}

export interface RowSyncConfig {
  table: string;
  /** Có thể là 1 tên tab, hoặc mảng nhiều tên tab ứng viên (thử theo thứ tự, dùng tab đầu tiên tồn tại). */
  tabName: string | string[];
  conflictColumns: string;
  /** Parse theo VỊ TRÍ cột (row[0], row[1]...) — cách cũ, vẫn hỗ trợ cho config chưa migrate. */
  parseRow?: (row: unknown[]) => Record<string, unknown> | null;
  /**
   * Parse theo TÊN cột (header) — không phụ thuộc thứ tự cột trong sheet.
   * Nếu config có field này, syncEngine sẽ ưu tiên dùng nó thay vì parseRow.
   */
  parseRowByHeader?: (get: (aliases: string | string[]) => any) => Record<string, unknown> | null;
  /** Nếu có, đọc từ sheet này thay vì spreadsheetId chính của project (dùng cho nguồn phụ như demographic) */
  sheetIdOverride?: string;
  /**
   * Danh sách cột dùng để XÓA CÓ PHẠM VI trước khi insert lại (bên cạnh project_id).
   * Bắt buộc khai báo nếu bảng này được NHIỀU tabName khác nhau cùng ghi vào
   * (vd ad_raw_data dùng chung cho YTD_DATA và MTD_DATA; ad_demographic_metrics
   * dùng chung cho >10 tab) — nếu không khai báo, sync sẽ xóa TOÀN BỘ data của
   * project trong bảng này, có thể xóa nhầm data do tab khác vừa ghi trong cùng lần chạy.
   * Giá trị scope được lấy từ chính data vừa parse (distinct theo các cột này).
   */
  deleteScopeColumns?: string[];
}

/**
 * Tách danh sách cột trong conflictColumns theo dấu phẩy ở top-level,
 * tôn trọng dấu phẩy nằm bên trong COALESCE(...) (không tách nhầm).
 */
function splitTopLevelColumns(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Lấy tên cột thật từ 1 phần tử của conflictColumns, kể cả khi nó được bọc COALESCE(...) */
function extractColumnName(term: string): string {
  const m = term.match(/COALESCE\(\s*([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (m) return m[1];
  return term.trim();
}

/** Build danh sách distinct tuple giá trị theo deleteScopeColumns từ mảng record đã parse */
function distinctScopeTuples(
  records: Record<string, unknown>[],
  scopeColumns: string[]
): unknown[][] {
  const seen = new Set<string>();
  const tuples: unknown[][] = [];
  for (const rec of records) {
    const tuple = scopeColumns.map((c) => rec[c] ?? null);
    const key = JSON.stringify(tuple);
    if (!seen.has(key)) {
      seen.add(key);
      tuples.push(tuple);
    }
  }
  return tuples;
}

export async function syncRawSheet(
  projectCode: string,
  spreadsheetId: string,
  config: RowSyncConfig
): Promise<SyncResult> {
  const tabCandidates = Array.isArray(config.tabName) ? config.tabName : [config.tabName];

  if (!config.parseRow && !config.parseRowByHeader) {
    return {
      projectCode,
      table: config.table,
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      errorMessage: `Config "${config.table}/${tabCandidates.join(' | ')}" thiếu cả parseRow lẫn parseRowByHeader.`,
    };
  }

  const client = await pool.connect();
  let batchId: number | null = null;

  const effectiveSheetId = config.sheetIdOverride ?? spreadsheetId;

  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project_code "${projectCode}"`);
    const projectId = projectRes.rows[0].id;

    // Thử lần lượt từng tên tab candidate, dùng tab đầu tiên thực sự tồn tại và đọc được.
    // (VD ad_delivery_status: thử 'YTD_DELIVERY_STATUS' trước, nếu không tồn tại thì thử 'DELIVERY_STATUS'.)
    let rawRows: unknown[][] | null = null;
    let resolvedTabName: string | null = null;

    for (const candidate of tabCandidates) {
      try {
        rawRows = await getSheetValues(effectiveSheetId, candidate);
        resolvedTabName = candidate;
        break;
      } catch (err) {
        const msg = (err as Error).message ?? '';
        // Google Sheets API trả lỗi này khi tên tab không tồn tại trong file
        // (VD: project không có MTD_DATA, MMU không có MTD_UNIT_COST_PLAN,
        // hoặc project dùng tên tab khác trong danh sách candidate...).
        // Đây là trường hợp DỰ KIẾN -> thử candidate tiếp theo, không phải lỗi thật.
        const isMissingTab = /unable to parse range/i.test(msg) || /not found/i.test(msg);
        if (isMissingTab) continue;
        // Lỗi khác (auth, quota, network...) vẫn coi là lỗi thật, ném lại để catch ngoài xử lý.
        throw err;
      }
    }

    // Không candidate nào tồn tại, hoặc tab tồn tại nhưng rỗng.
    if (!resolvedTabName || !rawRows || rawRows.length === 0) {
      return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    const { headerMap } = indexByHeader(rawRows);
    const rawDataRows = rawRows.slice(1).filter((r) => r.length > 0);

    if (rawDataRows.length === 0) {
      return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    // ⬅️ BƯỚC 1: Parse TOÀN BỘ rows trước, CHƯA đụng gì tới DB.
    // Nếu 1 dòng parse lỗi (throw), chỉ dòng đó bị bỏ qua (giữ hành vi cũ) —
    // không dừng cả batch, nhưng KHÔNG xóa DB nếu parse ra 0 dòng hợp lệ nào cả
    // (tránh trường hợp sheet lỗi tạm thời làm mất sạch data cũ).
    const parsedRecords: Record<string, unknown>[] = [];
    let skippedParseRows = 0;

    for (const row of rawDataRows) {
      try {
        const values = config.parseRowByHeader
          ? config.parseRowByHeader(makeFieldGetter(headerMap, row))
          : config.parseRow!(row);
        if (!values) {
          skippedParseRows++;
          continue;
        }
        values.project_id = projectId;
        parsedRecords.push(values);
      } catch (err) {
        skippedParseRows++;
      }
    }

    if (parsedRecords.length === 0) {
      return {
        projectCode,
        table: config.table,
        totalRows: rawDataRows.length,
        successRows: 0,
        failedRows: 0,
        skippedEmpty: true,
        errorMessage: `Parse ra 0 dòng hợp lệ (${skippedParseRows} dòng bị skip) — không xóa data cũ để tránh mất data.`,
      };
    }

    const batchRes = await client.query(
      `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status)
       VALUES ($1,$2,$3,'processing') RETURNING id`,
      [projectId, effectiveSheetId, resolvedTabName]
    );
    batchId = batchRes.rows[0].id;
    for (const rec of parsedRecords) rec.import_batch_id = batchId;

    let successRows = 0;
    let failedRows = 0;
    const sampleErrors: string[] = [];
    let deletedRows = 0;

    await client.query('BEGIN');

    // ⬅️ BƯỚC 2: Xóa CÓ PHẠM VI trước khi insert lại.
    if (config.deleteScopeColumns && config.deleteScopeColumns.length > 0) {
      const tuples = distinctScopeTuples(parsedRecords, config.deleteScopeColumns);
      // Xóa theo từng tuple scope (an toàn, dễ đọc, số lượng tuple thường nhỏ — vài chục là cùng)
      for (const tuple of tuples) {
        const whereScope = config.deleteScopeColumns
          .map((c, i) => `${c} IS NOT DISTINCT FROM $${i + 2}`)
          .join(' AND ');
        const res = await client.query(
          `DELETE FROM ${config.table} WHERE project_id = $1 AND ${whereScope}`,
          [projectId, ...tuple]
        );
        deletedRows += res.rowCount ?? 0;
      }
    } else {
      // Không có scope -> xóa toàn bộ data của project trong bảng này.
      // CHỈ an toàn nếu bảng này chỉ có đúng 1 tabName ghi vào (vd FACEBOOK_DATA, TIKTOK_DATA...).
      const res = await client.query(`DELETE FROM ${config.table} WHERE project_id = $1`, [projectId]);
      deletedRows = res.rowCount ?? 0;
    }

    // ⬅️ BƯỚC 3: Insert lại toàn bộ. Vẫn giữ ON CONFLICT DO NOTHING làm lưới an toàn
    // phòng trường hợp parsedRecords tự trùng khóa với nhau (2 dòng sheet cùng khóa).
    for (const values of parsedRecords) {
      await client.query('SAVEPOINT row_sp');
      try {
        const cols = Object.keys(values);
        const placeholders = cols.map((_, i) => `$${i + 1}`);

        const sql = `INSERT INTO ${config.table} (${cols.join(', ')})
                     VALUES (${placeholders.join(', ')})
                     ON CONFLICT (${config.conflictColumns}) DO NOTHING`;

        await client.query(sql, cols.map((c) => values[c]));
        await client.query('RELEASE SAVEPOINT row_sp');
        successRows++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT row_sp');
        const msg = (err as Error).message;
        console.error(`Lỗi sync ${config.table} (${projectCode}):`, msg);
        if (sampleErrors.length < 5) sampleErrors.push(msg);
        failedRows++;
      }
    }

    await client.query('COMMIT');
    await client.query(
      `UPDATE ad_import_batches SET status='success', total_rows=$1, success_rows=$2, failed_rows=$3 WHERE id=$4`,
      [rawDataRows.length, successRows, failedRows, batchId]
    );

    return {
      projectCode,
      table: config.table,
      totalRows: rawDataRows.length,
      successRows,
      failedRows,
      deletedRows,
      sampleErrors: sampleErrors.length ? sampleErrors : undefined,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const message = (err as Error).message;
    if (batchId) {
      await client.query(`UPDATE ad_import_batches SET status='failed', error_message=$1 WHERE id=$2`, [message, batchId]).catch(() => {});
    }
    return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, errorMessage: message };
  } finally {
    client.release();
  }
}