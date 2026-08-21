import { RowSyncConfig } from './syncEngine';
import { parseSheetNumber, parseSheetDate } from './syncHelpers';
// Thêm vào syncConfigs.ts (hoặc file riêng import vào), dùng chung pool như syncEngine.ts
import { pool } from './db';



const s = (v: unknown): string | null => (v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : null);
const n = (v: unknown): number => parseSheetNumber(v);
const nOrNull = (v: unknown): number | null => (v === null || v === undefined || String(v).trim() === '' ? null : parseSheetNumber(v));

/* =========================================================
 * FACEBOOK_DATA - chỉ TANAKAN có data, MMU rỗng (sẽ tự skip)
 * ⚠️ CHƯA MIGRATE sang parseRowByHeader: chưa xác nhận tên header
 * thật của sheet này, và chỉ 1 project dùng nên rủi ro lệch cột thấp.
 * ========================================================= */
export const FACEBOOK_CONFIG: RowSyncConfig = {
  table: 'ad_raw_facebook_data',
  tabName: 'FACEBOOK_DATA',
  conflictColumns: `project_id, campaign_name, COALESCE(adset_name, ''), COALESCE(ad_name, ''), date_start, date_stop`,
  parseRow: (row) => {
    const campaignName = s(row[3]);
    const dateStart = parseSheetDate(row[22]);
    const dateStop = parseSheetDate(row[23]);
    if (!campaignName || !dateStart || !dateStop) return null;
    return {
      ad_account_id: s(row[0]),
      start_date: parseSheetDate(row[1]),
      end_date: parseSheetDate(row[2]),
      campaign_name: campaignName,
      adset_name: s(row[4]),
      ad_name: s(row[5]),
      objective: s(row[6]),
      spend: n(row[7]),
      impressions: n(row[8]),
      reach: n(row[9]),
      clicks: n(row[10]),
      inline_link_clicks: n(row[11]),
      landing_page_view: n(row[12]),
      lead: n(row[13]),
      cost_per_landing_page_view: nOrNull(row[14]),
      cost_per_lead: nOrNull(row[15]),
      cost_per_inline_post_engagement: nOrNull(row[17]),
      cpc: nOrNull(row[19]),
      cpm: nOrNull(row[20]),
      ctr: nOrNull(row[21]),
      date_start: dateStart,
      date_stop: dateStop,
      frequency: nOrNull(row[24]),
      inline_post_engagement: n(row[25]),
    };
  },
};

/* =========================================================
 * TIKTOK_DATA - chỉ MMU có data, TANAKAN rỗng (sẽ tự skip)
 * ⚠️ CHƯA MIGRATE - lý do tương tự FACEBOOK_DATA.
 * ========================================================= */
export const TIKTOK_CONFIG: RowSyncConfig = {
  table: 'ad_raw_tiktok_data',
  tabName: 'TIKTOK_DATA',
  conflictColumns: `project_id, COALESCE(ad_id, ''), report_date`,
  parseRow: (row) => {
    const reportDate = parseSheetDate(row[0]);
    if (!reportDate) return null;
    return {
      report_date: reportDate,
      campaign_id: s(row[1]),
      campaign_name: s(row[2]),
      campaign_status: s(row[3]),
      ad_objective: s(row[4]),
      ad_group_id: s(row[5]),
      ad_group_name: s(row[6]),
      ad_group_status: s(row[7]),
      ad_group_secondary_status: s(row[8]),
      ad_id: s(row[9]),
      ad_name: s(row[10]),
      ad_status: s(row[11]),
      ad_secondary_status: s(row[12]),
      impressions: n(row[13]),
      clicks: n(row[14]),
      reach: n(row[15]),
      views: n(row[16]),
      spend: n(row[17]),
      conversions: n(row[18]),
      cost_per_result: nOrNull(row[19]),
      cpc: nOrNull(row[20]),
      cpm: nOrNull(row[21]),
      ctr: nOrNull(row[22]),
      conversion_rate: nOrNull(row[23]),
      cost_per_conversion: nOrNull(row[24]),
      ad_group_budget: nOrNull(row[25]),
    };
  },
};

/* =========================================================
 * SEM_DATA / YOUTUBE_DATA - CẢ 2 project đều có, nhưng thứ tự cột KHÁC NHAU
 * ⚠️ CHƯA MIGRATE - đây thực ra là ứng viên nên migrate (2 layout khác nhau
 * theo project, giống lỗi ad_raw_data), nhưng tôi chưa có header thật của
 * report Google Ads/YouTube xuất ra để map alias chính xác. Gửi tôi vài dòng
 * đầu (header row) của SEM_DATA/YOUTUBE_DATA cho cả 2 project, tôi sẽ migrate.
 * ========================================================= */
function buildSemYoutubeConfig(table: string, tabName: string, projectCode: string): RowSyncConfig {
  return {
    table,
    tabName,
    conflictColumns: `project_id, report_date, campaign_name`,
    parseRow: (row) => {
      if (projectCode !== 'MMU') {
        const reportDate = parseSheetDate(row[0]);
        const campaignName = s(row[3]);
        if (!reportDate || !campaignName) return null;
        return {
          report_date: reportDate,
          campaign_status: s(row[4]),
          campaign_name: campaignName,
          currency_code: s(row[9]),
          trueview_views: n(row[12]),
          trueview_avg_cpv: nOrNull(row[14]),
          clicks: n(row[7]),
          ctr: nOrNull(row[8]),
          avg_cpc: nOrNull(row[10]),
          impressions: n(row[6]),
          cost: n(row[11]),
          trueview_view_rate: nOrNull(row[13]),
          search_impr_share: s(row[16]),
          search_lost_is_rank: s(row[17]),
          search_lost_is_budget: s(row[18]),
        };
      }

      const reportDate = parseSheetDate(row[0]);
      const campaignName = s(row[2]);
      if (!reportDate || !campaignName) return null;
      return {
        report_date: reportDate,
        campaign_status: s(row[1]),
        campaign_name: campaignName,
        budget_name: s(row[3]),
        currency_code: s(row[4]),
        budget: nOrNull(row[5]),
        budget_type: s(row[6]),
        currency: s(row[7]),
        serving_status: s(row[8]),
        status_reasons: s(row[9]),
        trueview_views: n(row[10]),
        trueview_avg_cpv: nOrNull(row[11]),
        clicks: n(row[12]),
        ctr: nOrNull(row[13]),
        avg_cpc: nOrNull(row[14]),
        impressions: n(row[15]),
        cost: n(row[16]),
        trueview_view_rate: nOrNull(row[17]),
        search_impr_share: s(row[18]),
        search_lost_is_budget: s(row[19]),
        search_lost_is_rank: s(row[20]),
        unique_users: nOrNull(row[21]),
      };
    },
  };
}

/* =========================================================
 * ADX_DATA - Tanakan có thêm cột Region ở giữa, cần offset theo project
 * ⚠️ CHƯA MIGRATE - chưa có header thật, sheet nội bộ không chuẩn hoá.
 * ========================================================= */
function buildAdxConfig(projectCode: string): RowSyncConfig {
  const o = projectCode !== 'MMU' ? 1 : 0;
  return {
    table: 'ad_raw_adx_data',
    tabName: 'ADX_DATA',
    conflictColumns: `project_id, report_date, COALESCE(buying_type, ''), COALESCE(placement, '')`,
    parseRow: (row) => {
      const reportDate = parseSheetDate(row[3 + o]);
      if (!reportDate) return null;
      return {
        row_no: nOrNull(row[0]),
        buying_type: s(row[1 + o]),
        placement: s(row[2 + o]),
        report_date: reportDate,
        clicks: n(row[4 + o]),
        total_clicks: n(row[5 + o]),
        impressions: n(row[6 + o]),
        ctr: nOrNull(row[7 + o]),
        spend: n(row[8 + o]),
      };
    },
  };
}

/* =========================================================
 * MB Inpage_DATA - Tanakan cũng có thêm cột Region, tương tự ADX
 * ⚠️ CHƯA MIGRATE - lý do tương tự ADX_DATA.
 * ========================================================= */
function buildMbInpageConfig(projectCode: string): RowSyncConfig {
  const o = projectCode !== 'MMU' ? 1 : 0;
  return {
    table: 'ad_raw_mb_inpage_data',
    tabName: 'MB Inpage_DATA',
    conflictColumns: `project_id, report_date, COALESCE(row_no, -1)`,
    parseRow: (row) => {
      const reportDate = parseSheetDate(row[1 + o]);
      if (!reportDate) return null;
      return {
        row_no: nOrNull(row[0]),
        report_date: reportDate,
        cpm: nOrNull(row[2 + o]),
        views: n(row[3 + o]),
        viewers: n(row[4 + o]),
        clicks: n(row[5 + o]),
        ctr_pct: nOrNull(row[6 + o]),
        spend: n(row[7 + o]),
      };
    },
  };
}

/* =========================================================
 * DATE_SELECTION
 * ✅ MIGRATED — chỉ 2 cột, alias đơn giản, không cần offset theo project nữa.
 * ========================================================= */
function buildDateSelectionConfig(projectCode: string): RowSyncConfig {
  return {
    table: 'ad_sheet_date_selection',
    tabName: 'DATE_SELECTION',
    conflictColumns: `project_id, start_date, end_date`,
    parseRowByHeader: (get) => {
      const start = parseSheetDate(get(['start_date', 'start date']));
      const end = parseSheetDate(get(['end_date', 'end date']));
      if (!start || !end) return null;
      return { start_date: start, end_date: end };
    },
  };
}

/* =========================================================
 * UNIT_COST_PLAN (YTD + MTD)
 * ✅ MIGRATED — dùng chung 1 hàm parse cho cả Tanakan/MMU, field nào
 * sheet không có thì get() trả undefined -> tự thành null/'' an toàn.
 * Alias 'quanity' giữ lại vì comment gốc ghi rõ đây là lỗi chính tả có
 * thật trong header sheet (không phải typo của tôi).
 * ========================================================= */
function buildUnitCostPlanConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const isTanakan = projectCode !== 'MMU';
  const tabName = isTanakan
    ? periodType === 'YTD' ? 'YTD_UNIT_COST_PLAN' : 'MTD_UNIT_COST_PLAN'
    : periodType === 'YTD' ? 'UNIT_COST_PLAN' : 'MTD_UNIT_COST_PLAN'; // không tồn tại ở MMU -> auto skip

  return {
    table: 'ad_unit_cost_plan',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    deleteScopeColumns: ['period_month'],
    parseRowByHeader: (get) => {
      const channel = s(get(['channel']));
      const buyingType = s(get(['buying_type', 'buying type']));
      if (!channel || !buyingType) return null;

      const phaseRaw = s(get(['phase']))?.toLowerCase() ?? 'other';

      return {
        period_month: s(get(['period_month', 'month'])) ?? (periodType === 'YTD' ? 'YTD' : null),
        region: s(get(['region'])) ?? '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        asset: s(get(['asset'])) ?? '',
        unit_cost: n(get(['unit_cost'])),
        planned_quantity: n(get(['quanity', 'quantity', 'planned_quantity'])),
        start_date: parseSheetDate(get(['start_date'])),
        end_date: parseSheetDate(get(['end_date'])),
      };
    },
  };
}

/* =========================================================
 * REPORT (YTD + MTD)
 * ✅ MIGRATED — layout giống hệt ad_raw_data (đã verify header thật qua
 * ảnh chụp sheet trước đó: phase, channel, buying_type, asset, start_date,
 * end_date, Reach, Impressions, Engagements, Views, Clicks, Link Clicks,
 * Landing Page Views, Leads, Spend), nên dùng chung field key.
 * ========================================================= */
function buildReportConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const tabName = periodType === 'YTD' ? 'YTD_REPORT' : 'MTD_REPORT';

  return {
    table: 'ad_raw_report',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    deleteScopeColumns: ['period_month'],
    parseRowByHeader: (get) => {
      const channel = s(get(['channel']));
      const buyingType = s(get(['buying_type', 'buying type']));
      if (!channel || !buyingType) return null;

      const phaseRaw = s(get(['phase']))?.toLowerCase() ?? 'other';

      return {
        period_month: s(get(['period_month', 'month'])) ?? (periodType === 'YTD' ? 'YTD' : null),
        period_start_date: parseSheetDate(get(['period_start_date'])),
        period_end_date: parseSheetDate(get(['period_end_date'])),
        region: s(get(['region'])) ?? '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        asset: s(get(['asset'])) ?? '',
        start_date: parseSheetDate(get(['start_date'])),
        end_date: parseSheetDate(get(['end_date'])),
        reach: n(get(['reach'])),
        impressions: n(get(['impressions', 'impr.', 'impr'])),
        engagements: n(get(['engagements'])),
        views: n(get(['views'])),
        clicks: n(get(['clicks'])),
        link_clicks: n(get(['link_clicks', 'link clicks'])),
        landing_page_views: n(get(['landing_page_views', 'landing page views'])),
        leads: n(get(['leads'])),
        spend: n(get(['spend'])),
      };
    },
  };
}

/* =========================================================
 * DATA (YTD + MTD)
 * ✅ ĐÃ MIGRATE (giữ nguyên từ trước, không đổi)
 * ========================================================= */
function buildDataConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const tabName = periodType === 'YTD' ? 'YTD_DATA' : 'MTD_DATA';

  return {
    table: 'ad_raw_data',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    deleteScopeColumns: ['period_month'],
    parseRowByHeader: (get) => {
      const channel = s(get(['channel']));
      const buyingType = s(get(['buying_type', 'buying type']));
      if (!channel || !buyingType) return null;

      const phaseRaw = s(get(['phase']))?.toLowerCase() ?? 'other';

      return {
        period_month: s(get(['period_month', 'month'])) ?? (periodType === 'YTD' ? 'YTD' : null),
        period_start_date: parseSheetDate(get(['period_start_date'])),
        period_end_date: parseSheetDate(get(['period_end_date'])),
        region: s(get(['region'])) ?? '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        asset: s(get(['asset'])) ?? '',
        start_date: parseSheetDate(get(['start_date'])),
        end_date: parseSheetDate(get(['end_date'])),
        reach: n(get(['reach'])),
        impressions: n(get(['impressions', 'impr.', 'impr'])),
        engagements: n(get(['engagements'])),
        views: n(get(['views'])),
        clicks: n(get(['clicks'])),
        link_clicks: n(get(['link_clicks', 'link clicks'])),
        landing_page_views: n(get(['landing_page_views', 'landing page views'])),
        leads: n(get(['leads'])),
        spend: n(get(['spend'])),
        planned_quantity: nOrNull(get(['planned_quantity'])),
        actual_delivery: nOrNull(get(['actual_delivery'])),
        time_passed_pct: nOrNull(get(['time_passed_pct'])),
        delivery_pct: nOrNull(get(['delivery_pct'])),
        pacing_gap: nOrNull(get(['pacing_gap'])),
        sold_value: nOrNull(get(['sold_value'])),
        cost_optimized: nOrNull(get(['cost_optimized'])),
        cost_optimized_pct: nOrNull(get(['cost_optimized_pct'])),
        delivery_status: s(get(['delivery_status'])),
        cost_status: s(get(['cost_status'])),
      };
    },
  };
}

/* =========================================================
 * DELIVERY_STATUS (YTD + MTD)
 * ✅ MIGRATED — trước đây phải tính offset olead/oasset thủ công theo
 * project, giờ chỉ cần đọc theo tên cột, không còn if/else theo layout.
 * ========================================================= */
function buildDeliveryStatusConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  // Không đoán cứng theo isTanakan/projectCode nữa — thử cả 2 kiểu tên tab,
  // syncEngine sẽ tự chọn tab đầu tiên thực sự tồn tại trong sheet.
  // (VD project VUQ3 không phải MMU nhưng lại dùng tab tên 'DELIVERY_STATUS' không prefix,
  // nên nếu suy đoán cứng theo isTanakan sẽ tìm nhầm sang 'YTD_DELIVERY_STATUS' -> sync ra 0 dòng.)
  const candidateTabNames =
    periodType === 'YTD'
      ? ['YTD_DELIVERY_STATUS', 'DELIVERY_STATUS']
      : ['MTD_DELIVERY_STATUS'];

  return {
    table: 'ad_delivery_status',
    tabName: candidateTabNames,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    deleteScopeColumns: ['period_month'],
    parseRowByHeader: (get) => {
      const channel = s(get(['channel']));
      const buyingType = s(get(['buying_type', 'buying type']));
      if (!channel || !buyingType) return null;

      const phaseRaw = s(get(['phase']))?.toLowerCase() ?? 'other';

      // MTD_DELIVERY_STATUS (Tanakan) dùng plan_start_date/plan_end_date làm start_date/end_date thật;
      // YTD dùng thẳng start_date/end_date. Ưu tiên plan_start_date/plan_end_date nếu có.
      const startDate = parseSheetDate(get(['plan_start_date', 'start_date']));
      const endDate = parseSheetDate(get(['plan_end_date', 'end_date']));
      if (!startDate) return null;

      return {
        period_month: s(get(['period_month', 'month'])) ?? (periodType === 'YTD' ? 'YTD' : null),
        period_start_date: parseSheetDate(get(['period_start_date'])),
        period_end_date: parseSheetDate(get(['period_end_date'])),
        region: s(get(['region'])) ?? '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        asset: s(get(['asset'])) ?? '',
        start_date: startDate,
        end_date: endDate,
        unit_cost: n(get(['unit_cost'])),
        planned_quantity: n(get(['planned_quantity', 'quanity'])),
        actual_delivery: n(get(['actual_delivery'])),
        time_passed_pct: n(get(['time_passed_pct'])),
        delivery_pct: n(get(['delivery_pct'])),
        pacing_gap: n(get(['pacing_gap'])),
        actual_spend: n(get(['actual_spend'])),
        sold_value: n(get(['sold_value'])),
        cost_optimized: n(get(['cost_optimized'])),
        cost_optimized_pct: n(get(['cost_optimized_pct'])),
        delivery_status: s(get(['delivery_status'])),
        cost_status: s(get(['cost_status'])),
      };
    },
  };
}

/** Trả về toàn bộ config cần chạy cho 1 project (đã tự chỉnh theo cấu trúc sheet riêng) */
async function getDemographicSheetIds(projectCode: string): Promise<{ sem?: string; facebook?: string }> {
  const res = await pool.query(
    `SELECT s.source_type, s.sheet_id
     FROM ad_project_sheet_sources s
     JOIN ad_projects p ON p.id = s.project_id
     WHERE p.project_code = $1`,
    [projectCode]
  );

  const result: { sem?: string; facebook?: string } = {};
  for (const row of res.rows) {
    if (row.source_type === 'demographic_sem') result.sem = row.sheet_id;
    if (row.source_type === 'demographic_facebook') result.facebook = row.sheet_id;
  }
  return result;
}

export async function getAllRawConfigsForProject(projectCode: string): Promise<RowSyncConfig[]> {
  const isTanakan = projectCode !== 'MMU';

  const configs: RowSyncConfig[] = [
    buildDateSelectionConfig(projectCode),
    buildUnitCostPlanConfig(projectCode, 'YTD'),
    buildDeliveryStatusConfig(projectCode, 'YTD'),
    buildReportConfig(projectCode, 'YTD'),
    buildDataConfig(projectCode, 'YTD'),
    FACEBOOK_CONFIG,
    TIKTOK_CONFIG,
    buildSemYoutubeConfig('ad_raw_sem_data', 'SEM_DATA', projectCode),
    buildSemYoutubeConfig('ad_raw_youtube_data', 'YOUTUBE_DATA', projectCode),
    buildAdxConfig(projectCode),
    buildMbInpageConfig(projectCode),
  ];

  if (isTanakan) {
    configs.push(
      buildUnitCostPlanConfig(projectCode, 'MTD'),
      buildDeliveryStatusConfig(projectCode, 'MTD'),
      buildReportConfig(projectCode, 'MTD'),
      buildDataConfig(projectCode, 'MTD'),
    );

    const demoSheets = await getDemographicSheetIds(projectCode);

    if (demoSheets.sem) {
      (['age', 'gender', 'region'] as const).forEach((dim) => {
        configs.push({ ...buildGoogleDemographicConfig(dim, 'YTD'), sheetIdOverride: demoSheets.sem });
        configs.push({ ...buildGoogleDemographicConfig(dim, 'MTD'), sheetIdOverride: demoSheets.sem });
      });
      configs.push(buildGoogleSearchCampaignConfig(demoSheets.sem));
      configs.push(buildGoogleSearchKeywordConfig(demoSheets.sem));
    }
    if (demoSheets.facebook) {
      (['age', 'gender', 'region'] as const).forEach((dim) => {
        configs.push({ ...buildMetaDemographicConfig(dim, 'YTD'), sheetIdOverride: demoSheets.facebook });
        configs.push({ ...buildMetaDemographicConfig(dim, 'MTD'), sheetIdOverride: demoSheets.facebook });
      });
    }
  }

  return configs;
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function currentMonthAbbr(): string {
  return MONTHS[new Date().getMonth()];
}

/* =========================================================
 * DEMOGRAPHIC — Google/SEM (age, gender, region)
 * ✅ MIGRATED — header thật đã xác nhận qua ảnh chụp: Campaign,
 * Age (Matched)/Gender (Matched)/Region (Matched), Clicks, Impr., CTR.
 * Bỏ hẳn logic lọc "row[2] === 'Clicks'" vì giờ đọc theo header,
 * dòng header không còn lẫn vào dataRows nữa (syncEngine tự tách).
 * Sheet có preamble title/date-range TRƯỚC header thật — nếu preamble
 * nằm ở rows[0]/rows[1] (trước dòng header), cần xác nhận header có
 * đúng nằm ở rows[0] không, nếu không phải hàng đầu tiên thì
 * indexByHeader (đang lấy rows[0] làm header) sẽ đọc sai — báo tôi
 * nếu sync ra 0 dòng để kiểm tra lại vị trí header thật.
 * ========================================================= */
function buildGoogleDemographicConfig(
  dimension: 'age' | 'gender' | 'region',
  periodType: 'YTD' | 'MTD'
): RowSyncConfig {
  const tabName = periodType === 'YTD' ? `ytd_search_${dimension}` : `mtd_search_${dimension}`;
  const periodMonth = periodType === 'YTD' ? 'YTD' : currentMonthAbbr();

  const dimensionAliases: Record<string, string[]> = {
    age: ['age', 'age_(matched)', 'age (matched)'],
    gender: ['gender', 'gender_(matched)', 'gender (matched)'],
    region: ['region', 'region_(matched)', 'region (matched)'],
  };

  return {
    table: 'ad_demographic_metrics',
    tabName,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    deleteScopeColumns: ['period_month', 'platform', 'breakdown_type'],
    parseRowByHeader: (get) => {
      const campaignName = s(get(['campaign']));
      const breakdownValue = s(get(dimensionAliases[dimension]));
      if (!campaignName || !breakdownValue) return null;

      return {
        period_month: periodMonth,
        platform: 'google',
        campaign_name: campaignName,
        breakdown_type: dimension,
        breakdown_value: breakdownValue,
        clicks: n(get(['clicks'])),
        impressions: n(get(['impr.', 'impr', 'impressions'])),
        ctr: nOrNull(get(['ctr'])) !== null ? n(get(['ctr'])) * 100 : null,
        reach: null,
        spend: null,
      };
    },
  };
}

/* =========================================================
 * DEMOGRAPHIC — Meta/Facebook (age, gender, region)
 * ⚠️ CHƯA MIGRATE - comment gốc tự ghi "chưa chắc header thật", nên
 * giữ index-based, đợi bạn xác nhận header thật rồi migrate sau.
 * ========================================================= */
function buildMetaDemographicConfig(
  dimension: 'age' | 'gender' | 'region',
  periodType: 'YTD' | 'MTD'
): RowSyncConfig {
  const tabName = periodType === 'YTD' ? `ytd_${dimension}` : `mtd_${dimension}`;

  return {
    table: 'ad_demographic_metrics',
    tabName,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    deleteScopeColumns: ['period_month', 'platform', 'breakdown_type'],
    parseRow: (row) => {
      const dateStop = parseSheetDate(row[4]);
      const campaignName = s(row[6]);
      const breakdownValue = s(row[5]);
      if (!dateStop || !campaignName || !breakdownValue) return null;

      return {
        period_month: periodType === 'YTD' ? 'YTD' : currentMonthAbbrFromDate(dateStop),
        platform: 'meta',
        campaign_name: campaignName,
        breakdown_type: dimension,
        breakdown_value: breakdownValue,
        impressions: n(row[11]),
        reach: n(row[12]),
        clicks: n(row[13]),
        spend: n(row[10]),
        ctr: nOrNull(row[14]) !== null ? n(row[14]) * 100 : null,
      };
    },
  };
}

function currentMonthAbbrFromDate(iso: string): string {
  return MONTHS[new Date(iso).getMonth()];
}

/* =========================================================
 * SEM mtd_search_campaign
 * ✅ MIGRATED — cùng dạng report Google Ads như demographic Google
 * ở trên nên tái dùng alias tương tự (Campaign, Ad group, Clicks,
 * Impr., CTR).
 * ========================================================= */
function buildGoogleSearchCampaignConfig(sheetIdOverride?: string): RowSyncConfig {
  return {
    table: 'ad_demographic_metrics',
    tabName: 'mtd_search_campaign',
    sheetIdOverride,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    deleteScopeColumns: ['period_month', 'platform', 'breakdown_type'],
    parseRowByHeader: (get) => {
      const campaignName = s(get(['campaign']));
      const adGroup = s(get(['ad_group', 'ad group']));
      if (!campaignName || !adGroup) return null;

      return {
        period_month: currentMonthAbbr(),
        platform: 'google',
        campaign_name: campaignName,
        breakdown_type: 'campaign',
        breakdown_value: adGroup,
        clicks: n(get(['clicks'])),
        impressions: n(get(['impr.', 'impr', 'impressions'])),
        ctr: nOrNull(get(['ctr'])) !== null ? n(get(['ctr'])) * 100 : null,
        reach: null,
        spend: null,
      };
    },
  };
}

/* =========================================================
 * SEM mtd_search_keyword
 * ✅ MIGRATED
 * ========================================================= */
function buildGoogleSearchKeywordConfig(sheetIdOverride?: string): RowSyncConfig {
  return {
    table: 'ad_demographic_metrics',
    tabName: 'mtd_search_keyword',
    sheetIdOverride,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    deleteScopeColumns: ['period_month', 'platform', 'breakdown_type'],
    parseRowByHeader: (get) => {
      const searchTerm = s(get(['search_term', 'search term']));
      const adGroup = s(get(['ad_group', 'ad group']));
      if (!searchTerm) return null;

      return {
        period_month: currentMonthAbbr(),
        platform: 'google',
        campaign_name: adGroup,
        breakdown_type: 'keyword',
        breakdown_value: searchTerm,
        clicks: n(get(['clicks'])),
        impressions: n(get(['impr.', 'impr', 'impressions'])),
        ctr: nOrNull(get(['ctr'])) !== null ? n(get(['ctr'])) * 100 : null,
        reach: null,
        spend: null,
      };
    },
  };
}

/* =========================================================
 * findConfigForSheetTab
 * ✅ FIX — trước đây so `c.tabName === tabName`, nhưng
 * buildDeliveryStatusConfig gán tabName là 1 MẢNG (candidateTabNames),
 * nên so sánh === với string luôn false -> DELIVERY_STATUS không bao
 * giờ khớp được config qua webhook. Giờ check cả trường hợp mảng.
 * ========================================================= */
export async function findConfigForSheetTab(
  sheetId: string,
  tabName: string
): Promise<{ projectCode: string; config: RowSyncConfig } | null> {
  const projectsRes = await pool.query(`SELECT project_code FROM ad_projects`);

  for (const { project_code } of projectsRes.rows) {
    const configs = await getAllRawConfigsForProject(project_code);
    const found = configs.find((c) =>
      Array.isArray(c.tabName) ? c.tabName.includes(tabName) : c.tabName === tabName
    );
    if (!found) continue;

    const mainSheetRes = await pool.query(
      `SELECT sheet_id FROM sync_projects WHERE project_code = $1`,
      [project_code]
    );
    const mainSheetId = mainSheetRes.rows[0]?.sheet_id;
    const effectiveSheetId = found.sheetIdOverride ?? mainSheetId;

    if (effectiveSheetId === sheetId) {
      return { projectCode: project_code, config: found };
    }
  }

  return null;
}