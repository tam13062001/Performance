import { TrendingDown, TrendingUp } from "lucide-react"
import type { KpiCard as KpiCardType } from "@/lib/metrics"

export function KpiCards({ cards }: { cards: KpiCardType[] }) {
  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div className="kpi" key={c.label}>
          <span className="kpi-label">{c.label}</span>
          <span className="kpi-value">{c.value}</span>
          <div className="kpi-foot">
            <span className="kpi-target">{c.sub}</span>
            <span className={`chip ${c.trend === "up" ? "good" : "bad"}`}>
              {c.trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {c.delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
