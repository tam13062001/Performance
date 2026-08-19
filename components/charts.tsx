"use client"

import {
  ArcElement,
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
import { Bar, Doughnut, Line } from "react-chartjs-2"
import { hexToRgba, PLATFORM_COLORS, useClientTheme } from "@/lib/theme"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
)

ChartJS.defaults.font.family = "inherit"

// Read a CSS variable off <html> at render time so charts follow the active
// UI theme (dark/light). Falls back to the dark defaults during SSR.
function cvar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

const chartText = () => cvar("--chart-text", "#93a1c9")
const chartGrid = () => cvar("--chart-grid", "rgba(35, 48, 90, 0.6)")

// ---- Series color legibility ----
// Brand colors can be very dark (e.g. a navy secondary) or very light. On a dark
// dashboard a dark line is invisible and vice-versa, so line/series colors get
// nudged toward white/black just enough to read against the active UI theme,
// while preserving the hue that distinguishes them from other series.
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
  if (!isLight && lum < 0.22) return mixHex(hex, [255, 255, 255], 0.6) // too dark on dark bg
  if (isLight && lum > 0.82) return mixHex(hex, [0, 0, 0], 0.35) // too light on light bg
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

// Wrap a label into multiple lines by word, keeping each line within maxLen so
// long campaign names stay fully readable instead of overflowing the plot.
function wrapLabel(raw: string, maxLen = 16): string[] {
  const words = raw.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    if (!current) {
      current = word
    } else if ((current + " " + word).length <= maxLen) {
      current += " " + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// Shared x-axis config. Long category labels (e.g. full campaign names) wrap
// onto multiple lines so the full text stays visible without overflowing.
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

function axes(dualRight = false): ChartOptions["scales"] {
  return {
    x: xAxis(),
    y: {
      grid: { color: chartGrid() },
      ticks: { color: chartText() },
      position: "left",
    },
    ...(dualRight
      ? {
          y1: {
            position: "right" as const,
            grid: { drawOnChartArea: false },
            ticks: { color: seriesColor(cvar("--brand-2", "#22d3ee")) },
          },
        }
      : {}),
  }
}

export function ImpressionsCtrChart({ labels, impressions, ctr }: { labels: string[]; impressions: number[]; ctr: number[] }) {
  const c = useClientTheme()
  const data: ChartData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Impressions",
        data: impressions,
        backgroundColor: hexToRgba(c.primary, 0.6),
        borderRadius: 6,
        yAxisID: "y",
      },
      {
        type: "line" as const,
        label: "CTR (%)",
        data: ctr,
        borderColor: seriesColor(c.secondary),
        backgroundColor: seriesColor(c.secondary),
        tension: 0.4,
        pointRadius: 4,
        yAxisID: "y1",
      },
    ],
  }
  return <Bar data={data as ChartData<"bar">} options={{ ...baseOptions(), scales: axes(true) }} />
}

export function ImpressionsReachCtrChart({
  labels,
  impressions,
  reach,
  ctr,
}: {
  labels: string[]
  impressions: number[]
  reach: number[]
  ctr: number[]
}) {
  const c = useClientTheme()
  const data: ChartData = {
    labels,
    datasets: [
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
        label: "Reach",
        data: reach,
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
        tension: 0.4,
        pointRadius: 4,
        yAxisID: "y1",
      },
    ],
  }
  return <Bar data={data as ChartData<"bar">} options={{ ...baseOptions(), scales: axes(true) }} />
}

export function VolumeBarChart({ 
  labels, 
  impressions, 
  reach, 
  maxLabelLength = 15 // <--- Nhận prop với giá trị mặc định là 15
}: { 
  labels: string[]; 
  impressions: number[]; 
  reach?: number[];
  maxLabelLength?: number; 
}) {
  const c = useClientTheme();
  
  const datasets: ChartData<"bar">["datasets"] = [
    {
      label: "Impressions",
      data: impressions,
      backgroundColor: hexToRgba(c.primary, 0.6),
      borderRadius: 6,
    },
  ];
  
  if (reach) {
    datasets.push({
      label: "Reach",
      data: reach,
      backgroundColor: hexToRgba(c.accent, 0.45),
      borderRadius: 6,
    });
  }

  // Lấy cấu hình trục và option mặc định của bạn
  const defaultOptions = baseOptions();
  const defaultScales = axes(false);

  const customOptions = {
    ...defaultOptions,
    scales: {
      ...defaultScales,
      x: {
        ...defaultScales.x,
        ticks: {
          ...(defaultScales.x?.ticks || {}),
          // Cắt ngắn nhãn trên trục X bằng biến maxLabelLength
          callback: function (value: any, index: number) {
            const originalLabel = labels[index] || "";
            // Đã xóa biến maxLength = 4 ở đây và dùng thẳng maxLabelLength
            if (originalLabel.length > maxLabelLength) {
              return originalLabel.substring(0, maxLabelLength) + "…";
            }
            return originalLabel;
          },
        },
      },
    },
    plugins: {
      ...defaultOptions.plugins,
      tooltip: {
        ...(defaultOptions.plugins?.tooltip || {}),
        callbacks: {
          ...(defaultOptions.plugins?.tooltip?.callbacks || {}),
          // Hiển thị full tên khi Hover
          title: function (tooltipItems: any) {
            return labels[tooltipItems[0].dataIndex];
          },
        },
      },
    },
  };

  return <Bar data={{ labels, datasets }} options={customOptions} />;
}

export function RateLineChart({ 
  labels, 
  ctr, 
  frequency, 
  maxLabelLength = 15 // <--- Giá trị mặc định là 15 ký tự
}: { 
  labels: string[]; 
  ctr: number[]; 
  frequency?: number[];
  maxLabelLength?: number; 
}) {
  const c = useClientTheme();
  
  const datasets: ChartData<"line">["datasets"] = [
    {
      label: "CTR (%)",
      data: ctr,
      borderColor: seriesColor(c.secondary),
      backgroundColor: hexToRgba(seriesColor(c.secondary), 0.15),
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      yAxisID: "y",
    },
  ];
  
  if (frequency) {
    datasets.push({
      label: "Frequency",
      data: frequency,
      borderColor: seriesColor(c.accent),
      backgroundColor: hexToRgba(seriesColor(c.accent), 0.15),
      borderDash: [5, 4],
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      yAxisID: "y1",
    });
  }

  const baseScales = frequency
    ? {
        x: xAxis(),
        y: { position: "left" as const, grid: { color: chartGrid() }, ticks: { color: chartText() } },
        y1: {
          position: "right" as const,
          grid: { drawOnChartArea: false },
          ticks: { color: seriesColor(c.accent) },
        },
      }
    : axes(false);

  const customScales = {
    ...baseScales,
    x: {
      ...(baseScales.x || {}),
      ticks: {
        ...(baseScales.x?.ticks || {}),
        callback: function (value: any, index: number) {
          const originalLabel = labels[index] || "";
          
          // Sử dụng prop maxLabelLength để cắt chữ
          if (originalLabel.length > maxLabelLength) {
            return originalLabel.substring(0, maxLabelLength) + "…";
          }
          return originalLabel;
        },
      },
    },
  };

  const bOptions = baseOptions();
  const customOptions = {
    ...bOptions,
    plugins: {
      ...bOptions.plugins,
      legend: { display: !!frequency }, 
      tooltip: {
        ...(bOptions.plugins?.tooltip || {}),
        callbacks: {
          ...(bOptions.plugins?.tooltip?.callbacks || {}),
          title: function (tooltipItems: any) {
            return labels[tooltipItems[0].dataIndex];
          },
        },
      },
    },
    scales: customScales,
  };

  return (
    <Line
      data={{ labels, datasets }}
      options={customOptions}
    />
  );
}

export function VolumeEfficiencyChart({
  labels,
  impressions,
  ctr,
  frequency,
}: {
  labels: string[]
  impressions: number[]
  ctr: number[]
  frequency?: number[]
}) {
  const c = useClientTheme()
  const datasets: ChartData["datasets"] = [
    {
      type: "bar" as const,
      label: "Impressions",
      data: impressions,
      backgroundColor: hexToRgba(c.primary, 0.55),
      borderRadius: 6,
      order: 3,
      yAxisID: "y",
    },
    {
      type: "line" as const,
      label: "CTR (%)",
      data: ctr,
      borderColor: seriesColor(c.secondary),
      backgroundColor: seriesColor(c.secondary),
      tension: 0.4,
      pointRadius: 4,
      order: 1,
      yAxisID: "y1",
    },
  ]
  if (frequency) {
    datasets.push({
      type: "line" as const,
      label: "Frequency",
      data: frequency,
      borderColor: seriesColor(c.accent),
      backgroundColor: seriesColor(c.accent),
      borderDash: [5, 4],
      tension: 0.4,
      pointRadius: 4,
      order: 2,
      yAxisID: "y2",
    })
  }
  // Left axis = volume (impressions); two right axes = CTR (%) and Frequency.
  const scales = {
    x: xAxis(),
    y: { position: "left" as const, grid: { color: chartGrid() }, ticks: { color: chartText() } },
    y1: { position: "right" as const, grid: { drawOnChartArea: false }, ticks: { color: seriesColor(c.secondary) } },
    ...(frequency
      ? {
          y2: {
            position: "right" as const,
            grid: { drawOnChartArea: false },
            ticks: { color: seriesColor(c.accent) },
            offset: true,
          },
        }
      : {}),
  }
  return <Bar data={{ labels, datasets } as ChartData<"bar">} options={{ ...baseOptions(), scales }} />
}

export type ChannelSlice = { label: string; value: number };

const CHANNEL_COLOR_MAP: Record<string, string> = {
  FACEBOOK: PLATFORM_COLORS.Meta,
  SEM: PLATFORM_COLORS.Google,
  ADX: PLATFORM_COLORS.Google,
  YOUTUBE: PLATFORM_COLORS.Google,
  TIKTOK: "#111827", // hoặc màu brand TikTok bạn muốn dùng
  "MB INPAGE": "#7c3aed",
};

// Bảng màu dự phòng khi gặp channel chưa được khai báo màu riêng, để không bị trùng màu/hụt màu
const FALLBACK_COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#ef4444"];

function colorForChannel(name: string, indexIfUnknown: number): string {
  const key = name.trim().toUpperCase();
  return CHANNEL_COLOR_MAP[key] ?? FALLBACK_COLORS[indexIfUnknown % FALLBACK_COLORS.length];
}

export function ChannelDoughnut({ slices }: { slices: ChannelSlice[] }) {
  let fallbackIdx = 0;
  const colors = slices.map((s) => {
    const key = s.label.trim().toUpperCase();
    const color = CHANNEL_COLOR_MAP[key] ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
    if (!CHANNEL_COLOR_MAP[key]) fallbackIdx++;
    return hexToRgba(color, 0.9);
  });

  const data: ChartData<"doughnut"> = {
    labels: slices.map((s) => s.label),
    datasets: [
      {
        data: slices.map((s) => s.value),
        backgroundColor: colors,
        borderColor: cvar("--panel", "#0c1122"),
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <Doughnut
      data={data}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
          tooltip: baseOptions().plugins?.tooltip,
        },
      }}
    />
  );
}

export function CreativeChart({ labels, ctr }: { labels: string[]; ctr: number[] }) {
  const c = useClientTheme()
  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "CTR (%)",
        data: ctr,
        backgroundColor: [hexToRgba(c.primary, 0.75), hexToRgba(c.secondary, 0.75), hexToRgba(c.accent, 0.75)],
        borderRadius: 8,
      },
    ],
  }
  return <Bar data={data} options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } }, scales: axes(false) }} />
}

export function BreakdownChart({ labels, clicks, impressions }: { labels: string[]; clicks: number[]; impressions: number[] }) {
  const c = useClientTheme()
  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Impressions",
        data: impressions,
        backgroundColor: hexToRgba(c.primary, 0.55),
        borderRadius: 6,
      },
      {
        label: "Clicks",
        data: clicks,
        backgroundColor: hexToRgba(c.secondary, 0.7),
        borderRadius: 6,
      },
    ],
  }
  return <Bar data={data} options={{ ...baseOptions(), scales: axes(false) }} />
}

export function AudienceChart({ labels, impressions, ctr }: { labels: string[]; impressions: number[]; ctr: number[] }) {
  const c = useClientTheme()
  const data: ChartData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Impressions",
        data: impressions,
        backgroundColor: hexToRgba(c.secondary, 0.55),
        borderRadius: 6,
        yAxisID: "y",
      },
      {
        type: "line" as const,
        label: "CTR (%)",
        data: ctr,
        borderColor: c.primary,
        backgroundColor: c.primary,
        tension: 0.4,
        pointRadius: 4,
        yAxisID: "y1",
      },
    ],
  }
  return <Bar data={data as ChartData<"bar">} options={{ ...baseOptions(), scales: axes(true) }} />
}

export function TrendCtrCpcChart({ labels, ctr, cpc }: { labels: string[]; ctr: number[]; cpc: number[] }) {
  const data: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "CTR (%)",
        data: ctr,
        borderColor: cvar("--brand-2", "#22d3ee"),
        backgroundColor: "rgba(34, 211, 238, 0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: "y",
      },
      {
        label: "CPC (nghìn VND)",
        data: cpc.map((c) => Math.round(c / 1000)),
        borderColor: cvar("--brand", "#7c5cff"),
        backgroundColor: "rgba(124, 92, 255, 0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: "y1",
      },
    ],
  }
  return <Line data={data} options={{ ...baseOptions(), scales: axes(true) }} />
}

export function TrendChart({ labels, clicks, spend }: { labels: string[]; clicks: number[]; spend: number[] }) {
  const data: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "Clicks",
        data: clicks,
        borderColor: cvar("--brand-2", "#22d3ee"),
        backgroundColor: "rgba(34, 211, 238, 0.15)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: "y",
      },
      {
        label: "Spend (triệu VND)",
        data: spend.map((s) => Math.round(s / 1_000_000)),
        borderColor: cvar("--brand", "#7c5cff"),
        backgroundColor: "rgba(124, 92, 255, 0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: "y1",
      },
    ],
  }
  return <Line data={data} options={{ ...baseOptions(), scales: axes(true) }} />
}
