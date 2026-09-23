import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Footprints, ImagePlus, Loader2, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import {
  type ApiError,
  type ShoePublic,
  ShoesService,
  StorageService,
} from "@/client"
import { Stepper } from "@/components/ui/Stepper"
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
  const [targetDistanceKm, setTargetDistanceKm] = useState<number>(
    shoe?.target_distance_km ?? 700,
  )
  const [color, setColor] = useState(shoe?.color ?? "")
  const [photoUrl, setPhotoUrl] = useState(shoe?.photo_url ?? "")
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState(shoe?.notes ?? "")
  const [isActive, setIsActive] = useState(shoe?.is_active ?? true)

  useEffect(() => {
    if (open) {
      setName(shoe?.name ?? "")
      setBrand(shoe?.brand ?? "")
      setModel(shoe?.model ?? "")
      setCategory(shoe?.category ?? "training")
      setPurchaseDate(
        shoe?.purchase_date ? shoe.purchase_date.slice(0, 10) : "",
      )
      setTargetDistanceKm(shoe?.target_distance_km ?? 700)
      setColor(shoe?.color ?? "")
      setPhotoUrl(shoe?.photo_url ?? "")
      setNotes(shoe?.notes ?? "")
      setIsActive(shoe?.is_active ?? true)
    }
  }, [open, shoe])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
      }
    }
    if (open) {
      window.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [open, onOpenChange])

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
        target_distance_km: targetDistanceKm || 700,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || mutation.isPending) return
    mutation.mutate()
  }

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div className="w-full max-w-lg md:max-w-2xl lg:max-w-3xl bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-card max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <Footprints className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {shoe ? "Editar Zapatilla" : "Registrar Nueva Zapatilla"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Seguimiento de amortiguación y salud de espuma
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-xl bg-surface-container-high text-muted-foreground hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body: 2 columns on tablet/desktop (md+) */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Columna Izquierda: Datos principales y vida útil */}
            <div className="space-y-3.5">
              {/* Nombre */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Nombre / Apodo <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Rodadoras Diarias / Pegasus 41"
                  className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary"
                />
              </div>

              {/* Marca & Modelo */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ej: Nike, Hoka"
                    className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ej: Vaporfly 3"
                    className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Categoría & Uso Recomendado
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ShoePublic["category"])
                  }
                  className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary cursor-pointer"
                >
                  {SHOE_CATEGORIES.map((cat) => (
                    <option
                      key={cat.value}
                      value={cat.value}
                      className="bg-card text-white py-1"
                    >
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha de compra y Stepper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Fecha de compra
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <Stepper
                  label="Vida útil estimada"
                  value={targetDistanceKm}
                  onChange={setTargetDistanceKm}
                  step={50}
                  min={100}
                  max={2000}
                  unit="km"
                  decimals={0}
                />
              </div>
            </div>

            {/* Columna Derecha: Color, Foto, Notas y Estado */}
            <div className="space-y-3.5 flex flex-col justify-between">
              {/* Color Distintivo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Color distintivo (Hexadecimal o nombre)
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Ej: #10b981 o Verde Neón"
                  className="w-full bg-surface-container-high border border-border rounded-xl px-3 py-2 text-sm text-white font-medium focus:outline-none focus:border-primary"
                />
              </div>

              {/* Foto de la zapatilla */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Foto de la zapatilla
                </label>
                {photoUrl ? (
                  <div className="relative inline-block h-20 w-20 overflow-hidden rounded-xl border border-border bg-surface-container-high">
                    <img
                      src={photoUrl}
                      alt="Foto de la zapatilla"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-card/80 p-1 text-white hover:bg-card cursor-pointer"
                      onClick={() => setPhotoUrl("")}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-16 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high hover:text-white transition-colors">
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <ImagePlus className="size-4 text-primary" />
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

              {/* Notas */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Notas y sensaciones
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Calzado reservado únicamente para ritmos de umbral..."
                  className="w-full bg-surface-container-high border border-border rounded-xl p-2.5 text-sm text-white placeholder:text-on-surface-variant focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Par en rotación activa */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-container-high/40 p-2.5 w-full">
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs sm:text-sm text-white block truncate">
                    Par en rotación activa
                  </span>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Al desmarcarla, pasa al armario de retiradas.
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-card shadow-primary/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3]" />
              )}
              {shoe ? "Actualizar Zapatilla" : "Guardar Zapatilla"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
