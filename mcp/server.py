"""
OpenRunning MCP Server (Model Context Protocol).

Servidor MCP completo para asistentes de IA (Claude, Cursor, Antigravity).
Permite consultar métricas, estado de fatiga, calzado y planes de running,
así como ejecutar acciones (reprogramar/crear sesiones, registrar actividades,
ajustar metas semanales, dar de alta zapatillas y calcular fisiología deportiva).
"""

import json
import os
import sys
from collections.abc import Callable
from typing import Any

# Añadir el directorio actual al path para importar módulos locales con facilidad
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from client import OpenRunningAPIError, OpenRunningClient
from running_science import (
    calculate_karvonen_hr_zones,
    calculate_vdot,
    format_pace,
    format_seconds_to_time,
    get_training_paces_from_vdot,
    parse_time_string,
    predict_time_riegel,
)

PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "openrunning-mcp"
SERVER_VERSION = "1.0.0"

client = OpenRunningClient()

# ---------------------------------------------------------------------------
# Definición de Herramientas (MCP Tools)
# ---------------------------------------------------------------------------

TOOLS: list[dict[str, Any]] = [
    # ---------------- Dashboard & Corredor ----------------
    {
        "name": "get_dashboard",
        "description": "Obtiene las métricas clave de la semana (km acumulados, ritmo promedio, sesiones), timeline diario y próxima carrera.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "week_start": {
                    "type": "string",
                    "description": "Fecha del lunes inicial en formato YYYY-MM-DD (opcional; por defecto el lunes actual)",
                }
            },
        },
    },
    {
        "name": "get_runner_summary",
        "description": "Obtiene un resumen ejecutivo del corredor: volumen semanal actual, metas, racha, zapatillas activas y plan en curso.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_weekly_goals",
        "description": "Consulta las metas semanales configuradas (km totales, sesiones y distancia de tirada larga).",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "update_weekly_goals",
        "description": "Acción: Actualiza los objetivos semanales del corredor (volumen de km, cantidad de sesiones o tirada larga).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "target_km": {
                    "type": "number",
                    "description": "Kilómetros objetivo para la semana",
                },
                "target_sessions": {
                    "type": "integer",
                    "description": "Cantidad de sesiones objetivo para la semana",
                },
                "target_long_run_km": {
                    "type": "number",
                    "description": "Distancia objetivo para la tirada larga semanal (km)",
                },
            },
        },
    },
    # ---------------- Planes de Running & Sesiones ----------------
    {
        "name": "get_active_training_plan",
        "description": "Obtiene el plan de running activo con todas sus fases, semanas, sesiones prescritas y estado de cumplimiento con actividades reales.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "list_training_plans",
        "description": "Lista todos los planes de running registrados (activos, planificados y completados) con métricas de avance.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_plan_details",
        "description": "Obtiene el detalle completo de un plan específico por ID (fases, semanas, entrenamientos y bloques de series/ritmos).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "plan_id": {
                    "type": "string",
                    "description": "UUID del plan de running",
                }
            },
            "required": ["plan_id"],
        },
    },
    {
        "name": "update_workout",
        "description": "Acción: Modifica una sesión de entrenamiento dentro de un plan (cambiar fecha, marcar como completada/perdida, cancelar, modificar ritmo objetivo, distancia o notas).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "plan_id": {"type": "string", "description": "UUID del plan"},
                "workout_id": {"type": "string", "description": "UUID de la sesión"},
                "date": {"type": "string", "description": "Nueva fecha en formato YYYY-MM-DD (opcional)"},
                "status_override": {
                    "type": "string",
                    "enum": ["completed", "missed"],
                    "description": "Marcar manualmente como realizada o perdida",
                },
                "cancelled": {"type": "boolean", "description": "Cancelar o reactivar la sesión"},
                "distance_km": {"type": "number", "description": "Distancia prescrita en km"},
                "pace_seconds_per_km": {"type": "number", "description": "Ritmo prescrito en seg/km"},
                "name": {"type": "string", "description": "Nombre de la sesión"},
                "objective": {"type": "string", "description": "Objetivo de la sesión"},
                "notes": {"type": "string", "description": "Notas o prescripción del entrenador"},
            },
            "required": ["plan_id", "workout_id"],
        },
    },
    {
        "name": "duplicate_workout",
        "description": "Acción: Duplica una sesión existente en el plan hacia otra fecha (por defecto 7 días después).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "plan_id": {"type": "string", "description": "UUID del plan"},
                "workout_id": {"type": "string", "description": "UUID de la sesión a duplicar"},
                "target_date": {"type": "string", "description": "Fecha destino en formato YYYY-MM-DD (opcional)"},
            },
            "required": ["plan_id", "workout_id"],
        },
    },
    {
        "name": "create_training_plan",
        "description": "Acción: Crea un nuevo plan de running completo estructurado con fases, semanas y sesiones en la cuenta del atleta.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nombre del plan (ej. 'Plan Media Maratón Sub-1:45')"},
                "start_date": {"type": "string", "description": "Fecha de inicio (YYYY-MM-DD)"},
                "end_date": {"type": "string", "description": "Fecha de fin (YYYY-MM-DD)"},
                "distance_km": {"type": "number", "description": "Distancia objetivo en km (ej. 21.1 o 42.2)"},
                "goal": {"type": "string", "description": "Objetivo principal del plan"},
                "status": {"type": "string", "enum": ["planned", "active", "completed"], "default": "active"},
                "phases": {
                    "type": "array",
                    "description": "Lista de fases estructuradas (con semanas y sesiones)",
                    "items": {"type": "object"},
                },
            },
            "required": ["name", "start_date", "phases"],
        },
    },
    # ---------------- Actividades ----------------
    {
        "name": "list_activities",
        "description": "Lista actividades registradas con distancia, duración, ritmo promedio, frecuencia cardíaca y calzado utilizado.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "description": "Límite de actividades a devolver (default 20)"},
                "from_date": {"type": "string", "description": "Fecha desde (YYYY-MM-DD)"},
                "to_date": {"type": "string", "description": "Fecha hasta (YYYY-MM-DD)"},
                "source_type": {"type": "string", "description": "Origen: 'strava' o 'manual'"},
            },
        },
    },
    {
        "name": "get_activity_details",
        "description": "Obtiene las métricas detalladas de una actividad cardio: splits por kilómetro, zonas de pulso, cadencia, elevación y notas de esfuerzo percibido (RPE).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "activity_id": {"type": "string", "description": "UUID de la actividad"},
            },
            "required": ["activity_id"],
        },
    },
    {
        "name": "create_manual_activity",
        "description": "Acción: Registra manualmente un entrenamiento o carrera no sincronizado por reloj.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Título de la actividad"},
                "date_time": {"type": "string", "description": "Fecha y hora ISO (ej. '2026-09-23T08:30:00Z')"},
                "distance_km": {"type": "number", "description": "Distancia recorrida en km"},
                "duration_minutes": {"type": "number", "description": "Duración total en minutos"},
                "avg_hr": {"type": "integer", "description": "Frecuencia cardíaca media (bpm)"},
                "max_hr": {"type": "integer", "description": "Frecuencia cardíaca máxima (bpm)"},
                "elevation_gain_meters": {"type": "number", "description": "Desnivel positivo acumulado (m)"},
                "rpe": {"type": "integer", "description": "Esfuerzo percibido del 1 al 10"},
                "notes": {"type": "string", "description": "Sensaciones o notas del atleta"},
                "shoe_id": {"type": "string", "description": "UUID de la zapatilla utilizada"},
            },
            "required": ["name", "date_time", "distance_km", "duration_minutes"],
        },
    },
    {
        "name": "assign_shoe_to_activity",
        "description": "Acción: Asigna o desasigna un par de zapatillas a una actividad registrada para llevar el control de kilometraje.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "activity_id": {"type": "string", "description": "UUID de la actividad"},
                "shoe_id": {"type": "string", "description": "UUID de la zapatilla (o null para quitar)"},
            },
            "required": ["activity_id"],
        },
    },
    # ---------------- Zapatillas ----------------
    {
        "name": "list_shoes",
        "description": "Lista el calzado del corredor con kilometraje acumulado, objetivo de vida útil, porcentaje restante y alerta de desgaste.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["training", "race", "trail", "easy", "mixed"],
                    "description": "Filtrar por categoría de calzado",
                },
                "search": {"type": "string", "description": "Búsqueda por texto (marca o modelo)"},
            },
        },
    },
    {
        "name": "get_shoe_stats",
        "description": "Obtiene estadísticas de rendimiento de una zapatilla: km acumulados, ritmo promedio, sesiones y carreras disputadas.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "shoe_id": {"type": "string", "description": "UUID de la zapatilla"},
            },
            "required": ["shoe_id"],
        },
    },
    {
        "name": "create_shoe",
        "description": "Acción: Registra un nuevo par de zapatillas en el inventario del corredor.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nombre identificatorio (ej. 'Pegasus 40 Rodajes')"},
                "brand": {"type": "string", "description": "Marca (ej. 'Nike', 'Asics', 'PUMA')"},
                "model": {"type": "string", "description": "Modelo (ej. 'Velocity Nitro 3')"},
                "category": {
                    "type": "string",
                    "enum": ["training", "race", "trail", "easy", "mixed"],
                    "description": "Categoría de uso",
                },
                "target_distance_km": {"type": "number", "description": "Vida útil estimada en km (ej. 750)"},
                "notes": {"type": "string", "description": "Notas o sensaciones sobre el calzado"},
                "color": {"type": "string", "description": "Color o diseño"},
            },
            "required": ["name", "category"],
        },
    },
    {
        "name": "update_shoe",
        "description": "Acción: Actualiza la información de una zapatilla (ej. objetivo de km, notas o retirar/jubilar marcándola como inactiva).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "shoe_id": {"type": "string", "description": "UUID de la zapatilla"},
                "name": {"type": "string", "description": "Nuevo nombre"},
                "target_distance_km": {"type": "number", "description": "Nuevo objetivo de distancia en km"},
                "is_active": {"type": "boolean", "description": "Activa o jubilada/inactiva"},
                "notes": {"type": "string", "description": "Notas adicionales"},
            },
            "required": ["shoe_id"],
        },
    },
    # ---------------- Carreras ----------------
    {
        "name": "list_races",
        "description": "Lista el calendario de carreras del atleta (pasadas y futuras) ordenadas por fecha con prioridades A/B/C y marcas objetivo.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "distance_km": {"type": "number", "description": "Filtrar por distancia en km"},
                "search": {"type": "string", "description": "Buscar por nombre del evento"},
            },
        },
    },
    {
        "name": "create_race",
        "description": "Acción: Inscribe una nueva carrera objetivo en el calendario deportivo.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "event_name": {"type": "string", "description": "Nombre de la carrera (ej. 'Media Maratón de Buenos Aires')"},
                "date": {"type": "string", "description": "Fecha y hora en formato ISO (ej. '2026-10-18T07:30:00Z')"},
                "distance_km": {"type": "number", "description": "Distancia oficial en km"},
                "priority": {"type": "string", "enum": ["A", "B", "C"], "default": "B", "description": "Prioridad deportiva: A (objetivo del año), B (preparatoria), C (entrenamiento con dorsal)"},
                "target_time_formatted": {"type": "string", "description": "Tiempo objetivo en formato 'hh:mm:ss' o 'mm:ss' (ej. '1:39:00')"},
                "location": {"type": "string", "description": "Ciudad / Ubicación"},
                "notes": {"type": "string", "description": "Estrategia o notas"},
                "shoe_id": {"type": "string", "description": "UUID de la zapatilla elegida para competir"},
            },
            "required": ["event_name", "date", "distance_km"],
        },
    },
    {
        "name": "update_race_results",
        "description": "Acción: Registra los resultados oficiales post-carrera (tiempo oficial, tiempo neto, puesto y sensaciones).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "race_id": {"type": "string", "description": "UUID de la carrera"},
                "official_time_formatted": {"type": "string", "description": "Tiempo oficial en formato 'hh:mm:ss'"},
                "chip_time_formatted": {"type": "string", "description": "Tiempo neto / chip en formato 'hh:mm:ss'"},
                "position": {"type": "integer", "description": "Posición en la clasificación general"},
                "notes": {"type": "string", "description": "Resumen o sensaciones de carrera"},
            },
            "required": ["race_id"],
        },
    },
    # ---------------- Fisiología Deportiva & Calculadoras ----------------
    {
        "name": "calculate_vdot_and_paces",
        "description": "Calculadora: Calcula el VDOT de Jack Daniels a partir de una marca reciente y genera la tabla de ritmos por zona (Easy, Maratón, Umbral, Intervalos, Repetición).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "distance_meters": {"type": "number", "description": "Distancia de la prueba en metros (ej. 5000, 10000, 21097.5, 42195)"},
                "time_formatted": {"type": "string", "description": "Tiempo realizado en formato 'hh:mm:ss' o 'mm:ss' (ej. '44:30' o '1:38:15')"},
                "time_seconds": {"type": "number", "description": "Opcional: tiempo total en segundos (alternativa a time_formatted)"},
            },
            "required": ["distance_meters"],
        },
    },
    {
        "name": "predict_race_time",
        "description": "Calculadora: Predice el tiempo probable en cualquier distancia utilizando la fórmula de Pete Riegel (T2 = T1 * (D2/D1)^1.06).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "source_distance_meters": {"type": "number", "description": "Distancia de referencia en metros (ej. 10000)"},
                "source_time_formatted": {"type": "string", "description": "Tiempo de referencia 'hh:mm:ss' o 'mm:ss'"},
                "target_distance_meters": {"type": "number", "description": "Distancia a proyectar en metros (ej. 21097.5 para media maratón)"},
            },
            "required": ["source_distance_meters", "source_time_formatted", "target_distance_meters"],
        },
    },
    {
        "name": "calculate_heart_rate_zones",
        "description": "Calculadora: Calcula las 5 zonas de frecuencia cardíaca por la fórmula de Karvonen (FC de reserva).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "resting_hr": {"type": "integer", "description": "Frecuencia cardíaca en reposo (bpm)"},
                "max_hr": {"type": "integer", "description": "Frecuencia cardíaca máxima (bpm)"},
            },
            "required": ["resting_hr", "max_hr"],
        },
    },
    # ---------------- Sincronización ----------------
    {
        "name": "get_sync_status",
        "description": "Consulta el estado de la conexión con Strava y los últimos registros de sincronización de OpenRunning.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "trigger_strava_sync",
        "description": "Acción: Inicia la sincronización bajo demanda con la cuenta vinculada de Strava.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
]


# ---------------------------------------------------------------------------
# Implementación de los Handlers de las Herramientas
# ---------------------------------------------------------------------------

def handle_get_dashboard(args: dict[str, Any]) -> Any:
    week_start = args.get("week_start")
    return client.get_dashboard(week_start)


def handle_get_runner_summary(args: dict[str, Any]) -> Any:
    dashboard = client.get_dashboard()
    goals = client.get_weekly_goals()
    active_plan = client.get_active_plan()
    shoes = client.get_shoes()

    kpis = dashboard.get("kpis", {})
    dist_km = round((kpis.get("cardio_distance_meters") or 0.0) / 1000.0, 2)
    avg_pace_sec = kpis.get("cardio_avg_pace_seconds_per_km")
    avg_pace = format_pace(avg_pace_sec) if avg_pace_sec else "N/A"

    target_goals = goals.get("goals") or {}

    active_shoes_summary = []
    for s in shoes:
        if s.get("is_active"):
            try:
                stats = client.get_shoe_stats(s["id"])
                km_acc = round((stats.get("total_distance_meters") or 0.0) / 1000.0, 1)
            except Exception:  # noqa: BLE001
                km_acc = 0.0
            target_km = s.get("target_distance_km")
            pct_used = round((km_acc / target_km) * 100, 1) if target_km else None
            active_shoes_summary.append({
                "id": s["id"],
                "name": s["name"],
                "brand": s.get("brand"),
                "model": s.get("model"),
                "km_accumulated": km_acc,
                "target_km": target_km,
                "usage_percentage": f"{pct_used}%" if pct_used is not None else "Sin límite fijado",
            })

    plan_info = None
    if active_plan:
        plan_info = {
            "id": active_plan["id"],
            "name": active_plan["name"],
            "goal": active_plan.get("goal"),
            "distance_km": active_plan.get("distance_km"),
            "start_date": active_plan.get("start_date"),
            "end_date": active_plan.get("end_date"),
            "phases_count": len(active_plan.get("phases", [])),
        }

    return {
        "current_week": {
            "start": dashboard.get("week_start"),
            "end": dashboard.get("week_end"),
            "volume_km": dist_km,
            "target_km": target_goals.get("target_km"),
            "sessions": kpis.get("sessions", 0),
            "target_sessions": target_goals.get("target_sessions"),
            "avg_pace": avg_pace,
            "active_days": kpis.get("active_days", 0),
        },
        "upcoming_race": dashboard.get("upcoming_race"),
        "active_plan": plan_info,
        "shoes": active_shoes_summary,
    }


def handle_get_weekly_goals(args: dict[str, Any]) -> Any:
    return client.get_weekly_goals()


def handle_update_weekly_goals(args: dict[str, Any]) -> Any:
    target_km = args.get("target_km")
    target_sessions = args.get("target_sessions")
    target_long_run_km = args.get("target_long_run_km")
    result = client.update_weekly_goals(
        target_km=target_km,
        target_sessions=target_sessions,
        target_long_run_km=target_long_run_km,
    )
    return {
        "message": "Objetivos semanales actualizados exitosamente",
        "updated_goals": result,
    }


def handle_get_active_training_plan(args: dict[str, Any]) -> Any:
    plan = client.get_active_plan()
    if not plan:
        return {"message": "No se encontró ningún plan de running activo"}
    return plan


def handle_list_training_plans(args: dict[str, Any]) -> Any:
    return {"plans": client.get_plans()}


def handle_get_plan_details(args: dict[str, Any]) -> Any:
    plan_id = args["plan_id"]
    return client.get_plan(plan_id)


def handle_update_workout(args: dict[str, Any]) -> Any:
    plan_id = args["plan_id"]
    workout_id = args["workout_id"]
    update_data: dict[str, Any] = {}
    for key in (
        "date",
        "status_override",
        "cancelled",
        "distance_km",
        "pace_seconds_per_km",
        "name",
        "objective",
        "notes",
    ):
        if key in args and args[key] is not None:
            update_data[key] = args[key]

    updated = client.update_workout(plan_id, workout_id, update_data)
    return {
        "message": "Sesión de entrenamiento actualizada con éxito",
        "workout": updated,
    }


def handle_duplicate_workout(args: dict[str, Any]) -> Any:
    plan_id = args["plan_id"]
    workout_id = args["workout_id"]
    target_date = args.get("target_date")
    duplicated = client.duplicate_workout(plan_id, workout_id, target_date)
    return {
        "message": "Sesión duplicada con éxito",
        "new_workout": duplicated,
    }


def handle_create_training_plan(args: dict[str, Any]) -> Any:
    plan = client.create_plan(args)
    return {
        "message": f"Plan '{plan.get('name')}' creado exitosamente",
        "plan": plan,
    }


def handle_list_activities(args: dict[str, Any]) -> Any:
    limit = args.get("limit", 20)
    from_date = args.get("from_date")
    to_date = args.get("to_date")
    source_type = args.get("source_type")
    activities = client.get_activities(
        limit=limit,
        from_date=from_date,
        to_date=to_date,
        source_type=source_type,
    )
    formatted = []
    for a in activities:
        cardio = a.get("cardio") or {}
        dist_m = cardio.get("distance_meters") or 0.0
        dur_s = a.get("duration_seconds") or 0
        pace_s = cardio.get("avg_pace_seconds_per_km")
        formatted.append({
            "id": a["id"],
            "name": a.get("name"),
            "timestamp": a.get("timestamp"),
            "distance_km": round(dist_m / 1000.0, 2),
            "duration": format_seconds_to_time(dur_s),
            "avg_pace": format_pace(pace_s) if pace_s else None,
            "avg_hr": cardio.get("avg_hr"),
            "shoe_id": cardio.get("shoe_id"),
            "source_type": a.get("source_type"),
        })
    return {"count": len(formatted), "activities": formatted}


def handle_get_activity_details(args: dict[str, Any]) -> Any:
    activity_id = args["activity_id"]
    return client.get_activity_cardio(activity_id)


def handle_create_manual_activity(args: dict[str, Any]) -> Any:
    name = args["name"]
    date_time = args["date_time"]
    dist_km = float(args["distance_km"])
    duration_min = float(args["duration_minutes"])
    duration_sec = round(duration_min * 60)
    dist_meters = dist_km * 1000.0
    pace_sec = duration_sec / dist_km if dist_km > 0 else None

    import uuid
    source_id = f"manual_{uuid.uuid4().hex[:12]}"

    cardio_data = {
        "distance_meters": dist_meters,
        "avg_pace_seconds_per_km": pace_sec,
        "avg_hr": args.get("avg_hr"),
        "max_hr": args.get("max_hr"),
        "elevation_gain_meters": args.get("elevation_gain_meters", 0.0),
        "rpe": args.get("rpe"),
        "perceived_effort_notes": args.get("notes"),
        "shoe_id": args.get("shoe_id"),
        "splits": [],
        "heart_rate_zones": [],
    }

    activity_payload = {
        "name": name,
        "source_type": "manual",
        "source_id": source_id,
        "timestamp": date_time,
        "duration_seconds": duration_sec,
        "sport_type": "Run",
        "cardio": cardio_data,
    }

    created = client.create_activity(activity_payload)
    return {
        "message": f"Actividad '{name}' registrada correctamente",
        "activity": created,
    }


def handle_assign_shoe_to_activity(args: dict[str, Any]) -> Any:
    activity_id = args["activity_id"]
    shoe_id = args.get("shoe_id")
    res = client.assign_shoe_to_activity(activity_id, shoe_id)
    return {
        "message": "Calzado asignado correctamente a la actividad",
        "result": res,
    }


def handle_list_shoes(args: dict[str, Any]) -> Any:
    category = args.get("category")
    search = args.get("search")
    shoes = client.get_shoes(category=category, search=search)
    enhanced = []
    for s in shoes:
        try:
            stats = client.get_shoe_stats(s["id"])
            km_acc = round((stats.get("total_distance_meters") or 0.0) / 1000.0, 1)
            sessions = stats.get("sessions", 0)
            avg_pace_sec = stats.get("avg_pace_seconds_per_km")
            avg_pace = format_pace(avg_pace_sec) if avg_pace_sec else None
        except Exception:  # noqa: BLE001
            km_acc = 0.0
            sessions = 0
            avg_pace = None

        target = s.get("target_distance_km")
        remaining_km = round(target - km_acc, 1) if target else None
        usage_pct = round((km_acc / target) * 100, 1) if target and target > 0 else None

        enhanced.append({
            "id": s["id"],
            "name": s["name"],
            "brand": s.get("brand"),
            "model": s.get("model"),
            "category": s.get("category"),
            "is_active": s.get("is_active"),
            "km_accumulated": km_acc,
            "target_distance_km": target,
            "remaining_km": remaining_km,
            "usage_percentage": f"{usage_pct}%" if usage_pct is not None else "N/A",
            "sessions_count": sessions,
            "avg_pace": avg_pace,
            "notes": s.get("notes"),
        })
    return {"count": len(enhanced), "shoes": enhanced}


def handle_get_shoe_stats(args: dict[str, Any]) -> Any:
    shoe_id = args["shoe_id"]
    return client.get_shoe_stats(shoe_id)


def handle_create_shoe(args: dict[str, Any]) -> Any:
    payload = {
        "name": args["name"],
        "brand": args.get("brand"),
        "model": args.get("model"),
        "category": args["category"],
        "target_distance_km": args.get("target_distance_km"),
        "notes": args.get("notes"),
        "color": args.get("color"),
        "is_active": True,
    }
    created = client.create_shoe(payload)
    return {
        "message": f"Zapatilla '{created.get('name')}' agregada al inventario",
        "shoe": created,
    }


def handle_update_shoe(args: dict[str, Any]) -> Any:
    shoe_id = args["shoe_id"]
    update_data: dict[str, Any] = {}
    for key in ("name", "target_distance_km", "is_active", "notes"):
        if key in args and args[key] is not None:
            update_data[key] = args[key]

    updated = client.update_shoe(shoe_id, update_data)
    return {
        "message": f"Zapatilla '{updated.get('name')}' actualizada exitosamente",
        "shoe": updated,
    }


def handle_list_races(args: dict[str, Any]) -> Any:
    distance_km = args.get("distance_km")
    search = args.get("search")
    races = client.get_races(distance_km=distance_km, search=search)
    formatted = []
    for r in races:
        target_sec = r.get("target_time_seconds")
        target_str = format_seconds_to_time(target_sec) if target_sec else None
        target_pace_sec = r.get("target_pace_seconds_per_km")
        target_pace_str = format_pace(target_pace_sec) if target_pace_sec else None

        official_sec = r.get("official_time_seconds")
        official_str = format_seconds_to_time(official_sec) if official_sec else None

        formatted.append({
            "id": r["id"],
            "event_name": r.get("event_name"),
            "date": r.get("date"),
            "distance_km": r.get("distance_km"),
            "priority": r.get("priority"),
            "target_time": target_str,
            "target_pace": target_pace_str,
            "official_time": official_str,
            "chip_time": format_seconds_to_time(r.get("chip_time_seconds")) if r.get("chip_time_seconds") else None,
            "position": r.get("position"),
            "location": r.get("location"),
            "notes": r.get("notes"),
        })
    return {"count": len(formatted), "races": formatted}


def handle_create_race(args: dict[str, Any]) -> Any:
    event_name = args["event_name"]
    date_str = args["date"]
    distance_km = float(args["distance_km"])
    priority = args.get("priority", "B")

    target_sec = None
    target_pace_sec = None
    if args.get("target_time_formatted"):
        target_sec = parse_time_string(args["target_time_formatted"])
        if target_sec > 0 and distance_km > 0:
            target_pace_sec = target_sec / distance_km

    payload = {
        "event_name": event_name,
        "date": date_str,
        "distance_km": distance_km,
        "priority": priority,
        "target_time_seconds": target_sec,
        "target_pace_seconds_per_km": target_pace_sec,
        "location": args.get("location"),
        "notes": args.get("notes"),
        "shoe_id": args.get("shoe_id"),
    }
    created = client.create_race(payload)
    return {
        "message": f"Carrera '{event_name}' agendada exitosamente",
        "race": created,
    }


def handle_update_race_results(args: dict[str, Any]) -> Any:
    race_id = args["race_id"]
    update_data: dict[str, Any] = {}
    if args.get("official_time_formatted"):
        update_data["official_time_seconds"] = parse_time_string(args["official_time_formatted"])
    if args.get("chip_time_formatted"):
        update_data["chip_time_seconds"] = parse_time_string(args["chip_time_formatted"])
    if args.get("position") is not None:
        update_data["position"] = args["position"]
    if args.get("notes") is not None:
        update_data["notes"] = args["notes"]

    updated = client.update_race(race_id, update_data)
    return {
        "message": f"Resultados de '{updated.get('event_name')}' guardados exitosamente",
        "race": updated,
    }


def handle_calculate_vdot_and_paces(args: dict[str, Any]) -> Any:
    dist_m = float(args["distance_meters"])
    time_sec = args.get("time_seconds")
    if time_sec is None and args.get("time_formatted"):
        time_sec = parse_time_string(args["time_formatted"])

    if not time_sec or time_sec <= 0:
        return {"error": "Debe proporcionar time_formatted (ej. '45:00') o time_seconds válido"}

    vdot = calculate_vdot(dist_m, float(time_sec))
    paces = get_training_paces_from_vdot(vdot)
    return {
        "distance_meters": dist_m,
        "time_formatted": format_seconds_to_time(time_sec),
        "vdot": vdot,
        "training_paces": paces,
    }


def handle_predict_race_time(args: dict[str, Any]) -> Any:
    src_dist = float(args["source_distance_meters"])
    src_time_sec = parse_time_string(args["source_time_formatted"])
    tgt_dist = float(args["target_distance_meters"])

    pred_sec = predict_time_riegel(src_dist, float(src_time_sec), tgt_dist)
    pred_pace_sec = pred_sec / (tgt_dist / 1000.0)

    return {
        "source_performance": {
            "distance_m": src_dist,
            "time": args["source_time_formatted"],
        },
        "target_distance_m": tgt_dist,
        "predicted_time": format_seconds_to_time(pred_sec),
        "predicted_seconds": round(pred_sec, 1),
        "predicted_pace": f"{format_pace(pred_pace_sec)} /km",
    }


def handle_calculate_heart_rate_zones(args: dict[str, Any]) -> Any:
    resting_hr = int(args["resting_hr"])
    max_hr = int(args["max_hr"])
    return calculate_karvonen_hr_zones(resting_hr, max_hr)


def handle_get_sync_status(args: dict[str, Any]) -> Any:
    return client.get_sync_status()


def handle_trigger_strava_sync(args: dict[str, Any]) -> Any:
    res = client.trigger_strava_sync()
    return {"message": "Sincronización con Strava iniciada", "result": res}


TOOL_HANDLERS: dict[str, Callable[[dict[str, Any]], Any]] = {
    "get_dashboard": handle_get_dashboard,
    "get_runner_summary": handle_get_runner_summary,
    "get_weekly_goals": handle_get_weekly_goals,
    "update_weekly_goals": handle_update_weekly_goals,
    "get_active_training_plan": handle_get_active_training_plan,
    "list_training_plans": handle_list_training_plans,
    "get_plan_details": handle_get_plan_details,
    "update_workout": handle_update_workout,
    "duplicate_workout": handle_duplicate_workout,
    "create_training_plan": handle_create_training_plan,
    "list_activities": handle_list_activities,
    "get_activity_details": handle_get_activity_details,
    "create_manual_activity": handle_create_manual_activity,
    "assign_shoe_to_activity": handle_assign_shoe_to_activity,
    "list_shoes": handle_list_shoes,
    "get_shoe_stats": handle_get_shoe_stats,
    "create_shoe": handle_create_shoe,
    "update_shoe": handle_update_shoe,
    "list_races": handle_list_races,
    "create_race": handle_create_race,
    "update_race_results": handle_update_race_results,
    "calculate_vdot_and_paces": handle_calculate_vdot_and_paces,
    "predict_race_time": handle_predict_race_time,
    "calculate_heart_rate_zones": handle_calculate_heart_rate_zones,
    "get_sync_status": handle_get_sync_status,
    "trigger_strava_sync": handle_trigger_strava_sync,
}


def dispatch_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        return {
            "content": [{"type": "text", "text": f"Error: Herramienta '{name}' no encontrada"}],
            "isError": True,
        }

    try:
        result = handler(arguments)
        text = json.dumps(result, ensure_ascii=False, indent=2, default=str)
        return {
            "content": [{"type": "text", "text": text}],
            "isError": False,
        }
    except OpenRunningAPIError as e:
        return {
            "content": [{"type": "text", "text": f"Error de OpenRunning API ({e.status_code}): {e.detail}"}],
            "isError": True,
        }
    except Exception as e:  # noqa: BLE001
        return {
            "content": [{"type": "text", "text": f"Error inesperado al ejecutar '{name}': {e!s}"}],
            "isError": True,
        }


# ---------------------------------------------------------------------------
# Loop Principal JSON-RPC 2.0 (stdio) para el estándar MCP
# ---------------------------------------------------------------------------

def main() -> None:
    """Manejador stdio compatible con el estándar Model Context Protocol (MCP)."""
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line_str = line.strip()
            if not line_str:
                continue

            req = json.loads(line_str)
            req_id = req.get("id")
            method = req.get("method")

            # Notificaciones (sin id)
            if req_id is None:
                if method == "notifications/initialized":
                    continue
                continue

            if method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": PROTOCOL_VERSION,
                        "capabilities": {
                            "tools": {},
                        },
                        "serverInfo": {
                            "name": SERVER_NAME,
                            "version": SERVER_VERSION,
                        },
                    },
                }
            elif method == "ping":
                res = {"jsonrpc": "2.0", "id": req_id, "result": {}}
            elif method == "tools/list":
                res = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name", "")
                args = params.get("arguments", {})
                tool_result = dispatch_tool(name, args)
                res = {"jsonrpc": "2.0", "id": req_id, "result": tool_result}
            else:
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Método '{method}' no soportado"},
                }

            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except json.JSONDecodeError:
            err_res = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error: JSON inválido"},
            }
            sys.stdout.write(json.dumps(err_res) + "\n")
            sys.stdout.flush()
        except Exception as e:  # noqa: BLE001
            sys.stderr.write(f"Error crítico en servidor MCP: {e}\n")
            sys.stderr.flush()


if __name__ == "__main__":
    main()
