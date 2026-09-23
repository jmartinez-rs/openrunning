import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import { SettingsRow } from "@/components/Settings/SettingsSection"
import { isNavItemActive, moreMenu } from "@/lib/navigation"
import { cn } from "@/lib/utils"

interface MoreMenuContentProps {
  onNavigate?: () => void
  className?: string
}

/**
 * Contenido del menú "Más": items secundarios agrupados por sección
 * (Navegación / Herramientas / Sistema). Compartido entre el Sheet mobile
 * y el dropdown desktop para evitar duplicar la definición de items.
 */
export function MoreMenuContent({
  onNavigate,
  className,
}: MoreMenuContentProps) {
  const router = useRouterState()
  const currentPath = router.location.pathname

  return (
    <div className={cn("space-y-1", className)}>
      {moreMenu.map((section, index) => (
        <div
          key={section.id}
          className={cn(index > 0 && "mt-3 border-t border-border/50 pt-3")}
        >
          <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <div className="divide-y divide-border/40">
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = isNavItemActive(item, currentPath)
              return (
                <RouterLink
                  key={item.id}
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "block transition-colors",
                    isActive
                      ? "bg-primary/5"
                      : "hover:bg-surface-container-high/40",
                  )}
                >
                  <SettingsRow
                    icon={Icon}
                    iconBg="bg-surface-container-high/50"
                    iconColor="text-primary"
                    title={item.label}
                    accessory="chevron"
                  />
                </RouterLink>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
