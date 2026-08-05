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
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // yyyy-mm-dd (ISO) - ưu tiên nhận trực tiếp
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // dd/mm/yyyy hoặc mm/dd/yyyy - giả định dd/mm/yyyy vì sheet nguồn là VN
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c.length === 4) {
      const day = a.padStart(2, '0');
      const month = b.padStart(2, '0');
      return `${c}-${month}-${day}`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}