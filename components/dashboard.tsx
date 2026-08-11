"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Info, Moon, Search, Share2, Sparkles, Sun } from "lucide-react";
import { Sidebar, navMeta, type PageId } from "./sidebar";
import { ImportCenter } from "./import-center";
import { ProjectsPage } from "./projects-page";
import { ReportBuilder } from "./report-builder";
import { useProjects } from "@/lib/projects";
import { applyProjectTheme, ClientThemeContext } from "@/lib/theme";
import { KpiCards } from "./kpi-card";
import { ChartInsights } from "./chart-insights";
import { ChannelDoughnut, RateLineChart, VolumeBarChart, VolumeEfficiencyChart } from "./charts";
import {
  num,
  pct,
  vnd,
  freqOf,
  monthlyTrend as loadMonthlyTrend,
  loadExecutionRows,
  loadDeliveryStatus,
  loadDataStatus,
  loadUnitCostPlan,
  loadReport,
  loadAvailableMonths as fetchAvailableMonths,
  overviewKpis,
  businessBreakdown,
  campaignDeliveryRows,
  overviewSignals,
  performanceScore,
  planSummary,
  type DataStatusRow,
  type DeliveryStatusRow,
  type ReportRow,
  type UnitCostPlanRow,
  type BusinessDimension,
  type Verdict,
} from "@/lib/dashboard-data"; // Đường dẫn tuỳ project của bạn

// project_code thật trong DB
const DB_PROJECTS = [
  { code: "MMU", label: "BUV MMU" },
  { code: "TANAKAN", label: "Tanakan" },
];

function VerdictChip({ v }: { v: Verdict }) {
  const cls = v === "Đạt" ? "good" : v === "Cảnh báo" ? "warn" : v === "Chưa đạt" ? "bad" : "neutral";
  return <span className={`pill ${cls}`}>{v}</span>;
}

function PlatformChip({ p }: { p: string }) {
  const upper = (p || "").toUpperCase();
  const google = ["SEM", "ADX", "YOUTUBE"].includes(upper);
  const meta = ["FACEBOOK", "INSTAGRAM", "TIKTOK"].includes(upper); 
  const label = google ? "Google" : meta ? "Meta" : p;
  const cls = google ? "good" : meta ? "warn" : "neutral";
  return <span className={`pill ${cls}`}>{label}</span>;
}

function NotAvailableNotice({ what }: { what: string }) {
  return (
    <div className="notice">
      <Info size={20} />
      <div>
        <b>{what} chưa có nguồn dữ liệu.</b>
        <p>DB hiện chưa có bảng chứa thông tin này (cần thêm sync mới nếu muốn bật lại phần này).</p>
      </div>
    </div>
  );
}

// ----- HOOKS LẤY DỮ LIỆU -----
export function useAvailableMonths(projectCode: string) {
  const [months, setMonths] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchAvailableMonths(projectCode)
      .then((m) => !cancelled && setMonths(m))
      .catch((e) => console.error("loadAvailableMonths:", e));
    return () => {
      cancelled = true;
    };
  }, [projectCode]);
  return months;
}

export function usePlanData(projectCode: string, periodMonth: string) {
  const [data, setData] = useState<DataStatusRow[]>([]);
  const [delivery, setDelivery] = useState<DeliveryStatusRow[]>([]);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [plan, setPlan] = useState<UnitCostPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      loadDeliveryStatus(projectCode, periodMonth),
      loadReport(projectCode, periodMonth),
      loadUnitCostPlan(projectCode, periodMonth),
      loadDataStatus(projectCode, periodMonth),
    ])
      .then(([d, r, p, a]) => {
        if (cancelled) return;
        setDelivery(d);
        setReport(r);
        setPlan(p);
        setData(a);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("usePlanData:", e);
        setError(e.message ?? "Lỗi tải dữ liệu");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [projectCode, periodMonth]);

  const kpis = useMemo(() => overviewKpis(data), [data]);
  const signals = useMemo(() => overviewSignals(data), [data]);
  const score = useMemo(() => performanceScore(data), [data]);
  const campaignRows = useMemo(() => campaignDeliveryRows(data), [data]); 
  const planRows = useMemo(() => planSummary(plan), [plan]);
  const biz = (dim: BusinessDimension) => businessBreakdown(dim, report);

  return { data, delivery, report, plan, loading, error, kpis, signals, score, campaignRows, planRows, biz };
}

/* ---------------- Monthly trend (YTD view) ---------------- */
function MonthlyTrendCard({ projectCode, scope }: { projectCode: string; scope: string }) {
  const [series, setSeries] = useState<Awaited<ReturnType<typeof loadMonthlyTrend>>>([]);
  useEffect(() => {
    let cancelled = false;
    loadMonthlyTrend(projectCode).then((s) => !cancelled && setSeries(s)).catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [projectCode]);

  if (series.length === 0) return null;

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
  );
}

/* ---------------- Campaign Overview ---------------- */
function OverviewPage({ projectCode, periodMonth, planView }: { projectCode: string; periodMonth: string; planView: "MTD" | "YTD" }) {
  const { loading, error, kpis, signals, score, campaignRows, data, biz } = usePlanData(projectCode, periodMonth);
  const bizRows = biz("phase");

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

  const googleImp = data.filter(r => ["SEM", "ADX", "YOUTUBE"].includes((r.channel || "").toUpperCase())).reduce((s, r) => s + (r.impressions || 0), 0);
  const metaImp = data.filter(r => !["SEM", "ADX", "YOUTUBE"].includes((r.channel || "").toUpperCase())).reduce((s, r) => s + (r.impressions || 0), 0);

  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> Campaign control center</span>
          <h2>Một góc nhìn thống nhất để theo dõi toàn bộ campaign trước khi đi sâu vào từng kênh.</h2>
          <p>Overview tập trung vào plan, delivery, business dimensions và cảnh báo theo kỳ {periodMonth}.</p>
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
            <div><small>VOLUME DELIVERY</small><h3>Impressions theo Phase</h3></div>
            <span className="chip-config">Bar chart</span>
          </div>
          <div className="chart-wrap">
            <VolumeBarChart labels={bizRows.map((b) => b.label)} impressions={bizRows.map((b) => b.impressions)} reach={bizRows.map((b) => b.reach)} />
          </div>
          <ChartInsights spec={{ title: "Impressions theo Phase", subject: "volume delivery theo phase", labels: bizRows.map((b) => b.label), volume: bizRows.map((b) => b.impressions), volumeLabel: "Impressions" }} />
        </article>

        <article className="card">
          <div className="card-head">
            <div><small>EFFICIENCY TREND</small><h3>CTR &amp; Frequency theo Phase</h3></div>
            <span className="chip-config">Dual axis</span>
          </div>
          <div className="chart-wrap">
            <RateLineChart labels={bizRows.map((b) => b.label)} ctr={bizRows.map((b) => Number(b.ctr.toFixed(2)))} frequency={bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2)))} />
          </div>
          <ChartInsights spec={{ title: "CTR & Frequency theo Phase", subject: "hiệu suất theo phase", labels: bizRows.map((b) => b.label), ctr: bizRows.map((b) => Number(b.ctr.toFixed(2))), frequency: bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2))) }} />
        </article>
      </div>

      <div className="grid-2">
        <article className="card">
          <div className="card-head">
            <div><small>CHANNEL CONTRIBUTION</small><h3>Impressions theo nền tảng</h3></div>
          </div>
          <div className="chart-wrap large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ChannelDoughnut google={googleImp} meta={metaImp} />
          </div>
          <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
             <button style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>
               <Sparkles size={14} style={{ color: 'var(--accent)' }} />
               AI insights
             </button>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div><small>PERFORMANCE SIGNALS</small><h3>Cảnh báo chính</h3></div>
          </div>
          <div className="alerts">
            {signals.length === 0 && <p>Không có cảnh báo cho kỳ này.</p>}
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

      {planView === "YTD" && <MonthlyTrendCard projectCode={projectCode} scope="Toàn bộ channel" />}

      <article className="card">
        <div className="card-head"><div><small>Campaign delivery</small><h3>Toàn bộ campaign · {periodMonth}</h3></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th><th>Platform</th><th>Phase</th><th>Location</th><th>Buying type</th>
                <th className="right">Impressions</th><th className="right">Reach</th><th className="right">CTR</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.label}</td>
                  <td><PlatformChip p={r.channel} /></td>
                  <td>{r.phase}</td>
                  <td>{r.region}</td>
                  <td>{r.buyingType}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td><VerdictChip v={r.verdict} /></td>
                </tr>
              ))}
              {campaignRows.length === 0 && (
                <tr><td colSpan={9}>Chưa có data cho kỳ này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}

/* ---------------- Business Breakdown ---------------- */
const bizTabs: { id: BusinessDimension; label: string }[] = [
  { id: "phase", label: "Phase" },
  { id: "region", label: "Location" },
  { id: "channel", label: "Channel" },
  { id: "buying_type", label: "Buying Type" },
];

function BusinessPage({ projectCode, periodMonth, planView }: { projectCode: string; periodMonth: string; planView: "MTD" | "YTD" }) {
  const [dim, setDim] = useState<BusinessDimension>("phase");
  const { loading, biz } = usePlanData(projectCode, periodMonth);
  const rows = biz(dim);
  const label = bizTabs.find((t) => t.id === dim)?.label;

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;

  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          {bizTabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${dim === t.id ? "active" : ""}`} onClick={() => setDim(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head"><div><small>Volume</small><h3>Impressions theo {label}</h3></div></div>
          <div className="chart-wrap large">
            <VolumeBarChart labels={rows.map((r) => r.label)} impressions={rows.map((r) => r.impressions)} reach={rows.map((r) => r.reach)} />
          </div>
          <ChartInsights spec={{ title: `Impressions theo ${label}`, subject: `volume theo ${label?.toLowerCase()}`, labels: rows.map((r) => r.label), volume: rows.map((r) => r.impressions), volumeLabel: "Impressions" }} />
        </article>
        <article className="card">
          <div className="card-head"><div><small>Rate</small><h3>CTR theo {label}</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart labels={rows.map((r) => r.label)} ctr={rows.map((r) => Number(r.ctr.toFixed(2)))} />
          </div>
          <ChartInsights spec={{ title: `CTR theo ${label}`, subject: `hiệu suất CTR theo ${label?.toLowerCase()}`, labels: rows.map((r) => r.label), ctr: rows.map((r) => Number(r.ctr.toFixed(2))) }} />
        </article>
      </div>

      {planView === "YTD" && <MonthlyTrendCard projectCode={projectCode} scope="Toàn bộ channel" />}

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Dimension</th><th className="right">Rows</th><th className="right">Impressions</th><th className="right">Reach</th><th className="right">Clicks</th><th className="right">CTR</th><th className="right">Spend</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td><td className="right">{r.campaigns}</td><td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td><td className="right">{num(r.clicks)}</td><td className="right">{pct(r.ctr)}</td><td className="right">{vnd(r.spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}

/* ---------------- Channel dashboards ---------------- */
function ExecutionSection({ projectCode, platform, level }: { projectCode: string; platform: "Google" | "Meta"; level: "campaign" | "adgroup" }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadExecutionRows>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadExecutionRows(projectCode, platform, level)
      .then((r) => !cancelled && setRows(r))
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode, platform, level]);

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;

  const showReach = rows.some((r) => r.reach !== null);

  return (
    <>
      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head"><div><small>Delivery volume</small><h3>Impressions{showReach ? " & Reach" : ""}</h3></div></div>
          <div className="chart-wrap large">
            <VolumeBarChart labels={rows.map((r) => r.name)} impressions={rows.map((r) => r.impressions)} reach={showReach ? rows.map((r) => r.reach ?? 0) : undefined} />
          </div>
          <ChartInsights spec={{ title: `Impressions${showReach ? " & Reach" : ""} · ${platform}`, subject: `volume theo ${level === "campaign" ? "campaign" : "ad group"} trên ${platform}`, labels: rows.map((r) => r.name), volume: rows.map((r) => r.impressions), volumeLabel: "Impressions" }} />
        </article>
        <article className="card">
          <div className="card-head"><div><small>Efficiency</small><h3>CTR</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart labels={rows.map((r) => r.name)} ctr={rows.map((r) => Number(r.ctr.toFixed(2)))} />
          </div>
          <ChartInsights spec={{ title: `CTR · ${platform}`, subject: `hiệu suất CTR theo ${level === "campaign" ? "campaign" : "ad group"} trên ${platform}`, labels: rows.map((r) => r.name), ctr: rows.map((r) => Number(r.ctr.toFixed(2))) }} />
        </article>
      </div>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tên</th><th className="right">Impressions</th><th className="right">Reach</th><th className="right">Clicks</th><th className="right">CTR</th><th className="right">Spend</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.name}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{r.reach !== null ? num(r.reach) : "—"}</td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{vnd(r.spend)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}>Chưa có data.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}

function ChannelDashboard({ projectCode, platform, periodMonth, planView }: { projectCode: string; platform: "Google" | "Meta"; periodMonth: string; planView: "MTD" | "YTD" }) {
  const isGoogle = platform === "Google";
  const levels = [
    { id: "campaign", label: "Campaign" },
    { id: "adgroup", label: isGoogle ? "Ad Group" : "Ad Set" },
    { id: "audience", label: "Audience" },
    { id: isGoogle ? "keywords" : "creative", label: isGoogle ? "Keywords" : "Creative" },
  ];
  const [level, setLevel] = useState<string>("campaign");
  const { loading, kpis } = usePlanData(projectCode, periodMonth);

  return (
    <>
      <div className={`channel-banner ${isGoogle ? "google" : "meta"}`}>
        <div>
          <span>Channel dashboard</span>
          <h2>{isGoogle ? "Google Ads" : "Meta + TikTok Ads"}</h2>
          <p>{isGoogle ? "Campaign, Ad Group Performance (SEM + YouTube)." : "Campaign, Ad Set Performance (Facebook + TikTok)."}</p>
        </div>
        {isGoogle ? <Search size={40} /> : <Share2 size={40} />}
      </div>

      {!loading && <KpiCards cards={kpis} />}

      {planView === "YTD" && <MonthlyTrendCard projectCode={projectCode} scope={platform} />}

      <div className="page-toolbar">
        <div className="tabs">
          {levels.map((l) => (
            <button key={l.id} type="button" className={`tab ${level === l.id ? "active" : ""}`} onClick={() => setLevel(l.id)}>{l.label}</button>
          ))}
        </div>
      </div>

      {(level === "campaign" || level === "adgroup") && (
        <ExecutionSection projectCode={projectCode} platform={platform} level={level as "campaign" | "adgroup"} />
      )}
      {level === "audience" && <NotAvailableNotice what="Audience demographic (age/gender/region)" />}
      {level === "keywords" && <NotAvailableNotice what="Keyword-level reporting" />}
      {level === "creative" && <NotAvailableNotice what="Creative type breakdown" />}
    </>
  );
}

/* ---------------- Plan page ---------------- */
function PlanPage({ projectCode, periodMonth }: { projectCode: string; periodMonth: string }) {
  const { loading, planRows } = usePlanData(projectCode, periodMonth);
  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;

  return (
    <>
      <div className="notice">
        <Info size={20} />
        <div>
          <b>Media plan lấy trực tiếp từ ad_unit_cost_plan.</b>
          <p>Không còn suy luận taxonomy từ tên campaign — region/phase/channel/buying_type đã là cột thật trong DB.</p>
        </div>
      </div>

      <article className="card">
        <div className="card-head">
          <div><small>Media plan</small><h3>Plan · {periodMonth}</h3></div>
          <span className="chip-config">ad_unit_cost_plan</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Location</th><th>Phase</th><th>Channel</th><th>Buying type</th><th className="right">Unit cost</th><th className="right">Quantity</th><th className="right">Budget</th></tr>
            </thead>
            <tbody>
              {planRows.map((p, i) => (
                <tr key={i}>
                  <td>{p.region}</td><td>{p.phase}</td><td>{p.channel}</td><td>{p.buyingType}</td>
                  <td className="right">{vnd(p.unitCost)}</td><td className="right">{num(p.quantity)}</td><td className="right">{vnd(p.budget)}</td>
                </tr>
              ))}
              {planRows.length === 0 && <tr><td colSpan={7}>Chưa có plan cho kỳ này.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}

/* ---------------- Shell ---------------- */
export function Dashboard() {
  const [page, setPage] = useState<PageId>("overview");
  const [dbProjectCode, setDbProjectCode] = useState<string>(DB_PROJECTS[0].code);
  const [planView, setPlanView] = useState<"MTD" | "YTD">("YTD");
  const [month, setMonth] = useState<string>("");
  const [uiTheme, setUiTheme] = useState<"dark" | "light">("dark");
  const { projects, activeProject, activeId, setActiveId, addProject, removeProject, updateTheme } = useProjects();
  const meta = navMeta(page);
  const theme = activeProject.theme;
  const availableMonths = useAvailableMonths(dbProjectCode);

  // LOGIC ĐỒNG BỘ: KHI ĐỔI PROJECT UI -> TỰ ĐỘNG CẬP NHẬT DB_PROJECT CODE
  useEffect(() => {
    const activeIdx = projects.findIndex((p) => p.id === activeId);
    if (activeIdx !== -1 && DB_PROJECTS[activeIdx]) {
      setDbProjectCode(DB_PROJECTS[activeIdx].code);
    }
  }, [activeId, projects]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[0]);
    }
  }, [availableMonths, month]);

  const periodMonth = planView === "YTD" ? "YTD" : month;
  const periodLabel = planView === "YTD" ? "YTD" : month || "—";

  useEffect(() => {
    const saved = localStorage.getItem("rocket-ui-theme");
    if (saved === "light" || saved === "dark") setUiTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme;
    localStorage.setItem("rocket-ui-theme", uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    applyProjectTheme(theme);
  }, [theme]);

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
              <span>Project (DB)</span>
              <select value={dbProjectCode} onChange={(e) => setDbProjectCode(e.target.value)}>
                {DB_PROJECTS.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </label>
            <label className="period-select">
              <span>Plan view</span>
              <select value={planView} onChange={(e) => setPlanView(e.target.value as "MTD" | "YTD")}>
                <option value="MTD">MTD</option>
                <option value="YTD">YTD</option>
              </select>
            </label>
            <label className="period-select">
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={planView === "YTD" || availableMonths.length === 0}>
                {availableMonths.length === 0 && <option value="">Không có tháng MTD</option>}
                {availableMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <div className="header-chip"><Calendar size={15} /> {periodLabel}</div>
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
            <ProjectsPage projects={projects} activeId={activeId} onSelect={setActiveId} onCreate={addProject} onDelete={removeProject} />
          )}
          {page === "overview" && periodMonth && <OverviewPage projectCode={dbProjectCode} periodMonth={periodMonth} planView={planView} />}
          {page === "business" && periodMonth && <BusinessPage projectCode={dbProjectCode} periodMonth={periodMonth} planView={planView} />}
          {page === "audience" && <NotAvailableNotice what="Audience demographic (age/gender/region)" />}
          {page === "google" && <ChannelDashboard projectCode={dbProjectCode} platform="Google" periodMonth={periodMonth} planView={planView} />}
          {page === "meta" && <ChannelDashboard projectCode={dbProjectCode} platform="Meta" periodMonth={periodMonth} planView={planView} />}
          {page === "taxonomy" && periodMonth && <PlanPage projectCode={dbProjectCode} periodMonth={periodMonth} />}
          {page === "import" && <ImportCenter />}
          {page === "reports" && <ReportBuilder project={activeProject} onChange={(patch) => updateTheme(activeId, patch)} />}
        </section>
      </main>
    </ClientThemeContext.Provider>
  );
}