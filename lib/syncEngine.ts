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
  isTestMode?: boolean; 
  previewData?: any[];  
}

export interface RowSyncConfig {
  table: string;
  tabName: string | string[];
  conflictColumns: string;
  parseRow?: (row: unknown[]) => Record<string, unknown> | null;
  parseRowByHeader?: (get: (aliases: string | string[]) => any) => Record<string, unknown> | null;
  sheetIdOverride?: string;
  deleteScopeColumns?: string[];
}

// Dò dòng header thật trong vài dòng đầu, bỏ qua preamble kiểu title/date-range
// (dòng chỉ có 1 ô, hoặc dòng chứa số/ngày). Header thật: >=2 ô không rỗng,
// và toàn bộ là text (không parse được thành số).
function findHeaderRowIndex(rawRows: unknown[][], maxScan = 10): number {
  const limit = Math.min(maxScan, rawRows.length);
  for (let i = 0; i < limit; i++) {
    const row = rawRows[i];
    const nonEmpty = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpty.length < 2) continue; // preamble kiểu 1 ô ("Device", date range)
    const allText = nonEmpty.every((c) => {
      const str = String(c).trim();
      return isNaN(Number(str.replace(/[,%]/g, '')));
    });
    if (allText) return i;
  }
  return 0; // fallback: giữ hành vi cũ nếu không dò được
}

function distinctScopeTuples(records: Record<string, unknown>[], scopeColumns: string[]): unknown[][] {
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
  config: RowSyncConfig,
  testMode: boolean = false 
): Promise<SyncResult> {
  const tabCandidates = Array.isArray(config.tabName) ? config.tabName : [config.tabName];

  if (!config.parseRow && !config.parseRowByHeader) {
    return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, errorMessage: 'Thiếu parser.' };
  }

  const client = await pool.connect();
  let batchId: number | null = null;
  const effectiveSheetId = config.sheetIdOverride ?? spreadsheetId;

  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project_code "${projectCode}"`);
    const projectId = projectRes.rows[0].id;

    let rawRows: unknown[][] | null = null;
    let resolvedTabName: string | null = null;

    for (const candidate of tabCandidates) {
      try {
        rawRows = await getSheetValues(effectiveSheetId, candidate);
        resolvedTabName = candidate;
        break;
      } catch (err) {
        const msg = (err as Error).message ?? '';
        if (/unable to parse range/i.test(msg) || /not found/i.test(msg)) continue;
        throw err;
      }
    }

if (!resolvedTabName || !rawRows || rawRows.length === 0) {
  return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
}

const headerRowIndex = findHeaderRowIndex(rawRows);
const rowsFromHeader = rawRows.slice(headerRowIndex);

const { headerMap } = indexByHeader(rowsFromHeader);
const rawDataRows = rowsFromHeader.slice(1).filter((r) => r.length > 0);

    if (rawDataRows.length === 0) {
      return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    // BƯỚC 1: Parse rows
    const parsedRecords: Record<string, unknown>[] = [];
    for (const row of rawDataRows) {
      try {
        const values = config.parseRowByHeader ? config.parseRowByHeader(makeFieldGetter(headerMap, row)) : config.parseRow!(row);
        if (!values) continue;
        values.project_id = projectId;
        parsedRecords.push(values);
      } catch (err) {}
    }

    if (parsedRecords.length === 0) {
      return { projectCode, table: config.table, totalRows: rawDataRows.length, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    // 🚧 NẾU LÀ TEST MODE -> TRẢ VỀ LUÔN DATA TRƯỚC KHI GHI VÀO DB
    if (testMode) {
      return {
        projectCode,
        table: config.table,
        totalRows: rawDataRows.length,
        successRows: parsedRecords.length,
        failedRows: 0,
        isTestMode: true, 
        previewData: parsedRecords, 
      };
    }

    // BƯỚC 2: Ghi dữ liệu vào DB (Chỉ chạy khi test=false)
    const batchRes = await client.query(
      `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status) VALUES ($1,$2,$3,'processing') RETURNING id`,
      [projectId, effectiveSheetId, resolvedTabName]
    );
    batchId = batchRes.rows[0].id;
    for (const rec of parsedRecords) rec.import_batch_id = batchId;

    let successRows = 0; let failedRows = 0; let deletedRows = 0; const sampleErrors: string[] = [];
    await client.query('BEGIN');

    if (config.deleteScopeColumns && config.deleteScopeColumns.length > 0) {
      const tuples = distinctScopeTuples(parsedRecords, config.deleteScopeColumns);
      for (const tuple of tuples) {
        const whereScope = config.deleteScopeColumns.map((c, i) => `${c} IS NOT DISTINCT FROM $${i + 2}`).join(' AND ');
        const res = await client.query(`DELETE FROM ${config.table} WHERE project_id = $1 AND ${whereScope}`, [projectId, ...tuple]);
        deletedRows += res.rowCount ?? 0;
      }
    } else {
      const res = await client.query(`DELETE FROM ${config.table} WHERE project_id = $1`, [projectId]);
      deletedRows = res.rowCount ?? 0;
    }

    for (const values of parsedRecords) {
      await client.query('SAVEPOINT row_sp');
      try {
        const cols = Object.keys(values);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const sql = `INSERT INTO ${config.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${config.conflictColumns}) DO NOTHING`;
        await client.query(sql, cols.map((c) => values[c]));
        await client.query('RELEASE SAVEPOINT row_sp');
        successRows++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT row_sp');
        const msg = (err as Error).message;
        if (sampleErrors.length < 5) sampleErrors.push(msg);
        failedRows++;
      }
    }
    await client.query('COMMIT');
    await client.query(`UPDATE ad_import_batches SET status='success', total_rows=$1, success_rows=$2, failed_rows=$3 WHERE id=$4`, [rawDataRows.length, successRows, failedRows, batchId]);

    return { projectCode, table: config.table, totalRows: rawDataRows.length, successRows, failedRows, deletedRows, sampleErrors };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, errorMessage: (err as Error).message };
  } finally {
    client.release();
  }
}