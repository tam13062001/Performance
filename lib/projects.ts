"use client"

import { useCallback, useEffect, useState } from "react"
import { type ClientTheme, DEFAULT_THEME } from "./theme"

export type ProjectStatus = "Active" | "Planning" | "Completed"

// Transparency = actual spend from ad platforms; Non-transparency = estimated from unit-cost plan.
export type BillingModel = "transparent" | "non-transparent"

export type Project = {
  id: string
  code: string // ⬅️ map trực tiếp tới ad_projects.project_code — thay cho đồng bộ theo index
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

export type DbProject = { code: string; label: string; sheetId?: string }

const STORAGE_KEY = "rocket.projects.v11" // đổi key vì đổi schema (thêm field code)
const ACTIVE_KEY = "rocket.activeProject.v11"

// Bảng màu xoay vòng cho project mới auto-tạo từ DB (không hardcode theo tên khách hàng cụ thể nữa)
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

// Tạo 1 Project (UI) mặc định từ 1 DbProject — dùng khi project có trong DB
// nhưng chưa từng được mở trên UI này (chưa có trong localStorage).
function buildProjectFromDb(db: DbProject, index: number): Project {
  return {
    id: db.code, // dùng thẳng project_code làm id cho đơn giản, tránh lệch
    code: db.code,
    name: db.label,
    client: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "Active",
    billingModel: "transparent",
    createdAt: Date.now(),
    theme: buildDefaultTheme(db.label, index),
  }
}

// Backfill theme cho project cũ lưu trước khi có field `code` hoặc theme system.
function withDefaults(p: Partial<Project> & { id: string }): Project {
  return {
    ...(p as Project),
    code: p.code ?? p.id, // project lưu từ bản cũ chưa có `code` -> fallback dùng id
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

// Fetch danh sách project thật từ DB (ad_projects) — nguồn duy nhất, không hardcode.
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

  // Rehydrate: merge project đã lưu local (giữ theme/metadata tuỳ chỉnh) với
  // danh sách thật từ DB (tự thêm entry mới cho project chưa từng mở trên UI này).
  useEffect(() => {
    let cancelled = false

    async function init() {
      const local = loadLocal()
      const dbProjects = await fetchDbProjects()
      if (cancelled) return

      const localByCode = new Map(local.map((p) => [p.code, p]))
      const merged: Project[] = dbProjects.map((db, i) => localByCode.get(db.code) ?? buildProjectFromDb(db, i))

      // Giữ lại project local nào không còn khớp DB (vd bị xoá khỏi ad_projects)
      // để không mất theme đã tuỳ chỉnh — nhưng đặt cuối danh sách.
      const orphaned = local.filter((p) => !dbProjects.some((db) => db.code === p.code))
      const finalList = [...merged, ...orphaned]

      setProjects(finalList)
      setActiveId(loadActive(finalList[0]?.id ?? ""))
      setHydrated(true)
      setLoading(false)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  }, [projects, hydrated])

  useEffect(() => {
    if (!hydrated || !activeId) return
    window.localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId, hydrated])

  // Tạo project UI-only (không link DB) — dùng khi cần workspace riêng chưa có
  // sheet đồng bộ. Nếu muốn link tới DB, thêm project qua "/api/projects" (POST)
  // trước rồi hook này sẽ tự nhận ở lần load tiếp theo.
  const addProject = useCallback((data: NewProject) => {
    const id = `${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`
    const project: Project = {
      ...data,
      id,
      code: id, // chưa link DB thật -> tạm dùng id làm code, sẽ không có data (impressions...) cho tới khi link
      createdAt: Date.now(),
      theme: buildDefaultTheme(data.client || data.name, projectsLengthRef()),
    }
    setProjects((prev) => [...prev, project])
    setActiveId(project.id)
    return project

    function projectsLengthRef() {
      return 0 // màu mặc định đầu palette cho project UI-only
    }
  }, [])

  const updateTheme = useCallback((id: string, patch: Partial<ClientTheme>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, theme: { ...p.theme, ...patch } } : p)))
  }, [])

  const removeProject = useCallback(
    (id: string) => {
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id)
        return next
      })
      setActiveId((current) => {
        if (current !== id) return current
        const remaining = projects.filter((p) => p.id !== id)
        return remaining[0]?.id ?? ""
      })
    },
    [projects],
  )

  const activeProject = projects.find((p) => p.id === activeId) ?? projects[0]

  return { projects, activeProject, activeId, setActiveId, addProject, removeProject, updateTheme, hydrated, loading }
}