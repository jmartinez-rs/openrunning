import { Link } from "@tanstack/react-router"
import { Check, Dumbbell, Ellipsis, Footprints } from "lucide-react"

import type { ActivityPublic } from "@/client"
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
} from "./activity-utils"

export function ActivityCard({ activity }: { activity: ActivityPublic }) {
  const cardio = activity.cardio
  const strength = activity.strength
  const isStrength = activity.source_type === "hevy"

  return (
    <Link
      to="/activities/$activityId"
      params={{ activityId: activity.id }}
      className="group flex items-start gap-3 rounded-2xl bg-card p-4 shadow-card transition-colors hover:border hover:border-primary/30 dark:border dark:border-border/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low">
        {isStrength ? (
          <Dumbbell className="size-4 text-domain-strength" />
        ) : (
          <Footprints className="size-4 text-domain-cardio" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-body-lg font-semibold leading-tight text-primary">
          {activity.name || "Actividad"}
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          {cardio ? (
            <>
              <span className="flex items-baseline gap-1">
                <span className="text-title-lg text-primary font-semibold">
                  {formatDistance(cardio.distance_meters)}
                </span>
                <span className="text-body-md text-on-surface-variant">km</span>
              </span>
              <span className="text-title-lg text-primary font-semibold">
                {formatPace(cardio.avg_pace_seconds_per_km)}
              </span>
              <span className="text-title-lg text-primary font-semibold">
                {formatDuration(activity.duration_seconds)}
              </span>
            </>
          ) : strength ? (
            <>
              <span className="text-title-lg text-primary font-semibold">
                {Math.round(strength.total_volume_kg ?? 0)} kg
              </span>
              <span className="text-title-lg text-primary font-semibold">
                {strength.total_sets ?? 0} series
              </span>
              {strength.avg_rpe ? (
                <span className="text-title-lg text-primary font-semibold">
                  RPE {strength.avg_rpe}
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={
              isStrength
                ? "inline-flex items-center gap-1 rounded bg-domain-strength/10 px-2 py-0.5 text-label-lg text-domain-strength"
                : "inline-flex items-center gap-1 rounded bg-domain-cardio/10 px-2 py-0.5 text-label-lg text-domain-cardio"
            }
          >
            {isStrength ? "Hevy" : "Strava"}
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-label-lg text-primary">
            <Check className="size-3" />
            Sincronizado
          </span>
          <span className="text-label-sm text-on-surface-variant">
            {formatDate(activity.timestamp)}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="mt-1 flex size-8 items-center justify-center self-start rounded-lg text-on-surface-variant opacity-0 transition-all hover:bg-surface-container-low hover:text-primary group-hover:opacity-100"
        aria-label="Más acciones"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Ellipsis className="size-4" />
      </button>
    </Link>
  )
}
