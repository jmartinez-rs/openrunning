import type { ActivityCardioBase } from "@/client"

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes} min`
  return `${seconds}s`
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm) return "—"
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`
}

export function formatDistance(meters: number | undefined): string {
  if (!meters) return "—"
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function isCardio(activity: {
  source_type: string
  cardio?: ActivityCardioBase | null
}): boolean {
  return activity.source_type === "strava" || Boolean(activity.cardio)
}
