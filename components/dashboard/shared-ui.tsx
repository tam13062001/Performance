"use client";

import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import type { AlertRow, Verdict } from "@/lib/dashboard-data";
import type { RangeDays } from "./types";

export function AlertLine({ row }: { row: AlertRow }) {
  return (
    <p className="alert-line">
      {row.region} - {row.channel} - {row.buyingType} - {row.asset} - {row.statusLabel}
    </p>
  );
}

export function DateRangeTabs({ value, onChange }: { value: RangeDays; onChange: (v: RangeDays) => void }) {
  const options: RangeDays[] = [7, 14, 30, 90];
  return (
    <div className="tabs" style={{ gap: 4 }}>
      {options.map((d) => (
        <button
          key={d}
          type="button"
          className={`tab ${value === d ? "active" : ""}`}
          onClick={() => onChange(d)}
        >
          {d} ngày
        </button>
      ))}
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  minDate,
  maxDate,
  onChangeFrom,
  onChangeTo,
}: {
  from: string;
  to: string;
  minDate?: string;
  maxDate?: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
}) {
  return (
    <div className="date-range-picker">
      <input
        type="date"
        className="date-range-input"
        value={from}
        min={minDate}
        max={to || maxDate}
        onChange={(e) => onChangeFrom(e.target.value)}
      />
      <span className="date-range-arrow">→</span>
      <input
        type="date"
        className="date-range-input"
        value={to}
        min={from || minDate}
        max={maxDate}
        onChange={(e) => onChangeTo(e.target.value)}
      />
    </div>
  );
}

export function VerdictChip({ v }: { v: Verdict }) {
  const cls = v === "Đạt" ? "good" : v === "Cảnh báo" ? "warn" : v === "Chưa đạt" ? "bad" : "neutral";
  return <span className={`pill ${cls}`}>{v}</span>;
}

export function PlatformChip({ p }: { p: string }) {
  const upper = (p || "").toUpperCase();
  const google = ["SEM", "ADX", "YOUTUBE"].includes(upper);
  const meta = ["FACEBOOK", "INSTAGRAM", "TIKTOK"].includes(upper);
  const label = google ? "Google" : meta ? "Meta" : p;
  const cls = google ? "good" : meta ? "warn" : "neutral";
  return <span className={`pill ${cls}`}>{label}</span>;
}

// Chip riêng cho platform dạng "google" | "meta" (khác PlatformChip vốn nhận tên channel như SEM/FACEBOOK...)
export function DemoPlatformChip({ p }: { p: "google" | "meta" }) {
  const cls = p === "google" ? "good" : "warn";
  const label = p === "google" ? "Google" : "Meta";
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function NotAvailableNotice({ what }: { what: string }) {
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

export function PaginationControls({
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