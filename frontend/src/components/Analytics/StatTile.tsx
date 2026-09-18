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
    <div className="flex flex-col gap-2 rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl hover:border-slate-700 transition-all">
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          {icon}
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-black tracking-tight text-white tabular-nums mt-0.5"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
    </div>
  )
}
