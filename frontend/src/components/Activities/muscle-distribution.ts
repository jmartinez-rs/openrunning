import { fallbackGroupToSlug, hevyGroupToSlug } from "./muscle-map"
import { muscleGroupForExercise } from "./muscles"

export interface MuscleExercise {
  title?: string
  muscle_group?: string | null
  other_muscles?: string[] | null
  sets?: Array<{ set_type?: string }>
  target_sets?: number
}

export function computeMuscleDistribution(exercises: MuscleExercise[]): {
  distribution: Record<string, number>
  effectiveSets: number
} {
  const distribution: Record<string, number> = {}
  let effectiveSets = 0

  for (const exercise of exercises) {
    const rawSets = exercise.sets
    const hasSets = rawSets && rawSets.length > 0

    const exerciseSets = hasSets
      ? rawSets.filter((set) => set.set_type !== "warm_up").length
      : (exercise.target_sets ?? 1)

    if (exerciseSets === 0) continue

    effectiveSets += exerciseSets

    const primaryGroup =
      exercise.muscle_group ?? muscleGroupForExercise(exercise.title || "")
    const primarySlug =
      hevyGroupToSlug(primaryGroup) ?? fallbackGroupToSlug(primaryGroup)
    if (primarySlug) {
      distribution[primarySlug] =
        (distribution[primarySlug] ?? 0) + exerciseSets
    }

    for (const other of exercise.other_muscles ?? []) {
      const otherSlug = hevyGroupToSlug(other) ?? fallbackGroupToSlug(other)
      if (otherSlug) {
        distribution[otherSlug] =
          (distribution[otherSlug] ?? 0) + exerciseSets * 0.5
      }
    }
  }

  return { distribution, effectiveSets }
}
