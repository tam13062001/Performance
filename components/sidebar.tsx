"use client"

import {
  CalendarDays,
  FileText,
  FileUp,
  FolderKanban,
  LayoutDashboard,
  MoreHorizontal,
  Network,
  Rocket,
  Search,
  Share2,
  Store,
  Users,
  SquarePlay,
} from "lucide-react"
import type { Project } from "@/lib/projects"

export type PageId =
  | "overview"
  | "daily"
  | "business"
  | "audience"
  | "google"
  | "meta"
  | "youtube"
  | "taxonomy"
  | "projects"
  | "import"
  | "reports";

type NavItem = { id: PageId; label: string; title: string; desc: string; Icon: typeof LayoutDashboard }

const workspace: NavItem[] = [
  { id: "projects", label: "Projects", title: "Project Management", desc: "Quản trị nhiều chiến dịch, mỗi project có plan và dữ liệu riêng.", Icon: FolderKanban },
]

const campaign: NavItem[] = [
  { id: "overview", label: "Campaign Overview", title: "Campaign Overview", desc: "Tổng quan hiệu suất của toàn chiến dịch trên tất cả kênh.", Icon: LayoutDashboard },
  { id: "daily", label: "Daily Trend", title: "Daily Trend", desc: "Xu hướng hiệu suất theo từng ngày.", Icon: CalendarDays },
  { id: "business", label: "Business Breakdown", title: "Business Breakdown", desc: "Hiệu suất theo Phase, Objective, Location, Audience, Buying Type.", Icon: Store },
  { id: "audience", label: "Audience Overview", title: "Cross-channel Audience", desc: "Phân bổ Age, Gender, Location kèm breakdown từng kênh.", Icon: Users },
]

const channels: NavItem[] = [
  { id: "google", label: "Google Ads", title: "Google Ads Dashboard", desc: "Campaign, Ad Group, Audience và Keyword Performance.", Icon: Search },
  { id: "meta", label: "Meta Ads", title: "Meta Ads Dashboard", desc: "Campaign, Ad Set, Audience và Creative Intelligence.", Icon: Share2 },
  { id: "youtube", label: "Youtube Ads", title: "Youtube Ads Dashboard", desc: "Campaign, Ad Set, Audience và Creative Intelligence.", Icon: SquarePlay },
]

const governance: NavItem[] = [
  { id: "taxonomy", label: "Taxonomy & Plan", title: "Taxonomy & Media Plan", desc: "Map raw campaign name sang business dimensions và KPI.", Icon: Network },
  { id: "reports", label: "Report Builder", title: "Report Builder", desc: "Tạo report có skin khách hàng và export PDF từ dữ liệu project.", Icon: FileText },
  { id: "import", label: "Import Data", title: "Data Import Center", desc: "Upload plan và raw data để cập nhật toàn bộ Rocket Performance.", Icon: FileUp },
]

export const NAV_ITEMS: NavItem[] = [...workspace, ...campaign, ...channels, ...governance]

export function navMeta(id: PageId) {
  return NAV_ITEMS.find((n) => n.id === id) ?? campaign[0]
}

function Group({
  label,
  items,
  page,
  onNavigate,
}: {
  label: string
  items: NavItem[]
  page: PageId
  onNavigate: (p: PageId) => void
}) {
  return (
    <>
      <div className="nav-label">{label}</div>
      {items.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={`nav ${page === id ? "active" : ""}`} onClick={() => onNavigate(id)}>
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </>
  )
}

export function Sidebar({
  page,
  onNavigate,
  projects,
  activeId,
  onSelectProject,
}: {
  page: PageId
  onNavigate: (p: PageId) => void
  projects: Project[]
  activeId: string
  onSelectProject: (id: string) => void
}) {
  const active = projects.find((p) => p.id === activeId) ?? projects[0]

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Rocket size={20} />
        </div>
        <div>
          <strong>Rocket Performance</strong>
          <small>Campaign Intelligence Platform</small>
        </div>
      </div>

      <div className="workspace">
        <span>Active project</span>
        <div className="workspace-active">
          <div className="workspace-logo">
            {active?.theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.theme.logoUrl || "/placeholder.svg"} alt={`${active.name} logo`} />
            ) : (
              (active?.name.charAt(0).toUpperCase() ?? "R")
            )}
          </div>
          <div className="workspace-info">
            <strong>{active?.name ?? "—"}</strong>
            <small>{active?.description ?? "—"}</small>
          </div>
        </div>
        <select
          className="workspace-switcher"
          aria-label="Chuyển project"
          value={activeId}
          onChange={(e) => onSelectProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <nav>
        <Group label="Workspace" items={workspace} page={page} onNavigate={onNavigate} />
        <Group label="Campaign" items={campaign} page={page} onNavigate={onNavigate} />
        <Group label="Channel Dashboards" items={channels} page={page} onNavigate={onNavigate} />
        <Group label="Governance" items={governance} page={page} onNavigate={onNavigate} />
      </nav>

      <div className="sidebar-bottom">
        <div className="sync-card">
          <span className="live-dot" />
          <div>
            <strong>Sources connected</strong>
            <small>Demo data · Vercel ready</small>
          </div>
        </div>
        <div className="user-card">
          <div className="avatar">KH</div>
          <div>
            <strong>Kim Huynh</strong>
            <small>Administrator</small>
          </div>
          <button type="button" className="more" aria-label="Tùy chọn người dùng">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}