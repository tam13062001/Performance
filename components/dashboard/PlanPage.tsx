"use client";

import { Info } from "lucide-react";
import { num, vnd } from "@/lib/dashboard-data";
import { usePlanData, usePagination } from "./hooks";
import { PaginationControls } from "./shared-ui";

export function PlanPage({ projectCode, periodMonth }: { projectCode: string; periodMonth: string }) {
  const { loading, planRows } = usePlanData(projectCode, periodMonth);

  const { currentPage, setCurrentPage, totalPages, currentData: pagedPlanRows } = usePagination(planRows, 10);

  if (loading) return <div className="notice"><Info size={18} /><div><b>Đang tải dữ liệu…</b></div></div>;

  return (
    <>
      <div className="notice">
        <Info size={20} />
        <div>
          <b>Media plan lấy trực tiếp từ ad_unit_cost_plan.</b>
          <p>Không còn suy luận taxonomy từ tên campaign — region/phase/channel/buying_type đã là cột thật trong DB.</p>
        </div>
      </div>

      <article className="card">
        <div className="card-head">
          <div><small>Media plan</small><h3>Plan · {periodMonth}</h3></div>
          <span className="chip-config">ad_unit_cost_plan</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Location</th><th>Phase</th><th>Channel</th><th>Buying type</th><th className="right">Unit cost</th><th className="right">Quantity</th><th className="right">Budget</th></tr>
            </thead>
            <tbody>
              {pagedPlanRows.map((p, i) => (
                <tr key={i}>
                  <td>{p.region}</td><td>{p.phase}</td><td>{p.channel}</td><td>{p.buyingType}</td>
                  <td className="right">{vnd(p.unitCost)}</td><td className="right">{num(p.quantity)}</td><td className="right">{vnd(p.budget)}</td>
                </tr>
              ))}
              {pagedPlanRows.length === 0 && <tr><td colSpan={7}>Chưa có plan cho kỳ này.</td></tr>}
            </tbody>
          </table>
          <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </article>
    </>
  );
}