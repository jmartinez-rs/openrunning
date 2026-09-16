# OpenRunning — Plan de Herramientas de Running & Importador de Archivos

Este documento describe la especificación técnica para la implementación del **Módulo de Herramientas & Calculadoras del Corredor (`/tools`)** y el **Importador de Archivos GPX/FIT**.

---

## 1. Módulo de Herramientas & Calculadoras (`/tools`)

### 1.1 Objetivo
Proveer al atleta una suite completa e interactiva de calculadoras táctiles integradas en la aplicación, utilizando la librería de matemática deportiva de `frontend/src/lib/running-math.ts`.

### 1.2 Calculadoras Incluidas

1. **Calculadora VDOT & Ritmos de Entrenamiento (Jack Daniels)**
   - **Inputs:** Selector de distancia reciente (5K, 10K, 21.1K, 42.2K) + Tiempo transcurrido (hh:mm:ss).
   - **Outputs:** Puntaje VDOT estimado + Tabla de ritmos recomendados por zona (Easy, Marathon, Threshold, Interval, Repetition) en `min/km`.

2. **Predictor de Carrera (Fórmula de Riegel)**
   - **Inputs:** Distancia de referencia (km) + Tiempo de referencia (hh:mm:ss).
   - **Outputs:** Proyecciones de tiempo y ritmo medio para distancias estándar (5K, 10K, 15K, 21.1K Media Maratón, 42.2K Maratón).

3. **Calculadora de Zonas de Frecuencia Cardíaca (Karvonen & HRmax)**
   - **Inputs:** Frecuencia cardíaca en reposo (bpm) + Frecuencia cardíaca máxima (bpm).
   - **Outputs:** Rangos de FC (bpm) y porcentajes para Z1 (Recuperación), Z2 (Resistencia Aeróbica), Z3 (Tempo), Z4 (Umbral Lactato) y Z5 (VO2 Max).

4. **Conversor Interactivo de Ritmos**
   - **Inputs/Outputs sincronizados:** Ritmo ($\text{min/km}$) $\leftrightarrow$ Velocidad ($\text{km/h}$) $\leftrightarrow$ Ritmo por milla ($\text{min/mi}$).

---

## 2. Importador de Archivos GPX / FIT

### 2.1 Backend
- Dependencias: `fitparse` y `gpxpy` en el backend.
- Endpoint: `POST /api/v1/activities/upload` (recibe archivo `multipart/form-data`).
- Extracción: Distancia total, tiempo en movimiento, FC media/máx, cadencia, elevación acumulada, polyline GPS y splits de 1 km.

### 2.2 Frontend
- Componente Dropzone en la vista de **Actividades** (`/activities`).
- Parseo previo o subida directa con indicador de carga y redirección automática al detalle de la actividad.
