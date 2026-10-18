import { expect, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"

async function ensureActivity(page: import("@playwright/test").Page) {
  // Si no hay actividades, crea una vía API usando el token del localStorage.
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  if (!token) throw new Error("No hay token de sesión")
  const response = await page.request.get("/api/v1/activities/?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await response.json()) as { count: number }
  if (data.count > 0) return
  await page.request.post("/api/v1/activities/", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      source_id: `e2e-${Date.now()}`,
      source_type: "strava",
      timestamp: new Date().toISOString(),
      duration_seconds: 1800,
      name: "Actividad E2E",
      cardio: { distance_meters: 5000, avg_pace_seconds_per_km: 360 },
    },
  })
}

/** Crea una actividad en un instante exacto (sport_type nulo ⇒ cuenta, R7). */
async function seedRunAt(
  page: import("@playwright/test").Page,
  timestampIso: string,
) {
  const token = await page.evaluate(() => localStorage.getItem("access_token"))
  if (!token) throw new Error("No hay token de sesión")
  const response = await page.request.post("/api/v1/activities/", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      source_id: `e2e-activity-mark-${Date.now()}`,
      source_type: "strava",
      timestamp: timestampIso,
      duration_seconds: 1800,
      name: "Run E2E marca",
      cardio: { distance_meters: 5000, avg_pace_seconds_per_km: 360 },
    },
  })
  if (!response.ok()) {
    throw new Error(`No se pudo crear la actividad: ${response.status()}`)
  }
}

test.describe("Dashboard", () => {
  test("muestra KPIs y timeline semanal", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible()
    await expect(page.getByText("Distancia cardio")).toBeVisible()
    await expect(page.getByText("Volumen de fuerza")).toBeVisible()
    await expect(page.getByText("Timeline semanal")).toBeVisible()
  })

  test("navega al detalle de una actividad desde el dashboard", async ({
    page,
  }) => {
    await page.goto("/")
    await ensureActivity(page)
    await page.reload()
    await expect(page.getByText("Timeline semanal")).toBeVisible()
    // La primera actividad del timeline debe ser clicable.
    const activityLink = page.locator('a[href*="/activities/"]').first()
    await expect(activityLink).toBeVisible()
    await activityLink.click()
    await page.waitForURL(/\/activities\/[0-9a-f-]+/)
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toHaveCount(0)
  })
})

// No bloqueante: requiere el stack completo (Docker + .env raíz), por lo que no
// forma parte del gate de cobertura. Cubre S1/E1/E9: el reloj fijo evita que la
// marca caiga en el día UTC equivocado en el límite de la semana local.
test.describe("Dashboard — marca de actividad (no bloqueante)", () => {
  test("marca la actividad en el día local límite de la semana", async ({
    page,
  }) => {
    // 21:30 del domingo 2026-03-15 en UTC-3 (= 2026-03-16T00:30Z; en UTC ya es lunes).
    await page.clock.setFixedTime(new Date("2026-03-16T00:30:00Z"))
    await page.goto("/")
    // 21:00 local del 2026-03-15: debe bucketizar al 2026-03-15, no al lunes.
    await seedRunAt(page, "2026-03-16T00:00:00Z")
    await page.reload()
    await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible()
    await expect(
      page.locator('[data-day="2026-03-15"] [data-activity="true"]'),
    ).toBeVisible()
  })
})

test.describe("Carreras", () => {
  test("crea una carrera y la ve en el muro", async ({ page }) => {
    await page.goto("/races")
    await expect(page.getByRole("heading", { name: "Carreras" })).toBeVisible()
    await page.getByRole("button", { name: "Nueva carrera" }).click()
    const eventName = `Carrera E2E ${Date.now()}`
    await page.getByLabel("Evento").fill(eventName)
    await page.getByLabel("Distancia (km)").fill("10")
    await page.getByLabel("Tiempo oficial (mm:ss)").fill("40:00")
    await page.getByRole("button", { name: "Guardar" }).click()
    await expect(page.getByText(eventName)).toBeVisible()
    // Abre el detalle.
    await page.getByText(eventName).click()
    await page.waitForURL(/\/races\/[0-9a-f-]+/)
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible()
  })
})

test.describe("Login", () => {
  test("login correcto con superusuario", async ({ page }) => {
    await page.goto("/login")
    await page.getByTestId("email-input").fill(firstSuperuser)
    await page.getByTestId("password-input").fill(firstSuperuserPassword)
    await page.getByRole("button", { name: "Iniciar sesión" }).click()
    await page.waitForURL("/")
    await expect(page.getByRole("heading", { name: /Hola/ })).toBeVisible()
  })
})
