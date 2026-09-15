import { Droplets, Flame, Gauge, MapPin, Timer } from "lucide-react"

import type { ActivityCardioBase } from "@/client"
import { ActivityMap } from "./ActivityMap"
import { formatPace } from "./activity-utils"

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

export function CardioDetail({ cardio }: { cardio: ActivityCardioBase }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<MapPin className="size-4" />}
          label="Distancia"
          value={
            cardio.distance_meters
              ? `${(cardio.distance_meters / 1000).toFixed(2)} km`
              : "—"
          }
        />
        <Stat
          icon={<Timer className="size-4" />}
          label="Ritmo promedio"
          value={formatPace(cardio.avg_pace_seconds_per_km)}
        />
        <Stat
          icon={<Gauge className="size-4" />}
          label="Frecuencia cardíaca"
          value={cardio.avg_hr ? `${cardio.avg_hr} bpm` : "—"}
        />
        <Stat
          icon={<Flame className="size-4" />}
          label="Calorías"
          value={cardio.calories ? String(cardio.calories) : "—"}
        />
      </div>

      {cardio.elevation_gain_meters ? (
        <p className="flex items-center gap-2 text-body-md text-on-surface-variant">
          <Droplets className="size-4" />
          Desnivel: {Math.round(cardio.elevation_gain_meters)} m
        </p>
      ) : null}

      {cardio.map_summary_polyline ? (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <ActivityMap encoded={cardio.map_summary_polyline} />
        </div>
      ) : null}
    </div>
  )
}
