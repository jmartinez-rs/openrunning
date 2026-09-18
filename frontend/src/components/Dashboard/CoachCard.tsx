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
      className="bg-card/90 border border-white/5 rounded-2xl p-4 shadow-card hover:border-primary/20 backdrop-blur-md transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/20 text-primary shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              AI Coach
            </div>
            <div className="text-sm font-bold text-white truncate">{title}</div>
            {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
          </div>
        </div>

        {hasProposal ? (
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-primary text-black shadow-glow group-hover:bg-primary/90 transition-colors">
            Revisar
          </span>
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        )}
      </div>
    </div>
  );
};
