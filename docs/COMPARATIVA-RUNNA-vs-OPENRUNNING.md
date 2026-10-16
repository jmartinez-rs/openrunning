# Comparativa: Runna (referencia) ↔ OpenRunning (tu app)

> **Runna:** análisis estático del APK `com.runbuddy.prod` 8.55.0 (React Native + Expo, JS en **Hermes bytecode**, backend **GraphQL/AppSync**). Fuente: `Runna-REA/` (`INFORME-runna-planificacion.md`, `ANEXO-FRONTEND-runna.md`, `ANEXO-ENTRENAMIENTO-runna.md`, `UI-runna.md`).
> **OpenRunning:** lectura directa del repositorio (`/home/jose/Documentos/Proyectos/openrunning`): React 19 + Vite + TanStack Router/Query + Tailwind v4 + Recharts/Leaflet; backend FastAPI + SQLModel + PostgreSQL.
> **Clasificación:** `[OBS]` observado · `[INF]` inferido · `[?]` desconocido.
> **Aviso legal:** Runna es software propietario. Este documento describe **funcionalidad observable** con fines de estudio; **no** se copia código ni se reproducen fórmulas propietarias.

---

## 0. Veredicto rápido

| Dimensión | Runna | OpenRunning | Quién va por delante |
|---|---|---|---|
| **Motor de planes** | Backend (inobservable) `[?]` | **Cliente, explícito**: VDOT + Riegel + 4 fases `[OBS]` | OpenRunning en **transparencia**; Runna en **madurez** |
| **Datos/métricas** | Enorme (insights, replay, pace/mileage insights) | Bueno (dashboard, analytics, heatmap, PB wall) | Runna |
| **UI/superficie** | ~193 pantallas, ~963 componentes | ~18 rutas, ~90 componentes | Runna (mucho mayor) |
| **Entrenamiento (intervalos/bloques)** | `[OBS]` warm/bloques/reps/cool | **Modelo explícito**: `WorkoutBlock` (warmup/interval/cooldown) | Empate; OpenRunning más limpio |
| **Adaptación/ciclo de vida** | Muy rico (deload/timetrial, holiday, realign) | Básico (status dinámico, missed/completed) | Runna |
| **Propiedad de datos** | SaaS cerrado | **Self-hosted, AGPL** | OpenRunning (propósito distinto) |

**Conclusión:** vuestros objetivos son distintos (Runna = producto SaaS escalado; OpenRunning = self-hosted controlado). Lo aprovechable de Runna es su **modelo de producto**, no su implementación.

---

## 1. Ficha técnica

| | **Runna 8.55.0** | **OpenRunning** |
|---|---|---|
| Tipo | App móvil nativa (React Native/Expo, Hermes) | PWA (React 19 + Vite) |
| Código UI | Hermes bytecode (no legible) | TypeScript legible |
| Navegación | React Navigation + Expo Router | **TanStack Router** (file-based) |
| Estado/datos | Apollo GraphQL + caché | **TanStack Query** sobre REST (`/api/v1`) |
| Backend | AWS AppSync (GraphQL) + Cognito | **FastAPI + SQLModel + PostgreSQL + Alembic** |
| Diseño | Propio | **Kinetic Volt** (`#EAFC5F`, dark) |
| Mapa | propio | **Leaflet** (`ActivityMap`, polilíneas) |
| Gráficas | Skia/Reanimated | **Recharts** + `@uiw/react-heat-map` |
| Músculos/3D | — | `react-muscle-highlighter`, `MedalCard3D` |
| MCP | — | `mcp/running_science.py` (¡running science propio!) |

---

## 2. Navegación comparada

**Runna** `[INF]` (tabs inferidos): **Today · Train · Activities · Calendar · Account** + decenas de stacks/modales.
**Runna** `[OBS]`: `BottomTabNavigator`, `AppTabBar`, `customTabBar`.

**OpenRunning** `[OBS]` (mobile pill bar, `MobileTabBar.tsx`): **Hoy · Plan · RUN · Progreso · Más**
**OpenRunning** más-menú: Carreras & objetivos · Historial de Actividades · Calzado · Calculadoras · Configuración.

| Runna (tab) | OpenRunning (equivalente) | Nota |
|---|---|---|
| **Today** | **Hoy** (`/`) | Equivalente directo |
| **Train** | **Plan** (`/routines`, `/routines/run/$planId`) | Equivalente |
| **Activities** | **Historial** (dentro de "Más") | En OR es secundario; en Runna es tab |
| **Calendar** | (integrado en Plan / WeekStrip) | Runna tiene calendario como área propia |
| **Account** | **Configuración** (dentro de "Más") | Equivalente |
| — (Instant Workouts) | **RUN** (acción central) | Runna: workouts instantáneos; OR: registra actividad manual |
| — (Levels/Community) | *(no existe)* | Gamificación/social ausente en OR |

---

## 3. Pantallas y funcionalidad (equivalencias)

Estado: ✅ existe y similar · 🟡 parcial · ❌ falta en OpenRunning · ⭐ lo tiene OpenRunning y Runna no (o mejor resuelto).

| Área | Runna | OpenRunning | Estado |
|---|---|---|---|
| **Home** | Today: plan del día, millaje, countdown, clima, insights | Dashboard: `TargetRaceHeroCard`, `TodayWorkoutCard`, `WeekStrip`, `VolumeCard`, `StreakCard`, `StravaSyncBar`, `CoachCard` | 🟡 (falta clima e insights card) |
| **Plan overview** | `TrainPlanOverviewScreen`, timeline | `/routines` + `ActivePlanHero`, `RunningPlanCard` | ✅ |
| **Detalle de plan** | `TrainWeekDetailScreen`, calendario | `RunningPlanDetail` + `WeekSessionCalendar` + `WeekCarouselStrip` + `PlanEvolutionTab` | ✅ |
| **Detalle de sesión** | Bottom sheet con tabs (Resumen/Paso a paso/Clima) | `PaccerWorkoutSheet`, `WorkoutBlocksDrawer`, `PaccerSessionCard` | ✅ (muy alineado) |
| **Bloques de sesión** | warm/blocks/reps/recovery/cool | `WorkoutBlock` (warmup/interval/cooldown) | ✅ |
| **Crear plan** | Onboarding multi-pantalla (goal, distancia, fecha, días, millaje, nivel…) | `PlanWizard` (5 pasos) | ✅ |
| **Races** | Race + BRace + `RaceSelectionBottomSheet` | `/races` (`RaceWizard`, `PriorityRaceCard`, `PBWall`, `MedalCard3D`, tabs) | ✅⭐ (PBWall/Medal son un plus) |
| **Actividades** | Feed + detalle + replay | `/activities` (tabs plan/otras) + `$activityId` (mapa, splits) | ✅ (falta **replay** animado) |
| **Análisis** | Pace Insights, Mileage Insights, Performance Hub, `AIWorkoutAnalysis` | `/analytics` (ChartCard, heatmap, StatTile) + **`AIWorkoutAnalysisCard`** | 🟡 (OR tiene IA; Runna tiene más vistas) |
| **Feedback post-entreno** | `WorkoutReview`, "Not feeling 100" | `WorkoutFeedbackModal` | ✅ |
| **Zapatillas** | (no central) | `/shoes` (`ShoeCard`, `ShoeStats`) | ⭐ |
| **Herramientas** | Pace calculators | `/tools` (VDOT, Riegel, conversores) | ✅ |
| **Fuerza/Movilidad** | Fuerza 160 refs, mobilidad/pilates/yoga | *(no existe)* | ❌ |
| **Calendario/reordenar** | Drag & drop de sesiones | `WeekSessionCalendar` (¿drag?) | 🟡 |
| **Niveles/gamificación** | Levels, badges, points | `StreakCard` (racha) | ❌ |
| **Dispositivos/reloj** | Sync Garmin/Polar/Coros/Amazfit/Fitbit/Apple/HealthConnect + export .FIT | Strava sync (backend) | ❌ (parcial) |
| **Holiday/pausas** | Holiday hub, vacaciones | *(no existe)* | ❌ |
| **Instant Workouts** | Instant workouts + benchmark | *(no existe; RUN = manual)* | ❌ |
| **Compartir/social** | Share run/plan, coaches | *(no existe)* | ❌ |
| **Suscripción/Paywall** | Paywall, RevenueCat, Stripe | N/A (self-hosted, gratis) | ⭐ (filosofía distinta) |

---

## 4. Sistema de planificación: comparación

### 4.1 Datos de entrada

| Input | Runna `[OBS]` | OpenRunning `[OBS]` |
|---|---|---|
| Objetivo | ✅ goal + tipo de plan | ✅ `goal` |
| Distancia objetivo | ✅ (`targetKm`) | ✅ `targetKm` (5K/10K/21.1K/42.2K) |
| Carrera objetivo | ✅ Race + BRace | ✅ `race_id` (opcional) |
| Nivel/experiencia | ✅ abilities (Beginner→Elite+) | 🟡 derivado de VDOT |
| Marca reciente / PB | ✅ race time, PBs, parkrun | ✅ `refDistanceKm`/`refTimeSeconds` |
| Volumen actual | ✅ current weekly mileage | ✅ `currentWeeklyKm` |
| Tirada larga | ✅ current/target longest run | ✅ `longestRunKm` |
| Días/semana + días | ✅ | ✅ `selectedDays` + `longRunDay` |
| Duración (semanas) | ✅ | ✅ `numWeeks` (8–16) |
| Fecha inicio + week start | ✅ | ✅ `start_date`, `week_start_day` |
| Fuerza/movilidad | ✅ | ❌ |
| Lesión/holiday | ✅ | ❌ |

### 4.2 Motor de cálculo

| | Runna | OpenRunning |
|---|---|---|
| Ubicación | **Backend** (`useCreateOrderMutation` + `usePlanGenerationProgress`) `[INF]` | **Cliente** (`PlanWizard.generatePlanStructure`, `running-math.ts`) `[OBS]` |
| Ritmos | `[?]` (desconocido) | **VDOT/Jack Daniels** (fórmula explícita) `[OBS]` |
| Predicción carrera | `[?]` | **Riegel** (`T = T_ref·(D/D_ref)^1.06`) `[OBS]` |
| Zonas | HR zones + RPE `[OBS]` | Fracciones VDOT (Easy 59–74%, Marathon 84%, Threshold 88%, Interval 100%, Rep 105%) `[OBS]` |
| Periodización | `[?]` | **4 fases**: Base → Build/Tempo → Peak/Intervalos → Taper `[OBS]` |

### 4.3 Tipos de sesión

| Tipo | Runna | OpenRunning |
|---|---|---|
| Easy/fácil | ✅ | ✅ (`WorkoutType`) |
| Long run | ✅ (+ constrain days) | ✅ (`longRunDay`) |
| Tempo/Threshold | ✅ | ✅ (fase Build) |
| Intervalos | ✅ | ✅ (`WorkoutBlock.interval`, p.ej. 8×800m) |
| Recovery/regenerativo | ✅ | ✅ (+20 s/km tras calidad) |
| Hills | ✅ | 🟡 |
| Time trial | ✅ (en deload) | ❌ |
| Walk-run/C25K | ✅ | ❌ |
| Fuerza/movilidad | ✅ | ❌ |

### 4.4 Estructura de sesión (bloques)

| Runna `[OBS]` | OpenRunning `[OBS]` |
|---|---|
| warmup / blocks / reps / recovery / cooldown | `WorkoutBlock`: `warmup` (1500m) · `interval` (reps, distancia, ritmo, `recovery_seconds`, `recovery_type`) · `cooldown` |
| Rutinas warm/cool reutilizables | (bloques por sesión) |

→ **Muy alineados.** El modelo de OpenRunning es más explícito y testeable (`running-utils.test.ts`).

### 4.5 Progresión, deload, taper

| | Runna `[OBS]` | OpenRunning `[OBS]` |
|---|---|---|
| Progresión volumen | semanal, mínimos por plan, `trainingBuildRate` | `longRun` interpola `KM_inicial → 0.85·D_target` según `w/N` |
| Deload | ✅ `DELOAD` + time trials | 🟡 (¿semanas de descarga? no explícito) |
| Taper | ✅ `TAPER`, regla `CannotScheduleTaperOrRecoveryWeekAfterLongestRun` | ✅ Fase 4: reduce fondo al **60%** del pico; última semana = día de carrera |
| Reducción | `Decrease your weekly mileage` | (implícito en taper) |

### 4.6 Adaptación y ciclo de vida

| | Runna | OpenRunning |
|---|---|---|
| Completado/omitido | `missed`/`skipped`, reorganizar, reagendar | **`resolve_workout_status`** dinámico: `planned/completed/missed/cancelled` + auto-match Strava (UTC-3) `[OBS]` |
| Por fatiga | "Not Feeling 100", `adjustmentReason` | ❌ |
| Por clima | ✅ weather adaption | ❌ |
| Regenerar/realinear | `RealignPlanV3`, restart, migrate, plan adjustment | 🟡 (recrear plan) |
| Secciones/semana | milestones, weekly insight | `PlanEvolutionTab` |

---

## 5. Modelo de datos

| Domain | Runna (inferido de tokens) | OpenRunning (de `models.py`) |
|---|---|---|
| Plan | `Plan`/`Order` | `RunningPlan` |
| Fase | (implícito) | `RunningPhase` (position, start_week, end_week) |
| Semana | `Week` | `RunningWeek` (number, fechas) |
| Sesión | `Workout`/`Session` | `RunningWorkout` (date, type, distance_km, pace_seconds_per_km, intensity) |
| Bloque | reps/recoveries | `WorkoutBlock` (block_type, repeats, distance_m, pace, recovery_seconds/type) |
| Carrera | Race + BRace | `Race` (prioritaria/secundaria) |
| Actividad | Activity | Activity + match plan |
| Zapatilla | (Shoe) | Shoe + `ShoeStats` |

**Alineación jerárquica: muy alta.** OpenRunning: `Plan → Phase → Week → Workout → Block`.

---

## 6. Oportunidades para OpenRunning (sin copiar implementación)

Ideas derivadas del **contrato de producto** observado en Runna (todas implementables con vuestro stack):

1. **Estado de sesión y auto-match** — ya lo tenéis (`resolve_workout_status`). ⭐ Diferenciador.
2. **Semanas de descarga (deload)** explícitas cada 3–4 semanas y **taper** como fase formal.
3. **Time trials / test de progreso** al final de bloques para recalibrar VDOT.
4. **Día de semana de fondo** con **restricciones de separación** (p.ej. no calidad junto a tirada larga) — Runna usa `*_CONSTRAINT_DAYS`.
5. **Adaptación por feedback** ("¿cómo te sentiste?" → ajustar próxima semana).
6. **Clima** en el detalle de sesión (ya tenéis `docs` con mockups).
7. **Replay de actividad** (animación de splits).
8. **Zonas de FC** configurables (mencionadas en el plan UI, no en el modelo).
9. **Export .FIT/.GPX a reloj** para llevar la sesión al dispositivo.
10. **Gamificación ligera** (rachas ya existe; medallas 3D ya existe) → puntos/niveles propios.

**No priorizar** (fuera de vuestro propósito self-hosted): paywall, coaches, social/compartir, multi-dispositivo propietario.

---

## 7. Diferencias de filosofía (importante)

- **Runna**: SaaS, datos en su nube, generación **server-side** (caja negra), monetización.
- **OpenRunning**: **self-hosted, AGPL, sin telemetría**, generación **client-side transparente** y auditable.
- Por tanto, vuestro valor único es **transparencia del algoritmo + propiedad del dato**, no replicar la superficie de Runna.

---

## 8. Límites del análisis

- **Runna**: sólo nombres/textos del bundle Hermes + backend inobservable. Nada de fórmulas propietarias (`[?]`).
- **OpenRunning**: leído desde el repo actual; puede haber cambios no revisados a fondo (p.ej. soporte de deload, drag&drop, niveles).
- La comparación de "estado" (✅/🟡/❌) es orientativa y se basa en estructura de componentes/rutas, no en pruebas de UI ejecutadas.

---

### Referencias
- Runna: `Runna-REA/INFORME-runna-planificacion.md`, `ANEXO-FRONTEND-runna.md`, `ANEXO-ENTRENAMIENTO-runna.md`, `UI-runna.md`.
- OpenRunning: `README.md`, `docs/LOGICA_PLANES_RUNNING.md`, `docs/PLAN_REDISEÑO_UI_PACCER.md`, `frontend/src/{routes,components,lib}`.
