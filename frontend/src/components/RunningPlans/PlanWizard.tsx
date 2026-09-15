import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  type RacePublic,
  RacesService,
  type RunningPlanCreate,
  type RunningPlanPublic,
  RunningPlansService,
} from "@/client"
import {
  addDaysToIso,
  BLOCK_TYPE_META,
  type BlockType,
  blocksDistanceKm,
  buildBlockPreview,
  defaultTrainingDates,
  durationInputToSeconds,
  formatDateRange,
  formatDistance,
  formatShortDate,
  INTENSITY_META,
  type Intensity,
  PHASE_COLORS,
  type PhaseColor,
  PLAN_STATUS_META,
  type PlanStatus,
  paceInputToSeconds,
  secondsToDurationInput,
  secondsToPaceInput,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "@/components/RunningPlans/running-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

// ---------------------------------------------------------------------------
// Tipos del draft (espejo de la jerarquía RunningPlan, con inputs de formulario)
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

const STEPS = [
  { title: "Objetivo" },
  { title: "Fases" },
  { title: "Semanas" },
  { title: "Sesiones" },
  { title: "Bloques" },
  { title: "Revisión" },
] as const

const textareaClass =
  "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

function errorInputClass(error?: boolean): string {
  return error ? "border-destructive focus-visible:ring-destructive" : ""
}

function emptyBlock(position: number): BlockDraft {
  return {
    position,
    block_type: "main",
    repeats: 1,
    distance_m: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    pace_range_end_seconds_per_km: null,
    recovery_seconds: null,
    recovery_type: "jog",
    notes: "",
  }
}

function emptyWorkout(): WorkoutDraft {
  return {
    date: "",
    type: "easy_run",
    objective: "",
    name: "",
    distance_km: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    intensity: "easy",
    description: "",
    notes: "",
    cancelled: false,
    status_override: null,
    blocks: [emptyBlock(1)],
  }
}

function defaultWorkoutForDate(date: string): WorkoutDraft {
  return {
    date,
    type: "easy_run",
    objective: "",
    name: "",
    distance_km: null,
    duration_seconds: null,
    pace_seconds_per_km: null,
    intensity: "easy",
    description: "",
    notes: "",
    cancelled: false,
    status_override: null,
    blocks: [],
  }
}

function weekDefaultDates(planStartDate: string, week: WeekDraft): string[] {
  if (week.start_date && week.end_date) {
    return defaultTrainingDates(week.start_date, week.end_date)
  }
  if (!planStartDate) return []
  const monday = addDaysToIso(planStartDate, (week.number - 1) * 7)
  return defaultTrainingDates(monday, addDaysToIso(monday, 6))
}

function prefillWeekSessions(
  planStartDate: string,
  week: WeekDraft,
): WorkoutDraft[] {
  return weekDefaultDates(planStartDate, week).map(defaultWorkoutForDate)
}

function emptyWeek(number: number): WeekDraft {
  return {
    number,
    start_date: "",
    end_date: "",
    name: "",
    objective: "",
    notes: "",
    workouts: [],
  }
}

function emptyPhase(position: number): PhaseDraft {
  return {
    position,
    name: "",
    color: "emerald",
    start_week: 1,
    end_week: 1,
    objective: "",
    description: "",
    weeks: [emptyWeek(1)],
  }
}

function createEmptyDraft(): PlanDraft {
  return {
    name: "",
    goal: "",
    distance_km: null,
    distance_unit: "km",
    target_time_seconds: null,
    target_pace_seconds_per_km: null,
    start_date: "",
    end_date: "",
    status: "planned",
    race_id: null,
    notes: "",
    phases: [emptyPhase(1)],
  }
}

// ---------------------------------------------------------------------------
// Mapeos entre draft y el contrato del cliente (no toca running-utils)
// ---------------------------------------------------------------------------

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
// Validaciones por paso
// ---------------------------------------------------------------------------

function goalStepValid(draft: PlanDraft): boolean {
  return Boolean(
    draft.name.trim() &&
      draft.start_date &&
      (draft.end_date === "" || draft.end_date >= draft.start_date),
  )
}

function phasesStepValid(draft: PlanDraft): boolean {
  return (
    draft.phases.length > 0 &&
    draft.phases.every(
      (phase) =>
        phase.name.trim() &&
        phase.start_week != null &&
        phase.end_week != null &&
        phase.end_week >= phase.start_week,
    )
  )
}

function weeksStepValid(draft: PlanDraft): boolean {
  return (
    draft.phases.length > 0 &&
    draft.phases.every(
      (phase) =>
        phase.weeks.length > 0 &&
        phase.weeks.every((week) => week.number != null && week.number >= 1),
    )
  )
}

function sessionsStepValid(draft: PlanDraft): boolean {
  const seen = new Set<string>()
  for (const phase of draft.phases) {
    for (const week of phase.weeks) {
      for (const workout of week.workouts) {
        if (!workout.date) return false
        if (seen.has(workout.date)) return false
        seen.add(workout.date)
        const hasDistance =
          workout.distance_km != null && workout.distance_km > 0
        const hasDuration =
          workout.duration_seconds != null && workout.duration_seconds > 0
        if (!hasDistance && !hasDuration) return false
      }
    }
  }
  return true
}

function blocksStepValid(draft: PlanDraft): boolean {
  for (const phase of draft.phases) {
    for (const week of phase.weeks) {
      for (const workout of week.workouts) {
        for (const block of workout.blocks) {
          const hasDistance = block.distance_m != null && block.distance_m > 0
          const hasDuration =
            block.duration_seconds != null && block.duration_seconds > 0
          const paceOrderOk =
            block.pace_seconds_per_km == null ||
            block.pace_range_end_seconds_per_km == null ||
            block.pace_range_end_seconds_per_km >= block.pace_seconds_per_km
          if (
            (!hasDistance && !hasDuration) ||
            block.repeats < 1 ||
            !paceOrderOk
          ) {
            return false
          }
        }
      }
    }
  }
  return true
}

interface WorkoutRef {
  phaseIndex: number
  weekIndex: number
  workoutIndex: number
  workout: WorkoutDraft
}

function collectWorkouts(draft: PlanDraft): WorkoutRef[] {
  const out: WorkoutRef[] = []
  draft.phases.forEach((phase, phaseIndex) => {
    phase.weeks.forEach((week, weekIndex) => {
      week.workouts.forEach((workout, workoutIndex) => {
        out.push({ phaseIndex, weekIndex, workoutIndex, workout })
      })
    })
  })
  return out
}

function findDuplicateDates(draft: PlanDraft): Set<string> {
  const counts = new Map<string, number>()
  for (const { workout } of collectWorkouts(draft)) {
    if (!workout.date) continue
    counts.set(workout.date, (counts.get(workout.date) ?? 0) + 1)
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([date]) => date),
  )
}

function suggestWeekNumber(phase: PhaseDraft): number {
  const existing = new Set(phase.weeks.map((week) => week.number))
  const start = Math.max(1, phase.start_week)
  const end = Math.max(start, phase.end_week)
  for (let n = start; n <= end; n += 1) {
    if (!existing.has(n)) return n
  }
  let n = end + 1
  while (existing.has(n)) n += 1
  return n
}

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// ---------------------------------------------------------------------------
// Inputs reutilizables (sin perder la escritura intermedia del usuario)
// ---------------------------------------------------------------------------

function NumberField({
  value,
  onValueChange,
  id,
  className,
  placeholder,
  min,
  step,
}: {
  value: number | null
  onValueChange: (value: number | null) => void
  id?: string
  className?: string
  placeholder?: string
  min?: number
  step?: number | string
}) {
  const [text, setText] = useState(() => (value == null ? "" : String(value)))
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(value == null ? "" : String(value))
      lastEmitted.current = value
    }
  }, [value])

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      className={className}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const parsed = raw.trim() === "" ? null : Number(raw)
        const next = parsed == null || Number.isNaN(parsed) ? null : parsed
        lastEmitted.current = next
        onValueChange(next)
      }}
    />
  )
}

function DurationText({
  value,
  onValueChange,
  id,
  placeholder,
  className,
}: {
  value: number | null
  onValueChange: (value: number | null) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(() => secondsToDurationInput(value))
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(secondsToDurationInput(value))
      lastEmitted.current = value
    }
  }, [value])

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder ?? "hh:mm"}
      className={className}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const next = durationInputToSeconds(raw)
        lastEmitted.current = next
        onValueChange(next)
      }}
    />
  )
}

function PaceText({
  value,
  onValueChange,
  id,
  placeholder,
  className,
}: {
  value: number | null
  onValueChange: (value: number | null) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(() => secondsToPaceInput(value))
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(secondsToPaceInput(value))
      lastEmitted.current = value
    }
  }, [value])

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder={placeholder ?? "mm:ss"}
      className={className}
      value={text}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const next = paceInputToSeconds(raw)
        lastEmitted.current = next
        onValueChange(next)
      }}
    />
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

function NumberStepper({
  value,
  onValueChange,
  step = 1,
  min = 0,
  placeholder,
  className,
}: {
  value: number | null
  onValueChange: (value: number | null) => void
  step?: number
  min?: number
  placeholder?: string
  className?: string
}) {
  const base = value ?? min
  const round2 = (n: number) => Math.round(n * 100) / 100
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Disminuir"
        disabled={base <= min}
        onClick={() => onValueChange(round2(Math.max(min, base - step)))}
      >
        <Minus className="size-3.5" />
      </Button>
      <NumberField
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        min={min}
        step={String(step)}
        className={className}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Aumentar"
        onClick={() => onValueChange(round2(base + step))}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

function DurationStepper({
  value,
  onValueChange,
  stepMinutes = 5,
  className,
}: {
  value: number | null
  onValueChange: (value: number | null) => void
  stepMinutes?: number
  className?: string
}) {
  const stepSeconds = stepMinutes * 60
  const base = value ?? 0
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Disminuir"
        disabled={value != null && value <= 0}
        onClick={() => onValueChange(Math.max(0, base - stepSeconds))}
      >
        <Minus className="size-3.5" />
      </Button>
      <DurationText
        value={value}
        onValueChange={onValueChange}
        className={className}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Aumentar"
        onClick={() => onValueChange(base + stepSeconds)}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}

function IntervalBuilder({
  onAdd,
}: {
  onAdd: (data: Partial<BlockDraft>) => void
}) {
  const [reps, setReps] = useState(5)
  const [distanceM, setDistanceM] = useState(1000)
  const [paceStart, setPaceStart] = useState<number | null>(null)
  const [paceEnd, setPaceEnd] = useState<number | null>(null)
  const [recoveryMin, setRecoveryMin] = useState(2)
  const [recoveryType, setRecoveryType] = useState<"jog" | "walk">("jog")

  const paceOrderError =
    paceStart != null && paceEnd != null && paceEnd < paceStart
  const canAdd = reps >= 1 && distanceM > 0 && !paceOrderError

  const preview = buildBlockPreview({
    block_type: "interval",
    repeats: reps,
    distance_m: distanceM,
    pace_seconds_per_km: paceStart,
    pace_range_end_seconds_per_km: paceEnd,
    recovery_seconds: recoveryMin > 0 ? recoveryMin * 60 : null,
    recovery_type: recoveryType,
  })

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
        Agregar intervalo
      </p>
      <div className="grid gap-3 sm:grid-cols-6">
        <Field label="Reps">
          <NumberStepper
            value={reps}
            step={1}
            min={1}
            onValueChange={(value) => setReps(value ?? 1)}
          />
        </Field>
        <Field label="Distancia (m)">
          <NumberStepper
            value={distanceM}
            step={100}
            min={0}
            onValueChange={(value) => setDistanceM(value ?? 0)}
          />
        </Field>
        <Field label="Ritmo" hint="mm:ss">
          <PaceText
            value={paceStart}
            onValueChange={setPaceStart}
            className={errorInputClass(paceOrderError)}
          />
        </Field>
        <Field label="Ritmo máximo" hint="mm:ss">
          <PaceText
            value={paceEnd}
            onValueChange={setPaceEnd}
            className={errorInputClass(paceOrderError)}
          />
        </Field>
        <Field label="Recuperación (min)">
          <NumberStepper
            value={recoveryMin}
            step={0.5}
            min={0}
            onValueChange={(value) => setRecoveryMin(value ?? 0)}
          />
        </Field>
        <Field label="Recuperación tipo">
          <Select
            value={recoveryType}
            onValueChange={(value) => setRecoveryType(value as "jog" | "walk")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jog">Trotando</SelectItem>
              <SelectItem value="walk">Caminando</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {paceOrderError && (
        <p className="mt-2 text-xs text-destructive">
          El ritmo máximo debe ser mayor o igual al ritmo inicial.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/10 bg-primary/5 px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Vista previa
        </span>
        <span className="text-sm font-medium">{preview}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={!canAdd}
        onClick={() =>
          onAdd({
            block_type: "interval",
            repeats: reps,
            distance_m: distanceM,
            duration_seconds: null,
            pace_seconds_per_km: paceStart,
            pace_range_end_seconds_per_km: paceEnd,
            recovery_seconds: recoveryMin > 0 ? recoveryMin * 60 : null,
            recovery_type: recoveryType,
          })
        }
      >
        <Plus className="mr-1 size-3" /> Agregar intervalo
      </Button>
    </div>
  )
}

function Stepper({
  current,
  onSelect,
}: {
  current: number
  onSelect: (index: number) => void
}) {
  return (
    <nav
      aria-label="Pasos del asistente"
      className="flex items-center gap-1 overflow-x-auto pb-2 sm:gap-2"
    >
      {STEPS.map((step, index) => {
        const done = index < current
        const active = index === current
        const clickable = index <= current
        return (
          <div
            key={step.title}
            className="flex shrink-0 items-center gap-1 sm:gap-2"
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(index)}
              aria-current={active ? "step" : undefined}
              aria-label={`Paso ${index + 1}: ${step.title}${done ? " (completado)" : ""}`}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition sm:gap-2 sm:px-3",
                active
                  ? "bg-primary/10 text-primary"
                  : clickable
                    ? "hover:bg-accent"
                    : "hover:bg-transparent",
                !clickable && "cursor-not-allowed opacity-60",
                index > current && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary/15 text-primary ring-1 ring-primary/20"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="hidden whitespace-nowrap sm:inline">
                {step.title}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 sm:w-6",
                  index < current ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Paso 1: Objetivo
// ---------------------------------------------------------------------------

function ObjectiveStep({
  draft,
  races,
  onUpdate,
}: {
  draft: PlanDraft
  races: RacePublic[]
  onUpdate: (patch: Partial<PlanDraft>) => void
}) {
  const selectedRace = races.find((race) => race.id === draft.race_id) ?? null
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Nombre *"
        htmlFor="plan-name"
        className="sm:col-span-2"
        error={!draft.name.trim() ? "El nombre es obligatorio." : undefined}
      >
        <Input
          id="plan-name"
          value={draft.name}
          className={errorInputClass(!draft.name.trim())}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Ej: Plan 10K Sub-60"
        />
      </Field>
      <Field label="Objetivo" className="sm:col-span-2">
        <textarea
          className={cn(textareaClass, "min-h-20")}
          value={draft.goal}
          onChange={(e) => onUpdate({ goal: e.target.value })}
          placeholder="Ej: Correr 10K en menos de 60 minutos"
        />
      </Field>
      <Field label="Distancia objetivo" htmlFor="plan-distance">
        <NumberStepper
          value={draft.distance_km}
          onValueChange={(value) => onUpdate({ distance_km: value })}
          placeholder="10"
          step={0.5}
          min={0}
        />
      </Field>
      <Field label="Unidad">
        <Select
          value={draft.distance_unit}
          onValueChange={(value) =>
            onUpdate({ distance_unit: value as "km" | "mi" })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="km">km</SelectItem>
            <SelectItem value="mi">mi</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Tiempo objetivo"
        htmlFor="plan-target-time"
        hint="Formato hh:mm"
      >
        <DurationStepper
          value={draft.target_time_seconds}
          onValueChange={(value) => onUpdate({ target_time_seconds: value })}
          stepMinutes={5}
        />
      </Field>
      <Field
        label="Ritmo objetivo"
        htmlFor="plan-target-pace"
        hint="Formato mm:ss por km"
      >
        <PaceText
          id="plan-target-pace"
          value={draft.target_pace_seconds_per_km}
          onValueChange={(value) =>
            onUpdate({ target_pace_seconds_per_km: value })
          }
        />
      </Field>
      <Field
        label="Fecha inicio *"
        htmlFor="plan-start"
        error={
          !draft.start_date ? "La fecha de inicio es obligatoria." : undefined
        }
      >
        <Input
          id="plan-start"
          type="date"
          value={draft.start_date}
          className={errorInputClass(!draft.start_date)}
          onChange={(e) => onUpdate({ start_date: e.target.value })}
        />
      </Field>
      <Field
        label="Fecha cierre"
        htmlFor="plan-end"
        error={
          draft.end_date &&
          draft.start_date &&
          draft.end_date < draft.start_date
            ? "La fecha de cierre debe ser posterior al inicio."
            : undefined
        }
      >
        <Input
          id="plan-end"
          type="date"
          min={draft.start_date || undefined}
          value={draft.end_date}
          className={errorInputClass(
            Boolean(
              draft.end_date &&
                draft.start_date &&
                draft.end_date < draft.start_date,
            ),
          )}
          onChange={(e) => onUpdate({ end_date: e.target.value })}
        />
      </Field>
      <Field label="Estado">
        <Select
          value={draft.status}
          onValueChange={(value) => onUpdate({ status: value as PlanStatus })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PLAN_STATUS_META) as PlanStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {PLAN_STATUS_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Carrera objetivo"
        hint={
          selectedRace
            ? `${formatShortDate(selectedRace.date)} · ${formatDistance(selectedRace.distance_km)}`
            : undefined
        }
      >
        <Select
          value={draft.race_id ?? "none"}
          onValueChange={(value) =>
            onUpdate({ race_id: value === "none" ? null : value })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sin carrera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin carrera</SelectItem>
            {races.map((race) => (
              <SelectItem key={race.id} value={race.id}>
                {race.event_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Notas" className="sm:col-span-2">
        <textarea
          className={cn(textareaClass, "min-h-20")}
          value={draft.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="Opcional"
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paso 2: Fases
// ---------------------------------------------------------------------------

function PhasesStep({
  draft,
  onPhaseChange,
  onAddPhase,
  onRemovePhase,
}: {
  draft: PlanDraft
  onPhaseChange: (index: number, patch: Partial<PhaseDraft>) => void
  onAddPhase: () => void
  onRemovePhase: (index: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {draft.phases.map((phase, index) => {
        const weekRangeError =
          phase.end_week != null &&
          phase.start_week != null &&
          phase.end_week < phase.start_week
        return (
          <Card key={index}>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Fase {index + 1}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Eliminar fase ${index + 1}`}
                disabled={draft.phases.length === 1}
                onClick={() => onRemovePhase(index)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre *"
                className="sm:col-span-2"
                error={
                  !phase.name.trim() ? "El nombre es obligatorio." : undefined
                }
              >
                <Input
                  value={phase.name}
                  className={errorInputClass(!phase.name.trim())}
                  onChange={(e) =>
                    onPhaseChange(index, { name: e.target.value })
                  }
                  placeholder="Ej: Construcción y Velocidad"
                />
              </Field>
              <Field label="Color">
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(PHASE_COLORS) as PhaseColor[]).map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Color ${color}`}
                      aria-pressed={phase.color === color}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition hover:scale-105",
                        PHASE_COLORS[color].bar,
                        phase.color === color
                          ? "border-foreground ring-2 ring-offset-1 ring-foreground/20"
                          : "border-transparent hover:opacity-90",
                      )}
                      onClick={() => onPhaseChange(index, { color })}
                    />
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Semana inicial">
                  <NumberField
                    value={phase.start_week}
                    className={errorInputClass(weekRangeError)}
                    onValueChange={(value) =>
                      onPhaseChange(index, { start_week: value ?? 1 })
                    }
                    min={1}
                  />
                </Field>
                <Field label="Semana final">
                  <NumberField
                    value={phase.end_week}
                    className={errorInputClass(weekRangeError)}
                    onValueChange={(value) =>
                      onPhaseChange(index, { end_week: value ?? 1 })
                    }
                    min={1}
                  />
                </Field>
              </div>
              <Field label="Objetivo" className="sm:col-span-2">
                <Input
                  value={phase.objective}
                  onChange={(e) =>
                    onPhaseChange(index, { objective: e.target.value })
                  }
                  placeholder="Ej: Adaptación a ritmos superiores al objetivo"
                />
              </Field>
              <Field label="Descripción" className="sm:col-span-2">
                <textarea
                  className={cn(textareaClass, "min-h-16")}
                  value={phase.description}
                  onChange={(e) =>
                    onPhaseChange(index, { description: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </Field>
              {weekRangeError && (
                <p className="text-xs text-destructive sm:col-span-2">
                  La semana final debe ser mayor o igual a la inicial.
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
      <Button type="button" variant="outline" onClick={onAddPhase}>
        <Plus className="mr-2 size-4" /> Agregar fase
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paso 3: Semanas
// ---------------------------------------------------------------------------

function WeeksStep({
  draft,
  onWeekChange,
  onAddWeek,
  onRemoveWeek,
}: {
  draft: PlanDraft
  onWeekChange: (
    phaseIndex: number,
    weekIndex: number,
    patch: Partial<WeekDraft>,
  ) => void
  onAddWeek: (phaseIndex: number) => void
  onRemoveWeek: (phaseIndex: number, weekIndex: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {draft.phases.map((phase, phaseIndex) => (
        <Card key={phaseIndex}>
          <CardHeader>
            <CardTitle className="text-base">
              Fase {phaseIndex + 1}: {phase.name.trim() || "Sin nombre"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {phase.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    Semana {week.number}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar semana ${week.number}`}
                    disabled={phase.weeks.length === 1}
                    onClick={() => onRemoveWeek(phaseIndex, weekIndex)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Field
                    label="Número *"
                    error={
                      week.number == null || week.number < 1
                        ? "El número debe ser mayor a 0."
                        : undefined
                    }
                  >
                    <NumberField
                      value={week.number}
                      className={errorInputClass(
                        week.number == null || week.number < 1,
                      )}
                      onValueChange={(value) =>
                        onWeekChange(phaseIndex, weekIndex, {
                          number: value ?? 1,
                        })
                      }
                      min={1}
                    />
                  </Field>
                  <Field label="Fecha inicio">
                    <Input
                      type="date"
                      value={week.start_date}
                      onChange={(e) =>
                        onWeekChange(phaseIndex, weekIndex, {
                          start_date: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Fecha fin">
                    <Input
                      type="date"
                      min={week.start_date || undefined}
                      value={week.end_date}
                      onChange={(e) =>
                        onWeekChange(phaseIndex, weekIndex, {
                          end_date: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Nombre">
                    <Input
                      value={week.name}
                      onChange={(e) =>
                        onWeekChange(phaseIndex, weekIndex, {
                          name: e.target.value,
                        })
                      }
                      placeholder="Opcional"
                    />
                  </Field>
                  <Field label="Objetivo">
                    <Input
                      value={week.objective}
                      onChange={(e) =>
                        onWeekChange(phaseIndex, weekIndex, {
                          objective: e.target.value,
                        })
                      }
                      placeholder="Ej: Carga acumulada"
                    />
                  </Field>
                  <Field label="Notas">
                    <Input
                      value={week.notes}
                      onChange={(e) =>
                        onWeekChange(phaseIndex, weekIndex, {
                          notes: e.target.value,
                        })
                      }
                      placeholder="Opcional"
                    />
                  </Field>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddWeek(phaseIndex)}
            >
              <Plus className="mr-1 size-3" /> Agregar semana
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paso 4: Sesiones
// ---------------------------------------------------------------------------

function SessionsStep({
  draft,
  duplicateDates,
  onWorkoutChange,
  onAddWorkout,
  onRemoveWorkout,
  onAddDefaultWorkouts,
}: {
  draft: PlanDraft
  duplicateDates: Set<string>
  onWorkoutChange: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    patch: Partial<WorkoutDraft>,
  ) => void
  onAddWorkout: (phaseIndex: number, weekIndex: number) => void
  onRemoveWorkout: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
  ) => void
  onAddDefaultWorkouts: (phaseIndex: number, weekIndex: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {draft.phases.map((phase, phaseIndex) =>
        phase.weeks.map((week, weekIndex) => (
          <Card key={`${phaseIndex}-${weekIndex}`}>
            <CardHeader>
              <CardTitle className="text-base">
                Fase {phaseIndex + 1} · Semana {week.number}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {week.workouts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Sin sesiones en esta semana.
                </p>
              )}
              {week.workouts.map((workout, workoutIndex) => {
                const duplicated = duplicateDates.has(workout.date)
                const noEffort =
                  !(workout.distance_km != null && workout.distance_km > 0) &&
                  !(
                    workout.duration_seconds != null &&
                    workout.duration_seconds > 0
                  )
                return (
                  <div
                    key={workoutIndex}
                    className={cn(
                      "rounded-lg border p-3",
                      duplicated && "border-destructive/50 bg-destructive/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        Sesión {workoutIndex + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Eliminar sesión ${workoutIndex + 1}`}
                        disabled={week.workouts.length === 1}
                        onClick={() =>
                          onRemoveWorkout(phaseIndex, weekIndex, workoutIndex)
                        }
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <Field
                        label="Fecha *"
                        error={
                          duplicated
                            ? "Ya hay otra sesión con esta fecha."
                            : !workout.date
                              ? "Indicá una fecha."
                              : undefined
                        }
                      >
                        <Input
                          type="date"
                          className={errorInputClass(
                            duplicated || !workout.date,
                          )}
                          value={workout.date}
                          onChange={(e) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              {
                                date: e.target.value,
                              },
                            )
                          }
                        />
                      </Field>
                      <Field label="Tipo">
                        <Select
                          value={workout.type}
                          onValueChange={(value) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { type: value as WorkoutType },
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(WORKOUT_TYPE_META) as WorkoutType[]
                            ).map((type) => (
                              <SelectItem key={type} value={type}>
                                <span className="inline-flex items-center gap-1.5">
                                  <span>{WORKOUT_TYPE_META[type].emoji}</span>
                                  <span>{WORKOUT_TYPE_META[type].label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Objetivo de sesión">
                        <Input
                          value={workout.objective}
                          onChange={(e) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { objective: e.target.value },
                            )
                          }
                          placeholder="Ej: Velocidad"
                        />
                      </Field>
                      <Field label="Nombre (opcional)">
                        <Input
                          value={workout.name}
                          onChange={(e) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              {
                                name: e.target.value,
                              },
                            )
                          }
                          placeholder="Ej: 5×1000"
                        />
                      </Field>
                      <Field label="Distancia (km)">
                        <NumberStepper
                          value={workout.distance_km}
                          onValueChange={(value) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { distance_km: value },
                            )
                          }
                          placeholder="10"
                          step={0.5}
                          min={0}
                          className={errorInputClass(noEffort)}
                        />
                      </Field>
                      <Field label="Duración" hint="Formato hh:mm">
                        <DurationStepper
                          value={workout.duration_seconds}
                          onValueChange={(value) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { duration_seconds: value },
                            )
                          }
                          stepMinutes={5}
                          className={errorInputClass(noEffort)}
                        />
                      </Field>
                      <Field label="Ritmo" hint="Formato mm:ss">
                        <PaceText
                          value={workout.pace_seconds_per_km}
                          onValueChange={(value) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { pace_seconds_per_km: value },
                            )
                          }
                        />
                      </Field>
                      <Field label="Intensidad">
                        <Select
                          value={workout.intensity}
                          onValueChange={(value) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { intensity: value as Intensity },
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(INTENSITY_META) as Intensity[]).map(
                              (intensity) => (
                                <SelectItem key={intensity} value={intensity}>
                                  {INTENSITY_META[intensity].label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Descripción" className="sm:col-span-4">
                        <textarea
                          className={cn(textareaClass, "min-h-16")}
                          value={workout.description}
                          onChange={(e) =>
                            onWorkoutChange(
                              phaseIndex,
                              weekIndex,
                              workoutIndex,
                              { description: e.target.value },
                            )
                          }
                          placeholder="Opcional"
                        />
                      </Field>
                    </div>
                    {noEffort && (
                      <p className="mt-2 text-xs text-destructive">
                        Indicá distancia o duración para esta sesión.
                      </p>
                    )}
                  </div>
                )
              })}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAddDefaultWorkouts(phaseIndex, weekIndex)}
                >
                  <CalendarDays className="mr-1 size-3" /> Agregar días default
                  (mié/jue/dom)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAddWorkout(phaseIndex, weekIndex)}
                >
                  <Plus className="mr-1 size-3" /> Agregar sesión
                </Button>
              </div>
            </CardContent>
          </Card>
        )),
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paso 5: Bloques
// ---------------------------------------------------------------------------

function BlocksStep({
  draft,
  onBlockChange,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock,
  onAddInterval,
}: {
  draft: PlanDraft
  onBlockChange: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    patch: Partial<BlockDraft>,
  ) => void
  onAddBlock: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
  ) => void
  onRemoveBlock: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
  ) => void
  onMoveBlock: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    direction: -1 | 1,
  ) => void
  onAddInterval: (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    data: Partial<BlockDraft>,
  ) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {draft.phases.map((phase, phaseIndex) =>
        phase.weeks.map((week, weekIndex) =>
          week.workouts.map((workout, workoutIndex) => (
            <Card key={`${phaseIndex}-${weekIndex}-${workoutIndex}`}>
              <CardHeader>
                <CardTitle className="text-base">
                  Sesión {workoutIndex + 1} · Semana {week.number}
                </CardTitle>
                <CardDescription>
                  {workout.objective.trim() || "Sin objetivo"} ·{" "}
                  {formatShortDate(workout.date)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {workout.type === "intervals" && (
                  <IntervalBuilder
                    onAdd={(data) =>
                      onAddInterval(phaseIndex, weekIndex, workoutIndex, data)
                    }
                  />
                )}
                {workout.blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin bloques en esta sesión.
                  </p>
                )}
                {workout.blocks.map((block, blockIndex) => {
                  const hasDistance =
                    block.distance_m != null && block.distance_m > 0
                  const hasDuration =
                    block.duration_seconds != null && block.duration_seconds > 0
                  const noEffort = !hasDistance && !hasDuration
                  const paceOrderError =
                    block.pace_seconds_per_km != null &&
                    block.pace_range_end_seconds_per_km != null &&
                    block.pace_range_end_seconds_per_km <
                      block.pace_seconds_per_km
                  return (
                    <div key={blockIndex} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          Bloque {blockIndex + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Mover bloque arriba"
                            disabled={blockIndex === 0}
                            onClick={() =>
                              onMoveBlock(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                -1,
                              )
                            }
                          >
                            <ArrowUp className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Mover bloque abajo"
                            disabled={blockIndex === workout.blocks.length - 1}
                            onClick={() =>
                              onMoveBlock(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                1,
                              )
                            }
                          >
                            <ArrowDown className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Eliminar bloque"
                            disabled={workout.blocks.length === 1}
                            onClick={() =>
                              onRemoveBlock(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                              )
                            }
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <Field label="Tipo">
                          <Select
                            value={block.block_type}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { block_type: value as BlockType },
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.keys(BLOCK_TYPE_META) as BlockType[]
                              ).map((blockType) => (
                                <SelectItem key={blockType} value={blockType}>
                                  {BLOCK_TYPE_META[blockType].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Repeticiones">
                          <NumberField
                            value={block.repeats}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                {
                                  repeats:
                                    value == null
                                      ? 1
                                      : Math.max(1, Math.round(value)),
                                },
                              )
                            }
                            min={1}
                          />
                        </Field>
                        <Field label="Distancia (m)">
                          <NumberStepper
                            value={block.distance_m}
                            className={errorInputClass(noEffort)}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { distance_m: value },
                              )
                            }
                            placeholder="1000"
                            step={100}
                            min={0}
                          />
                        </Field>
                        <Field label="Duración" hint="Formato hh:mm">
                          <DurationStepper
                            value={block.duration_seconds}
                            className={errorInputClass(noEffort)}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { duration_seconds: value },
                              )
                            }
                            stepMinutes={5}
                          />
                        </Field>
                        <Field label="Ritmo" hint="Formato mm:ss">
                          <PaceText
                            value={block.pace_seconds_per_km}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { pace_seconds_per_km: value },
                              )
                            }
                          />
                        </Field>
                        <Field label="Ritmo máximo" hint="Para rango 5:40–5:50">
                          <PaceText
                            value={block.pace_range_end_seconds_per_km}
                            className={errorInputClass(paceOrderError)}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { pace_range_end_seconds_per_km: value },
                              )
                            }
                          />
                        </Field>
                        <Field label="Recuperación (min)">
                          <NumberStepper
                            value={
                              block.recovery_seconds == null
                                ? null
                                : Math.round(
                                    (block.recovery_seconds / 60) * 10,
                                  ) / 10
                            }
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                {
                                  recovery_seconds:
                                    value == null
                                      ? null
                                      : Math.round(value * 60),
                                },
                              )
                            }
                            placeholder="2"
                            step={0.5}
                            min={0}
                          />
                        </Field>
                        <Field label="Tipo de recuperación">
                          <Select
                            value={block.recovery_type}
                            onValueChange={(value) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { recovery_type: value as "jog" | "walk" },
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="jog">Trotando</SelectItem>
                              <SelectItem value="walk">Caminando</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Notas" className="sm:col-span-4">
                          <Input
                            value={block.notes}
                            onChange={(e) =>
                              onBlockChange(
                                phaseIndex,
                                weekIndex,
                                workoutIndex,
                                blockIndex,
                                { notes: e.target.value },
                              )
                            }
                            placeholder="Opcional"
                          />
                        </Field>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/10 bg-primary/5 px-3 py-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">
                          Vista previa
                        </span>
                        <span className="text-sm font-medium">
                          {buildBlockPreview(block)}
                        </span>
                      </div>
                      {noEffort && (
                        <p className="mt-2 text-xs text-destructive">
                          Indicá distancia o duración para este bloque.
                        </p>
                      )}
                      {paceOrderError && (
                        <p className="mt-2 text-xs text-destructive">
                          El ritmo máximo debe ser mayor o igual al ritmo
                          inicial.
                        </p>
                      )}
                    </div>
                  )
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onAddBlock(phaseIndex, weekIndex, workoutIndex)
                  }
                >
                  <Plus className="mr-1 size-3" /> Agregar bloque
                </Button>
              </CardContent>
            </Card>
          )),
        ),
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paso 6: Revisión
// ---------------------------------------------------------------------------

function ReviewStep({ draft }: { draft: PlanDraft }) {
  const { totalWeeks, totalSessions, plannedKm } = useMemo(() => {
    let sessions = 0
    let km = 0
    for (const { workout } of collectWorkouts(draft)) {
      sessions += 1
      if (workout.distance_km != null && workout.distance_km > 0) {
        km += workout.distance_km
      } else {
        km += blocksDistanceKm(workout.blocks) ?? 0
      }
    }
    return {
      totalWeeks: draft.phases.reduce(
        (acc, phase) => acc + phase.weeks.length,
        0,
      ),
      totalSessions: sessions,
      plannedKm: Math.round(km * 10) / 10,
    }
  }, [draft])

  const typeCounts = useMemo(() => {
    const counts = new Map<WorkoutType, number>()
    for (const { workout } of collectWorkouts(draft)) {
      counts.set(workout.type, (counts.get(workout.type) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [draft])

  const selectedRace = draft.race_id

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumen de tu plan</CardTitle>
          <CardDescription>
            {draft.name.trim() || "Plan sin nombre"} ·{" "}
            {PLAN_STATUS_META[draft.status].label}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Fechas
            </span>
            <span className="text-sm font-medium">
              {draft.start_date
                ? formatDateRange(draft.start_date, draft.end_date || null)
                : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Semanas
            </span>
            <span className="text-sm font-medium">{totalWeeks}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Sesiones
            </span>
            <span className="text-sm font-medium">{totalSessions}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              Km planificados
            </span>
            <span className="text-sm font-medium">
              {formatDistance(plannedKm)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribución por tipo</CardTitle>
        </CardHeader>
        <CardContent>
          {typeCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no definiste sesiones.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {typeCounts.map(([type, count]) => (
                <Badge
                  key={type}
                  variant="outline"
                  className={cn("gap-1.5", WORKOUT_TYPE_META[type].badgeClass)}
                >
                  <span>{WORKOUT_TYPE_META[type].emoji}</span>
                  <span>
                    {count} {WORKOUT_TYPE_META[type].label}
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {draft.goal.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div>
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Objetivo
              </span>
              <p className="text-sm font-medium">{draft.goal.trim()}</p>
            </div>
            {selectedRace && (
              <div>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Carrera
                </span>
                <p className="text-sm font-medium">Asignada</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Wizard principal
// ---------------------------------------------------------------------------

export function PlanWizard({ editId }: { editId: string | null }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [draft, setDraft] = useState<PlanDraft>(createEmptyDraft)
  const [step, setStep] = useState(0)
  const hydrated = useRef(false)

  const planQuery = useQuery({
    queryKey: ["running-plan", editId],
    queryFn: () => RunningPlansService.readPlan({ planId: editId as string }),
    enabled: Boolean(editId),
  })

  const racesQuery = useQuery({
    queryKey: ["races", "options"],
    queryFn: () => RacesService.readRaces({ limit: 100 }),
  })
  const races = racesQuery.data?.data ?? []

  useEffect(() => {
    if (planQuery.data && !hydrated.current) {
      hydrated.current = true
      setDraft(publicToDraft(planQuery.data))
    }
  }, [planQuery.data])

  const updatePlan = (patch: Partial<PlanDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }))

  const updatePhase = (index: number, patch: Partial<PhaseDraft>) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, i) =>
        i === index ? { ...phase, ...patch } : phase,
      ),
    }))

  const addPhase = () =>
    setDraft((prev) => ({
      ...prev,
      phases: [...prev.phases, emptyPhase(prev.phases.length + 1)],
    }))

  const removePhase = (index: number) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases
        .filter((_, i) => i !== index)
        .map((phase, i) => ({ ...phase, position: i + 1 })),
    }))

  const updateWeek = (
    phaseIndex: number,
    weekIndex: number,
    patch: Partial<WeekDraft>,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) => {
                if (wi !== weekIndex) return week
                const next = { ...week, ...patch }
                if (
                  (patch.start_date || patch.end_date) &&
                  next.workouts.length === 0
                ) {
                  next.workouts = prefillWeekSessions(prev.start_date, next)
                }
                return next
              }),
            }
          : phase,
      ),
    }))

  const addWeek = (phaseIndex: number) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) => {
        if (pi !== phaseIndex) return phase
        const week = emptyWeek(suggestWeekNumber(phase))
        const workouts = prefillWeekSessions(prev.start_date, week)
        return { ...phase, weeks: [...phase.weeks, { ...week, workouts }] }
      }),
    }))

  const removeWeek = (phaseIndex: number, weekIndex: number) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? { ...phase, weeks: phase.weeks.filter((_, wi) => wi !== weekIndex) }
          : phase,
      ),
    }))

  const updateWorkout = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    patch: Partial<WorkoutDraft>,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.map((workout, xi) =>
                        xi === workoutIndex
                          ? { ...workout, ...patch }
                          : workout,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const addWorkout = (phaseIndex: number, weekIndex: number) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? { ...week, workouts: [...week.workouts, emptyWorkout()] }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const removeWorkout = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.filter(
                        (_, xi) => xi !== workoutIndex,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const addDefaultWorkouts = (phaseIndex: number, weekIndex: number) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) => {
                if (wi !== weekIndex) return week
                const existing = new Set(
                  week.workouts.map((workout) => workout.date).filter(Boolean),
                )
                const missing = prefillWeekSessions(
                  prev.start_date,
                  week,
                ).filter((workout) => !existing.has(workout.date))
                return {
                  ...week,
                  workouts: [...week.workouts, ...missing],
                }
              }),
            }
          : phase,
      ),
    }))

  const updateBlock = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    patch: Partial<BlockDraft>,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.map((workout, xi) =>
                        xi === workoutIndex
                          ? {
                              ...workout,
                              blocks: workout.blocks.map((block, bi) =>
                                bi === blockIndex
                                  ? { ...block, ...patch }
                                  : block,
                              ),
                            }
                          : workout,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const addBlock = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.map((workout, xi) =>
                        xi === workoutIndex
                          ? {
                              ...workout,
                              blocks: [
                                ...workout.blocks,
                                emptyBlock(workout.blocks.length + 1),
                              ],
                            }
                          : workout,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const addIntervalBlock = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    data: Partial<BlockDraft>,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.map((workout, xi) =>
                        xi === workoutIndex
                          ? {
                              ...workout,
                              blocks: [
                                ...workout.blocks,
                                {
                                  ...emptyBlock(workout.blocks.length + 1),
                                  ...data,
                                },
                              ],
                            }
                          : workout,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const removeBlock = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.map((workout, xi) =>
                        xi === workoutIndex
                          ? {
                              ...workout,
                              blocks: workout.blocks
                                .filter((_, bi) => bi !== blockIndex)
                                .map((block, bi) => ({
                                  ...block,
                                  position: bi + 1,
                                })),
                            }
                          : workout,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const moveBlock = (
    phaseIndex: number,
    weekIndex: number,
    workoutIndex: number,
    blockIndex: number,
    direction: -1 | 1,
  ) =>
    setDraft((prev) => ({
      ...prev,
      phases: prev.phases.map((phase, pi) =>
        pi === phaseIndex
          ? {
              ...phase,
              weeks: phase.weeks.map((week, wi) =>
                wi === weekIndex
                  ? {
                      ...week,
                      workouts: week.workouts.map((workout, xi) =>
                        xi === workoutIndex
                          ? {
                              ...workout,
                              blocks: reorder(
                                workout.blocks,
                                blockIndex,
                                blockIndex + direction,
                              ).map((block, bi) => ({
                                ...block,
                                position: bi + 1,
                              })),
                            }
                          : workout,
                      ),
                    }
                  : week,
              ),
            }
          : phase,
      ),
    }))

  const duplicateDates = useMemo(() => findDuplicateDates(draft), [draft])

  const stepValid = [
    goalStepValid(draft),
    phasesStepValid(draft),
    weeksStepValid(draft),
    sessionsStepValid(draft),
    blocksStepValid(draft),
    true,
  ][step]

  const mutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload(draft)
      if (editId) {
        return RunningPlansService.replacePlan({
          planId: editId,
          requestBody: payload,
        })
      }
      return RunningPlansService.createPlan({ requestBody: payload })
    },
    onSuccess: (result) => {
      showSuccessToast(editId ? "Plan actualizado" : "Plan creado")
      queryClient.invalidateQueries({ queryKey: ["running-plans"] })
      queryClient.invalidateQueries({ queryKey: ["running-plan"] })
      navigate({ to: "/routines/run/$planId", params: { planId: result.id } })
    },
    onError: handleError.bind(showErrorToast),
  })

  const goNext = () =>
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  const goBack = () => setStep((current) => Math.max(current - 1, 0))
  const goToStep = (index: number) =>
    setStep((current) => (index <= current ? index : current))

  if (editId && planQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (editId && planQuery.isError) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-semibold">No se pudo cargar el plan</p>
        <Button type="button" variant="outline" asChild>
          <Link to="/routines">
            <ChevronLeft className="mr-2 size-4" /> Volver a rutinas
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {editId ? "Editar plan" : "Nuevo plan de running"}
          </h1>
          <p className="text-muted-foreground">
            Planificá tu temporada con fases, semanas y sesiones.
          </p>
        </div>
        <Stepper current={step} onSelect={goToStep} />
      </header>

      <div className="pb-4">
        {step === 0 && (
          <ObjectiveStep draft={draft} races={races} onUpdate={updatePlan} />
        )}
        {step === 1 && (
          <PhasesStep
            draft={draft}
            onPhaseChange={updatePhase}
            onAddPhase={addPhase}
            onRemovePhase={removePhase}
          />
        )}
        {step === 2 && (
          <WeeksStep
            draft={draft}
            onWeekChange={updateWeek}
            onAddWeek={addWeek}
            onRemoveWeek={removeWeek}
          />
        )}
        {step === 3 && (
          <SessionsStep
            draft={draft}
            duplicateDates={duplicateDates}
            onWorkoutChange={updateWorkout}
            onAddWorkout={addWorkout}
            onRemoveWorkout={removeWorkout}
            onAddDefaultWorkouts={addDefaultWorkouts}
          />
        )}
        {step === 4 && (
          <BlocksStep
            draft={draft}
            onBlockChange={updateBlock}
            onAddBlock={addBlock}
            onRemoveBlock={removeBlock}
            onMoveBlock={moveBlock}
            onAddInterval={addIntervalBlock}
          />
        )}
        {step === 5 && <ReviewStep draft={draft} />}
      </div>

      <footer className="sticky bottom-0 z-10 -mx-6 border-t bg-background/95 px-6 py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || mutation.isPending}
            onClick={goBack}
          >
            <ChevronLeft className="mr-1 size-4" /> Atrás
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              disabled={!stepValid || mutation.isPending}
              onClick={goNext}
            >
              Continuar <ChevronRight className="ml-1 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!stepValid || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {editId ? "Guardar cambios" : "Guardar plan"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
