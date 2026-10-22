import { describe, expect, it } from "bun:test"
import type { RunningWorkoutPublic } from "@/client"
import { generateWorkoutTcx } from "./tcx-export"

describe("tcx-export", () => {
  it("generates valid TCX XML with steps for structured workout", () => {
    const workout: RunningWorkoutPublic = {
      id: "w1",
      week_id: "wk1",
      plan_id: "p1",
      date: "2026-10-24",
      type: "intervals",
      distance_km: 7.0,
      intensity: "hard",
      cancelled: false,
      blocks: [
        {
          id: "b1",
          position: 1,
          block_type: "warm_up",
          repeats: 1,
          distance_m: 2000,
          duration_seconds: null,
          pace_seconds_per_km: 360,
          notes: "",
        },
        {
          id: "b2",
          position: 2,
          block_type: "intervals",
          repeats: 5,
          distance_m: 400,
          duration_seconds: null,
          pace_seconds_per_km: 240,
          notes: "",
        },
      ],
    }

    const tcx = generateWorkoutTcx(workout, "Plan Maratón")

    expect(tcx).toContain('<TrainingCenterDatabase')
    expect(tcx).toContain('<Workout Sport="Running">')
    expect(tcx).toContain('<Name>Plan Maratón</Name>')
    expect(tcx).toContain('<StepId>1</StepId>')
    expect(tcx).toContain('<Meters>2000</Meters>')
    expect(tcx).toContain('<StepId>2</StepId>')
    expect(tcx).toContain('<Meters>400</Meters>')
    expect(tcx).toContain('<Target xsi:type="Speed_t">')
  })
})
