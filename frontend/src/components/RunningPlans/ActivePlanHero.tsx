import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowDownRight, ArrowRight, ArrowUpRight, MapPin } from "lucide-react"
import { useMemo, useState } from "react"

import { type RunningPlanSummaryPublic, RunningPlansService } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  computeProgress,
  formatDateRange,
  formatDistance,
  formatDuration,
  formatPace,
  getWeekBoundsISO,
  PLAN_STATUS_META,
} from "./running-utils"
import { WeekVolumeChart } from "./WeekVolumeChart"

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
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Progreso general del plan
        </span>
        <span className="text-[11px] font-bold text-emerald-400">
          {percent}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="flex h-full">
          <div
            className="h-full rounded-l-full bg-primary transition-all duration-500"
            style={{ width: `${completedPct}%` }}
          />
          <div
            className="h-full bg-destructive/70 transition-all duration-500"
            style={{ width: `${missedPct}%` }}
          />
        </div>
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

  const [weekOffset, setWeekOffset] = useState<0 | -1>(0)

  const phases = detailQuery.data?.phases ?? []

  // Calculate selected week and comparison
  const { selectedWeekData, comparisonPct, isPositive } = useMemo(() => {
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

    // Distances
    const calculateDistance = (week: any) =>
      (week?.workouts ?? []).reduce(
        (acc: number, w: any) => acc + (w.distance_km ?? 0),
        0,
      )

    const selectedDist = calculateDistance(selected)
    const previousDist = calculateDistance(previous)

    let pct = 0
    let pos = true
    if (previousDist > 0) {
      pct = Math.abs((selectedDist - previousDist) / previousDist) * 100
      pos = selectedDist >= previousDist
    } else if (selectedDist > 0) {
      pct = 100
    }

    return {
      selectedWeekData: selected,
      comparisonPct: pct.toFixed(1),
      isPositive: pos,
    }
  }, [phases, weekOffset])

  const { monday } = getWeekBoundsISO()
  const weekMondayISO = selectedWeekData?.start_date ?? monday

  // Calculate week stats
  const weekTotalDistance = (selectedWeekData?.workouts ?? []).reduce(
    (acc: number, w: any) => acc + (w.distance_km ?? 0),
    0,
  )
  const weekTotalDuration = (selectedWeekData?.workouts ?? []).reduce(
    (acc: number, w: any) => acc + (w.duration_seconds ?? 0),
    0,
  )
  const weekSessions = (selectedWeekData?.workouts ?? []).length
  const weekAvgPace =
    weekTotalDistance > 0 && weekTotalDuration > 0
      ? weekTotalDuration / weekTotalDistance
      : 0

  return (
    <Link to="/routines/run/$planId" params={{ planId: plan.id }}>
      <div className="group relative flex flex-col gap-6 rounded-2xl bg-card border border-border p-5 shadow-card transition-all hover:border-primary/30 overflow-hidden">
        {/* Header Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex bg-secondary p-1 rounded-full border border-border">
            <button
              type="button"
              className={cn(
                "px-5 py-2 text-[11px] sm:text-xs font-bold rounded-full transition-all uppercase font-display tracking-wide",
                weekOffset === 0
                  ? "bg-surface-bright text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={(e) => {
                e.preventDefault()
                setWeekOffset(0)
              }}
            >
              ESTA SEMANA
            </button>
            <button
              type="button"
              className={cn(
                "px-5 py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all",
                weekOffset === -1
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200",
              )}
              onClick={(e) => {
                e.preventDefault()
                setWeekOffset(-1)
              }}
            >
              SEMANA PASADA
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={status.variant}
              className={cn("hidden sm:flex font-bold", status.className)}
            >
              {status.label}
            </Badge>
            <div className="size-10 flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-emerald-400 group-hover:bg-emerald-500/10 transition-colors">
              <ArrowRight className="size-5" />
            </div>
          </div>
        </div>

        {/* Big Metric Area */}
        <div className="flex items-end justify-between relative mt-2">
          <div className="flex flex-col gap-1 z-10">
            <div className="flex items-center gap-1.5 text-slate-400">
              <MapPin className="size-4 text-emerald-400" />
              <span className="text-sm font-semibold">
                Distancia total planeada
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-5xl sm:text-6xl font-black font-display text-foreground tracking-tighter">
                {weekTotalDistance > 0
                  ? formatDistance(weekTotalDistance).replace(" km", "")
                  : "0"}
                <span className="text-2xl sm:text-3xl ml-1 font-bold text-muted-foreground uppercase">
                  KM
                </span>
              </h2>

              {weekTotalDistance > 0 && Number(comparisonPct) > 0 && (
                <div
                  className={cn(
                    "flex flex-col text-xs font-bold leading-tight mb-2 font-display",
                    isPositive ? "text-primary" : "text-destructive",
                  )}
                >
                  <span className="flex items-center">
                    {isPositive ? (
                      <ArrowUpRight className="size-3.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5 mr-0.5" />
                    )}
                    {comparisonPct}%
                  </span>
                  <span>vs sem. pas.</span>
                </div>
              )}
            </div>
          </div>

          {/* Decorative Right Pill Graphic */}
          <div className="absolute -right-2 -bottom-2 flex items-end gap-2 opacity-60 z-0 pointer-events-none">
            <div className="w-8 sm:w-10 h-16 rounded-full bg-surface-bright border-2 border-border" />
            <div className="w-8 sm:w-10 h-28 rounded-full bg-primary shadow-glow stripe-pattern" />
          </div>
        </div>

        {/* General Progress Bar */}
        <div className="relative z-10 mt-1 mb-1">
          <ProgressBar {...progress} />
        </div>

        {/* Small Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 z-10 mt-2">
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-border bg-secondary/30">
            <span className="text-[10px] font-bold text-muted-foreground font-display uppercase tracking-wider mb-1">
              Ritmo Medio
            </span>
            <span className="text-sm sm:text-base font-extrabold font-display text-foreground">
              {weekAvgPace > 0
                ? formatPace(weekAvgPace).replace("/km", "")
                : "—"}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-border bg-secondary/30">
            <span className="text-[10px] font-bold text-muted-foreground font-display uppercase tracking-wider mb-1">
              Tiempo Total
            </span>
            <span className="text-sm sm:text-base font-extrabold font-display text-foreground">
              {weekTotalDuration > 0
                ? formatDuration(weekTotalDuration)
                    .replace(" h", "h")
                    .replace(" min", "m")
                : "—"}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-border bg-secondary/30">
            <span className="text-[10px] font-bold text-muted-foreground font-display uppercase tracking-wider mb-1">
              Sesiones
            </span>
            <span className="text-sm sm:text-base font-extrabold font-display text-primary">
              {weekSessions}
            </span>
          </div>
        </div>

        {/* Bar Chart Section */}
        <div className="mt-2 z-10">
          {detailQuery.isLoading ? (
            <Skeleton className="h-32 w-full rounded-2xl bg-slate-800/80" />
          ) : (
            <WeekVolumeChart
              mondayISO={weekMondayISO}
              workouts={selectedWeekData?.workouts ?? []}
              className="mt-2"
            />
          )}
        </div>

        {/* Bottom Context Info */}
        <div className="flex items-center justify-between border-t border-border pt-4 mt-2 text-xs font-semibold text-muted-foreground z-10 flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-foreground truncate font-display tracking-wide">
              {plan.name}
            </span>
            {selectedWeekData && (
              <span className="px-2 py-0.5 rounded-full bg-secondary text-primary whitespace-nowrap shrink-0 border border-border">
                Semana {selectedWeekData.number}
              </span>
            )}
          </div>
          <span className="shrink-0">
            {formatDateRange(plan.start_date, plan.end_date)}
          </span>
        </div>
      </div>
      <style>{`
        .stripe-pattern {
          background-image: repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 4px,
            rgba(0, 0, 0, 0.1) 4px,
            rgba(0, 0, 0, 0.1) 8px
          );
        }
      `}</style>
    </Link>
  )
}
