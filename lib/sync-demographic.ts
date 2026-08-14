// lib/sync-demographic.ts
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export const DEMOGRAPHIC_TAB_META: Record<string, { platform: 'google' | 'meta'; dimension: 'age' | 'gender' | 'region'; period: 'YTD' | 'MTD' }> = {
  ytd_search_age: { platform: 'google', dimension: 'age', period: 'YTD' },
  mtd_search_age: { platform: 'google', dimension: 'age', period: 'MTD' },
  ytd_search_gender: { platform: 'google', dimension: 'gender', period: 'YTD' },
  mtd_search_gender: { platform: 'google', dimension: 'gender', period: 'MTD' },
  ytd_search_region: { platform: 'google', dimension: 'region', period: 'YTD' },
  mtd_search_region: { platform: 'google', dimension: 'region', period: 'MTD' },
  ytd_age: { platform: 'meta', dimension: 'age', period: 'YTD' },
  mtd_age: { platform: 'meta', dimension: 'age', period: 'MTD' },
  ytd_gender: { platform: 'meta', dimension: 'gender', period: 'YTD' },
  mtd_gender: { platform: 'meta', dimension: 'gender', period: 'MTD' },
  ytd_region: { platform: 'meta', dimension: 'region', period: 'YTD' },
  mtd_region: { platform: 'meta', dimension: 'region', period: 'MTD' },
};

function toPeriodMonth(tabPeriod: 'YTD' | 'MTD', periodEndISO: string | null): string {
  if (tabPeriod === 'YTD') return 'YTD';
  if (!periodEndISO) return 'MTD';
  const monthIdx = new Date(periodEndISO).getUTCMonth();
  return MONTHS[monthIdx];
}

// Google sheet: row0=title, row1="May 1, 2026 - July 31, 2026", row2=header("Campaign",...), row3+=data
function parseGoogleDemographicRows(values: any[][]) {
  const headerIdx = values.findIndex((r) => r[0] === 'Campaign');
  const dateRangeRaw = String(values[1]?.[0] ?? '');
  const [startStr, endStr] = dateRangeRaw.split(' - ').map((s) => s.trim());

  const periodStart = startStr ? new Date(startStr).toISOString().slice(0, 10) : null;
  const periodEnd = endStr ? new Date(endStr).toISOString().slice(0, 10) : null;

  const dataRows = values.slice(headerIdx + 1).filter((r) => r[0]);
  const rows = dataRows.map((r) => ({
    campaign_name: r[0] ?? null,
    breakdown_value: String(r[1] ?? ''),
    clicks: Number(r[2] ?? 0),
    impressions: Number(r[3] ?? 0),
    ctr: Number(r[4] ?? 0) * 100,
    reach: null as number | null,
    spend: null as number | null,
  }));

  return { periodStart, periodEnd, rows };
}

// Meta sheet: row0=header thật, row1+=data. Cột dimension trùng tên: age/gender/region
function parseMetaDemographicRows(values: any[][], dimensionCol: string) {
  const header = values[0] as string[];
  const idx = (name: string) => header.indexOf(name);
  const dataRows = values.slice(1).filter((r) => r[idx('campaign_name')]);

  if (dataRows.length === 0) return { periodStart: null, periodEnd: null, rows: [] };

  const first = dataRows[0];
  const periodStart = String(first[idx('date_start')]).slice(0, 10);
  const periodEnd = String(first[idx('date_stop')]).slice(0, 10);

  const rows = dataRows.map((r) => ({
    campaign_name: r[idx('campaign_name')] ?? null,
    breakdown_value: String(r[idx(dimensionCol)] ?? ''),
    impressions: Number(r[idx('impressions')] ?? 0),
    reach: Number(r[idx('reach')] ?? 0),
    clicks: Number(r[idx('clicks')] ?? 0),
    spend: Number(r[idx('spend')] ?? 0),
    ctr: Number(r[idx('ctr')] ?? 0) * 100,
  }));

  return { periodStart, periodEnd, rows };
}

export async function syncDemographicTab(
  projectId: string,
  sheetId: string,
  tabName: string,
  auth: any
) {
  const meta = DEMOGRAPHIC_TAB_META[tabName];
  if (!meta) {
    return { table: 'ad_demographic_metrics', errorMessage: `Không nhận diện được tab "${tabName}"` };
  }

  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: tabName });
  const values = res.data.values ?? [];

  const parsed =
    meta.platform === 'google'
      ? parseGoogleDemographicRows(values)
      : parseMetaDemographicRows(values, meta.dimension);

  if (parsed.rows.length === 0) {
    return { table: 'ad_demographic_metrics', rowCount: 0 };
  }

  const periodMonth = toPeriodMonth(meta.period, parsed.periodEnd);

  // Replace: xóa data cũ đúng project + period + platform + breakdown_type trước khi insert lại
  await supabase
    .from('ad_demographic_metrics')
    .delete()
    .eq('project_id', projectId)
    .eq('period_month', periodMonth)
    .eq('platform', meta.platform)
    .eq('breakdown_type', meta.dimension);

  const rowsToInsert = parsed.rows.map((r) => ({
    project_id: projectId,
    period_month: periodMonth,
    platform: meta.platform,
    campaign_name: r.campaign_name,
    breakdown_type: meta.dimension,
    breakdown_value: r.breakdown_value,
    impressions: r.impressions,
    clicks: r.clicks,
    reach: r.reach,
    spend: r.spend,
    ctr: r.ctr,
  }));

  const { error } = await supabase.from('ad_demographic_metrics').insert(rowsToInsert);
  if (error) {
    return { table: 'ad_demographic_metrics', errorMessage: error.message };
  }

  return { table: 'ad_demographic_metrics', rowCount: rowsToInsert.length };
}