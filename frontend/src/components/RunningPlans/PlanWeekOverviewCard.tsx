import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Waves,
  XCircle,
} from "lucide-react"

import type { RunningWorkoutPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
  formatRunnaDateRange,
  getRunnaWeekday,
  getRunnaWorkoutColor,
  PHASE_COLORS,
  type WeekOverview,
} from "./running-utils"

interface PlanWeekOverviewCardProps {
  week: WeekOverview
  expanded: boolean
  onToggle: () => void
  onSelectWorkout: (workout: RunningWorkoutPublic) => void
}

/**
 * Tarjeta de semana inspirada en la vista "Tu Plan" de Runna:
 * - Rango de fechas superior en mayúsculas ("12 OCT - 18 OCT")
 * - Título de la semana destacado ("Semana 1")
 * - Barra segmentada de progreso de entrenamientos (1 segmento por sesión)
 * - Resumen: "Total de entrenamientos: X · Distancia: Y.YYkm"
 * - Lista directa de sesiones con pastilla temática de color, día abreviado y distancia
 */
export function PlanWeekOverviewCard({
  week,
  expanded,
  onToggle,
  onSelectWorkout,
}: PlanWeekOverviewCardProps) {
  const phaseBadge =
    PHASE_COLORS[week.phaseColor]?.badge ?? PHASE_COLORS.slate.badge
  const workouts = [...week.workouts].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const isCurrent = week.status === "current"

  return (
    <section
      id={`week-${week.number}`}
      aria-label={`Semana ${week.number}`}
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-3xl border bg-card/90 p-5 sm:p-6 shadow-md transition-all duration-200",
        isCurrent
          ? "border-2 border-foreground/90 dark:border-white ring-1 ring-primary/30 shadow-lg"
          : "border-border/80 hover:border-border",
      )}
    >
      {/* ── Cabecera de la semana (Toggle colapsable) ── */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`week-body-${week.number}`}
        className="w-full text-left transition-colors cursor-pointer group"
      >
        {/* Fila 1: Fechas en mayúsculas estilo Runna + Badges */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/90">
            {formatRunnaDateRange(week.startDate, week.endDate)}
          </span>

          <div className="flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn("shrink-0 text-[10px] sm:text-[11px] font-semibold py-0.5", phaseBadge)}
            >
              {week.phaseName}
            </Badge>
            {isCurrent && (
              <Badge className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary-foreground">
                Actual
              </Badge>
            )}
            {week.isRestOrCutback && (
              <Badge
                variant="outline"
                className="gap-1 rounded-md border-border text-[10px] font-bold uppercase text-muted-foreground py-0.5"
              >
                <Waves className="size-3" /> Descarga
              </Badge>
            )}
          </div>
        </div>

        {/* Fila 2: Título "Semana X" + Chevron */}
        <div className="mt-1 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Semana {week.number}
          </h3>
          <div className="size-7 flex items-center justify-center rounded-full bg-surface-container-high/50 text-muted-foreground group-hover:text-foreground transition-colors">
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </div>
        </div>

        {/* Fila 3: Barra segmentada de entrenamientos (1 segmento por workout) */}
        <div className="mt-3 flex items-center gap-1.5 w-full">
          {workouts.length === 0 ? (
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high/60" />
          ) : (
            workouts.map((w, idx) => {
              const isDone = w.status === "completed"
              const isMissed = w.status === "missed"
              const isCancelled = w.cancelled || w.status === "cancelled"
              return (
                <div
                  key={w.id || idx}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    isDone
                      ? "bg-primary"
                      : isMissed
                        ? "bg-destructive"
                        : isCancelled
                          ? "bg-muted line-through"
                          : "bg-surface-container-high dark:bg-zinc-700/80",
                  )}
                  title={`${w.name || w.type}: ${w.status}`}
                />
              )
            })
          )}
        </div>

        {/* Fila 4: Total de entrenamientos · Distancia */}
        <div className="mt-2.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Total de entrenamientos:{" "}
            <strong className="text-foreground font-semibold">
              {week.counts.total}
            </strong>
          </span>
          <span>
            Distancia:{" "}
            <strong className="text-foreground font-semibold">
              {week.volumeKm > 0 ? `${week.volumeKm.toFixed(2)}km` : "0.00km"}
            </strong>
          </span>
        </div>
      </button>

      {/* ── Lista de entrenamientos directa dentro de la tarjeta (Runna style) ── */}
      {expanded && (
        <div
          id={`week-body-${week.number}`}
          className="mt-3.5 pt-3 border-t border-border/50 flex flex-col gap-1"
        >
          {workouts.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Sin entrenamientos planificados para esta semana.
            </p>
          ) : (
            workouts.map((workout) => {
              const runnaColor = getRunnaWorkoutColor(workout.type)
              const weekday = getRunnaWeekday(workout.date)
              const dist =
                workout.distance_km != null
                  ? workout.distance_km
                  : blocksDistanceKm(workout.blocks ?? [])
              const distText =
                dist != null && dist > 0
                  ? `${dist >= 10 ? dist.toFixed(1) : dist}km`
                  : null
              const title = workout.name || runnaColor.label

              return (
                <button
                  key={workout.id}
                  type="button"
                  onClick={() => onSelectWorkout(workout)}
                  className="flex items-center justify-between gap-3 w-full py-2.5 px-3 rounded-xl hover:bg-surface-container-high/60 active:scale-[0.99] transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Pastilla de color temática de Runna */}
                    <span
                      className={cn(
                        "size-4 sm:size-4.5 rounded-[5px] shrink-0 shadow-sm transition-transform group-hover:scale-110",
                        runnaColor.bg,
                      )}
                      title={runnaColor.label}
                    />

                    {/* Día abreviado ("Vie", "Dom") */}
                    <span className="w-9 text-xs sm:text-sm font-bold text-muted-foreground shrink-0 capitalize">
                      {weekday}
                    </span>

                    {/* Nombre de la sesión y distancia */}
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {title}
                      </span>
                      {distText && (
                        <>
                          <span className="text-muted-foreground/60 text-xs shrink-0">
                            ·
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-muted-foreground shrink-0">
                            {distText}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Estado / Acción derecha */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {workout.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                        <CheckCircle2 className="size-4" />
                      </span>
                    ) : workout.status === "missed" ? (
                      <span className="inline-flex items-center gap-1 text-destructive text-xs font-semibold">
                        <XCircle className="size-4" />
                      </span>
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </section>
  )
}
