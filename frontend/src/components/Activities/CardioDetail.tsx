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
    <div className="bg-card/80 border border-border rounded-2xl p-3.5 sm:p-4 shadow-card flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${iconBgClass}`}>
          {icon}
        </div>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate min-w-0">
          {label}
        </p>
      </div>
      <p
        className={`text-base sm:text-lg md:text-xl font-black tracking-tight truncate ${accentColorClass}`}
      >
        {value}
      </p>
    </div>
  )
}

export function CardioDetail({ cardio }: { cardio: ActivityCardioBase }) {
  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* Polyline Interactive Map on Top (Mockup 14-atividades-mapa.png) */}
      {cardio.map_summary_polyline ? (
        <div className="overflow-hidden rounded-2xl border border-border shadow-card bg-card/90 relative">
          <ActivityMap encoded={cardio.map_summary_polyline} />
        </div>
      ) : null}

      {/* Elevation Profile info strip */}
      {cardio.elevation_gain_meters ? (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#121214] border border-border/80 rounded-2xl text-xs font-semibold text-muted-foreground w-full">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-primary shrink-0" />
            <span>Ganancia de elevación acumulada</span>
          </div>
          <span className="font-mono font-bold text-white text-sm">
            +{Math.round(cardio.elevation_gain_meters)} m
          </span>
        </div>
      ) : null}

      {/* Metric Cards Grid - 2 cols on mobile, 4 cols on desktop */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 min-w-0">
        <StatCard
          icon={<MapPin className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Distância"
          value={
            cardio.distance_meters
              ? `${(cardio.distance_meters / 1000).toFixed(2)} km`
              : "—"
          }
          iconBgClass="bg-primary/15 text-primary"
          accentColorClass="text-primary"
        />
        <StatCard
          icon={<Timer className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Pace médio"
          value={formatPace(cardio.avg_pace_seconds_per_km)}
          iconBgClass="bg-primary/15 text-primary"
          accentColorClass="text-primary"
        />
        <StatCard
          icon={<Gauge className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="FC Média"
          value={cardio.avg_hr ? `${Math.round(cardio.avg_hr)} bpm` : "—"}
          iconBgClass="bg-destructive/15 text-destructive"
          accentColorClass="text-destructive"
        />
        <StatCard
          icon={<Flame className="w-4 h-4 sm:w-5 sm:h-5" />}
          label="Calorias"
          value={cardio.calories ? `${cardio.calories} kcal` : "—"}
          iconBgClass="bg-primary/15 text-primary"
        />
      </div>
    </div>
  )
}
