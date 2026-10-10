import { ChevronRight, Sun } from "lucide-react"
import type React from "react"
import type { RunningWorkoutPublic } from "@/client"
import {
  blocksDistanceKm,
  formatDistance,
  formatPace,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "./running-utils"

interface PaccerSessionCardProps {
  workout: RunningWorkoutPublic
  onClick: () => void
}

const DAYS_ABBR = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"]

export const PaccerSessionCard: React.FC<PaccerSessionCardProps> = ({
  workout,
  onClick,
}) => {
  const typeMeta = WORKOUT_TYPE_META[workout.type as WorkoutType] ?? WORKOUT_TYPE_META.easy_run
  const distanceKm =
    workout.distance_km != null
      ? workout.distance_km
      : blocksDistanceKm(workout.blocks ?? [])

  const paceSec = workout.pace_seconds_per_km
  let paceFormatted = "--:--"
  if (paceSec && paceSec > 0) {
    paceFormatted = formatPace(paceSec).replace("/km", "").trim()
  }

  // Parse day of week and day of month
  const dateObj = new Date(`${workout.date}T12:00:00`)
  const dayName = DAYS_ABBR[dateObj.getDay()]
  const dayNumber = dateObj.getDate()

  // Border indicator color according to session type / intensity (Image 8)
  const isHard = workout.type === "intervals" || workout.type === "race"
  const isModerate = workout.type === "tempo" || workout.type === "long_run"
  const borderBarClass = isHard
    ? "bg-rose-500"
    : isModerate
      ? "bg-amber-400"
      : "bg-emerald-400"

  const isCompleted = workout.status === "completed"

  return (
    <div
      onClick={onClick}
      className="group relative flex overflow-hidden rounded-3xl border border-white/5 bg-[#121214] p-4 shadow-card hover:border-primary/30 transition-all cursor-pointer"
    >
      {/* Lateral color bar indicator (Image 8) */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full ${borderBarClass}`}
      />

      <div className="flex flex-1 items-center justify-between pl-3 pr-1 gap-4">
        {/* Day Number and Abbr */}
        <div className="flex flex-col items-center justify-center min-w-[42px] shrink-0 border-r border-white/5 pr-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 leading-none">
            {dayName}
          </span>
          <span className="text-2xl font-display font-black text-white leading-none mt-1">
            {dayNumber}
          </span>
        </div>

        {/* Workout Title and Distance */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-primary transition-colors">
            {workout.name || typeMeta.label}
          </h4>
          <span className="text-lg font-display font-black text-white block mt-0.5">
            {distanceKm ? `${formatDistance(distanceKm).replace(" km", "")}km` : "--"}
          </span>

          {/* Weather preview chip (Image 8) */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1">
            <Sun className="size-3 text-amber-400" />
            <span>Despejado · 14° / 20°</span>
          </div>
        </div>

        {/* Target Pace and Status / Arrow */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
              Pace
            </span>
            <span className="text-sm font-bold font-mono text-white">
              {paceFormatted}
            </span>
          </div>

          {/* Completion indicator circle */}
          <div
            className={`size-6 rounded-full flex items-center justify-center border transition-all ${
              isCompleted
                ? "bg-primary border-primary text-black font-bold text-xs"
                : "border-white/10 bg-white/5 text-transparent"
            }`}
          >
            {isCompleted ? "✓" : ""}
          </div>

          <ChevronRight className="size-5 text-zinc-500 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  )
}
