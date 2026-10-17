/**
 * Local-day key utilities for the dashboard.
 *
 * Single day-key authority: every calendar day key on the dashboard is derived
 * from the pinned running timezone below, never from the browser clock, never
 * from `Date.prototype.toISOString()` and never from local `getDate()` getters.
 * Mirrors the backend `RUNNING_TIMEZONE` (`app/services/running.py`).
 */

export const RUNNING_TIMEZONE = "America/Argentina/Buenos_Aires"

/** Builds `YYYY-MM-DD` from numeric `formatToParts` output of the pinned zone. */
const DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: RUNNING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const SHORT_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: RUNNING_TIMEZONE,
  day: "numeric",
  month: "short",
})

const ISO_DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

interface IsoParts {
  year: number
  month: number
  day: number
}

function parseIsoDayKey(iso: string): IsoParts {
  const match = ISO_DAY_KEY.exec(iso)
  if (!match) throw new Error(`Invalid ISO day key: ${iso}`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0")
}

/**
 * Day key (`YYYY-MM-DD`) of an instant in the pinned running timezone.
 * Uses `formatToParts` numeric parts, so the output never depends on the
 * locale pattern nor on the host timezone.
 */
export function formatDayKey(date: Date): string {
  const parts = DAY_KEY_FORMATTER.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) {
    throw new Error(`Unable to derive a day key from ${date.toISOString()}`)
  }
  return `${year}-${month}-${day}`
}

/**
 * Shifts a day key by `days`. Calendar arithmetic runs on a UTC instant built
 * from the key parts, so it is immune to host timezone and DST shifts.
 */
export function addDaysIso(iso: string, days: number): string {
  const { year, month, day } = parseIsoDayKey(iso)
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000)
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate(),
  )}`
}

/** Day of week of a day key: 0 = Sunday … 6 = Saturday. */
export function weekdayOfIso(iso: string): number {
  const { year, month, day } = parseIsoDayKey(iso)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Local Monday of the week containing `date`. */
export function mondayIso(date: Date): string {
  const iso = formatDayKey(date)
  const daysSinceMonday = (weekdayOfIso(iso) + 6) % 7
  return addDaysIso(iso, -daysSinceMonday)
}

/** The seven Mon-Sun day keys of the week that starts at `mondayIso`. */
export function weekIsoKeys(mondayIsoKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    addDaysIso(mondayIsoKey, index),
  )
}

/** Display-only short label ("10 mar") for a day key, formatted in the pinned zone. */
export function formatShortDayMonth(iso: string): string {
  const { year, month, day } = parseIsoDayKey(iso)
  // Noon UTC keeps the calendar day stable inside the pinned timezone.
  return SHORT_DAY_MONTH_FORMATTER.format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  ).replace(".", "")
}
