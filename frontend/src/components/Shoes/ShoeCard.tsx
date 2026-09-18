import { Link } from "@tanstack/react-router"
import { AlertTriangle, Footprints, Gauge } from "lucide-react"

import type { ShoePublic, ShoeStatsPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  checkRotationAlert,
  formatKm,
  formatPace,
  getFoamHealth,
  shoeCategoryMeta,
} from "./shoe-utils"

export function ShoeCard({
  shoe,
  stats,
}: {
  shoe: ShoePublic
  stats?: ShoeStatsPublic | null
}) {
  const health = getFoamHealth(
    stats?.total_distance_meters,
    shoe.target_distance_km,
  )
  const categoryMeta = shoeCategoryMeta(shoe.category)
  const rotationAlert = checkRotationAlert(shoe.id, [])

  return (
    <Link to="/shoes/$shoeId" params={{ shoeId: shoe.id }}>
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-200 hover:border-primary/40 hover:bg-card/90 cursor-pointer">
        {/* Photo / Color Header Avatar */}
        <div className="relative h-32 w-full overflow-hidden rounded-xl bg-surface-container-high/80">
          {shoe.photo_url ? (
            <img
              src={shoe.photo_url}
              alt={shoe.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center relative overflow-hidden"
              style={
                shoe.color
                  ? {
                      background: `linear-gradient(135deg, ${shoe.color} 25%, #0e0e0e 100%)`,
                    }
                  : {
                      background:
                        "linear-gradient(135deg, #262626 0%, #0e0e0e 100%)",
                    }
              }
            >
              <Footprints className="size-12 text-white/30 transition-transform group-hover:scale-110" />
            </div>
          )}

          {/* Top badges over photo */}
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5 z-10">
            <Badge
              className={cn(
                "text-[10px] font-extrabold uppercase border px-2 py-0.5",
                categoryMeta.badgeClass,
              )}
            >
              {categoryMeta.shortLabel}
            </Badge>

            {shoe.strava_gear_id && (
              <Badge className="bg-card/80 text-muted-foreground border-border text-[10px] font-bold backdrop-blur-xs">
                Strava Gear
              </Badge>
            )}
          </div>

          {/* Foam Health Pill */}
          <div className="absolute right-2.5 top-2.5 z-10">
            <Badge
              className={cn(
                "text-[10px] font-extrabold border px-2 py-0.5 shadow-md",
                health.badgeClass,
              )}
            >
              {health.percent}% salud
            </Badge>
          </div>
        </div>

        {/* Shoe Info Body */}
        <div className="flex flex-col gap-3 pt-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-white group-hover:text-primary transition-colors">
              {shoe.name}
            </h3>
            <p className="truncate text-xs font-medium text-muted-foreground mt-0.5">
              {[shoe.brand, shoe.model].filter(Boolean).join(" · ") ||
                "Sin especificación de modelo"}
            </p>
          </div>

          {/* Wear Progress Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground">
                Vida útil de espuma
              </span>
              <span className="font-bold text-white">
                {formatKm(stats?.total_distance_meters)} / {health.targetKm} km
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high border border-border/50 p-0.5">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                  health.barColorClass,
                )}
                style={{ width: `${Math.min(health.percent, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span
                className={cn(
                  "font-bold",
                  health.status === "optimal"
                    ? "text-primary"
                    : health.status === "warning"
                      ? "text-primary"
                      : "text-destructive",
                )}
              >
                ● {health.statusLabel}
              </span>
              <span className="text-muted-foreground font-medium">
                Quedan ~{health.remainingKm} km
              </span>
            </div>
          </div>

          {/* Rotation alert if applicable */}
          {rotationAlert.needsRest && (
            <div className="flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/30 p-2 text-[11px] font-semibold text-primary">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span className="truncate">
                Rotación sugerida por entreno reciente
              </span>
            </div>
          )}

          {/* Stats Footer */}
          <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1 text-foreground">
              <Footprints className="size-3.5 text-on-surface-variant" />
              {stats?.sessions ?? 0}{" "}
              {stats?.sessions === 1 ? "sesión" : "sesiones"}
            </span>

            {stats?.avg_pace_seconds_per_km ? (
              <span className="flex items-center gap-1 text-primary font-extrabold">
                <Gauge className="size-3.5" />
                {formatPace(stats.avg_pace_seconds_per_km)}
              </span>
            ) : (
              <span className="text-on-surface-variant text-[11px]">
                Sin entrenos
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
