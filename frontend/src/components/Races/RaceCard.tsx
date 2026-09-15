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
      <div className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-colors hover:border hover:border-primary/30 md:flex-row dark:border dark:border-border/50">
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-surface-variant md:h-auto md:w-2/5">
          {cover ? (
            <img
              src={cover}
              alt={race.event_name}
              className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageOff className="size-8 text-on-surface-variant/50" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-card px-3 py-1 text-label-sm text-primary shadow-sm">
            {distanceBadge(race.distance_km)}
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-5">
          <div>
            <p className="text-label-sm text-on-surface-variant">
              {formatRaceDate(race.date)}
              {race.location ? ` · ${race.location}` : ""}
            </p>
            <h3 className="mt-1.5 text-title-lg text-primary">
              {race.event_name}
            </h3>
            {race.notes ? (
              <p className="mt-1 line-clamp-2 text-body-md text-on-surface-variant">
                {race.notes}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3">
            <div>
              <p className="text-label-sm text-on-surface-variant">Tiempo</p>
              <p className="mt-0.5 text-title-lg tabular-nums text-primary">
                {formatRaceTime(race.official_time_seconds)}
              </p>
            </div>
            {race.position != null ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-domain-race/10 px-3 py-1 text-label-lg text-domain-race">
                <Medal className="size-3" />
                Puesto {race.position}
              </span>
            ) : (
              <span className="text-label-lg text-on-surface-variant">
                Completada
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
