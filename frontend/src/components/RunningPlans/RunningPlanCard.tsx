import { Link } from "@tanstack/react-router"
import { Footprints, Pencil, Trash2 } from "lucide-react"

import type { RunningPlanSummaryPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { formatDateRange, PLAN_STATUS_META } from "./running-utils"

export function RunningPlanCard({
  plan,
  onEdit,
  onDelete,
  deleting = false,
}: {
  plan: RunningPlanSummaryPublic
  onEdit?: () => void
  onDelete?: () => void
  deleting?: boolean
}) {
  const status = PLAN_STATUS_META[plan.status]

  return (
    <Link to="/routines/run/$planId" params={{ planId: plan.id }}>
      <div className="group/card relative flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-card transition-colors hover:border hover:border-primary/30 dark:border dark:border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-domain-cardio/10 text-domain-cardio">
              <Footprints className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-title-lg truncate text-primary">
                {plan.name}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-body-md text-on-surface-variant">
                {plan.goal}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-lg ${
              status.className || ""
            }`}
          >
            {status.label}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-label-sm text-on-surface-variant">
            {formatDateRange(plan.start_date, plan.end_date)}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-label-sm text-on-surface-variant">
            <span>
              {plan.weeks} {plan.weeks === 1 ? "semana" : "semanas"}
            </span>
            <span>·</span>
            <span>
              {plan.sessions} {plan.sessions === 1 ? "sesión" : "sesiones"}
            </span>
            <span>·</span>
            <span>{plan.planned_km} km planificados</span>
            {plan.completed > 0 ? (
              <>
                <span>·</span>
                <span className="font-semibold text-domain-success">
                  {plan.completed} completadas
                </span>
              </>
            ) : null}
            {plan.missed > 0 ? (
              <>
                <span>·</span>
                <span className="font-semibold text-destructive">
                  {plan.missed} perdidas
                </span>
              </>
            ) : null}
          </div>
        </div>

        {onEdit || onDelete ? (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-100 transition-opacity group-hover/card:opacity-100 max-md:opacity-100 md:opacity-0">
            {onEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar plan"
                className="size-8 rounded-lg bg-card shadow-sm"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar plan"
                className="size-8 rounded-lg bg-card shadow-sm"
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
