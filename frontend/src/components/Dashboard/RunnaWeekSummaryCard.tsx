import { ChevronRight } from "lucide-react"
import type React from "react"

interface RunnaWeekSummaryCardProps {
  weekNumber: number
  completedWorkouts: number
  totalWorkouts: number
  completedKm: number
  totalWeekKm: number
  onNavigateToWeek?: () => void
}

export const RunnaWeekSummaryCard: React.FC<RunnaWeekSummaryCardProps> = ({
  weekNumber,
  completedWorkouts,
  totalWorkouts,
  completedKm,
  totalWeekKm,
  onNavigateToWeek,
}) => {
  const safeTotalWorkouts = Math.max(1, totalWorkouts)

  return (
    <div
      onClick={onNavigateToWeek}
      className="rounded-3xl bg-[#17171a] border border-white/10 p-5 shadow-card hover:border-white/20 transition-all cursor-pointer group"
    >
      {/* Título de la tarjeta */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-display font-black text-white group-hover:text-primary transition-colors">
          Resumen de la semana {weekNumber}
        </h3>
        <ChevronRight className="size-4 text-zinc-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>

      {/* Barra de progreso segmentada estilo Runna */}
      <div className="flex items-center gap-1.5 my-3.5">
        {Array.from({ length: safeTotalWorkouts }).map((_, idx) => {
          const isDone = idx < completedWorkouts
          return (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                isDone
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                  : "bg-white/10"
              }`}
            />
          )
        })}
      </div>

      {/* Fila de métricas inferior: Entrenamientos y Distancia */}
      <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
        <div>
          <span>Entrenamientos: </span>
          <span className="text-white font-mono">
            {completedWorkouts}/{totalWorkouts}
          </span>
        </div>
        <div>
          <span>Distancia: </span>
          <span className="text-white font-mono uppercase">
            {completedKm.toFixed(1)}/{totalWeekKm > 0 ? totalWeekKm.toFixed(1) : "0"}KM
          </span>
        </div>
      </div>
    </div>
  )
}
