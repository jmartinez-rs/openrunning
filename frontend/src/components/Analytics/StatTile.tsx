import type { ReactNode } from "react"

interface StatTileProps {
  icon: ReactNode
  label: string
  value: ReactNode
  /** Optional color override for the value text */
  valueColor?: string
}

export function StatTile({ icon, label, value, valueColor }: StatTileProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card border border-border p-4 shadow-card hover:border-primary/20 transition-all">
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
    </div>
  )
}
