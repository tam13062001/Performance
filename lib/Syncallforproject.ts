import { syncMasterDataForProject, SyncResult } from './syncMasterData';
import { syncRawSheet } from './syncEngine';
import { getAllRawConfigsForProject } from './syncConfigs';

export async function syncAllForProject(
  projectCode: string,
  spreadsheetId: string,
  table?: string,
  testMode: boolean = true,
  tabFilter?: string
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Bỏ qua sync master data nếu đang lọc tab cụ thể
  if (!tabFilter && (!table || table === 'ad_daily_metrics')) {
    // 🔧 FIX — trước đây gọi syncMasterDataForProject(projectCode, spreadsheetId)
    // không truyền testMode, nên dù URL có test=true/false, bảng ad_daily_metrics
    // vẫn luôn ghi thật (testMode bị bỏ qua hoàn toàn). Giờ truyền testMode xuống
    // đúng như các bảng khác qua syncRawSheet bên dưới.
    results.push(await syncMasterDataForProject(projectCode, spreadsheetId, undefined, testMode));
  }

  const configs = await getAllRawConfigsForProject(projectCode);
  let matchCount = 0;

  for (const config of configs) {
    if (table && config.table !== table) continue;
    
    if (tabFilter) {
      const tabNames = Array.isArray(config.tabName) ? config.tabName : [config.tabName];
      const isMatch = tabNames.some(t => t.toLowerCase().includes(tabFilter.toLowerCase()));
      if (!isMatch) continue;
    }

    matchCount++;
    results.push(await syncRawSheet(projectCode, spreadsheetId, config, testMode));
  }

  if (matchCount === 0) {
    results.push({
      projectCode,
      table: table || 'All',
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      errorMessage: `Không tìm thấy config nào khớp với điều kiện (table: ${table || 'Bất kỳ'}, tab: ${tabFilter || 'Bất kỳ'}).`,
    });
  }

  return results;
}