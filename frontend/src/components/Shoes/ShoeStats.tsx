import { Activity, Gauge, Route, Timer } from "lucide-react"

import type { ShoeStatsPublic } from "@/client"
import { formatKm, formatPace } from "./shoe-utils"

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-container-low px-3 py-2.5">
      <div className="rounded-md bg-domain-cardio/10 p-2 text-domain-cardio">
        {icon}
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant uppercase">
          {label}
        </p>
        <p className="text-title-lg text-primary">{value}</p>
      </div>
    </div>
  )
}

export function ShoeStats({ stats }: { stats: ShoeStatsPublic }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        icon={<Route className="size-4" />}
        label="Distancia total"
        value={formatKm(stats.total_distance_meters)}
      />
      <Stat
        icon={<Activity className="size-4" />}
        label="Sesiones"
        value={String(stats.sessions ?? 0)}
      />
      <Stat
        icon={<Timer className="size-4" />}
        label="Ritmo promedio"
        value={formatPace(stats.avg_pace_seconds_per_km)}
      />
      <Stat
        icon={<Gauge className="size-4" />}
        label="FC promedio"
        value={stats.avg_hr != null ? `${Math.round(stats.avg_hr)} bpm` : "—"}
      />
    </div>
  )
}
