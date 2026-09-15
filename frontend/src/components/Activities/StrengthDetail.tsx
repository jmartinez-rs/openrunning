import { Dumbbell, Trophy, Weight } from "lucide-react"

import type { ActivityStrengthBase } from "@/client"
import { muscleGroupForExercise } from "./muscles"

interface ExerciseSet {
  index?: number
  set_type?: string
  weight_kg?: number | null
  reps?: number | null
  rpe?: number | null
}

interface Exercise {
  index?: number
  title?: string
  notes?: string | null
  sets?: ExerciseSet[]
}

export interface ExerciseRecord {
  max_weight: number
  max_volume: number
  max_1rm: number
}

function setTypeLabel(setType: string | undefined): string {
  switch (setType) {
    case "warm_up":
      return "Calentamiento"
    case "failure":
      return "Fallo"
    case "drop_set":
      return "Drop set"
    default:
      return "Efectiva"
  }
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-container-low px-3 py-2.5">
      <div className="rounded-md bg-domain-strength/10 p-2 text-domain-strength">
        {icon}
      </div>
      <div>
        <p className="text-label-sm text-on-surface-variant uppercase">
          {label}
        </p>
        <p className="text-title-lg text-primary">{value}</p>
      </div>
    </div>
  )
}

export function StrengthDetail({
  strength,
  records,
}: {
  strength: ActivityStrengthBase
  records?: Record<string, ExerciseRecord>
}) {
  const exercises = (strength.exercises ?? []) as unknown as Exercise[]

  const muscleDistribution: Record<string, number> = {}
  for (const exercise of exercises) {
    const group = muscleGroupForExercise(exercise.title || "")
    muscleDistribution[group] = (muscleDistribution[group] ?? 0) + 1
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          icon={<Weight className="size-4" />}
          label="Volumen total"
          value={`${Math.round(strength.total_volume_kg ?? 0)} kg`}
        />
        <Stat
          icon={<Dumbbell className="size-4" />}
          label="Series"
          value={`${strength.total_sets ?? 0}${strength.avg_rpe ? ` · RPE ${strength.avg_rpe}` : ""}`}
        />
      </div>

      {Object.keys(muscleDistribution).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(muscleDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([group, count]) => (
              <span
                key={group}
                className="inline-flex items-center gap-1 rounded-full bg-domain-strength/10 px-3 py-1 text-label-lg text-domain-strength"
              >
                {group} · {count}
              </span>
            ))}
        </div>
      ) : null}

      {exercises.length === 0 ? (
        <p className="rounded-lg bg-surface-container-low px-3 py-4 text-center text-body-md text-on-surface-variant">
          No hay ejercicios cargados para esta sesión.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {exercises.map((exercise, exerciseIndex) => {
            const record = exercise.title
              ? records?.[exercise.title.trim().toLowerCase()]
              : undefined
            return (
              <div
                key={exerciseIndex}
                className="overflow-hidden rounded-xl border border-border/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/20 bg-surface-container-low px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-title-lg text-primary">
                      {exercise.title || `Ejercicio ${exerciseIndex + 1}`}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-domain-strength/10 px-2 py-0.5 text-label-lg text-domain-strength">
                      {muscleGroupForExercise(exercise.title || "")}
                    </span>
                    {record && Number(record.max_1rm) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-domain-race/10 px-2 py-0.5 text-label-lg text-domain-race">
                        <Trophy className="size-3" />
                        1RM {Number(record.max_1rm)} kg
                      </span>
                    ) : null}
                  </div>
                  <span className="text-label-lg text-on-surface-variant">
                    {exercise.sets?.length ?? 0} series
                  </span>
                </div>
                <div className="divide-y divide-border/20">
                  {(exercise.sets ?? []).map((set, setIndex) => (
                    <div
                      key={setIndex}
                      className="flex items-center justify-between px-4 py-1.5 text-body-md"
                    >
                      <span className="text-on-surface-variant">
                        {setTypeLabel(set.set_type)}
                      </span>
                      <span className="text-primary">
                        {set.weight_kg ? `${set.weight_kg} kg` : "—"} ×{" "}
                        {set.reps ?? "—"}
                        {set.rpe ? ` · RPE ${set.rpe}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
