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

// Fixed platform colors — never follow the client brand.
export const PLATFORM_COLORS: Record<string, string> = {
  Google: "#4285F4",   // xanh dương sáng — giữ nguyên, đã đủ nổi trên nền tối
  Meta: "#FF7A59",     // cam san hô — tương phản mạnh với xanh Google, dễ phân biệt tức thì
  YouTube: "#EF4444",
  TikTok: "#2DD4BF",   // đổi từ đen (#111318) sang xanh ngọc — màu đen gần như vô hình trên nền tối
  Programmatic: "#8B5CF6",
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
