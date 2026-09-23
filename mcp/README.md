# OpenRunning MCP Server (Model Context Protocol)

Servidor oficial de **Model Context Protocol (MCP)** para OpenRunning. Permite que asistentes de Inteligencia Artificial (**Claude Desktop**, **Cursor**, **Antigravity**, etc.) se conecten en tiempo real con OpenRunning tanto para **consultar métricas y estado del corredor** como para **ejecutar acciones concretas** (reprogramar o crear sesiones de entrenamiento, ajustar objetivos semanales, gestionar calzado, inscribir carreras y calcular zonas y ritmos de entrenamiento).

---

## 🚀 Requisitos Previos

- Python `>= 3.10`
- [`uv`](https://docs.astral.sh/uv/) (recomendado) o `python3` con `httpx`
- Instancia de OpenRunning en ejecución (por defecto `http://localhost:8001/api/v1`)

---

## ⚙️ Variables de Entorno de Configuración

El servidor MCP se conecta al backend de OpenRunning vía API REST autenticada. Puedes configurar las siguientes variables de entorno:

| Variable | Valor por Defecto | Descripción |
|---|---|---|
| `OPENRUNNING_API_URL` | `http://localhost:8001/api/v1` | URL base de la API REST de OpenRunning |
| `OPENRUNNING_EMAIL` | `admin@example.com` | Email del usuario en OpenRunning |
| `OPENRUNNING_PASSWORD` | `changethis` | Contraseña del usuario |
| `OPENRUNNING_ACCESS_TOKEN` | *(opcional)* | Token Bearer JWT estático pregenerado |

---

## 🛠️ Configuración en Clientes de IA

### 1. Cursor IDE

Crea o edita el archivo `.cursor/mcp.json` en la raíz de tu proyecto o en tu configuración global de Cursor:

```json
{
  "mcpServers": {
    "openrunning": {
      "command": "uv",
      "args": [
        "run",
        "--with",
        "httpx",
        "python",
        "/home/jose/Documentos/Proyectos/openrunning/mcp/server.py"
      ],
      "env": {
        "OPENRUNNING_API_URL": "http://localhost:8001/api/v1",
        "OPENRUNNING_EMAIL": "admin@example.com",
        "OPENRUNNING_PASSWORD": "changethis"
      }
    }
  }
}
```

---

### 2. Claude Desktop

En tu archivo de configuración de Claude Desktop:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "openrunning": {
      "command": "uv",
      "args": [
        "run",
        "--with",
        "httpx",
        "python",
        "/home/jose/Documentos/Proyectos/openrunning/mcp/server.py"
      ],
      "env": {
        "OPENRUNNING_API_URL": "http://localhost:8001/api/v1",
        "OPENRUNNING_EMAIL": "admin@example.com",
        "OPENRUNNING_PASSWORD": "changethis"
      }
    }
  }
}
```

---

### 3. Antigravity

El servidor MCP puede registrarse agregándolo en `.gemini/antigravity-cli/mcp/openrunning` o invocando el comando directo:

```bash
uv run python mcp/server.py
```

---

## 🏃 Catálogo Completo de Herramientas (Tools)

### 📊 Dashboard & Resumen del Corredor
- `get_dashboard`: KPIs semanales (distancia acumulada, ritmo medio, sesiones), timeline diario y próxima carrera.
- `get_runner_summary`: Resumen ejecutivo integral (volumen, racha, plan activo, estado de zapatillas).
- `get_weekly_goals`: Metas semanales configuradas (km totales, sesiones, tirada larga).
- **Acción:** `update_weekly_goals`: Actualiza los objetivos semanales del corredor.

### 📅 Planes de Entrenamiento & Sesiones (Read & Actions)
- `get_active_training_plan`: Detalle completo del plan activo (fases, semanas, sesiones prescritas y estado de cumplimiento con Strava/manual).
- `list_training_plans`: Resumen de todos los planes (completitud, km planificados, fechas).
- `get_plan_details`: Estructura completa de un plan específico por ID.
- **Acción:** `update_workout`: Modifica una sesión (fecha, marcar como completada/perdida, cancelar, ritmos, distancia, notas del entrenador).
- **Acción:** `duplicate_workout`: Clona una sesión hacia una nueva fecha.
- **Acción:** `create_training_plan`: Crea un nuevo plan completo estructurado con fases, semanas y entrenamientos.

### 👟 Calzado de Running (Shoes)
- `list_shoes`: Inventario de zapatillas con kilometraje acumulado, objetivo de vida útil y % de desgaste restante.
- `get_shoe_stats`: Estadísticas de rendimiento (sesiones, ritmo promedio, carreras corridas con este par).
- **Acción:** `create_shoe`: Da de alta un nuevo par de zapatillas.
- **Acción:** `update_shoe`: Actualiza objetivo de km, notas o jubila la zapatilla marcándola como inactiva.

### 🏃‍♂️ Actividades y Entrenamientos
- `list_activities`: Lista actividades recientes con distancia, tiempo, ritmo y pulso.
- `get_activity_details`: Métricas cardio avanzadas (splits km a km, zonas de pulso, cadencia, elevación, RPE).
- **Acción:** `create_manual_activity`: Registra un entrenamiento manual.
- **Acción:** `assign_shoe_to_activity`: Vincula una zapatilla a una actividad.

### 🏆 Carreras y Calendario
- `list_races`: Calendario de competiciones pasadas y futuras (prioridades A/B/C, metas de tiempo y ritmo).
- **Acción:** `create_race`: Inscribe una nueva carrera objetivo.
- **Acción:** `update_race_results`: Registra tiempos oficiales post-carrera, puesto y sensaciones.

### 🔬 Fisiología Deportiva & Calculadoras de Entrenamiento
- `calculate_vdot_and_paces`: VDOT de Jack Daniels y tabla de ritmos por zona (Easy, Marathon, Threshold, Interval, Repetition).
- `predict_race_time`: Predicción de marcas usando la fórmula de fatiga de Pete Riegel ($T_2 = T_1 \cdot (D_2/D_1)^{1.06}$).
- `calculate_heart_rate_zones`: Zonas de pulso cardíaco calculadas por la fórmula de Karvonen (FC de reserva).

### 🔄 Sincronización
- `get_sync_status`: Estado de integración con Strava y logs recientes.
- **Acción:** `trigger_strava_sync`: Inicia la sincronización manual con Strava.

---

## 🧪 Verificación y Pruebas Automatizadas

Para validar que todo el servidor y la conexión con OpenRunning funcionan correctamente:

```bash
uv run python mcp/test_mcp.py
```

El script ejecuta un conjunto completo de pruebas vía subproceso stdio emulando un cliente MCP real:
1. `initialize` y negociación de protocolo JSON-RPC.
2. `tools/list` para verificar el registro de las 26 herramientas.
3. Consultas en tiempo real contra el backend de OpenRunning (`get_runner_summary`, `list_shoes`).
4. Cálculos matemáticos de fisiología deportiva.
5. Acciones mutativas (`update_weekly_goals`, `create_race`, etc.) y verificación de persistencia en la base de datos.
