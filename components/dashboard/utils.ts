import type { DailyMetricRow } from "@/lib/dashboard-data";

export function classifyChannel(channel: string): "google" | "meta" | "other" {
  const upper = (channel || "").toUpperCase();
  if (["SEM", "ADX", "YOUTUBE"].includes(upper)) return "google";
  if (["FACEBOOK", "INSTAGRAM", "TIKTOK"].includes(upper)) return "meta";
  return "other";
}

/**
 * Gộp các row raw (1 row = 1 campaign/1 report_date) thành 1 row/campaign,
 * cộng dồn các metric trong khoảng ngày đã filter.
 *
 * Lưu ý: `reach` là unique users nên cộng dồn nhiều ngày sẽ overcounting
 * (1 user xem nhiều ngày bị đếm nhiều lần). Nếu cần reach chính xác theo
 * range, phải tính từ nguồn dữ liệu hỗ trợ dedup theo user, không thể suy
 * ra từ việc sum các daily reach.
 */
export function aggregateByCampaign(rows: DailyMetricRow[]) {
  const map = new Map<string, {
    id: string;
    campaign_name: string;
    channel: string;
    phase: string;
    impressions: number;
    reach: number;
    clicks: number;
    engagements: number;
    spend: number;
  }>();

  for (const r of rows) {
    // Gộp theo cả campaign + channel, tránh trộn lẫn số liệu của 2 kênh
    // khác nhau vào chung 1 dòng khi 1 campaign chạy đa kênh.
    const key = `${r.campaign_name}__${r.channel}`;
    const existing = map.get(key);

    if (existing) {
      existing.impressions += r.impressions;
      existing.reach += r.reach;
      existing.clicks += r.clicks;
      existing.engagements += r.engagements;
      existing.spend += r.spend;
    } else {
      map.set(key, {
        id: key,
        campaign_name: r.campaign_name,
        channel: r.channel,
        phase: r.phase,
        impressions: r.impressions,
        reach: r.reach,
        clicks: r.clicks,
        engagements: r.engagements,
        spend: r.spend,
      });
    }
  }

  return Array.from(map.values());
}

export function formatDateVN(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function currentMonthAbbrClient(): string {
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return MONTHS[new Date().getMonth()];
}