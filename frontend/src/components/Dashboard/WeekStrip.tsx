import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface DayStatus {
  dateIso: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  status: "done" | "plan" | "ovr" | "rest" | "empty";
  workoutTitle?: string;
}

interface WeekStripProps {
  days: DayStatus[];
  weekLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (day: DayStatus) => void;
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  days,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onPrevWeek}
          className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {weekLabel}
        </span>

        <button
          type="button"
          onClick={onNextWeek}
          className="p-1.5 rounded-lg bg-slate-800/80 text-slate-300 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {days.map((day) => {
          let dotColor = "bg-transparent";
          if (day.status === "done") dotColor = "bg-emerald-400 shadow-sm shadow-emerald-500/50";
          else if (day.status === "plan") dotColor = "bg-teal-400";
          else if (day.status === "ovr") dotColor = "bg-amber-400";

          return (
            <button
              key={day.dateIso}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all cursor-pointer select-none ${
                day.isToday
                  ? "bg-emerald-500/15 border border-emerald-500/40 text-white font-bold"
                  : "bg-slate-800/40 hover:bg-slate-800 border border-slate-800/60 text-slate-300"
              }`}
            >
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {day.dayName}
              </span>
              <span className="text-base font-extrabold mt-0.5 my-0.5">
                {day.dayNumber}
              </span>
              <span className={`w-2 h-2 rounded-full mt-0.5 ${dotColor}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
