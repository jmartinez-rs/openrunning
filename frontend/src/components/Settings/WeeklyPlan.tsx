import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays } from "lucide-react"
import { useEffect, useState } from "react"

import {
  PlanService,
  type RoutinePublic,
  RoutinesService,
  type TrainingPlanDayBase,
} from "@/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

type DayKind = "strength" | "running" | "rest"

type DraftDay = {
  weekday: number
  kind: DayKind
  routineId: string | null
  label: string
}

const WEEKDAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const

const NO_ROUTINE_VALUE = "__none__"

const KIND_OPTIONS: { value: DayKind; label: string }[] = [
  { value: "rest", label: "Descanso" },
  { value: "strength", label: "Fuerza" },
  { value: "running", label: "Running" },
]

function createDefaultDays(): DraftDay[] {
  return WEEKDAY_LABELS.map((_, index) => ({
    weekday: index + 1,
    kind: "rest",
    routineId: null,
    label: "",
  }))
}

async function fetchAllRoutines(): Promise<RoutinePublic[]> {
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

export function WeeklyPlan() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [days, setDays] = useState<DraftDay[]>(createDefaultDays)

  const planQuery = useQuery({
    queryKey: ["weekly-plan"],
    queryFn: () => PlanService.readPlan(),
  })

  const routinesQuery = useQuery({
    queryKey: ["routines"],
    queryFn: () => fetchAllRoutines(),
  })

  useEffect(() => {
    if (!planQuery.data) return

    const savedByWeekday = new Map<number, TrainingPlanDayBase>()
    for (const day of planQuery.data.days ?? []) {
      savedByWeekday.set(day.weekday, day)
    }

    setDays(
      createDefaultDays().map((draft) => {
        const saved = savedByWeekday.get(draft.weekday)
        if (!saved) return draft

        return {
          ...draft,
          kind: saved.kind,
          routineId: saved.routine_id ?? null,
          label: saved.label ?? "",
        }
      }),
    )
  }, [planQuery.data])

  const handleKindChange = (weekday: number, value: DayKind) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day

        let nextRoutineId = day.routineId
        let nextLabel = day.label

        if (value === "rest") {
          nextRoutineId = null
          nextLabel = ""
        } else if (value === "running") {
          nextRoutineId = null
        }

        return {
          ...day,
          kind: value,
          routineId: nextRoutineId,
          label: nextLabel,
        }
      }),
    )
  }

  const handleRoutineChange = (weekday: number, value: string) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.weekday !== weekday) return day

        const routineId = value === NO_ROUTINE_VALUE ? null : value
        const routine = routinesQuery.data?.find((r) => r.id === value)
        const label = routine && !day.label.trim() ? routine.name : day.label

        return { ...day, routineId, label }
      }),
    )
  }

  const handleLabelChange = (weekday: number, value: string) => {
    setDays((prev) =>
      prev.map((day) =>
        day.weekday === weekday ? { ...day, label: value } : day,
      ),
    )
  }

  const mutation = useMutation({
    mutationFn: () =>
      PlanService.replacePlan({
        requestBody: {
          days: days.map<TrainingPlanDayBase>((day) => ({
            weekday: day.weekday,
            kind: day.kind,
            routine_id:
              day.kind === "strength" ? (day.routineId ?? null) : null,
            label:
              day.kind === "rest"
                ? null
                : day.label.trim()
                  ? day.label.trim()
                  : null,
          })),
        },
      }),
    onSuccess: () => {
      showSuccessToast("Plan semanal guardado correctamente")
      queryClient.invalidateQueries({ queryKey: ["weekly-plan"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const isLoading = planQuery.isLoading || routinesQuery.isLoading
  const isError = planQuery.isError || routinesQuery.isError

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <CardTitle>Plan semanal</CardTitle>
            <CardDescription>
              Armá la estructura semanal de entrenamiento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <PlanSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 py-6 text-center">
            <p className="text-sm font-medium">No se cargó el plan semanal</p>
            <p className="text-xs text-muted-foreground">
              Intentá de nuevo en unos segundos.
            </p>
            <LoadingButton
              variant="outline"
              size="sm"
              onClick={() => {
                planQuery.refetch()
                routinesQuery.refetch()
              }}
            >
              Reintentar
            </LoadingButton>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              {days.map((day) => (
                <div
                  key={day.weekday}
                  className="grid grid-cols-[5.5rem_1fr] items-start gap-3 sm:grid-cols-[6.5rem_1fr]"
                >
                  <div className="pt-2 text-sm font-medium">
                    {WEEKDAY_LABELS[day.weekday - 1]}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <Select
                      value={day.kind}
                      onValueChange={(value) =>
                        handleKindChange(day.weekday, value as DayKind)
                      }
                    >
                      <SelectTrigger
                        aria-label="Tipo de entrenamiento"
                        className="w-full sm:w-36"
                      >
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {day.kind === "strength" && (
                      <Select
                        value={day.routineId ?? NO_ROUTINE_VALUE}
                        onValueChange={(value) =>
                          handleRoutineChange(day.weekday, value)
                        }
                      >
                        <SelectTrigger
                          aria-label="Rutina de Hevy"
                          className="w-full sm:flex-1"
                        >
                          <SelectValue placeholder="Rutina" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_ROUTINE_VALUE}>
                            Sin rutina
                          </SelectItem>
                          {routinesQuery.data?.map((routine) => (
                            <SelectItem key={routine.id} value={routine.id}>
                              {routine.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {day.kind !== "rest" && (
                      <Input
                        value={day.label}
                        onChange={(event) =>
                          handleLabelChange(day.weekday, event.target.value)
                        }
                        placeholder="Tempo, Fondo, Series…"
                        className="w-full sm:flex-1"
                        aria-label="Detalle de la sesión"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <LoadingButton
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Guardar semana
            </LoadingButton>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[5.5rem_1fr] items-start gap-3 sm:grid-cols-[6.5rem_1fr]"
        >
          <Skeleton className="h-5 w-16" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-9 w-full sm:w-36" />
            <Skeleton className="h-9 w-full sm:flex-1" />
            <Skeleton className="h-9 w-full sm:flex-1" />
          </div>
        </div>
      ))}
    </div>
  )
}
