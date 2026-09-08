"use client";

import { useMemo } from "react";
import { Info, Sparkles } from "lucide-react";
import {
  num,
  pct,
  freqOf,
  businessBreakdown,
} from "@/lib/dashboard-data";
import { KpiCards } from "../kpi-card";
import { ChannelDoughnut, RateLineChart, VolumeBarChart, VolumeEfficiencyChart, type ChannelSlice } from "../charts";
import { usePlanData, useDailyMetrics, usePagination } from "./hooks";
import { VerdictChip, PaginationControls } from "./shared-ui";

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
    </article>
  );
}

type FunnelStageTone = "impressions" | "engagement" | "clicks";

type PerformanceFunnelProps = {
  impressions: number;
  engagements: number;
  clicks: number;
};

function PerformanceFunnel({ impressions, engagements, clicks }: PerformanceFunnelProps) {
  const stages: Array<{ label: string; value: number; tone: FunnelStageTone }> = [
    { label: "Total impressions", value: impressions, tone: "impressions" },
    { label: "Total engagement", value: engagements, tone: "engagement" },
    { label: "Total clicks", value: clicks, tone: "clicks" },
  ];
  const rateOf = (value: number, base: number) => (base > 0 ? (value / base) * 100 : 0);
  const rates = [
    { label: "Engagement rate", value: rateOf(engagements, impressions), tone: "engagement" },
    { label: "CTR", value: rateOf(clicks, impressions), tone: "impressions" },
    { label: "Click-to-engagement", value: rateOf(clicks, engagements), tone: "clicks" },
  ];
  const conversionAnnotations = [
    { label: "CTR", value: rateOf(clicks, impressions), tone: "impressions" },
    { label: "Tỷ lệ chuyển đổi", value: rateOf(clicks, engagements), tone: "clicks" },
  ];

  return (
    <div className="performance-funnel">
      <ol className="performance-funnel-metrics" aria-label="Tổng quan hiệu quả chuyển đổi">
        {stages.map((stage, index) => (
          <li className={`performance-funnel-metric ${stage.tone}`} key={stage.tone}>
            <span className="performance-funnel-metric-marker" aria-hidden="true">
              {index + 1}
            </span>
            <span className="performance-funnel-metric-copy">
              <span className="performance-funnel-metric-label">{stage.label}</span>
              <strong>{num(stage.value)}</strong>
            </span>
          </li>
        ))}
      </ol>

      <div className="performance-funnel-visual-wrap">
        <ol className="performance-funnel-visual" aria-hidden="true">
          {stages.map((stage) => (
            <li className={`performance-funnel-stage ${stage.tone}`} key={stage.tone}>
              <span>{stage.label}</span>
              <strong>{num(stage.value)}</strong>
            </li>
          ))}
        </ol>
        <ol className="performance-funnel-annotations" aria-label="Tỷ lệ chuyển đổi giữa các tầng">
          {conversionAnnotations.map((annotation, index) => (
            <li className={`performance-funnel-annotation ${annotation.tone}`} key={annotation.label}>
              <span className="performance-funnel-annotation-bracket" aria-hidden="true">
                <span className="performance-funnel-annotation-arrow" />
              </span>
              <span className="performance-funnel-annotation-copy">
                <span>{annotation.label}</span>
                <strong>{pct(annotation.value)}</strong>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <dl className="performance-funnel-rates" aria-label="Tỷ lệ chuyển đổi">
        {rates.map((rate) => (
          <div className={`performance-funnel-rate ${rate.tone}`} key={rate.label}>
            <dt>{rate.label}</dt>
            <dd>{pct(rate.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------------- Campaign Overview ---------------- */
export function OverviewPage({ projectCode, periodMonth, planView }: { projectCode: string; periodMonth: string; planView: "MTD" | "YTD" }) {
  const { loading, error, kpis, signals, score, campaignRows, data } = usePlanData(projectCode, periodMonth);

  const bizRows = useMemo(() => businessBreakdown("phase", data), [data]);
  const performanceTotals = useMemo(
    () =>
      data.reduce(
        (totals, row) => ({
          impressions: totals.impressions + (row.impressions ?? 0),
          engagements: totals.engagements + (row.engagements ?? 0),
          clicks: totals.clicks + (row.clicks ?? 0),
        }),
        { impressions: 0, engagements: 0, clicks: 0 },
      ),
    [data],
  );

  // Daily trend từ ad_daily_metrics (chart hiện đang comment ở dưới, giữ hook
  // để không phá vỡ nếu bật lại card daily trend trong tương lai).
  const { rows: dailyRows, loading: dailyLoading } = useDailyMetrics(projectCode);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedCampaignRows } = usePagination(campaignRows, 10);

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;
  if (error) return <div className="notice"><Info size={18} /><div><b>Lỗi tải dữ liệu</b><p>{error}</p></div></div>;

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
        </article>

        <article className="card">
          <div className="card-head">
            <div><small>EFFICIENCY TREND</small><h3>CTR &amp; Frequency theo Phase</h3></div>
            <span className="chip-config">Dual axis</span>
          </div>
          <div className="chart-wrap">
            <RateLineChart labels={bizRows.map((b) => b.label)} ctr={bizRows.map((b) => Number(b.ctr.toFixed(2)))} frequency={bizRows.map((b) => Number(freqOf(b.impressions, b.reach).toFixed(2)))} />
          </div>
        </article>
      </div>

      <PhaseEfficiencyCard bizRows={bizRows} />

      {/* Daily trend (ad_daily_metrics) — giữ comment y nguyên như bản gốc,
          đã có trang riêng DailyTrendPage nên card này tắt ở Overview. */}
      {/* <article className="card">
        <div className="card-head">
          <div>
            <small>Xu hướng theo ngày</small>
            <h3>Impressions, CTR &amp; Frequency theo report_date</h3>
          </div>
          <span className="chip-config">ad_daily_metrics</span>
        </div>
        {dailyLoading ? (
          <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu daily…</b></div></div>
        ) : dailyPoints.length === 0 ? (
          <div className="notice"><Info size={18} /><div><b>Chưa có dữ liệu daily.</b></div></div>
        ) : (
          <div className="chart-wrap large">
            <VolumeEfficiencyChart
              labels={dailyPoints.map((p) => p.date)}
              impressions={dailyPoints.map((p) => p.impressions)}
              ctr={dailyPoints.map((p) => Number(p.ctr.toFixed(2)))}
              frequency={dailyPoints.map((p) => Number(p.frequency.toFixed(2)))}
            />
          </div>
        )}
      </article> */}

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
            <div>
              <small>PERFORMANCE SIGNALS</small>
              <h3>Hiệu quả chuyển đổi</h3>
            </div>
          </div>
          <PerformanceFunnel
            impressions={performanceTotals.impressions}
            engagements={performanceTotals.engagements}
            clicks={performanceTotals.clicks}
          />
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