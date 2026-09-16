import type { ReactNode } from "react"

interface StatTileProps {
  icon: ReactNode
  label: string
  value: ReactNode
  /** Optional color override for the value text */
  valueColor?: string
}

/**
 * Summary tile inspired by OpenGym's .tiles grid.
 * Renders an icon + label row and a large numeric value below.
 */
export function StatTile({ icon, label, value, valueColor }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-card p-4 shadow-card dark:border dark:border-border/50">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <span className="text-base">{icon}</span>
        <span className="text-label-sm uppercase tracking-wide">{label}</span>
      </div>
      <div
        className="text-[26px] font-semibold leading-tight tracking-tight tabular-nums"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
    </div>
  )
}
