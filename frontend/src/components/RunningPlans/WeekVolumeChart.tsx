import { cn } from "@/lib/utils"
import { getShortDayName, weekDaysISO } from "./running-utils"

interface WorkoutSlot {
  id: string
  date: string
  type: string
  status: string
  distance_km?: number | null
  cancelled: boolean
}

interface WeekVolumeChartProps {
  mondayISO: string
  workouts: WorkoutSlot[]
  className?: string
}

export function WeekVolumeChart({
  mondayISO,
  workouts,
  className,
}: WeekVolumeChartProps) {
  const days = weekDaysISO(mondayISO)
  const today = new Date()
  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-")

  const byDate = new Map<string, WorkoutSlot>()
  for (const w of workouts) {
    byDate.set(w.date, w)
  }

  // Find max distance to scale the bars
  let maxDistance = 5 // minimum scale of 5km
  for (const w of workouts) {
    if (w.distance_km && w.distance_km > maxDistance && !w.cancelled) {
      maxDistance = w.distance_km
    }
  }

  const TOTAL_SEGMENTS = 10

  return (
    <div className={cn("grid grid-cols-7 gap-1 sm:gap-2", className)}>
      {days.map((dateISO) => {
        const dayDate = new Date(`${dateISO}T12:00:00`)
        const dayIndex = dayDate.getDay()
        const dayName = getShortDayName(dayIndex)
        const isToday = dateISO === todayISO
        const workout = byDate.get(dateISO)

        const isCompleted = workout?.status === "completed"
        const isMissed = workout?.status === "missed"
        const isCancelled =
          workout?.cancelled || workout?.status === "cancelled"

        const distance = workout?.distance_km || 0
        const hasWorkout = !!workout && distance > 0 && !isCancelled

        // Calculate how many segments should be filled based on distance
        const percent = hasWorkout
          ? Math.min(100, (distance / maxDistance) * 100)
          : 0
        const activeSegments = Math.ceil((percent / 100) * TOTAL_SEGMENTS)

        return (
          <div key={dateISO} className="flex flex-col items-center gap-2">
            {/* Top Label (Distance) */}
            <div className="h-4 text-[10px] font-bold text-muted-foreground">
              {hasWorkout ? `${distance}km` : ""}
            </div>

            {/* Segmented Bar */}
            <div className="flex flex-col-reverse gap-[2px] h-24 w-full px-1">
              {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => {
                const isActive = i < activeSegments
                let bgColor = "bg-surface-container-high"
                if (isActive) {
                  if (isCompleted) bgColor = "bg-primary"
                  else if (isMissed) bgColor = "bg-destructive"
                  else bgColor = "bg-primary/70" // planned
                }

                return (
                  <div
                    key={i}
                    className={cn(
                      "w-full flex-1 rounded-sm transition-all",
                      bgColor,
                    )}
                  />
                )
              })}
            </div>

            {/* Bottom Label (Day Name) */}
            <div
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider mt-1",
                isToday ? "text-primary" : "text-on-surface-variant",
              )}
            >
              {dayName}
            </div>
          </div>
        )
      })}
    </div>
  )
}
