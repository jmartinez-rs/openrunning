import type React from "react"

// no icons needed

interface VolumeCardProps {
  currentKm: number
  targetKm: number
  avgPaceText?: string
  onOpenCalendar: () => void
}

export const VolumeCard: React.FC<VolumeCardProps> = ({
  currentKm,
  targetKm,
  avgPaceText,
  onOpenCalendar,
}) => {
  const percentage = Math.min(
    100,
    Math.round((currentKm / (targetKm || 1)) * 100),
  )

  return (
    <div className="grid grid-cols-2 gap-3" onClick={onOpenCalendar}>
      {/* Volume Card */}
      <div className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card hover:border-primary/20 backdrop-blur-md transition-all cursor-pointer group flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1">
            Volumen Semanal
          </h3>
          <div className="text-3xl font-display font-black text-white tracking-tight flex items-baseline gap-1">
            {currentKm.toFixed(1)}
            <span className="text-sm font-bold text-muted-foreground">km</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-baseline text-[10px] mb-1.5 font-semibold text-muted-foreground">
            <span>Meta: {targetKm.toFixed(0)} km</span>
            <span className="text-primary">{percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 shadow-glow"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Average Pace Card */}
      {avgPaceText && (
        <div className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card hover:border-primary/20 backdrop-blur-md transition-all cursor-pointer group flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1">
              Ritmo Promedio
            </h3>
            <div className="text-3xl font-display font-black text-white tracking-tight flex items-baseline gap-1">
              {avgPaceText}
              <span className="text-sm font-bold text-muted-foreground">
                /km
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden flex">
              <div className="h-full bg-primary w-1/3" />
              <div className="h-full bg-primary/70 w-1/3" />
              <div className="h-full bg-primary/40 w-1/3" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
