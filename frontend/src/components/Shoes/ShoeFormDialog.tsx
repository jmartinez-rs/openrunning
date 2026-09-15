import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, X } from "lucide-react"
import { useState } from "react"

import {
  type ApiError,
  type ShoePublic,
  ShoesService,
  StorageService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SHOE_CATEGORIES } from "./shoe-utils"

interface ShoeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shoe?: ShoePublic | null
}

export function ShoeFormDialog({
  open,
  onOpenChange,
  shoe,
}: ShoeFormDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [name, setName] = useState(shoe?.name ?? "")
  const [brand, setBrand] = useState(shoe?.brand ?? "")
  const [model, setModel] = useState(shoe?.model ?? "")
  const [category, setCategory] = useState<ShoePublic["category"]>(
    shoe?.category ?? "training",
  )
  const [purchaseDate, setPurchaseDate] = useState(
    shoe?.purchase_date ? shoe.purchase_date.slice(0, 10) : "",
  )
  const [targetDistanceKm, setTargetDistanceKm] = useState(
    shoe?.target_distance_km != null ? String(shoe.target_distance_km) : "",
  )
  const [color, setColor] = useState(shoe?.color ?? "")
  const [photoUrl, setPhotoUrl] = useState(shoe?.photo_url ?? "")
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState(shoe?.notes ?? "")
  const [isActive, setIsActive] = useState(shoe?.is_active ?? true)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        category,
        purchase_date: purchaseDate
          ? new Date(`${purchaseDate}T12:00:00`).toISOString()
          : null,
        target_distance_km: targetDistanceKm ? Number(targetDistanceKm) : null,
        color: color.trim() || null,
        photo_url: photoUrl || null,
        notes: notes.trim() || null,
        is_active: isActive,
      }

      if (shoe) {
        return ShoesService.updateShoe({
          shoeId: shoe.id,
          requestBody: payload,
        })
      }
      return ShoesService.createShoe({
        requestBody: payload as {
          name: string
          category: "training" | "race" | "trail" | "easy" | "mixed"
          brand?: string | null
          model?: string | null
          purchase_date?: string | null
          target_distance_km?: number | null
          color?: string | null
          photo_url?: string | null
          notes?: string | null
          is_active?: boolean
        },
      })
    },
    onSuccess: () => {
      showSuccessToast(shoe ? "Zapatilla actualizada" : "Zapatilla registrada")
      queryClient.invalidateQueries({ queryKey: ["shoes"] })
      if (shoe) {
        queryClient.invalidateQueries({ queryKey: ["shoe", shoe.id] })
        queryClient.invalidateQueries({ queryKey: ["shoe-stats", shoe.id] })
      }
      onOpenChange(false)
    },
    onError: handleError.bind(showErrorToast),
  })

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await StorageService.uploadFile({
        formData: { file: file as unknown as string },
      })
      const url = String((result as Record<string, string>).url ?? "")
      if (url) setPhotoUrl(url)
    } catch (error) {
      handleError.bind(showErrorToast)(error as ApiError)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {shoe ? "Editar zapatilla" : "Registrar zapatilla"}
          </DialogTitle>
          <DialogDescription>
            Cargá los datos de tu calzado para trackear el desgaste.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shoe-name">Nombre *</Label>
            <Input
              id="shoe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Nike Pegasus 41"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shoe-brand">Marca</Label>
              <Input
                id="shoe-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ej: Nike"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shoe-model">Modelo</Label>
              <Input
                id="shoe-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ej: Pegasus 41"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shoe-category">Categoría</Label>
            <select
              id="shoe-category"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ShoePublic["category"])
              }
            >
              {SHOE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shoe-purchase">Fecha de compra</Label>
              <Input
                id="shoe-purchase"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shoe-target">Vida útil (km)</Label>
              <Input
                id="shoe-target"
                type="number"
                step="10"
                value={targetDistanceKm}
                onChange={(e) => setTargetDistanceKm(e.target.value)}
                placeholder="Ej: 800"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shoe-color">Color</Label>
            <Input
              id="shoe-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ej: #e11d48"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Foto</Label>
            {photoUrl ? (
              <div className="relative inline-block h-24 w-24 overflow-hidden rounded-lg border">
                <img
                  src={photoUrl}
                  alt="Foto de la zapatilla"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  onClick={() => setPhotoUrl("")}
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ImagePlus className="size-5" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadPhoto}
                />
              </label>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shoe-notes">Notas</Label>
            <textarea
              id="shoe-notes"
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sensaciones, uso habitual..."
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
            <div>
              <Label htmlFor="shoe-active">Activa</Label>
              <p className="text-body-md text-on-surface-variant">
                Zapatilla en uso actual
              </p>
            </div>
            <Switch
              id="shoe-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
