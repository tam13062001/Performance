"use client"

import { createContext, useContext } from "react"

// ---------------------------------------------------------------------------
// Client Skin System
// Rocket Core stays consistent; each project carries a Client Skin that only
// reskins client-facing surfaces (header, primary actions, chart primary
// series). Status + platform colors are fixed and never follow the client.
// ---------------------------------------------------------------------------

export type ThemePreset = "rocket-standard" | "client-branded" | "executive-premium"
export type ReportMode = "light" | "dark"

export type ClientTheme = {
  preset: ThemePreset
  logoUrl: string
  coverUrl: string
  primary: string
  secondary: string
  accent: string
  mode: ReportMode
  clientName: string
  reportTitle: string
  footerText: string
}

// Rocket core accents (used for the rocket-standard preset).
export const ROCKET_ACCENTS = { primary: "#7c5cff", secondary: "#22d3ee", accent: "#f5b942" }

export const DEFAULT_THEME: ClientTheme = {
  preset: "rocket-standard",
  logoUrl: "",
  coverUrl: "",
  primary: ROCKET_ACCENTS.primary,
  secondary: ROCKET_ACCENTS.secondary,
  accent: ROCKET_ACCENTS.accent,
  mode: "light",
  clientName: "",
  reportTitle: "Campaign Performance Dashboard",
  footerText: "Powered by Rocket Performance",
}

export const PRESETS: { id: ThemePreset; label: string; desc: string }[] = [
  { id: "rocket-standard", label: "Rocket Standard", desc: "Màu Rocket, chỉ thay logo client. Phù hợp dashboard nội bộ." },
  { id: "client-branded", label: "Client Branded", desc: "Logo và màu client ở header, chart, selected state. Mặc định khi share." },
  { id: "executive-premium", label: "Executive Premium", desc: "Cover riêng, typography lớn, chart tối giản. Dùng cho export PDF / meeting." },
]

// Quick-fill palettes per known client.
export const CLIENT_PRESETS: { label: string; primary: string; secondary: string; accent: string }[] = [
  { label: "BUV", primary: "#C8102E", secondary: "#12284C", accent: "#D4AF37" },
  { label: "Smecta", primary: "#0A7DC2", secondary: "#F5A623", accent: "#7FC5E8" },
  { label: "Phúc Long", primary: "#0B6B3A", secondary: "#C9A227", accent: "#8DC63F" },
]

export const PLATFORM_COLORS: Record<string, string> = {
  Google: "#4285F4",
  Meta: "#f59e0b",
  YouTube: "#FF0000",
  TikTok: "#25F4EE",
  Programmatic: "#8B5CF6",
}

// Multi-stop gradients cho platform có brand identity dạng gradient (hiện
// chỉ Meta). null = không có gradient, dùng PLATFORM_COLORS làm màu đặc.
export const PLATFORM_GRADIENT_STOPS: Record<string, string[] | null> = {
  Google: null,
  Meta: ["#0064E0", "#7B2FF7", "#F72585", "#FF7A00"],
  YouTube: null,
  TikTok: null,
  Programmatic: null,
}

// Tạo CanvasGradient theo chiều dọc (top -> bottom) cho 1 dataset, dùng cho
// cả bar (backgroundColor) và line (borderColor). Chart.js gọi callback này
// mỗi lần vẽ, có sẵn ctx + chartArea nên không cần biết kích thước trước.
function platformScriptableColor(platformKey: string, fallbackHex: string, alpha = 1) {
  const stops = PLATFORM_GRADIENT_STOPS[platformKey];
  return (context: any) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return hexToRgba(fallbackHex, alpha); // lần vẽ đầu chưa có chartArea

    if (!stops) return hexToRgba(fallbackHex, alpha);

    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    stops.forEach((color, i) => {
      gradient.addColorStop(i / (stops.length - 1), hexToRgba(color, alpha));
    });
    return gradient;
  };
}

// Fixed performance-status colors — never follow the client brand.
export const STATUS_COLORS = { good: "#1CAF75", watch: "#F5A623", under: "#E5484D", none: "#6B7280" }

// hex (#rgb or #rrggbb) → rgba string with the given alpha.
export function hexToRgba(hex: string, alpha = 1): string {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const int = Number.parseInt(h, 16)
  if (Number.isNaN(int) || h.length !== 6) return `rgba(124, 92, 255, ${alpha})`
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Apply the active project's skin to the document via CSS variables.
// rocket-standard leaves the Rocket core tokens untouched.
export function applyProjectTheme(theme: ClientTheme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--client-primary", theme.primary)
  root.style.setProperty("--client-secondary", theme.secondary)
  root.style.setProperty("--client-accent", theme.accent)

  if (theme.preset === "rocket-standard") {
    root.style.removeProperty("--brand")
    root.style.removeProperty("--brand-2")
  } else {
    root.style.setProperty("--brand", theme.primary)
    root.style.setProperty("--brand-2", theme.secondary)
  }
  root.setAttribute("data-report-mode", theme.mode)
  root.setAttribute("data-report-preset", theme.preset)
}

// Chart color context: the active skin's series colors (with Rocket fallback).
export type ChartColors = { primary: string; secondary: string; accent: string }

export const ClientThemeContext = createContext<ChartColors>(ROCKET_ACCENTS)

export function useClientTheme(): ChartColors {
  return useContext(ClientThemeContext)
}
