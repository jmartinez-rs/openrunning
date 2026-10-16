# Evaluación — Cómo Runna "lee" un plan ya creado (y cómo mejorar la lectura en OpenRunning)

> **Runna:** inferido del bundle Hermes (nombres de pantallas/componentes + copy i18n). Sin decompilador ⇒ se describe el **modelo de lectura**, no píxeles exactos.
> **OpenRunning:** lectura del código real (`RunningPlanDetail.tsx`, `WeekCarouselStrip`, `WeekSessionCard`, `PaccerSessionCard`, `PaccerWorkoutSheet`, `PhaseTimeline`, `WorkoutBlocksDrawer`).
> **Uso:** documento de trabajo para la fase de rediseño de lectura del plan.

---

## 1. Cómo Runna lee un plan creado

Runna **no** tiene "una pantalla de plan" con todo apilado. Tiene una **jerarquía de lectura**: *Plan → Semana → Día → Sesión*, con una **línea de tiempo** como columna vertebral y **hitos** como puntuación.

### 1.1 Pantallas de lectura (evidencia `[OBS]`)

| Nivel | Pantalla/componente (token) | Rol |
|---|---|---|
| **Plan (overview)** | `TrainPlanOverviewScreen`, `TrainPlanHeaderCard` | Portada del plan |
| **Línea de tiempo** | `PlanTimelineMarqueeSkia` (+ `PlanTimelineMarqueeItemSkia`), `furthestRunInPlan`, `PlanTotalTimeWidget` | Timeline horizontal del plan completo (scroll) |
| **Tarjetas de semana** | `WeekOverviewCardV2`, `WeekOverviewCellContent`, `WeekOverviewDays`, `mapWeekOverviewToV2Days`, `compareWeekOverviewDays` | Cada semana como tarjeta con **filas de días** |
| **Breakdown** | `PlanOverviewBreakdownTsx1..4`, `PlanOverviewCard{Header,Footer,ConflictFooter}`, `PlanSummarySYRCardContent`, `PlanTabStickers` | "Qué incluye el plan" |
| **Próxima sesión** | `nextSessionRow`, `nextWorkoutDay`, `getWorkoutDayNavigationTargetToggled` | CTA de foco: siguiente sesión |
| **Detalle de semana** | `TrainWeekDetailScreen`, `TrainWeekDropDownMenu`, `TrainWeekDetailHeaderSpacer` | Semana abierta + **dropdown** para saltar |
| **Detalle de día** | `TrainDayDetailScreen` + `TrainDayDetailHeaderCard` + `TrainDayDetailCompactHeader` + `TrainDayDetailDeepLink` | Día (deep-linkable) |
| **Detalle de sesión** | `TrainWorkoutDetailsModal`, `WorkoutCard` | Modal de la sesión |
| **Hitos** | `PlanMilestoneModal`, `introMilestonesScreen`, `PlanPbMilestonesList`, `useMilestoneAnimation`, `shouldShowMilestone`, `isMilestoneWeekDescriptionCard` | Hitos (intro, mitad, final, PB) |
| **Guía del plan** | `PlanGuideScreen`, `PlanOverviewGuideDetail`, `GuideListSelectCard`; i18n `features.plan.guide.{adaptations, sections, skipping, training, adjust, revisit, current}` | "Cómo funciona mi plan" + qué hacer si falto/ajusto |
| **Guía metodología** | i18n `features.plan.methodology.{title, description, coach}` | Explica el método |
| **Export** | `PlanOverviewPDFScreen`, `GetPlanOverviewPdf` | Plan a **PDF** |
| **Estados de semana** | `isOnOrPastFinalPlanWeekOverviewCardTags`, `isRestWeekOverviewStandalone`, `isHalfwayWeekOverviewCardRowV2`, `isInSecondHalfOfPlanOverview` | Semana final, descanso, segunda mitad… |

### 1.2 Copy que revela el modelo (`[OBS]`)

- `"halfway point of your plan"`, `"halfwayThroughPlan"`, `PLAN_HALFWAY_MILESTONE_SEEN_FOR_ORDER_ID`, `BasePlanHalfwayFeedbackType`, `"halfway feedback"` → **feedback a mitad de plan**.
- `"furthestRunInPlan"` → muestra la **tirada más larga** del plan.
- `"Got another race before your main event"` → gestión de carrera intermedia (B-Race) dentro de la lectura.
- `Add Vacation Details`, `Add Time` → pausas/ajustes desde la lectura.
- `usePrefetchPlanOverviewContent`, `usePlanReplayScreenLogic` → precarga la lectura (percepción de fluidez).

### 1.3 Flujo de lectura (reconstruido) `[INF]`

```
Train (tab)
 └─ TrainPlanOverviewScreen
     ├─ PlanHeaderCard            (nombre, objetivo, fechas, estado)
     ├─ PlanTimelineMarquee       (línea de tiempo del plan completo, scroll)
     ├─ [nextSessionRow]          (CTA: "tu próxima sesión")
     ├─ WeekOverviewCardV2 × N    (cada semana → filas de días)
     ├─ PlanOverviewBreakdown     ("qué incluye")
     ├─ Milestones                (intro / mitad / final / PB)
     └─ PlanGuide + PDF export    ("cómo funciona" / descargar)
        ↓ tocar semana
     TrainWeekDetailScreen  (+ WeekDropDown para saltar)
        ↓ tocar día
     TrainDayDetailScreen   (deep link)  →  TrainWorkoutDetailsModal
```

**Idea central:** el usuario **recorre** el plan (timeline → semana → día), no "aterriza en una lista densa". La **próxima sesión** y los **hitos** dan orientación constante.

---

## 2. Cómo lo lee OpenRunning hoy (código real)

`RunningPlanDetail.tsx` (1001 líneas) = pantalla única con:

1. **Barra superior**: volver, nombre, **selector de estado** (Activo/Pausado/Finalizado), objetivo+fechas, **Exportar** (Markdown/`.md`), Editar, Eliminar.
2. **Hero de progreso**: barra completadas/perdidas + tiempo/ritmo objetivo + 6 *stat chips* (semanas, sesiones, km, completadas, perdidas, pendientes).
3. **Selector de vista** (3 botones): **Entrenamientos** (`paccer`) · **Evolución** · **Todas las fases** (`expanded`).
4. **Vista `paccer`**: `WeekCarouselStrip` (chips 1..N) + lista de `PaccerSessionCard` de la semana seleccionada.
5. **Vista `expanded`**: `PhaseTimeline` + fases con **semanas colapsables** y grilla de `WeekSessionCard`.
6. **Sheets**: `PaccerWorkoutSheet` (+ stub clima/analise), `WorkoutBlocksDrawer`.

### 2.1 Problemas de lectura detectados `[OBS]`

1. **Dos lecturas paralelas e inconsistentes**: `paccer` (card tipo “feed”) vs `expanded` (card compacta + colapsables). Mismo plan, dos lenguajes visuales distintos → desorientación.
2. **El carrusel de semanas está desconectado de los datos**: en `RunningPlanDetail.tsx` los chips se generan con `Array.from({length: summary.weeks})` (números 1..N) e `isCompleted = num < currentWeek`, **no** con el estado real de las sesiones. La semana **no** tiene fecha/fase en el chip.
3. **No hay “línea de tiempo del plan completo”**: Runna tiene `PlanTimelineMarquee`; aquí la vista por defecto muestra **una sola semana**; se pierde la visión global y el “dónde estoy”.
4. **Exceso de cromo arriba**: hero + 6 stats + 3 tabs antes de ver **una sesión**. La lectura empieza con números, no con el plan.
5. **Sin foco en “próxima sesión”**: no hay CTA de siguiente entreno; el usuario debe buscarlo en el carrusel.
6. **Sin hitos ni guía**: no hay “mitad de plan”, ni “cómo funciona/ajustar”, ni feedback de mitad.
7. **Semana sin contexto**: se muestra `Semana N` + fase, pero **no** el rango de fechas, ni volumen objetivo (salvo un campo `target_volume_km` que el backend no envía hoy), ni estado agregado de la semana.
8. **Duplicación**: `WeekSessionCard` (expanded) y `PaccerSessionCard` (paccer) representan lo mismo; mantén **una** tarjeta canónica.
9. **Modo edición solapado**: `WorkoutBlocksDrawer` aparece solo cuando el sheet se cierra (`selected && !paccerSheetOpen`) — flujo confuso.

---

## 3. Propuesta — Rediseño de lectura (alineado a Kinetic Volt)

> Objetivo: pasar de **“lista densa por semana”** a **“recorrido Plan → Semana → Día”** con una línea de tiempo y un foco de “próxima sesión”. **Sin copiar Runna**, solo sus patrones de IA/estructura.

### 3.1 Nueva jerarquía de lectura

```
/routines/run/$planId  →  OVERVIEW (lectura principal)
 ├─ 1. Hero compacto: estado + progreso + tiempo objetivo   (colapsable)
 ├─ 2. NEXT SESSION card (foco)   ← CTA "Ver sesión" / "Empezar"
 ├─ 3. TIMELINE del plan (scroll horizontal)
 │       chip por semana: nº + fase (color tonal) + estado (✓/○/perdida)
 ├─ 4. SEMANAS como tarjetas (WeekOverview) con filas de días
 │       cada fila: día · tipo · dist · rango ritmo · estado
 ├─ 5. HITOS (mitad/final/PB) dentro del flujo del timeline
 └─ 6. Acciones: Ver guía del plan · Exportar · Editar
Tocar semana → WEEK DETAIL      (fechas, volumen objetivo, días)
Tocar día    → DAY DETAIL       (o abre el sheet de sesión)
```

### 3.2 Cambios concretos por componente

| Ahora | Propuesta |
|---|---|
| `WeekCarouselStrip` con números sin datos | **`PlanTimeline`** con chip/semana que incluye **fase (color), estado real y fecha**; semana actual destacada con puntero. |
| Dos vistas (`paccer`/`expanded`) | **Una sola lectura**; elimina la duplicación de tarjetas (`WeekSessionCard` **o** `PaccerSessionCard`, no ambas). |
| Vista por defecto = 1 semana | Vista por defecto = **overview** (timeline + semanas); el detalle de semana solo al tocar. |
| Hero con 6 stats | **Hero compacto** (progreso + objetivo) y un bloque “detalles” plegable. |
| Sin “próxima sesión” | **`NextSessionCard`** arriba, con tipo, fecha, dist y botón. |
| Sin hitos | **Hitos** en el timeline (mitad/final/PB) con modal breve. |
| Sin guía | **Plan Guide**: “cómo funciona”, “si falto un día”, “cómo se ajusta” (reutiliza `features.plan.guide.*` como **inspiración de contenido**, redactado propio). |
| Export .md | Mantener; añadir **“Añadir al calendario”** y (fase M5) **export a reloj**. |
| Edición en drawer escondido | Botón explícito **Editar sesión** en el detalle de día/sesión. |

### 3.3 Detalle de sesión (sheet) — mejorar la lectura interna

Ya tienes `PaccerWorkoutSheet` con tabs `Resumen · Paso a paso · Clima · Análisis`. Completa:
- **Paso a paso**: bloques con barra lateral + **rango de ritmo** y **recuperación** (ya hay `buildBlockPreview`).
- **Clima**: implementar (hoy stub).
- **Análisis**: comparar planificado vs ejecutado (lo sugiere tu `AIWorkoutAnalysisCard`).
- Añadir **“+” de contexto**: día de la semana, fase, semana N/total, y **objetivo de la sesión**.

### 3.4 Cómo se siente (principios)

1. **Orientación permanente**: siempre visible “semana N de M”, “próxima sesión”, y fase actual.
2. **Una sola gramática visual**: un único tipo de tarjeta de sesión en toda la app.
3. **Progreso con significado**: barra = completadas vs **planificadas a hoy**, no vs total (para no verse “0%” durante meses).
4. **Menos cromo, más plan**: los números van después del contenido, no antes.
5. **Continuidad**: meseta → timeline con milestones; nada de saltos entre vistas.

---

## 4. Qué NO copiar de Runna

- Su estética/Skia/paywall/milestone-gamificación pesada.
- Su modelo server-side opaco.
- **Sí** adoptar (patrón, no código): jerarquía de lectura, timeline del plan, foco de próxima sesión, guía del plan, hitos, PDF/export.

---

## 5. Recomendación de siguiente paso

Convertir §3 en una **spec de UI** para la fase de rediseño:
- `PlanTimeline` (nuevo componente) + `NextSessionCard` + `WeekOverviewCard` (reuso de datos reales, no `Array.from`).
- Eliminar la dualidad `paccer`/`expanded` y `WeekCarouselStrip` desconectado.
- Añadir hitos + guía del plan.
- Criterios de aceptación: ver §3.1–3.4 y “progreso vs planificado a hoy”.

> Esto es opinión de producto basada en evidencia de UI, no una imposición: valida con prototipo antes de implementar.
