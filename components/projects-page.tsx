"use client"

import { useState } from "react"
import { Building2, CalendarRange, FolderPlus, Info, Link2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import type { BillingModel, NewProject, Project, ProjectStatus } from "@/lib/projects"

function StatusPill({ status }: { status: ProjectStatus }) {
  const cls = status === "Active" ? "good" : status === "Planning" ? "warn" : "neutral"
  return <span className={`pill ${cls}`}>{status}</span>
}

function fmt(date: string) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" })
}

function readProjectFields(form: FormData): NewProject {
  return {
    name: String(form.get("name") ?? "").trim(),
    client: String(form.get("client") ?? "").trim(),
    description: String(form.get("description") ?? "").trim() || "Google Ads + Meta Ads",
    startDate: String(form.get("startDate") ?? ""),
    endDate: String(form.get("endDate") ?? ""),
    status: (String(form.get("status") ?? "Active") as ProjectStatus) || "Active",
    billingModel: (String(form.get("billingModel") ?? "transparent") as BillingModel) || "transparent",
  }
}

export function ProjectsPage({
  projects,
  activeId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: {
  projects: Project[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (data: NewProject & { projectCode: string; sheetUrl: string }) => Promise<Project | void> 
  onEdit: (code: string, data: NewProject) => Promise<void>
  onDelete: (id: string, force?: boolean) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingForceDeleteId, setPendingForceDeleteId] = useState<string | null>(null)

  const activeProject = projects.find((p) => p.id === activeId)

  const isEditing = editingProject !== null
  const modalOpen = open || isEditing

  function closeModal() {
    if (submitting) return
    setOpen(false)
    setEditingProject(null)
    setError(null)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const fields = readProjectFields(form)
    const projectCode = String(form.get("projectCode") ?? "").trim()
    const sheetUrl = String(form.get("sheetUrl") ?? "").trim()
    if (!fields.name || !projectCode || !sheetUrl) return

    setSubmitting(true)
    try {
      await onCreate({ ...fields, projectCode, sheetUrl })
      closeModal()
    } catch (e: any) {
      setError(e.message ?? "Không tạo được project")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingProject) return
    setError(null)
    const form = new FormData(e.currentTarget)
    const fields = readProjectFields(form)
    if (!fields.name) return

    setSubmitting(true)
    try {
      await onEdit(editingProject.code, fields)
      closeModal()
    } catch (e: any) {
      setError(e.message ?? "Không cập nhật được project")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteClick(p: Project) {
    setDeleteError(null)
    setDeletingId(p.id)
    try {
      await onDelete(p.id, false)
    } catch (e: any) {
      const msg: string = e.message ?? "Không xóa được project"
      // API trả lỗi 409 kèm gợi ý force=true khi project còn data
      if (msg.includes("còn") && msg.includes("dữ liệu")) {
        setPendingForceDeleteId(p.id)
        setDeleteError(msg)
      } else {
        setDeleteError(msg)
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleForceDelete(p: Project) {
    setDeleteError(null)
    setDeletingId(p.id)
    try {
      await onDelete(p.id, true)
      setPendingForceDeleteId(null)
    } catch (e: any) {
      setDeleteError(e.message ?? "Không xóa được project")
    } finally {
      setDeletingId(null)
    }
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

      {deleteError && (
        <div className="notice error" style={{ marginBottom: 16 }}>
          <Info size={18} />
          <div>
            <b>Không xóa được project</b>
            <p>{deleteError}</p>
          </div>
        </div>
      )}

      <div className="project-grid">
        {projects.map((p) => {
          const isActive = p.id === activeId
          const isDeleting = deletingId === p.id
          const needsForceConfirm = pendingForceDeleteId === p.id
          return (
            <article key={p.id} className={`project-card ${isActive ? "active" : ""}`}>
              <div className="project-card-head">
                <div className="workspace-logo">{p.name.charAt(0).toUpperCase()}</div>
                <StatusPill status={p.status} />
              </div>
              <h3>{p.name}</h3>
              {p.code && (
                <div className="project-meta">
                  <Link2 size={14} /> {p.code}
                </div>
              )}
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

              {needsForceConfirm && (
                <div className="upload-status error" style={{ marginBottom: 8 }}>
                  Project còn dữ liệu. Bấm "Xóa hết dữ liệu" để xóa toàn bộ, hoặc bỏ qua.
                </div>
              )}

              <div className="project-card-actions">
                <button type="button" className="primary-button" disabled={isActive} onClick={() => onSelect(p.id)}>
                  {isActive ? "Đang mở" : "Mở project"}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Sửa ${p.name}`}
                  onClick={() => setEditingProject(p)}
                >
                  <Pencil size={15} />
                </button>
                {!needsForceConfirm ? (
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Xóa ${p.name}`}
                    disabled={isDeleting}
                    onClick={() => handleDeleteClick(p)}
                  >
                    {isDeleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Xóa hết dữ liệu ${p.name}`}
                    disabled={isDeleting}
                    onClick={() => handleForceDelete(p)}
                    title="Xóa cả project và toàn bộ dữ liệu liên quan"
                  >
                    {isDeleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <small>{isEditing ? "Edit workspace" : "New workspace"}</small>
                <h3>{isEditing ? `Sửa project · ${editingProject?.code}` : "Tạo project mới"}</h3>
              </div>
              <button type="button" className="icon-btn" aria-label="Đóng" onClick={closeModal} disabled={submitting}>
                <X size={16} />
              </button>
            </div>
            <form className="project-form" onSubmit={isEditing ? handleEditSubmit : handleCreate}>
              <label>
                <span>Tên project *</span>
                <input name="name" required placeholder="VD: Smecta 2026 Campaign" defaultValue={editingProject?.name} />
              </label>

              {!isEditing && (
                <>
                  <label>
                    <span>Project code *</span>
                    <input name="projectCode" required placeholder="VD: SMECTA2026" style={{ textTransform: "uppercase" }} />
                  </label>
                  <label className="full">
                    <span>Google Sheet URL *</span>
                    <input name="sheetUrl" type="url" required placeholder="https://docs.google.com/spreadsheets/d/.../edit" />
                  </label>
                </>
              )}
              {isEditing && (
                <div className="full project-meta">
                  <Link2 size={14} /> Project code: <b>{editingProject?.code}</b> (không thể đổi ở đây)
                </div>
              )}

              <label>
                <span>Khách hàng</span>
                <input name="client" placeholder="VD: Ipsen Vietnam" defaultValue={editingProject?.client} />
              </label>
              <label className="full">
                <span>Mô tả / kênh triển khai</span>
                <input name="description" placeholder="Google Ads + Meta Ads" defaultValue={editingProject?.description} />
              </label>
              <label>
                <span>Ngày bắt đầu</span>
                <input name="startDate" type="date" defaultValue={editingProject?.startDate} />
              </label>
              <label>
                <span>Ngày kết thúc</span>
                <input name="endDate" type="date" defaultValue={editingProject?.endDate} />
              </label>
              <label>
                <span>Trạng thái</span>
                <select name="status" defaultValue={editingProject?.status ?? "Active"}>
                  <option>Active</option>
                  <option>Planning</option>
                  <option>Completed</option>
                </select>
              </label>
              <label>
                <span>Mô hình chi phí</span>
                <select name="billingModel" defaultValue={editingProject?.billingModel ?? "transparent"}>
                  <option value="transparent">Transparency — dùng actual spend</option>
                  <option value="non-transparent">Non-transparency — dùng unit cost plan</option>
                </select>
              </label>

              {!isEditing && (
                <div className="full model-note">
                  <Info size={16} />
                  <span>
                    Sheet cần được share Viewer cho service account đồng bộ dữ liệu — hệ thống sẽ tự kiểm tra khi bạn bấm "Tạo project".
                    Project code sẽ dùng để liên kết dữ liệu trong ad_projects và sync_projects.
                  </span>
                </div>
              )}

              {error && (
                <div className="full">
                  <div className="upload-status error">{error}</div>
                </div>
              )}
              <div className="modal-actions full">
                <button type="button" className="ghost-button" onClick={closeModal} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? <Loader2 size={15} className="spin" /> : isEditing ? <Pencil size={15} /> : <Plus size={15} />}
                  {submitting ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Tạo và mở project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}