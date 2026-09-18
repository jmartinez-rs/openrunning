import { useState } from "react"
import { Medal, Trophy, Clock } from "lucide-react"

import type { RacePublic } from "@/client"
import { formatRaceTime, formatRaceDate, formatRacePace } from "./race-utils"


interface MedalCard3DProps {
  race: RacePublic
  isPB?: boolean
  onClick?: () => void
}

export function MedalCard3D({ race, isPB, onClick }: MedalCard3DProps) {
  const [flipped, setFlipped] = useState(false)

  // Decide medal color based on position or default
  let medalColorClass = "text-amber-600" // Bronze default
  let medalBgClass = "bg-amber-600/20"
  if (race.position === 1) {
    medalColorClass = "text-yellow-400"
    medalBgClass = "bg-yellow-400/20"
  } else if (race.position === 2) {
    medalColorClass = "text-slate-300"
    medalBgClass = "bg-slate-300/20"
  }

  const handleFlip = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFlipped(!flipped)
  }

  return (
    <div 
      className="group perspective-1000 w-full h-[320px] cursor-pointer"
      onClick={onClick}
    >
      <div 
        className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
          flipped ? "rotate-y-180" : ""
        }`}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden w-full h-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col items-center justify-center p-6 text-center hover:border-slate-700 transition-colors">
          
          {isPB && (
            <div className="absolute top-3 left-[-30px] rotate-[-45deg] bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest py-1 w-[120px] shadow-lg shadow-orange-500/20">
              PB / PR
            </div>
          )}

          <button 
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={handleFlip}
          >
            <Trophy className="size-4" />
          </button>

          <div className={`p-5 rounded-full ${medalBgClass} mb-4 shadow-[0_0_30px_rgba(255,165,0,0.1)]`}>
            <Medal className={`size-16 ${medalColorClass} drop-shadow-md`} />
          </div>

          <h3 className="text-lg font-black text-white tracking-tight line-clamp-2">
            {race.event_name}
          </h3>
          <p className="mt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            {race.distance_km} KM
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400">
            {formatRaceDate(race.date)}
          </p>

          <div className="mt-auto pt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400">
            <span className="text-orange-400">Ver estadísticas</span>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 shadow-xl p-6 flex flex-col">
          
          <button 
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={handleFlip}
          >
            <Trophy className="size-4" />
          </button>

          <h4 className="text-sm font-bold text-white tracking-tight pr-8 line-clamp-1">
            {race.event_name}
          </h4>
          
          <div className="flex-1 mt-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="size-3" /> Tiempo Oficial
              </p>
              <p className="mt-1 text-2xl font-black text-white tabular-nums">
                {formatRaceTime(race.official_time_seconds)}
              </p>
              {race.chip_time_seconds && (
                <p className="text-xs text-slate-400 tabular-nums">
                  Chip: {formatRaceTime(race.chip_time_seconds)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Ritmo
                </p>
                <p className="mt-1 text-sm font-bold text-white tabular-nums">
                  {formatRacePace(race.official_pace_seconds_per_km)}
                </p>
              </div>
              {race.position != null && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Puesto
                  </p>
                  <p className="mt-1 text-sm font-bold text-white tabular-nums">
                    #{race.position}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <button className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-colors">
            Abrir Ficha
          </button>
        </div>
      </div>
    </div>
  )
}
