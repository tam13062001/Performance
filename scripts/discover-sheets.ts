/**
 * Chạy: npm run discover
 * Mục đích: liệt kê tên tab + header cột thật của từng tab
 * trong 2 Google Sheet (MMU, Tanakan), để map chính xác vào DB
 * thay vì đoán tên cột.
 */
import 'dotenv/config';
import { listSheetTabs, getSheetValues } from '../lib/googleSheets';

async function inspectSpreadsheet(label: string, spreadsheetId: string | undefined) {
  if (!spreadsheetId) {
    console.log(`⚠️  Bỏ qua ${label}: thiếu spreadsheet ID trong .env.local`);
    return;
  }

  console.log(`\n========== ${label} (${spreadsheetId}) ==========`);

  const tabs = await listSheetTabs(spreadsheetId);
  console.log(`Tìm thấy ${tabs.length} tab:`, tabs);

  for (const tab of tabs) {
    try {
      const values = await getSheetValues(spreadsheetId, `${tab}!A1:Z1`); // chỉ lấy header row
      const header = values[0] ?? [];
      console.log(`\n--- Tab: "${tab}" ---`);
      if (header.length === 0) {
        console.log('  (trống, không có header)');
      } else {
        header.forEach((col: string, i: number) => console.log(`  [${i}] ${col}`));
      }
    } catch (err) {
      console.log(`  ❌ Lỗi đọc tab "${tab}":`, (err as Error).message);
    }
  }
}

async function main() {
  await inspectSpreadsheet('TANAKAN (Branding)', process.env.GOOGLE_SHEET_TANAKAN_ID);
  await inspectSpreadsheet('MMU (Branding)', process.env.GOOGLE_SHEET_MMU_ID);
}

main().catch((err) => {
  console.error('Script lỗi:', err);
  process.exit(1);
});