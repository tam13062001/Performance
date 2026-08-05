"use client"

import { useMemo, useRef, useState } from "react"
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  DatabaseZap,
  Download,
  LockOpen,
  Search,
  Share2,
  Sheet,
  Trash2,
  X,
  XCircle,
} from "lucide-react"

type SourceId = "planYTD" | "planMTD" | "google" | "meta"

type SourceDef = {
  id: SourceId
  kicker: string
  title: string
  desc: string
  required: string[]
  Icon: typeof Search
  iconClass?: string
}

type SourceState = {
  status: "idle" | "ok" | "error"
  message: string
  rows?: number
}

type LogEntry = { id: number; source: string; ok: boolean; text: string; time: string }

const SOURCES: SourceDef[] = [
  {
    id: "planYTD",
    kicker: "Media plan",
    title: "YTD Plan",
    desc: "Plan tổng kỳ theo region, phase, channel, buying type và asset.",
    required: ["region", "phase", "channel", "buying_type", "asset", "unit_cost", "quanity", "start_date", "end_date"],
    Icon: CalendarDays,
  },
  {
    id: "planMTD",
    kicker: "Media plan",
    title: "MTD Plan",
    desc: "Plan từng tháng, dùng để tính pacing và forecast.",
    required: ["month", "region", "phase", "channel", "buying_type", "asset", "unit_cost", "quanity", "start_date", "end_date"],
    Icon: CalendarClock,
  },
  {
    id: "google",
    kicker: "Raw delivery",
    title: "Google Ads",
    desc: "CSV/XLSX export Campaign, Ad Group, Keyword và Audience.",
    required: [],
    Icon: Search,
    iconClass: "google-icon",
  },
  {
    id: "meta",
    kicker: "Raw delivery",
    title: "Facebook / Meta",
    desc: "Workbook hỗ trợ các sheet Utd, Age, Gender và Region.",
    required: [],
    Icon: Share2,
    iconClass: "meta-icon",
  },
]

const FORMATS: { title: string; cols: string }[] = [
  { title: "YTD Plan", cols: "region, phase, channel, buying_type, asset, unit_cost, quanity, start_date, end_date" },
  { title: "MTD Plan", cols: "month, region, phase, channel, buying_type, asset, unit_cost, quanity, start_date, end_date" },
  { title: "Meta workbook", cols: "Utd, Age, Gender, Region" },
  { title: "Google workbook", cols: "Campaigns, AdGroups, Keywords, Age, Gender, Region" },
]

const TEMPLATES: { label: string; file: string; content: string }[] = [
  {
    label: "YTD template",
    file: "ytd_plan_template.csv",
    content: "region,phase,channel,buying_type,asset,unit_cost,quanity,start_date,end_date\nHCM,Awareness,Google,CPM,Search,120,500000,2026-01-01,2026-12-31\n",
  },
  {
    label: "MTD template",
    file: "mtd_plan_template.csv",
    content: "month,region,phase,channel,buying_type,asset,unit_cost,quanity,start_date,end_date\n2026-06,HCM,Awareness,Meta,CPC,3500,40000,2026-06-01,2026-06-30\n",
  },
  {
    label: "Google template",
    file: "google_raw_template.csv",
    content: "campaign,ad_group,keyword,impressions,clicks,cost\nBUV-Search-Brand,Brand-Core,buv,120000,4800,9600000\n",
  },
  {
    label: "Meta template",
    file: "meta_raw_template.csv",
    content: "campaign,ad_set,age,gender,region,impressions,reach,clicks\nBUV-Meta-Awareness,Broad-18-34,18-24,Nữ,HCM,300000,180000,21000\n",
  },
]

// Minimal CSV header + row parser for client-side validation.
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return { headers: [] as string[], rows: 0 }
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
  return { headers, rows: lines.length - 1 }
}

function download(file: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = file
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportCenter() {
  const [states, setStates] = useState<Record<SourceId, SourceState>>({
    planYTD: { status: "idle", message: "Chưa import" },
    planMTD: { status: "idle", message: "Chưa import" },
    google: { status: "idle", message: "Đang dùng demo data" },
    meta: { status: "idle", message: "Đang dùng demo data" },
  })
  const [log, setLog] = useState<LogEntry[]>([])
  const [sheetSource, setSheetSource] = useState<SourceDef | null>(null)
  const logId = useRef(0)

  const readyCount = useMemo(() => Object.values(states).filter((s) => s.status === "ok").length, [states])

  function addLog(source: string, ok: boolean, text: string) {
    logId.current += 1
    setLog((prev) => [
      { id: logId.current, source, ok, text, time: new Date().toLocaleTimeString("vi-VN") },
      ...prev,
    ].slice(0, 8))
  }

  async function handleFile(def: SourceDef, file: File) {
    const isCsv = /\.csv$/i.test(file.name)
    if (!isCsv) {
      // Excel workbooks are accepted in the demo but validated only by name.
      setStates((s) => ({ ...s, [def.id]: { status: "ok", message: `Đã nhận ${file.name}` } }))
      addLog(def.title, true, `Nhận workbook ${file.name} (${Math.round(file.size / 1024)} KB). Sẽ xử lý ở bản production.`)
      return
    }
    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    const missing = def.required.filter((c) => !headers.includes(c))

    if (rows === 0) {
      setStates((s) => ({ ...s, [def.id]: { status: "error", message: "File rỗng" } }))
      addLog(def.title, false, `${file.name}: không có dòng dữ liệu nào.`)
      return
    }
    if (missing.length > 0) {
      setStates((s) => ({ ...s, [def.id]: { status: "error", message: `Thiếu ${missing.length} cột` } }))
      addLog(def.title, false, `${file.name}: thiếu cột ${missing.join(", ")}.`)
      return
    }
    setStates((s) => ({ ...s, [def.id]: { status: "ok", message: `${rows} dòng hợp lệ`, rows } }))
    addLog(def.title, true, `${file.name}: ${rows} dòng, ${headers.length} cột — hợp lệ.`)
  }

  function reset() {
    setStates({
      planYTD: { status: "idle", message: "Chưa import" },
      planMTD: { status: "idle", message: "Chưa import" },
      google: { status: "idle", message: "Đang dùng demo data" },
      meta: { status: "idle", message: "Đang dùng demo data" },
    })
    setLog([])
  }

  function handleSheetImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!sheetSource) return
    const form = new FormData(e.currentTarget)
    const url = String(form.get("sheetUrl") ?? "").trim()
    const tab = String(form.get("sheetTab") ?? "").trim()
    const isSheet = /docs\.google\.com\/spreadsheets/.test(url)
    if (!isSheet) {
      setStates((s) => ({ ...s, [sheetSource.id]: { status: "error", message: "Link không hợp lệ" } }))
      addLog(sheetSource.title, false, "Link Google Sheets không hợp lệ.")
      setSheetSource(null)
      return
    }
    setStates((s) => ({ ...s, [sheetSource.id]: { status: "ok", message: "Đã kết nối Sheet" } }))
    addLog(sheetSource.title, true, `Đã kết nối Google Sheet${tab ? ` · tab "${tab}"` : ""}. Dữ liệu sẽ đồng bộ ở bản production.`)
    setSheetSource(null)
  }

  return (
    <>
      <div className="hero import-hero">
        <div>
          <span className="eyebrow">
            <DatabaseZap size={13} /> Data import center
          </span>
          <h2>Upload plan và raw data để cập nhật toàn bộ Rocket Performance.</h2>
          <p>Hỗ trợ CSV và Excel. Dữ liệu được xử lý ngay trong trình duyệt hiện tại; không upload lên server trong bản demo này.</p>
        </div>
        <div className="hero-badge">
          <b>{readyCount}/4</b>
          <span>Sources ready</span>
        </div>
      </div>

      <div className="import-grid">
        {SOURCES.map((def) => {
          const st = states[def.id]
          return (
            <article key={def.id} className="upload-card">
              <div className={`upload-icon ${def.iconClass ?? ""}`}>
                <def.Icon size={20} />
              </div>
              <div className="upload-body">
                <small>{def.kicker}</small>
                <h3>{def.title}</h3>
                <p>{def.desc}</p>
              </div>
              <div className="source-actions">
                <label className="upload-button">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFile(def, f)
                      e.target.value = ""
                    }}
                  />
                  Upload file
                </label>
                <button type="button" className="sheet-button" onClick={() => setSheetSource(def)}>
                  <Sheet size={15} /> Google Sheet
                </button>
              </div>
              <div className={`upload-status ${st.status}`}>{st.message}</div>
            </article>
          )
        })}
      </div>

      <div className="grid-2">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Import validation</small>
              <h3>Kết quả xử lý gần nhất</h3>
            </div>
            <button type="button" className="ghost-button" onClick={reset}>
              <Trash2 size={15} /> Reset imported data
            </button>
          </div>
          <div className="import-log">
            {log.length === 0 ? (
              <div className="empty-log">Chọn một file để bắt đầu.</div>
            ) : (
              log.map((l) => (
                <div key={l.id} className={`log-row ${l.ok ? "ok" : "error"}`}>
                  {l.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <div>
                    <b>
                      {l.source} · {l.time}
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
              <small>Supported format</small>
              <h3>Chuẩn cột dữ liệu</h3>
            </div>
          </div>
          <div className="format-list">
            {FORMATS.map((f) => (
              <div key={f.title}>
                <b>{f.title}</b>
                <code>{f.cols}</code>
              </div>
            ))}
          </div>
          <div className="template-links">
            {TEMPLATES.map((t) => (
              <button key={t.file} type="button" onClick={() => download(t.file, t.content)}>
                {t.label}
              </button>
            ))}
          </div>
        </article>
      </div>

      {sheetSource && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSheetSource(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <small>Google Sheets source</small>
                <h3>Import {sheetSource.title} từ Google Sheets</h3>
              </div>
              <button type="button" className="icon-btn" aria-label="Đóng" onClick={() => setSheetSource(null)}>
                <X size={16} />
              </button>
            </div>
            <form className="project-form" onSubmit={handleSheetImport}>
              <label className="full">
                <span>Google Sheets link *</span>
                <input name="sheetUrl" type="url" required placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
              </label>
              <label>
                <span>Tên tab</span>
                <input name="sheetTab" placeholder="VD: YTD Plan" />
              </label>
              <label>
                <span>Range (không bắt buộc)</span>
                <input name="sheetRange" placeholder="VD: A1:I500" />
              </label>
              <div className="full sheet-permission-note">
                <LockOpen size={18} />
                <div>
                  <b>Quyền truy cập</b>
                  <p>
                    Sheet cần để &quot;Anyone with the link – Viewer&quot; hoặc Publish to web. App chỉ đọc dữ liệu và lưu bản đã chuẩn hóa
                    theo project hiện tại.
                  </p>
                </div>
              </div>
              <div className="modal-actions full">
                <button type="button" className="ghost-button" onClick={() => setSheetSource(null)}>
                  Hủy
                </button>
                <button type="submit" className="primary-button">
                  <Download size={15} /> Import Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
