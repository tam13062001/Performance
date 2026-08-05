import { google } from 'googleapis';

export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY trong .env.local');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

/** Lấy toàn bộ giá trị của 1 tab, trả về mảng 2 chiều (row x col), row đầu là header */
export async function getSheetValues(spreadsheetId: string, tabName: string) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabName, // lấy toàn bộ tab, không giới hạn range
  });
  return res.data.values ?? [];
}

/** Liệt kê tên tất cả các tab trong 1 spreadsheet */
export async function listSheetTabs(spreadsheetId: string) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets ?? []).map((s) => s.properties?.title ?? '(unnamed)');
}