import type {
  RunningPhasePublic,
  RunningPlanPublic,
  RunningWeekPublic,
  RunningWorkoutPublic,
  WorkoutBlockPublic,
} from "@/client"
import {
  BLOCK_TYPE_META,
  blocksDistanceKm,
  formatBlockDistance,
  formatDateRange,
  formatDuration,
  formatPace,
  formatPaceRange,
  formatRecovery,
  formatShortDate,
  getCurrentWeekFromPhases,
  INTENSITY_META,
  PLAN_STATUS_META,
  WORKOUT_STATUS_META,
  WORKOUT_TYPE_META,
} from "./running-utils"

export type PlanExportScope = "full" | "current"

/** Línea de un bloque: "Intervalo: 5×1000 m a 4:20–4:30/km (rec 90' trotando)" */
function formatBlockLine(block: WorkoutBlockPublic): string {
  const parts: string[] = []
  parts.push(BLOCK_TYPE_META[block.block_type]?.label ?? block.block_type)
  if (block.repeats > 1) parts.push(`${block.repeats}×`)
  if (block.distance_m != null) {
    parts.push(formatBlockDistance(block.distance_m))
  } else if (block.duration_seconds != null) {
    parts.push(formatDuration(block.duration_seconds))
  }
  const pace = formatPaceRange(block)
  if (pace !== "—") parts.push(`a ${pace}/km`)
  const recovery = formatRecovery(block)
  if (recovery !== "—") parts.push(`(rec ${recovery})`)
  if (block.notes) parts.push(`— ${block.notes}`)
  return parts.join(" ")
}

/** Línea de una sesión: "- **mié 23/09 · Rodaje Suave** — Rodaje suave · 8 km · 6:00/km · Suave" */
function formatWorkoutLine(workout: RunningWorkoutPublic): string {
  const typeLabel = WORKOUT_TYPE_META[workout.type]?.label ?? workout.type
  const distance = workout.distance_km ?? blocksDistanceKm(workout.blocks ?? [])
  const parts: string[] = []
  parts.push(
    `**${formatShortDate(workout.date)} · ${workout.name ?? typeLabel}**`,
  )
  parts.push(typeLabel)
  if (distance != null) parts.push(`${distance} km`)
  if (workout.pace_seconds_per_km != null) {
    parts.push(formatPace(workout.pace_seconds_per_km))
  }
  parts.push(INTENSITY_META[workout.intensity]?.label ?? workout.intensity)
  const status = WORKOUT_STATUS_META[workout.status]?.label
  if (status && workout.status !== "planned") parts.push(`[${status}]`)
  return `- ${parts.join(" · ")}`
}

function buildWeekSection(week: RunningWeekPublic): string {
  const lines: string[] = []
  const title = week.name
    ? `Semana ${week.number} · ${week.name}`
    : `Semana ${week.number}`
  lines.push(
    `### ${title} (${formatDateRange(week.start_date, week.end_date)})`,
  )
  if (week.objective) lines.push(`Objetivo: ${week.objective}`)
  lines.push("")
  for (const workout of week.workouts ?? []) {
    lines.push(formatWorkoutLine(workout))
    for (const block of workout.blocks ?? []) {
      lines.push(`  - ${formatBlockLine(block)}`)
    }
  }
  lines.push("")
  return lines.join("\n")
}

function buildPhaseSection(phase: RunningPhasePublic): string {
  const lines: string[] = []
  lines.push(
    `## Fase ${phase.position} · ${phase.name} (Semanas ${phase.start_week}–${phase.end_week})`,
  )
  if (phase.objective) lines.push(phase.objective)
  lines.push("")
  for (const week of phase.weeks ?? []) {
    lines.push(buildWeekSection(week))
  }
  return lines.join("\n")
}

function buildPlanHeader(plan: RunningPlanPublic): string {
  const lines: string[] = []
  lines.push(`# ${plan.name}`)
  lines.push("")
  if (plan.goal) lines.push(`**Objetivo:** ${plan.goal}`)
  lines.push(`**Periodo:** ${formatDateRange(plan.start_date, plan.end_date)}`)
  lines.push(
    `**Estado:** ${PLAN_STATUS_META[plan.status]?.label ?? plan.status}`,
  )
  if (plan.target_time_seconds) {
    lines.push(
      `**Tiempo objetivo:** ${formatDuration(plan.target_time_seconds)}`,
    )
  }
  if (plan.target_pace_seconds_per_km) {
    lines.push(
      `**Ritmo objetivo:** ${formatPace(plan.target_pace_seconds_per_km)}`,
    )
  }
  if (plan.notes) lines.push(`**Notas:** ${plan.notes}`)
  return lines.join("\n")
}

/** Genera el markdown del plan (completo o solo la semana actual). */
export function buildPlanMarkdown(
  plan: RunningPlanPublic,
  scope: PlanExportScope = "full",
): string {
  const sections: string[] = []
  sections.push(buildPlanHeader(plan))
  sections.push("")
  sections.push("---")
  sections.push("")

  const phases = plan.phases ?? []

  if (scope === "current") {
    const current = getCurrentWeekFromPhases(phases)
    if (current) {
      sections.push(`## ${current.phaseName} · Semana ${current.weekNumber}`)
      sections.push("")
      for (const workout of current.workouts) {
        sections.push(formatWorkoutLine(workout as RunningWorkoutPublic))
        for (const block of (workout as RunningWorkoutPublic).blocks ?? []) {
          sections.push(`  - ${formatBlockLine(block)}`)
        }
      }
      sections.push("")
    } else {
      sections.push("_No hay una semana en curso._")
    }
  } else {
    for (const phase of phases) {
      sections.push(buildPhaseSection(phase))
    }
  }

  return `${sections.join("\n").trim()}\n`
}

/** Nombre de archivo seguro para el plan. */
export function planExportFilename(
  plan: RunningPlanPublic,
  scope: PlanExportScope,
): string {
  const base = plan.name.replace(/[^\w\dáéíóúñüÁÉÍÓÚÑÜ -]+/g, "").trim()
  const safe = base || "plan"
  return scope === "current" ? `${safe} - Semana actual.md` : `${safe}.md`
}

/** Descarga el contenido como archivo .md (sin dependencias). */
export function downloadPlanFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
