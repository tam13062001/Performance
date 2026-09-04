// project_code thật trong DB
export type DbProject = { code: string; label: string; sheetId?: string };

export type RangeDays = 7 | 14 | 30 | 90;

export type SortMetric = "impressions" | "reach" | "clicks" | "engagements" | "spend" | "ctr";