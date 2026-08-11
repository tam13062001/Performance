import { syncMasterDataForProject, SyncResult } from './syncMasterData';
import { syncRawSheet } from './syncEngine';
import { getAllRawConfigsForProject } from './syncConfigs';

/**
 * Sync sheet cho 1 project. Nếu truyền `table`, CHỈ chạy sync cho đúng bảng
 * đó (so khớp với `config.table`, hoặc 'ad_daily_metrics' cho MASTER_DATA) —
 * để test nhanh 1 bảng thay vì phải đợi sync hết ~10 bảng mỗi lần.
 * Không truyền `table` = sync toàn bộ như cũ.
 */
export async function syncAllForProject(
  projectCode: string,
  spreadsheetId: string,
  table?: string,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // 1. MASTER_DATA (bảng ad_daily_metrics) - chỉ chạy nếu không filter, hoặc filter đúng bảng này
  if (!table || table === 'ad_daily_metrics') {
    results.push(await syncMasterDataForProject(projectCode, spreadsheetId));
  }

  // 2. Tất cả sheet còn lại - filter theo config.table nếu có
  const configs = getAllRawConfigsForProject(projectCode);
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