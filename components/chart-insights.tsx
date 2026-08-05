"use client"

import { useMemo, useState } from "react"
import { Sparkles, ChevronDown, Lightbulb, Loader2 } from "lucide-react"
import { buildInsights, type InsightSpec } from "@/lib/insights"

// Collapsible AI-insights panel attached under a chart. Rule-based bullets are
// computed instantly from the chart data; the "Hỏi AI" button calls the LLM
// route for a deeper natural-language read.
export function ChartInsights({ spec }: { spec: InsightSpec }) {
  const [open, setOpen] = useState(false)
  const [aiText, setAiText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bullets = useMemo(() => buildInsights(spec), [spec])

  async function askAi() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spec),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Lỗi không xác định")
      setAiText(data.text as string)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được phân tích AI.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`chart-ai ${open ? "open" : ""}`}>
      <button type="button" className="chart-ai-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Sparkles size={15} />
        <span>AI insights</span>
        <ChevronDown size={15} className="chart-ai-caret" />
      </button>

      {open && (
        <div className="chart-ai-body">
          <ul className="chart-ai-list">
            {bullets.map((b, i) => (
              <li key={i}>
                <Lightbulb size={14} />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {aiText && (
            <div className="chart-ai-llm">
              <div className="chart-ai-llm-head">
                <Sparkles size={13} /> Phân tích AI
              </div>
              <p>{aiText}</p>
            </div>
          )}

          {error && <p className="chart-ai-error">{error}</p>}

          <button type="button" className="chart-ai-ask" onClick={askAi} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            {loading ? "Đang phân tích…" : aiText ? "Phân tích lại với AI" : "Hỏi AI"}
          </button>
        </div>
      )}
    </div>
  )
}
