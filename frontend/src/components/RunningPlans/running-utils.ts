// Metadatos y formateo del dominio de planes de running.
// Contrato compartido entre el wizard, el listado y el detalle.

export type WorkoutType =
  | "easy_run"
  | "regeneration"
  | "intervals"
  | "tempo"
  | "long_run"
  | "test"
  | "activation"
  | "race"

export type WorkoutStatus = "planned" | "completed" | "missed" | "cancelled"

export type PlanStatus = "planned" | "active" | "completed"

export type Intensity = "easy" | "moderate" | "hard"

export type BlockType =
  | "warmup"
  | "main"
  | "interval"
  | "recovery"
  | "cooldown"
  | "strides"

export type PhaseColor =
  | "emerald"
  | "amber"
  | "red"
  | "sky"
  | "violet"
  | "slate"

export const WORKOUT_TYPE_META: Record<
  WorkoutType,
  { label: string; emoji: string; badgeClass: string }
> = {
  easy_run: {
    label: "Rodaje suave",
    emoji: "🟢",
    badgeClass: "bg-emerald-500/15 text-emerald-600",
  },
  regeneration: {
    label: "Regenerativo",
    emoji: "🔵",
    badgeClass: "bg-sky-500/15 text-sky-600",
  },
  intervals: {
    label: "Intervalos",
    emoji: "🟣",
    badgeClass: "bg-purple-500/15 text-purple-600",
  },
  tempo: {
    label: "Tempo",
    emoji: "🟠",
    badgeClass: "bg-orange-500/15 text-orange-600",
  },
  long_run: {
    label: "Fondo",
    emoji: "🟡",
    badgeClass: "bg-amber-500/15 text-amber-600",
  },
  test: {
    label: "Test",
    emoji: "🔴",
    badgeClass: "bg-red-500/15 text-red-600",
  },
  activation: {
    label: "Activación",
    emoji: "⚫",
    badgeClass: "bg-slate-500/15 text-slate-600",
  },
  race: {
    label: "Carrera",
    emoji: "🏁",
    badgeClass: "bg-domain-cardio/15 text-domain-cardio",
  },
}

export const WORKOUT_STATUS_META: Record<
  WorkoutStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    className?: string
  }
> = {
  planned: { label: "Planificada", variant: "outline" },
  completed: {
    label: "Completada",
    variant: "secondary",
    className: "bg-emerald-500/15 text-emerald-600 border-transparent",
  },
  missed: { label: "Perdida", variant: "destructive" },
  cancelled: {
    label: "Cancelada",
    variant: "outline",
    className: "text-muted-foreground line-through",
  },
}

export const PLAN_STATUS_META: Record<
  PlanStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    className: string
  }
> = {
  active: {
    label: "Activo",
    variant: "default",
    className:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold",
  },
  planned: {
    label: "Pausado / Planificado",
    variant: "outline",
    className:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold",
  },
  completed: {
    label: "Finalizado",
    variant: "secondary",
    className:
      "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 font-bold",
  },
}

export const INTENSITY_META: Record<Intensity, { label: string }> = {
  easy: { label: "Suave" },
  moderate: { label: "Moderada" },
  hard: { label: "Fuerte" },
}

export const BLOCK_TYPE_META: Record<BlockType, { label: string }> = {
  warmup: { label: "Entrada en calor" },
  main: { label: "Serie principal" },
  interval: { label: "Intervalo" },
  recovery: { label: "Recuperación" },
  cooldown: { label: "Afloje" },
  strides: { label: "Progresiones" },
}

export const PHASE_COLORS: Record<PhaseColor, { bar: string; badge: string }> =
  {
    emerald: {
      bar: "bg-emerald-500",
      badge: "bg-emerald-500/15 text-emerald-600",
    },
    amber: { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-600" },
    red: { bar: "bg-red-500", badge: "bg-red-500/15 text-red-600" },
    sky: { bar: "bg-sky-500", badge: "bg-sky-500/15 text-sky-600" },
    violet: { bar: "bg-violet-500", badge: "bg-violet-500/15 text-violet-600" },
    slate: { bar: "bg-slate-400", badge: "bg-slate-500/15 text-slate-600" },
  }

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 })

/** "5:55/km" | "1:02:30/km" | "—" */
export function formatPace(secondsPerKm?: number | null): string {
  if (secondsPerKm == null || Number.isNaN(secondsPerKm)) return "—"
  const total = Math.round(secondsPerKm)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}/km` : `${mm}:${ss}/km`
}

/** "52 min" | "1 h 05 min" | "—" */
export function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "—"
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0)
    return m > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`
  if (m > 0) return `${m} min`
  return `${total} s`
}

/** "8,4 km" | "400 m" | "—" */
export function formatDistance(km?: number | null): string {
  if (km == null || Number.isNaN(km)) return "—"
  return `${numFmt.format(km)} km`
}

/** Distancia de un bloque: "1 km" | "400 m" | "—" */
export function formatBlockDistance(meters: number | null | undefined): string {
  if (meters == null) return "—"
  if (meters >= 1000) return formatDistance(meters / 1000)
  return `${Math.round(meters)} m`
}

/**
 * Resumen corto de los bloques de una sesión para el editor del wizard:
 * "Cal 2km · 8km · Enf 1km" | "Cal 1.5km · 4×800m · Enf 1.5km".
 */
export function summarizeBlocks(
  blocks: Array<{
    block_type?: string | null
    repeats?: number | null
    distance_m?: number | null
  }>,
): string {
  if (!blocks || blocks.length === 0) return ""
  const parts = blocks.map((b) => {
    const dist = b.distance_m
    const distText =
      dist != null && dist > 0
        ? dist >= 1000
          ? `${Math.round(dist / 100) / 10}km`
          : `${Math.round(dist)}m`
        : ""
    const reps = b.repeats && b.repeats > 1 ? `${b.repeats}×` : ""
    switch (b.block_type) {
      case "warmup":
        return distText ? `Cal ${distText}` : "Cal"
      case "main":
        return distText || "Main"
      case "interval":
        return `${reps}${distText}`.trim() || "Int"
      case "strides":
        return `${reps}${distText}`.trim() || "Strides"
      case "cooldown":
        return distText ? `Enf ${distText}` : "Enf"
      case "recovery":
        return "Rec"
      default:
        return distText || "Bloque"
    }
  })
  return parts.join(" · ")
}

/** Rango de ritmo de un bloque: "4:20" | "4:20–4:30" | "—" */
export function formatPaceRange(block: {
  pace_seconds_per_km?: number | null
  pace_range_end_seconds_per_km?: number | null
}): string {
  const start = block.pace_seconds_per_km
  if (start == null) return "—"
  const a = formatPace(start).replace("/km", "")
  const end = block.pace_range_end_seconds_per_km
  if (end == null) return a
  return `${a}–${formatPace(end).replace("/km", "")}`
}

/** Recuperación de un bloque: "90' trotando" | "2' caminando" | "—" */
export function formatRecovery(block: {
  recovery_seconds?: number | null
  recovery_type?: string | null
}): string {
  if (block.recovery_seconds == null || block.recovery_seconds <= 0) return "—"
  const mins = block.recovery_seconds / 60
  const rec = mins % 1 === 0 ? `${mins}'` : `${mins.toFixed(1)}'`
  const tipo =
    block.recovery_type === "jog"
      ? " trotando"
      : block.recovery_type === "walk"
        ? " caminando"
        : ""
  return `${rec}${tipo}`
}

/** "sáb 08/08" | "—" */
export function formatShortDate(iso?: string | null): string {
  if (!iso) return "—"
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return dateFmt.format(date)
}

/** "04 ago – 13 sep" | "04 ago" | "—" */
export function formatDateRange(
  start?: string | null,
  end?: string | null,
): string {
  if (!start) return "—"
  const monthDay = (iso: string) => {
    const date = new Date(`${iso}T12:00:00`)
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
    }).format(date)
  }
  if (end) return `${monthDay(start)} – ${monthDay(end)}`
  return monthDay(start)
}

/** "hh:mm" o "mm" → segundos (para duración). Vacío/inválido → null. */
export function durationInputToSeconds(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(":")
  if (parts.length > 3) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null
  if (nums.length === 1) return Math.round(nums[0] * 60)
  if (nums.length === 2) return Math.round(nums[0] * 3600 + nums[1] * 60)
  return Math.round(nums[0] * 3600 + nums[1] * 60 + nums[2])
}

/** Segundos → "hh:mm[:ss]" (incluye segundos si hay resto, para round-trip). */
export function secondsToDurationInput(seconds?: number | null): string {
  if (seconds == null) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0)
    return s > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${h}:${String(m).padStart(2, "0")}`
  if (s > 0) return `${m}:${String(s).padStart(2, "0")}`
  return String(m)
}

/** "mm:ss" o "h:mm:ss" → segundos (para ritmo). Vacío/inválido → null. */
export function paceInputToSeconds(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(":")
  if (parts.length > 3 || parts.length === 0) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null
  if (nums.length === 1) return Math.round(nums[0] * 60)
  if (nums.length === 3)
    return Math.round(nums[0] * 3600 + nums[1] * 60 + nums[2])
  return Math.round(nums[0] * 60 + nums[1])
}

/** Segundos → "mm:ss" (o "h:mm:ss" si >= 1 h). */
export function secondsToPaceInput(seconds?: number | null): string {
  if (seconds == null) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Tiempo de carrera → segundos. A diferencia de `durationInputToSeconds`,
 * interpreta 2 partes como "mm:ss" (no "hh:mm"), que es el formato natural de
 * una marca de carrera y lo que produce `formatTime` para tiempos < 1 h.
 * "50:00" → 3000 s | "1:30:00" → 5400 s | "24" → 1440 s. Vacío/inválido → null.
 */
export function raceTimeInputToSeconds(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parts = trimmed.split(":")
  if (parts.length > 3 || parts.length === 0) return null
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => Number.isNaN(n) || n < 0)) return null
  if (nums.length === 1) return Math.round(nums[0] * 60)
  if (nums.length === 2) return Math.round(nums[0] * 60 + nums[1])
  return Math.round(nums[0] * 3600 + nums[1] * 60 + nums[2])
}

interface BlockPreviewInput {
  block_type?: string | null
  repeats?: number | null
  distance_m?: number | null
  duration_seconds?: number | null
  pace_seconds_per_km?: number | null
  pace_range_end_seconds_per_km?: number | null
  recovery_seconds?: number | null
  recovery_type?: string | null
  notes?: string | null
}

function formatMeters(meters: number): string {
  if (meters >= 1000 && meters % 1000 === 0) return `${meters / 1000} km`
  if (meters >= 1000) return `${numFmt.format(meters / 1000)} km`
  return `${Math.round(meters)} m`
}

/** "5 × 1 km @ 5:40–5:50 · 2' recuperación (trote)" | "—" */
export function buildBlockPreview(block: BlockPreviewInput): string {
  const hasDistance = block.distance_m != null && block.distance_m > 0
  const hasDuration =
    block.duration_seconds != null && block.duration_seconds > 0
  if (!hasDistance && !hasDuration) return "—"

  const reps = block.repeats && block.repeats > 1 ? `${block.repeats} × ` : ""
  const effort = hasDistance
    ? formatMeters(block.distance_m as number)
    : formatDuration(block.duration_seconds)

  const paceStart = block.pace_seconds_per_km
  const paceEnd = block.pace_range_end_seconds_per_km
  let pace = ""
  if (paceStart != null) {
    const a = formatPace(paceStart).replace("/km", "")
    const b = paceEnd != null ? formatPace(paceEnd).replace("/km", "") : ""
    pace = b ? ` @ ${a}–${b}` : ` @ ${a}`
  }

  let recovery = ""
  if (block.recovery_seconds != null && block.recovery_seconds > 0) {
    const total = Math.round(block.recovery_seconds)
    const mins = Math.floor(total / 60)
    const secs = total % 60
    const rec =
      secs > 0 ? `${mins}:${String(secs).padStart(2, "0")}'` : `${mins}'`
    const tipo =
      block.recovery_type === "jog"
        ? " trotando"
        : block.recovery_type === "walk"
          ? " caminando"
          : ""
    recovery = ` · ${rec} recuperación${tipo}`
  }

  return `${reps}${effort}${pace}${recovery}`
}

/** Suma la distancia de trabajo de los bloques (reps × distancia) en km, o null si no hay. */
export function blocksDistanceKm(
  blocks: Array<{ repeats?: number | null; distance_m?: number | null }>,
): number | null {
  const meters = (blocks ?? []).reduce(
    (acc, block) => acc + (block.repeats ?? 1) * (block.distance_m ?? 0),
    0,
  )
  return meters > 0 ? Math.round((meters / 1000) * 10) / 10 : null
}

/** "Plan 10K" → label corto del plan para listado. */
export function planTitle(name: string, goal?: string | null): string {
  if (goal) return goal
  return name
}

function isoFromDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Suma días a una fecha ISO "YYYY-MM-DD" y devuelve otra ISO (zona local). */
export function addDaysToIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  date.setDate(date.getDate() + days)
  return isoFromDate(date)
}

// Días de entrenamiento por defecto (getDay: 0=domingo, 3=miércoles, 4=jueves).
const DEFAULT_TRAINING_WEEKDAYS = [3, 4, 0]

/** Fechas ISO de los días de entrenamiento por defecto (mié/jue/dom) dentro de [start, end]. */
export function defaultTrainingDates(start: string, end: string): string[] {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  ) {
    return []
  }
  const result: string[] = []
  const cursor = new Date(startDate)
  let guard = 0
  while (cursor <= endDate && guard < 40) {
    if (DEFAULT_TRAINING_WEEKDAYS.includes(cursor.getDay())) {
      result.push(isoFromDate(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
    guard += 1
  }
  return result
}

// ---------------------------------------------------------------------------
// Helpers for the redesigned /routines page
// ---------------------------------------------------------------------------

/** Spanish short day names indexed by JS getDay() (0=domingo). */
const SHORT_DAY_NAMES = ["D", "L", "M", "M", "J", "V", "S"] as const

/** Returns the Spanish short name for a JS day index (0=Sun → "D"). */
export function getShortDayName(dayIndex: number): string {
  return SHORT_DAY_NAMES[dayIndex] ?? "?"
}

/** Progress breakdown for a plan. */
export interface PlanProgress {
  total: number
  completed: number
  missed: number
  planned: number
  percent: number
}

/** Computes progress from a RunningPlanSummaryPublic-shaped object. */
export function computeProgress(summary: {
  completed: number
  missed: number
  planned: number
  sessions: number
}): PlanProgress {
  const total = summary.sessions
  const percent = total > 0 ? Math.round((summary.completed / total) * 100) : 0
  return {
    total,
    completed: summary.completed,
    missed: summary.missed,
    planned: summary.planned,
    percent,
  }
}

/** ISO dates for Monday→Sunday of the week containing `referenceDate`. */
export function getWeekBoundsISO(referenceDate?: Date): {
  monday: string
  sunday: string
} {
  const d = referenceDate ?? new Date()
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday: isoLocal(monday), sunday: isoLocal(sunday) }
}

function isoLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Given plan phases (full detail), find the week whose date range contains
 * `today`. Returns the week, its workouts, and parent phase info, or null.
 */
export function getCurrentWeekFromPhases(
  phases: Array<{
    name: string
    color: string
    weeks?: Array<{
      id: string
      number: number
      start_date?: string | null
      end_date?: string | null
      workouts?: Array<{
        id: string
        date: string
        type: string
        status: string
        name?: string | null
        objective?: string | null
        distance_km?: number | null
        pace_seconds_per_km?: number | null
        cancelled: boolean
        [key: string]: unknown
      }>
    }>
  }>,
  referenceDate?: Date,
): {
  phaseName: string
  phaseColor: string
  weekNumber: number
  weekId: string
  startDate: string
  endDate: string
  workouts: Array<{
    id: string
    date: string
    type: string
    status: string
    name?: string | null
    objective?: string | null
    distance_km?: number | null
    pace_seconds_per_km?: number | null
    cancelled: boolean
    [key: string]: unknown
  }>
} | null {
  const today = isoLocal(referenceDate ?? new Date())

  for (const phase of phases) {
    for (const week of phase.weeks ?? []) {
      const start = week.start_date
      const end = week.end_date
      if (!start || !end) continue
      if (today >= start && today <= end) {
        return {
          phaseName: phase.name,
          phaseColor: phase.color,
          weekNumber: week.number,
          weekId: week.id,
          startDate: start,
          endDate: end,
          workouts: week.workouts ?? [],
        }
      }
    }
  }
  return null
}

/** Generate an array of 7 ISO date strings for Mon→Sun of a given week. */
export function weekDaysISO(mondayISO: string): string[] {
  const base = new Date(`${mondayISO}T12:00:00`)
  if (Number.isNaN(base.getTime())) return []
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return isoLocal(d)
  })
}
