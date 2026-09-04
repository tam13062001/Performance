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
 * 🔧 MIGRATED sang parseRowByHeader — không còn phụ thuộc thứ tự cột.
 * ⚠️ VẪN CHƯA XÁC NHẬN header thật của report Google Ads/YouTube xuất ra —
 * alias bên dưới là ĐOÁN dựa theo tên field cũ (snake_case + spaced + vài
 * tên thường gặp trong export Google Ads: "Impr.", "Avg. CPC", "Campaign
 * state"...). Nếu header thật không khớp alias nào, field đó sẽ ra `null`
 * ÂM THẦM (không lỗi rõ ràng) — rủi ro hơn cả bug index-based cũ. Gửi tôi
 * vài dòng đầu (header row) thật của SEM_DATA/YOUTUBE_DATA cho cả 2 project
 * để xác nhận/chỉnh lại alias cho đúng trước khi tin tưởng data ra.
 * ========================================================= */
function buildSemYoutubeConfig(table: string, tabName: string, projectCode: string): RowSyncConfig {
  return {
    table,
    tabName,
    conflictColumns: `project_id, report_date, campaign_name`,
    parseRowByHeader: (get) => {
      const reportDate = parseSheetDate(get(['report_date', 'report date', 'date', 'day']));
      const campaignName = s(get(['campaign_name', 'campaign name', 'campaign']));
      if (!reportDate || !campaignName) return null;
 
      return {
        report_date: reportDate,
        campaign_name: campaignName,
        campaign_status: s(get(['campaign_status', 'campaign status', 'campaign state'])),
        budget_name: s(get(['budget_name', 'budget name'])),
        currency_code: s(get(['currency_code', 'currency code'])),
        budget: nOrNull(get(['budget'])),
        budget_type: s(get(['budget_type', 'budget type'])),
        currency: s(get(['currency'])),
        serving_status: s(get(['serving_status', 'serving status'])),
        status_reasons: s(get(['status_reasons', 'status reasons'])),
        trueview_views: n(get(['trueview_views', 'trueview views', 'views'])),
        trueview_avg_cpv: nOrNull(get(['trueview_avg_cpv', 'trueview avg cpv', 'avg. cpv', 'avg cpv'])),
        clicks: n(get(['clicks'])),
        ctr: nOrNull(get(['ctr'])),
        avg_cpc: nOrNull(get(['avg_cpc', 'avg cpc', 'avg. cpc'])),
        impressions: n(get(['impressions', 'impr.', 'impr'])),
        cost: n(get(['cost'])),
        trueview_view_rate: nOrNull(get(['trueview_view_rate', 'trueview view rate', 'view rate'])),
        search_impr_share: s(get(['search_impr_share', 'search impr. share', 'search impr share'])),
        search_lost_is_rank: s(get(['search_lost_is_rank', 'search lost is rank (rank)', 'search lost is (rank)'])),
        search_lost_is_budget: s(get(['search_lost_is_budget', 'search lost is budget (budget)', 'search lost is (budget)'])),
        unique_users: nOrNull(get(['unique_users', 'unique users'])),
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
 *
 * 🔧 FIX — trước đây đoán cứng tên tab theo `isTanakan` (projectCode !== 'MMU'),
 * nên với project không phải MMU nhưng vẫn dùng tab UNIT_COST_PLAN không
 * prefix (VD VUQ3), code sẽ đi tìm nhầm 'YTD_UNIT_COST_PLAN' -> 404 "không
 * tìm thấy config". Đây là cùng 1 lớp bug đã fix cho DELIVERY_STATUS, giờ
 * áp dụng cùng pattern: thử nhiều tên tab ứng viên (mảng), để syncEngine /
 * findConfigForSheetTab (đã handle Array.isArray(tabName)) tự chọn tab
 * thực sự tồn tại trong sheet, không đoán cứng theo project nữa.
 * ========================================================= */
function buildUnitCostPlanConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const candidateTabNames =
    periodType === 'YTD'
      ? ['YTD_UNIT_COST_PLAN', 'UNIT_COST_PLAN']
      : ['MTD_UNIT_COST_PLAN'];

  return {
    table: 'ad_unit_cost_plan',
    tabName: candidateTabNames,
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

/* =========================================================
 * DEMOGRAPHIC CHUNG (GOOGLE, META, TIKTOK, YOUTUBE)
 *
 * 🔧 UPDATE (VUQ3 — DATA_SEM_VU_2026.xlsx / DATA_FACEBOOK_VU_2026.xlsx):
 * Đã nhận được 2 file thật dùng làm demoSheets.sem / demoSheets.facebook
 * của VUQ3. Xác nhận:
 *  - Header của Age/Gender/Region (cả Google lẫn Meta) KHỚP ĐÚNG với
 *    dimensionAliases đã đoán từ trước (age/gender/region (matched),
 *    impr., clicks, ctr, cost/spend...) — không cần sửa alias.
 *  - NHƯNG tên tab thật KHÔNG có prefix ytd_/mtd_ như code cũ giả định —
 *    chỉ là "Age", "Gender", "Region", "Keyword", "Campaign", "Term" trần.
 *    -> tabName đổi thành mảng [tên có prefix (giữ để tương thích ngược
 *    nếu sau này có sheet khác đặt đúng kiểu cũ), tên trần] — cùng pattern
 *    đã dùng cho DELIVERY_STATUS/UNIT_COST_PLAN.
 *  - ⚠️ CTR KHÔNG đồng nhất giữa 2 nguồn: Google/SEM trả về fraction 0–1
 *    (vd 0.2107 = 21.07%) như code cũ giả định, nhưng Meta/Facebook demo-
 *    graphic (DATA_FACEBOOK_VU_2026.xlsx) đã tính sẵn CTR dạng PHẦN TRĂM
 *    (vd 5.647841 nghĩa là 5.65%, không phải 0.05647). Nếu nhân 100 cho
 *    cả 2 như code cũ, số của Meta sẽ sai lệch 100 lần. Đã sửa: chỉ nhân
 *    100 khi platform === 'google'.
 *  - Ngày trong SEM sheet nằm ở cột "Day" (1 cột ngày đơn, không phải
 *    range date_stop/end_date) -> thêm alias 'day'/'date' khi tính
 *    periodMonth cho MTD.
 *  - Đã thêm 3 breakdown_type mới CHỈ áp dụng cho google: 'keyword'
 *    (tab Keyword, alias 'search keyword'), 'campaign' (tab Campaign,
 *    breakdown_value = ad group, alias 'ad group'), 'term' (tab Term,
 *    alias 'search term'). KHÔNG thêm 3 loại này vào vòng lặp dimensions
 *    dùng chung cho cả 4 platform (age/gender/region/device) vì Meta/
 *    Tiktok/Youtube không có các tab này — xem getAllRawConfigsForProject
 *    bên dưới, gọi riêng cho google.
 *  - Tab "Utd" trong DATA_FACEBOOK_VU_2026.xlsx (data campaign-level,
 *    không breakdown) — theo xác nhận, KHÔNG cần sync, cố tình bỏ qua,
 *    không có config nào match tab này.
 *  - ⚠️ CHƯA XÁC NHẬN: nếu 2 tab trùng tên (vd 'Keyword' xuất hiện trong
 *    cả candidate YTD và MTD vì sheet chỉ có 1 tab 'Keyword' duy nhất,
 *    không tách ytd_/mtd_ riêng), findConfigForSheetTab (dùng .find(),
 *    trả về match ĐẦU TIÊN) sẽ luôn resolve về config được push trước
 *    (YTD) khi đồng bộ qua webhook theo tabName — bản MTD tương ứng có
 *    thể không bao giờ được trigger qua đường webhook single-tab. Nếu
 *    syncEngine của bạn cho phép nhiều config cùng khớp 1 tab (chạy tuần
 *    tự tất cả match thay vì chỉ lấy match đầu) thì không vấn đề gì —
 *    nhưng nếu không, cần tách sheet/tab riêng cho YTD và MTD của
 *    Keyword/Campaign/Term/Age/Gender/Region, hoặc đổi cơ chế dispatch.
 *    Báo tôi cách syncEngine xử lý nhiều config trùng tabName để tôi
 *    điều chỉnh thêm nếu cần.
 * ========================================================= */
export function buildDemographicConfig(
  platform: 'google' | 'meta' | 'tiktok' | 'youtube',
  dimension: 'age' | 'gender' | 'region' | 'device' | 'keyword' | 'campaign' | 'term',
  periodType: 'YTD' | 'MTD',
  sheetIdOverride?: string
): RowSyncConfig {
  const tabPrefixes = {
    google:  periodType === 'YTD' ? 'ytd_search' : 'mtd_search',
    meta:    periodType === 'YTD' ? 'ytd' : 'mtd',
    tiktok:  periodType === 'YTD' ? 'ytd_tiktok' : 'mtd_tiktok',
    youtube: periodType === 'YTD' ? 'ytd' : 'mtd',
  };

  // Tên tab kiểu cũ (có prefix ytd_/mtd_) — giữ lại phòng khi có sheet khác
  // đặt tên đúng kiểu này.
  const prefixedTabName = `${tabPrefixes[platform]}_${dimension}`;
  // Tên tab THẬT trong 2 file VUQ3: viết hoa chữ cái đầu, không prefix.
  const plainTabName = dimension.charAt(0).toUpperCase() + dimension.slice(1);
  const tabName = [prefixedTabName, plainTabName];

  const dimensionAliases: Record<string, string[]> = {
    age: ['age', 'age_(matched)', 'age (matched)'],
    gender: ['gender', 'gender_(matched)', 'gender (matched)'],
    region: ['region', 'region_(matched)', 'region (matched)'],
    device: ['device', 'thiết bị', 'platform'],
    // Google/SEM only:
    keyword: ['search_keyword', 'search keyword'],
    term: ['search_term', 'search term'],
    campaign: ['ad_group', 'ad group'],
  };

  return {
    table: 'ad_demographic_metrics',
    tabName,
    sheetIdOverride,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, ''), report_date`,
    deleteScopeColumns: ['period_month', 'platform', 'breakdown_type'],
    parseRowByHeader: (get) => {
      const campaignName = s(get(['campaign', 'campaign_name']));
      const breakdownValue = s(get(dimensionAliases[dimension]));
      if (!campaignName || !breakdownValue) return null;

      const dateStopRaw = get(['date_stop', 'end_date', 'end date', 'day', 'date']);
      const dateStop = parseSheetDate(dateStopRaw);
      if (!dateStop) return null; // không có ngày -> không biết insert vào report_date nào, bỏ qua row

      let periodMonth = periodType === 'YTD' ? 'YTD' : currentMonthAbbr();
      if (periodType === 'MTD' && dateStop) {
        periodMonth = currentMonthAbbrFromDate(dateStop);
      }

      const ctrRaw = nOrNull(get(['ctr']));
      const ctr = ctrRaw === null ? null : (platform === 'google' ? ctrRaw * 100 : ctrRaw);

      return {
        period_month: periodMonth,
        report_date: dateStop,          // 🆕 lưu đúng ngày thật, không chỉ bucket theo tháng
        platform,
        campaign_name: campaignName,
        breakdown_type: dimension,
        breakdown_value: breakdownValue,
        impressions: n(get(['impressions', 'impr.', 'impr'])),
        clicks: n(get(['clicks'])),
        reach: nOrNull(get(['reach'])),
        trueview_views: nOrNull(get(['trueview views', 'trueview_views'])),
        spend: nOrNull(get(['spend', 'cost'])),
        ctr,
      };
    },
  };
}

/* =========================================================
 * FETCH DEMOGRAPHIC SHEET IDS (QUERY VÀO DATABASE)
 * ========================================================= */
async function getDemographicSheetIds(projectCode: string): Promise<{ sem?: string; facebook?: string; tiktok?: string; youtube?: string }> {
  const res = await pool.query(
    `SELECT s.source_type, s.sheet_id
     FROM ad_project_sheet_sources s
     JOIN ad_projects p ON p.id = s.project_id
     WHERE p.project_code = $1`,
    [projectCode]
  );

  const result: { sem?: string; facebook?: string; tiktok?: string; youtube?: string } = {};
  for (const row of res.rows) {
    if (row.source_type === 'demographic_sem') result.sem = row.sheet_id;
    if (row.source_type === 'demographic_facebook') result.facebook = row.sheet_id;
    if (row.source_type === 'demographic_tiktok') result.tiktok = row.sheet_id;
    if (row.source_type === 'demographic_youtube') result.youtube = row.sheet_id;
  }
  return result;
}

export async function getAllRawConfigsForProject(projectCode: string): Promise<RowSyncConfig[]> {
  const isTanakan = projectCode !== 'MMU';
  const configs: RowSyncConfig[] = [];

  // --- các config report/raw còn thiếu ---
  configs.push(buildDateSelectionConfig(projectCode));
  configs.push(buildUnitCostPlanConfig(projectCode, 'YTD'));
  configs.push(buildUnitCostPlanConfig(projectCode, 'MTD'));
  configs.push(buildReportConfig(projectCode, 'YTD'));
  configs.push(buildReportConfig(projectCode, 'MTD'));
  configs.push(buildDataConfig(projectCode, 'YTD'));
  configs.push(buildDataConfig(projectCode, 'MTD'));
  configs.push(buildDeliveryStatusConfig(projectCode, 'YTD'));
  configs.push(buildDeliveryStatusConfig(projectCode, 'MTD'));
  configs.push(FACEBOOK_CONFIG);
  configs.push(TIKTOK_CONFIG);
  configs.push(buildAdxConfig(projectCode));
  configs.push(buildMbInpageConfig(projectCode));
  configs.push(buildSemYoutubeConfig('ad_raw_sem_data', 'SEM_DATA', projectCode));
  configs.push(buildSemYoutubeConfig('ad_raw_youtube_data', 'YOUTUBE_DATA', projectCode));

  if (isTanakan) {

    const demoSheets = await getDemographicSheetIds(projectCode);
    const dimensions = ['age', 'gender', 'region', 'device'] as const;

    if (demoSheets.sem) {
      dimensions.forEach((dim) => {
        configs.push(buildDemographicConfig('google', dim, 'YTD', demoSheets.sem));
        configs.push(buildDemographicConfig('google', dim, 'MTD', demoSheets.sem));
      });

      // 🔧 MỚI (VUQ3) — 3 tab bổ sung trong DATA_SEM_VU_2026.xlsx:
      // Keyword, Campaign, Term. Chỉ tồn tại ở nguồn Google/SEM nên tách
      // riêng khỏi vòng lặp `dimensions` dùng chung cho 4 platform.
      const googleOnlyDimensions = ['keyword', 'campaign', 'term'] as const;
      googleOnlyDimensions.forEach((dim) => {
        configs.push(buildDemographicConfig('google', dim, 'YTD', demoSheets.sem));
        configs.push(buildDemographicConfig('google', dim, 'MTD', demoSheets.sem));
      });
    }
    
    if (demoSheets.facebook) {
      dimensions.forEach((dim) => {
        configs.push(buildDemographicConfig('meta', dim, 'YTD', demoSheets.facebook));
        configs.push(buildDemographicConfig('meta', dim, 'MTD', demoSheets.facebook));
      });
      // Tab "Utd" trong DATA_FACEBOOK_VU_2026.xlsx (data campaign-level,
      // không breakdown theo age/gender/region) — theo xác nhận, KHÔNG
      // cần sync, cố tình không tạo config nào cho tab này.
    }

    if (demoSheets.youtube) {
      dimensions.forEach((dim) => {
        configs.push(buildDemographicConfig('youtube', dim, 'YTD', demoSheets.youtube));
        configs.push(buildDemographicConfig('youtube', dim, 'MTD', demoSheets.youtube));
      });
    }
    
    if (demoSheets.tiktok) {
      dimensions.forEach((dim) => {
        configs.push(buildDemographicConfig('tiktok', dim, 'YTD', demoSheets.tiktok));
        configs.push(buildDemographicConfig('tiktok', dim, 'MTD', demoSheets.tiktok));
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
 * ⚠️ LEGACY / KHÔNG CÒN ĐƯỢC GỌI TỪ getAllRawConfigsForProject.
 * Chức năng này đã được thay bằng buildDemographicConfig() dùng chung
 * (xem phía trên, đã cập nhật để khớp header + tên tab thật của VUQ3).
 * Giữ lại hàm này để không phá vỡ chỗ khác có thể còn import, nhưng nếu
 * không còn nơi nào dùng thì có thể xoá an toàn.
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
 * ⚠️ LEGACY / KHÔNG CÒN ĐƯỢC GỌI — xem ghi chú ở buildGoogleDemographicConfig.
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
 * ⚠️ LEGACY / KHÔNG CÒN ĐƯỢC GỌI — logic tương đương đã nằm trong
 * buildDemographicConfig('google', 'campaign', ...) ở trên (breakdown_value
 * = ad group, tab 'Campaign'). Giữ lại phòng khi có nơi khác import.
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
 * ⚠️ LEGACY / KHÔNG CÒN ĐƯỢC GỌI — logic tương đương đã nằm trong
 * buildDemographicConfig('google', 'term', ...) ở trên (tab 'Term',
 * alias 'search term'). Giữ lại phòng khi có nơi khác import.
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
 * (Áp dụng chung cho cả UNIT_COST_PLAN sau khi fix — cũng dùng mảng
 * tabName nên đã được xử lý đúng bởi Array.isArray check này. Cũng áp
 * dụng cho buildDemographicConfig sau khi thêm mảng [prefixedTabName,
 * plainTabName] cho VUQ3.)
 *
 * ⚠️ LƯU Ý — .find() chỉ trả về config KHỚP ĐẦU TIÊN. Với
 * buildDemographicConfig, cả bản YTD và MTD của cùng 1 dimension đều có
 * plainTabName giống hệt nhau (vd cả 2 đều chứa 'Keyword' trong mảng
 * candidate) vì sheet VUQ3 chỉ có 1 tab vật lý duy nhất cho mỗi dimension
 * (không tách riêng bản ytd_/mtd_). Nghĩa là nếu đồng bộ qua webhook theo
 * tabName, luôn chỉ có bản YTD (được push trước trong getAllRawConfigsForProject)
 * được chọn — bản MTD tương ứng sẽ không bao giờ khớp qua đường này. Nếu
 * bạn cần cả 2 bản cùng chạy khi có update ở tab đó, cần sửa hàm này để
 * trả về TẤT CẢ config khớp (không chỉ .find() đầu tiên) và cho phần gọi
 * nó lặp qua tất cả, hoặc tách sheet/tab vật lý riêng cho YTD/MTD.
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