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
 * tên tháng thật, KHÔNG phải chuỗi tháng UI cũ). Trả kèm trạng thái loading/error
 * để component tự quyết định hiển thị skeleton hay thông báo lỗi.
 */
export function usePlanData(projectCode: string, periodMonth: string) {
  const [data,setData] = useState<DataStatusRow[]>([]);
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

// Trong file chứa hook usePlanData
  // Sửa 'delivery' thành 'data' ở 3 dòng này:
  const kpis = useMemo(() => overviewKpis(data), [data]);
  const signals = useMemo(() => overviewSignals(data), [data]);
  const score = useMemo(() => performanceScore(data), [data]);
  
  // Dòng này giữ nguyên như bạn đã sửa:
  const campaignRows = useMemo(() => campaignDeliveryRows(data), [data]); 
  
  const planRows = useMemo(() => planSummary(plan), [plan]);
  
  const biz = (dim: BusinessDimension) => businessBreakdown(dim, report);

  return { data, delivery, report, plan, loading, error, kpis, signals, score, campaignRows, planRows, biz };
}
