import { fetchTable } from "./api-client";

// ---------- Format helpers ----------
export const vnd = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + " tỷ";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " tr";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
};
export const num = (n: number) => (Number.isFinite(n) ? new Intl.NumberFormat("vi-VN").format(Math.round(n)) : "—");
export const pct = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2)}%` : "—");
export const freqFmt = (n: number) => (Number.isFinite(n) ? n.toFixed(2) + "x" : "—");
export const ctrOf = (imp: number, clk: number) => (imp > 0 ? (clk / imp) * 100 : 0);
export const cpcOf = (spend: number, clk: number) => (clk > 0 ? spend / clk : 0);
export const freqOf = (imp: number, reach: number) => (reach > 0 ? imp / reach : 0);

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

// ---------- KPI tổng quan (Đã chuyển sang dùng DataStatusRow) ----------
export type KpiCard = { label: string; value: string; sub: string; trend: "up" | "down"; delta: string };

function sum<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((s, r) => s + (pick(r) ?? 0), 0);
}

export function overviewKpis(data: DataStatusRow[]): KpiCard[] {
  if (data.length === 0) return [];
  
  const imp = sum(data, (r) => r.impressions);
  const reach = sum(data, (r) => r.reach);
  const clicks = sum(data, (r) => r.clicks);
  const spend = sum(data, (r) => r.spend);
  const plannedQuantity = sum(data, (r) => r.planned_quantity);
  const actualDelivery = sum(data, (r) => r.actual_delivery);
  
  const avgTimePassedPct = data.length > 0 ? sum(data, (r) => r.time_passed_pct) / data.length : 0;
  
  const ctr = ctrOf(imp, clicks);
  const cpc = cpcOf(spend, clicks);
  const freq = freqOf(imp, reach);
  const deliveryPct = plannedQuantity > 0 ? (actualDelivery / plannedQuantity) * 100 : 0;
  
  const spendPacing = data.length > 0 ? sum(data, r => r.cost_optimized_pct) / data.length : 0;

  return [
    { label: "Impressions (MTD)", value: num(imp), sub: `${num(clicks)} clicks`, trend: "up", delta: "+8.4%" },
    { label: "Reach", value: num(reach), sub: `Frequency ${freq.toFixed(2)}x`, trend: "up", delta: "+5.2%" },
    { label: "CTR trung bình", value: pct(ctr), sub: "Blended toàn tài khoản", trend: "up", delta: "+1.5pt" },
    { label: "Spend pacing", value: pct(spendPacing), sub: `Thời gian đã dùng ${avgTimePassedPct.toFixed(0)}%`, trend: "down", delta: `${(spendPacing - avgTimePassedPct).toFixed(0)}pt vs time` },
    { label: "Quantity vs KPI", value: pct(deliveryPct), sub: `${num(actualDelivery)}/${num(plannedQuantity)} clicks`, trend: "up", delta: `CPC ${num(cpc)} ₫` },
  ];
}

// ---------- Business breakdown ----------
export type BusinessDimension = "phase" | "region" | "buying_type" | "channel";
export type BusinessRow = { label: string; campaigns: number; impressions: number; reach: number; clicks: number; ctr: number; spend: number };

export function businessBreakdown(dim: BusinessDimension, report: ReportRow[]): BusinessRow[] {
  const map = new Map<string, BusinessRow>();
  for (const r of report) {
    const raw = String(r[dim] ?? "");
    const label = raw.trim() === "" ? "Chưa map" : raw;
    const row = map.get(label) ?? { label, campaigns: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, spend: 0 };
    row.campaigns += 1;
    row.impressions += r.impressions;
    row.reach += r.reach;
    row.clicks += r.clicks;
    row.spend += r.spend;
    map.set(label, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, ctr: ctrOf(r.impressions, r.clicks) }))
    .sort((a, b) => b.impressions - a.impressions);
}

// ---------- Monthly trend ----------
export type MonthlyPoint = { month: string; impressions: number; reach: number; clicks: number; spend: number; ctr: number; frequency: number };

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
      const clicks = sum(group, (r) => r.clicks);
      const spend = sum(group, (r) => r.spend);
      return { month, impressions, reach, clicks, spend, ctr: ctrOf(impressions, clicks), frequency: freqOf(impressions, reach) };
    })
    .sort((a, b) => sortByMonth(a.month, b.month));
}

// ---------- Campaign delivery table (Đã đổi thành DataStatusRow) ----------
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
  ctr: number;
  verdict: Verdict;
  statusRaw: string;
};

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
      
      return {
        id: r.id,
        label: `${platform} · ${phaseCap} · ${region}`,
        channel: r.channel,
        phase: phaseCap,
        region: region,
        buyingType: r.buying_type,
        impressions: r.impressions || 0,
        reach: r.reach || 0,
        ctr: ctrOf(r.impressions || 0, r.clicks || 0),
        verdict,
        statusRaw: raw,
      };
    })
    .sort((a, b) => b.impressions - a.impressions);
}

// ---------- Signals (Đã chuyển qua dùng DataStatusRow) ----------
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
export type ExecutionRow = { id: string; name: string; adGroup: string | null; impressions: number; reach: number | null; clicks: number; spend: number; ctr: number };

function normFacebook(rows: any[]): ExecutionRow[] {
  return rows.map((r, i) => ({
    id: r.id ?? `fb-${i}`,
    name: r.campaign_name,
    adGroup: r.adset_name,
    impressions: r.impressions ?? 0,
    reach: r.reach ?? null,
    clicks: r.clicks ?? 0,
    spend: r.spend ?? 0,
    ctr: r.ctr ?? ctrOf(r.impressions ?? 0, r.clicks ?? 0),
  }));
}
function normSemYoutube(rows: any[]): ExecutionRow[] {
  return rows.map((r, i) => ({
    id: r.id ?? `g-${i}`,
    name: r.campaign_name,
    adGroup: null,
    impressions: r.impressions ?? 0,
    reach: null,
    clicks: r.clicks ?? 0,
    spend: r.cost ?? 0,
    ctr: r.ctr ?? ctrOf(r.impressions ?? 0, r.clicks ?? 0),
  }));
}
function normTiktok(rows: any[]): ExecutionRow[] {
  return rows.map((r, i) => ({
    id: r.id ?? `tt-${i}`,
    name: r.campaign_name,
    adGroup: r.ad_group_name,
    impressions: r.impressions ?? 0,
    reach: r.reach ?? null,
    clicks: r.clicks ?? 0,
    spend: r.spend ?? 0,
    ctr: r.ctr ?? ctrOf(r.impressions ?? 0, r.clicks ?? 0),
  }));
}

function aggregateBy(rows: ExecutionRow[], key: (r: ExecutionRow) => string): ExecutionRow[] {
  const map = new Map<string, ExecutionRow>();
  for (const r of rows) {
    const k = key(r);
    const agg = map.get(k) ?? { id: k, name: k, adGroup: null, impressions: 0, reach: null, clicks: 0, spend: 0, ctr: 0 };
    agg.impressions += r.impressions;
    agg.clicks += r.clicks;
    agg.spend += r.spend;
    if (r.reach !== null) agg.reach = (agg.reach ?? 0) + r.reach;
    map.set(k, agg);
  }
  return [...map.values()].map((a) => ({ ...a, ctr: ctrOf(a.impressions, a.clicks) })).sort((a, b) => b.impressions - a.impressions);
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