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
  // Cờ đánh dấu: master data (ad_daily_metrics) đã được xử lý ở nhánh dưới
  // hay chưa. Dùng để tránh báo lỗi "không tìm thấy config" giả — vì
  // ad_daily_metrics không nằm trong getAllRawConfigsForProject, nó luôn có
  // matchCount = 0 dù đã sync thành công ở syncMasterDataForProject rồi.
  let handledByMasterData = false;

  // Bỏ qua sync master data nếu đang lọc tab cụ thể
  if (!tabFilter && (!table || table === 'ad_daily_metrics')) {
    // 🔧 FIX — trước đây gọi syncMasterDataForProject(projectCode, spreadsheetId)
    // không truyền testMode, nên dù URL có test=true/false, bảng ad_daily_metrics
    // vẫn luôn ghi thật (testMode bị bỏ qua hoàn toàn). Giờ truyền testMode xuống
    // đúng như các bảng khác qua syncRawSheet bên dưới.
    results.push(await syncMasterDataForProject(projectCode, spreadsheetId, undefined, testMode));
    handledByMasterData = true;
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

  // 🔧 FIX #2 — chỉ báo lỗi "không tìm thấy config" khi thực sự không có
  // nhánh nào xử lý request này. Trước đây, filter table=ad_daily_metrics sẽ
  // LUÔN rơi vào đây (vì ad_daily_metrics không có trong raw configs), kể cả
  // khi syncMasterDataForProject ở trên đã chạy và trả về thành công — gây
  // ra 1 kết quả lỗi giả trong mảng results dù sync không có gì sai.
  if (matchCount === 0 && !handledByMasterData) {
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