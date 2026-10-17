import { describe, expect, it } from "vitest"
import {
  type ActivePlanCandidate,
  isWorkoutCompleted,
  resolveHeroState,
  selectActivePlan,
} from "./dashboard-model"

const WEEK_MONDAY = "2026-03-09"
const WEEK_SUNDAY = "2026-03-15"

function plan(
  overrides: Partial<ActivePlanCandidate> & { id: string },
): ActivePlanCandidate {
  return {
    status: "planned",
    start_date: "2026-03-01",
    end_date: "2026-03-31",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("selectActivePlan", () => {
  it("returns null when there are no plans (E4)", () => {
    expect(selectActivePlan(undefined, WEEK_MONDAY, WEEK_SUNDAY)).toBeNull()
    expect(selectActivePlan(null, WEEK_MONDAY, WEEK_SUNDAY)).toBeNull()
    expect(selectActivePlan([], WEEK_MONDAY, WEEK_SUNDAY)).toBeNull()
  })

  it("prefers the literal active plan over any covering plan (S5)", () => {
    const active = plan({
      id: "active",
      status: "active",
      start_date: "2025-01-01",
      end_date: "2025-02-01",
    })
    const covering = plan({
      id: "covering",
      status: "planned",
      updated_at: "2026-06-01T00:00:00Z",
    })
    expect(
      selectActivePlan([covering, active], WEEK_MONDAY, WEEK_SUNDAY)?.id,
    ).toBe("active")
  })

  it("selects the plan whose range covers the displayed week (S4)", () => {
    const covering = plan({ id: "covering" })
    const elsewhere = plan({
      id: "elsewhere",
      start_date: "2026-06-01",
      end_date: "2026-07-01",
    })
    expect(
      selectActivePlan([elsewhere, covering], WEEK_MONDAY, WEEK_SUNDAY)?.id,
    ).toBe("covering")
  })

  it("treats a null end_date as open-ended", () => {
    const openEnded = plan({
      id: "open",
      start_date: "2026-01-01",
      end_date: null,
    })
    expect(selectActivePlan([openEnded], WEEK_MONDAY, WEEK_SUNDAY)?.id).toBe(
      "open",
    )
  })

  it("accepts a week that only partially overlaps the plan range", () => {
    const endingMidWeek = plan({
      id: "ending",
      start_date: "2026-03-01",
      end_date: "2026-03-11",
    })
    const startingMidWeek = plan({
      id: "starting",
      start_date: "2026-03-13",
      end_date: "2026-04-01",
    })
    expect(
      selectActivePlan([endingMidWeek], WEEK_MONDAY, WEEK_SUNDAY)?.id,
    ).toBe("ending")
    expect(
      selectActivePlan([startingMidWeek], WEEK_MONDAY, WEEK_SUNDAY)?.id,
    ).toBe("starting")
  })

  it("returns null when the displayed week is outside every plan range (E5)", () => {
    const before = plan({
      id: "before",
      start_date: "2026-01-01",
      end_date: "2026-02-01",
    })
    const after = plan({
      id: "after",
      start_date: "2026-06-01",
      end_date: "2026-07-01",
    })
    expect(
      selectActivePlan([before, after], WEEK_MONDAY, WEEK_SUNDAY),
    ).toBeNull()
  })

  it("breaks ties between covering plans by most recent update (deterministic)", () => {
    const older = plan({ id: "older", updated_at: "2026-01-01T00:00:00Z" })
    const newer = plan({ id: "newer", updated_at: "2026-05-01T00:00:00Z" })
    expect(selectActivePlan([older, newer], WEEK_MONDAY, WEEK_SUNDAY)?.id).toBe(
      "newer",
    )
    expect(selectActivePlan([newer, older], WEEK_MONDAY, WEEK_SUNDAY)?.id).toBe(
      "newer",
    )
  })
})

describe("isWorkoutCompleted", () => {
  it("is true only for the backend-resolved completed status", () => {
    expect(isWorkoutCompleted({ status: "completed" })).toBe(true)
    expect(isWorkoutCompleted({ status: "planned" })).toBe(false)
    expect(isWorkoutCompleted({ status: "missed" })).toBe(false)
    expect(isWorkoutCompleted({ status: "cancelled" })).toBe(false)
  })

  it("covers auto-match and override, and ignores the legacy heuristic (S13/S14/E10)", () => {
    const autoMatched = {
      status: "completed",
      status_override: null,
      matched_activity_id: null,
    } as const
    const overrideOnly = {
      status: "planned",
      status_override: "completed",
      matched_activity_id: null,
    } as const
    const matchedButPlanned = {
      status: "planned",
      status_override: null,
      matched_activity_id: "act-1",
    } as const

    expect(isWorkoutCompleted(autoMatched)).toBe(true)
    expect(isWorkoutCompleted(overrideOnly)).toBe(false)
    expect(isWorkoutCompleted(matchedButPlanned)).toBe(false)
  })
})

describe("resolveHeroState", () => {
  it("shows the assigned session for a non-cancelled workout (S6)", () => {
    expect(
      resolveHeroState({ workout: { cancelled: false }, isLoading: false }),
    ).toBe("session")
  })

  it("falls back to rest for a cancelled workout (E6)", () => {
    expect(
      resolveHeroState({ workout: { cancelled: true }, isLoading: false }),
    ).toBe("rest")
  })

  it("is rest without a workout (E4)", () => {
    expect(resolveHeroState({ workout: null, isLoading: false })).toBe("rest")
    expect(resolveHeroState({ workout: undefined, isLoading: false })).toBe(
      "rest",
    )
  })

  it("never shows rest while loading, even with no workout yet (E7)", () => {
    expect(resolveHeroState({ workout: null, isLoading: true })).toBe("loading")
    expect(
      resolveHeroState({ workout: { cancelled: true }, isLoading: true }),
    ).toBe("loading")
  })
})
