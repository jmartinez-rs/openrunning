import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Footprints,
  MapPin,
  Timer,
} from "lucide-react"
import { useMemo, useState } from "react"

import { type RunningPlanSummaryPublic, RunningPlansService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
  computeProgress,
  formatDateRange,
  formatDistance,
  formatPace,
  getWeekBoundsISO,
  PLAN_STATUS_META,
  WORKOUT_TYPE_META,
} from "./running-utils"
import { WeekSessionCalendar } from "./WeekSessionCalendar"

interface ActivePlanHeroProps {
  plan: RunningPlanSummaryPublic
}

function Donut({
  completed,
  total,
  size = "size-28",
  small = false,
}: {
  completed: number
  total: number
  size?: string
  small?: boolean
}) {
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0
  const r = 40
  const c = 2 * Math.PI * r
  return (
    <div className={cn("relative", size)}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          style={{ stroke: "var(--surface-container-high)" }}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          style={{ stroke: "var(--primary)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-black font-display text-foreground leading-none",
            small ? "text-lg" : "text-2xl",
          )}
        >
          {Math.round(completed)}
        </span>
        <span
          className={cn(
            "font-semibold text-muted-foreground",
            small ? "text-[10px]" : "text-[11px]",
          )}
        >
          / {Math.round(total)} km
        </span>
      </div>
    </div>
  )
}

function MetricCell({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  accent?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3">
      <div className="flex items-center gap-1.5">
        <Icon className="size-4 text-primary shrink-0" />
        <span
          className={cn(
            "text-lg sm:text-xl font-extrabold font-display leading-tight",
            accent ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

function compactDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${Math.round(seconds)}s`
}

function weekdayName(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const name = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(d)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function workoutDistanceKm(workout: {
  distance_km?: number | null
  blocks?: Array<{ repeats?: number | null; distance_m?: number | null }>
}): number | null {
  if (workout.distance_km != null) return workout.distance_km
  return blocksDistanceKm(workout.blocks ?? [])
}

function workoutPaceText(workout: {
  pace_seconds_per_km?: number | null
  blocks?: Array<{
    pace_seconds_per_km?: number | null
    pace_range_end_seconds_per_km?: number | null
  }>
}): string | null {
  if (workout.pace_seconds_per_km != null) {
    const a = formatPace(workout.pace_seconds_per_km).replace("/km", "")
    const end = workout.blocks?.find(
      (b) => b.pace_range_end_seconds_per_km != null,
    )?.pace_range_end_seconds_per_km
    return end != null
      ? `${a}–${formatPace(end).replace("/km", "")}/km`
      : `${a}/km`
  }
  const block = workout.blocks?.find((b) => b.pace_seconds_per_km != null)
  if (!block?.pace_seconds_per_km) return null
  const a = formatPace(block.pace_seconds_per_km).replace("/km", "")
  const end = block.pace_range_end_seconds_per_km
  return end != null
    ? `${a}–${formatPace(end).replace("/km", "")}/km`
    : `${a}/km`
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

  const [weekOffset, setWeekOffset] = useState<0 | -1>(0)

  const phases = detailQuery.data?.phases ?? []

  // Calculate selected week and previous week distance
  const { selectedWeekData, previousDist } = useMemo(() => {
    const allWeeks = phases.flatMap(
      (p) =>
        p.weeks?.map((w) => ({
          ...w,
          phaseName: p.name,
          phaseColor: p.color,
        })) ?? [],
    )
    allWeeks.sort((a, b) => a.number - b.number)

    // Find "current" week based on today
    const today = new Date().toISOString().slice(0, 10)
    let currentIndex = allWeeks.findIndex(
      (w) =>
        w.start_date &&
        w.end_date &&
        today >= w.start_date &&
        today <= w.end_date,
    )

    // Fallback if not active today
    if (currentIndex === -1 && allWeeks.length > 0) currentIndex = 0

    const targetIndex = Math.max(0, currentIndex + weekOffset)
    const selected = allWeeks[targetIndex]
    const previous = targetIndex > 0 ? allWeeks[targetIndex - 1] : null

    const calculateDistance = (week: any) =>
      (week?.workouts ?? []).reduce(
        (acc: number, w: any) => acc + (w.distance_km ?? 0),
        0,
      )

    return {
      selectedWeekData: selected,
      previousDist: calculateDistance(previous),
    }
  }, [phases, weekOffset])

  const { monday } = getWeekBoundsISO()
  const weekMondayISO = selectedWeekData?.start_date ?? monday

  // Week stats (selected week)
  const weekWorkouts = selectedWeekData?.workouts ?? []
  const weekTotalDistance = weekWorkouts.reduce(
    (acc: number, w: any) => acc + (w.distance_km ?? 0),
    0,
  )
  const weekTotalDuration = weekWorkouts.reduce(
    (acc: number, w: any) => acc + (w.duration_seconds ?? 0),
    0,
  )
  const weekSessions = weekWorkouts.length
  const weekAvgPace =
    weekTotalDistance > 0 && weekTotalDuration > 0
      ? weekTotalDuration / weekTotalDistance
      : 0
  const weekCompletedWorkouts = weekWorkouts.filter(
    (w: any) => w.status === "completed",
  )
  const weekCompletedDistance = weekCompletedWorkouts.reduce(
    (acc: number, w: any) => acc + (w.distance_km ?? 0),
    0,
  )
  const weekCompletedSessions = weekCompletedWorkouts.length

  const deltaKm = weekTotalDistance - previousDist
  const avgPerSession =
    weekSessions > 0 ? weekTotalDistance / weekSessions : null

  const totalWeeks =
    plan.weeks || phases.reduce((acc, p) => acc + (p.weeks?.length ?? 0), 0)

  // Next upcoming session across the whole plan (real data)
  const todayISO = new Date().toISOString().slice(0, 10)
  const nextSession = useMemo(() => {
    const all = phases.flatMap((p) =>
      (p.weeks ?? []).flatMap((w) =>
        (w.workouts ?? []).map((wo) => ({ ...wo, weekNumber: w.number })),
      ),
    )
    all.sort((a, b) => a.date.localeCompare(b.date))
    return (
      all.find(
        (wo) => wo.status === "planned" && !wo.cancelled && wo.date >= todayISO,
      ) ?? null
    )
  }, [phases, todayISO])

  const nextDistance = nextSession ? workoutDistanceKm(nextSession) : null
  const nextPace = nextSession ? workoutPaceText(nextSession) : null

  return (
    <Link to="/routines/run/$planId" params={{ planId: plan.id }}>
      <div className="group relative flex flex-col gap-5 rounded-2xl bg-card border border-border p-5 sm:p-6 shadow-card transition-all hover:border-primary/30 overflow-hidden">
        {/* Header: week toggle + status + nav */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex gap-1 rounded-xl bg-secondary/60 p-1 border border-border">
            <button
              type="button"
              aria-pressed={weekOffset === 0}
              className={cn(
                "relative rounded-lg px-4 sm:px-5 py-2 text-[11px] sm:text-xs font-bold uppercase font-display tracking-wide transition-all",
                weekOffset === 0
                  ? "bg-surface-bright text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={(e) => {
                e.preventDefault()
                setWeekOffset(0)
              }}
            >
              Esta semana
              {weekOffset === 0 && (
                <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-primary" />
              )}
            </button>
            <button
              type="button"
              aria-pressed={weekOffset === -1}
              className={cn(
                "relative rounded-lg px-4 sm:px-5 py-2 text-[11px] sm:text-xs font-bold uppercase font-display tracking-wide transition-all",
                weekOffset === -1
                  ? "bg-surface-bright text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={(e) => {
                e.preventDefault()
                setWeekOffset(-1)
              }}
            >
              Semana pasada
              {weekOffset === -1 && (
                <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-primary" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge
              variant={status.variant}
              className={cn("hidden sm:flex font-bold", status.className)}
            >
              {status.label}
            </Badge>
            <div className="size-10 flex items-center justify-center rounded-full bg-card border border-border text-primary group-hover:bg-primary/10 group-hover:border-primary/40 transition-colors">
              <ArrowRight className="size-5" />
            </div>
          </div>
        </div>

        {/* Main metric cards (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: Distance this week */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4 text-primary shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Distancia esta semana
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-5xl font-black font-display text-foreground tracking-tighter">
                {weekTotalDistance > 0
                  ? formatDistance(weekTotalDistance).replace(" km", "")
                  : "0"}
              </span>
              <span className="text-xl font-bold text-muted-foreground uppercase">
                km
              </span>
            </div>
            {deltaKm !== 0 && (
              <div className="flex items-center gap-1 text-sm font-bold text-primary">
                <ArrowUpRight
                  className={cn("size-4", deltaKm < 0 && "rotate-90")}
                />
                {deltaKm > 0 ? "+" : "−"}
                {formatDistance(Math.abs(deltaKm)).replace(" km", "")} km
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              vs. semana pasada
            </span>
            {avgPerSession != null && weekSessions > 0 && (
              <span className="text-xs text-muted-foreground">
                {weekSessions} {weekSessions === 1 ? "sesión" : "sesiones"} · ~
                {formatDistance(avgPerSession).replace(" km", "")} km/sesión
              </span>
            )}
          </div>

          {/* Card 2: Plan progress */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-4 text-primary shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Progreso del plan
              </span>
            </div>
            <span className="text-lg font-bold text-foreground">
              Semana {selectedWeekData?.number ?? "—"} de {totalWeeks || "—"}
            </span>
            <div className="h-1.5 w-full rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-sm font-bold text-foreground">
              {progress.percent}%
            </span>
          </div>

          {/* Card 3: Completed this week (donut) */}
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card/60 p-4">
            {/* Mobile: compact horizontal (donut left, title + % right) */}
            <div className="flex w-full items-center justify-between gap-3 md:hidden">
              <Donut
                completed={weekCompletedDistance}
                total={weekTotalDistance}
                size="size-20"
                small
              />
              <div className="flex flex-col items-end gap-1">
                <span className="text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Completado esta semana
                </span>
                <span className="text-sm font-bold text-primary">
                  {weekTotalDistance > 0
                    ? `${Math.round((weekCompletedDistance / weekTotalDistance) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
            {/* Desktop: vertical centered */}
            <div className="hidden md:flex flex-col items-center gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Completado esta semana
              </span>
              <Donut
                completed={weekCompletedDistance}
                total={weekTotalDistance}
              />
              <span className="text-sm font-bold text-primary">
                {weekTotalDistance > 0
                  ? `${Math.round((weekCompletedDistance / weekTotalDistance) * 100)}%`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary metrics: single block with icons */}
        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-secondary/20">
          <MetricCell
            label="Ritmo medio"
            value={weekAvgPace > 0 ? formatPace(weekAvgPace) : "—"}
            icon={Footprints}
          />
          <MetricCell
            label="Tiempo total"
            value={
              weekTotalDuration > 0 ? compactDuration(weekTotalDuration) : "—"
            }
            icon={Timer}
          />
          <MetricCell
            label="Sesiones completadas"
            value={
              weekSessions > 0
                ? `${weekCompletedSessions} / ${weekSessions}`
                : "—"
            }
            icon={CheckCircle2}
            accent
          />
        </div>

        {/* Next session (highlighted) */}
        {nextSession ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <CalendarDays className="size-5 text-primary shrink-0" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  Próxima sesión
                </span>
                <span className="font-bold text-white">
                  {weekdayName(nextSession.date)} ·{" "}
                  {WORKOUT_TYPE_META[nextSession.type]?.label ?? "Sesión"} ·{" "}
                  {nextDistance != null
                    ? formatDistance(nextDistance).replace(" km", "")
                    : ""}{" "}
                  km
                </span>
                {nextPace && (
                  <span className="text-xs text-muted-foreground">
                    {nextPace}
                  </span>
                )}
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-primary whitespace-nowrap shrink-0">
              Ver sesión <ArrowRight className="size-3.5" />
            </span>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-xs font-semibold text-muted-foreground">
            Sin sesiones próximas
          </div>
        )}

        {/* Weekly session calendar */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Sesiones de la semana
          </span>
          {detailQuery.isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl bg-surface-container-high/80" />
          ) : (
            <WeekSessionCalendar
              mondayISO={weekMondayISO}
              workouts={weekWorkouts}
            />
          )}
        </div>

        {/* Footer: plan identity bar */}
        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <Footprints className="size-4 text-primary shrink-0" />
            <span className="text-sm font-bold text-foreground">
              {plan.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {selectedWeekData && (
              <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">
                Semana {selectedWeekData.number}
              </span>
            )}
            <span className="whitespace-nowrap">
              {formatDateRange(plan.start_date, plan.end_date)}
            </span>
            <ChevronRight className="size-4" />
          </div>
        </div>
      </div>
    </Link>
  )
}
