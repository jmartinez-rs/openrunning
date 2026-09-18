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
      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-slate-700 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-400">
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div>
            <div className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              {streakWeeks > 0 ? (
                <>
                  <span>{streakWeeks} semanas de racha</span>
                  <span className="text-sm">🔥</span>
                </>
              ) : (
                <>
                  <span>Racha Semanal</span>
                  <span className="text-sm text-slate-400 font-normal ml-1">0</span>
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-slate-400">
              {completedSessions} de {plannedSessions} sesiones esta semana
            </div>
          </div>
        </div>

        <Calendar className="w-5 h-5 text-slate-500 group-hover:text-orange-400 transition-colors" />
      </div>
    </div>
  );
};
