import { Flag, ChevronRight } from "lucide-react"
import { Link } from "@tanstack/react-router"

import type { RacePublic, RunningPlanPublic } from "@/client"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
  formatDuration,
  formatPace,
  formatRunnaDate,
  type WeekOverview,
} from "./running-utils"

interface RunnaPlanHeroCardProps {
  plan: RunningPlanPublic
  race?: RacePublic | null
  weeks: WeekOverview[]
  totalKm: number
  className?: string
}

/**
 * Tarjeta superior de resumen del plan (Runna Hero Card - PAgina_tuplan_completa.jpg):
 * - Título del plan ("Under Armour 15K Plan")
 * - Subtítulo de carrera ("Tu carrera: 29 NOV 2026")
 * - Escudo/Badge de distancia en la esquina superior derecha ("15 KM")
 * - Barra segmentada de semanas (1 segmento por cada semana del plan)
 * - Métricas principales: "Total de semanas: 0/7" y "Distancia total: 197.6 km"
 * - Métricas de la semana actual: Distancia esta semana, Tiempo promedio, Ritmo total
 * - Fila inferior clicable con el evento objetivo
 */
export function RunnaPlanHeroCard({
  plan,
  race,
  weeks,
  totalKm,
  className,
}: RunnaPlanHeroCardProps) {
  const targetDate = race?.date || plan.end_date
  const distanceKm =
    plan.distance_km ||
    race?.distance_km ||
    (plan.goal?.includes("42") ? 42.2 : plan.goal?.includes("21") ? 21.1 : 15)

  const totalWeeks = weeks.length || 7
  const currentWeekIndex = weeks.findIndex((w) => w.status === "current")
  const completedWeeks = weeks.filter((w) =>
    w.workouts.length > 0 && w.workouts.every((wo) => wo.status === "completed")
  ).length

  // Métricas de la semana actual
  const currentWeek =
    weeks.find((w) => w.status === "current") ??
    weeks.find((w) => w.workouts.some((wo) => wo.status === "planned")) ??
    weeks[0]

  let currentWeekDistanceKm = 0
  let currentWeekTotalSeconds = 0
  let workoutsWithDuration = 0

  if (currentWeek) {
    for (const wo of currentWeek.workouts) {
      const dist =
        wo.distance_km ?? blocksDistanceKm(wo.blocks ?? []) ?? 0
      if (dist > 0) currentWeekDistanceKm += dist

      let sec = wo.duration_seconds
      if ((!sec || sec <= 0) && dist > 0 && wo.pace_seconds_per_km) {
        sec = dist * wo.pace_seconds_per_km
      } else if ((!sec || sec <= 0) && dist > 0) {
        const fallbackPace =
          plan.target_pace_seconds_per_km ??
          (plan.target_time_seconds && plan.distance_km
            ? plan.target_time_seconds / plan.distance_km
            : 330)
        sec = dist * fallbackPace
      }
      if (sec != null && sec > 0) {
        currentWeekTotalSeconds += sec
        workoutsWithDuration += 1
      }
    }

    if (currentWeekDistanceKm === 0 && currentWeek.volumeKm > 0) {
      currentWeekDistanceKm = currentWeek.volumeKm
    }
  }

  const avgDurationSeconds =
    workoutsWithDuration > 0
      ? currentWeekTotalSeconds / workoutsWithDuration
      : null
  const avgDurationStr = avgDurationSeconds
    ? formatDuration(avgDurationSeconds)
    : "—"

  const avgPaceSeconds =
    currentWeekDistanceKm > 0 && currentWeekTotalSeconds > 0
      ? currentWeekTotalSeconds / currentWeekDistanceKm
      : plan.target_pace_seconds_per_km ?? null
  const avgPaceStr = avgPaceSeconds
    ? formatPace(avgPaceSeconds).replace(/^0/, "")
    : "—"

  return (
    <section
      aria-label="Resumen del Plan de Entrenamiento"
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-6 shadow-md transition-all",
        className,
      )}
    >
      {/* ── Fila Superior: Título + Escudo de distancia ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl sm:text-3xl font-black tracking-tight text-white">
            {plan.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-muted-foreground">
            Tu carrera:{" "}
            <span className="text-zinc-200 uppercase">
              {formatRunnaDate(targetDate)}
            </span>
          </p>
        </div>

        {/* Escudo / Badge de distancia estilo Runna */}
        <div className="relative shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-b-2xl bg-gradient-to-b from-red-600 via-red-700 to-red-900 border border-red-500/50 shadow-lg text-white">
          <span className="font-display text-sm font-black tracking-tighter leading-none">
            {distanceKm >= 10 ? Math.round(distanceKm) : distanceKm}
          </span>
          <span className="text-[10px] font-black uppercase tracking-wider leading-none mt-0.5">
            KM
          </span>
          <div className="mt-1 size-1 rounded-full bg-red-300 animate-pulse" />
        </div>
      </div>

      {/* ── Barra segmentada de progreso de semanas ── */}
      <div className="mt-5 flex items-center gap-1.5 w-full">
        {Array.from({ length: totalWeeks }).map((_, idx) => {
          const isDone = idx < completedWeeks
          const isCurrent =
            currentWeekIndex !== -1
              ? idx === currentWeekIndex
              : idx === 0
          return (
            <div
              key={idx}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                isDone
                  ? "bg-primary"
                  : isCurrent
                    ? "bg-white/80"
                    : "bg-surface-container-high/60 dark:bg-zinc-700/60",
              )}
              title={`Semana ${idx + 1}`}
            />
          )
        })}
      </div>

      {/* ── Métricas en 2 columnas: Total de semanas / Distancia total ── */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground">
            Total de semanas
          </span>
          <span className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums mt-0.5">
            {completedWeeks}/{totalWeeks}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-muted-foreground">
            Distancia total
          </span>
          <span className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight tabular-nums mt-0.5">
            {totalKm > 0 ? `${totalKm.toFixed(1)} km` : "—"}
          </span>
        </div>
      </div>

      {/* ── Métricas de la semana actual: idéntico diseño que los totales de arriba ── */}
      {currentWeek && (
        <div className="mt-5 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground">
                Esta semana
              </span>
              <span className="font-display text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums mt-0.5 whitespace-nowrap">
                {currentWeekDistanceKm > 0
                  ? `${currentWeekDistanceKm.toFixed(1)} km`
                  : "—"}
              </span>
            </div>

            <div className="flex flex-col items-center text-center">
              <span className="text-xs font-semibold text-muted-foreground">
                Tiempo prom.
              </span>
              <span className="font-display text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums mt-0.5 whitespace-nowrap">
                {avgDurationStr}
              </span>
            </div>

            <div className="flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-muted-foreground">
                Ritmo total
              </span>
              <span className="font-display text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums mt-0.5 whitespace-nowrap">
                {avgPaceStr}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Fila Inferior: Evento objetivo clicable ── */}
      {plan.race_id && (
        <div className="mt-5 pt-3.5 border-t border-border/50">
          <Link
            to="/races/$raceId"
            params={{ raceId: plan.race_id }}
            className="flex items-center justify-between text-xs font-bold text-zinc-300 hover:text-white transition-colors group"
          >
            <div className="flex items-center gap-2 truncate">
              <Flag className="size-4 text-primary shrink-0" />
              <span className="truncate">
                {race?.event_name ?? "Ver carrera objetivo"}
              </span>
              {race?.date && (
                <span className="text-muted-foreground font-normal">
                  {formatRunnaDate(race.date)}
                </span>
              )}
            </div>
            <ChevronRight className="size-4 text-muted-foreground group-hover:text-white transition-colors shrink-0" />
          </Link>
        </div>
      )}
    </section>
  )
}
