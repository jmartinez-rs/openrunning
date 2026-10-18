import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { RunningWorkoutPublic } from "@/client"
import { dayOfMonthIso, type MonthCursor } from "@/lib/dashboard-dates"
import {
  getDotClassName,
  type RunnaDayItem,
  RunnaWeekStrip,
} from "./RunnaWeekStrip"

/**
 * Wiring test for the strip's two branches: the weekly grid (R5/R6, S10,
 * E8/E9), the expanded month grid (R9) and the planned-vs-done dot semantics
 * shared by both (R10).
 *
 * Lifting `isMonthExpanded` to the route made the month grid a controlled prop
 * instead of a `useState(false)` default, so `renderToStaticMarkup` can now
 * reach it too. Its layout math (`monthCursorOf`/`shiftMonth`/`monthStartOffset`/
 * `monthTotalDays`/`monthDayKeys`) and the run criterion (`isRunActivity`) stay
 * covered as pure helpers in `dashboard-dates.test.ts` / `dashboard-model.test.ts`.
 */

const MARCH_2026: MonthCursor = { year: 2026, month: 2 }

/**
 * R10's two distinguishing tokens: the utility that cues a done session
 * (emerald ring) and the one that mutes a planned-but-not-done dot. Assertions
 * target these tokens (never the whole class string), so the dot's other
 * utilities stay free to change.
 */
const MUTED_DOT_TOKEN = "opacity-30"
const COMPLETED_DOT_TOKEN = "ring-emerald-500/20"

const WEEK = [
  "2026-03-09",
  "2026-03-10",
  "2026-03-11",
  "2026-03-12",
  "2026-03-13",
  "2026-03-14",
  "2026-03-15",
]
const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]

function dayItem(
  dateIso: string,
  index: number,
  overrides: Partial<RunnaDayItem> = {},
): RunnaDayItem {
  return {
    dateIso,
    dayName: DAY_NAMES[index],
    dayNumber: dayOfMonthIso(dateIso),
    isToday: false,
    isSelected: false,
    hasWorkout: false,
    workoutType: null,
    isCompleted: false,
    hasActivity: false,
    ...overrides,
  }
}

function weeklyDays(
  marks: Record<string, Partial<RunnaDayItem>> = {},
): RunnaDayItem[] {
  return WEEK.map((iso, index) => dayItem(iso, index, marks[iso]))
}

function workout(
  date: string,
  overrides: Partial<RunningWorkoutPublic> = {},
): RunningWorkoutPublic {
  return {
    id: `wo-${date}`,
    date,
    type: "easy_run",
    objective: null,
    name: null,
    distance_km: 5,
    duration_seconds: null,
    pace_seconds_per_km: null,
    intensity: "easy",
    description: null,
    notes: null,
    cancelled: false,
    status: "planned",
    matched_activity: null,
    ...overrides,
  }
}

function renderStrip(
  days: RunnaDayItem[],
  overrides: Partial<{
    isMonthExpanded: boolean
    monthCursor: MonthCursor
    monthActivityDates: ReadonlySet<string>
    workoutsByDate: Map<string, RunningWorkoutPublic>
    todayIso: string
  }> = {},
): string {
  return renderToStaticMarkup(
    <RunnaWeekStrip
      days={days}
      selectedDateIso={WEEK[0]}
      todayIso={WEEK[0]}
      isMonthExpanded={false}
      monthCursor={MARCH_2026}
      onToggleMonth={() => {}}
      onShiftMonth={() => {}}
      onSelectDay={() => {}}
      {...overrides}
    />,
  )
}

/** Isolates one weekly day cell so day-key association can be asserted. */
function daySection(html: string, dateIso: string): string {
  const start = html.indexOf(`data-day="${dateIso}"`)
  if (start === -1) throw new Error(`Day cell not rendered: ${dateIso}`)
  const next = html.indexOf('data-day="', start + 1)
  return html.slice(start, next === -1 ? undefined : next)
}

function activityMarker(tag: string): string | undefined {
  return tag.match(/<span[^>]*data-activity="true"[^>]*>/)?.[0]
}

/**
 * The plan dot is the only span in a day cell carrying a `bg-*` utility (the
 * activity mark is a hollow ring and the empty spacer has no background), so
 * this isolates it without depending on its full class list.
 */
function planDot(tag: string): string {
  const dot = tag.match(/<span[^>]*class="[^"]*\bbg-[^"]*"[^>]*><\/span>/)?.[0]
  if (!dot) throw new Error("Plan dot not rendered in this day cell")
  return dot
}

describe("RunnaWeekStrip — activity marks (weekly branch)", () => {
  it("renders one marker on a marked day and keeps the plan dot distinct (R5/R6/S10)", () => {
    const html = renderStrip(
      weeklyDays({
        "2026-03-10": {
          hasWorkout: true,
          isCompleted: true,
          workoutType: "easy_run",
          hasActivity: true,
        },
      }),
    )

    expect(html.match(/data-activity="true"/g)?.length).toBe(1)

    const marked = daySection(html, "2026-03-10")
    // Both carriers coexist and stay visually distinct: the done plan dot keeps
    // its vivid type colour plus the completion cue, the activity mark is a
    // separate hollow ring.
    const dot = planDot(marked)
    expect(dot).toContain("bg-lime-400")
    expect(dot).not.toContain(MUTED_DOT_TOKEN)
    expect(dot).toContain(COMPLETED_DOT_TOKEN)
    const marker = activityMarker(marked)
    expect(marker).toBeDefined()
    expect(marker).toContain("border-sky-400")
    expect(marker).not.toContain("bg-lime-400")
    expect(marker).not.toContain(COMPLETED_DOT_TOKEN)
    expect(marker).toContain('aria-label="Actividad registrada"')
  })

  it("renders no marker when the timeline is empty, plan dot only (E8)", () => {
    const html = renderStrip(
      weeklyDays({
        "2026-03-10": { hasWorkout: true, workoutType: "easy_run" },
      }),
    )

    expect(html).not.toContain('data-activity="true"')
    expect(daySection(html, "2026-03-10")).toContain("bg-lime-400")
  })

  it("places the mark on the correct key at the local week boundary (E9)", () => {
    const html = renderStrip(
      weeklyDays({ "2026-03-15": { hasActivity: true } }),
    )

    expect(daySection(html, "2026-03-15")).toContain('data-activity="true"')
    expect(daySection(html, "2026-03-14")).not.toContain('data-activity="true"')
  })
})

describe("RunnaWeekStrip — activity marks (expanded month branch)", () => {
  it("labels and lays out the controlled month (R9)", () => {
    const html = renderStrip([], { isMonthExpanded: true })

    // `es-AR` renders the year with a connective ("marzo de 2026"), so the
    // assertion stays on the parts, not on one locale's exact phrasing.
    expect(html).toContain("Marzo")
    expect(html).toContain("2026")
    expect(html).toContain('data-day="2026-03-01"')
    expect(html).toContain('data-day="2026-03-31"')
    // Each day number is read from its own day key.
    expect(daySection(html, "2026-03-01")).toContain(">1<")
    expect(daySection(html, "2026-03-31")).toContain(">31<")
  })

  it("marks today from the injected clock, not from a second new Date() (R1/E1)", () => {
    const html = renderStrip([], {
      isMonthExpanded: true,
      todayIso: "2026-03-10",
    })

    // The route owns the pinned clock (`formatDayKey`); the strip consumes it,
    // so a second host-clock read cannot mark a different day. The real clock is
    // never March 2026, so this only passes through the prop.
    expect(daySection(html, "2026-03-10")).toContain("ring-primary/40")
    expect(daySection(html, "2026-03-11")).not.toContain("ring-primary/40")
  })

  it("marks every day of the month present in the month set, keyed by day (R9)", () => {
    const html = renderStrip([], {
      isMonthExpanded: true,
      monthActivityDates: new Set(["2026-03-02", "2026-03-28"]),
    })

    expect(html.match(/data-activity="true"/g)?.length).toBe(2)
    expect(daySection(html, "2026-03-02")).toContain('data-activity="true"')
    expect(daySection(html, "2026-03-28")).toContain('data-activity="true"')
    expect(daySection(html, "2026-03-03")).not.toContain('data-activity="true"')
  })

  it("ignores the weekly days' activity flags when the month is expanded (R9)", () => {
    // The 7-day timeline set must not leak into the month grid: only the month
    // summary keys mark it.
    const html = renderStrip(
      weeklyDays({ "2026-03-10": { hasActivity: true } }),
      { isMonthExpanded: true },
    )

    expect(html).not.toContain('data-activity="true"')
  })

  it("shows no month marks while the summary is missing or errored (E8)", () => {
    const html = renderStrip([], { isMonthExpanded: true })

    expect(html).not.toContain('data-activity="true"')
  })
})

describe("RunnaWeekStrip — planned vs done dot semantics (R10)", () => {
  it("cues done and pending with mutually exclusive shared tokens (unit)", () => {
    const types = ["easy_run", "tempo", "intervals", "long_run", "test", null]

    for (const type of types) {
      const done = getDotClassName(type, true)
      const pending = getDotClassName(type, false)

      // The cue — never the hue — is what tells done from pending...
      expect(done).toContain(COMPLETED_DOT_TOKEN)
      expect(done).not.toContain(MUTED_DOT_TOKEN)
      expect(pending).toContain(MUTED_DOT_TOKEN)
      expect(pending).not.toContain(COMPLETED_DOT_TOKEN)
      // ...and both build on the very same type colour.
      expect(done.split(" ")[0]).toBe(pending.split(" ")[0])
    }
  })

  it("keeps the done dot vivid and mutes the pending one, same type colour (weekly grid)", () => {
    const html = renderStrip(
      weeklyDays({
        "2026-03-10": {
          hasWorkout: true,
          isCompleted: true,
          workoutType: "easy_run",
        },
        "2026-03-12": {
          hasWorkout: true,
          isCompleted: false,
          workoutType: "easy_run",
        },
      }),
    )

    const doneDot = planDot(daySection(html, "2026-03-10"))
    const pendingDot = planDot(daySection(html, "2026-03-12"))

    // Same hue for both planned sessions...
    expect(doneDot).toContain("bg-lime-400")
    expect(pendingDot).toContain("bg-lime-400")
    // ...and the cue is exactly what tells "done" from "not done".
    expect(doneDot).toContain(COMPLETED_DOT_TOKEN)
    expect(doneDot).not.toContain(MUTED_DOT_TOKEN)
    expect(pendingDot).toContain(MUTED_DOT_TOKEN)
    expect(pendingDot).not.toContain(COMPLETED_DOT_TOKEN)
  })

  it("keeps each workout type's colour when done (R10)", () => {
    const html = renderStrip(
      weeklyDays({
        "2026-03-10": {
          hasWorkout: true,
          isCompleted: true,
          workoutType: "intervals",
        },
        "2026-03-12": {
          hasWorkout: true,
          isCompleted: true,
          workoutType: "long_run",
        },
      }),
    )

    expect(planDot(daySection(html, "2026-03-10"))).toContain("bg-orange-400")
    expect(planDot(daySection(html, "2026-03-12"))).toContain("bg-purple-500")
  })

  it("mutes a past-but-not-done session as well (R10)", () => {
    // The dot reads completion only from the resolved status, so a session that
    // never happened is muted exactly like a future one.
    const html = renderStrip(
      weeklyDays({
        "2026-03-10": {
          hasWorkout: true,
          isCompleted: false,
          workoutType: "tempo",
        },
      }),
    )

    const dot = planDot(daySection(html, "2026-03-10"))
    expect(dot).toContain("bg-amber-400")
    expect(dot).toContain(MUTED_DOT_TOKEN)
  })

  it("keeps the activity mark distinguishable from a muted pending dot (R6/R10)", () => {
    const html = renderStrip(
      weeklyDays({
        "2026-03-12": {
          hasWorkout: true,
          isCompleted: false,
          workoutType: "easy_run",
          hasActivity: true,
        },
      }),
    )

    const marked = daySection(html, "2026-03-12")
    expect(planDot(marked)).toContain(MUTED_DOT_TOKEN)
    const marker = activityMarker(marked)
    expect(marker).toBeDefined()
    expect(marker).toContain("border-sky-400")
    expect(marker).not.toContain(MUTED_DOT_TOKEN)
  })

  it("applies the same semantics to the expanded month grid (R10)", () => {
    const html = renderStrip([], {
      isMonthExpanded: true,
      workoutsByDate: new Map([
        ["2026-03-10", workout("2026-03-10", { status: "completed" })],
        ["2026-03-12", workout("2026-03-12", { status: "planned" })],
      ]),
    })

    const doneDot = planDot(daySection(html, "2026-03-10"))
    const pendingDot = planDot(daySection(html, "2026-03-12"))

    expect(doneDot).toContain("bg-lime-400")
    expect(doneDot).toContain(COMPLETED_DOT_TOKEN)
    expect(doneDot).not.toContain(MUTED_DOT_TOKEN)
    expect(pendingDot).toContain("bg-lime-400")
    expect(pendingDot).toContain(MUTED_DOT_TOKEN)
    expect(pendingDot).not.toContain(COMPLETED_DOT_TOKEN)
  })
})
