import { describe, expect, it } from "vitest"
import {
  MONTH_SUMMARY_QUERY_ROOT,
  monthSummaryRequest,
} from "./dashboard-query"

/**
 * The month summary is fetched by the route only, and the route is not
 * reachable from this node test environment (no DOM, no `QueryClient`
 * provider). Extracting the wiring — cursor-derived `month` param, React Query
 * key and `enabled` gate — into a pure function pins the seam: the route
 * consumes these values, so the key and the gate cannot drift from the cursor.
 */
describe("monthSummaryRequest", () => {
  it("derives month, query key and enabled gate from the cursor (R9)", () => {
    const request = monthSummaryRequest({ year: 2026, month: 2 }, true)

    expect(request.month).toBe("2026-03")
    expect(request.queryKey).toEqual([MONTH_SUMMARY_QUERY_ROOT, "2026-03"])
    expect(request.enabled).toBe(true)
  })

  it("keeps the collapsed month gated but still keyed (R9)", () => {
    // A collapsed grid must not fetch, while the key stays derived so switching
    // the expansion on reuses the same entry instead of refetching a new one.
    const collapsed = monthSummaryRequest({ year: 2026, month: 2 }, false)
    const expanded = monthSummaryRequest({ year: 2026, month: 2 }, true)

    expect(collapsed.enabled).toBe(false)
    expect(collapsed.queryKey).toEqual(expanded.queryKey)
    expect(collapsed.month).toBe(expanded.month)
  })

  it("keys each cursor month distinctly, across year boundaries", () => {
    const keys = [
      { year: 2025, month: 11 },
      { year: 2026, month: 0 },
      { year: 2026, month: 11 },
    ].map((cursor) => monthSummaryRequest(cursor, true))

    expect(keys.map((request) => request.month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-12",
    ])
    expect(
      new Set(keys.map((request) => request.queryKey.join("|"))).size,
    ).toBe(3)
    for (const request of keys) {
      expect(request.queryKey[0]).toBe(MONTH_SUMMARY_QUERY_ROOT)
    }
  })
})
