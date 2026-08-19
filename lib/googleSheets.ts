import { google } from 'googleapis';
import { createPrivateKey } from 'crypto';

/**
 * Chuẩn hoá private key lấy từ env: xử lý cả 2 trường hợp:
 *  - key lưu với \n dạng chuỗi ký tự (phổ biến khi set qua UI như Vercel)
 *  - key bị dính dấu " bao ngoài do copy nhầm khi dán vào env
 *  - key có khoảng trắng/ký tự ẩn ở đầu/cuối
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  // Nếu bị dính nguyên cặp dấu " ở đầu/cuối (copy nhầm cả quote khi set env) -> bỏ đi
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }

  // Xử lý cả 2 kiểu: \\n (double-escaped) và \n (single-escaped)
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');

  return key.trim();
}

/**
 * Validate key có đúng format PEM không, và log ra thông tin CHẨN ĐOÁN
 * (không log key thật) để dễ debug lỗi "DECODER routines::unsupported".
 */
function assertValidPrivateKey(key: string, email: string | undefined) {
  const hasBegin = key.includes('-----BEGIN PRIVATE KEY-----');
  const hasEnd = key.includes('-----END PRIVATE KEY-----');
  const lineCount = key.split('\n').length;

  if (!hasBegin || !hasEnd) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY sai format PEM (thiếu BEGIN/END marker). ` +
      `hasBegin=${hasBegin} hasEnd=${hasEnd} lineCount=${lineCount} email=${email ?? 'MISSING'}. ` +
      `Kiểm tra lại giá trị env — có thể bị copy thiếu dòng hoặc \\n chưa được convert đúng.`
    );
  }

  // Thử decode thật bằng Node crypto để bắt lỗi SỚM, với message rõ ràng hơn
  // thay vì để lỗi mờ mịt "DECODER routines::unsupported" xảy ra sâu bên trong googleapis/JWT.
  try {
    createPrivateKey(key);
  } catch (err) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY không decode được (PEM bị hỏng nội dung, không phải thiếu marker). ` +
      `lineCount=${lineCount} email=${email ?? 'MISSING'}. Lỗi gốc: ${(err as Error).message}`
    );
  }
}

export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error('Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY trong .env.local');
  }

  const privateKey = normalizePrivateKey(rawKey);
  assertValidPrivateKey(privateKey, email);

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