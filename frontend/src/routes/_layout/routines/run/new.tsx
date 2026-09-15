import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { PlanWizard } from "@/components/RunningPlans/PlanWizard"

const searchSchema = z.object({
  edit: z.string().optional().catch(undefined),
})

export const Route = createFileRoute("/_layout/routines/run/new")({
  component: RunPlanNew,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Nuevo Plan de Running - OpenRunning" }] }),
})

function RunPlanNew() {
  const { edit } = Route.useSearch()
  return (
    <div className="col-span-12">
      <PlanWizard editId={edit ?? null} />
    </div>
  )
}
