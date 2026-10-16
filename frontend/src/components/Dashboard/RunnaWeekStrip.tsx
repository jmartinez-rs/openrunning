import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
import type React from "react"
import { useMemo, useState } from "react"
import type { RunningWorkoutPublic } from "@/client"

export interface RunnaDayItem {
  dateIso: string
  dayName: string
  dayNumber: number
  isToday: boolean
  isSelected: boolean
  hasWorkout: boolean
  workoutType?: string | null
  isCompleted?: boolean
}

interface RunnaWeekStripProps {
  days: RunnaDayItem[]
  selectedDateIso: string
  workoutsByDate?: Map<string, RunningWorkoutPublic>
  onSelectDay: (dateIso: string) => void
}

function getDotColor(workoutType?: string | null, isCompleted?: boolean): string {
  if (isCompleted) return "bg-emerald-400"
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

export const RunnaWeekStrip: React.FC<RunnaWeekStripProps> = ({
  days,
  selectedDateIso,
  workoutsByDate,
  onSelectDay,
}) => {
  const [isMonthExpanded, setIsMonthExpanded] = useState(false)

  // Mes y año para la vista mensual
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const initial = selectedDateIso ? new Date(`${selectedDateIso}T12:00:00`) : new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })

  const todayIso = useMemo(() => new Date().toISOString().split("T")[0], [])

  const monthLabel = useMemo(() => {
    const formatted = new Intl.DateTimeFormat("es-AR", {
      month: "long",
      year: "numeric",
    }).format(currentMonthDate)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }, [currentMonthDate])

  const shiftMonth = (delta: number) => {
    setCurrentMonthDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    )
  }

  // Generación de días del mes
  const monthCalendarData = useMemo(() => {
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Lunes = 0, Domingo = 6
    let startOffset = firstDay.getDay() - 1
    if (startOffset === -1) startOffset = 6

    const totalDays = lastDay.getDate()
    const items: Array<{
      dateIso: string
      dayNumber: number
      isToday: boolean
      isSelected: boolean
      hasWorkout: boolean
      workoutType?: string | null
      isCompleted?: boolean
    } | null> = []

    for (let i = 0; i < startOffset; i++) {
      items.push(null)
    }

    for (let d = 1; d <= totalDays; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const wo = workoutsByDate?.get(iso)
      const isCompleted =
        wo?.status_override === "completed" || Boolean(wo?.matched_activity_id)

      items.push({
        dateIso: iso,
        dayNumber: d,
        isToday: iso === todayIso,
        isSelected: iso === selectedDateIso,
        hasWorkout: Boolean(wo),
        workoutType: wo?.type || null,
        isCompleted,
      })
    }

    return items
  }, [currentMonthDate, workoutsByDate, selectedDateIso, todayIso])

  return (
    <div className="w-full pt-1 pb-2 transition-all">
      {!isMonthExpanded ? (
        /* Vista semanal clásica (7 días) */
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((day) => {
            const dotColor = day.hasWorkout
              ? getDotColor(day.workoutType, day.isCompleted)
              : "transparent"

            return (
              <button
                key={day.dateIso}
                type="button"
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

                {/* Punto indicador de sesión */}
                <div className="h-2 flex items-center justify-center mt-1">
                  {day.hasWorkout ? (
                    <span
                      className={`size-2 rounded-full ${dotColor} ${
                        day.isCompleted ? "ring-2 ring-emerald-500/20" : ""
                      }`}
                    />
                  ) : (
                    <span className="size-2 opacity-0" />
                  )}
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
              onClick={() => shiftMonth(-1)}
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
              onClick={() => shiftMonth(1)}
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
                ? getDotColor(item.workoutType, item.isCompleted)
                : "transparent"

              return (
                <button
                  key={item.dateIso}
                  type="button"
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

                  <div className="h-1.5 flex items-center justify-center mt-0.5">
                    {item.hasWorkout ? (
                      <span className={`size-1.5 rounded-full ${dotColor}`} />
                    ) : (
                      <span className="size-1.5 opacity-0" />
                    )}
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
        onClick={() => setIsMonthExpanded((prev) => !prev)}
        className="group flex flex-col items-center justify-center mx-auto mt-2.5 p-1 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 transition-all hover:scale-105"
        title={isMonthExpanded ? "Contraer a vista semanal" : "Agrandar y mostrar calendario del mes"}
        aria-label={isMonthExpanded ? "Contraer a vista semanal" : "Agrandar y mostrar calendario del mes"}
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
