import { Link } from "@tanstack/react-router"
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Link2,
  XCircle,
} from "lucide-react"
import type React from "react"

import type { RunningWorkoutPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
  buildBlockPreview,
  formatDistance,
  formatPace,
  formatShortDate,
  PHASE_COLORS,
  type PhaseColor,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "./running-utils"

type MatchedActivity = {
  activity_id?: string
  name?: string | null
  distance_meters?: number | null
  duration_seconds?: number | null
}

interface SessionCardProps {
  workout: RunningWorkoutPublic
  /** "row" = fila compacta (plan/semana); "grid" = tarjeta para grillas. */
  variant?: "row" | "grid"
  onClick: () => void
  /** Acento tonal de fase para sesiones planificadas. */
  phaseColor?: PhaseColor
  /** En la fila, muestra la fecha compacta dentro de la tarjeta. */
  showDate?: boolean
  className?: string
}

const DAYS_ABBR = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"]

function isCancelled(workout: RunningWorkoutPublic): boolean {
  return workout.cancelled || workout.status === "cancelled"
}

/**
 * Barra lateral de acento: el hue queda reservado al estado real
 * (completada/perdida) y el tono de fase a las sesiones planificadas.
 */
function accentBarClass(
  workout: RunningWorkoutPublic,
  phaseColor?: PhaseColor,
): string {
  if (isCancelled(workout)) return "bg-on-surface-variant/60"
  if (workout.status === "completed") return "bg-primary"
  if (workout.status === "missed") return "bg-destructive"
  return phaseColor
    ? (PHASE_COLORS[phaseColor]?.bar ?? "bg-primary/40")
    : "bg-primary/40"
}

function StatusIndicator({ workout }: { workout: RunningWorkoutPublic }) {
  if (isCancelled(workout)) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <XCircle className="size-4" />
        <span className="hidden sm:inline">Cancelada</span>
      </span>
    )
  }
  if (workout.status === "completed") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
        <CheckCircle2 className="size-4" />
        <span className="hidden sm:inline">Completada</span>
      </span>
    )
  }
  if (workout.status === "missed") {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
        <XCircle className="size-4" />
        <span className="hidden sm:inline">Perdida</span>
      </span>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-border text-[11px] font-normal text-muted-foreground"
    >
      Planificada
    </Badge>
  )
}

function MatchedBadges({ workout }: { workout: RunningWorkoutPublic }) {
  const matched = workout.matched_activity as MatchedActivity | null
  return (
    <>
      {matched?.activity_id && (
        <Badge
          variant="outline"
          asChild
          className="gap-1 border-primary/40 bg-primary/10 text-[11px] text-primary hover:bg-primary/20"
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
      {workout.matched_activity_id && (
        <Badge
          variant="outline"
          className="gap-1 border-border text-[11px] text-muted-foreground"
        >
          <Link2 className="size-2.5" />
          <span>Vinculada</span>
        </Badge>
      )}
    </>
  )
}

/**
 * Tarjeta única de sesión (Kinetic Volt). Reemplaza a PaccerSessionCard y
 * WeekSessionCard: una sola gramática en toda la app.
 */
export const SessionCard: React.FC<SessionCardProps> = ({
  workout,
  variant = "grid",
  onClick,
  phaseColor,
  showDate = false,
  className,
}) => {
  const typeMeta =
    WORKOUT_TYPE_META[workout.type as WorkoutType] ?? WORKOUT_TYPE_META.easy_run
  const cancelled = isCancelled(workout)

  const distanceKm =
    workout.distance_km ?? blocksDistanceKm(workout.blocks ?? [])
  const distanceText = distanceKm != null ? formatDistance(distanceKm) : null
  const paceText = formatPace(workout.pace_seconds_per_km)
  const blockPreviews = (workout.blocks ?? []).map(buildBlockPreview)

  const dateObj = new Date(`${workout.date}T12:00:00`)
  const dayName = DAYS_ABBR[dateObj.getDay()] ?? ""

  if (variant === "row") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-surface-container/50 py-3 pl-4 pr-3 transition-colors duration-200 hover:border-primary/40 hover:bg-surface-container/80 cursor-pointer",
          cancelled && "opacity-60",
          outcomeSurface(workout),
          className,
        )}
      >
        <div
          className={cn(
            "absolute inset-y-2 left-1.5 w-1 rounded-full",
            accentBarClass(workout, phaseColor),
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col pl-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary",
                cancelled && "line-through",
              )}
            >
              {workout.name || typeMeta.label}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
                typeMeta.badgeClass,
              )}
            >
              {typeMeta.label}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {showDate && (
              <span className="font-medium whitespace-nowrap">
                {formatShortDate(workout.date)} · {dayName}
              </span>
            )}
            {distanceText && (
              <span className="font-display font-extrabold text-foreground">
                {distanceText}
              </span>
            )}
            {paceText !== "—" && (
              <span>
                Ritmo:{" "}
                <strong className="font-display text-foreground">
                  {paceText}
                </strong>
              </span>
            )}
            {blockPreviews.length > 0 && (
              <span className="truncate">• {blockPreviews.join(" + ")}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <MatchedBadges workout={workout} />
          <StatusIndicator workout={workout} />
          <ChevronRight className="size-4 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-2.5 overflow-hidden rounded-2xl border border-border bg-surface-container-high/40 p-3.5 pl-4 transition-colors duration-200 hover:bg-surface-container-high/70 cursor-pointer",
        cancelled && "opacity-60",
        outcomeSurface(workout),
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-y-3 left-1.5 w-1 rounded-full",
          accentBarClass(workout, phaseColor),
        )}
      />

      {/* Header: date, type, status */}
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
            {formatShortDate(workout.date)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
              typeMeta.badgeClass,
            )}
          >
            {typeMeta.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MatchedBadges workout={workout} />
          <StatusIndicator workout={workout} />
          <ChevronRight className="size-4 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>

      {/* Title & objective */}
      <div className="pl-1.5">
        <h4
          className={cn(
            "text-sm font-display font-bold text-foreground transition-colors group-hover:text-primary",
            cancelled && "line-through",
          )}
        >
          {workout.name || typeMeta.label}
        </h4>
        {workout.objective && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {workout.objective}
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-1.5 pl-1.5 text-xs text-muted-foreground">
        {distanceText && (
          <span className="font-display font-extrabold text-foreground">
            {distanceText}
          </span>
        )}
        {paceText !== "—" && (
          <span>
            Ritmo:{" "}
            <strong className="font-display text-foreground">{paceText}</strong>
          </span>
        )}
        {blockPreviews.length > 0 && (
          <span className="max-w-full truncate">
            • {blockPreviews.join(" + ")}
          </span>
        )}
      </div>
    </div>
  )
}

/** Tinte de superficie por resultado (hue reservado a estado real). */
function outcomeSurface(workout: RunningWorkoutPublic): string {
  if (isCancelled(workout)) return ""
  if (workout.status === "completed") return "bg-primary/10"
  if (workout.status === "missed") return "bg-destructive/10"
  return ""
}
