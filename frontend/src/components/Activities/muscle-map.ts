import type { Slug } from "react-muscle-highlighter"

export const HEVY_GROUP_LABELS: Record<string, string> = {
  abdominals: "Abdominales",
  shoulders: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebrazos",
  quadriceps: "Cuádriceps",
  hamstrings: "Isquiotibiales",
  calves: "Pantorrillas",
  glutes: "Glúteos",
  abductors: "Abductores",
  adductors: "Aductores",
  lats: "Dorsales",
  upper_back: "Espalda alta",
  traps: "Trapecios",
  lower_back: "Espalda baja",
  chest: "Pecho",
  neck: "Cuello",
}

export const SLUG_LABELS: Record<string, string> = {
  abs: "Abdominales",
  adductors: "Aductores",
  biceps: "Bíceps",
  calves: "Pantorrillas",
  chest: "Pecho",
  deltoids: "Hombros",
  forearm: "Antebrazos",
  gluteal: "Glúteos",
  hamstring: "Isquiotibiales",
  "lower-back": "Espalda baja",
  neck: "Cuello",
  quadriceps: "Cuádriceps",
  trapezius: "Trapecios",
  triceps: "Tríceps",
  "upper-back": "Dorsales",
}

const HEVY_TO_SLUG: Record<string, Slug | null> = {
  abdominals: "abs",
  shoulders: "deltoids",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  quadriceps: "quadriceps",
  hamstrings: "hamstring",
  calves: "calves",
  glutes: "gluteal",
  adductors: "adductors",
  lats: "upper-back",
  upper_back: "upper-back",
  traps: "trapezius",
  lower_back: "lower-back",
  chest: "chest",
  neck: "neck",
  abductors: null,
  cardio: null,
  full_body: null,
  other: null,
}

const FALLBACK_TO_SLUG: Record<string, Slug | null> = {
  Pecho: "chest",
  Espalda: "upper-back",
  Cuádriceps: "quadriceps",
  Isquiosurales: "hamstring",
  Glúteos: "gluteal",
  Hombros: "deltoids",
  Bíceps: "biceps",
  Tríceps: "triceps",
  Core: "abs",
  Pantorrillas: "calves",
  Antebrazo: "forearm",
  Trapecio: "trapezius",
  Lumbar: "lower-back",
  Otros: null,
}

export function hevyGroupToSlug(group: string): Slug | null {
  return HEVY_TO_SLUG[group] ?? null
}

export function fallbackGroupToSlug(group: string): Slug | null {
  return FALLBACK_TO_SLUG[group] ?? null
}
