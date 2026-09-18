import { Layers } from "lucide-react"

import type { RunningPhasePublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { PHASE_COLORS, type PhaseColor } from "./running-utils"

interface PhaseTimelineProps {
  phases: RunningPhasePublic[]
  selectedPhaseId: string | null
  onSelectPhase: (phaseId: string | null) => void
  currentWeekNumber?: number
}

export function PhaseTimeline({
  phases,
  selectedPhaseId,
  onSelectPhase,
  currentWeekNumber,
}: PhaseTimelineProps) {
  if (!phases || phases.length === 0) return null

  const totalWeeks = Math.max(...phases.map((p) => p.end_week ?? 1), 1)

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card/90 p-4 shadow-card backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
            <Layers className="size-4" />
          </div>
          <h3 className="text-sm font-bold text-white">
            Fases del Plan ({phases.length})
          </h3>
        </div>

        {selectedPhaseId && (
          <button
            type="button"
            onClick={() => onSelectPhase(null)}
            className="text-xs font-bold text-primary hover:text-primary transition-colors"
          >
            Ver todas las semanas
          </button>
        )}
      </div>

      {/* Visual Phase Progress Bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container-high border border-border/60 p-0.5">
        {phases.map((phase) => {
          const phaseWeeks = phase.end_week - phase.start_week + 1 || 1
          const widthPct = (phaseWeeks / totalWeeks) * 100
          const phaseColor =
            PHASE_COLORS[phase.color as PhaseColor] ?? PHASE_COLORS.slate
          const isCurrentPhase =
            currentWeekNumber != null &&
            currentWeekNumber >= phase.start_week &&
            currentWeekNumber <= phase.end_week
          const isSelected = selectedPhaseId === phase.id

          return (
            <div
              key={phase.id}
              onClick={() => onSelectPhase(isSelected ? null : phase.id)}
              title={`${phase.name}: Semanas ${phase.start_week}-${phase.end_week}`}
              className={cn(
                "group relative h-full cursor-pointer transition-all duration-200 hover:brightness-125 rounded-sm",
                phaseColor.bar,
                isCurrentPhase &&
                  "ring-2 ring-primary ring-offset-1 ring-offset-card z-10",
                selectedPhaseId && !isSelected && "opacity-35",
              )}
              style={{ width: `${widthPct}%` }}
            />
          )
        })}
      </div>

      {/* Phase Filter Chips */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSelectPhase(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border",
            selectedPhaseId === null
              ? "bg-primary/20 text-primary border-primary/50 shadow-sm"
              : "bg-surface-container-high/80 text-muted-foreground border-border hover:bg-surface-container-high hover:text-white",
          )}
        >
          Todas las Fases
        </button>

        {phases.map((phase) => {
          const phaseColor =
            PHASE_COLORS[phase.color as PhaseColor] ?? PHASE_COLORS.slate
          const isSelected = selectedPhaseId === phase.id
          const isCurrentPhase =
            currentWeekNumber != null &&
            currentWeekNumber >= phase.start_week &&
            currentWeekNumber <= phase.end_week

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => onSelectPhase(isSelected ? null : phase.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : cn(
                      "bg-surface-container-high/80 border-border hover:bg-surface-container-high hover:border-border text-foreground",
                    ),
              )}
            >
              <span
                className={cn("size-2.5 rounded-full shrink-0", phaseColor.bar)}
              />
              <span>{phase.name}</span>
              <span className="opacity-70 text-[11px] font-normal">
                (S{phase.start_week}-{phase.end_week})
              </span>
              {isCurrentPhase && (
                <Badge className="ml-1 border-primary/40 bg-primary/20 px-1.5 py-0 text-[10px] text-primary font-extrabold">
                  Actual
                </Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
