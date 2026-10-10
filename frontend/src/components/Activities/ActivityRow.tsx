import { Link } from "@tanstack/react-router"
import {
  Bike,
  ChevronRight,
  Footprints,
  PersonStanding,
  Waves,
} from "lucide-react"

import type { ActivityPublic } from "@/client"
import { formatDate, formatDuration, formatPace } from "./activity-utils"

interface ActivityRowProps {
  activity: ActivityPublic
}

export function ActivityRow({ activity }: ActivityRowProps) {
  const cardio = activity.cardio
  const sportType = (activity.sport_type || "").toLowerCase()

  // Select icon based on activity type
  let Icon = Footprints
  let sportName = "Corrida"

  if (
    sportType.includes("ride") ||
    sportType.includes("bike") ||
    sportType.includes("ciclismo")
  ) {
    Icon = Bike
    sportName = "Ciclismo"
  } else if (
    sportType.includes("walk") ||
    sportType.includes("hike") ||
    sportType.includes("caminata")
  ) {
    Icon = PersonStanding
    sportName = "Caminhada"
  } else if (sportType.includes("swim") || sportType.includes("natacion")) {
    Icon = Waves
    sportName = "Natação"
  }

  const distanceKm = cardio?.distance_meters
    ? (cardio.distance_meters / 1000).toFixed(2)
    : "—"
  const paceStr = cardio?.avg_pace_seconds_per_km
    ? formatPace(cardio.avg_pace_seconds_per_km)
    : "—"
  const durationStr = activity.duration_seconds
    ? formatDuration(activity.duration_seconds)
    : "—"

  return (
    <Link
      to="/activities/$activityId"
      params={{ activityId: activity.id }}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-[#121214] p-4 transition-all duration-200 hover:border-primary/40 hover:bg-[#18181c] shadow-sm"
    >
      {/* Left Column: Map Thumbnail & Activity Title/Date */}
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Map route preview or icon placeholder */}
        <div className="relative flex size-14 shrink-0 items-center justify-center rounded-xl overflow-hidden border border-border/60 bg-[#0d0d0f]">
          {cardio?.map_summary_polyline ? (
            <div className="flex size-full items-center justify-center bg-zinc-900/90 text-primary">
              <Icon className="size-6 text-primary group-hover:scale-110 transition-transform" />
            </div>
          ) : (
            <Icon className="size-6 text-primary group-hover:scale-110 transition-transform" />
          )}
        </div>

        {/* Title, Sport and Date */}
        <div className="min-w-0">
          <h3 className="truncate text-sm sm:text-base font-bold text-white group-hover:text-primary transition-colors">
            {activity.name || sportName}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatDate(activity.timestamp)}</span>
            <span>·</span>
            <span>{sportName}</span>
          </div>
        </div>
      </div>

      {/* Right Column: 3 Paccer Metrics (Distância, Pace, Duração) + Chevron */}
      <div className="flex items-center gap-4 sm:gap-7 shrink-0">
        {/* Distância */}
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Distância
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-white">
            {distanceKm}{" "}
            <span className="text-[10px] font-semibold text-zinc-400">km</span>
          </div>
        </div>

        {/* Pace */}
        <div className="hidden sm:block text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Pace
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-primary">
            {paceStr}
          </div>
        </div>

        {/* Duração */}
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Duração
          </div>
          <div className="font-mono text-xs sm:text-sm font-black text-white">
            {durationStr}
          </div>
        </div>

        {/* Chevron arrow */}
        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 group-hover:text-white" />
      </div>
    </Link>
  )
}
