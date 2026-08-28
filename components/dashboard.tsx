"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Info, Moon, Search, Share2, Sparkles, Sun, ChevronLeft, ChevronRight, X, SquarePlay } from "lucide-react";
import { ShareManager } from "./share-manager";
import { Sidebar, navMeta, type PageId } from "./sidebar";
import { ImportCenter } from "./import-center";
import { ProjectsPage } from "./projects-page";
import { ReportBuilder } from "./report-builder";
import { useProjects } from "@/lib/projects";
import { applyProjectTheme, ClientThemeContext } from "@/lib/theme";
import { KpiCards } from "./kpi-card";
import { ChartInsights } from "./chart-insights";
import { ChannelDoughnut, RateLineChart, VolumeBarChart, VolumeEfficiencyChart, type ChannelSlice } from "./charts";
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
  fillMissingDeliveryStatus,
  loadDemographics,
  aggregateDemographic,
  aggregateDemographicByCampaignDetail,
  deliveryAlertGroups,
  loadChannelRawData, 
  channelKpis,
  type AlertRow,
  type CampaignBreakdownRow,
  type DataStatusRow,
  type DeliveryStatusRow,
  type ReportRow,
  type UnitCostPlanRow,
  type BusinessDimension,
  type Verdict,
  type DemographicRow,
} from "@/lib/dashboard-data";

// project_code thật trong DB
type DbProject = { code: string; label: string; sheetId?: string };

function AlertLine({ row }: { row: AlertRow }) {
  return (
    <p className="alert-line">
      {row.region} - {row.channel} - {row.buyingType} - {row.asset} - {row.statusLabel}
    </p>
  );
}

function useDbProjects() {
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setError(json.error);
        } else {
          setProjects(json.projects ?? []);
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { projects, loading, error };
}

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

// Chip riêng cho platform dạng "google" | "meta" (khác PlatformChip vốn nhận tên channel như SEM/FACEBOOK...)
function DemoPlatformChip({ p }: { p: "google" | "meta" }) {
  const cls = p === "google" ? "good" : "warn";
  const label = p === "google" ? "Google" : "Meta";
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

function useChannelRawData(projectCode: string, platform: "Google" | "Meta" | "Youtube") {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadChannelRawData>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadChannelRawData(projectCode, platform)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => console.error("useChannelRawData:", e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode, platform]);

  return { rows, loading };
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

  const mergedData = useMemo(
    () => fillMissingDeliveryStatus(data, delivery),
    [data, delivery]
  );

  useEffect(() => {
    if (data.length === 0 || delivery.length === 0) return;
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const deliveryKeys = new Set(
      delivery.map((d) => `${norm(d.region)}|${norm(d.phase)}|${norm(d.channel)}|${norm(d.buying_type)}`)
    );
    const unmatched = mergedData.filter((r) => !r.delivery_status && !r.cost_status);
    if (unmatched.length > 0) {
      console.debug(
        `[usePlanData] ${unmatched.length}/${mergedData.length} row vẫn "Chưa map" sau khi merge.`,
        "Sample unmatched keys:",
        unmatched.slice(0, 5).map((r) => `${norm(r.region)}|${norm(r.phase)}|${norm(r.channel)}|${norm(r.buying_type)}`),
        "Delivery keys có sẵn:",
        [...deliveryKeys]
      );
    }
  }, [mergedData, delivery, data]);

  const kpis = useMemo(() => overviewKpis(mergedData, delivery), [mergedData, delivery]);
  const signals = useMemo(() => overviewSignals(mergedData), [mergedData]);
  const score = useMemo(() => performanceScore(mergedData), [mergedData]);
  const campaignRows = useMemo(() => campaignDeliveryRows(mergedData), [mergedData]);

  const planRows = useMemo(() => planSummary(plan), [plan]);
  const biz = (dim: BusinessDimension) => businessBreakdown(dim, report);

  return {
    data: mergedData,
    delivery,
    report,
    plan,
    loading,
    error,
    kpis,
    signals,
    score,
    campaignRows,
    planRows,
    biz,
  };
}

/* ---------------- Volume & Efficiency theo Phase ---------------- */
function PhaseEfficiencyCard({ bizRows }: { bizRows: ReturnType<typeof businessBreakdown> }) {
  if (bizRows.length === 0) return null;

  return (
    <article className="card">
      <div className="card-head">
        <div>
          <small>Volume &amp; efficiency</small>
          <h3>Impressions, CTR &amp; Frequency theo Phase</h3>
        </div>
        <span className="chip-config">Combo 3 trục</span>
      </div>
      <div className="chart-wrap large">
        <VolumeEfficiencyChart
          labels={bizRows.map((b) => b.label)}
          impressions={bizRows.map((b) => b.impressions)}
          ctr={bizRows.map((b) => Number(b.ctr.toFixed(2)))}
          frequency={bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2)))}
        />
      </div>
      {/* <ChartInsights
        spec={{
          title: "Impressions, CTR & Frequency theo Phase",
          subject: "volume & efficiency theo phase",
          labels: bizRows.map((b) => b.label),
          volume: bizRows.map((b) => b.impressions),
          volumeLabel: "Impressions",
          ctr: bizRows.map((b) => Number(b.ctr.toFixed(2))),
          frequency: bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2))),
        }}
      /> */}
    </article>
  );
}

/* ---------------- Pagination Hooks & Components ---------------- */
function usePagination<T>(data: T[], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const currentData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  return { currentPage, setCurrentPage, totalPages, currentData };
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: "13px" }}>
      <span style={{ color: "var(--fg-muted)" }}>
        Trang {currentPage} / {totalPages}
      </span>
      <div style={{ display: "flex", gap: "4px" }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{ padding: "6px", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1, background: "transparent", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg)", display: "flex", alignItems: "center" }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ padding: "6px", cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1, background: "transparent", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg)", display: "flex", alignItems: "center" }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
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
      {/* <ChartInsights
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
      /> */}
    </article>
  );
}

/* ---------------- Campaign Overview ---------------- */
export function OverviewPage({ projectCode, periodMonth, planView }: { projectCode: string; periodMonth: string; planView: "MTD" | "YTD" }) {
  const { loading, error, kpis, signals, score, campaignRows, data } = usePlanData(projectCode, periodMonth);
  const alertGroups = useMemo(() => deliveryAlertGroups(data), [data]);

  // THAY: 3 chart theo Phase (Volume Delivery, Efficiency Trend, Volume & Efficiency)
  // giờ dùng data từ ad_raw_data (data status) thay vì report từ ad_raw_report,
  // vì ad_raw_data có dữ liệu đầy đủ/chính xác hơn cho phase Conversion.
  const bizRows = useMemo(() => businessBreakdown("phase", data), [data]);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedCampaignRows } = usePagination(campaignRows, 10);

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

  // Breakdown theo TỪNG channel thật (không nhị phân Google/Meta nữa) — số lát bánh tự co giãn theo data
  const channelSlices: ChannelSlice[] = Object.entries(
    data.reduce<Record<string, number>>((acc, r) => {
      const key = (r.channel || "Chưa map").trim().toUpperCase();
      acc[key] = (acc[key] || 0) + (r.impressions || 0);
      return acc;
    }, {})
  )
    .filter(([, imp]) => imp > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
  const isAllClear = alertGroups.laggingDelivery.length === 0 && alertGroups.overCost.length === 0;
  return (
    <>
      <div className="hero">
        <div>
          <span className="eyebrow"><Sparkles size={13} /> CAMPAIGN INTELLIGENCE CENTER</span>
          <h2>Toàn cảnh hiệu suất. Một nơi duy nhất. Theo thời gian thực.</h2>
          <p>Theo dõi tiến độ, hiệu quả của toàn bộ chiến dịch - từ kế hoạch đến từng kênh triển khai.</p>
        </div>
        <div className="hero-badge">
          <b>{score}</b>
          <span>Performance Index</span>
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
          {/* <ChartInsights spec={{ title: "Impressions theo Phase", subject: "volume delivery theo phase", labels: bizRows.map((b) => b.label), volume: bizRows.map((b) => b.impressions), volumeLabel: "Impressions" }} /> */}
        </article>

        <article className="card">
          <div className="card-head">
            <div><small>EFFICIENCY TREND</small><h3>CTR &amp; Frequency theo Phase</h3></div>
            <span className="chip-config">Dual axis</span>
          </div>
          <div className="chart-wrap">
            <RateLineChart labels={bizRows.map((b) => b.label)} ctr={bizRows.map((b) => Number(b.ctr.toFixed(2)))} frequency={bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2)))} />
          </div>
          {/* <ChartInsights spec={{ title: "CTR & Frequency theo Phase", subject: "hiệu suất theo phase", labels: bizRows.map((b) => b.label), ctr: bizRows.map((b) => Number(b.ctr.toFixed(2))), frequency: bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2))) }} /> */}
        </article>
      </div>
      <PhaseEfficiencyCard bizRows={bizRows} />
      <div className="grid-2">
        <article className="card">
          <div className="card-head">
            <div><small>CHANNEL CONTRIBUTION</small><h3>Impressions theo nền tảng</h3></div>
          </div>
          <div className="chart-wrap large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ChannelDoughnut slices={channelSlices} />
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
            <div><small>PERFORMANCE SIGNALS</small></div>
          </div>
<div className="alerts">
  

  {isAllClear ? (
    <div className="alert-empty-all" style={{ marginTop: '10px' }}>
      <strong>Hoạt động ổn định</strong>
      <p>✓ Không có tín hiệu bất thường</p>
      <p>Tiến độ phân phối, chất lượng chiến dịch, hiệu quả chi phí hiện đang nằm trong ngưỡng tối ưu.</p>
    </div>
  ) : (
    <>
      <div className="alert-group">
        <strong>1. Chậm spending/ delivery</strong>
        {alertGroups.laggingDelivery.length === 0 ? (
          <p className="alert-empty">Hoạt động ổn định</p>
        ) : (
          alertGroups.laggingDelivery.map((row) => <AlertLine key={row.key} row={row} />)
        )}
      </div>

      <div className="alert-group">
        <strong>2. Chi phí vượt ngưỡng</strong>
        {alertGroups.overCost.length === 0 ? (
          <p className="alert-empty">✓ Không có tín hiệu bất thường</p>
        ) : (
          alertGroups.overCost.map((row) => <AlertLine key={row.key} row={row} />)
        )}
      </div>
    </>
  )}
</div>
        </article>
      </div>

      <article className="card">
        <div className="card-head"><div><small>Campaign delivery</small><h3>Toàn bộ campaign · {periodMonth}</h3></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campaign</th><th>Buying type</th>
                <th className="right">Impressions</th><th className="right">Reach</th><th className="right">Views</th><th className="right">Clicks</th><th className="right">Engagement</th><th className="right">CTR</th><th className="right">ER</th><th>Status</th>
              </tr> 
            </thead>
            <tbody>
              {pagedCampaignRows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.label}</td>
                  <td>{r.buyingType}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{num(r.view)}</td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{num(r.engagement)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{pct(r.er)}</td>
                  <td><VerdictChip v={r.verdict} /></td>
                </tr>
              ))}
              {pagedCampaignRows.length === 0 && (
                <tr><td colSpan={9}>Chưa có data cho kỳ này.</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
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

export function BusinessPage({ projectCode, periodMonth, planView }: { projectCode: string; periodMonth: string; planView: "MTD" | "YTD" }) {
  const [dim, setDim] = useState<BusinessDimension>("phase");
  const { loading, biz } = usePlanData(projectCode, periodMonth);
  const rows = biz(dim);
  const label = bizTabs.find((t) => t.id === dim)?.label;

  const { currentPage, setCurrentPage, totalPages, currentData: pagedRows } = usePagination(rows, 10);

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

      <article className="card">
        <div className="card-head">
          <div>
            <small>Volume &amp; efficiency</small>
            <h3>Impressions, CTR &amp; Frequency theo {label}</h3>
          </div>
          <span className="chip-config">Combo 3 trục</span>
        </div>
        <div className="chart-wrap large">
          <VolumeEfficiencyChart
            labels={rows.map((r) => r.label)}
            impressions={rows.map((r) => r.impressions)}
            ctr={rows.map((r) => Number(r.ctr.toFixed(2)))}
            frequency={rows.map((r) => Number(freqOf(r.impressions, r.reach).toFixed(2)))}
          />
        </div>
        {/* <ChartInsights
          spec={{
            title: `Impressions, CTR & Frequency theo ${label}`,
            subject: `volume & efficiency theo ${label?.toLowerCase()}`,
            labels: rows.map((r) => r.label),
            volume: rows.map((r) => r.impressions),
            volumeLabel: "Impressions",
            ctr: rows.map((r) => Number(r.ctr.toFixed(2))),
            frequency: rows.map((r) => Number(freqOf(r.impressions, r.reach).toFixed(2))),
          }}
        /> */}
      </article>

      {planView === "YTD" && <MonthlyTrendCard projectCode={projectCode} scope="Toàn bộ channel" />}

      <article className="card">
        <div className="card-head"><div><small>Bảng chi tiết</small><h3>Theo {label}</h3></div></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{label}</th>
                <th className="right">Reach</th>
                <th className="right">Impressions</th>
                <th className="right">Engagements</th>
                <th className="right">Views</th>
                <th className="right">Clicks</th>
                <th className="right">Link Clicks</th>
                <th className="right">Landing Page Views</th>
                <th className="right">Leads</th>
                <th className="right">CTR</th>
                <th className="right">ER</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="right">{num(r.reach)}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{num(r.engagements)}</td>
                  <td className="right">{num(r.views)}</td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{num(r.linkClicks)}</td>
                  <td className="right">{num(r.landingPageViews)}</td>
                  <td className="right">{num(r.leads)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{pct(r.er)}</td>
                </tr>
              ))}
              {pagedRows.length === 0 && (
                <tr><td colSpan={11}>Chưa có data cho kỳ này.</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </article>
    </>
  );
}

/* ---------------- Channel dashboards ---------------- */
function ExecutionSection({ projectCode, platform, level }: { projectCode: string; platform: "Google" | "Meta"; level: "campaign" | "adgroup" }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadExecutionRows>>>([]);
  const [loading, setLoading] = useState(true);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedRows } = usePagination(rows, 10);

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

  const TRUNCATE_LENGTH = 4;
  const truncateLabel = (name: string) => {
    return name.length > TRUNCATE_LENGTH ? name.substring(0, TRUNCATE_LENGTH) + "…" : name;
  };

  return (
    <>
      <div className=" two-thirds">
        <article className="card">
          <div className="card-head"><div><small>Delivery volume</small><h3>Impressions{showReach ? " & Reach" : ""}</h3></div></div>
          <div className="chart-wrap large">
            <VolumeBarChart
              labels={rows.map((r) => r.name)}
              impressions={rows.map((r) => r.impressions)}
              reach={showReach ? rows.map((r) => r.reach ?? 0) : undefined}
              
            />
          </div>
          {/* LƯU Ý: ChartInsights vẫn nhận full tên (r.name) để AI đọc được chính xác dữ liệu */}
          {/* <ChartInsights spec={{ title: `Impressions${showReach ? " & Reach" : ""} · ${platform}`, subject: `volume theo ${level === "campaign" ? "campaign" : "ad group"} trên ${platform}`, labels: rows.map((r) => r.name), volume: rows.map((r) => r.impressions), volumeLabel: "Impressions" }} /> */}
        </article>

        <article className="card mt-2">
          <div className="card-head"><div><small>Efficiency</small><h3>CTR</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart
              labels={rows.map((r) => r.name)}
              ctr={rows.map((r) => Number(r.ctr.toFixed(2)))}
              
            />
          </div>
          {/* <ChartInsights spec={{ title: `CTR · ${platform}`, subject: `hiệu suất CTR theo ${level === "campaign" ? "campaign" : "ad group"} trên ${platform}`, labels: rows.map((r) => r.name), ctr: rows.map((r) => Number(r.ctr.toFixed(2))) }} /> */}
        </article>
      </div>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tên</th><th className="right">Impressions</th><th className="right">Reach</th><th className="right">Clicks</th><th className="right">Engagements</th><th className="right">CTR</th><th className="right">ER</th><th className="right">Spend</th></tr></thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" title={r.name}>{r.name}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right">{r.reach !== null ? num(r.reach) : "—"}</td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{num(r.engagements)}</td>
                  <td className="right">{pct(r.ctr)}</td>
                  <td className="right">{pct(r.er)}</td>
                  <td className="right">{vnd(r.spend)}</td>
                </tr>
              ))}
              {pagedRows.length === 0 && <tr><td colSpan={8}>Chưa có data.</td></tr>}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </article>
    </>
  );
}

export function ChannelDashboard({ projectCode, platform, periodMonth, planView }: { projectCode: string; platform: "Google" | "Meta" | "Youtube"; periodMonth: string; planView: "MTD" | "YTD" }) {
  const isGoogle = platform === "Google";
  const isYoutube = platform === "Youtube";
  const levels = [
    { id: "campaign", label: "Campaign" },
    { id: "adgroup", label: isGoogle || isYoutube ? "Ad Group" : "Ad Set" },
    { id: "audience", label: "Audience" },
    { id: isGoogle ? "keywords" : "creative", label: isGoogle ? "Keywords" : "Creative" },
  ];
  const [level, setLevel] = useState<string>("campaign");

  // THAY: kpis lấy từ raw table của đúng platform, không còn dùng usePlanData (vốn tính trên toàn project)
  const { rows: channelRows, loading } = useChannelRawData(projectCode, platform);
  const kpis = useMemo(() => channelKpis(platform, channelRows), [platform, channelRows]);

  const bannerClass = isGoogle ? "google" : isYoutube ? "youtube" : "meta";
  const bannerIcon = isGoogle ? <Search size={40} /> : isYoutube ? <SquarePlay size={40} /> : <Share2 size={40} />;
  const bannerTitle = isGoogle ? "Google Ads" : isYoutube ? "YouTube Ads" : "Meta Ads";
  const bannerDesc = isGoogle
    ? "Campaign, Ad Group Performance (SEM)."
    : isYoutube
    ? "Campaign, Ad Group Performance (Video)."
    : "Campaign, Ad Set Performance (Facebook).";

  return (
    <>
      <div className={`channel-banner ${bannerClass}`}>
        <div>
          <span>Channel dashboard</span>
          <h2>{bannerTitle}</h2>
          <p>{bannerDesc}</p>
        </div>
        {bannerIcon}
      </div>

      {!loading && <KpiCards cards={kpis} />}

      <div className="page-toolbar">
        <div className="tabs">
          {levels.map((l) => (
            <button key={l.id} type="button" className={`tab ${level === l.id ? "active" : ""}`} onClick={() => setLevel(l.id)}>{l.label}</button>
          ))}
        </div>
      </div>

      {(level === "campaign" || level === "adgroup") && (
        isYoutube ? (
          <NotAvailableNotice what={`${level === "campaign" ? "Campaign" : "Ad Group"} performance cho YouTube`} />
        ) : (
          <ExecutionSection projectCode={projectCode} platform={platform as "Google" | "Meta"} level={level as "campaign" | "adgroup"} />
        )
      )}
      {level === "audience" && (
        <PlatformAudienceSection projectCode={projectCode} periodMonth={periodMonth} platform={platform} />
      )}
      {level === "keywords" && isGoogle && <KeywordsSection projectCode={projectCode} />}
      {level === "creative" && <NotAvailableNotice what="Creative type breakdown" />}
    </>
  );
}

/* ---------------- Platform-specific audience (dùng trong Google/Meta channel dashboard) ---------------- */
function PlatformAudienceSection({
  projectCode,
  periodMonth,
  platform,
}: {
  projectCode: string;
  periodMonth: string;
  platform: "Google" | "Meta" | "Youtube";
}) {
  const [dim, setDim] = useState<"age" | "gender" | "region" | "device">("age");
  const [view, setView] = useState<"value" | "campaign">("value");
  const [rows, setRows] = useState<DemographicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const platformKey = platform === "Google" ? "google" : platform === "Youtube" ? "youtube" : "meta";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDemographics(projectCode, periodMonth, dim)
      .then((r) => !cancelled && setRows(r.filter((x) => x.platform === platformKey)))
      .catch((e) => !cancelled && setError(e.message ?? "Lỗi tải dữ liệu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode, periodMonth, dim, platformKey]);


  const breakdown = useMemo(() => aggregateDemographic(rows), [rows]);
  const campaignBreakdown = useMemo(() => aggregateDemographicByCampaignDetail(rows), [rows]);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedRows } = usePagination(breakdown, 10);
  const {
    currentPage: campPage,
    setCurrentPage: setCampPage,
    totalPages: campTotalPages,
    currentData: pagedCampaignRows,
  } = usePagination(campaignBreakdown, 10);

  const label = demoTabs.find((t) => t.id === dim)?.label;

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          {demoTabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${dim === t.id ? "active" : ""}`} onClick={() => setDim(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head"><div><small>Volume</small><h3>Impressions theo {label} · {platform}</h3></div></div>
          <div className="chart-wrap large">
            <VolumeBarChart labels={breakdown.map((b) => b.label)} impressions={breakdown.map((b) => b.impressions)} reach={breakdown.map((b) => b.reach)} />
          </div>
          {/* <ChartInsights spec={{ title: `Impressions theo ${label} · ${platform}`, subject: `audience theo ${label?.toLowerCase()} trên ${platform}`, labels: breakdown.map((b) => b.label), volume: breakdown.map((b) => b.impressions), volumeLabel: "Impressions" }} /> */}
        </article>
        <article className="card">
          <div className="card-head"><div><small>Rate</small><h3>CTR theo {label} · {platform}</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart labels={breakdown.map((b) => b.label)} ctr={breakdown.map((b) => Number(b.ctr.toFixed(2)))} />
          </div>
          {/* <ChartInsights spec={{ title: `CTR theo ${label} · ${platform}`, subject: `hiệu suất CTR theo ${label?.toLowerCase()} trên ${platform}`, labels: breakdown.map((b) => b.label), ctr: breakdown.map((b) => Number(b.ctr.toFixed(2))) }} /> */}
        </article>
      </div>

      <article className="card">
        <div className="card-head">
          <div><small>Bảng chi tiết</small><h3>Theo {label} · {platform}</h3></div>
          <div className="tabs" style={{ gap: 4 }}>
            <button type="button" className={`tab ${view === "value" ? "active" : ""}`} onClick={() => setView("value")}>Theo {label}</button>
            <button type="button" className={`tab ${view === "campaign" ? "active" : ""}`} onClick={() => setView("campaign")}>Theo Campaign</button>
          </div>
        </div>
        <div className="table-wrap">
          {view === "value" ? (
            <>
              <table>
                <thead>
                  <tr>
                    <th>{label}</th>
                    <th className="right">Impressions</th>
                    <th className="right">Reach</th>
                    <th className="right">Clicks</th>
                    <th className="right">CTR</th>
                    <th className="right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td className="right">{num(b.impressions)}</td>
                      <td className="right">{num(b.reach)}</td>
                      <td className="right">{num(b.clicks)}</td>
                      <td className="right">{pct(b.ctr)}</td>
                      <td className="right">{vnd(b.spend)}</td>
                    </tr>
                  ))}
                  {pagedRows.length === 0 && (
                    <tr><td colSpan={6}>Chưa có data audience cho {platform} ở kỳ này.</td></tr>
                  )}
                </tbody>
              </table>
              <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>{label}</th>
                    <th className="right">Impressions</th>
                    <th className="right">Clicks</th>
                    <th className="right">CTR</th>
                    <th className="right">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCampaignRows.map((r, i) => (
                    <tr key={`${r.campaignName}-${r.breakdownValue}-${i}`}>
                      <td className="mono">{r.campaignName}</td>
                      <td>{r.breakdownValue}</td>
                      <td className="right">{num(r.impressions)}</td>
                      <td className="right">{num(r.clicks)}</td>
                      <td className="right">{pct(r.ctr)}</td>
                      <td className="right">{vnd(r.spend)}</td>
                    </tr>
                  ))}
                  {pagedCampaignRows.length === 0 && (
                    <tr><td colSpan={6}>Chưa có data campaign cho {platform} ở kỳ này.</td></tr>
                  )}
                </tbody>
              </table>
              <PaginationControls currentPage={campPage} totalPages={campTotalPages} onPageChange={setCampPage} />
            </>
          )}
        </div>
      </article>
    </>
  );
}

/* ---------------- Keywords (Google only, breakdown_type='keyword') ---------------- */
function KeywordsSection({ projectCode }: { projectCode: string }) {
  const [rows, setRows] = useState<DemographicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDemographics(projectCode, currentMonthAbbrClient(), "keyword")
      .then((r) => !cancelled && setRows(r.filter((x) => x.platform === "google")))
      .catch((e) => !cancelled && setError(e.message ?? "Lỗi tải dữ liệu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode]);

  const breakdown = useMemo(() => aggregateDemographic(rows), [rows]);
  const { currentPage, setCurrentPage, totalPages, currentData: pagedRows } = usePagination(breakdown, 10);

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

  return (
    <>
      <article className="card">
        <div className="card-head"><div><small>Search terms</small><h3>Top keyword theo Clicks</h3></div></div>
        <div className="chart-wrap large">
          <VolumeBarChart labels={breakdown.slice(0, 15).map((b) => b.label)} impressions={breakdown.slice(0, 15).map((b) => b.impressions)} />
        </div>
        {/* <ChartInsights spec={{ title: "Top keyword theo Clicks", subject: "hiệu suất search term", labels: breakdown.map((b) => b.label), volume: breakdown.map((b) => b.impressions), volumeLabel: "Impressions" }} /> */}
      </article>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Search term</th>
                <th className="right">Impressions</th>
                <th className="right">Clicks</th>
                <th className="right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((b) => (
                <tr key={b.label}>
                  <td className="mono">{b.label}</td>
                  <td className="right">{num(b.impressions)}</td>
                  <td className="right">{num(b.clicks)}</td>
                  <td className="right">{pct(b.ctr)}</td>
                </tr>
              ))}
              {pagedRows.length === 0 && <tr><td colSpan={4}>Chưa có data keyword.</td></tr>}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </article>
    </>
  );
}

function currentMonthAbbrClient(): string {
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return MONTHS[new Date().getMonth()];
}

/* ---------------- Audience (demographic) ---------------- */
const demoTabs: { id: "age" | "gender" | "region"; label: string }[] = [
  { id: "age", label: "Độ tuổi" },
  { id: "gender", label: "Giới tính" },
  { id: "region", label: "Khu vực" },
];

const platformDemoTabs: { id: "age" | "gender" | "region" | "device"; label: string }[] = [
  { id: "age", label: "Độ tuổi" },
  { id: "gender", label: "Giới tính" },
  { id: "region", label: "Khu vực" },
  { id: "device", label: "Thiết bị" },
];

export function AudiencePage({ projectCode, periodMonth }: { projectCode: string; periodMonth: string }) {
  const [dim, setDim] = useState<"age" | "gender" | "region">("age");
  const [view, setView] = useState<"value" | "campaign">("value");
  const [rows, setRows] = useState<DemographicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDemographics(projectCode, periodMonth, dim)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e.message ?? "Lỗi tải dữ liệu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode, periodMonth, dim]);

  const breakdown = useMemo(() => aggregateDemographic(rows), [rows]);
  const campaignBreakdown = useMemo(() => aggregateDemographicByCampaignDetail(rows), [rows]);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedRows } = usePagination(breakdown, 10);
  const {
    currentPage: campPage,
    setCurrentPage: setCampPage,
    totalPages: campTotalPages,
    currentData: pagedCampaignRows,
  } = usePagination(campaignBreakdown, 10);

  const label = demoTabs.find((t) => t.id === dim)?.label;

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          {demoTabs.map((t) => (
            <button key={t.id} type="button" className={`tab ${dim === t.id ? "active" : ""}`} onClick={() => setDim(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head"><div><small>Volume</small><h3>Impressions theo {label}</h3></div></div>
          <div className="chart-wrap large">
            <VolumeBarChart labels={breakdown.map((b) => b.label)} impressions={breakdown.map((b) => b.impressions)} reach={breakdown.map((b) => b.reach)} />
          </div>
          {/* <ChartInsights spec={{ title: `Impressions theo ${label}`, subject: `audience theo ${label?.toLowerCase()}`, labels: breakdown.map((b) => b.label), volume: breakdown.map((b) => b.impressions), volumeLabel: "Impressions" }} /> */}
        </article>
        <article className="card">
          <div className="card-head"><div><small>Rate</small><h3>CTR theo {label}</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart labels={breakdown.map((b) => b.label)} ctr={breakdown.map((b) => Number(b.ctr.toFixed(2)))} />
          </div>
          {/* <ChartInsights spec={{ title: `CTR theo ${label}`, subject: `hiệu suất CTR theo ${label?.toLowerCase()}`, labels: breakdown.map((b) => b.label), ctr: breakdown.map((b) => Number(b.ctr.toFixed(2))) }} /> */}
        </article>
      </div>

      <div className="grid-2">
        <article className="card">
          <div className="card-head">
            <div><small>Channel contribution</small><h3>Google vs Meta theo {label}</h3></div>
          </div>
          <div className="chart-wrap large" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <ChannelDoughnut
              slices={[
                { label: "Google Ads", value: breakdown.reduce((s, b) => s + b.googleImpressions, 0) },
                { label: "Meta Ads", value: breakdown.reduce((s, b) => s + b.metaImpressions, 0) },
              ].filter((s) => s.value > 0)}
            />
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div><small>Bảng chi tiết</small><h3>Theo {label}</h3></div>
            <div className="tabs" style={{ gap: 4 }}>
              <button type="button" className={`tab ${view === "value" ? "active" : ""}`} onClick={() => setView("value")}>Theo {label}</button>
              <button type="button" className={`tab ${view === "campaign" ? "active" : ""}`} onClick={() => setView("campaign")}>Theo Campaign</button>
            </div>
          </div>
          <div className="table-wrap">
            {view === "value" ? (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>{label}</th>
                      <th className="right">Impressions</th>
                      <th className="right">Reach</th>
                      <th className="right">Clicks</th>
                      <th className="right">CTR</th>
                      <th className="right">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((b) => (
                      <tr key={b.label}>
                        <td>{b.label}</td>
                        <td className="right">{num(b.impressions)}</td>
                        <td className="right">{num(b.reach)}</td>
                        <td className="right">{num(b.clicks)}</td>
                        <td className="right">{pct(b.ctr)}</td>
                        <td className="right">{vnd(b.spend)}</td>
                      </tr>
                    ))}
                    {pagedRows.length === 0 && (
                      <tr><td colSpan={6}>Chưa có data cho kỳ này.</td></tr>
                    )}
                  </tbody>
                </table>
                <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>{label}</th>
                      <th>Platform</th>
                      <th className="right">Impressions</th>
                      <th className="right">Clicks</th>
                      <th className="right">CTR</th>
                      <th className="right">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCampaignRows.map((r, i) => (
                      <tr key={`${r.campaignName}-${r.breakdownValue}-${i}`}>
                        <td className="mono">{r.campaignName}</td>
                        <td>{r.breakdownValue}</td>
                        <td><DemoPlatformChip p={r.platform} /></td>
                        <td className="right">{num(r.impressions)}</td>
                        <td className="right">{num(r.clicks)}</td>
                        <td className="right">{pct(r.ctr)}</td>
                        <td className="right">{vnd(r.spend)}</td>
                      </tr>
                    ))}
                    {pagedCampaignRows.length === 0 && (
                      <tr><td colSpan={7}>Chưa có data campaign cho kỳ này.</td></tr>
                    )}
                  </tbody>
                </table>
                <PaginationControls currentPage={campPage} totalPages={campTotalPages} onPageChange={setCampPage} />
              </>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

/* ---------------- Plan page ---------------- */
export function PlanPage({ projectCode, periodMonth }: { projectCode: string; periodMonth: string }) {
  const { loading, planRows } = usePlanData(projectCode, periodMonth);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedPlanRows } = usePagination(planRows, 10);

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
              {pagedPlanRows.map((p, i) => (
                <tr key={i}>
                  <td>{p.region}</td><td>{p.phase}</td><td>{p.channel}</td><td>{p.buyingType}</td>
                  <td className="right">{vnd(p.unitCost)}</td><td className="right">{num(p.quantity)}</td><td className="right">{vnd(p.budget)}</td>
                </tr>
              ))}
              {pagedPlanRows.length === 0 && <tr><td colSpan={7}>Chưa có plan cho kỳ này.</td></tr>}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </article>
    </>
  );
}

export function Dashboard() {
  const [page, setPage] = useState<PageId>("overview");
  const [planView, setPlanView] = useState<"MTD" | "YTD">("YTD");
  const [month, setMonth] = useState<string>("");
  const [uiTheme, setUiTheme] = useState<"dark" | "light">("dark");
  const [showShareModal, setShowShareModal] = useState(false);
  const { projects, activeProject, activeId, setActiveId, addProject, editProject, removeProject, updateTheme, hydrated } = useProjects();
  const meta = navMeta(page);

  const dbProjectCode = activeProject?.code ?? "";

  const availableMonths = useAvailableMonths(dbProjectCode);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[0]);
    }
  }, [availableMonths, month]);

  useEffect(() => {
    setMonth("");
  }, [dbProjectCode]);

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
    if (activeProject?.theme) applyProjectTheme(activeProject.theme);
  }, [activeProject]);

  if (!hydrated || !activeProject) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="notice">
          <Info size={18} />
          <div><b>Đang tải project…</b></div>
        </div>
      </main>
    );
  }

  const theme = activeProject.theme;

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
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <Share2 size={15} />
              Share
            </button>
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
            <ProjectsPage projects={projects} activeId={activeId} onSelect={setActiveId} onCreate={addProject} onEdit={editProject} onDelete={removeProject} />
          )}
          {page === "overview" && periodMonth && dbProjectCode && <OverviewPage projectCode={dbProjectCode} periodMonth={periodMonth} planView={planView} />}
          {page === "business" && periodMonth && dbProjectCode && <BusinessPage projectCode={dbProjectCode} periodMonth={periodMonth} planView={planView} />}
          {page === "audience" && dbProjectCode && periodMonth && <AudiencePage projectCode={dbProjectCode} periodMonth={periodMonth} />}
          {page === "google" && dbProjectCode && <ChannelDashboard projectCode={dbProjectCode} platform="Google" periodMonth={periodMonth} planView={planView} />}
          {page === "meta" && dbProjectCode && <ChannelDashboard projectCode={dbProjectCode} platform="Meta" periodMonth={periodMonth} planView={planView} />}
          {page === "youtube" && dbProjectCode && <ChannelDashboard projectCode={dbProjectCode} platform="Youtube" periodMonth={periodMonth} planView={planView} />}  
          {page === "taxonomy" && periodMonth && dbProjectCode && <PlanPage projectCode={dbProjectCode} periodMonth={periodMonth} />}

          {page === "import" && <ImportCenter />}
          {page === "reports" && <ReportBuilder project={activeProject} onChange={(patch) => updateTheme(activeId, patch)} />}
        </section>
      </main>

      {showShareModal && (
        <div
          onClick={() => setShowShareModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              aria-label="Đóng"
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "6px",
                cursor: "pointer",
                color: "var(--fg)",
                zIndex: 1,
              }}
            >
              <X size={16} />
            </button>
            <ShareManager projectCode={dbProjectCode} />
          </div>
        </div>
      )}
    </ClientThemeContext.Provider>
  );
}