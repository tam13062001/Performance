"use client"

import { useMemo, useRef, useState } from "react"
import { Download, Eye, FileText, Printer, ImageUp, RotateCcw } from "lucide-react"
import type { Project } from "@/lib/projects"
import {
  type ClientTheme,
  type ThemePreset,
  CLIENT_PRESETS,
  DEFAULT_THEME,
  PLATFORM_COLORS,
  PRESETS,
  ROCKET_ACCENTS,
  STATUS_COLORS,
} from "@/lib/theme"
import {
  overviewKpis,
  overviewCampaignRows,
  businessBreakdown,
  executionRows,
  performanceScore,
  platformImpressions,
  mediaPlan,
  num,
  pct,
  vnd,
} from "@/lib/metrics"

type SectionId = "executive" | "business" | "google" | "meta" | "audience" | "plan"

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "executive", label: "Executive Overview" },
  { id: "business", label: "Business Breakdown" },
  { id: "google", label: "Google Ads" },
  { id: "meta", label: "Meta Ads" },
  { id: "audience", label: "Audience Overview" },
  { id: "plan", label: "Plan & KPI" },
]

const MONTHS = ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026"]

const verdictColor = (v: string) =>
  v === "Đạt" ? STATUS_COLORS.good : v === "Cảnh báo" ? STATUS_COLORS.watch : v === "Chưa đạt" ? STATUS_COLORS.under : STATUS_COLORS.none

export function ReportBuilder({
  project,
  onChange,
}: {
  project: Project
  onChange: (patch: Partial<ClientTheme>) => void
}) {
  const theme = project.theme
  // rocket-standard forces Rocket accents for client-facing series.
  const isRocket = theme.preset === "rocket-standard"
  const series = isRocket ? ROCKET_ACCENTS : { primary: theme.primary, secondary: theme.secondary, accent: theme.accent }
  const [title, setTitle] = useState(theme.reportTitle || "Campaign Performance Report")
  const [period, setPeriod] = useState<"MTD" | "YTD">("MTD")
  const [month, setMonth] = useState("Jun 2026")
  const [note, setNote] = useState("")
  const [spendSource, setSpendSource] = useState<"project" | "actual" | "plan">("project")
  const [footer, setFooter] = useState(theme.footerText || "Prepared by Rocket Performance")
  const [sections, setSections] = useState<Set<SectionId>>(
    new Set(["executive", "business", "google", "meta", "audience"]),
  )
  const [generated, setGenerated] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)

  const periodLabel = period === "YTD" ? "Jan–Jun 2026" : month
  const clientName = theme.clientName || project.client || project.name

  // Report content assembled from the active project's live metrics.
  const kpis = useMemo(() => overviewKpis("All"), [])
  const score = useMemo(() => performanceScore("All"), [])
  const platform = useMemo(() => platformImpressions(), [])
  const bizPhase = useMemo(() => businessBreakdown("phase", "All"), [])
  const googleRows = useMemo(() => executionRows("campaign", "Google"), [])
  const metaRows = useMemo(() => executionRows("campaign", "Meta"), [])
  const audienceRows = useMemo(() => businessBreakdown("audience", "All"), [])
  const overviewRows = useMemo(() => overviewCampaignRows("All"), [])

  const pageCount = Math.max(1, [...sections].length)

  // Spend basis: "project" follows the project's billing model, else forced actual/plan.
  const resolvedBasis =
    spendSource === "project" ? (project.billingModel === "transparent" ? "actual" : "plan") : spendSource
  const totalActual = useMemo(() => bizPhase.reduce((s, r) => s + r.spend, 0), [bizPhase])
  const totalPlan = useMemo(() => mediaPlan.reduce((s, p) => s + p.budget, 0), [])
  // Plan basis estimates spend from the unit-cost plan; scale actual delivery to the planned budget.
  const spendFactor = resolvedBasis === "plan" && totalActual > 0 ? totalPlan / totalActual : 1
  const basisLabel = resolvedBasis === "actual" ? "Actual spend (platform)" : "Estimated spend (unit-cost plan)"
  const spendHelp =
    project.billingModel === "transparent" ? "Project mặc định: Transparency" : "Project mặc định: Non-transparency"

  function toggleSection(id: SectionId) {
    setSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ logoUrl: String(reader.result) })
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  async function downloadPdf() {
    if (!docRef.current) return
    setDownloading(true)
    try {
      const mod = await import("html2pdf.js")
      const html2pdf = (mod as { default?: unknown }).default ?? mod
      await (html2pdf as () => any)()
        .set({
          margin: 0,
          filename: `${clientName.replace(/\s+/g, "-")}-report.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(docRef.current)
        .save()
    } finally {
      setDownloading(false)
    }
  }

  function applyClientPreset(p: (typeof CLIENT_PRESETS)[number]) {
    onChange({ primary: p.primary, secondary: p.secondary, accent: p.accent, preset: "client-branded", clientName: p.label })
  }

  function resetSkin() {
    onChange({ ...DEFAULT_THEME, clientName: project.client })
  }

  const brandStyle = {
    ["--rp-primary" as string]: series.primary,
    ["--rp-secondary" as string]: series.secondary,
    ["--rp-accent" as string]: series.accent,
  } as React.CSSProperties

  return (
    <div className="report-builder">
      <div className="hero report-hero">
        <div className="report-hero-copy">
          <div className="eyebrow">
            <FileText size={15} /> Client Report Builder
          </div>
          <h2 className="text-balance">Tạo report có skin riêng cho từng khách hàng và tải PDF ngay.</h2>
          <p className="text-pretty">
            Chọn kỳ báo cáo, nội dung, preset thương hiệu và footer. Client Skin (logo + màu) lưu theo project đang mở và chỉnh
            trực tiếp tại đây. Preview dựng từ dữ liệu thật của project.
          </p>
        </div>
        <div className="hero-badge">
          <b>{pageCount}</b>
          <span>Sections</span>
        </div>
      </div>

      <div className="report-builder-layout">
        {/* ---------- Config ---------- */}
        <aside className="card report-settings">
          <div className="head">
            <div>
              <small>Report configuration</small>
              <h2>Thiết lập report</h2>
            </div>
          </div>

          <div className="report-form">
            <label className="brand-field full">
              <span className="brand-label">Tiêu đề report</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <div className="brand-grid two">
              <label className="brand-field">
                <span className="brand-label">Plan view</span>
                <select value={period} onChange={(e) => setPeriod(e.target.value as "MTD" | "YTD")}>
                  <option value="MTD">MTD</option>
                  <option value="YTD">YTD</option>
                </select>
              </label>
              <label className="brand-field">
                <span className="brand-label">Tháng</span>
                <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={period === "YTD"}>
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="brand-field full">
              <span className="brand-label">Nguồn Spending khi xuất report</span>
              <select value={spendSource} onChange={(e) => setSpendSource(e.target.value as typeof spendSource)}>
                <option value="project">Theo thiết lập project</option>
                <option value="actual">Actual spend từ ad platform</option>
                <option value="plan">Estimated spend theo unit cost plan</option>
              </select>
              <span className="brand-hint">{spendHelp}</span>
            </label>

            <label className="brand-field full">
              <span className="brand-label">Reporting note</span>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Báo cáo cập nhật đến ngày 04/08/2026"
              />
            </label>

            <div className="brand-field full">
              <span className="brand-label">Nội dung report</span>
              <div className="section-checks">
                {SECTIONS.map((s) => (
                  <label key={s.id} className="check-row">
                    <input type="checkbox" checked={sections.has(s.id)} onChange={() => toggleSection(s.id)} />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="brand-field full">
              <span className="brand-label">Brand preset</span>
              <div className="preset-options">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`preset-option ${theme.preset === p.id ? "active" : ""}`}
                    onClick={() => onChange({ preset: p.id as ThemePreset })}
                  >
                    <strong>{p.label}</strong>
                    <small>{p.desc}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="brand-field full">
              <span className="brand-label">Quick client palette</span>
              <div className="client-chips">
                {CLIENT_PRESETS.map((p) => (
                  <button key={p.label} type="button" className="client-chip" onClick={() => applyClientPreset(p)}>
                    <span className="swatch" style={{ background: p.primary }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="brand-field full">
              <span className="brand-label">Client logo &amp; colors</span>
              <div className="logo-row">
                <div className="logo-preview">
                  {theme.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={theme.logoUrl || "/placeholder.svg"} alt="Client logo" />
                  ) : (
                    <span>No logo</span>
                  )}
                </div>
                <label className="sheet-button">
                  <ImageUp size={15} /> Upload logo
                  <input type="file" accept="image/*" onChange={onLogo} hidden />
                </label>
                {theme.logoUrl && (
                  <button type="button" className="ghost-button" onClick={() => onChange({ logoUrl: "" })}>
                    Xóa
                  </button>
                )}
              </div>
              <div className="brand-grid">
                {(["primary", "secondary", "accent"] as const).map((key) => (
                  <div key={key} className={`color-input ${isRocket ? "disabled" : ""}`}>
                    <input
                      type="color"
                      value={series[key]}
                      disabled={isRocket}
                      onChange={(e) => onChange({ [key]: e.target.value } as Partial<ClientTheme>)}
                      aria-label={key}
                    />
                    <input
                      type="text"
                      value={series[key].toUpperCase()}
                      disabled={isRocket}
                      spellCheck={false}
                      onChange={(e) => onChange({ [key]: e.target.value } as Partial<ClientTheme>)}
                    />
                  </div>
                ))}
              </div>
              {isRocket && <p className="brand-hint">Rocket Standard dùng màu Rocket. Chuyển sang Client Branded để chỉnh màu.</p>}
            </div>

            <label className="brand-field full">
              <span className="brand-label">Footer</span>
              <input type="text" value={footer} onChange={(e) => setFooter(e.target.value)} />
            </label>

            <div className="report-actions full">
              <button type="button" className="ghost-button" onClick={resetSkin}>
                <RotateCcw size={15} /> Reset skin
              </button>
              <button type="button" className="ghost-button" onClick={() => setGenerated(true)}>
                <Eye size={15} /> Generate preview
              </button>
              <button type="button" className="primary-button" onClick={downloadPdf} disabled={downloading}>
                <Download size={15} /> {downloading ? "Đang tạo PDF…" : "Download PDF"}
              </button>
            </div>
          </div>
        </aside>

        {/* ---------- Live preview ---------- */}
        <section className="report-preview-shell">
          <div className="preview-toolbar">
            <div>
              <b>Live preview</b>
              <span>PDF layout · A4 landscape</span>
            </div>
            <button type="button" className="ghost-button" onClick={() => window.print()}>
              <Printer size={15} /> Print fallback
            </button>
          </div>

          <div className="fixed-legend">
            <span className="brand-label">Màu trạng thái cố định — không theo client</span>
            <div className="legend-row">
              <span className="legend-dot">
                <i style={{ background: STATUS_COLORS.good }} /> Đạt
              </span>
              <span className="legend-dot">
                <i style={{ background: STATUS_COLORS.watch }} /> Cảnh báo
              </span>
              <span className="legend-dot">
                <i style={{ background: STATUS_COLORS.under }} /> Chưa đạt
              </span>
              <span className="legend-dot">
                <i style={{ background: STATUS_COLORS.none }} /> No data
              </span>
            </div>
          </div>

          {!generated ? (
            <div className="report-document report-empty">
              <FileText size={30} />
              <b>Chưa tạo preview</b>
              <span>Chọn cấu hình và bấm Generate preview.</span>
            </div>
          ) : (
            <div ref={docRef} className="report-document" style={brandStyle}>
              {/* Cover / header */}
              <header className="rp-header">
                <div className="rp-logo">
                  {theme.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={theme.logoUrl || "/placeholder.svg"} alt={`${clientName} logo`} />
                  ) : (
                    <span>{clientName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="rp-title">
                  <small>{clientName}</small>
                  <h1>{title}</h1>
                  <p>
                    {period} · {periodLabel}
                    {note ? ` · ${note}` : ""}
                  </p>
                </div>
                <div className="rp-score">
                  <b>{score}</b>
                  <span>Performance Index</span>
                </div>
              </header>

              {sections.has("executive") && (
                <section className="rp-section">
                  <h3 className="rp-h3">Executive Overview</h3>
                  <div className="rp-kpis">
                    {kpis.map((k) => (
                      <div key={k.label} className="rp-kpi">
                        <small>{k.label}</small>
                        <b>{k.value}</b>
                        <span>{k.sub}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rp-chart-row">
                    <div className="rp-chart-box">
                      <span className="rp-chart-title">Impression share theo kênh</span>
                      <Donut
                        slices={[
                          { label: "Google Ads", value: platform.google, color: PLATFORM_COLORS.Google },
                          { label: "Meta Ads", value: platform.meta, color: PLATFORM_COLORS.Meta },
                        ]}
                      />
                    </div>
                    <div className="rp-chart-box">
                      <span className="rp-chart-title">Impressions theo kênh</span>
                      <div className="rp-split">
                        <div className="rp-channel">
                          <span>Google Ads</span>
                          <div className="rp-bar-track">
                            <i style={{ width: `${(platform.google / platform.total) * 100}%`, background: PLATFORM_COLORS.Google }} />
                          </div>
                          <b>{num(platform.google)}</b>
                        </div>
                        <div className="rp-channel">
                          <span>Meta Ads</span>
                          <div className="rp-bar-track">
                            <i style={{ width: `${(platform.meta / platform.total) * 100}%`, background: PLATFORM_COLORS.Meta }} />
                          </div>
                          <b>{num(platform.meta)}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {sections.has("business") && (
                <section className="rp-section">
                  <h3 className="rp-h3">Business Breakdown · Phase</h3>
                  <p className="rp-basis">Spend basis: {basisLabel}</p>
                  <div className="rp-chart-box wide">
                    <span className="rp-chart-title">Impressions (cột) &amp; CTR (đường) theo Phase</span>
                    <ComboChart
                      data={bizPhase.map((r) => ({ label: r.label, bar: r.impressions, line: r.ctr }))}
                      barColor={series.primary}
                      lineColor={series.accent}
                      formatBar={num}
                    />
                  </div>
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Campaigns</th>
                        <th>Impressions</th>
                        <th>Clicks</th>
                        <th>CTR</th>
                        <th>Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bizPhase.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}</td>
                          <td>{r.campaigns}</td>
                          <td>{num(r.impressions)}</td>
                          <td>{num(r.clicks)}</td>
                          <td>{pct(r.ctr)}</td>
                          <td>{vnd(Math.round(r.spend * spendFactor))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {sections.has("google") && (
                <section className="rp-section">
                  <h3 className="rp-h3">Google Ads · Campaigns</h3>
                  <div className="rp-chart-box wide">
                    <span className="rp-chart-title">CTR theo campaign (top 6)</span>
                    <HBars
                      data={googleRows.slice(0, 6).map((r) => ({ label: r.name, value: r.ctr, color: PLATFORM_COLORS.Google }))}
                      format={pct}
                    />
                  </div>
                  <ReportExecTable rows={googleRows.slice(0, 6)} />
                </section>
              )}

              {sections.has("meta") && (
                <section className="rp-section">
                  <h3 className="rp-h3">Meta Ads · Campaigns</h3>
                  <div className="rp-chart-box wide">
                    <span className="rp-chart-title">CTR theo campaign (top 6)</span>
                    <HBars
                      data={metaRows.slice(0, 6).map((r) => ({ label: r.name, value: r.ctr, color: PLATFORM_COLORS.Meta }))}
                      format={pct}
                    />
                  </div>
                  <ReportExecTable rows={metaRows.slice(0, 6)} />
                </section>
              )}

              {sections.has("audience") && (
                <section className="rp-section">
                  <h3 className="rp-h3">Audience Overview</h3>
                  <div className="rp-chart-box wide">
                    <span className="rp-chart-title">Impressions (cột) &amp; CTR (đường) theo Segment</span>
                    <ComboChart
                      data={audienceRows.map((r) => ({ label: r.label, bar: r.impressions, line: r.ctr }))}
                      barColor={series.secondary}
                      lineColor={series.accent}
                      formatBar={num}
                    />
                  </div>
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th>Segment</th>
                        <th>Impressions</th>
                        <th>Reach</th>
                        <th>Clicks</th>
                        <th>CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audienceRows.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}</td>
                          <td>{num(r.impressions)}</td>
                          <td>{num(r.reach)}</td>
                          <td>{num(r.clicks)}</td>
                          <td>{pct(r.ctr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {sections.has("plan") && (
                <section className="rp-section">
                  <h3 className="rp-h3">Plan &amp; KPI</h3>
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th>Platform</th>
                        <th>Phase</th>
                        <th>Channel</th>
                        <th>CTR KPI</th>
                        <th>Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediaPlan.map((p, i) => (
                        <tr key={i}>
                          <td>{p.platform}</td>
                          <td>{p.phase}</td>
                          <td>{p.channel}</td>
                          <td>{pct(p.ctrKpi)}</td>
                          <td>{vnd(p.budget)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <footer className="rp-footer">
                <span>{footer}</span>
                <span>{overviewRows.length} campaigns · {clientName}</span>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ReportExecTable({
  rows,
}: {
  rows: { id: string; name: string; phase: string; impressions: number; reach: number; ctr: number; verdict: string }[]
}) {
  return (
    <table className="rp-table">
      <thead>
        <tr>
          <th>Campaign</th>
          <th>Phase</th>
          <th>Impressions</th>
          <th>Reach</th>
          <th>CTR</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="rp-name">{r.name}</td>
            <td>{r.phase}</td>
            <td>{num(r.impressions)}</td>
            <td>{num(r.reach)}</td>
            <td>{pct(r.ctr)}</td>
            <td>
              <span className="rp-status" style={{ background: `${verdictColor(r.verdict)}22`, color: verdictColor(r.verdict) }}>
                {r.verdict}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------- Inline SVG charts (capture cleanly into PDF) ---------- */

function Donut({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1
  const r = 52
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="rp-donut">
      <svg viewBox="0 0 140 140" width="120" height="120" role="img" aria-label="Channel split">
        <g transform="rotate(-90 70 70)">
          {slices.map((d) => {
            const len = (d.value / total) * c
            const seg = (
              <circle
                key={d.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="18"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return seg
          })}
        </g>
      </svg>
      <ul className="rp-legend">
        {slices.map((d) => (
          <li key={d.label}>
            <i style={{ background: d.color }} />
            {d.label} · {Math.round((d.value / total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  )
}

function ComboChart({
  data,
  barColor,
  lineColor,
  formatBar,
}: {
  data: { label: string; bar: number; line: number }[]
  barColor: string
  lineColor: string
  formatBar: (n: number) => string
}) {
  const W = 520
  const H = 200
  const padL = 48
  const padR = 44
  const padT = 16
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const barMax = Math.max(...data.map((d) => d.bar), 1)
  const lineMax = Math.max(...data.map((d) => d.line), 0.01)
  const n = data.length
  const slot = plotW / n
  const barW = Math.min(slot * 0.5, 42)

  const x = (i: number) => padL + slot * i + slot / 2
  const yBar = (v: number) => padT + plotH - (v / barMax) * plotH
  const yLine = (v: number) => padT + plotH - (v / lineMax) * plotH

  const linePoints = data.map((d, i) => `${x(i)},${yLine(d.line)}`).join(" ")
  const grid = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="rp-combo">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Impressions and CTR by group" preserveAspectRatio="xMidYMid meet">
        {grid.map((g) => {
          const gy = padT + plotH - g * plotH
          return (
            <g key={g}>
              <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="#eef0f4" strokeWidth="1" />
              <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="8" fill="#8b90a0">
                {formatBar(Math.round(barMax * g))}
              </text>
              <text x={W - padR + 6} y={gy + 3} textAnchor="start" fontSize="8" fill={lineColor}>
                {(lineMax * g).toFixed(1)}%
              </text>
            </g>
          )
        })}
        {data.map((d, i) => (
          <rect
            key={d.label}
            x={x(i) - barW / 2}
            y={yBar(d.bar)}
            width={barW}
            height={padT + plotH - yBar(d.bar)}
            rx="3"
            fill={barColor}
            opacity="0.85"
          />
        ))}
        <polyline points={linePoints} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={`p-${d.label}`}>
            <circle cx={x(i)} cy={yLine(d.line)} r="3.5" fill="#fff" stroke={lineColor} strokeWidth="2" />
            <text x={x(i)} y={yLine(d.line) - 8} textAnchor="middle" fontSize="8" fontWeight="700" fill={lineColor}>
              {d.line.toFixed(2)}%
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={`l-${d.label}`} x={x(i)} y={H - 12} textAnchor="middle" fontSize="8.5" fill="#6b7280">
            {d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label}
          </text>
        ))}
      </svg>
      <div className="rp-combo-legend">
        <span>
          <i style={{ background: barColor }} /> Impressions
        </span>
        <span>
          <i className="line" style={{ background: lineColor }} /> CTR (%)
        </span>
      </div>
    </div>
  )
}

function HBars({ data, format }: { data: { label: string; value: number; color: string }[]; format: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="rp-hbars">
      {data.map((d) => (
        <div key={d.label} className="rp-hbar">
          <span className="rp-hbar-label">{d.label}</span>
          <div className="rp-hbar-track">
            <i style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
          <b className="rp-hbar-val">{format(d.value)}</b>
        </div>
      ))}
    </div>
  )
}
