import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { CheckCircle2, XCircle } from "lucide-react"
import { useMemo } from "react"
import {
  ActivitiesService,
  type ActivityPublic,
  PlanService,
  type RoutinePublic,
  RoutinesService,
  RunningPlansService,
  type RunningWorkoutPublic,
  SettingsService,
  type TrainingPlanDayPublic,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type DayEntry = {
  strength: boolean
  cardio: boolean
  strengthVolumeKg: number
  strengthSets: number
  cardioDistanceMeters: number
  cardioDurationSeconds: number
}

type PlanRowKind = "strength" | "running" | "rest"
type PlanRowStatus = "planned" | "completed" | "missed"

type PlanRow = {
  weekday: number
  kind: PlanRowKind
  label: string
  status: PlanRowStatus
}

const WEEKDAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
]

const RUNNING_TYPE_LABELS: Record<RunningWorkoutPublic["type"], string> = {
  easy_run: "Rodaje",
  regeneration: "Regeneración",
  intervals: "Series",
  tempo: "Tempo",
  long_run: "Fondo",
  test: "Test",
  activation: "Activación",
  race: "Carrera",
}

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0)
}

function isDateInRange(
  key: string,
  start: string | null,
  end: string | null,
): boolean {
  if (start && key < formatLocalDateKey(parseLocalDate(start))) return false
  if (end && key > formatLocalDateKey(parseLocalDate(end))) return false
  return true
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function mergeActivity(
  map: Map<string, DayEntry>,
  activity: ActivityPublic,
): void {
  const key = formatLocalDateKey(new Date(activity.timestamp))
  const entry = map.get(key) ?? {
    strength: false,
    cardio: false,
    strengthVolumeKg: 0,
    strengthSets: 0,
    cardioDistanceMeters: 0,
    cardioDurationSeconds: 0,
  }

  if (activity.source_type === "hevy") {
    entry.strength = true
    entry.strengthVolumeKg += activity.strength?.total_volume_kg ?? 0
    entry.strengthSets += activity.strength?.total_sets ?? 0
  } else if (activity.source_type === "strava") {
    entry.cardio = true
    entry.cardioDistanceMeters += activity.cardio?.distance_meters ?? 0
    entry.cardioDurationSeconds += activity.duration_seconds ?? 0
  }

  map.set(key, entry)
}

async function fetchWeekActivities(
  weekStart: Date,
): Promise<Map<string, DayEntry>> {
  const weekEnd = addDays(weekStart, 6)
  const fromDate = formatLocalDateKey(weekStart)
  const toDate = formatLocalDateKey(weekEnd)
  const map = new Map<string, DayEntry>()

  let skip = 0
  const limit = 100

  while (true) {
    const response = await ActivitiesService.readActivities({
      fromDate,
      toDate,
      skip,
      limit,
    })

    for (const activity of response.data) {
      mergeActivity(map, activity)
    }

    skip += response.data.length
    if (skip >= response.count) break
  }

  return map
}

async function fetchRoutines(): Promise<RoutinePublic[]> {
  const routines: RoutinePublic[] = []
  let skip = 0
  const limit = 100

  while (true) {
    const response = await RoutinesService.readRoutines({ skip, limit })
    routines.push(...response.data)
    skip += response.data.length
    if (skip >= response.count) break
  }

  return routines
}

function getRunningLabel(workout: RunningWorkoutPublic): string {
  return (
    workout.name ??
    workout.objective ??
    RUNNING_TYPE_LABELS[workout.type] ??
    "Running"
  )
}

function getPlanLabel(day: TrainingPlanDayPublic): string {
  switch (day.kind) {
    case "strength":
      return day.label ? `Fuerza · ${day.label}` : "Fuerza"
    case "running":
      return day.label ? `Running · ${day.label}` : "Running"
    case "rest":
      return "Descanso"
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes} min`
  return "0 min"
}

function getRowMetric(row: PlanRow, entry?: DayEntry): string | null {
  if (row.kind === "rest" || !entry) return null

  if (row.kind === "strength") {
    if (entry.strengthSets === 0) return null
    return `${Math.round(entry.strengthVolumeKg).toLocaleString()} kg · ${entry.strengthSets} series`
  }

  if (entry.cardioDistanceMeters === 0) return null
  const km = (entry.cardioDistanceMeters / 1000).toFixed(1)
  return `${km} km · ${formatDuration(entry.cardioDurationSeconds)}`
}

export function WeekPlanCard({ weekStart }: { weekStart: Date }) {
  const today = useMemo(() => new Date(), [])
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart])
  const todayKey = useMemo(() => formatLocalDateKey(today), [today])

  const planQuery = useQuery({
    queryKey: ["weekly-plan"],
    queryFn: () => PlanService.readPlan(),
  })

  const activitiesQuery = useQuery({
    queryKey: ["week-activities", formatLocalDateKey(weekStart)],
    queryFn: () => fetchWeekActivities(weekStart),
  })

  const runningPlansQuery = useQuery({
    queryKey: ["running-plans"],
    queryFn: () => RunningPlansService.readPlans(),
  })

  const routinesQuery = useQuery({
    queryKey: ["routines"],
    queryFn: fetchRoutines,
  })

  const goalsQuery = useQuery({
    queryKey: ["weekly-goals"],
    queryFn: () => SettingsService.readGoals(),
  })

  const selectedPlanId = useMemo(() => {
    const plans = runningPlansQuery.data?.data ?? []
    const active = plans.find((plan) => plan.status === "active")
    if (active) return active.id
    return plans.find(
      (plan) =>
        plan.status === "planned" &&
        isDateInRange(todayKey, plan.start_date, plan.end_date),
    )?.id
  }, [runningPlansQuery.data, todayKey])

  const runningPlanQuery = useQuery({
    queryKey: ["running-plan", selectedPlanId],
    queryFn: () =>
      RunningPlansService.readPlan({ planId: selectedPlanId as string }),
    enabled: !!selectedPlanId,
  })

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  }, [weekStart])

  const planDaysByWeekday = useMemo(() => {
    const map = new Map<number, TrainingPlanDayPublic>()
    for (const day of planQuery.data?.days ?? []) {
      map.set(day.weekday, day)
    }
    return map
  }, [planQuery.data])

  const runningWorkoutsByDate = useMemo(() => {
    const map = new Map<string, RunningWorkoutPublic>()
    const phases = runningPlanQuery.data?.phases ?? []
    for (const phase of phases) {
      for (const week of phase.weeks ?? []) {
        for (const workout of week.workouts ?? []) {
          if (workout.status === "cancelled" || workout.cancelled) continue
          if (
            !isDateInRange(
              workout.date,
              formatLocalDateKey(weekStart),
              formatLocalDateKey(weekEnd),
            )
          ) {
            continue
          }
          if (!map.has(workout.date)) {
            map.set(workout.date, workout)
          }
        }
      }
    }
    return map
  }, [runningPlanQuery.data, weekStart, weekEnd])

  const routines = useMemo(() => routinesQuery.data ?? [], [routinesQuery.data])

  const hasManualPlan = (planQuery.data?.days?.length ?? 0) > 0

  const rows = useMemo<PlanRow[]>(() => {
    if (hasManualPlan) {
      return Array.from({ length: 7 }, (_, index) => {
        const weekday = index + 1
        const planDay = planDaysByWeekday.get(weekday)
        if (!planDay) {
          return {
            weekday,
            kind: "rest",
            label: "Descanso",
            status: "planned",
          }
        }
        return {
          weekday,
          kind: planDay.kind,
          label: getPlanLabel(planDay),
          status: "planned",
        }
      })
    }

    const result: (PlanRow | null)[] = Array.from({ length: 7 }, () => null)
    const freeDayIndices: number[] = []

    for (let index = 0; index < 7; index++) {
      const weekday = index + 1
      const dateKey = formatLocalDateKey(days[index])
      const workout = runningWorkoutsByDate.get(dateKey)
      if (workout) {
        const status =
          workout.status === "completed"
            ? "completed"
            : workout.status === "missed"
              ? "missed"
              : "planned"
        result[index] = {
          weekday,
          kind: "running",
          label: `Running · ${getRunningLabel(workout)}`,
          status,
        }
      } else {
        freeDayIndices.push(index)
      }
    }

    const targetGymDays = goalsQuery.data?.target_gym_days
    const fallbackCount = routines.length > 0 ? routines.length : 3
    const gymDaysCount = Math.min(
      targetGymDays ?? fallbackCount,
      freeDayIndices.length,
    )

    for (let index = 0; index < gymDaysCount; index++) {
      const dayIndex = freeDayIndices[index]
      const routine =
        routines.length > 0 ? routines[index % routines.length] : null
      result[dayIndex] = {
        weekday: dayIndex + 1,
        kind: "strength",
        label: routine ? `Fuerza · ${routine.name}` : "Fuerza",
        status: "planned",
      }
    }

    for (let index = 0; index < 7; index++) {
      if (!result[index]) {
        result[index] = {
          weekday: index + 1,
          kind: "rest",
          label: "Descanso",
          status: "planned",
        }
      }
    }

    return result as PlanRow[]
  }, [
    hasManualPlan,
    planDaysByWeekday,
    runningWorkoutsByDate,
    routines,
    goalsQuery.data,
    days,
  ])

  const progress = useMemo(() => {
    let total = 0
    let completed = 0
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      if (row.kind === "rest") continue
      total++
      const dateKey = formatLocalDateKey(days[index])
      const activityEntry = activitiesQuery.data?.get(dateKey)
      const done =
        row.kind === "strength"
          ? (activityEntry?.strength ?? false)
          : row.kind === "running"
            ? !hasManualPlan
              ? row.status === "completed"
              : (activityEntry?.cardio ?? false)
            : false
      if (done) completed++
    }
    return {
      total,
      completed,
      percent: total > 0 ? (completed / total) * 100 : 0,
    }
  }, [rows, days, activitiesQuery.data, hasManualPlan])

  const isLoading =
    planQuery.isLoading ||
    activitiesQuery.isLoading ||
    runningPlansQuery.isLoading ||
    routinesQuery.isLoading ||
    goalsQuery.isLoading ||
    (selectedPlanId && runningPlanQuery.isLoading)

  const isError =
    planQuery.isError ||
    activitiesQuery.isError ||
    runningPlansQuery.isError ||
    routinesQuery.isError ||
    goalsQuery.isError ||
    runningPlanQuery.isError

  if (isLoading) {
    return <WeekPlanCardSkeleton />
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Entrenamientos de la semana
          </CardTitle>
          <CardDescription>No se pudieron cargar los datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 py-6 text-center">
            <p className="text-sm font-medium">
              Hubo un error al cargar tu plan semanal
            </p>
            <p className="text-xs text-muted-foreground">
              Verificá la conexión e intentá nuevamente.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                planQuery.refetch()
                activitiesQuery.refetch()
                runningPlansQuery.refetch()
                routinesQuery.refetch()
                goalsQuery.refetch()
                runningPlanQuery.refetch()
              }}
            >
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasAnyData =
    hasManualPlan || routines.length > 0 || runningWorkoutsByDate.size > 0

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Entrenamientos de la semana
          </CardTitle>
          <CardDescription>
            Organizá tus entrenamientos semanales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 py-6 text-center">
            <p className="text-sm font-medium">
              No definiste tu semana todavía
            </p>
            <p className="text-xs text-muted-foreground">
              Conectá tus integraciones o configurá tu semana.
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link to="/settings">Configurar</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isAutoDerived = !hasManualPlan

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-base">
            Entrenamientos de la semana
          </CardTitle>
          <CardDescription>
            {isAutoDerived
              ? "Sugerido desde tus rutinas y plan de running."
              : "Lo que tenés planeado para estos días."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {progress.total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {progress.completed} de {progress.total} sesiones
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(progress.percent)}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-domain-success transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          {rows.map((row, index) => {
            const date = days[index]
            const dateKey = formatLocalDateKey(date)
            const isToday = dateKey === todayKey
            const activityEntry = activitiesQuery.data?.get(dateKey)
            const done =
              row.kind === "strength"
                ? (activityEntry?.strength ?? false)
                : row.kind === "running"
                  ? isAutoDerived
                    ? row.status === "completed"
                    : (activityEntry?.cardio ?? false)
                  : false
            const missed = row.status === "missed"
            const metric = getRowMetric(row, activityEntry)

            return (
              <div
                key={row.weekday}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors",
                  isToday ? "bg-accent/50" : "hover:bg-muted/30",
                  missed && "opacity-60",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "w-20 shrink-0 text-sm font-medium",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {WEEKDAY_LABELS[index]}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-domain-success" />
                    ) : missed ? (
                      <XCircle className="size-4 shrink-0 text-destructive" />
                    ) : row.kind !== "rest" ? (
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          row.kind === "strength"
                            ? "bg-domain-strength"
                            : "bg-domain-cardio",
                        )}
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          "truncate text-sm",
                          (row.kind === "rest" || missed) &&
                            "text-muted-foreground",
                        )}
                      >
                        {row.label}
                      </span>
                      {metric && (
                        <span className="text-xs text-muted-foreground">
                          {metric}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isToday && (
                  <span className="shrink-0 text-xs font-medium text-primary">
                    Hoy
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {isAutoDerived && (
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="ghost" asChild>
              <Link to="/settings">Fijar en Configuración</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WeekPlanCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-1 h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
