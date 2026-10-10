import { Frown, HelpCircle, Meh, Smile } from "lucide-react"
import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"

export interface WorkoutFeedbackData {
  distanceKm: string
  paceMinKm: string
  durationFormatted: string
  avgBpm: string
  rpeRating: "weak" | "normal" | "strong"
  feelingNotes?: string
}

interface WorkoutFeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: {
    distanceKm?: number | null
    paceSecondsPerKm?: number | null
    durationSeconds?: number | null
    avgBpm?: number | null
  }
  onSubmitFeedback: (data: WorkoutFeedbackData) => Promise<void> | void
}

export const WorkoutFeedbackModal: React.FC<WorkoutFeedbackModalProps> = ({
  open,
  onOpenChange,
  initialData,
  onSubmitFeedback,
}) => {
  const { showSuccessToast } = useCustomToast()
  const [distance, setDistance] = useState(
    initialData?.distanceKm ? initialData.distanceKm.toFixed(2) : "5.00",
  )

  const initialPaceStr = (() => {
    if (!initialData?.paceSecondsPerKm) return "05:50"
    const mins = Math.floor(initialData.paceSecondsPerKm / 60)
    const secs = Math.floor(initialData.paceSecondsPerKm % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  })()
  const [pace, setPace] = useState(initialPaceStr)

  const initialDurationStr = (() => {
    if (!initialData?.durationSeconds) return "00:29:10"
    const hrs = Math.floor(initialData.durationSeconds / 3600)
    const mins = Math.floor((initialData.durationSeconds % 3600) / 60)
    const secs = initialData.durationSeconds % 60
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  })()
  const [duration, setDuration] = useState(initialDurationStr)

  const [bpm, setBpm] = useState(
    initialData?.avgBpm ? Math.round(initialData.avgBpm).toString() : "148",
  )

  const [feeling, setFeeling] = useState<"weak" | "normal" | "strong">("normal")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onSubmitFeedback({
        distanceKm: distance,
        paceMinKm: pace,
        durationFormatted: duration,
        avgBpm: bpm,
        rpeRating: feeling,
      })
      showSuccessToast("¡Entrenamiento registrado y evaluado!")
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#121214] border border-white/10 text-white rounded-3xl max-w-sm sm:max-w-md p-6 overflow-hidden shadow-2xl"
      >
        {/* Subtle grab bar indicator */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-2 mb-4" />

        <DialogHeader className="p-0 text-left space-y-1.5">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl sm:text-2xl font-display font-black text-white tracking-tight">
              ¿Cómo fue tu entrenamiento?
            </DialogTitle>
            <HelpCircle className="size-5 text-amber-400 shrink-0 cursor-help" />
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Informa las métricas del entrenamiento y recibe el feedback y análisis de la inteligencia artificial.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Grid de 4 Métricas (Distancia, Ritmo medio, Duración, BPM medio) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Distancia */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 focus-within:border-primary/50 transition-all">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Distancia
              </label>
              <div className="flex items-baseline gap-1">
                <Input
                  type="text"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className="p-0 h-auto bg-transparent border-0 font-display font-black text-xl text-white focus-visible:ring-0 shadow-none"
                />
                <span className="text-xs font-semibold text-zinc-400">km</span>
              </div>
            </div>

            {/* Pace medio */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 focus-within:border-primary/50 transition-all">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Pace medio
              </label>
              <div className="flex items-baseline gap-1">
                <Input
                  type="text"
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  className="p-0 h-auto bg-transparent border-0 font-display font-black text-xl text-white focus-visible:ring-0 shadow-none font-mono"
                />
                <span className="text-xs font-semibold text-zinc-400">/km</span>
              </div>
            </div>

            {/* Duración */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 focus-within:border-primary/50 transition-all">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                Duración
              </label>
              <Input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="p-0 h-auto bg-transparent border-0 font-display font-black text-xl text-white focus-visible:ring-0 shadow-none font-mono"
              />
            </div>

            {/* BPM medio */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 focus-within:border-primary/50 transition-all">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                BPM medio
              </label>
              <div className="flex items-baseline gap-1">
                <Input
                  type="text"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  className="p-0 h-auto bg-transparent border-0 font-display font-black text-xl text-white focus-visible:ring-0 shadow-none font-mono"
                />
                <span className="text-xs font-semibold text-zinc-400">bpm</span>
              </div>
            </div>
          </div>

          {/* Selector: ¿Cómo te sentiste? (Fraco / Normal / Forte) */}
          <div className="space-y-3">
            <h4 className="text-sm font-display font-black text-white">
              ¿Cómo te sentiste?
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {/* Fraco / Débil */}
              <button
                type="button"
                onClick={() => setFeeling("weak")}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  feeling === "weak"
                    ? "bg-rose-500/10 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                    : "bg-black/30 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Frown className="size-8" />
                <span className="text-xs font-bold">Débil</span>
              </button>

              {/* Normal */}
              <button
                type="button"
                onClick={() => setFeeling("normal")}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  feeling === "normal"
                    ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    : "bg-black/30 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Meh className="size-8" />
                <span className="text-xs font-bold">Normal</span>
              </button>

              {/* Forte / Fuerte */}
              <button
                type="button"
                onClick={() => setFeeling("strong")}
                className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  feeling === "strong"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "bg-black/30 border-white/5 text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Smile className="size-8" />
                <span className="text-xs font-bold">Fuerte</span>
              </button>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 rounded-2xl bg-primary text-black font-extrabold hover:bg-primary/90 text-sm shadow-[0_4px_20px_rgba(234,252,95,0.2)] transition-all cursor-pointer"
            >
              {isSubmitting ? "Registrando..." : "Registrar entrenamiento"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full py-3 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition-all"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
