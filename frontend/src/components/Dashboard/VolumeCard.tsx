import React from "react";
import { Flame, Calendar } from "lucide-react";

interface VolumeCardProps {
  currentKm: number;
  targetKm: number;
  streakWeeks: number;
  completedSessions: number;
  plannedSessions: number;
  onOpenCalendar: () => void;
}

export const VolumeCard: React.FC<VolumeCardProps> = ({
  currentKm,
  targetKm,
  streakWeeks,
  completedSessions,
  plannedSessions,
  onOpenCalendar,
}) => {
  const percentage = Math.min(100, Math.round((currentKm / (targetKm || 1)) * 100));

  return (
    <div
      onClick={onOpenCalendar}
      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-slate-700 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-500/15 text-orange-400">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              <span>{streakWeeks} semanas de racha</span>
              <span className="text-sm">🔥</span>
            </div>
            <div className="text-xs text-slate-400">
              {completedSessions} de {plannedSessions} sesiones esta semana
            </div>
          </div>
        </div>

        <Calendar className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between items-baseline text-xs mb-1.5">
          <span className="font-semibold text-slate-300">Volumen Semanal</span>
          <span className="font-extrabold text-emerald-400">
            {currentKm.toFixed(1)} / {targetKm.toFixed(1)} km · {percentage}%
          </span>
        </div>

        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};
