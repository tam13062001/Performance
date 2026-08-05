"use client"

import { useEffect, useState } from "react"
import { Calendar, Info, Moon, Search, Share2, Sparkles, Sun } from "lucide-react"
import { Sidebar, navMeta, type PageId } from "./sidebar"
import { ImportCenter } from "./import-center"
import { ProjectsPage } from "./projects-page"
import { ReportBuilder } from "./report-builder"
import { useProjects } from "@/lib/projects"
import { applyProjectTheme, ClientThemeContext } from "@/lib/theme"
import { KpiCards } from "./kpi-card"
import { ChartInsights } from "./chart-insights"
import {
  ChannelDoughnut,
  CreativeChart,
  ImpressionsReachCtrChart,
  RateLineChart,
  VolumeBarChart,
  VolumeEfficiencyChart,
} from "./charts"
import {
  adRows,
  audienceContribution,
  audienceKpis,
  audienceRows,
  businessBreakdown,
  creativeSummary,
  creativeTypeBreakdown,
  executionRows,
  keywordRows,
  monthlyTrend,
  num,
  overviewCampaignRows,
  overviewKpis,
  overviewSignals,
  pct,
  performanceScore,
  platformImpressions,
  freqFmt,
  freqOf,
  taxonomyRows,
  vnd,
  type PlatformFilter,
  type Verdict,
} from "@/lib/metrics"
import { audience } from "@/lib/data"
import { mediaPlan, type Dimension } from "@/lib/taxonomy"

function VerdictChip({ v }: { v: Verdict }) {
  const cls = v === "Đạt" ? "good" : v === "Cảnh báo" ? "warn" : v === "Chưa đạt" ? "bad" : "neutral"
  return <span className={`pill ${cls}`}>{v}</span>
}

function PlatformChip({ p }: { p: string }) {
  return <span className={`pill ${p === "Google" ? "good" : "warn"}`}>{p}</span>
}

function shortName(name: string) {
  const parts = name.split("|")
  return parts.length === 7 ? parts.slice(0, 4).join(" · ") : name
}

/* ---------------- Monthly trend (YTD view) ---------------- */

// Combined volume (impressions bars) + efficiency (CTR & Frequency lines) by
// month. Shown when the YTD plan view is active so numbers spread across months.
function MonthlyTrendCard({ filter, scope }: { filter: PlatformFilter; scope: string }) {
  const series = monthlyTrend(filter)
  return (
    <article className="card">
      <div className="card-head">
        <div>
          <small>Xu hướng theo tháng · YTD</small>
          <h3>Volume &amp; efficiency theo tháng</h3>
        </div>
        <span className="chip-config">{scope} · Combo 3 trục</span>
      </div>
      <div className="chart-wrap large">
        <VolumeEfficiencyChart
          labels={series.map((m) => m.month)}
          impressions={series.map((m) => m.impressions)}
          ctr={series.map((m) => Number(m.ctr.toFixed(2)))}
          frequency={series.map((m) => Number(m.frequency.toFixed(2)))}
        />
      </div>
      <ChartInsights
        spec={{
          title: "Volume & efficiency theo tháng",
          subject: `xu hướng theo tháng · ${scope}`,
          labels: series.map((m) => m.month),
          volume: series.map((m) => m.impressions),
          volumeLabel: "Impressions",
          ctr: series.map((m) => Number(m.ctr.toFixed(2))),
          frequency: series.map((m) => Number(m.frequency.toFixed(2))),
          spend: series.map((m) => m.spend),
        }}
      />
    </article>
  )
}

/* ---------------- Campaign Overview (cross-channel) ---------------- */

function OverviewPage({ planView }: { planView: "MTD" | "YTD" }) {
  const filter: PlatformFilter = "All"
  const kpis = overviewKpis(filter)
  const signals = overviewSignals(filter)
  const rows = overviewCampaignRows(filter)
  const biz = businessBreakdown("phase", filter)
  const split = platformImpressions()
  const score = performanceScore(filter)

  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} /> Campaign control center
          </span>
          <h2>Một góc nhìn thống nhất để theo dõi toàn bộ campaign trước khi đi sâu vào từng kênh.</h2>
          <p>Overview tập trung vào plan, delivery, business dimensions và cảnh báo; Google và Meta có dashboard độc lập bên dưới.</p>
        </div>
        <div className="hero-badge">
          <b>{score}</b>
          <span>Performance Score</span>
        </div>
      </div>

      <KpiCards cards={kpis} />

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Volume delivery</small>
              <h3>Impressions theo Phase</h3>
            </div>
            <span className="chip-config">Bar chart</span>
          </div>
          <div className="chart-wrap">
            <VolumeBarChart labels={biz.map((b) => b.label)} impressions={biz.map((b) => b.impressions)} reach={biz.map((b) => b.reach)} />
          </div>
          <ChartInsights
            spec={{
              title: "Impressions theo Phase",
              subject: "volume delivery theo phase",
              labels: biz.map((b) => b.label),
              volume: biz.map((b) => b.impressions),
              volumeLabel: "Impressions",
            }}
          />
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <small>Efficiency trend</small>
              <h3>CTR &amp; Frequency theo Phase</h3>
            </div>
            <span className="chip-config">Dual axis</span>
          </div>
          <div className="chart-wrap">
            <RateLineChart
              labels={biz.map((b) => b.label)}
              ctr={biz.map((b) => Number(b.ctr.toFixed(2)))}
              frequency={biz.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2)))}
            />
          </div>
          <ChartInsights
            spec={{
              title: "CTR & Frequency theo Phase",
              subject: "hiệu suất theo phase",
              labels: biz.map((b) => b.label),
              ctr: biz.map((b) => Number(b.ctr.toFixed(2))),
              frequency: biz.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2))),
            }}
          />
        </article>
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Volume &amp; efficiency</small>
            <h3>Impressions, CTR &amp; Frequency theo Phase</h3>
          </div>
          <span className="chip-config">Combo · 3 trục</span>
        </div>
        <div className="chart-wrap large">
          <VolumeEfficiencyChart
            labels={biz.map((b) => b.label)}
            impressions={biz.map((b) => b.impressions)}
            ctr={biz.map((b) => Number(b.ctr.toFixed(2)))}
            frequency={biz.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2)))}
          />
        </div>
        <ChartInsights
          spec={{
            title: "Impressions, CTR & Frequency theo Phase",
            subject: "volume và hiệu suất theo phase",
            labels: biz.map((b) => b.label),
            volume: biz.map((b) => b.impressions),
            volumeLabel: "Impressions",
            ctr: biz.map((b) => Number(b.ctr.toFixed(2))),
            frequency: biz.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2))),
          }}
        />
      </article>

      {planView === "YTD" && <MonthlyTrendCard filter="All" scope="Google + Meta" />}

      <div className="grid-2">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Channel contribution</small>
              <h3>Impressions theo nền tảng</h3>
            </div>
          </div>
          <div className="chart-wrap">
            <ChannelDoughnut google={split.google} meta={split.meta} />
          </div>
          <ChartInsights
            spec={{
              title: "Impressions theo nền tảng",
              subject: "phân bổ impressions theo kênh",
              labels: ["Google Ads", "Meta Ads"],
              volume: [split.google, split.meta],
              volumeLabel: "Impressions",
            }}
          />
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <small>Performance signals</small>
              <h3>Cảnh báo chính</h3>
            </div>
          </div>
          <div className="alerts">
            {signals.map((s, i) => (
              <div key={i} className={`alert ${s.tone}`}>
                <span className="alert-dot" />
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Campaign delivery</small>
            <h3>Toàn bộ campaign</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Platform</th>
                <th>Phase</th>
                <th>Location</th>
                <th>Buying type</th>
                <th className="right">Impressions</th>
                <th className="right">Reach</th>
                <th className="right">CTR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{shortName(r.name)}</td>
                  <td>
                    <PlatformChip p={r.platform} />
                  </td>
                  <td>{r.phase}</td>
                  <td>{r.location}</td>
                  <td>{r.buyingType}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td>
                    <VerdictChip v={r.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

/* ---------------- Business Breakdown (cross-channel) ---------------- */

const bizTabs: { id: Dimension; label: string }[] = [
  { id: "phase", label: "Phase" },
  { id: "objective", label: "Objective" },
  { id: "location", label: "Location" },
  { id: "audience", label: "Audience" },
  { id: "buyingType", label: "Buying Type" },
]

function BusinessPage({ planView }: { planView: "MTD" | "YTD" }) {
  const [dim, setDim] = useState<Dimension>("phase")
  const rows = businessBreakdown(dim, "All")
  const label = bizTabs.find((t) => t.id === dim)?.label

  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          {bizTabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${dim === t.id ? "active" : ""}`} onClick={() => setDim(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Volume</small>
              <h3>Impressions theo {label}</h3>
            </div>
          </div>
          <div className="chart-wrap large">
            <VolumeBarChart labels={rows.map((r) => r.label)} impressions={rows.map((r) => r.impressions)} reach={rows.map((r) => r.reach)} />
          </div>
          <ChartInsights
            spec={{
              title: `Impressions theo ${label}`,
              subject: `volume theo ${label?.toLowerCase()}`,
              labels: rows.map((r) => r.label),
              volume: rows.map((r) => r.impressions),
              volumeLabel: "Impressions",
            }}
          />
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <small>Rate</small>
              <h3>CTR theo {label}</h3>
            </div>
          </div>
          <div className="chart-wrap large">
            <RateLineChart labels={rows.map((r) => r.label)} ctr={rows.map((r) => Number(r.ctr.toFixed(2)))} />
          </div>
          <ChartInsights
            spec={{
              title: `CTR theo ${label}`,
              subject: `hiệu suất CTR theo ${label?.toLowerCase()}`,
              labels: rows.map((r) => r.label),
              ctr: rows.map((r) => Number(r.ctr.toFixed(2))),
            }}
          />
        </article>
      </div>

      {planView === "YTD" && <MonthlyTrendCard filter="All" scope="Google + Meta" />}

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                <th className="right">Campaigns</th>
                <th className="right">Impressions</th>
                <th className="right">Reach*</th>
                <th className="right">Clicks</th>
                <th className="right">CTR</th>
                <th className="right">Spend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="right">{r.campaigns}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{vnd(r.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

/* ---------------- Audience (cross-channel) ---------------- */

const audTabs = [
  { id: "age", label: "Age" },
  { id: "gender", label: "Gender" },
  { id: "region", label: "Location" },
] as const

const audPlatforms: { id: PlatformFilter; label: string }[] = [
  { id: "All", label: "All Channels" },
  { id: "Google", label: "Google Ads" },
  { id: "Meta", label: "Meta Ads" },
]

function AudiencePage({ planView }: { planView: "MTD" | "YTD" }) {
  const [tab, setTab] = useState<"age" | "gender" | "region">("age")
  const [platform, setPlatform] = useState<PlatformFilter>("All")

  const segs = audience[tab]
  const rows = audienceRows(segs, platform)
  const kpis = audienceKpis(segs, platform)
  const contribution = audienceContribution(segs)
  const showBreakdown = platform === "All"
  const dimLabel = audTabs.find((t) => t.id === tab)?.label ?? ""

  return (
    <>
      <div className="page-toolbar audience-toolbar">
        <div className="platform-filter">
          {audPlatforms.map((p) => (
            <button key={p.id} type="button" className={platform === p.id ? "active" : ""} onClick={() => setPlatform(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="tabs">
          {audTabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="notice">
        <Info size={18} />
        <div>
          <b>
            {platform === "All"
              ? `Đang tổng hợp ${dimLabel} trên cả Google Ads và Meta Ads.`
              : `Đang lọc ${dimLabel} theo ${platform === "Google" ? "Google Ads" : "Meta Ads"}.`}
          </b>
          <p>
            {showBreakdown
              ? "Bảng chi tiết hiển thị breakdown từng kênh cạnh nhau. Chuyển tab kênh để xem riêng Google hoặc Meta."
              : "Chuyển về “All Channels” để so sánh đóng góp giữa hai kênh trong cùng một segment."}
          </p>
        </div>
      </div>

      <KpiCards cards={kpis} />

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Volume breakdown</small>
              <h3>Impressions &amp; Reach theo {dimLabel}</h3>
            </div>
            <span className="chip-config">{platform === "All" ? "Google + Meta" : platform}</span>
          </div>
          <div className="chart-wrap large">
            <VolumeBarChart labels={rows.map((r) => r.label)} impressions={rows.map((r) => r.impressions)} reach={rows.map((r) => r.reach)} />
          </div>
          <ChartInsights
            spec={{
              title: `Impressions & Reach theo ${dimLabel}`,
              subject: `phân bổ audience theo ${dimLabel.toLowerCase()} (${platform === "All" ? "Google + Meta" : platform})`,
              labels: rows.map((r) => r.label),
              volume: rows.map((r) => r.impressions),
              volumeLabel: "Impressions",
            }}
          />
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <small>Rate breakdown</small>
              <h3>CTR theo {dimLabel}</h3>
            </div>
          </div>
          <div className="chart-wrap large">
            <RateLineChart labels={rows.map((r) => r.label)} ctr={rows.map((r) => Number(r.ctr.toFixed(2)))} />
          </div>
          <ChartInsights
            spec={{
              title: `CTR theo ${dimLabel}`,
              subject: `hiệu suất CTR theo ${dimLabel.toLowerCase()}`,
              labels: rows.map((r) => r.label),
              ctr: rows.map((r) => Number(r.ctr.toFixed(2))),
            }}
          />
        </article>
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Channel contribution</small>
            <h3>Tỷ trọng impressions theo kênh</h3>
          </div>
        </div>
        <div className="chart-wrap">
          <ChannelDoughnut google={contribution.google} meta={contribution.meta} />
        </div>
        <ChartInsights
          spec={{
            title: "Tỷ trọng impressions theo kênh",
            subject: "đóng góp impressions của từng kênh",
            labels: ["Google Ads", "Meta Ads"],
            volume: [contribution.google, contribution.meta],
            volumeLabel: "Impressions",
          }}
        />
      </article>

      {planView === "YTD" && (
        <MonthlyTrendCard filter={platform} scope={platform === "All" ? "Google + Meta" : platform} />
      )}

      <article className="card">
        <div className="card-head">
          <div>
            <small>Audience detail</small>
            <h3>{showBreakdown ? "Audience tổng hợp đa kênh" : `Audience · ${platform}`}</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              {showBreakdown ? (
                <>
                  <tr>
                    <th rowSpan={2}>Segment</th>
                    <th colSpan={3} className="group-head">Google Ads</th>
                    <th colSpan={3} className="group-head">Meta Ads</th>
                    <th colSpan={2} className="group-head">Tổng hợp</th>
                  </tr>
                  <tr>
                    <th className="right">Impr.</th>
                    <th className="right">CTR</th>
                    <th className="right">Freq.</th>
                    <th className="right">Impr.</th>
                    <th className="right">CTR</th>
                    <th className="right">Freq.</th>
                    <th className="right">Impr.</th>
                    <th className="right">CTR</th>
                  </tr>
                </>
              ) : (
                <tr>
                  <th>Segment</th>
                  <th className="right">Impressions</th>
                  <th className="right">Reach</th>
                  <th className="right">Clicks</th>
                  <th className="right">CTR</th>
                  <th className="right">Frequency</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((r) =>
                showBreakdown ? (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="right">{num(r.google.impressions)}</td>
                    <td className="right">{pct(r.google.ctr)}</td>
                    <td className="right">{freqFmt(r.google.frequency)}</td>
                    <td className="right">{num(r.meta.impressions)}</td>
                    <td className="right">{pct(r.meta.ctr)}</td>
                    <td className="right">{freqFmt(r.meta.frequency)}</td>
                    <td className="right">{num(r.impressions)}</td>
                    <td className="right">{pct(r.ctr)}</td>
                  </tr>
                ) : (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="right">{num(r.impressions)}</td>
                    <td className="right">{num(r.reach)}</td>
                    <td className="right">{num(r.clicks)}</td>
                    <td className="right">{pct(r.ctr)}</td>
                    <td className="right">{freqFmt(r.frequency)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

/* ---------------- Channel dashboards (Google / Meta) ---------------- */

function ExecutionSection({ platform, level }: { platform: PlatformFilter; level: "campaign" | "adgroup" }) {
  const rows = executionRows(level, platform)
  const showReach = platform === "Meta"
  const nameOf = (r: (typeof rows)[number]) => (level === "campaign" ? shortName(r.name) : r.name)

  return (
    <>
      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head">
            <div>
              <small>Delivery volume</small>
              <h3>Impressions{showReach ? " & Reach" : ""}</h3>
            </div>
          </div>
          <div className="chart-wrap large">
            <VolumeBarChart
              labels={rows.map(nameOf)}
              impressions={rows.map((r) => r.impressions)}
              reach={showReach ? rows.map((r) => r.reach) : undefined}
            />
          </div>
          <ChartInsights
            spec={{
              title: `Impressions${showReach ? " & Reach" : ""} · ${platform}`,
              subject: `volume theo ${level === "campaign" ? "campaign" : "ad group"} trên ${platform}`,
              labels: rows.map(nameOf),
              volume: rows.map((r) => r.impressions),
              volumeLabel: "Impressions",
            }}
          />
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <small>Efficiency</small>
              <h3>{showReach ? "CTR / ER" : "CTR"}</h3>
            </div>
          </div>
          <div className="chart-wrap large">
            <RateLineChart labels={rows.map(nameOf)} ctr={rows.map((r) => Number(r.ctr.toFixed(2)))} />
          </div>
          <ChartInsights
            spec={{
              title: `CTR · ${platform}`,
              subject: `hiệu suất CTR theo ${level === "campaign" ? "campaign" : "ad group"} trên ${platform}`,
              labels: rows.map(nameOf),
              ctr: rows.map((r) => Number(r.ctr.toFixed(2))),
            }}
          />
        </article>
      </div>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Phase</th>
                <th className="right">Impressions</th>
                <th className="right">Reach</th>
                <th className="right">CTR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={level === "campaign" ? "mono" : ""}>{nameOf(r)}</td>
                  <td>{r.phase}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td>
                    <VerdictChip v={r.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

function ChannelAudienceSection({ platform }: { platform: PlatformFilter }) {
  const [tab, setTab] = useState<"age" | "gender" | "region">("age")
  const rows = audienceRows(audience[tab], platform)
  const dimLabel = audTabs.find((t) => t.id === tab)?.label ?? ""

  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          {audTabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Audience</small>
            <h3>Impressions &amp; CTR theo {dimLabel}</h3>
          </div>
        </div>
        <div className="chart-wrap large">
          <ImpressionsReachCtrChart
            labels={rows.map((r) => r.label)}
            impressions={rows.map((r) => r.impressions)}
            reach={rows.map((r) => r.reach)}
            ctr={rows.map((r) => Number(r.ctr.toFixed(2)))}
          />
        </div>
        <ChartInsights
          spec={{
            title: `Impressions & CTR theo ${dimLabel}`,
            subject: `audience theo ${dimLabel.toLowerCase()} trên ${platform === "All" ? "Google + Meta" : platform}`,
            labels: rows.map((r) => r.label),
            volume: rows.map((r) => r.impressions),
            volumeLabel: "Impressions",
            ctr: rows.map((r) => Number(r.ctr.toFixed(2))),
          }}
        />
      </article>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Segment</th>
                <th className="right">Impressions</th>
                <th className="right">Reach</th>
                <th className="right">Clicks</th>
                <th className="right">CTR</th>
                <th className="right">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{freqFmt(r.frequency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

function KeywordsSection() {
  const rows = keywordRows()
  return (
    <>
      <article className="card">
        <div className="card-head">
          <div>
            <small>Search terms</small>
            <h3>Impressions &amp; CTR theo Keyword</h3>
          </div>
          <span className="chip-config">Combo · 2 trục</span>
        </div>
        <div className="chart-wrap large">
          <VolumeEfficiencyChart
            labels={rows.map((r) => r.keyword)}
            impressions={rows.map((r) => r.impressions)}
            ctr={rows.map((r) => Number(r.ctr.toFixed(2)))}
          />
        </div>
        <ChartInsights
          spec={{
            title: "Impressions theo Keyword",
            subject: "volume search term theo keyword",
            labels: rows.map((r) => r.keyword),
            volume: rows.map((r) => r.impressions),
            volumeLabel: "Impressions",
            ctr: rows.map((r) => Number(r.ctr.toFixed(2))),
          }}
        />
      </article>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Match</th>
                <th>Campaign</th>
                <th className="right">Impressions</th>
                <th className="right">CTR</th>
                <th className="right">CPC</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.keyword}</td>
                  <td>
                    <span className="pill neutral">{r.matchType}</span>
                  </td>
                  <td className="mono">{shortName(r.campaign)}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{vnd(r.cpc)}</td>
                  <td>
                    <VerdictChip v={r.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

function CreativeSection() {
  const summary = creativeSummary()
  const types = creativeTypeBreakdown()
  const rows = adRows()

  return (
    <>
      <div className="mini-grid">
        {summary.map((s) => (
          <div key={s.label} className="mini-card">
            <small>{s.label}</small>
            <strong>{s.value}</strong>
            <span>{s.sub}</span>
          </div>
        ))}
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Creative type</small>
            <h3>CTR theo Image / Video / Carousel</h3>
          </div>
        </div>
        <div className="chart-wrap large">
          <CreativeChart labels={types.map((t) => t.label)} ctr={types.map((t) => Number(t.ctr.toFixed(2)))} />
        </div>
        <ChartInsights
          spec={{
            title: "CTR theo Image / Video / Carousel",
            subject: "hiệu suất CTR theo định dạng creative",
            labels: types.map((t) => t.label),
            ctr: types.map((t) => Number(t.ctr.toFixed(2))),
          }}
        />
      </article>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ad name</th>
                <th>Creative type</th>
                <th>Audience</th>
                <th className="right">Impressions</th>
                <th className="right">Reach</th>
                <th className="right">CTR</th>
                <th className="right">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <span className="pill neutral">{r.creativeType}</span>
                  </td>
                  <td>{r.audience}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{freqFmt(r.frequency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

type GoogleLevel = "campaign" | "adgroup" | "audience" | "keywords"
type MetaLevel = "campaign" | "adgroup" | "audience" | "creative"

function ChannelDashboard({ platform, planView }: { platform: "Google" | "Meta"; planView: "MTD" | "YTD" }) {
  const isGoogle = platform === "Google"
  const levels: { id: string; label: string }[] = isGoogle
    ? [
        { id: "campaign", label: "Campaign" },
        { id: "adgroup", label: "Ad Group" },
        { id: "audience", label: "Audience" },
        { id: "keywords", label: "Keywords" },
      ]
    : [
        { id: "campaign", label: "Campaign" },
        { id: "adgroup", label: "Ad Set" },
        { id: "audience", label: "Audience" },
        { id: "creative", label: "Creative" },
      ]
  const [level, setLevel] = useState<string>("campaign")
  const kpis = overviewKpis(platform)

  return (
    <>
      <div className={`channel-banner ${isGoogle ? "google" : "meta"}`}>
        <div>
          <span>Channel dashboard</span>
          <h2>{isGoogle ? "Google Ads Search" : "Meta Ads"}</h2>
          <p>{isGoogle ? "Campaign, Ad Group, Audience và Keyword Performance." : "Campaign, Ad Set, Audience và Creative Intelligence."}</p>
        </div>
        {isGoogle ? <Search size={40} /> : <Share2 size={40} />}
      </div>

      <KpiCards cards={kpis} />

      {planView === "YTD" && <MonthlyTrendCard filter={platform} scope={platform} />}

      <div className="page-toolbar">
        <div className="tabs">
          {levels.map((l) => (
            <button key={l.id} type="button" className={`tab ${level === l.id ? "active" : ""}`} onClick={() => setLevel(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {(level === "campaign" || level === "adgroup") && (
        <ExecutionSection platform={platform} level={level as "campaign" | "adgroup"} />
      )}
      {level === "audience" && <ChannelAudienceSection platform={platform} />}
      {isGoogle && level === "keywords" && <KeywordsSection />}
      {!isGoogle && level === "creative" && <CreativeSection />}
    </>
  )
}

/* ---------------- Taxonomy & Plan ---------------- */

function TaxonomyPage() {
  const tax = taxonomyRows()
  return (
    <>
      <div className="notice">
        <Info size={20} />
        <div>
          <b>Campaign naming dùng để tự động phân loại.</b>
          <p>Mapping vẫn có thể override bằng config hoặc bảng mapping khi triển khai production.</p>
        </div>
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Mapping diagnostics</small>
            <h3>Google + Meta Taxonomy</h3>
          </div>
          <span className="chip-config">config/taxonomy.js</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Platform</th>
                <th>Phase</th>
                <th>Objective</th>
                <th>Location</th>
                <th>Audience</th>
                <th>Creative type</th>
                <th>Buying type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tax.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.name}</td>
                  <td>{t.platform}</td>
                  <td>{t.phase}</td>
                  <td>{t.objective}</td>
                  <td>{t.location}</td>
                  <td>{t.audience}</td>
                  <td>{t.creativeType}</td>
                  <td>{t.buyingType}</td>
                  <td>
                    <span className={`pill ${t.status === "mapped" ? "good" : "bad"}`}>
                      {t.status === "mapped" ? "Mapped" : "Unmapped"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Media plan</small>
            <h3>Plan &amp; KPI Mapping</h3>
          </div>
          <span className="chip-config">config/plan.js</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Phase</th>
                <th>Channel</th>
                <th>Buying type</th>
                <th className="right">CTR KPI</th>
                <th className="right">Unit cost</th>
                <th className="right">Quantity</th>
                <th className="right">Budget</th>
              </tr>
            </thead>
            <tbody>
              {mediaPlan.map((p, i) => (
                <tr key={i}>
                  <td>{p.platform}</td>
                  <td>{p.phase}</td>
                  <td>{p.channel}</td>
                  <td>{p.buyingType}</td>
                  <td className="right">{p.ctrKpi}%</td>
                  <td className="right">{vnd(p.unitCostKpi)}</td>
                  <td className="right">{num(p.quantityKpi)}</td>
                  <td className="right">{vnd(p.budget)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  )
}

/* ---------------- Shell ---------------- */

const MONTHS = ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026"]

export function Dashboard() {
  const [page, setPage] = useState<PageId>("overview")
  const [planView, setPlanView] = useState<"MTD" | "YTD">("MTD")
  const [month, setMonth] = useState("Jun 2026")
  const [uiTheme, setUiTheme] = useState<"dark" | "light">("dark")
  const { projects, activeProject, activeId, setActiveId, addProject, removeProject, updateTheme } = useProjects()
  const meta = navMeta(page)
  const periodLabel = planView === "YTD" ? "Jan–Jun 2026" : month
  const theme = activeProject.theme

  // Restore the saved UI skin (dark/light) once on mount.
  useEffect(() => {
    const saved = localStorage.getItem("rocket-ui-theme")
    if (saved === "light" || saved === "dark") setUiTheme(saved)
  }, [])

  // Reflect the UI skin onto <html> and persist it. Chart.js reads CSS vars at
  // render time, so the uiTheme dep on the charts below repaints them.
  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme
    localStorage.setItem("rocket-ui-theme", uiTheme)
  }, [uiTheme])

  // Apply the active project's Client Skin to the document.
  useEffect(() => {
    applyProjectTheme(theme)
  }, [theme])

  return (
    <ClientThemeContext.Provider value={{ primary: theme.primary, secondary: theme.secondary, accent: theme.accent }}>
      <Sidebar page={page} onNavigate={setPage} projects={projects} activeId={activeId} onSelectProject={setActiveId} />
      <main>
        <header className="topbar">
          <div>
            <div className="eyebrow">Rocket Performance V8</div>
            <h1>{meta.title}</h1>
            <p>{meta.desc}</p>
          </div>
          <div className="header-controls">
            <label className="period-select">
              <span>Plan view</span>
              <select value={planView} onChange={(e) => setPlanView(e.target.value as "MTD" | "YTD")}>
                <option value="MTD">MTD</option>
                <option value="YTD">YTD</option>
              </select>
            </label>
            <label className="period-select">
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={planView === "YTD"}>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <div className="header-chip">
              <Calendar size={15} /> {periodLabel}
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={uiTheme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              title={uiTheme === "dark" ? "Light mode" : "Dark mode"}
            >
              {uiTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{uiTheme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>

        <section className="page" key={uiTheme}>
          {page === "projects" && (
            <ProjectsPage
              projects={projects}
              activeId={activeId}
              onSelect={setActiveId}
              onCreate={addProject}
              onDelete={removeProject}
            />
          )}
          {page === "overview" && <OverviewPage planView={planView} />}
          {page === "business" && <BusinessPage planView={planView} />}
          {page === "audience" && <AudiencePage planView={planView} />}
          {page === "google" && <ChannelDashboard platform="Google" planView={planView} />}
          {page === "meta" && <ChannelDashboard platform="Meta" planView={planView} />}
          {page === "taxonomy" && <TaxonomyPage />}
          {page === "import" && <ImportCenter />}
          {page === "reports" && (
            <ReportBuilder project={activeProject} onChange={(patch) => updateTheme(activeId, patch)} />
          )}
        </section>
      </main>
    </ClientThemeContext.Provider>
  )
}
