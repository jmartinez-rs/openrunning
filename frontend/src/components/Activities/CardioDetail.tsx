import { Flame, Gauge, MapPin, Mountain, Timer } from "lucide-react"

import type { ActivityCardioBase } from "@/client"
import { ActivityMap } from "./ActivityMap"
import { formatPace } from "./activity-utils"

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  iconBgClass: string
  accentColorClass?: string
}

function StatCard({
  icon,
  label,
  value,
  iconBgClass,
  accentColorClass = "text-white",
}: StatCardProps) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${iconBgClass}`}>
          {icon}
        </div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate min-w-0">
          {label}
        </p>
      </div>
      <p className={`text-base sm:text-lg md:text-xl font-black tracking-tight truncate ${accentColorClass}`}>
        {value}
      </p>
    </div>
  )
}

export function CardioDetail({ cardio }: { cardio: ActivityCardioBase }) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Metric Cards Grid - 2 cols on mobile/small screens, 4 cols on desktop */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 min-w-0">
        <StatCard
          icon={<MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Distancia"
          value={
            cardio.distance_meters
              ? `${(cardio.distance_meters / 1000).toFixed(2)} km`
              : "—"
          }
          iconBgClass="bg-emerald-500/15 text-emerald-400"
          accentColorClass="text-emerald-400"
        />
        <StatCard
          icon={<Timer className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Ritmo medio"
          value={formatPace(cardio.avg_pace_seconds_per_km)}
          iconBgClass="bg-orange-500/15 text-orange-400"
          accentColorClass="text-orange-400"
        />
        <StatCard
          icon={<Gauge className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Pulsaciones"
          value={cardio.avg_hr ? `${cardio.avg_hr} bpm` : "—"}
          iconBgClass="bg-rose-500/15 text-rose-400"
          accentColorClass="text-rose-400"
        />
        <StatCard
          icon={<Flame className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Calorías"
          value={cardio.calories ? `${cardio.calories} kcal` : "—"}
          iconBgClass="bg-amber-500/15 text-amber-400"
        />
      </div>

      {/* Elevation Badge / Info if available */}
      {cardio.elevation_gain_meters ? (
        <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 w-fit max-w-full truncate">
          <Mountain className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="truncate">Desnivel acumulado: <strong className="text-white">{Math.round(cardio.elevation_gain_meters)} m</strong></span>
        </div>
      ) : null}

      {/* Polyline Interactive Map */}
      {cardio.map_summary_polyline ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl bg-slate-900/90 relative">
          <ActivityMap encoded={cardio.map_summary_polyline} />
        </div>
      ) : null}
    </div>
  )
}


