import { Flag, TrendingUp } from "lucide-react"

import { cn } from "@/lib/utils"

type MilestoneTone = "primary" | "neutral" | "race"

interface PlanMilestoneBadgeProps {
  label: string
  tone?: MilestoneTone
  className?: string
}

const TONE_CLASS: Record<MilestoneTone, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  neutral: "bg-surface-container-high text-muted-foreground border-border",
  race: "bg-domain-cardio/15 text-domain-cardio border-domain-cardio/30",
}

/** Marcador inline de hito del plan (mitad / recta final / día de carrera). */
export function PlanMilestoneBadge({
  label,
  tone = "primary",
  className,
}: PlanMilestoneBadgeProps) {
  const Icon = tone === "race" ? Flag : TrendingUp
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wide whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="size-2.5" />
      {label}
    </span>
  )
}
