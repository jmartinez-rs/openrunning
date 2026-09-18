import { Link } from "@tanstack/react-router"
import { Activity } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
  showSubtitle?: boolean
}

function OpenRunningMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-glow",
        className,
      )}
      aria-hidden="true"
    >
      <Activity className="size-5 stroke-[2.5]" />
    </div>
  )
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
  showSubtitle = true,
}: LogoProps) {
  const isIconOnly = variant === "icon"
  const showWordmark = variant === "full" || variant === "responsive"

  const content = (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <OpenRunningMark className={cn("size-9", isIconOnly && "size-8")} />
      {showWordmark && (
        <div className="flex flex-col">
          <span
            className={cn(
              "text-lg font-black tracking-tight text-white",
              variant === "responsive" &&
                "block group-data-[collapsible=icon]:hidden",
            )}
          >
            Open<span className="text-primary">Running</span>
          </span>
          {showSubtitle && (
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">
              Running & Performance OS
            </span>
          )}
        </div>
      )}
    </div>
  )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
