"use client";

import { useEffect, useState } from "react";
import { Share2, Trash2, Copy, Check } from "lucide-react";
import { SHAREABLE_PAGES, type SharePageId } from "@/lib/share-pages";

type ShareLink = {
  slug: string;
  label: string | null;
  allowedPages: SharePageId[];
  theme: { primary: string; secondary: string; accent: string } | null;
  createdAt: string;
  revokedAt: string | null;
};

const COLOR_PALETTE: { name: string; primary: string; secondary: string; accent: string }[] = [
  { name: "Indigo", primary: "#6366f1", secondary: "#22d3ee", accent: "#f97316" },
  { name: "Xanh dương", primary: "#2563eb", secondary: "#38bdf8", accent: "#f59e0b" },
  { name: "Xanh lá", primary: "#16a34a", secondary: "#4ade80", accent: "#facc15" },
  { name: "Tím", primary: "#9333ea", secondary: "#c084fc", accent: "#ec4899" },
  { name: "Đỏ cam", primary: "#dc2626", secondary: "#fb923c", accent: "#fde047" },
  { name: "Hồng", primary: "#db2777", secondary: "#f472b6", accent: "#a3e635" },
  { name: "Than chì", primary: "#334155", secondary: "#64748b", accent: "#38bdf8" },
  { name: "Ngọc lam", primary: "#0d9488", secondary: "#2dd4bf", accent: "#fb7185" },
];

const C = {
  text: "#111827",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  bg: "#ffffff",
  danger: "#dc2626",
  accent: "#111827",
  accentText: "#ffffff",
};

export function ShareManager({ projectCode }: { projectCode: string }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPages, setSelectedPages] = useState<SharePageId[]>([]);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCustomTheme, setUseCustomTheme] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#22d3ee");
  const [accentColor, setAccentColor] = useState("#f97316");

  const load = () => {
    setLoading(true);
    fetch(`/api/share?projectCode=${projectCode}`)
      .then((r) => r.json())
      .then((json) => setLinks(json.links ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectCode]);

  const togglePage = (id: SharePageId) => {
    setSelectedPages((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));
  };

  const create = async () => {
    if (selectedPages.length === 0) {
      setError("Chọn ít nhất 1 phần để share.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectCode,
          allowedPages: selectedPages,
          label: label || undefined,
          password: password || undefined,
          theme: useCustomTheme
            ? { primary: primaryColor, secondary: secondaryColor, accent: accentColor }
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Không tạo được link");
        return;
      }
      setSelectedPages([]);
      setLabel("");
      setPassword("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (slug: string) => {
    await fetch(`/api/share?slug=${slug}`, { method: "DELETE" });
    load();
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 1500);
  };

  return (
    <article className="card" style={{ background: C.bg, color: C.text }}>
      <div className="card-head" style={{ borderColor: C.border }}>
        <div>
          <small style={{ color: C.textMuted }}>Share cho client</small>
          <h3 style={{ color: C.text }}>
            <Share2 size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Tạo link chia sẻ
          </h3>
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Chọn phần muốn share:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SHAREABLE_PAGES.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: "6px 10px",
                  cursor: "pointer",
                  color: C.text,
                  fontSize: 14,
                }}
              >
                <input type="checkbox" checked={selectedPages.includes(p.id)} onChange={() => togglePage(p.id)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <input
          placeholder="Tên gợi nhớ cho link (không bắt buộc)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.bg,
            color: C.text,
          }}
        />

        <input
          type="password"
          placeholder="Mật khẩu cho project này (để trống nếu giữ nguyên password cũ)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.bg,
            color: C.text,
          }}
        />

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: C.textMuted,
              cursor: "pointer",
              marginBottom: useCustomTheme ? 12 : 0,
            }}
          >
            <input type="checkbox" checked={useCustomTheme} onChange={(e) => setUseCustomTheme(e.target.checked)} />
            Tùy chỉnh màu riêng cho link này
          </label>

          {useCustomTheme && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Chọn bảng màu có sẵn:</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {COLOR_PALETTE.map((p) => {
                    const isSelected = primaryColor === p.primary && secondaryColor === p.secondary && accentColor === p.accent;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setPrimaryColor(p.primary);
                          setSecondaryColor(p.secondary);
                          setAccentColor(p.accent);
                        }}
                        title={p.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: isSelected ? `2px solid ${C.text}` : `1px solid ${C.border}`,
                          background: C.bg,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ display: "flex" }}>
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.primary, marginRight: -4, border: "1px solid rgba(0,0,0,0.15)" }} />
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.secondary, marginRight: -4, border: "1px solid rgba(0,0,0,0.15)" }} />
                          <span style={{ width: 14, height: 14, borderRadius: "50%", background: p.accent, border: "1px solid rgba(0,0,0,0.15)" }} />
                        </span>
                        <span style={{ fontSize: 12, color: C.text }}>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Hoặc tự chọn từng màu:</p>
                <div style={{ display: "flex", gap: 16 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.textMuted }}>
                    Primary
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 44, height: 32, padding: 0, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", background: C.bg }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.textMuted }}>
                    Secondary
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ width: 44, height: 32, padding: 0, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", background: C.bg }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: C.textMuted }}>
                    Accent
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 44, height: 32, padding: 0, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", background: C.bg }} />
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>Xem trước:</span>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: primaryColor }} />
                <span style={{ width: 20, height: 20, borderRadius: 6, background: secondaryColor }} />
                <span style={{ width: 20, height: 20, borderRadius: 6, background: accentColor }} />
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ color: C.danger, fontSize: 13 }}>{error}</p>}

        <button
          onClick={create}
          disabled={creating}
          style={{
            alignSelf: "flex-start",
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: C.accent,
            color: C.accentText,
            cursor: creating ? "not-allowed" : "pointer",
            opacity: creating ? 0.6 : 1,
          }}
        >
          {creating ? "Đang tạo…" : "Tạo link share"}
        </button>
      </div>

      <div className="table-wrap" style={{ padding: "0 4px 4px" }}>
        <table
          style={{
            color: C.text,
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "38%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <thead>
            <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600 }}>Link</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600 }}>Nội dung</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 600 }}>Trạng thái</th>
              <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 12, fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr
                key={l.slug}
                style={{
                  opacity: l.revokedAt ? 0.55 : 1,
                  color: C.text,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <td className="mono" style={{ color: C.text, padding: "10px 12px", verticalAlign: "top", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {l.label ? <b style={{ display: "block", marginBottom: 2 }}>{l.label}</b> : null}
                  <div style={{ color: C.textMuted, fontSize: 12, whiteSpace: "normal", wordBreak: "break-all" }}>/share/{l.slug}</div>
                </td>
                <td style={{ color: C.text, padding: "10px 12px", verticalAlign: "top" }}>
                  <div>{l.allowedPages.map((id) => SHAREABLE_PAGES.find((p) => p.id === id)?.label ?? id).join(", ")}</div>
                  {l.theme && (
                    <span style={{ display: "inline-flex", gap: 3, marginTop: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.theme.primary, display: "inline-block" }} />
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.theme.secondary, display: "inline-block" }} />
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.theme.accent, display: "inline-block" }} />
                    </span>
                  )}
                </td>
                <td style={{ color: l.revokedAt ? C.textMuted : "#16a34a", padding: "10px 12px", verticalAlign: "top", fontWeight: 600, fontSize: 13 }}>
                  {l.revokedAt ? "Đã thu hồi" : "Đang hoạt động"}
                </td>
                <td style={{ padding: "10px 12px", verticalAlign: "top", textAlign: "right" }}>
                  {!l.revokedAt ? (
                    <div style={{ display: "inline-flex", gap: 8 }}>
                      <button onClick={() => copyLink(l.slug)} title="Copy link" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 6, cursor: "pointer", color: C.text }}>
                        {copiedSlug === l.slug ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button onClick={() => revoke(l.slug)} title="Thu hồi" style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 6, cursor: "pointer", color: C.danger }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && links.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: C.textMuted, padding: "16px 12px" }}>Chưa có link share nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}