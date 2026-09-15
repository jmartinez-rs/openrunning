import { Clock, Dumbbell, Layers, Weight } from "lucide-react"

import type { ActivityStrengthBase } from "@/client"

import { formatDuration } from "./activity-utils"
import { MuscleMap } from "./MuscleMap"
import {
  computeMuscleDistribution,
  type MuscleExercise,
} from "./muscle-distribution"
import { SLUG_LABELS } from "./muscle-map"

interface ActivitySummaryProps {
  strength: ActivityStrengthBase
  durationSeconds?: number
}

function formatSets(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
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

export function ActivitySummary({
  strength,
  durationSeconds,
}: ActivitySummaryProps) {
  const exercises = (strength.exercises ?? []) as unknown as MuscleExercise[]
  const { distribution: slugDistribution, effectiveSets: effectiveSetCount } =
    computeMuscleDistribution(exercises)

  const sortedMuscles = Object.entries(slugDistribution)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])

  const maxSets =
    sortedMuscles.length > 0
      ? Math.max(...sortedMuscles.map(([_, value]) => value))
      : 0

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50">
      <h2 className="text-title-lg text-primary">Resumen de sesión</h2>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Dumbbell className="size-4" />}
          label="Ejercicios"
          value={String(exercises.length)}
        />
        <Stat
          icon={<Layers className="size-4" />}
          label="Series"
          value={formatSets(effectiveSetCount)}
        />
        <Stat
          icon={<Weight className="size-4" />}
          label="Volumen"
          value={`${Math.round(strength.total_volume_kg ?? 0)} kg`}
        />
        <Stat
          icon={<Clock className="size-4" />}
          label="Duración"
          value={formatDuration(durationSeconds)}
        />
      </div>

      <MuscleMap distribution={slugDistribution} />

      {sortedMuscles.length > 0 ? (
        <div className="flex flex-col gap-3">
          {sortedMuscles.map(([slug, value]) => (
            <div key={slug} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                <span className="font-semibold text-primary">
                  {SLUG_LABELS[slug] ?? slug}
                </span>
                <span>{formatSets(value)} series</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
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
        <p className="text-body-md text-on-surface-variant">
          Sin distribución muscular disponible.
        </p>
      )}
    </div>
  )
}
