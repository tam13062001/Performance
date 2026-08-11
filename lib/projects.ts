"use client"

import { useCallback, useEffect, useState } from "react"
import { type ClientTheme, DEFAULT_THEME } from "./theme"

export type ProjectStatus = "Active" | "Planning" | "Completed"

// Transparency = actual spend from ad platforms; Non-transparency = estimated from unit-cost plan.
export type BillingModel = "transparent" | "non-transparent"

export type Project = {
  id: string
  name: string
  client: string
  description: string
  startDate: string
  endDate: string
  status: ProjectStatus
  billingModel: BillingModel
  createdAt: number
  theme: ClientTheme
}

export type NewProject = Omit<Project, "id" | "createdAt" | "theme">

// Đổi KEY để force reset lại local storage, nhận project Tanakan mới
const STORAGE_KEY = "rocket.projects.v10" 
const ACTIVE_KEY = "rocket.activeProject.v10"

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "buv-campaign",
    name: "BUV Campaign",
    client: "British University Vietnam",
    description: "Google Ads + Meta Ads",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "Active",
    billingModel: "transparent",
    createdAt: Date.now(),
    theme: {
      ...DEFAULT_THEME,
      preset: "client-branded",
      primary: "#C8102E",
      secondary: "#12284C",
      accent: "#D4AF37",
      clientName: "British University Vietnam",
      reportTitle: "BUV Media Performance",
      footerText: "Prepared by Rocket Digital",
    },
  },
  {
    id: "tanakan-campaign", // ID map với UI
    name: "Tanakan Campaign",
    client: "Tanakan",
    description: "Multi-channel Campaign",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "Active",
    billingModel: "transparent",
    createdAt: Date.now(),
    theme: {
      ...DEFAULT_THEME,
      preset: "client-branded",
      primary: "#0A7DC2", // Bạn có thể thay đổi mã màu theo branding của Tanakan
      secondary: "#F5A623",
      accent: "#7FC5E8",
      clientName: "Tanakan",
      reportTitle: "Tanakan Performance Dashboard",
      footerText: "Prepared by Rocket Digital",
    },
  },
]

// Backfill theme for projects persisted before the skin system existed.
function withTheme(p: Partial<Project> & { id: string }): Project {
  return {
    ...(p as Project),
    billingModel: p.billingModel ?? "transparent",
    theme: { ...DEFAULT_THEME, ...(p.theme ?? {}) },
  }
}

function load(): Project[] {
  if (typeof window === "undefined") return DEFAULT_PROJECTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROJECTS
    const parsed = JSON.parse(raw) as Project[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(withTheme) : DEFAULT_PROJECTS
  } catch {
    return DEFAULT_PROJECTS
  }
}

function loadActive(fallback: string): string {
  if (typeof window === "undefined") return fallback
  return window.localStorage.getItem(ACTIVE_KEY) ?? fallback
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS)
  const [activeId, setActiveId] = useState<string>(DEFAULT_PROJECTS[0].id)
  const [hydrated, setHydrated] = useState(false)

  // Rehydrate from localStorage after mount to keep SSR output stable.
  useEffect(() => {
    const stored = load()
    setProjects(stored)
    setActiveId(loadActive(stored[0].id))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  }, [projects, hydrated])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId, hydrated])

  const addProject = useCallback((data: NewProject) => {
    const project: Project = {
      ...data,
      id: `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`,
      createdAt: Date.now(),
      theme: { ...DEFAULT_THEME, clientName: data.client },
    }
    setProjects((prev) => [...prev, project])
    setActiveId(project.id)
    return project
  }, [])

  const updateTheme = useCallback((id: string, patch: Partial<ClientTheme>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, theme: { ...p.theme, ...patch } } : p)))
  }, [])

  const removeProject = useCallback(
    (id: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id)
        return next.length > 0 ? next : DEFAULT_PROJECTS
      })
      setActiveId((current) => {
        if (current !== id) return current
        const remaining = projects.filter((p) => p.id !== id)
        return remaining[0]?.id ?? DEFAULT_PROJECTS[0].id
      })
    },
    [projects],
  )

  const activeProject = projects.find((p) => p.id === activeId) ?? projects[0]

  return { projects, activeProject, activeId, setActiveId, addProject, removeProject, updateTheme, hydrated }
}