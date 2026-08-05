import { syncMasterDataForProject, SyncResult } from './syncMasterData';
import { syncRawSheet } from './syncEngine';
import { getAllRawConfigsForProject } from './syncConfigs';

/** Sync toàn bộ sheet (MASTER_DATA + tất cả raw/planning tables) cho 1 project */
export async function syncAllForProject(projectCode: string, spreadsheetId: string): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // 1. MASTER_DATA trước - đây là bảng tổng hợp chính, dùng cho dashboard
  results.push(await syncMasterDataForProject(projectCode, spreadsheetId));

  // 2. Tất cả sheet còn lại
  const configs = getAllRawConfigsForProject(projectCode);
  for (const config of configs) {
    results.push(await syncRawSheet(projectCode, spreadsheetId, config));
  }

  return results;
}