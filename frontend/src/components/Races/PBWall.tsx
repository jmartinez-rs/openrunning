import { Flame } from "lucide-react"

import type { RacePublic } from "@/client"
import { formatRacePace, formatRaceTime } from "./race-utils"

interface PBWallProps {
  completedRaces: RacePublic[]
  onOpenMemoryModal: (race: RacePublic) => void
}

interface PBRecord {
  distanceLabel: string
  distanceKm: number
  race: RacePublic
}

export function PBWall({ completedRaces, onOpenMemoryModal }: PBWallProps) {
  // We define standard PB categories (within a small margin)
  const categories = [
    { label: "5K", min: 4.8, max: 5.2 },
    { label: "10K", min: 9.8, max: 10.2 },
    { label: "15K", min: 14.8, max: 15.2 },
    { label: "21K", min: 20.9, max: 21.3 },
    { label: "42K", min: 42.0, max: 42.4 },
  ]

  const pbs: PBRecord[] = []

  categories.forEach((cat) => {
    const racesInCat = completedRaces.filter(
      (r) =>
        r.distance_km >= cat.min &&
        r.distance_km <= cat.max &&
        r.official_time_seconds,
    )
    if (racesInCat.length > 0) {
      // Find the one with the minimum time
      const best = racesInCat.reduce((prev, curr) =>
        curr.official_time_seconds! < prev.official_time_seconds! ? curr : prev,
      )
      pbs.push({
        distanceLabel: cat.label,
        distanceKm: best.distance_km,
        race: best,
      })
    }
  })

  if (pbs.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Flame className="size-5 text-orange-500" />
        <h3 className="text-lg font-bold text-white tracking-tight">
          Mejores Marcas (PB Wall)
        </h3>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
        {pbs.map((pb) => (
          <div
            key={pb.distanceLabel}
            onClick={() => onOpenMemoryModal(pb.race)}
            className="flex-none w-[260px] snap-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 shadow-xl relative overflow-hidden cursor-pointer hover:border-orange-500/50 transition-colors"
          >
            {/* Background decoration */}
            <div className="absolute -right-4 -top-4 opacity-[0.03] text-9xl font-black italic select-none">
              {pb.distanceLabel.replace("K", "")}
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="flex justify-between items-start">
                <div className="rounded-lg bg-orange-500/20 px-2.5 py-1 text-xs font-black text-orange-400">
                  {pb.distanceLabel} PB
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {pb.race.date.slice(0, 4)}
                </div>
              </div>

              <div>
                <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                  {formatRaceTime(pb.race.official_time_seconds)}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-400">
                  Ritmo: {formatRacePace(pb.race.official_pace_seconds_per_km)}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80">
                <div className="text-xs font-bold text-slate-300 truncate">
                  {pb.race.event_name}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
