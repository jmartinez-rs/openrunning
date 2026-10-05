import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface StatTileProps {
  icon: ReactNode
  label: string
  value: ReactNode
  /** Optional color override for the value text */
  valueColor?: string
  /** Optional supporting line under the value (empty states, context). */
  hint?: ReactNode
  /** When set, the whole tile becomes a link. */
  to?: string
}

export function StatTile({
  icon,
  label,
  value,
  valueColor,
  hint,
  to,
}: StatTileProps) {
  const base = cn(
    "flex flex-col gap-2 rounded-2xl bg-card border border-border p-4 shadow-card",
    to && "transition-colors hover:border-primary/30",
  )

  const content = (
    <>
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </div>
        <span className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-black font-display tracking-tight text-foreground tabular-nums mt-0.5"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {hint && (
        <p className="text-[11px] font-medium text-muted-foreground">{hint}</p>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={base}>
        {content}
      </Link>
    )
  }

  return <div className={base}>{content}</div>
}
