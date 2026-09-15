export interface GymExercise {
  title: string
  notes?: string | null
  target_sets?: number
  target_reps?: number
  target_weight_kg?: number
  /** Estructura detallada usada por rutinas importadas de Hevy. */
  sets?: Array<{
    index?: number
    set_type?: string
    weight_kg?: number | null
    reps?: number | null
    rpe?: number | null
  }>
}

export interface RunInterval {
  repeats: number
  type: "distance" | "time"
  value: number
  unit: string
  pace_seconds_per_km?: number
  rest_seconds?: number
}

export interface RunBlock {
  label: string
  instructions?: string
  intervals: RunInterval[]
}

export type GymRoutineData = { exercises: GymExercise[] }
export type RunRoutineData = { blocks: RunBlock[] }
