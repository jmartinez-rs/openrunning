import { Calendar, Clock, Flame, Footprints } from "lucide-react"
import type { ActivityPublic } from "@/client"

interface WorkoutCardProps {
  activity: ActivityPublic
  isActive?: boolean
}

export function WorkoutCard({ activity, isActive = false }: WorkoutCardProps) {
  // Use primary as the "neon" accent color to match Kinetic Volt's palette
  const accentColor = isActive ? "text-primary" : "text-muted-foreground"
  const borderColor = isActive ? "border-primary" : "border-border"
  const badgeBg = isActive
    ? "bg-primary text-primary-foreground"
    : "bg-transparent border border-border text-muted-foreground"

  // Format Distance
  const distance = activity.cardio?.distance_meters
    ? (activity.cardio.distance_meters / 1000).toFixed(2)
    : "0.00"

  // Format Duration
  const durSeconds = activity.duration_seconds || 0
  const h = Math.floor(durSeconds / 3600)
  const m = Math.floor((durSeconds % 3600) / 60)
  const s = durSeconds % 60
  const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`

  // Format Date
  const dateObj = new Date(activity.timestamp)
  const dateStr = dateObj
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
    .replace(/\//g, ".") // e.g. 23.04.24

  let dayName = dateObj.toLocaleDateString("es-AR", { weekday: "long" })
  dayName = dayName.charAt(0).toUpperCase() + dayName.slice(1)

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-w-[140px] px-4 py-6 rounded-[2rem] border-2 bg-background transition-all z-10 ${borderColor}`}
    >
      {/* Icon at top */}
      <div className={`mb-3 ${accentColor}`}>
        {activity.sport_type?.toLowerCase().includes("walk") ||
        activity.sport_type?.toLowerCase().includes("hike") ? (
          <Footprints className="size-6" />
        ) : activity.source_type === "hevy" ? (
          <Flame className="size-6" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
          >
            <path d="m14.4 7.6-.7.7-1.1-1.1a1 1 0 0 0-1.4 0l-3.2 3.2v3.6" />
            <path d="m18 19-.9-2.7a1 1 0 0 0-1-.7h-2.1l-.8-2.5-3.3 1" />
            <path d="M5.5 15.6a1 1 0 0 1-1-.4l-2.4-3.6" />
            <circle cx="14" cy="4" r="2" />
          </svg>
        )}
      </div>

      {/* Main Stat (Distance) */}
      <div
        className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-4 ${accentColor}`}
      >
        {distance} <span className="text-lg sm:text-xl font-bold">KM</span>
      </div>

      {/* Badges */}
      <div className="flex flex-col gap-2 w-full mt-1">
        <div
          className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 px-3 text-xs font-semibold ${badgeBg}`}
        >
          <Clock className="size-3.5" />
          {timeStr}
        </div>
        <div
          className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 px-3 text-xs font-semibold ${badgeBg}`}
        >
          <Calendar className="size-3.5 shrink-0" />
          <span className="truncate">
            {dayName} {dateStr}
          </span>
        </div>
      </div>
    </div>
  )
}
