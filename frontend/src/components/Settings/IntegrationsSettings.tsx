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
    <>
      <StravaIntegration />
      <HevyIntegration />
      <SyncManager />
      <SyncScheduleSettings />
      <SyncLog />
    </>
  )
}
