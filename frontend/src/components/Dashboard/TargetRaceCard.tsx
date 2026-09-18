import { Calendar, ChevronRight, Flag, Gauge, Trophy } from "lucide-react"
import type React from "react"

interface TargetRaceCardProps {
  raceName?: string
  daysRemaining?: number
  dateText?: string
  distanceKm?: number
  targetTimeText?: string
  targetPaceText?: string
  onClick: () => void
}

export const TargetRaceCard: React.FC<TargetRaceCardProps> = ({
  raceName,
  daysRemaining,
  dateText,
  distanceKm,
  targetTimeText,
  targetPaceText,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card hover:border-primary/20 backdrop-blur-md transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/15 text-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Próxima Carrera Objetivo
          </span>
        </div>

        {daysRemaining !== undefined && daysRemaining >= 0 && (
          <span className="text-xs font-display font-extrabold px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/40">
            Faltan {daysRemaining} días
          </span>
        )}
      </div>

      {raceName ? (
        <>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-primary transition-colors">
                {raceName}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-on-surface-variant" />
                  {dateText}
                </span>
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Flag className="w-3.5 h-3.5 text-primary" />
                  {distanceKm} km
                </span>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>

          {(targetTimeText || targetPaceText) && (
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/80 text-xs">
              {targetTimeText && (
                <div className="bg-surface rounded-lg p-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Tiempo Objetivo
                    </div>
                    <div className="font-display font-bold text-white">
                      {targetTimeText}
                    </div>
                  </div>
                </div>
              )}

              {targetPaceText && (
                <div className="bg-surface rounded-lg p-2 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Ritmo Necesario
                    </div>
                    <div className="font-display font-bold text-white">
                      {targetPaceText} /km
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between mt-2">
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              Sin carreras próximas
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toca aquí para agendar tu próximo objetivo.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      )}
    </div>
  )
}
