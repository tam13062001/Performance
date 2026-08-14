import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { findConfigForSheetTab } from '@/lib/syncConfigs';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret');
  if (secret !== process.env.SHEET_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { sheet_id, tab_name, rows } = body as {
    sheet_id?: string;
    tab_name?: string;
    rows?: unknown[][]; // mảng các dòng mới, mỗi dòng là mảng giá trị cột
  };

  if (!sheet_id || !tab_name || !rows || rows.length === 0) {
    return NextResponse.json({ error: 'Thiếu sheet_id, tab_name hoặc rows' }, { status: 400 });
  }

  // Tìm đúng project + config khớp sheet_id + tab_name (bao gồm cả sheetIdOverride demographic)
  const match = await findConfigForSheetTab(sheet_id, tab_name);
  if (!match) {
    return NextResponse.json({ error: `Không tìm thấy config nào khớp sheet_id="${sheet_id}" tab="${tab_name}"` }, { status: 404 });
  }

  const { projectCode, config } = match;
  const client = await pool.connect();
  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project "${projectCode}"`);
    const projectId = projectRes.rows[0].id;

    let successRows = 0;
    let failedRows = 0;

    for (const row of rows) {
      const values = config.parseRow(row as unknown[]);
      if (!values) continue; // dòng rỗng/không hợp lệ, bỏ qua

      values.project_id = projectId;

      const cols = Object.keys(values);
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const sql = `INSERT INTO ${config.table} (${cols.join(', ')})
                   VALUES (${placeholders.join(', ')})
                   ON CONFLICT (${config.conflictColumns}) DO NOTHING`;
      try {
        await client.query(sql, cols.map((c) => values[c]));
        successRows++;
      } catch (e) {
        console.error(`Webhook insert lỗi (${config.table}):`, (e as Error).message);
        failedRows++;
      }
    }

    return NextResponse.json({ projectCode, table: config.table, successRows, failedRows, totalRows: rows.length });
  } finally {
    client.release();
  }
}