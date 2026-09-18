import { Dumbbell, Trophy, Weight, Layers } from "lucide-react"

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

function SetTypeBadge({ setType }: { setType: string | undefined }) {
  switch (setType) {
    case "warm_up":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-semibold">
          Calentamiento
        </span>
      )
    case "failure":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400 text-[10px] font-bold">
          Fallo
        </span>
      )
    case "drop_set":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-bold">
          Drop set
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[10px] font-bold">
          Efectiva
        </span>
      )
  }
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
      {/* Metrics Header Cards */}
      <div className="grid gap-3 grid-cols-2 min-w-0">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/15 text-purple-400 shrink-0">
              <Weight className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate min-w-0">Volumen Total</p>
          </div>
          <p className="text-base sm:text-lg md:text-xl font-black text-purple-400 tracking-tight truncate">
            {Math.round(strength.total_volume_kg ?? 0)} kg
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-2.5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 shrink-0">
              <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate min-w-0">Series & RPE</p>
          </div>
          <p className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight truncate">
            {strength.total_sets ?? 0} {strength.avg_rpe ? `· RPE ${strength.avg_rpe}` : ""}
          </p>
        </div>
      </div>

      {/* Muscle Distribution Badges */}
      {Object.keys(muscleDistribution).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(muscleDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([group, count]) => (
              <span
                key={group}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold"
              >
                <span>{group}</span>
                <span className="text-purple-400 font-bold">• {count}</span>
              </span>
            ))}
        </div>
      ) : null}

      {/* Exercises Cards */}
      {exercises.length === 0 ? (
        <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl text-center text-xs font-medium text-slate-400">
          No hay ejercicios registrados en esta sesión.
        </div>
      ) : (
        <div className="space-y-4">
          {exercises.map((exercise, exerciseIndex) => {
            const record = exercise.title
              ? records?.[exercise.title.trim().toLowerCase()]
              : undefined
            return (
              <div
                key={exerciseIndex}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
              >
                <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white tracking-tight">
                      {exercise.title || `Ejercicio ${exerciseIndex + 1}`}
                    </p>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 text-[11px] font-bold">
                      {muscleGroupForExercise(exercise.title || "")}
                    </span>
                    {record && Number(record.max_1rm) > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        1RM {Number(record.max_1rm)} kg
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    {exercise.sets?.length ?? 0} series
                  </span>
                </div>

                <div className="divide-y divide-slate-800/40">
                  {(exercise.sets ?? []).map((set, setIndex) => (
                    <div
                      key={setIndex}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-800/20 transition-colors"
                    >
                      <SetTypeBadge setType={set.set_type} />
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="font-bold text-white">
                          {set.weight_kg ? `${set.weight_kg} kg` : "—"} × {set.reps ?? "—"}
                        </span>
                        {set.rpe ? (
                          <span className="text-slate-400 text-[11px]">
                            RPE {set.rpe}
                          </span>
                        ) : null}
                      </div>
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

