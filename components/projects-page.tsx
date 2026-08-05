"use client"

import { useState } from "react"
import { Building2, CalendarRange, FolderPlus, Info, Plus, Trash2, X } from "lucide-react"
import type { BillingModel, NewProject, Project, ProjectStatus } from "@/lib/projects"

function StatusPill({ status }: { status: ProjectStatus }) {
  const cls = status === "Active" ? "good" : status === "Planning" ? "warn" : "neutral"
  return <span className={`pill ${cls}`}>{status}</span>
}

function fmt(date: string) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" })
}

export function ProjectsPage({
  projects,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: {
  projects: Project[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (data: NewProject) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const activeProject = projects.find((p) => p.id === activeId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    if (!name) return
    onCreate({
      name,
      client: String(form.get("client") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || "Google Ads + Meta Ads",
      startDate: String(form.get("startDate") ?? ""),
      endDate: String(form.get("endDate") ?? ""),
      status: (String(form.get("status") ?? "Active") as ProjectStatus) || "Active",
      billingModel: (String(form.get("billingModel") ?? "transparent") as BillingModel) || "transparent",
    })
    setOpen(false)
  }

  return (
    <>
      <div className="hero project-hero">
        <div>
          <span className="eyebrow">
            <FolderPlus size={13} /> Project workspace
          </span>
          <h2>Quản trị nhiều chiến dịch, mỗi project có plan và dữ liệu riêng.</h2>
          <p>
            Tạo project cho từng khách hàng hoặc campaign. Khi chuyển project, toàn bộ YTD/MTD plan, Google raw data và Meta raw data được
            tách biệt.
          </p>
        </div>
        <button type="button" className="hero-action" onClick={() => setOpen(true)}>
          <Plus size={16} /> Tạo project mới
        </button>
      </div>

      <div className="project-toolbar">
        <div>
          <h3>Danh sách project</h3>
          <p>
            Project đang mở: <strong>{activeProject?.name ?? "—"}</strong>
          </p>
        </div>
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="project-grid">
        {projects.map((p) => {
          const isActive = p.id === activeId
          return (
            <article key={p.id} className={`project-card ${isActive ? "active" : ""}`}>
              <div className="project-card-head">
                <div className="workspace-logo">{p.name.charAt(0).toUpperCase()}</div>
                <StatusPill status={p.status} />
              </div>
              <h3>{p.name}</h3>
              {p.client && (
                <div className="project-meta">
                  <Building2 size={14} /> {p.client}
                </div>
              )}
              <p className="project-desc">{p.description}</p>
              <div className="project-meta">
                <CalendarRange size={14} /> {fmt(p.startDate)} – {fmt(p.endDate)}
              </div>
              <div className="project-meta">
                <Info size={14} /> {p.billingModel === "transparent" ? "Transparency" : "Non-transparency"}
              </div>
              <div className="project-card-actions">
                <button type="button" className="primary-button" disabled={isActive} onClick={() => onSelect(p.id)}>
                  {isActive ? "Đang mở" : "Mở project"}
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label={`Xóa ${p.name}`}
                  onClick={() => onDelete(p.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <small>New workspace</small>
                <h3>Tạo project mới</h3>
              </div>
              <button type="button" className="icon-btn" aria-label="Đóng" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="project-form" onSubmit={handleSubmit}>
              <label>
                <span>Tên project *</span>
                <input name="name" required placeholder="VD: Smecta 2026 Campaign" />
              </label>
              <label>
                <span>Khách hàng</span>
                <input name="client" placeholder="VD: Ipsen Vietnam" />
              </label>
              <label className="full">
                <span>Mô tả / kênh triển khai</span>
                <input name="description" placeholder="Google Ads + Meta Ads" />
              </label>
              <label>
                <span>Ngày bắt đầu</span>
                <input name="startDate" type="date" />
              </label>
              <label>
                <span>Ngày kết thúc</span>
                <input name="endDate" type="date" />
              </label>
              <label>
                <span>Trạng thái</span>
                <select name="status" defaultValue="Active">
                  <option>Active</option>
                  <option>Planning</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                <span>Mô hình chi phí</span>
                <select name="billingModel" defaultValue="transparent">
                  <option value="transparent">Transparency — dùng actual spend</option>
                  <option value="non-transparent">Non-transparency — dùng unit cost plan</option>
                </select>
              </label>
              <div className="full model-note">
                <Info size={16} />
                <span>
                  Transparency hiển thị chi phí thực tế từ nền tảng. Non-transparency ước tính spending từ delivery thực tế × unit cost
                  trong plan.
                </span>
              </div>
              <div className="modal-actions full">
                <button type="button" className="ghost-button" onClick={() => setOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="primary-button">
                  <Plus size={15} /> Tạo và mở project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
