import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"

interface RunnaDashboardHeaderProps {
  weekLabel: string
  currentWeekNumber: number
  totalWeeks: number
  hasActivePlan?: boolean
  onPrevWeek: () => void
  onNextWeek: () => void
}

export const RunnaDashboardHeader: React.FC<RunnaDashboardHeaderProps> = ({
  weekLabel,
  currentWeekNumber,
  totalWeeks,
  hasActivePlan = true,
  onPrevWeek,
  onNextWeek,
}) => {
  return (
    <header className="flex items-center justify-between pt-1 px-1 pb-1">
      {/* Flecha izquierda: Semana anterior */}
      <button
        type="button"
        onClick={onPrevWeek}
        className="size-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
        aria-label="Semana anterior"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Título informativo central (sin enlace al plan) */}
      <div className="flex flex-col items-center select-none text-center px-2">
        <span className="text-xs sm:text-sm font-display font-black text-white uppercase tracking-wider">
          {weekLabel}
        </span>
        {hasActivePlan && (
          <span className="text-[11px] font-semibold text-primary/90 mt-0.5">
            Semana {currentWeekNumber} de {totalWeeks}
          </span>
        )}
      </div>

      {/* Flecha derecha: Semana siguiente */}
      <button
        type="button"
        onClick={onNextWeek}
        className="size-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer active:scale-95"
        aria-label="Semana siguiente"
      >
        <ChevronRight className="size-4" />
      </button>
    </header>
  )
}
