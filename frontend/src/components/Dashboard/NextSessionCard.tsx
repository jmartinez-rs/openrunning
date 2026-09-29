import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, CalendarDays } from "lucide-react"
import { useMemo } from "react"

import { RunningPlansService } from "@/client"
import {
  blocksDistanceKm,
  formatDistance,
  formatPace,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "@/components/RunningPlans/running-utils"
import { Skeleton } from "@/components/ui/skeleton"

interface NextSessionCardProps {
  planId?: string | null
  hasCompletedActivityToday?: boolean
  todayIso: string
}

function weekdayName(iso: string): string {
  const todayISO = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowISO = tomorrow.toISOString().slice(0, 10)

  if (iso === todayISO) return "Hoy"
  if (iso === tomorrowISO) return "Mañana"

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

export function NextSessionCard({
  planId,
  hasCompletedActivityToday = false,
  todayIso,
}: NextSessionCardProps) {
  const navigate = useNavigate()

  const detailQuery = useQuery({
    queryKey: ["running-plan", planId],
    queryFn: () => RunningPlansService.readPlan({ planId: planId! }),
    enabled: Boolean(planId),
    staleTime: 5 * 60 * 1000,
  })

  const phases = detailQuery.data?.phases ?? []

  const nextSession = useMemo(() => {
    const all = phases.flatMap((p) =>
      (p.weeks ?? []).flatMap((w) =>
        (w.workouts ?? []).map((wo) => ({ ...wo, weekNumber: w.number })),
      ),
    )
    all.sort((a, b) => a.date.localeCompare(b.date))
    return (
      all.find(
        (wo) =>
          wo.status === "planned" &&
          !wo.cancelled &&
          (hasCompletedActivityToday
            ? wo.date > todayIso
            : wo.date >= todayIso),
      ) ?? null
    )
  }, [phases, todayIso, hasCompletedActivityToday])

  if (!planId) return null

  if (detailQuery.isLoading) {
    return (
      <Skeleton className="h-20 w-full rounded-2xl bg-card border border-border" />
    )
  }

  if (!nextSession) {
    return null
  }

  const nextDistance = workoutDistanceKm(nextSession)
  const nextPace = workoutPaceText(nextSession)

  return (
    <button
      type="button"
      onClick={() =>
        navigate({
          to: "/routines/run/$planId",
          params: { planId },
          search: nextSession.weekNumber
            ? { week: nextSession.weekNumber }
            : {},
        })
      }
      className="group w-full text-left flex items-center justify-between gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 transition-all hover:border-primary hover:bg-primary/10 cursor-pointer shadow-card"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
          <CalendarDays className="size-5 text-primary shrink-0" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
            Próxima sesión
          </span>
          <span className="font-bold text-white text-sm sm:text-base truncate">
            {weekdayName(nextSession.date)} ·{" "}
            {WORKOUT_TYPE_META[nextSession.type as WorkoutType]?.label ??
              "Sesión"}{" "}
            ·{" "}
            {nextDistance != null
              ? formatDistance(nextDistance).replace(" km", "")
              : ""}{" "}
            km
          </span>
          {nextPace && (
            <span className="text-xs text-muted-foreground">{nextPace}</span>
          )}
        </div>
      </div>
      <span className="flex items-center gap-1 text-xs font-bold text-primary whitespace-nowrap shrink-0 group-hover:translate-x-0.5 transition-transform">
        Ver sesión <ArrowRight className="size-3.5" />
      </span>
    </button>
  )
}
