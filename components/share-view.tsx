"use client";

import { useEffect, useState } from "react";
import { Lock, Info, Calendar } from "lucide-react";
import {
  OverviewPage,
  BusinessPage,
  AudiencePage,
  ChannelDashboard,
  PlanPage,
  useAvailableMonths,
  DailyTrendPage,
} from "./dashboard";
import { SHAREABLE_PAGES, type SharePageId } from "@/lib/share-pages";
import { applyProjectTheme, ClientThemeContext, DEFAULT_THEME } from "@/lib/theme";

type ShareMeta = {
  authed: boolean;
  projectCode: string;
  projectLabel: string;
  allowedPages: SharePageId[];
  label: string | null;
  theme: { primary: string; secondary: string; accent: string } | null;
};

// Bảng màu cố định cho màn hình nhập mật khẩu — không phụ thuộc theme
// để tránh chữ/input bị mờ khi site đang ở light mode.
const C = {
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  bg: "#ffffff",
  placeholder: "#9ca3af",
  danger: "#dc2626",
  accent: "#111827",
  accentText: "#ffffff",
};

function PasswordGate({ slug, onAuthed }: { slug: string; onAuthed: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${slug}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Sai mật khẩu");
        return;
      }
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <form
        onSubmit={submit}
        style={{
          maxWidth: 360,
          width: "100%",
          padding: 24,
          background: C.bg,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Lock size={18} color={C.text} />
          <h3 style={{ margin: 0, color: C.text }}>Báo cáo được bảo vệ</h3>
        </div>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
          Nhập mật khẩu được cung cấp để xem báo cáo này.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            marginBottom: 12,
            background: C.bg,
            color: C.text,
            boxSizing: "border-box",
          }}
        />
        {error && <p style={{ color: C.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "none",
            background: C.accent,
            color: C.accentText,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "Đang kiểm tra…" : "Xem báo cáo"}
        </button>
      </form>
    </main>
  );
}

export function ShareView({ slug }: { slug: string }) {
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<SharePageId | null>(null);
  const [planView, setPlanView] = useState<"MTD" | "YTD">("YTD");
  const [month, setMonth] = useState("");

  const projectCode = meta?.projectCode ?? "";
  const availableMonths = useAvailableMonths(projectCode);

  // Luôn ép light mode cho toàn bộ trang Share, không phụ thuộc theme client hay session trước đó
  useEffect(() => {
    document.documentElement.dataset.uiTheme = "light";
  }, []);

  useEffect(() => {
    if (meta?.theme) {
      applyProjectTheme({
        ...DEFAULT_THEME,
        preset: "client-branded",
        primary: meta.theme.primary,
        secondary: meta.theme.secondary,
        accent: meta.theme.accent,
        mode: "light",
      });
    }
  }, [meta]);

  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(month)) {
      setMonth(availableMonths[0]);
    }
  }, [availableMonths, month]);

  const loadMeta = () => {
    fetch(`/api/share/${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setLoadError(json.error);
          return;
        }
        setMeta(json);
        if (json.allowedPages?.length > 0) setActivePage(json.allowedPages[0]);
      })
      .catch((e) => setLoadError(e.message));
  };

  useEffect(() => {
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (loadError) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="notice"><Info size={18} /><div><b>Không thể mở báo cáo</b><p>{loadError}</p></div></div>
      </main>
    );
  }

  if (!meta) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="notice"><Info size={18} /><div><b>Đang tải…</b></div></div>
      </main>
    );
  }

  if (!meta.authed) {
    return <PasswordGate slug={slug} onAuthed={loadMeta} />;
  }

  const periodMonth = planView === "YTD" ? "YTD" : month;
  const periodLabel = planView === "YTD" ? "YTD" : month || "—";
  const pages = SHAREABLE_PAGES.filter((p) => meta.allowedPages.includes(p.id));

  const themeContextValue = meta.theme ?? { primary: "#6366f1", secondary: "#22d3ee", accent: "#f97316" };

  return (
    <ClientThemeContext.Provider value={themeContextValue}>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        <header className="topbar">
          <div>
            <div className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <img
                src="/Rocket Group Logo.png"
                alt="Logo"
                style={{ height: 36, width: "auto", objectFit: "contain" }}
              />
            </div>
            <h1>{meta.projectLabel}</h1>
            {meta.label && <p>{meta.label}</p>}
          </div>
          <div className="header-controls">
            <label className="period-select">
              <span>Plan view</span>
              <select value={planView} onChange={(e) => setPlanView(e.target.value as "MTD" | "YTD")}>
                <option value="MTD">MTD</option>
                <option value="YTD">YTD</option>
              </select>
            </label>
            {planView === "MTD" && (
              <label className="period-select">
                <span>Month</span>
                <select value={month} onChange={(e) => setMonth(e.target.value)} disabled={availableMonths.length === 0}>
                  {availableMonths.length === 0 && <option value="">Không có tháng MTD</option>}
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="header-chip"><Calendar size={15} /> {periodLabel}</div>
          </div>
        </header>

        <div className="page-toolbar">
          <div className="tabs">
            {pages.map((p) => (
              <button key={p.id} type="button" className={`tab ${activePage === p.id ? "active" : ""}`} onClick={() => setActivePage(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <section className="page">
          {activePage === "overview" && periodMonth && <OverviewPage projectCode={projectCode} periodMonth={periodMonth} planView={planView} />}
          {activePage === "business" && periodMonth && <BusinessPage projectCode={projectCode} periodMonth={periodMonth} planView={planView} />}
          {activePage === "audience" && periodMonth && <AudiencePage projectCode={projectCode} periodMonth={periodMonth} />}
          {activePage === "google" && <ChannelDashboard projectCode={projectCode} platform="Google" periodMonth={periodMonth} planView={planView} />}
          {activePage === "meta" && <ChannelDashboard projectCode={projectCode} platform="Meta" periodMonth={periodMonth} planView={planView} />}
          {activePage === "taxonomy" && periodMonth && <PlanPage projectCode={projectCode} periodMonth={periodMonth} />}
          {activePage === "daily" && <DailyTrendPage projectCode={projectCode} />}
        </section>
      </main>
    </ClientThemeContext.Provider>
  );
}