import { RowSyncConfig } from './syncEngine';
import { parseSheetNumber, parseSheetDate } from './syncHelpers';

const s = (v: unknown): string | null => (v !== null && v !== undefined && String(v).trim() !== '' ? String(v).trim() : null);
const n = (v: unknown): number => parseSheetNumber(v);
const nOrNull = (v: unknown): number | null => (v === null || v === undefined || String(v).trim() === '' ? null : parseSheetNumber(v));

/* =========================================================
 * FACEBOOK_DATA - chỉ TANAKAN có data, MMU rỗng (sẽ tự skip)
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
 * => cần factory function riêng theo projectCode
 * ========================================================= */
function buildSemYoutubeConfig(table: string, tabName: string, projectCode: string): RowSyncConfig {
  return {
    table,
    tabName,
    conflictColumns: `project_id, report_date, campaign_name`,
    parseRow: (row) => {
      if (projectCode === 'TANAKAN') {
        // [0]Day [1]Account name [2]Customer ID [3]Campaign [4]Campaign state [5]Campaign type
        // [6]Impr. [7]Clicks [8]CTR [9]Currency code [10]Avg.CPC [11]Cost [12]TrueView views
        // [13]TrueView view rate [14]TrueView avg.CPV [15]Avg.CPM [16]Search impr.share
        // [17]Search lost IS(rank) [18]Search lost IS(budget) ...
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

      // MMU: [0]Day [1]Campaign status [2]Campaign [3]Budget name [4]Currency code [5]Budget
      // [6]Budget type [7]Currency [8]Status [9]Status reasons [10]TrueView views
      // [11]TrueView avg.CPV [12]Clicks [13]CTR [14]Avg.CPC [15]Impr. [16]Cost
      // [17]TrueView view rate [18]Search impr.share [19]Search lost IS(budget)
      // [20]Search lost IS(rank) [21]Unique users
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
 * ========================================================= */
function buildAdxConfig(projectCode: string): RowSyncConfig {
  const o = projectCode === 'TANAKAN' ? 1 : 0; // Tanakan có thêm cột Region ở index 1
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
 * ========================================================= */
function buildMbInpageConfig(projectCode: string): RowSyncConfig {
  const o = projectCode === 'TANAKAN' ? 1 : 0;
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
 * ========================================================= */
function buildDateSelectionConfig(projectCode: string): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN'; // Tanakan có thêm cột report_type ở đầu
  return {
    table: 'ad_sheet_date_selection',
    tabName: 'DATE_SELECTION',
    conflictColumns: `project_id, start_date, end_date`,
    parseRow: (row) => {
      const start = parseSheetDate(row[isTanakan ? 1 : 0]);
      const end = parseSheetDate(row[isTanakan ? 2 : 1]);
      if (!start || !end) return null;
      return { start_date: start, end_date: end };
    },
  };
}

/* =========================================================
 * UNIT_COST_PLAN (MMU) / YTD_UNIT_COST_PLAN (Tanakan)
 * ========================================================= */
function buildUnitCostPlanConfig(projectCode: string): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN';
  return {
    table: 'ad_unit_cost_plan',
    tabName: isTanakan ? 'YTD_UNIT_COST_PLAN' : 'UNIT_COST_PLAN',
    conflictColumns: `project_id, phase, channel, COALESCE(buying_type, ''), start_date, end_date`,
    parseRow: (row) => {
      // Tanakan: [0]region [1]phase [2]channel [3]buying_type [4]asset [5]unit_cost [6]quanity [7]start_date [8]end_date
      // MMU:     [0]phase  [1]channel [2]buying_type [3]unit_cost [4]quanity [5]start_date [6]end_date
      const o = isTanakan ? 1 : 0;
      const phaseRaw = s(row[0 + o])?.toLowerCase() ?? 'other';
      const channel = s(row[1 + o]);
      const buyingType = s(row[2 + o]);
      const startDate = parseSheetDate(row[5 + o]);
      if (!channel || !buyingType) return null;
      return {
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        unit_cost: n(row[3 + o]),
        planned_quantity: n(row[4 + o]),
        start_date: startDate,
        end_date: parseSheetDate(row[6 + o]),
      };
    },
  };
}

/* =========================================================
 * DELIVERY_STATUS (MMU) / YTD_DELIVERY_STATUS (Tanakan)
 * ========================================================= */
function buildDeliveryStatusConfig(projectCode: string): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN';
  return {
    table: 'ad_delivery_status',
    tabName: isTanakan ? 'YTD_DELIVERY_STATUS' : 'DELIVERY_STATUS',
    conflictColumns: `project_id, phase, channel, COALESCE(buying_type, ''), start_date, end_date`,
    parseRow: (row) => {
      // Tanakan: [0]project [1]region [2]phase [3]channel [4]buying_type [5]asset [6]start_date [7]end_date
      //          [8]unit_cost [9]planned_quantity [10]actual_delivery [11]time_passed_pct [12]delivery_pct
      //          [13]pacing_gap [14]actual_spend [15]sold_value [16]cost_optimized [17]cost_optimized_pct
      //          [18]delivery_status [19]cost_status
      // MMU:     [0]phase [1]channel [2]buying_type [3]start_date [4]end_date [5]unit_cost [6]planned_quantity
      //          [7]actual_delivery [8]time_passed_pct [9]delivery_pct [10]pacing_gap [11]actual_spend
      //          [12]sold_value [13]cost_optimized [14]cost_optimized_pct [15]delivery_status [16]cost_status
      const o = isTanakan ? 2 : 0;
      const phaseRaw = s(row[0 + o])?.toLowerCase() ?? 'other';
      const channel = s(row[1 + o]);
      const buyingType = s(row[2 + o]);
      const startDate = parseSheetDate(row[3 + o]);
      if (!channel || !buyingType || !startDate) return null;
      return {
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        start_date: startDate,
        end_date: parseSheetDate(row[4 + o]),
        unit_cost: n(row[5 + o]),
        planned_quantity: n(row[6 + o]),
        actual_delivery: n(row[7 + o]),
        time_passed_pct: n(row[8 + o]),
        delivery_pct: n(row[9 + o]),
        pacing_gap: n(row[10 + o]),
        actual_spend: n(row[11 + o]),
        sold_value: n(row[12 + o]),
        cost_optimized: n(row[13 + o]),
        cost_optimized_pct: n(row[14 + o]),
        delivery_status: s(row[15 + o]),
        cost_status: s(row[16 + o]),
      };
    },
  };
}

/** Trả về toàn bộ config cần chạy cho 1 project (đã tự chỉnh theo cấu trúc sheet riêng) */
export function getAllRawConfigsForProject(projectCode: string): RowSyncConfig[] {
  return [
    buildDateSelectionConfig(projectCode),
    buildUnitCostPlanConfig(projectCode),
    buildDeliveryStatusConfig(projectCode),
    FACEBOOK_CONFIG,
    TIKTOK_CONFIG,
    buildSemYoutubeConfig('ad_raw_sem_data', 'SEM_DATA', projectCode),
    buildSemYoutubeConfig('ad_raw_youtube_data', 'YOUTUBE_DATA', projectCode),
    buildAdxConfig(projectCode),
    buildMbInpageConfig(projectCode),
  ];
}