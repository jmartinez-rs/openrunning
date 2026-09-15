import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"

import { type SyncLogPublic, SyncService } from "@/client"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function statusBadge(status: string) {
  if (status === "success")
    return <Badge className="bg-domain-success">Éxito</Badge>
  if (status === "partial") return <Badge variant="secondary">Parcial</Badge>
  if (status === "running") return <Badge variant="outline">En curso</Badge>
  return <Badge variant="destructive">Error</Badge>
}

export function SyncLog() {
  const logsQuery = useQuery({
    queryKey: ["sync-logs"],
    queryFn: () => SyncService.readSyncLogs({ limit: 10 }),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de sincronización</CardTitle>
        <CardDescription>
          Últimas ejecuciones de sync por proveedor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logsQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton className="h-12 w-full" key={index} />
            ))}
          </div>
        ) : logsQuery.data?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <History className="mb-2 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Todavía no hay sincronizaciones registradas.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {(logsQuery.data?.data ?? []).map((log: SyncLogPublic) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">
                    {log.provider}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {String(log.details?.message ?? "")} ·{" "}
                    {formatDateTime(log.started_at)}
                  </p>
                </div>
                {statusBadge(log.status)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
