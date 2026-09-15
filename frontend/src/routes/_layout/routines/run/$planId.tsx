import { createFileRoute } from "@tanstack/react-router"

import { RunningPlanDetail } from "@/components/RunningPlans/RunningPlanDetail"

export const Route = createFileRoute("/_layout/routines/run/$planId")({
  component: PlanDetailRoute,
  head: () => ({ meta: [{ title: "Plan de Running - OpenRunning" }] }),
})

function PlanDetailRoute() {
  const { planId } = Route.useParams()
  return (
    <div className="col-span-12">
      <RunningPlanDetail planId={planId} />
    </div>
  )
}
