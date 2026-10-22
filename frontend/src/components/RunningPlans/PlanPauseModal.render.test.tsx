import { describe, expect, it } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { PlanPauseModal } from "./PlanPauseModal"

describe("PlanPauseModal (Render Tests)", () => {
  it("renders without crashing when closed", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <PlanPauseModal
          planId="test-plan-id"
          open={false}
          onOpenChange={() => {}}
        />
      </QueryClientProvider>
    )

    // Closed dialog renders nothing to the DOM tree
    expect(html).toBe("")
  })
})
