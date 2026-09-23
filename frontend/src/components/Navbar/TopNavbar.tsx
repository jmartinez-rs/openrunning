import { useMutation } from "@tanstack/react-query"
import {
  Link as RouterLink,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { Bell, Loader2, Menu, RefreshCw, Settings2, User } from "lucide-react"
import { useState } from "react"
import { SyncService } from "@/client"
import { Logo } from "@/components/Common/Logo"
import { MoreMenuContent } from "@/components/Navbar/MoreMenuContent"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useAuth from "@/hooks/useAuth"
import {
  desktopNavItems,
  isAnyMoreItemActive,
  isNavItemActive,
  type NavItem,
  primaryNav,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"

function DesktopNavLink({
  item,
  currentPath,
}: {
  item: NavItem
  currentPath: string
}) {
  const isActive = isNavItemActive(item, currentPath)
  const Icon = item.icon
  return (
    <RouterLink
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-3 text-label-md font-semibold transition-all",
        isActive
          ? "bg-primary/15 font-bold text-primary border border-primary/30"
          : "text-muted-foreground hover:bg-surface-container-high/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" strokeWidth={2} />
      <span>{item.shortLabel ?? item.label}</span>
    </RouterLink>
  )
}

function DesktopNav() {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreActive = isAnyMoreItemActive(currentPath)

  return (
    <>
      {/* xl+: hay espacio, se muestran todos los items */}
      <nav
        aria-label="Navegación principal"
        className="hidden xl:flex xl:items-center xl:gap-1"
      >
        {desktopNavItems.map((item) => (
          <DesktopNavLink key={item.id} item={item} currentPath={currentPath} />
        ))}
      </nav>

      {/* md–xl: sin espacio, primarios + dropdown "Más" */}
      <nav
        aria-label="Navegación principal"
        className="hidden md:flex xl:hidden md:items-center md:gap-1"
      >
        {primaryNav.map((item) => (
          <DesktopNavLink key={item.id} item={item} currentPath={currentPath} />
        ))}

        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={moreOpen}
              aria-current={isMoreActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-3 text-label-md font-semibold transition-all",
                isMoreActive
                  ? "bg-primary/15 font-bold text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-surface-container-high/60 hover:text-foreground",
              )}
            >
              <Menu className="size-4 shrink-0" strokeWidth={2} />
              <span>Más</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 bg-card border-border text-muted-foreground max-h-[70vh] overflow-y-auto"
          >
            <MoreMenuContent onNavigate={() => setMoreOpen(false)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  )
}

function RightActions() {
  const { user: currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const syncMutation = useMutation({
    mutationFn: async () => {
      await SyncService.triggerSync({ provider: "strava" })
    },
  })

  return (
    <div className="flex items-center gap-2 md:gap-3">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:bg-surface-container-high hover:text-foreground"
        aria-label="Sincronizar con Strava"
        disabled={syncMutation.isPending}
        onClick={() => syncMutation.mutate()}
      >
        {syncMutation.isPending ? (
          <Loader2 className="size-5 animate-spin text-primary" />
        ) : (
          <RefreshCw className="size-5 text-primary" />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:bg-surface-container-high hover:text-foreground"
            aria-label="Notificaciones"
          >
            <Bell className="size-5" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-card border-border text-muted-foreground"
        >
          <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border" />
          <div className="p-4 text-center text-xs text-muted-foreground">
            No tienes notificaciones recientes.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {currentUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="size-8 cursor-pointer ring-1 ring-primary/30 transition-all hover:ring-primary">
              <AvatarFallback className="bg-card text-primary font-bold">
                {currentUser.full_name?.charAt(0) || (
                  <User className="size-4" />
                )}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-card border-border text-muted-foreground"
          >
            <DropdownMenuLabel className="text-foreground truncate">
              {currentUser.full_name || currentUser.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              className="cursor-pointer hover:bg-surface-container-high hover:text-foreground focus:bg-surface-container-high focus:text-foreground"
              onClick={() => navigate({ to: "/settings" })}
            >
              <Settings2 className="mr-2 size-4" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              className="cursor-pointer text-destructive hover:bg-surface-container-high hover:text-destructive focus:bg-surface-container-high focus:text-destructive"
              onClick={() => logout()}
            >
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-surface-container-high hover:text-foreground"
          aria-label="Cuenta"
        >
          <User className="size-5" />
        </Button>
      )}
    </div>
  )
}

export function TopNavbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md md:h-16 md:px-6">
      <div className="flex items-center gap-3">
        <Logo variant="responsive" showSubtitle={false} />
      </div>

      <DesktopNav />

      <RightActions />
    </header>
  )
}

export default TopNavbar
