// lib/sync-demographic.ts
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

// ============================================================
// 1. TYPES
// ============================================================

type Platform = 'google' | 'meta' | 'tiktok' | 'youtube'; 

type TabMeta = {
  platform: Platform;
  dimension: 'age' | 'gender' | 'region';
  period: 'YTD' | 'MTD';
};

type ParsedRow = {
  campaign_name: string | null;
  breakdown_value: string;
  impressions: number;
  clicks: number;
  reach: number | null; // Sẽ dùng để chứa "TrueView views" của YouTube
  spend: number | null;
  ctr: number;
};

type ParseResult = {
  periodStart: string | null;
  periodEnd: string | null;
  rows: ParsedRow[];
};

// ============================================================
// 2. TAB META MAP
// ============================================================

export const DEMOGRAPHIC_TAB_META: Record<string, TabMeta> = {
  // --- Google ---
  ytd_search_age:    { platform: 'google', dimension: 'age',    period: 'YTD' },
  mtd_search_age:    { platform: 'google', dimension: 'age',    period: 'MTD' },
  ytd_search_gender: { platform: 'google', dimension: 'gender', period: 'YTD' },
  mtd_search_gender: { platform: 'google', dimension: 'gender', period: 'MTD' },
  ytd_search_region: { platform: 'google', dimension: 'region', period: 'YTD' },
  mtd_search_region: { platform: 'google', dimension: 'region', period: 'MTD' },

  // --- Meta ---
  ytd_age:    { platform: 'meta', dimension: 'age',    period: 'YTD' },
  mtd_age:    { platform: 'meta', dimension: 'age',    period: 'MTD' },
  ytd_gender: { platform: 'meta', dimension: 'gender', period: 'YTD' },
  mtd_gender: { platform: 'meta', dimension: 'gender', period: 'MTD' },
  ytd_region: { platform: 'meta', dimension: 'region', period: 'YTD' },
  mtd_region: { platform: 'meta', dimension: 'region', period: 'MTD' },

  // --- TikTok ---
  ytd_tiktok_age:    { platform: 'tiktok', dimension: 'age',    period: 'YTD' },
  mtd_tiktok_age:    { platform: 'tiktok', dimension: 'age',    period: 'MTD' },
  ytd_tiktok_gender: { platform: 'tiktok', dimension: 'gender', period: 'YTD' },
  mtd_tiktok_gender: { platform: 'tiktok', dimension: 'gender', period: 'MTD' },
  ytd_tiktok_region: { platform: 'tiktok', dimension: 'region', period: 'YTD' },
  mtd_tiktok_region: { platform: 'tiktok', dimension: 'region', period: 'MTD' },

  // --- YouTube ---
  ytd_youtube_age:    { platform: 'youtube', dimension: 'age',    period: 'YTD' },
  mtd_youtube_age:    { platform: 'youtube', dimension: 'age',    period: 'MTD' },
  ytd_youtube_gender: { platform: 'youtube', dimension: 'gender', period: 'YTD' },
  mtd_youtube_gender: { platform: 'youtube', dimension: 'gender', period: 'MTD' },
  ytd_youtube_region: { platform: 'youtube', dimension: 'region', period: 'YTD' },
  mtd_youtube_region: { platform: 'youtube', dimension: 'region', period: 'MTD' },
};

// ============================================================
// 3. HELPERS
// ============================================================

function toPeriodMonth(tabPeriod: 'YTD' | 'MTD', periodEndISO: string | null): string {
  if (tabPeriod === 'YTD') return 'YTD';
  if (!periodEndISO) return 'MTD';
  const monthIdx = new Date(periodEndISO).getUTCMonth();
  return MONTHS[monthIdx];
}

function safeDate(raw: string): string | null {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// Giúp parse chuỗi phần trăm (0.01%) ra số an toàn hơn
function parseNumberClean(val: any): number {
  if (!val) return 0;
  let s = String(val).replace(/,/g, '').trim();
  if (s.endsWith('%')) {
    return Number(s.replace('%', ''));
  }
  return Number(s);
}

// ============================================================
// 4. PARSERS
// ============================================================

function parseGoogleDemographicRows(values: any[][]): ParseResult {
  const headerIdx = values.findIndex((r) => r[0] === 'Campaign');
  const dateRangeRaw = String(values[1]?.[0] ?? '');
  const [startStr, endStr] = dateRangeRaw.split(' - ').map((s) => s.trim());

  const periodStart = startStr ? safeDate(startStr) : null;
  const periodEnd   = endStr   ? safeDate(endStr)   : null;

  const dataRows = values.slice(headerIdx + 1).filter((r) => r[0]);

  const rows: ParsedRow[] = dataRows.map((r) => ({
    campaign_name:   r[0] ?? null,
    breakdown_value: String(r[1] ?? ''),
    clicks:          Number(r[2] ?? 0),
    impressions:     Number(r[3] ?? 0),
    ctr:             Number(r[4] ?? 0) * 100,
    reach:           null,
    spend:           null,
  }));

  return { periodStart, periodEnd, rows };
}

function parseMetaDemographicRows(values: any[][], dimensionCol: string): ParseResult {
  const header = values[0] as string[];
  const idx = (name: string) => header.indexOf(name);
  const dataRows = values.slice(1).filter((r) => r[idx('campaign_name')]);

  if (dataRows.length === 0) return { periodStart: null, periodEnd: null, rows: [] };

  const first = dataRows[0];
  const periodStart = String(first[idx('date_start')]).slice(0, 10);
  const periodEnd   = String(first[idx('date_stop')]).slice(0, 10);

  const rows: ParsedRow[] = dataRows.map((r) => ({
    campaign_name:   r[idx('campaign_name')] ?? null,
    breakdown_value: String(r[idx(dimensionCol)] ?? ''),
    impressions:     Number(r[idx('impressions')] ?? 0),
    reach:           Number(r[idx('reach')] ?? 0),
    clicks:          Number(r[idx('clicks')] ?? 0),
    spend:           Number(r[idx('spend')] ?? 0),
    ctr:             Number(r[idx('ctr')] ?? 0) * 100,
  }));

  return { periodStart, periodEnd, rows };
}

function parseTiktokDemographicRows(values: any[][], dimensionCol: string): ParseResult {
  const header = values[0] as string[];
  const idx = (name: string) => header.indexOf(name);
  const dataRows = values.slice(1).filter((r) => r[idx('campaign_name')]);

  if (dataRows.length === 0) return { periodStart: null, periodEnd: null, rows: [] };

  const first = dataRows[0];
  const periodStart = String(first[idx('start_date')]).slice(0, 10);
  const periodEnd   = String(first[idx('end_date')]).slice(0, 10);

  const rows: ParsedRow[] = dataRows.map((r) => ({
    campaign_name:   r[idx('campaign_name')] ?? null,
    breakdown_value: String(r[idx(dimensionCol)] ?? ''),
    impressions:     Number(r[idx('impressions')] ?? 0),
    reach:           Number(r[idx('reach')] ?? 0),
    clicks:          Number(r[idx('clicks')] ?? 0),
    spend:           Number(r[idx('spend')] ?? 0),
    ctr:             Number(r[idx('ctr')] ?? 0) * 100,
  }));

  return { periodStart, periodEnd, rows };
}

/**
 * YouTube sheet layout:
 * Nhận diện linh hoạt theo ảnh (Clicks, TrueView views, Impr., CTR, Cost)
 */
function parseYoutubeDemographicRows(values: any[][], dimensionCol: string): ParseResult {
  // Tìm header thật (dòng chứa từ khóa Clicks hoặc Impr.)
  const headerIdx = values.findIndex(row => 
    row.some(cell => String(cell).toLowerCase() === 'clicks' || String(cell).toLowerCase() === 'impr.')
  );
  
  if (headerIdx === -1) return { periodStart: null, periodEnd: null, rows: [] };

  const header = values[headerIdx].map(h => String(h).trim().toLowerCase());
  const findIdx = (aliases: string[]) => header.findIndex(h => aliases.includes(h));

  const campaignIdx   = findIdx(['campaign', 'campaign_name']);
  const dimIdx        = findIdx([dimensionCol.toLowerCase(), `${dimensionCol.toLowerCase()}_(matched)`, `${dimensionCol.toLowerCase()} (matched)`]);
  
  // Dựa theo đúng tên cột từ ảnh: Clicks | TrueView views | Impr. | CTR
  const impressionsIdx= findIdx(['impressions', 'impr.', 'impr']);
  const reachIdx      = findIdx(['reach', 'trueview views']); // Map TrueView views sang cột reach
  const clicksIdx     = findIdx(['clicks']);
  const spendIdx      = findIdx(['cost', 'spend']);
  const ctrIdx        = findIdx(['ctr']);

  const dataRows = values.slice(headerIdx + 1).filter((r) => r[campaignIdx]);
  if (dataRows.length === 0) return { periodStart: null, periodEnd: null, rows: [] };

  const rows: ParsedRow[] = dataRows.map((r) => {
    // Nếu sheet trả CTR là "0.01%" thì ta chỉ lấy số; nếu nó trả 0.0001 (raw data) thì nhân lên
    const rawCtr = ctrIdx !== -1 ? r[ctrIdx] : 0;
    const isStringPercent = String(rawCtr).includes('%');
    const finalCtr = isStringPercent ? parseNumberClean(rawCtr) : parseNumberClean(rawCtr) * 100;

    return {
      campaign_name:   r[campaignIdx] ?? null,
      breakdown_value: dimIdx !== -1 ? String(r[dimIdx] ?? '') : '',
      impressions:     impressionsIdx !== -1 ? parseNumberClean(r[impressionsIdx]) : 0,
      reach:           reachIdx !== -1 ? parseNumberClean(r[reachIdx]) : null, // Lấy TrueView views
      clicks:          clicksIdx !== -1 ? parseNumberClean(r[clicksIdx]) : 0,
      spend:           spendIdx !== -1 ? parseNumberClean(r[spendIdx]) : null,
      ctr:             finalCtr,
    };
  });

  return { periodStart: null, periodEnd: null, rows };
}

// ============================================================
// 5. PARSER ROUTER
// ============================================================

const PARSERS: Record<Platform, (values: any[][], dimension: string) => ParseResult> = {
  google: (values) => parseGoogleDemographicRows(values),
  meta:   (values, dim) => parseMetaDemographicRows(values, dim),
  tiktok: (values, dim) => parseTiktokDemographicRows(values, dim),
  youtube:(values, dim) => parseYoutubeDemographicRows(values, dim),
};

// ============================================================
// 6. MAIN SYNC FUNCTION (TÍCH HỢP TEST MODE)
// ============================================================

export async function syncDemographicTab(
  projectId: string,
  sheetId: string,
  tabName: string,
  auth: any,
  testMode: boolean = true // Bật mặc định để không ghi vào DB
) {
  const meta = DEMOGRAPHIC_TAB_META[tabName];
  if (!meta) {
    return {
      table: 'ad_demographic_metrics',
      errorMessage: `Không nhận diện được tab "${tabName}"`,
    };
  }

  const parser = PARSERS[meta.platform];
  if (!parser) {
    return {
      table: 'ad_demographic_metrics',
      errorMessage: `Chưa có parser cho platform "${meta.platform}"`,
    };
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: tabName });
  const values = res.data.values ?? [];

  const parsed = parser(values, meta.dimension);

  if (parsed.rows.length === 0) {
    return { table: 'ad_demographic_metrics', rowCount: 0, testMode };
  }

  const periodMonth = toPeriodMonth(meta.period, parsed.periodEnd);

  const rowsToInsert = parsed.rows.map((r) => ({
    project_id:      projectId,
    period_month:    periodMonth,
    platform:        meta.platform,
    campaign_name:   r.campaign_name,
    breakdown_type:  meta.dimension,
    breakdown_value: r.breakdown_value,
    impressions:     r.impressions,
    clicks:          r.clicks,
    reach:           r.reach,
    spend:           r.spend,
    ctr:             r.ctr,
  }));

  // Nếu là TEST MODE thì dừng lại ở đây và show Data ra trình duyệt / Postman
  if (testMode) {
    return { 
      table: 'ad_demographic_metrics', 
      rowCount: rowsToInsert.length,
      testMode: true,
      message: 'Chế độ Test. Dữ liệu chưa ghi vào Database.',
      previewData: rowsToInsert 
    };
  }

  await supabase
    .from('ad_demographic_metrics')
    .delete()
    .eq('project_id', projectId)
    .eq('period_month', periodMonth)
    .eq('platform', meta.platform)
    .eq('breakdown_type', meta.dimension);

  const { error } = await supabase.from('ad_demographic_metrics').insert(rowsToInsert);
  if (error) {
    return { table: 'ad_demographic_metrics', errorMessage: error.message };
  }

  return { table: 'ad_demographic_metrics', rowCount: rowsToInsert.length, testMode: false };
}