// Taxonomy + media plan layer (cross-platform: Google + Meta).
// The taxonomy turns a raw campaign name into business dimensions.
// The media plan defines KPI targets per Platform + Phase + Buying type.

import type { Campaign, Platform } from "./data"

export type Dimension = "phase" | "objective" | "location" | "audience" | "buyingType"

export type Taxonomy = {
  platform: string
  phase: string
  objective: string
  location: string
  audience: string
  creativeType: string
  buyingType: string
  status: "mapped" | "unmapped"
}

// Naming convention: Platform|Phase|Objective|Location|Audience|CreativeType|BuyingType
export function resolveTaxonomy(name: string, fallbackPlatform?: Platform): Taxonomy {
  const parts = name.split("|").map((p) => p.trim())
  if (parts.length !== 7 || parts.some((p) => p.length === 0)) {
    return {
      platform: fallbackPlatform ?? "—",
      phase: "—",
      objective: "—",
      location: "—",
      audience: "—",
      creativeType: "—",
      buyingType: "—",
      status: "unmapped",
    }
  }
  const [platform, phase, objective, location, audience, creativeType, buyingType] = parts
  return { platform, phase, objective, location, audience, creativeType, buyingType, status: "mapped" }
}

export type CampaignWithTaxonomy = Campaign & { taxonomy: Taxonomy }

export function withTaxonomy(list: Campaign[]): CampaignWithTaxonomy[] {
  return list.map((c) => ({ ...c, taxonomy: resolveTaxonomy(c.name, c.platform) }))
}

export type PlanEntry = {
  platform: string
  phase: string
  channel: string
  buyingType: string
  ctrKpi: number // %
  unitCostKpi: number // VND (CPC / CPM target)
  quantityKpi: number // clicks target
  budget: number // VND
}

// Defined media plan keyed by Platform + Phase + Buying type.
export const mediaPlan: PlanEntry[] = [
  { platform: "Google", phase: "Launch", channel: "Search", buyingType: "CPC", ctrKpi: 5, unitCostKpi: 20000, quantityKpi: 30000, budget: 260000000 },
  { platform: "Google", phase: "Growth", channel: "Search", buyingType: "CPC", ctrKpi: 7, unitCostKpi: 15000, quantityKpi: 55000, budget: 320000000 },
  { platform: "Google", phase: "Retention", channel: "Search", buyingType: "CPC", ctrKpi: 10, unitCostKpi: 12000, quantityKpi: 15000, budget: 120000000 },
  { platform: "Meta", phase: "Launch", channel: "Social", buyingType: "CPM", ctrKpi: 3, unitCostKpi: 4000, quantityKpi: 30000, budget: 160000000 },
  { platform: "Meta", phase: "Growth", channel: "Social", buyingType: "CPC", ctrKpi: 4.5, unitCostKpi: 6000, quantityKpi: 45000, budget: 140000000 },
  { platform: "Meta", phase: "Growth", channel: "Social", buyingType: "CPM", ctrKpi: 3.5, unitCostKpi: 4500, quantityKpi: 20000, budget: 90000000 },
]

export function planFor(tax: Taxonomy): PlanEntry | undefined {
  if (tax.status === "unmapped") return undefined
  return mediaPlan.find(
    (p) => p.platform === tax.platform && p.phase === tax.phase && p.buyingType === tax.buyingType,
  )
}

export const totalPlannedBudget = mediaPlan.reduce((s, p) => s + p.budget, 0)
export const totalQuantityKpi = mediaPlan.reduce((s, p) => s + p.quantityKpi, 0)
