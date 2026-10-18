import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { MonthCursor } from "@/lib/dashboard-dates"
import { type RunnaDayItem, RunnaWeekStrip } from "./RunnaWeekStrip"

/**
 * Wiring test for the strip's two branches: the weekly grid (R5/R6, S10,
 * E8/E9) and the expanded month grid (R9).
 *
 * Lifting `isMonthExpanded` to the route made the month grid a controlled prop
 * instead of a `useState(false)` default, so `renderToStaticMarkup` can now
 * reach it too. Its layout math (`monthCursorOf`/`shiftMonth`/`monthStartOffset`/
 * `monthTotalDays`/`monthDayKeys`) and the run criterion (`isRunActivity`) stay
 * covered as pure helpers in `dashboard-dates.test.ts` / `dashboard-model.test.ts`.
 */

const MARCH_2026: MonthCursor = { year: 2026, month: 2 }

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
    dayNumber: Number(dateIso.slice(8, 10)),
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

function renderStrip(
  days: RunnaDayItem[],
  overrides: Partial<{
    isMonthExpanded: boolean
    monthCursor: MonthCursor
    monthActivityDates: ReadonlySet<string>
  }> = {},
): string {
  return renderToStaticMarkup(
    <RunnaWeekStrip
      days={days}
      selectedDateIso={WEEK[0]}
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
    // Both carriers coexist and stay visually distinct: the plan dot keeps its
    // filled completion colour, the activity mark is a separate hollow ring.
    expect(marked).toContain("bg-emerald-400")
    const marker = activityMarker(marked)
    expect(marker).toBeDefined()
    expect(marker).toContain("border-sky-400")
    expect(marker).not.toContain("bg-emerald-400")
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
