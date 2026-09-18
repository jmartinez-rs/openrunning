import { X, Calendar, MapPin, Trophy, Footprints, Image as ImageIcon, Pencil, Trash } from "lucide-react"

import type { RacePublic } from "@/client"
import { formatRaceDate, formatRaceTime, formatRacePace } from "./race-utils"
import { parseRaceNotes } from "./race-meta"

interface RaceMemoryModalProps {
  race: RacePublic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (race: RacePublic) => void
  onDelete?: (race: RacePublic) => void
}

export function RaceMemoryModal({ race, open, onOpenChange, onEdit, onDelete }: RaceMemoryModalProps) {
  if (!race) return null
  const meta = parseRaceNotes(race.notes)

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
        
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(race)}
              className="p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              title="Editar carrera"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm("¿Seguro que quieres eliminar esta carrera del historial?")) {
                  onDelete(race)
                }
              }}
              className="p-2 rounded-full bg-slate-800/80 text-red-400 hover:text-white hover:bg-red-500 transition-colors"
              title="Eliminar carrera"
            >
              <Trash className="size-4" />
            </button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Hero Section */}
        <div className="relative h-[250px] sm:h-[300px] bg-slate-950 w-full rounded-t-3xl overflow-hidden flex flex-col justify-end">
          {race.photos_urls?.[0] ? (
            <img 
              src={race.photos_urls[0]} 
              alt="Race memory" 
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-800">
              <ImageIcon className="size-20 opacity-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
          
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-3 py-1 rounded-xl bg-orange-500/20 text-orange-400 text-xs font-black uppercase tracking-widest border border-orange-500/20">
                {race.distance_km} KM
              </span>
              {race.location && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/80 text-slate-300 text-xs font-medium border border-slate-700/50 backdrop-blur-md">
                  <MapPin className="size-3" /> {race.location}
                </span>
              )}
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              {race.event_name}
            </h2>
            <div className="flex items-center gap-2 mt-2 text-sm font-medium text-slate-400">
              <Calendar className="size-4" />
              {formatRaceDate(race.date)}
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiempo Oficial</p>
              <p className="mt-1 text-2xl font-black text-white tabular-nums">{formatRaceTime(race.official_time_seconds)}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tiempo Neto (Chip)</p>
              <p className="mt-1 text-xl font-bold text-slate-300 tabular-nums">
                {race.chip_time_seconds ? formatRaceTime(race.chip_time_seconds) : "--:--:--"}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ritmo Medio</p>
              <p className="mt-1 text-2xl font-black text-white tabular-nums">{formatRacePace(race.official_pace_seconds_per_km)}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Puesto General</p>
              <p className="mt-1 text-xl font-bold text-slate-300 tabular-nums">{race.position ? `#${race.position}` : "--"}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white tracking-tight uppercase">
                <Footprints className="size-4 text-orange-400" /> Material & Equipamiento
              </h3>
              <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800">
                {race.shoe_id ? (
                  <p className="text-sm font-medium text-slate-300">
                    ID Zapatilla vinculada: <span className="font-mono text-xs text-orange-400">{race.shoe_id}</span>
                    <br/><span className="text-xs text-slate-500">(Integración de zapatos en desarrollo)</span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">No se especificó calzado para esta carrera.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white tracking-tight uppercase">
                <Trophy className="size-4 text-orange-400" /> Notas y Sensaciones
              </h3>
              <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-800 h-full">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">
                  {meta.raw_notes || "Sin registros de sensaciones para esta carrera."}
                </p>
              </div>
            </div>
          </div>

          {/* Photo Gallery (if multiple) */}
          {race.photos_urls && race.photos_urls.length > 1 && (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="text-sm font-bold text-white tracking-tight uppercase">Galería Multimedia</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                {race.photos_urls.slice(1).map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt={`Momento ${i+2}`} 
                    className="h-32 sm:h-40 w-auto rounded-xl snap-center border border-slate-800 object-cover"
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
