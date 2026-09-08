import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { findConfigForSheetTab } from '@/lib/syncConfigs';
import { findLegacyMasterDataProject, processMasterDataRows } from '@/lib/syncMasterData';
import type { PoolClient } from 'pg';

type WebhookRowNew = { row_number: number; values: unknown[] };

const FULL_REPLACE_SKIP_RATIO_THRESHOLD = 0.05;

// Số scope-tuple tối đa trong 1 câu DELETE ... WHERE (col1, col2) IN (...)
// Giữ nhỏ để tránh vượt giới hạn param của Postgres (65535) và tránh query quá dài.
const DELETE_CHUNK_SIZE = 1000;

// Số dòng tối đa trong 1 câu INSERT nhiều dòng (multi-row VALUES).
const INSERT_BATCH_SIZE = 500;

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function buildGetter(headers: unknown[], rowValues: unknown[]) {
  const map = new Map<string, unknown>();
  headers.forEach((h, idx) => {
    const raw = normalizeHeader(h);
    if (!raw) return;
    if (!map.has(raw)) map.set(raw, rowValues[idx]);
    const underscored = raw.replace(/\s+/g, '_');
    if (!map.has(underscored)) map.set(underscored, rowValues[idx]);
    const spaced = raw.replace(/_/g, ' ');
    if (!map.has(spaced)) map.set(spaced, rowValues[idx]);
  });

  return (aliases: string[]) => {
    for (const alias of aliases) {
      const key = normalizeHeader(alias);
      if (map.has(key)) return map.get(key);
    }
    return undefined;
  };
}

function extractConflictColumnNames(conflictColumns: string): string[] {
  const matches = conflictColumns.match(/(?:COALESCE\(\s*)?([a-zA-Z_][a-zA-Z0-9_]*)/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/^COALESCE\(\s*/, '').trim()))]
    .filter((c) => c.toUpperCase() !== 'COALESCE');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Xóa theo scope, chia thành nhiều chunk thay vì 1 câu DELETE riêng cho mỗi
 * scope key. Với bảng có nhiều giá trị phân biệt (vd tab Term), cách cũ chạy
 * hàng nghìn DELETE tuần tự trong 1 transaction -> dễ statement_timeout.
 * Cách này gộp nhiều scope vào 1 câu DELETE dùng mệnh đề (col1, col2) IN (...).
 *
 * LƯU Ý: vẫn cần index trên (project_id, ...scopeCols) để mỗi chunk chạy nhanh;
 * nếu không có index, IN-list lớn vẫn có thể chậm vì mỗi tuple phải seq scan.
 */
async function deleteByScopesChunked(
  client: PoolClient,
  table: string,
  projectId: number,
  scopeCols: string[],
  scopeRows: unknown[][]
) {
  if (scopeRows.length === 0) return;

  const chunks = chunkArray(scopeRows, DELETE_CHUNK_SIZE);
  const tupleCols = scopeCols.join(', ');

  for (const chunk of chunks) {
    const valuesClause = chunk
      .map(
        (_, r) =>
          `(${scopeCols.map((_, c) => `$${r * scopeCols.length + c + 2}`).join(', ')})`
      )
      .join(', ');
    const flatParams = chunk.flat();

    await client.query(
      `DELETE FROM ${table} WHERE project_id = $1 AND (${tupleCols}) IN (${valuesClause})`,
      [projectId, ...flatParams]
    );
  }
}

/**
 * Insert theo batch (multi-row VALUES) để giảm số round-trip tới DB.
 * Nếu cả batch lỗi (vd 1 dòng trong batch vi phạm constraint), fallback về
 * insert từng dòng trong đúng batch đó để vẫn đếm chính xác successRows/failedRows
 * và không làm rollback toàn bộ transaction vì 1 dòng lỗi.
 *
 * onConflict: truyền vào nếu là UPSERT (undefined nếu là FULL_REPLACE insert thường).
 */
async function insertRowsBatched(
  client: PoolClient,
  table: string,
  parsedRows: Record<string, any>[],
  onConflict?: { conflictColumns: string; updateCols: string[] }
): Promise<{ successRows: number; failedRows: number }> {
  let successRows = 0;
  let failedRows = 0;
  if (parsedRows.length === 0) return { successRows, failedRows };

  const cols = Object.keys(parsedRows[0]);

  function buildSql(rows: Record<string, any>[]): { sql: string; params: unknown[] } {
    const valuesClause = rows
      .map(
        (_, r) => `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(', ')})`
      )
      .join(', ');
    const flatParams = rows.flatMap((row) => cols.map((c) => row[c]));

    let sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${valuesClause}`;
    if (onConflict) {
      sql += ` ON CONFLICT (${onConflict.conflictColumns})`;
      sql +=
        onConflict.updateCols.length > 0
          ? ` DO UPDATE SET ${onConflict.updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`
          : ` DO NOTHING`;
    }
    return { sql, params: flatParams };
  }

  async function insertSingle(values: Record<string, any>): Promise<boolean> {
    const singleCols = Object.keys(values);
    const placeholders = singleCols.map((_, i) => `$${i + 1}`);
    let sql = `INSERT INTO ${table} (${singleCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    if (onConflict) {
      sql += ` ON CONFLICT (${onConflict.conflictColumns})`;
      sql +=
        onConflict.updateCols.length > 0
          ? ` DO UPDATE SET ${onConflict.updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')}`
          : ` DO NOTHING`;
    }
    try {
      await client.query(sql, singleCols.map((c) => values[c]));
      return true;
    } catch (e) {
      console.error(`Webhook insert lỗi (${table}):`, (e as Error).message);
      return false;
    }
  }

  const batches = chunkArray(parsedRows, INSERT_BATCH_SIZE);

  for (const batch of batches) {
    const { sql, params } = buildSql(batch);
    try {
      await client.query(sql, params);
      successRows += batch.length;
    } catch (e) {
      // Cả batch lỗi -> fallback insert từng dòng để cô lập đúng (các) dòng lỗi
      console.error(
        `Webhook batch insert lỗi (${table}), fallback insert từng dòng. Batch size=${batch.length}:`,
        (e as Error).message
      );
      for (const values of batch) {
        const ok = await insertSingle(values);
        if (ok) successRows++;
        else failedRows++;
      }
    }
  }

  return { successRows, failedRows };
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret');
  if (secret !== process.env.SHEET_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { sheet_id, tab_name, rows, headers, change_type } = body as {
    sheet_id?: string;
    tab_name?: string;
    headers?: unknown[];
    rows?: unknown[][] | WebhookRowNew[];
    change_type?: 'INSERT' | 'UPSERT' | 'FULL_REPLACE';
  };

  // TEMP DEBUG — xoá sau khi xác định xong nguyên nhân
  console.log('[WEBHOOK DEBUG]', {
    sheet_id_received: sheet_id,
    tab_name_received: tab_name,
    tab_name_normalized: normalizeHeader(tab_name),
    rows_count: rows?.length,
  });

  if (!sheet_id || !tab_name || !rows || rows.length === 0) {
    return NextResponse.json({ error: 'Thiếu sheet_id, tab_name hoặc rows' }, { status: 400 });
  }

  const normalizedRows: { row_number: number | null; values: unknown[] }[] = rows.map((r) =>
    Array.isArray(r)
      ? { row_number: null, values: r }
      : { row_number: (r as WebhookRowNew).row_number ?? null, values: (r as WebhookRowNew).values }
  );

  // ===== MASTER_DATA — xử lý riêng, không đi qua findConfigForSheetTab/parseRow =====
  if (normalizeHeader(tab_name) === 'master_data') {
    const legacyProject = await findLegacyMasterDataProject(sheet_id);
    if (legacyProject) {
      if (!headers || headers.length === 0) {
        return NextResponse.json(
          { error: `MASTER_DATA đọc theo header nhưng payload không có "headers"` },
          { status: 400 }
        );
      }

      const client = await pool.connect();
      let batchId: number | null = null;
      try {
        const batchRes = await client.query(
          `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status)
           VALUES ($1, $2, $3, 'processing') RETURNING id`,
          [legacyProject.projectId, sheet_id, tab_name]
        );
        batchId = batchRes.rows[0].id;

        const dataRows = normalizedRows.map((r) => r.values);

        await client.query('BEGIN');
        const { successRows, failedRows, sampleErrors, mergedDuplicateGroups } =
          await processMasterDataRows(client, legacyProject.projectId, legacyProject.projectCode, batchId, headers, dataRows);
        await client.query(
          `UPDATE ad_projects SET last_synced_at = NOW() WHERE id = $1`,
          [legacyProject.projectId]
        );
        await client.query('COMMIT');

        await client.query(
          `UPDATE ad_import_batches SET status = 'success', total_rows = $1, success_rows = $2, failed_rows = $3 WHERE id = $4`,
          [dataRows.length, successRows, failedRows, batchId]
        );

        return NextResponse.json({
          projectCode: legacyProject.projectCode,
          table: 'ad_daily_metrics',
          changeType: change_type ?? 'UPSERT',
          fullReplace: false,
          successRows, failedRows,
          skippedRows: failedRows,
          totalRows: dataRows.length,
          sampleErrors, mergedDuplicateGroups,
        });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        const message = (e as Error).message;
        if (batchId) {
          await client.query(`UPDATE ad_import_batches SET status = 'failed', error_message = $1 WHERE id = $2`, [message, batchId]).catch(() => {});
        }
        return NextResponse.json({ error: message }, { status: 500 });
      } finally {
        client.release();
      }
    }
  }

  const match = await findConfigForSheetTab(sheet_id, tab_name);
  if (!match) {
    return NextResponse.json({ error: `Không tìm thấy config nào khớp sheet_id="${sheet_id}" tab="${tab_name}"` }, { status: 404 });
  }

  const { projectCode, config } = match;

  if (!config.parseRow && !config.parseRowByHeader) {
    return NextResponse.json({ error: `Config table="${config.table}" thiếu cả parseRow lẫn parseRowByHeader` }, { status: 500 });
  }
  if (config.parseRowByHeader && (!headers || headers.length === 0)) {
    return NextResponse.json(
      { error: `Config table="${config.table}" đọc theo header nhưng payload không có "headers"` },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project "${projectCode}"`);
    const projectId = projectRes.rows[0].id;

    const parsedRows: Record<string, any>[] = [];
    let skippedRows = 0;
    const skippedRowNumbers: number[] = [];

    for (const row of normalizedRows) {
      const values = config.parseRowByHeader
        ? config.parseRowByHeader(buildGetter(headers as unknown[], row.values))
        : config.parseRow!(row.values);
      if (!values) {
        skippedRows++;
        if (row.row_number !== null) skippedRowNumbers.push(row.row_number);
        continue;
      }
      values.project_id = projectId;
      parsedRows.push(values);
    }

    const useFullReplace =
      change_type === 'FULL_REPLACE' &&
      Array.isArray(config.deleteScopeColumns) &&
      config.deleteScopeColumns.length > 0;

    if (useFullReplace) {
      const totalConsidered = normalizedRows.length;
      const skipRatio = totalConsidered > 0 ? skippedRows / totalConsidered : 0;

      if (skipRatio > FULL_REPLACE_SKIP_RATIO_THRESHOLD) {
        return NextResponse.json(
          {
            error: `Từ chối FULL_REPLACE cho table="${config.table}" tab="${tab_name}": tỷ lệ dòng bị skip quá cao (${(skipRatio * 100).toFixed(1)}%, ngưỡng cho phép ${(FULL_REPLACE_SKIP_RATIO_THRESHOLD * 100).toFixed(0)}%). Không xóa data cũ để tránh mất dữ liệu — vui lòng kiểm tra các dòng bị skip rồi thử lại.`,
            skippedRows,
            totalRows: totalConsidered,
            skipRatio: Number(skipRatio.toFixed(4)),
            skippedRowNumbers: skippedRowNumbers.slice(0, 50),
          },
          { status: 422 }
        );
      }
    }

    // Set timeout riêng cho transaction này — vẫn giữ giá trị mặc định của DB cho
    // các session khác. Đây là lớp bảo vệ phụ, không thay thế cho việc tối ưu
    // DELETE/INSERT ở dưới, chỉ để tránh timeout khi payload đột biến lớn.
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = '120s'`);

    if (useFullReplace && parsedRows.length > 0) {
      const scopeCols = config.deleteScopeColumns!;
      const seenScopes = new Map<string, unknown[]>();
      for (const values of parsedRows) {
        const scopeKey = scopeCols.map((c) => String(values[c])).join('|');
        if (!seenScopes.has(scopeKey)) {
          seenScopes.set(scopeKey, scopeCols.map((c) => values[c]));
        }
      }
      await deleteByScopesChunked(client, config.table, projectId, scopeCols, Array.from(seenScopes.values()));
    }

    let successRows = 0;
    let failedRows = 0;

    if (useFullReplace) {
      const result = await insertRowsBatched(client, config.table, parsedRows);
      successRows = result.successRows;
      failedRows = result.failedRows;
    } else {
      const conflictCols = extractConflictColumnNames(config.conflictColumns);
      const allCols = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
      const updateCols = allCols.filter((c) => !conflictCols.includes(c));
      const result = await insertRowsBatched(client, config.table, parsedRows, {
        conflictColumns: config.conflictColumns,
        updateCols,
      });
      successRows = result.successRows;
      failedRows = result.failedRows;
    }

    await client.query('COMMIT');

    if (skippedRowNumbers.length > 0) {
      console.warn(
        `[SYNC SKIP] table="${config.table}" tab="${tab_name}" sheet_id="${sheet_id}": ${skippedRows} dòng bị skip, row_number = [${skippedRowNumbers.join(', ')}]`
      );
    }

    return NextResponse.json({
      projectCode, table: config.table,
      changeType: change_type ?? 'UPSERT',
      fullReplace: useFullReplace,
      successRows, failedRows, skippedRows, totalRows: rows.length,
      skippedRowNumbers,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    client.release();
  }
}