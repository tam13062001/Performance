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


  mtd_search_campaign: 'ad_demographic_metrics',
  mtd_search_keyword: 'ad_demographic_metrics',
  ytd_search_age: 'ad_demographic_metrics',
  mtd_search_age: 'ad_demographic_metrics',
  ytd_search_gender: 'ad_demographic_metrics',
  mtd_search_gender: 'ad_demographic_metrics',
  ytd_search_region: 'ad_demographic_metrics',
  mtd_search_region: 'ad_demographic_metrics',

  // Demographic — Meta
  ytd_age: 'ad_demographic_metrics',
  mtd_age: 'ad_demographic_metrics',
  ytd_gender: 'ad_demographic_metrics',
  mtd_gender: 'ad_demographic_metrics',
  ytd_region: 'ad_demographic_metrics',
  mtd_region: 'ad_demographic_metrics',
};

export function tableForSheetTab(tabTitle: string): string | null {
  return SHEET_TAB_TO_TABLE[tabTitle] ?? null;
}

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