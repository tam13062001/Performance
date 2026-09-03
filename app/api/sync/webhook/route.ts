import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { findConfigForSheetTab } from '@/lib/syncConfigs';
import { findLegacyMasterDataProject, processMasterDataRows } from '@/lib/syncMasterData';

type WebhookRowNew = { row_number: number; values: unknown[] };

const FULL_REPLACE_SKIP_RATIO_THRESHOLD = 0.05;

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

  // ===== FIX MASTER_DATA — MASTER_DATA không nằm trong getAllRawConfigsForProject
  // (nó dùng aggregation SUM + resolveChannelId/resolveCampaignId riêng, khác hẳn
  // pattern RowSyncConfig của các bảng khác), nên findConfigForSheetTab luôn trả
  // null cho tab này -> webhook cũ báo 404 dù project có bật uses_legacy_master_data.
  // Giờ chặn sớm: nếu tab_name là MASTER_DATA VÀ sheet_id khớp đúng 1 project đang
  // dùng layout cũ, xử lý ngay bằng processMasterDataRows (dùng chung logic với
  // batch flow), không đi qua findConfigForSheetTab/parseRow nữa.
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
          skippedRows: failedRows, // MASTER_DATA không phân biệt "skip" vs "failed" — thiếu field bắt buộc tính chung vào failedRows
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
    // Không khớp project nào dùng layout cũ -> rơi xuống nhánh chung bên dưới,
    // sẽ trả 404 "không tìm thấy config" như trước (đúng, vì project đó không
    // nên có tab MASTER_DATA).
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

    await client.query('BEGIN');

    if (useFullReplace && parsedRows.length > 0) {
      const scopeCols = config.deleteScopeColumns!;
      const seenScopes = new Set<string>();
      for (const values of parsedRows) {
        const scopeKey = scopeCols.map((c) => String(values[c])).join('|');
        if (seenScopes.has(scopeKey)) continue;
        seenScopes.add(scopeKey);

        const whereCols = ['project_id', ...scopeCols];
        const whereVals = [projectId, ...scopeCols.map((c) => values[c])];
        const whereClause = whereCols.map((c, i) => `${c} = $${i + 1}`).join(' AND ');
        await client.query(`DELETE FROM ${config.table} WHERE ${whereClause}`, whereVals);
      }
    }

    let successRows = 0;
    let failedRows = 0;

    for (const values of parsedRows) {
      const cols = Object.keys(values);
      const placeholders = cols.map((_, i) => `$${i + 1}`);

      let sql: string;
      if (useFullReplace) {
        sql = `INSERT INTO ${config.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;
      } else {
        const conflictCols = extractConflictColumnNames(config.conflictColumns);
        const updateCols = cols.filter((c) => !conflictCols.includes(c));
        const updateSetClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
        sql = updateCols.length > 0
          ? `INSERT INTO ${config.table} (${cols.join(', ')})
             VALUES (${placeholders.join(', ')})
             ON CONFLICT (${config.conflictColumns})
             DO UPDATE SET ${updateSetClause}`
          : `INSERT INTO ${config.table} (${cols.join(', ')})
             VALUES (${placeholders.join(', ')})
             ON CONFLICT (${config.conflictColumns}) DO NOTHING`;
      }

      try {
        await client.query(sql, cols.map((c) => values[c]));
        successRows++;
      } catch (e) {
        console.error(`Webhook insert lỗi (${config.table}):`, (e as Error).message);
        failedRows++;
      }
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