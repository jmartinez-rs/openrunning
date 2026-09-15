import { useEffect } from "react"

import useCustomToast from "@/hooks/useCustomToast"
import { HevyIntegration } from "./HevyIntegration"
import { StravaIntegration } from "./StravaIntegration"
import { SyncLog } from "./SyncLog"
import { SyncManager } from "./SyncManager"
import { SyncScheduleSettings } from "./SyncScheduleSettings"

export function IntegrationsSettings() {
  const { showSuccessToast, showErrorToast } = useCustomToast()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const stravaStatus = params.get("strava")
    if (stravaStatus === "connected") {
      showSuccessToast("Strava conectado correctamente")
    } else if (stravaStatus === "error") {
      showErrorToast("No se pudo conectar con Strava")
    }
    if (stravaStatus) {
      window.history.replaceState({}, "", window.location.pathname)
    }
  }, [showSuccessToast, showErrorToast])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-title-lg text-primary">Integraciones</h3>
        <p className="text-body-md text-on-surface-variant">
          Conectá tu cuenta de Strava para sincronizar tus carreras automáticamente.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <StravaIntegration />
        <HevyIntegration />
      </div>
      <SyncManager />
      <SyncScheduleSettings />
      <SyncLog />
    </div>
  )
}
