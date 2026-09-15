import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { useState } from "react"

import { type ShoePublic, ShoesService } from "@/client"
import { ShoeCard } from "@/components/Shoes/ShoeCard"
import { ShoeFormDialog } from "@/components/Shoes/ShoeFormDialog"
import { SHOE_CATEGORIES } from "@/components/Shoes/shoe-utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

export const Route = createFileRoute("/_layout/shoes/")({
  component: Shoes,
  head: () => ({ meta: [{ title: "Calzado - OpenRunning" }] }),
})

const CATEGORY_FILTERS = [
  { label: "Todas", value: "" },
  ...SHOE_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
]

function Shoes() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [category, setCategory] = useState("")
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

  const statsMap = new Map(
    shoes.map((shoe, i) => [shoe.id, statsQueries[i]?.data]),
  )

  const importMutation = useMutation({
    mutationFn: () => ShoesService.importStravaShoes(),
    onSuccess: (result) => {
      showSuccessToast(result.message ?? "Importación completada")
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-lg text-primary">Calzado</h1>
          <p className="text-body-md text-on-surface-variant">
            Tus zapatillas y el desgaste de cada una.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            disabled={importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            Importar desde Strava
          </Button>
          <Button
            type="button"
            className="rounded-lg bg-primary text-primary-foreground"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="mr-2 size-4" /> Nueva zapatilla
          </Button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setCategory(filter.value)}
            className={
              category === filter.value
                ? "rounded-lg bg-primary px-4 py-1.5 text-label-sm text-primary-foreground shadow-sm transition-all"
                : "rounded-lg bg-surface-container-low px-4 py-1.5 text-label-sm text-on-surface-variant transition-colors hover:text-primary"
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {shoesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl sm:h-52" />
          ))}
        </div>
      ) : shoesQuery.isError ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-surface-container-low p-4">
            <RefreshCw className="size-8 text-primary" />
          </div>
          <h3 className="text-title-lg text-primary">
            No pudimos cargar tus zapatillas
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Verificá que el backend esté disponible.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 rounded-lg"
            onClick={() => shoesQuery.refetch()}
          >
            <RefreshCw className="mr-2 size-4" /> Reintentar
          </Button>
        </div>
      ) : shoes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-surface-container-low p-4">
            <RefreshCw className="size-8 text-primary" />
          </div>
          <h3 className="text-title-lg text-primary">
            Todavía no registraste zapatillas
          </h3>
          <p className="text-body-md text-on-surface-variant">
            Agregá tu primera zapatilla para trackear el desgaste.
          </p>
          <Button
            type="button"
            className="mt-2 rounded-lg bg-primary text-primary-foreground"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="mr-2 size-4" /> Agregar zapatilla
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shoes.map((shoe) => (
            <div className="group relative" key={shoe.id}>
              <ShoeCard shoe={shoe} stats={statsMap.get(shoe.id)} />
              <div className="absolute right-3 top-3 z-10 hidden items-center gap-1 group-hover:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg bg-card shadow-sm"
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
                  size="icon"
                  className="size-8 rounded-lg bg-card shadow-sm"
                  disabled={deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault()
                    deleteMutation.mutate(shoe.id)
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
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
