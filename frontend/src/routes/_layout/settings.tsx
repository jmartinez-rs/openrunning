import { createFileRoute } from "@tanstack/react-router"
import { Globe, Moon, Scale } from "lucide-react"
import { useState } from "react"
import { IntegrationsSettings } from "@/components/Settings/IntegrationsSettings"
import {
  SettingsRow,
  SettingsSection,
  SettingsSegmented,
} from "@/components/Settings/SettingsSection"
import { WeeklyGoals } from "@/components/Settings/WeeklyGoals"
import { useTheme } from "@/components/theme-provider"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserInformation from "@/components/UserSettings/UserInformation"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/settings")({
  component: UserSettings,
  head: () => ({
    meta: [
      {
        title: "Configuración - OpenRunning",
      },
    ],
  }),
})

function UserSettings() {
  const { user: currentUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric")

  if (!currentUser) {
    return null
  }

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-12">
      {/* Header section — Kinetic Volt style */}
      <div className="border-b border-border/80 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestioná tu perfil, preferencias del sistema, integraciones y
          objetivos.
        </p>
      </div>

      {/* Section 1: Account & Profile */}
      <SettingsSection
        title="Cuenta & Perfil"
        footer={`Sesión iniciada como ${currentUser.full_name || currentUser.email}${currentUser.is_superuser ? " (Administrador)" : ""}.`}
      >
        <UserInformation />
        <ChangePassword />
      </SettingsSection>

      {/* Section 2: Preferences & System */}
      <SettingsSection
        title="General & Apariencia"
        footer="Las preferencias de unidades se aplican en todas las métricas y resúmenes."
      >
        <SettingsRow
          icon={Globe}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          title="Idioma principal"
          value="Español (AR)"
        />
        <SettingsRow
          icon={Scale}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          title="Unidades de medida"
        >
          <SettingsSegmented
            options={[
              { value: "metric", label: "kg / km" },
              { value: "imperial", label: "lb / mi" },
            ]}
            value={unitSystem}
            onChange={setUnitSystem}
          />
        </SettingsRow>
        <SettingsRow
          icon={Moon}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          title="Apariencia"
        >
          <SettingsSegmented
            options={[
              { value: "dark", label: "Oscuro" },
              { value: "light", label: "Claro" },
            ]}
            value={theme === "system" ? "dark" : theme}
            onChange={(value) => setTheme(value)}
          />
        </SettingsRow>
      </SettingsSection>

      {/* Section 3: Gerenciar Treinamento (Paccer Mockup 19-perfil-conexcoes.png) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Gerenciar Treinamento
        </h2>
        <div className="rounded-2xl border border-border/80 bg-[#121214] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              Trocar treino atual
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Redefina seus objetivos ou prova alvo, criando um novo ciclo de treinamento personalizado.
            </p>
          </div>
          <a
            href="/routines/run/new"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-black hover:bg-primary/90 transition-all shrink-0"
          >
            Novo Treino
          </a>
        </div>
      </div>

      {/* Section 4: Integrations */}
      <SettingsSection
        title="Conexões & Sincronização"
        footer="Conectá tu cuenta de Strava para importar automáticamente tus actividades."
      >
        <IntegrationsSettings />
      </SettingsSection>

      {/* Section 4: Goals */}
      {!currentUser.is_superuser && (
        <SettingsSection
          title="Metas Semanales"
          footer="Objetivos para comparar con tu rendimiento semanal."
        >
          <WeeklyGoals />
        </SettingsSection>
      )}

      {/* Section 5: Danger Zone */}
      {!currentUser.is_superuser && (
        <SettingsSection title="Zona de Peligro">
          <DeleteAccount />
        </SettingsSection>
      )}
    </div>
  )
}
