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
        "flex flex-col rounded-2xl bg-card p-4 shadow-card dark:border dark:border-border/50",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-label-sm text-on-surface-variant uppercase">
          {title}
        </h3>
        {kpi !== undefined && (
          <p className="text-headline-md text-primary">
            {kpi}
            {kpiHint && (
              <span className="ml-2 text-body-md text-on-surface-variant">
                {kpiHint}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-1 flex-col">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4 text-center">
            <p className="text-body-md text-on-surface-variant">
              No pudimos cargar estos datos.
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Reintentar
              </Button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-1 items-center justify-center py-4 text-center">
            <p className="text-body-md text-on-surface-variant">{emptyText}</p>
          </div>
        ) : (
          <div className="text-on-surface-variant">{children}</div>
        )}
      </div>
    </div>
  )
}
