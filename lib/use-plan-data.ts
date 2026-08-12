"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadDeliveryStatus,
  loadDataStatus,
  loadUnitCostPlan,
  loadReport,
  loadAvailableMonths,
  overviewKpis,
  businessBreakdown,
  campaignDeliveryRows,
  overviewSignals,
  performanceScore,
  planSummary,
  fillMissingDeliveryStatus,
  type DataStatusRow,
  type DeliveryStatusRow,
  type ReportRow,
  type UnitCostPlanRow,
  type BusinessDimension,
} from "./dashboard-data";

export function useAvailableMonths(projectCode: string) {
  const [months, setMonths] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadAvailableMonths(projectCode)
      .then((m) => !cancelled && setMonths(m))
      .catch((e) => console.error("loadAvailableMonths:", e));
    return () => {
      cancelled = true;
    };
  }, [projectCode]);
  return months;
}

/**
 * Fetch delivery/report/plan cho 1 project + 1 kỳ (period_month = 'YTD' hoặc
 * tên tháng thật). Nếu ad_raw_data thiếu delivery_status/cost_status (một số
 * sheet YTD_DATA Excel không có 2 cột này), tự động fallback lấy từ
 * ad_delivery_status (match theo region/phase/channel/buying_type/asset).
 */
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

  // Data đã được "vá" status từ ad_delivery_status khi ad_raw_data thiếu
  const mergedData = useMemo(() => fillMissingDeliveryStatus(data, delivery), [data, delivery]);

  const kpis = useMemo(() => overviewKpis(mergedData), [mergedData]);
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