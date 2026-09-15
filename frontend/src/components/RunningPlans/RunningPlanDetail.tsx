import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flag,
  Pencil,
  Trash2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  RacesService,
  RunningPlansService,
  type RunningWorkoutPublic,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import {
  blocksDistanceKm,
  formatDateRange,
  formatDistance,
  formatPace,
  formatShortDate,
  PHASE_COLORS,
  type PhaseColor,
  PLAN_STATUS_META,
  WORKOUT_STATUS_META,
  WORKOUT_TYPE_META,
} from "./running-utils"
import { WorkoutBlocksDrawer } from "./WorkoutBlocksDrawer"

type MatchedActivity = {
  activity_id?: string
  name?: string | null
  distance_meters?: number | null
  duration_seconds?: number | null
}

type SelectedWorkout = {
  workout: RunningWorkoutPublic
  phaseName: string
  weekNumber: number
}

function StatChip({
  label,
  value,
  className,
}: {
  label: string
  value: string | number
  className?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border bg-muted/20 px-3 py-2 transition-colors">
      <span className={cn("text-sm font-semibold", className)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function RunningPlanDetail({ planId }: { planId: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [selected, setSelected] = useState<SelectedWorkout | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [collapseInitialized, setCollapseInitialized] = useState(false)

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

  const summary = useMemo(() => {
    let weeks = 0
    let sessions = 0
    let plannedKm = 0
    let completed = 0
    let missed = 0
    let planned = 0
    for (const phase of phases) {
      weeks += phase.weeks?.length ?? 0
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
      weeks,
      sessions,
      plannedKm: Math.round(plannedKm * 10) / 10,
      completed,
      missed,
      planned,
    }
  }, [phases])

  useEffect(() => {
    if (!plan || collapseInitialized) return
    setCollapseInitialized(true)
    const weekIds =
      plan.phases?.flatMap((phase) => phase.weeks?.map((w) => w.id) ?? []) ?? []
    if (weekIds.length > 2) setCollapsed(new Set(weekIds))
  }, [plan, collapseInitialized])

  const toggleWeek = (weekId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(weekId)) {
        next.delete(weekId)
      } else {
        next.add(weekId)
      }
      return next
    })
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

  const workoutDistance = (workout: RunningWorkoutPublic): string => {
    if (workout.distance_km != null) return formatDistance(workout.distance_km)
    const blocks = blocksDistanceKm(workout.blocks ?? [])
    return blocks != null ? formatDistance(blocks) : "—"
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
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

  if (phases.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Volver a rutinas"
              asChild
            >
              <Link to="/routines">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {plan.name}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {plan.goal ? `${plan.goal} · ` : ""}
                {formatDateRange(plan.start_date, plan.end_date)}
              </p>
            </div>
          </div>
          <Badge
            variant={planStatus.variant}
            className={cn("w-fit", planStatus.className)}
          >
            {planStatus.label}
          </Badge>
        </div>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-semibold">Este plan no tiene fases</p>
          <p className="text-muted-foreground">
            Agregá fases, semanas y sesiones para empezar a entrenar.
          </p>
          <Button type="button" asChild>
            <Link to="/routines/run/new" search={{ edit: planId }}>
              <Pencil className="mr-2 size-4" /> Editar plan
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Volver a rutinas"
              asChild
            >
              <Link to="/routines">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {plan.name}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {plan.goal ? `${plan.goal} · ` : ""}
                {formatDateRange(plan.start_date, plan.end_date)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Badge
              variant={planStatus.variant}
              className={planStatus.className}
            >
              {planStatus.label}
            </Badge>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link to="/routines/run/new" search={{ edit: planId }}>
                <Pencil className="mr-2 size-4" /> Editar plan
              </Link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deletePlan.isPending}
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 size-4" /> Eliminar
            </Button>
          </div>
        </div>
        {plan.race_id ? (
          <Badge
            variant="outline"
            asChild
            className="w-fit gap-1 border-domain-cardio/30 bg-domain-cardio/10 text-domain-cardio hover:bg-domain-cardio/15"
          >
            <Link to="/races/$raceId" params={{ raceId: plan.race_id }}>
              <Flag className="size-3" />
              {raceQuery.data?.event_name ?? "Carrera objetivo"}
            </Link>
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <StatChip
          label={summary.weeks === 1 ? "semana" : "semanas"}
          value={summary.weeks}
        />
        <StatChip
          label={summary.sessions === 1 ? "sesión" : "sesiones"}
          value={summary.sessions}
        />
        <StatChip label="km planificados" value={summary.plannedKm} />
        <StatChip
          label="completadas"
          value={summary.completed}
          className={summary.completed > 0 ? "text-emerald-600" : undefined}
        />
        <StatChip
          label="perdidas"
          value={summary.missed}
          className={summary.missed > 0 ? "text-destructive" : undefined}
        />
        <StatChip label="planificadas" value={summary.planned} />
      </div>

      <div className="flex flex-col gap-6">
        {phases.map((phase) => {
          const phaseColor =
            PHASE_COLORS[phase.color as PhaseColor] ?? PHASE_COLORS.slate
          return (
            <section key={phase.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-1.5 self-stretch rounded-full",
                    phaseColor.bar,
                  )}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{phase.name}</h2>
                  {phase.objective ? (
                    <p className="text-sm text-muted-foreground">
                      {phase.objective}
                    </p>
                  ) : null}
                </div>
                <Badge
                  variant="secondary"
                  className={cn("shrink-0", phaseColor.badge)}
                >
                  Semanas {phase.start_week}–{phase.end_week}
                </Badge>
              </div>
              {phase.description ? (
                <p className="text-sm text-muted-foreground">
                  {phase.description}
                </p>
              ) : null}
              <div className="flex flex-col gap-3">
                {(phase.weeks ?? []).map((week) => {
                  const isCollapsed = collapsed.has(week.id)
                  const workouts = week.workouts ?? []
                  return (
                    <div key={week.id} className="rounded-lg border bg-card">
                      <button
                        type="button"
                        onClick={() => toggleWeek(week.id)}
                        aria-expanded={!isCollapsed}
                        data-state={isCollapsed ? "closed" : "open"}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          Semana {week.number}
                        </span>
                        {week.name ? (
                          <span className="truncate text-sm text-muted-foreground">
                            {week.name}
                          </span>
                        ) : null}
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {formatDateRange(week.start_date, week.end_date)}
                          {workouts.length > 0
                            ? ` · ${workouts.length} ${
                                workouts.length === 1 ? "sesión" : "sesiones"
                              }`
                            : ""}
                        </span>
                      </button>
                      <div
                        data-state={isCollapsed ? "closed" : "open"}
                        className="grid transition-all duration-300 ease-in-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]"
                      >
                        <div className="overflow-hidden">
                          <div className="flex flex-col gap-3 border-t px-3 py-3">
                            {week.objective ? (
                              <p className="text-sm text-muted-foreground">
                                {week.objective}
                              </p>
                            ) : null}
                            {workouts.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Sin sesiones en esta semana.
                              </p>
                            ) : (
                              <div className="-mx-3 overflow-x-auto px-3">
                                <Table className="min-w-[36rem]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-28">
                                        Fecha
                                      </TableHead>
                                      <TableHead>Sesión</TableHead>
                                      <TableHead>Tipo</TableHead>
                                      <TableHead>Distancia</TableHead>
                                      <TableHead>Ritmo</TableHead>
                                      <TableHead>Estado</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {workouts.map((workout) => {
                                      const typeMeta =
                                        WORKOUT_TYPE_META[workout.type]
                                      const statusMeta =
                                        WORKOUT_STATUS_META[workout.status]
                                      const matched =
                                        workout.matched_activity as MatchedActivity | null
                                      return (
                                        <TableRow
                                          key={workout.id}
                                          className="cursor-pointer transition-colors hover:bg-muted/40"
                                          onClick={() =>
                                            setSelected({
                                              workout,
                                              phaseName: phase.name,
                                              weekNumber: week.number,
                                            })
                                          }
                                        >
                                          <TableCell>
                                            <span className="whitespace-nowrap font-medium">
                                              {formatShortDate(workout.date)}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <div className="max-w-44 truncate font-medium">
                                              {workout.name ?? typeMeta.label}
                                            </div>
                                            {workout.objective ? (
                                              <div className="max-w-44 truncate text-xs text-muted-foreground">
                                                {workout.objective}
                                              </div>
                                            ) : null}
                                          </TableCell>
                                          <TableCell>
                                            <span
                                              className={cn(
                                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                                                typeMeta.badgeClass,
                                              )}
                                            >
                                              {typeMeta.emoji} {typeMeta.label}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <span className="whitespace-nowrap">
                                              {workoutDistance(workout)}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <span className="whitespace-nowrap">
                                              {formatPace(
                                                workout.pace_seconds_per_km,
                                              )}
                                            </span>
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-1.5">
                                              <Badge
                                                variant={statusMeta.variant}
                                                className={statusMeta.className}
                                              >
                                                {statusMeta.label}
                                              </Badge>
                                              {workout.status_override !=
                                              null ? (
                                                <Badge
                                                  variant="outline"
                                                  className="text-muted-foreground"
                                                >
                                                  Manual
                                                </Badge>
                                              ) : null}
                                              {workout.status === "completed" &&
                                              matched?.activity_id ? (
                                                <Link
                                                  to="/activities/$activityId"
                                                  params={{
                                                    activityId:
                                                      matched.activity_id,
                                                  }}
                                                  aria-label="Ver actividad en Strava"
                                                  className="text-domain-cardio transition-colors hover:text-domain-cardio/70"
                                                  onClick={(event) =>
                                                    event.stopPropagation()
                                                  }
                                                >
                                                  <ExternalLink className="size-3.5" />
                                                </Link>
                                              ) : null}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {selected ? (
        <WorkoutBlocksDrawer
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null)
          }}
          planId={planId}
          workout={selected.workout}
          phaseName={selected.phaseName}
          weekNumber={selected.weekNumber}
        />
      ) : null}
    </div>
  )
}
