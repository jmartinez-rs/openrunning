import { Link } from "@tanstack/react-router"
import { Dumbbell, Footprints } from "lucide-react"

import type { RoutinePublic } from "@/client"
import type { GymExercise, RunBlock } from "./routine-types"

export function RoutineCard({ routine }: { routine: RoutinePublic }) {
  const isGym = routine.type === "gym"
  const data = (routine.routine_data ?? {}) as {
    exercises?: GymExercise[]
    blocks?: RunBlock[]
  }

  const summary = isGym
    ? data.exercises?.length
      ? `${data.exercises.length} ejercicios`
      : "Sin ejercicios"
    : data.blocks?.length
      ? `${data.blocks.length} bloques`
      : "Sin bloques"

  return (
    <Link to="/routines/$routineId" params={{ routineId: routine.id }}>
      <div className="group flex items-start gap-4 rounded-2xl bg-card p-5 shadow-card transition-colors hover:border hover:border-primary/30 dark:border dark:border-border/50">
        <div
          className={
            isGym
              ? "flex size-12 shrink-0 items-center justify-center rounded-full bg-domain-strength/10 text-domain-strength"
              : "flex size-12 shrink-0 items-center justify-center rounded-full bg-domain-cardio/10 text-domain-cardio"
          }
        >
          {isGym ? (
            <Dumbbell className="size-5" />
          ) : (
            <Footprints className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-title-lg text-primary">{routine.name}</h3>
          <p className="mt-0.5 line-clamp-1 text-body-md text-on-surface-variant">
            {routine.description || summary}
          </p>
          <p className="mt-1 text-label-sm text-on-surface-variant">
            {isGym ? "Rutina de fuerza" : "Estructura de pasadas"}
          </p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1 text-label-lg text-on-surface-variant">
          {summary}
        </span>
      </div>
    </Link>
  )
}
