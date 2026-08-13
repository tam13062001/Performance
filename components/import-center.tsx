"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  DatabaseZap,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Sheet as SheetIcon,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { tableForSheetTab } from "@/lib/sheet-table-map"

type DbProject = { code: string; label: string; sheetId?: string }

type SheetTab = { title: string; sheetId?: number; rowCount?: number | null }

type SyncResult = {
  project_code?: string
  table?: string
  rowCount?: number
  errorMessage?: string
}

type SyncState = {
  status: "idle" | "syncing" | "ok" | "error"
  lastSyncedAt?: string
  results?: SyncResult[]
}

type LogEntry = { id: number; label: string; ok: boolean; text: string; time: string }

async function fetchProjects(): Promise<DbProject[]> {
  const res = await fetch("/api/projects")
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json.projects ?? []
}

async function fetchSheetTabs(projectCode: string): Promise<SheetTab[]> {
  const res = await fetch(`/api/projects/sheets?project_code=${encodeURIComponent(projectCode)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Không lấy được danh sách sheet")
  return json.tabs ?? []
}

// Dùng lại đúng API sync cũ: /api/sync?project_code=...&table=...
async function runSync(
  projectCode?: string,
  table?: string
): Promise<{ synced_at: string; results: SyncResult[] }> {
  const params = new URLSearchParams()
  if (projectCode) params.set("project_code", projectCode)
  if (table) params.set("table", table)
  const res = await fetch(`/api/sync${params.toString() ? `?${params}` : ""}`)
  const json = await res.json()
  if (!res.ok && !json.results) throw new Error(json.error ?? "Sync thất bại")
  return json
}

function SyncProgressBar({ elapsedMs }: { elapsedMs: number }) {
  const seconds = (elapsedMs / 1000).toFixed(1)
  return (
    <div className="sync-progress">
      <div className="sync-progress-track">
        <div className="sync-progress-fill" />
      </div>
      <span className="sync-progress-label">
        <Loader2 size={13} className="spin" /> Đang đồng bộ… {seconds}s
      </span>
    </div>
  )
}

export function ImportCenter() {
  const [projects, setProjects] = useState<DbProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})
  const [log, setLog] = useState<LogEntry[]>([])
  const logId = useRef(0)

  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number>(0)

  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // ---- Chọn sheet để sync ----
  const [sheetPickerProject, setSheetPickerProject] = useState<DbProject | null>(null)
  const [sheetTabs, setSheetTabs] = useState<SheetTab[]>([])
  const [sheetTabsLoading, setSheetTabsLoading] = useState(false)
  const [sheetTabsError, setSheetTabsError] = useState<string | null>(null)
  const [selectedTabs, setSelectedTabs] = useState<Set<string>>(new Set())

  const readyCount = useMemo(
    () => projects.filter((p) => syncStates[p.code]?.status === "ok").length,
    [projects, syncStates]
  )

  function loadProjects() {
    setProjectsLoading(true)
    setProjectsError(null)
    fetchProjects()
      .then(setProjects)
      .catch((e) => setProjectsError(e.message))
      .finally(() => setProjectsLoading(false))
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (!runningKey) return
    startRef.current = Date.now()
    setElapsedMs(0)
    const interval = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100)
    return () => clearInterval(interval)
  }, [runningKey])

  function addLog(label: string, ok: boolean, text: string) {
    logId.current += 1
    setLog((prev) =>
      [{ id: logId.current, label, ok, text, time: new Date().toLocaleTimeString("vi-VN") }, ...prev].slice(0, 10)
    )
  }

  // table: tên bảng DB đích (đã map từ tên tab). displayLabel: hiển thị cho log/UI.
  async function handleSync(projectCode?: string, table?: string, displayLabel?: string) {
    const key = table ? `${projectCode}::${table}` : projectCode ?? "ALL"
    setRunningKey(key)
    setSyncStates((s) => ({ ...s, [key]: { status: "syncing" } }))

    try {
      const { synced_at, results } = await runSync(projectCode, table)
      const hasError = results.some((r) => r.errorMessage)
      const baseLabel = projectCode ? projects.find((p) => p.code === projectCode)?.label ?? projectCode : "Tất cả project"
      const label = displayLabel ? `${baseLabel} · ${displayLabel}` : baseLabel

      setSyncStates((s) => ({
        ...s,
        [key]: { status: hasError ? "error" : "ok", lastSyncedAt: synced_at, results },
      }))

      if (hasError) {
        const firstError = results.find((r) => r.errorMessage)
        addLog(label, false, `${firstError?.table ?? "?"}: ${firstError?.errorMessage}`)
      } else {
        const totalRows = results.reduce((sum, r) => sum + (r.rowCount ?? 0), 0)
        addLog(label, true, `Đồng bộ xong ${results.length} bảng${totalRows ? ` · ${totalRows} dòng` : ""}.`)
      }
    } catch (e: any) {
      setSyncStates((s) => ({ ...s, [key]: { status: "error" } }))
      const baseLabel = projectCode ? projects.find((p) => p.code === projectCode)?.label ?? projectCode : "Tất cả project"
      addLog(displayLabel ? `${baseLabel} · ${displayLabel}` : baseLabel, false, e.message ?? "Lỗi không xác định")
    } finally {
      setRunningKey(null)
    }
  }

  function resetLog() {
    setLog([])
    setSyncStates({})
  }

  async function handleAddProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddLoading(true)
    setAddError(null)
    const form = new FormData(e.currentTarget)
    const url = String(form.get("sheetUrl") ?? "").trim()
    const code = String(form.get("projectCode") ?? "").trim()
    const label = String(form.get("projectLabel") ?? "").trim()

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, project_code: code, label }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Không thêm được project")

      addLog(label, true, `Đã thêm project mới "${code}" từ Google Sheet.`)
      setAddOpen(false)
      loadProjects()
    } catch (e: any) {
      setAddError(e.message)
    } finally {
      setAddLoading(false)
    }
  }

  // ---- Mở modal chọn sheet ----
  async function openSheetPicker(p: DbProject) {
    setSheetPickerProject(p)
    setSheetTabs([])
    setSelectedTabs(new Set())
    setSheetTabsError(null)
    setSheetTabsLoading(true)
    try {
      const tabs = await fetchSheetTabs(p.code)
      setSheetTabs(tabs)
    } catch (e: any) {
      setSheetTabsError(e.message)
    } finally {
      setSheetTabsLoading(false)
    }
  }

  function closeSheetPicker() {
    if (runningKey) return
    setSheetPickerProject(null)
  }

  function toggleTab(title: string) {
    setSelectedTabs((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  // Sync lần lượt từng tab đã chọn — mỗi tab được map sang table thật rồi
  // gọi /api/sync?table=... (API cũ, không cần thay đổi backend)
  async function handleSyncSelectedTabs() {
    if (!sheetPickerProject) return
    const tabs = [...selectedTabs]
    if (tabs.length === 0) return

    for (const tab of tabs) {
      const table = tableForSheetTab(tab)
      if (!table) {
        addLog(`${sheetPickerProject.label} · ${tab}`, false, `Không xác định được bảng DB tương ứng với tab "${tab}".`)
        continue
      }
      await handleSync(sheetPickerProject.code, table, tab)
    }
    closeSheetPicker()
  }

  return (
    <>
      <div className="hero import-hero">
        <div>
          <span className="eyebrow">
            <DatabaseZap size={13} /> Sync data center
          </span>
          <h2>Đồng bộ dữ liệu từ Google Sheet vào Rocket Performance.</h2>
          <p>Mỗi project đã được kết nối 1 Google Sheet. Bấm "Sync now" để lấy toàn bộ, hoặc "Chọn sheet" để sync riêng từng tab.</p>
        </div>
        <div className="hero-badge">
          <b>{readyCount}/{projects.length || 0}</b>
          <span>Project đã sync</span>
        </div>
      </div>

      <div className="import-grid">
        <button type="button" className="upload-card sync-all-card" onClick={() => handleSync()} disabled={!!runningKey}>
          <div className="upload-icon">
            <RefreshCw size={20} className={runningKey === "ALL" ? "spin" : ""} />
          </div>
          <div className="upload-body">
            <small>Toàn bộ project</small>
            <h3>Sync tất cả</h3>
            <p>Chạy sync cho mọi project đang active trong DB.</p>
          </div>
          {runningKey === "ALL" && <SyncProgressBar elapsedMs={elapsedMs} />}
          {runningKey !== "ALL" && syncStates.ALL && (
            <div className={`upload-status ${syncStates.ALL.status}`}>
              {syncStates.ALL.status === "ok" ? "Đã sync xong" : "Có lỗi khi sync"}
            </div>
          )}
        </button>

        {projectsLoading && <div className="notice"><Loader2 size={16} className="spin" /><div><b>Đang tải danh sách project…</b></div></div>}
        {projectsError && <div className="notice error"><XCircle size={16} /><div><b>Lỗi tải project</b><p>{projectsError}</p></div></div>}

        {!projectsLoading && projects.length === 0 && (
          <div className="notice">
            <DatabaseZap size={16} />
            <div>
              <b>Chưa có project nào.</b>
              <p>Thêm project mới bằng Google Sheet URL bên dưới.</p>
            </div>
          </div>
        )}

        {projects.map((p) => {
          const st = syncStates[p.code]
          const isRunning = runningKey === p.code
          return (
            <article key={p.code} className="upload-card">
              <div className="upload-icon">
                <RefreshCw size={20} className={isRunning ? "spin" : ""} />
              </div>
              <div className="upload-body">
                <small>{p.code}</small>
                <h3>{p.label}</h3>
                <p>Sync toàn bộ hoặc chọn riêng tab muốn đồng bộ.</p>
              </div>
              <div className="source-actions">
                <button type="button" className="sheet-button" onClick={() => handleSync(p.code)} disabled={!!runningKey}>
                  <RefreshCw size={15} /> Sync now
                </button>
                <button type="button" className="sheet-button" onClick={() => openSheetPicker(p)} disabled={!!runningKey}>
                  <ListChecks size={15} /> Chọn sheet
                </button>
              </div>
              {isRunning && <SyncProgressBar elapsedMs={elapsedMs} />}
              {!isRunning && st && (
                <div className={`upload-status ${st.status}`}>
                  {st.status === "ok" && `Đã sync · ${st.lastSyncedAt ? new Date(st.lastSyncedAt).toLocaleTimeString("vi-VN") : ""}`}
                  {st.status === "error" && "Sync lỗi — xem log bên dưới"}
                </div>
              )}
            </article>
          )
        })}

        <button type="button" className="upload-card add-project-card" onClick={() => setAddOpen(true)}>
          <div className="upload-icon">
            <Plus size={20} />
          </div>
          <div className="upload-body">
            <small>New source</small>
            <h3>Thêm project mới</h3>
            <p>Dán Google Sheet URL để tự động lấy sheet ID và kết nối.</p>
          </div>
        </button>
      </div>

      <div className="grid-2">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Sync log</small>
              <h3>Lịch sử đồng bộ gần nhất</h3>
            </div>
            <button type="button" className="ghost-button" onClick={resetLog}>
              <Trash2 size={15} /> Xóa log
            </button>
          </div>
          <div className="import-log">
            {log.length === 0 ? (
              <div className="empty-log">Chưa có lần sync nào. Bấm "Sync now" để bắt đầu.</div>
            ) : (
              log.map((l) => (
                <div key={l.id} className={`log-row ${l.ok ? "ok" : "error"}`}>
                  {l.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <b>
                      {l.label} · {l.time}
                    </b>
                    <span>{l.text}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <small>Chi tiết bảng</small>
              <h3>Kết quả sync theo từng table</h3>
            </div>
          </div>
          <div className="format-list">
            {Object.entries(syncStates).flatMap(([key, st]) =>
              (st.results ?? []).map((r, i) => (
                <div key={`${key}-${i}`}>
                  <b>
                    {r.project_code ?? key} · {r.table ?? "—"}
                  </b>
                  <code>
                    {r.errorMessage ? r.errorMessage : `${r.rowCount ?? "?"} dòng — OK`}
                  </code>
                </div>
              ))
            )}
            {Object.keys(syncStates).length === 0 && <div className="empty-log">Chưa có kết quả sync nào.</div>}
          </div>
        </article>
      </div>

      {addOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => !addLoading && setAddOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <small>New sync source</small>
                <h3>Thêm project từ Google Sheet URL</h3>
              </div>
              <button type="button" className="icon-btn" aria-label="Đóng" onClick={() => setAddOpen(false)} disabled={addLoading}>
                <X size={16} />
              </button>
            </div>
            <form className="project-form" onSubmit={handleAddProject}>
              <label>
                <span>Project code *</span>
                <input name="projectCode" required placeholder="VD: NEWCLIENT" />
              </label>
              <label>
                <span>Tên hiển thị *</span>
                <input name="projectLabel" required placeholder="VD: New Client Campaign" />
              </label>
              <label className="full">
                <span>Google Sheets URL *</span>
                <input name="sheetUrl" type="url" required placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
              </label>
              <div className="full sheet-permission-note">
                <Link2 size={18} />
                <div>
                  <b>Quyền truy cập</b>
                  <p>Sheet cần được share Viewer cho service account đồng bộ dữ liệu — hệ thống sẽ tự kiểm tra khi bạn bấm "Thêm project".</p>
                </div>
              </div>
              {addError && (
                <div className="full">
                  <div className="upload-status error">{addError}</div>
                </div>
              )}
              <div className="modal-actions full">
                <button type="button" className="ghost-button" onClick={() => setAddOpen(false)} disabled={addLoading}>
                  Hủy
                </button>
                <button type="submit" className="primary-button" disabled={addLoading}>
                  {addLoading ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                  {addLoading ? "Đang kiểm tra..." : "Thêm project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sheetPickerProject && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeSheetPicker}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <small>Chọn sheet để sync</small>
                <h3>{sheetPickerProject.label}</h3>
              </div>
              <button type="button" className="icon-btn" aria-label="Đóng" onClick={closeSheetPicker} disabled={!!runningKey}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "0 4px" }}>
              {sheetTabsLoading && (
                <div className="notice"><Loader2 size={16} className="spin" /><div><b>Đang tải danh sách sheet…</b></div></div>
              )}
              {sheetTabsError && (
                <div className="notice error"><XCircle size={16} /><div><b>Lỗi</b><p>{sheetTabsError}</p></div></div>
              )}

              {!sheetTabsLoading && !sheetTabsError && sheetTabs.length === 0 && (
                <div className="empty-log">Không tìm thấy sheet nào trong file này.</div>
              )}

              {!sheetTabsLoading && sheetTabs.length > 0 && (
                <div className="sheet-tab-list">
                  {sheetTabs.map((tab) => {
                    const table = tableForSheetTab(tab.title)
                    const key = `${sheetPickerProject.code}::${table ?? tab.title}`
                    const isRunning = runningKey === key
                    const st = syncStates[key]
                    return (
                      <label key={tab.title} className={`sheet-tab-row ${!table ? "disabled" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedTabs.has(tab.title)}
                          onChange={() => toggleTab(tab.title)}
                          disabled={!!runningKey || !table}
                        />
                        <SheetIcon size={15} />
                        <span className="sheet-tab-name">{tab.title}</span>
                        {!table && <span className="sheet-tab-nomap" title="Chưa map được bảng DB tương ứng">Chưa hỗ trợ</span>}
                        {tab.rowCount != null && <span className="sheet-tab-rows">{tab.rowCount} dòng</span>}
                        {isRunning && <Loader2 size={14} className="spin" />}
                        {!isRunning && st?.status === "ok" && <CheckCircle2 size={14} className="ok-icon" />}
                        {!isRunning && st?.status === "error" && <XCircle size={14} className="error-icon" />}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="modal-actions full" style={{ marginTop: 16 }}>
              <button type="button" className="ghost-button" onClick={closeSheetPicker} disabled={!!runningKey}>
                Đóng
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={selectedTabs.size === 0 || !!runningKey}
                onClick={handleSyncSelectedTabs}
              >
                {runningKey ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
                {runningKey ? "Đang sync..." : `Sync ${selectedTabs.size || ""} sheet đã chọn`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}