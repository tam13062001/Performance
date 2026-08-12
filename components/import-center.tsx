"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  DatabaseZap,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react"

type DbProject = { code: string; label: string; sheetId?: string }

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

async function runSync(projectCode?: string, table?: string): Promise<{ synced_at: string; results: SyncResult[] }> {
  const params = new URLSearchParams()
  if (projectCode) params.set("project_code", projectCode)
  if (table) params.set("table", table)
  const res = await fetch(`/api/sync${params.toString() ? `?${params}` : ""}`)
  const json = await res.json()
  if (!res.ok && !json.results) throw new Error(json.error ?? "Sync thất bại")
  return json
}

// Thanh progress dạng indeterminate — vì /api/sync là 1 request dài (tới 60s)
// không trả % tiến độ thật, nên hiện animation trượt + đếm giây đã trôi qua.
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

  // Trạng thái sync theo từng project_code, + "ALL" cho sync toàn bộ
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})
  const [log, setLog] = useState<LogEntry[]>([])
  const logId = useRef(0)

  // Đếm thời gian đang chạy để hiện lên progress bar
  const [runningKey, setRunningKey] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number>(0)

  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

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

  async function handleSync(projectCode?: string) {
    const key = projectCode ?? "ALL"
    setRunningKey(key)
    setSyncStates((s) => ({ ...s, [key]: { status: "syncing" } }))

    try {
      const { synced_at, results } = await runSync(projectCode)
      const hasError = results.some((r) => r.errorMessage)
      const label = projectCode ? projects.find((p) => p.code === projectCode)?.label ?? projectCode : "Tất cả project"

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
      addLog(projectCode ?? "Tất cả project", false, e.message ?? "Lỗi không xác định")
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

  return (
    <>
      <div className="hero import-hero">
        <div>
          <span className="eyebrow">
            <DatabaseZap size={13} /> Sync data center
          </span>
          <h2>Đồng bộ dữ liệu từ Google Sheet vào Rocket Performance.</h2>
          <p>Mỗi project đã được kết nối 1 Google Sheet. Bấm "Sync now" để lấy dữ liệu mới nhất, hoặc thêm project mới bằng URL Sheet.</p>
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
                <p>Sync riêng project này từ Google Sheet đã kết nối.</p>
              </div>
              <div className="source-actions">
                <button type="button" className="sheet-button" onClick={() => handleSync(p.code)} disabled={!!runningKey}>
                  <RefreshCw size={15} /> Sync now
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
    </>
  )
}