// lib/insights.ts
//
// Shared shape + logic cho khối "AI insights" gắn dưới mỗi chart.
// - InsightSpec: mô tả 1 chart một cách trung lập (không phụ thuộc chart lib).
// - buildInsights(): rule-based, chạy ngay trên client, KHÔNG gọi API.
// - specToPrompt(): format lại spec thành text để gửi cho LLM (route /api/insights).

export type InsightSpec = {
  /** Tiêu đề chart, dùng để hiển thị + đưa vào prompt. VD: "Impressions theo nền tảng" */
  title: string
  /** Bổ sung ngữ cảnh ngắn cho tiêu đề. VD: "theo nền tảng", "theo Phase" */
  subject: string
  /** Nhãn trục X / từng lát cắt. VD: ["Google", "Meta", "Tiktok"] */
  labels: string[]

  /** Chuỗi số liệu dạng khối lượng (impressions, clicks, spend...) — optional */
  volume?: number[]
  /** Tên hiển thị cho `volume`. VD: "Impressions", "Spend" */
  volumeLabel?: string
  /** Đơn vị của `volume`, ảnh hưởng cách format số trong bullet + prompt */
  volumeUnit?: "number" | "currency"

  /** Chuỗi số liệu dạng tỉ lệ % (CTR, ER, delivery %...) — optional */
  rate?: number[]
  /** Tên hiển thị cho `rate`. VD: "CTR", "Engagement rate" */
  rateLabel?: string

  /** Nếu true, coi labels là chuỗi thời gian (tháng/ngày) để tính xu hướng tăng/giảm */
  isTimeSeries?: boolean
}

// ---------- Local formatters (không import từ dashboard-data để tránh vòng lặp import) ----------
const numFmt = (n: number) =>
  Number.isFinite(n) ? new Intl.NumberFormat("vi-VN").format(Math.round(n)) : "—"

const vndFmt = (n: number) => {
  if (!Number.isFinite(n)) return "—"
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + " tỷ"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + " tr"
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫"
}

const pctFmt = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2)}%` : "—")

function formatVolume(n: number, unit: InsightSpec["volumeUnit"]) {
  return unit === "currency" ? vndFmt(n) : numFmt(n)
}

// ---------- Rule-based bullets (chạy tức thì, không gọi API) ----------
export function buildInsights(spec: InsightSpec): string[] {
  const bullets: string[] = []
  const { labels, volume, volumeLabel, volumeUnit, rate, rateLabel, isTimeSeries } = spec

  if (!labels?.length) return bullets

  // 1) Top item theo volume
  if (volume?.length === labels.length) {
    const total = volume.reduce((s, v) => s + (v || 0), 0)
    if (total > 0) {
      const maxIdx = volume.reduce((best, v, i) => (v > volume[best] ? i : best), 0)
      const minIdx = volume.reduce((best, v, i) => (v < volume[best] ? i : best), 0)
      const share = (volume[maxIdx] / total) * 100

      bullets.push(
        `${labels[maxIdx]} dẫn đầu với ${formatVolume(volume[maxIdx], volumeUnit)} ${
          volumeLabel ?? ""
        } (${pctFmt(share)} tổng số).`,
      )

      // Chỉ nêu điểm thấp nhất nếu có ≥ 3 nhóm và không trùng với top
      if (labels.length >= 3 && minIdx !== maxIdx) {
        bullets.push(
          `${labels[minIdx]} thấp nhất với ${formatVolume(volume[minIdx], volumeUnit)} ${
            volumeLabel ?? ""
          }.`,
        )
      }

      // Nếu top chiếm quá bán tổng, cảnh báo mất cân đối
      if (share >= 50 && labels.length > 2) {
        bullets.push(`Phân bổ đang tập trung mạnh vào ${labels[maxIdx]} — cân nhắc đa dạng hoá nếu đây không phải chủ đích.`)
      }
    }
  }

  // 2) Rate cao/thấp nhất (CTR, ER...)
  if (rate?.length === labels.length) {
    const validIdx = rate.map((_, i) => i).filter((i) => Number.isFinite(rate[i]))
    if (validIdx.length > 0) {
      const maxIdx = validIdx.reduce((best, i) => (rate[i] > rate[best] ? i : best), validIdx[0])
      const minIdx = validIdx.reduce((best, i) => (rate[i] < rate[best] ? i : best), validIdx[0])

      bullets.push(`${rateLabel ?? "Tỷ lệ"} cao nhất ở ${labels[maxIdx]}: ${pctFmt(rate[maxIdx])}.`)

      if (minIdx !== maxIdx) {
        bullets.push(`${rateLabel ?? "Tỷ lệ"} thấp nhất ở ${labels[minIdx]}: ${pctFmt(rate[minIdx])} — có thể cần tối ưu.`)
      }
    }
  }

  // 3) Xu hướng theo thời gian (nếu là time series và có volume)
  if (isTimeSeries && volume && volume.length >= 2) {
    const first = volume[0]
    const last = volume[volume.length - 1]
    if (first > 0) {
      const change = ((last - first) / first) * 100
      const direction = change > 0 ? "tăng" : change < 0 ? "giảm" : "không đổi"
      if (Math.abs(change) >= 1) {
        bullets.push(
          `${volumeLabel ?? "Chỉ số"} ${direction} ${pctFmt(Math.abs(change))} từ ${labels[0]} đến ${labels[labels.length - 1]}.`,
        )
      }
    }
  }

  return bullets.slice(0, 4) // giới hạn số bullet hiển thị
}

// ---------- Format spec thành text block để đưa vào prompt LLM ----------
export function specToPrompt(spec: InsightSpec): string {
  const { labels, volume, volumeLabel, volumeUnit, rate, rateLabel } = spec
  const lines: string[] = []

  labels.forEach((label, i) => {
    const parts: string[] = [`- ${label}:`]
    if (volume?.[i] !== undefined) {
      parts.push(`${volumeLabel ?? "Giá trị"} = ${formatVolume(volume[i], volumeUnit)}`)
    }
    if (rate?.[i] !== undefined) {
      parts.push(`${rateLabel ?? "Tỷ lệ"} = ${pctFmt(rate[i])}`)
    }
    lines.push(parts.join(" "))
  })

  return lines.join("\n")
}