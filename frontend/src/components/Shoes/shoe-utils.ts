import type { ShoePublic, ShoeStatsPublic } from "@/client"

export interface ShoeCategoryOption {
  value: "easy" | "training" | "mixed" | "race" | "trail"
  label: string
  shortLabel: string
  description: string
  badgeClass: string
  recommendedTypes: string[]
}

export const SHOE_CATEGORIES: ShoeCategoryOption[] = [
  {
    value: "easy",
    label: "Rodajes Suaves / Z2 (Easy)",
    shortLabel: "Rodaje Z2",
    description:
      "Máxima amortiguación para entrenamientos regenerativos y cómodos",
    badgeClass: "bg-card/90 text-foreground border-border",
    recommendedTypes: ["easy_run", "recovery"],
  },
  {
    value: "training",
    label: "Entrenamiento Diario (Daily Trainer)",
    shortLabel: "Entrenamiento",
    description: "Zapatillas versátiles y duraderas para el día a día",
    badgeClass: "bg-card/90 text-foreground border-border",
    recommendedTypes: ["easy_run", "long_run"],
  },
  {
    value: "mixed",
    label: "Series & Tempo (Mixtas / Calidad)",
    shortLabel: "Series / Tempo",
    description:
      "Calzado reactivo y ligero para series de velocidad y ritmo umbral",
    badgeClass: "bg-card/90 text-foreground border-border",
    recommendedTypes: ["tempo", "intervals", "fartlek", "activation"],
  },
  {
    value: "race",
    label: "Competencia / Carbono (Race Day)",
    shortLabel: "Competencia",
    description:
      "Zapatillas voladoras con placa de carbono para días de carrera",
    badgeClass: "bg-card/90 text-foreground border-border",
    recommendedTypes: ["race", "time_trial"],
  },
  {
    value: "trail",
    label: "Montaña & Terreno Técnico (Trail)",
    shortLabel: "Trail",
    description: "Agarre y protección para senderos, tierra y desniveles",
    badgeClass: "bg-card/90 text-foreground border-border",
    recommendedTypes: ["trail", "mountain"],
  },
]

export function shoeCategoryLabel(value: string): string {
  const cat = SHOE_CATEGORIES.find((c) => c.value === value)
  return cat ? cat.shortLabel : value
}

export function shoeCategoryMeta(value: string): ShoeCategoryOption {
  return (
    SHOE_CATEGORIES.find((c) => c.value === value) ?? {
      value: "training" as const,
      label: "Entrenamiento",
      shortLabel: "Entrenamiento",
      description: "Zapatillas de uso general",
      badgeClass:
        "bg-surface-container-high text-muted-foreground border-border",
      recommendedTypes: [],
    }
  )
}

export function formatKm(meters: number | undefined | null): string {
  if (!meters) return "0 km"
  const km = meters / 1000
  return `${km.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm) return "—"
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`
}

// ---------------------------------------------------------------------------
// Salud de la Espuma (Foam Health)
// ---------------------------------------------------------------------------

export interface FoamHealth {
  usedKm: number
  targetKm: number
  percent: number
  remainingKm: number
  status: "optimal" | "warning" | "critical"
  statusLabel: string
  badgeClass: string
  barColorClass: string
  colorHex: string
}

export function getFoamHealth(
  usedMeters: number | undefined | null,
  targetKmInput: number | undefined | null,
): FoamHealth {
  const usedKm = (usedMeters ?? 0) / 1000
  const targetKm = targetKmInput && targetKmInput > 0 ? targetKmInput : 700
  const percent = Math.round((usedKm / targetKm) * 100)
  const remainingKm = Math.max(0, Math.round(targetKm - usedKm))

  if (percent < 60) {
    return {
      usedKm: Math.round(usedKm * 10) / 10,
      targetKm,
      percent: Math.min(percent, 100),
      remainingKm,
      status: "optimal",
      statusLabel: "Óptima (0-60%)",
      badgeClass: "bg-card/90 text-primary border-border",
      barColorClass: "bg-primary",
      colorHex: "#eafc5f",
    }
  }

  if (percent < 85) {
    return {
      usedKm: Math.round(usedKm * 10) / 10,
      targetKm,
      percent: Math.min(percent, 100),
      remainingKm,
      status: "warning",
      statusLabel: "Desgaste Medio (60-85%)",
      badgeClass: "bg-card/90 text-amber-400 border-border",
      barColorClass: "bg-amber-400",
      colorHex: "#f59e0b",
    }
  }

  return {
    usedKm: Math.round(usedKm * 10) / 10,
    targetKm,
    percent: Math.min(percent, 100),
    remainingKm,
    status: "critical",
    statusLabel: "Reemplazo Sugerido (>85%)",
    badgeClass: "bg-card/90 text-destructive border-border",
    barColorClass: "bg-destructive",
    colorHex: "#ef4444",
  }
}

export function usagePercent(
  usedMeters: number | undefined | null,
  targetKm: number | undefined | null,
): number {
  return getFoamHealth(usedMeters, targetKm).percent
}

// ---------------------------------------------------------------------------
// Recomendador Algorítmico de Calzado por Sesión
// ---------------------------------------------------------------------------

export interface RecommendationResult {
  recommendedShoe: ShoePublic | null
  reason: string | null
  isOptimal: boolean
}

export function getShoeRecommendation(
  workoutType: string | undefined | null,
  shoes: ShoePublic[],
  statsMap?: Map<string, ShoeStatsPublic | undefined>,
): RecommendationResult {
  const activeShoes = shoes.filter((s) => s.is_active !== false)
  if (activeShoes.length === 0) {
    return { recommendedShoe: null, reason: null, isOptimal: false }
  }

  const type = workoutType ?? "easy_run"

  // Priority mapping based on workout type
  let targetCategory: "easy" | "training" | "mixed" | "race" | "trail" = "easy"
  if (
    type === "tempo" ||
    type === "intervals" ||
    type === "activation" ||
    type === "fartlek"
  ) {
    targetCategory = "mixed"
  } else if (type === "race" || type === "time_trial") {
    targetCategory = "race"
  } else if (type === "long_run") {
    targetCategory = "training"
  } else {
    targetCategory = "easy"
  }

  // Find exact category match with healthy foam (<85% usage)
  const categoryMatch = activeShoes.find((s) => {
    if (s.category !== targetCategory) return false
    const stats = statsMap?.get(s.id)
    const health = getFoamHealth(
      stats?.total_distance_meters,
      s.target_distance_km,
    )
    return health.status !== "critical"
  })

  if (categoryMatch) {
    const meta = shoeCategoryMeta(targetCategory)
    return {
      recommendedShoe: categoryMatch,
      reason: `Sugerencia: Zapatilla óptima recomendada para ${meta.shortLabel}`,
      isOptimal: true,
    }
  }

  // Fallback to any active shoe with healthy foam
  const healthyShoe =
    activeShoes.find((s) => {
      const stats = statsMap?.get(s.id)
      const health = getFoamHealth(
        stats?.total_distance_meters,
        s.target_distance_km,
      )
      return health.status !== "critical"
    }) ?? activeShoes[0]

  return {
    recommendedShoe: healthyShoe,
    reason: `Sugerencia: Par disponible en tu armario`,
    isOptimal: false,
  }
}

// ---------------------------------------------------------------------------
// Alerta de Rotación (EVA/PEBA Foam Rest)
// ---------------------------------------------------------------------------

export interface RotationAlert {
  needsRest: boolean
  reason: string | null
}

export function checkRotationAlert(
  shoeId: string,
  recentSessions: Array<{
    date: string
    shoe_id?: string | null
    type?: string | null
  }>,
): RotationAlert {
  if (!recentSessions || recentSessions.length === 0) {
    return { needsRest: false, reason: null }
  }

  const todayIso = new Date().toISOString().split("T")[0]
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayIso = yesterdayDate.toISOString().split("T")[0]

  // Check if shoe was used yesterday in a hard workout
  const yesterdayWorkout = recentSessions.find(
    (s) =>
      s.shoe_id === shoeId &&
      (s.date === yesterdayIso || s.date === todayIso) &&
      (s.type === "intervals" ||
        s.type === "tempo" ||
        s.type === "race" ||
        s.type === "long_run"),
  )

  if (yesterdayWorkout) {
    return {
      needsRest: true,
      reason:
        "⚠️ Alerta de Rotación: Se usó en un entreno exigente recientemente. Alterná a otro par para permitir que la espuma recupere su resiliencia.",
    }
  }

  return { needsRest: false, reason: null }
}
