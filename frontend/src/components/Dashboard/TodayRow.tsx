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
  let iconBg = "bg-primary/20 text-primary";

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
      className="flex items-center justify-between p-3.5 mt-3 bg-card/90 hover:bg-surface border border-white/5 rounded-xl transition-all cursor-pointer group shadow-card backdrop-blur-md"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <IconComponent className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/30">
            Cumplida ✓
          </span>
        ) : workoutType === "rest" ? (
          <span className="text-xs text-muted-foreground font-medium">Descanso</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 active:scale-95 transition-all shadow-glow">
            <Play className="w-3.5 h-3.5 fill-current" /> Ver Sesión
          </span>
        )}
      </div>
    </div>
  );
};
