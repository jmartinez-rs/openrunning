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

export function formatRunnaTime(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return "--:--"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`
}

export function formatRunnaDateTime(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const day = d.getDate()
  const month = new Intl.DateTimeFormat("es-AR", { month: "short" })
    .format(d)
    .replace(".", "")
    .trim()
  const year = d.getFullYear()
  const time = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
  return `${day} ${month} ${year} a las ${time}`
}
