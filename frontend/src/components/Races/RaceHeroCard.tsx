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
      <div className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
        <div className="mb-4 rounded-xl bg-orange-500/15 p-4">
          <Trophy className="size-8 text-orange-400" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Todavía no hay carreras próximas
        </h2>
        <p className="mt-1 max-w-sm text-sm text-slate-400">
          Registrá tu próximo evento para ver la cuenta regresiva en el muro.
        </p>
        <Button
          type="button"
          className="mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20"
          onClick={onRegister}
        >
          <CalendarPlus className="mr-2 size-4" />
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
          <div className="flex h-full w-full items-center justify-center bg-slate-900 border-b border-slate-800">
            <ImageOff className="size-10 text-slate-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
      </div>

      <div className="relative flex w-full flex-col gap-4 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="rounded-xl bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-orange-500/20">
            Próxima carrera
          </span>
          {race.location ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-slate-900/60 px-2.5 py-1 text-xs font-medium text-slate-200 backdrop-blur-md border border-slate-700/50">
              <MapPin className="size-3.5 text-slate-400" />
              {race.location}
            </span>
          ) : null}
        </div>

        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">{race.event_name}</h2>
          <p className="mt-1 text-sm font-medium text-orange-400">
            {formatRaceDate(race.date)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {COUNTDOWN_UNITS.map(({ key, label }) => (
            <div
              key={key}
              className="min-w-[76px] rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center backdrop-blur-md"
            >
              <div className="text-2xl font-black tabular-nums text-white tracking-tight">
                {countdown[key]}
              </div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
