import { createFileRoute } from "@tanstack/react-router"

import { RunningPlanDetail } from "@/components/RunningPlans/RunningPlanDetail"

export const Route = createFileRoute("/_layout/routines/run/$planId")({
  validateSearch: (search: Record<string, unknown>): { week?: number; tab?: string } => ({
    week: typeof search.week === "number" ? search.week : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: PlanDetailRoute,
  head: () => ({ meta: [{ title: "Plan de Running - OpenRunning" }] }),
})

function PlanDetailRoute() {
  const { planId } = Route.useParams()
  const { week, tab } = Route.useSearch()
  return (
    <div className="col-span-12">
      <RunningPlanDetail planId={planId} initialWeek={week} initialTab={tab} />
    </div>
  )
}
