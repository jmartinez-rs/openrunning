import { useMutation } from "@tanstack/react-query"
import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import {
  BarChart3,
  Bell,
  Calculator,
  CalendarDays,
  Flame,
  Footprints,
  Home,
  Loader2,
  RefreshCw,
  Settings2,
  Trophy,
  User,
} from "lucide-react"
import { SyncService } from "@/client"
import { Logo } from "@/components/Common/Logo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

type Item = {
  icon: typeof Home
  title: string
  path: string
}

const navItems: Item[] = [
  { icon: Home, title: "Inicio", path: "/" },
  { icon: CalendarDays, title: "Actividades", path: "/activities" },
  { icon: Flame, title: "Planes", path: "/routines" },
  { icon: Trophy, title: "Carreras", path: "/races" },
  { icon: Footprints, title: "Calzado", path: "/shoes" },
  { icon: Calculator, title: "Herramientas", path: "/tools" },
  { icon: BarChart3, title: "Analítica", path: "/analytics" },
  { icon: Settings2, title: "Configuración", path: "/settings" },
]

function DesktopNav() {
  const router = useRouterState()
  const currentPath = router.location.pathname

  return (
    <nav className="hidden md:flex md:items-center md:gap-1">
      {navItems.map((item) => {
        const isActive = currentPath === item.path
        const Icon = item.icon
        return (
          <RouterLink
            key={item.title}
            to={item.path}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-3 text-label-md font-semibold transition-all",
              isActive
                ? "bg-emerald-500/15 font-bold text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            <span>{item.title}</span>
          </RouterLink>
        )
      })}
    </nav>
  )
}

function RightActions() {
  const { user: currentUser } = useAuth()

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
        className="text-slate-400 hover:bg-slate-800 hover:text-white"
        aria-label="Sincronizar con Strava"
        disabled={syncMutation.isPending}
        onClick={() => syncMutation.mutate()}
      >
        {syncMutation.isPending ? (
          <Loader2 className="size-5 animate-spin text-emerald-400" />
        ) : (
          <RefreshCw className="size-5 text-emerald-400" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="relative text-slate-400 hover:bg-slate-800 hover:text-white"
        aria-label="Notificaciones"
      >
        <Bell className="size-5" />
        <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
      </Button>

      {currentUser ? (
        <RouterLink to="/settings">
          <Avatar className="size-8 cursor-pointer ring-1 ring-emerald-500/30">
            <AvatarFallback className="bg-slate-900 text-emerald-400 font-bold">
              {currentUser.full_name?.charAt(0) || <User className="size-4" />}
            </AvatarFallback>
          </Avatar>
        </RouterLink>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:bg-slate-800 hover:text-white"
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
    <header className="fixed top-0 right-0 left-0 z-50 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 backdrop-blur-md md:h-16 md:px-6">
      <div className="flex items-center gap-3">
        <Logo variant="responsive" showSubtitle={false} />
      </div>

      <DesktopNav />

      <RightActions />
    </header>
  )
}

export default TopNavbar
