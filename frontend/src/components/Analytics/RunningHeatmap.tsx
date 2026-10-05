import type { CSSProperties, ReactNode } from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { MONTH_LABELS_ES } from "@/components/Analytics/chart-theme"
import { cn } from "@/lib/utils"

const DAYS_ES = ["Lun", "", "Mié", "", "Vie", "", ""]

const MIN_CELL = 4
const MAX_CELL = 14
const DAY_GUTTER = 28
/** Separación mínima entre dos etiquetas de mes para que no se solapen. */
const MIN_LABEL_GAP_PX = 24

function isoOf(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function todayISO(): string {
  return isoOf(new Date())
}

interface HeatmapDay {
  date: string // ISO yyyy-mm-dd
  km: number
  sessions: number
}

interface RunningHeatmapProps {
  /** Array of days with their running data */
  data: HeatmapDay[]
  /** Number of weeks to render (defaults to 52). */
  weeks?: number
  /** Called when a day with data is activated (tap, click or keyboard). */
  onDay?: (iso: string) => void
}

interface Metrics {
  cell: number
  gap: number
  gutter: number
  compact: boolean
  fits: boolean
}

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

/**
 * GitHub-style activity heatmap, shaded by km run.
 * The cell size adapts to the container so the selected period fits at a
 * glance; only when the minimum cell can't fit do we fall back to scroll.
 * Each day with data is a keyboard-focusable button with an aria-label.
 */
export function RunningHeatmap({
  data,
  weeks = 52,
  onDay,
}: RunningHeatmapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<Metrics>({
    cell: 11,
    gap: 3,
    gutter: DAY_GUTTER,
    compact: false,
    fits: true,
  })

  // Measure the container and solve the cell size so all columns fit.
  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const cols = weeks + 1

    const compute = () => {
      const width = node.clientWidth
      if (!width) return

      const solve = (gutter: number) => {
        const rough = (width - gutter - (cols - 1) * 2) / cols
        const gap = rough >= 10 ? 3 : 2
        const cell = (width - gutter - (cols - 1) * gap) / cols
        return { cell, gap }
      }

      let { cell, gap } = solve(DAY_GUTTER)
      let gutter = DAY_GUTTER
      let compact = false

      // Below ~8px the weekday gutter labels no longer fit; reclaim the space.
      if (cell < 8) {
        compact = true
        gutter = 0
        const reclaimed = solve(0)
        cell = reclaimed.cell
        gap = reclaimed.gap
      }

      cell = Math.max(MIN_CELL, Math.min(MAX_CELL, cell))
      const total = cols * cell + (cols - 1) * gap + gutter
      const fits = total <= width + 1

      setMetrics((prev) =>
        prev.cell === cell &&
        prev.gap === gap &&
        prev.gutter === gutter &&
        prev.compact === compact &&
        prev.fits === fits
          ? prev
          : { cell, gap, gutter, compact, fits },
      )
    }

    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(node)
    return () => observer.disconnect()
  }, [weeks])

  // Only scroll to the most recent week when the grid actually overflows.
  useEffect(() => {
    const node = wrapRef.current
    if (!node) return
    node.scrollLeft = metrics.fits ? 0 : node.scrollWidth
  }, [metrics.fits])

  // Aggregate data by date
  const agg = useMemo(() => {
    const result: Record<string, { km: number; sessions: number }> = {}
    for (const d of data) {
      const prev = result[d.date]
      if (prev) {
        prev.km += d.km
        prev.sessions += d.sessions
      } else {
        result[d.date] = { km: d.km, sessions: d.sessions }
      }
    }
    return result
  }, [data])

  // Compute quartile thresholds for shading levels
  const kms = Object.values(agg)
    .map((a) => a.km)
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
  const q = (p: number) =>
    kms.length ? kms[Math.min(kms.length - 1, Math.floor(p * kms.length))] : 0
  const t1 = q(0.25)
  const t2 = q(0.5)
  const t3 = q(0.75)
  const level = (a: { km: number } | undefined) =>
    !a
      ? 0
      : a.km <= 0
        ? 0
        : a.km >= t3
          ? 4
          : a.km >= t2
            ? 3
            : a.km >= t1
              ? 2
              : 1

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  // End of the current week (Monday-based)
  const end = new Date(today)
  end.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const start = new Date(end)
  start.setDate(end.getDate() - weeks * 7)

  const pitch = metrics.cell + metrics.gap
  const minLabelCols = Math.max(1, Math.ceil(MIN_LABEL_GAP_PX / pitch))

  const months: ReactNode[] = []
  const cols: ReactNode[] = []
  let lastMonth = -1
  let lastLabelWk = -Number.POSITIVE_INFINITY

  for (let wk = 0; wk <= weeks; wk++) {
    const colStart = new Date(start)
    colStart.setDate(start.getDate() + wk * 7)
    const mo = colStart.getMonth()
    const isMonthStart =
      mo !== lastMonth && colStart.getDate() <= 7 && wk < weeks - 1
    const showLabel = isMonthStart && wk - lastLabelWk >= minLabelCols
    if (showLabel) lastLabelWk = wk
    months.push(
      <span key={wk} className="hm-mo">
        {showLabel ? MONTH_LABELS_ES[mo] : ""}
      </span>,
    )
    if (colStart.getDate() <= 7) lastMonth = mo

    const cells: ReactNode[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(colStart)
      day.setDate(colStart.getDate() + d)
      const key = isoOf(day)
      const a = agg[key]
      const lvl = level(a)
      const isToday = key === todayISO()
      const isFuture = day > today
      const interactive = Boolean(a) && !isFuture

      const classes = `hm-c l${lvl}${isToday ? " today" : ""}${isFuture ? " future" : ""}${interactive ? " hm-c--interactive" : ""}`

      if (interactive) {
        const label = `${DAY_LABEL_FORMATTER.format(day)} · ${(a?.km ?? 0).toFixed(1)} km · ${a?.sessions ?? 0} ${(a?.sessions ?? 0) === 1 ? "carrera" : "carreras"}`
        cells.push(
          <button
            key={d}
            type="button"
            className={classes}
            aria-label={label}
            title={label}
            onClick={() => onDay?.(key)}
          />,
        )
      } else {
        cells.push(<div key={d} className={classes} aria-hidden="true" />)
      }
    }
    cols.push(
      <div key={wk} className="hm-col">
        {cells}
      </div>,
    )
  }

  return (
    <>
      <div
        className={cn(
          "hm-wrap",
          metrics.fits && "hm-wrap--fit",
          metrics.compact && "hm-wrap--compact",
        )}
        ref={wrapRef}
        style={
          {
            "--hm-cell": `${metrics.cell}px`,
            "--hm-gap": `${metrics.gap}px`,
            "--hm-gutter": `${metrics.gutter}px`,
          } as CSSProperties
        }
      >
        <div className="hm-months">{months}</div>
        <div className="hm-body">
          <div className="hm-days" aria-hidden="true">
            {DAYS_ES.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="hm-grid">{cols}</div>
        </div>
      </div>
      <div className="hm-legend">
        Menos km <div className="hm-c l0" />
        <div className="hm-c l1" />
        <div className="hm-c l2" />
        <div className="hm-c l3" />
        <div className="hm-c l4" /> Más km
      </div>
    </>
  )
}
