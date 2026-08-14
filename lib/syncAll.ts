import { syncMasterDataForProject, SyncResult } from './syncMasterData';
import { syncRawSheet } from './syncEngine';
import { getAllRawConfigsForProject } from './syncConfigs';

export async function syncAllForProject(
  projectCode: string,
  spreadsheetId: string,
  table?: string,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  if (!table || table === 'ad_daily_metrics') {
    results.push(await syncMasterDataForProject(projectCode, spreadsheetId));
  }

  const configs = await getAllRawConfigsForProject(projectCode); // ⬅️ thêm await
  for (const config of configs) {
    if (table && config.table !== table) continue;
    results.push(await syncRawSheet(projectCode, spreadsheetId, config));
  }

  if (table && results.length === 0) {
    results.push({
      projectCode,
      table,
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      errorMessage: `Không tìm thấy config nào có table = "${table}" cho project "${projectCode}". Kiểm tra lại tên bảng.`,
    });
  }

  return results;
}