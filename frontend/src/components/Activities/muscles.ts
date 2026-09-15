/** Mapeo de títulos de ejercicios a grupos musculares por palabras clave. */

const MUSCLE_KEYWORDS: Array<[string, string[]]> = [
  [
    "Pecho",
    [
      "press",
      "pecho",
      "bench",
      "pec",
      "push-up",
      "flexion",
      "chest",
      "apertura",
      "crucifijo",
      "fly",
    ],
  ],
  [
    "Espalda",
    [
      "espalda",
      "back",
      "remo",
      "row",
      "pull-down",
      "jalon",
      "dominada",
      "chin",
      "pull-up",
      "tirón",
      "tiron",
    ],
  ],
  [
    "Cuádriceps",
    [
      "sentadilla",
      "squat",
      "cuadriceps",
      "leg press",
      "prensa",
      "extension de pierna",
      "zancada",
      "lunge",
      "hack",
      "sissy",
    ],
  ],
  [
    "Isquiosurales",
    [
      "peso muerto",
      "deadlift",
      "isquio",
      "hamstring",
      "curl femoral",
      "leg curl",
      "good morning",
      "rumano",
    ],
  ],
  [
    "Glúteos",
    ["glute", "hip thrust", "puente", "bridge", "kickback", "cadera"],
  ],
  [
    "Hombros",
    [
      "hombro",
      "shoulder",
      "press militar",
      "overhead",
      "elevacion lateral",
      "lateral raise",
      "face pull",
      "deltoid",
      "deltoides",
      "vuelos",
    ],
  ],
  [
    "Bíceps",
    [
      "bicep",
      "curl de biceps",
      "curl con barra",
      "curl mancuerna",
      "martillo",
      "hammer",
      "concentrado",
      "predicador",
    ],
  ],
  [
    "Tríceps",
    [
      "tricep",
      "extension de triceps",
      "press frances",
      "frances",
      "pushdown",
      "fondo",
      "dips",
      "patada",
    ],
  ],
  [
    "Core",
    [
      "core",
      "abdominal",
      "abs",
      "crunch",
      "plancha",
      "plank",
      "leg raise",
      "russian twist",
      "pallof",
      "sit-up",
      "elevacion de piernas",
    ],
  ],
  [
    "Pantorrillas",
    ["pantorrilla", "calf", "gemelos", "elevacion de talones", "calf raise"],
  ],
]

export function muscleGroupForExercise(title: string): string {
  const normalized = title.toLowerCase()
  for (const [group, keywords] of MUSCLE_KEYWORDS) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) return group
    }
  }
  return "Otros"
}
