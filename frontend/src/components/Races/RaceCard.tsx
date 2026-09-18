import { Link } from "@tanstack/react-router"
import { ImageOff, Medal } from "lucide-react"

import type { RacePublic } from "@/client"
import { formatRaceDate, formatRaceTime } from "./race-utils"

function distanceBadge(km: number): string {
  if (km >= 42.195) return "42K"
  if (km >= 21.0975) return "21K"
  if (km >= 10) return "10K"
  if (km >= 5) return "5K"
  return `${km} km`
}

export function RaceCard({ race }: { race: RacePublic }) {
  const cover = race.photos_urls?.[0]

  return (
    <Link to="/races/$raceId" params={{ raceId: race.id }}>
      <div className="group flex flex-col overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl transition-colors hover:border-slate-700 md:flex-row">
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800/50 md:h-auto md:w-2/5">
          {cover ? (
            <img
              src={cover}
              alt={race.event_name}
              className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff className="size-8 text-slate-700" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-xl bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
            {distanceBadge(race.distance_km)}
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-medium text-slate-400">
              {formatRaceDate(race.date)}
              {race.location ? ` · ${race.location}` : ""}
            </p>
            <h3 className="mt-1.5 text-lg font-bold text-white tracking-tight">
              {race.event_name}
            </h3>
            {race.notes ? (
              <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                {race.notes}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-800/80 pt-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tiempo
              </p>
              <p className="mt-0.5 text-xl font-bold text-white tabular-nums">
                {formatRaceTime(race.official_time_seconds)}
              </p>
            </div>
            {race.position != null ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-400">
                <Medal className="size-3" />
                Puesto {race.position}
              </span>
            ) : (
              <span className="text-xs font-semibold text-slate-500">
                Completada
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
