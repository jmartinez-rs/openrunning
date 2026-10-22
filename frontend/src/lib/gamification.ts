/**
 * OpenRunning Athlete Gamification & XP Engine.
 * Calculates runner levels, XP progression, and badges from training history.
 */

export interface AthleteGamificationStats {
  totalKm: number
  completedWorkoutsCount: number
  streakWeeks: number
  personalBestsCount?: number
}

export interface RunnerLevelInfo {
  level: number
  title: string
  currentXp: number
  nextLevelXp: number
  progressPercent: number
}

export function calculateRunnerXp(stats: AthleteGamificationStats): number {
  const kmXp = Math.round((stats.totalKm || 0) * 10)
  const workoutXp = (stats.completedWorkoutsCount || 0) * 50
  const streakXp = (stats.streakWeeks || 0) * 100
  const pbXp = (stats.personalBestsCount || 0) * 200
  return kmXp + workoutXp + streakXp + pbXp
}

export function getRunnerLevel(totalXp: number): RunnerLevelInfo {
  const safeXp = Math.max(0, totalXp)
  // Level threshold: Level L requires (L - 1)^2 * 150 XP
  // E.g., L1: 0, L2: 150, L3: 600, L4: 1350, L5: 2400...
  const level = Math.floor(Math.sqrt(safeXp / 150)) + 1

  const currentLevelBaseXp = Math.pow(level - 1, 2) * 150
  const nextLevelBaseXp = Math.pow(level, 2) * 150
  const range = nextLevelBaseXp - currentLevelBaseXp
  const currentInLevel = safeXp - currentLevelBaseXp
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentInLevel / range) * 100)))

  let title = "Novato en Pista"
  if (level >= 20) title = "Leyenda del Running 🏆"
  else if (level >= 15) title = "Maratonista Imparable ⚡"
  else if (level >= 10) title = "Atleta de Fondo Avanzado 🔥"
  else if (level >= 4) title = "Corredor Constante 🏃"
  else if (level >= 2) title = "Entusiasta del Asfalto 👟"

  return {
    level,
    title,
    currentXp: safeXp,
    nextLevelXp: nextLevelBaseXp,
    progressPercent,
  }
}
