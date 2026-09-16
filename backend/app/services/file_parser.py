import math
from datetime import datetime, timezone
from typing import Any

import gpxpy
import polyline
from pydantic import BaseModel


class ParsedActivityData(BaseModel):
    name: str
    timestamp: datetime
    distance_meters: float
    elapsed_time_seconds: float
    moving_time_seconds: float
    avg_hr: float | None = None
    max_hr: float | None = None
    elevation_gain: float | None = None
    polyline_str: str | None = None
    splits: list[dict[str, Any]] = []


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates haversine distance in meters between two lat/lon pairs."""
    r = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def parse_gpx_file(content_bytes: bytes, filename: str = "Carrera GPX") -> ParsedActivityData:
    """Parses a GPX file into ParsedActivityData."""
    content_str = content_bytes.decode("utf-8", errors="ignore")
    gpx = gpxpy.parse(content_str)

    coords: list[tuple[float, float]] = []
    hr_values: list[int] = []
    total_distance_m = 0.0
    total_elevation_gain = 0.0

    points_data: list[dict[str, Any]] = []

    for track in gpx.tracks:
        for segment in track.segments:
            prev_point = None
            for point in segment.points:
                coords.append((point.latitude, point.longitude))

                # Extract HR from extensions if present
                point_hr = None
                if point.extensions:
                    for ext in point.extensions:
                        if "hr" in ext.tag.lower() or "heartrate" in ext.tag.lower():
                            try:
                                point_hr = int(ext.text)
                                hr_values.append(point_hr)
                            except (ValueError, TypeError):
                                pass

                if prev_point:
                    dist = haversine_distance_m(
                        prev_point.latitude,
                        prev_point.longitude,
                        point.latitude,
                        point.longitude,
                    )
                    total_distance_m += dist

                    if point.elevation is not None and prev_point.elevation is not None:
                        ele_diff = point.elevation - prev_point.elevation
                        if ele_diff > 0:
                            total_elevation_gain += ele_diff

                points_data.append(
                    {
                        "lat": point.latitude,
                        "lon": point.longitude,
                        "ele": point.elevation,
                        "time": point.time,
                        "hr": point.hr if hasattr(point, "hr") else point_hr,
                    }
                )
                prev_point = point

    # Start time
    start_time = points_data[0]["time"] if points_data and points_data[0]["time"] else datetime.now(timezone.utc)
    end_time = points_data[-1]["time"] if points_data and points_data[-1]["time"] else start_time

    elapsed_secs = max(1.0, (end_time - start_time).total_seconds()) if (end_time and start_time) else 1.0

    encoded_polyline = polyline.encode(coords) if coords else None

    avg_hr = sum(hr_values) / len(hr_values) if hr_values else None
    max_hr = max(hr_values) if hr_values else None

    # Derive 1km splits
    splits = []
    current_split_dist = 0.0
    split_start_time = start_time
    split_num = 1

    for idx in range(1, len(points_data)):
        p1 = points_data[idx - 1]
        p2 = points_data[idx]
        d = haversine_distance_m(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
        current_split_dist += d

        if current_split_dist >= 1000 or idx == len(points_data) - 1:
            split_end_time = p2["time"] or split_start_time
            split_secs = max(1.0, (split_end_time - split_start_time).total_seconds())
            splits.append(
                {
                    "split_number": split_num,
                    "distance_meters": round(current_split_dist, 1),
                    "elapsed_seconds": round(split_secs, 1),
                    "avg_pace_sec_km": round((split_secs / current_split_dist) * 1000, 1) if current_split_dist > 0 else 0,
                }
            )
            split_num += 1
            current_split_dist = 0.0
            split_start_time = split_end_time

    activity_name = gpx.tracks[0].name if gpx.tracks and gpx.tracks[0].name else filename.replace(".gpx", "").replace(".fit", "").title()

    return ParsedActivityData(
        name=activity_name or "Carrera GPX",
        timestamp=start_time,
        distance_meters=round(total_distance_m, 1),
        elapsed_time_seconds=round(elapsed_secs, 1),
        moving_time_seconds=round(elapsed_secs, 1),
        avg_hr=round(avg_hr, 1) if avg_hr else None,
        max_hr=round(max_hr) if max_hr else None,
        elevation_gain=round(total_elevation_gain, 1) if total_elevation_gain > 0 else None,
        polyline_str=encoded_polyline,
        splits=splits,
    )


def parse_fit_file(content_bytes: bytes, filename: str = "Carrera FIT") -> ParsedActivityData:
    """Parses a binary FIT file into ParsedActivityData."""
    import fitparse

    fitfile = fitparse.FitFile(content_bytes)

    coords: list[tuple[float, float]] = []
    hr_values: list[int] = []
    total_distance_m = 0.0
    total_elevation_gain = 0.0
    start_time: datetime | None = None
    end_time: datetime | None = None

    records = list(fitfile.get_messages("record"))

    semicircles_to_deg = 180.0 / (2**31)

    for record in records:
        record_dict = {field.name: field.value for field in record.fields}

        # Timestamp
        ts = record_dict.get("timestamp")
        if ts and isinstance(ts, datetime):
            if not start_time:
                start_time = ts
            end_time = ts

        # Coords
        lat_semi = record_dict.get("position_lat")
        lon_semi = record_dict.get("position_long")
        if lat_semi is not None and lon_semi is not None:
            lat = lat_semi * semicircles_to_deg
            lon = lon_semi * semicircles_to_deg
            coords.append((lat, lon))

        # Heart rate
        hr = record_dict.get("heart_rate")
        if hr and isinstance(hr, (int, float)):
            hr_values.append(int(hr))

        # Distance
        dist = record_dict.get("distance")
        if dist and isinstance(dist, (int, float)):
            total_distance_m = max(total_distance_m, float(dist))

        # Altitude / elevation gain
        alt = record_dict.get("altitude")
        if alt and isinstance(alt, (int, float)):
            pass  # optional alt tracking

    if not start_time:
        start_time = datetime.now(timezone.utc)
    if not end_time:
        end_time = start_time

    elapsed_secs = max(1.0, (end_time - start_time).total_seconds())
    encoded_polyline = polyline.encode(coords) if coords else None

    avg_hr = sum(hr_values) / len(hr_values) if hr_values else None
    max_hr = max(hr_values) if hr_values else None

    activity_name = filename.replace(".fit", "").replace(".gpx", "").replace("_", " ").title()

    return ParsedActivityData(
        name=activity_name or "Carrera FIT",
        timestamp=start_time,
        distance_meters=round(total_distance_m, 1),
        elapsed_time_seconds=round(elapsed_secs, 1),
        moving_time_seconds=round(elapsed_secs, 1),
        avg_hr=round(avg_hr, 1) if avg_hr else None,
        max_hr=round(max_hr) if max_hr else None,
        elevation_gain=round(total_elevation_gain, 1) if total_elevation_gain > 0 else None,
        polyline_str=encoded_polyline,
        splits=[],
    )
