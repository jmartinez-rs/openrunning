import React from "react";
import { RefreshCw, Plus } from "lucide-react";

interface StravaSyncBarProps {
  lastSyncText: string;
  isSyncing: boolean;
  onSyncStrava: () => void;
  onOpenManualRun: () => void;
}

export const StravaSyncBar: React.FC<StravaSyncBarProps> = ({
  lastSyncText,
  isSyncing,
  onSyncStrava,
  onOpenManualRun,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-md">
      {/* Sync Status Badge */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
        </span>
        <span className="text-xs font-medium text-slate-300">
          {isSyncing ? "Sincronizando con Strava..." : lastSyncText || "Strava conectado"}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSyncStrava}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span>Sync Strava</span>
        </button>

        <button
          type="button"
          onClick={onOpenManualRun}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 active:scale-95 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>+ Registrar Manual</span>
        </button>
      </div>
    </div>
  );
};
