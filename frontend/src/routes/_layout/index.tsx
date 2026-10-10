import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { ChevronDown, ChevronUp, Play } from "lucide-react"
import { useMemo, useState } from "react"
import { AnalyticsService, RunningPlansService, SyncService } from "@/client"
import { CoachCard } from "@/components/Dashboard/CoachCard"
import { StravaSyncBar } from "@/components/Dashboard/StravaSyncBar"
import { StreakCard } from "@/components/Dashboard/StreakCard"
import { TargetRaceHeroCard } from "@/components/Dashboard/TargetRaceHeroCard"
import { TodayWorkoutCard } from "@/components/Dashboard/TodayWorkoutCard"

import { VolumeCard } from "@/components/Dashboard/VolumeCard"
import { type DayStatus, WeekStrip } from "@/components/Dashboard/WeekStrip"
import { ManualRunSheet } from "@/components/Sheets/ManualRunSheet"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: OpenRunningDashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - OpenRunning",
      },
    ],
  }),
})

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(12, 0, 0, 0)
  return date
}

function formatDateIso(d: Date): string {
  return d.toISOString().split("T")[0]
}

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

function OpenRunningDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [weekOffset, setWeekOffset] = useState(0)
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false)
  const [isProgressExpanded, setIsProgressExpanded] = useState(false)

  const baseMonday = useMemo(() => {
    const today = new Date()
    const monday = getMonday(today)
    monday.setDate(monday.getDate() + weekOffset * 7)
    return monday
  }, [weekOffset])

  const weekStartIso = formatDateIso(baseMonday)

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", weekStartIso],
    queryFn: () => AnalyticsService.readDashboard({ weekStart: weekStartIso }),
  })

  const dashboard = dashboardQuery.data

  // Plan actual y detalle de fases
  const plansQuery = useQuery({
    queryKey: ["running-plans"],
    queryFn: () => RunningPlansService.readPlans(),
  })
  const activePlan = plansQuery.data?.data.find((p) => p.status === "active")

  const planDetailQuery = useQuery({
    queryKey: ["running-plan", activePlan?.id],
    queryFn: () => RunningPlansService.readPlan({ planId: activePlan!.id }),
    enabled: Boolean(activePlan?.id),
    staleTime: 5 * 60 * 1000,
  })

  const syncMutation = useMutation({
    mutationFn: () => SyncService.triggerSync({ provider: "strava" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["shoes"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
    },
  })

  const todayIso = formatDateIso(new Date())

  // Sesión de hoy y progreso de semanas del plan activo
  const planStats = useMemo(() => {
    if (!planDetailQuery.data) {
      return {
        todayWorkout: null,
        currentWeekNumber: 1,
        totalWeeks: 12,
        totalPlanKm: undefined,
      }
    }
    const plan = planDetailQuery.data
    const phases = plan.phases ?? []
    const allWorkouts: any[] = []
    let totalKm = 0
    let totalWeeksCount = 0

    phases.forEach((p) => {
      (p.weeks ?? []).forEach((w) => {
        totalWeeksCount = Math.max(totalWeeksCount, w.number)
        ;(w.workouts ?? []).forEach((wo) => {
          totalKm += wo.distance_km || 0
          allWorkouts.push({ ...wo, weekNumber: w.number })
        })
      })
    })

    // Buscar entrenamiento de hoy (o próximo)
    const todayWo = allWorkouts.find((wo) => wo.date === todayIso && !wo.cancelled) || null
    
    // Calcular en qué semana del plan estamos según fecha de inicio
    let currentWeekNumber = 1
    if (plan.start_date) {
      const start = new Date(plan.start_date).getTime()
      const now = new Date(todayIso).getTime()
      const diffWeeks = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1
      currentWeekNumber = Math.max(1, Math.min(diffWeeks, totalWeeksCount || 1))
    }

    return {
      todayWorkout: todayWo,
      currentWeekNumber,
      totalWeeks: totalWeeksCount || 12,
      totalPlanKm: totalKm > 0 ? totalKm : undefined,
    }
  }, [planDetailQuery.data, todayIso])

  // Generate 7 day statuses for WeekStrip
  const days: DayStatus[] = useMemo(() => {
    const result: DayStatus[] = []
    const timeline = dashboard?.timeline || []
    const timelineMap = new Map(timeline.map((d) => [d.date, d]))

    for (let i = 0; i < 7; i++) {
      const current = new Date(baseMonday)
      current.setDate(baseMonday.getDate() + i)
      const iso = formatDateIso(current)
      const isToday = iso === todayIso
      const dayData = timelineMap.get(iso)

      let status: DayStatus["status"] = "empty"
      if (dayData?.activities && dayData.activities.length > 0) {
        status = "done"
      }

      result.push({
        dateIso: iso,
        dayName: DAYS_SHORT[current.getDay()],
        dayNumber: current.getDate(),
        isToday,
        status,
        workoutTitle: dayData?.activities?.[0]?.name || undefined,
        activityId: dayData?.activities?.[0]?.id || undefined,
      })
    }
    return result
  }, [baseMonday, dashboard, todayIso])

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "Esta semana"
    const sunday = new Date(baseMonday)
    sunday.setDate(baseMonday.getDate() + 6)
    return `${baseMonday.getDate()} ${baseMonday.toLocaleDateString("es-AR", { month: "short" })} – ${sunday.getDate()} ${sunday.toLocaleDateString("es-AR", { month: "short" })}`
  }, [baseMonday, weekOffset])

  const kpis = dashboard?.kpis
  const currentKm = (kpis?.cardio_distance_meters || 0) / 1000
  const targetKm = dashboard?.previous_kpis
    ? Math.max(
        10,
        Math.round(dashboard.previous_kpis.cardio_distance_meters / 1000) + 5,
      )
    : 50.0

  const formatPace = (secondsPerKm?: number | null) => {
    if (!secondsPerKm) return undefined
    const mins = Math.floor(secondsPerKm / 60)
    const secs = Math.floor(secondsPerKm % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  const avgPaceText = formatPace(kpis?.cardio_avg_pace_seconds_per_km)

  const upcomingRace = dashboard?.upcoming_race
  const daysToRace = upcomingRace
    ? Math.max(
        0,
        Math.ceil(
          (new Date(upcomingRace.date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0

  // 1. Strava Sync State
  const stravaSyncState = dashboard?.sync_state?.find(
    (s) => s.provider === "strava",
  )
  let lastSyncText = "Strava sin configurar"
  if (stravaSyncState) {
    if (stravaSyncState.last_run_at) {
      const diffMin = Math.floor(
        (Date.now() - new Date(stravaSyncState.last_run_at).getTime()) / 60000,
      )
      if (diffMin < 1) lastSyncText = "Strava sincronizado · recién"
      else if (diffMin < 60)
        lastSyncText = `Strava sincronizado · hace ${diffMin} min`
      else if (diffMin < 1440)
        lastSyncText = `Strava sincronizado · hace ${Math.floor(diffMin / 60)} h`
      else
        lastSyncText = `Strava sincronizado · hace ${Math.floor(diffMin / 1440)} d`
    } else {
      lastSyncText = "Strava conectado (sin sincro)"
    }
  }

  const handleManualRunSubmit = async (_data: any) => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-20 max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 px-1">
        <div>
          <h1 className="text-2xl font-display font-black text-white tracking-tight">
            ¡Hola, {user?.full_name?.split(" ")[0] || "Corredor"}!
          </h1>
          <p className="text-xs text-muted-foreground capitalize font-medium">
            {new Date().toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsManualSheetOpen(true)}
          aria-label="RUN"
          className="group flex flex-col items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(234,252,95,0.25)] transition-transform active:scale-95 group-hover:scale-105">
            <Play className="size-5 fill-current stroke-none ml-0.5" />
          </div>
          <span className="text-[10px] font-bold leading-none text-primary tracking-wider">
            RUN
          </span>
        </button>
      </div>

      {/* Strava Sync Bar */}
      <StravaSyncBar
        lastSyncText={lastSyncText}
        isSyncing={syncMutation.isPending}
        onSyncStrava={() => syncMutation.mutate()}
        onOpenManualRun={() => setIsManualSheetOpen(true)}
      />

      {/* 1. Carrera Objetivo Principal (Mockups 4 & 7) */}
      <TargetRaceHeroCard
        raceName={upcomingRace?.event_name || (activePlan ? activePlan.name : undefined)}
        daysRemaining={upcomingRace ? daysToRace : undefined}
        dateText={
          upcomingRace
            ? new Date(upcomingRace.date).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : activePlan?.end_date
              ? new Date(activePlan.end_date).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : undefined
        }
        distanceKm={upcomingRace?.distance_km || activePlan?.distance_km || undefined}
        currentWeek={planStats.currentWeekNumber}
        totalWeeks={planStats.totalWeeks}
        totalPlanKm={planStats.totalPlanKm}
        goalText={activePlan?.goal || "Completar la distancia"}
        onViewWorkouts={() => {
          if (activePlan?.id) {
            navigate({
              to: "/routines/run/$planId",
              params: { planId: activePlan.id },
            })
          } else {
            navigate({ to: "/routines/run/new" as any })
          }
        }}
      />

      {/* 2. Sección Plegable: Progreso del Entrenamiento (Mockup 4) */}
      <div className="rounded-2xl border border-white/5 bg-[#121214] overflow-hidden shadow-card">
        <button
          type="button"
          onClick={() => setIsProgressExpanded(!isProgressExpanded)}
          className="w-full p-4 flex items-center justify-between text-left text-sm font-bold text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <span>Progreso del entrenamiento</span>
          {isProgressExpanded ? (
            <ChevronUp className="size-5 text-primary" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          )}
        </button>

        {isProgressExpanded && (
          <div className="p-4 pt-1 border-t border-white/5 space-y-4">
            <WeekStrip
              days={days}
              weekLabel={weekLabel}
              onPrevWeek={() => setWeekOffset((w) => w - 1)}
              onNextWeek={() => setWeekOffset((w) => w + 1)}
              onSelectDay={(day) => {
                if (day.activityId) {
                  navigate({
                    to: "/activities/$activityId",
                    params: { activityId: day.activityId },
                  })
                }
              }}
            />

            <VolumeCard
              currentKm={currentKm}
              targetKm={targetKm}
              avgPaceText={avgPaceText}
              onOpenCalendar={() => navigate({ to: "/analytics" as any })}
            />

            <StreakCard
              streakWeeks={0}
              completedSessions={kpis?.sessions || 0}
              plannedSessions={4}
              onOpenCalendar={() => navigate({ to: "/analytics" as any })}
            />
          </div>
        )}
      </div>

      {/* 3. Entrenamiento de Hoy (Mockup 4) */}
      <TodayWorkoutCard
        workout={planStats.todayWorkout}
        planId={activePlan?.id}
        weekNumber={planStats.currentWeekNumber}
        isLoading={planDetailQuery.isLoading}
        onOpenManualRun={() => setIsManualSheetOpen(true)}
      />

      {/* AI Coach Proposal Card */}
      <CoachCard
        title="AI Coach en desarrollo..."
        subtitle="Las rutinas y planes inteligentes estarán disponibles pronto."
        hasProposal={false}
        onReview={() => {}}
      />

      {/* Manual Run Bottom Sheet */}
      <ManualRunSheet
        isOpen={isManualSheetOpen}
        onClose={() => setIsManualSheetOpen(false)}
        onSubmit={handleManualRunSubmit}
      />
    </div>
  )
}
