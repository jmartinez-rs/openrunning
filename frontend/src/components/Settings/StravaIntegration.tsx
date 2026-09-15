import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Loader2 } from "lucide-react"
import { useState } from "react"

import {
  AuthService,
  SettingsService,
  type StravaCredentialsIn,
} from "@/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { IntegrationCard } from "./IntegrationCard"

export function StravaIntegration() {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")

  const mutation = useMutation({
    mutationFn: (data: StravaCredentialsIn) =>
      SettingsService.saveStravaCredentials({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("Credenciales de Strava guardadas")
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
    mutation.mutate({
      client_id: clientId || null,
      client_secret: clientSecret || null,
      access_token: accessToken || null,
      refresh_token: refreshToken || null,
    })
  }

  return (
    <IntegrationCard
      provider="strava"
      title="Strava"
      description="Conectá tu cuenta para sincronizar tus salidas con el permiso correcto."
    >
      <div className="rounded-md border bg-muted/40 px-3 py-3">
        <p className="text-sm font-medium">Conexión automática</p>
        <p className="mt-1 text-xs text-muted-foreground">
          La forma recomendada: te redirige a Strava para autorizar la app con
          los scopes <code>activity:read</code> y <code>profile:read_all</code>.
          Los tokens del panel de Strava siempre tienen solo <code>read</code>.
        </p>
        <Button
          type="button"
          className="mt-3 w-full"
          disabled={oauthMutation.isPending}
          onClick={() => oauthMutation.mutate()}
        >
          {oauthMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 size-4" />
          )}
          Conectar con Strava
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Requiere registrar la URL de redirección en tu app de Strava:
          <code className="block break-all">
            http://localhost:18000/api/v1/auth/strava/callback
          </code>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          o configuración manual
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strava-client-id">Client ID</Label>
            <Input
              id="strava-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="ID de la aplicación"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="strava-client-secret">Client Secret</Label>
            <PasswordInput
              id="strava-client-secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Secreto de la aplicación"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strava-access-token">Access Token</Label>
          <PasswordInput
            id="strava-access-token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Token de acceso (opcional)"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="strava-refresh-token">Refresh Token</Label>
          <PasswordInput
            id="strava-refresh-token"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Token de refresco (opcional)"
            autoComplete="off"
          />
        </div>
        <div className="pt-1">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar credenciales
          </Button>
        </div>
      </form>
    </IntegrationCard>
  )
}
