import { Map as MapIcon, Medal } from "lucide-react"

import type { RacePublic } from "@/client"

interface RaceGlobalMetricsProps {
  completedRaces: RacePublic[]
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg">
      <div className="rounded-xl bg-orange-500/15 p-3 text-orange-400">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <div className="mt-1 text-2xl font-black text-white tracking-tight">
          {value}
        </div>
      </div>
    </div>
  )
}

export function RaceGlobalMetrics({ completedRaces }: RaceGlobalMetricsProps) {
  const totalRaces = completedRaces.length
  const totalKm = completedRaces.reduce(
    (acc, race) => acc + race.distance_km,
    0,
  )

  // Medals by distance
  const medals: Record<string, number> = {
    Maratón: 0,
    "Media Maratón": 0,
    "15K": 0,
    "10K": 0,
    "5K": 0,
    Otras: 0,
  }

  completedRaces.forEach((race) => {
    const km = race.distance_km
    if (km >= 42) medals.Maratón++
    else if (km >= 21) medals["Media Maratón"]++
    else if (km >= 15) medals["15K"]++
    else if (km >= 10) medals["10K"]++
    else if (km >= 5) medals["5K"]++
    else medals.Otras++
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Total Carreras"
          value={totalRaces}
          icon={<Medal className="size-6" />}
        />
        <MetricCard
          title="Kilómetros Totales"
          value={
            <>
              {totalKm % 1 === 0 ? totalKm.toFixed(0) : totalKm.toFixed(1)}
              <span className="text-sm ml-1 text-slate-400 font-medium">
                km
              </span>
            </>
          }
          icon={<MapIcon className="size-6" />}
        />
        <div className="flex flex-col justify-center rounded-2xl bg-slate-900/80 border border-slate-800 p-4 shadow-lg h-full">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
            Medallero
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(medals)
              .filter(([_, count]) => count > 0)
              .map(([label, count]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-200"
                >
                  <span className="text-orange-400">{count}x</span> {label}
                </span>
              ))}
            {totalRaces === 0 && (
              <span className="text-xs font-medium text-slate-500">
                Sin medallas aún
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
