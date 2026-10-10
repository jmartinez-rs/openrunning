import { ChevronRight, Flag, Trophy } from "lucide-react"
import type React from "react"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface TargetRaceHeroCardProps {
  raceName?: string
  daysRemaining?: number
  dateText?: string
  distanceKm?: number
  currentWeek?: number
  totalWeeks?: number
  totalPlanKm?: number
  levelText?: string
  goalText?: string
  onViewWorkouts?: () => void
}

export const TargetRaceHeroCard: React.FC<TargetRaceHeroCardProps> = ({
  raceName,
  daysRemaining,
  dateText,
  distanceKm,
  currentWeek = 1,
  totalWeeks = 12,
  totalPlanKm,
  levelText = "Intermedio",
  goalText = "Completar con buenas sensaciones",
  onViewWorkouts,
}) => {
  const [modalOpen, setModalOpen] = useState(false)

  if (!raceName) {
    return (
      <div
        onClick={onViewWorkouts}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121214] p-5 shadow-card hover:border-primary/40 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Trophy className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider font-bold text-primary">
                Objetivo de Temporada
              </p>
              <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors">
                Definir Carrera Objetivo
              </h3>
            </div>
          </div>
          <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121214] shadow-card transition-all cursor-pointer group hover:border-primary/30"
      >
        {/* Subtle background ambient graphic/gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-black/60 pointer-events-none" />
        <div className="absolute top-0 right-0 w-64 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Image banner feel */}
        <div className="relative h-28 sm:h-36 w-full overflow-hidden bg-[#18181b] border-b border-white/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-primary/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-[#121214]/40 to-transparent" />
          
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-zinc-300">
              <Flag className="size-3 text-primary" />
              {distanceKm ? `${distanceKm} km` : "Carrera"}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative p-5 pt-3">
          <div className="flex items-center justify-between gap-4">
            {/* Days Left Badge (Paccer style) */}
            <div className="flex flex-col items-center justify-center size-20 rounded-2xl bg-primary text-black shrink-0 shadow-[0_4px_20px_rgba(234,252,95,0.25)] select-none">
              <span className="text-[10px] font-black uppercase tracking-wider text-black/80 leading-none">
                Faltan
              </span>
              <span className="text-2xl font-display font-black leading-none my-0.5 text-black">
                {daysRemaining !== undefined && daysRemaining >= 0 ? daysRemaining : "--"}
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-black/80 leading-none">
                Días
              </span>
            </div>

            {/* Title & Subtitle */}
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Prueba Objetivo
              </span>
              <h2 className="text-xl font-display font-black text-white tracking-tight truncate group-hover:text-primary transition-colors">
                {raceName}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                {dateText && <span>{dateText}</span>}
                {distanceKm && <span>· {distanceKm} km</span>}
              </p>
            </div>

            <ChevronRight className="size-6 text-zinc-500 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
          </div>

          {/* Progress dots bar */}
          <div className="mt-5 space-y-2.5">
            <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
              {Array.from({ length: Math.min(15, totalWeeks) }).map((_, idx) => {
                const weekIdx = idx + 1
                const isPassed = weekIdx < currentWeek
                const isCurrent = weekIdx === currentWeek
                return (
                  <div
                    key={weekIdx}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      isCurrent
                        ? "bg-primary shadow-[0_0_8px_rgba(234,252,95,0.6)]"
                        : isPassed
                          ? "bg-primary/50"
                          : "bg-white/10"
                    }`}
                  />
                )
              })}
            </div>

            {/* Weeks and Volume info footer */}
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 pt-1">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
                  Semanas
                </span>
                <span className="text-sm font-bold text-white">
                  {currentWeek}/{totalWeeks}
                </span>
              </div>

              {totalPlanKm !== undefined && (
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block font-bold">
                    Volumen Total Plan
                  </span>
                  <span className="text-sm font-bold text-white">
                    {totalPlanKm.toFixed(1)} km
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet / Dialog Modal: 7-inicio-prova-alvo.png */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="bg-[#121214] border border-white/10 text-white rounded-3xl max-w-sm sm:max-w-md p-6 overflow-hidden shadow-2xl"
        >
          {/* Subtle top indicator bar */}
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-2 mb-4" />

          <DialogHeader className="p-0 text-left">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex flex-col items-center justify-center size-20 rounded-2xl bg-primary text-black shrink-0 shadow-[0_4px_20px_rgba(234,252,95,0.25)]">
                <span className="text-[10px] font-black uppercase tracking-wider text-black/80 leading-none">
                  Faltan
                </span>
                <span className="text-2xl font-display font-black leading-none my-0.5 text-black">
                  {daysRemaining !== undefined && daysRemaining >= 0 ? daysRemaining : "--"}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-black/80 leading-none">
                  Días
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                  Prueba Objetivo Principal
                </span>
                <DialogTitle className="text-xl font-display font-black text-white leading-tight">
                  {raceName}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* Details list as shown in image 7 */}
          <div className="divide-y divide-white/5 py-2 text-sm">
            <div className="flex items-center justify-between py-3">
              <span className="text-zinc-400">Distancia</span>
              <span className="font-bold text-white">{distanceKm ? `${distanceKm}km` : "--"}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-zinc-400">Nivel</span>
              <span className="font-bold text-white capitalize">{levelText}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-zinc-400">Objetivo</span>
              <span className="font-bold text-white">{goalText}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-zinc-400">Fecha de la carrera</span>
              <span className="font-bold text-white">{dateText || "--"}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-4">
            <Button
              type="button"
              onClick={() => {
                setModalOpen(false)
                if (onViewWorkouts) onViewWorkouts()
              }}
              className="w-full py-6 rounded-2xl bg-primary text-black font-extrabold hover:bg-primary/90 text-sm transition-all"
            >
              Ver entrenamientos
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="w-full py-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/5 font-semibold text-sm transition-all"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
