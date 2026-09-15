import { Monitor, Moon, Sun } from "lucide-react"

import { type Theme, useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type LucideIcon = React.FC<React.SVGProps<SVGSVGElement>>

const ICON_MAP: Record<Theme, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

const LABEL_MAP: Record<Theme, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
}

export const SidebarAppearance = () => {
  const { setTheme, theme } = useTheme()
  const Icon = ICON_MAP[theme]

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="theme-button"
          className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-label-lg font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary dark:hover:bg-surface-variant/10"
        >
          <Icon className="size-5" strokeWidth={2} />
          <span>Apariencia</span>
          <span className="sr-only">Cambiar tema</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="min-w-48">
        {(["light", "dark", "system"] as Theme[]).map((value) => {
          const ItemIcon = ICON_MAP[value]
          return (
            <DropdownMenuItem
              key={value}
              data-testid={
                value === "light"
                  ? "light-mode"
                  : value === "dark"
                    ? "dark-mode"
                    : undefined
              }
              onClick={() => setTheme(value)}
              className={
                theme === value ? "bg-surface-container-low text-primary" : ""
              }
            >
              <ItemIcon className="mr-2 size-4" strokeWidth={2} />
              {LABEL_MAP[value]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const Appearance = () => {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid="theme-button"
          variant="outline"
          size="icon"
          className="rounded-full border-border/50 bg-card text-primary shadow-card hover:bg-surface-container-low hover:text-primary"
        >
          <Sun
            className="absolute size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            strokeWidth={2}
          />
          <Moon
            className="absolute size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            strokeWidth={2}
          />
          <span className="sr-only">Cambiar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {(["light", "dark", "system"] as Theme[]).map((value) => {
          const ItemIcon = ICON_MAP[value]
          return (
            <DropdownMenuItem
              key={value}
              data-testid={
                value === "light"
                  ? "light-mode"
                  : value === "dark"
                    ? "dark-mode"
                    : undefined
              }
              onClick={() => setTheme(value)}
              className={
                theme === value ? "bg-surface-container-low text-primary" : ""
              }
            >
              <ItemIcon className="mr-2 size-4" strokeWidth={2} />
              {LABEL_MAP[value]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
