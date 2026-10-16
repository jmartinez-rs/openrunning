# Anexo — UI lado a lado: Runna ↔ OpenRunning (y cómo mejorar tu UI)

> **Método:** mapa de UI de Runna (`Runna-REA/UI-runna.md`, anchuras de nombres del bundle Hermes) vs **código real** de OpenRunning (`frontend/src/…`).
> **Nota:** Runna es propietario; aquí se **describe** el patrón visual para inspirar, **no** se copia código ni assets.
> **Leyenda de estado (OpenRunning):** ✅ hecho y bueno · 🟡 existe pero mejorable · ❌ no existe.

---

## 1. Shell / navegación

| Aspecto | Runna `[OBS]` | OpenRunning `[OBS]` | Mejora sugerida |
|---|---|---|---|
| Barra inferior | 5 tabs (Today/Train/Activities/Calendar/Account) | Pill flotante: Hoy · Plan · **RUN** · Progreso · Más (`MobileTabBar.tsx`) | ✅ Ya es superior en foco ("RUN" central). Añadir **labels cortos** bajo iconos ya está. |
| Menú "Más" | — (todo en tabs) | `MoreMenuSheet` con secciones (Navegación/Herramientas/Sistema) | ✅ Buena IA. Añadir badge de "sin sincronizar" si hay actividades pendientes. |
| Top nav desktop | — | `TopNavbar` | ✅ |

**Veredicto:** tu navegación está **bien resuelta** y es más limpia que la de Runna.

---

## 2. Pantalla por pantalla

### 2.1 Home / "Hoy"
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Hero objetivo | Hero con countdown "FALTAN X DÍAS" | `TargetRaceHeroCard` (días, semana X/Y, volumen) | ✅ base sólida. Añadir **fondo/imagen sutil** del evento y **barra de progreso por puntos/semanas**. |
| Plan del día | Tarjeta + clima + switch PACE/KMH | `TodayWorkoutCard` | 🟡 añadir **clima** en cabecera y **sub-tabs** Resumen/Paso a paso/Clima (reusar `PaccerWorkoutSheet`). |
| Progreso semana | — | `WeekStrip` + `VolumeCard` + `StreakCard` | ✅ buena. Formato de `StreakCard` puede mostrar racha real (hoy `streakWeeks={0}`). |
| Insights | `TodayInsightCard*` (millas, carrera, clima) | ❌ | Añadir 1–2 "insight cards" (tendencia de ritmo/FC). |
| IA | "AI Insight" | `CoachCard` (placeholder) | 🟡 conectar a `AIWorkoutAnalysisCard` cuando exista motor. |

### 2.2 Lista de planes ("Plan")
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Activo | `ActivePlanHero` (equivalente) | `ActivePlanHero` + `RunningPlanCard` | ✅ |
| Filtros | buckets | chips Todos/Activos/Planificados/Finalizados | ✅ |
| Progreso | barras/badges | `computeProgress` | ✅ |
| Plantillas | `suggestedPlans`, foundation plans | ❌ | Añadir **plantillas de planes** (starter plans) con 1 clic. |

### 2.3 Detalle de plan / calendario ("Train")
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Selector de semanas | carrusel de chips circulares + marcador semana actual | `WeekCarouselStrip` + `WeekSessionCalendar` | ✅ concepto. Añadir **flecha/indicador** en semana actual y **color por fase**. |
| Tarjetas de sesión | badge lateral de color por tipo + día + dist + rango ritmo + clima + check | `WeekSessionCard` con `WORKOUT_TYPE_META` (tonal, sin hue) | ✅ **decisión de color superior** (hue reservado a estado). Añadir **rango de ritmo** y **clima**. |
| Timeline de fases | `PlanTimelineMarquee` | `PhaseTimeline` | ✅ |
| Pestaña Evolución | `PlanEvolution` | `PlanEvolutionTab` | ✅ (métrica real vs planificado, aprovechamiento). |
| Detalle sesión | bottom sheet con tabs + "Exportar a reloj" | `PaccerWorkoutSheet` (tabs resumo/passo_a_passo/clima/analise) | 🟡 **clima y analise son stubs**; implementar (ver §4). |

### 2.4 Actividades
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Feed | tabs plan/otras + thumbnail de mapa | `/activities` (`ActivityRow`, `WorkoutCard`) | 🟡 añadir **mini-mapa por fila** (polilínea de acento). |
| Detalle | mapa a color por ritmo + perfil altimétrico + grid + **parciales por km** | `$activityId` (`ActivityMap`, `CardioDetail`, `CardioSummary`, `AIWorkoutAnalysisCard`, `WorkoutFeedbackModal`) | 🟡 **muy cerca**. Falta: **perfil de elevación**, **tabla de parciales con barras de ritmo**, **thumbnail en el feed**. |
| Replay | `Replay*` (animación de splats) | ❌ | Roadmap (ver plan de mejoras, M6). |

### 2.5 Progreso / Analítica
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Resumen | 3 métricas + tendencia | `ChartCard`, `StatTile` | ✅ |
| Volumen | gráficos pace/mileage insights | `RunningHeatmap`, charts + `PeriodSelector` | ✅ |
| Zonas FC | `HeartRateZones` | analytics HR (backend `HrZonesPublic`) | 🟡 **superficie**: añadir visual de zonas en el detalle de sesión y en analytics. |
| Comparativa plan vs real | ✅ | `PlanEvolutionTab` | ✅ |

### 2.6 Carreras
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Wizard | `RaceSelectionBottomSheet` | `RaceWizard` (+ `RaceFormDialog`) | ✅ |
| Hero prioritaria | `RaceHeroCard` | `PriorityRaceCard`, `TargetRaceHeroCard` | ✅ |
| Secundaria | B-Race | `SecondaryRaceCard` | ✅ |
| Marca/medallas | — | **`PBWall`, `MedalCard3D`, `RaceFinishDialog`** | ⭐ **ya superas a Runna aquí**. |

### 2.7 Zapatillas / Herramientas / Ajustes
| | Runna | OpenRunning | Mejora |
|---|---|---|---|
| Calzado | (no central) | `/shoes` (`ShoeCard`, `ShoeStats`, `ShoeFormDialog`) | ⭐ diferenciador. Añadir **barra de vida útil** (km usados vs límite). |
| Calculadoras | pace calculators | `/tools` (VDOT, Riegel, conversores) | ✅ |
| Integraciones | syncs por dispositivo + estado | `Settings` (`StravaIntegration`, `SyncManager`, `SyncLog`, `IntegrationsSettings`) | 🟡 falta **Google Calendar** y **relojes**; hoy Strava. |

---

## 3. Patrones de componente (Runna → OpenRunning)

| Patrón Runna | Tienes equivalente | Falta / mejora |
|---|---|---|
| Bottom sheets con **tabs** internos | `Sheet` + `PaccerWorkoutSheet` | completar tabs `clima`/`analise` reales |
| **Badge lateral de color** por tipo de sesión | `WORKOUT_TYPE_META` (tonal) | mantener tonalidad (buena); usa `--domain-*` para estados |
| **Countdown badge** en objetivo | `TargetRaceHeroCard` | reforzar tipografía del "FALTAN X DÍAS" |
| **Skeleton loaders** ubicuos | `Skeleton` + algunos `*Skeleton` | añadir skeletons específicos (plan detail, activity detail) |
| `AlertModal`, `BottomSheet` genéricos | `dialog.tsx`, `sheet.tsx`, `alert.tsx` | ✅ |
| **Carousel horizontal** de semanas | `WeekCarouselStrip` | pulir snap + indicador actual |
| Chips de ritmo/velocidad | toggle PACE/KMH en `PaccerWorkoutSheet` | ✅ |
| **Insets / safe-area** | `MobileTabBar` usa `env(safe-area-inset-bottom)` | ✅ |

---

## 4. Sistema de diseño (Kinetic Volt) — observaciones

**Tienes (bien):**
- Tokens semánticos completos (`--primary`, `--surface-container{,-high,…}`, `--on-surface-variant`, `--outline`, `--radius`) y **tokens de dominio** (`--domain-race/-pace/-cardio/-strength/-active/-success`).
- Decisión acertada documentada en `running-utils.ts`: **el hue se reserva a estados reales** (completada/perdida); la identidad de tipo es **tonal** (tints del acento). Esto es **más disciplinado** que Runna.
- Dark-first; acento `#EAFC5F`.

**Gaps de sistema a homogeneizar:**
1. **Escala tipográfica:** define `display/h1/h2/body/caption` como utilidades (ahora mezclas `text-2xl font-display font-black`, `text-[10px]`, etc.). Runna usa una jerarquía muy consistente.
2. **Escala de espaciado/radius:** fija `rounded-2xl/3xl` y `gap-4/6` por nivel de tarjeta. Hay hardcodes (`rounded-t-[32px]`, `bg-[#121214]`) que deberían ser tokens (`--surface-container`).
3. **Estados vacíos / error / loading:** Runna cubre todo con skeletons y empty states; formaliza `<EmptyState/>` y `<SectionSkeleton/>` reutilizables.
4. **Colores hardcodeados:** sustituye `bg-[#121214]`, `text-amber-400`, `text-zinc-400` por tokens (`--surface-container`, `--warning`, `--on-surface-variant`) para consistencia y theming.
5. **Accesibilidad táctil:** objetivo ≥44px (lo menciona tu `PLAN_REDISEÑO_UI_PACCER.md`); verifica steppers/chips pequeños.

---

## 5. Datos/métricas mostradas — qué añadir

| Métrica | Runna | OpenRunning | Acción |
|---|---|---|---|
| Distancia / Ritmo / Duración | ✅ | ✅ | — |
| FC media + **zonas** | ✅ | 🟡 (analytics) | mostrar zona objetivo **por bloque** en la sesión |
| **Parciales por km** con barras | ✅ | 🟡 | tabla visual de splits en detalle de actividad |
| **Perfil de elevación** | ✅ | ❌ | gráfico sincronizado (Leaflet + Recharts) |
| Cadencia / Potencia / Contacto | ✅ | ❌ | opcional (si hay datos de dispositivo) |
| Clima del día de la sesión | ✅ | ❌ (stub) | tab clima real |
| Dispositivo de origen | ✅ | ❌ | "Garmin Forerunner" en detalle |

---

## 6. Backlog UI priorizado

**Quick wins (bajo esfuerzo, alto impacto visual):**
1. **Mini-mapa** en filas del feed de actividades (`ActivityRow`).
2. **Barra de vida útil** en `ShoeCard` (km usados / límite).
3. **Indicador de semana actual** en `WeekCarouselStrip`.
4. **Rango de ritmo** y **estimación de duración** en `WeekSessionCard`.
5. **Skeletons** específicos en `RunningPlanDetail` y `$activityId`.
6. **Empty states** unificados (sin plan, sin actividades, sin carreras).

**Medio (mayor valor de producto):**
7. **Pestaña Clima real** en `PaccerWorkoutSheet` (ver M5).
8. **Zonas FC por bloque** en la sesión.
9. **Perfil de elevación + tabla de splits** en detalle de actividad.
10. **Tab "Análisis IA"** funcional (enlazar `AIWorkoutAnalysisCard`).
11. **Export a reloj** (TCX/GPX primero).

**Alto (roadmap):**
12. Replay animado de actividad.
13. Insight cards en Home (tendencia ritmo/FC).
14. Gamificación propia (niveles/puntos).

---

## 7. Qué OpenRunning ya hace mejor que Runna (no romper)

1. **Disciplina de color**: hue reservado a estados; tipos por tonalidad.
2. **Calzado** (`/shoes`) con stats.
3. **PBWall + MedalCard3D + RaceFinishDialog**: capa de "logros" muy atractiva.
4. **AIWorkoutAnalysisCard** (concepto) y `PlanEvolutionTab` (real vs planificado).
5. **Navegación** más limpia (pill + RUN central).
6. **Transparencia**: la lógica del plan es legible y auditable (Runna no).

> Regla de oro: **mejorar sin perder identidad Kinetic Volt**. Adoptar *patrones de layout* de Runna (hero, tabs en sheets, splits, clima), no su estética ni su código.

---

### Referencias
- Runna: `Runna-REA/UI-runna.md`, `ANEXO-FRONTEND-runna.md`.
- OpenRunning: `frontend/src/{routes,components,lib}`, `docs/PLAN_REDISEÑO_UI_PACCER.md`, `docs/PLAN_IMPLEMENTACION_MEJORAS.md`.
