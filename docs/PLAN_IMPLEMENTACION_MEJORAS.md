# Plan de implementación — Mejoras de mayor valor (OpenRunning)

> **Contexto:** comparativa con Runna (`docs/COMPARATIVA-RUNNA-vs-OPENRUNNING.md`). El objetivo **no** es copiar Runna (software propietario), sino cerrar los gaps de mayor valor usando **principios de fisiología del entrenamiento** y el stack propio.
> **Estado real inspeccionado:** motor `v3` en `backend/app/services/plan_generator.py` ya tiene periodización, **descargas (cutbacks)**, **taper**, topes de tirada larga, tune-ups (half/marathon) y un **validador de invariantes**. `resolve_workout_status` resuelve estado dinámico con auto-match Strava.
> **Conclusión:** no hace falta "reinventar" el motor; falta **dinamismo, adaptación y capa UX**.

---

## 0. Backlog priorizado

| # | Mejora | Valor | Esfuerzo | Fase |
|---|---|---|---|---|
| **M1** | **VDOT dinámico + test de forma + recalibración de ritmos** | 🔥🔥🔥 | M | 1 |
| **M2** | **Adaptación del plan a la realidad (adherencia + RPE/feedback)** | 🔥🔥🔥 | M–L | 1 |
| **M3** | **Reglas de estructuración configurables + validador ampliado** | 🔥🔥 | M | 2 |
| **M4** | **Pausas (Holiday) y re-planificación con desplazamiento** | 🔥🔥 | M | 2 |
| **M5** | **UX de sesión: zonas FC reales + clima + export .FIT** | 🔥🔥 | M (FIT: L) | 2–3 |
| M6 | Replay de actividad + niveles/gamificación propios | 🔥 | L | 3 (roadmap) |

**Por qué M1–M2 primero:** atacan directamente tu principal dificultad ("planes coherentes y adaptados"). M3 endurece la coherencia estructural; M4–M5 son calidad percibida.

---

## Principios rectores

1. **Desde primeros principios**, no ingeniería inversa de Runna. Usar modelos públicos (Daniels/VDOT, Riegel) ya presentes en `running-math` / `services/running_math.py`.
2. **Todo cambio del plan es explícito y auditable**: previsualizar diff → confirmar → aplicar (nunca mutar el plan en silencio).
3. **Nunca reescribir el pasado**: recalibración/adaptación sólo afecta a **semanas futuras**.
4. **Validador siempre en verde**: toda mutación vuelve a pasar `validate_plan_invariants`.
5. **Versionado de motor**: subir `engine_version` a `v4` cuando entre M1/M2 para trazabilidad (`baseline`, `generation_params` ya lo soportan).

---

## FASE 1 — Dinamismo y adaptación

### M1. VDOT dinámico + test de forma + recalibración de ritmos

**Problema:** el plan se calcula una vez con el VDOT de entrada y queda "congelado". Si mejoras, el plan no lo refleja hasta que crees otro.

**Diseño:**

1. **Modelo de datos** (`backend/app/models.py`):
   - Nuevo `PlanRecalibration` (o campo JSON `recalibrations` en `RunningPlan.generation_params`):
     ```
     id, plan_id, created_at, source (activity|test|manual),
     old_vdot, new_vdot, old_paces, new_paces,
     effective_from_week, applied: bool
     ```
   - Reutilizar `WorkoutType = "test"` (ya existe) para el **test de forma** (5K/10K time trial).
2. **Servicio** `backend/app/services/fitness.py`:
   - `estimate_vdot_from_activity(activity) -> (vdot, confidence, evidence)`: usa mejor esfuerzo reciente (distancia/tiempo reales) → `calculate_vdot` (backend `running_math.py`).
   - `recalibration_preview(plan, new_vdot) -> {old_paces, new_paces, affected_weeks, diff}`.
   - `apply_recalibration(plan, new_vdot, from_week)`: recalcula `pace_seconds_per_km` de **workouts y bloques de semanas futuras** con `get_training_paces_seconds(new_vdot)` y re-valida invariantes.
3. **Motor**: programar **test de forma** automáticamente si no hay marca reciente:
   - Regla: si `baseline.vdot.confidence == "estimated"` o antigüedad de marca > 8 semanas → insertar `test` (5K para objetivos ≤21K, 10K para maratón) al final de la **Fase 1** y al final de la **Fase 3**.
   - Extender la lógica de tune-up existente (`tuneup_week`) para cubrir 5K/10K.
4. **API** (`backend/app/api/routes/running_plans.py`):
   - `POST /running-plans/{plan_id}/recalibrate/preview` → `PlanRecalibrationPreview`
   - `POST /running-plans/{plan_id}/recalibrate` → aplica y devuelve plan actualizado + warnings.
   - Auto-disparo opcional tras sync: si aparece una actividad de tipo carrera/test con mejor VDOT → generar **preview** y notificar (no aplicar solo).
5. **UI** (`frontend/src/components/RunningPlans/`):
   - Card "Estado de forma" en `RunningPlanDetail`: VDOT actual, fuente, fecha.
   - Modal "Recalibrar plan" con diff (ritmos antes/después por tipo) + botón aplicar.
   - Badge en sesiones futuras afectadas.

**Tests** (`backend/tests`, `frontend` vitest):
- VDOT desde actividad conocida = valor esperado.
- Recalibración **no** toca semanas pasadas.
- Ritmos nuevos = `get_training_paces_seconds(new_vdot)`.
- Invariantes siguen OK tras aplicar.

**Aceptación:** puedo mejorar y el plan me ofrece recalibrar; los ritmos futuros se actualizan y el histórico queda intacto.

---

### M2. Adaptación del plan a la realidad (adherencia + feedback/RPE)

**Problema:** hoy `resolve_workout_status` marca `missed/completed`, pero el plan **no reacciona** (ni a sesiones perdidas ni al RPE).

**Diseño:**

1. **Datos disponibles ya:** `RunningWorkout.status_override`, `matched_activity_id`, `Activity.rpe` (1–10), `perceived_effort_notes`, y el feedback `WorkoutFeedbackModal` (weak/normal/strong). Falta **unirlos y decidir**.
2. **Servicio** `backend/app/services/plan_adaptation.py` con reglas deterministas y explicables:
   - **R1 Adherencia baja:** si en una semana `<60%` de sesiones completadas **y** se perdió una sesión de calidad → **no progresar volumen** la semana siguiente (repetir carga).
   - **R2 Fondo perdido:** si se perdió la tirada larga → **no** incrementar `long_run_km` la semana siguiente.
   - **R3 Sobrecoste percibido:** si 2+ sesiones fáciles con RPE ≥ 8 (o "strong" recurrente) → proponer descarga anticipada / bajar ritmo objetivo 5–10 s.
   - **R4 Sesión infrautilizada:** si RPE ≤ 3 repetido en calidad → proponer subir 5 s/km (evita planes poco estimulantes).
   - **R5 Fatiga/lesión:** si el atleta marca "lesión/enfermedad" → insertar bloque de recuperación (tipo `regeneration`) y desplazar calidad.
   - Cada regla devuelve `{code, reason, before, after}` (auditable, igual que `PlanValidationIssue`).
3. **API**:
   - `GET /running-plans/{plan_id}/adaptation/preview` → lista de sugerencias + diff.
   - `POST /running-plans/{plan_id}/adaptation/apply` → aplica seleccionadas y re-valida.
   - Persistir log de adaptaciones (JSON en plan o tabla `PlanAdaptation`).
4. **Motor:** exponer `conservative_mode` ya existente cuando R5/R3 se dispare.
5. **UI:**
   - Home (`TodayWorkoutCard`) / Plan detail: banner "Tu plan puede mejorar → Revisar 3 ajustes".
   - Modal de ajustes con lista de reglas, toggle por cada una, y "Aplicar".
   - Toast `AdaptationApplied`.

**Tests:** cada regla con escenario sintético; idempotencia; invariantes.

**Aceptación:** tras una semana con sesiones perdidas o feedback alto, la app me propone ajustes concretos y explicados, y solo aplica lo que confirmo.

---

## FASE 2 — Coherencia estructural y flexibilidad

### M3. Reglas de estructuración configurables + validador ampliado

**Diseño:**

1. **`PlanGeneratorConfig` (models.py)** — nuevos parámetros (con defaults que preservan el comportamiento actual):
   - `cutback_cadence: int = 4` (hoy fijo 3/4)
   - `hard_day_min_gap_days: int = 2`
   - `avoid_long_adjacent_quality: bool = True`
   - `quality_days_preference: list[int] | None`
2. **`plan_generator.py`:** usar estos parámetros en la colocación de calidad (hoy ya evita Domingo-Lunes y separa por `abs(d-q1)>1`; formalizarlo).
3. **`plan_validator.py` — invariantes nuevos:**
   - `LONG_RUN_ADJACENT_QUALITY` (fondo no contiguo a calidad).
   - `QUALITY_TOO_CLOSE` (dos calidades a <`hard_day_min_gap_days`).
   - `CUTBACK_CADENCE_MISSED` (falta descarga cada N semanas).
4. **Motor:** fase "deload" explícita (hoy es cutback por volumen; nombrarla ayuda a la UI).
5. **UI:** en el `PlanWizard`, sección avanzada "Cómo estructurar mis semanas" (día de fondo, nº días, separación, cadencia de descarga).

**Aceptación:** el usuario puede ajustar la estructura y el validador garantiza coherencia (sin días duros consecutivos, fondo separado, descargas presentes).

---

### M4. Pausas (Holiday) y re-planificación con desplazamiento

**Problema:** falta el concepto de pausa/vacaciones; hoy solo cancelar sesiones.

**Diseño:**

1. **Modelo:** `PlanPause` (plan_id, start_date, end_date, reason) o campos en el plan.
2. **Servicio** `backend/app/services/plan_schedule.py`:
   - `preview_shift(plan, pause_start, pause_end)` → desplaza semanas (o workouts) por N días y **extiende** `end_date`.
   - Opciones: (a) *desplazar todo* (mueve el objetivo), (b) *comprimir* (recalcular volumen respetando el ≤15%/semana del validador).
3. **API:** `POST /running-plans/{plan_id}/pause/preview` y `/apply`.
4. **UI:** en `RunningPlanDetail`, acción "Pausar / Vacaciones" con calendario del rango y preview del nuevo plan.

**Aceptación:** puedo marcar 2 semanas de vacaciones y el plan se reajusta sin romper invariantes, con vista previa.

---

### M5. UX de sesión: zonas FC reales + clima + export .FIT

> `PaccerWorkoutSheet.tsx` ya tiene pestañas `clima` y `analise` y un **stub** de descarga `.FIT` ("Descargando…"). Hay que hacerlas reales.

1. **Zonas FC reales:** `calculateHeartRateZones` existe (frontend `running-math.ts` y backend). Hoy la zona se asigna por `type` **hardcodeada**; enlazarla al `maxHr`/`restHr` del usuario y mostrarla por bloque.
2. **Clima:** endpoint backend `GET /weather?date=&lat=&lon=` (Open-Meteo, sin API key) → `clima` tab con temp min/máx, lluvia, viento, e **indumentaria sugerida**. Cachear por día.
3. **Export .FIT (o alternativa):** generar workout estructurado para reloj.
   - Opción ligera primero: **GPX/TCX** con pasos (TCX soporta `<Workout>` por pasos) o descarga JSON→integración Garmin.
   - `.FIT` real requiere SDK `fit-python`/`garmin-fit-sdk` (esfuerzo **L**): planificar como sub-fase.

**Aceptación:** la pestaña clima muestra datos reales del día del entreno; la zona FC refleja mis zonas; el botón de export descarga un archivo válido.

---

## FASE 3 — Roadmap (menor prioridad)

- **M6 Replay de actividad:** animación de splats por km (Recharts + canvas/leaflet), a partir de `ActivitySplits`/`CardioDetail`.
- **Gamificación propia:** ya tenéis `StreakCard` y `MedalCard3D`; añadir puntos/niveles internos (sin copiar el sistema de Runna).
- **Fuerza/movilidad:** catálogo paralelo (si interesa ampliar dominio).

---

## Plan de ejecución sugerido

```
Sprint 1: M1 (modelo + servicio + preview/apply + UI card/modal + tests)
Sprint 2: M2 (plan_adaptation + preview/apply + UI banner/modal + tests)
Sprint 3: M3 (config params + validadores + wizard avanzado)
Sprint 4: M4 (pausas) y M5.a (zonas FC + clima)
Sprint 5: M5.b (.FIT/TCX) y M6
```

**Definición de "engine v4":** M1+M2+M3 entregados ⇒ `engine_version="v4"`, adaptativo y auditable.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Adaptación "mágica" que confunde | Siempre **preview + confirmación**; reglas explicadas. |
| Regresión en generación | Tests de invariantes + golden tests del validador. |
| Duplicar lógica backend/frontend | Fuente única: recalibración/adaptación en **backend**; frontend solo presenta. |
| `running-math` divergente (TS vs Python) | Test de paridad (mismos inputs → mismos ritmos). |
| `.FIT` complejo | Empezar por TCX/GPX; FIT como sub-fase. |

## Qué NO hacer

- Copiar el algoritmo de Runna (propietario): se implementa **desde primeros principios** (Daniels/Riegel ya presentes).
- Mutar el plan sin confirmación del usuario.
- Reescribir sesiones pasadas o historial.

---

### Anexos
- `ANEXO_UI_RUNNA_vs_OPENRUNNING.md` — UI lado a lado + backlog de mejoras visuales.
- `COMPARATIVA-RUNNA-vs-OPENRUNNING.md` — comparación funcional completa.
