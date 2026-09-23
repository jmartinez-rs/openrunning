import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import {
  PlanService,
  type RoutinePublic,
  RoutinesService,
  type TrainingPlanDayBase,
} from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { SettingsRow } from "./SettingsSection"

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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl bg-card/60" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {days.map((day) => (
        <SettingsRow
          key={day.weekday}
          icon={CalendarDays}
          iconBg="bg-surface-container-high/80"
          iconColor="text-muted-foreground"
          title={WEEKDAY_LABELS[day.weekday - 1]}
          subtitle={
            day.kind === "rest"
              ? "Día de descanso"
              : day.label ||
                (day.kind === "running" ? "Carrera" : "Sesión de fuerza")
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={day.kind}
              onValueChange={(value) =>
                handleKindChange(day.weekday, value as DayKind)
              }
            >
              <SelectTrigger
                aria-label="Tipo de entrenamiento"
                className="h-8 w-28 rounded-xl border-border bg-background text-xs text-foreground"
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
                  className="h-8 w-32 rounded-xl border-border bg-background text-xs text-foreground"
                >
                  <SelectValue placeholder="Rutina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROUTINE_VALUE}>Sin rutina</SelectItem>
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
                placeholder="Detalle..."
                className="h-8 w-32 rounded-xl border-border bg-background text-xs text-foreground"
                aria-label="Detalle de la sesión"
              />
            )}
          </div>
        </SettingsRow>
      ))}

      <div className="pt-2 px-4 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90"
        >
          {mutation.isPending && (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          )}
          Guardar semana
        </Button>
      </div>
    </div>
  )
}
