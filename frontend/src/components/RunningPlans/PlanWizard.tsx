import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Footprints,
  HelpCircle,
  Loader2,
  Minus,
  Mountain,
  Plus,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  ActivitiesService,
  AnalyticsService,
  RacesService,
  type RunningPlanCreate,
  type RunningPlanPublic,
  RunningPlansService,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import {
  calculateVDOT,
  formatTime,
  getTrainingPaces,
  formatPace as mathFormatPace,
  parsePace as mathParsePace,
  predictTimeRiegel,
} from "@/lib/running-math"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import {
  addDaysToIso,
  type BlockType,
  blocksDistanceKm,
  formatDistance,
  formatShortDate,
  getDayToIsoWeekday,
  type Intensity,
  isoWeekdayToGetDay,
  PHASE_COLORS,
  type PhaseColor,
  type PlanStatus,
  raceTimeInputToSeconds,
  summarizeBlocks,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "./running-utils"

// ---------------------------------------------------------------------------
// Tipos del Draft
// ---------------------------------------------------------------------------

interface BlockDraft {
  id?: string
  position: number
  block_type: BlockType
  repeats: number
  distance_m: number | null
  duration_seconds: number | null
  pace_seconds_per_km: number | null
  pace_range_end_seconds_per_km: number | null
  recovery_seconds: number | null
  recovery_type: "jog" | "walk"
  notes: string
}

interface WorkoutDraft {
  id?: string
  date: string
  type: WorkoutType
  objective: string
  name: string
  distance_km: number | null
  duration_seconds: number | null
  pace_seconds_per_km: number | null
  intensity: Intensity
  description: string
  notes: string
  cancelled: boolean
  status_override: "completed" | "missed" | null
  blocks: BlockDraft[]
}

interface WeekDraft {
  id?: string
  number: number
  start_date: string
  end_date: string
  name: string
  objective: string
  notes: string
  workouts: WorkoutDraft[]
}

interface PhaseDraft {
  id?: string
  position: number
  name: string
  color: PhaseColor
  start_week: number
  end_week: number
  objective: string
  description: string
  weeks: WeekDraft[]
}

export interface PlanDraft {
  name: string
  goal: string
  distance_km: number | null
  distance_unit: "km" | "mi"
  target_time_seconds: number | null
  target_pace_seconds_per_km: number | null
  start_date: string
  end_date: string
  week_start_day: number
  status: PlanStatus
  race_id: string | null
  notes: string
  /**
   * Generation snapshot returned by `POST /running-plans/generate-draft`.
   *
   * Optional: an edit loaded through `GET /running-plans/{id}` does not expose
   * it, and the local fallback generator has none. `buildPayload` omits the keys
   * when absent so a PUT never wipes the stored snapshot.
   */
  baseline?: Record<string, unknown> | null
  generation_params?: Record<string, unknown> | null
  phases: PhaseDraft[]
}

const DAYS_OF_WEEK = [
  { id: 1, label: "Lunes", short: "Lun" },
  { id: 2, label: "Martes", short: "Mar" },
  { id: 3, label: "Miércoles", short: "Mié" },
  { id: 4, label: "Jueves", short: "Jue" },
  { id: 5, label: "Viernes", short: "Vie" },
  { id: 6, label: "Sábado", short: "Sáb" },
  { id: 0, label: "Domingo", short: "Dom" },
]

export const LEVELS = [
  {
    id: "beginner",
    title: "Principiante",
    desc: "Estoy empezando ahora o vuelvo tras una pausa.",
    weeklyKm: 18,
    longestKm: 7,
    refTime: "00:32:00",
    vdot: 32,
  },
  {
    id: "intermediate",
    title: "Intermedio",
    desc: "Ya corro con regularidad y busco mejorar mis marcas.",
    weeklyKm: 30,
    longestKm: 12,
    refTime: "00:24:30",
    vdot: 42,
  },
  {
    id: "advanced",
    title: "Avanzado",
    desc: "Entreno de forma estructurada con foco en rendimiento.",
    weeklyKm: 50,
    longestKm: 18,
    refTime: "00:19:45",
    vdot: 50,
  },
  {
    id: "elite",
    title: "Élite",
    desc: "Competidor experimentado buscando optimización máxima.",
    weeklyKm: 65,
    longestKm: 22,
    refTime: "00:17:15",
    vdot: 58,
  },
]

/** ISO (YYYY-MM-DD) del lunes de la semana actual. */
function getCurrentWeekStartIso(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(12, 0, 0, 0)
  return monday.toISOString().split("T")[0]
}

function createEmptyDraft(): PlanDraft {
  const today = new Date().toISOString().split("T")[0]
  return {
    name: "",
    goal: "",
    distance_km: 21.1,
    distance_unit: "km",
    target_time_seconds: null,
    target_pace_seconds_per_km: null,
    start_date: today,
    end_date: "",
    week_start_day: 1,
    status: "active",
    race_id: null,
    notes: "",
    phases: [],
  }
}

function publicToDraft(plan: RunningPlanPublic): PlanDraft {
  // The generated OpenAPI client type predates `RunningPlanBase.baseline` /
  // `generation_params`, so they are read through a widened view instead of
  // regenerating the client (out of scope for this change).
  const withSnapshot = plan as RunningPlanPublic & {
    baseline?: Record<string, unknown> | null
    generation_params?: Record<string, unknown> | null
  }
  return {
    name: plan.name,
    goal: plan.goal ?? "",
    distance_km: plan.distance_km,
    distance_unit: plan.distance_unit === "mi" ? "mi" : "km",
    target_time_seconds: plan.target_time_seconds,
    target_pace_seconds_per_km: plan.target_pace_seconds_per_km,
    start_date: plan.start_date,
    end_date: plan.end_date ?? "",
    week_start_day: plan.week_start_day ?? 1,
    status: plan.status,
    race_id: plan.race_id,
    notes: plan.notes ?? "",
    baseline: withSnapshot.baseline ?? null,
    generation_params: withSnapshot.generation_params ?? null,
    phases: (plan.phases ?? []).map((phase, pi) => ({
      id: phase.id,
      position: pi + 1,
      name: phase.name,
      color: PHASE_COLORS[phase.color as PhaseColor]
        ? (phase.color as PhaseColor)
        : "emerald",
      start_week: phase.start_week,
      end_week: phase.end_week,
      objective: phase.objective ?? "",
      description: phase.description ?? "",
      weeks: (phase.weeks ?? []).map((week) => ({
        id: week.id,
        number: week.number,
        start_date: week.start_date ?? "",
        end_date: week.end_date ?? "",
        name: week.name ?? "",
        objective: week.objective ?? "",
        notes: week.notes ?? "",
        workouts: (week.workouts ?? []).map((workout) => ({
          id: workout.id,
          date: workout.date,
          type: workout.type,
          objective: workout.objective ?? "",
          name: workout.name ?? "",
          distance_km: workout.distance_km,
          duration_seconds: workout.duration_seconds,
          pace_seconds_per_km: workout.pace_seconds_per_km,
          intensity: workout.intensity,
          description: workout.description ?? "",
          notes: workout.notes ?? "",
          cancelled: workout.cancelled,
          status_override: workout.status_override ?? null,
          blocks: (workout.blocks ?? []).map((block) => ({
            id: block.id,
            position: block.position,
            block_type: block.block_type,
            repeats: block.repeats,
            distance_m: block.distance_m,
            duration_seconds: block.duration_seconds,
            pace_seconds_per_km: block.pace_seconds_per_km,
            pace_range_end_seconds_per_km: block.pace_range_end_seconds_per_km,
            recovery_seconds: block.recovery_seconds,
            recovery_type: block.recovery_type === "walk" ? "walk" : "jog",
            notes: block.notes ?? "",
          })),
        })),
      })),
    })),
  }
}

/**
 * The create/replace body plus the plan's generation snapshot.
 *
 * `RunningPlanCreate` in the generated client predates
 * `RunningPlanBase.baseline` / `generation_params`, so the two keys are
 * re-declared here instead of regenerating the whole client for one change.
 * The backend keeps them (see `create_plan` / `replace_plan`), which is what
 * lets a created plan be recalibrated later.
 */
export type RunningPlanCreateWithSnapshot = RunningPlanCreate & {
  baseline?: Record<string, unknown> | null
  generation_params?: Record<string, unknown> | null
}

export function buildPayload(draft: PlanDraft): RunningPlanCreateWithSnapshot {
  return {
    name: draft.name.trim(),
    goal: draft.goal.trim() || null,
    distance_km: draft.distance_km,
    distance_unit: draft.distance_unit,
    target_time_seconds: draft.target_time_seconds,
    target_pace_seconds_per_km: draft.target_pace_seconds_per_km,
    start_date: draft.start_date,
    end_date: draft.end_date || null,
    week_start_day: draft.week_start_day,
    status: draft.status,
    race_id: draft.race_id,
    notes: draft.notes.trim() || null,
    // Omitted (not sent as null) when the draft has no snapshot: a PUT that
    // omits them keeps the plan's stored baseline/generation_params.
    ...(draft.baseline ? { baseline: draft.baseline } : {}),
    ...(draft.generation_params
      ? { generation_params: draft.generation_params }
      : {}),
    phases: draft.phases.map((phase, pi) => ({
      position: pi + 1,
      name: phase.name.trim(),
      color: phase.color,
      start_week: phase.start_week,
      end_week: phase.end_week,
      objective: phase.objective.trim() || null,
      description: phase.description.trim() || null,
      weeks: phase.weeks.map((week) => ({
        number: week.number,
        start_date: week.start_date || null,
        end_date: week.end_date || null,
        name: week.name.trim() || null,
        objective: week.objective.trim() || null,
        notes: week.notes.trim() || null,
        workouts: week.workouts.map((workout) => ({
          date: workout.date,
          type: workout.type,
          objective: workout.objective.trim() || null,
          name: workout.name.trim() || null,
          distance_km: workout.distance_km,
          duration_seconds: workout.duration_seconds,
          pace_seconds_per_km: workout.pace_seconds_per_km,
          intensity: workout.intensity,
          description: workout.description.trim() || null,
          notes: workout.notes.trim() || null,
          cancelled: workout.cancelled,
          status_override: workout.status_override,
          blocks: workout.blocks.map((block, bi) => ({
            position: bi + 1,
            block_type: block.block_type,
            repeats: block.repeats,
            distance_m: block.distance_m,
            duration_seconds: block.duration_seconds,
            pace_seconds_per_km: block.pace_seconds_per_km,
            pace_range_end_seconds_per_km: block.pace_range_end_seconds_per_km,
            recovery_seconds: block.recovery_seconds,
            recovery_type: block.recovery_type,
            notes: block.notes.trim() || null,
          })),
        })),
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Engine — Algoritmo de Generación de Sesiones Estructuradas
// ---------------------------------------------------------------------------

export function generatePlanStructure({
  draft,
  planType: _planType,
  targetKm,
  numWeeks,
  userLevel: _userLevel,
  refDistanceKm,
  refTimeSeconds,
  currentWeeklyKm,
  longestRunKm,
  selectedDays,
  longRunDay,
}: {
  draft: PlanDraft
  planType: string
  targetKm: number
  numWeeks: number
  userLevel: string
  refDistanceKm: number
  refTimeSeconds: number
  currentWeeklyKm: number
  longestRunKm: number
  selectedDays: number[]
  longRunDay: number
}): PlanDraft {
  const startDateISO =
    draft.start_date || new Date().toISOString().split("T")[0]

  // Alineamos la grilla de semanas al día de inicio elegido (week_start_day).
  const wsd = draft.week_start_day || 1 // 1..7
  const wsdGetDay = isoWeekdayToGetDay(wsd)
  const startGetDay = new Date(`${startDateISO}T12:00:00`).getDay()
  const startIso = getDayToIsoWeekday(startGetDay)
  const delta = (startIso - wsd + 7) % 7
  const firstWeekStart = addDaysToIso(startDateISO, -delta)
  const calculatedEndDate = addDaysToIso(firstWeekStart, numWeeks * 7 - 1)

  // Calculate VDOT & Paces using Jack Daniels formulas
  const vdot = calculateVDOT(refDistanceKm * 1000, refTimeSeconds)
  const paces = getTrainingPaces(vdot)

  const easyPaceSec = mathParsePace(paces.easyMin) || 330
  const tempoPaceSec = mathParsePace(paces.threshold) || 270
  const intervalPaceSec = mathParsePace(paces.interval) || 240
  const longRunPaceSec = mathParsePace(paces.easyMax) || 345

  // Predict finish time for target distance using Riegel's formula
  const predictedFinishSec = predictTimeRiegel(
    refDistanceKm * 1000,
    refTimeSeconds,
    targetKm * 1000,
  )
  const predictedPaceSec = Math.round(predictedFinishSec / targetKm)

  // 4 Phase Specs
  const p1End = Math.max(1, Math.round(numWeeks * 0.3))
  const p2End = Math.max(p1End + 1, Math.round(numWeeks * 0.65))
  const p3End = Math.max(p2End + 1, Math.round(numWeeks * 0.85))
  const p4End = numWeeks

  const phasesSpec: Array<{
    name: string
    color: PhaseColor
    start: number
    end: number
    objective: string
  }> = [
    {
      name: "Fase Base Aeróbica",
      color: "emerald" as PhaseColor,
      start: 1,
      end: p1End,
      objective: `Rodajes suaves a ritmo ${paces.easyMin}-${paces.easyMax} min/km y adaptación neuromuscular`,
    },
    {
      name: "Fase Construcción & Tempo",
      color: "amber" as PhaseColor,
      start: p1End + 1,
      end: p2End,
      objective: `Series a ritmo umbral (${paces.threshold} min/km) e incremento controlado de carga`,
    },
    {
      name: "Fase Pico & Intervalos VO2",
      color: "violet" as PhaseColor,
      start: p2End + 1,
      end: p3End,
      objective: `Intervalos de velocidad (${paces.interval} min/km) y fondos largos máximos`,
    },
    {
      name: "Fase Tapering & Carrera",
      color: "sky" as PhaseColor,
      start: p3End + 1,
      end: p4End,
      objective:
        "Descarga de volumen (-40%), afinamiento de ritmo y día del objetivo",
    },
  ].filter((p) => p.start <= p.end)

  // Orden de días coherente con el inicio de semana; la tirada larga va al final.
  const sortedDays = [...selectedDays].sort((a, b) => {
    const orderA = a === longRunDay ? 99 : (a - wsdGetDay + 7) % 7
    const orderB = b === longRunDay ? 99 : (b - wsdGetDay + 7) % 7
    return orderA - orderB
  })

  // Índices (dentro de sortedDays) reservados para sesiones de calidad.
  // El día siguiente al último de calidad se usa para un rodaje regenerativo.
  const qualityIndices = [1, ...(sortedDays.length > 3 ? [2] : [])]
  const lastQualityIdx = qualityIndices.length
    ? Math.max(...qualityIndices)
    : -1

  const generatedPhases: PhaseDraft[] = phasesSpec.map((spec, phaseIdx) => {
    const weeksInPhase: WeekDraft[] = []

    for (let wNum = spec.start; wNum <= spec.end; wNum++) {
      const weekStart = addDaysToIso(firstWeekStart, (wNum - 1) * 7)
      const weekEnd = addDaysToIso(weekStart, 6)

      // Calculate weekly long run target distance
      const progressRatio = wNum / numWeeks
      const baseLongKm = Math.max(longestRunKm, 6)
      const targetLongKm = Math.min(targetKm * 0.85, 32)
      let weekLongKm = Math.round(
        baseLongKm + progressRatio * (targetLongKm - baseLongKm),
      )

      // Tapering phase reduces volume
      if (phaseIdx === 3 && wNum < numWeeks) {
        weekLongKm = Math.round(weekLongKm * 0.6)
      } else if (wNum === numWeeks) {
        weekLongKm = targetKm // Race Day
      }

      const workouts: WorkoutDraft[] = []

      sortedDays.forEach((dayId, dayIdx) => {
        // Offset respecto al día de inicio de semana elegido (week_start_day).
        const offset = (dayId - wsdGetDay + 7) % 7
        const workoutDate = addDaysToIso(weekStart, offset)

        // No agendar sesiones antes del inicio real del plan.
        if (workoutDate < startDateISO) return

        const isLongRunDay =
          dayId === longRunDay ||
          (dayIdx === sortedDays.length - 1 && !sortedDays.includes(longRunDay))
        const isQualityDay = qualityIndices.includes(dayIdx)
        const isRecoveryDay =
          phaseIdx >= 1 && dayIdx === lastQualityIdx + 1 && !isLongRunDay

        let type: WorkoutType = "easy_run"
        let name = "Rodaje Suave Aeróbico"
        let distKm = Math.max(
          5,
          Math.round(currentWeeklyKm / sortedDays.length),
        )
        let targetPace = easyPaceSec
        let intensity: Intensity = "easy"
        let blocks: BlockDraft[] = []

        if (isLongRunDay) {
          type = wNum === numWeeks ? "race" : "long_run"
          name =
            wNum === numWeeks
              ? `Día de Carrera Objetivo (${formatDistance(targetKm)})`
              : `Tirada Larga de Fondo (${formatDistance(weekLongKm)})`
          distKm = weekLongKm
          targetPace = wNum === numWeeks ? predictedPaceSec : longRunPaceSec
          intensity = wNum === numWeeks ? "hard" : "moderate"

          // Long Run Structured Blocks
          const mainKm = Math.max(2, distKm - 3)
          blocks = [
            {
              position: 1,
              block_type: "warmup",
              repeats: 1,
              distance_m: 2000,
              duration_seconds: null,
              pace_seconds_per_km: easyPaceSec + 15,
              pace_range_end_seconds_per_km: null,
              recovery_seconds: null,
              recovery_type: "jog",
              notes: "Entrada en calor suave",
            },
            {
              position: 2,
              block_type: "main",
              repeats: 1,
              distance_m: mainKm * 1000,
              duration_seconds: null,
              pace_seconds_per_km: longRunPaceSec,
              pace_range_end_seconds_per_km: null,
              recovery_seconds: null,
              recovery_type: "jog",
              notes: "Ritmo cómodo conversacional",
            },
            {
              position: 3,
              block_type: "cooldown",
              repeats: 1,
              distance_m: 1000,
              duration_seconds: null,
              pace_seconds_per_km: easyPaceSec + 20,
              pace_range_end_seconds_per_km: null,
              recovery_seconds: null,
              recovery_type: "jog",
              notes: "Afloje final",
            },
          ]
        } else if (isQualityDay && phaseIdx >= 1) {
          if (phaseIdx === 1) {
            // Tempo Run
            type = "tempo"
            name = "Sesión Tempo (Umbral Láctico)"
            distKm = 8 + Math.round(wNum * 0.4)
            targetPace = tempoPaceSec
            intensity = "hard"

            const tempoKm = Math.max(3, distKm - 3)
            blocks = [
              {
                position: 1,
                block_type: "warmup",
                repeats: 1,
                distance_m: 1500,
                duration_seconds: null,
                pace_seconds_per_km: easyPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: "Calentamiento",
              },
              {
                position: 2,
                block_type: "main",
                repeats: 1,
                distance_m: tempoKm * 1000,
                duration_seconds: null,
                pace_seconds_per_km: tempoPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: `Bloque Tempo sostenido @ ${paces.threshold}/km`,
              },
              {
                position: 3,
                block_type: "cooldown",
                repeats: 1,
                distance_m: 1500,
                duration_seconds: null,
                pace_seconds_per_km: easyPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: "Enfriamiento",
              },
            ]
          } else if (phaseIdx === 2) {
            // Interval Session
            type = "intervals"
            name = "Intervalos de Velocidad (VO2 Max)"
            distKm = 9
            targetPace = intervalPaceSec
            intensity = "hard"

            const reps = Math.min(8, 4 + Math.floor(wNum * 0.4))
            blocks = [
              {
                position: 1,
                block_type: "warmup",
                repeats: 1,
                distance_m: 1500,
                duration_seconds: null,
                pace_seconds_per_km: easyPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: "Calentamiento + progresiones",
              },
              {
                position: 2,
                block_type: "interval",
                repeats: reps,
                distance_m: 800,
                duration_seconds: null,
                pace_seconds_per_km: intervalPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: 90,
                recovery_type: "jog",
                notes: `${reps}x800m @ ${paces.interval}/km con 90s trote`,
              },
              {
                position: 3,
                block_type: "cooldown",
                repeats: 1,
                distance_m: 1500,
                duration_seconds: null,
                pace_seconds_per_km: easyPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: "Enfriamiento libre",
              },
            ]
          } else {
            // Activation
            type = "activation"
            name = "Activación y Progresiones"
            distKm = 5
            targetPace = easyPaceSec
            intensity = "easy"
            blocks = [
              {
                position: 1,
                block_type: "warmup",
                repeats: 1,
                distance_m: 3000,
                duration_seconds: null,
                pace_seconds_per_km: easyPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: "Rodaje suave",
              },
              {
                position: 2,
                block_type: "strides",
                repeats: 4,
                distance_m: 100,
                duration_seconds: null,
                pace_seconds_per_km: intervalPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: 45,
                recovery_type: "walk",
                notes: "Progresiones sueltas",
              },
              {
                position: 3,
                block_type: "cooldown",
                repeats: 1,
                distance_m: 1000,
                duration_seconds: null,
                pace_seconds_per_km: easyPaceSec,
                pace_range_end_seconds_per_km: null,
                recovery_seconds: null,
                recovery_type: "jog",
                notes: "Afloje final",
              },
            ]
          }
        } else {
          // Rodaje fácil: regenerativo (día post-calidad), corto, medio o largo,
          // con variedad de distancias y progresiones para evitar sesiones idénticas.
          const isRegeneration = isRecoveryDay
          type = isRegeneration ? "regeneration" : "easy_run"

          const baseEasy = 6 + wNum * 0.2
          const variation = ((dayIdx % 3) - 1) * 1.5 // -1.5 / 0 / +1.5 km
          distKm = isRegeneration
            ? Math.max(4, Math.round((5 + wNum * 0.1) * 10) / 10)
            : Math.max(5, Math.round((baseEasy + variation) * 10) / 10)

          name = isRegeneration
            ? "Rodaje Regenerativo"
            : distKm <= 6
              ? "Rodaje Suave Corto"
              : distKm <= 8
                ? "Rodaje Suave Medio"
                : "Rodaje Suave Largo"

          targetPace = isRegeneration ? easyPaceSec + 20 : easyPaceSec
          intensity = "easy"

          const baseBlocks: BlockDraft[] = [
            {
              position: 1,
              block_type: "warmup",
              repeats: 1,
              distance_m: 1000,
              duration_seconds: null,
              pace_seconds_per_km: easyPaceSec + 10,
              pace_range_end_seconds_per_km: null,
              recovery_seconds: null,
              recovery_type: "jog",
              notes: "Trote inicial",
            },
            {
              position: 2,
              block_type: "main",
              repeats: 1,
              distance_m: Math.max(2000, (distKm - 2) * 1000),
              duration_seconds: null,
              pace_seconds_per_km: targetPace,
              pace_range_end_seconds_per_km: null,
              recovery_seconds: null,
              recovery_type: "jog",
              notes: isRegeneration
                ? "Ritmo muy suave, recuperación activa"
                : "Ritmo Z2 aeróbico conversacional",
            },
          ]

          // Progresiones (strides) en el primer rodaje de la semana, si hay ≥3 días.
          if (!isRegeneration && dayIdx === 0 && sortedDays.length >= 3) {
            baseBlocks.push({
              position: 3,
              block_type: "strides",
              repeats: 4,
              distance_m: 100,
              duration_seconds: null,
              pace_seconds_per_km: intervalPaceSec,
              pace_range_end_seconds_per_km: null,
              recovery_seconds: 45,
              recovery_type: "walk",
              notes: "4x100m progresiones sueltas",
            })
          }

          baseBlocks.push({
            position: baseBlocks.length + 1,
            block_type: "cooldown",
            repeats: 1,
            distance_m: 1000,
            duration_seconds: null,
            pace_seconds_per_km: easyPaceSec + 10,
            pace_range_end_seconds_per_km: null,
            recovery_seconds: null,
            recovery_type: "jog",
            notes: "Soltura",
          })

          blocks = baseBlocks.map((b, i) => ({ ...b, position: i + 1 }))
        }

        workouts.push({
          date: workoutDate,
          type,
          name,
          objective: `${name} (${formatDistance(distKm)} @ ${mathFormatPace(targetPace)}/km)`,
          distance_km: distKm,
          duration_seconds: null,
          pace_seconds_per_km: targetPace,
          intensity,
          description: "",
          notes: "",
          cancelled: false,
          status_override: null,
          blocks,
        })
      })

      weeksInPhase.push({
        number: wNum,
        start_date: weekStart,
        end_date: weekEnd,
        name: "",
        objective: `Volumen semana: ~${formatDistance(
          workouts.reduce((acc, curr) => acc + (curr.distance_km || 0), 0),
        )}`,
        notes: "",
        workouts,
      })
    }

    return {
      position: phaseIdx + 1,
      name: spec.name,
      color: spec.color,
      start_week: spec.start,
      end_week: spec.end,
      objective: spec.objective,
      description: "",
      weeks: weeksInPhase,
    }
  })

  // Format plan name automatically if empty
  const planName = draft.name.trim() || `Plan ${targetKm}K (${numWeeks} sem)`

  return {
    ...draft,
    name: planName,
    goal:
      draft.goal ||
      `Completar ${formatDistance(targetKm)} en ${formatTime(predictedFinishSec)} (${mathFormatPace(predictedPaceSec)}/km)`,
    distance_km: targetKm,
    target_time_seconds: predictedFinishSec,
    target_pace_seconds_per_km: predictedPaceSec,
    end_date: calculatedEndDate,
    phases: generatedPhases,
  }
}

export function PlanWizard({ editId }: { editId?: string | null }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [step, setStep] = useState<number>(editId ? 6 : 1)
  const [draft, setDraft] = useState<PlanDraft>(createEmptyDraft)
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false)

  // Questionnaire / Onboarding state (Paccer style)
  const [userLevel, setUserLevel] = useState<string>("intermediate")
  const [hasInjury, setHasInjury] = useState<boolean>(false)
  const [showFullEditor, setShowFullEditor] = useState<boolean>(Boolean(editId))

  const [terrain, setTerrain] = useState<"road" | "trail">("road")
  const [planType, setPlanType] = useState<string>("race")
  const [goalType, setGoalType] = useState<"finish" | "time" | "performance">("finish")
  const [raceName, setRaceName] = useState<string>("")
  const [raceDate, setRaceDate] = useState<string>("")
  const [targetKm, setTargetKm] = useState<number>(21.1)
  const [numWeeks, setNumWeeks] = useState<number>(12)

  const [confidence, setConfidence] = useState<"measured" | "declared" | "estimated">("measured")
  const [conservativeMode, setConservativeMode] = useState<boolean>(false)
  const [warnings, setWarnings] = useState<Array<{ code: string; severity: string; message: string }>>([])

  // M3: Reglas estructurales configurables
  const [cutbackCadence, setCutbackCadence] = useState<number>(4)
  const [hardDayMinGapDays, setHardDayMinGapDays] = useState<number>(2)
  const [avoidLongAdjacentQuality, setAvoidLongAdjacentQuality] = useState<boolean>(true)
  const [showAdvancedStructure, setShowAdvancedStructure] = useState<boolean>(false)

  const [refDistanceKm, setRefDistanceKm] = useState<number>(5)
  const [refTimeInput, setRefTimeInput] = useState<string>("00:24:30")

  const { refHours, refMinutes, refSeconds } = useMemo(() => {
    if (!refTimeInput) return { refHours: 0, refMinutes: 24, refSeconds: 30 }
    const parts = refTimeInput.split(":").map((p) => parseInt(p, 10) || 0)
    if (parts.length === 2) {
      // mm:ss
      return {
        refHours: 0,
        refMinutes: Math.min(59, parts[0]),
        refSeconds: Math.min(59, parts[1]),
      }
    }
    if (parts.length >= 3) {
      // hh:mm:ss
      return {
        refHours: Math.min(23, parts[0]),
        refMinutes: Math.min(59, parts[1]),
        refSeconds: Math.min(59, parts[2]),
      }
    }
    return { refHours: 0, refMinutes: 24, refSeconds: 30 }
  }, [refTimeInput])

  const updateRefTime = (hours: number, minutes: number, seconds: number) => {
    refTimeEdited.current = true
    const h = Math.max(0, Math.min(23, hours))
    const m = Math.max(0, Math.min(59, minutes))
    const s = Math.max(0, Math.min(59, seconds))
    const pad = (n: number) => n.toString().padStart(2, "0")
    setRefTimeInput(`${pad(h)}:${pad(m)}:${pad(s)}`)
  }

  const [currentWeeklyKm, setCurrentWeeklyKm] = useState<number | "">("")
  const [longestRunKm, setLongestRunKm] = useState<number | "">("")
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5, 6]) // Lun, Mié, Vie, Sáb (Paccer default)
  const [longRunDay, setLongRunDay] = useState<number>(6) // Sáb (Paccer default)

  // Best marks reales del usuario (para autocompletar el tiempo de referencia)
  const bestPacesQuery = useQuery({
    queryKey: ["stats-best-paces"],
    queryFn: () => AnalyticsService.readCardioBestPaces(),
  })

  // Mapa distancia de referencia (5, 10, 15, 21.1, 42.2) → mejor tiempo (seg)
  const bestTimeByRefKm = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of bestPacesQuery.data ?? []) {
      const label = String(entry.distance_label ?? "").toLowerCase()
      const duration = Number(entry.duration_seconds)
      if (!duration) continue
      if (label === "5k") map["5"] = duration
      else if (label === "10k") map["10"] = duration
      else if (label === "15k") map["15"] = duration
      else if (label === "21k") map["21.1"] = duration
      else if (label === "42k") map["42.2"] = duration
    }
    return map
  }, [bestPacesQuery.data])

  const bestTimeForRef = bestTimeByRefKm[refDistanceKm.toString()]

  // Si el usuario aún no editó el tiempo a mano, autocompletar con su mejor marca
  const refTimeEdited = useRef(false)
  useEffect(() => {
    const best = bestTimeByRefKm[refDistanceKm.toString()]
    if (best && !refTimeEdited.current) {
      const h = Math.floor(best / 3600)
      const m = Math.floor((best % 3600) / 60)
      const s = Math.round(best % 60)
      const pad = (n: number) => n.toString().padStart(2, "0")
      setRefTimeInput(`${pad(h)}:${pad(m)}:${pad(s)}`)
    }
  }, [refDistanceKm, bestTimeByRefKm])

  // Datos reales para autocompletar volumen semanal y tirada larga
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "current-week"],
    queryFn: () =>
      AnalyticsService.readDashboard({ weekStart: getCurrentWeekStartIso() }),
  })

  const recentActivitiesQuery = useQuery({
    queryKey: ["activities", "recent"],
    queryFn: () => ActivitiesService.readActivities({ limit: 50 }),
  })

  // Promedio de kilometraje semanal (semana actual + anterior)
  const autoWeeklyKm = useMemo(() => {
    const current = dashboardQuery.data?.kpis?.cardio_distance_meters ?? 0
    const previous =
      dashboardQuery.data?.previous_kpis?.cardio_distance_meters ?? 0
    const total = current + previous
    if (total <= 0) return null
    return Math.round(total / 2 / 1000)
  }, [dashboardQuery.data])

  // Tirada más larga reciente (máxima distancia cardio de las últimas actividades)
  const autoLongestKm = useMemo(() => {
    const activities = recentActivitiesQuery.data?.data ?? []
    let maxMeters = 0
    for (const activity of activities) {
      const distance = activity.cardio?.distance_meters ?? 0
      if (distance > maxMeters) maxMeters = distance
    }
    if (maxMeters <= 0) return null
    return Math.round(maxMeters / 1000)
  }, [recentActivitiesQuery.data])

  // Autocompletar solo si el usuario no editó el campo manualmente
  const volumeEdited = useRef(false)
  const longestEdited = useRef(false)
  useEffect(() => {
    if (autoWeeklyKm != null && !volumeEdited.current) {
      setCurrentWeeklyKm(autoWeeklyKm)
    }
  }, [autoWeeklyKm])
  useEffect(() => {
    if (autoLongestKm != null && !longestEdited.current) {
      setLongestRunKm(autoLongestKm)
    }
  }, [autoLongestKm])

  // Calculated VDOT preview
  const refTimeSeconds = useMemo(
    () => raceTimeInputToSeconds(refTimeInput) || 1470,
    [refTimeInput],
  )

  const calculatedVdot = useMemo(
    () => calculateVDOT(refDistanceKm * 1000, refTimeSeconds),
    [refDistanceKm, refTimeSeconds],
  )

  const calculatedPaces = useMemo(
    () => getTrainingPaces(calculatedVdot),
    [calculatedVdot],
  )

  const predictedRaceSec = useMemo(
    () =>
      predictTimeRiegel(refDistanceKm * 1000, refTimeSeconds, targetKm * 1000),
    [refDistanceKm, refTimeSeconds, targetKm],
  )

  // Projected finish time after completing the training block (~2% to 5% gain)
  const projectedTargetSec = useMemo(() => {
    if (!predictedRaceSec) return 0
    const factor =
      goalType === "performance" ? 0.94 : goalType === "time" ? 0.96 : 0.98
    return Math.round(predictedRaceSec * factor)
  }, [predictedRaceSec, goalType])

  // Fetch plan if in edit mode
  const editQuery = useQuery({
    queryKey: ["running-plan", editId ?? ""],
    queryFn: () => RunningPlansService.readPlan({ planId: editId! }),
    enabled: Boolean(editId),
  })

  useEffect(() => {
    if (editQuery.data) {
      const converted = publicToDraft(editQuery.data)
      setDraft(converted)
      if (converted.distance_km) setTargetKm(converted.distance_km)
    }
  }, [editQuery.data])

  const racesQuery = useQuery({
    queryKey: ["races"],
    queryFn: () => RacesService.readRaces(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: RunningPlanCreate) =>
      RunningPlansService.createPlan({ requestBody: payload }),
    onSuccess: (res) => {
      showSuccessToast("¡Plan generado y guardado exitosamente!")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      navigate({ to: "/routines/run/$planId", params: { planId: res.id } })
    },
    onError: handleError.bind(showErrorToast),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: RunningPlanCreate) =>
      RunningPlansService.replacePlan({
        planId: editId!,
        requestBody: payload,
      }),
    onSuccess: () => {
      showSuccessToast("Plan actualizado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["running-plan", editId] })
      navigate({ to: "/routines/run/$planId", params: { planId: editId! } })
    },
    onError: handleError.bind(showErrorToast),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSave = () => {
    if (!draft.name.trim()) {
      showErrorToast("Ingresá un nombre para tu plan")
      return
    }
    const payload = buildPayload(draft)
    if (editId) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const toggleDay = (dayId: number) => {
    const next = selectedDays.includes(dayId)
      ? selectedDays.filter((d) => d !== dayId)
      : [...selectedDays, dayId]
    setSelectedDays(next)
    // Si el día de fondo quedó deseleccionado, moverlo al último día elegido.
    if (next.length > 0 && !next.includes(longRunDay)) {
      setLongRunDay(next[next.length - 1])
    }
  }

  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      const todayIso = new Date().toISOString().split("T")[0]
      const defaultWeeklyKm =
        userLevel === "beginner"
          ? 18.0
          : userLevel === "intermediate"
            ? 30.0
            : userLevel === "elite"
              ? 65.0
              : 50.0
      const defaultLongestKm =
        userLevel === "beginner"
          ? 7.0
          : userLevel === "intermediate"
            ? 12.0
            : userLevel === "elite"
              ? 22.0
              : 18.0

      const payload = {
        plan_type: planType,
        goal_type: goalType,
        target_km: targetKm,
        target_time_seconds: refTimeSeconds > 0 ? refTimeSeconds : null,
        num_weeks: numWeeks,
        start_date: draft.start_date || todayIso,
        week_start_day: draft.week_start_day || 1,
        selected_days: selectedDays.map((d) => (d === 0 ? 7 : d)),
        long_run_day: longRunDay === 0 ? 7 : longRunDay,
        baseline: {
          weekly_km: {
            value:
              currentWeeklyKm === ""
                ? defaultWeeklyKm
                : Number(currentWeeklyKm),
            confidence: confidence,
          },
          longest_run_km: {
            value:
              longestRunKm === ""
                ? defaultLongestKm
                : Number(longestRunKm),
            confidence: confidence,
          },
          vdot: {
            value:
              calculatedVdot ||
              (userLevel === "beginner"
                ? 32.0
                : userLevel === "intermediate"
                  ? 42.0
                  : userLevel === "elite"
                    ? 58.0
                    : 50.0),
            confidence: confidence,
          },
          runs_per_week: {
            value: selectedDays.length || 4,
            confidence: confidence,
          },
        },
        confidence: confidence,
        conservative_mode: conservativeMode || hasInjury,
        cutback_cadence: cutbackCadence,
        hard_day_min_gap_days: hardDayMinGapDays,
        avoid_long_adjacent_quality: avoidLongAdjacentQuality,
      }
      return RunningPlansService.generateDraft({ requestBody: payload as any })
    },
    onSuccess: (res: any) => {
      const fallbackName =
        draft.name.trim() ||
        (raceName.trim()
          ? `Plan ${raceName.trim()}`
          : `Plan ${targetKm}K (${numWeeks} sem)`)
      if (res?.draft) {
        const d = publicToDraft(res.draft as any)
        if (!d.name) d.name = fallbackName
        setDraft(d)
        setWarnings(res.warnings || [])
      } else {
        const d = publicToDraft(res as any)
        if (!d.name) d.name = fallbackName
        setDraft(d)
      }
      showSuccessToast("¡Plan generado con éxito según tu rutina y nivel!")
      setStep(6)
    },
    onError: () => {
      const fallbackName =
        draft.name.trim() ||
        (raceName.trim()
          ? `Plan ${raceName.trim()}`
          : `Plan ${targetKm}K (${numWeeks} sem)`)
      const defaultWeeklyKm =
        userLevel === "beginner"
          ? 18
          : userLevel === "intermediate"
            ? 30
            : userLevel === "elite"
              ? 65
              : 50
      const defaultLongestKm =
        userLevel === "beginner"
          ? 7
          : userLevel === "intermediate"
            ? 12
            : userLevel === "elite"
              ? 22
              : 18

      const generated = generatePlanStructure({
        draft: {
          ...draft,
          name: fallbackName,
          notes: [
            draft.notes,
            `Modalidad: ${terrain === "trail" ? "Trail / Montaña" : "Asfalto"}`,
            hasInjury
              ? "Antecedente de lesión: Progresión conservadora activa"
              : null,
          ]
            .filter(Boolean)
            .join(" | "),
        },
        planType,
        targetKm,
        numWeeks,
        userLevel,
        refDistanceKm,
        refTimeSeconds,
        currentWeeklyKm:
          currentWeeklyKm === "" ? defaultWeeklyKm : Number(currentWeeklyKm),
        longestRunKm:
          longestRunKm === "" ? defaultLongestKm : Number(longestRunKm),
        selectedDays,
        longRunDay,
      })
      setDraft(generated)
      showSuccessToast("Plan generado localmente.")
      setStep(6)
    },
  })

  const handleGeneratePlan = () => {
    if (selectedDays.length === 0) {
      showErrorToast("Seleccioná al menos 1 día de entrenamiento")
      return
    }
    generateDraftMutation.mutate()
  }

  // Weekly Km chart stats for Unified Editor
  const weeklyKmStats = useMemo(() => {
    const stats: Array<{ weekNum: number; totalKm: number }> = []
    draft.phases.forEach((phase) => {
      phase.weeks.forEach((week) => {
        const km = week.workouts.reduce(
          (acc, w) => acc + (w.distance_km || blocksDistanceKm(w.blocks) || 0),
          0,
        )
        stats.push({ weekNum: week.number, totalKm: Math.round(km * 10) / 10 })
      })
    })
    return stats
  }, [draft])

  const maxWeeklyKm = Math.max(...weeklyKmStats.map((s) => s.totalKm), 1)

  if (editQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-2">
      {/* Runna-style Navigation Header (Steps 1 to 5) */}
      {step <= 5 && (
        <div className="flex items-center justify-between gap-4 max-w-xl mx-auto w-full px-2 pt-2 pb-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (step > 1) {
                setStep(step - 1)
              } else {
                navigate({ to: "/routines" })
              }
            }}
            className="size-10 rounded-full hover:bg-surface-container-high text-muted-foreground hover:text-white cursor-pointer shrink-0"
            aria-label="Atrás"
          >
            <ArrowLeft className="size-5" />
          </Button>

          {/* 5-step thin segmented progress bar (Runna style) */}
          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  s <= step ? "bg-white" : "bg-neutral-800",
                )}
              />
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/routines" })}
            className="size-10 rounded-full hover:bg-surface-container-high text-muted-foreground hover:text-white cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X className="size-5" />
          </Button>
        </div>
      )}

      {/* Standard Editor Header (Step 6) */}
      {step === 6 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="bg-card border border-border text-muted-foreground hover:text-white hover:bg-surface-container-high rounded-xl"
              onClick={() => setStep(5)}
              title="Volver a los parámetros"
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {editId ? "Editar Plan de Running" : "Creador de Planes"}
                </h1>
                <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 text-[11px] font-bold">
                  <Sparkles className="size-3" /> Algoritmo VDOT
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Revisá y personalizá los bloques, fases y cargas generadas antes de confirmar tu plan.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20 gap-2 rounded-xl cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4 stroke-[3]" />
            )}
            <span>{editId ? "Guardar Cambios" : "Guardar Plan"}</span>
          </Button>
        </div>
      )}

      {/* STEP 1: Nivel de carrera (Runna parte 2) */}
      {step === 1 && (
        <Card className="max-w-xl mx-auto w-full p-6 sm:p-8 bg-card border-border/80 shadow-card rounded-3xl">
          <CardHeader className="px-0 pt-0 pb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Nivel de carrera
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Elegí el nivel que mejor represente tu experiencia actual.
            </p>
          </CardHeader>

          <CardContent className="px-0 flex flex-col gap-6">
            {/* Niveles con radio rings */}
            <div className="flex flex-col gap-3">
              {LEVELS.map((lvl) => {
                const isSelected = userLevel === lvl.id
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => {
                      setUserLevel(lvl.id)
                      if (!volumeEdited.current) setCurrentWeeklyKm(lvl.weeklyKm)
                      if (!longestEdited.current) setLongestRunKm(lvl.longestKm)
                      if (!refTimeEdited.current) setRefTimeInput(lvl.refTime)
                    }}
                    className={cn(
                      "flex items-center justify-between p-4.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                      isSelected
                        ? "bg-surface-container-high/90 border-white text-white shadow-sm ring-1 ring-white/20"
                        : "bg-surface-container-high/30 border-border/80 text-white hover:bg-surface-container-high/60 hover:border-border",
                    )}
                  >
                    <div className="flex flex-col pr-4">
                      <span className="text-base font-bold text-white">
                        {lvl.title}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {lvl.desc}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-white bg-white"
                          : "border-neutral-500 bg-transparent",
                      )}
                    >
                      {isSelected && (
                        <div className="size-2 rounded-full bg-black" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Pregunta Lesiones */}
            <div className="flex flex-col gap-2.5 pt-2">
              <span className="font-bold text-sm text-white">
                ¿Alguna lesión activa o reciente?
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHasInjury(false)
                    setConservativeMode(false)
                    setConfidence("measured")
                  }}
                  className={cn(
                    "h-12 rounded-2xl border font-bold text-sm transition-all cursor-pointer",
                    !hasInjury
                      ? "bg-primary text-black border-primary shadow-xs"
                      : "bg-surface-container-high/60 border-border/80 text-muted-foreground hover:text-white hover:bg-surface-container-high",
                  )}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasInjury(true)
                    setConservativeMode(true)
                    setConfidence("estimated")
                  }}
                  className={cn(
                    "h-12 rounded-2xl border font-bold text-sm transition-all cursor-pointer",
                    hasInjury
                      ? "bg-primary text-black border-primary shadow-xs"
                      : "bg-surface-container-high/60 border-border/80 text-muted-foreground hover:text-white hover:bg-surface-container-high",
                  )}
                >
                  Sí
                </button>
              </div>
              {hasInjury && (
                <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl mt-1 flex items-start gap-2">
                  <Sparkles className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    Modo Preventivo activo: el plan comenzará con incrementos más
                    pausados y semanas de descarga para proteger tus articulaciones.
                  </span>
                </div>
              )}
            </div>

            {/* Botón continuar */}
            <Button
              type="button"
              onClick={() => setStep(2)}
              className="w-full h-14 rounded-full bg-white text-black hover:bg-neutral-200 font-extrabold text-base cursor-pointer shadow-card mt-2"
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Defina sua meta (2-criar-treino-meta.png) */}
      {step === 2 && (
        <Card className="max-w-xl mx-auto w-full p-6 sm:p-8 bg-card border-border/80 shadow-card rounded-3xl">
          <CardHeader className="px-0 pt-0 pb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Definí tu meta
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Elegí el foco de tu entrenamiento.
            </p>
          </CardHeader>

          <CardContent className="px-0 flex flex-col gap-6">
            {/* Modalidad de la corrida */}
            <div className="flex flex-col gap-2.5">
              <span className="font-bold text-sm text-white">
                Modalidad de carrera
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTerrain("road")}
                  className={cn(
                    "h-13 rounded-2xl border font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2",
                    terrain === "road"
                      ? "bg-primary text-black border-primary shadow-xs"
                      : "bg-surface-container-high/60 border-border/80 text-muted-foreground hover:text-white hover:bg-surface-container-high",
                  )}
                >
                  <span>Asfalto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTerrain("trail")}
                  className={cn(
                    "h-13 rounded-2xl border font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2",
                    terrain === "trail"
                      ? "bg-primary text-black border-primary shadow-xs"
                      : "bg-surface-container-high/60 border-border/80 text-muted-foreground hover:text-white hover:bg-surface-container-high",
                  )}
                >
                  <Mountain className="size-4" />
                  <span>Trail</span>
                </button>
              </div>
            </div>

            {/* ¿Cuál es tu objetivo? */}
            <div className="flex flex-col gap-2.5">
              <span className="font-bold text-sm text-white">
                ¿Cuál es tu objetivo?
              </span>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setPlanType("race")}
                  className={cn(
                    "flex items-center gap-4 p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                    planType === "race"
                      ? "bg-primary text-black border-primary shadow-md font-bold"
                      : "bg-surface-container-high/60 border-border/80 text-white hover:bg-surface-container-high hover:border-border",
                  )}
                >
                  <div
                    className={cn(
                      "p-2.5 rounded-xl transition-colors",
                      planType === "race"
                        ? "bg-black/10 text-black"
                        : "bg-card text-muted-foreground",
                    )}
                  >
                    <Trophy className="size-6" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span
                      className={cn(
                        "text-base font-bold",
                        planType === "race" ? "text-black" : "text-white",
                      )}
                    >
                      Entrenar para una prueba
                    </span>
                    <span
                      className={cn(
                        "text-xs mt-0.5",
                        planType === "race"
                          ? "text-black/80 font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      Ciclo de entrenamiento completo.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPlanType("distance")}
                  className={cn(
                    "flex items-center gap-4 p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 cursor-pointer",
                    planType !== "race"
                      ? "bg-primary text-black border-primary shadow-md font-bold"
                      : "bg-surface-container-high/60 border-border/80 text-white hover:bg-surface-container-high hover:border-border",
                  )}
                >
                  <div
                    className={cn(
                      "p-2.5 rounded-xl transition-colors",
                      planType !== "race"
                        ? "bg-black/10 text-black"
                        : "bg-card text-muted-foreground",
                    )}
                  >
                    <Footprints className="size-6" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <span
                      className={cn(
                        "text-base font-bold",
                        planType !== "race" ? "text-black" : "text-white",
                      )}
                    >
                      Solo correr
                    </span>
                    <span
                      className={cn(
                        "text-xs mt-0.5",
                        planType !== "race"
                          ? "text-black/80 font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      Mantener salud y evolucionar sin prueba.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Campos condicionales para carrera (idéntico a imagen 2) */}
            {planType === "race" ? (
              <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl bg-surface-container-high/40 border border-border/80">
                {/* Objetivo en la prueba */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    ¿Cuál es tu objetivo en la prueba?
                  </Label>
                  <Select
                    value={goalType}
                    onValueChange={(val) => setGoalType(val as any)}
                  >
                    <SelectTrigger className="h-12 bg-card border-border text-white rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-white">
                      <SelectItem value="finish">Terminar bien</SelectItem>
                      <SelectItem value="time">Cumplir un tiempo objetivo</SelectItem>
                      <SelectItem value="performance">
                        Buscar récord personal (PB)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Distancia de la carrera */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Distancia objetivo
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "5K", km: 5 },
                      { label: "10K", km: 10 },
                      { label: "21K", km: 21.1 },
                      { label: "42K", km: 42.2 },
                    ].map((d) => (
                      <button
                        key={d.km}
                        type="button"
                        onClick={() => {
                          setTargetKm(d.km)
                          setRefDistanceKm(d.km)
                          setDraft({ ...draft, distance_km: d.km })
                        }}
                        className={cn(
                          "h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          targetKm === d.km
                            ? "bg-primary text-black border-primary shadow-xs"
                            : "bg-card border-border text-muted-foreground hover:text-white",
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre de la prueba */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Nombre de la prueba
                    </Label>
                    {(racesQuery.data?.data ?? []).length > 0 && (
                      <span className="text-[11px] text-primary">
                        o seleccioná de tus carreras abajo
                      </span>
                    )}
                  </div>
                  <Input
                    placeholder="Ej: Maratón de Buenos Aires"
                    value={raceName}
                    onChange={(e) => {
                      setRaceName(e.target.value)
                      setDraft({ ...draft, name: e.target.value })
                    }}
                    className="h-12 bg-card border-border text-white rounded-xl"
                  />
                  {(racesQuery.data?.data ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(racesQuery.data?.data ?? []).slice(0, 3).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setRaceName(r.event_name)
                            setDraft({
                              ...draft,
                              name: `Plan para ${r.event_name}`,
                              race_id: r.id,
                              distance_km: r.distance_km ?? targetKm,
                            })
                            if (r.distance_km) setTargetKm(r.distance_km)
                            if (r.date) {
                              setRaceDate(r.date)
                              const start = new Date(
                                draft.start_date ||
                                  new Date().toISOString().split("T")[0],
                              )
                              const target = new Date(r.date)
                              const weeks = Math.max(
                                4,
                                Math.min(
                                  24,
                                  Math.round(
                                    (target.getTime() - start.getTime()) /
                                      (7 * 24 * 60 * 60 * 1000),
                                  ),
                                ),
                              )
                              if (weeks >= 4) setNumWeeks(weeks)
                            }
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-container-high border border-border text-muted-foreground hover:text-white cursor-pointer"
                        >
                          {r.event_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fecha de la prueba */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Fecha de la prueba
                  </Label>
                  <Input
                    type="date"
                    value={raceDate}
                    onChange={(e) => {
                      const val = e.target.value
                      setRaceDate(val)
                      if (val) {
                        const start = new Date(
                          draft.start_date ||
                            new Date().toISOString().split("T")[0],
                        )
                        const target = new Date(val)
                        const weeks = Math.max(
                          4,
                          Math.min(
                            24,
                            Math.round(
                              (target.getTime() - start.getTime()) /
                                (7 * 24 * 60 * 60 * 1000),
                            ),
                          ),
                        )
                        if (weeks >= 4) setNumWeeks(weeks)
                      }
                    }}
                    className="h-12 bg-card border-border text-white rounded-xl"
                  />
                  {raceDate && (
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Duración estimada calculada: {numWeeks} semanas de ciclo.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Solo correr: distancia a dominar y duración del ciclo */
              <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl bg-surface-container-high/40 border border-border/80">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Distancia que querés alcanzar o dominar
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "5K", km: 5 },
                      { label: "10K", km: 10 },
                      { label: "21K", km: 21.1 },
                    ].map((d) => (
                      <button
                        key={d.km}
                        type="button"
                        onClick={() => {
                          setTargetKm(d.km)
                          setDraft({ ...draft, distance_km: d.km })
                        }}
                        className={cn(
                          "h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          targetKm === d.km
                            ? "bg-primary text-black border-primary shadow-xs"
                            : "bg-card border-border text-muted-foreground hover:text-white",
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Duración del ciclo
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[8, 12, 16].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setNumWeeks(w)}
                        className={cn(
                          "h-11 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          numWeeks === w
                            ? "bg-primary text-black border-primary shadow-xs"
                            : "bg-card border-border text-muted-foreground hover:text-white",
                        )}
                      >
                        {w} Semanas
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botón continuar */}
            <Button
              type="button"
              onClick={() => setStep(3)}
              className="w-full h-14 rounded-full bg-white text-black hover:bg-neutral-200 font-extrabold text-base cursor-pointer shadow-card mt-2"
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Tiempo estimado actual (Runna parte 3) */}
      {step === 3 && (
        <Card className="max-w-xl mx-auto w-full p-6 sm:p-8 bg-card border-border/80 shadow-card rounded-3xl">
          <CardHeader className="px-0 pt-0 pb-5">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              ¿Cuál es tu tiempo estimado <span className="text-primary">actual</span> de carrera?
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Elige un tiempo que refleje tu nivel de condición física <span className="text-primary font-medium">actual</span>. ¡No utilices un tiempo de MP o de objetivo antiguo!
            </p>
          </CardHeader>

          <CardContent className="px-0 flex flex-col gap-6">
            {/* Distancia de referencia (Chips horizontales estilo Runna) */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "5 km", km: 5 },
                { label: "10 km", km: 10 },
                { label: "Media maratón", km: 21.1 },
                { label: "Maratón", km: 42.2 },
              ].map((d) => {
                const isSelected = refDistanceKm === d.km
                return (
                  <button
                    key={d.km}
                    type="button"
                    onClick={() => {
                      setRefDistanceKm(d.km)
                      refTimeEdited.current = false
                    }}
                    className={cn(
                      "px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center",
                      isSelected
                        ? "bg-primary text-black font-extrabold shadow-sm"
                        : "bg-surface-container-high/80 text-muted-foreground hover:text-white border border-border/50",
                    )}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>

            {/* Runna Dynamic Sentence Callout */}
            <div className="text-center py-1">
              <p className="text-sm text-muted-foreground">
                Actualmente puedo correr una carrera de{" "}
                <span className="font-bold text-primary">
                  {refDistanceKm === 5
                    ? "5 km"
                    : refDistanceKm === 10
                      ? "10 km"
                      : refDistanceKm === 21.1
                        ? "Media maratón"
                        : "Maratón"}
                </span>{" "}
                en{" "}
                <span className="font-display font-black text-white text-base">
                  {refHours > 0
                    ? `${refHours}:${refMinutes.toString().padStart(2, "0")}:${refSeconds.toString().padStart(2, "0")}`
                    : `${refMinutes}:${refSeconds.toString().padStart(2, "0")}`}
                </span>
                {refDistanceKm > 0 && refTimeSeconds > 0 && (
                  <span className="text-xs text-muted-foreground ml-1.5">
                    (~{mathFormatPace(Math.round(refTimeSeconds / refDistanceKm))}/km)
                  </span>
                )}
              </p>
            </div>

            {/* Runna Drum / Slot Picker (Horas : Minutos : Segundos) */}
            <div className="flex flex-col items-center gap-1 w-full max-w-sm mx-auto">
              <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
                {/* Columna Horas */}
                <div className="flex flex-col items-center flex-1 max-w-[96px]">
                  {refHours > 0 ? (
                    <button
                      type="button"
                      onClick={() => updateRefTime(refHours - 1, refMinutes, refSeconds)}
                      className="h-8 text-xs font-semibold text-muted-foreground/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                      aria-label="Menos horas"
                    >
                      <ChevronUp className="size-3" />
                      <span>{refHours - 1}hora</span>
                    </button>
                  ) : (
                    <div className="h-8" />
                  )}

                  <div className="w-full h-14 rounded-2xl bg-surface-container-high/90 border border-border/80 flex items-center justify-center font-display font-black text-lg sm:text-xl text-white shadow-xs select-none">
                    {refHours}hora
                  </div>

                  <button
                    type="button"
                    onClick={() => updateRefTime(refHours + 1, refMinutes, refSeconds)}
                    className="h-8 text-xs font-semibold text-muted-foreground/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                    aria-label="Más horas"
                  >
                    <span>{refHours + 1}hora</span>
                    <ChevronDown className="size-3" />
                  </button>
                </div>

                <span className="text-xl font-black text-muted-foreground/60 select-none pb-0.5">
                  :
                </span>

                {/* Columna Minutos */}
                <div className="flex flex-col items-center flex-1 max-w-[96px]">
                  <button
                    type="button"
                    onClick={() => updateRefTime(refHours, (refMinutes - 1 + 60) % 60, refSeconds)}
                    className="h-8 text-xs font-semibold text-muted-foreground/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                    aria-label="Menos minutos"
                  >
                    <ChevronUp className="size-3" />
                    <span>{(refMinutes - 1 + 60) % 60}m</span>
                  </button>

                  <div className="w-full h-14 rounded-2xl bg-surface-container-high/90 border border-border/80 flex items-center justify-center font-display font-black text-lg sm:text-xl text-white shadow-xs select-none">
                    {refMinutes}m
                  </div>

                  <button
                    type="button"
                    onClick={() => updateRefTime(refHours, (refMinutes + 1) % 60, refSeconds)}
                    className="h-8 text-xs font-semibold text-muted-foreground/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                    aria-label="Más minutos"
                  >
                    <span>{(refMinutes + 1) % 60}m</span>
                    <ChevronDown className="size-3" />
                  </button>
                </div>

                <span className="text-xl font-black text-muted-foreground/60 select-none pb-0.5">
                  :
                </span>

                {/* Columna Segundos */}
                <div className="flex flex-col items-center flex-1 max-w-[96px]">
                  <button
                    type="button"
                    onClick={() => updateRefTime(refHours, refMinutes, (refSeconds - 1 + 60) % 60)}
                    className="h-8 text-xs font-semibold text-muted-foreground/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                    aria-label="Menos segundos"
                  >
                    <ChevronUp className="size-3" />
                    <span>{(refSeconds - 1 + 60) % 60}s</span>
                  </button>

                  <div className="w-full h-14 rounded-2xl bg-surface-container-high/90 border border-border/80 flex items-center justify-center font-display font-black text-lg sm:text-xl text-white shadow-xs select-none">
                    {refSeconds}s
                  </div>

                  <button
                    type="button"
                    onClick={() => updateRefTime(refHours, refMinutes, (refSeconds + 1) % 60)}
                    className="h-8 text-xs font-semibold text-muted-foreground/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                    aria-label="Más segundos"
                  >
                    <span>{(refSeconds + 1) % 60}s</span>
                    <ChevronDown className="size-3" />
                  </button>
                </div>
              </div>

              {bestTimeForRef && (
                <button
                  type="button"
                  onClick={() => {
                    refTimeEdited.current = true
                    const h = Math.floor(bestTimeForRef / 3600)
                    const m = Math.floor((bestTimeForRef % 3600) / 60)
                    const s = Math.round(bestTimeForRef % 60)
                    const pad = (n: number) => n.toString().padStart(2, "0")
                    setRefTimeInput(`${pad(h)}:${pad(m)}:${pad(s)}`)
                  }}
                  className="text-xs text-primary text-center hover:underline cursor-pointer pt-2"
                >
                  Usar mejor marca registrada: {formatTime(bestTimeForRef)}
                </button>
              )}
            </div>

            {/* VDOT & Paces calculation preview */}
            <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-border/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Nivel de condición física (VDOT)
                </span>
                <span className="font-mono font-black text-primary text-sm sm:text-base">
                  {calculatedVdot || 35} VDOT
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Rodaje Suave
                  </span>
                  <span className="text-xs font-bold text-white mt-0.5">
                    {calculatedPaces.easyMin} - {calculatedPaces.easyMax}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold">
                    Ritmo Tempo
                  </span>
                  <span className="text-xs font-bold text-white mt-0.5">
                    {calculatedPaces.threshold} /km
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-red-400 uppercase font-semibold">
                    Intervalos
                  </span>
                  <span className="text-xs font-bold text-white mt-0.5">
                    {calculatedPaces.interval} /km
                  </span>
                </div>
              </div>
            </div>

            {/* Botón continuar */}
            <Button
              type="button"
              onClick={() => setStep(4)}
              className="w-full h-14 rounded-full bg-white text-black hover:bg-neutral-200 font-extrabold text-base cursor-pointer shadow-card mt-2"
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Días para entrenar (Runna parte 4) */}
      {step === 4 && (
        <Card className="max-w-xl mx-auto w-full p-6 sm:p-8 bg-card border-border/80 shadow-card rounded-3xl">
          <CardHeader className="px-0 pt-0 pb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Días para entrenar
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              ¿Qué días de la semana tenés disponibles para salir a correr?
            </p>
          </CardHeader>

          <CardContent className="px-0 flex flex-col gap-6">
            {/* Runna Guidance banner */}
            <div className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-border/80 flex items-start gap-2.5">
              <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Recomendamos entre 3 y 5 días a la semana para un progreso equilibrado y permitir la recuperación adecuada de tus tejidos.
              </p>
            </div>

            {/* 7 Vertical Full-width Day Rows (Runna Parte 4) */}
            <div className="flex flex-col gap-2.5">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.id)
                const isLong = isSelected && longRunDay === day.id
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left",
                      isSelected
                        ? "bg-surface-container-high/90 border-white text-white shadow-sm ring-1 ring-white/20"
                        : "bg-surface-container-high/30 border-border/80 text-muted-foreground hover:text-white hover:bg-surface-container-high/60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-white">
                        {day.label}
                      </span>
                      {isLong && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          Tirada Larga
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "size-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                        isSelected
                          ? "border-white bg-white text-black"
                          : "border-neutral-500 bg-transparent text-transparent",
                      )}
                    >
                      <Check className="size-3.5 stroke-[3]" />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Día de entrenamiento largo (reactivo a selectedDays) */}
            <div className="flex flex-col gap-2.5 pt-2">
              <span className="font-bold text-sm text-white">
                ¿Cuál es tu día preferido para la Tirada Larga?
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedDays.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Seleccioná al menos un día arriba primero.
                  </p>
                ) : (
                  [...selectedDays]
                    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                    .map((dayId) => {
                      const dayObj = DAYS_OF_WEEK.find((d) => d.id === dayId)
                      const isLong = longRunDay === dayId
                      return (
                        <button
                          key={dayId}
                          type="button"
                          onClick={() => setLongRunDay(dayId)}
                          className={cn(
                            "px-4 h-11 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                            isLong
                              ? "bg-purple-500/20 text-purple-300 border-purple-500 font-extrabold shadow-xs"
                              : "bg-surface-container-high/60 border-border/80 text-muted-foreground hover:text-white",
                          )}
                        >
                          {dayObj?.label || ""}
                        </button>
                      )
                    })
                )}
              </div>
            </div>

            {/* Botón continuar */}
            <Button
              type="button"
              onClick={() => {
                if (selectedDays.length === 0) {
                  showErrorToast("Seleccioná al menos 1 día de entrenamiento")
                  return
                }
                setStep(5)
              }}
              className="w-full h-14 rounded-full bg-white text-black hover:bg-neutral-200 font-extrabold text-base cursor-pointer shadow-card mt-2"
            >
              Continuar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Preferencias & Resumen del Plan (Runna parte 1) */}
      {step === 5 && (
        <Card className="max-w-xl mx-auto w-full p-6 sm:p-8 bg-card border-border/80 shadow-card rounded-3xl">
          <CardHeader className="px-0 pt-0 pb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Estructura de tu plan
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Así organizaremos tu entrenamiento para alcanzar tu objetivo.
            </p>
          </CardHeader>

          <CardContent className="px-0 flex flex-col gap-6">
            {/* Plan Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-high/50 border border-border/80 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                    Objetivo
                  </span>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    {raceName.trim() || `Plan ${targetKm}K`}
                  </h3>
                </div>
                <div className="px-3 py-1 rounded-xl bg-primary/10 border border-primary/30 text-primary font-mono font-black text-sm">
                  {targetKm} km
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Duración
                  </span>
                  <span className="text-sm font-bold text-white mt-0.5">
                    {numWeeks} semanas
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Frecuencia
                  </span>
                  <span className="text-sm font-bold text-white mt-0.5">
                    {selectedDays.length} días/sem
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Ritmo Meta
                  </span>
                  <span className="text-sm font-bold text-white mt-0.5">
                    {predictedRaceSec ? `${mathFormatPace(Math.round(predictedRaceSec / targetKm))}/km` : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Runna 2x2 Workout Types Mosaic (Parte 1) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">
                  Tipos de entrenamiento incluidos
                </span>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                >
                  <HelpCircle className="size-3.5" />
                  <span>Ver guía</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fondo / Tirada Larga */}
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-400" />
                    <span className="font-bold text-xs text-purple-200">
                      Tirada Larga
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-100/70 leading-relaxed">
                    Carrera continua progresiva para construir tu resistencia aeróbica base y confianza en la distancia.
                  </p>
                </div>

                {/* Rodaje Fácil */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-xs text-emerald-200">
                      Rodaje Fácil
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100/70 leading-relaxed">
                    Trote suave a ritmo conversacional para asimilar la carga de entrenamiento y promover recuperación activa.
                  </p>
                </div>

                {/* Intervalos / VO2 Max */}
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-rose-400" />
                    <span className="font-bold text-xs text-rose-200">
                      Intervalos & Series
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-100/70 leading-relaxed">
                    Series de alta intensidad con pausas de trote para elevar tu potencia aeróbica y velocidad máxima.
                  </p>
                </div>

                {/* Tempo / Umbral */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-400" />
                    <span className="font-bold text-xs text-amber-200">
                      Tempo & Umbral
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-100/70 leading-relaxed">
                    Bloques sostenidos a ritmo exigente pero controlado para desplazar tu umbral de lactato.
                  </p>
                </div>
              </div>
            </div>

            {/* Configuración avanzada de estructura */}
            <div className="rounded-2xl border border-border/80 bg-surface-container-high/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedStructure((prev) => !prev)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <span className="font-bold text-sm text-white">
                    Configuración avanzada de estructura
                  </span>
                </div>
                {showAdvancedStructure ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {showAdvancedStructure && (
                <div className="p-4 pt-1 border-t border-border/50 flex flex-col gap-4 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Frecuencia de semana de descarga (Cutback)
                    </Label>
                    <Select
                      value={cutbackCadence.toString()}
                      onValueChange={(val) => setCutbackCadence(Number(val))}
                    >
                      <SelectTrigger className="h-10 bg-card border-border text-white rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Cada 3 semanas (más conservador)</SelectItem>
                        <SelectItem value="4">Cada 4 semanas (estándar recomendado)</SelectItem>
                        <SelectItem value="5">Cada 5 semanas (atletas avanzados)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Separación mínima entre sesiones duras
                    </Label>
                    <Select
                      value={hardDayMinGapDays.toString()}
                      onValueChange={(val) => setHardDayMinGapDays(Number(val))}
                    >
                      <SelectTrigger className="h-10 bg-card border-border text-white rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 día mínimo de descanso/fácil</SelectItem>
                        <SelectItem value="2">2 días mínimos (recomendado)</SelectItem>
                        <SelectItem value="3">3 días mínimos (máxima recuperación)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={avoidLongAdjacentQuality}
                      onChange={(e) => setAvoidLongAdjacentQuality(e.target.checked)}
                      className="size-4 rounded accent-primary bg-card border-border cursor-pointer"
                    />
                    <span className="text-xs text-white">
                      Evitar entrenamientos de calidad adyacentes a la tirada larga
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Cuándo comenzás */}
            <div className="flex flex-col gap-1.5 pt-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                ¿Cuándo querés comenzar?
              </Label>
              <Input
                type="date"
                value={draft.start_date}
                onChange={(e) =>
                  setDraft({ ...draft, start_date: e.target.value })
                }
                className="h-12 bg-card border-border text-white rounded-xl"
              />
            </div>

            {/* Runna Final CTA Button */}
            <div className="flex flex-col gap-2 mt-2">
              <Button
                type="button"
                onClick={handleGeneratePlan}
                disabled={generateDraftMutation.isPending}
                className="w-full h-14 rounded-full bg-white text-black hover:bg-neutral-200 font-extrabold text-base cursor-pointer shadow-card gap-2"
              >
                {generateDraftMutation.isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    <span>Calculando cargas y ritmos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-5" />
                    <span>Generar mi plan de entrenamiento</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guide Dialog Modal (Pagina_ArmarPlan_guia) */}
      <Dialog open={showGuideModal} onOpenChange={setShowGuideModal}>
        <DialogContent className="bg-card border-border text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">
              Guía de Tipos de Entrenamiento
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-purple-400" />
                <h4 className="font-bold text-sm text-purple-200">
                  Tirada Larga (Long Run)
                </h4>
              </div>
              <p className="text-xs text-purple-100/80 leading-relaxed">
                El entrenamiento clave para la resistencia. Se realiza el fin de semana a un ritmo cómodo y controlado, incrementando progresivamente la distancia semana a semana para acostumbrar a tu cuerpo a pasar más tiempo de pie.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-400" />
                <h4 className="font-bold text-sm text-emerald-200">
                  Rodaje Fácil & Regenerativo
                </h4>
              </div>
              <p className="text-xs text-emerald-100/80 leading-relaxed">
                Corridas a ritmo suave donde deberías poder mantener una conversación sin esfuerzo (Zona 2). Construyen capilarización muscular y mitocondrias sin sobrecargar el sistema neuromuscular.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-amber-400" />
                <h4 className="font-bold text-sm text-amber-200">
                  Tempo / Ritmo Umbral
                </h4>
              </div>
              <p className="text-xs text-amber-100/80 leading-relaxed">
                Bloques de 15 a 30 minutos a un esfuerzo "confortablemente duro" (ritmo de 15k a media maratón). Entrenan a tu cuerpo para reciclar el lactato sanguíneo con mayor eficiencia a altas intensidades.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-rose-400" />
                <h4 className="font-bold text-sm text-rose-200">
                  Intervalos & VO2 Max
                </h4>
              </div>
              <p className="text-xs text-rose-100/80 leading-relaxed">
                Repeticiones de 400m a 1600m a ritmo de 3k/5k alternadas con recuperaciones al trote. Desarrollan la capacidad de tu corazón y pulmones para entregar oxígeno rápidamente a tus músculos.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* STEP 6: Plan Generado & Activación / Editor */}
      {step === 6 && (
        <div className="flex flex-col gap-6">
          {/* Validation Warnings / Algorithmic Feedback (Hito 2) */}
          {warnings.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 shadow-card">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                <Sparkles className="size-4" />
                Observaciones del Validador Algorítmico ({warnings.length})
              </div>
              <ul className="flex flex-col gap-1.5 pl-4 list-disc text-xs text-amber-100/90">
                {warnings.map((w, idx) => (
                  <li key={idx}>
                    <span className="font-semibold uppercase text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 mr-1.5">
                      {w.severity}
                    </span>
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Plan Summary Hero Card */}
          <Card className="p-6 bg-card border-border/80 shadow-card rounded-3xl text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Plan generado exitosamente
                </span>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Nombre de tu plan"
                  className="text-lg sm:text-xl font-extrabold bg-surface-container-high/60 border-border text-white h-11 rounded-xl px-3"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card gap-2 h-12 px-6 rounded-2xl cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4 stroke-[3]" />
                  )}
                  <span>{editId ? "Guardar Cambios" : "Guardar y Activar Plan"}</span>
                </Button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
              <div className="flex flex-col p-3 rounded-xl bg-surface-container-high/50 border border-border/60">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Distancia Objetivo
                </span>
                <span className="text-base font-extrabold text-white">
                  {formatDistance(targetKm)}
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-surface-container-high/50 border border-border/60">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Duración
                </span>
                <span className="text-base font-extrabold text-white">
                  {draft.phases.reduce((acc, p) => acc + p.weeks.length, 0) || numWeeks} Semanas
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-surface-container-high/50 border border-border/60">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Frecuencia
                </span>
                <span className="text-base font-extrabold text-white">
                  {selectedDays.length} días/sem
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-surface-container-high/50 border border-border/60">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Ritmo Rodaje
                </span>
                <span className="text-base font-extrabold text-primary font-mono">
                  {calculatedPaces.easyMin}/km
                </span>
              </div>
              <div className="flex flex-col p-3 rounded-xl bg-surface-container-high/50 border border-border/60">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                  Meta Estimada
                </span>
                <span className="text-base font-extrabold text-primary font-mono">
                  ~{formatTime(projectedTargetSec)}
                </span>
              </div>
            </div>
          </Card>

          {/* Weekly Volume Chart */}
          <Card className="p-4 bg-card/90 border-border shadow-card text-white">
            <CardHeader className="p-0 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <TrendingUp className="size-4 text-primary" />
                Carga de Volumen Semanal Calculada (Km)
              </CardTitle>
              <Badge
                variant="outline"
                className="text-xs font-bold border-primary/30 text-primary"
              >
                VDOT {calculatedVdot || 35} ·{" "}
                {draft.phases.reduce((acc, p) => acc + p.weeks.length, 0)}{" "}
                Semanas
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex items-end gap-1.5 h-28 pt-4 pb-2 px-2 overflow-x-auto">
                {weeklyKmStats.map((st) => {
                  const barHeightPct = (st.totalKm / maxWeeklyKm) * 100
                  return (
                    <div
                      key={st.weekNum}
                      className="flex flex-col items-center gap-1 flex-1 min-w-[20px] group relative"
                    >
                      <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        {st.totalKm}
                      </span>
                      <div className="w-full bg-surface-container-high rounded-t-md overflow-hidden h-20 flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-primary/70 to-primary group-hover:brightness-110 transition-all rounded-t-md"
                          style={{ height: `${Math.max(5, barHeightPct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        S{st.weekNum}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Toggle Button for Detailed Blocks Editor */}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFullEditor(!showFullEditor)}
              className="gap-2 border-border text-white hover:bg-surface-container-high rounded-xl cursor-pointer"
            >
              <SlidersHorizontal className="size-4" />
              <span>
                {showFullEditor
                  ? "Ocultar editor detallado de sesiones"
                  : "Personalizar fases, sesiones y bloques en detalle"}
              </span>
              {showFullEditor ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </div>

          {/* Phases & Weeks Unified Editor */}
          {showFullEditor && (
            <div className="flex flex-col gap-4">
            {draft.phases.map((phase, pIdx) => {
              const phaseColor =
                PHASE_COLORS[phase.color as PhaseColor] ?? PHASE_COLORS.emerald
              return (
                <div
                  key={pIdx}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card/90 p-4 shadow-card"
                >
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-3 rounded-full shrink-0",
                          phaseColor.bar,
                        )}
                      />
                      <Input
                        value={phase.name}
                        onChange={(e) => {
                          const newPhases = [...draft.phases]
                          newPhases[pIdx].name = e.target.value
                          setDraft({ ...draft, phases: newPhases })
                        }}
                        className="font-bold text-sm h-8 w-72 bg-surface-container-high/80 text-white border-border focus:border-primary rounded-lg px-2.5"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      Semanas {phase.start_week}–{phase.end_week}
                    </span>
                  </div>

                  {/* Weeks list inside phase */}
                  <div className="flex flex-col gap-3">
                    {phase.weeks.map((week, wIdx) => (
                      <div
                        key={wIdx}
                        className="rounded-xl border border-border bg-surface-container-high/40 p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-white">
                            Semana {week.number} (
                            {formatShortDate(week.start_date)} -{" "}
                            {formatShortDate(week.end_date)})
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            Total:{" "}
                            {formatDistance(
                              week.workouts.reduce(
                                (acc, w) => acc + (w.distance_km || 0),
                                0,
                              ),
                            )}
                          </span>
                        </div>

                        {/* Workouts Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                          {week.workouts.map((workout, wkIdx) => {
                            const typeMeta =
                              WORKOUT_TYPE_META[workout.type] ??
                              WORKOUT_TYPE_META.easy_run
                            const updateWorkout = (
                              patch: Partial<WorkoutDraft>,
                            ) => {
                              const newPhases = [...draft.phases]
                              Object.assign(
                                newPhases[pIdx].weeks[wIdx].workouts[wkIdx],
                                patch,
                              )
                              setDraft({ ...draft, phases: newPhases })
                            }
                            return (
                              <div
                                key={wkIdx}
                                className="flex flex-col gap-2 p-2.5 rounded-xl border border-border bg-card/90 text-xs shadow-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground font-semibold">
                                    {formatShortDate(workout.date)}
                                  </span>
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                                      typeMeta.badgeClass,
                                    )}
                                  >
                                    {typeMeta.label}
                                  </span>
                                </div>

                                <Select
                                  value={workout.type}
                                  onValueChange={(val) => {
                                    const t = val as WorkoutType
                                    updateWorkout({
                                      type: t,
                                      name:
                                        WORKOUT_TYPE_META[t]?.label ??
                                        workout.name,
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-xs font-bold px-2 py-1 bg-surface-container-high border-border text-white focus:border-primary rounded-lg">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border text-white">
                                    {Object.entries(WORKOUT_TYPE_META).map(
                                      ([key, meta]) => (
                                        <SelectItem key={key} value={key}>
                                          {meta.label}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>

                                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                                  <span>Distancia:</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateWorkout({
                                          distance_km: Math.max(
                                            0,
                                            Math.round(
                                              ((workout.distance_km ?? 0) -
                                                0.5) *
                                                10,
                                            ) / 10,
                                          ),
                                        })
                                      }
                                      className="size-6 rounded-md bg-surface-container-high border border-border text-muted-foreground hover:text-white flex items-center justify-center shrink-0"
                                      aria-label="Bajar distancia"
                                    >
                                      <Minus className="size-3" />
                                    </button>
                                    <Input
                                      type="number"
                                      step="0.5"
                                      value={workout.distance_km ?? ""}
                                      onChange={(e) =>
                                        updateWorkout({
                                          distance_km: e.target.value
                                            ? parseFloat(e.target.value)
                                            : null,
                                        })
                                      }
                                      className="h-6 text-xs w-14 px-1.5 py-0 bg-surface-container-high border-border text-white font-extrabold focus:border-primary rounded-lg"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateWorkout({
                                          distance_km:
                                            Math.round(
                                              ((workout.distance_km ?? 0) +
                                                0.5) *
                                                10,
                                            ) / 10,
                                        })
                                      }
                                      className="size-6 rounded-md bg-surface-container-high border border-border text-muted-foreground hover:text-white flex items-center justify-center shrink-0"
                                      aria-label="Subir distancia"
                                    >
                                      <Plus className="size-3" />
                                    </button>
                                    <span className="text-[10px] text-muted-foreground">
                                      km
                                    </span>
                                  </div>
                                </div>

                                {workout.blocks.length > 0 && (
                                  <span className="text-[10px] text-primary font-display truncate font-medium">
                                    ✓ {summarizeBlocks(workout.blocks)}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-border text-muted-foreground"
              onClick={() => setStep(5)}
            >
              Volver al Asistente
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card gap-2 px-4 sm:px-6 py-4 sm:py-5 text-sm sm:text-base"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              <span>
                {editId ? "Guardar Cambios" : "Confirmar y Guardar Plan"}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
