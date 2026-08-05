// Demo dataset for the cross-platform (Google + Meta) performance dashboard.
// Campaign raw names follow a naming convention the taxonomy layer parses:
//   Platform | Phase | Objective | Location | Audience | CreativeType | BuyingType

export type Platform = "Google" | "Meta"

export type Campaign = {
  id: string
  name: string // raw campaign name (source of classification, not source of truth)
  platform: Platform
  impressions: number
  reach: number
  clicks: number
  spend: number // VND
}

export type AdGroup = {
  id: string
  name: string
  campaignId: string
  platform: Platform
  impressions: number
  reach: number
  clicks: number
  spend: number
}

// Meta creative-level entity (ads inside ad sets).
export type Ad = {
  id: string
  name: string
  adGroupId: string
  campaignId: string
  creativeType: "Image" | "Video" | "Carousel"
  audience: string
  impressions: number
  reach: number
  clicks: number
  spend: number
}

export type Keyword = {
  id: string
  keyword: string
  matchType: "Exact" | "Phrase" | "Broad"
  campaignId: string
  impressions: number
  clicks: number
  spend: number
}

// Per-channel delivery split for an audience segment.
export type ChannelSplit = {
  impressions: number
  reach: number
  clicks: number
}

export type Segment = {
  label: string
  google: ChannelSplit
  meta: ChannelSplit
}

export type TrendPoint = {
  month: string
  impressions: number
  reach: number
  clicks: number
  spend: number
}

export const campaigns: Campaign[] = [
  // Google
  { id: "g1", name: "Google|Launch|Awareness|HCMC|Students|Search|CPC", platform: "Google", impressions: 420000, reach: 290000, clicks: 25200, spend: 168000000 },
  { id: "g2", name: "Google|Growth|Consideration|National|Professionals|Search|CPC", platform: "Google", impressions: 610000, reach: 402000, clicks: 42700, spend: 214000000 },
  { id: "g3", name: "Google|Growth|Conversion|Hanoi|Parents|Search|CPC", platform: "Google", impressions: 285000, reach: 178000, clicks: 22800, spend: 98000000 },
  { id: "g4", name: "Google|Retention|Conversion|HCMC|Alumni|Search|CPC", platform: "Google", impressions: 152000, reach: 96000, clicks: 16720, spend: 61000000 },
  // Meta
  { id: "m1", name: "Meta|Launch|Awareness|National|Students|Video|CPM", platform: "Meta", impressions: 980000, reach: 540000, clicks: 34300, spend: 142000000 },
  { id: "m2", name: "Meta|Growth|Consideration|HCMC|Parents|Carousel|CPC", platform: "Meta", impressions: 640000, reach: 388000, clicks: 30720, spend: 118000000 },
  { id: "m3", name: "Meta|Growth|Consideration|Hanoi|Professionals|Image|CPM", platform: "Meta", impressions: 512000, reach: 331000, clicks: 20480, spend: 86000000 },
  // Intentionally malformed name to exercise taxonomy diagnostics
  { id: "x1", name: "Brand-Core-2026", platform: "Meta", impressions: 96000, reach: 74000, clicks: 9600, spend: 38000000 },
]

export const adGroups: AdGroup[] = [
  { id: "a1", name: "Brand Exact", campaignId: "g1", platform: "Google", impressions: 240000, reach: 170000, clicks: 16800, spend: 92000000 },
  { id: "a2", name: "Brand Phrase", campaignId: "g1", platform: "Google", impressions: 180000, reach: 128000, clicks: 8400, spend: 76000000 },
  { id: "a3", name: "Professional Programs", campaignId: "g2", platform: "Google", impressions: 320000, reach: 210000, clicks: 24000, spend: 118000000 },
  { id: "a4", name: "Bachelor Programs", campaignId: "g2", platform: "Google", impressions: 290000, reach: 192000, clicks: 18700, spend: 96000000 },
  { id: "a5", name: "Vs Competitors", campaignId: "g3", platform: "Google", impressions: 285000, reach: 178000, clicks: 22800, spend: 98000000 },
  { id: "a6", name: "Past Visitors", campaignId: "g4", platform: "Google", impressions: 152000, reach: 96000, clicks: 16720, spend: 61000000 },
  // Meta ad sets
  { id: "s1", name: "Awareness · Students 18-24", campaignId: "m1", platform: "Meta", impressions: 620000, reach: 360000, clicks: 21700, spend: 92000000 },
  { id: "s2", name: "Awareness · Lookalike 2%", campaignId: "m1", platform: "Meta", impressions: 360000, reach: 210000, clicks: 12600, spend: 50000000 },
  { id: "s3", name: "Consideration · Parents", campaignId: "m2", platform: "Meta", impressions: 640000, reach: 388000, clicks: 30720, spend: 118000000 },
  { id: "s4", name: "Consideration · Professionals", campaignId: "m3", platform: "Meta", impressions: 512000, reach: 331000, clicks: 20480, spend: 86000000 },
]

// Meta ads (creative level)
export const ads: Ad[] = [
  { id: "ad1", name: "Campus Life 15s", adGroupId: "s1", campaignId: "m1", creativeType: "Video", audience: "Students", impressions: 340000, reach: 210000, clicks: 13600, spend: 51000000 },
  { id: "ad2", name: "Scholarship Reveal", adGroupId: "s1", campaignId: "m1", creativeType: "Video", audience: "Students", impressions: 280000, reach: 168000, clicks: 8400, spend: 41000000 },
  { id: "ad3", name: "Alumni Stories", adGroupId: "s2", campaignId: "m1", creativeType: "Image", audience: "Lookalike", impressions: 360000, reach: 210000, clicks: 12600, spend: 50000000 },
  { id: "ad4", name: "Program Highlights", adGroupId: "s3", campaignId: "m2", creativeType: "Carousel", audience: "Parents", impressions: 380000, reach: 236000, clicks: 19000, spend: 70000000 },
  { id: "ad5", name: "Open Day Invite", adGroupId: "s3", campaignId: "m2", creativeType: "Image", audience: "Parents", impressions: 260000, reach: 152000, clicks: 11720, spend: 48000000 },
  { id: "ad6", name: "Career Outcomes", adGroupId: "s4", campaignId: "m3", creativeType: "Image", audience: "Professionals", impressions: 512000, reach: 331000, clicks: 20480, spend: 86000000 },
]

export const keywords: Keyword[] = [
  { id: "k1", keyword: "chương trình mba", matchType: "Phrase", campaignId: "g1", impressions: 128000, clicks: 9600, spend: 48000000 },
  { id: "k2", keyword: "học đại học quốc tế", matchType: "Broad", campaignId: "g2", impressions: 164000, clicks: 9840, spend: 39000000 },
  { id: "k3", keyword: "buv tuyển sinh", matchType: "Exact", campaignId: "g1", impressions: 92000, clicks: 12880, spend: 34000000 },
  { id: "k4", keyword: "trường đại học anh quốc", matchType: "Phrase", campaignId: "g2", impressions: 88000, clicks: 7040, spend: 31000000 },
  { id: "k5", keyword: "du học tại chỗ", matchType: "Broad", campaignId: "g3", impressions: 142000, clicks: 8520, spend: 41000000 },
  { id: "k6", keyword: "học phí đại học", matchType: "Broad", campaignId: "g2", impressions: 176000, clicks: 7040, spend: 44000000 },
  { id: "k7", keyword: "học bổng đại học", matchType: "Phrase", campaignId: "g2", impressions: 74000, clicks: 8140, spend: 29000000 },
  { id: "k8", keyword: "đăng ký nhập học", matchType: "Exact", campaignId: "g4", impressions: 46000, clicks: 6900, spend: 19000000 },
]

// Each segment carries a Google + Meta channel breakdown so the Audience page
// can compare platforms and roll them up into a combined view.
export const audience = {
  age: [
    { label: "18-24", google: { impressions: 300000, reach: 180000, clicks: 21000 }, meta: { impressions: 420000, reach: 250000, clicks: 33000 } },
    { label: "25-34", google: { impressions: 260000, reach: 168000, clicks: 18200 }, meta: { impressions: 300000, reach: 180000, clicks: 21000 } },
    { label: "35-44", google: { impressions: 190000, reach: 124000, clicks: 11400 }, meta: { impressions: 150000, reach: 90000, clicks: 9000 } },
    { label: "45-54", google: { impressions: 82000, reach: 56000, clicks: 4100 }, meta: { impressions: 48000, reach: 32000, clicks: 2400 } },
    { label: "55+", google: { impressions: 35000, reach: 26000, clicks: 1400 }, meta: { impressions: 20000, reach: 15000, clicks: 800 } },
  ] as Segment[],
  gender: [
    { label: "Nữ", google: { impressions: 440000, reach: 260000, clicks: 30800 }, meta: { impressions: 540000, reach: 330000, clicks: 37800 } },
    { label: "Nam", google: { impressions: 360000, reach: 212000, clicks: 23400 }, meta: { impressions: 400000, reach: 240000, clicks: 26000 } },
    { label: "Không xác định", google: { impressions: 30000, reach: 22000, clicks: 1500 }, meta: { impressions: 35000, reach: 27000, clicks: 1750 } },
  ] as Segment[],
  region: [
    { label: "TP.HCM", google: { impressions: 320000, reach: 190000, clicks: 24000 }, meta: { impressions: 370000, reach: 220000, clicks: 27750 } },
    { label: "Hà Nội", google: { impressions: 250000, reach: 152000, clicks: 17500 }, meta: { impressions: 270000, reach: 170000, clicks: 18900 } },
    { label: "Đà Nẵng", google: { impressions: 110000, reach: 72000, clicks: 7150 }, meta: { impressions: 130000, reach: 84000, clicks: 8450 } },
    { label: "Cần Thơ", google: { impressions: 68000, reach: 44000, clicks: 4080 }, meta: { impressions: 82000, reach: 54000, clicks: 4920 } },
    { label: "Khác", google: { impressions: 95000, reach: 65000, clicks: 3900 }, meta: { impressions: 110000, reach: 76000, clicks: 4600 } },
  ] as Segment[],
}

export const trend: TrendPoint[] = [
  { month: "T3", impressions: 1420000, reach: 980000, clicks: 92000, spend: 430000000 },
  { month: "T4", impressions: 1560000, reach: 1040000, clicks: 104000, spend: 468000000 },
  { month: "T5", impressions: 1610000, reach: 1052000, clicks: 118000, spend: 492000000 },
  { month: "T6", impressions: 1720000, reach: 1102000, clicks: 126000, spend: 528000000 },
  { month: "T7", impressions: 1685000, reach: 1059000, clicks: 121000, spend: 511000000 },
  { month: "T8", impressions: 1901000, reach: 1173000, clicks: 135610, spend: 700000000 },
]

// Period context for pacing / forecast
export const period = {
  label: "August 2026",
  daysElapsed: 12,
  daysTotal: 31,
}
