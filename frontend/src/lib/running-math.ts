/**
 * OpenRunning Mathematics Library
 * Formulas and utilities for VDOT (Jack Daniels), Riegel Race Predictor,
 * Pace/Speed conversions, Heart Rate Zones and Training Paces.
 */

export interface RacePerformance {
  distanceMeters: number;
  timeSeconds: number;
}

export interface TrainingPaces {
  easyMin: string; // mm:ss /km
  easyMax: string;
  marathon: string;
  threshold: string;
  interval: string;
  repetition: string;
}

export interface HeartRateZones {
  z1Recovery: [number, number];
  z2Aerobic: [number, number];
  z3Tempo: [number, number];
  z4Threshold: [number, number];
  z5Anaerobic: [number, number];
}

/**
 * Converts pace in seconds per kilometer to a formatted "mm:ss" string.
 */
export function formatPace(secondsPerKm: number): string {
  if (isNaN(secondsPerKm) || secondsPerKm <= 0 || !isFinite(secondsPerKm)) {
    return "--:--";
  }
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
  return `${minutes}:${formattedSeconds}`;
}

/**
 * Parses a "mm:ss" pace string into total seconds per kilometer.
 */
export function parsePace(paceStr: string): number {
  if (!paceStr || !paceStr.includes(":")) return 0;
  const parts = paceStr.split(":");
  const mins = parseInt(parts[0], 10) || 0;
  const secs = parseInt(parts[1], 10) || 0;
  return mins * 60 + secs;
}

/**
 * Converts speed in km/h to pace in seconds per kilometer.
 */
export function kmhToPaceSeconds(kmh: number): number {
  if (kmh <= 0) return 0;
  return 3600 / kmh;
}

/**
 * Converts pace in seconds per kilometer to speed in km/h.
 */
export function paceSecondsToKmh(secondsPerKm: number): number {
  if (secondsPerKm <= 0) return 0;
  return 3600 / secondsPerKm;
}

/**
 * Estimates race finish time for a new target distance using Riegel's Formula:
 * T2 = T1 * (D2 / D1)^1.06
 */
export function predictTimeRiegel(
  sourceDistanceM: number,
  sourceTimeSec: number,
  targetDistanceM: number,
  exponent = 1.06
): number {
  if (sourceDistanceM <= 0 || sourceTimeSec <= 0 || targetDistanceM <= 0) return 0;
  return Math.round(sourceTimeSec * Math.pow(targetDistanceM / sourceDistanceM, exponent));
}

/**
 * Formats time in seconds to "hh:mm:ss" or "mm:ss".
 */
export function formatTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  const formattedSecs = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const formattedMins = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${formattedMins}:${formattedSecs}`;
  }
  return `${minutes}:${formattedSecs}`;
}

/**
 * Estimates Jack Daniels' VDOT value based on distance (meters) and time (seconds).
 * Using standard Daniels VDOT approximation formula.
 */
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  if (distanceMeters <= 0 || timeSeconds <= 0) return 0;
  const timeMinutes = timeSeconds / 60;
  const velocityMperMin = distanceMeters / timeMinutes;

  // Oxygen cost equation
  const vo2 =
    -4.60 +
    0.182258 * velocityMperMin +
    0.000104 * Math.pow(velocityMperMin, 2);

  // Drop-off / percent VO2 max equation
  const percentMax =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  const vdot = vo2 / percentMax;
  return Math.round(vdot * 10) / 10;
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
    };
  }

  // Linear approximations of velocity at intensity percentages of VDOT
  // Easy: ~65-75% VO2max
  // Marathon: ~80-85% VO2max
  // Threshold: ~88-90% VO2max
  // Interval: ~98-100% VO2max
  // Repetition: ~105-110% VO2max

  // Empirical pace seconds/km for VDOT thresholds:
  // VDOT 50 -> E: ~5:15-5:45, M: ~4:35, T: ~4:15, I: ~3:50, R: ~3:35
  const baseT = 3600 / (vdot * 0.28 + 3);
  const tPace = Math.max(150, baseT);

  const easyMinSec = tPace * 1.25;
  const easyMaxSec = tPace * 1.40;
  const marathonSec = tPace * 1.08;
  const thresholdSec = tPace;
  const intervalSec = tPace * 0.90;
  const repetitionSec = tPace * 0.83;

  return {
    easyMin: formatPace(easyMinSec),
    easyMax: formatPace(easyMaxSec),
    marathon: formatPace(marathonSec),
    threshold: formatPace(thresholdSec),
    interval: formatPace(intervalSec),
    repetition: formatPace(repetitionSec),
  };
}

/**
 * Computes 5 heart rate zones based on Max Heart Rate (Karvonen or standard HRmax).
 */
export function calculateHeartRateZones(maxHr: number, restHr = 0): HeartRateZones {
  if (maxHr <= 0) {
    return {
      z1Recovery: [0, 0],
      z2Aerobic: [0, 0],
      z3Tempo: [0, 0],
      z4Threshold: [0, 0],
      z5Anaerobic: [0, 0],
    };
  }

  if (restHr > 0 && restHr < maxHr) {
    const hrr = maxHr - restHr;
    const calc = (pct: number) => Math.round(restHr + hrr * pct);
    return {
      z1Recovery: [calc(0.5), calc(0.6)],
      z2Aerobic: [calc(0.6), calc(0.7)],
      z3Tempo: [calc(0.7), calc(0.8)],
      z4Threshold: [calc(0.8), calc(0.9)],
      z5Anaerobic: [calc(0.9), maxHr],
    };
  }

  const calcStd = (pct: number) => Math.round(maxHr * pct);
  return {
    z1Recovery: [calcStd(0.5), calcStd(0.6)],
    z2Aerobic: [calcStd(0.6), calcStd(0.7)],
    z3Tempo: [calcStd(0.7), calcStd(0.8)],
    z4Threshold: [calcStd(0.8), calcStd(0.9)],
    z5Anaerobic: [calcStd(0.9), maxHr],
  };
}
