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
 * ========================================================= */
function buildAdxConfig(projectCode: string): RowSyncConfig {
  const o = projectCode === 'TANAKAN' ? 1 : 0;
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
  const isTanakan = projectCode === 'TANAKAN';
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
 * UNIT_COST_PLAN (YTD + MTD)
 * ---------------------------------------------------------
 * Cột thực tế đã verify từ file gốc:
 *
 * YTD_UNIT_COST_PLAN (Tanakan, 9 cột):
 *   0 region, 1 phase, 2 channel, 3 buying_type, 4 asset,
 *   5 unit_cost, 6 quanity, 7 start_date, 8 end_date
 *
 * MTD_UNIT_COST_PLAN (Tanakan, 10 cột — có thêm cột month ở đầu):
 *   0 month, 1 region, 2 phase, 3 channel, 4 buying_type, 5 asset,
 *   6 unit_cost, 7 quanity, 8 start_date, 9 end_date
 *
 * UNIT_COST_PLAN (MMU, 7 cột — không có region, không có asset):
 *   0 phase, 1 channel, 2 buying_type, 3 unit_cost, 4 quanity,
 *   5 start_date, 6 end_date
 *
 * MMU không có sheet MTD_UNIT_COST_PLAN => tab không tồn tại => tự skip.
 * ========================================================= */
function buildUnitCostPlanConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN';
  const tabName = isTanakan
    ? periodType === 'YTD' ? 'YTD_UNIT_COST_PLAN' : 'MTD_UNIT_COST_PLAN'
    : periodType === 'YTD' ? 'UNIT_COST_PLAN' : 'MTD_UNIT_COST_PLAN'; // không tồn tại ở MMU -> auto skip

  return {
    table: 'ad_unit_cost_plan',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    parseRow: (row) => {
      if (periodType === 'MTD') {
        // chỉ Tanakan có nhánh này
        const month = s(row[0]);
        const channel = s(row[3]);
        const buyingType = s(row[4]);
        if (!month || !channel || !buyingType) return null;
        const phaseRaw = s(row[2])?.toLowerCase() ?? 'other';
        return {
          period_month: month,
          region: s(row[1]) ?? '',
          phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
          channel,
          buying_type: buyingType,
          asset: s(row[5]) ?? '',
          unit_cost: n(row[6]),
          planned_quantity: n(row[7]),
          start_date: parseSheetDate(row[8]),
          end_date: parseSheetDate(row[9]),
        };
      }

      // periodType === 'YTD'
      if (isTanakan) {
        const channel = s(row[2]);
        const buyingType = s(row[3]);
        if (!channel || !buyingType) return null;
        const phaseRaw = s(row[1])?.toLowerCase() ?? 'other';
        return {
          period_month: 'YTD',
          region: s(row[0]) ?? '',
          phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
          channel,
          buying_type: buyingType,
          asset: s(row[4]) ?? '',
          unit_cost: n(row[5]),
          planned_quantity: n(row[6]),
          start_date: parseSheetDate(row[7]),
          end_date: parseSheetDate(row[8]),
        };
      }

      // MMU YTD (UNIT_COST_PLAN) - không có region, không có asset
      const channel = s(row[1]);
      const buyingType = s(row[2]);
      if (!channel || !buyingType) return null;
      const phaseRaw = s(row[0])?.toLowerCase() ?? 'other';
      return {
        period_month: 'YTD',
        region: '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        asset: '',
        unit_cost: n(row[3]),
        planned_quantity: n(row[4]),
        start_date: parseSheetDate(row[5]),
        end_date: parseSheetDate(row[6]),
      };
    },
  };
}

/* =========================================================
 * DELIVERY_STATUS (YTD + MTD)
 * ---------------------------------------------------------
 * Cột thực tế đã verify từ file gốc:
 *
 * YTD_DELIVERY_STATUS (Tanakan, 20 cột):
 *   0 project, 1 region, 2 phase, 3 channel, 4 buying_type, 5 asset,
 *   6 start_date, 7 end_date, 8 unit_cost, 9 planned_quantity,
 *   10 actual_delivery, 11 time_passed_pct, 12 delivery_pct, 13 pacing_gap,
 *   14 actual_spend, 15 sold_value, 16 cost_optimized, 17 cost_optimized_pct,
 *   18 delivery_status, 19 cost_status
 *
 * DELIVERY_STATUS (MMU, 17 cột — không project/region/asset):
 *   0 phase, 1 channel, 2 buying_type, 3 start_date, 4 end_date,
 *   5 unit_cost, 6 planned_quantity, 7 actual_delivery, 8 time_passed_pct,
 *   9 delivery_pct, 10 pacing_gap, 11 actual_spend, 12 sold_value,
 *   13 cost_optimized, 14 cost_optimized_pct, 15 delivery_status, 16 cost_status
 *
 * MTD_DELIVERY_STATUS (Tanakan, 23 cột):
 *   0 period_month, 1 period_start_date, 2 period_end_date, 3 project,
 *   4 region, 5 phase, 6 channel, 7 buying_type, 8 asset,
 *   9 plan_start_date, 10 plan_end_date, 11 unit_cost, 12 planned_quantity,
 *   13 actual_delivery, 14 time_passed_pct, 15 delivery_pct, 16 pacing_gap,
 *   17 actual_spend, 18 sold_value, 19 cost_optimized, 20 cost_optimized_pct,
 *   21 delivery_status, 22 cost_status
 *   -> có hàng TOTAL cuối mỗi tháng (channel rỗng) => bị filter bởi guard !channel.
 *
 * MMU không có sheet MTD_DELIVERY_STATUS => tab không tồn tại => tự skip.
 * ========================================================= */
function buildDeliveryStatusConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN';
  const tabName = isTanakan
    ? periodType === 'YTD' ? 'YTD_DELIVERY_STATUS' : 'MTD_DELIVERY_STATUS'
    : periodType === 'YTD' ? 'DELIVERY_STATUS' : 'MTD_DELIVERY_STATUS'; // không tồn tại ở MMU -> auto skip

  return {
    table: 'ad_delivery_status',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    parseRow: (row) => {
      if (periodType === 'MTD') {
        // chỉ Tanakan có nhánh này
        const month = s(row[0]);
        const channel = s(row[6]);
        const buyingType = s(row[7]);
        const planStart = parseSheetDate(row[9]);
        if (!month || !channel || !buyingType || !planStart) return null;
        const phaseRaw = s(row[5])?.toLowerCase() ?? 'other';
        return {
          period_month: month,
          period_start_date: parseSheetDate(row[1]),
          period_end_date: parseSheetDate(row[2]),
          region: s(row[4]) ?? '',
          phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
          channel,
          buying_type: buyingType,
          asset: s(row[8]) ?? '',
          start_date: planStart, // = plan_start_date, giữ nguyên khoảng plan
          end_date: parseSheetDate(row[10]),
          unit_cost: n(row[11]),
          planned_quantity: n(row[12]),
          actual_delivery: n(row[13]),
          time_passed_pct: n(row[14]),
          delivery_pct: n(row[15]),
          pacing_gap: n(row[16]),
          actual_spend: n(row[17]),
          sold_value: n(row[18]),
          cost_optimized: n(row[19]),
          cost_optimized_pct: n(row[20]),
          delivery_status: s(row[21]),
          cost_status: s(row[22]),
        };
      }

      // periodType === 'YTD'
      const olead = isTanakan ? 2 : 0; // project + region (Tanakan only)
      const oasset = isTanakan ? 1 : 0; // asset (Tanakan only)
      const phaseRaw = s(row[0 + olead])?.toLowerCase() ?? 'other';
      const channel = s(row[1 + olead]);
      const buyingType = s(row[2 + olead]);
      const base = olead + 3 + oasset; // index của start_date
      const startDate = parseSheetDate(row[base]);
      if (!channel || !buyingType || !startDate) return null;
      return {
        period_month: 'YTD',
        period_start_date: null,
        period_end_date: null,
        region: isTanakan ? s(row[1]) ?? '' : '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
        channel,
        buying_type: buyingType,
        asset: isTanakan ? s(row[olead + 3]) ?? '' : '',
        start_date: startDate,
        end_date: parseSheetDate(row[base + 1]),
        unit_cost: n(row[base + 2]),
        planned_quantity: n(row[base + 3]),
        actual_delivery: n(row[base + 4]),
        time_passed_pct: n(row[base + 5]),
        delivery_pct: n(row[base + 6]),
        pacing_gap: n(row[base + 7]),
        actual_spend: n(row[base + 8]),
        sold_value: n(row[base + 9]),
        cost_optimized: n(row[base + 10]),
        cost_optimized_pct: n(row[base + 11]),
        delivery_status: s(row[base + 12]),
        cost_status: s(row[base + 13]),
      };
    },
  };
}

/** Trả về toàn bộ config cần chạy cho 1 project (đã tự chỉnh theo cấu trúc sheet riêng) */
export function getAllRawConfigsForProject(projectCode: string): RowSyncConfig[] {
  const isTanakan = projectCode === 'TANAKAN';

  const configs: RowSyncConfig[] = [
    buildDateSelectionConfig(projectCode),
    buildUnitCostPlanConfig(projectCode, 'YTD'),
    buildDeliveryStatusConfig(projectCode, 'YTD'),
    FACEBOOK_CONFIG,
    TIKTOK_CONFIG,
    buildSemYoutubeConfig('ad_raw_sem_data', 'SEM_DATA', projectCode),
    buildSemYoutubeConfig('ad_raw_youtube_data', 'YOUTUBE_DATA', projectCode),
    buildAdxConfig(projectCode),
    buildMbInpageConfig(projectCode),
  ];

  // MMU chưa có sheet MTD_UNIT_COST_PLAN / MTD_DELIVERY_STATUS trong Google Sheet
  // thật (không phải tab rỗng mà tab KHÔNG TỒN TẠI) -> gọi range này Google Sheets
  // API trả lỗi "Unable to parse range" chứ không tự skip êm như tab rỗng.
  // => chỉ thêm 2 config MTD này khi là Tanakan, tránh log lỗi giả mỗi lần sync.
  if (isTanakan) {
    configs.push(
      buildUnitCostPlanConfig(projectCode, 'MTD'),
      buildDeliveryStatusConfig(projectCode, 'MTD'),
    );
  }

  return configs;
}