import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import { ActivitiesService } from "@/client"
import { Button } from "@/components/ui/button"

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function monthYearLabel(date: Date) {
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" })
    .format(date)
    .replace(/^(\w)/, (c) => c.toUpperCase())
}

type DayType = "cardio" | "strength" | "both" | null

type CalendarDay = {
  day: number
  isToday: boolean
  isOtherMonth: boolean
  type: DayType
}

function generateCalendarDays(
  monthStart: Date,
  activityMap: Map<string, DayType>,
): (CalendarDay | null)[] {
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  )
  const startDay = monthStart.getDay()
  const today = new Date().toISOString().slice(0, 10)

  const days: (CalendarDay | null)[] = []
  for (let i = 0; i < startDay - 1; i++) {
    days.push(null)
  }
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d)
    const dateStr = formatDate(date)
    days.push({
      day: d,
      isToday: dateStr === today,
      isOtherMonth: false,
      type: activityMap.get(dateStr) ?? null,
    })
  }
  return days
}

export function MiniCalendar({
  initialMonth,
  className,
}: {
  initialMonth?: Date
  className?: string
}) {
  const [month, setMonth] = useState(() => ({
    year: (initialMonth ?? new Date()).getFullYear(),
    month: (initialMonth ?? new Date()).getMonth(),
  }))

  const shiftMonth = (delta: number) => {
    setMonth((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() }
    })
  }

  const monthStart = new Date(month.year, month.month, 1)
  const monthEnd = new Date(month.year, month.month + 1, 0)

  const activitiesQuery = useQuery({
    queryKey: [
      "activities",
      "month",
      formatDate(monthStart),
      formatDate(monthEnd),
    ],
    queryFn: () =>
      ActivitiesService.readActivities({
        fromDate: formatDate(monthStart),
        toDate: formatDate(monthEnd),
        limit: 100,
      }),
  })

  const activityMap = useMemo(() => {
    const map = new Map<string, DayType>()
    for (const act of activitiesQuery.data?.data ?? []) {
      const dateStr = act.timestamp.slice(0, 10)
      const existing = map.get(dateStr)
      if (act.source_type === "strava") {
        map.set(dateStr, existing === "strength" ? "both" : "cardio")
      } else if (act.source_type === "hevy") {
        map.set(dateStr, existing === "cardio" ? "both" : "strength")
      }
    }
    return map
  }, [activitiesQuery.data])

  return (
    <div
      className={`flex max-h-[420px] flex-col rounded-2xl bg-card p-6 shadow-card dark:border dark:border-border/50${className ? ` ${className}` : ""}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mes anterior"
          className="size-7 rounded-lg"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h3 className="text-title-lg text-primary">
          {monthYearLabel(monthStart)}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mes siguiente"
          className="size-7 rounded-lg"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-label-sm text-outline">
        <div>M</div>
        <div>T</div>
        <div>W</div>
        <div>T</div>
        <div>F</div>
        <div>S</div>
        <div>S</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-body-md text-primary">
        {generateCalendarDays(monthStart, activityMap).map((day, i) => (
          <div key={i} className="py-1">
            {day ? (
              <span
                className={`mx-auto flex size-8 items-center justify-center rounded-full ${
                  day.isToday
                    ? "bg-primary font-bold text-primary-foreground shadow-sm"
                    : day.type === "both"
                      ? "bg-gradient-to-br from-domain-cardio/40 to-domain-strength/40 font-semibold"
                      : day.type === "cardio"
                        ? "bg-domain-cardio/20 text-domain-cardio font-semibold"
                        : day.type === "strength"
                          ? "bg-domain-strength/20 text-domain-strength font-semibold"
                          : ""
                } ${day.isOtherMonth ? "text-outline-variant" : ""}`}
              >
                {day.day}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
