import { Link } from "@tanstack/react-router"
import {
  Bike,
  ChevronRight,
  Footprints,
  PersonStanding,
  Waves,
} from "lucide-react"

import type { ActivityPublic } from "@/client"
import { cn } from "@/lib/utils"
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
} from "./activity-utils"

interface ActivityRowProps {
  activity: ActivityPublic
}

export function ActivityRow({ activity }: ActivityRowProps) {
  const cardio = activity.cardio
  const sportType = (activity.sport_type || "").toLowerCase()

  // Select icon and badge colors based on activity type
  let Icon = Footprints
  let iconBgClass = "bg-primary/15 text-primary"
  let badgeText = "Strava"
  let badgeClass = "bg-primary/10 text-primary border-primary/20"

  if (
    sportType.includes("ride") ||
    sportType.includes("bike") ||
    sportType.includes("ciclismo")
  ) {
    Icon = Bike
    iconBgClass = "bg-cyan-500/15 text-cyan-400"
    badgeText = "Ciclismo"
    badgeClass = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
  } else if (
    sportType.includes("walk") ||
    sportType.includes("hike") ||
    sportType.includes("caminata")
  ) {
    Icon = PersonStanding
    iconBgClass = "bg-primary/15 text-primary"
    badgeText = "Caminata"
    badgeClass = "bg-primary/10 text-primary border-primary/20"
  } else if (sportType.includes("swim") || sportType.includes("natacion")) {
    Icon = Waves
    iconBgClass = "bg-blue-500/15 text-blue-400"
    badgeText = "Natación"
    badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20"
  } else if (
    activity.source_type === "gpx_upload" ||
    activity.source_type === "fit_upload"
  ) {
    badgeText = "Archivo GPS"
    badgeClass = "bg-primary/10 text-primary border-primary/20"
  } else if (activity.source_type === "manual") {
    badgeText = "Manual"
    badgeClass = "bg-white/5 text-muted-foreground border-white/10"
  }

  // Build metrics string joined by ' · '
  const metricsParts: string[] = [formatDate(activity.timestamp)]

  if (activity.duration_seconds) {
    metricsParts.push(formatDuration(activity.duration_seconds))
  }

  if (cardio) {
    if (cardio.distance_meters) {
      metricsParts.push(formatDistance(cardio.distance_meters))
    }
    if (cardio.avg_pace_seconds_per_km) {
      metricsParts.push(formatPace(cardio.avg_pace_seconds_per_km))
    }
    if (cardio.avg_hr) {
      metricsParts.push(`${Math.round(cardio.avg_hr)} ppm`)
    }
  }

  const subtitle = metricsParts.join(" · ")

  return (
    <Link
      to="/activities/$activityId"
      params={{ activityId: activity.id }}
      className="group flex items-center gap-3.5 rounded-2xl border border-border/80 bg-card/60 px-4 py-3.5 transition-all duration-150 hover:border-border hover:bg-surface-container-high/60"
    >
      {/* Icon Badge */}
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
          iconBgClass,
        )}
      >
        <Icon className="size-5" />
      </div>

      {/* Main Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {activity.name || "Actividad sin nombre"}
          </h3>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {subtitle}
        </div>
      </div>

      {/* Badge & Chevron */}
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={cn(
            "hidden sm:inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
            badgeClass,
          )}
        >
          {badgeText}
        </span>
        <ChevronRight className="size-4 text-on-surface-variant transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>
    </Link>
  )
}
