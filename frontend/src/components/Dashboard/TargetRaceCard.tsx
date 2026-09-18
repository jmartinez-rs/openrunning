import React from "react";
import { Trophy, Calendar, Flag, Gauge, ChevronRight } from "lucide-react";

interface TargetRaceCardProps {
  raceName?: string;
  daysRemaining?: number;
  dateText?: string;
  distanceKm?: number;
  targetTimeText?: string;
  targetPaceText?: string;
  onClick: () => void;
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
      className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 shadow-xl hover:border-emerald-500/60 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Próxima Carrera Objetivo
          </span>
        </div>

        {daysRemaining !== undefined && daysRemaining >= 0 && (
          <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            Faltan {daysRemaining} días
          </span>
        )}
      </div>

      {raceName ? (
        <>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                {raceName}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {dateText}
                </span>
                <span className="flex items-center gap-1 font-semibold text-slate-300">
                  <Flag className="w-3.5 h-3.5 text-emerald-400" />
                  {distanceKm} km
                </span>
              </div>
            </div>

            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>

          {(targetTimeText || targetPaceText) && (
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
              {targetTimeText && (
                <div className="bg-slate-800/40 rounded-lg p-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Tiempo Objetivo</div>
                    <div className="font-bold text-white">{targetTimeText}</div>
                  </div>
                </div>
              )}

              {targetPaceText && (
                <div className="bg-slate-800/40 rounded-lg p-2 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-teal-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Ritmo Necesario</div>
                    <div className="font-bold text-white">{targetPaceText} /km</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between mt-2">
          <div>
            <h3 className="text-base font-bold text-slate-300 tracking-tight group-hover:text-emerald-300 transition-colors">
              Sin carreras próximas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Toca aquí para agendar tu próximo objetivo.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
        </div>
      )}
    </div>
  );
};
