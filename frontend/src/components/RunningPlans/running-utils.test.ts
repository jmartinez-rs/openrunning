import { describe, expect, it } from "vitest"
import type {
  RunningPhasePublic,
  RunningWeekPublic,
  RunningWorkoutPublic,
} from "@/client"
import {
  addDaysToIso,
  alignIsoToWeekStart,
  buildWeeklyOverview,
  computeProgressToDate,
  computeWeeklyVolumeKm,
  formatRunnaDateRange,
  getCurrentWeekFromPhases,
  getDayToIsoWeekday,
  getNextWorkout,
  getRunnaWeekday,
  getRunnaWorkoutColor,
  getWeekBoundsISO,
  getWeekStatus,
  isoWeekdayToGetDay,
  raceTimeInputToSeconds,
  weekDaysISO,
} from "./running-utils"

describe("raceTimeInputToSeconds", () => {
  it("parses mm:ss (2 parts) as minutes:seconds", () => {
    // Regresión: antes se interpretaba como hh:mm y colapsaba el VDOT.
    expect(raceTimeInputToSeconds("50:00")).toBe(3000)
    expect(raceTimeInputToSeconds("24:30")).toBe(1470)
  })

  it("parses h:mm:ss (3 parts)", () => {
    expect(raceTimeInputToSeconds("1:30:00")).toBe(5400)
    expect(raceTimeInputToSeconds("00:24:30")).toBe(1470)
  })

  it("parses a single number as minutes", () => {
    expect(raceTimeInputToSeconds("24")).toBe(1440)
  })

  it("returns null for empty or invalid input", () => {
    expect(raceTimeInputToSeconds("")).toBeNull()
    expect(raceTimeInputToSeconds("abc")).toBeNull()
    expect(raceTimeInputToSeconds("1:2:3:4")).toBeNull()
  })
})

describe("week start day helpers", () => {
  it("maps JS getDay to ISO weekday", () => {
    expect(getDayToIsoWeekday(0)).toBe(7) // domingo
    expect(getDayToIsoWeekday(1)).toBe(1)
    expect(getDayToIsoWeekday(6)).toBe(6)
  })

  it("maps ISO weekday to JS getDay", () => {
    expect(isoWeekdayToGetDay(7)).toBe(0)
    expect(isoWeekdayToGetDay(1)).toBe(1)
  })

  it("aligns a Sunday to the previous Tuesday (week_start_day=2)", () => {
    // 2026-01-04 es domingo; el martes anterior es 2025-12-30.
    expect(alignIsoToWeekStart("2026-01-04", 2)).toBe("2025-12-30")
  })

  it("getWeekBoundsISO respects the configured week start", () => {
    const sunday = new Date("2026-01-04T12:00:00")
    expect(getWeekBoundsISO(sunday, 2)).toEqual({
      weekStart: "2025-12-30",
      weekEnd: "2026-01-05",
    })
    expect(getWeekBoundsISO(sunday, 1)).toEqual({
      weekStart: "2025-12-29",
      weekEnd: "2026-01-04",
    })
  })

  it("orders the 7 days from the week start; Sunday is last for a Monday start", () => {
    const days = weekDaysISO(alignIsoToWeekStart("2026-01-04", 1))
    expect(days).toHaveLength(7)
    expect(days[0]).toBe("2025-12-29")
    expect(days[6]).toBe("2026-01-04")
  })
})

describe("getCurrentWeekFromPhases", () => {
  const phases = [
    {
      name: "Fase Base",
      color: "emerald",
      weeks: [
        {
          id: "w1",
          number: 1,
          start_date: "2026-01-06",
          end_date: "2026-01-12",
          workouts: [],
        },
        {
          id: "w2",
          number: 2,
          start_date: "2026-01-13",
          end_date: "2026-01-19",
          workouts: [],
        },
      ],
    },
  ]

  it("devuelve null antes de la primera semana", () => {
    expect(
      getCurrentWeekFromPhases(phases, new Date("2026-01-01T12:00:00")),
    ).toBeNull()
  })

  it("devuelve null después de la última semana", () => {
    expect(
      getCurrentWeekFromPhases(phases, new Date("2026-02-01T12:00:00")),
    ).toBeNull()
  })

  it("devuelve la semana correcta dentro del rango", () => {
    const current = getCurrentWeekFromPhases(
      phases,
      new Date("2026-01-14T12:00:00"),
    )
    expect(current?.weekNumber).toBe(2)
    expect(current?.weekId).toBe("w2")
    expect(current?.phaseName).toBe("Fase Base")
    expect(current?.startDate).toBe("2026-01-13")
    expect(current?.endDate).toBe("2026-01-19")
  })
})

// ---------------------------------------------------------------------------
// Lectura jerárquica: buildWeeklyOverview / getNextWorkout / computeProgressToDate
// ---------------------------------------------------------------------------

function makeWorkout(
  over: Partial<RunningWorkoutPublic> &
    Pick<RunningWorkoutPublic, "id" | "date" | "status">,
): RunningWorkoutPublic {
  return {
    id: over.id,
    date: over.date,
    status: over.status,
    type: over.type ?? "easy_run",
    objective: over.objective ?? null,
    name: over.name ?? null,
    distance_km: over.distance_km ?? 5,
    duration_seconds: over.duration_seconds ?? null,
    pace_seconds_per_km: over.pace_seconds_per_km ?? null,
    intensity: over.intensity ?? "easy",
    description: over.description ?? null,
    notes: over.notes ?? null,
    cancelled: over.cancelled ?? over.status === "cancelled",
    matched_activity: over.matched_activity ?? null,
    blocks: over.blocks ?? [],
    status_override: over.status_override,
    matched_activity_id: over.matched_activity_id,
  }
}

function makeWeek(
  id: string,
  number: number,
  over: Partial<RunningWeekPublic> = {},
): RunningWeekPublic {
  return {
    id,
    number,
    start_date: over.start_date ?? null,
    end_date: over.end_date ?? null,
    name: over.name ?? null,
    objective: over.objective ?? null,
    notes: over.notes ?? null,
    workouts: over.workouts ?? [],
  }
}

function makePhase(
  over: Partial<RunningPhasePublic> & Pick<RunningPhasePublic, "name">,
): RunningPhasePublic {
  return {
    id: over.id ?? over.name,
    position: over.position ?? 1,
    name: over.name,
    color: over.color ?? "emerald",
    start_week: over.start_week ?? 1,
    end_week: over.end_week ?? 1,
    objective: over.objective ?? null,
    description: over.description ?? null,
    weeks: over.weeks ?? [],
  }
}

describe("getWeekStatus", () => {
  it("clasifica pasado / actual / futuro", () => {
    const ref = new Date("2026-01-14T12:00:00")
    expect(getWeekStatus("2026-01-05", "2026-01-11", ref)).toBe("past")
    expect(getWeekStatus("2026-01-12", "2026-01-18", ref)).toBe("current")
    expect(getWeekStatus("2026-01-19", "2026-01-25", ref)).toBe("future")
  })

  it("sin fecha de inicio devuelve future", () => {
    expect(getWeekStatus(null, null, new Date("2026-01-14T12:00:00"))).toBe(
      "future",
    )
  })

  it("infiere el fin a 6 días del inicio si falta", () => {
    const ref = new Date("2026-01-17T12:00:00")
    expect(getWeekStatus("2026-01-12", null, ref)).toBe("current")
    expect(
      getWeekStatus("2026-01-12", null, new Date("2026-01-19T12:00:00")),
    ).toBe("past")
  })
})

describe("computeWeeklyVolumeKm", () => {
  it("suma distance_km y cae a los bloques cuando falta", () => {
    const km = computeWeeklyVolumeKm([
      { distance_km: 5 },
      {
        distance_km: null,
        blocks: [
          { repeats: 4, distance_m: 1000 },
          { repeats: 1, distance_m: 500 },
        ],
      },
    ])
    expect(km).toBe(9.5)
  })
})

describe("buildWeeklyOverview", () => {
  it("respeta phaseColor y week_start_day (grilla de fallback)", () => {
    const phases = [
      makePhase({
        name: "Base",
        color: "sky",
        start_week: 1,
        end_week: 2,
        weeks: [
          makeWeek("w1", 1, {
            start_date: "2026-01-04",
            end_date: "2026-01-10",
          }),
          makeWeek("w2", 2), // sin fechas → derivadas del ancla
        ],
      }),
    ]

    const weeks = buildWeeklyOverview(
      phases,
      new Date("2026-01-05T12:00:00"),
      2, // semana empieza el martes
    )

    expect(weeks).toHaveLength(2)
    expect(weeks[0].phaseColor).toBe("sky")
    expect(weeks[0].status).toBe("current")
    // ancla alineada al martes: 2026-01-04 (dom) → 2025-12-30, +7 = 2026-01-06
    expect(weeks[1].startDate).toBe("2026-01-06")
    expect(weeks[1].status).toBe("future")
  })

  it("marca semanas de descarga por nombre o por caída de volumen", () => {
    const phases = [
      makePhase({
        name: "Carga",
        weeks: [
          makeWeek("w1", 1, {
            start_date: "2026-01-05",
            workouts: [
              makeWorkout({
                id: "a",
                date: "2026-01-06",
                status: "planned",
                distance_km: 10,
              }),
            ],
          }),
          makeWeek("w2", 2, {
            start_date: "2026-01-12",
            name: "Descarga",
            workouts: [
              makeWorkout({
                id: "b",
                date: "2026-01-13",
                status: "planned",
                distance_km: 5,
              }),
            ],
          }),
          makeWeek("w3", 3, {
            start_date: "2026-01-19",
            workouts: [
              makeWorkout({
                id: "c",
                date: "2026-01-20",
                status: "planned",
                distance_km: 3,
              }),
            ],
          }),
        ],
      }),
    ]
    const weeks = buildWeeklyOverview(phases, new Date("2026-01-05"))
    expect(weeks[1].isRestOrCutback).toBe(true) // por nombre
    expect(weeks[2].isRestOrCutback).toBe(true) // por heurística (3 ≤ 5*0.75)
  })
})

describe("getNextWorkout", () => {
  it("salta completadas y canceladas y devuelve la de hoy", () => {
    const phases = [
      makePhase({
        name: "Base",
        weeks: [
          makeWeek("w1", 1, {
            start_date: "2026-01-12",
            workouts: [
              makeWorkout({
                id: "past",
                date: "2026-01-13",
                status: "completed",
              }),
              makeWorkout({
                id: "missed",
                date: "2026-01-12",
                status: "missed",
              }),
              makeWorkout({
                id: "today",
                date: "2026-01-14",
                status: "planned",
              }),
              makeWorkout({
                id: "cancel",
                date: "2026-01-15",
                status: "cancelled",
              }),
              makeWorkout({
                id: "later",
                date: "2026-01-16",
                status: "planned",
              }),
            ],
          }),
        ],
      }),
    ]
    const weeks = buildWeeklyOverview(phases, new Date("2026-01-14T12:00:00"))
    const next = getNextWorkout(weeks, new Date("2026-01-14T12:00:00"))
    expect(next?.workout.id).toBe("today")
    expect(next?.week.number).toBe(1)
  })

  it("devuelve null cuando no quedan sesiones pendientes", () => {
    const phases = [
      makePhase({
        name: "Base",
        weeks: [
          makeWeek("w1", 1, {
            start_date: "2026-01-12",
            workouts: [
              makeWorkout({
                id: "d1",
                date: "2026-01-13",
                status: "completed",
              }),
              makeWorkout({
                id: "d2",
                date: "2026-01-14",
                status: "cancelled",
              }),
            ],
          }),
        ],
      }),
    ]
    const weeks = buildWeeklyOverview(phases, new Date("2026-01-20T12:00:00"))
    expect(getNextWorkout(weeks, new Date("2026-01-20T12:00:00"))).toBeNull()
  })
})

describe("computeProgressToDate", () => {
  it("mide contra lo planificado a la fecha, no contra el total del plan", () => {
    const weeksFixture = Array.from({ length: 12 }, (_, i) => {
      const number = i + 1
      const start = addDaysToIso("2026-01-05", i * 7)
      const status: RunningWorkoutPublic["status"] =
        number === 1 ? "completed" : "planned"
      return makeWeek(`w${number}`, number, {
        start_date: start,
        workouts: [
          makeWorkout({
            id: `x${number}`,
            date: start,
            status,
            distance_km: 5,
          }),
        ],
      })
    })
    const phases = [makePhase({ name: "Plan 12", weeks: weeksFixture })]

    // Semana 3 de 12: 2026-01-19.
    const ref = new Date("2026-01-21T12:00:00")
    const weeks = buildWeeklyOverview(phases, ref)
    const progress = computeProgressToDate(weeks, ref)

    expect(progress.plannedToDate).toBe(3)
    expect(progress.completed).toBe(1)
    expect(progress.percent).toBe(33)
    // No es el 8% artificial que daría dividir por el total (1/12).
    expect(progress.percent).not.toBe(Math.round((1 / 12) * 100))
  })

  it("devuelve 0% y plannedToDate 0 si aún no empezó", () => {
    const phases = [
      makePhase({
        name: "Futuro",
        weeks: [
          makeWeek("w1", 1, {
            start_date: "2026-06-01",
            workouts: [
              makeWorkout({ id: "a", date: "2026-06-02", status: "planned" }),
            ],
          }),
        ],
      }),
    ]
    const ref = new Date("2026-01-01T12:00:00")
    const weeks = buildWeeklyOverview(phases, ref)
    const progress = computeProgressToDate(weeks, ref)
    expect(progress.plannedToDate).toBe(0)
    expect(progress.percent).toBe(0)
  })
})

describe("Runna-inspired helpers", () => {
  it("formatRunnaDateRange formatea en mayúsculas estilo Runna", () => {
    // 2026-10-12 a 2026-10-18
    const formatted = formatRunnaDateRange("2026-10-12", "2026-10-18")
    expect(formatted).toMatch(/12 OCT - 18 OCT/i)
  })

  it("getRunnaWeekday devuelve el nombre del día abreviado capitalizado", () => {
    // 2026-10-16 es un viernes
    const day = getRunnaWeekday("2026-10-16")
    expect(day.toLowerCase()).toContain("vie")
  })

  it("getRunnaWorkoutColor devuelve las clases de color correctas para cada tipo", () => {
    expect(getRunnaWorkoutColor("easy_run").bg).toContain("lime")
    expect(getRunnaWorkoutColor("long_run").bg).toContain("purple")
    expect(getRunnaWorkoutColor("intervals").bg).toContain("orange")
    expect(getRunnaWorkoutColor("tempo").bg).toContain("amber")
  })
})
