"""
OpenRunning MCP Server (Model Context Protocol)
Exposes tools for AI Assistants (Claude, Cursor, Antigravity) to inspect
running metrics, active training plans, shoe mileage, and fatigue status.
"""

import json
import sys
from typing import Any, Dict, List

TOOLS = [
    {
        "name": "get_running_summary",
        "description": "Obtiene el resumen de volumen semanal, ritmos promedios y VDOT estimado del corredor.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "ID del usuario (opcional)"}
            }
        }
    },
    {
        "name": "get_active_plan",
        "description": "Obtiene el plan de running activo con las sesiones programadas para la semana actual.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "get_shoe_status",
        "description": "Lista el estado de desgaste y kilometraje acumulado del calzado de running.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    }
]

def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[Dict[str, Any]]:
    if name == "get_running_summary":
        return [{
            "type": "text",
            "text": json.dumps({
                "weekly_volume_km": 34.2,
                "target_weekly_km": 50.0,
                "vdot_estimated": 48.5,
                "streak_weeks": 12,
                "avg_pace": "5:15 min/km",
                "fatigue_status": "Moderate (Z2 base week)"
            }, indent=2)
        }]
    elif name == "get_active_plan":
        return [{
            "type": "text",
            "text": json.dumps({
                "plan_name": "Plan Media Maratón Sub-1:45",
                "phase": "Construcción / Volumen",
                "week_number": 5,
                "today_workout": "8 km Rodaje Z2 + 4x100m progresivos",
                "upcoming_workouts": [
                    {"day": "Jueves", "type": "Tempo 6K a 4:55/km"},
                    {"day": "Sábado", "type": "Tirada Larga 16K a 5:30/km"}
                ]
            }, indent=2)
        }]
    elif name == "get_shoe_status":
        return [{
            "type": "text",
            "text": json.dumps([
                {
                    "brand": "Nike",
                    "model": "Pegasus 40",
                    "km_accumulated": 420.5,
                    "target_km": 700.0,
                    "condition": "74% de vida útil restante",
                    "status": "Activa"
                },
                {
                    "brand": "Asics",
                    "model": "Novablast 4",
                    "km_accumulated": 180.0,
                    "target_km": 800.0,
                    "condition": "90% de vida útil restante",
                    "status": "Activa"
                }
            ], indent=2)
        }]
    else:
        return [{"type": "text", "text": f"Error: Tool '{name}' not found"}]

def main():
    """Simple JSON-RPC 2.0 stdio server handler for MCP standard."""
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")

            if method == "tools/list":
                res = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name", "")
                args = params.get("arguments", {})
                content = handle_call_tool(name, args)
                res = {"jsonrpc": "2.0", "id": req_id, "result": {"content": content}}
            else:
                res = {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": "Method not found"}}

            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write(f"Error in MCP server: {e}\n")
            sys.stderr.flush()

if __name__ == "__main__":
    main()
