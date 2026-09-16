import type { ReactNode } from "react"
import { useEffect, useRef } from "react"

const MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]

const DAYS_ES = ["Lun", "", "Mié", "", "Vie", "", ""]

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
  /** Called when a day with data is tapped/clicked */
  onDay?: (iso: string) => void
}

/**
 * GitHub-style activity heatmap, 52 weeks, shaded by km run.
 * Ported from OpenGym's Heatmap.jsx, adapted for running data.
 */
export function RunningHeatmap({ data, onDay }: RunningHeatmapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to the right (most recent) on mount
  useEffect(() => {
    if (wrapRef.current) {
      wrapRef.current.scrollLeft = wrapRef.current.scrollWidth
    }
  }, [])

  // Aggregate data by date
  const agg: Record<string, { km: number; sessions: number }> = {}
  for (const d of data) {
    const prev = agg[d.date]
    if (prev) {
      prev.km += d.km
      prev.sessions += d.sessions
    } else {
      agg[d.date] = { km: d.km, sessions: d.sessions }
    }
  }

  // Compute quartile thresholds for shading levels
  const kms = Object.values(agg)
    .map((a) => a.km)
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
  const q = (p: number) =>
    kms.length
      ? kms[Math.min(kms.length - 1, Math.floor(p * kms.length))]
      : 0
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
  start.setDate(end.getDate() - 52 * 7)

  const months: ReactNode[] = []
  const cols: ReactNode[] = []
  let lastMonth = -1

  for (let wk = 0; wk <= 52; wk++) {
    const colStart = new Date(start)
    colStart.setDate(start.getDate() + wk * 7)
    const mo = colStart.getMonth()
    const showM = mo !== lastMonth && colStart.getDate() <= 7 && wk < 51
    months.push(
      <span key={wk} className="hm-mo">
        {showM ? MONTHS_ES[mo] : ""}
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

      cells.push(
        <div
          key={d}
          className={`hm-c l${lvl}${isToday ? " today" : ""}${isFuture ? " future" : ""}`}
          title={
            key +
            (a
              ? ` · ${a.sessions} ${a.sessions === 1 ? "carrera" : "carreras"} · ${a.km.toFixed(1)} km`
              : "")
          }
          onClick={a ? () => onDay?.(key) : undefined}
        />,
      )
    }
    cols.push(
      <div key={wk} className="hm-col">
        {cells}
      </div>,
    )
  }

  return (
    <>
      <div className="hm-wrap" ref={wrapRef}>
        <div className="hm-months" style={{ marginLeft: 30 }}>
          {months}
        </div>
        <div className="hm-body">
          <div className="hm-days">
            {DAYS_ES.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="hm-grid">{cols}</div>
        </div>
      </div>
      <div className="hm-legend">
        Menos km{" "}
        <div className="hm-c l0" />
        <div className="hm-c l1" />
        <div className="hm-c l2" />
        <div className="hm-c l3" />
        <div className="hm-c l4" /> Más km
      </div>
    </>
  )
}
