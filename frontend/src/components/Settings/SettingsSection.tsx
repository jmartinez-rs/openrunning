import { ChevronRight, type LucideIcon } from "lucide-react"
import type React from "react"
import { cn } from "@/lib/utils"

interface SettingsSectionProps {
  title?: string
  footer?: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  title,
  footer,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-2", className)}>
      {title && (
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 divide-y divide-slate-800/60 shadow-sm">
        {children}
      </div>
      {footer && (
        <p className="px-1 text-xs text-slate-400 leading-relaxed">{footer}</p>
      )}
    </section>
  )
}

interface SettingsRowProps {
  icon?: LucideIcon
  iconBg?: string
  iconColor?: string
  title: string
  subtitle?: string
  value?: React.ReactNode
  accessory?: "chevron" | "check" | "none"
  onClick?: () => void
  danger?: boolean
  children?: React.ReactNode
  className?: string
}

export function SettingsRow({
  icon: Icon,
  iconBg = "bg-slate-800/80",
  iconColor = "text-slate-300",
  title,
  subtitle,
  value,
  accessory = "none",
  onClick,
  danger,
  children,
  className,
}: SettingsRowProps) {
  const Component = onClick ? "button" : "div"

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors",
        onClick &&
          "cursor-pointer hover:bg-slate-800/40 active:bg-slate-800/60",
        danger && "text-red-400 hover:bg-red-500/10",
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            danger ? "bg-red-500/15 text-red-400" : cn(iconBg, iconColor),
          )}
        >
          <Icon className="size-4.5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-medium leading-snug",
            danger ? "text-red-400" : "text-slate-100",
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-xs text-slate-400 leading-normal">
            {subtitle}
          </div>
        )}
      </div>

      {children && <div className="shrink-0">{children}</div>}

      {value !== undefined && value !== null && (
        <div className="text-sm font-medium text-slate-400 shrink-0">
          {value}
        </div>
      )}

      {accessory === "chevron" && (
        <ChevronRight className="size-4 shrink-0 text-slate-500" />
      )}
    </Component>
  )
}

interface SettingsSegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (val: T) => void
  className?: string
}

export function SettingsSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SettingsSegmentedProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800/80",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
            value === opt.value
              ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
