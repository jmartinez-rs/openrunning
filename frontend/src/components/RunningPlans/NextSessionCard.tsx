import { CalendarClock, Flag, PartyPopper } from "lucide-react"

import type { RunningWorkoutPublic } from "@/client"
import { Button } from "@/components/ui/button"
import { formatShortDate, todayIsoLocal } from "./running-utils"
import { SessionCard } from "./SessionCard"

interface NextSessionCardProps {
  workout: RunningWorkoutPublic | null
  phaseName?: string
  weekNumber?: number
  onOpen: () => void
  planStartDate?: string | null
}

function daysUntilStart(startDate: string): number {
  const start = new Date(`${startDate}T12:00:00`).getTime()
  const today = new Date(`${todayIsoLocal()}T12:00:00`).getTime()
  return Math.max(0, Math.round((start - today) / 86_400_000))
}

/** Etiqueta relativa de una fecha de sesión: "Hoy" | "Mañana" | "En N días". */
function relativeDayLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`).getTime()
  const today = new Date(`${todayIsoLocal()}T12:00:00`).getTime()
  const diff = Math.round((date - today) / 86_400_000)
  if (diff <= 0) return "Hoy"
  if (diff === 1) return "Mañana"
  return `En ${diff} días`
}

/** Foco de lectura: la próxima sesión (o estado contextual si no hay). */
export function NextSessionCard({
  workout,
  phaseName,
  weekNumber,
  onOpen,
  planStartDate,
}: NextSessionCardProps) {
  if (!workout) {
    const notStarted = Boolean(planStartDate && todayIsoLocal() < planStartDate)
    const countdown =
      notStarted && planStartDate ? daysUntilStart(planStartDate) : 0

    return (
      <section className="flex items-center gap-3 rounded-3xl border border-border bg-card/80 p-5 shadow-card">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          {notStarted ? (
            <CalendarClock className="size-5" />
          ) : (
            <PartyPopper className="size-5" />
          )}
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Próxima sesión
          </p>
          <p className="text-sm font-semibold text-foreground">
            {notStarted && planStartDate
              ? countdown > 0
                ? `Tu plan empieza el ${formatShortDate(planStartDate)} · faltan ${countdown} días`
                : `Tu plan empieza el ${formatShortDate(planStartDate)}`
              : "¡Plan completado!"}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
          <Flag className="size-4" />
          Próxima sesión
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
            {relativeDayLabel(workout.date)}
          </span>
          {(phaseName || weekNumber) && (
            <span className="text-[11px] font-semibold text-muted-foreground">
              {phaseName}
              {weekNumber ? ` · Semana ${weekNumber}` : ""}
            </span>
          )}
        </div>
      </div>

      <SessionCard variant="row" workout={workout} showDate onClick={onOpen} />

      <Button
        type="button"
        onClick={onOpen}
        className="min-h-11 w-full rounded-2xl font-extrabold"
      >
        Ver sesión
      </Button>
    </section>
  )
}
