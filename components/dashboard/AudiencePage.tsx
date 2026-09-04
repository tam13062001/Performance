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

// Tìm ngày có data gần nhất so với ngày mong muốn (`target`), ưu tiên ngày
// <= target (data "gần nhất trong quá khứ"); nếu không có ngày nào <= target
// thì lấy ngày sớm nhất đang có. `dates` phải sort tăng dần.
function nearestAvailableDate(target: string, dates: string[]): string | null {
  if (dates.length === 0) return null;
  let candidate: string | null = null;
  for (const d of dates) {
    if (d <= target) candidate = d;
    else break;
  }
  return candidate ?? dates[0];
}

export function AudiencePage({ projectCode, periodMonth }: { projectCode: string; periodMonth: string }) {
  const [dim, setDim] = useState<"age" | "gender" | "region">("age");
  const [view, setView] = useState<"value" | "campaign">("value");
  // Toàn bộ rows của dim hiện tại (KHÔNG lọc theo report_date) — dùng để vừa
  // suy ra danh sách ngày có data, vừa lọc lại theo selectedDate ở client
  // mà không cần gọi API lần 2.
  const [allRows, setAllRows] = useState<DemographicRow[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]); // ISO date, sort tăng dần
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // null = "chưa xác định" — tự set về ngày mới nhất có data ngay khi tải xong.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Ngày mới nhất đang thực sự có data — dùng làm mặc định VÀ làm giới hạn
  // `max` của date picker, thay vì tính cứng "hôm qua" không liên quan gì
  // đến dữ liệu sync thật.
  const latestAvailableDate = availableDates.length > 0 ? availableDates[availableDates.length - 1] : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Lấy toàn bộ data của dim này (không truyền reportDate) để biết chính
    // xác ngày nào thực sự có data.
    loadDemographics(projectCode, periodMonth, dim)
      .then((all) => {
        if (cancelled) return;
        const dates = Array.from(
          new Set(all.map((r) => r.report_date).filter((d): d is string => !!d))
        ).sort();
        setAvailableDates(dates);
        setAllRows(all);

        setSelectedDate((prev) => {
          // Ngày đang chọn vẫn có data cho dim mới → giữ nguyên.
          if (prev && dates.includes(prev)) return prev;
          // Ngược lại, mặc định về ngày mới nhất đang có data.
          const latest = dates.length > 0 ? dates[dates.length - 1] : null;
          if (!latest) return prev;
          return prev ? nearestAvailableDate(prev, dates) ?? latest : latest;
        });
      })
      .catch((e) => !cancelled && setError(e.message ?? "Lỗi tải dữ liệu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode, periodMonth, dim]);

  // Lọc lại theo ngày đang chọn ngay trên client — không cần fetch lại API.
  const rows = useMemo(
    () => (selectedDate ? allRows.filter((r) => r.report_date === selectedDate) : []),
    [allRows, selectedDate]
  );

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

  // Người dùng tự chọn 1 ngày trên date picker mà ngày đó không có data →
  // tự fallback về ngày gần nhất có data thay vì để trắng trang.
  function handleDateChange(next: string) {
    if (availableDates.includes(next)) {
      setSelectedDate(next);
      return;
    }
    setSelectedDate(nearestAvailableDate(next, availableDates) ?? next);
  }

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
            value={selectedDate ?? ""}
            max={latestAvailableDate ?? undefined}
            onChange={(e) => handleDateChange(e.target.value)}
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