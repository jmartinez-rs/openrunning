import { cn } from "@/lib/utils"

export interface PeriodOption {
  key: string
  label: string
  months: number
}

interface PeriodSelectorProps {
  value: string
  options: readonly PeriodOption[]
  onChange: (key: string) => void
  className?: string
}

/**
 * Selector de período global — un solo instrumento para todas las cards.
 * Píldora Kinetic Volt con estado activo en `primary` + glow.
 */
export function PeriodSelector({
  value,
  options,
  onChange,
  className,
}: PeriodSelectorProps) {
  return (
    <fieldset
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-1 backdrop-blur-md",
        className,
      )}
    >
      <legend className="sr-only">Período de análisis</legend>
      {options.map((option) => {
        const active = option.key === value
        return (
          <label
            key={option.key}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold font-display tracking-wide transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/70 has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
              active
                ? "bg-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="analytics-period"
              value={option.key}
              checked={active}
              onChange={() => onChange(option.key)}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}
