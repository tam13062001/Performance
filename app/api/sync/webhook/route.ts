import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { findConfigForSheetTab } from '@/lib/syncConfigs';

type WebhookRowNew = { row_number: number; values: unknown[] };

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

// Xây hàm get(aliases) giống hệt cách parseRowByHeader kỳ vọng:
// truyền vào danh sách alias (vd ['buying_type', 'buying type']), trả về giá trị đầu tiên khớp.
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

// Bóc tên cột thật ra khỏi conflictColumns, kể cả khi có COALESCE(col, '') bọc quanh
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

  if (!sheet_id || !tab_name || !rows || rows.length === 0) {
    return NextResponse.json({ error: 'Thiếu sheet_id, tab_name hoặc rows' }, { status: 400 });
  }

  const rawRows: unknown[][] = rows.map((r) => (Array.isArray(r) ? r : (r as WebhookRowNew).values));

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

    // Parse toàn bộ trước, để biết được scope thật sự cần xóa (nếu có)
    const parsedRows: Record<string, any>[] = [];
    let skippedRows = 0;
    for (const row of rawRows) {
      const values = config.parseRowByHeader
        ? config.parseRowByHeader(buildGetter(headers as unknown[], row))
        : config.parseRow!(row);
      if (!values) { skippedRows++; continue; }
      values.project_id = projectId;
      parsedRows.push(values);
    }

    const useFullReplace =
      change_type === 'FULL_REPLACE' &&
      Array.isArray(config.deleteScopeColumns) &&
      config.deleteScopeColumns.length > 0;

    await client.query('BEGIN');

    if (useFullReplace && parsedRows.length > 0) {
      // Chỉ xóa đúng phạm vi (VD period_month = 'YTD') — không đụng vào MTD hay tab khác dùng chung bảng
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
    // Nếu tab bị xóa sạch dữ liệu (parsedRows rỗng) thì KHÔNG xóa gì trong DB —
    // an toàn hơn là xóa nhầm toàn bộ khi header/parse bị lỗi tạm thời.

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

    return NextResponse.json({
      projectCode, table: config.table,
      changeType: change_type ?? 'UPSERT',
      fullReplace: useFullReplace,
      successRows, failedRows, skippedRows, totalRows: rawRows.length,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    client.release();
  }
}