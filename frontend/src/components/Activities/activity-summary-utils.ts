const RUNNING_TYPES = new Set(["Run", "TrailRun", "VirtualRun"])
const CYCLING_TYPES = new Set(["Ride", "VirtualRide"])
const WALKING_TYPES = new Set(["Walk", "Hike"])
const SWIMMING_TYPES = new Set(["Swim"])
const STRENGTH_TYPES = new Set(["Workout", "WeightTraining", "strength"])

const CATEGORY_BG: Record<string, string> = {
  running: "bg-domain-cardio",
  cycling: "bg-domain-success",
  walking: "bg-domain-active",
  swimming: "bg-domain-pace",
  strength: "bg-domain-strength",
  other: "bg-domain-race",
}

const CATEGORY_TEXT: Record<string, string> = {
  running: "text-domain-cardio",
  cycling: "text-domain-success",
  walking: "text-domain-active",
  swimming: "text-domain-pace",
  strength: "text-domain-strength",
  other: "text-domain-race",
}

const CATEGORY_BG_SOFT: Record<string, string> = {
  running: "bg-domain-cardio/10",
  cycling: "bg-domain-success/10",
  walking: "bg-domain-active/10",
  swimming: "bg-domain-pace/10",
  strength: "bg-domain-strength/10",
  other: "bg-domain-race/10",
}

export function getTypeLabel(type: string): string {
  if (RUNNING_TYPES.has(type)) return "Running"
  if (CYCLING_TYPES.has(type)) return "Cycling"
  if (WALKING_TYPES.has(type)) return "Walking"
  if (SWIMMING_TYPES.has(type)) return "Swimming"
  if (STRENGTH_TYPES.has(type)) return "Gimnasio"
  return "Otro"
}

export function getCategoryFromType(type: string): string {
  if (RUNNING_TYPES.has(type)) return "running"
  if (CYCLING_TYPES.has(type)) return "cycling"
  if (WALKING_TYPES.has(type)) return "walking"
  if (SWIMMING_TYPES.has(type)) return "swimming"
  if (STRENGTH_TYPES.has(type)) return "strength"
  return "other"
}

export function categoryBg(category: string): string {
  return CATEGORY_BG[category] ?? CATEGORY_BG.other
}

export function categoryText(category: string): string {
  return CATEGORY_TEXT[category] ?? CATEGORY_TEXT.other
}

export function categoryBgSoft(category: string): string {
  return CATEGORY_BG_SOFT[category] ?? CATEGORY_BG_SOFT.other
}

export function formatElevation(meters: number | undefined): string {
  if (!meters) return "—"
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}
