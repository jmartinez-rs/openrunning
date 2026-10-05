import { describe, expect, it } from "vitest"
import {
  alignIsoToWeekStart,
  getCurrentWeekFromPhases,
  getDayToIsoWeekday,
  getWeekBoundsISO,
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
