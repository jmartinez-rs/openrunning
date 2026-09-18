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
import { WeeklyPlan } from "@/components/Settings/WeeklyPlan"
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
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric")
  const [theme, setTheme] = useState<"dark" | "light">("dark")

  if (!currentUser) {
    return null
  }

  return (
    <div className="col-span-12 flex flex-col gap-6 pb-12">
      {/* Header section — OpenGym style */}
      <div className="border-b border-slate-800/80 pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-slate-400">
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
          iconBg="bg-blue-500/15"
          iconColor="text-blue-400"
          title="Idioma principal"
          value="Español (AR)"
        />
        <SettingsRow
          icon={Scale}
          iconBg="bg-teal-500/15"
          iconColor="text-teal-400"
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
          iconBg="bg-purple-500/15"
          iconColor="text-purple-400"
          title="Apariencia"
        >
          <SettingsSegmented
            options={[
              { value: "dark", label: "Oscuro" },
              { value: "light", label: "Claro" },
            ]}
            value={theme}
            onChange={setTheme}
          />
        </SettingsRow>
      </SettingsSection>

      {/* Section 3: Integrations */}
      <SettingsSection
        title="Integraciones & Sincronización"
        footer="Conectá tus cuentas de Strava y Hevy para importar automáticamente tus actividades."
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

      {/* Section 5: Weekly Plan */}
      {!currentUser.is_superuser && (
        <SettingsSection
          title="Plan Semanal"
          footer="Estructura de días de entrenamiento de running y fuerza."
        >
          <WeeklyPlan />
        </SettingsSection>
      )}

      {/* Section 6: Danger Zone */}
      {!currentUser.is_superuser && (
        <SettingsSection title="Zona de Peligro">
          <DeleteAccount />
        </SettingsSection>
      )}
    </div>
  )
}
