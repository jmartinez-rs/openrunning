import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  Download,
  Footprints,
  HeartPulse,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { useMemo, useState } from "react"

import { type ShoePublic, ShoesService } from "@/client"
import { ShoeCard } from "@/components/Shoes/ShoeCard"
import { ShoeFormDialog } from "@/components/Shoes/ShoeFormDialog"
import { getFoamHealth, SHOE_CATEGORIES } from "@/components/Shoes/shoe-utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/shoes/")({
  component: Shoes,
  head: () => ({ meta: [{ title: "Shoe Locker - OpenRunning" }] }),
})

const CATEGORY_FILTERS = [
  { label: "Todas las categorías", value: "" },
  ...SHOE_CATEGORIES.map((c) => ({ label: c.shortLabel, value: c.value })),
]

function Shoes() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [category, setCategory] = useState("")
  const [activeTab, setActiveTab] = useState<"active" | "retired">("active")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ShoePublic | null>(null)

  const shoesQuery = useQuery({
    queryKey: ["shoes", category],
    queryFn: () =>
      ShoesService.readShoes({
        category: (category || null) as
          | "training"
          | "race"
          | "trail"
          | "easy"
          | "mixed"
          | null,
        limit: 100,
      }),
  })

  const shoes = shoesQuery.data?.data ?? []

  const statsQueries = useQueries({
    queries: shoes.map((shoe) => ({
      queryKey: ["shoe-stats", shoe.id],
      queryFn: () => ShoesService.readShoeStats({ shoeId: shoe.id }),
    })),
  })

  const statsMap = useMemo(
    () => new Map(shoes.map((shoe, i) => [shoe.id, statsQueries[i]?.data])),
    [shoes, statsQueries],
  )

  // Split shoes by active / retired
  const activeShoes = useMemo(
    () => shoes.filter((s) => s.is_active !== false),
    [shoes],
  )
  const retiredShoes = useMemo(
    () => shoes.filter((s) => s.is_active === false),
    [shoes],
  )

  const displayShoes = activeTab === "active" ? activeShoes : retiredShoes

  // Summary Metrics
  const lockerSummary = useMemo(() => {
    let totalMeters = 0
    let healthSum = 0
    activeShoes.forEach((shoe) => {
      const stats = statsMap.get(shoe.id)
      const meters = stats?.total_distance_meters ?? 0
      totalMeters += meters
      const health = getFoamHealth(meters, shoe.target_distance_km)
      healthSum += health.percent
    })
    const avgHealth =
      activeShoes.length > 0 ? Math.round(healthSum / activeShoes.length) : 100

    return {
      activeCount: activeShoes.length,
      retiredCount: retiredShoes.length,
      totalKmTracked: Math.round((totalMeters / 1000) * 10) / 10,
      avgHealthPercent: avgHealth,
    }
  }, [activeShoes, retiredShoes, statsMap])

  const importMutation = useMutation({
    mutationFn: () => ShoesService.importStravaShoes(),
    onSuccess: (result) => {
      showSuccessToast(result.message ?? "Importación de Strava completada")
      queryClient.invalidateQueries({ queryKey: ["shoes"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ShoesService.deleteShoe({ shoeId: id }),
    onSuccess: () => {
      showSuccessToast("Zapatilla eliminada")
      queryClient.invalidateQueries({ queryKey: ["shoes"] })
    },
    onError: handleError.bind(showErrorToast),
  })

  return (
    <div className="col-span-12 flex flex-col gap-6">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Shoe Locker · Mi Calzado
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            Seguimiento de amortiguación, desgaste de espuma EVA/PEBA y
            recomendación por sesión.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="bg-card border-border text-muted-foreground hover:text-white hover:bg-surface-container-high rounded-xl text-xs font-semibold"
            disabled={importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin text-primary" />
            ) : (
              <Download className="mr-2 size-4 text-primary" />
            )}
            Importar Strava Gear
          </Button>
          <Button
            type="button"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20 rounded-xl cursor-pointer text-xs"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="mr-2 size-4 stroke-[3]" /> Registrar zapatilla
          </Button>
        </div>
      </div>

      {/* ── Locker Summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-card border border-border shadow-card">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Footprints className="size-3.5 text-primary" />
            Pares Activos
          </div>
          <span className="text-2xl font-black text-white font-display tracking-tight leading-none">
            {lockerSummary.activeCount}{" "}
            <span className="text-xs font-normal text-muted-foreground font-sans">
              pares
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-card border border-border shadow-card">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <TrendingUp className="size-3.5 text-primary" />
            Km Acumulados
          </div>
          <span className="text-2xl font-black text-primary font-display tracking-tight leading-none">
            {lockerSummary.totalKmTracked}{" "}
            <span className="text-xs font-normal text-muted-foreground font-sans">
              km
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-card border border-border shadow-card">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <HeartPulse className="size-3.5 text-primary" />
            Salud Promedio Espuma
          </div>
          <span className="text-2xl font-black text-primary font-display tracking-tight leading-none">
            {lockerSummary.avgHealthPercent}%
          </span>
        </div>

        <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-card border border-border shadow-card">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Archive className="size-3.5 text-on-surface-variant" />
            Pares Retirados
          </div>
          <span className="text-2xl font-black text-white font-display tracking-tight leading-none">
            {lockerSummary.retiredCount}{" "}
            <span className="text-xs font-normal text-muted-foreground font-sans">
              pares
            </span>
          </span>
        </div>
      </div>

      {/* ── Tabs & Category Filters ────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
          {/* Active vs Retired Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-card border border-border">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "active"
                  ? "bg-surface-container-high text-primary shadow-xs"
                  : "text-muted-foreground hover:text-white",
              )}
            >
              En Rotación ({activeShoes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("retired")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "retired"
                  ? "bg-surface-container-high text-primary shadow-xs"
                  : "text-muted-foreground hover:text-white",
              )}
            >
              Retiradas ({retiredShoes.length})
            </button>
          </div>

          <span className="text-xs font-semibold text-muted-foreground">
            Mostrando {displayShoes.length}{" "}
            {displayShoes.length === 1 ? "zapatilla" : "zapatillas"}
          </span>
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setCategory(filter.value)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer border",
                category === filter.value
                  ? "bg-surface-container-high text-primary border-border shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:bg-surface-container-high hover:text-white",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Grid ───────────────────────────────────────────── */}
      {shoesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-56 w-full rounded-2xl bg-surface-container-high/80"
            />
          ))}
        </div>
      ) : shoesQuery.isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center bg-card border border-border rounded-3xl p-8">
          <div className="rounded-2xl bg-surface-container-high/80 p-4">
            <RefreshCw className="size-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-white">
            No pudimos cargar tus zapatillas
          </h3>
          <p className="text-xs text-muted-foreground">
            Verificá que la conexión al servidor esté disponible.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 bg-surface-container-high border-border text-muted-foreground hover:text-white rounded-xl"
            onClick={() => shoesQuery.refetch()}
          >
            <RefreshCw className="mr-2 size-4" /> Reintentar
          </Button>
        </div>
      ) : displayShoes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center bg-card border border-border rounded-3xl p-8 shadow-card">
          <div className="rounded-2xl bg-primary/15 text-primary border border-primary/30 p-4">
            <Footprints className="size-8" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {activeTab === "active"
              ? "Todavía no tenés zapatillas activas en rotación"
              : "No hay zapatillas en el archivo de retiradas"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {activeTab === "active"
              ? "Agregá tu primera zapatilla o importá tu equipamiento desde Strava Gear para calcular la salud de la espuma."
              : "Las zapatillas que marques como inactivas aparecerán aquí."}
          </p>
          {activeTab === "active" && (
            <Button
              type="button"
              className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20 rounded-xl cursor-pointer"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="mr-2 size-4 stroke-[3]" /> Registrar primera
              zapatilla
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayShoes.map((shoe) => (
            <div className="group relative" key={shoe.id}>
              <ShoeCard shoe={shoe} stats={statsMap.get(shoe.id)} />
              <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 opacity-100 transition-opacity group-hover:opacity-100 max-md:opacity-100 md:opacity-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar zapatilla"
                  className="size-8 rounded-xl bg-surface-container-high/90 border border-border text-muted-foreground hover:text-white hover:bg-surface-container-highest shadow-md cursor-pointer"
                  onClick={(event) => {
                    event.preventDefault()
                    setEditing(shoe)
                    setFormOpen(true)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Eliminar zapatilla"
                  className="size-8 rounded-xl bg-surface-container-high/90 border border-border text-destructive hover:text-destructive hover:bg-surface-container-highest shadow-md cursor-pointer"
                  disabled={deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault()
                    if (
                      window.confirm(
                        `¿Eliminás la zapatilla "${shoe.name}" del registro?`,
                      )
                    ) {
                      deleteMutation.mutate(shoe.id)
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ShoeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        shoe={editing}
      />
    </div>
  )
}
