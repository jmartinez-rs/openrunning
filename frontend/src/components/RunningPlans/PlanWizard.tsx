import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  Activity,
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Flag,
  Footprints,
  Gauge,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  TrendingUp,
  Trophy,
  Wand2,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  ActivitiesService,
  AnalyticsService,
  type RacePublic,
  RacesService,
  type RunningPlanCreate,
  type RunningPlanPublic,
  RunningPlansService,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  formatShortDate,
  type Intensity,
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

interface PlanDraft {
  name: string
  goal: string
  distance_km: number | null
  distance_unit: "km" | "mi"
  target_time_seconds: number | null
  target_pace_seconds_per_km: number | null
  start_date: string
  end_date: string
  status: PlanStatus
  race_id: string | null
  notes: string
  phases: PhaseDraft[]
}

const ONBOARDING_STEPS = [
  { id: 1, title: "1. Objetivo Principal", desc: "Tipo de plan y distancia" },
  { id: 2, title: "2. Nivel & VDOT", desc: "Marca reciente y ritmos" },
  { id: 3, title: "3. Volumen Actual", desc: "Kilometraje habitual" },
  { id: 4, title: "4. Disponibilidad", desc: "Frecuencia y Tirada Larga" },
  {
    id: 5,
    title: "5. Motor Algorítmico",
    desc: "Generar plan con estructurado",
  },
] as const

const DAYS_OF_WEEK = [
  { id: 1, label: "Lunes", short: "L" },
  { id: 2, label: "Martes", short: "M" },
  { id: 3, label: "Miércoles", short: "X" },
  { id: 4, label: "Jueves", short: "J" },
  { id: 5, label: "Viernes", short: "V" },
  { id: 6, label: "Sábado", short: "S" },
  { id: 0, label: "Domingo", short: "D" },
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
    status: "active",
    race_id: null,
    notes: "",
    phases: [],
  }
}

function publicToDraft(plan: RunningPlanPublic): PlanDraft {
  return {
    name: plan.name,
    goal: plan.goal ?? "",
    distance_km: plan.distance_km,
    distance_unit: plan.distance_unit === "mi" ? "mi" : "km",
    target_time_seconds: plan.target_time_seconds,
    target_pace_seconds_per_km: plan.target_pace_seconds_per_km,
    start_date: plan.start_date,
    end_date: plan.end_date ?? "",
    status: plan.status,
    race_id: plan.race_id,
    notes: plan.notes ?? "",
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

function buildPayload(draft: PlanDraft): RunningPlanCreate {
  return {
    name: draft.name.trim(),
    goal: draft.goal.trim() || null,
    distance_km: draft.distance_km,
    distance_unit: draft.distance_unit,
    target_time_seconds: draft.target_time_seconds,
    target_pace_seconds_per_km: draft.target_pace_seconds_per_km,
    start_date: draft.start_date,
    end_date: draft.end_date || null,
    status: draft.status,
    race_id: draft.race_id,
    notes: draft.notes.trim() || null,
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

function generatePlanStructure({
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
  const calculatedEndDate = addDaysToIso(startDateISO, numWeeks * 7 - 1)

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

  // Sorted days ensuring longRunDay is handled
  const sortedDays = [...selectedDays].sort((a, b) => {
    const orderA = a === longRunDay ? 99 : a === 0 ? 7 : a
    const orderB = b === longRunDay ? 99 : b === 0 ? 7 : b
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
      const weekMonday = addDaysToIso(startDateISO, (wNum - 1) * 7)
      const weekSunday = addDaysToIso(weekMonday, 6)

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
        // El offset se calcula respecto al día real en que arranca la semana
        // (startDateISO), no asumiendo que arranca lunes. Así el día de fondo
        // cae en el día elegido aunque el plan arranque a mitad de semana.
        const weekStartDay = new Date(`${weekMonday}T12:00:00`).getDay()
        const offset = (dayId - weekStartDay + 7) % 7
        const workoutDate = addDaysToIso(weekMonday, offset)

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
              ? `Día de Carrera Objetivo (${targetKm} km)`
              : `Tirada Larga de Fondo (${weekLongKm} km)`
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
          objective: `${name} (${distKm} km @ ${mathFormatPace(targetPace)}/km)`,
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
        start_date: weekMonday,
        end_date: weekSunday,
        name: `Semana ${wNum}`,
        objective: `Volumen semana: ~${workouts.reduce((acc, curr) => acc + (curr.distance_km || 0), 0)} km`,
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
      `Completar ${targetKm} km en ${formatTime(predictedFinishSec)} (${mathFormatPace(predictedPaceSec)}/km)`,
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

  const [step, setStep] = useState<number>(1)
  const [draft, setDraft] = useState<PlanDraft>(createEmptyDraft)

  // Questionnaire / Onboarding state (wizard style)
  const [planType, setPlanType] = useState<string>("race")
  const [targetKm, setTargetKm] = useState<number>(21.1)
  const [numWeeks, setNumWeeks] = useState<number>(12)
  const [userLevel, setUserLevel] = useState<string>("intermediate")
  const [refDistanceKm, setRefDistanceKm] = useState<number>(5)
  const [refTimeInput, setRefTimeInput] = useState<string>("00:24:30")
  const [currentWeeklyKm, setCurrentWeeklyKm] = useState<number | "">("")
  const [longestRunKm, setLongestRunKm] = useState<number | "">("")
  const [selectedDays, setSelectedDays] = useState<number[]>([2, 4, 6, 0]) // Tue, Thu, Sat, Sun
  const [longRunDay, setLongRunDay] = useState<number>(0) // Sunday

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
      setRefTimeInput(formatTime(best))
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

  const handleGeneratePlan = () => {
    if (selectedDays.length === 0) {
      showErrorToast("Seleccioná al menos 1 día de entrenamiento")
      return
    }

    const generated = generatePlanStructure({
      draft,
      planType,
      targetKm,
      numWeeks,
      userLevel,
      refDistanceKm,
      refTimeSeconds,
      currentWeeklyKm: currentWeeklyKm === "" ? 0 : currentWeeklyKm,
      longestRunKm: longestRunKm === "" ? 0 : longestRunKm,
      selectedDays,
      longRunDay,
    })

    setDraft(generated)
    showSuccessToast("¡Algoritmo ejecutado! Plan generado con bloques exactos.")
    setStep(6) // Jump to Unified Editor & Preview
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
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="bg-card border border-border text-muted-foreground hover:text-white hover:bg-surface-container-high rounded-xl"
            asChild
          >
            <Link to="/routines">
              <ArrowLeft className="size-5" />
            </Link>
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
              Respondé las preguntas clave y el algoritmo calculará
              matemáticamente tus cargas, ritmos y bloques.
            </p>
          </div>
        </div>

        {step === 6 && (
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
        )}
      </div>

      {/* Step Indicator Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-border pb-4">
        {ONBOARDING_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              "flex flex-col gap-1 p-2.5 rounded-xl text-left border transition-all duration-200 cursor-pointer",
              step === s.id
                ? "border-primary/60 bg-primary/15 text-primary shadow-sm"
                : "border-border bg-card/80 text-muted-foreground hover:bg-surface-container-high hover:text-white",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-container-high text-muted-foreground border border-border",
                )}
              >
                {s.id}
              </span>
              {step > s.id && <Check className="size-3.5 text-primary" />}
            </div>
            <span className="font-bold text-xs truncate">{s.title}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: Objetivo Principal */}
      {step === 1 && (
        <Card className="p-6 bg-card border-border shadow-card rounded-2xl">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Trophy className="size-5 text-primary" />
              1. Tu Objetivo Principal
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Plan Type Cards */}
            <div className="flex flex-col gap-3">
              <Label className="font-semibold text-xs text-muted-foreground">
                ¿Cuál es tu tipo de objetivo?
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    id: "race",
                    title: "Carrera Oficial",
                    desc: "Preparar un evento oficial con fecha límite",
                    icon: Trophy,
                  },
                  {
                    id: "distance",
                    title: "Cubrir Distancia",
                    desc: "Superar 5K, 10K, 15K, 21K o 42K por tu cuenta",
                    icon: Flag,
                  },
                  {
                    id: "faster",
                    title: "Mejorar Marca",
                    desc: "Aumentar velocidad y bajar tiempos",
                    icon: Zap,
                  },
                  {
                    id: "beginner",
                    title: "Empezar a Correr",
                    desc: "Plan desde cero para ganar hábito y resistencia",
                    icon: Footprints,
                  },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setPlanType(type.id)}
                    className={cn(
                      "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all cursor-pointer",
                      planType === type.id
                        ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                        : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high hover:border-border",
                    )}
                  >
                    <type.icon
                      className={cn(
                        "size-6",
                        planType === type.id
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {type.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Distance Target Selection */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Distancia Objetivo
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "5K", km: 5 },
                  { label: "10K", km: 10 },
                  { label: "15K", km: 15 },
                  { label: "21.1K (Media Maratón)", km: 21.1 },
                  { label: "42.2K (Maratón)", km: 42.2 },
                  { label: "50K (Ultra)", km: 50 },
                ].map((d) => (
                  <button
                    key={d.km}
                    type="button"
                    onClick={() => {
                      setTargetKm(d.km)
                      setDraft({ ...draft, distance_km: d.km })
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      targetKm === d.km
                        ? "bg-primary/20 text-primary border-primary/60 shadow-xs"
                        : "bg-surface-container-high/60 text-muted-foreground border-border hover:bg-surface-container-high hover:text-white",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Duration / Race Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              {planType === "race" && (
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="race-select"
                    className="font-semibold text-xs text-muted-foreground"
                  >
                    Carrera Objetivo Guardada
                  </Label>
                  <Select
                    value={draft.race_id ?? "none"}
                    onValueChange={(val) =>
                      setDraft({
                        ...draft,
                        race_id: val === "none" ? null : val,
                      })
                    }
                  >
                    <SelectTrigger
                      id="race-select"
                      className="bg-surface-container-high border-border text-white rounded-xl"
                    >
                      <SelectValue placeholder="Seleccionar de tus carreras" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-white">
                      <SelectItem
                        value="none"
                        className="focus:bg-surface-container-high focus:text-primary text-foreground"
                      >
                        Sin carrera vinculada
                      </SelectItem>
                      {(racesQuery.data?.data ?? []).map((r: RacePublic) => (
                        <SelectItem
                          key={r.id}
                          value={r.id}
                          className="focus:bg-surface-container-high focus:text-primary text-foreground"
                        >
                          {r.event_name} ({r.distance_km} km)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="num-weeks-select"
                  className="font-semibold text-xs text-muted-foreground"
                >
                  Duración del Bloque (Semanas)
                </Label>
                <Select
                  value={numWeeks.toString()}
                  onValueChange={(val) => setNumWeeks(parseInt(val, 10))}
                >
                  <SelectTrigger
                    id="num-weeks-select"
                    className="bg-surface-container-high border-border text-white rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-white">
                    <SelectItem
                      value="6"
                      className="focus:bg-surface-container-high focus:text-primary text-foreground"
                    >
                      6 Semanas (Expreso)
                    </SelectItem>
                    <SelectItem
                      value="8"
                      className="focus:bg-surface-container-high focus:text-primary text-foreground"
                    >
                      8 Semanas (Corto)
                    </SelectItem>
                    <SelectItem
                      value="12"
                      className="focus:bg-surface-container-high focus:text-primary text-foreground"
                    >
                      12 Semanas (Recomendado)
                    </SelectItem>
                    <SelectItem
                      value="16"
                      className="focus:bg-surface-container-high focus:text-primary text-foreground"
                    >
                      16 Semanas (Maratón 42K)
                    </SelectItem>
                    <SelectItem
                      value="20"
                      className="focus:bg-surface-container-high focus:text-primary text-foreground"
                    >
                      20 Semanas (Ultra / Bloque Extendido)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => setStep(2)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20 rounded-xl cursor-pointer"
              >
                <span>Siguiente: Nivel & Ritmos VDOT</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Nivel & Marca Reciente (Cálculo VDOT en vivo) */}
      {step === 2 && (
        <Card className="p-6 bg-card/90 border-border shadow-card text-white">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Gauge className="size-5 text-primary" />
              2. Nivel Actual & Calculadora VDOT (Dato Clave)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Level selection */}
            <div className="flex flex-col gap-3">
              <Label className="font-semibold text-sm text-muted-foreground">
                Tu Nivel Auto-Percibido
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "beginner", label: "Principiante" },
                  { id: "intermediate", label: "Intermedio" },
                  { id: "advanced", label: "Avanzado" },
                  { id: "elite", label: "Élite" },
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setUserLevel(lvl.id)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-center font-bold text-xs transition-all",
                      userLevel === lvl.id
                        ? "bg-primary/20 text-primary border-primary/60 shadow-xs"
                        : "bg-surface-container-high/60 text-muted-foreground border-border hover:bg-surface-container-high hover:text-white",
                    )}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Performance Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="ref-dist"
                  className="font-semibold text-muted-foreground"
                >
                  Distancia de Referencia Reciente
                </Label>
                <Select
                  value={refDistanceKm.toString()}
                  onValueChange={(val) => {
                    setRefDistanceKm(parseFloat(val))
                    refTimeEdited.current = false
                  }}
                >
                  <SelectTrigger
                    id="ref-dist"
                    className="bg-surface-container-high/80 border-border text-white"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-white">
                    <SelectItem value="5">5K Reciente</SelectItem>
                    <SelectItem value="10">10K Reciente</SelectItem>
                    <SelectItem value="15">15K Reciente</SelectItem>
                    <SelectItem value="21.1">21.1K (Media Maratón)</SelectItem>
                    <SelectItem value="42.2">42.2K (Maratón)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="ref-time"
                  className="font-semibold text-muted-foreground"
                >
                  Mejor Tiempo Reciente (hh:mm:ss o mm:ss)
                </Label>
                <Input
                  id="ref-time"
                  placeholder="00:24:30"
                  value={refTimeInput}
                  onChange={(e) => {
                    refTimeEdited.current = true
                    setRefTimeInput(e.target.value)
                  }}
                  className="bg-surface-container-high/80 border-border text-white font-display"
                />
                {bestTimeForRef ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRefTimeInput(formatTime(bestTimeForRef))
                      refTimeEdited.current = true
                    }}
                    className="inline-flex items-center gap-1 self-start text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1 hover:bg-primary/20 transition-colors"
                  >
                    <Sparkles className="size-3" />
                    Usar mi mejor marca ({formatTime(bestTimeForRef)})
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Sin marca registrada para esta distancia — escribila
                    manualmente.
                  </p>
                )}
              </div>
            </div>

            {/* Calculated VDOT Live Preview Card */}
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground font-extrabold text-xs">
                    VDOT: {calculatedVdot}
                  </Badge>
                  <span className="text-xs font-bold text-white">
                    Ritmos de Entrenamiento Calculados por Algoritmo (Jack
                    Daniels)
                  </span>
                </div>

                <Badge
                  variant="outline"
                  className="text-xs border-primary/40 text-primary"
                >
                  {refDistanceKm}K en {formatTime(refTimeSeconds)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="flex flex-col p-2.5 rounded-lg border border-border bg-card/80">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Rodaje Suave (Z2)
                  </span>
                  <span className="text-sm font-extrabold text-primary">
                    {calculatedPaces.easyMin} - {calculatedPaces.easyMax} /km
                  </span>
                </div>

                <div className="flex flex-col p-2.5 rounded-lg border border-border bg-card/80">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Ritmo Tempo (Umbral)
                  </span>
                  <span className="text-sm font-extrabold text-primary">
                    {calculatedPaces.threshold} /km
                  </span>
                </div>

                <div className="flex flex-col p-2.5 rounded-lg border border-border bg-card/80">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Intervalos (VO2 Max)
                  </span>
                  <span className="text-sm font-extrabold text-primary">
                    {calculatedPaces.interval} /km
                  </span>
                </div>

                <div className="flex flex-col p-2.5 rounded-lg border border-border bg-card/80">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Objetivo {targetKm}K (Riegel)
                  </span>
                  <span className="text-sm font-extrabold text-primary">
                    {formatTime(predictedRaceSec)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground"
                onClick={() => setStep(1)}
              >
                Atrás
              </Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                <span>Siguiente: Volumen Actual</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Volumen Actual & Antecedentes */}
      {step === 3 && (
        <Card className="p-6 bg-card/90 border-border shadow-card text-white">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Activity className="size-5 text-primary" />
              3. Volumen Semanal Actual & Prevención de Lesiones
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <Label
                  htmlFor="current-weekly"
                  className="font-semibold text-muted-foreground"
                >
                  Kilometraje Semanal Promedio Actual
                </Label>
                <Input
                  id="current-weekly"
                  type="number"
                  min="0"
                  placeholder="Ej: 25"
                  value={currentWeeklyKm}
                  onChange={(e) => {
                    volumeEdited.current = true
                    const value = e.target.value
                    setCurrentWeeklyKm(
                      value === "" ? "" : Math.max(0, parseInt(value, 10) || 0),
                    )
                  }}
                  className="font-extrabold text-base bg-surface-container-high/80 border-border text-white"
                />
                <p className="text-xs text-muted-foreground">
                  El algoritmo usará este dato para que el volumen de la Semana
                  1 no supere un incremento del 10-15%.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Label
                  htmlFor="longest-run"
                  className="font-semibold text-muted-foreground"
                >
                  Tirada Más Larga Reciente del Último Mes
                </Label>
                <Input
                  id="longest-run"
                  type="number"
                  min="0"
                  placeholder="Ej: 12"
                  value={longestRunKm}
                  onChange={(e) => {
                    longestEdited.current = true
                    const value = e.target.value
                    setLongestRunKm(
                      value === "" ? "" : Math.max(0, parseInt(value, 10) || 0),
                    )
                  }}
                  className="font-extrabold text-base bg-surface-container-high/80 border-border text-white"
                />
                <p className="text-xs text-muted-foreground">
                  Permite escalar la distancia de la tirada larga del fin de
                  semana progresivamente.
                </p>
              </div>
            </div>

            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground"
                onClick={() => setStep(2)}
              >
                Atrás
              </Button>
              <Button
                type="button"
                onClick={() => setStep(4)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                <span>Siguiente: Disponibilidad Semanal</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Disponibilidad Semanal & Tirada Larga */}
      {step === 4 && (
        <Card className="p-6 bg-card/90 border-border shadow-card text-white">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Calendar className="size-5 text-primary" />
              4. Disponibilidad Semanal & Días de Entrenamiento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Days Selection */}
            <div className="flex flex-col gap-3">
              <Label className="font-semibold text-sm text-muted-foreground">
                Seleccioná los Días en los que Podés Salir a Correr
              </Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = selectedDays.includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={cn(
                        "flex flex-col items-center justify-center size-14 rounded-xl border transition-all font-bold text-sm",
                        isSelected
                          ? "bg-primary/20 text-primary border-primary/60 shadow-xs"
                          : "bg-surface-container-high/60 text-muted-foreground border-border hover:bg-surface-container-high hover:text-white",
                      )}
                    >
                      <span>{d.short}</span>
                      <span className="text-[10px] font-normal opacity-80">
                        {d.label.slice(0, 3)}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Seleccionaste {selectedDays.length} días por semana.
              </p>
            </div>

            {/* Long Run Day selector */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label
                htmlFor="long-run-day"
                className="font-semibold text-muted-foreground"
              >
                Día Preferido para la Tirada Larga (Fondo)
              </Label>
              <Select
                value={longRunDay.toString()}
                onValueChange={(val) => setLongRunDay(parseInt(val, 10))}
              >
                <SelectTrigger
                  id="long-run-day"
                  className="w-64 bg-surface-container-high/80 border-border text-white"
                >
                  <SelectValue placeholder="Elegí un día" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-white">
                  {selectedDays.length === 0 ? (
                    <SelectItem value={longRunDay.toString()} disabled>
                      Seleccioná días de entrenamiento
                    </SelectItem>
                  ) : (
                    [...selectedDays]
                      .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
                      .map((dayId) => (
                        <SelectItem key={dayId} value={dayId.toString()}>
                          {DAYS_OF_WEEK.find((d) => d.id === dayId)?.label ??
                            ""}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground"
                onClick={() => setStep(3)}
              >
                Atrás
              </Button>
              <Button
                type="button"
                onClick={() => setStep(5)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                <span>Siguiente: Resumen & Algoritmo</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Resumen & Motor Algorítmico */}
      {step === 5 && (
        <Card className="p-6 border-primary/40 bg-card/90 shadow-card text-white">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2 text-white">
              <Sparkles className="size-6 text-primary animate-pulse" />
              5. Generar Plan Completo con Algoritmo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-container-high/60 border border-border">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  Distancia & Bloque
                </span>
                <span className="font-extrabold text-white">
                  {targetKm} km en {numWeeks} Semanas
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  Puntaje VDOT & Ritmos
                </span>
                <span className="font-extrabold text-primary">
                  VDOT {calculatedVdot} ({calculatedPaces.easyMin} -{" "}
                  {calculatedPaces.threshold}/km)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  Días Semanales
                </span>
                <span className="font-extrabold text-white">
                  {selectedDays.length} días/sem (Fondo:{" "}
                  {DAYS_OF_WEEK.find((d) => d.id === longRunDay)?.label})
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Button
                type="button"
                onClick={handleGeneratePlan}
                className="w-full max-w-md bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-sm sm:text-base px-4 py-5 rounded-2xl shadow-card transition-all gap-3 cursor-pointer"
              >
                <Wand2 className="size-6 shrink-0" />
                <span className="whitespace-normal text-center">
                  ⚡ Ejecutar Algoritmo & Generar Plan Estructurado
                </span>
              </Button>
              <p className="text-xs text-muted-foreground">
                Cada sesión del plan se creará con sus bloques exactos de
                calentamiento, ritmos objetivo, repeticiones y enfriamiento.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: Editor Unificado & Vista Previa */}
      {step === 6 && (
        <div className="flex flex-col gap-6">
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
                VDOT {calculatedVdot} ·{" "}
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

          {/* Phases & Weeks Unified Editor */}
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
                            {week.workouts.reduce(
                              (acc, w) => acc + (w.distance_km || 0),
                              0,
                            )}{" "}
                            km
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

          <div className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto border-border text-muted-foreground"
              onClick={() => setStep(5)}
            >
              Volver al Cuestionario
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
