import { RowSyncConfig } from './syncEngine';
import { parseSheetNumber, parseSheetDate } from './syncHelpers';
// Thêm vào syncConfigs.ts (hoặc file riêng import vào), dùng chung pool như syncEngine.ts
import { pool } from './db';



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
 * REPORT (YTD + MTD) - raw metrics gộp theo region/phase/channel/buying_type/asset
 * ---------------------------------------------------------
 * Cột thực tế đã verify từ file gốc:
 *
 * YTD_REPORT (Tanakan, 17 cột):
 *   0 project, 1 region, 2 phase, 3 channel, 4 buying_type, 5 asset,
 *   6 start_date, 7 end_date, 8 Reach, 9 Impressions, 10 Engagements,
 *   11 Views, 12 Clicks, 13 Link Clicks, 14 Landing Page Views, 15 Leads, 16 Spend
 *
 * MTD_REPORT (Tanakan, 20 cột):
 *   0 period_month, 1 period_start_date, 2 period_end_date, 3 project,
 *   4 region, 5 phase, 6 channel, 7 buying_type, 8 asset,
 *   9 start_date, 10 end_date, 11 Reach, 12 Impressions, 13 Engagements,
 *   14 Views, 15 Clicks, 16 Link Clicks, 17 Landing Page Views, 18 Leads, 19 Spend
 *
 * YTD_REPORT (MMU, 15 cột — không region, không asset):
 *   0 project, 1 phase, 2 channel, 3 buying_type, 4 start_date, 5 end_date,
 *   6 Reach, 7 Impressions, 8 Engagements, 9 Views, 10 Clicks, 11 Link Clicks,
 *   12 Landing Page Views, 13 Leads, 14 Spend
 *
 * MMU không có sheet MTD_REPORT => tab không tồn tại => KHÔNG add config (giống MTD_UNIT_COST_PLAN/MTD_DELIVERY_STATUS).
 * ========================================================= */
function buildReportConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN';
  const tabName = periodType === 'YTD' ? 'YTD_REPORT' : 'MTD_REPORT';

  return {
    table: 'ad_raw_report',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    parseRow: (row) => {
      if (periodType === 'MTD') {
        // chỉ Tanakan có nhánh này
        const month = s(row[0]);
        const channel = s(row[6]);
        const buyingType = s(row[7]);
        if (!month || !channel || !buyingType) return null;
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
          start_date: parseSheetDate(row[9]),
          end_date: parseSheetDate(row[10]),
          reach: n(row[11]),
          impressions: n(row[12]),
          engagements: n(row[13]),
          views: n(row[14]),
          clicks: n(row[15]),
          link_clicks: n(row[16]),
          landing_page_views: n(row[17]),
          leads: n(row[18]),
          spend: n(row[19]),
        };
      }

      // periodType === 'YTD' — viết tường minh theo từng project để tránh nhầm offset
      if (isTanakan) {
        const channelT = s(row[3]);
        const buyingTypeT = s(row[4]);
        if (!channelT || !buyingTypeT) return null;
        const phaseRaw = s(row[2])?.toLowerCase() ?? 'other';
        return {
          period_month: 'YTD',
          region: s(row[1]) ?? '',
          phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
          channel: channelT,
          buying_type: buyingTypeT,
          asset: s(row[5]) ?? '',
          start_date: parseSheetDate(row[6]),
          end_date: parseSheetDate(row[7]),
          reach: n(row[8]),
          impressions: n(row[9]),
          engagements: n(row[10]),
          views: n(row[11]),
          clicks: n(row[12]),
          link_clicks: n(row[13]),
          landing_page_views: n(row[14]),
          leads: n(row[15]),
          spend: n(row[16]),
        };
      }

      // MMU YTD_REPORT
      const channelM = s(row[2]);
      const buyingTypeM = s(row[3]);
      if (!channelM || !buyingTypeM) return null;
      const phaseRawM = s(row[1])?.toLowerCase() ?? 'other';
      return {
        period_month: 'YTD',
        region: '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRawM) ? phaseRawM : 'other',
        channel: channelM,
        buying_type: buyingTypeM,
        asset: '',
        start_date: parseSheetDate(row[4]),
        end_date: parseSheetDate(row[5]),
        reach: n(row[6]),
        impressions: n(row[7]),
        engagements: n(row[8]),
        views: n(row[9]),
        clicks: n(row[10]),
        link_clicks: n(row[11]),
        landing_page_views: n(row[12]),
        leads: n(row[13]),
        spend: n(row[14]),
      };
    },
  };
}

/* =========================================================
 * DATA (YTD + MTD) - KHÁC ad_raw_report:
 *   + end_date = ngày kết thúc PLAN (cố định), không phải cutoff báo cáo.
 *   + MMU: sheet này gộp sẵn planned_quantity/actual_delivery/delivery_status...
 *     (Tanakan không có các cột này -> để NULL).
 * ---------------------------------------------------------
 * Cột thực tế đã verify từ file gốc:
 *
 * YTD_DATA (Tanakan, 17 cột — giống hệt layout YTD_REPORT):
 *   0 project, 1 region, 2 phase, 3 channel, 4 buying_type, 5 asset,
 *   6 start_date, 7 end_date, 8 Reach, 9 Impressions, 10 Engagements,
 *   11 Views, 12 Clicks, 13 Link Clicks, 14 Landing Page Views, 15 Leads, 16 Spend
 *
 * MTD_DATA (Tanakan, 20 cột — giống hệt layout MTD_REPORT):
 *   0 period_month, 1 period_start_date, 2 period_end_date, 3 project,
 *   4 region, 5 phase, 6 channel, 7 buying_type, 8 asset,
 *   9 start_date, 10 end_date, 11 Reach, 12 Impressions, 13 Engagements,
 *   14 Views, 15 Clicks, 16 Link Clicks, 17 Landing Page Views, 18 Leads, 19 Spend
 *
 * YTD_DATA (MMU, 25 cột — không region/asset, có thêm plan+status):
 *   0 project, 1 phase, 2 channel, 3 buying_type, 4 start_date, 5 end_date,
 *   6 Reach, 7 Impressions, 8 Engagements, 9 Views, 10 Clicks, 11 Link Clicks,
 *   12 Landing Page Views, 13 Leads, 14 Spend, 15 planned_quantity,
 *   16 actual_delivery, 17 time_passed_pct, 18 delivery_pct, 19 pacing_gap,
 *   20 sold_value, 21 cost_optimized, 22 cost_optimized_pct,
 *   23 delivery_status, 24 cost_status
 *
 * MMU không có sheet MTD_DATA => KHÔNG add config (giống MTD_REPORT).
 * ========================================================= */
function buildDataConfig(projectCode: string, periodType: 'YTD' | 'MTD'): RowSyncConfig {
  const isTanakan = projectCode === 'TANAKAN';
  const tabName = periodType === 'YTD' ? 'YTD_DATA' : 'MTD_DATA';

  return {
    table: 'ad_raw_data',
    tabName,
    conflictColumns: `project_id, period_month, region, phase, channel, buying_type, asset, start_date, end_date`,
    parseRow: (row) => {
      if (periodType === 'MTD') {
        // chỉ Tanakan có nhánh này, layout giống hệt MTD_REPORT
        const month = s(row[0]);
        const channel = s(row[6]);
        const buyingType = s(row[7]);
        if (!month || !channel || !buyingType) return null;
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
          start_date: parseSheetDate(row[9]),
          end_date: parseSheetDate(row[10]),
          reach: n(row[11]),
          impressions: n(row[12]),
          engagements: n(row[13]),
          views: n(row[14]),
          clicks: n(row[15]),
          link_clicks: n(row[16]),
          landing_page_views: n(row[17]),
          leads: n(row[18]),
          spend: n(row[19]),
          // Tanakan MTD_DATA không có cột plan/status
          planned_quantity: null,
          actual_delivery: null,
          time_passed_pct: null,
          delivery_pct: null,
          pacing_gap: null,
          sold_value: null,
          cost_optimized: null,
          cost_optimized_pct: null,
          delivery_status: null,
          cost_status: null,
        };
      }

      // periodType === 'YTD'
      if (isTanakan) {
        const channelT = s(row[3]);
        const buyingTypeT = s(row[4]);
        if (!channelT || !buyingTypeT) return null;
        const phaseRaw = s(row[2])?.toLowerCase() ?? 'other';
        return {
          period_month: 'YTD',
          region: s(row[1]) ?? '',
          phase: ['awareness', 'consideration', 'conversion'].includes(phaseRaw) ? phaseRaw : 'other',
          channel: channelT,
          buying_type: buyingTypeT,
          asset: s(row[5]) ?? '',
          start_date: parseSheetDate(row[6]),
          end_date: parseSheetDate(row[7]),
          reach: n(row[8]),
          impressions: n(row[9]),
          engagements: n(row[10]),
          views: n(row[11]),
          clicks: n(row[12]),
          link_clicks: n(row[13]),
          landing_page_views: n(row[14]),
          leads: n(row[15]),
          spend: n(row[16]),
          planned_quantity: null,
          actual_delivery: null,
          time_passed_pct: null,
          delivery_pct: null,
          pacing_gap: null,
          sold_value: null,
          cost_optimized: null,
          cost_optimized_pct: null,
          delivery_status: null,
          cost_status: null,
        };
      }

      // MMU YTD_DATA - có sẵn plan/status gộp trong cùng dòng
      const channelM = s(row[2]);
      const buyingTypeM = s(row[3]);
      if (!channelM || !buyingTypeM) return null;
      const phaseRawM = s(row[1])?.toLowerCase() ?? 'other';
      return {
        period_month: 'YTD',
        region: '',
        phase: ['awareness', 'consideration', 'conversion'].includes(phaseRawM) ? phaseRawM : 'other',
        channel: channelM,
        buying_type: buyingTypeM,
        asset: '',
        start_date: parseSheetDate(row[4]),
        end_date: parseSheetDate(row[5]),
        reach: n(row[6]),
        impressions: n(row[7]),
        engagements: n(row[8]),
        views: n(row[9]),
        clicks: n(row[10]),
        link_clicks: n(row[11]),
        landing_page_views: n(row[12]),
        leads: n(row[13]),
        spend: n(row[14]),
        planned_quantity: nOrNull(row[15]),
        actual_delivery: nOrNull(row[16]),
        time_passed_pct: nOrNull(row[17]),
        delivery_pct: nOrNull(row[18]),
        pacing_gap: nOrNull(row[19]),
        sold_value: nOrNull(row[20]),
        cost_optimized: nOrNull(row[21]),
        cost_optimized_pct: nOrNull(row[22]),
        delivery_status: s(row[23]),
        cost_status: s(row[24]),
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
  const isTanakan = projectCode === 'TANAKAN';

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
      // ⬅️ mới: campaign + keyword report (chỉ có bản MTD trong file mẫu)
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
/* =========================================================
 * DEMOGRAPHIC — Google/SEM (age, gender, region)
 * ---------------------------------------------------------
 * Sheet có 3 dòng preamble trước data (title, date-range, header cột),
 * không có cột month riêng cho bản MTD -> period_month tính theo tháng
 * hiện tại lúc sync (server time) đối với MTD, cố định 'YTD' cho bản YTD.
 *
 * Cột thực tế (đã verify từ file mẫu):
 *   0 Campaign, 1 Age/Gender/Region (Matched), 2 Clicks, 3 Impr., 4 CTR
 * ========================================================= */
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function currentMonthAbbr(): string {
  return MONTHS[new Date().getMonth()];
}

function buildGoogleDemographicConfig(
  dimension: 'age' | 'gender' | 'region',
  periodType: 'YTD' | 'MTD'
): RowSyncConfig {
  const tabName = periodType === 'YTD' ? `ytd_search_${dimension}` : `mtd_search_${dimension}`;
  const periodMonth = periodType === 'YTD' ? 'YTD' : currentMonthAbbr();

  return {
    table: 'ad_demographic_metrics',
    tabName,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    parseRow: (row) => {
      const campaignName = s(row[0]);
      const breakdownValue = s(row[1]);
      // Lọc bỏ 3 dòng preamble (title/date-range/header): các dòng đó
      // không có breakdownValue hợp lệ hoặc row[2] chính là chữ "Clicks" (header).
      if (!campaignName || !breakdownValue || row[2] === 'Clicks') return null;

      return {
        period_month: periodMonth,
        platform: 'google',
        campaign_name: campaignName,
        breakdown_type: dimension,
        breakdown_value: breakdownValue,
        clicks: n(row[2]),
        impressions: n(row[3]),
        ctr: nOrNull(row[4]) !== null ? n(row[4]) * 100 : null,
        reach: null,
        spend: null,
      };
    },
  };
}

/* =========================================================
 * DEMOGRAPHIC — Meta/Facebook (age, gender, region)
 * ---------------------------------------------------------
 * Header thật ở row đầu, có date_start/date_stop MỖI DÒNG -> dùng
 * trực tiếp để tính period_month chính xác, không cần đoán theo server time.
 *
 * Cột thực tế (đã verify từ file mẫu, theo tên header — vị trí index
 * có thể lệch giữa các tab nên KHÔNG dùng số cột cố định ở đây; nếu
 * engine chỉ truyền row dạng mảng theo index, cần map cứng index dưới
 * đây khớp đúng thứ tự cột thật trong sheet của bạn):
 *   ad_account_id, report_start_date, report_end_date, date_start, date_stop,
 *   age|gender|region, campaign_name, adset_name, ad_name, objective,
 *   spend, impressions, reach, clicks, ctr, cpc, cpm, frequency, ...
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
 * SEM mtd_search_campaign — report mức Ad (headline/description),
 * chỉ lấy Campaign/Ad group/Clicks/Impr./CTR, lưu vào ad_demographic_metrics
 * với breakdown_type='campaign' (tái dùng bảng đã có, không tạo bảng mới).
 * Cột thật: 0 Campaign, 1 Ad group, ... 49 Clicks, 50 Impr., 51 CTR
 * ========================================================= */
function buildGoogleSearchCampaignConfig(sheetIdOverride?: string): RowSyncConfig {
  return {
    table: 'ad_demographic_metrics',
    tabName: 'mtd_search_campaign',
    sheetIdOverride,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    parseRow: (row) => {
      const campaignName = s(row[0]);
      const adGroup = s(row[1]);
      // 3 dòng preamble (title/date-range/header) bị loại vì row[49] không phải số ở các dòng đó
      if (!campaignName || !adGroup || row[49] === 'Clicks') return null;

      return {
        period_month: currentMonthAbbr(),
        platform: 'google',
        campaign_name: campaignName,
        breakdown_type: 'campaign',
        breakdown_value: adGroup,
        clicks: n(row[49]),
        impressions: n(row[50]),
        ctr: nOrNull(row[51]) !== null ? n(row[51]) * 100 : null,
        reach: null,
        spend: null,
      };
    },
  };
}

/* =========================================================
 * SEM mtd_search_keyword — report search term
 * Cột thật: 0 Search term, 1 Ad group, 2 Clicks, 3 Impr., 4 CTR
 * ========================================================= */
function buildGoogleSearchKeywordConfig(sheetIdOverride?: string): RowSyncConfig {
  return {
    table: 'ad_demographic_metrics',
    tabName: 'mtd_search_keyword',
    sheetIdOverride,
    conflictColumns: `project_id, period_month, platform, breakdown_type, breakdown_value, COALESCE(campaign_name, '')`,
    parseRow: (row) => {
      const searchTerm = s(row[0]);
      const adGroup = s(row[1]);
      if (!searchTerm || row[2] === 'Clicks') return null;

      return {
        period_month: currentMonthAbbr(),
        platform: 'google',
        campaign_name: adGroup, // không có tên campaign ở tab này, dùng ad group thay thế
        breakdown_type: 'keyword',
        breakdown_value: searchTerm,
        clicks: n(row[2]),
        impressions: n(row[3]),
        ctr: nOrNull(row[4]) !== null ? n(row[4]) * 100 : null,
        reach: null,
        spend: null,
      };
    },
  };
}

export async function findConfigForSheetTab(
  sheetId: string,
  tabName: string
): Promise<{ projectCode: string; config: RowSyncConfig } | null> {
  // Lấy tất cả project active để dò — với hệ thống nhỏ (vài project) việc này đủ nhanh
  const projectsRes = await pool.query(`SELECT project_code FROM ad_projects`);

  for (const { project_code } of projectsRes.rows) {
    const configs = await getAllRawConfigsForProject(project_code);
    const found = configs.find((c) => c.tabName === tabName);
    if (!found) continue;

    // Xác nhận đúng sheet_id (main sheet hoặc sheetIdOverride)
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