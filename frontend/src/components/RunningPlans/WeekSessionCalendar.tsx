import { Check, ChevronRight, Moon, X } from "lucide-react"
import type { ComponentType } from "react"

import type { RunningWorkoutPublic } from "@/client"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
  formatDistance,
  formatPace,
  WORKOUT_TYPE_META,
  weekDaysISO,
} from "./running-utils"

const DAY_LABELS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"]

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
})

interface WeekSessionCalendarProps {
  mondayISO: string
  workouts: RunningWorkoutPublic[]
  className?: string
}

type DayState =
  | "rest"
  | "completed"
  | "missed"
  | "cancelled"
  | "pending"
  | "next"

function dayLabel(iso: string): { name: string; date: string } {
  const d = new Date(`${iso}T12:00:00`)
  return { name: DAY_LABELS[d.getDay()] ?? "?", date: dateFmt.format(d) }
}

function workoutDistanceKm(w: RunningWorkoutPublic): number | null {
  if (w.distance_km != null) return w.distance_km
  return blocksDistanceKm(w.blocks ?? [])
}

function workoutPaceText(w: RunningWorkoutPublic): string | null {
  if (w.pace_seconds_per_km != null) {
    const a = formatPace(w.pace_seconds_per_km).replace("/km", "")
    const end = w.blocks?.find(
      (b) => b.pace_range_end_seconds_per_km != null,
    )?.pace_range_end_seconds_per_km
    return end != null
      ? `${a}–${formatPace(end).replace("/km", "")}/km`
      : `${a}/km`
  }
  const block = w.blocks?.find((b) => b.pace_seconds_per_km != null)
  if (!block?.pace_seconds_per_km) return null
  const a = formatPace(block.pace_seconds_per_km).replace("/km", "")
  const end = block.pace_range_end_seconds_per_km
  return end != null
    ? `${a}–${formatPace(end).replace("/km", "")}/km`
    : `${a}/km`
}

const STATE_META: Record<
  DayState,
  {
    label: string
    icon: ComponentType<{ className?: string }> | null
    circleClass: string
    iconClass: string
    badgeClass: string
    cellClass: string
  }
> = {
  rest: {
    label: "Descanso",
    icon: Moon,
    circleClass: "bg-surface-container-high",
    iconClass: "text-on-surface-variant",
    badgeClass: "",
    cellClass: "border-border bg-transparent",
  },
  completed: {
    label: "Completada",
    icon: Check,
    circleClass: "bg-emerald-500",
    iconClass: "text-white",
    badgeClass: "bg-emerald-500/15 text-emerald-500",
    cellClass: "border-emerald-500/30 bg-emerald-500/5",
  },
  next: {
    label: "Próxima",
    icon: null,
    circleClass: "border-2 border-primary bg-transparent",
    iconClass: "text-primary",
    badgeClass: "bg-primary/15 text-primary",
    cellClass: "border-primary bg-primary/5 shadow-glow",
  },
  pending: {
    label: "Pendiente",
    icon: null,
    circleClass: "border-2 border-on-surface-variant/60 bg-transparent",
    iconClass: "text-on-surface-variant",
    badgeClass: "bg-secondary text-on-surface-variant",
    cellClass: "border-border bg-secondary/20",
  },
  missed: {
    label: "Perdida",
    icon: X,
    circleClass: "bg-destructive",
    iconClass: "text-white",
    badgeClass: "bg-destructive/15 text-destructive",
    cellClass: "border-destructive/30 bg-destructive/5",
  },
  cancelled: {
    label: "Cancelada",
    icon: X,
    circleClass: "bg-surface-container-high",
    iconClass: "text-muted-foreground",
    badgeClass: "bg-secondary text-muted-foreground line-through",
    cellClass: "border-border bg-secondary/10 opacity-60",
  },
}

const LEGEND = [
  { label: "Completada", dot: "bg-emerald-500" },
  { label: "Próxima", dot: "bg-primary" },
  { label: "Pendiente", dot: "bg-on-surface-variant" },
  { label: "Descanso", dot: "bg-surface-container-high" },
  { label: "Perdida", dot: "bg-destructive" },
]

export function WeekSessionCalendar({
  mondayISO,
  workouts,
  className,
}: WeekSessionCalendarProps) {
  const days = weekDaysISO(mondayISO)
  const today = new Date()
  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-")

  const byDate = new Map<string, RunningWorkoutPublic>()
  for (const w of workouts) byDate.set(w.date, w)

  // First upcoming planned session of the week (highlighted as "next").
  const nextDate = workouts
    .filter((w) => w.status === "planned" && !w.cancelled && w.date >= todayISO)
    .map((w) => w.date)
    .sort()[0]

  const resolveState = (
    dateISO: string,
    workout?: RunningWorkoutPublic,
  ): DayState => {
    if (!workout) return "rest"
    if (workout.cancelled || workout.status === "cancelled") return "cancelled"
    if (workout.status === "completed") return "completed"
    if (workout.status === "missed") return "missed"
    if (dateISO === nextDate) return "next"
    return "pending"
  }

  const cells = days.map((dateISO) => {
    const workout = byDate.get(dateISO)
    const state = resolveState(dateISO, workout)
    const { name, date } = dayLabel(dateISO)
    const isToday = dateISO === todayISO
    const distance = workout ? workoutDistanceKm(workout) : null
    const pace = workout ? workoutPaceText(workout) : null
    const typeLabel = workout
      ? (WORKOUT_TYPE_META[workout.type]?.label ?? "Sesión")
      : null
    const meta = STATE_META[state]
    return {
      dateISO,
      name,
      date,
      isToday,
      workout,
      state,
      meta,
      distance,
      pace,
      typeLabel,
    }
  })

  const renderCircle = (c: (typeof cells)[number], size: string) => (
    <div
      className={cn(
        "flex items-center justify-center rounded-full shrink-0",
        size,
        c.meta.circleClass,
      )}
    >
      {c.meta.icon ? (
        <c.meta.icon className={cn("size-5", c.meta.iconClass)} />
      ) : (
        <span
          className={cn(
            "size-2.5 rounded-full",
            c.state === "next" ? "bg-primary" : "bg-on-surface-variant",
          )}
        />
      )}
    </div>
  )

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Desktop: 7 column cards */}
      <div className="hidden sm:grid grid-cols-7 gap-2">
        {cells.map((c) => (
          <div
            key={c.dateISO}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-colors",
              c.meta.cellClass,
            )}
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  c.isToday ? "text-primary" : "text-foreground",
                )}
              >
                {c.name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {c.date}
              </span>
            </div>

            {renderCircle(c, "size-10")}

            {c.workout && c.state !== "rest" && c.state !== "cancelled" && (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-semibold text-foreground">
                  {c.typeLabel}
                </span>
                {c.distance != null && (
                  <span className="text-sm font-extrabold text-white">
                    {formatDistance(c.distance)}
                  </span>
                )}
                {c.pace && (
                  <span className="text-[10px] text-muted-foreground">
                    {c.pace}
                  </span>
                )}
              </div>
            )}

            {c.state !== "rest" && c.meta.badgeClass && (
              <span
                className={cn(
                  "mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  c.meta.badgeClass,
                )}
              >
                {c.meta.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: compact list with drill-down affordance */}
      <div className="sm:hidden flex flex-col divide-y divide-border rounded-2xl border border-border bg-secondary/10">
        {cells.map((c) => (
          <div
            key={c.dateISO}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              c.isToday && "bg-primary/5",
            )}
          >
            <div className="w-12 shrink-0">
              <span
                className={cn(
                  "block text-[11px] font-bold uppercase tracking-wider",
                  c.isToday ? "text-primary" : "text-foreground",
                )}
              >
                {c.name}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {c.date}
              </span>
            </div>

            {renderCircle(c, "size-8")}

            {c.workout && c.state !== "rest" && c.state !== "cancelled" ? (
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {c.typeLabel}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {c.distance != null ? formatDistance(c.distance) : ""}
                  {c.pace ? ` · ${c.pace}` : ""}
                </span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                {c.meta.label}
              </span>
            )}

            <ChevronRight className="size-4 text-on-surface-variant shrink-0" />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-muted-foreground">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", item.dot)} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
