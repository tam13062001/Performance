"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { num, pct, freqOf, monthlyTrend as loadMonthlyTrend, type BusinessDimension } from "@/lib/dashboard-data";
import { VolumeEfficiencyChart } from "../charts";
import { usePlanData, usePagination } from "./hooks";
import { PaginationControls } from "./shared-ui";
import { bizTabs } from "./constants";

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
    </article>
  );
}

/* ---------------- Business Breakdown ---------------- */
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