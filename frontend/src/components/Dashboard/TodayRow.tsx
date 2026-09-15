import React from "react";
import { Flame, Moon, Timer, Zap, Play } from "lucide-react";

interface TodayRowProps {
  sessionTitle: string;
  workoutType?: "easy_run" | "intervals" | "tempo" | "long_run" | "rest";
  isCompleted?: boolean;
  rescheduled?: boolean;
  onAction: () => void;
}

export const TodayRow: React.FC<TodayRowProps> = ({
  sessionTitle,
  workoutType = "easy_run",
  isCompleted = false,
  rescheduled = false,
  onAction,
}) => {
  let IconComponent = Zap;
  let iconBg = "bg-emerald-500/20 text-emerald-400";

  if (workoutType === "intervals") {
    IconComponent = Flame;
    iconBg = "bg-orange-500/20 text-orange-400";
  } else if (workoutType === "tempo") {
    IconComponent = Timer;
    iconBg = "bg-amber-500/20 text-amber-400";
  } else if (workoutType === "rest") {
    IconComponent = Moon;
    iconBg = "bg-slate-700/40 text-slate-400";
  }

  return (
    <div
      onClick={onAction}
      className="flex items-center justify-between p-3.5 mt-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <IconComponent className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Hoy
          </div>
          <div className="text-sm font-bold text-white truncate">
            {sessionTitle}
            {rescheduled && <span className="text-xs text-amber-400 font-normal ml-1">· repogramado</span>}
          </div>
        </div>
      </div>

      <div className="shrink-0 ml-2">
        {isCompleted ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Cumplida ✓
          </span>
        ) : workoutType === "rest" ? (
          <span className="text-xs text-slate-400 font-medium">Descanso</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 active:scale-95 transition-all shadow-md shadow-emerald-500/20">
            <Play className="w-3.5 h-3.5 fill-current" /> Ver Sesión
          </span>
        )}
      </div>
    </div>
  );
};
