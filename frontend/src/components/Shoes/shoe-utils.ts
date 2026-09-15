export const SHOE_CATEGORIES = [
  { value: "training" as const, label: "Entrenamiento" },
  { value: "race" as const, label: "Competencia" },
  { value: "trail" as const, label: "Trail" },
  { value: "easy" as const, label: "Rodaje" },
  { value: "mixed" as const, label: "Mixta" },
]

export function shoeCategoryLabel(value: string): string {
  return SHOE_CATEGORIES.find((c) => c.value === value)?.label ?? value
}

export function formatKm(meters: number | undefined | null): string {
  if (!meters) return "0 km"
  const km = meters / 1000
  return `${km.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm) return "—"
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`
}

export function usagePercent(
  usedMeters: number | undefined | null,
  targetKm: number | undefined | null,
): number {
  if (!targetKm || !usedMeters) return 0
  const usedKm = usedMeters / 1000
  return Math.min(Math.round((usedKm / targetKm) * 100), 100)
}
