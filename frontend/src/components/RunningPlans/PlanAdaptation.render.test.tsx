import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import type { PlanAdaptationPreviewPublic } from "@/client"
import { PlanAdaptationBanner } from "./PlanAdaptationBanner"

describe("PlanAdaptation (Render Tests)", () => {
  const samplePreview: PlanAdaptationPreviewPublic = {
    plan_id: "plan-123",
    evaluated_at: "2026-10-22",
    evaluated_week_number: 1,
    suggestions: [
      {
        rule_code: "R1_LOW_ADHERENCE",
        title: "Adherencia baja en la última semana (<60%)",
        reason: "Completaste 1 de 3 sesiones y se perdió una sesión de calidad.",
        severity: "warning",
        before_summary: "Progresión a 30 km en Semana 2",
        after_summary: "Repetir carga de 25 km",
        affected_weeks: [2],
        affected_workouts_count: 3,
        params: {},
      },
    ],
  }

  it("renders adaptation banner when suggestions exist", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    })
    queryClient.setQueryData(["adaptation-preview", "plan-123"], samplePreview)

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PlanAdaptationBanner planId="plan-123" />
      </QueryClientProvider>,
    )

    expect(html).toContain("Tu plan puede adaptarse")
    expect(html).toContain("1 ajuste")
    expect(html).toContain("Revisar ajustes")
  })
})
