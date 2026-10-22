import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { RunningPlanPublic } from "@/client"
import { PlanFitnessCard } from "./PlanFitnessCard"

describe("PlanFitnessCard (Render Tests)", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  const samplePlan: RunningPlanPublic = {
    id: "plan-123",
    name: "Plan 10K",
    distance_km: 10,
    distance_unit: "km",
    start_date: "2026-10-12",
    end_date: "2026-12-07",
    week_start_day: 1,
    status: "active",
    engine_version: "v3",
    baseline: {
      vdot: { value: 42.5, confidence: "measured" },
    },
  }

  it("renders current VDOT and Recalibrate button", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PlanFitnessCard plan={samplePlan} />
      </QueryClientProvider>,
    )

    expect(html).toContain("Estado de forma")
    expect(html).toContain("VDOT 42.5")
    expect(html).toContain("Recalibrar ritmos")
  })
})
