import { useQuery } from "@tanstack/react-query"
import { History, Loader2 } from "lucide-react"

import { SyncService } from "@/client"
import { cn } from "@/lib/utils"
import { SettingsRow } from "./SettingsSection"

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function SyncLog() {
  const logsQuery = useQuery({
    queryKey: ["sync-logs"],
    queryFn: () => SyncService.readSyncLogs({ limit: 1 }),
  })

  if (logsQuery.isLoading) {
    return (
      <SettingsRow
        icon={History}
        iconBg="bg-slate-800/80"
        iconColor="text-slate-400"
        title="Última sincronización"
        subtitle="Cargando historial..."
        value={<Loader2 className="size-4 animate-spin text-slate-500" />}
      />
    )
  }

  const latest = logsQuery.data?.data?.[0]

  if (!latest) {
    return (
      <SettingsRow
        icon={History}
        iconBg="bg-slate-800/80"
        iconColor="text-slate-400"
        title="Última sincronización"
        subtitle="Sin registros aún"
      />
    )
  }

  const providerName =
    latest.provider.charAt(0).toUpperCase() + latest.provider.slice(1)
  const detailsMsg = String(latest.details?.message ?? "Sincronizado")
  const subtitle = `${providerName} · ${detailsMsg} · ${formatDateTime(latest.started_at)}`
  const isSuccess = latest.status === "success"
  const isRunning = latest.status === "running"

  return (
    <SettingsRow
      icon={History}
      iconBg="bg-slate-800/80"
      iconColor="text-slate-300"
      title="Última sincronización"
      subtitle={subtitle}
      value={
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-xs font-semibold",
            isSuccess
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : isRunning
                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                : "border-red-500/30 bg-red-500/10 text-red-400",
          )}
        >
          {isSuccess ? "Éxito" : isRunning ? "En curso" : "Error"}
        </span>
      }
    />
  )
}
