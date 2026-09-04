"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadDailyMetrics,
  loadChannelRawData,
  loadDeliveryStatus,
  loadReport,
  loadUnitCostPlan,
  loadDataStatus,
  fillMissingDeliveryStatus,
  overviewKpis,
  overviewSignals,
  performanceScore,
  campaignDeliveryRows,
  planSummary,
  businessBreakdown,
  loadAvailableMonths as fetchAvailableMonths,
  type DailyMetricRow,
  type DataStatusRow,
  type DeliveryStatusRow,
  type ReportRow,
  type UnitCostPlanRow,
  type BusinessDimension,
} from "@/lib/dashboard-data";
import type { DbProject } from "./types";

/* ---------------- Daily metrics hook (ad_daily_metrics) ---------------- */
export function useDailyMetrics(projectCode: string) {
  const [rows, setRows] = useState<DailyMetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDailyMetrics(projectCode)
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e.message ?? "Lỗi tải dữ liệu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectCode]);

  return { rows, loading, error };
}

export function useDbProjects() {
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

export function useChannelRawData(projectCode: string, platform: "Google" | "Meta" | "Youtube") {
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

/* ---------------- Pagination hook ---------------- */
export function usePagination<T>(data: T[], itemsPerPage = 10) {
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