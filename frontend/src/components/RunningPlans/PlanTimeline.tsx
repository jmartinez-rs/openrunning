import { CheckCircle2, MinusCircle } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { PlanMilestoneBadge } from "./PlanMilestoneBadge"
import { PHASE_COLORS, type WeekOverview } from "./running-utils"

interface PlanTimelineProps {
  weeks: WeekOverview[]
  currentWeekNumber?: number
  onSelectWeek: (weekNumber: number) => void
}

const STATUS_WORD: Record<WeekOverview["status"], string> = {
  past: "completada",
  current: "actual",
  future: "futura",
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Línea de tiempo del plan completo: un chip por semana con fase y estado.
 * Columna vertebral de orientación ("dónde estoy").
 */
export function PlanTimeline({
  weeks,
  currentWeekNumber,
  onSelectWeek,
}: PlanTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [selected, setSelected] = useState<number | undefined>(
    currentWeekNumber ?? weeks[0]?.number,
  )

  useEffect(() => {
    setSelected(currentWeekNumber ?? weeks[0]?.number)
  }, [currentWeekNumber, weeks])

  // Auto-scroll horizontal hasta centrar la semana actual (sin mover la página).
  useEffect(() => {
    const target = currentWeekNumber ?? weeks[0]?.number
    if (target == null) return
    const container = containerRef.current
    const chip = chipRefs.current.get(target)
    if (!container || !chip) return
    const left =
      chip.offsetLeft - container.clientWidth / 2 + chip.clientWidth / 2
    container.scrollTo({
      left,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }, [currentWeekNumber, weeks])

  const milestones = useMemo(() => {
    const map = new Map<
      number,
      { label: string; tone: "primary" | "race" | "neutral" }[]
    >()
    const push = (
      number: number | undefined,
      label: string,
      tone: "primary" | "race" | "neutral",
    ) => {
      if (number == null) return
      const list = map.get(number) ?? []
      if (!list.some((m) => m.label === label)) list.push({ label, tone })
      map.set(number, list)
    }

    if (weeks.length > 0) {
      push(Math.ceil(weeks.length / 2), "Mitad del plan", "primary")
      push(weeks[weeks.length - 1]?.number, "Recta final", "neutral")
      const raceWeek = weeks.find((week) =>
        week.workouts.some((workout) => workout.type === "race"),
      )
      push(raceWeek?.number, "Día de carrera", "race")
    }
    return map
  }, [weeks])

  if (weeks.length === 0) return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const currentIndex = weeks.findIndex((week) => week.number === selected)
    const delta = event.key === "ArrowLeft" ? -1 : 1
    const nextIndex = Math.max(
      0,
      Math.min(weeks.length - 1, currentIndex + delta),
    )
    const next = weeks[nextIndex]
    if (!next) return
    setSelected(next.number)
    onSelectWeek(next.number)
    chipRefs.current.get(next.number)?.focus()
  }

  return (
    <section
      aria-label="Línea de tiempo del plan"
      className="flex flex-col gap-2"
    >
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Semanas del plan"
        onKeyDown={handleKeyDown}
        className="flex items-stretch gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {weeks.map((week) => {
          const isCurrent = week.number === currentWeekNumber
          const isSelected = week.number === selected
          const hasMissed = week.counts.missed > 0
          const isComplete =
            week.counts.total > 0 && week.counts.completed === week.counts.total
          const phaseBar =
            PHASE_COLORS[week.phaseColor]?.bar ?? PHASE_COLORS.slate.bar
          const weekMilestones = milestones.get(week.number) ?? []

          return (
            <div
              key={week.id}
              className="flex shrink-0 snap-center flex-col items-center gap-1"
            >
              <button
                type="button"
                role="tab"
                ref={(el) => {
                  if (el) chipRefs.current.set(week.number, el)
                  else chipRefs.current.delete(week.number)
                }}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                aria-label={`Semana ${week.number}, ${week.phaseName}, ${STATUS_WORD[week.status]}`}
                onClick={() => {
                  setSelected(week.number)
                  onSelectWeek(week.number)
                }}
                className={cn(
                  "relative flex h-20 w-20 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl border px-1.5 py-2 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isCurrent
                    ? "border-primary bg-surface-container-high shadow-card"
                    : "border-border bg-surface-container-high/50 hover:bg-surface-container-high",
                  week.status === "future" && !isCurrent && "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-3 top-1.5 h-1 rounded-full",
                    phaseBar,
                  )}
                />
                <span className="mt-1.5 text-lg font-display font-black leading-none tracking-tight text-foreground tabular-nums">
                  {week.number}
                </span>
                <span className="w-full truncate text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {week.phaseName}
                </span>
                <span className="mt-0.5 flex h-3 items-center gap-1">
                  {hasMissed ? (
                    <MinusCircle className="size-3 text-destructive" />
                  ) : isComplete ? (
                    <CheckCircle2 className="size-3 text-primary" />
                  ) : isCurrent ? (
                    <span className="size-2 rounded-full bg-primary" />
                  ) : null}
                </span>
              </button>

              {weekMilestones.map((milestone) => (
                <PlanMilestoneBadge
                  key={milestone.label}
                  label={milestone.label}
                  tone={milestone.tone}
                />
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
