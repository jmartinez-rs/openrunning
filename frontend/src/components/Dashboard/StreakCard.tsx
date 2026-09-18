import React from "react";
import { Flame, Calendar } from "lucide-react";

interface StreakCardProps {
  streakWeeks: number;
  completedSessions: number;
  plannedSessions: number;
  onOpenCalendar: () => void;
}

export const StreakCard: React.FC<StreakCardProps> = ({
  streakWeeks,
  completedSessions,
  plannedSessions,
  onOpenCalendar,
}) => {
  return (
    <div
      onClick={onOpenCalendar}
      className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card hover:border-primary/20 backdrop-blur-md transition-all cursor-pointer group"
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
                  <span className="text-sm text-muted-foreground font-normal ml-1">0</span>
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
    </div>
  );
};
