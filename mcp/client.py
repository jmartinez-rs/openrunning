"""
Cliente API para conectar el servidor MCP con el backend de OpenRunning.
"""

import os
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx


class OpenRunningAPIError(Exception):
    """Excepción para errores devueltos por la API de OpenRunning."""
    def __init__(self, status_code: int, detail: Any):
        super().__init__(f"Error de OpenRunning [{status_code}]: {detail}")
        self.status_code = status_code
        self.detail = detail


class OpenRunningClient:
    """Cliente HTTP autenticado para la API REST de OpenRunning."""

    def __init__(
        self,
        base_url: str | None = None,
        email: str | None = None,
        password: str | None = None,
        access_token: str | None = None,
        timeout: float = 15.0,
    ):
        self.base_url = (
            base_url
            or os.getenv("OPENRUNNING_API_URL")
            or "http://localhost:8001/api/v1"
        ).rstrip("/")
        self.email = email or os.getenv("OPENRUNNING_EMAIL") or "admin@example.com"
        self.password = password or os.getenv("OPENRUNNING_PASSWORD") or "changethis"
        self.access_token = access_token or os.getenv("OPENRUNNING_ACCESS_TOKEN")
        self.timeout = timeout
        self._http = httpx.Client(timeout=self.timeout)

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def authenticate(self) -> str:
        """Autentica con email y contraseña en /login/access-token y almacena el token."""
        login_url = f"{self.base_url}/login/access-token"
        response = self._http.post(
            login_url,
            data={"username": self.email, "password": self.password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            raise OpenRunningAPIError(
                response.status_code,
                f"Fallo de autenticación en {login_url}: {response.text}",
            )
        data = response.json()
        self.access_token = data["access_token"]
        return self.access_token

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json_data: Any | None = None,
        retry_on_auth_failure: bool = True,
    ) -> Any:
        if not self.access_token:
            self.authenticate()

        url = f"{self.base_url}/{path.lstrip('/')}"
        response = self._http.request(
            method=method,
            url=url,
            params=params,
            json=json_data,
            headers=self._get_headers(),
        )

        # Si el token expiró, reintentar una vez
        if response.status_code == 401 and retry_on_auth_failure:
            self.authenticate()
            response = self._http.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=self._get_headers(),
            )

        if response.status_code not in (200, 201, 204):
            try:
                err_detail = response.json().get("detail", response.text)
            except Exception:  # noqa: BLE001
                err_detail = response.text
            raise OpenRunningAPIError(response.status_code, err_detail)

        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    # -------------------------------------------------------------------------
    # Dashboard & Metas
    # -------------------------------------------------------------------------

    def get_dashboard(self, week_start: str | None = None) -> dict[str, Any]:
        """
        Obtiene el dashboard semanal. Si no se pasa week_start, se calcula el lunes actual.
        """
        if not week_start:
            today = datetime.now(UTC).date()
            monday = today - timedelta(days=today.weekday())
            week_start = monday.isoformat()

        return self._request("GET", "/analytics/dashboard", params={"week_start": week_start})

    def get_weekly_goals(self) -> dict[str, Any]:
        """Consulta los objetivos semanales y conexiones de integración."""
        return self._request("GET", "/settings/")

    def update_weekly_goals(
        self,
        target_km: float | None = None,
        target_sessions: int | None = None,
        target_long_run_km: float | None = None,
    ) -> dict[str, Any]:
        """Actualiza los objetivos semanales."""
        payload: dict[str, Any] = {}
        if target_km is not None:
            payload["target_km"] = target_km
        if target_sessions is not None:
            payload["target_sessions"] = target_sessions
        if target_long_run_km is not None:
            payload["target_long_run_km"] = target_long_run_km

        return self._request("PUT", "/settings/goals", json_data=payload)

    # -------------------------------------------------------------------------
    # Planes de Running & Sesiones
    # -------------------------------------------------------------------------

    def get_plans(self) -> list[dict[str, Any]]:
        """Lista todos los planes de running del usuario."""
        res = self._request("GET", "/running-plans/")
        return res.get("data", [])

    def get_plan(self, plan_id: str) -> dict[str, Any]:
        """Obtiene el detalle completo de un plan (fases, semanas, sesiones)."""
        return self._request("GET", f"/running-plans/{plan_id}")

    def get_active_plan(self) -> dict[str, Any] | None:
        """
        Devuelve el plan de running activo con su estructura completa.
        Si hay más de uno activo, devuelve el primero.
        """
        plans = self.get_plans()
        active = [p for p in plans if p.get("status") == "active"]
        if not active:
            # Si no hay activo pero hay planes, tomar el más reciente
            if plans:
                return self.get_plan(plans[0]["id"])
            return None
        return self.get_plan(active[0]["id"])

    def create_plan(self, plan_data: dict[str, Any]) -> dict[str, Any]:
        """Crea un nuevo plan de running estructurado."""
        return self._request("POST", "/running-plans/", json_data=plan_data)

    def update_workout(
        self,
        plan_id: str,
        workout_id: str,
        update_data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Actualiza los parámetros de una sesión de entrenamiento.
        Campos soportados: date, cancelled, status_override ('completed'|'missed'),
        distance_km, duration_seconds, pace_seconds_per_km, name, objective, notes, intensity.
        """
        return self._request(
            "PATCH",
            f"/running-plans/{plan_id}/workouts/{workout_id}",
            json_data=update_data,
        )

    def duplicate_workout(
        self,
        plan_id: str,
        workout_id: str,
        target_date: str | None = None,
    ) -> dict[str, Any]:
        """Duplica una sesión hacia otra fecha (por defecto +7 días)."""
        payload = {"date": target_date} if target_date else None
        return self._request(
            "POST",
            f"/running-plans/{plan_id}/workouts/{workout_id}/duplicate",
            json_data=payload,
        )

    def delete_plan(self, plan_id: str) -> dict[str, Any]:
        """Elimina un plan de running."""
        return self._request("DELETE", f"/running-plans/{plan_id}")

    # -------------------------------------------------------------------------
    # Actividades
    # -------------------------------------------------------------------------

    def get_activities(
        self,
        limit: int = 20,
        skip: int = 0,
        source_type: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
    ) -> list[dict[str, Any]]:
        """Lista actividades con soporte de filtros."""
        params: dict[str, Any] = {"limit": limit, "skip": skip}
        if source_type:
            params["source_type"] = source_type
        if from_date:
            params["from_date"] = from_date
        if to_date:
            params["to_date"] = to_date

        res = self._request("GET", "/activities/", params=params)
        return res.get("data", [])

    def get_activity_cardio(self, activity_id: str) -> dict[str, Any]:
        """Obtiene las métricas cardio completas (splits, HR zones, calzado, etc.)."""
        return self._request("GET", f"/activities/cardio/{activity_id}")

    def create_activity(self, activity_data: dict[str, Any]) -> dict[str, Any]:
        """Crea una nueva actividad manual."""
        return self._request("POST", "/activities/", json_data=activity_data)

    def assign_shoe_to_activity(
        self,
        activity_id: str,
        shoe_id: str | None,
    ) -> dict[str, Any]:
        """Asigna o desasigna un calzado a una actividad."""
        return self._request(
            "PATCH",
            f"/activities/{activity_id}/shoe",
            json_data={"shoe_id": shoe_id},
        )

    def delete_activity(self, activity_id: str) -> dict[str, Any]:
        """Elimina una actividad."""
        return self._request("DELETE", f"/activities/{activity_id}")

    # -------------------------------------------------------------------------
    # Zapatillas (Shoes)
    # -------------------------------------------------------------------------

    def get_shoes(
        self,
        category: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        """Lista el calzado del corredor."""
        params: dict[str, Any] = {}
        if category:
            params["category"] = category
        if search:
            params["search"] = search
        res = self._request("GET", "/shoes/", params=params)
        return res.get("data", [])

    def get_shoe_stats(self, shoe_id: str) -> dict[str, Any]:
        """Obtiene estadísticas de kilometraje, ritmo medio y carreras con este calzado."""
        return self._request("GET", f"/shoes/{shoe_id}/stats")

    def create_shoe(self, shoe_data: dict[str, Any]) -> dict[str, Any]:
        """Registra un nuevo par de zapatillas."""
        return self._request("POST", "/shoes/", json_data=shoe_data)

    def update_shoe(self, shoe_id: str, update_data: dict[str, Any]) -> dict[str, Any]:
        """Actualiza información de la zapatilla (ej. objetivo de km, notas, estado activo)."""
        return self._request("PUT", f"/shoes/{shoe_id}", json_data=update_data)

    def delete_shoe(self, shoe_id: str) -> dict[str, Any]:
        """Elimina una zapatilla."""
        return self._request("DELETE", f"/shoes/{shoe_id}")

    # -------------------------------------------------------------------------
    # Carreras (Races)
    # -------------------------------------------------------------------------

    def get_races(
        self,
        distance_km: float | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        """Lista las carreras del usuario."""
        params: dict[str, Any] = {}
        if distance_km is not None:
            params["distance_km"] = distance_km
        if search:
            params["search"] = search
        res = self._request("GET", "/races/", params=params)
        return res.get("data", [])

    def create_race(self, race_data: dict[str, Any]) -> dict[str, Any]:
        """Registra una carrera en el calendario."""
        return self._request("POST", "/races/", json_data=race_data)

    def update_race(self, race_id: str, race_data: dict[str, Any]) -> dict[str, Any]:
        """Actualiza una carrera (marca objetivo o resultado oficial)."""
        return self._request("PUT", f"/races/{race_id}", json_data=race_data)

    def delete_race(self, race_id: str) -> dict[str, Any]:
        """Elimina una carrera."""
        return self._request("DELETE", f"/races/{race_id}")

    # -------------------------------------------------------------------------
    # Sincronización
    # -------------------------------------------------------------------------

    def get_sync_status(self) -> dict[str, Any]:
        """Consulta el estado de la integración de sincronización y los últimos registros."""
        status = self._request("GET", "/sync/status")
        try:
            logs = self._request("GET", "/sync/logs", params={"limit": 5})
        except Exception:  # noqa: BLE001
            logs = {"data": []}
        return {"status": status, "recent_logs": logs.get("data", [])}

    def trigger_strava_sync(self) -> dict[str, Any]:
        """Dispara una sincronización manual con Strava."""
        return self._request("POST", "/sync/strava")
