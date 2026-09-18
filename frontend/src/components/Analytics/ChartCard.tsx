import { RefreshCw } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ChartCardProps {
  title: string
  kpi?: ReactNode
  kpiHint?: string
  loading?: boolean
  error?: boolean
  empty?: boolean
  emptyText?: string
  onRetry?: () => void
  className?: string
  children?: ReactNode
}

export function ChartCard({
  title,
  kpi,
  kpiHint,
  loading = false,
  error = false,
  empty = false,
  emptyText = "Todavía no hay datos para este período.",
  onRetry,
  className,
  children,
}: ChartCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          {title}
        </h3>
        {kpi !== undefined && (
          <p className="text-2xl font-black text-white">
            {kpi}
            {kpiHint && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                {kpiHint}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl bg-slate-800/80" />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-xs font-medium text-slate-400">
              No pudimos cargar estos datos.
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Reintentar
              </Button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-1 items-center justify-center py-6 text-center">
            <p className="text-xs font-medium text-slate-400">{emptyText}</p>
          </div>
        ) : (
          <div className="text-slate-300">{children}</div>
        )}
      </div>
    </div>
  )
}
