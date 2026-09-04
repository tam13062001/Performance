"use client";

import { useEffect, useState } from "react";
import { Calendar, Info, Moon, Share2, Sun, X } from "lucide-react";
import { ShareManager } from "../share-manager";
import { Sidebar, navMeta, type PageId } from "../sidebar";
import { ImportCenter } from "../import-center";
import { ProjectsPage } from "../projects-page";
import { ReportBuilder } from "../report-builder";
import { useProjects } from "@/lib/projects";
import { applyProjectTheme, ClientThemeContext } from "@/lib/theme";
import { useAvailableMonths } from "./hooks";
import { DailyTrendPage } from "./DailyTrendPage";
import { OverviewPage } from "./OverviewPage";
import { BusinessPage } from "./BusinessPage";
import { AudiencePage } from "./AudiencePage";
import { ChannelDashboard } from "./ChannelDashboard";
import { PlanPage } from "./PlanPage";

export function Dashboard() {
  const [page, setPage] = useState<PageId>("overview");
  const [planView, setPlanView] = useState<"MTD" | "YTD">("YTD");
  const [month, setMonth] = useState<string>("");
  const [uiTheme, setUiTheme] = useState<"dark" | "light">("dark");
  const [showShareModal, setShowShareModal] = useState(false);
  const { projects, activeProject, activeId, setActiveId, addProject, editProject, removeProject, updateTheme, hydrated } = useProjects();
  const meta = navMeta(page);

  const dbProjectCode = activeProject?.code ?? "";

  const availableMonths = useAvailableMonths(dbProjectCode);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[0]);
    }
  }, [availableMonths, month]);

  useEffect(() => {
    setMonth("");
  }, [dbProjectCode]);

  const periodMonth = planView === "YTD" ? "YTD" : month;
  const periodLabel = planView === "YTD" ? "YTD" : month || "—";

  useEffect(() => {
    const saved = localStorage.getItem("rocket-ui-theme");
    if (saved === "light" || saved === "dark") setUiTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.uiTheme = uiTheme;
    localStorage.setItem("rocket-ui-theme", uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    if (activeProject?.theme) applyProjectTheme(activeProject.theme);
  }, [activeProject]);

  if (!hydrated || !activeProject) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="notice">
          <Info size={18} />
          <div><b>Đang tải project…</b></div>
        </div>
      </main>
    );
  }

  const theme = activeProject.theme;

  return (
    <ClientThemeContext.Provider value={{ primary: theme.primary, secondary: theme.secondary, accent: theme.accent }}>
      <Sidebar page={page} onNavigate={setPage} projects={projects} activeId={activeId} onSelectProject={setActiveId} />
      <main>
        <header className="topbar">
          <div>
            <div className="eyebrow">Rocket Performance</div>
            <h1>{meta.title}</h1>
            <p>{meta.desc}</p>
          </div>
          <div className="header-controls">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--fg)",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              <Share2 size={15} />
              Share
            </button>
            <label className="period-select">
              <span>Plan view</span>
              <select value={planView} onChange={(e) => setPlanView(e.target.value as "MTD" | "YTD")}>
                <option value="MTD">MTD</option>
                <option value="YTD">YTD</option>
              </select>
            </label>
            <label className="period-select">
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={planView === "YTD" || availableMonths.length === 0}>
                {availableMonths.length === 0 && <option value="">Không có tháng MTD</option>}
                {availableMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <div className="header-chip"><Calendar size={15} /> {periodLabel}</div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setUiTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={uiTheme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              title={uiTheme === "dark" ? "Light mode" : "Dark mode"}
            >
              {uiTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{uiTheme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </header>

        <section className="page" key={uiTheme}>
          {page === "projects" && (
            <ProjectsPage projects={projects} activeId={activeId} onSelect={setActiveId} onCreate={addProject} onEdit={editProject} onDelete={removeProject} />
          )}
          {page === "daily" && dbProjectCode && <DailyTrendPage projectCode={dbProjectCode} />}
          {page === "overview" && periodMonth && dbProjectCode && <OverviewPage projectCode={dbProjectCode} periodMonth={periodMonth} planView={planView} />}
          {page === "business" && periodMonth && dbProjectCode && <BusinessPage projectCode={dbProjectCode} periodMonth={periodMonth} planView={planView} />}
          {page === "audience" && dbProjectCode && periodMonth && <AudiencePage projectCode={dbProjectCode} periodMonth={periodMonth} />}
          {page === "google" && dbProjectCode && <ChannelDashboard projectCode={dbProjectCode} platform="Google" periodMonth={periodMonth} planView={planView} />}
          {page === "meta" && dbProjectCode && <ChannelDashboard projectCode={dbProjectCode} platform="Meta" periodMonth={periodMonth} planView={planView} />}
          {page === "youtube" && dbProjectCode && <ChannelDashboard projectCode={dbProjectCode} platform="Youtube" periodMonth={periodMonth} planView={planView} />}

          {page === "taxonomy" && periodMonth && dbProjectCode && <PlanPage projectCode={dbProjectCode} periodMonth={periodMonth} />}

          {page === "import" && <ImportCenter />}
          {page === "reports" && <ReportBuilder project={activeProject} onChange={(patch) => updateTheme(activeId, patch)} />}
        </section>
      </main>

      {showShareModal && (
        <div
          onClick={() => setShowShareModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 640,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowShareModal(false)}
              aria-label="Đóng"
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "6px",
                cursor: "pointer",
                color: "var(--fg)",
                zIndex: 1,
              }}
            >
              <X size={16} />
            </button>
            <ShareManager projectCode={dbProjectCode} />
          </div>
        </div>
      )}
    </ClientThemeContext.Provider>
  );
}