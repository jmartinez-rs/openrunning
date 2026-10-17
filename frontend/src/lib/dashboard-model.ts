/**
 * Pure dashboard selectors.
 *
 * No clock, no I/O, no React: everything here is a deterministic function so it
 * can be unit-tested and shared by the hero card, the week strip and the week
 * summary without letting their states drift apart.
 */

/** Minimal plan shape required to resolve the dashboard's plan. */
export interface ActivePlanCandidate {
  id: string
  status: "planned" | "active" | "completed"
  start_date: string
  end_date: string | null
  updated_at: string
}

/** Hero states, in resolution order: loading wins over rest (E7). */
export type HeroState = "loading" | "session" | "rest"

/**
 * True when the plan's date range overlaps the displayed local week.
 * A null `end_date` means the plan is open-ended (any date from `start_date`).
 */
function coversWeek(
  plan: ActivePlanCandidate,
  weekMondayIso: string,
  weekSundayIso: string,
): boolean {
  if (plan.start_date > weekSundayIso) return false
  if (plan.end_date === null) return true
  return plan.end_date >= weekMondayIso
}

/**
 * Resolves the plan that backs the displayed week:
 * 1. the literal `active` plan, else
 * 2. the plan whose range covers the week (most recently updated wins ties),
 *    else null — a week outside every range is a legitimate rest week (E5).
 */
export function selectActivePlan<T extends ActivePlanCandidate>(
  plans: readonly T[] | null | undefined,
  weekMondayIso: string,
  weekSundayIso: string,
): T | null {
  if (!plans || plans.length === 0) return null

  const active = plans.find((plan) => plan.status === "active")
  if (active) return active

  let selected: T | null = null
  for (const plan of plans) {
    if (!coversWeek(plan, weekMondayIso, weekSundayIso)) continue
    if (!selected || plan.updated_at > selected.updated_at) selected = plan
  }
  return selected
}

/**
 * Completion comes exclusively from the backend-resolved status (R8), which
 * already folds in Strava auto-match and `status_override`. The legacy
 * `status_override || matched_activity_id` heuristic must never be used again.
 */
export function isWorkoutCompleted(workout: { status: string }): boolean {
  return workout.status === "completed"
}

/** Picks the hero branch for the selected day. Loading is checked first (E7). */
export function resolveHeroState({
  workout,
  isLoading,
}: {
  workout: { cancelled: boolean } | null | undefined
  isLoading: boolean
}): HeroState {
  if (isLoading) return "loading"
  if (!workout || workout.cancelled) return "rest"
  return "session"
}
