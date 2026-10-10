import { Activity, Flame, Layers } from "lucide-react"

import type { ActivityCardioBase } from "@/client"
import { formatPace } from "./activity-utils"

interface Split {
  distance?: number
  moving_time?: number
  split?: number
  pace?: number
}

function splitPace(split: Split): string {
  const distance = Number(split.distance) || 0
  const movingTime = Number(split.moving_time) || 0
  if (distance <= 0 || movingTime <= 0) return "—"
  return formatPace(movingTime / (distance / 1000))
}

const ZONE_CONFIGS = [
  {
    name: "Z1 Recuperación",
    color: "bg-on-surface-variant",
    text: "text-muted-foreground",
  },
  { name: "Z2 Aeróbico", color: "bg-primary", text: "text-primary" },
  { name: "Z3 Tempo", color: "bg-cyan-500", text: "text-cyan-400" },
  { name: "Z4 Umbral", color: "bg-primary", text: "text-primary" },
  { name: "Z5 Máximo", color: "bg-destructive", text: "text-destructive" },
]

export function CardioSummary({ cardio }: { cardio: ActivityCardioBase }) {
  const splits = (cardio.splits ?? []) as unknown as Split[]
  const zones = (cardio.heart_rate_zones ?? []) as unknown as Array<{
    min?: number
    max?: number
    time?: number
  }>
  const hasZones = zones.some((z) => Number(z.time) > 0)

  if (splits.length === 0 && !hasZones) {
    return null
  }

  const totalZoneTime = zones.reduce((acc, z) => acc + (Number(z.time) || 0), 0)

  return (
    <div className="bg-card/80 border border-border rounded-2xl p-4 sm:p-5 shadow-card space-y-6">
      <div className="flex items-center gap-2 pb-1 border-b border-border/80">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-bold text-white tracking-tight">
          Parciales y Zonas
        </h2>
      </div>

      {/* Splits: Visual Pill Bars & Split Table */}
      {splits.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Parciales por Km
            </span>
            <span className="text-[11px] text-zinc-400 font-semibold">
              {splits.length} km total
            </span>
          </div>

          <div className="space-y-2 rounded-xl border border-border/80 bg-[#121214] p-3">
            {splits.map((split, index) => {
              const movingTime = Number(split.moving_time) || 0
              const dist = Number(split.distance) || 1000
              const paceSec = dist > 0 ? movingTime / (dist / 1000) : 0
              // Calculate percentage bar width relative to pace range (e.g. 3:00 to 7:00 /km)
              // Faster pace = higher bar fill
              const minPace = 180 // 3:00
              const maxPace = 420 // 7:00
              const clampedPace = Math.min(Math.max(paceSec, minPace), maxPace)
              const pacePercent = Math.round(100 - ((clampedPace - minPace) / (maxPace - minPace)) * 80)

              return (
                <div key={index} className="flex items-center justify-between gap-3 text-xs">
                  {/* Km Number */}
                  <div className="w-6 font-mono font-bold text-zinc-400 shrink-0">
                    {split.split ?? index + 1}
                  </div>

                  {/* Horizontal Visual Pill Bar */}
                  <div className="flex-1 h-3 rounded-full bg-zinc-800/80 overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.max(15, Math.min(100, pacePercent))}%` }}
                    />
                  </div>

                  {/* Pace and Time */}
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="font-bold text-primary">
                      {splitPace(split)}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {movingTime
                        ? `${Math.floor(movingTime / 60)}:${String(Math.round(movingTime % 60)).padStart(2, "0")}`
                        : "—"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Heart Rate Zones */}
      {hasZones ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-destructive" /> Zonas
              Frecuencia Cardíaca
            </span>
          </div>

          <div className="space-y-2.5">
            {zones.map((zone, index) => {
              const time = Number(zone.time) || 0
              const percentage =
                totalZoneTime > 0 ? Math.round((time / totalZoneTime) * 100) : 0
              const cfg = ZONE_CONFIGS[index] || {
                name: `Z${index + 1}`,
                color: "bg-primary",
                text: "text-primary",
              }

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                      <span className="text-muted-foreground font-semibold">
                        {cfg.name}
                      </span>
                      <span className="text-on-surface-variant font-display">
                        ({zone.min ?? "?"}–{zone.max ?? "?"} bpm)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-display">
                      <span className={`font-bold ${cfg.text}`}>
                        {percentage}%
                      </span>
                      <span className="text-muted-foreground">
                        {Math.floor(time / 60)}:
                        {String(Math.round(time % 60)).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-surface-container-lowest rounded-full overflow-hidden p-0.5 border border-border/50">
                    <div
                      className={`h-full rounded-full ${cfg.color} transition-all duration-500`}
                      style={{
                        width: `${Math.max(percentage, time > 0 ? 3 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
