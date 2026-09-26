/**
 * OpenRunning Mathematics Library
 * Formulas and utilities for VDOT (Jack Daniels), Riegel Race Predictor,
 * Pace/Speed conversions, Heart Rate Zones and Training Paces.
 */

export interface RacePerformance {
  distanceMeters: number
  timeSeconds: number
}

export interface TrainingPaces {
  easyMin: string // mm:ss /km
  easyMax: string
  marathon: string
  threshold: string
  interval: string
  repetition: string
}

export interface HeartRateZones {
  z1Recovery: [number, number]
  z2Aerobic: [number, number]
  z3Tempo: [number, number]
  z4Threshold: [number, number]
  z5Anaerobic: [number, number]
}

/**
 * Converts pace in seconds per kilometer to a formatted "mm:ss" string.
 */
export function formatPace(secondsPerKm: number): string {
  if (
    Number.isNaN(secondsPerKm) ||
    secondsPerKm <= 0 ||
    !Number.isFinite(secondsPerKm)
  ) {
    return "--:--"
  }
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`
  return `${minutes}:${formattedSeconds}`
}

/**
 * Parses a "mm:ss" pace string into total seconds per kilometer.
 */
export function parsePace(paceStr: string): number {
  if (!paceStr?.includes(":")) return 0
  const parts = paceStr.split(":")
  const mins = parseInt(parts[0], 10) || 0
  const secs = parseInt(parts[1], 10) || 0
  return mins * 60 + secs
}

/**
 * Converts speed in km/h to pace in seconds per kilometer.
 */
export function kmhToPaceSeconds(kmh: number): number {
  if (kmh <= 0) return 0
  return 3600 / kmh
}

/**
 * Converts pace in seconds per kilometer to speed in km/h.
 */
export function paceSecondsToKmh(secondsPerKm: number): number {
  if (secondsPerKm <= 0) return 0
  return 3600 / secondsPerKm
}

/**
 * Estimates race finish time for a new target distance using Riegel's Formula:
 * T2 = T1 * (D2 / D1)^1.06
 */
export function predictTimeRiegel(
  sourceDistanceM: number,
  sourceTimeSec: number,
  targetDistanceM: number,
  exponent = 1.06,
): number {
  if (sourceDistanceM <= 0 || sourceTimeSec <= 0 || targetDistanceM <= 0)
    return 0
  return Math.round(
    sourceTimeSec * (targetDistanceM / sourceDistanceM) ** exponent,
  )
}

/**
 * Formats time in seconds to "hh:mm:ss" or "mm:ss".
 */
export function formatTime(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds <= 0) return "0:00"
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.round(totalSeconds % 60)

  const formattedSecs = seconds < 10 ? `0${seconds}` : `${seconds}`
  if (hours > 0) {
    const formattedMins = minutes < 10 ? `0${minutes}` : `${minutes}`
    return `${hours}:${formattedMins}:${formattedSecs}`
  }
  return `${minutes}:${formattedSecs}`
}

/**
 * Estimates Jack Daniels' VDOT value based on distance (meters) and time (seconds).
 * Using standard Daniels VDOT approximation formula.
 */
export function calculateVDOT(
  distanceMeters: number,
  timeSeconds: number,
): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 0
  const timeMinutes = timeSeconds / 60
  const velocityMperMin = distanceMeters / timeMinutes

  // Oxygen cost equation
  const vo2 =
    -4.6 + 0.182258 * velocityMperMin + 0.000104 * velocityMperMin ** 2

  // Drop-off / percent VO2 max equation
  const percentMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes)

  const vdot = vo2 / percentMax
  if (!Number.isFinite(vdot) || vdot <= 0) return 0
  return Math.round(vdot * 10) / 10
}

/**
 * Calculates Jack Daniels' training paces (Easy, Marathon, Threshold, Interval, Repetition)
 * given a VDOT score.
 */
export function getTrainingPaces(vdot: number): TrainingPaces {
  if (vdot <= 0) {
    return {
      easyMin: "--:--",
      easyMax: "--:--",
      marathon: "--:--",
      threshold: "--:--",
      interval: "--:--",
      repetition: "--:--",
    }
  }

  // Jack Daniels: velocidades de entrenamiento como fracción de VO2max.
  // Invertimos la ecuación de costo de oxígeno (VO2 = -4.6 + 0.182258*v +
  // 0.000104*v²) para obtener la velocidad (m/min) a cada intensidad y de ahí
  // el ritmo (s/km). Esto reemplaza la aproximación lineal previa, que daba
  // ritmos demasiado rápidos (p. ej. umbral ~4:18 para VDOT 39 en vez de ~5:12).
  const velocityForVo2 = (vo2: number): number => {
    const a = 0.000104
    const b = 0.182258
    const c = -(4.6 + vo2)
    const disc = b * b - 4 * a * c
    if (disc <= 0) return 0
    return (-b + Math.sqrt(disc)) / (2 * a)
  }
  const paceForFraction = (fraction: number): number => {
    const velocity = velocityForVo2(vdot * fraction)
    return velocity > 0 ? 60000 / velocity : 0
  }

  // Rangos de %VO2max por tipo de entrenamiento (Daniels' Running Formula).
  // Easy 59-74%, Marathon 84%, Threshold 88%, Interval 100%, Repetition 105%.
  const easyMinSec = paceForFraction(0.74) // extremo rápido del rango fácil
  const easyMaxSec = paceForFraction(0.59) // extremo lento del rango fácil
  const marathonSec = paceForFraction(0.84)
  const thresholdSec = paceForFraction(0.88)
  const intervalSec = paceForFraction(1.0)
  const repetitionSec = paceForFraction(1.05)

  return {
    easyMin: formatPace(easyMinSec),
    easyMax: formatPace(easyMaxSec),
    marathon: formatPace(marathonSec),
    threshold: formatPace(thresholdSec),
    interval: formatPace(intervalSec),
    repetition: formatPace(repetitionSec),
  }
}

/**
 * Computes 5 heart rate zones based on Max Heart Rate (Karvonen or standard HRmax).
 */
export function calculateHeartRateZones(
  maxHr: number,
  restHr = 0,
): HeartRateZones {
  if (maxHr <= 0) {
    return {
      z1Recovery: [0, 0],
      z2Aerobic: [0, 0],
      z3Tempo: [0, 0],
      z4Threshold: [0, 0],
      z5Anaerobic: [0, 0],
    }
  }

  if (restHr > 0 && restHr < maxHr) {
    const hrr = maxHr - restHr
    const calc = (pct: number) => Math.round(restHr + hrr * pct)
    return {
      z1Recovery: [calc(0.5), calc(0.6)],
      z2Aerobic: [calc(0.6), calc(0.7)],
      z3Tempo: [calc(0.7), calc(0.8)],
      z4Threshold: [calc(0.8), calc(0.9)],
      z5Anaerobic: [calc(0.9), maxHr],
    }
  }

  const calcStd = (pct: number) => Math.round(maxHr * pct)
  return {
    z1Recovery: [calcStd(0.5), calcStd(0.6)],
    z2Aerobic: [calcStd(0.6), calcStd(0.7)],
    z3Tempo: [calcStd(0.7), calcStd(0.8)],
    z4Threshold: [calcStd(0.8), calcStd(0.9)],
    z5Anaerobic: [calcStd(0.9), maxHr],
  }
}
