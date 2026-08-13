// Map tên tab trong Google Sheet -> tên bảng DB đích tương ứng (param `table`
// của /api/sync). Dựa theo quy ước tab hiện tại của Excel.
export const SHEET_TAB_TO_TABLE: Record<string, string> = {
  YTD_DATA: 'ad_raw_data',
  MTD_DATA: 'ad_raw_data',
  YTD_DELIVERY_STATUS: 'ad_delivery_status',
  MTD_DELIVERY_STATUS: 'ad_delivery_status',
  YTD_UNIT_COST_PLAN: 'ad_unit_cost_plan',
  MTD_UNIT_COST_PLAN: 'ad_unit_cost_plan',
  YTD_REPORT: 'ad_raw_report',
  MTD_REPORT: 'ad_raw_report',
  SEM_DATA: 'ad_raw_sem_data',
  YOUTUBE_DATA: 'ad_raw_youtube_data',
  FACEBOOK_DATA: 'ad_raw_facebook_data',
  FACEBOOK_DETAIL_OUTPUT: 'ad_facebook_detail_output',
  ADX_DATA: 'ad_raw_adx_data',
  'MB Inpage_DATA': 'ad_raw_mb_inpage_data',
  TIKTOK_DATA: 'ad_raw_tiktok_data',
  LINKEDIN_DATA: 'ad_raw_linkedin_data',
  GDN_DATA: 'ad_raw_gdn_data',
  ZALO_DATA: 'ad_raw_zalo_data',
  DATE_SELECTION: 'ad_sheet_date_selection',
};

export function tableForSheetTab(tabTitle: string): string | null {
  return SHEET_TAB_TO_TABLE[tabTitle] ?? null;
}