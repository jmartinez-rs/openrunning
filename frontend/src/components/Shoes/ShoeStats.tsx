import { Activity, Gauge, Route, Timer } from "lucide-react"

import type { ShoeStatsPublic } from "@/client"
import { formatKm, formatPace } from "./shoe-utils"

function Stat({
  icon,
  label,
  value,
  accentColor = "text-emerald-400",
}: {
  icon: React.ReactNode
  label: string
  value: string
  accentColor?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
      <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className={`text-base font-extrabold ${accentColor}`}>{value}</p>
      </div>
    </div>
  )
}

export function ShoeStats({ stats }: { stats: ShoeStatsPublic }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        icon={<Route className="size-5" />}
        label="Distancia Acumulada"
        value={formatKm(stats.total_distance_meters)}
        accentColor="text-white"
      />
      <Stat
        icon={<Activity className="size-5" />}
        label="Sesiones Completadas"
        value={String(stats.sessions ?? 0)}
        accentColor="text-emerald-400"
      />
      <Stat
        icon={<Timer className="size-5" />}
        label="Ritmo Promedio"
        value={formatPace(stats.avg_pace_seconds_per_km)}
        accentColor="text-teal-400"
      />
      <Stat
        icon={<Gauge className="size-5" />}
        label="FC Promedio"
        value={stats.avg_hr != null ? `${Math.round(stats.avg_hr)} bpm` : "—"}
        accentColor="text-amber-400"
      />
    </div>
  )
}
