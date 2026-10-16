import { describe, expect, it } from "vitest"

import { buildPayload, type PlanDraft } from "./PlanWizard"

/**
 * Contract test for the create/replace request body.
 *
 * `POST /running-plans/` only keeps a plan's `baseline`/`generation_params`
 * when the client sends them, and recalibration needs `baseline.vdot` to know
 * the current VDOT (`409 plan_has_no_baseline` otherwise). `buildPayload` is a
 * pure transformation, so it is tested directly instead of through the wizard.
 */
function draft(snapshot: Partial<PlanDraft> = {}): PlanDraft {
  return {
    name: "Plan 21.1K",
    goal: "",
    distance_km: 21.1,
    distance_unit: "km",
    target_time_seconds: 5700,
    target_pace_seconds_per_km: 270,
    start_date: "2026-10-19",
    end_date: "",
    week_start_day: 1,
    status: "active",
    race_id: null,
    notes: "",
    phases: [],
    ...snapshot,
  }
}

describe("buildPayload generation snapshot", () => {
  it("sends the draft baseline and generation_params in the create request", () => {
    const baseline = {
      vdot: { value: 45.0, confidence: "measured" },
      weekly_km: { value: 40.0, confidence: "measured" },
    }
    const generationParams = { target_km: 21.1, num_weeks: 12 }

    const payload = buildPayload(
      draft({ baseline, generation_params: generationParams }),
    )

    expect(payload.baseline).toEqual(baseline)
    expect(payload.generation_params).toEqual(generationParams)
    // The snapshot travels with the rest of the plan payload.
    expect(payload.name).toBe("Plan 21.1K")
  })

  it("omits the snapshot when the draft has none, so a PUT keeps the stored one", () => {
    const payload = buildPayload(draft())

    expect("baseline" in payload).toBe(false)
    expect("generation_params" in payload).toBe(false)
    expect(payload.distance_km).toBe(21.1)
  })
})
