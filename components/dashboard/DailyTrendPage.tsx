"use client";

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { num, pct, vnd, ctrOf, dailyTrend, filterDailyByRange } from "@/lib/dashboard-data";
import { VolumeEfficiencyChart } from "../charts";
import { useDailyMetrics, usePagination } from "./hooks";
import { classifyChannel, aggregateByCampaign, formatDateVN } from "./utils";
import { DateRangeTabs, DateRangePicker, PlatformChip, PaginationControls } from "./shared-ui";
import type { RangeDays, SortMetric } from "./types";

export function DailyTrendPage({ projectCode }: { projectCode: string }) {
  const { rows, loading, error } = useDailyMetrics(projectCode);
  const [channelFilter, setChannelFilter] = useState<"all" | "google" | "meta">("all");

  // sort bảng chi tiết: theo channel trước, rồi theo metric đã chọn
  const [sortMetric, setSortMetric] = useState<SortMetric>("impressions");

  // chart: chọn theo số ngày gần nhất
  const [chartRangeDays, setChartRangeDays] = useState<RangeDays>(30);

  // bảng raw: chọn theo khoảng ngày cụ thể
  const [tableFromDate, setTableFromDate] = useState<string>("");
  const [tableToDate, setTableToDate] = useState<string>("");

  const { minDate, maxDate } = useMemo(() => {
    if (rows.length === 0) return { minDate: undefined, maxDate: undefined };
    const dates = rows.map((r) => r.report_date).sort();
    return { minDate: dates[0], maxDate: dates[dates.length - 1] };
  }, [rows]);

  useEffect(() => {
    if (maxDate && !tableToDate) {
      setTableToDate(maxDate);
      const d = new Date(maxDate);
      d.setDate(d.getDate() - 29);
      const defaultFrom = d.toISOString().slice(0, 10);
      setTableFromDate(minDate && defaultFrom < minDate ? minDate : defaultFrom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDate]);

  const channelFilteredRows = useMemo(
    () => (channelFilter === "all" ? rows : rows.filter((r) => classifyChannel(r.channel) === channelFilter)),
    [rows, channelFilter]
  );

  // Data cho chart: N ngày gần nhất
  const allPoints = useMemo(() => dailyTrend(channelFilteredRows), [channelFilteredRows]);
  const points = useMemo(() => allPoints.slice(-chartRangeDays), [allPoints, chartRangeDays]);

  // Data cho bảng: theo khoảng ngày cụ thể
  const tableRows = useMemo(
    () => filterDailyByRange(channelFilteredRows, tableFromDate || undefined, tableToDate || undefined),
    [channelFilteredRows, tableFromDate, tableToDate]
  );

  // Gộp theo campaign trong khoảng ngày đã chọn, tránh liệt kê raw rows gây confuse
  // (nhiều dòng cùng campaign nhưng khác report_date bị ẩn cột ngày -> nhìn như duplicate)
  const aggregatedRows = useMemo(() => aggregateByCampaign(tableRows), [tableRows]);

  const sortedRows = useMemo(
    () =>
      [...aggregatedRows].sort((a, b) => {
        const channelCompare = a.channel.localeCompare(b.channel);
        if (channelCompare !== 0) return channelCompare;
        if (sortMetric === "ctr") {
          return ctrOf(b.impressions, b.clicks) - ctrOf(a.impressions, a.clicks);
        }
        return b[sortMetric] - a[sortMetric];
      }),
    [aggregatedRows, sortMetric]
  );
  const { currentPage, setCurrentPage, totalPages, currentData: pagedRows } = usePagination(sortedRows, 20);

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

  return (
    <>
      <div className="page-toolbar">
        <div className="tabs">
          <button type="button" className={`tab ${channelFilter === "all" ? "active" : ""}`} onClick={() => setChannelFilter("all")}>
            Tất cả kênh
          </button>
          <button type="button" className={`tab ${channelFilter === "meta" ? "active" : ""}`} onClick={() => setChannelFilter("meta")}>
            Meta
          </button>
          <button type="button" className={`tab ${channelFilter === "google" ? "active" : ""}`} onClick={() => setChannelFilter("google")}>
            Google
          </button>
        </div>
      </div>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Xu hướng theo ngày</small>
            <h3>Impressions, CTR &amp; Frequency theo report_date</h3>
          </div>
          <DateRangeTabs value={chartRangeDays} onChange={setChartRangeDays} />
        </div>
        {points.length === 0 ? (
          <div className="notice"><Info size={18} /><div><b>Chưa có dữ liệu cho khoảng ngày này.</b></div></div>
        ) : (
          <div className="chart-wrap large">
            <VolumeEfficiencyChart
              labels={points.map((p) => p.date)}
              impressions={points.map((p) => p.impressions)}
              ctr={points.map((p) => Number(p.ctr.toFixed(2)))}
              frequency={points.map((p) => Number(p.frequency.toFixed(2)))}
            />
          </div>
        )}
      </article>

      <article className="card">
        <div className="card-head">
          <div>
            <small>Bảng chi tiết</small>
            <h3>Dữ liệu theo campaign</h3>
            {tableFromDate && tableToDate && (
              <p className="range-note">
                Tổng từ {formatDateVN(tableFromDate)} đến {formatDateVN(tableToDate)}
              </p>
            )}
          </div>
          <div className="table-controls">
            <label className="sort-select">
              <span className="sort-select-label">Sắp xếp theo</span>
              <select value={sortMetric} onChange={(e) => setSortMetric(e.target.value as SortMetric)}>
                <option value="impressions">Impressions</option>
                <option value="reach">Reach</option>
                <option value="clicks">Clicks</option>
                <option value="engagements">Engagements</option>
                <option value="spend">Spend</option>
                <option value="ctr">CTR</option>
              </select>
            </label>
            <DateRangePicker
              from={tableFromDate}
              to={tableToDate}
              minDate={minDate}
              maxDate={maxDate}
              onChangeFrom={setTableFromDate}
              onChangeTo={setTableToDate}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Channel</th><th>Campaign</th><th>Phase</th>
                <th className="right">Impressions</th><th className="right">Reach</th>
                <th className="right">Clicks</th><th className="right">Engagements</th>
                <th className="right">Spend</th><th className="right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id}>
                  <td><PlatformChip p={r.channel} /></td>
                  <td className="mono" title={r.campaign_name}>{r.campaign_name}</td>
                  <td>{r.phase}</td>
                  <td className="right">{num(r.impressions)}</td>
                  <td className="right" title="Tổng cộng dồn theo ngày, có thể trùng user giữa các ngày">
                    {num(r.reach)}
                  </td>
                  <td className="right">{num(r.clicks)}</td>
                  <td className="right">{num(r.engagements)}</td>
                  <td className="right">{vnd(r.spend)}</td>
                  <td className="right">{pct(ctrOf(r.impressions, r.clicks))}</td>
                </tr>
              ))}
              {pagedRows.length === 0 && <tr><td colSpan={9}>Chưa có data.</td></tr>}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </article>
    </>
  );
}