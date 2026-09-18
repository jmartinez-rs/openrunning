import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Footprints, ImagePlus, Loader2, X } from "lucide-react"
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
    shoe?.target_distance_km != null ? String(shoe.target_distance_km) : "700",
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
        target_distance_km: targetDistanceKm ? Number(targetDistanceKm) : 700,
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
      <DialogContent className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-slate-900 border-slate-800 text-white shadow-2xl rounded-2xl">
        <DialogHeader className="pr-6">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-white">
            <Footprints className="size-5 text-emerald-400 shrink-0" />
            {shoe ? "Editar Zapatilla" : "Registrar Nueva Zapatilla"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            Ingresá los detalles del calzado para el cálculo de desgaste y
            algoritmo Runna.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2 w-full min-w-0">
          <div className="flex flex-col gap-1.5 w-full">
            <Label
              htmlFor="shoe-name"
              className="text-xs font-semibold text-slate-300"
            >
              Nombre / Apodo *
            </Label>
            <Input
              id="shoe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Rodadoras Diarias / Pegasus 41"
              className="w-full bg-slate-800 border-slate-700 text-white focus:border-emerald-500 rounded-xl"
            />
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 w-full">
            <div className="flex flex-col gap-1.5 w-full">
              <Label
                htmlFor="shoe-brand"
                className="text-xs font-semibold text-slate-300"
              >
                Marca
              </Label>
              <Input
                id="shoe-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ej: Nike, Hoka, Asics"
                className="w-full bg-slate-800 border-slate-700 text-white focus:border-emerald-500 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <Label
                htmlFor="shoe-model"
                className="text-xs font-semibold text-slate-300"
              >
                Modelo
              </Label>
              <Input
                id="shoe-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ej: Vaporfly NEXT% 3"
                className="w-full bg-slate-800 border-slate-700 text-white focus:border-emerald-500 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <Label
              htmlFor="shoe-category"
              className="text-xs font-semibold text-slate-300"
            >
              Categoría & Uso Recomendado
            </Label>
            <select
              id="shoe-category"
              className="w-full max-w-full truncate rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white font-medium focus:border-emerald-500 focus:outline-none cursor-pointer"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ShoePublic["category"])
              }
            >
              {SHOE_CATEGORIES.map((cat) => (
                <option
                  key={cat.value}
                  value={cat.value}
                  className="bg-slate-900 text-white py-1"
                >
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 w-full">
            <div className="flex flex-col gap-1.5 w-full">
              <Label
                htmlFor="shoe-purchase"
                className="text-xs font-semibold text-slate-300"
              >
                Fecha de compra
              </Label>
              <Input
                id="shoe-purchase"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-slate-800 border-slate-700 text-white focus:border-emerald-500 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <Label
                htmlFor="shoe-target"
                className="text-xs font-semibold text-slate-300"
              >
                Vida útil estimada (km)
              </Label>
              <Input
                id="shoe-target"
                type="number"
                step="50"
                value={targetDistanceKm}
                onChange={(e) => setTargetDistanceKm(e.target.value)}
                placeholder="Ej: 700"
                className="w-full bg-slate-800 border-slate-700 text-white font-extrabold focus:border-emerald-500 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <Label
              htmlFor="shoe-color"
              className="text-xs font-semibold text-slate-300"
            >
              Color distintivo (Hexadecimal)
            </Label>
            <Input
              id="shoe-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ej: #10b981 o #f59e0b"
              className="w-full bg-slate-800 border-slate-700 text-white focus:border-emerald-500 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <Label className="text-xs font-semibold text-slate-300">
              Foto de la zapatilla
            </Label>
            {photoUrl ? (
              <div className="relative inline-block h-28 w-28 overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                <img
                  src={photoUrl}
                  alt="Foto de la zapatilla"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-white hover:bg-slate-900"
                  onClick={() => setPhotoUrl("")}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-24 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin text-emerald-400" />
                ) : (
                  <ImagePlus className="size-5 text-emerald-400" />
                )}
                <span className="text-xs font-semibold">
                  Subir foto de calzado
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadPhoto}
                />
              </label>
            )}
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <Label
              htmlFor="shoe-notes"
              className="text-xs font-semibold text-slate-300"
            >
              Notas y sensaciones
            </Label>
            <textarea
              id="shoe-notes"
              className="flex min-h-20 w-full max-w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Calzado reservado únicamente para ritmos de umbral y series en pista..."
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3.5 sm:p-4 w-full">
            <div className="min-w-0 flex-1">
              <Label
                htmlFor="shoe-active"
                className="font-bold text-sm text-white block truncate"
              >
                Par en rotación activa
              </Label>
              <p className="text-xs text-slate-400 truncate">
                Al desmarcarla, se moverá al armario de retiradas.
              </p>
            </div>
            <Switch
              id="shoe-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              className="shrink-0"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-slate-800 pt-4 mt-2 flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-500/20 rounded-xl cursor-pointer"
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar Zapatilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
