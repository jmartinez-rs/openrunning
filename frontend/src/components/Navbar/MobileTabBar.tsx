import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink, useRouterState } from "@tanstack/react-router"
import {
  BarChart3,
  Calculator,
  CalendarDays,
  Flame,
  Footprints,
  Home,
  Loader2,
  Menu,
  Play,
  RefreshCw,
  Settings2,
  Trophy,
  Upload,
} from "lucide-react"
import { useState } from "react"

import { SyncService } from "@/client"
import { QuickCreateActivityDialog } from "@/components/Activities/QuickCreateActivityDialog"
import { SettingsRow } from "@/components/Settings/SettingsSection"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"

export function MobileTabBar() {
  const router = useRouterState()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const currentPath = router.location.pathname
  const [menuOpen, setMenuOpen] = useState(false)
  const [newActionOpen, setNewActionOpen] = useState(false)
  const [manualRunOpen, setManualRunOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setNewActionOpen(false)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch("/api/v1/activities/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Error al subir el archivo")
      }

      showSuccessToast("Actividad GPS importada correctamente")
      queryClient.invalidateQueries({ queryKey: ["activities"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    } catch (err: any) {
      showErrorToast(err.message || "No se pudo procesar el archivo GPS")
    } finally {
      setIsUploading(false)
      e.target.value = ""
    }
  }

  const syncMutation = useMutation({
    mutationFn: async () => {
      await SyncService.triggerSync({ provider: "strava" })
    },
    onSuccess: () => {
      showSuccessToast("Sincronización completada")
      queryClient.invalidateQueries({ queryKey: ["activities"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setNewActionOpen(false)
    },
    onError: (err: any) => {
      showErrorToast(err.message || "Error al sincronizar")
    },
  })

  const moreItems = [
    {
      icon: Flame,
      title: "Planes de Entrenamiento",
      path: "/routines",
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      icon: Trophy,
      title: "Carreras & Objetivos",
      path: "/races",
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      icon: Footprints,
      title: "Gestión de Calzado",
      path: "/shoes",
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      icon: Calculator,
      title: "Calculadoras & Herramientas",
      path: "/tools",
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      icon: Settings2,
      title: "Configuración del Sistema",
      path: "/settings",
      color: "text-primary",
      bg: "bg-primary/15",
    },
  ]

  const isMoreActive = moreItems.some((item) => currentPath === item.path)

  return (
    <>
      <div className="md:hidden fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <nav className="flex w-full max-w-[400px] items-center justify-between bg-surface-container/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-card">
          {/* Tab 1: Inicio */}
          <RouterLink
            to="/"
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-full transition-colors",
              currentPath === "/"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Home
              className="size-6 shrink-0"
              strokeWidth={currentPath === "/" ? 2.5 : 1.8}
            />
          </RouterLink>

          {/* Tab 2: Actividades */}
          <RouterLink
            to="/activities"
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-full transition-colors",
              currentPath === "/activities"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarDays
              className="size-6 shrink-0"
              strokeWidth={currentPath === "/activities" ? 2.5 : 1.8}
            />
          </RouterLink>

          {/* Tab 3: Botón Central Flotante "Play" */}
          <button
            type="button"
            onClick={() => setNewActionOpen(true)}
            className="flex items-center justify-center cursor-pointer group -mt-10"
          >
            <div className="flex size-[64px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform active:scale-95 group-hover:scale-105">
              {isUploading || syncMutation.isPending ? (
                <Loader2 className="size-6 animate-spin text-primary-foreground" />
              ) : (
                <Play className="size-8 fill-current stroke-none ml-1" />
              )}
            </div>
          </button>

          {/* Tab 4: Analítica */}
          <RouterLink
            to="/analytics"
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-full transition-colors",
              currentPath === "/analytics"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BarChart3
              className="size-6 shrink-0"
              strokeWidth={currentPath === "/analytics" ? 2.5 : 1.8}
            />
          </RouterLink>

          {/* Tab 5: Más / Menú */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-full transition-colors",
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu
              className="size-6 shrink-0"
              strokeWidth={isMoreActive ? 2.5 : 1.8}
            />
          </button>
        </nav>
      </div>

      {/* Action Sheet for "Nuevo" (+) */}
      <Sheet open={newActionOpen} onOpenChange={setNewActionOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-background p-4 pb-8 max-w-lg mx-auto"
        >
          <SheetHeader className="p-0 pb-3 border-b border-border/80">
            <SheetTitle className="text-lg font-bold text-foreground">
              Registrar / Importar Actividad
            </SheetTitle>
          </SheetHeader>

          <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/80 bg-card/60 overflow-hidden">
            {/* Option 1: Registrar Carrera Manual */}
            <SettingsRow
              icon={Footprints}
              iconBg="bg-primary/15"
              iconColor="text-primary"
              title="Registrar Carrera Manual"
              subtitle="Cargar nombre, fecha, distancia y tiempo"
              accessory="chevron"
              onClick={() => {
                setNewActionOpen(false)
                setManualRunOpen(true)
              }}
            />

            {/* Option 2: Importar .FIT / .GPX */}
            <label className="block cursor-pointer">
              <SettingsRow
                icon={Upload}
                iconBg="bg-primary/15"
                iconColor="text-primary"
                title="Importar Archivo .FIT / .GPX"
                subtitle="Cargar archivo GPS registrado desde tu reloj"
                accessory="chevron"
              />
              <input
                type="file"
                accept=".gpx,.fit"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>

            {/* Option 3: Sincronizar Strava & Hevy */}
            <SettingsRow
              icon={RefreshCw}
              iconBg="bg-primary/15"
              iconColor="text-primary"
              title="Sincronizar Strava & Hevy"
              subtitle="Forzar importación inmediata desde tus cuentas"
              accessory="chevron"
              onClick={() => syncMutation.mutate()}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick Create Activity Dialog */}
      <QuickCreateActivityDialog
        open={manualRunOpen}
        onOpenChange={setManualRunOpen}
      />

      {/* Secondary Navigation Menu ("Más") */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-background p-4 pb-8 max-w-lg mx-auto"
        >
          <SheetHeader className="p-0 pb-3 border-b border-border/80">
            <SheetTitle className="text-lg font-bold text-foreground">
              Navegación & Herramientas
            </SheetTitle>
          </SheetHeader>

          <div className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/80 bg-card/60 overflow-hidden">
            {moreItems.map((item) => {
              const Icon = item.icon
              return (
                <RouterLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                >
                  <SettingsRow
                    icon={Icon}
                    iconBg={item.bg}
                    iconColor={item.color}
                    title={item.title}
                    accessory="chevron"
                    onClick={() => {
                      setMenuOpen(false)
                    }}
                  />
                </RouterLink>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
