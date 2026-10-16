import { useState } from "react"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Footprints,
  HelpCircle,
  Link2,
  Music,
  Pencil,
  Play,
  Repeat,
  RotateCcw,
  Share2,
  Sparkles,
  Timer,
  Wind,
  XCircle,
} from "lucide-react"

import type { RunningWorkoutPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import {
  blocksDistanceKm,
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
  /** Abre el editor avanzado de la sesión (WorkoutBlocksDrawer). */
  onEdit?: () => void
}

/**
 * Detalle del entrenamiento inspirado en las capturas de Runna:
 * - Cabecera inmersiva con gradiente ámbar y fecha ("22 OCT 2026", "Variantes de 300 m", "Tempo · ⏱ 40m - 45m")
 * - Tarjeta "Informe personalizado del entrenamiento" con botón "¿Cómo adaptarse a las condiciones?"
 * - Fila de 4 botones circulares de acción rápida: Estiramientos, Cargar ruta, Vincular actividad, Saltar
 * - Selector segmentado: EXTERIOR | CINTA
 * - Bloques estructurados numerados (1, 2, 3...) con banner naranja destacado para repeticiones ("🔁 Repetición x5")
 * - Nota del entrenador/atleta olímpico
 * - Sticky bottom action bar con "▶ Iniciar entrenamiento" y botón de música
 */
export function PaccerWorkoutSheet({
  open,
  onOpenChange,
  workout,
  phaseName,
  weekNumber,
  onEdit,
}: PaccerWorkoutSheetProps) {
  const { showSuccessToast } = useCustomToast()
  const [environment, setEnvironment] = useState<"outdoor" | "treadmill">("outdoor")

  // Modales interactivos para acciones rápidas
  const [showStretchesModal, setShowStretchesModal] = useState(false)
  const [showWeatherModal, setShowWeatherModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showMusicModal, setShowMusicModal] = useState(false)
  const [showSkipModal, setShowSkipModal] = useState(false)

  if (!workout) return null

  const typeMeta =
    WORKOUT_TYPE_META[workout.type as WorkoutType] ?? WORKOUT_TYPE_META.easy_run
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

  // Estimación de duración de la sesión
  let durationEstimateStr = "40m - 45m"
  if (workout.duration_seconds && workout.duration_seconds > 0) {
    const mins = Math.round(workout.duration_seconds / 60)
    durationEstimateStr = `${mins - 3}m - ${mins + 3}m`
  } else if (distanceKm && paceSec) {
    const mins = Math.round((distanceKm * paceSec) / 60)
    durationEstimateStr = `${mins - 3}m - ${mins + 3}m`
  } else if (distanceKm) {
    const mins = Math.round(distanceKm * 5.5)
    durationEstimateStr = `${mins - 5}m - ${mins + 5}m`
  }

  // Ritmo en cinta (treadmill) con inclinación sugerida del 1%
  const treadmillSpeed = paceSec ? (3600 / paceSec).toFixed(1) : "9.5"

  // Texto contextual de entrenador según tipo de sesión
  const coachNotes: Record<string, string> = {
    tempo:
      '¡Hola, Jose! Esta sesión también se conoce como "fartlek" o cambios de ritmo. Se trata de aprender a adaptarse a distintas velocidades sin tensarte y entrenar el aclaramiento de lactato.',
    intervals:
      '¡A por las series de velocidad! La clave en los intervalos no es quemar todo en la primera repetición, sino mantener la constancia en cada pasada y recuperar bien el pulso.',
    long_run:
      'Día de fondo largo. El foco exclusivo es construir eficiencia metabólica y volumen en los pies. Mantené un ritmo donde puedas mantener una conversación fluida.',
    easy_run:
      'Carrera suave y regenerativa. Corré por sensaciones, sin mirar el reloj obsesivamente. La meta hoy es oxigenar los músculos y asimilar la carga de la semana.',
  }
  const currentCoachNote =
    coachNotes[workout.type] ??
    'Concentrate en una buena técnica de carrera, postura erguida y respiración rítmica durante todo el entrenamiento.'

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      showSuccessToast("Enlace de la sesión copiado al portapapeles")
    }
  }

  const handleStartWorkout = () => {
    showSuccessToast("¡Sesión iniciada! Registrando actividad de carrera...")
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex w-full max-w-xl mx-auto flex-col rounded-t-[36px] bg-[#12151a] border-t border-white/10 p-0 text-white shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
        >
          {/* ── Top Bar de navegación y acciones rápidas ── */}
          <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#12151a]/95 backdrop-blur-md border-b border-white/5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-5" />
              <span>
                {phaseName ? `${phaseName} · ` : ""}Semana {weekNumber || 1}
              </span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleShare}
                className="size-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Compartir entrenamiento"
              >
                <Share2 className="size-4" />
              </button>

              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="size-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Editar sesión"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
          </div>

          {/* ── Hero con gradiente ámbar/dorado inmersivo ── */}
          <div className="relative px-6 pt-5 pb-6 bg-gradient-to-b from-amber-500/20 via-amber-950/5 to-transparent">
            {/* Fecha y estado */}
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300/90 mb-1">
              <span>{formatShortDate(workout.date)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                {workout.status === "completed"
                  ? "Completada"
                  : workout.status === "missed"
                    ? "Perdida"
                    : "Programa"}
              </span>
            </div>

            {/* Título de la sesión */}
            <h2 className="text-2xl sm:text-3xl font-black font-display text-white tracking-tight leading-tight">
              {workout.name || typeMeta.label}
            </h2>

            {/* Subtítulo tipo de sesión y duración */}
            <div className="mt-2 flex items-center gap-3 text-sm text-zinc-300 font-medium">
              <span className="text-amber-300 font-bold">{typeMeta.label}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                <Timer className="size-4 text-zinc-400" />
                {durationEstimateStr}
              </span>
            </div>
          </div>

          <div className="px-6 space-y-6 pb-24">
            {/* ── Card: Informe personalizado del entrenamiento ── */}
            <div className="rounded-2xl bg-black/40 border border-white/5 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                  <Sparkles className="size-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-white">
                    Informe personalizado del entrenamiento
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Disponible el día antes de tu carrera
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowWeatherModal(true)}
                className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer border border-white/5"
              >
                <Wind className="size-3.5 text-amber-400" />
                <span>¿Cómo adaptarse a las condiciones?</span>
              </button>
            </div>

            {/* ── Fila de botones de acción rápida circulares (Runna style) ── */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {/* 1. Estiramientos */}
              <button
                type="button"
                onClick={() => setShowStretchesModal(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white/5 transition cursor-pointer group"
              >
                <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:text-primary transition-all shadow-sm">
                  <Activity className="size-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase leading-tight tracking-tight">
                  Estiramientos
                  <br />
                  <span className="text-[9px] font-normal text-zinc-500">
                    (Calentamiento)
                  </span>
                </span>
              </button>

              {/* 2. Cargar ruta */}
              <button
                type="button"
                onClick={() => setShowRouteModal(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white/5 transition cursor-pointer group"
              >
                <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:text-primary transition-all shadow-sm">
                  <Compass className="size-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase leading-tight tracking-tight">
                  Cargar
                  <br />
                  <span className="text-[9px] font-normal text-zinc-500">Ruta</span>
                </span>
              </button>

              {/* 3. Vincular actividad */}
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white/5 transition cursor-pointer group"
              >
                <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:text-primary transition-all shadow-sm">
                  <Link2 className="size-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase leading-tight tracking-tight">
                  Vincular
                  <br />
                  <span className="text-[9px] font-normal text-zinc-500">
                    Actividad
                  </span>
                </span>
              </button>

              {/* 4. Saltar entrenamiento */}
              <button
                type="button"
                onClick={() => setShowSkipModal(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-white/5 transition cursor-pointer group"
              >
                <div className="size-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 group-hover:bg-destructive/20 group-hover:border-destructive/40 group-hover:text-destructive transition-all shadow-sm">
                  <RotateCcw className="size-5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase leading-tight tracking-tight">
                  Saltar
                  <br />
                  <span className="text-[9px] font-normal text-zinc-500">
                    Entrenamiento
                  </span>
                </span>
              </button>
            </div>

            {/* ── Selector segmentado: EXTERIOR | CINTA ── */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Footprints className="size-4 text-primary" />
                Estructura de la sesión
              </span>

              <div className="inline-flex rounded-full bg-black/50 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setEnvironment("outdoor")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-extrabold uppercase transition-all cursor-pointer",
                    environment === "outdoor"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  Exterior
                </button>
                <button
                  type="button"
                  onClick={() => setEnvironment("treadmill")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-extrabold uppercase transition-all cursor-pointer",
                    environment === "treadmill"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  Cinta
                </button>
              </div>
            </div>

            {/* ── Bloques estructurados de entrenamiento (Pasos numerados) ── */}
            <div className="space-y-3">
              {/* Paso 1: Calentamiento */}
              <div className="overflow-hidden rounded-2xl bg-black/40 border border-white/5">
                <div className="bg-zinc-800/60 px-4 py-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  Calentamiento
                </div>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="text-lg font-black font-display text-zinc-400 w-4">
                      1
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white flex items-center gap-1">
                        2km a ritmo conversacional
                        <HelpCircle className="size-3.5 text-zinc-500" />
                      </span>
                      <span className="text-xs text-zinc-400">
                        {environment === "outdoor"
                          ? "No más rápido que 6:40/km"
                          : `Cinta a ${treadmillSpeed} km/h · Inclinación 1.0%`}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-zinc-300 text-[10px] font-black uppercase shrink-0"
                  >
                    🏃 Carrera
                  </Badge>
                </div>
              </div>

              {/* Paso 2: Repetición x5 (Banda naranja destacada estilo Runna) */}
              <div className="overflow-hidden rounded-2xl bg-black/40 border border-amber-500/30 shadow-md">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1.5 text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                  <Repeat className="size-3.5 stroke-[3]" />
                  <span>Repetición x5</span>
                </div>

                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="text-lg font-black font-display text-amber-400 w-4">
                      2
                    </span>
                    <div className="flex flex-col space-y-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">
                          300 m a{" "}
                          {paceFormatted !== "--:--"
                            ? `${paceFormatted}/km`
                            : "5:35/km"}
                        </span>
                        <span className="text-xs text-amber-300/90 font-medium">
                          {environment === "outdoor"
                            ? "Ritmo objetivo de velocidad"
                            : `Cinta a ${speedFormatted !== "--.-" ? speedFormatted : "10.8"} km/h`}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-zinc-300">
                          300 m a 6:20/km
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">
                          {environment === "outdoor"
                            ? "Trote suave de recuperación activa"
                            : "Cinta a 9.5 km/h"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-black uppercase shrink-0">
                    🏃 Carrera
                  </Badge>
                </div>
              </div>

              {/* Paso 3: Descansa */}
              <div className="overflow-hidden rounded-2xl bg-black/40 border border-white/5">
                <div className="bg-zinc-800/60 px-4 py-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  Descansa
                </div>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="text-lg font-black font-display text-zinc-400 w-4">
                      3
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">
                        90s de descanso caminando
                      </span>
                      <span className="text-xs text-zinc-400">
                        Bajar pulsaciones e hidratarse
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-zinc-400 text-[10px] font-bold uppercase shrink-0"
                  >
                    Descansa
                  </Badge>
                </div>
              </div>

              {/* Paso 4: Enfriamiento */}
              <div className="overflow-hidden rounded-2xl bg-black/40 border border-white/5">
                <div className="bg-zinc-800/60 px-4 py-1.5 text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                  Enfriamiento
                </div>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <span className="text-lg font-black font-display text-zinc-400 w-4">
                      4
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white flex items-center gap-1">
                        1,6km a ritmo conversacional
                        <HelpCircle className="size-3.5 text-zinc-500" />
                      </span>
                      <span className="text-xs text-zinc-400">
                        O más lento para asimilación muscular
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-zinc-300 text-[10px] font-black uppercase shrink-0"
                  >
                    🏃 Carrera
                  </Badge>
                </div>
              </div>
            </div>

            {/* ── Nota del Entrenador / Atleta Olímpico (Runna style) ── */}
            <div className="rounded-2xl bg-black/40 border border-white/5 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-zinc-950 font-black text-xs shadow-md">
                    CQ
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">
                      Colleen Quigley
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Deportista olímpica de EE. UU.
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-4 text-zinc-500" />
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed italic border-l-2 border-primary/50 pl-3 py-0.5">
                {currentCoachNote}
              </p>
            </div>
          </div>

          {/* ── Sticky Bottom Bar: Iniciar entrenamiento & Música ── */}
          <div className="fixed bottom-0 inset-x-0 max-w-xl mx-auto p-4 bg-gradient-to-t from-[#12151a] via-[#12151a]/95 to-transparent border-t border-white/10 flex items-center gap-3 z-30">
            <button
              type="button"
              onClick={handleStartWorkout}
              className="flex-1 py-3.5 px-6 rounded-full bg-white hover:bg-zinc-100 text-zinc-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer"
            >
              <Play className="size-4 fill-current" />
              <span>Iniciar entrenamiento</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMusicModal(true)}
              className="size-12 rounded-full bg-white/10 hover:bg-white/15 text-white flex items-center justify-center border border-white/10 transition-all cursor-pointer shrink-0"
              title="Música y ritmos"
            >
              <Music className="size-5" />
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Modal de Estiramientos de Calentamiento ── */}
      <Dialog open={showStretchesModal} onOpenChange={setShowStretchesModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Estiramientos Dinámicos
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Realizá 30 a 45 segundos de cada ejercicio antes de comenzar el trote suave.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
              <span className="size-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <span className="font-bold text-white block">
                  Balanceos de pierna frontal y lateral
                </span>
                <span className="text-zinc-400">
                  Activa flexores de cadera e isquiotibiales (15 reps por pierna).
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
              <span className="size-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <span className="font-bold text-white block">
                  Zancadas dinámicas con rotación de torso
                </span>
                <span className="text-zinc-400">
                  Despierta glúteos, cuádriceps y movilidad torácica.
                </span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
              <span className="size-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <span className="font-bold text-white block">
                  Círculos de tobillo y elevación de gemelos
                </span>
                <span className="text-zinc-400">
                  Prepara el tendón de Aquiles para el impacto repetitivo.
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-white text-zinc-950 font-bold text-xs"
              onClick={() => setShowStretchesModal(false)}
            >
              Listo para calentar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Adaptación al Clima ── */}
      <Dialog open={showWeatherModal} onOpenChange={setShowWeatherModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Adaptación a las Condiciones
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Estrategias para correr con calor, frío o viento.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 space-y-3 text-xs text-zinc-300">
            <p>
              🌡️ <strong>Calor y Humedad (&gt; 22°C):</strong> Ajustá el ritmo entre 5 y 15 seg/km más lento. El corazón bombea más sangre a la piel para enfriar el cuerpo.
            </p>
            <p>
              💨 <strong>Viento en contra:</strong> Corré por esfuerzo percibido, no por ritmo del reloj. Compensá el esfuerzo en el tramo a favor.
            </p>
            <p>
              🌧️ <strong>Lluvia:</strong> Utilizá gorra para proteger la visión y evitá ropa de algodón que acumule peso.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-white text-zinc-950 font-bold text-xs"
              onClick={() => setShowWeatherModal(false)}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Cargar Ruta GPX ── */}
      <Dialog open={showRouteModal} onOpenChange={setShowRouteModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Cargar Ruta del Entrenamiento
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Podés exportar este entrenamiento a tu reloj o cargar un archivo GPX.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10 rounded-2xl justify-start text-xs font-bold py-6"
              onClick={() => {
                showSuccessToast("Descargando archivo estructurado (.FIT) para Garmin / Apple Watch")
                setShowRouteModal(false)
              }}
            >
              <Download className="mr-3 size-4 text-primary" />
              Descargar archivo estructurado (.FIT)
            </Button>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => setShowRouteModal(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Vincular Actividad ── */}
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Vincular Actividad Realizada
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              ¿Ya corriste esta sesión? Vinculala con una actividad sincronizada de Strava o reloj.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-zinc-300">
            Al sincronizar con Strava, OpenRunning empareja automáticamente los entrenamientos por fecha y distancia. También podés asociarla manualmente desde la lista de Actividades.
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-white text-zinc-950 font-bold text-xs"
              onClick={() => setShowLinkModal(false)}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Música & Spotify ── */}
      <Dialog open={showMusicModal} onOpenChange={setShowMusicModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              Música & Cadencia
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Sincronizá tus playlists de running con tu cadencia objetivo (170-180 SPM).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-zinc-300 space-y-2">
            <p>
              🎧 Correr con música al ritmo de tu zancada ayuda a optimizar el gasto energético y mantener la consistencia en series tempo.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              className="rounded-full bg-white text-zinc-950 font-bold text-xs"
              onClick={() => setShowMusicModal(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Saltar Entrenamiento ── */}
      <Dialog open={showSkipModal} onOpenChange={setShowSkipModal}>
        <DialogContent className="max-w-md rounded-3xl bg-[#12151a] border-white/10 text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black font-display text-white">
              ¿Saltar este entrenamiento?
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Podés reprogramarlo para mañana o marcarlo como descanso si no te sentís al 100%.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex flex-col gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-white/10 text-white hover:bg-white/10 text-xs font-bold py-5 justify-start"
              onClick={() => {
                showSuccessToast("Entrenamiento reprogramado")
                setShowSkipModal(false)
                onOpenChange(false)
              }}
            >
              <RotateCcw className="mr-2 size-4 text-amber-400" />
              Mover para mañana
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-white/10 text-white hover:bg-white/10 text-xs font-bold py-5 justify-start"
              onClick={() => {
                showSuccessToast("Sesión marcada como descanso")
                setShowSkipModal(false)
                onOpenChange(false)
              }}
            >
              <XCircle className="mr-2 size-4 text-destructive" />
              Tomar día de descanso
            </Button>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => setShowSkipModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
