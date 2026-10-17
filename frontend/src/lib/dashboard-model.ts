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
 * override/matched-activity heuristic must never be used again.
 */
export function isWorkoutCompleted(workout: { status: string }): boolean {
  return workout.status === "completed"
}

/** Minimal activity shape required by the run predicate (R7). */
export interface RunActivityCandidate {
  sport_type?: string | null
  distance_meters?: number | null
}

/** Minimal timeline day required by the activity-date builder (R5). */
export interface TimelineDayCandidate {
  date: string
  activities?: readonly RunActivityCandidate[] | null
}

/** Canonical positive set: the running-family Strava types. */
export const RUN_SPORTS: ReadonlySet<string> = new Set([
  "Run",
  "TrailRun",
  "VirtualRun",
])

/**
 * Explicitly non-running Strava sport types (R7, amended). Anything else —
 * including `null` (GPX/FIT uploads never carry a `sport_type`) and types this
 * build does not know yet — counts as a run.
 */
export const NON_RUN_SPORTS: ReadonlySet<string> = new Set([
  "Ride",
  "VirtualRide",
  "EBikeRide",
  "MountainBikeRide",
  "EMountainBikeRide",
  "GravelRide",
  "Handcycle",
  "Velomobile",
  "Walk",
  "Hike",
  "Swim",
  "AlpineSki",
  "BackcountrySki",
  "NordicSki",
  "RollerSki",
  "Snowboard",
  "Snowshoe",
  "IceSkate",
  "InlineSkate",
  "Skateboard",
  "Surfing",
  "Windsurf",
  "Kitesurf",
  "Sail",
  "Kayaking",
  "Canoeing",
  "Rowing",
  "VirtualRow",
  "StandUpPaddling",
  "RockClimbing",
  "Golf",
  "Soccer",
  "Tennis",
  "TableTennis",
  "Badminton",
  "Racquetball",
  "Squash",
  "Pickleball",
  "Basketball",
  "Volleyball",
  "Cricket",
  "WeightTraining",
  "Workout",
  "Yoga",
  "Pilates",
  "Crossfit",
  "Elliptical",
  "StairStepper",
  "HighIntensityIntervalTraining",
  "Wheelchair",
])

/**
 * Whether an activity qualifies as a run (R7, amended): an exclusion rule, so
 * `null` (GPX/FIT uploads, no `sport_type`) and unrecognized types mark too.
 * `source_type` and `distance_meters` are deliberately never consulted.
 */
export function isRunActivity(activity: RunActivityCandidate): boolean {
  return activity.sport_type == null || !NON_RUN_SPORTS.has(activity.sport_type)
}

/**
 * Local day keys that carry at least one qualifying run (R5). Keys come from
 * the backend timeline, which already buckets by `RUNNING_TIMEZONE`, so this is
 * clock-free and safe to share between the week strip and the month grid.
 */
export function buildActivityDates(
  timeline: readonly TimelineDayCandidate[] | null | undefined,
): Set<string> {
  const dates = new Set<string>()
  for (const day of timeline ?? []) {
    if (day.activities?.some((activity) => isRunActivity(activity))) {
      dates.add(day.date)
    }
  }
  return dates
}

/** Minimal month-summary shape required by the month-grid builder (R9). */
export interface MonthActivitySummaryCandidate {
  by_type?: ReadonlyArray<{
    type: string
    dot_days?: readonly string[] | null
  }> | null
}

/**
 * Local day keys of the whole displayed month that carry at least one
 * qualifying run (R9). Reads the backend month summary
 * (`AnalyticsService.readActivitiesSummary`), whose `dot_days` are already
 * local (`RUNNING_TIMEZONE`) keys, so this stays clock-free. Each `by_type`
 * bucket is filtered through the shared `isRunActivity` predicate — including
 * the `"Other"` bucket the backend uses for null-`sport_type` runs — so the run
 * criterion cannot drift from the week strip.
 */
export function monthActivityDates(
  summary: MonthActivitySummaryCandidate | null | undefined,
): Set<string> {
  const dates = new Set<string>()
  for (const entry of summary?.by_type ?? []) {
    if (!isRunActivity({ sport_type: entry.type })) continue
    for (const day of entry.dot_days ?? []) dates.add(day)
  }
  return dates
}

/** Per-day plan + activity state for the week strip. */
export interface WeekDayActivityState {
  dateIso: string
  hasWorkout: boolean
  isCompleted: boolean
  hasActivity: boolean
}

/**
 * Builds the week strip's day flags so the plan dot (`hasWorkout`/`isCompleted`)
 * and the activity mark (`hasActivity`) cannot drift apart: an unplanned free
 * run marks a day without ever faking a plan dot (R5/R6, S8/S10).
 */
export function buildWeekDayItems<T extends { status: string }>(
  weekKeys: readonly string[],
  workoutsByDate: ReadonlyMap<string, T> | null | undefined,
  activityDates: ReadonlySet<string> | null | undefined,
): WeekDayActivityState[] {
  return weekKeys.map((dateIso) => {
    const workout = workoutsByDate?.get(dateIso)
    return {
      dateIso,
      hasWorkout: Boolean(workout),
      isCompleted: workout ? isWorkoutCompleted(workout) : false,
      hasActivity: Boolean(activityDates?.has(dateIso)),
    }
  })
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
