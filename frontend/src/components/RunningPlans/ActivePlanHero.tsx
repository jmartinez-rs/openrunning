import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  CalendarDays,
  Flag,
  Footprints,
  MapPin,
  Timer,
  TrendingUp,
} from "lucide-react"

import {
  type RunningPlanSummaryPublic,
  RunningPlansService,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  computeProgress,
  formatDateRange,
  formatDuration,
  formatDistance,
  formatPace,
  getCurrentWeekFromPhases,
  getWeekBoundsISO,
  PHASE_COLORS,
  type PhaseColor,
  PLAN_STATUS_META,
} from "./running-utils"
import { WeekStrip } from "./WeekStrip"

interface ActivePlanHeroProps {
  plan: RunningPlanSummaryPublic
}

function ProgressBar({
  completed,
  missed,
  total,
  percent,
}: {
  completed: number
  missed: number
  total: number
  percent: number
}) {
  if (total === 0) return null
  const completedPct = (completed / total) * 100
  const missedPct = (missed / total) * 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-label-lg text-on-surface-variant">
          Progreso del plan
        </span>
        <span className="text-label-lg font-bold text-primary">
          {percent}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className="flex h-full">
          <div
            className="h-full rounded-l-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${completedPct}%` }}
          />
          <div
            className="h-full bg-destructive/70 transition-all duration-500"
            style={{ width: `${missedPct}%` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-label-sm text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-emerald-500" />
          {completed} completadas
        </span>
        {missed > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-destructive/70" />
            {missed} perdidas
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-surface-container" />
          {total - completed - missed} pendientes
        </span>
      </div>
    </div>
  )
}

export function ActivePlanHero({ plan }: ActivePlanHeroProps) {
  const status = PLAN_STATUS_META[plan.status]
  const progress = computeProgress(plan)

  // Fetch full plan detail to get current week workouts
  const detailQuery = useQuery({
    queryKey: ["running-plan", plan.id],
    queryFn: () => RunningPlansService.readPlan({ planId: plan.id }),
    staleTime: 5 * 60 * 1000,
  })

  const phases = detailQuery.data?.phases ?? []
  const currentWeek = phases.length > 0
    ? getCurrentWeekFromPhases(phases)
    : null

  // Determine monday for the WeekStrip
  const { monday } = getWeekBoundsISO()
  const weekMondayISO = currentWeek?.startDate ?? monday

  const phaseColor = currentWeek
    ? PHASE_COLORS[currentWeek.phaseColor as PhaseColor] ?? PHASE_COLORS.slate
    : null

  return (
    <Link to="/routines/run/$planId" params={{ planId: plan.id }}>
      <div className="group relative flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 p-6 shadow-xl transition-all hover:border-emerald-500/60">
        {/* Glow accent */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Footprints className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-title-lg font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                {plan.name}
              </h3>
              {plan.goal && (
                <p className="mt-0.5 line-clamp-1 text-body-md text-slate-400">
                  {plan.goal}
                </p>
              )}
            </div>
          </div>
          <Badge
            variant={status.variant}
            className={cn("shrink-0 font-bold", status.className)}
          >
            {status.label}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <ProgressBar {...progress} />
        </div>

        {/* Estimated Race Time — simulated from target_time_seconds */}
        {detailQuery.data && (
          detailQuery.data.target_time_seconds != null ||
          detailQuery.data.distance_km != null
        ) && (
          <div className="relative flex flex-wrap items-center gap-3 rounded-xl bg-slate-800/60 px-4 py-3 border border-slate-700/60">
            <Timer className="size-4 text-emerald-400" />
            <span className="text-label-lg font-semibold text-slate-200">
              Tiempo estimado
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {detailQuery.data.target_time_seconds != null && (
                <span className="text-body-md font-bold text-emerald-400">
                  {formatDuration(detailQuery.data.target_time_seconds)}
                </span>
              )}
              {detailQuery.data.distance_km != null && (
                <span className="text-label-sm text-slate-400">
                  {formatDistance(detailQuery.data.distance_km)}
                </span>
              )}
              {detailQuery.data.target_pace_seconds_per_km != null && (
                <span className="text-label-sm text-slate-400">
                  Ritmo {formatPace(detailQuery.data.target_pace_seconds_per_km)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Current week strip */}
        <div className="relative flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-slate-400" />
              <span className="text-xs font-bold text-white">
                Semana actual
              </span>
              {currentWeek && (
                <span className="text-xs text-slate-400 font-medium">
                  · S{currentWeek.weekNumber}
                </span>
              )}
              {currentWeek && phaseColor && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                    phaseColor.badge,
                  )}
                >
                  {currentWeek.phaseName}
                </span>
              )}
            </div>
          </div>

          {detailQuery.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl bg-slate-800/80" />
          ) : (
            <WeekStrip
              mondayISO={weekMondayISO}
              workouts={currentWeek?.workouts ?? []}
              className="rounded-2xl bg-slate-900/90 border border-slate-800 p-2 shadow-inner"
            />
          )}
        </div>

        {/* Stats strip */}
        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800/80 pt-4 text-xs text-slate-400">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <TrendingUp className="size-3.5 text-slate-400" />
            {plan.weeks} {plan.weeks === 1 ? "semana" : "semanas"}
          </span>
          <span>·</span>
          <span>
            {plan.sessions} {plan.sessions === 1 ? "sesión" : "sesiones"}
          </span>
          <span>·</span>
          <span className="font-extrabold text-emerald-400">
            {plan.planned_km} km
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5 text-slate-500" />
            {formatDateRange(plan.start_date, plan.end_date)}
          </span>

          {plan.race_id && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Flag className="size-3.5" />
                Carrera objetivo
              </span>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto gap-1 text-emerald-400 font-bold hover:text-emerald-300 hover:bg-slate-800/80"
            asChild
          >
            <span>
              Ver plan <ArrowRight className="size-3.5" />
            </span>
          </Button>
        </div>
      </div>
    </Link>
  )
}
