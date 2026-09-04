// lib/location-aliases.ts
//
// Google Ads và Meta Ads trả tên location theo format khác nhau
// (vd: "Ho Chi Minh City" vs "Ho Chi Minh" vs "TP.HCM"). Nếu group thẳng
// theo string thô thì chart/table sẽ tách thành nhiều entry cho cùng 1 nơi.
// Module này chuẩn hoá về 1 label canonical duy nhất, dùng chung cho mọi
// nơi cần group theo Region (AudiencePage, PlatformAudienceSection, export...).

// key: đã lowercase + bỏ dấu + trim khoảng trắng thừa.
// value: label canonical sẽ hiển thị ra UI.
const REGION_ALIASES: Record<string, string> = {
  // Hồ Chí Minh
  "ho chi minh city": "Hồ Chí Minh",
  "ho chi minh": "Hồ Chí Minh",
  "hcmc": "Hồ Chí Minh",
  "tp.hcm": "Hồ Chí Minh",
  "tp hcm": "Hồ Chí Minh",
  "tp. ho chi minh": "Hồ Chí Minh",
  "thanh pho ho chi minh": "Hồ Chí Minh",
  "ho chi minh city, vietnam": "Hồ Chí Minh",

  // Hà Nội
  "hanoi": "Hà Nội",
  "ha noi": "Hà Nội",
  "hanoi city": "Hà Nội",
  "ha noi city": "Hà Nội",
  "hanoi, vietnam": "Hà Nội",

  // Đà Nẵng
  "da nang": "Đà Nẵng",
  "danang": "Đà Nẵng",
  "da nang city": "Đà Nẵng",

  // Cần Thơ
  "can tho": "Cần Thơ",
  "can tho city": "Cần Thơ",

  // Hải Phòng
  "hai phong": "Hải Phòng",
  "haiphong": "Hải Phòng",

  // TODO: bổ sung thêm khi phát hiện biến thể mới trong data thật
  // (log các label chưa map được — xem hàm `logUnmappedRegions` bên dưới).
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(raw: string): string {
  return stripDiacritics(raw.trim().toLowerCase()).replace(/\s+/g, " ");
}

/**
 * Chuẩn hoá 1 tên location thô về label canonical.
 * Nếu không tìm thấy trong bảng alias, trả lại nguyên bản (đã trim) —
 * không tự ý đoán để tránh gộp nhầm 2 nơi khác nhau.
 */
export function normalizeRegionLabel(raw: string | null | undefined): string {
  if (!raw) return "Không xác định";
  const trimmed = raw.trim();
  if (!trimmed) return "Không xác định";
  const key = normalizeKey(trimmed);
  return REGION_ALIASES[key] ?? trimmed;
}

/**
 * Dùng khi debug: liệt kê các label KHÔNG khớp alias nào, để biết cần bổ
 * sung thêm entry nào vào REGION_ALIASES.
 */
export function findUnmappedRegions(rawValues: (string | null | undefined)[]): string[] {
  const unmapped = new Set<string>();
  for (const raw of rawValues) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!(normalizeKey(trimmed) in REGION_ALIASES)) unmapped.add(trimmed);
  }
  return Array.from(unmapped).sort();
}