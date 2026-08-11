import { pool } from './db';
import { getSheetValues } from './googleSheets';

export interface SyncResult {
  projectCode: string;
  table?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  skippedEmpty?: boolean;
  errorMessage?: string;
  sampleErrors?: string[];
}

export interface RowSyncConfig {
  table: string;
  tabName: string;
  /** Phải khớp CHÍNH XÁC với biểu thức trong unique index đã tạo ở migration */
  conflictColumns: string;
  /** Trả về map cột->giá trị để insert, hoặc null nếu dòng không hợp lệ/rỗng (bỏ qua, không tính lỗi) */
  parseRow: (row: unknown[]) => Record<string, unknown> | null;
}

export async function syncRawSheet(
  projectCode: string,
  spreadsheetId: string,
  config: RowSyncConfig
): Promise<SyncResult> {
  const client = await pool.connect();
  let batchId: number | null = null;

  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project_code "${projectCode}"`);
    const projectId = projectRes.rows[0].id;

    const rawRows = await getSheetValues(spreadsheetId, config.tabName);
    const dataRows = rawRows.slice(1).filter((r) => r.length > 0);

    if (dataRows.length === 0) {
      return { projectCode, table: config.table, totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    const batchRes = await client.query(
      `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status)
       VALUES ($1,$2,$3,'processing') RETURNING id`,
      [projectId, spreadsheetId, config.tabName]
    );
    batchId = batchRes.rows[0].id;

    let successRows = 0;
    let failedRows = 0;
    let skippedRows = 0;
    const sampleErrors: string[] = [];

    await client.query('BEGIN');

    for (const row of dataRows) {
      await client.query('SAVEPOINT row_sp');
      try {
        const values = config.parseRow(row);
        if (!values) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp');
          skippedRows++;
          continue;
        }
        values.project_id = projectId;
        values.import_batch_id = batchId;

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
      [dataRows.length, successRows, failedRows, batchId]
    );

    return {
      projectCode,
      table: config.table,
      totalRows: dataRows.length,
      successRows,
      failedRows,
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