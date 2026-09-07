// components/dashboard/ComboVolumeRateChart.tsx
"use client"

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js"
import { Bar } from "react-chartjs-2"
import { hexToRgba, useClientTheme } from "@/lib/theme"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
)

// ---- Helpers copy lại từ file chart gốc để component này tự đứng độc lập ----

function cvar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const chartText = () => cvar("--chart-text", "#93a1c9")
const chartGrid = () => cvar("--chart-grid", "rgba(35, 48, 90, 0.6)")

function hexToRgbTuple(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const int = Number.parseInt(h, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}
function relLuminance(hex: string): number {
  const [r, g, b] = hexToRgbTuple(hex).map((v) => v / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function mixHex(hex: string, target: [number, number, number], amt: number): string {
  const [r, g, b] = hexToRgbTuple(hex)
  const to2 = (n: number) => Math.round(n).toString(16).padStart(2, "0")
  return `#${to2(r + (target[0] - r) * amt)}${to2(g + (target[1] - g) * amt)}${to2(b + (target[2] - b) * amt)}`
}
function seriesColor(hex: string): string {
  const isLight = typeof document !== "undefined" && document.documentElement.dataset.uiTheme === "light"
  const lum = relLuminance(hex)
  if (!isLight && lum < 0.22) return mixHex(hex, [255, 255, 255], 0.6)
  if (isLight && lum > 0.82) return mixHex(hex, [0, 0, 0], 0.35)
  return hex
}

function baseOptions(): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { usePointStyle: true, boxWidth: 8, padding: 16, color: chartText() },
        position: "top",
      },
      tooltip: {
        backgroundColor: cvar("--chart-tooltip-bg", "#131b34"),
        borderColor: cvar("--chart-tooltip-border", "#23305a"),
        borderWidth: 1,
        padding: 12,
        titleColor: cvar("--chart-tooltip-title", "#eaf0ff"),
        bodyColor: cvar("--chart-tooltip-body", "#93a1c9"),
      },
    },
  }
}

function splitIntoTokens(raw: string): string[] {
  const tokens: string[] = []
  let current = ""
  for (const ch of raw) {
    current += ch
    if (ch === "_" || ch === "-" || ch === " ") {
      tokens.push(current)
      current = ""
    }
  }
  if (current) tokens.push(current)
  return tokens
}

function wrapLabel(raw: string, maxLen = 16): string[] {
  const tokens = splitIntoTokens(raw)
  const lines: string[] = []
  let current = ""
  for (const token of tokens) {
    if (token.length > maxLen) {
      if (current) {
        lines.push(current)
        current = ""
      }
      let remaining = token
      while (remaining.length > maxLen) {
        lines.push(remaining.slice(0, maxLen))
        remaining = remaining.slice(maxLen)
      }
      current = remaining
      continue
    }
    if (!current) {
      current = token
    } else if ((current + token).length <= maxLen) {
      current += token
    } else {
      lines.push(current)
      current = token
    }
  }
  if (current) lines.push(current)
  return lines
}

function wrapMultiline(raw: string, maxLen: number, maxLines: number): string[] {
  const lines = wrapLabel(raw, maxLen)
  if (lines.length <= maxLines) return lines
  const trimmed = lines.slice(0, maxLines)
  const last = trimmed[maxLines - 1]
  trimmed[maxLines - 1] = (last.length > 1 ? last.slice(0, -1) : last) + "…"
  return trimmed
}

function xAxis() {
  return {
    grid: { display: false },
    ticks: {
      color: chartText(),
      autoSkip: false,
      maxRotation: 0,
      minRotation: 0,
      font: { size: 10 },
      callback(this: { getLabelForValue: (v: number) => string }, value: number | string) {
        const raw = typeof value === "number" ? this.getLabelForValue(value) : String(value)
        return wrapLabel(raw)
      },
    },
  }
}

function axes(): ChartOptions["scales"] {
  return {
    x: xAxis(),
    y: {
      grid: { color: chartGrid() },
      ticks: { color: chartText() },
      position: "left",
    },
  }
}

// ---- Component chính ----

export function VolumeRateComboChart({
  labels,
  impressions,
  secondary,
  secondaryLabel = "Reach",
  ctr,
  maxLabelLength = 14,
  maxLabelLines = 3,
  minBarWidth = 90,
}: {
  labels: string[]
  impressions: number[]
  secondary: number[] // Clicks (Google) hoặc Reach (Meta/Youtube)
  secondaryLabel?: string
  ctr: number[]
  maxLabelLength?: number
  maxLabelLines?: number
  minBarWidth?: number
}) {
  const c = useClientTheme()

  const datasets: ChartData["datasets"] = [
    {
      type: "bar" as const,
      label: "Impressions",
      data: impressions,
      backgroundColor: hexToRgba(c.primary, 0.6),
      borderRadius: 6,
      yAxisID: "y",
    },
    {
      type: "bar" as const,
      label: secondaryLabel,
      data: secondary,
      backgroundColor: hexToRgba(c.accent, 0.45),
      borderRadius: 6,
      yAxisID: "y",
    },
    {
      type: "line" as const,
      label: "CTR (%)",
      data: ctr,
      borderColor: seriesColor(c.secondary),
      backgroundColor: seriesColor(c.secondary),
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      borderWidth: 2.5,
      yAxisID: "y1",
    },
  ]

  const defaultOptions = baseOptions()
  const defaultScales = axes()

  const customOptions = {
    ...defaultOptions,
    scales: {
      ...defaultScales,
      x: {
        ...defaultScales.x,
        ticks: {
          ...(defaultScales.x?.ticks || {}),
          callback: function (value: any, index: number) {
            const originalLabel = labels[index] || ""
            if (labels.length <= 2) return originalLabel
            return wrapMultiline(originalLabel, maxLabelLength, maxLabelLines)
          },
        },
      },
      y1: {
        position: "right" as const,
        grid: { drawOnChartArea: false },
        ticks: { color: seriesColor(c.secondary) },
        beginAtZero: true,
      },
    },
    plugins: {
      ...defaultOptions.plugins,
      legend: { display: true, labels: { ...defaultOptions.plugins?.legend?.labels } },
      tooltip: {
        ...(defaultOptions.plugins?.tooltip || {}),
        callbacks: {
          ...(defaultOptions.plugins?.tooltip?.callbacks || {}),
          title: function (tooltipItems: any) {
            return labels[tooltipItems[0].dataIndex]
          },
        },
      },
    },
  }

  const chartMinWidth = Math.max(labels.length * minBarWidth, 0)

  return (
    <div style={{ overflowX: "auto", width: "100%", height: "100%" }}>
      <div style={{ minWidth: chartMinWidth, height: "100%" }}>
        <Bar
          data={{ labels, datasets } as ChartData<"bar">}
          options={{ ...customOptions, maintainAspectRatio: false }}
        />
      </div>
    </div>
  )
}