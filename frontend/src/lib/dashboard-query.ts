/**
 * Query descriptors for the dashboard's analytics calls.
 *
 * The expanded month grid owns its own summary fetch, and the route is the only
 * place that wires it. Keeping the request shape here (the `month` param, the
 * React Query key and the `enabled` gate) turns that wiring into a pure
 * function, testable without mounting the route — this project's test
 * environment is node, with no DOM and no `QueryClient` provider.
 */

import { type MonthCursor, monthKey } from "./dashboard-dates"

/**
 * Root of the month summary query key. Exported so the route cannot invent a
 * different first segment and silently create a second cache entry.
 */
export const MONTH_SUMMARY_QUERY_ROOT = "activities-summary"

export interface MonthSummaryRequest {
  /** Backend `month` query param (`YYYY-MM`), derived from the grid cursor. */
  month: string
  /** React Query key; a different cursor month is a different entry. */
  queryKey: readonly [string, string]
  /** The summary is fetched only while the month grid is expanded (R9). */
  enabled: boolean
}

/** Everything the month summary query needs, derived from the grid state. */
export function monthSummaryRequest(
  cursor: MonthCursor,
  isMonthExpanded: boolean,
): MonthSummaryRequest {
  const month = monthKey(cursor)
  return {
    month,
    queryKey: [MONTH_SUMMARY_QUERY_ROOT, month],
    enabled: isMonthExpanded,
  }
}
