import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { RaceWizard } from "@/components/Races/RaceWizard"

const searchSchema = z.object({
  edit: z.string().optional().catch(undefined),
  activityId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute("/_layout/races/new")({
  component: RaceNew,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Nueva Carrera - OpenRunning" }] }),
})

function RaceNew() {
  const { edit, activityId } = Route.useSearch()
  return (
    <div className="col-span-12">
      <RaceWizard
        editId={edit ?? null}
        defaultActivityId={activityId ?? null}
      />
    </div>
  )
}
