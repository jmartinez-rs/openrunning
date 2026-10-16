# SPEC de implementación — Rediseño de la LECTURA de un plan (OpenRunning)

> **Para:** agente implementador. **Objetivo:** reemplazar la actual “pantalla de plan” (densa y con vistas duplicadas) por un **modelo de lectura único y jerárquico**: `Plan → Semana → Día → Sesión`.
> **Alcance:** solo **frontend** de lectura del plan. **No** cambia el backend, ni el motor de generación, ni el modelo de datos.
> **Contexto/evidencia:** `docs/EVALUACION_LECTURA_PLAN_RUNNA.md` (cómo lo lee Runna) y `docs/COMPARATIVA-RUNNA-vs-OPENRUNNING.md`.
> **Regla de oro:** identidad **Kinetic Volt** intacta. Adoptamos *patrones de estructura* (timeline, jerarquía, hitos, guía), **no** estética ni código de terceros.

---

## 0. TL;DR de cambios

| Acción | Elemento |
|---|---|
| **CREAR** | `PlanTimeline`, `PlanWeekOverviewCard`, `NextSessionCard`, `SessionCard` (unificada), `PlanGuideSheet`, `PlanMilestoneBadge` |
| **REFACTOR** | `RunningPlanDetail.tsx` (una sola lectura; menos cromo; deep links) |
| **ELIMINAR** | `WeekCarouselStrip` (desconectado de datos), la dualidad `paccer`/`expanded`, `PaccerSessionCard` **o** `WeekSessionCard` (elegir una) |
| **AÑADIR** (utils) | `buildWeeklyOverview`, `getNextWorkout`, `computeProgressToDate`, `getWeekStatus`, `computeWeeklyVolumeKm` en `running-utils.ts` |

---

## 1. Problema y objetivos

### 1.1 Problema actual (verificado en código)
- `RunningPlanDetail.tsx` (1001 líneas) tiene **dos vistas paralelas** con tarjetas distintas (`PaccerSessionCard` y `WeekSessionCard`) → dos gramáticas visuales.
- `WeekCarouselStrip` se genera con `Array.from({length: summary.weeks})` e `isCompleted = num < currentWeek` → **chips sin datos reales** (ni fecha, ni fase, ni estado).
- **No hay línea de tiempo del plan**; la vista por defecto muestra **una semana** → se pierde “dónde estoy”.
- **Cromo excesivo** (hero + 6 stats + 3 tabs) antes de ver una sesión.
- Sin **próxima sesión**, sin **hitos**, sin **guía del plan**.

### 1.2 Objetivos
1. **Lectura única jerárquica**: Overview → Semana → Día → Sesión.
2. **Orientación permanente**: semana N/M, fase actual y **próxima sesión** siempre visibles.
3. **Una sola gramática de tarjeta de sesión** en toda la app.
4. **Progreso con significado**: avanzado vs **planificado a la fecha**, no vs total.
5. **Hitos** (mitad/final/PB) y **guía del plan** integrados.

### 1.3 No-objetivos (out of scope)
- No tocar backend, modelos ni endpoints.
- No implementar clima real, análisis IA, export `.FIT`, replay (van en otras fases/specs).
- No cambiar la estética/tokens (solo consumirlos).

---

## 2. Arquitectura de lectura (nueva IA)

```
/routines/run/$planId            →  OVERVIEW (lectura por defecto)
 ├─ A. Header compacto            (nombre, estado, objetivo, fechas)   [colapsable: detalles]
 ├─ B. NextSessionCard            (foco: próxima sesión)  ← CTA "Ver sesión"
 ├─ C. PlanTimeline               (scroll horizontal, chip por semana con fase+estado)
 ├─ D. PlanWeekOverviewCard × N   (cada semana → filas de días; actual expandida)
 ├─ E. Hitos                      (mitad / final / PB, inline en el timeline)
 └─ F. Acciones                   (Guía del plan · Exportar · Editar · Eliminar)
        ↓ tocar semana → #week-N (inline) o ?view=week
        ↓ tocar día    → abre PaccerWorkoutSheet (lectura) → "Editar sesión" → WorkoutBlocksDrawer
```

**Regla:** toda la interacción primaria ocurre en **una sola vista** (Overview). “Semana” y “Día” son **anclas/estados**, no vistas con gramática distinta.

---

## 3. Rutas y deep links

Archivo: `frontend/src/routes/_layout/routines/run/$planId.tsx`

Extender el validador de search (mantener compatibilidad con `week` y `tab`):

```ts
validateSearch: (s: Record<string, unknown>): {
  week?: number
  day?: string        // ISO "YYYY-MM-DD" para abrir el sheet de ese día
  view?: "overview" | "evolution"
  tab?: string        // LEGACY: "evolution" ⇒ view="evolution"
} => ({
  week: typeof s.week === "number" ? s.week : undefined,
  day: typeof s.day === "string" ? s.day : undefined,
  view: s.view === "evolution" || s.view === "overview" ? s.view
        : (s.tab === "evolution" ? "evolution" : "overview"),
  tab: typeof s.tab === "string" ? s.tab : undefined,
})
```

**Contratos de navegación:**
| Desde | A | Params |
|---|---|---|
| Dashboard “Hoy” (sesión de hoy) | Plan | `?week=N&day=ISO` (abre sheet del día) |
| `PlanTimeline` chip semana | misma página | scroll a semana `#week-N` |
| `PlanWeekOverviewCard` fila día | misma página | abre `PaccerWorkoutSheet` con ese workout |
| “Ver evolución” | misma página | `?view=evolution` |

> Nota: actualmente el dashboard navega con `search: { tab: "evolution" }`. Mantener y añadir `view`.

---

## 4. Derivaciones de datos (utils) — `running-utils.ts`

Añadir (puras, testeables). **No** modificar backend. Semana **no** trae `target_volume_km` ⇒ **calcular client-side**.

```ts
type WeekStatus = "past" | "current" | "future"

export interface WeekOverview {
  id: string
  number: number
  phaseName: string
  phaseColor: PhaseColor
  startDate: string | null
  endDate: string | null
  status: WeekStatus
  isRestOrCutback: boolean         // de week.name ("Descarga") o heurística
  volumeKm: number                 // suma distances (o blocksDistanceKm) de la semana
  counts: { total: number; completed: number; missed: number; planned: number }
  workouts: RunningWorkoutPublic[]
}

/** Construye el array de semanas aplanado con fase y estado, en orden. */
export function buildWeeklyOverview(
  phases: RunningPhasePublic[],
  referenceDate?: Date,
  weekStartDayIso = 1,
): WeekOverview[]

/** Próxima sesión no completada y no cancelada con date >= hoy (o la de hoy). */
export function getNextWorkout(
  weeks: WeekOverview[],
  referenceDate?: Date,
): { workout: RunningWorkoutPublic; week: WeekOverview } | null

/** Progreso vs PLANIFICADO HASTA HOY (no vs total). */
export function computeProgressToDate(
  weeks: WeekOverview[],
  referenceDate?: Date,
): { plannedToDate: number; completed: number; missed: number; percent: number }

export function getWeekStatus(weekStart?: string|null, weekEnd?: string|null, ref?: Date): WeekStatus
export function computeWeeklyVolumeKm(workouts: RunningWorkoutPublic[]): number
```

**Requisitos de `computeProgressToDate`:** `plannedToDate` = nº de sesiones con `date <= hoy` (excluye `cancelled`); `percent = round(completed / plannedToDate * 100)`; si `plannedToDate === 0` ⇒ `percent = 0` y la UI muestra “Aún no empezaste”.

**Tests (Vitest):** plan en la semana 3 de 12 ⇒ `percent` refleja solo semanas 1–3; `getNextWorkout` salta `cancelled/completed` y devuelve la de hoy si existe; `buildWeeklyOverview` respeta `phaseColor` y `week_start_day`.

---

## 5. Componentes — especificación

> Tokens: usar **solo** tokens existentes (`--primary`, `--surface-container{,-high,-highest,-lowest}`, `--on-surface-variant`, `--outline`, `--border`, `--destructive`, `--domain-*`, `--radius`). **Prohibido** hardcodear (`#121214`, `amber-400`, `zinc-400`) → sustituir por tokens.

### 5.1 `PlanTimeline` (NUEVO) — `components/RunningPlans/PlanTimeline.tsx`
- **Propósito:** línea de tiempo del **plan completo**; columna vertebral de orientación.
- **Props:**
  ```ts
  { weeks: WeekOverview[]; currentWeekNumber?: number; onSelectWeek: (n: number) => void }
  ```
- **Render:** scroll horizontal (`overflow-x-auto`, snap), un chip por semana:
  - nº de semana (grande), `phaseName` corto, `status`:
    - `completed-all` → check `--primary`;
    - `current` → borde `--primary` + indicador (punto/“triangle”) + auto-scroll al entrar;
    - `future` → `--surface-container-high` + `--on-surface-variant`;
    - `has-missed` → punto `--destructive`.
  - Color de **fase** como acento **tonal** (`PHASE_COLORS[...].bar`), **no** nuevo hue.
- **Accesibilidad:** `role="tablist"`, chips `role="tab"` con `aria-selected`, teclado ←/→, `aria-label="Semana N, Fase X, completada|actual|futura"`.
- **Auto-scroll:** al montar, centrar la semana actual (`currentWeekNumber`).

### 5.2 `PlanWeekOverviewCard` (NUEVO) — `components/RunningPlans/PlanWeekOverviewCard.tsx`
- **Props:**
  ```ts
  { week: WeekOverview; expanded: boolean; onToggle: () => void; onSelectWorkout: (w: RunningWorkoutPublic) => void }
  ```
- **Cabecera (siempre visible):** `Semana N` · `phaseName` (badge tonal) · rango de fechas (`formatDateRange`) · `volumeKm` (“Volumen: X km”) · contadores (`completed/total`) · badge **“Semana actual”** si `status==="current"` · badge **“Descarga”** si `isRestOrCutback`.
- **Cuerpo (si `expanded`):** **filas de días** (no grilla de cards): `día (formatShortDate) · SessionCard (variante row)`.
- **Auto-expandir** la semana `current`; el resto colapsadas (estado en `RunningPlanDetail`).
- **Ancla:** `id={`week-${number}`}` + `scroll-mt-24` para deep-link/scroll.

### 5.3 `NextSessionCard` (NUEVO) — `components/RunningPlans/NextSessionCard.tsx`
- **Props:** `{ workout, phaseName, weekNumber, onOpen }`.
- **Contenido:** etiqueta “Próxima sesión”, `SessionCard` (variante row) o resumen (tipo, distancia, ritmo objetivo, fecha), CTA primaria **“Ver sesión”** → `onOpen` (abre el sheet).
- **Si no hay próxima** (plan no iniciado o terminado): mostrar estado vacío contextual (“Tu plan empieza el DD/MM” o “¡Plan completado!”).

### 5.4 `SessionCard` (UNIFICAR) — `components/RunningPlans/SessionCard.tsx`
- **Sustituye** a `PaccerSessionCard` y `WeekSessionCard`. Una sola gramática.
- **Props:** `{ workout; variant: "row" | "grid"; onClick }`.
- **Base de datos ya disponible:** `status` (`planned|completed|missed|cancelled`), `type`, `name`, `objective`, `distance_km`, `pace_seconds_per_km`, `intensity`, `blocks[]`, `matched_activity`.
- **Reglas visuales (Kinetic Volt — mantener disciplina tonal):**
  - Barra lateral = **acento tonal de fase** o `WORKOUT_TYPE_META`; **hue reservado a estado**:
    - `completed` → acento `--primary` + ✔;
    - `missed` → `--destructive` + ✕;
    - `cancelled` → `--on-surface-variant` tachado/atenuado;
    - `planned` → superficie neutra.
  - Contenido: día (row) o título, `formatDistance`, `formatPace`, resumen de bloques (`summarizeBlocks`/`buildBlockPreview`), badges “Actividad”/“Vinculada” si `matched_activity`.
  - **NO** hardcodear clima (el chip “Despejado · 14°/20°” de `PaccerSessionCard` es ficticio: **eliminar** hasta que exista clima real).

### 5.5 `PlanGuideSheet` (NUEVO, opcional en esta spec) — `components/RunningPlans/PlanGuideSheet.tsx`
- Bottom sheet “Cómo funciona tu plan”. Secciones **redactadas propias** (contenido, no copiado): *cómo se estructura*, *qué hacer si falto*, *cómo se ajusta*, *para qué sirven las fases*. Sin lógica nueva.

### 5.6 `PlanMilestoneBadge` (NUEVO, ligero)
- Marcador inline dentro de `PlanTimeline`/lista: **“Mitad del plan”**, **“Recta final”**, **“Día de carrera”**.
- Se calcula desde `weeks` (mitad = `ceil(total/2)`; final = última semana; carrera = semana con `workout.type==="race"`).
- Sin animación pesada; opcional modal informativo (no bloqueante).

### 5.7 `RunningPlanDetail.tsx` (REFACTOR)
- **Estructura nueva (Overview):**
  1. **Header compacto**: back, `plan.name`, `PLAN_STATUS_META` (badge, no `Select` inline — mover cambio de estado a menú `⋯`), goal+fechas.
  2. **Fila de acciones** (`⋯`): Editar · Exportar (MD) · **Guía del plan** · Eliminar.
  3. **`NextSessionCard`**.
  4. **`PlanTimeline`**.
  5. **`PlanWeekOverviewCard` × N** (semana actual expandida; anclas `#week-N`).
  6. **Barra de progreso “vs planificado a hoy”** (usar `computeProgressToDate`) + resumen compacto (semanas, km, tiempo objetivo). Los 6 stat chips pasan a un bloque **plegable “Detalles”**.
- **Vista Evolución**: conservar `PlanEvolutionTab` detrás de `?view=evolution`.
- **Sheets**: `PaccerWorkoutSheet` (lectura) + botón **“Editar sesión”** dentro → abre `WorkoutBlocksDrawer` (quitar el flujo `selected && !paccerSheetOpen`).
- **Deep link `day=ISO`**: al montar, si viene `day`, localizar workout y abrir sheet.
- **Deep link `week=N`**: scroll a `#week-N` y expandir.

---

## 6. Estados (obligatorios)

| Estado | Comportamiento |
|---|---|
| **No iniciado** (`today < start_date`) | Header “Empieza el DD/MM”; `NextSessionCard` = primera sesión (con cuenta atrás de días); progreso = “Aún no empezaste”; timeline sin “actual”. |
| **En curso** | Semana actual marcada + expandida; `NextSessionCard` = siguiente no completada; progreso vs planificado a hoy. |
| **Completado** | Badge “Finalizado”; `NextSessionCard` vacío → “¡Plan completado!”; timeline en tono apagado con checks. |
| **Semana de descarga** | Badge “Descarga”; sin cambios de color (tonal). |
| **Con sesiones perdidas** | Punto `--destructive` en el chip; contadores “Perdidas”. |
| **Loading** | Skeletons: header, `NextSessionCard`, timeline (chips), 2–3 `PlanWeekOverviewCard`. |
| **Empty/Error** | Reusar patrón actual (“No se pudo cargar el plan”, Reintentar). |

---

## 7. Diseño visual (resumen de reglas)

- **Tipografía:** define/usа la escala existente (`font-display` para números y títulos). Evitar tamaños arbitrarios nuevos (`text-[10px]` puntual solo en labels). Títulos: `font-display font-black tracking-tight`.
- **Superficies:** `rounded-2xl/3xl`, `bg-card`/`bg-surface-container`, `border-border`. **Migrar** hardcodes `bg-[#121214]`, `bg-[#141416]` → `bg-surface-container`.
- **Color semántico:** estado usa hue (`--primary` completado, `--destructive` perdido); **tipo/fase** usa **tono** (`PHASE_COLORS`, `WORKOUT_TYPE_META`).
- **Espaciado:** `gap-4/6`, sin anidar chips en chips.
- **Touch targets** ≥ 44px en chips/acciones.
- **Motion:** transiciones suaves (150–250ms), respetar `prefers-reduced-motion`. Sin Skia/animaciones pesadas.

---

## 8. Criterios de aceptación (testables)

1. Existe **una sola** vista de lectura por defecto (Overview); no hay conmutador `paccer/expanded`.
2. `WeekCarouselStrip` **eliminado** o reemplazado por `PlanTimeline` con datos reales (fase + estado + fecha).
3. Solo existe **una** tarjeta de sesión (`SessionCard`) reutilizada en todas las apariciones.
4. `PlanTimeline` resalta la **semana actual** y hace auto-scroll a ella.
5. `NextSessionCard` muestra la **próxima sesión** correcta y abre el sheet.
6. La barra de progreso usa **% completado vs planificado a hoy** (verificable: semana 3 de 12 ⇒ no muestra 25% artificial por total).
7. Deep links funcionan: `?week=5` (scroll+expande), `?day=YYYY-MM-DD` (abre sheet), `?view=evolution`.
8. Hitos visibles (mitad/final) en el timeline.
9. **Cero hardcodes de color** nuevos; solo tokens (grep de `#[0-9a-fA-F]{6}` y `amber-|zinc-|rose-` sin nuevos usos en componentes tocados).
10. Accesibilidad: timeline navegable por teclado con `aria-selected`; progressbar con `aria-valuenow` correcto.
11. Lighthouse/a11y sin regresiones; tests Vitest nuevos en verde; `bun run lint` (biome) en verde.

---

## 9. Plan de tareas (orden sugerido)

**T1 — Utils + tests** (`running-utils.ts`)
- Implementar `buildWeeklyOverview`, `getNextWorkout`, `computeProgressToDate`, `getWeekStatus`, `computeWeeklyVolumeKm` + tests Vitest.

**T2 — `SessionCard` unificada**
- Crear `SessionCard` (variantes row/grid) a partir de `WeekSessionCard` + eliminar el chip de clima ficticio.
- Migrar usos y **borrar** `PaccerSessionCard` y `WeekSessionCard`.

**T3 — `PlanTimeline`**
- Crear componente + auto-scroll + a11y.

**T4 — `PlanWeekOverviewCard`**
- Crear con filas de días; auto-expand de semana actual.

**T5 — `NextSessionCard`**

**T6 — Refactor `RunningPlanDetail.tsx`**
- Nueva Overview; mover stats a “Detalles”; cambiar progreso a “vs planificado a hoy”; estado del plan a menú `⋯`; deep links `week`/`day`; botón “Editar sesión” en el sheet.

**T7 — Hitos + Guía**
- `PlanMilestoneBadge` inline; `PlanGuideSheet` con contenido propio.

**T8 — Limpieza**
- Eliminar `WeekCarouselStrip`, dualidad `paccer/expanded`, código muerto; migrar hardcodes a tokens en los archivos tocados.

**T9 — QA**
- Aceptación §8, responsive (móvil 360px y desktop), teclado, estados §6.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper deep links del dashboard (`tab=evolution`) | Mantener `tab` como legacy y mapear a `view`. |
| Semanas sin fechas (`start_date` null) | `buildWeeklyOverview` debe manejar null: mostrar solo nº + estado por índice (fallback ya existe en `getCurrentWeekFromPhases`). |
| Card de sesión usada en otros sitios | Hacer `SessionCard` compatible con los props ya usados (`workout`, `onClick`) antes de borrar las antiguas. |
| Regresión visual Kinetic Volt | Adoptar tokens, no hardcodes; revisar contraste `--on-surface-variant`. |
| Perf con 24 semanas | Filas ligeras; sin animaciones costosas; memoizar `buildWeeklyOverview`. |

---

## 11. Definición de “hecho”

- [ ] Spec §8 verde.
- [ ] `WeekCarouselStrip`, `PaccerSessionCard`, `WeekSessionCard` eliminados; `SessionCard` única.
- [ ] `PlanTimeline`, `PlanWeekOverviewCard`, `NextSessionCard`, `PlanGuideSheet`, `PlanMilestoneBadge` implementados.
- [ ] `RunningPlanDetail` con una sola lectura + deep links.
- [ ] Tests nuevos + existentes en verde (`bun run test`), lint verde.
- [ ] Sin nuevos hardcodes de color.

---

### Referencias de código
- `frontend/src/routes/_layout/routines/run/$planId.tsx` (search schema)
- `frontend/src/components/RunningPlans/RunningPlanDetail.tsx`
- `frontend/src/components/RunningPlans/{WeekSessionCard,PaccerSessionCard,PaccerWorkoutSheet,WorkoutBlocksDrawer,PhaseTimeline,PlanEvolutionTab,WeekCarouselStrip}.tsx`
- `frontend/src/components/RunningPlans/running-utils.ts`
- Tipos: `frontend/src/client` (`RunningPlanPublic`, `RunningWorkoutPublic`)
