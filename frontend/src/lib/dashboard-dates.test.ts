import { describe, expect, it } from "vitest"
import {
  addDaysIso,
  formatDayKey,
  mondayIso,
  RUNNING_TIMEZONE,
  weekdayOfIso,
  weekIsoKeys,
} from "./dashboard-dates"

describe("dashboard-dates", () => {
  it("pins the running timezone to Buenos Aires", () => {
    expect(RUNNING_TIMEZONE).toBe("America/Argentina/Buenos_Aires")
  })

  // S1 / E1 — 21:30 local on 2026-03-10 must not roll to 2026-03-11 (UTC would).
  it("keeps a 21:30 local instant on the local day (S1/E1)", () => {
    const lateEvening = new Date("2026-03-11T00:30:00Z")
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-03-11")
    expect(formatDayKey(lateEvening)).toBe("2026-03-10")
  })

  // S2 — 03:00 local belongs to the same calendar day, not the previous/next one.
  it("keeps a 03:00 local instant on the same local day (S2)", () => {
    expect(formatDayKey(new Date("2026-03-10T06:00:00Z"))).toBe("2026-03-10")
  })

  it("resolves every 21:00-24:00 local instant to that local day (E1)", () => {
    for (const hour of [21, 22, 23]) {
      const instant = new Date(Date.UTC(2026, 2, 10, hour + 3, 15))
      expect(formatDayKey(instant)).toBe("2026-03-10")
    }
  })

  it("never derives day keys from the UTC ISO string", () => {
    expect(formatDayKey(new Date("2026-01-01T02:00:00Z"))).toBe("2025-12-31")
  })

  it("builds zero-padded YYYY-MM-DD keys", () => {
    expect(formatDayKey(new Date("2026-03-15T12:00:00Z"))).toBe("2026-03-15")
  })

  it("shifts ISO day keys across month and year boundaries", () => {
    expect(addDaysIso("2026-03-10", 1)).toBe("2026-03-11")
    expect(addDaysIso("2026-03-31", 1)).toBe("2026-04-01")
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28")
    expect(addDaysIso("2026-01-01", -1)).toBe("2025-12-31")
    expect(addDaysIso("2026-03-10", 6)).toBe("2026-03-16")
  })

  it("reports ISO weekdays with 0 = Sunday", () => {
    expect(weekdayOfIso("2026-03-15")).toBe(0)
    expect(weekdayOfIso("2026-03-09")).toBe(1)
    expect(weekdayOfIso("2026-03-10")).toBe(2)
    expect(weekdayOfIso("2026-03-14")).toBe(6)
  })

  // E2 — the local Monday of the week containing the instant.
  it("resolves the local Monday for any instant in the week (E2)", () => {
    expect(mondayIso(new Date("2026-03-09T12:00:00Z"))).toBe("2026-03-09")
    expect(mondayIso(new Date("2026-03-15T12:00:00Z"))).toBe("2026-03-09")
    expect(mondayIso(new Date("2026-03-16T12:00:00Z"))).toBe("2026-03-16")
    // 22:00 local on Sunday still belongs to the Sunday-ending week.
    expect(mondayIso(new Date("2026-03-16T01:00:00Z"))).toBe("2026-03-09")
  })

  it("keeps weekStart on a Monday for any weekOffset (E2)", () => {
    const monday = mondayIso(new Date("2026-03-11T12:00:00Z"))
    for (const offset of [-3, -1, 0, 1, 4]) {
      expect(weekdayOfIso(addDaysIso(monday, offset * 7))).toBe(1)
    }
  })

  it("builds the seven Mon-Sun keys of a week", () => {
    expect(weekIsoKeys("2026-03-09")).toEqual([
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
    ])
  })
})
