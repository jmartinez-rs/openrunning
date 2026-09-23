import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Footprints, RefreshCw, Upload } from "lucide-react"
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

interface RunActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Acción principal "RUN": registrar / importar una actividad.
 * Reutiliza la lógica existente (QuickCreateActivityDialog, upload .FIT/.GPX
 * y sync Strava & Hevy) sin crear flujos nuevos.
 */
export function RunActionSheet({ open, onOpenChange }: RunActionSheetProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [manualRunOpen, setManualRunOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    onOpenChange(false)
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
      onOpenChange(false)
    },
    onError: (err: any) => {
      showErrorToast(err.message || "Error al sincronizar")
    },
  })

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-border bg-background p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-lg mx-auto"
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
                onOpenChange(false)
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
    </>
  )
}
