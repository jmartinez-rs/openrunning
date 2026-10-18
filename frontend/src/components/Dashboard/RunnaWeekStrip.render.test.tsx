import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { type RunnaDayItem, RunnaWeekStrip } from "./RunnaWeekStrip"

/**
 * Wiring test for the SSR-reachable weekly branch (R5/R6, S10, E8/E9).
 *
 * The expanded month grid is intentionally NOT covered here: it is gated by
 * `isMonthExpanded`, a `useState(false)` default, so `renderToStaticMarkup`
 * cannot reach it (SSR cannot click). Its completion + activity-marker logic is
 * therefore covered by the pure helpers (`isWorkoutCompleted`, `isRunActivity`,
 * `buildActivityDates`, `buildWeekDayItems`) in `dashboard-model.test.ts`.
 */

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

function renderStrip(days: RunnaDayItem[]): string {
  return renderToStaticMarkup(
    <RunnaWeekStrip
      days={days}
      selectedDateIso={WEEK[0]}
      onSelectDay={() => {}}
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
