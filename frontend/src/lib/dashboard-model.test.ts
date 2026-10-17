import { describe, expect, it } from "vitest"
import {
  type ActivePlanCandidate,
  buildActivityDates,
  buildWeekDayItems,
  isRunActivity,
  isWorkoutCompleted,
  resolveHeroState,
  selectActivePlan,
  type TimelineDayCandidate,
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

// R7 (amended) — exclusion predicate. Unknown and null `sport_type` MUST mark,
// the enumerated non-run sports MUST NOT, and `distance_meters` is never read.
describe("isRunActivity", () => {
  it("marks a null or missing sport_type (GPX/FIT uploads)", () => {
    expect(isRunActivity({ sport_type: null })).toBe(true)
    expect(isRunActivity({})).toBe(true)
  })

  it("marks the canonical running family", () => {
    for (const sport_type of ["Run", "TrailRun", "VirtualRun"]) {
      expect(isRunActivity({ sport_type })).toBe(true)
    }
  })

  it("rejects the explicitly non-running sports (S11)", () => {
    for (const sport_type of ["Ride", "Walk", "Swim", "Hike", "VirtualRide"]) {
      expect(isRunActivity({ sport_type })).toBe(false)
    }
  })

  it("rejects the enumerated other non-run Strava types", () => {
    for (const sport_type of [
      "MountainBikeRide",
      "GravelRide",
      "Rowing",
      "Kayaking",
      "WeightTraining",
      "Yoga",
      "Soccer",
    ]) {
      expect(isRunActivity({ sport_type })).toBe(false)
    }
  })

  it("marks an unrecognized type instead of dropping the run", () => {
    expect(isRunActivity({ sport_type: "FutureRunType" })).toBe(true)
  })

  it("never consults distance_meters (S12/E8)", () => {
    expect(isRunActivity({ sport_type: "Run", distance_meters: null })).toBe(
      true,
    )
    expect(isRunActivity({ sport_type: null, distance_meters: 0 })).toBe(true)
    expect(isRunActivity({ sport_type: "Ride", distance_meters: 42_000 })).toBe(
      false,
    )
  })
})

function activityDay(
  date: string,
  sportTypes: Array<string | null>,
): TimelineDayCandidate {
  return {
    date,
    activities: sportTypes.map((sport_type, index) => ({
      id: `${date}-${index}`,
      sport_type,
      distance_meters: 5000,
    })),
  }
}

describe("buildActivityDates", () => {
  it("marks every day with at least one qualifying activity (R5/S8)", () => {
    const dates = buildActivityDates([
      activityDay("2026-03-10", ["Run"]),
      activityDay("2026-03-11", ["Ride"]),
      activityDay("2026-03-12", [null]),
    ])

    expect([...dates].sort()).toEqual(["2026-03-10", "2026-03-12"])
  })

  it("marks a free run on an otherwise rest day (S8)", () => {
    expect(
      buildActivityDates([activityDay("2026-03-14", [null])]).has("2026-03-14"),
    ).toBe(true)
  })

  it("reads only the timeline it is given, so week nav stays honest (S9)", () => {
    const previousWeek = [activityDay("2026-03-03", ["Run"])]
    const dates = buildActivityDates(previousWeek)

    expect(dates.has("2026-03-03")).toBe(true)
    expect(dates.has("2026-03-10")).toBe(false)
  })

  it("returns an empty set for an empty or absent timeline (E8)", () => {
    expect(buildActivityDates([]).size).toBe(0)
    expect(buildActivityDates(undefined).size).toBe(0)
    expect(buildActivityDates(null).size).toBe(0)
    expect(
      buildActivityDates([{ date: "2026-03-10", activities: [] }]).size,
    ).toBe(0)
  })

  it("keeps the backend day key at a week boundary (E9)", () => {
    const dates = buildActivityDates([activityDay("2026-03-15", ["Run"])])

    expect(dates.has("2026-03-15")).toBe(true)
    expect(dates.has("2026-03-16")).toBe(false)
  })
})

function completedWorkout(status = "completed") {
  return { id: "wo-1", status }
}

describe("buildWeekDayItems", () => {
  it("keeps hasActivity distinct from hasWorkout (S10)", () => {
    const workouts = new Map([["2026-03-10", completedWorkout()]])
    const activityDates = new Set(["2026-03-10", "2026-03-12"])

    const items = buildWeekDayItems(
      ["2026-03-10", "2026-03-11", "2026-03-12"],
      workouts,
      activityDates,
    )

    expect(items[0]).toEqual({
      dateIso: "2026-03-10",
      hasWorkout: true,
      isCompleted: true,
      hasActivity: true,
    })
    expect(items[1]).toEqual({
      dateIso: "2026-03-11",
      hasWorkout: false,
      isCompleted: false,
      hasActivity: false,
    })
    expect(items[2]).toEqual({
      dateIso: "2026-03-12",
      hasWorkout: false,
      isCompleted: false,
      hasActivity: true,
    })
  })

  it("shows plan dots only when the timeline is empty (E8)", () => {
    const items = buildWeekDayItems(
      ["2026-03-10"],
      new Map([["2026-03-10", completedWorkout("planned")]]),
      new Set(),
    )

    expect(items[0]).toEqual({
      dateIso: "2026-03-10",
      hasWorkout: true,
      isCompleted: false,
      hasActivity: false,
    })
  })

  it("marks the correct boundary key and tolerates missing maps (E9)", () => {
    const items = buildWeekDayItems(
      ["2026-03-14", "2026-03-15"],
      undefined,
      new Set(["2026-03-15"]),
    )

    expect(items.map((item) => item.hasActivity)).toEqual([false, true])
    expect(items.every((item) => !item.hasWorkout)).toBe(true)
  })
})
