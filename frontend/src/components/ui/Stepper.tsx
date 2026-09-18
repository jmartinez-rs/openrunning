import React from "react";
import { Minus, Plus } from "lucide-react";

interface StepperProps {
  value: number;
  onChange: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  decimals?: number;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  label,
  unit,
  decimals = 1,
  className = "",
}) => {
  const update = (delta: number) => {
    let newVal = (value || 0) + delta;
    if (min !== undefined && newVal < min) newVal = min;
    if (max !== undefined && newVal > max) newVal = max;
    const factor = Math.pow(10, decimals);
    newVal = Math.round(newVal * factor) / factor;
    onChange(newVal);
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      )}
      <div className="flex items-center gap-1 bg-card/80 border border-border/60 rounded-xl p-1 shadow-card">
        <button
          type="button"
          onClick={() => update(-step)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high text-foreground hover:bg-surface-container-highest active:scale-95 transition-all cursor-pointer font-bold text-lg select-none"
          aria-label="Decrease"
        >
          <Minus className="w-5 h-5" />
        </button>

        <div className="flex-1 text-center font-bold text-lg text-primary tracking-tight px-1 font-display">
          {isNaN(value) ? 0 : value}
          {unit && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {unit}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => update(step)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-high text-foreground hover:bg-surface-container-highest active:scale-95 transition-all cursor-pointer font-bold text-lg select-none"
          aria-label="Increase"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};