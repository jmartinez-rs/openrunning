import { useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gauge,
  HelpCircle,
  Info,
  Sparkles,
  Zap,
} from "lucide-react"

import type { RacePublic, RunningPlanPublic } from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  calculateVDOT,
  formatPace,
  formatTime,
  getTrainingPaces,
  predictTimeRiegel,
} from "@/lib/running-math"
import { cn } from "@/lib/utils"

interface PlanPaceInsightsCardProps {
  plan: RunningPlanPublic
  race?: RacePublic | null
  className?: string
}

/**
 * Tarjeta de "Análisis del Ritmo" y "Tiempos estimados de carrera",
 * idéntica a la vista "Tu Plan" de Runna (pagina_tuplan.jpg):
 * - Banner "ANÁLISIS DEL RITMO" con CTA pill "¡EN MARCHA!"
 * - Divisor sutil
 * - Subsección colapsable "Tiempos estimados de carrera ℹ️" con cuenta regresiva "En X semanas" y rango "1:26:00 - 1:30:00"
 */
export function PlanPaceInsightsCard({
  plan,
  race,
  className,
}: PlanPaceInsightsCardProps) {
  const [showPacesModal, setShowPacesModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 1. Distancia y tiempo objetivo
  const targetDistanceKm =
    plan.distance_km || race?.distance_km || (plan.goal?.includes("42") ? 42.2 : plan.goal?.includes("21") ? 21.1 : 10)

  let baseTimeSec =
    plan.target_time_seconds ||
    race?.target_time_seconds ||
    (plan.target_pace_seconds_per_km ? plan.target_pace_seconds_per_km * targetDistanceKm : null)

  // Fallback representativo según distancia si el plan aún no tiene target_time_seconds definido
  if (!baseTimeSec || baseTimeSec <= 0) {
    if (targetDistanceKm >= 40) baseTimeSec = 13200 // ~3h40
    else if (targetDistanceKm >= 20) baseTimeSec = 5280 // ~1h28
    else if (targetDistanceKm >= 9) baseTimeSec = 2880 // ~48m
    else baseTimeSec = 1440 // ~24m
  }

  // 2. Rango de tiempo estimado (±2%)
  const lowSec = Math.round(baseTimeSec * 0.98)
  const highSec = Math.round(baseTimeSec * 1.02)
  const predictedRangeStr = `${formatTime(lowSec)} - ${formatTime(highSec)}`

  // 3. Semanas restantes
  const targetDate = race?.date || plan.end_date
  let weeksLeftText = "En 7 semanas"
  if (targetDate) {
    const today = new Date()
    const target = new Date(`${targetDate}T12:00:00`)
    const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000)
    const weeksCount = Math.max(0, Math.ceil(diffDays / 7))
    if (weeksCount <= 0) weeksLeftText = "Esta semana"
    else if (weeksCount === 1) weeksLeftText = "En 1 semana"
    else weeksLeftText = `En ${weeksCount} semanas`
  }

  // 4. VDOT y equivalencias Jack Daniels
  const vdot = calculateVDOT(targetDistanceKm * 1000, baseTimeSec)
  const trainingPaces = vdot > 0 ? getTrainingPaces(vdot) : null

  // Equivalencias estándar vía fórmula de Riegel
  const equivalentDistances = [
    { label: "5K", meters: 5000 },
    { label: "10K", meters: 10000 },
    { label: "21.1K (Media)", meters: 21097 },
    { label: "42.2K (Maratón)", meters: 42195 },
  ]

  return (
    <>
      <section
        aria-label="Análisis del Ritmo y Tiempos Estimados"
        className={cn(
          "overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-5 sm:p-6 shadow-md transition-all",
          className,
        )}
      >
        {/* ── Parte Superior: ANÁLISIS DEL RITMO ── */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground/90">
              Análisis del ritmo
            </span>
            <Badge
              variant="outline"
              className="gap-1 border-primary/30 bg-primary/10 text-[10px] font-bold text-primary uppercase"
            >
              <Sparkles className="size-3" />
              Adaptativo
            </Badge>
          </div>

          <p className="mt-2 text-sm text-foreground/90 font-medium leading-relaxed max-w-md">
            Controlaremos tus sesiones de velocidad para mantener tu entrenamiento en el buen camino.
          </p>

          <div className="mt-3.5">
            <button
              type="button"
              onClick={() => setShowPacesModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-xs font-black uppercase tracking-wide text-background shadow-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="size-3.5 fill-current" />
              Zonas de ritmo
            </button>
          </div>
        </div>

        {/* ── Divisor sutil ── */}
        <div className="my-4 h-px w-full bg-border/60" />

        {/* ── Parte Inferior: Tiempos estimados de carrera ── */}
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-2 text-left cursor-pointer group"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors">
                Tiempos estimados de carrera
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowInfoModal(true)
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 cursor-help"
                title="Información sobre las estimaciones"
              >
                <HelpCircle className="size-4" />
              </button>
            </div>

            <div className="size-7 flex items-center justify-center rounded-full bg-surface-container-high/50 text-muted-foreground group-hover:text-foreground transition-colors">
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </div>
          </button>

          <div className="mt-1">
            <span className="block text-xs font-semibold text-muted-foreground">
              {weeksLeftText}
            </span>
            <span className="block font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight tabular-nums mt-0.5">
              {predictedRangeStr}
            </span>
          </div>

          {/* Sección desplegable con equivalencias de tiempo y ritmos */}
          {expanded && (
            <div className="mt-4 pt-3.5 border-t border-border/50 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Distancia</span>
                <span>Tiempo proyectado</span>
                <span>Ritmo medio</span>
              </div>

              <div className="flex flex-col gap-2">
                {equivalentDistances.map((dist) => {
                  const equivSec = predictTimeRiegel(
                    targetDistanceKm * 1000,
                    baseTimeSec!,
                    dist.meters,
                  )
                  const paceSec = equivSec / (dist.meters / 1000)
                  const isCurrentDist =
                    Math.abs(dist.meters / 1000 - targetDistanceKm) < 1

                  return (
                    <div
                      key={dist.label}
                      className={cn(
                        "flex items-center justify-between py-2 px-3 rounded-xl text-xs transition-colors",
                        isCurrentDist
                          ? "bg-primary/10 border border-primary/30 font-bold text-foreground"
                          : "bg-surface-container-high/40 text-muted-foreground",
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        {isCurrentDist && (
                          <span className="size-1.5 rounded-full bg-primary" />
                        )}
                        <span>{dist.label}</span>
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatTime(equivSec)}
                      </span>
                      <span className="tabular-nums">
                        {formatPace(paceSec)}/km
                      </span>
                    </div>
                  )
                })}
              </div>

              {vdot > 0 && (
                <div className="mt-1 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                  <span>
                    Puntuación VDOT estimada:{" "}
                    <strong className="text-foreground">{vdot.toFixed(1)}</strong>
                  </span>
                  <Link
                    to="/tools"
                    className="text-primary hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    Ver calculadora <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Modal de Ritmos de Entrenamiento (al pulsar ¡EN MARCHA!) ── */}
      <Dialog open={showPacesModal} onOpenChange={setShowPacesModal}>
        <DialogContent className="max-w-md rounded-3xl bg-card border-border p-6 text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Gauge className="size-4" />
              <span>Zonas de Ritmo del Plan</span>
            </div>
            <DialogTitle className="text-xl font-black font-display tracking-tight text-foreground">
              Análisis del Ritmo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tus ritmos estructurados según el método Jack Daniels (VDOT {vdot > 0 ? vdot.toFixed(1) : "—"}).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2.5">
            {trainingPaces ? (
              <>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-high/60 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">
                      Carrera Fácil / Suave
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Base aeróbica, charlas cómodas
                    </span>
                  </div>
                  <span className="text-sm font-black font-display text-lime-400 tabular-nums">
                    {trainingPaces.easyMin} - {trainingPaces.easyMax}/km
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-high/60 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">
                      Tempo / Umbral
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Ritmo controlado, esfuerzo sostenible
                    </span>
                  </div>
                  <span className="text-sm font-black font-display text-amber-400 tabular-nums">
                    {trainingPaces.threshold}/km
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-high/60 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">
                      Intervalos (VO2 Max)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Series rápidas de 3 a 5 minutos
                    </span>
                  </div>
                  <span className="text-sm font-black font-display text-orange-400 tabular-nums">
                    {trainingPaces.interval}/km
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-high/60 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">
                      Repeticiones Rápidas
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Economía de carrera y velocidad pura
                    </span>
                  </div>
                  <span className="text-sm font-black font-display text-red-400 tabular-nums">
                    {trainingPaces.repetition}/km
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Definí una marca previa o un objetivo para calibrar tus ritmos exactos.
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs font-bold"
              asChild
            >
              <Link to="/tools">Calculadoras de Ritmo</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-primary text-primary-foreground font-bold text-xs"
              onClick={() => setShowPacesModal(false)}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de Información de Predicciones ── */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="max-w-md rounded-3xl bg-card border-border p-6 text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Info className="size-4" />
              <span>Estimaciones de Carrera</span>
            </div>
            <DialogTitle className="text-xl font-black font-display tracking-tight text-foreground">
              ¿Cómo se calculan los tiempos?
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p>
              Las proyecciones se basan en tu tiempo objetivo, historial de sesiones completadas y la <strong>fórmula de equivalencia de rendimiento de Peter Riegel</strong> y el modelo de <strong>Jack Daniels (VDOT)</strong>.
            </p>
            <p>
              El rango mostrado (±2%) contempla variaciones de clima, perfil altimétrico de la carrera y el tapering final.
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-primary text-primary-foreground font-bold text-xs"
              onClick={() => setShowInfoModal(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
