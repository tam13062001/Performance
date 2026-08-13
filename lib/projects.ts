"use client"

import { useCallback, useEffect, useState } from "react"
import { type ClientTheme, DEFAULT_THEME } from "./theme"

export type ProjectStatus = "Active" | "Planning" | "Completed"

// Transparency = actual spend from ad platforms; Non-transparency = estimated from unit-cost plan.
export type BillingModel = "transparent" | "non-transparent"

export type Project = {
  id: string
  code: string // map trực tiếp tới ad_projects.project_code
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

export type NewProject = Omit<Project, "id" | "createdAt" | "theme" | "code">

// Payload khi tạo project mới — cần thêm projectCode + sheetUrl để ghi
// đồng thời vào ad_projects và sync_projects qua API.
export type CreateProjectInput = NewProject & {
  projectCode: string
  sheetUrl: string
}

export type DbProject = {
  code: string
  label: string
  sheetId?: string
  client?: string
  description?: string
  startDate?: string
  endDate?: string
  status?: string
  billingModel?: string
}

const STORAGE_KEY = "rocket.projects.v11"
const ACTIVE_KEY = "rocket.activeProject.v11"

const THEME_PALETTE: Pick<ClientTheme, "primary" | "secondary" | "accent">[] = [
  { primary: "#C8102E", secondary: "#12284C", accent: "#D4AF37" },
  { primary: "#0A7DC2", secondary: "#F5A623", accent: "#7FC5E8" },
  { primary: "#1F9D55", secondary: "#0F2A1C", accent: "#8CE0B0" },
  { primary: "#7C3AED", secondary: "#1E1B2E", accent: "#C4B5FD" },
]

function buildDefaultTheme(label: string, index: number): ClientTheme {
  const palette = THEME_PALETTE[index % THEME_PALETTE.length]
  return {
    ...DEFAULT_THEME,
    preset: "client-branded",
    ...palette,
    clientName: label,
    reportTitle: `${label} Performance Dashboard`,
    footerText: "Prepared by Rocket Digital",
  }
}

function buildProjectFromDb(db: DbProject, index: number): Project {
  return {
    id: db.code,
    code: db.code,
    name: db.label,
    client: db.client ?? "",
    description: db.description ?? "",
    startDate: db.startDate ?? "",
    endDate: db.endDate ?? "",
    status: (db.status as ProjectStatus) ?? "Active",
    billingModel: (db.billingModel as BillingModel) ?? "transparent",
    createdAt: Date.now(),
    theme: buildDefaultTheme(db.label, index),
  }
}

function withDefaults(p: Partial<Project> & { id: string }): Project {
  return {
    ...(p as Project),
    code: p.code ?? p.id,
    billingModel: p.billingModel ?? "transparent",
    theme: { ...DEFAULT_THEME, ...(p.theme ?? {}) },
  }
}

function loadLocal(): Project[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    return Array.isArray(parsed) ? parsed.map(withDefaults) : []
  } catch {
    return []
  }
}

function loadActive(fallback: string): string {
  if (typeof window === "undefined") return fallback
  return window.localStorage.getItem(ACTIVE_KEY) ?? fallback
}

async function fetchDbProjects(): Promise<DbProject[]> {
  try {
    const res = await fetch("/api/projects")
    const json = await res.json()
    return json.projects ?? []
  } catch (e) {
    console.error("fetchDbProjects:", e)
    return []
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)

  const refreshFromDb = useCallback(async () => {
    const local = loadLocal()
    const dbProjects = await fetchDbProjects()

    const localByCode = new Map(local.map((p) => [p.code, p]))
    // Ưu tiên data từ DB (source of truth) nhưng vẫn giữ theme đã lưu local
    const merged: Project[] = dbProjects.map((db, i) => {
      const cached = localByCode.get(db.code)
      const fresh = buildProjectFromDb(db, i)
      return cached ? { ...fresh, theme: cached.theme } : fresh
    })

    const orphaned = local.filter((p) => !dbProjects.some((db) => db.code === p.code))
    const finalList = [...merged, ...orphaned]

    setProjects(finalList)
    return finalList
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const finalList = await refreshFromDb()
      if (cancelled) return
      setActiveId(loadActive(finalList[0]?.id ?? ""))
      setHydrated(true)
      setLoading(false)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [refreshFromDb])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  }, [projects, hydrated])

  useEffect(() => {
    if (!hydrated || !activeId) return
    window.localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId, hydrated])

  // Tạo project mới: gọi API để ghi vào CẢ ad_projects lẫn sync_projects (cùng project_code)
  const addProject = useCallback(async (data: CreateProjectInput) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: data.sheetUrl,
        project_code: data.projectCode,
        label: data.name,
        client: data.client,
        description: data.description,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        status: data.status,
        billing_model: data.billingModel,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error ?? "Không tạo được project")
    }

    const p = json.project
    const project: Project = {
      id: p.code,
      code: p.code,
      name: data.name,
      client: p.client ?? data.client,
      description: p.description ?? data.description,
      startDate: p.startDate ?? data.startDate,
      endDate: p.endDate ?? data.endDate,
      status: p.status ?? data.status,
      billingModel: p.billingModel ?? data.billingModel,
      createdAt: Date.now(),
      theme: buildDefaultTheme(data.client || data.name, projects.length),
    }
    setProjects((prev) => [...prev, project])
    setActiveId(project.id)
    return project
  }, [projects.length])

  // Sửa metadata project đã tồn tại (không đổi project_code/sheet)
  const editProject = useCallback(async (code: string, data: NewProject) => {
    const res = await fetch(`/api/projects?project_code=${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: data.name,
        client: data.client,
        description: data.description,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        status: data.status,
        billing_model: data.billingModel,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error ?? "Không cập nhật được project")
    }

    const p = json.project
    setProjects((prev) =>
      prev.map((proj) =>
        proj.code === code
          ? {
              ...proj,
              name: data.name,
              client: p.client ?? data.client,
              description: p.description ?? data.description,
              startDate: p.startDate ?? data.startDate,
              endDate: p.endDate ?? data.endDate,
              status: p.status ?? data.status,
              billingModel: p.billingModel ?? data.billingModel,
            }
          : proj
      )
    )
  }, [])

  const updateTheme = useCallback((id: string, patch: Partial<ClientTheme>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, theme: { ...p.theme, ...patch } } : p)))
  }, [])

  // Xóa project — gọi API xóa cả ad_projects + sync_projects, chỉ update
  // state local sau khi backend xác nhận xóa thành công.
  const removeProject = useCallback(
    async (id: string, force = false) => {
      const project = projects.find((p) => p.id === id)
      if (!project) return

      const res = await fetch(
        `/api/projects?project_code=${encodeURIComponent(project.code)}${force ? "&force=true" : ""}`,
        { method: "DELETE" }
      )
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? "Không xóa được project")
      }

      setProjects((prev) => prev.filter((p) => p.id !== id))
      setActiveId((current) => {
        if (current !== id) return current
        const remaining = projects.filter((p) => p.id !== id)
        return remaining[0]?.id ?? ""
      })
    },
    [projects],
  )

  const activeProject = projects.find((p) => p.id === activeId) ?? projects[0]

  return {
    projects,
    activeProject,
    activeId,
    setActiveId,
    addProject,
    editProject,
    removeProject,
    updateTheme,
    hydrated,
    loading,
    refreshFromDb,
  }
}