"use client";

import { useEffect, useState } from "react";
import { Share2, Trash2, Copy, Check } from "lucide-react";
import { SHAREABLE_PAGES, type SharePageId } from "@/lib/share-pages";

type ShareLink = {
  slug: string;
  label: string | null;
  allowedPages: SharePageId[];
  createdAt: string;
  revokedAt: string | null;
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
    <article className="card">
      <div className="card-head">
        <div>
          <small>Share cho client</small>
          <h3><Share2 size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Tạo link chia sẻ</h3>
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 8 }}>Chọn phần muốn share:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SHAREABLE_PAGES.map((p) => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
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
          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--fg)" }}
        />

        <input
          type="password"
          placeholder="Mật khẩu cho project này (để trống nếu giữ nguyên password cũ)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--fg)" }}
        />

        {error && <p style={{ color: "#e5484d", fontSize: 13 }}>{error}</p>}

        <button
          onClick={create}
          disabled={creating}
          style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", cursor: creating ? "not-allowed" : "pointer" }}
        >
          {creating ? "Đang tạo…" : "Tạo link share"}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Link</th><th>Nội dung</th><th>Trạng thái</th><th></th></tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.slug} style={{ opacity: l.revokedAt ? 0.5 : 1 }}>
                <td className="mono">
                  {l.label ? <b>{l.label}</b> : null}
                  <div>/share/{l.slug}</div>
                </td>
                <td>{l.allowedPages.map((id) => SHAREABLE_PAGES.find((p) => p.id === id)?.label ?? id).join(", ")}</td>
                <td>{l.revokedAt ? "Đã thu hồi" : "Đang hoạt động"}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  {!l.revokedAt && (
                    <>
                      <button onClick={() => copyLink(l.slug)} title="Copy link" style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: 6, cursor: "pointer", color: "var(--fg)" }}>
                        {copiedSlug === l.slug ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button onClick={() => revoke(l.slug)} title="Thu hồi" style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: 6, cursor: "pointer", color: "#e5484d" }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!loading && links.length === 0 && <tr><td colSpan={4}>Chưa có link share nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </article>
  );
}