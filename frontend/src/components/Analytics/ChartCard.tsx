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
        "flex flex-col rounded-2xl bg-card border border-border p-5 shadow-card transition-all hover:border-primary/20",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {kpi !== undefined && (
          <p className="text-3xl font-black font-display text-foreground">
            {kpi}
            {kpiHint && (
              <span className="ml-2 text-xs font-normal font-sans text-muted-foreground">
                {kpiHint}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        {loading ? (
          <Skeleton className="h-48 w-full rounded-xl bg-secondary" />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              No pudimos cargar estos datos.
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-border bg-secondary text-xs font-bold text-foreground hover:bg-surface-bright"
                onClick={onRetry}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Reintentar
              </Button>
            )}
          </div>
        ) : empty ? (
          <div className="flex flex-1 items-center justify-center py-6 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              {emptyText}
            </p>
          </div>
        ) : (
          <div className="text-foreground">{children}</div>
        )}
      </div>
    </div>
  )
}
