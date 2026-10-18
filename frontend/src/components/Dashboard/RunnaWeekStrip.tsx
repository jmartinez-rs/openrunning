import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
import type React from "react"
import { useMemo } from "react"
import type { RunningWorkoutPublic } from "@/client"
import {
  formatDayKey,
  type MonthCursor,
  monthDayKeys,
  monthStartOffset,
  RUNNING_TIMEZONE,
} from "@/lib/dashboard-dates"
import { isWorkoutCompleted } from "@/lib/dashboard-model"

export interface RunnaDayItem {
  dateIso: string
  dayName: string
  dayNumber: number
  isToday: boolean
  isSelected: boolean
  hasWorkout: boolean
  workoutType?: string | null
  isCompleted?: boolean
  hasActivity?: boolean
}

interface RunnaWeekStripProps {
  days: RunnaDayItem[]
  selectedDateIso: string
  workoutsByDate?: Map<string, RunningWorkoutPublic>
  /** Run days (local keys) of the displayed month, for the expanded grid (R9). */
  monthActivityDates?: ReadonlySet<string>
  /** Month-grid expansion is owned by the route; this component is controlled. */
  isMonthExpanded: boolean
  /** Calendar month shown when expanded (0-based `month`). */
  monthCursor: MonthCursor
  onToggleMonth: () => void
  onShiftMonth: (delta: number) => void
  onSelectDay: (dateIso: string) => void
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: RUNNING_TIMEZONE,
  month: "long",
  year: "numeric",
})

/**
 * R10 — the token that cues a DONE session. It belongs to `getDotClassName`, so
 * the weekly and the monthly grids show the very same completion cue and
 * neither grid adds styling of its own. It is the single stylistic difference
 * the tests hang on, so the dot's other utilities stay free to change.
 */
export const COMPLETED_DOT_CLASS = "ring-2 ring-emerald-500/20"

/**
 * R10 — the token that mutes a planned-but-not-done dot. Like
 * `COMPLETED_DOT_CLASS`, it is applied by `getDotClassName` for both grids.
 */
export const PENDING_DOT_CLASS = "opacity-30"

/** Colour of the session dot, by workout type. Never depends on completion. */
function getDotColor(workoutType?: string | null): string {
  switch (workoutType) {
    case "tempo":
      return "bg-amber-400"
    case "intervals":
      return "bg-orange-400"
    case "easy_run":
    case "regeneration":
      return "bg-lime-400"
    case "long_run":
      return "bg-purple-500"
    case "test":
    case "race":
      return "bg-rose-500"
    default:
      return "bg-lime-400"
  }
}

/**
 * R10 — a session that is DONE keeps its type colour at full strength plus the
 * shared completion cue; a session that is still pending (future/planned, or
 * past but never done) shows the very same hue muted, so "planned" never reads
 * like "done". Both grids call this, so neither can invent its own cue.
 */
export function getDotClassName(
  workoutType?: string | null,
  isCompleted?: boolean,
): string {
  const color = getDotColor(workoutType)
  return isCompleted
    ? `${color} ${COMPLETED_DOT_CLASS}`
    : `${color} ${PENDING_DOT_CLASS}`
}

export const RunnaWeekStrip: React.FC<RunnaWeekStripProps> = ({
  days,
  selectedDateIso,
  workoutsByDate,
  monthActivityDates,
  isMonthExpanded,
  monthCursor,
  onToggleMonth,
  onShiftMonth,
  onSelectDay,
}) => {
  // "Hoy" pinned al huso de running: nunca `toISOString()`, que rota de día
  // entre las 21:00 y las 24:00 locales (R1/E1).
  const todayIso = useMemo(() => formatDayKey(new Date()), [])

  const monthLabel = useMemo(() => {
    // Ancla a mediodía UTC para que la etiqueta no se corra de mes.
    const anchor = new Date(
      Date.UTC(monthCursor.year, monthCursor.month, 1, 12),
    )
    const formatted = MONTH_LABEL_FORMATTER.format(anchor)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [monthCursor])

  // Días del mes como claves locales puras (`monthDayKeys`), sin getters del
  // host; el offset Monday-first viene de `monthStartOffset`.
  const monthCalendarData = useMemo(() => {
    const items: Array<{
      dateIso: string
      dayNumber: number
      isToday: boolean
      isSelected: boolean
      hasWorkout: boolean
      workoutType?: string | null
      isCompleted?: boolean
      hasActivity: boolean
    } | null> = []

    for (let i = 0; i < monthStartOffset(monthCursor); i++) {
      items.push(null)
    }

    for (const iso of monthDayKeys(monthCursor)) {
      const wo = workoutsByDate?.get(iso)

      items.push({
        dateIso: iso,
        dayNumber: Number(iso.slice(8, 10)),
        isToday: iso === todayIso,
        isSelected: iso === selectedDateIso,
        hasWorkout: Boolean(wo),
        workoutType: wo?.type || null,
        isCompleted: wo ? isWorkoutCompleted(wo) : false,
        hasActivity: Boolean(monthActivityDates?.has(iso)),
      })
    }

    return items
  }, [
    monthCursor,
    workoutsByDate,
    selectedDateIso,
    todayIso,
    monthActivityDates,
  ])

  return (
    <div className="w-full pt-1 pb-2 transition-all">
      {!isMonthExpanded ? (
        /* Vista semanal clásica (7 días) */
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((day) => {
            const dotColor = day.hasWorkout
              ? getDotClassName(day.workoutType, day.isCompleted)
              : "transparent"

            return (
              <button
                key={day.dateIso}
                type="button"
                data-day={day.dateIso}
                onClick={() => onSelectDay(day.dateIso)}
                className="flex flex-col items-center justify-center py-1 rounded-2xl transition-all cursor-pointer select-none group"
              >
                {/* Nombre abreviado: LUN, MAR, etc. */}
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  {day.dayName}
                </span>

                {/* Número del día */}
                <div
                  className={`size-9 flex items-center justify-center rounded-full text-sm transition-all ${
                    day.isSelected
                      ? "bg-white text-zinc-950 font-black shadow-lg scale-105"
                      : day.isToday
                        ? "text-primary font-black ring-1 ring-primary/40 bg-primary/10"
                        : "text-zinc-200 font-bold hover:text-white hover:bg-white/5"
                  }`}
                >
                  {day.dayNumber}
                </div>

                {/* Punto indicador: sesión planificada + marca de actividad */}
                <div className="h-2 flex items-center justify-center gap-1 mt-1">
                  {day.hasWorkout ? (
                    <span className={`size-2 rounded-full ${dotColor}`} />
                  ) : (
                    <span className="size-2 opacity-0" />
                  )}
                  {day.hasActivity ? (
                    <span
                      data-activity="true"
                      role="img"
                      aria-label="Actividad registrada"
                      title="Actividad registrada"
                      className="size-2 rounded-full border-2 border-sky-400 bg-transparent"
                    />
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        /* Vista mensual completa expandida */
        <div className="rounded-3xl bg-[#17171a] border border-white/10 p-4 shadow-card animate-in fade-in zoom-in-95 duration-200">
          {/* Navegación del mes */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/5 px-1">
            <button
              type="button"
              onClick={() => onShiftMonth(-1)}
              className="size-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </button>

            <span className="text-sm font-display font-black text-white tracking-tight">
              {monthLabel}
            </span>

            <button
              type="button"
              onClick={() => onShiftMonth(1)}
              className="size-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"].map((d) => (
              <span
                key={d}
                className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider py-1"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Rejilla de días del mes */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {monthCalendarData.map((item, idx) => {
              if (!item) {
                return <div key={`empty-${idx}`} className="size-9 mx-auto" />
              }

              const dotColor = item.hasWorkout
                ? getDotClassName(item.workoutType, item.isCompleted)
                : "transparent"

              return (
                <button
                  key={item.dateIso}
                  type="button"
                  data-day={item.dateIso}
                  onClick={() => {
                    onSelectDay(item.dateIso)
                  }}
                  className="flex flex-col items-center justify-center py-1 transition-all cursor-pointer select-none group"
                >
                  <div
                    className={`size-8 flex items-center justify-center rounded-full text-xs transition-all ${
                      item.isSelected
                        ? "bg-white text-zinc-950 font-black shadow-md scale-105"
                        : item.isToday
                          ? "text-primary font-black ring-1 ring-primary/40 bg-primary/10"
                          : "text-zinc-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.dayNumber}
                  </div>

                  <div className="h-1.5 flex items-center justify-center gap-1 mt-0.5">
                    {item.hasWorkout ? (
                      <span className={`size-1.5 rounded-full ${dotColor}`} />
                    ) : (
                      <span className="size-1.5 opacity-0" />
                    )}
                    {item.hasActivity ? (
                      <span
                        data-activity="true"
                        role="img"
                        aria-label="Actividad registrada"
                        title="Actividad registrada"
                        className="size-1.5 rounded-full border border-sky-400 bg-transparent"
                      />
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Notch / Drawer handle interactivo para expandir/contraer el mes */}
      <button
        type="button"
        onClick={onToggleMonth}
        className="group flex flex-col items-center justify-center mx-auto mt-2.5 p-1 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 transition-all hover:scale-105"
        title={
          isMonthExpanded
            ? "Contraer a vista semanal"
            : "Agrandar y mostrar calendario del mes"
        }
        aria-label={
          isMonthExpanded
            ? "Contraer a vista semanal"
            : "Agrandar y mostrar calendario del mes"
        }
      >
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-white/20 group-hover:bg-white/40 rounded-full transition-colors" />
          {isMonthExpanded ? (
            <ChevronUp className="size-3 text-zinc-400 group-hover:text-white" />
          ) : (
            <ChevronDown className="size-3 text-zinc-400 group-hover:text-white" />
          )}
        </div>
      </button>
    </div>
  )
}
