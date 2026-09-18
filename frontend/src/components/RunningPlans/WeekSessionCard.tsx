import { Link } from "@tanstack/react-router"
import { CheckCircle2, ChevronRight, ExternalLink, XCircle } from "lucide-react"

import type { RunningWorkoutPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
  buildBlockPreview,
  formatDistance,
  formatPace,
  formatShortDate,
  WORKOUT_TYPE_META,
} from "./running-utils"

type MatchedActivity = {
  activity_id?: string
  name?: string | null
  distance_meters?: number | null
  duration_seconds?: number | null
}

interface WeekSessionCardProps {
  workout: RunningWorkoutPublic
  onClick: () => void
}

export function WeekSessionCard({ workout, onClick }: WeekSessionCardProps) {
  const typeMeta = WORKOUT_TYPE_META[workout.type] ?? WORKOUT_TYPE_META.easy_run
  const matched = workout.matched_activity as MatchedActivity | null

  const distanceText = (() => {
    if (workout.distance_km != null) return formatDistance(workout.distance_km)
    const blocksDist = blocksDistanceKm(workout.blocks ?? [])
    return blocksDist != null ? formatDistance(blocksDist) : null
  })()

  const paceText = formatPace(workout.pace_seconds_per_km)

  // Block preview text
  const blockPreviews = (workout.blocks ?? []).map(buildBlockPreview)

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-xl border border-border bg-card/90 p-3.5 shadow-md transition-all duration-200 hover:border-primary/40 hover:bg-card cursor-pointer",
        workout.status === "completed" && "border-primary/40 bg-primary/20",
        workout.status === "missed" &&
          "border-destructive/40 bg-destructive/20",
        workout.cancelled && "opacity-60",
      )}
    >
      {/* Top Header: Date, Type Badge, and Status Icon */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {formatShortDate(workout.date)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
              typeMeta.badgeClass,
            )}
          >
            <span>{typeMeta.emoji}</span>
            <span>{typeMeta.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {workout.status === "completed" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="size-4" />
              <span className="hidden sm:inline">Completada</span>
            </span>
          )}
          {workout.status === "missed" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
              <XCircle className="size-4" />
              <span className="hidden sm:inline">Perdida</span>
            </span>
          )}
          {workout.status === "planned" && (
            <Badge
              variant="outline"
              className="text-[11px] font-normal border-border text-muted-foreground"
            >
              Planificada
            </Badge>
          )}

          {matched?.activity_id && (
            <Badge
              variant="outline"
              asChild
              className="gap-1 border-primary/40 bg-primary/10 text-[10px] text-primary hover:bg-primary/20"
              onClick={(e) => e.stopPropagation()}
            >
              <Link
                to="/activities/$activityId"
                params={{ activityId: matched.activity_id }}
              >
                <span>Actividad</span>
                <ExternalLink className="size-2.5" />
              </Link>
            </Badge>
          )}

          <ChevronRight className="size-4 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>

      {/* Session Title & Objective */}
      <div>
        <h4 className="font-bold text-white group-hover:text-primary transition-colors text-sm">
          {workout.name || typeMeta.label}
        </h4>
        {workout.objective && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {workout.objective}
          </p>
        )}
      </div>

      {/* Metrics Row (Distance, Pace, Duration) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1.5 border-t border-border">
        {distanceText && (
          <span className="font-extrabold text-white">{distanceText}</span>
        )}
        {paceText && paceText !== "—" && (
          <span>
            Ritmo: <strong className="text-foreground">{paceText}</strong>
          </span>
        )}

        {/* Block previews summary */}
        {blockPreviews.length > 0 && (
          <span className="truncate text-muted-foreground max-w-full">
            • {blockPreviews.join(" + ")}
          </span>
        )}
      </div>
    </div>
  )
}
