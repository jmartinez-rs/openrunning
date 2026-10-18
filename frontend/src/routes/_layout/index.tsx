import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import {
  AnalyticsService,
  RunningPlansService,
  type RunningWorkoutPublic,
  SyncService,
} from "@/client"
import { RunnaDashboardHeader } from "@/components/Dashboard/RunnaDashboardHeader"
import { RunnaHeroWorkoutCard } from "@/components/Dashboard/RunnaHeroWorkoutCard"
import { RunnaMisDatosSection } from "@/components/Dashboard/RunnaMisDatosSection"
import {
  type RunnaDayItem,
  RunnaWeekStrip,
} from "@/components/Dashboard/RunnaWeekStrip"
import { RunnaWeekSummaryCard } from "@/components/Dashboard/RunnaWeekSummaryCard"
import { TargetRaceHeroCard } from "@/components/Dashboard/TargetRaceHeroCard"
import { VolumeCard } from "@/components/Dashboard/VolumeCard"
import { PaccerWorkoutSheet } from "@/components/RunningPlans/PaccerWorkoutSheet"
import { ManualRunSheet } from "@/components/Sheets/ManualRunSheet"
import useCustomToast from "@/hooks/useCustomToast"
import {
  addDaysIso,
  dayOfMonthIso,
  formatDayKey,
  formatShortDayMonth,
  type MonthCursor,
  mondayIso,
  monthCursorOf,
  shiftMonth,
  weekIsoKeys,
} from "@/lib/dashboard-dates"
import {
  buildActivityDates,
  buildWeekDayItems,
  isWorkoutCompleted,
  monthActivityDates as monthActivityDateKeys,
  selectActivePlan,
} from "@/lib/dashboard-model"
import { monthSummaryRequest } from "@/lib/dashboard-query"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/")({
  component: OpenRunningDashboard,
  head: () => ({
    meta: [
      {
        title: "Hoy - OpenRunning",
      },
    ],
  }),
})

const RUNNA_DAYS_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]

function OpenRunningDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const todayIso = useMemo(() => formatDayKey(new Date()), [])
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso)
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false)
  const [workoutForSheet, setWorkoutForSheet] =
    useState<RunningWorkoutPublic | null>(null)

  const [weekOffset, setWeekOffset] = useState(0)

  // Estado de la rejilla mensual: vive acá (no en `RunnaWeekStrip`) para que el
  // strip siga siendo presentacional y SSR-safe (sin `useQuery` adentro), y para
  // que su cursor pueda alimentar la query del resumen mensual.
  const [isMonthExpanded, setIsMonthExpanded] = useState(false)
  const [monthCursor, setMonthCursor] = useState<MonthCursor>(() =>
    monthCursorOf(todayIso),
  )
  // Seam único del resumen mensual (mes + query key + gate) en un helper puro,
  // para que la clave no pueda divergir del cursor (ver `dashboard-query.ts`).
  const monthSummary = useMemo(
    () => monthSummaryRequest(monthCursor, isMonthExpanded),
    [monthCursor, isMonthExpanded],
  )

  // Lunes local de la semana con offset de navegación (autoridad: RUNNING_TIMEZONE)
  const weekStartIso = useMemo(
    () => addDaysIso(mondayIso(new Date()), weekOffset * 7),
    [weekOffset],
  )
  const weekEndIso = useMemo(() => addDaysIso(weekStartIso, 6), [weekStartIso])

  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return "Esta semana"
    return `${formatShortDayMonth(weekStartIso)} – ${formatShortDayMonth(weekEndIso)}`
  }, [weekStartIso, weekEndIso, weekOffset])

  // Query general de analíticas/dashboard
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", weekStartIso],
    queryFn: () => AnalyticsService.readDashboard({ weekStart: weekStartIso }),
  })
  const dashboard = dashboardQuery.data

  // Días locales con al menos una actividad de running real (R5). El timeline
  // ya viene bucketizado por RUNNING_TIMEZONE desde el backend.
  const activityDates = useMemo(
    () => buildActivityDates(dashboard?.timeline),
    [dashboard?.timeline],
  )

  // R9: el mes expandido marca TODOS los días del mes mostrado, no sólo los 7 de
  // la semana cargada. Sólo se consulta el resumen mensual con la rejilla abierta;
  // mientras carga (o si falla) `data` es `undefined` y el mes queda sin marcas
  // extra, sin bloquear ni romper el render.
  const monthSummaryQuery = useQuery({
    queryKey: monthSummary.queryKey,
    queryFn: () =>
      AnalyticsService.readActivitiesSummary({ month: monthSummary.month }),
    enabled: monthSummary.enabled,
  })
  const monthActivityDates = useMemo(
    () => monthActivityDateKeys(monthSummaryQuery.data),
    [monthSummaryQuery.data],
  )

  // Planes de running
  const plansQuery = useQuery({
    queryKey: ["running-plans"],
    queryFn: () => RunningPlansService.readPlans(),
  })
  // Plan que respalda la semana mostrada: derivación cara, memoizada como sus pares
  const activePlan = useMemo(
    () => selectActivePlan(plansQuery.data?.data, weekStartIso, weekEndIso),
    [plansQuery.data, weekStartIso, weekEndIso],
  )

  // Detalle del plan activo (fases, semanas, sesiones estructuradas)
  const planDetailQuery = useQuery({
    queryKey: ["running-plan", activePlan?.id],
    queryFn: () => RunningPlansService.readPlan({ planId: activePlan!.id }),
    enabled: Boolean(activePlan?.id),
    staleTime: 5 * 60 * 1000,
  })

  // Sincronización con Strava
  const syncMutation = useMutation({
    mutationFn: () => SyncService.triggerSync({ provider: "strava" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["shoes"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
      showSuccessToast("Sincronización con Strava iniciada")
    },
    onError: handleError.bind(showErrorToast),
  })

  // Mutación para marcar/desmarcar sesión como completada desde la Hero Card
  const toggleCompleteMutation = useMutation({
    mutationFn: async ({
      workoutId,
      currentCompleted,
    }: {
      workoutId: string
      currentCompleted: boolean
    }) => {
      if (!activePlan?.id) return
      return RunningPlansService.updateWorkout({
        planId: activePlan.id,
        workoutId,
        requestBody: {
          status_override: currentCompleted ? null : "completed",
          cancelled: false,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["running-plan", activePlan?.id],
      })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      showSuccessToast("Estado del entrenamiento actualizado")
    },
    onError: handleError.bind(showErrorToast),
  })

  // Extraer todas las sesiones y estadísticas del plan activo
  const { allWorkouts, currentWeekNumber, totalWeeks, totalPlanKm } =
    useMemo(() => {
      if (!planDetailQuery.data) {
        return {
          allWorkouts: [] as RunningWorkoutPublic[],
          currentWeekNumber: 1,
          totalWeeks: 12,
          totalPlanKm: undefined as number | undefined,
        }
      }

      const plan = planDetailQuery.data
      const phases = plan.phases ?? []
      const workoutsList: RunningWorkoutPublic[] = []
      let totalKm = 0
      let totalWeeksCount = 0

      phases.forEach((p) => {
        ;(p.weeks ?? []).forEach((w) => {
          totalWeeksCount = Math.max(totalWeeksCount, w.number)
          ;(w.workouts ?? []).forEach((wo) => {
            totalKm += wo.distance_km || 0
            workoutsList.push(wo)
          })
        })
      })

      // Calcular semana actual según fecha de inicio
      let currentWeekNum = 1
      if (plan.start_date) {
        const start = new Date(plan.start_date).getTime()
        const now = new Date(todayIso).getTime()
        const diffWeeks =
          Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1
        currentWeekNum = Math.max(1, Math.min(diffWeeks, totalWeeksCount || 1))
      }

      return {
        allWorkouts: workoutsList,
        currentWeekNumber: currentWeekNum,
        totalWeeks: totalWeeksCount || 12,
        totalPlanKm: totalKm > 0 ? totalKm : undefined,
      }
    }, [planDetailQuery.data, todayIso])

  // Entrenamientos mapeados por fecha ISO ("YYYY-MM-DD")
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, RunningWorkoutPublic>()
    allWorkouts.forEach((wo) => {
      if (wo.date && !wo.cancelled) {
        map.set(wo.date, wo)
      }
    })
    return map
  }, [allWorkouts])

  // 7 Días de la semana para el WeekStrip interactivo de Runna
  const weekDays: RunnaDayItem[] = useMemo(() => {
    return buildWeekDayItems(
      weekIsoKeys(weekStartIso),
      workoutsByDate,
      activityDates,
    ).map((item, i) => ({
      dateIso: item.dateIso,
      dayName: RUNNA_DAYS_SHORT[i],
      dayNumber: dayOfMonthIso(item.dateIso),
      isToday: item.dateIso === todayIso,
      isSelected: item.dateIso === selectedDateIso,
      hasWorkout: item.hasWorkout,
      workoutType: workoutsByDate.get(item.dateIso)?.type || null,
      isCompleted: item.isCompleted,
      hasActivity: item.hasActivity,
    }))
  }, [weekStartIso, todayIso, selectedDateIso, workoutsByDate, activityDates])

  // Entrenamiento correspondiente a la fecha seleccionada
  const selectedWorkout = useMemo(() => {
    return workoutsByDate.get(selectedDateIso) || null
  }, [workoutsByDate, selectedDateIso])

  // Estadísticas de la semana actual para RunnaWeekSummaryCard
  const weekSummary = useMemo(() => {
    const currentWeekDates = weekDays.map((d) => d.dateIso)
    const weekWorkouts = allWorkouts.filter(
      (wo) => wo.date && currentWeekDates.includes(wo.date) && !wo.cancelled,
    )

    const totalWorkouts = weekWorkouts.length
    const completedWorkouts = weekWorkouts.filter((wo) =>
      isWorkoutCompleted(wo),
    ).length

    const totalWeekKm = weekWorkouts.reduce(
      (sum, wo) => sum + (wo.distance_km || 0),
      0,
    )
    const completedKmCalculated = weekWorkouts
      .filter((wo) => isWorkoutCompleted(wo))
      .reduce((sum, wo) => sum + (wo.distance_km || 0), 0)

    // Si hay km de Strava registrados en la semana y no están linkeados, usar el máximo
    const stravaWeekKm = (dashboard?.kpis?.cardio_distance_meters || 0) / 1000
    const completedKm = Math.max(completedKmCalculated, stravaWeekKm)

    return {
      totalWorkouts,
      completedWorkouts,
      totalWeekKm,
      completedKm,
    }
  }, [weekDays, allWorkouts, dashboard?.kpis?.cardio_distance_meters])

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

  // Datos de la próxima carrera objetivo (TargetRace)
  const upcomingRace = dashboard?.upcoming_race
  const targetDateIso = upcomingRace?.date || activePlan?.end_date
  const daysToRace = targetDateIso
    ? Math.max(
        0,
        Math.ceil(
          (new Date(targetDateIso).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : undefined

  // Estado de sincronización Strava
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
    queryClient.invalidateQueries({ queryKey: ["running-plan"] })
  }

  return (
    <div className="col-span-12 flex flex-col gap-5 pb-28 max-w-xl mx-auto w-full px-2 sm:px-0">
      {/* 1. Header: Nombre semana y flechas en los laterales para moverme entre semanas */}
      <RunnaDashboardHeader
        weekLabel={weekLabel}
        currentWeekNumber={Math.max(
          1,
          Math.min(currentWeekNumber + weekOffset, totalWeeks),
        )}
        totalWeeks={totalWeeks}
        hasActivePlan={Boolean(activePlan)}
        onPrevWeek={() => setWeekOffset((w) => w - 1)}
        onNextWeek={() => setWeekOffset((w) => w + 1)}
      />

      {/* 2. Week Strip interactivo estilo Runna con puntos de color y notch expandible a mes */}
      <RunnaWeekStrip
        days={weekDays}
        selectedDateIso={selectedDateIso}
        workoutsByDate={workoutsByDate}
        isMonthExpanded={isMonthExpanded}
        monthCursor={monthCursor}
        monthActivityDates={monthActivityDates}
        onToggleMonth={() => setIsMonthExpanded((prev) => !prev)}
        onShiftMonth={(delta) =>
          setMonthCursor((prev) => shiftMonth(prev, delta))
        }
        onSelectDay={(dateIso) => setSelectedDateIso(dateIso)}
      />

      {/* 3. Hero Card del Entrenamiento (Hoy o día seleccionado) */}
      <RunnaHeroWorkoutCard
        workout={selectedWorkout}
        selectedDateIso={selectedDateIso}
        isToday={selectedDateIso === todayIso}
        isLoading={plansQuery.isLoading || planDetailQuery.isLoading}
        weatherTemp="18°"
        weatherCondition="cloudy"
        isTogglingComplete={toggleCompleteMutation.isPending}
        onToggleComplete={(workoutId, currentCompleted) => {
          toggleCompleteMutation.mutate({ workoutId, currentCompleted })
        }}
        onViewDetails={() => {
          if (selectedWorkout) {
            setWorkoutForSheet(selectedWorkout)
          }
        }}
        onOpenManualRun={() => setIsManualSheetOpen(true)}
      />

      {/* 4. Resumen de la semana estilo Runna (por arriba de prueba objetivo) */}
      <RunnaWeekSummaryCard
        weekNumber={Math.max(
          1,
          Math.min(currentWeekNumber + weekOffset, totalWeeks),
        )}
        completedWorkouts={weekSummary.completedWorkouts}
        totalWorkouts={weekSummary.totalWorkouts}
        completedKm={weekSummary.completedKm}
        totalWeekKm={weekSummary.totalWeekKm}
        onNavigateToWeek={() => {
          if (activePlan?.id) {
            navigate({
              to: "/routines/run/$planId",
              params: { planId: activePlan.id },
              search: { week: currentWeekNumber },
            })
          }
        }}
      />

      {/* 5. Volumen semanal y Ritmo promedio */}
      <VolumeCard
        currentKm={currentKm}
        targetKm={targetKm}
        avgPaceText={avgPaceText}
        onOpenCalendar={() => navigate({ to: "/analytics" as any })}
      />

      {/* 6. ⭐ PRÓXIMA CARRERA (PRUEBA OBJETIVO) - PRESERVADO AL 100% ⭐ */}
      <TargetRaceHeroCard
        raceName={
          upcomingRace?.event_name || (activePlan ? activePlan.name : undefined)
        }
        daysRemaining={daysToRace}
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
        distanceKm={
          upcomingRace?.distance_km || activePlan?.distance_km || undefined
        }
        currentWeek={currentWeekNumber}
        totalWeeks={totalWeeks}
        totalPlanKm={totalPlanKm}
        goalText={activePlan?.goal || "Completar con buenas sensaciones"}
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

      {/* 7. Sección colapsable "Mis datos": Strava */}
      <RunnaMisDatosSection
        stravaLastSyncText={lastSyncText}
        isSyncingStrava={syncMutation.isPending}
        onSyncStrava={() => syncMutation.mutate()}
      />

      {/* Hoja de detalle estructurado del entrenamiento (Runna/Paccer style) */}
      <PaccerWorkoutSheet
        open={Boolean(workoutForSheet)}
        onOpenChange={(open) => !open && setWorkoutForSheet(null)}
        workout={workoutForSheet}
        weekNumber={currentWeekNumber}
        onEdit={() => {
          if (activePlan?.id) {
            navigate({
              to: "/routines/run/$planId",
              params: { planId: activePlan.id },
            })
          }
        }}
      />

      {/* Bottom Sheet de Registro Manual */}
      <ManualRunSheet
        isOpen={isManualSheetOpen}
        onClose={() => setIsManualSheetOpen(false)}
        onSubmit={handleManualRunSubmit}
      />
    </div>
  )
}
