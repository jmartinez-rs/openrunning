import { Sparkles } from "lucide-react"
import type React from "react"

interface AIWorkoutAnalysisCardProps {
  analysisText?: string
  workoutType?: string
  isRegenerativeExceeded?: boolean
  completedKm?: number
  targetKm?: number
  avgPace?: string
  targetPace?: string
}

export const AIWorkoutAnalysisCard: React.FC<AIWorkoutAnalysisCardProps> = ({
  analysisText,
  isRegenerativeExceeded = false,
  completedKm,
  targetKm,
  avgPace,
}) => {
  const defaultText = isRegenerativeExceeded
    ? "Completaste la distancia propuesta, sin embargo el ritmo y la frecuencia cardíaca estuvieron por encima de lo planificado para un entrenamiento de soltura. Mantén el control de la intensidad en los próximos entrenamientos suaves para garantizar la regeneración muscular y evitar la acumulación de fatiga innecesaria."
    : completedKm && targetKm && completedKm >= targetKm
      ? `Excelente trabajo. Cumpliste con éxito el objetivo de ${completedKm.toFixed(1)} km a un ritmo medio consistente de ${avgPace || "ritmo óptimo"}. Tu respuesta cardíaca se mantuvo estable dentro del rango aeróbico programado.`
      : "Sesión completada y sincronizada correctamente. Continúa con tu hidratación y descanso programado para consolidar la adaptación de este estímulo."

  const content = analysisText || defaultText

  return (
    <div className="rounded-3xl border border-white/10 bg-[#121214] p-6 shadow-card space-y-4">
      {/* Header with Sparkles AI icon */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
          <Sparkles className="size-5 text-primary" />
        </div>
        <h3 className="text-lg font-display font-black text-white tracking-tight">
          Análisis de la IA de tu entrenamiento
        </h3>
      </div>

      {/* Main Analysis Body Text (Paccer 12-treinos-analise.png style) */}
      <div className="space-y-3 text-sm text-zinc-300 leading-relaxed font-normal">
        <p className="bg-black/30 border border-white/5 rounded-2xl p-4">
          {content}
        </p>
      </div>

      {/* Pro tip or recommendation highlight */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
        <span className="text-primary font-black text-xs uppercase tracking-wider shrink-0 mt-0.5">
          Tip IA:
        </span>
        <p className="text-xs text-zinc-300 leading-snug">
          Prioriza 7 a 8 horas de sueño esta noche y estiramientos suaves de la cadena posterior para optimizar la recuperación muscular.
        </p>
      </div>
    </div>
  )
}
