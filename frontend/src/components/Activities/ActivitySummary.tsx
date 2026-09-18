import { Activity, Clock, Dumbbell, Layers, Weight } from "lucide-react"

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

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5 flex items-center gap-2.5">
      <div className="p-2 rounded-lg bg-purple-500/15 text-purple-400 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
          {value}
        </p>
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
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
      <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
        <Activity className="w-4 h-4 text-purple-400" />
        <h2 className="text-sm font-bold text-white tracking-tight">
          Resumen de Sesión
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatItem
          icon={<Dumbbell className="w-4 h-4" />}
          label="Ejercicios"
          value={String(exercises.length)}
        />
        <StatItem
          icon={<Layers className="w-4 h-4" />}
          label="Series"
          value={formatSets(effectiveSetCount)}
        />
        <StatItem
          icon={<Weight className="w-4 h-4" />}
          label="Volumen"
          value={`${Math.round(strength.total_volume_kg ?? 0)} kg`}
        />
        <StatItem
          icon={<Clock className="w-4 h-4" />}
          label="Duración"
          value={formatDuration(durationSeconds)}
        />
      </div>

      {/* Visual Muscle Map Container */}
      <div className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl flex justify-center overflow-hidden">
        <MuscleMap distribution={slugDistribution} />
      </div>

      {/* Muscle distribution bars */}
      {sortedMuscles.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Distribución por Músculo
          </p>
          {sortedMuscles.map(([slug, value]) => (
            <div key={slug} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="font-semibold text-slate-300">
                  {SLUG_LABELS[slug] ?? slug}
                </span>
                <span className="font-bold text-purple-400 font-mono">
                  {formatSets(value)} series
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500"
                  style={{
                    width: `${maxSets > 0 ? (value / maxSets) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center">
          Sin distribución muscular disponible.
        </p>
      )}
    </div>
  )
}
