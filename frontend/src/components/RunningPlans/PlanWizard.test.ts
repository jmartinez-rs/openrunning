import { describe, expect, it } from "vitest"
import { generatePlanStructure } from "./PlanWizard"
import { weekDaysISO } from "./running-utils"

function buildResult(overrides: {
  start_date?: string
  week_start_day?: number
  selectedDays?: number[]
  longRunDay?: number
  numWeeks?: number
}) {
  return generatePlanStructure({
    draft: {
      name: "Test Plan",
      goal: "",
      distance_km: 10,
      distance_unit: "km" as const,
      target_time_seconds: null,
      target_pace_seconds_per_km: null,
      start_date: overrides.start_date ?? "2026-01-04", // domingo
      end_date: "",
      week_start_day: overrides.week_start_day ?? 2, // martes
      status: "active" as const,
      race_id: null,
      notes: "",
      phases: [],
    },
    planType: "race",
    targetKm: 10,
    numWeeks: overrides.numWeeks ?? 4,
    userLevel: "intermediate",
    refDistanceKm: 5,
    refTimeSeconds: 1470,
    currentWeeklyKm: 20,
    longestRunKm: 8,
    selectedDays: overrides.selectedDays ?? [2, 4, 6, 0], // mar, jue, sáb, dom
    longRunDay: overrides.longRunDay ?? 0, // domingo
  })
}

describe("generatePlanStructure week alignment", () => {
  // start_date domingo + week_start_day martes: la semana 1 arranca el martes
  // anterior y nada se agenda antes del inicio del plan.
  const result = buildResult({})
  const week1 = result.phases[0].weeks[0]
  const allWeeks = result.phases.flatMap((p) => p.weeks)

  it("arranca la semana 1 el martes anterior al start_date", () => {
    expect(week1.start_date).toBe("2025-12-30")
    expect(new Date(`${week1.start_date}T12:00:00`).getDay()).toBe(2)
    expect(week1.end_date).toBe("2026-01-05")
  })

  it("ubica el domingo como día tardío de la semana, nunca como día 1", () => {
    const sunday = week1.workouts.find(
      (w) => new Date(`${w.date}T12:00:00`).getDay() === 0,
    )
    expect(sunday?.date).toBe("2026-01-04")
    // En una semana que empieza martes, el domingo es el 6º día (índice 5).
    expect(weekDaysISO(week1.start_date).indexOf("2026-01-04")).toBe(5)
  })

  it("no agenda workouts antes de start_date", () => {
    const allDates = allWeeks.flatMap((w) => w.workouts.map((wo) => wo.date))
    expect(allDates.length).toBeGreaterThan(0)
    for (const date of allDates) {
      expect(date >= (result.start_date ?? "")).toBe(true)
    }
    // La semana 1 solo conserva el domingo 04/01 (mar/jue/sáb caen antes).
    expect(week1.workouts.map((w) => w.date)).toEqual(["2026-01-04"])
  })

  it("fija end_date al calendario alineado y persiste week_start_day", () => {
    // firstWeekStart (2025-12-30) + numWeeks*7 - 1 = 2026-01-26
    expect(result.end_date).toBe("2026-01-26")
    expect(result.week_start_day).toBe(2)
  })
})

describe("generatePlanStructure week_start_day=7 (domingo)", () => {
  it("alinea la semana al domingo anterior cuando arranca miércoles", () => {
    const result = buildResult({
      start_date: "2026-01-07", // miércoles
      week_start_day: 7,
      selectedDays: [7, 3, 0],
    })
    const week1 = result.phases[0].weeks[0]
    expect(week1.start_date).toBe("2026-01-04") // domingo anterior
    expect(new Date(`${week1.start_date}T12:00:00`).getDay()).toBe(0)
    expect(week1.end_date).toBe("2026-01-10")
  })

  it("no agenda antes de start_date con inicio domingo", () => {
    const result = buildResult({
      start_date: "2026-01-07",
      week_start_day: 7,
      selectedDays: [7, 3, 0],
    })
    const allDates = result.phases
      .flatMap((p) => p.weeks)
      .flatMap((w) => w.workouts.map((wo) => wo.date))
    for (const date of allDates) expect(date >= "2026-01-07").toBe(true)
  })
})

describe("generatePlanStructure start_date ya alineado", () => {
  it("firstWeekStart == start_date y el domingo es el 6º día", () => {
    const result = buildResult({
      start_date: "2026-01-06", // martes
      week_start_day: 2,
    })
    const week1 = result.phases[0].weeks[0]
    expect(week1.start_date).toBe("2026-01-06")
    expect(weekDaysISO(week1.start_date).indexOf("2026-01-11")).toBe(5)
  })
})
