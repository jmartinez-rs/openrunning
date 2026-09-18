import React from "react";
// no icons needed

interface VolumeCardProps {
  currentKm: number;
  targetKm: number;
  avgPaceText?: string;
  onOpenCalendar: () => void;
}

export const VolumeCard: React.FC<VolumeCardProps> = ({
  currentKm,
  targetKm,
  avgPaceText,
  onOpenCalendar,
}) => {
  const percentage = Math.min(100, Math.round((currentKm / (targetKm || 1)) * 100));

  return (
    <div className="grid grid-cols-2 gap-3" onClick={onOpenCalendar}>
      {/* Volume Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-slate-700 transition-all cursor-pointer group flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 mb-1">Volumen Semanal</h3>
          <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-1">
            {currentKm.toFixed(1)}
            <span className="text-sm font-bold text-slate-500">km</span>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex justify-between items-baseline text-[10px] mb-1.5 font-semibold text-slate-500">
            <span>Meta: {targetKm.toFixed(0)} km</span>
            <span className="text-emerald-400">{percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Average Pace Card */}
      {avgPaceText && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-slate-700 transition-all cursor-pointer group flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 mb-1">Ritmo Promedio</h3>
            <div className="text-3xl font-black text-white tracking-tight flex items-baseline gap-1">
              {avgPaceText}
              <span className="text-sm font-bold text-slate-500">/km</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-teal-500/50 w-1/3" />
              <div className="h-full bg-teal-400 w-1/3" />
              <div className="h-full bg-teal-300 w-1/3" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
