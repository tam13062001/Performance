import { PoolClient } from 'pg';

/** Tìm channel_id theo tên (không phân biệt hoa thường); nếu chưa có thì tự tạo mới */
export async function resolveChannelId(client: PoolClient, channelName: string): Promise<number> {
  const name = channelName.trim();

  const found = await client.query(
    `SELECT id FROM ad_channels WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (found.rows.length > 0) return found.rows[0].id;

  const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const inserted = await client.query(
    `INSERT INTO ad_channels (code, name) VALUES ($1, $2)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [code, name]
  );
  return inserted.rows[0].id;
}

/** Tìm campaign_id theo (project_id, channel_id, campaign_name); nếu chưa có thì tự tạo mới */
export async function resolveCampaignId(
  client: PoolClient,
  params: {
    projectId: number;
    channelId: number;
    campaignName: string;
    phase?: string;
    buyingType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }
): Promise<number> {
  const { projectId, channelId, campaignName, phase, buyingType, startDate, endDate } = params;

  const found = await client.query(
    `SELECT id FROM ad_campaigns WHERE project_id = $1 AND channel_id = $2 AND campaign_name = $3 LIMIT 1`,
    [projectId, channelId, campaignName]
  );
  if (found.rows.length > 0) return found.rows[0].id;

  const inserted = await client.query(
    `INSERT INTO ad_campaigns (project_id, channel_id, campaign_name, phase, buying_type, start_date, end_date)
     VALUES ($1, $2, $3, COALESCE($4, 'other'), $5, $6, $7)
     RETURNING id`,
    [projectId, channelId, campaignName, phase ?? null, buyingType ?? null, startDate ?? null, endDate ?? null]
  );
  return inserted.rows[0].id;
}

/** Parse số từ chuỗi Google Sheet (có thể có dấu phẩy ngăn cách nghìn, ký tự %, khoảng trắng...) */
export function parseSheetNumber(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const cleaned = String(raw).replace(/[,%\s]/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Parse ngày từ chuỗi Google Sheet, hỗ trợ vài định dạng phổ biến (yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy) */
export function parseSheetDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Nếu raw đã là Date object (một số client Google Sheets tự parse sẵn) -> LUÔN đọc theo UTC,
  // không dùng String(raw)/toString() vì nó theo local timezone của server, gây lệch ngày.
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(raw).trim();
  if (!str) return null;

  // yyyy-mm-dd (ISO) - nhận trực tiếp phần đầu, không qua new Date()
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // dd/mm/yyyy hoặc mm/dd/yyyy - giả định dd/mm/yyyy vì sheet nguồn là VN
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4 && /^\d+$/.test(a) && /^\d+$/.test(b)) {
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
  }

  // Serial number kiểu Google Sheets (số ngày kể từ 1899-12-30) - phòng trường hợp
  // getSheetValues trả UNFORMATTED_VALUE thay vì string ngày.
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = Number(str);
    if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
      const utcMs = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
      return new Date(utcMs).toISOString().slice(0, 10);
    }
  }

  // Fallback cuối - luôn đọc lại theo UTC getters, không dùng local
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

function normalizeHeader(h: string): string {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Nhận rows thô từ Google Sheets (rows[0] = header), trả về:
 * - headerMap: tên cột đã normalize -> index
 * - dataRows: các dòng data (đã bỏ header)
 */
export function indexByHeader(rows: any[][]): { headerMap: Record<string, number>; dataRows: any[][] } {
  const headerMap: Record<string, number> = {};
  const header = rows[0] ?? [];
  header.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key) headerMap[key] = i;
  });
  return { headerMap, dataRows: rows.slice(1) };
}

/**
 * Field accessor hỗ trợ nhiều alias (vì tên cột có thể viết khác nhau
 * giữa các project, vd "Reach" vs "reach" vs "Total Reach").
 */
export function makeFieldGetter(headerMap: Record<string, number>, row: any[]) {
  return (aliases: string | string[]): any => {
    const list = Array.isArray(aliases) ? aliases : [aliases];
    for (const a of list) {
      const idx = headerMap[normalizeHeader(a)];
      if (idx !== undefined) return row[idx];
    }
    return undefined;
  };
}