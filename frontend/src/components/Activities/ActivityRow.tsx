import { Link } from "@tanstack/react-router"
import {
  Bike,
  ChevronRight,
  Dumbbell,
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
  isStrength,
} from "./activity-utils"

interface ActivityRowProps {
  activity: ActivityPublic
}

export function ActivityRow({ activity }: ActivityRowProps) {
  const cardio = activity.cardio
  const strength = activity.strength
  const strengthActivity = isStrength(activity)
  const sportType = (activity.sport_type || "").toLowerCase()

  // Select icon and badge colors based on activity type
  let Icon = Footprints
  let iconBgClass = "bg-emerald-500/15 text-emerald-400"
  let badgeText = "Strava"
  let badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"

  if (strengthActivity) {
    Icon = Dumbbell
    iconBgClass = "bg-purple-500/15 text-purple-400"
    badgeText = "Hevy"
    badgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/20"
  } else if (sportType.includes("ride") || sportType.includes("bike") || sportType.includes("ciclismo")) {
    Icon = Bike
    iconBgClass = "bg-cyan-500/15 text-cyan-400"
    badgeText = "Ciclismo"
    badgeClass = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
  } else if (sportType.includes("walk") || sportType.includes("hike") || sportType.includes("caminata")) {
    Icon = PersonStanding
    iconBgClass = "bg-amber-500/15 text-amber-400"
    badgeText = "Caminata"
    badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20"
  } else if (sportType.includes("swim") || sportType.includes("natacion")) {
    Icon = Waves
    iconBgClass = "bg-blue-500/15 text-blue-400"
    badgeText = "Natación"
    badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20"
  } else if (activity.source_type === "gpx_upload" || activity.source_type === "fit_upload") {
    badgeText = "Archivo GPS"
    badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
  } else if (activity.source_type === "manual") {
    badgeText = "Manual"
    badgeClass = "bg-slate-500/10 text-slate-400 border-slate-500/20"
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
  } else if (strength) {
    if (strength.total_volume_kg) {
      metricsParts.push(`${Math.round(strength.total_volume_kg)} kg`)
    }
    if (strength.total_sets) {
      metricsParts.push(`${strength.total_sets} series`)
    }
    if (strength.avg_rpe) {
      metricsParts.push(`RPE ${strength.avg_rpe}`)
    }
  }

  const subtitle = metricsParts.join(" · ")

  return (
    <Link
      to="/activities/$activityId"
      params={{ activityId: activity.id }}
      className="group flex items-center gap-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/60 px-4 py-3.5 transition-all duration-150 hover:border-slate-700 hover:bg-slate-800/60"
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
          <h3 className="truncate text-base font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
            {activity.name || "Actividad sin nombre"}
          </h3>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-400">
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
        <ChevronRight className="size-4 text-slate-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-300" />
      </div>
    </Link>
  )
}
