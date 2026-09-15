import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Dumbbell, Footprints } from "lucide-react"

import { RoutinesService } from "@/client"
import { RoutineSummary } from "@/components/Routines/RoutineSummary"
import type { GymExercise, RunBlock } from "@/components/Routines/routine-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/routines/$routineId")({
  component: RoutineDetail,
  head: () => ({ meta: [{ title: "Plan de Running - OpenRunning" }] }),
})

function formatInterval(interval: RunBlock["intervals"][number]): string {
  const repeats = interval.repeats > 1 ? `${interval.repeats} × ` : ""
  const value =
    interval.type === "distance"
      ? `${interval.value} m`
      : `${interval.value} min`
  const rest = interval.rest_seconds
    ? ` · descanso ${interval.rest_seconds}s`
    : ""
  return `${repeats}${value}${rest}`
}

function RoutineDetail() {
  const { routineId } = Route.useParams()

  const query = useQuery({
    queryKey: ["routine", routineId],
    queryFn: () => RoutinesService.readRoutine({ routineId }),
  })

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">No se pudo cargar la rutina</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/routines">
            <ArrowLeft className="mr-2 size-4" /> Volver a rutinas
          </Link>
        </Button>
      </div>
    )
  }

  const routine = query.data
  const isGym = routine.type === "gym"
  const data = (routine.routine_data ?? {}) as {
    exercises?: GymExercise[]
    blocks?: RunBlock[]
  }

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link to="/routines">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{routine.name}</h1>
          <p className="text-muted-foreground">
            {isGym ? "Rutina de fuerza" : "Estructura de pasadas"}
            {routine.description ? ` · ${routine.description}` : ""}
          </p>
        </div>
        <Badge variant={isGym ? "secondary" : "outline"} className="ml-auto">
          {isGym ? "Gimnasio" : "Running"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isGym ? (
                <Dumbbell className="size-5 text-domain-strength" />
              ) : (
                <Footprints className="size-5 text-domain-cardio" />
              )}
              {isGym ? "Ejercicios" : "Bloques"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGym ? (
              (data.exercises ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin ejercicios cargados.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {(data.exercises ?? []).map((exercise, index) => (
                    <div key={index} className="rounded-lg border">
                      <div className="flex items-center justify-between border-b bg-muted/20 px-3 py-2">
                        <p className="text-sm font-medium">{exercise.title}</p>
                        <Badge variant="secondary">
                          {exercise.target_sets
                            ? `${exercise.target_sets} × ${exercise.target_reps ?? "?"} reps`
                            : `${exercise.sets?.length ?? 0} series`}
                        </Badge>
                      </div>
                      {exercise.sets?.length ? (
                        <div className="divide-y">
                          {exercise.sets.map((set, setIndex) => (
                            <div
                              key={setIndex}
                              className="flex items-center justify-between px-3 py-1.5 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {set.set_type ?? "normal"}
                              </span>
                              <span>
                                {set.weight_kg ? `${set.weight_kg} kg` : "—"} ×{" "}
                                {set.reps ?? "—"}
                                {set.rpe ? ` · RPE ${set.rpe}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            ) : (data.blocks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin bloques cargados.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {(data.blocks ?? []).map((block, blockIndex) => (
                  <div key={blockIndex} className="rounded-lg border">
                    <div className="border-b bg-muted/20 px-3 py-2">
                      <p className="text-sm font-medium">
                        {block.label || `Bloque ${blockIndex + 1}`}
                      </p>
                      {block.instructions ? (
                        <p className="text-xs text-muted-foreground">
                          {block.instructions}
                        </p>
                      ) : null}
                    </div>
                    <div className="divide-y">
                      {(block.intervals ?? []).map(
                        (interval, intervalIndex) => (
                          <div
                            key={intervalIndex}
                            className="px-3 py-1.5 text-sm"
                          >
                            {formatInterval(interval)}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isGym && (data.exercises ?? []).length > 0 ? (
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <RoutineSummary exercises={data.exercises ?? []} />
          </aside>
        ) : null}
      </div>
    </div>
  )
}
