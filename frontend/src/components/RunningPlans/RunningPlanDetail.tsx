import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Bell } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  RacesService,
  RunningPlansService,
  type RunningWorkoutPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import { PaccerWorkoutSheet } from "./PaccerWorkoutSheet"
import { PlanGuideSheet } from "./PlanGuideSheet"
import { PlanPaceInsightsCard } from "./PlanPaceInsightsCard"
import { PlanWeekOverviewCard } from "./PlanWeekOverviewCard"
import { RunnaPlanHeroCard } from "./RunnaPlanHeroCard"
import { RunnaPlanQuickActions } from "./RunnaPlanQuickActions"
import {
  buildPlanMarkdown,
  downloadPlanFile,
  type PlanExportScope,
  planExportFilename,
} from "./plan-export"
import {
  blocksDistanceKm,
  buildWeeklyOverview,
  PLAN_STATUS_META,
} from "./running-utils"
import { WorkoutBlocksDrawer } from "./WorkoutBlocksDrawer"

type SelectedWorkout = {
  workout: RunningWorkoutPublic
  phaseName: string
  weekNumber: number
}

export function RunningPlanDetail({
  planId,
  initialWeek,
  initialDay,
}: {
  planId: string
  initialWeek?: number
  initialDay?: string
  initialView?: "overview" | "evolution"
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [selected, setSelected] = useState<SelectedWorkout | null>(null)
  const [paccerSheetOpen, setPaccerSheetOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [expandedWeekIds, setExpandedWeekIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [dayHandled, setDayHandled] = useState(false)

  const query = useQuery({
    queryKey: ["running-plan", planId],
    queryFn: () => RunningPlansService.readPlan({ planId }),
  })

  const plan = query.data

  const raceQuery = useQuery({
    queryKey: ["race", plan?.race_id ?? ""],
    queryFn: () => RacesService.readRace({ raceId: plan!.race_id! }),
    enabled: Boolean(plan?.race_id),
  })

  const phases = plan?.phases ?? []

  const weeks = useMemo(
    () => buildWeeklyOverview(phases, undefined, plan?.week_start_day ?? 1),
    [phases, plan?.week_start_day],
  )

  const currentWeekNumber = useMemo(
    () => weeks.find((week) => week.status === "current")?.number,
    [weeks],
  )

  const summary = useMemo(() => {
    let weeksCount = 0
    let sessions = 0
    let plannedKm = 0
    let completed = 0
    let missed = 0
    let planned = 0
    for (const phase of phases) {
      weeksCount += phase.weeks?.length ?? 0
      for (const week of phase.weeks ?? []) {
        for (const workout of week.workouts ?? []) {
          sessions += 1
          if (workout.status === "completed") completed += 1
          else if (workout.status === "missed") missed += 1
          else if (workout.status === "planned") planned += 1

          const distance =
            workout.distance_km ?? blocksDistanceKm(workout.blocks ?? [])
          if (distance != null) plannedKm += distance
        }
      }
    }
    return {
      weeks: weeksCount,
      sessions,
      plannedKm: Math.round(plannedKm * 10) / 10,
      completed,
      missed,
      planned,
    }
  }, [phases])

  // Expande únicamente la semana actual (o la primera) por defecto para mantener la vista limpia
  useEffect(() => {
    if (weeks.length === 0 || initialized) return
    setInitialized(true)
    const targetNumber =
      initialWeek ?? weeks.find((week) => week.status === "current")?.number
    const target =
      weeks.find((week) => week.number === targetNumber) ?? weeks[0]
    setExpandedWeekIds(target ? new Set([target.id]) : new Set())
  }, [weeks, initialWeek, initialized])

  // Deep link ?week=N → scroll suave al ancla de la semana.
  useEffect(() => {
    if (!initialWeek || weeks.length === 0) return
    const timer = window.setTimeout(() => {
      document
        .getElementById(`week-${initialWeek}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [initialWeek, weeks.length])

  // Deep link ?day=ISO → abre el sheet de esa sesión.
  useEffect(() => {
    if (!initialDay || dayHandled || weeks.length === 0) return
    for (const week of weeks) {
      const workout = week.workouts.find((w) => w.date === initialDay)
      if (workout) {
        setSelected({
          workout,
          phaseName: week.phaseName,
          weekNumber: week.number,
        })
        setPaccerSheetOpen(true)
        setDayHandled(true)
        break
      }
    }
  }, [initialDay, weeks, dayHandled])

  const toggleWeek = (weekId: string) => {
    setExpandedWeekIds((prev) => {
      const next = new Set(prev)
      if (next.has(weekId)) next.delete(weekId)
      else next.add(weekId)
      return next
    })
  }

  const openWorkout = (
    workout: RunningWorkoutPublic,
    phaseName: string,
    weekNumber: number,
  ) => {
    setSelected({ workout, phaseName, weekNumber })
    setPaccerSheetOpen(true)
  }

  const handleSelectWeek = (weekNumber: number) => {
    const week = weeks.find((w) => w.number === weekNumber)
    if (week) {
      setExpandedWeekIds((prev) => new Set(prev).add(week.id))
    }
    document
      .getElementById(`week-${weekNumber}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const deletePlan = useMutation({
    mutationFn: () => RunningPlansService.deletePlan({ planId }),
    onSuccess: () => {
      showSuccessToast("Plan eliminado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      navigate({ to: "/routines" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleDelete = () => {
    if (!plan) return
    if (
      !window.confirm(
        `¿Eliminás el plan "${plan.name}"? Se borran todas sus fases, semanas y sesiones. Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    deletePlan.mutate()
  }

  const handleDownloadExport = (scope: PlanExportScope) => {
    if (!plan) return
    downloadPlanFile(
      buildPlanMarkdown(plan, scope),
      planExportFilename(plan, scope),
    )
    showSuccessToast(
      scope === "current"
        ? "Semana actual descargada (.md)"
        : "Plan descargado (.md)",
    )
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-20 shrink-0 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (query.isError || !plan) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">No se pudo cargar el plan</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
          >
            Reintentar
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/routines">
              <ArrowLeft className="mr-2 size-4" /> Volver a rutinas
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const planStatus = PLAN_STATUS_META[plan.status]

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      {/* ── Top Bar estilo Runna (PAgina_tuplan_completa.jpg) ── */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Volver a rutinas"
          className="size-10 rounded-full bg-card border border-border/60 hover:bg-white/10"
          asChild
        >
          <Link to="/routines">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>

        <h1 className="font-display text-lg font-black text-white tracking-tight">
          Tu plan
        </h1>

        <div className="flex items-center gap-2">
          <Badge
            variant={planStatus.variant}
            className={cn("hidden sm:flex font-bold text-xs", planStatus.className)}
          >
            {planStatus.label}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-full bg-card border border-border/60 text-muted-foreground hover:text-white"
            onClick={() => showSuccessToast("No hay nuevas notificaciones del plan")}
            title="Notificaciones"
          >
            <Bell className="size-5" />
          </Button>
        </div>
      </div>

      {/* ── 1. Tarjeta Hero del Plan (PAgina_tuplan_completa.jpg) ── */}
      <RunnaPlanHeroCard
        plan={plan}
        race={raceQuery.data}
        weeks={weeks}
        totalKm={summary.plannedKm}
      />

      {/* ── 2. Acciones Rápidas: Visión general | Apps conectadas | Gestionar plan ── */}
      <RunnaPlanQuickActions
        plan={plan}
        weeks={weeks}
        currentWeekNumber={currentWeekNumber}
        onSelectWeek={handleSelectWeek}
        onExportMarkdown={() => handleDownloadExport("full")}
        onDeletePlan={handleDelete}
      />

      {/* ── 3. Análisis del Ritmo & Tiempos Estimados ── */}
      <PlanPaceInsightsCard plan={plan} race={raceQuery.data} />

      {/* ── 4. Semanas del Plan (Feed limpio con semana actual desplegada) ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Semanas del plan ({weeks.length})
          </span>
          <button
            type="button"
            onClick={() => {
              if (expandedWeekIds.size === weeks.length) {
                setExpandedWeekIds(new Set())
              } else {
                setExpandedWeekIds(new Set(weeks.map((w) => w.id)))
              }
            }}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            {expandedWeekIds.size === weeks.length
              ? "Colapsar todas"
              : "Expandir todas"}
          </button>
        </div>

        {weeks.map((week) => (
          <PlanWeekOverviewCard
            key={week.id}
            week={week}
            expanded={expandedWeekIds.has(week.id)}
            onToggle={() => toggleWeek(week.id)}
            onSelectWorkout={(workout) =>
              openWorkout(workout, week.phaseName, week.number)
            }
          />
        ))}
      </div>


      {/* Lectura de la sesión */}
      <PaccerWorkoutSheet
        open={paccerSheetOpen}
        onOpenChange={setPaccerSheetOpen}
        workout={selected?.workout ?? null}
        phaseName={selected?.phaseName}
        weekNumber={selected?.weekNumber}
        onEdit={() => {
          setPaccerSheetOpen(false)
          setEditOpen(true)
        }}
      />

      {/* Edición avanzada de la sesión */}
      {selected && (
        <WorkoutBlocksDrawer
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open)
            if (!open) setSelected(null)
          }}
          planId={planId}
          workout={selected.workout}
          phaseName={selected.phaseName}
          weekNumber={selected.weekNumber}
        />
      )}

      {/* Guía del plan */}
      <PlanGuideSheet open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  )
}
