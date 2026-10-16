import { Link } from "@tanstack/react-router"
import { ArrowRight, Pencil, Trash2 } from "lucide-react"

import type { RunningPlanSummaryPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  computeProgress,
  formatDateRange,
  formatRunnaDate,
  PLAN_STATUS_META,
} from "./running-utils"

interface RunningPlanCardProps {
  plan: RunningPlanSummaryPublic
  isActiveFeatured?: boolean
  onEdit?: () => void
  onDelete?: () => void
  deleting?: boolean
  className?: string
}

export function RunningPlanCard({
  plan,
  isActiveFeatured = false,
  onEdit,
  onDelete,
  deleting = false,
  className,
}: RunningPlanCardProps) {
  const status = PLAN_STATUS_META[plan.status]
  const progress = computeProgress(plan)

  // Estimación de distancia para el escudo Runna
  const matchNum = plan.name.match(/\b(42|21|15|10|5)k?\b/i)
  const distanceKm =
    plan.distance_km ||
    (matchNum
      ? Number(matchNum[1])
      : plan.goal?.includes("42")
        ? 42.2
        : plan.goal?.includes("21")
          ? 21.1
          : plan.goal?.includes("15")
            ? 15
            : plan.goal?.includes("10")
              ? 10
              : plan.goal?.includes("5")
                ? 5
                : Math.round(plan.planned_km / (plan.weeks || 1)))

  const totalWeeks = plan.weeks || 1

  return (
    <Link
      to="/routines/run/$planId"
      params={{ planId: plan.id }}
      className="block group/card outline-none"
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-card/90 p-5 sm:p-6 shadow-md transition-all hover:border-primary/40 hover:bg-card cursor-pointer",
          isActiveFeatured
            ? "border-primary/40 bg-gradient-to-b from-card via-card to-primary/[0.04] ring-1 ring-primary/20"
            : "border-border/80",
          className,
        )}
      >
        {/* ── Fila Superior: Título + Escudo de distancia ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className={cn(
                  "font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide",
                  status.className || "text-muted-foreground border-border",
                )}
              >
                {status.label}
              </Badge>
              {isActiveFeatured && (
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                  ★ En curso
                </span>
              )}
            </div>

            <h3 className="truncate font-display text-xl sm:text-2xl font-black tracking-tight text-white group-hover/card:text-primary transition-colors">
              {plan.name}
            </h3>

            <p className="mt-1 text-xs font-semibold text-muted-foreground truncate">
              {plan.end_date ? (
                <>
                  Tu carrera:{" "}
                  <span className="text-zinc-200 uppercase">
                    {formatRunnaDate(plan.end_date)}
                  </span>
                </>
              ) : plan.goal ? (
                plan.goal
              ) : (
                formatDateRange(plan.start_date, plan.end_date)
              )}
            </p>
          </div>

          {/* Escudo / Badge de distancia estilo Runna */}
          <div className="relative shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-b-2xl bg-gradient-to-b from-red-600 via-red-700 to-red-900 border border-red-500/50 shadow-md text-white">
            <span className="font-display text-xs font-black tracking-tighter leading-none">
              {distanceKm >= 10 ? Math.round(distanceKm) : distanceKm}
            </span>
            <span className="text-[9px] font-black uppercase tracking-wider leading-none mt-0.5">
              KM
            </span>
            {isActiveFeatured && (
              <div className="mt-1 size-1 rounded-full bg-red-300 animate-pulse" />
            )}
          </div>
        </div>

        {/* ── Barra segmentada de semanas estilo Runna ── */}
        <div className="mt-5 flex items-center gap-1.5 w-full">
          {Array.from({ length: Math.min(totalWeeks, 16) }).map((_, idx) => {
            const completedCount = Math.floor(
              (progress.completed / (progress.total || 1)) * totalWeeks,
            )
            const isDone = idx < completedCount
            const isCurrent = idx === completedCount && isActiveFeatured

            return (
              <div
                key={idx}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  isDone
                    ? "bg-primary"
                    : isCurrent
                      ? "bg-white/80"
                      : "bg-surface-container-high/60 dark:bg-zinc-700/60",
                )}
              />
            )
          })}
        </div>

        {/* ── Métricas principales: Total de semanas / Distancia total ── */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-muted-foreground">
              Total de semanas
            </span>
            <span className="font-display text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums mt-0.5">
              {totalWeeks} sem.
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-muted-foreground">
              Distancia total
            </span>
            <span className="font-display text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums mt-0.5">
              {plan.planned_km > 0 ? `${plan.planned_km.toFixed(1)} km` : "—"}
            </span>
          </div>
        </div>

        {/* ── Pie de tarjeta: progreso y CTA o acciones ── */}
        <div className="mt-4 pt-3.5 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {progress.total > 0
              ? `${progress.completed}/${progress.total} sesiones · ${progress.percent}%`
              : `${plan.sessions || 0} sesiones`}
          </span>

          <div className="flex items-center gap-2">
            {isActiveFeatured ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover/card:translate-x-0.5 transition-transform">
                Ver tu plan <ArrowRight className="size-3.5" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover/card:text-white transition-colors">
                Detalles <ArrowRight className="size-3.5" />
              </span>
            )}

            {/* Botones de acción */}
            {(onEdit || onDelete) && (
              <div
                className="flex items-center gap-1 ml-2 pl-2 border-l border-border/50"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                {onEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Editar plan"
                    className="size-7 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onEdit()
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar plan"
                    disabled={deleting}
                    className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDelete()
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

