import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"

export interface DayStatus {
  dateIso: string
  dayName: string
  dayNumber: number
  isToday: boolean
  status: "done" | "plan" | "ovr" | "rest" | "empty"
  workoutTitle?: string
  activityId?: string
}

interface WeekStripProps {
  days: DayStatus[]
  weekLabel: string
  onPrevWeek: () => void
  onNextWeek: () => void
  onSelectDay: (day: DayStatus) => void
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  days,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
}) => {
  return (
    <div className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card backdrop-blur-md">
      {/* Header with week navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onPrevWeek}
          className="p-1.5 rounded-lg bg-surface-container-high/80 text-muted-foreground hover:bg-surface-container-highest active:scale-95 transition-all cursor-pointer"
          aria-label="Previous week"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {weekLabel}
        </span>

        <button
          type="button"
          onClick={onNextWeek}
          className="p-1.5 rounded-lg bg-surface-container-high/80 text-muted-foreground hover:bg-surface-container-highest active:scale-95 transition-all cursor-pointer"
          aria-label="Next week"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 7-day strip */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {days.map((day) => {
          let dotColor = "bg-transparent"
          if (day.status === "done")
            dotColor = "bg-primary shadow-sm shadow-glow"
          else if (day.status === "plan") dotColor = "bg-primary/70"
          else if (day.status === "ovr") dotColor = "bg-amber-400"

          return (
            <button
              key={day.dateIso}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all cursor-pointer select-none ${
                day.isToday
                  ? "bg-primary/15 border border-primary/40 text-white font-bold"
                  : "bg-surface-dim hover:bg-surface border border-white/5 text-muted-foreground"
              }`}
            >
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {day.dayName}
              </span>
              <span className="text-base font-display font-bold mt-0.5 my-0.5 text-white">
                {day.dayNumber}
              </span>
              <span className={`w-2 h-2 rounded-full mt-0.5 ${dotColor}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
