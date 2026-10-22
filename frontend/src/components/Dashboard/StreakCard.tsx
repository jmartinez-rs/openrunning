import { Calendar, Flame, Trophy } from "lucide-react"
import type React from "react"
import { useMemo } from "react"
import { calculateRunnerXp, getRunnerLevel } from "@/lib/gamification"

interface StreakCardProps {
  streakWeeks: number
  completedSessions: number
  plannedSessions: number
  onOpenCalendar: () => void
}

export const StreakCard: React.FC<StreakCardProps> = ({
  streakWeeks,
  completedSessions,
  plannedSessions,
  onOpenCalendar,
}) => {
  const runnerLevel = useMemo(() => {
    const xp = calculateRunnerXp({
      totalKm: completedSessions * 8,
      completedWorkoutsCount: completedSessions,
      streakWeeks,
    })
    return getRunnerLevel(xp)
  }, [completedSessions, streakWeeks])

  return (
    <div
      onClick={onOpenCalendar}
      className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card hover:border-primary/20 backdrop-blur-md transition-all cursor-pointer group space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 text-primary">
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="text-base font-display font-bold text-white tracking-tight flex items-center gap-1.5">
              {streakWeeks > 0 ? (
                <>
                  <span className="text-primary">{streakWeeks}</span>
                  <span>semanas de racha</span>
                  <span className="text-sm">🔥</span>
                </>
              ) : (
                <>
                  <span>Racha Semanal</span>
                  <span className="text-sm text-muted-foreground font-normal ml-1">
                    0
                  </span>
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-muted-foreground">
              {completedSessions} de {plannedSessions} sesiones esta semana
            </div>
          </div>
        </div>

        <Calendar className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      {/* M6: Barra de Nivel & Experiencia (Gamificación) */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <Trophy className="size-3.5 text-amber-400" />
          <span>Nivel {runnerLevel.level}:</span>
          <span className="text-amber-300 font-medium text-[11px]">{runnerLevel.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${runnerLevel.progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-zinc-400">{runnerLevel.progressPercent}%</span>
        </div>
      </div>
    </div>
  )
}
