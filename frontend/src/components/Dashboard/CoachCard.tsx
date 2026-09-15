import React from "react";
import { Sparkles, ChevronRight } from "lucide-react";

interface CoachCardProps {
  title: string;
  subtitle?: string;
  hasProposal?: boolean;
  onReview: () => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({
  title,
  subtitle = "AI Coach suggestion",
  hasProposal = true,
  onReview,
}) => {
  return (
    <div
      onClick={onReview}
      className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 shadow-xl hover:border-indigo-500/60 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              AI Coach
            </div>
            <div className="text-sm font-bold text-white truncate">{title}</div>
            {subtitle && <div className="text-xs text-slate-400 truncate">{subtitle}</div>}
          </div>
        </div>

        {hasProposal ? (
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20 group-hover:bg-indigo-400 transition-colors">
            Revisar
          </span>
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
        )}
      </div>
    </div>
  );
};
