"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import {
  num,
  pct,
  vnd,
  loadDemographics,
  aggregateDemographic,
  aggregateDemographicByCampaignDetail,
  type DemographicRow,
} from "@/lib/dashboard-data";
import { ChannelDoughnut, VolumeBarChart, RateLineChart } from "../charts";
import { usePagination } from "./hooks";
import { DemoPlatformChip, PaginationControls } from "./shared-ui";
import { demoTabs } from "./constants";

// Ngày dữ liệu chỉ sync 1 lần/ngày (lấy full data của hôm qua), nên không
// bao giờ cho chọn "hôm nay" — data hôm nay luôn chưa đầy đủ.
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

export function AudiencePage({ projectCode, periodMonth }: { projectCode: string; periodMonth: string }) {
  const [dim, setDim] = useState<"age" | "gender" | "region">("age");
  const [view, setView] = useState<"value" | "campaign">("value");
  const [rows, setRows] = useState<DemographicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ngày dữ liệu breakdown audience — mặc định hôm qua, max cũng chỉ tới
  // hôm qua (không cho chọn "today" vì data hôm nay chưa full).
  const maxSelectableDate = useMemo(() => yesterdayIso(), []);
  const [selectedDate, setSelectedDate] = useState<string>(maxSelectableDate);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDemographics(projectCode, periodMonth, dim, selectedDate)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e.message ?? "Lỗi tải dữ liệu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode, periodMonth, dim, selectedDate]);

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
        <label className="sort-select">
          <span className="sort-select-label">Dữ liệu ngày</span>
          <input
            type="date"
            className="date-range-input"
            value={selectedDate}
            max={maxSelectableDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2 two-thirds">
        <article className="card">
          <div className="card-head"><div><small>Volume</small><h3>Impressions theo {label}</h3></div></div>
          <div className="chart-wrap large">
            <VolumeBarChart
                labels={breakdown.map((b) => b.label)}
                impressions={breakdown.map((b) => b.impressions)}
                reach={breakdown.map((b) => b.reach)}
                googleImpressions={breakdown.map((b) => b.googleImpressions)}
                metaImpressions={breakdown.map((b) => b.metaImpressions)}
            />
          </div>
        </article>
        <article className="card">
          <div className="card-head"><div><small>Rate</small><h3>CTR theo {label}</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart
            labels={breakdown.map((b) => b.label)}
            ctr={breakdown.map((b) => Number(b.ctr.toFixed(2)))}
            googleCtr={breakdown.map((b) => Number(b.googleCtr.toFixed(2)))}
            metaCtr={breakdown.map((b) => Number(b.metaCtr.toFixed(2)))}
            />
          </div>
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