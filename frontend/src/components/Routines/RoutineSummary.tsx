import { Activity, Dumbbell, Layers, Weight } from "lucide-react"
import { MuscleMap } from "@/components/Activities/MuscleMap"
import {
  computeMuscleDistribution,
  type MuscleExercise,
} from "@/components/Activities/muscle-distribution"
import { SLUG_LABELS } from "@/components/Activities/muscle-map"

import type { GymExercise } from "./routine-types"

type EnrichedGymExercise = GymExercise & {
  muscle_group?: string | null
  other_muscles?: string[] | null
}

interface RoutineSummaryProps {
  exercises: GymExercise[]
}

function formatSets(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function formatVolume(value: number): string {
  return value > 0 ? `${Math.round(value)} kg` : "—"
}

export function RoutineSummary({ exercises }: RoutineSummaryProps) {
  const enriched = exercises as EnrichedGymExercise[]
  const { distribution: slugDistribution } = computeMuscleDistribution(
    enriched as MuscleExercise[],
  )

  const totalSetCount = enriched.reduce((total, exercise) => {
    return (
      total +
      (exercise.sets?.filter((set) => set.set_type !== "warm_up").length ??
        exercise.target_sets ??
        0)
    )
  }, 0)

  const estimatedVolume = enriched.reduce((total, exercise) => {
    const effectiveSets = (exercise.sets ?? []).filter(
      (set) => set.set_type !== "warm_up",
    )
    return (
      total +
      effectiveSets.reduce((setTotal, set) => {
        const weight = set.weight_kg ?? 0
        const reps = set.reps ?? 0
        return setTotal + weight * reps
      }, 0)
    )
  }, 0)

  const sortedMuscles = Object.entries(slugDistribution)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])

  const maxSets =
    sortedMuscles.length > 0
      ? Math.max(...sortedMuscles.map(([_, value]) => value))
      : 0

  const activeMuscles = sortedMuscles.length

  return (
    <aside className="flex flex-col gap-5 rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Resumen de rutina</h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="rounded-md bg-domain-strength/10 p-2 text-domain-strength">
            <Dumbbell className="size-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ejercicios</p>
            <p className="text-sm font-semibold">{exercises.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="rounded-md bg-domain-strength/10 p-2 text-domain-strength">
            <Layers className="size-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Series</p>
            <p className="text-sm font-semibold">{totalSetCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="rounded-md bg-domain-strength/10 p-2 text-domain-strength">
            <Weight className="size-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Volumen estimado</p>
            <p className="text-sm font-semibold">
              {formatVolume(estimatedVolume)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="rounded-md bg-domain-strength/10 p-2 text-domain-strength">
            <Activity className="size-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Músculos</p>
            <p className="text-sm font-semibold">{activeMuscles}</p>
          </div>
        </div>
      </div>

      <MuscleMap distribution={slugDistribution} />

      {sortedMuscles.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sortedMuscles.map(([slug, value]) => (
            <div key={slug} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{SLUG_LABELS[slug] ?? slug}</span>
                <span className="text-muted-foreground">
                  {formatSets(value)} series
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-domain-strength transition-all"
                  style={{
                    width: `${maxSets > 0 ? (value / maxSets) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sin distribución muscular disponible.
        </p>
      )}
    </aside>
  )
}
