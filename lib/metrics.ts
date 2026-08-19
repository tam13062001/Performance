// Derived metrics: cross-platform totals, business dimensions, execution +
// creative breakdown, evaluation vs media plan KPI, and automated signals.

import { campaigns, adGroups, ads, keywords, trend, period } from "./data"
import type { AdGroup, Ad, Keyword, Platform, Segment } from "./data"
import {
  withTaxonomy,
  resolveTaxonomy,
  planFor,
  totalPlannedBudget,
  totalQuantityKpi,
  mediaPlan,
  type CampaignWithTaxonomy,
  type Dimension,
  type PlanEntry,
} from "./taxonomy"

export type PlatformFilter = "All" | Platform

export const vnd = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + " tỷ"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " tr"
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫"
}
export const num = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n))
export const pct = (n: number) => `${n.toFixed(2)}%`
export const freqFmt = (n: number) => n.toFixed(2) + "x"

export const ctrOf = (imp: number, clk: number) => (imp > 0 ? (clk / imp) * 100 : 0)
export const cpcOf = (spend: number, clk: number) => (clk > 0 ? spend / clk : 0)
export const freqOf = (imp: number, reach: number) => (reach > 0 ? imp / reach : 0)

export const campaignsTx = withTaxonomy(campaigns)

function matchPlatform(p: Platform, filter: PlatformFilter) {
  return filter === "All" || p === filter
}

function filteredCampaigns(filter: PlatformFilter) {
  return campaignsTx.filter((c) => matchPlatform(c.platform, filter))
}

export type Verdict = "Đạt" | "Cảnh báo" | "Chưa đạt" | "Chưa map"

export function evaluate(imp: number, clk: number, spend: number, plan?: PlanEntry): Verdict {
  if (!plan) return "Chưa map"
  const ctrOk = ctrOf(imp, clk) >= plan.ctrKpi
  const cpcOk = cpcOf(spend, clk) <= plan.unitCostKpi
  if (ctrOk && cpcOk) return "Đạt"
  if (!ctrOk && !cpcOk) return "Chưa đạt"
  return "Cảnh báo"
}

// ---------- Overview KPIs ----------

export type KpiCard = {
  label: string
  value: string
  sub: string
  trend?: "up" | "down"
  delta?: string
}

function accountTotals(filter: PlatformFilter) {
  return filteredCampaigns(filter).reduce(
    (a, c) => ({
      imp: a.imp + c.impressions,
      reach: a.reach + c.reach,
      clk: a.clk + c.clicks,
      spend: a.spend + c.spend,
    }),
    { imp: 0, reach: 0, clk: 0, spend: 0 },
  )
}

function plannedFor(filter: PlatformFilter) {
  const plans = filter === "All" ? mediaPlan : mediaPlan.filter((p) => p.platform === filter)
  return {
    budget: plans.reduce((s, p) => s + p.budget, 0),
    quantity: plans.reduce((s, p) => s + p.quantityKpi, 0),
  }
}

export function overviewKpis(filter: PlatformFilter): KpiCard[] {
  const totals = accountTotals(filter)
  const ctr = ctrOf(totals.imp, totals.clk)
  const cpc = cpcOf(totals.spend, totals.clk)
  const frequency = freqOf(totals.imp, totals.reach)
  const planned = plannedFor(filter)

  const spendPct = planned.budget ? (totals.spend / planned.budget) * 100 : 0
  const timePct = (period.daysElapsed / period.daysTotal) * 100
  const quantityPct = planned.quantity ? (totals.clk / planned.quantity) * 100 : 0

  return [
    { label: "Impressions (MTD)", value: num(totals.imp), sub: `${num(totals.clk)} clicks`, trend: "up", delta: "+8.4%" },
    { label: "Reach", value: num(totals.reach), sub: `Frequency ${freqFmt(frequency)}`, trend: "up", delta: "+5.2%" },
    { label: "CTR trung bình", value: pct(ctr), sub: "Blended toàn tài khoản", trend: ctr >= 4 ? "up" : "down", delta: `${ctr >= 4 ? "+" : ""}${(ctr - 4).toFixed(1)}pt` },
    {
      label: "Spend pacing",
      value: pct(spendPct),
      sub: `Thời gian đã dùng ${timePct.toFixed(0)}%`,
      trend: spendPct <= timePct + 5 ? "up" : "down",
      delta: `${(spendPct - timePct).toFixed(0)}pt vs time`,
    },
    {
      label: "Quantity vs KPI",
      value: pct(quantityPct),
      sub: `${num(totals.clk)}/${num(planned.quantity)} clicks`,
      trend: quantityPct >= timePct ? "up" : "down",
      delta: `CPC ${vnd(cpc)}`,
    },
  ]
}

// ---------- Business dimension aggregation ----------

export type BusinessRow = {
  label: string
  campaigns: number
  impressions: number
  reach: number
  clicks: number
  ctr: number
  spend: number
}

export function businessBreakdown(dim: Dimension, filter: PlatformFilter): BusinessRow[] {
  const map = new Map<string, BusinessRow>()
  for (const c of filteredCampaigns(filter)) {
    const key = c.taxonomy[dim]
    const label = key === "—" ? "Chưa map" : key
    const row = map.get(label) ?? { label, campaigns: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, spend: 0 }
    row.campaigns += 1
    row.impressions += c.impressions
    row.reach += c.reach
    row.clicks += c.clicks
    row.spend += c.spend
    map.set(label, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, ctr: ctrOf(r.impressions, r.clicks) }))
    .sort((a, b) => b.impressions - a.impressions)
}

// ---------- Execution breakdown ----------

export type ExecutionRow = {
  id: string
  name: string
  platform: Platform
  campaign: string
  phase: string
  impressions: number
  reach: number
  ctr: number
  verdict: Verdict
}

function campaignById(id: string): CampaignWithTaxonomy | undefined {
  return campaignsTx.find((c) => c.id === id)
}

export function executionRows(level: "campaign" | "adgroup" | "ad", filter: PlatformFilter): ExecutionRow[] {
  if (level === "campaign") {
    return filteredCampaigns(filter)
      .map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        campaign: c.name,
        phase: c.taxonomy.phase,
        impressions: c.impressions,
        reach: c.reach,
        ctr: ctrOf(c.impressions, c.clicks),
        verdict: evaluate(c.impressions, c.clicks, c.spend, planFor(c.taxonomy)),
      }))
      .sort((a, b) => b.impressions - a.impressions)
  }
  if (level === "adgroup") {
    return adGroups
      .filter((g) => matchPlatform(g.platform, filter))
      .map((g: AdGroup) => {
        const c = campaignById(g.campaignId)
        return {
          id: g.id,
          name: g.name,
          platform: g.platform,
          campaign: c?.name ?? "—",
          phase: c?.taxonomy.phase ?? "—",
          impressions: g.impressions,
          reach: g.reach,
          ctr: ctrOf(g.impressions, g.clicks),
          verdict: evaluate(g.impressions, g.clicks, g.spend, c ? planFor(c.taxonomy) : undefined),
        }
      })
      .sort((a, b) => b.impressions - a.impressions)
  }
  // ad level (Meta only)
  return ads
    .filter(() => filter === "All" || filter === "Meta")
    .map((ad: Ad) => {
      const c = campaignById(ad.campaignId)
      return {
        id: ad.id,
        name: ad.name,
        platform: "Meta" as Platform,
        campaign: c?.name ?? "—",
        phase: c?.taxonomy.phase ?? "—",
        impressions: ad.impressions,
        reach: ad.reach,
        ctr: ctrOf(ad.impressions, ad.clicks),
        verdict: evaluate(ad.impressions, ad.clicks, ad.spend, c ? planFor(c.taxonomy) : undefined),
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
}

// ---------- Creative intelligence (Meta ads) ----------

export type CreativeTypeRow = { label: string; ads: number; impressions: number; reach: number; clicks: number; ctr: number }

export function creativeTypeBreakdown(): CreativeTypeRow[] {
  const map = new Map<string, CreativeTypeRow>()
  for (const ad of ads) {
    const row = map.get(ad.creativeType) ?? { label: ad.creativeType, ads: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0 }
    row.ads += 1
    row.impressions += ad.impressions
    row.reach += ad.reach
    row.clicks += ad.clicks
    map.set(ad.creativeType, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, ctr: ctrOf(r.impressions, r.clicks) }))
    .sort((a, b) => b.ctr - a.ctr)
}

export type AdRow = {
  id: string
  name: string
  creativeType: string
  audience: string
  campaign: string
  impressions: number
  reach: number
  ctr: number
  frequency: number
}

export function adRows(): AdRow[] {
  return ads
    .map((ad) => {
      const c = campaignById(ad.campaignId)
      return {
        id: ad.id,
        name: ad.name,
        creativeType: ad.creativeType,
        audience: ad.audience,
        campaign: c?.name ?? "—",
        impressions: ad.impressions,
        reach: ad.reach,
        ctr: ctrOf(ad.impressions, ad.clicks),
        frequency: freqOf(ad.impressions, ad.reach),
      }
    })
    .sort((a, b) => b.ctr - a.ctr)
}

export function creativeSummary() {
  const totalImp = ads.reduce((s, a) => s + a.impressions, 0)
  const totalReach = ads.reduce((s, a) => s + a.reach, 0)
  const totalClk = ads.reduce((s, a) => s + a.clicks, 0)
  const best = adRows()[0]
  const types = creativeTypeBreakdown()
  return [
    { label: "Meta ads", value: num(ads.length), sub: `${types.length} loại creative` },
    { label: "CTR trung bình", value: pct(ctrOf(totalImp, totalClk)), sub: "Trên toàn bộ creative" },
    { label: "Frequency", value: freqFmt(freqOf(totalImp, totalReach)), sub: `Reach ${num(totalReach)}` },
    { label: "Creative tốt nhất", value: best?.name ?? "—", sub: `CTR ${pct(best?.ctr ?? 0)}` },
  ]
}

// ---------- Audience rows (with channel breakdown) ----------

export type ChannelStat = { impressions: number; reach: number; clicks: number; ctr: number; frequency: number }
export type AudienceRow = {
  label: string
  impressions: number
  reach: number
  clicks: number
  ctr: number
  frequency: number
  google: ChannelStat
  meta: ChannelStat
}

function toStat(split: { impressions: number; reach: number; clicks: number }): ChannelStat {
  return {
    ...split,
    ctr: ctrOf(split.impressions, split.clicks),
    frequency: freqOf(split.impressions, split.reach),
  }
}

// Combine the channels a filter selects into a single split.
function combineSplit(s: Segment, platform: PlatformFilter) {
  const parts = platform === "Google" ? [s.google] : platform === "Meta" ? [s.meta] : [s.google, s.meta]
  return parts.reduce(
    (a, p) => ({ impressions: a.impressions + p.impressions, reach: a.reach + p.reach, clicks: a.clicks + p.clicks }),
    { impressions: 0, reach: 0, clicks: 0 },
  )
}

export function audienceRows(segs: Segment[], platform: PlatformFilter): AudienceRow[] {
  return segs
    .map((s) => {
      const combined = combineSplit(s, platform)
      return {
        label: s.label,
        impressions: combined.impressions,
        reach: combined.reach,
        clicks: combined.clicks,
        ctr: ctrOf(combined.impressions, combined.clicks),
        frequency: freqOf(combined.impressions, combined.reach),
        google: toStat(s.google),
        meta: toStat(s.meta),
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
}

// KPI cards for the audience page, scoped to the selected channel.
export function audienceKpis(segs: Segment[], platform: PlatformFilter): KpiCard[] {
  const rows = audienceRows(segs, platform)
  const t = rows.reduce((a, r) => ({ imp: a.imp + r.impressions, reach: a.reach + r.reach, clk: a.clk + r.clicks }), { imp: 0, reach: 0, clk: 0 })
  const top = [...rows].sort((a, b) => b.ctr - a.ctr)[0]
  const gImp = segs.reduce((s, x) => s + x.google.impressions, 0)
  const mImp = segs.reduce((s, x) => s + x.meta.impressions, 0)
  const totalImp = gImp + mImp
  const share = platform === "Google" ? gImp / totalImp : platform === "Meta" ? mImp / totalImp : 1
  return [
    { label: "Impressions", value: num(t.imp), sub: `${num(t.clk)} clicks`, trend: "up", delta: platform === "All" ? "Google + Meta" : `${(share * 100).toFixed(0)}% of total` },
    { label: "Reach", value: num(t.reach), sub: `Frequency ${freqFmt(freqOf(t.imp, t.reach))}`, trend: "up", delta: "+4.6%" },
    { label: "CTR trung bình", value: pct(ctrOf(t.imp, t.clk)), sub: "Blended theo segment", trend: ctrOf(t.imp, t.clk) >= 4 ? "up" : "down", delta: `${(ctrOf(t.imp, t.clk) - 4).toFixed(1)}pt` },
    { label: "Segment tốt nhất", value: top?.label ?? "—", sub: `CTR ${pct(top?.ctr ?? 0)}`, trend: "up", delta: num(top?.impressions ?? 0) + " imp" },
  ]
}

// Impressions contribution per channel for the current dimension.
export function audienceContribution(segs: Segment[]) {
  const google = segs.reduce((s, x) => s + x.google.impressions, 0)
  const meta = segs.reduce((s, x) => s + x.meta.impressions, 0)
  return { google, meta, total: google + meta }
}

// ---------- Keyword rows (Google only) ----------

export type KeywordRow = {
  id: string
  keyword: string
  matchType: string
  campaign: string
  impressions: number
  ctr: number
  cpc: number
  verdict: Verdict
}

export function keywordRows(): KeywordRow[] {
  return keywords
    .map((k: Keyword) => {
      const c = campaignById(k.campaignId)
      return {
        id: k.id,
        keyword: k.keyword,
        matchType: k.matchType,
        campaign: c?.name ?? "—",
        impressions: k.impressions,
        ctr: ctrOf(k.impressions, k.clicks),
        cpc: cpcOf(k.spend, k.clicks),
        verdict: evaluate(k.impressions, k.clicks, k.spend, c ? planFor(c.taxonomy) : undefined),
      }
    })
    .sort((a, b) => b.impressions - a.impressions)
}

// ---------- Overview table ----------

export type OverviewCampaignRow = {
  id: string
  name: string
  platform: Platform
  phase: string
  location: string
  buyingType: string
  impressions: number
  reach: number
  ctr: number
  verdict: Verdict
}

export function overviewCampaignRows(filter: PlatformFilter): OverviewCampaignRow[] {
  return filteredCampaigns(filter)
    .map((c) => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      phase: c.taxonomy.phase,
      location: c.taxonomy.location,
      buyingType: c.taxonomy.buyingType,
      impressions: c.impressions,
      reach: c.reach,
      ctr: ctrOf(c.impressions, c.clicks),
      verdict: evaluate(c.impressions, c.clicks, c.spend, planFor(c.taxonomy)),
    }))
    .sort((a, b) => b.impressions - a.impressions)
}

// Account-level impressions split by platform (for the overview doughnut).
export function platformImpressions() {
  const google = campaignsTx.filter((c) => c.platform === "Google").reduce((s, c) => s + c.impressions, 0)
  const meta = campaignsTx.filter((c) => c.platform === "Meta").reduce((s, c) => s + c.impressions, 0)
  return { google, meta, total: google + meta }
}

// Blended performance score (0-100) from campaign verdicts vs plan.
export function performanceScore(filter: PlatformFilter): number {
  const rows = overviewCampaignRows(filter)
  const scored = rows.filter((r) => r.verdict !== "Chưa map")
  if (scored.length === 0) return 0
  const weight = { "Đạt": 100, "Cảnh báo": 65, "Chưa đạt": 30, "Chưa map": 0 } as const
  const total = scored.reduce((s, r) => s + weight[r.verdict], 0)
  return Math.round(total / scored.length)
}

// ---------- Automated signals ----------

export type Signal = { tone: "good" | "warn" | "bad"; title: string; detail: string }

export function overviewSignals(filter: PlatformFilter): Signal[] {
  const signals: Signal[] = []
  const rows = overviewCampaignRows(filter)

  const unmapped = filteredCampaigns(filter).filter((c) => c.taxonomy.status === "unmapped")
  if (unmapped.length > 0) {
    signals.push({
      tone: "bad",
      title: `${unmapped.length} campaign chưa map taxonomy`,
      detail: `"${unmapped[0].name}" không đúng naming convention — KPI không thể đối chiếu.`,
    })
  }

  const under = rows.filter((r) => r.verdict === "Chưa đạt")
  if (under.length > 0) {
    signals.push({ tone: "bad", title: `${under.length} campaign dưới KPI cả CTR & CPC`, detail: `Ưu tiên rà soát "${short(under[0].name)}".` })
  }

  const warn = rows.filter((r) => r.verdict === "Cảnh báo")
  if (warn.length > 0) {
    signals.push({ tone: "warn", title: `${warn.length} campaign lệch một chỉ số KPI`, detail: "CTR hoặc CPC chưa đạt — cần tối ưu bid hoặc creative." })
  }

  const good = rows.filter((r) => r.verdict === "Đạt")
  if (good.length > 0) {
    signals.push({ tone: "good", title: `${good.length} campaign đạt đủ KPI`, detail: "Delivery đúng plan theo Platform, Phase và Buying type." })
  }

  const totals = accountTotals(filter)
  const planned = plannedFor(filter)
  const spendPct = planned.budget ? (totals.spend / planned.budget) * 100 : 0
  const timePct = (period.daysElapsed / period.daysTotal) * 100
  signals.push({
    tone: spendPct > timePct + 10 ? "warn" : "good",
    title: `Spend pacing ${spendPct.toFixed(0)}% ngân sách`,
    detail: `Thời gian đã trôi qua ${timePct.toFixed(0)}% — ${spendPct > timePct + 10 ? "tiêu nhanh hơn kế hoạch" : "trong tầm kiểm soát"}.`,
  })

  return signals
}

function short(name: string) {
  const parts = name.split("|")
  return parts.length === 7 ? parts.slice(1, 4).join(" · ") : name
}

// ---------- Taxonomy diagnostics ----------

export function taxonomyRows() {
  return campaigns.map((c) => ({ id: c.id, name: c.name, ...resolveTaxonomy(c.name, c.platform) }))
}

// ---------- Monthly time-series (for YTD view) ----------

export type MonthlyPoint = {
  month: string
  impressions: number
  reach: number
  clicks: number
  spend: number
  ctr: number
  frequency: number
}

// Monthly trend scoped to a platform. "All" uses the raw series; Google/Meta
// scale each month by that platform's share of account totals so the monthly
// sums stay consistent with the platform-level totals shown elsewhere.
export function monthlyTrend(filter: PlatformFilter): MonthlyPoint[] {
  const all = accountTotals("All")
  const scope = accountTotals(filter)
  const impShare = all.imp ? scope.imp / all.imp : 1
  const reachShare = all.reach ? scope.reach / all.reach : 1
  const clkShare = all.clk ? scope.clk / all.clk : 1
  const spendShare = all.spend ? scope.spend / all.spend : 1

  return trend.map((t) => {
    const impressions = Math.round(t.impressions * impShare)
    const reach = Math.round(t.reach * reachShare)
    const clicks = Math.round(t.clicks * clkShare)
    const spend = Math.round(t.spend * spendShare)
    return {
      month: t.month,
      impressions,
      reach,
      clicks,
      spend,
      ctr: ctrOf(impressions, clicks),
      frequency: freqOf(impressions, reach),
    }
  })
}

export { trend, mediaPlan }
