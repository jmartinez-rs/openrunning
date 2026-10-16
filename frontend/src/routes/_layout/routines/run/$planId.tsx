import { createFileRoute } from "@tanstack/react-router"

import { RunningPlanDetail } from "@/components/RunningPlans/RunningPlanDetail"

export const Route = createFileRoute("/_layout/routines/run/$planId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    week?: number
    day?: string
    view?: "overview" | "evolution"
    tab?: string
  } => ({
    week: typeof search.week === "number" ? search.week : undefined,
    day: typeof search.day === "string" ? search.day : undefined,
    view:
      search.view === "evolution" || search.view === "overview"
        ? search.view
        : search.tab === "evolution"
          ? "evolution"
          : "overview",
    // LEGACY: el dashboard navegaba con tab="evolution".
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: PlanDetailRoute,
  head: () => ({ meta: [{ title: "Plan de Running - OpenRunning" }] }),
})

function PlanDetailRoute() {
  const { planId } = Route.useParams()
  const { week, day, view } = Route.useSearch()
  return (
    <div className="col-span-12">
      <RunningPlanDetail
        planId={planId}
        initialWeek={week}
        initialDay={day}
        initialView={view}
      />
    </div>
  )
}
