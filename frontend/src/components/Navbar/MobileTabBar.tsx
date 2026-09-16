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
  Plus,
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
    { icon: Flame, title: "Planes de Entrenamiento", path: "/routines", color: "text-amber-400", bg: "bg-amber-500/15" },
    { icon: Trophy, title: "Carreras & Objetivos", path: "/races", color: "text-yellow-400", bg: "bg-yellow-500/15" },
    { icon: Footprints, title: "Gestión de Calzado", path: "/shoes", color: "text-cyan-400", bg: "bg-cyan-500/15" },
    { icon: Calculator, title: "Calculadoras & Herramientas", path: "/tools", color: "text-blue-400", bg: "bg-blue-500/15" },
    { icon: Settings2, title: "Configuración del Sistema", path: "/settings", color: "text-purple-400", bg: "bg-purple-500/15" },
  ]

  const isMoreActive = moreItems.some((item) => currentPath === item.path)

  return (
    <>
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 flex items-end justify-around bg-slate-950/85 backdrop-blur-xl border-t border-slate-800/80 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl">
        {/* Tab 1: Inicio */}
        <RouterLink
          to="/"
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors flex-1 py-1",
            currentPath === "/" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200",
          )}
        >
          <Home className="size-5 shrink-0" strokeWidth={currentPath === "/" ? 2.5 : 1.8} />
          <span>Inicio</span>
        </RouterLink>

        {/* Tab 2: Actividades */}
        <RouterLink
          to="/activities"
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors flex-1 py-1",
            currentPath === "/activities" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200",
          )}
        >
          <CalendarDays className="size-5 shrink-0" strokeWidth={currentPath === "/activities" ? 2.5 : 1.8} />
          <span>Historial</span>
        </RouterLink>

        {/* Tab 3: Botón Central Flotante "Nuevo" (+) (OpenGym .start style) */}
        <button
          type="button"
          onClick={() => setNewActionOpen(true)}
          className="flex flex-col items-center justify-center cursor-pointer -mt-6 flex-1 group"
        >
          <div className="flex size-13 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40 ring-4 ring-slate-950 transition-transform active:scale-95 group-hover:scale-105">
            {isUploading || syncMutation.isPending ? (
              <Loader2 className="size-6 animate-spin text-slate-950" />
            ) : (
              <Plus className="size-7 stroke-[2.5]" />
            )}
          </div>
          <span className="text-[10px] font-bold text-emerald-400 mt-0.5">
            Nuevo
          </span>
        </button>

        {/* Tab 4: Analítica */}
        <RouterLink
          to="/analytics"
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors flex-1 py-1",
            currentPath === "/analytics" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200",
          )}
        >
          <BarChart3 className="size-5 shrink-0" strokeWidth={currentPath === "/analytics" ? 2.5 : 1.8} />
          <span>Analítica</span>
        </RouterLink>

        {/* Tab 5: Más / Menú */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className={cn(
            "flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors flex-1 py-1",
            isMoreActive ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200",
          )}
        >
          <Menu className="size-5 shrink-0" strokeWidth={isMoreActive ? 2.5 : 1.8} />
          <span>Más</span>
        </button>
      </nav>

      {/* Action Sheet for "Nuevo" (+) */}
      <Sheet open={newActionOpen} onOpenChange={setNewActionOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-slate-800 bg-slate-950 p-4 pb-8 max-w-lg mx-auto">
          <SheetHeader className="p-0 pb-3 border-b border-slate-800/80">
            <SheetTitle className="text-lg font-bold text-slate-100">
              Registrar / Importar Actividad
            </SheetTitle>
          </SheetHeader>

          <div className="mt-3 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
            {/* Option 1: Registrar Carrera Manual */}
            <SettingsRow
              icon={Footprints}
              iconBg="bg-orange-500/15"
              iconColor="text-orange-400"
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
                iconBg="bg-emerald-500/15"
                iconColor="text-emerald-400"
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
              iconBg="bg-blue-500/15"
              iconColor="text-blue-400"
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
        <SheetContent side="bottom" className="rounded-t-3xl border-slate-800 bg-slate-950 p-4 pb-8 max-w-lg mx-auto">
          <SheetHeader className="p-0 pb-3 border-b border-slate-800/80">
            <SheetTitle className="text-lg font-bold text-slate-100">
              Navegación & Herramientas
            </SheetTitle>
          </SheetHeader>

          <div className="mt-3 divide-y divide-slate-800/60 rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
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
