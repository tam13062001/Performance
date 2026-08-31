import { PoolClient } from 'pg';
import { pool } from './db';
import { getSheetValues } from './googleSheets';
import { resolveChannelId, resolveCampaignId, parseSheetNumber, parseSheetDate } from './syncHelpers';

const FIELD_ALIASES = {
  phase: ['phase'],
  channel: ['channel'],
  reportDate: ['report_date', 'report date', 'date'],
  campaignName: ['campaign_name', 'campaign name', 'campaign'],
  buyingType: ['buying_type', 'buying type'],
  startDate: ['start_date', 'start date'],
  endDate: ['end_date', 'end date'],
  reach: ['reach'],
  impressions: ['impressions', 'impr.', 'impr'],
  engagements: ['engagements'],
  views: ['views'],
  clicks: ['clicks'],
  linkClicks: ['link_clicks', 'link clicks'],
  landingPageViews: ['landing_page_views', 'landing page views'],
  leads: ['leads'],
  spend: ['spend'],
  region: ['region'],
  asset: ['asset'],
} as const;

export interface SyncResult {
  projectCode: string;
  table?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errorMessage?: string;
  sampleErrors?: string[];
  mergedDuplicateGroups?: number;
  skippedEmpty?: boolean;
  testMode?: boolean;
}

interface AggregatedRow {
  channelName: string;
  campaignName: string;
  reportDate: string;
  phase: string;
  buyingType: string | null;
  startDate: string | null;
  endDate: string | null;
  region: string | null;
  asset: string | null;
  reach: number;
  impressions: number;
  engagements: number;
  views: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  spend: number;
  rowsMerged: number;
}

function normalizeHeader(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function buildGetter(headers: unknown[], rowValues: unknown[]) {
  const map = new Map<string, unknown>();
  headers.forEach((h, idx) => {
    const raw = normalizeHeader(h);
    if (!raw) return;
    if (!map.has(raw)) map.set(raw, rowValues[idx]);
    const underscored = raw.replace(/\s+/g, '_');
    if (!map.has(underscored)) map.set(underscored, rowValues[idx]);
    const spaced = raw.replace(/_/g, ' ');
    if (!map.has(spaced)) map.set(spaced, rowValues[idx]);
  });

  return (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const key = normalizeHeader(alias);
      if (map.has(key)) return map.get(key);
    }
    return undefined;
  };
}

// ===== TÁCH RA DÙNG CHUNG =====
// Đây là phần lõi (group theo conflict key + upsert) của MASTER_DATA, tách
// riêng khỏi việc "lấy data ở đâu ra" (đọc cả sheet qua Sheets API, hay nhận
// rows/headers từ payload webhook). Lý do tách: trước đây MASTER_DATA CHỈ có
// đường batch (syncMasterDataForProject tự gọi getSheetValues), nên khi có
// nhu cầu sync MASTER_DATA qua webhook (real-time), không có chỗ nào để gọi
// vào — vì webhook route chỉ biết tìm config qua findConfigForSheetTab, mà
// MASTER_DATA chưa từng được đăng ký ở đó (nó nằm hẳn ở file này, ngoài danh
// sách RowSyncConfig của syncConfigs.ts). Giờ tách lõi ra để cả 2 đường
// (batch VÀ webhook) đều gọi chung 1 chỗ, tránh sau này sửa logic gộp/upsert
// mà quên sửa đồng bộ ở 2 nơi.
//
// LƯU Ý: hàm này KHÔNG tự BEGIN/COMMIT — transaction do caller quản lý, vì
// webhook route cần kiểm soát transaction ở cấp request chứ không phải cấp
// từng bảng.
export async function processMasterDataRows(
  client: PoolClient,
  projectId: number,
  projectCode: string,
  batchId: number | null,
  headers: unknown[],
  dataRows: unknown[][]
): Promise<{ successRows: number; failedRows: number; sampleErrors: string[]; mergedDuplicateGroups: number }> {
  let failedRows = 0;
  const sampleErrors: string[] = [];

  // ---------- BƯỚC 1: gộp (SUM) các dòng trùng conflict key ----------
  const grouped = new Map<string, AggregatedRow>();
  for (const row of dataRows) {
    const get = buildGetter(headers, row);

    const channelName = String(get(FIELD_ALIASES.channel) ?? '').trim();
    const campaignName = String(get(FIELD_ALIASES.campaignName) ?? '').trim();
    const reportDate = parseSheetDate(get(FIELD_ALIASES.reportDate));

    if (!channelName || !campaignName || !reportDate) {
      failedRows++;
      if (sampleErrors.length < 5) {
        sampleErrors.push(`Thiếu dữ liệu bắt buộc (channel="${channelName}", campaign="${campaignName}", date="${get(FIELD_ALIASES.reportDate)}")`);
      }
      continue;
    }

    const phase = String(get(FIELD_ALIASES.phase) ?? 'other').trim().toLowerCase();
    const buyingTypeRaw = get(FIELD_ALIASES.buyingType);
    const buyingType = buyingTypeRaw ? String(buyingTypeRaw).trim() : null;
    const startDate = parseSheetDate(get(FIELD_ALIASES.startDate));
    const endDate = parseSheetDate(get(FIELD_ALIASES.endDate));
    const regionRaw = get(FIELD_ALIASES.region);
    const region = regionRaw ? String(regionRaw).trim() : null;
    const assetRaw = get(FIELD_ALIASES.asset);
    const asset = assetRaw ? String(assetRaw).trim() : null;

    const key = [channelName.toLowerCase(), campaignName, reportDate, buyingType ?? '', asset ?? ''].join('::');

    const existing = grouped.get(key);
    const reach = parseSheetNumber(get(FIELD_ALIASES.reach));
    const impressions = parseSheetNumber(get(FIELD_ALIASES.impressions));
    const engagements = parseSheetNumber(get(FIELD_ALIASES.engagements));
    const views = parseSheetNumber(get(FIELD_ALIASES.views));
    const clicks = parseSheetNumber(get(FIELD_ALIASES.clicks));
    const linkClicks = parseSheetNumber(get(FIELD_ALIASES.linkClicks));
    const landingPageViews = parseSheetNumber(get(FIELD_ALIASES.landingPageViews));
    const leads = parseSheetNumber(get(FIELD_ALIASES.leads));
    const spend = parseSheetNumber(get(FIELD_ALIASES.spend));

    if (existing) {
      existing.reach += reach;
      existing.impressions += impressions;
      existing.engagements += engagements;
      existing.views += views;
      existing.clicks += clicks;
      existing.linkClicks += linkClicks;
      existing.landingPageViews += landingPageViews;
      existing.leads += leads;
      existing.spend += spend;
      existing.rowsMerged += 1;
    } else {
      grouped.set(key, {
        channelName, campaignName, reportDate,
        phase: ['awareness', 'consideration', 'conversion'].includes(phase) ? phase : 'other',
        buyingType, startDate, endDate, region, asset,
        reach, impressions, engagements, views, clicks, linkClicks, landingPageViews, leads, spend,
        rowsMerged: 1,
      });
    }
  }

  const mergedDuplicateGroups = [...grouped.values()].filter((g) => g.rowsMerged > 1).length;
  if (mergedDuplicateGroups > 0) {
    console.warn(
      `[syncMasterData] ${projectCode}: ${mergedDuplicateGroups} nhóm dòng bị trùng conflict key đã được cộng dồn ` +
      `(tổng ${[...grouped.values()].reduce((s, g) => s + g.rowsMerged - 1, 0)} dòng thừa).`
    );
  }

  // ---------- BƯỚC 2: upsert từng dòng đã gộp ----------
  let successRows = 0;
  const channelIdCache = new Map<string, number>();
  const campaignIdCache = new Map<string, number>();

  for (const g of grouped.values()) {
    await client.query('SAVEPOINT row_sp');
    try {
      const channelId = channelIdCache.get(g.channelName.toLowerCase())
        ?? await resolveChannelId(client, g.channelName);
      channelIdCache.set(g.channelName.toLowerCase(), channelId);

      const campaignCacheKey = `${channelId}::${g.campaignName}`;
      const campaignId = campaignIdCache.get(campaignCacheKey)
        ?? await resolveCampaignId(client, {
          projectId, channelId, campaignName: g.campaignName,
          phase: g.phase, buyingType: g.buyingType, startDate: g.startDate, endDate: g.endDate,
        });
      campaignIdCache.set(campaignCacheKey, campaignId);

      await client.query(
        `INSERT INTO ad_daily_metrics (
          project_id, campaign_id, channel_id, import_batch_id,
          project_code, phase, channel, report_date, campaign_name, buying_type,
          start_date, end_date, region, asset,
          reach, impressions, engagements, views, clicks, link_clicks,
          landing_page_views, leads, spend
        ) VALUES (
          $1,$2,$3,$4, $5,$6,$7,$8,$9,$10, $11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20,$21,$22,$23
        )
        ON CONFLICT (project_id, channel_id, campaign_name, report_date, COALESCE(buying_type, ''), COALESCE(asset, ''))
        DO UPDATE SET
          campaign_id = EXCLUDED.campaign_id,
          import_batch_id = EXCLUDED.import_batch_id,
          phase = EXCLUDED.phase,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          region = EXCLUDED.region,
          asset = EXCLUDED.asset,
          reach = EXCLUDED.reach,
          impressions = EXCLUDED.impressions,
          engagements = EXCLUDED.engagements,
          views = EXCLUDED.views,
          clicks = EXCLUDED.clicks,
          link_clicks = EXCLUDED.link_clicks,
          landing_page_views = EXCLUDED.landing_page_views,
          leads = EXCLUDED.leads,
          spend = EXCLUDED.spend`,
        [
          projectId, campaignId, channelId, batchId,
          projectCode, g.phase, g.channelName, g.reportDate, g.campaignName, g.buyingType,
          g.startDate, g.endDate, g.region, g.asset,
          g.reach, g.impressions, g.engagements, g.views, g.clicks, g.linkClicks,
          g.landingPageViews, g.leads, g.spend,
        ]
      );
      await client.query('RELEASE SAVEPOINT row_sp');
      successRows++;
    } catch (rowErr) {
      await client.query('ROLLBACK TO SAVEPOINT row_sp');
      const msg = (rowErr as Error).message;
      console.error(`Lỗi ở row (project=${projectCode}, table=ad_daily_metrics):`, msg);
      if (sampleErrors.length < 5) sampleErrors.push(msg);
      failedRows++;
    }
  }

  return { successRows, failedRows, sampleErrors, mergedDuplicateGroups };
}

// syncMasterDataForProject giờ chỉ còn nhiệm vụ: lấy data (đọc cả sheet qua
// Sheets API), rồi gọi processMasterDataRows để xử lý — logic gộp/upsert
// KHÔNG còn lặp lại ở đây nữa.
export async function syncMasterDataForProject(
  projectCode: string,
  spreadsheetId: string,
  tabName: string = 'MASTER_DATA',
  testMode: boolean = false
): Promise<SyncResult> {
  const client = await pool.connect();
  let batchId: number | null = null;

  try {
    const projectRes = await client.query(
      `SELECT id, uses_legacy_master_data FROM ad_projects WHERE project_code = $1`,
      [projectCode]
    );
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project_code "${projectCode}" trong ad_projects`);
    const projectId = projectRes.rows[0].id;

    if (!projectRes.rows[0].uses_legacy_master_data) {
      return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    let rawRows: unknown[][];
    try {
      rawRows = await getSheetValues(spreadsheetId, tabName);
    } catch (fetchErr) {
      const msg = (fetchErr as Error).message ?? '';
      if (/unable to parse range|not found/i.test(msg)) {
        return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
      }
      throw fetchErr;
    }

    if (rawRows.length === 0) {
      return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    const headers = rawRows[0];

    if (!testMode) {
      const batchRes = await client.query(
        `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status)
         VALUES ($1, $2, $3, 'processing') RETURNING id`,
        [projectId, spreadsheetId, tabName]
      );
      batchId = batchRes.rows[0].id;
    }

    const dataRows = rawRows
      .slice(1)
      .filter((row) => row.length > 0 && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''));

    if (dataRows.length === 0) {
      if (!testMode) {
        await client.query(`UPDATE ad_import_batches SET status = 'success', total_rows = 0, success_rows = 0, failed_rows = 0 WHERE id = $1`, [batchId]);
      }
      return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true, testMode };
    }

    await client.query('BEGIN');
    const { successRows, failedRows, sampleErrors, mergedDuplicateGroups } =
      await processMasterDataRows(client, projectId, projectCode, batchId, headers, dataRows);

    if (testMode) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
      await client.query(
        `UPDATE ad_import_batches SET status = 'success', total_rows = $1, success_rows = $2, failed_rows = $3 WHERE id = $4`,
        [dataRows.length, successRows, failedRows, batchId]
      );
    }

    return {
      projectCode, table: 'ad_daily_metrics',
      totalRows: dataRows.length, successRows, failedRows, sampleErrors,
      mergedDuplicateGroups, testMode,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const message = (err as Error).message;
    if (batchId) {
      await client.query(`UPDATE ad_import_batches SET status = 'failed', error_message = $1 WHERE id = $2`, [message, batchId]).catch(() => {});
    }
    return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, errorMessage: message };
  } finally {
    client.release();
  }
}

// ===== HÀM MỚI — dùng cho webhook =====
// Tìm project nào đang dùng layout MASTER_DATA cũ (uses_legacy_master_data =
// true) và có sheet chính (sync_projects.sheet_id) trùng với sheet_id trong
// payload webhook. Trả về null nếu không khớp project nào — lúc đó webhook
// route sẽ rơi về nhánh xử lý cũ (findConfigForSheetTab) như bình thường.
export async function findLegacyMasterDataProject(
  sheetId: string
): Promise<{ projectId: number; projectCode: string } | null> {
  const res = await pool.query(
    `SELECT p.id AS project_id, p.project_code
     FROM ad_projects p
     JOIN sync_projects sp ON sp.project_code = p.project_code
     WHERE sp.sheet_id = $1 AND p.uses_legacy_master_data = true`,
    [sheetId]
  );
  if (res.rows.length === 0) return null;
  return { projectId: res.rows[0].project_id, projectCode: res.rows[0].project_code };
}