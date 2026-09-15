import HeatMap from "@uiw/react-heat-map"
import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  PersonStanding,
  Waves,
} from "lucide-react"
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react"

import type { ActivityTypeSummary } from "@/client"
import { DOMAIN_COLORS } from "@/components/Analytics/chart-theme"
import { cn } from "@/lib/utils"
import {
  categoryBgSoft,
  categoryText,
  formatElevation,
  getCategoryFromType,
} from "./activity-summary-utils"
import { formatDistance, formatDuration } from "./activity-utils"

const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  running: Footprints,
  cycling: Bike,
  walking: PersonStanding,
  swimming: Waves,
  strength: Dumbbell,
  other: Activity,
}

const CATEGORY_COLORS: Record<string, string> = {
  running: DOMAIN_COLORS.cardio,
  cycling: DOMAIN_COLORS.success,
  walking: DOMAIN_COLORS.active,
  swimming: DOMAIN_COLORS.pace,
  strength: DOMAIN_COLORS.strength,
  other: DOMAIN_COLORS.race,
}

interface ActivityTypeCardsProps {
  by_type: ActivityTypeSummary[]
}

export function ActivityTypeCards({ by_type }: ActivityTypeCardsProps) {
  const aggregated = useMemo(() => {
    const agg: Record<string, any> = {
      running: {
        category: "running",
        label: "Running",
        count: 0,
        distance: 0,
        duration: 0,
        elevation: 0,
        dotDays: new Set<string>(),
      },
      strength: {
        category: "strength",
        label: "Gimnasio",
        count: 0,
        distance: 0,
        duration: 0,
        elevation: 0,
        dotDays: new Set<string>(),
      },
    }

    for (const item of by_type) {
      const cat = getCategoryFromType(item.type)
      if (cat === "running" || cat === "strength") {
        agg[cat].count += item.count
        agg[cat].distance += item.distance_meters || 0
        agg[cat].duration += item.duration_seconds || 0
        agg[cat].elevation += item.elevation_gain_meters || 0
        for (const d of item.dot_days || []) agg[cat].dotDays.add(d)
      }
    }

    return [
      { ...agg.running, dotDays: Array.from(agg.running.dotDays).sort() },
      { ...agg.strength, dotDays: Array.from(agg.strength.dotDays).sort() },
    ]
  }, [by_type])

  return (
    <>
      {aggregated.map((summary) => (
        <div key={summary.category} className="min-w-[260px] flex-1">
          <AggregatedCard summary={summary} />
        </div>
      ))}
    </>
  )
}

function AggregatedCard({ summary }: { summary: any }) {
  const Icon = CATEGORY_ICONS[summary.category] ?? Activity

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-card p-4 shadow-card dark:border dark:border-border/50">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            categoryBgSoft(summary.category),
          )}
        >
          <Icon className={cn("size-5", categoryText(summary.category))} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-lg font-semibold text-primary">
            {summary.label}
          </h3>
          <p className="text-label-sm text-on-surface-variant">
            Últimas 4 semanas
          </p>
        </div>
        <span className="text-title-lg font-semibold text-primary">
          {summary.count}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <Metric
          label={summary.category === "running" ? "Elev Gain" : "Sesiones"}
          value={
            summary.category === "running"
              ? formatElevation(summary.elevation)
              : summary.count.toString()
          }
        />
        <Metric
          label={summary.category === "running" ? "Distancia" : "Tiempo Avg"}
          value={
            summary.category === "running"
              ? formatDistance(summary.distance)
              : formatDuration(
                  summary.count > 0 ? summary.duration / summary.count : 0,
                )
          }
        />
        <Metric label="Tiempo Total" value={formatDuration(summary.duration)} />
      </div>

      {/* Chart — grows to fill remaining space */}
      <div className="min-h-[120px] flex-1">
        <HeatmapChart dotDays={summary.dotDays} category={summary.category} />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface-container-low px-2 py-1.5">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      <span className="text-body-md font-semibold text-primary">{value}</span>
    </div>
  )
}

function HeatmapChart({
  dotDays = [],
  category = "other",
}: {
  dotDays?: string[]
  category?: string
}) {
  const color = CATEGORY_COLORS[category] ?? DOMAIN_COLORS.race
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 120 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setDims({ width: el.clientWidth || 300, height: el.clientHeight || 120 })
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0)
          setDims({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const value = useMemo(
    () => dotDays.map((date) => ({ date, count: 1 })),
    [dotDays],
  )

  const endDate = useMemo(() => {
    if (dotDays.length > 0) {
      const parts = dotDays[dotDays.length - 1].split("-")
      return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2]),
        12,
        0,
        0,
        0,
      )
    }
    return new Date()
  }, [dotDays])

  const startDate = useMemo(() => {
    const d = new Date(endDate)
    d.setDate(d.getDate() - 28) // 4 weeks
    return d
  }, [endDate])

  const SPACE = 2
  const LABEL_W = 28 // px reserved for day-of-week labels on the left
  const COLS = 5 // 4 weeks = up to 5 columns
  const ROWS = 7 // days per week

  // Constrain cell size by whichever axis is tighter
  const byWidth = Math.floor((dims.width - LABEL_W - SPACE * (COLS - 1)) / COLS)
  const byHeight = Math.floor((dims.height - 20 - SPACE * (ROWS - 1)) / ROWS)
  const cellSize = Math.min(Math.max(byWidth, byHeight, 8), 18)

  return (
    <div ref={containerRef} className="h-full w-full pt-2">
      <HeatMap
        value={value}
        width={dims.width}
        style={{ color: "currentColor", fontSize: "10px", display: "block" }}
        startDate={startDate}
        endDate={endDate}
        rectSize={cellSize}
        space={SPACE}
        legendCellSize={0}
        rectProps={{ rx: Math.ceil(cellSize * 0.25) }}
        panelColors={{
          0: "var(--color-surface-container-high, rgba(128, 128, 128, 0.15))",
          1: color,
        }}
      />
    </div>
  )
}
