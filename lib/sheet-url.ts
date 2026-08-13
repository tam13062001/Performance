// lib/sheet-url.ts

/**
 * Nhận nhiều dạng URL Google Sheets người dùng có thể paste:
 * - https://docs.google.com/spreadsheets/d/1AbCxyz.../edit#gid=0
 * - https://docs.google.com/spreadsheets/d/1AbCxyz.../edit?usp=sharing
 * - https://docs.google.com/spreadsheets/u/1/d/1AbCxyz.../edit  ⬅️ dạng multi-account (u/0, u/1, u/2...)
 * - https://docs.google.com/spreadsheets/d/1AbCxyz.../
 * - hoặc chỉ paste thẳng sheet ID (không phải URL)
 */
export function extractSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Case 1: URL Google Sheets — có hoặc không có đoạn /u/{n}/ ở giữa
  const urlMatch = trimmed.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];

  // Case 2: người dùng paste thẳng ID (chuỗi 20+ ký tự, chữ/số/-/_)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

export function buildSheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}