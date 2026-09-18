import { Link } from "@tanstack/react-router"
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  MapPin,
  Target,
} from "lucide-react"
import { useEffect, useState } from "react"

import type { RacePublic } from "@/client"
import { Button } from "@/components/ui/button"
import { parseRaceNotes } from "./race-meta"
import { formatRaceDate } from "./race-utils"

function getCountdown(date: string) {
  const diff = Math.max(0, new Date(date).getTime() - Date.now())
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
  }
}

export function PriorityRaceCard({ race }: { race: RacePublic }) {
  const [countdown, setCountdown] = useState(() => getCountdown(race.date))
  const [expanded, setExpanded] = useState(false)
  const meta = parseRaceNotes(race.notes)

  useEffect(() => {
    const update = () => setCountdown(getCountdown(race.date))
    const interval = setInterval(update, 60_000)
    return () => clearInterval(interval)
  }, [race.date])

  const cover = race.photos_urls?.[0]

  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl border border-orange-500/50 bg-slate-900 shadow-[0_0_40px_rgba(249,115,22,0.1)]">
      {/* Golden/Neon Top Accent */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-400 via-yellow-500 to-orange-500 z-20" />

      {/* Hero Section */}
      <div className="relative min-h-[220px] w-full bg-slate-950 flex flex-col justify-end p-6 md:p-8">
        {cover && (
          <img
            src={cover}
            alt={race.event_name}
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="rounded-xl bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-sm shadow-orange-500/20 uppercase tracking-widest">
                Carrera A
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-200 border border-slate-700/50">
                <MapPin className="size-3 text-slate-400" />
                {race.location || "Ubicación pendiente"}
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none mb-2">
              {race.event_name}
            </h2>
            <div className="flex items-center gap-2 text-orange-400 font-semibold">
              <Calendar className="size-4" />
              {formatRaceDate(race.date)}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-4 text-center backdrop-blur-md min-w-[90px]">
              <div className="text-4xl font-black tabular-nums text-white tracking-tight leading-none">
                {countdown.days}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Días
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-4 text-center backdrop-blur-md min-w-[90px]">
              <div className="text-4xl font-black tabular-nums text-white tracking-tight leading-none">
                {countdown.hours}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Horas
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logistics & Meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/50 border-t border-slate-800">
        <div className="bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Distancia
          </p>
          <p className="text-lg font-black text-white">{race.distance_km} KM</p>
        </div>
        <div className="bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Dorsal / Corral
          </p>
          <p className="text-lg font-black text-white truncate">
            {race.bib_number || "--"} / {meta.corral || "--"}
          </p>
        </div>
        <div className="bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Largada
          </p>
          <p className="text-lg font-black text-white">
            {meta.start_time || "--:--"}
          </p>
        </div>
        <div className="bg-slate-900 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Estado
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className={`w-2 h-2 rounded-full ${meta.status === "confirmed" ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            <p className="text-xs font-bold text-slate-300 capitalize">
              {meta.status ? meta.status.replace("_", " ") : "Incompleto"}
            </p>
          </div>
        </div>
      </div>

      {/* Strategy Toggle */}
      <button
        className="flex items-center justify-between w-full p-4 bg-slate-900 hover:bg-slate-800/80 transition-colors border-t border-slate-800"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Target className="size-4 text-orange-500" />
          <span className="text-sm font-bold text-white tracking-tight">
            Estrategia y Objetivos
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-slate-400" />
        ) : (
          <ChevronDown className="size-4 text-slate-400" />
        )}
      </button>

      {/* Expandable Panel */}
      {expanded && (
        <div className="p-6 bg-slate-950 border-t border-slate-800 flex flex-col gap-6 animate-in slide-in-from-top-2 duration-300">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Ritmo Objetivo
                </p>
                <p className="text-xl font-black text-white tabular-nums">
                  {meta.target_pace || "--:--"}{" "}
                  <span className="text-xs font-medium text-slate-400">
                    /km
                  </span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Tiempo Estimado
                </p>
                <p className="text-xl font-black text-white tabular-nums">
                  {meta.target_time || "--:--:--"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Segmentación (Splits)
                </p>
                <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-900 p-3 rounded-xl border border-slate-800 min-h-[60px]">
                  {meta.splits_strategy ||
                    "Aún no has definido tu estrategia de carrera."}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Nutrición e Hidratación
                </p>
                <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-900 p-3 rounded-xl border border-slate-800 min-h-[60px]">
                  {meta.nutrition_plan || "Sin plan de nutrición cargado."}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-2 pt-4 border-t border-slate-800/50">
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <Link to="/routines">
                <LinkIcon className="mr-2 size-4" /> Ver plan de entrenamiento
                asociado
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
