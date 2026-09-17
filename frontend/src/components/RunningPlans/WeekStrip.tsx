import { cn } from "@/lib/utils"
import {
  formatDistance,
  getShortDayName,
  weekDaysISO,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "./running-utils"

interface WorkoutSlot {
  id: string
  date: string
  type: string
  status: string
  name?: string | null
  objective?: string | null
  distance_km?: number | null
  cancelled: boolean
}

interface WeekStripProps {
  /** ISO date of the Monday of the week to display */
  mondayISO: string
  /** Workouts to render in the strip */
  workouts: WorkoutSlot[]
  /** Optional: compact mode hides labels */
  compact?: boolean
  className?: string
}

function shortLabel(workout: WorkoutSlot): string {
  if (workout.distance_km != null && workout.distance_km > 0) {
    return formatDistance(workout.distance_km).replace(" km", "")
  }
  const meta = WORKOUT_TYPE_META[workout.type as WorkoutType]
  if (!meta) return ""
  // Abbreviate the label to max 5 chars
  const label = meta.label
  if (label.length <= 6) return label
  return `${label.slice(0, 5)}.`
}

export function WeekStrip({
  mondayISO,
  workouts,
  compact = false,
  className,
}: WeekStripProps) {
  const days = weekDaysISO(mondayISO)
  const today = new Date()
  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-")

  // Map workouts by date for O(1) lookup
  const byDate = new Map<string, WorkoutSlot>()
  for (const w of workouts) {
    byDate.set(w.date, w)
  }

  return (
    <div className={cn("grid grid-cols-7 gap-1", className)}>
      {days.map((dateISO) => {
        const dayDate = new Date(`${dateISO}T12:00:00`)
        const dayIndex = dayDate.getDay()
        const dayName = getShortDayName(dayIndex)
        const dayNum = dayDate.getDate()
        const isToday = dateISO === todayISO
        const workout = byDate.get(dateISO)

        const meta = workout
          ? WORKOUT_TYPE_META[workout.type as WorkoutType]
          : null
        const isCompleted = workout?.status === "completed"
        const isMissed = workout?.status === "missed"
        const isCancelled = workout?.cancelled || workout?.status === "cancelled"

        return (
          <div
            key={dateISO}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-all border",
              isToday && "bg-emerald-500/20 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-xs",
              !isToday && "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800",
            )}
          >
            {/* Day name */}
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                isToday ? "text-emerald-400" : "text-slate-400",
              )}
            >
              {dayName}
            </span>

            {/* Day number */}
            {!compact && (
              <span
                className={cn(
                  "text-xs font-bold",
                  isToday
                    ? "text-white"
                    : "text-slate-300",
                )}
              >
                {dayNum}
              </span>
            )}

            {/* Workout dot */}
            {workout && meta ? (
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-xl text-xs transition-all border shadow-xs",
                  isCancelled && "bg-slate-800/80 border-slate-700 text-slate-500 line-through opacity-60",
                  isMissed && "bg-red-500/15 border-red-500/30 text-red-400",
                  isCompleted && "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-bold",
                  !isCompleted &&
                    !isMissed &&
                    !isCancelled &&
                    "bg-slate-800 border-slate-700 text-slate-300",
                )}
              >
                {meta.emoji}
              </div>
            ) : (
              <div className="flex size-7 items-center justify-center">
                <div className="size-1.5 rounded-full bg-slate-700/80" />
              </div>
            )}

            {/* Short label */}
            {!compact && workout && meta && !isCancelled ? (
              <span
                className={cn(
                  "max-w-full truncate text-center text-[10px] font-bold leading-tight",
                  isCompleted
                    ? "text-emerald-400"
                    : isMissed
                      ? "text-red-400"
                      : "text-slate-400",
                )}
              >
                {shortLabel(workout)}
              </span>
            ) : !compact ? (
              <span className="text-[10px] leading-tight text-transparent select-none">
                —
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
