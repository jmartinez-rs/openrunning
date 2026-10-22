"""Tests for weather forecast endpoint (M5)."""

import datetime as dt
from fastapi.testclient import TestClient

from app.models import WeatherForecastPublic


def test_weather_endpoint_returns_forecast_and_apparel(client: TestClient):
    resp = client.get("/api/v1/weather?date=2026-10-22&latitude=-34.60&longitude=-58.38")
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["date"] == "2026-10-22"
    assert "temperature_min_c" in data
    assert "temperature_max_c" in data
    assert "condition" in data
    assert "apparel_recommendation" in data
    assert len(data["apparel_recommendation"]) > 5
