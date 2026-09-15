import { createFileRoute } from "@tanstack/react-router"

import { IntegrationsSettings } from "@/components/Settings/IntegrationsSettings"
import { WeeklyGoals } from "@/components/Settings/WeeklyGoals"
import { WeeklyPlan } from "@/components/Settings/WeeklyPlan"
import ChangePassword from "@/components/UserSettings/ChangePassword"
import DeleteAccount from "@/components/UserSettings/DeleteAccount"
import UserInformation from "@/components/UserSettings/UserInformation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useAuth from "@/hooks/useAuth"

const tabsConfig = [
  { value: "my-profile", title: "Mi perfil", component: UserInformation },
  { value: "password", title: "Contraseña", component: ChangePassword },
  {
    value: "integrations",
    title: "Integraciones",
    component: IntegrationsSettings,
  },
  { value: "goals", title: "Metas", component: WeeklyGoals },
  { value: "plan", title: "Plan", component: WeeklyPlan },
  { value: "danger-zone", title: "Zona de peligro", component: DeleteAccount },
]

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
  const finalTabs = currentUser?.is_superuser
    ? tabsConfig.slice(0, 3)
    : tabsConfig

  if (!currentUser) {
    return null
  }

  return (
    <div className="col-span-12 flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-primary">Ajustes del Sistema</h1>
        <p className="text-body-md text-on-surface-variant">
          Gestioná tu perfil, objetivos y preferencias de entrenamiento.
        </p>
      </div>

      <Tabs defaultValue="my-profile">
        <TabsList>
          {finalTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {finalTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <tab.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
