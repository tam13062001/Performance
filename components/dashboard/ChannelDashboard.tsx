"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Search, Share2, SquarePlay } from "lucide-react";
import {
  num,
  pct,
  vnd,
  loadExecutionRows,
  channelKpis,
  loadDemographics,
  aggregateDemographic,
  aggregateDemographicByCampaignDetail,
  type DemographicRow,
} from "@/lib/dashboard-data";
import { KpiCards } from "../kpi-card";
import { VolumeBarChart, RateLineChart } from "../charts";
import { useChannelRawData, usePagination } from "./hooks";
import { currentMonthAbbrClient } from "./utils";
import { NotAvailableNotice, PaginationControls } from "./shared-ui";
import { demoTabs } from "./constants";

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
        </article>

        <article className="card mt-2">
          <div className="card-head"><div><small>Efficiency</small><h3>CTR</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart
              labels={rows.map((r) => r.name)}
              ctr={rows.map((r) => Number(r.ctr.toFixed(2)))}
            />
          </div>
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
        </article>
        <article className="card">
          <div className="card-head"><div><small>Rate</small><h3>CTR theo {label} · {platform}</h3></div></div>
          <div className="chart-wrap large">
            <RateLineChart labels={breakdown.map((b) => b.label)} ctr={breakdown.map((b) => Number(b.ctr.toFixed(2)))} />
          </div>
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