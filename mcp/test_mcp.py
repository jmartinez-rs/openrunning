"""
Suite de pruebas automatizadas para el servidor MCP de OpenRunning.
Simula un cliente MCP (como Cursor o Claude Desktop) enviando mensajes
JSON-RPC por stdio a través de un subproceso.
"""

import json
import subprocess
import sys
from typing import Any


def send_rpc(proc: subprocess.Popen, method: str, params: Any = None, req_id: int = 1) -> dict[str, Any]:
    msg: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        msg["params"] = params
    payload = json.dumps(msg) + "\n"
    proc.stdin.write(payload.encode("utf-8"))
    proc.stdin.flush()

    line = proc.stdout.readline().decode("utf-8")
    if not line:
        raise RuntimeError("El servidor MCP cerró la conexión inesperadamente")
    return json.loads(line)


def main():
    print("=" * 60)
    print("INICIANDO PRUEBAS DEL SERVIDOR MCP DE OPENRUNNING")
    print("=" * 60)

    # Iniciar el servidor MCP como un subproceso stdio
    cmd = [sys.executable, "mcp/server.py"]
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        # 1. Probar initialize
        print("\n[1/7] Probando 'initialize'...")
        init_res = send_rpc(
            proc,
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-suite", "version": "1.0.0"},
            },
            req_id=1,
        )
        assert "result" in init_res, f"Fallo initialize: {init_res}"
        server_info = init_res["result"]["serverInfo"]
        print(f" -> Servidor inicializado: {server_info['name']} v{server_info['version']}")

        # 2. Probar tools/list
        print("\n[2/7] Probando 'tools/list'...")
        list_res = send_rpc(proc, "tools/list", req_id=2)
        tools = list_res["result"]["tools"]
        print(f" -> Total herramientas registradas: {len(tools)}")
        tool_names = [t["name"] for t in tools]
        print(f" -> Herramientas: {', '.join(tool_names[:6])}... y más")
        assert len(tools) >= 20, "Faltan herramientas esperadas"

        # 3. Probar get_runner_summary
        print("\n[3/7] Probando llamada a 'get_runner_summary'...")
        summary_res = send_rpc(
            proc,
            "tools/call",
            {"name": "get_runner_summary", "arguments": {}},
            req_id=3,
        )
        content_text = summary_res["result"]["content"][0]["text"]
        summary_data = json.loads(content_text)
        print(f" -> Semana actual: {summary_data['current_week']['start']} a {summary_data['current_week']['end']}")
        print(f" -> Volumen km: {summary_data['current_week']['volume_km']} km en {summary_data['current_week']['sessions']} sesiones")
        print(f" -> Plan activo detectado: {summary_data.get('active_plan', {}).get('name')}")
        print(f" -> Calzado activo: {len(summary_data.get('shoes', []))} pares")

        # 4. Probar calculadoras deportivas (VDOT, Riegel, Karvonen)
        print("\n[4/7] Probando herramientas de ciencia deportiva...")
        vdot_res = send_rpc(
            proc,
            "tools/call",
            {
                "name": "calculate_vdot_and_paces",
                "arguments": {"distance_meters": 10000, "time_formatted": "45:00"},
            },
            req_id=4,
        )
        vdot_data = json.loads(vdot_res["result"]["content"][0]["text"])
        print(f" -> VDOT calculado para 10K en 45:00: {vdot_data['vdot']}")
        print(f" -> Ritmo Fácil (Z2): {vdot_data['training_paces']['easy_pace_range']}")
        print(f" -> Ritmo Umbral: {vdot_data['training_paces']['threshold_pace']}")
        assert vdot_data["vdot"] > 44, "VDOT no coincide con el rango esperado"

        riegel_res = send_rpc(
            proc,
            "tools/call",
            {
                "name": "predict_race_time",
                "arguments": {
                    "source_distance_meters": 10000,
                    "source_time_formatted": "45:00",
                    "target_distance_meters": 21097.5,
                },
            },
            req_id=5,
        )
        riegel_data = json.loads(riegel_res["result"]["content"][0]["text"])
        print(f" -> Predicción 21.1K según Riegel: {riegel_data['predicted_time']} (ritmo: {riegel_data['predicted_pace']})")

        karvonen_res = send_rpc(
            proc,
            "tools/call",
            {
                "name": "calculate_heart_rate_zones",
                "arguments": {"resting_hr": 52, "max_hr": 192},
            },
            req_id=6,
        )
        karvonen_data = json.loads(karvonen_res["result"]["content"][0]["text"])
        print(f" -> Z2 Karvonen: {karvonen_data['zones']['Z2_aerobic_base']['bpm_range']}")

        # 5. Probar list_shoes con métricas de vida útil
        print("\n[5/7] Probando 'list_shoes'...")
        shoes_res = send_rpc(
            proc,
            "tools/call",
            {"name": "list_shoes", "arguments": {}},
            req_id=7,
        )
        shoes_data = json.loads(shoes_res["result"]["content"][0]["text"])
        print(f" -> Zapatillas listadas: {shoes_data['count']}")
        for s in shoes_data["shoes"]:
            print(f"    - {s['name']} ({s.get('brand')} {s.get('model')}): {s['km_accumulated']} km acumulados")

        # 6. Probar acción: update_weekly_goals
        print("\n[6/7] Probando Acción: 'update_weekly_goals'...")
        update_goals_res = send_rpc(
            proc,
            "tools/call",
            {
                "name": "update_weekly_goals",
                "arguments": {
                    "target_km": 42.5,
                    "target_sessions": 4,
                    "target_long_run_km": 18.0,
                },
            },
            req_id=8,
        )
        goals_data = json.loads(update_goals_res["result"]["content"][0]["text"])
        print(f" -> Respuesta de actualización: {goals_data['message']}")

        # Verificar que se persistió en la API
        get_goals_res = send_rpc(
            proc,
            "tools/call",
            {"name": "get_weekly_goals", "arguments": {}},
            req_id=9,
        )
        persisted_goals = json.loads(get_goals_res["result"]["content"][0]["text"])
        assert persisted_goals["goals"]["target_km"] == 42.5
        print(f" -> Verificado en DB: Meta = {persisted_goals['goals']['target_km']} km, {persisted_goals['goals']['target_sessions']} sesiones")

        # 7. Probar acción: create_race y posterior list_races
        print("\n[7/7] Probando Acción: 'create_race'...")
        race_res = send_rpc(
            proc,
            "tools/call",
            {
                "name": "create_race",
                "arguments": {
                    "event_name": "Media Maratón Test MCP",
                    "date": "2026-11-15T07:30:00Z",
                    "distance_km": 21.1,
                    "priority": "A",
                    "target_time_formatted": "1:38:00",
                    "location": "Buenos Aires",
                    "notes": "Prueba creada por el servidor MCP",
                },
            },
            req_id=10,
        )
        race_data = json.loads(race_res["result"]["content"][0]["text"])
        created_race = race_data["race"]
        race_id = created_race["id"]
        print(f" -> Carrera creada: {created_race['event_name']} (ID: {race_id}) con prioridad {created_race['priority']}")

        # Limpiar la carrera de prueba
        from client import OpenRunningClient
        cleaner = OpenRunningClient()
        cleaner.delete_race(race_id)
        print(" -> Carrera de prueba eliminada tras verificación limpia.")

        print("\n" + "=" * 60)
        print("¡TODAS LAS PRUEBAS DEL SERVIDOR MCP PASARON EXITOSAMENTE!")
        print("=" * 60)

    finally:
        proc.terminate()
        proc.wait(timeout=3)


if __name__ == "__main__":
    main()
