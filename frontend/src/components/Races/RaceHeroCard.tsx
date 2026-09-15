import { CalendarPlus, ImageOff, MapPin, Trophy } from "lucide-react"
import { useEffect, useState } from "react"

import type { RacePublic } from "@/client"
import { Button } from "@/components/ui/button"
import { formatRaceDate } from "./race-utils"

interface Countdown {
  days: number
  hours: number
  minutes: number
}

function getCountdown(date: string): Countdown {
  const diff = Math.max(0, new Date(date).getTime() - Date.now())
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
  }
}

const COUNTDOWN_UNITS: { key: keyof Countdown; label: string }[] = [
  { key: "days", label: "Días" },
  { key: "hours", label: "Horas" },
  { key: "minutes", label: "Min" },
]

export function RaceHeroCard({
  race,
  onRegister,
}: {
  race: RacePublic | null
  onRegister: () => void
}) {
  const [countdown, setCountdown] = useState<Countdown>(() =>
    getCountdown(race?.date ?? ""),
  )

  useEffect(() => {
    if (!race) return
    const update = () => setCountdown(getCountdown(race.date))
    update()
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [race])

  if (!race) {
    return (
      <div className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/50 bg-card p-8 text-center">
        <div className="mb-4 rounded-full bg-domain-race/10 p-4">
          <Trophy className="size-8 text-domain-race" />
        </div>
        <h2 className="text-title-lg text-primary">
          Todavía no hay carreras próximas
        </h2>
        <p className="mt-1 max-w-sm text-body-md text-on-surface-variant">
          Registrá tu próximo evento para ver la cuenta regresiva en el muro.
        </p>
        <Button
          type="button"
          className="mt-4 rounded-lg bg-primary text-primary-foreground"
          onClick={onRegister}
        >
          <CalendarPlus className="size-4" />
          Registrar carrera
        </Button>
      </div>
    )
  }

  const cover = race.photos_urls?.[0]

  return (
    <div className="relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-2xl">
      <div className="absolute inset-0">
        {cover ? (
          <img
            src={cover}
            alt={race.event_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-variant">
            <ImageOff className="size-10 text-on-surface-variant/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      </div>

      <div className="relative flex w-full flex-col gap-4 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-full bg-domain-race px-3 py-1 text-label-sm text-white">
            Próxima carrera
          </span>
          {race.location ? (
            <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-label-sm text-white backdrop-blur-sm">
              <MapPin className="size-3" />
              {race.location}
            </span>
          ) : null}
        </div>

        <div>
          <h2 className="text-headline-lg text-white">{race.event_name}</h2>
          <p className="mt-1 text-body-md text-white/70">
            {formatRaceDate(race.date)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {COUNTDOWN_UNITS.map(({ key, label }) => (
            <div
              key={key}
              className="min-w-[76px] rounded-lg border border-white/10 bg-black/40 p-3 text-center backdrop-blur-md"
            >
              <div className="text-headline-md tabular-nums text-white">
                {countdown[key]}
              </div>
              <div className="mt-0.5 text-label-sm uppercase tracking-wider text-white/70">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
