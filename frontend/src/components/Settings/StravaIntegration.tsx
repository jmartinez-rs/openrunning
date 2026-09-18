import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Footprints, Loader2, Unplug } from "lucide-react"
import { useState } from "react"

import {
  AuthService,
  SettingsService,
  type StravaCredentialsIn,
} from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SettingsRow } from "./SettingsSection"

export function StravaIntegration() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const statusQuery = useQuery({
    queryKey: ["integration-status", "strava"],
    queryFn: () =>
      SettingsService.readIntegrationStatus({ provider: "strava" }),
  })

  const connected = statusQuery.data?.connected ?? false
  const [showManualForm, setShowManualForm] = useState(!connected)

  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")

  const saveMutation = useMutation({
    mutationFn: (data: StravaCredentialsIn) =>
      SettingsService.saveStravaCredentials({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Credenciales de Strava guardadas y conectadas")
      queryClient.invalidateQueries({
        queryKey: ["integration-status", "strava"],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const testMutation = useMutation({
    mutationFn: () => SettingsService.testIntegration({ provider: "strava" }),
    onSuccess: (result) => {
      if (result.success) {
        showSuccessToast(result.message)
      } else {
        showErrorToast(result.message)
      }
      queryClient.invalidateQueries({
        queryKey: ["integration-status", "strava"],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const disconnectMutation = useMutation({
    mutationFn: () =>
      SettingsService.disconnectIntegration({ provider: "strava" }),
    onSuccess: () => {
      showSuccessToast("Strava desconectado")
      queryClient.invalidateQueries({
        queryKey: ["integration-status", "strava"],
      })
    },
    onError: handleError.bind(showErrorToast),
  })

  const oauthMutation = useMutation({
    mutationFn: () => AuthService.startStravaAuth(),
    onSuccess: (data) => {
      const url = data?.url
      if (url) {
        window.location.href = url
      } else {
        showErrorToast("No se pudo iniciar la conexión con Strava")
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveMutation.mutate({
      client_id: clientId || null,
      client_secret: clientSecret || null,
      access_token: accessToken || null,
      refresh_token: refreshToken || null,
    })
  }

  return (
    <>
      <SettingsRow
        icon={Footprints}
        iconBg="bg-orange-500/15"
        iconColor="text-orange-400"
        title="Strava"
        subtitle="Sincronizar carreras y actividades de cardio automáticamente"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {statusQuery.isLoading ? (
            <Loader2 className="size-4 animate-spin text-slate-500" />
          ) : (
            <>
              {connected && (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                  Conectado
                </span>
              )}
              <Button
                type="button"
                size="sm"
                disabled={oauthMutation.isPending}
                onClick={() => oauthMutation.mutate()}
                className="h-8 rounded-xl bg-orange-500 text-slate-950 font-bold text-xs hover:bg-orange-400 cursor-pointer"
              >
                {oauthMutation.isPending ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1.5 size-3.5" />
                )}
                {connected ? "Re-conectar OAuth" : "Conectar con OAuth"}
              </Button>
              {connected && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testMutation.isPending}
                    onClick={() => testMutation.mutate()}
                    className="h-8 rounded-xl border-slate-800 text-xs text-slate-300"
                  >
                    {testMutation.isPending && (
                      <Loader2 className="mr-1 size-3 animate-spin" />
                    )}
                    Probar Conexión
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-xl text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnectMutation.mutate()}
                  >
                    <Unplug className="size-3.5" />
                  </Button>
                </>
              )}
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowManualForm(!showManualForm)}
            className="h-8 px-2 text-xs text-slate-400 hover:text-slate-200"
          >
            {showManualForm ? "Ocultar Campos" : "Credenciales API"}
          </Button>
        </div>
      </SettingsRow>

      {(!connected || showManualForm) && (
        <div className="p-4 bg-slate-950/60 border-t border-slate-800/60 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Credenciales de Aplicación Strava API
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ingresá tus credenciales de Strava Developer para vincular y
                sincronizar la app.
              </p>
            </div>
            {!connected && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={oauthMutation.isPending}
                onClick={() => oauthMutation.mutate()}
                className="h-7 text-[11px] rounded-lg border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
              >
                <ExternalLink className="mr-1 size-3" /> Conexión directa OAuth
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-orange-500/30 bg-orange-950/30 p-3 text-xs text-orange-200 flex flex-col gap-1">
            <p className="font-bold flex items-center gap-1.5 text-orange-400">
              <ExternalLink className="size-3.5 shrink-0" />
              Paso Requerido para Autorización de Carreras
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Luego de guardar tu <strong>Client ID</strong> y{" "}
              <strong>Client Secret</strong>, hacé clic en el botón naranja{" "}
              <strong>"Conectar con OAuth"</strong> para autorizar en Strava el
              permiso de lectura de carreras (<code>activity:read</code>).
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-semibold">
                  Client ID *
                </label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Ej: 123456"
                  className="h-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-slate-200 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-semibold">
                  Client Secret *
                </label>
                <PasswordInput
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Secreto de aplicación"
                  className="h-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-slate-200 focus:border-orange-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">
                  Access Token (opcional)
                </label>
                <PasswordInput
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Access Token de la API"
                  className="h-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-slate-200 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">
                  Refresh Token (opcional)
                </label>
                <PasswordInput
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  placeholder="Refresh Token de la API"
                  className="h-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-slate-200 focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={
                  saveMutation.isPending ||
                  (!clientId && !clientSecret && !accessToken)
                }
                className="h-9 px-4 rounded-xl bg-orange-500 text-slate-950 font-bold text-xs hover:bg-orange-400 cursor-pointer shadow-md shadow-orange-500/20"
              >
                {saveMutation.isPending && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Guardar Credenciales y Conectar
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
