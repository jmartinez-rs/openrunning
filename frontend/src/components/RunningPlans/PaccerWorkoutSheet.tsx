import {
  CalendarDays,
  Download,
  HelpCircle,
  Sun,
} from "lucide-react"
import type React from "react"
import { useState } from "react"
import {
  type RunningWorkoutPublic,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import useCustomToast from "@/hooks/useCustomToast"
import {
  BLOCK_TYPE_META,
  blocksDistanceKm,
  formatDistance,
  formatPace,
  formatShortDate,
  WORKOUT_TYPE_META,
  type WorkoutType,
} from "./running-utils"

interface PaccerWorkoutSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: RunningWorkoutPublic | null
  phaseName?: string
  weekNumber?: number
}

type TabType = "resumo" | "passo_a_passo" | "clima"
type UnitType = "pace" | "kmh"

export const PaccerWorkoutSheet: React.FC<PaccerWorkoutSheetProps> = ({
  open,
  onOpenChange,
  workout,
  phaseName,
  weekNumber,
}) => {
  const { showSuccessToast } = useCustomToast()
  const [activeTab, setActiveTab] = useState<TabType>("resumo")
  const [unitMode, setUnitMode] = useState<UnitType>("pace")

  if (!workout) return null

  const typeMeta = WORKOUT_TYPE_META[workout.type as WorkoutType] ?? WORKOUT_TYPE_META.easy_run
  const blocks = workout.blocks ?? []

  const distanceKm =
    workout.distance_km != null ? workout.distance_km : blocksDistanceKm(blocks)

  const paceSec = workout.pace_seconds_per_km
  let paceFormatted = "--:--"
  let speedFormatted = "--.-"
  if (paceSec && paceSec > 0) {
    paceFormatted = formatPace(paceSec).replace("/km", "").trim()
    speedFormatted = (3600 / paceSec).toFixed(1)
  }

  // Zona cardíaca sugerida según tipo de entreno
  const hrZone =
    workout.type === "intervals"
      ? "Z4 - Umbral Anaeróbico"
      : workout.type === "tempo"
        ? "Z3 - Tempo / Umbral"
        : workout.type === "long_run"
          ? "Z2 - Aeróbico Extensivo"
          : "Z1 / Z2 - Regenerativo"

  const handleDownloadFit = () => {
    // Generar o notificar descarga de entrenamiento para Garmin / Apple Watch
    showSuccessToast("Descargando archivo estructurado de sesión (.FIT)...")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex w-full max-w-lg mx-auto flex-col rounded-t-[32px] bg-[#121214] border-t border-white/10 p-6 text-white shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-2 mb-4 shrink-0" />

        <SheetHeader className="p-0 text-left space-y-2">
          {/* Header row with Type title, Help Icon, Unit switcher */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-2xl font-display font-black text-white tracking-tight">
                {workout.name || typeMeta.label}
              </SheetTitle>
              <HelpCircle className="size-5 text-amber-400 shrink-0 cursor-help" />
            </div>

            {/* Switch PACE / KM/H (Images 9, 10, 12) */}
            <div className="flex items-center rounded-full bg-black/40 border border-white/10 p-0.5 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setUnitMode("pace")}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  unitMode === "pace"
                    ? "bg-primary text-black font-extrabold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                PACE
              </button>
              <button
                type="button"
                onClick={() => setUnitMode("kmh")}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                  unitMode === "kmh"
                    ? "bg-primary text-black font-extrabold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                KM/H
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 pb-1">
            <CalendarDays className="size-3.5 text-primary" />
            <span>{formatShortDate(workout.date)}</span>
            {phaseName && <span>· {phaseName}</span>}
            {weekNumber && <span>· Semana {weekNumber}</span>}
          </div>
        </SheetHeader>

        {/* 3 Tabs: Resumo | Passo a passo | Clima */}
        <div className="flex items-center border-b border-white/10 gap-6 text-sm font-bold mt-4 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab("resumo")}
            className={`pb-3 transition-all relative cursor-pointer ${
              activeTab === "resumo"
                ? "text-white font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Resumen
            {activeTab === "resumo" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(234,252,95,0.6)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("passo_a_passo")}
            className={`pb-3 transition-all relative cursor-pointer ${
              activeTab === "passo_a_passo"
                ? "text-white font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Paso a paso
            {activeTab === "passo_a_passo" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(234,252,95,0.6)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("clima")}
            className={`pb-3 transition-all relative cursor-pointer ${
              activeTab === "clima"
                ? "text-white font-extrabold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Clima
            {activeTab === "clima" && (
              <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(234,252,95,0.6)]" />
            )}
          </button>
        </div>

        {/* Tab 1: Resumo */}
        {activeTab === "resumo" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Distancia
                </span>
                <span className="text-xl font-display font-black text-white">
                  {distanceKm ? `${formatDistance(distanceKm).replace(" km", "")} km` : "--"}
                </span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                  {unitMode === "pace" ? "Ritmo Previsto" : "Velocidad"}
                </span>
                <span className="text-xl font-display font-black text-white">
                  {unitMode === "pace" ? `${paceFormatted}/km` : `${speedFormatted} km/h`}
                </span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-3.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">
                  Zona FC
                </span>
                <span className="text-base font-display font-black text-primary truncate block mt-0.5">
                  {workout.intensity === "hard" ? "Z4" : workout.intensity === "moderate" ? "Z3" : "Z2"}
                </span>
              </div>
            </div>

            {workout.description && (
              <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Instrucciones del entrenador
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {workout.description}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Passo a passo (Image 10-treinos-passo-a-passo.png) */}
        {activeTab === "passo_a_passo" && (
          <div className="space-y-4">
            {/* Top metrics summary line */}
            <div className="flex items-center justify-between text-xs px-1 font-semibold text-zinc-400">
              <div>
                <span className="text-[10px] uppercase text-zinc-500 block">Distancia</span>
                <span className="text-white font-bold text-sm">
                  {distanceKm ? `${formatDistance(distanceKm).replace(" km", "")}km` : "--"}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-500 block">Pace</span>
                <span className="text-white font-bold text-sm">{paceFormatted}/km</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-500 block">Zona FC</span>
                <span className="text-white font-bold text-sm">{hrZone.slice(0, 2)}</span>
              </div>
            </div>

            {/* Vertical structured blocks */}
            <div className="space-y-2.5">
              {blocks.length > 0 ? (
                blocks.map((b, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border-l-4 border-l-primary border-t border-r border-b border-white/5 text-xs text-zinc-200"
                  >
                    <div>
                      <span className="font-bold text-white block text-sm">
                        {b.notes || (b.block_type ? BLOCK_TYPE_META[b.block_type]?.label : `Bloque ${idx + 1}`)}
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        {b.distance_m ? `${b.distance_m}m` : ""}
                        {b.repeats && b.repeats > 1 ? ` · ${b.repeats} repeticiones` : ""}
                      </span>
                    </div>
                    {b.pace_seconds_per_km && (
                      <span className="font-mono font-bold text-primary">
                        {formatPace(b.pace_seconds_per_km)}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <>
                  <div className="p-3.5 rounded-2xl bg-black/40 border-l-4 border-l-zinc-500 border-t border-r border-b border-white/5 text-xs">
                    <span className="font-bold text-white block text-sm mb-0.5">
                      Calentamiento: 2km suave
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Trote progresivo y movilidad articular dinámica
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-black/40 border-l-4 border-l-primary border-t border-r border-b border-white/5 text-xs">
                    <span className="font-bold text-white block text-sm mb-0.5">
                      Principal: {distanceKm ? `${distanceKm}km` : "Bloque central"}
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Ritmo objetivo sostenido según la prescripción
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-black/40 border-l-4 border-l-zinc-500 border-t border-r border-b border-white/5 text-xs">
                    <span className="font-bold text-white block text-sm mb-0.5">
                      Descalentamiento: 1.5km suave
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      Vuelta a la calma y recuperación activa
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Big Action: Baixar treino para o relógio (Image 10) */}
            <Button
              type="button"
              onClick={handleDownloadFit}
              className="w-full py-6 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-extrabold flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer mt-4"
            >
              <Download className="size-5 text-primary" />
              <span>Descargar entrenamiento para el reloj</span>
            </Button>
          </div>
        )}

        {/* Tab 3: Clima (Image 9-treinos-clima.png) */}
        {activeTab === "clima" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Sun className="size-6 text-amber-400" />
              <div>
                <h4 className="text-lg font-bold text-white">17°C | Clima agradable</h4>
                <p className="text-xs text-zinc-400">Condiciones ideales para correr</p>
              </div>
            </div>

            {/* Grid of Weather parameters */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">
                  Mín/Máx
                </span>
                <span className="text-xs font-bold text-white">10° / 21°</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">
                  Lluvia
                </span>
                <span className="text-xs font-bold text-white">0%</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">
                  Humedad
                </span>
                <span className="text-xs font-bold text-white">76%</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-2xl p-2.5">
                <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block">
                  Viento
                </span>
                <span className="text-xs font-bold text-white">7 km/h</span>
              </div>
            </div>

            {/* Cuidados especiais card */}
            <div className="p-4 rounded-2xl bg-black/40 border-l-4 border-l-primary border-t border-r border-b border-white/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-primary block mb-1">
                Cuidados Especiales
              </span>
              <p className="text-xs text-zinc-200 leading-relaxed font-semibold">
                Tiempo favorable: <span className="font-normal text-zinc-400">El clima está óptimo para la sesión de hoy, no se requiere ningún cuidado especial de hidratación extrema.</span>
              </p>
            </div>

            {/* Roupas e acessórios para o clima */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white block">
                Ropa y accesorios para este clima
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                    Prenda Superior
                  </span>
                  <span className="text-xs font-bold text-white">Camiseta Técnica</span>
                </div>
                <div className="p-3 rounded-2xl bg-black/30 border border-white/5">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                    Prenda Inferior
                  </span>
                  <span className="text-xs font-bold text-white">Shorts de Running</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
