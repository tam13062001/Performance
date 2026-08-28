import { fetchTable } from "./api-client";

// ---------- Format helpers ----------
export const vnd = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + " tỷ";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " tr";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
};

export const num = (n: number) => (Number.isFinite(n) ? new Intl.NumberFormat("vi-VN").format(Math.round(n)) : "—");
export const float = (n: number) => 
  Number.isFinite(n) 
    ? new Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n) 
    : "—";
export const pct = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2)}%` : "—");

export const freqFmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) + "x" : "—");
export const ctrOf = (imp: number, clk: number) => (imp > 0 ? (clk / imp) * 100 : 0);
export const erOf = (imp: number, eng: number) => (imp > 0 ? (eng / imp) * 100 : 0); // <-- Thêm helper erOf
export const cpcOf = (spend: number, clk: number) => (clk > 0 ? spend / clk : 0);
export const freqOf = (imp: number, reach: number) => (reach > 0 ? imp / reach : 0);

export const cr = (num1: number, num2: number) => (num2 > 0 ? (num1 / num2) * 100 : 0);

// ---------- Row types khớp DB thật ----------
export type DataStatusRow = {
  id: string;
  project_id: string;
  import_batch_id: number;
  period_month: string;
  period_start_date: string | null;
  period_end_date: string | null;
  region: string;
  phase: string;
  channel: string;
  buying_type: string;
  asset: string;
  start_date: string | null;
  end_date: string | null;
  reach: number;
  impressions: number;
  engagements: number;
  views: number;
  clicks: number;
  link_clicks: number;
  landing_page_views: number;
  leads: number;
  spend: number;
  planned_quantity: number;
  actual_delivery: number;
  time_passed_pct: number;
  delivery_pct: number;
  pacing_gap: number;
  sold_value: number;
  cost_optimized: number;
  cost_optimized_pct: number;
  delivery_status: string | null;
  cost_status: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryStatusRow = {
  id: string;
  project_id: string;
  period_month: string;
  region: string;
  phase: string;
  channel: string;
  buying_type: string;
  asset: string;
  unit_cost: number;
  planned_quantity: number;
  actual_delivery: number;
  time_passed_pct: number;
  delivery_pct: number;
  pacing_gap: number;
  actual_spend: number;
  sold_value: number;
  cost_optimized: number;
  cost_optimized_pct: number;
  delivery_status: string | null;
  cost_status: string | null;
};

export type UnitCostPlanRow = {
  id: string;
  project_id: string;
  period_month: string;
  region: string;
  phase: string;
  channel: string;
  buying_type: string;
  asset: string;
  unit_cost: number;
  planned_quantity: number;
  start_date: string;
  end_date: string;
};

export type ReportRow = {
  id: string;
  project_id: string;
  period_month: string;
  region: string;
  phase: string;
  channel: string;
  buying_type: string;
  asset: string;
  reach: number;
  impressions: number;
  engagements: number;
  views: number;
  clicks: number;
  link_clicks: number;
  landing_page_views: number;
  leads: number;
  spend: number;
};

const MONTH_ORDER = ["MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR"];
export function sortByMonth(a: string, b: string) {
  return MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b);
}

// ---------- Fetch tiện dụng ----------
export async function loadDataStatus(projectCode: string, periodMonth: string): Promise<DataStatusRow[]> {
  const all = await fetchTable<DataStatusRow>("ad_raw_data", projectCode);
  return all.filter((r) => r.period_month === periodMonth);
}

export async function loadDeliveryStatus(projectCode: string, periodMonth: string): Promise<DeliveryStatusRow[]> {
  const all = await fetchTable<DeliveryStatusRow>("ad_delivery_status", projectCode);
  return all.filter((r) => r.period_month === periodMonth);
}

export async function loadUnitCostPlan(projectCode: string, periodMonth: string): Promise<UnitCostPlanRow[]> {
  const all = await fetchTable<UnitCostPlanRow>("ad_unit_cost_plan", projectCode);
  return all.filter((r) => r.period_month === periodMonth);
}

export async function loadReport(projectCode: string, periodMonth: string): Promise<ReportRow[]> {
  const all = await fetchTable<ReportRow>("ad_raw_report", projectCode);
  return all.filter((r) => r.period_month === periodMonth);
}

export async function loadAvailableMonths(projectCode: string): Promise<string[]> {
  const all = await fetchTable<DeliveryStatusRow>("ad_delivery_status", projectCode);
  const months = new Set(all.map((r) => r.period_month).filter((m) => m !== "YTD"));
  return [...months].sort(sortByMonth);
}

// ---------- KPI tổng quan ----------
export type KpiCard = { label: string; value: string; sub: string; trend?: "up" | "down"; delta?: string };

function sum<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
}

export function overviewKpis(data: DataStatusRow[], delivery: DeliveryStatusRow[] = []) {
  if (data.length === 0) return [];

  const imp = sum(data, (r) => r.impressions);
  const reach = sum(data, (r) => r.reach);
  const clicks = sum(data, (r) => r.clicks);
  const spend = sum(data, (r) => r.spend);
  const plannedQuantity = sum(data, (r) => r.planned_quantity);
  const actualDelivery = sum(data, (r) => r.actual_delivery);
  const views = sum(data, (r) => r.views);
  const eng = sum(data, (r) => r.engagements);

  const avgTimePassedPct = data.length > 0 ? sum(data, (r) => r.time_passed_pct) / data.length : 0;
  const soldvalue = sum(delivery , (r) => r.sold_value);
  const costoptimizepct = sum(delivery, (r)=> r.cost_optimized);
  
  const spendoptimize = costoptimizepct/soldvalue;
  const totalvalue = sum(delivery, (r)=> (r.unit_cost) * (r.planned_quantity));
  
  console.log('cost',totalvalue);
  console.log('sold',soldvalue);
  const ctr = cr(clicks, imp);
  const er = cr(eng, imp);
  const cpc = cpcOf(spend, clicks);
  const freq = freqOf(imp, reach);

  const spendPacing = soldvalue/totalvalue;

  return [
    {
      label: "Impressions",
      value: num(imp),
      trend: "up",
    },
    {
      label: "Reach",
      value: num(reach),
      trend: "up",
    },
    {
      label: "Average CTR",
      value: pct(ctr),
      sub: "Click-Through Rate",
      trend: "up",
    },
    {
      label: "Average ER",
      value: pct(er),
      sub: "Engagement Rate",
      trend: "up",
    },
    {
      label: "Total Clicks",
      value: num(clicks),
      sub: `CPC ${num(cpc)} ₫`,
      trend: "up",
    },
    {
      label: "Total Views",
      value: num(views),
      sub: ``,
      trend: "up",
    },
    {
      label: "Total Engagements",
      value: num(eng),
      sub: ``,
      trend: "up",
    },
  {
      label: "Total spend",
      value: vnd(spend),
      sub: ``,
      trend: "up",
    },
    // {
    //   label: "Spending Optimization",
    //   value: float(spendoptimize *100),
    //   trend: "up",
    // },
    // {
    //   label: "Spend Pacing",
    //   value: float(spendPacing * 100),
    //   trend: "up",
    // },
  ];
}

// ---------- Business breakdown ----------
export type BusinessDimension = "phase" | "region" | "buying_type" | "channel";
export type BusinessRow = {
  label: string;
  campaigns: number;
  impressions: number;
  reach: number;
  engagements: number;
  views: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  spend: number;
  ctr: number;
  er: number;
};

export function businessBreakdown(dim: BusinessDimension, report: ReportRow[]): BusinessRow[] {
  const map = new Map<string, BusinessRow>();
  for (const r of report) {
    const raw = String(r[dim] ?? "");
    const label = raw.trim() === "" ? "Chưa map" : raw;
    const row =
      map.get(label) ??
      ({
        label,
        campaigns: 0,
        impressions: 0,
        reach: 0,
        engagements: 0,
        views: 0,
        clicks: 0,
        linkClicks: 0,
        landingPageViews: 0,
        leads: 0,
        spend: 0,
        ctr: 0,
        er: 0,
      } as BusinessRow);
    row.campaigns += 1;
    row.impressions += r.impressions;
    row.reach += r.reach;
    row.engagements += r.engagements;
    row.views += r.views;
    row.clicks += r.clicks;
    row.linkClicks += r.link_clicks;
    row.landingPageViews += r.landing_page_views;
    row.leads += r.leads;
    row.spend += r.spend;
    map.set(label, row);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      ctr: ctrOf(r.impressions, r.clicks),
      er: erOf(r.impressions, r.engagements),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

// ---------- Monthly trend ----------
export type MonthlyPoint = {
  month: string;
  impressions: number;
  reach: number;
  engagements: number;
  clicks: number;
  spend: number;
  ctr: number;
  er: number; // <-- THÊM ER
  frequency: number;
};

export async function monthlyTrend(projectCode: string): Promise<MonthlyPoint[]> {
  const all = await fetchTable<ReportRow>("ad_raw_report", projectCode);
  const mtd = all.filter((r) => r.period_month !== "YTD");
  const map = new Map<string, ReportRow[]>();
  for (const r of mtd) {
    const arr = map.get(r.period_month) ?? [];
    arr.push(r);
    map.set(r.period_month, arr);
  }
  return [...map.entries()]
    .map(([month, group]) => {
      const impressions = sum(group, (r) => r.impressions);
      const reach = sum(group, (r) => r.reach);
      const engagements = sum(group, (r) => r.engagements);
      const clicks = sum(group, (r) => r.clicks);
      const spend = sum(group, (r) => r.spend);
      return {
        month,
        impressions,
        reach,
        engagements,
        clicks,
        spend,
        ctr: ctrOf(impressions, clicks),
        er: erOf(impressions, engagements), // <-- THÊM TÍNH ER
        frequency: freqOf(impressions, reach),
      };
    })
    .sort((a, b) => sortByMonth(a.month, b.month));
}

// ---------- Campaign delivery table ----------
export type Verdict = "Đạt" | "Cảnh báo" | "Chưa đạt" | "Chưa map";

export function verdictFromStatus(deliveryStatus: string | null, costStatus: string | null): { verdict: Verdict; raw: string } {
  const d = (deliveryStatus ?? "").toLowerCase();
  const c = (costStatus ?? "").toLowerCase();
  const raw = [deliveryStatus, costStatus].filter(Boolean).join(" · ") || "—";

  const behind = /behind|chậm|trễ|late/.test(d);
  const overCost = /over|vượt|exceed/.test(c);
  const onTrack = /on.?track|đúng|good|ok/.test(d) || /on.?track|đúng|good|ok/.test(c);

  if (behind && overCost) return { verdict: "Chưa đạt", raw };
  if (behind || overCost) return { verdict: "Cảnh báo", raw };
  if (onTrack) return { verdict: "Đạt", raw };
  return { verdict: "Chưa map", raw };
}

export type CampaignDeliveryRow = {
  id: string;
  label: string;
  channel: string;
  phase: string;
  region: string;
  buyingType: string;
  impressions: number;
  reach: number;
  engagement: number;
  view: number;
  clicks: number;
  linkclick: number;
  landing: number;
  er: number;
  ctr: number;
  verdict: Verdict;
  statusRaw: string;
};

export function fillMissingDeliveryStatus(
  data: DataStatusRow[],
  delivery: DeliveryStatusRow[]
): DataStatusRow[] {
  if (delivery.length === 0) return data;

  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

  // "No plan" không tính là status thật — coi như rỗng để vẫn thử merge
  const hasRealStatus = (s: string | null | undefined) => {
    const v = norm(s);
    return v !== "" && v !== "no plan";
  };

  const keyFull = (r: { region: string; phase: string; channel: string; buying_type: string; asset: string }) =>
    `${norm(r.region)}|${norm(r.phase)}|${norm(r.channel)}|${norm(r.buying_type)}|${norm(r.asset)}`;
  const keyLoose = (r: { region: string; phase: string; channel: string; buying_type: string }) =>
    `${norm(r.region)}|${norm(r.phase)}|${norm(r.channel)}|${norm(r.buying_type)}`;

  const fullMap = new Map<string, DeliveryStatusRow>();
  const looseMap = new Map<string, DeliveryStatusRow>();
  for (const d of delivery) {
    fullMap.set(keyFull(d), d);
    if (!looseMap.has(keyLoose(d))) looseMap.set(keyLoose(d), d);
  }

  return data.map((r) => {
    // CHANGED: chỉ giữ nguyên nếu status là "thật" (khác "No plan"/rỗng)
    const hasStatus = hasRealStatus(r.delivery_status) || hasRealStatus(r.cost_status);
    if (hasStatus) return r;

    const match = fullMap.get(keyFull(r)) ?? looseMap.get(keyLoose(r));
    if (!match) return r;

    return {
      ...r,
      // CHANGED: dùng status mới từ match, không giữ "No plan" cũ nữa
      delivery_status: hasRealStatus(r.delivery_status) ? r.delivery_status : (match.delivery_status ?? r.delivery_status),
      cost_status: hasRealStatus(r.cost_status) ? r.cost_status : (match.cost_status ?? r.cost_status),
    };
  });
}

export function campaignDeliveryRows(data: DataStatusRow[]): CampaignDeliveryRow[] {
  return data
    .map((r) => {
      const { verdict, raw } = verdictFromStatus(r.delivery_status ?? null, r.cost_status ?? null);

      const upperChannel = (r.channel || "").toUpperCase();
      const platform = ["SEM", "ADX", "YOUTUBE"].includes(upperChannel)
        ? "Google"
        : ["FACEBOOK", "INSTAGRAM", "TIKTOK"].includes(upperChannel)
          ? "Meta"
          : r.channel;

      const phaseCap = r.phase ? r.phase.charAt(0).toUpperCase() + r.phase.slice(1) : "—";
      const region = r.region || "National";
      const asset = r.asset;
      const engagement = r.engagements || 0;
      const view = r.views || 0;
      const clicks = r.clicks || 0;
      const linkclick = r.link_clicks || 0;
      const landing = r.landing_page_views || 0;
      const impressions = r.impressions || 0;

      return {
        id: r.id,
        label: `${platform} · ${phaseCap} · ${region} · ${asset} `,
        channel: r.channel,
        phase: phaseCap,
        region: region,
        buyingType: r.buying_type,
        impressions,
        reach: r.reach || 0,
        engagement,
        view,
        clicks,
        linkclick,
        landing,
        er: erOf(impressions, engagement),
        ctr: ctrOf(impressions, clicks),
        verdict,
        statusRaw: raw,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}

// ---------- Signals ----------
export type Signal = { tone: "good" | "warn" | "bad"; title: string; detail: string };

export function overviewSignals(data: DataStatusRow[]): Signal[] {
  const signals: Signal[] = [];
  const withVerdict = data.map((d) => ({ ...d, ...verdictFromStatus(d.delivery_status, d.cost_status) }));

  const unmapped = withVerdict.filter((d) => d.verdict === "Chưa map");
  if (unmapped.length > 0) {
    signals.push({ tone: "bad", title: `${unmapped.length} campaign chưa map taxonomy`, detail: `"${unmapped[0].channel || 'Campaign'}" không đúng naming convention — KPI không thể đối chiếu.` });
  }

  const warn = withVerdict.filter((d) => d.verdict === "Cảnh báo" || d.verdict === "Chưa đạt");
  if (warn.length > 0) {
    signals.push({ tone: "warn", title: `${warn.length} campaign lệch một chỉ số KPI`, detail: "CTR hoặc CPC chưa đạt — cần tối ưu bid hoặc creative." });
  }

  const good = withVerdict.filter((d) => d.verdict === "Đạt");
  if (good.length > 0) {
    signals.push({ tone: "good", title: `${good.length} campaign đạt đủ KPI`, detail: "Delivery đúng plan theo Platform, Phase và Buying type." });
  }

  const avgTimePassed = data.length > 0 ? sum(data, (r) => r.time_passed_pct) / data.length : 0;
  const avgSpendPct = data.length > 0 ? sum(data, (r) => r.cost_optimized_pct) / data.length : 0;
  if (avgSpendPct > avgTimePassed + 5) {
     signals.push({ tone: "warn", title: `Spend pacing ${avgSpendPct.toFixed(0)}% ngân sách`, detail: `Thời gian đã trôi qua ${avgTimePassed.toFixed(0)}% — tiêu nhanh hơn kế hoạch.` });
  }

  return signals;
}

export function performanceScore(data: DataStatusRow[]): number {
  const withVerdict = data.map((d) => verdictFromStatus(d.delivery_status, d.cost_status).verdict);
  const scored = withVerdict.filter((v) => v !== "Chưa map");
  if (scored.length === 0) return 0;
  const weight: Record<string, number> = { "Đạt": 100, "Cảnh báo": 65, "Chưa đạt": 30 };
  return Math.round(scored.reduce((s, v) => s + (weight[v] || 0), 0) / scored.length);
}

// ---------- Plan table ----------
export function planSummary(plan: UnitCostPlanRow[]) {
  return plan
    .map((p) => ({
      region: p.region || "National",
      phase: p.phase,
      channel: p.channel,
      buyingType: p.buying_type,
      unitCost: p.unit_cost,
      quantity: p.planned_quantity,
      budget: p.unit_cost * p.planned_quantity,
    }))
    .sort((a, b) => b.budget - a.budget);
}

// ---------- Execution rows (Google/Meta dashboard) ----------
export type ExecutionRow = { 
  id: string; 
  name: string; 
  adGroup: string | null; 
  impressions: number; 
  reach: number | null; 
  engagements: number; 
  views: number;              // + thêm
  clicks: number; 
  linkClicks: number;         // + thêm
  landingPageViews: number;   // + thêm
  leads: number;              // + thêm
  spend: number; 
  ctr: number; 
  er: number;
};

function normFacebook(rows: any[]): ExecutionRow[] {
  return rows.map((r, i) => {
    const imp = r.impressions ?? 0;
    const eng = r.engagements ?? r.engagement ?? r.inline_post_engagement ?? 0;
    return {
      id: r.id ?? `fb-${i}`,
      name: r.campaign_name,
      adGroup: r.adset_name,
      impressions: imp,
      reach: r.reach ?? null,
      engagements: eng,
      views: r.views ?? 0,                              // + thêm
      clicks: r.clicks ?? 0,
      linkClicks: r.link_clicks ?? 0,                    // + thêm
      landingPageViews: r.landing_page_views ?? 0,       // + thêm
      leads: r.leads ?? 0,                                // + thêm
      spend: r.spend ?? 0,
      ctr: r.ctr ?? ctrOf(imp, r.clicks ?? 0),
      er: r.er ?? erOf(imp, eng),
    };
  });
}

function normSemYoutube(rows: any[]): ExecutionRow[] {
  return rows.map((r, i) => {
    const imp = r.impressions ?? 0;
    const eng = r.engagements ?? r.engagement ?? 0;
    return {
      id: r.id ?? `g-${i}`,
      name: r.campaign_name,
      adGroup: null,
      impressions: imp,
      reach: null,
      engagements: eng,
      views: r.views ?? 0,                              // + thêm
      clicks: r.clicks ?? 0,
      linkClicks: r.link_clicks ?? 0,                    // + thêm
      landingPageViews: r.landing_page_views ?? 0,       // + thêm
      leads: r.leads ?? 0,                                // + thêm
      spend: r.cost ?? 0,
      ctr: r.ctr ?? ctrOf(imp, r.clicks ?? 0),
      er: r.er ?? erOf(imp, eng),
    };
  });
}

function normTiktok(rows: any[]): ExecutionRow[] {
  return rows.map((r, i) => {
    const imp = r.impressions ?? 0;
    const eng = r.engagements ?? r.engagement ?? 0;
    return {
      id: r.id ?? `tt-${i}`,
      name: r.campaign_name,
      adGroup: r.ad_group_name,
      impressions: imp,
      reach: r.reach ?? null,
      engagements: eng,
      views: r.views ?? 0,                              // + thêm
      clicks: r.clicks ?? 0,
      linkClicks: r.link_clicks ?? 0,                    // + thêm
      landingPageViews: r.landing_page_views ?? 0,       // + thêm
      leads: r.leads ?? 0,                                // + thêm
      spend: r.spend ?? 0,
      ctr: r.ctr ?? ctrOf(imp, r.clicks ?? 0),
      er: r.er ?? erOf(imp, eng),
    };
  });
}

function aggregateBy(rows: ExecutionRow[], key: (r: ExecutionRow) => string): ExecutionRow[] {
  const map = new Map<string, ExecutionRow>();
  for (const r of rows) {
    const k = key(r);
    const agg = map.get(k) ?? {
      id: k, name: k, adGroup: null,
      impressions: 0, reach: null, engagements: 0,
      views: 0,                    // + thêm
      clicks: 0,
      linkClicks: 0,                // + thêm
      landingPageViews: 0,          // + thêm
      leads: 0,                     // + thêm
      spend: 0, ctr: 0, er: 0,
    };
    agg.impressions += r.impressions;
    agg.clicks += r.clicks;
    agg.spend += r.spend;
    agg.engagements += r.engagements;
    agg.views += r.views;                     // + thêm
    agg.linkClicks += r.linkClicks;           // + thêm
    agg.landingPageViews += r.landingPageViews; // + thêm
    agg.leads += r.leads;                     // + thêm
    if (r.reach !== null) agg.reach = (agg.reach ?? 0) + r.reach;
    map.set(k, agg);
  }
  return [...map.values()]
    .map((a) => ({ 
      ...a, 
      ctr: ctrOf(a.impressions, a.clicks),
      er: erOf(a.impressions, a.engagements)
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

export async function loadExecutionRows(
  projectCode: string,
  platform: "Google" | "Meta",
  level: "campaign" | "adgroup",
): Promise<ExecutionRow[]> {
  let rows: ExecutionRow[] = [];
  if (platform === "Google") {
    const [sem, youtube] = await Promise.all([
      fetchTable("ad_raw_sem_data", projectCode),
      fetchTable("ad_raw_youtube_data", projectCode),
    ]);
    rows = [...normSemYoutube(sem), ...normSemYoutube(youtube)];
  } else {
    const [fb, tt] = await Promise.all([
      fetchTable("ad_raw_facebook_data", projectCode),
      fetchTable("ad_raw_tiktok_data", projectCode),
    ]);
    rows = [...normFacebook(fb), ...normTiktok(tt)];
  }

  if (level === "campaign") return aggregateBy(rows, (r) => r.name ?? "—");
  return aggregateBy(rows.filter((r) => r.adGroup), (r) => `${r.name}::${r.adGroup}`).map((r) => ({ ...r, name: r.adGroup ?? r.name }));
}

// ---------- Demographic (age/gender/region) ----------
export type DemographicRow = {
  id: string;
  project_id: string;
  period_month: string;
  platform: "google" | "meta";
  breakdown_type: "age" | "gender" | "region" | "campaign" | "keyword";
  breakdown_value: string;
  campaign_name: string | null;
  impressions: number;
  reach: number | null;
  clicks: number;
  spend: number | null;
  ctr: number;
};

export async function loadDemographics(
  projectCode: string,
  periodMonth: string,
  breakdownType: "age" | "gender" | "region" | "campaign" | "keyword"
): Promise<DemographicRow[]> {
  const all = await fetchTable<DemographicRow>("ad_demographic_metrics", projectCode);
  return all.filter((r) => r.period_month === periodMonth && r.breakdown_type === breakdownType);
}

export type DemographicBreakdown = {
  label: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  ctr: number;
  googleImpressions: number;
  metaImpressions: number;
};

export function aggregateDemographic(rows: DemographicRow[]): DemographicBreakdown[] {
  const map = new Map<string, DemographicBreakdown>();
  for (const r of rows) {
    const key = r.breakdown_value;
    const item =
      map.get(key) ??
      ({ label: key, impressions: 0, reach: 0, clicks: 0, spend: 0, ctr: 0, googleImpressions: 0, metaImpressions: 0 } as DemographicBreakdown);

    item.impressions += r.impressions || 0;
    item.reach += r.reach || 0;
    item.clicks += r.clicks || 0;
    item.spend += r.spend || 0;
    if (r.platform === "google") item.googleImpressions += r.impressions || 0;
    else item.metaImpressions += r.impressions || 0;

    map.set(key, item);
  }
  return [...map.values()]
    .map((i) => ({ ...i, ctr: ctrOf(i.impressions, i.clicks) }))
    .sort((a, b) => b.impressions - a.impressions);
}

// ---------- Demographic breakdown theo Campaign + Age/Gender/Region ----------
export type CampaignBreakdownRow = {
  campaignName: string;
  breakdownValue: string;
  platform: "google" | "meta";
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  ctr: number;
};

export function aggregateDemographicByCampaignDetail(rows: DemographicRow[]): CampaignBreakdownRow[] {
  const map = new Map<string, CampaignBreakdownRow>();
  for (const r of rows) {
    const campaignName = r.campaign_name ?? "Unknown";
    const key = `${campaignName}::${r.breakdown_value}::${r.platform}`;
    const item =
      map.get(key) ??
      ({
        campaignName,
        breakdownValue: r.breakdown_value,
        platform: r.platform,
        impressions: 0,
        reach: 0,
        clicks: 0,
        spend: 0,
        ctr: 0,
      } as CampaignBreakdownRow);

    item.impressions += r.impressions || 0;
    item.reach += r.reach || 0;
    item.clicks += r.clicks || 0;
    item.spend += r.spend || 0;

    map.set(key, item);
  }
  return [...map.values()]
    .map((i) => ({ ...i, ctr: ctrOf(i.impressions, i.clicks) }))
    .sort((a, b) => a.campaignName.localeCompare(b.campaignName) || b.impressions - a.impressions);
}

export type AlertRow = {
  key: string;
  region: string;
  channel: string;
  buyingType: string;
  asset: string;
  statusLabel: string;
  value: number;
};

export type AlertGroups = {
  laggingDelivery: AlertRow[];
  overCost: AlertRow[];
};

export function deliveryAlertGroups(data: DataStatusRow[]): AlertGroups {
  const laggingDelivery: AlertRow[] = [];
  const overCost: AlertRow[] = [];

  for (const r of data) {
    const d = (r.delivery_status ?? "").toLowerCase();
    const c = (r.cost_status ?? "").toLowerCase();
    const costOptimizedPct = r.cost_optimized_pct ?? 0; // <-- dùng cost_optimized_pct (đúng nghĩa "T" theo rule), không phải cost_optimized (giá trị thô) hay time_passed_pct

    const isBehind = /behind|chậm|trễ|late/.test(d);
    const isOverCost = /over|vượt|exceed/.test(c);
    const isCostOptimized = /optimi[sz]ed|tối ưu/.test(c);

    const region = r.region || "National";
    const asset = r.asset || "general";

    if (isBehind) {
      laggingDelivery.push({
        key: r.id,
        region,
        channel: r.channel,
        buyingType: r.buying_type,
        asset,
        statusLabel: "behind",
        value: r.pacing_gap ?? 0,
      });
    }

    // Rule (ảnh 1): Alert khi W = over cost, HOẶC W = cost optimized nhưng T (cost_optimized_pct) < 20
    if (isOverCost || (isCostOptimized && costOptimizedPct < 20)) {
      overCost.push({
        key: r.id,
        region,
        channel: r.channel,
        buyingType: r.buying_type,
        asset,
        statusLabel: isOverCost ? "over cost" : `cost optimized nhưng cost_optimized_pct = ${costOptimizedPct.toFixed(2)} < 20`,
        value: costOptimizedPct,
      });
    }
  }

  laggingDelivery.sort((a, b) => a.value - b.value);
  overCost.sort((a, b) => a.value - b.value); // sort tăng dần để campaign đáng lo nhất (pct thấp nhất) hiện lên đầu

  return { laggingDelivery, overCost };
}

// ---------- Channel-level KPIs (raw platform table, không lọc theo periodMonth) ----------
export type ChannelRawRow = Record<string, any>;

export async function loadChannelRawData(
  projectCode: string,
  platform: "Google" | "Meta" | "Youtube"
): Promise<ChannelRawRow[]> {
  const table =
    platform === "Google" ? "ad_raw_sem_data" : platform === "Youtube" ? "ad_raw_youtube_data" : "ad_raw_facebook_data";
  return fetchTable<ChannelRawRow>(table, projectCode);
}

import type { KpiCard as KpiCardType } from "@/lib/metrics";


function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function sumField(rows: ChannelRawRow[], key: string): number {
  return rows.reduce((s, r) => s + (toNum(r[key]) ?? 0), 0);
}

function avgField(rows: ChannelRawRow[], key: string): number | null {
  const vals = rows.map((r) => toNum(r[key])).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function hasAnyValid(rows: ChannelRawRow[], key: string): boolean {
  return rows.some((r) => toNum(r[key]) !== null);
}

// ---------- Google / SEM (và tạm dùng cho Youtube) ----------
function googleChannelKpis(rows: ChannelRawRow[]): KpiCardType[] {
  const cards: KpiCardType[] = [];

  const imp = sumField(rows, "impressions");
  const clicks = sumField(rows, "clicks");
  const cost = sumField(rows, "cost");
  const budget = sumField(rows, "budget");
  const trueviewViews = sumField(rows, "trueview_views");
  const uniqueUsers = sumField(rows, "unique_users");

  const ctr = ctrOf(imp, clicks);
  const cpc = cpcOf(cost, clicks);

  cards.push({ label: "Impressions", value: num(imp), sub: "", trend: "up" });
  cards.push({ label: "Total Clicks", value: num(clicks), sub: `CPC ${num(cpc)} ₫`, trend: "up" });
  cards.push({ label: "Total Cost", value: vnd(cost), sub: "", trend: "up" });
  cards.push({ label: "Average CTR", value: pct(ctr), sub: "Click-Through Rate", trend: "up" });

  if (hasAnyValid(rows, "budget")) {
    cards.push({ label: "Total Budget", value: vnd(budget), sub: "Ngân sách đặt", trend: "up" });
  }


  if (hasAnyValid(rows, "search_impr_share")) {
    const share = avgField(rows, "search_impr_share")!;
    cards.push({ label: "Search Impr. Share", value: pct(share * 100), sub: "", trend: "up" });
  }

  if (hasAnyValid(rows, "search_lost_is_rank")) {
    const lostRank = avgField(rows, "search_lost_is_rank")!;
    cards.push({ label: "Lost IS (Rank)", value: pct(lostRank * 100), sub: "", trend: "up" });
  }

  if (hasAnyValid(rows, "search_lost_is_budget")) {
    const lostBudget = avgField(rows, "search_lost_is_budget")!;
    cards.push({ label: "Lost IS (Budget)", value: pct(lostBudget * 100), sub: "", trend: "up" });
  }

  if (hasAnyValid(rows, "unique_users")) {
    cards.push({ label: "Unique Users", value: num(uniqueUsers), sub: "", trend: "up" });
  }

  return cards;
}

// ---------- Meta / Facebook ----------
function metaChannelKpis(rows: ChannelRawRow[]): KpiCardType[] {
  const cards: KpiCardType[] = [];

  const imp = sumField(rows, "impressions");
  const reach = sumField(rows, "reach");
  const clicks = sumField(rows, "clicks");
  const spend = sumField(rows, "spend");
  const linkClicks = sumField(rows, "inline_link_clicks");
  const landingViews = sumField(rows, "landing_page_view");
  const engagements = sumField(rows, "inline_post_engagement");

  const ctr = ctrOf(imp, clicks);
  const cpc = cpcOf(spend, clicks);
  const cpm = imp > 0 ? (spend / imp) * 1000 : 0;
  const freq = freqOf(imp, reach);
  const er = erOf(imp, engagements);

  cards.push({ label: "Impressions", value: num(imp), sub: "", trend: "up" });
  cards.push({ label: "Reach", value: num(reach), sub: `Frequency ${freq.toFixed(2)}x`, trend: "up" });
  cards.push({ label: "Total Clicks", value: num(clicks), sub: `CPC ${num(cpc)} ₫`, trend: "up" });
  cards.push({ label: "Total Spend", value: vnd(spend), sub: `CPM ${num(cpm)} ₫`, trend: "up" });

  if (hasAnyValid(rows, "inline_link_clicks")) {
    cards.push({ label: "Link Clicks", value: num(linkClicks), sub: "", trend: "up" });
  }

  if (hasAnyValid(rows, "landing_page_view")) {
    cards.push({ label: "Landing Page Views", value: num(landingViews), sub: "", trend: "up" });
  }


  if (hasAnyValid(rows, "cost_per_landing_page_view")) {
    const cplpv = avgField(rows, "cost_per_landing_page_view")!;
    cards.push({ label: "Avg Cost / Landing Page View", value: vnd(cplpv), sub: "", trend: "up" });
  }

  if (hasAnyValid(rows, "cost_per_inline_post_engagement")) {
    const cpe = avgField(rows, "cost_per_inline_post_engagement")!;
    cards.push({ label: "Avg Cost / Engagement", value: vnd(cpe), sub: "", trend: "up" });
  }

  cards.push({ label: "Average CTR", value: pct(ctr), sub: "Click-Through Rate", trend: "up" });
  cards.push({ label: "Average CPC", value: vnd(cpc), sub: "Cost Per Click", trend: "up" });
  cards.push({ label: "Average CPM", value: vnd(cpm), sub: "Cost Per Thousand Impressions", trend: "up" });
  return cards;
}

export function channelKpis(platform: "Google" | "Meta" | "Youtube", rows: ChannelRawRow[]): KpiCardType[] {
  if (rows.length === 0) return [];
  return platform === "Meta" ? metaChannelKpis(rows) : googleChannelKpis(rows);
}