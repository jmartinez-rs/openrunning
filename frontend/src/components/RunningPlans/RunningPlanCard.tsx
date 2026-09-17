import { Link } from "@tanstack/react-router"
import { Footprints, MapPin, Pencil, Trash2, TrendingUp } from "lucide-react"

import type { RunningPlanSummaryPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { computeProgress, formatDateRange, PLAN_STATUS_META } from "./running-utils"

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
  const progress = computeProgress(plan)

  return (
    <Link to="/routines/run/$planId" params={{ planId: plan.id }}>
      <div className="group/card relative flex flex-col gap-3.5 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl transition-all duration-200 hover:border-emerald-500/40 hover:bg-slate-900/90 cursor-pointer">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Footprints className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-white group-hover/card:text-emerald-300 transition-colors">
                {plan.name}
              </h3>
              {plan.goal && (
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-400 font-medium">
                  {plan.goal}
                </p>
              )}
            </div>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border",
              status.className || "bg-slate-800 text-slate-300 border-slate-700",
            )}
          >
            {status.label}
          </span>
        </div>

        {/* Progress bar (only for plans with sessions) */}
        {progress.total > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="flex h-full">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                  style={{
                    width: `${(progress.completed / progress.total) * 100}%`,
                    borderRadius:
                      progress.missed === 0 &&
                      progress.completed === progress.total
                        ? "9999px"
                        : "9999px 0 0 9999px",
                  }}
                />
                {progress.missed > 0 && (
                  <div
                    className="h-full bg-red-500/70 transition-all duration-500"
                    style={{
                      width: `${(progress.missed / progress.total) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {progress.completed}/{progress.total} sesiones
              </span>
              <span className="font-bold text-emerald-400">
                {progress.percent}%
              </span>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="flex items-center gap-1 text-slate-300 font-semibold">
            <TrendingUp className="size-3.5 text-slate-400" />
            {plan.weeks} {plan.weeks === 1 ? "semana" : "semanas"}
          </span>
          <span>·</span>
          <span className="font-extrabold text-emerald-400">
            {plan.planned_km} km
          </span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5 text-slate-500" />
            {formatDateRange(plan.start_date, plan.end_date)}
          </span>
          {progress.completed > 0 && (
            <>
              <span>·</span>
              <span className="font-bold text-emerald-400">
                {progress.completed} completadas
              </span>
            </>
          )}
          {progress.missed > 0 && (
            <>
              <span>·</span>
              <span className="font-bold text-red-400">
                {progress.missed} perdidas
              </span>
            </>
          )}
        </div>

        {/* Action buttons (hover) */}
        {(onEdit || onDelete) && (
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 opacity-100 transition-opacity group-hover/card:opacity-100 max-md:opacity-100 md:opacity-0">
            {onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar plan"
                className="size-8 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 shadow-md cursor-pointer"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar plan"
                className="size-8 rounded-xl bg-slate-800/90 border border-slate-700 text-red-400 hover:text-red-300 hover:bg-slate-700 shadow-md cursor-pointer"
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
