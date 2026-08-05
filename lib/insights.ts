import { num, pct, vnd, freqFmt } from "./metrics"

// A chart-agnostic description of what a chart plots. Every dashboard chart can
// map its series onto this shape, so one engine covers all of them.
export type InsightSpec = {
  title: string
  // e.g. "theo Phase", "theo tháng", "theo kênh"
  subject: string
  labels: string[]
  volume?: number[]
  volumeLabel?: string
  ctr?: number[]
  frequency?: number[]
  spend?: number[]
}

function pctChange(first: number, last: number): number {
  if (!first) return 0
  return ((last - first) / first) * 100
}

function argmax(arr: number[]): number {
  let idx = 0
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[idx]) idx = i
  return idx
}

function argmin(arr: number[]): number {
  let idx = 0
  for (let i = 1; i < arr.length; i++) if (arr[i] < arr[idx]) idx = i
  return idx
}

function sum(arr: number[]): number {
  return arr.reduce((s, n) => s + n, 0)
}

// Deterministic, offline rule-based insights derived directly from chart data.
export function buildInsights(spec: InsightSpec): string[] {
  const out: string[] = []
  const { labels, volume, volumeLabel = "Volume", ctr, frequency, spend } = spec
  if (!labels.length) return ["Chưa có dữ liệu để phân tích."]

  // Volume: trend + concentration.
  if (volume && volume.length) {
    const total = sum(volume)
    const top = argmax(volume)
    const share = total ? (volume[top] / total) * 100 : 0
    out.push(
      `${volumeLabel} cao nhất ở "${labels[top]}" với ${num(volume[top])} (${share.toFixed(0)}% tổng ${num(total)}).`,
    )
    if (volume.length >= 2) {
      const chg = pctChange(volume[0], volume[volume.length - 1])
      const dir = chg >= 0 ? "tăng" : "giảm"
      out.push(
        `${volumeLabel} ${dir} ${Math.abs(chg).toFixed(1)}% từ "${labels[0]}" (${num(volume[0])}) đến "${labels[labels.length - 1]}" (${num(volume[volume.length - 1])}).`,
      )
    }
  }

  // CTR: best/worst efficiency.
  if (ctr && ctr.length) {
    const best = argmax(ctr)
    const worst = argmin(ctr)
    if (best !== worst) {
      out.push(
        `CTR tốt nhất tại "${labels[best]}" (${pct(ctr[best])}), thấp nhất tại "${labels[worst]}" (${pct(ctr[worst])}).`,
      )
    } else {
      out.push(`CTR trung bình quanh ${pct(ctr[best])}.`)
    }
  }

  // Frequency: fatigue warning.
  if (frequency && frequency.length) {
    const hi = argmax(frequency)
    if (frequency[hi] >= 3) {
      out.push(
        `⚠ Frequency tại "${labels[hi]}" đạt ${freqFmt(frequency[hi])} — có dấu hiệu bội thực quảng cáo, cân nhắc mở rộng tệp.`,
      )
    } else {
      out.push(`Frequency cao nhất ${freqFmt(frequency[hi])} tại "${labels[hi]}", vẫn trong ngưỡng an toàn.`)
    }
  }

  // Spend efficiency: cost per the volume unit when both present.
  if (spend && spend.length && volume && volume.length) {
    const totalSpend = sum(spend)
    const totalVol = sum(volume)
    if (totalVol) {
      const cpm = (totalSpend / totalVol) * 1000
      out.push(`Chi phí trung bình ${vnd(Math.round(cpm))}/1.000 ${volumeLabel.toLowerCase()} (CPM).`)
    }
  }

  return out.slice(0, 4)
}

// Compact serialization sent to the LLM for deeper analysis.
export function specToPrompt(spec: InsightSpec): string {
  const lines: string[] = []
  spec.labels.forEach((label, i) => {
    const parts: string[] = [label]
    if (spec.volume) parts.push(`${spec.volumeLabel ?? "volume"}=${spec.volume[i]}`)
    if (spec.ctr) parts.push(`ctr=${spec.ctr[i]}%`)
    if (spec.frequency) parts.push(`frequency=${spec.frequency[i]}`)
    if (spec.spend) parts.push(`spend=${spec.spend[i]}`)
    lines.push(parts.join(", "))
  })
  return lines.join("\n")
}
