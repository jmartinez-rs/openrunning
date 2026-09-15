import { Link } from "@tanstack/react-router"
import { Footprints } from "lucide-react"

import type { ShoePublic, ShoeStatsPublic } from "@/client"
import {
  formatKm,
  formatPace,
  shoeCategoryLabel,
  usagePercent,
} from "./shoe-utils"

const CATEGORY_BADGE: Record<string, string> = {
  training: "bg-domain-cardio/10 text-domain-cardio",
  race: "bg-domain-race/10 text-domain-race",
  trail: "bg-emerald-500/10 text-emerald-600",
  easy: "bg-teal-500/10 text-teal-600",
  mixed: "bg-domain-strength/10 text-domain-strength",
}

export function ShoeCard({
  shoe,
  stats,
}: {
  shoe: ShoePublic
  stats?: ShoeStatsPublic | null
}) {
  const percent = usagePercent(
    stats?.total_distance_meters,
    shoe.target_distance_km,
  )

  return (
    <Link to="/shoes/$shoeId" params={{ shoeId: shoe.id }}>
      <div className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-colors hover:border hover:border-primary/30 dark:border dark:border-border/50">
        {/* Image / placeholder — identical fixed height on both branches */}
        {shoe.photo_url ? (
          <div className="relative h-20 overflow-hidden sm:h-28">
            <img
              src={shoe.photo_url}
              alt={shoe.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        ) : (
          <div
            className="flex h-20 items-center justify-center sm:h-28"
            style={
              shoe.color
                ? {
                    background: `color-mix(in srgb, ${shoe.color} 12%, var(--surface-container-low))`,
                  }
                : undefined
            }
          >
            <Footprints className="size-8 text-on-surface-variant/40 sm:size-10" />
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
          {/* Name + brand */}
          <div className="min-w-0">
            <h3 className="truncate text-title-lg text-primary">{shoe.name}</h3>
            <p className="truncate text-body-sm text-on-surface-variant">
              {[shoe.brand, shoe.model].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`w-fit rounded-full px-2.5 py-0.5 text-label-sm ${CATEGORY_BADGE[shoe.category] ?? "bg-surface-container-low text-on-surface-variant"}`}
            >
              {shoeCategoryLabel(shoe.category)}
            </span>
            {shoe.strava_gear_id && (
              <span className="w-fit rounded-full bg-surface-container-low px-2.5 py-0.5 text-label-sm text-on-surface-variant">
                Strava
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="h-full rounded-full bg-domain-cardio transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-label-sm text-on-surface-variant">
              {formatKm(stats?.total_distance_meters)}
              {shoe.target_distance_km
                ? ` / ${shoe.target_distance_km} km`
                : ""}
            </p>
          </div>

          {/* Footer: sessions + pace */}
          {(stats?.sessions != null ||
            stats?.avg_pace_seconds_per_km != null) && (
            <div className="flex items-center gap-3 border-t border-border/50 pt-2 text-body-sm text-on-surface-variant sm:pt-2.5">
              {stats?.sessions != null && (
                <span className="flex items-center gap-1">
                  <Footprints className="size-3.5" />
                  {stats.sessions}{" "}
                  {stats.sessions === 1 ? "sesión" : "sesiones"}
                </span>
              )}
              {stats?.avg_pace_seconds_per_km != null && (
                <span>{formatPace(stats.avg_pace_seconds_per_km)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
