from datetime import UTC, date, datetime, time, timedelta

from fastapi import APIRouter, Query
from sqlmodel import col, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Activity,
    ActivityCardio,
    ActivitySummaryCalendarDay,
    ActivitySummaryMonthly,
    ActivitySummaryPublic,
    ActivityTypeSummary,
    AuthToken,
    CardioAnalyticsPublic,
    DashboardActivity,
    DashboardDay,
    DashboardKPIs,
    DashboardPublic,
    HrTrendPoint,
    HrTrendPublic,
    HrZonesPublic,
    Race,
    SyncLog,
    SyncStateEntry,
    UpcomingRacePublic,
    WeeklyGoal,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/cardio", response_model=CardioAnalyticsPublic)
def read_cardio_analytics(
    session: SessionDep,
    current_user: CurrentUser,
    from_date: date | None = None,
    to_date: date | None = None,
) -> CardioAnalyticsPublic:
    filters = [Activity.user_id == current_user.id]
    if from_date:
        filters.append(Activity.timestamp >= datetime.combine(from_date, time.min))
    if to_date:
        filters.append(
            Activity.timestamp < datetime.combine(to_date + timedelta(days=1), time.min)
        )
    activities = session.exec(select(Activity).where(*filters)).all()
    ids = [activity.id for activity in activities]
    metrics = (
        session.exec(
            select(ActivityCardio).where(col(ActivityCardio.activity_id).in_(ids))
        ).all()
        if ids
        else []
    )
    by_activity = {metric.activity_id: metric for metric in metrics}
    distance = sum(metric.distance_meters for metric in metrics)
    duration = sum(
        activity.duration_seconds
        for activity in activities
        if activity.id in by_activity
    )
    return CardioAnalyticsPublic(
        from_date=from_date,
        to_date=to_date,
        distance_meters=distance,
        duration_seconds=duration,
        average_pace_seconds_per_km=duration / (distance / 1000) if distance else None,
        sessions=len(metrics),
    )


def _week_bounds(week_start: date) -> tuple[datetime, datetime]:
    start = datetime.combine(week_start, time.min, tzinfo=UTC)
    return start, start + timedelta(days=7)


@router.get("/dashboard", response_model=DashboardPublic)
def read_dashboard(
    session: SessionDep,
    current_user: CurrentUser,
    week_start: date = Query(..., description="Monday that starts the requested week"),
) -> DashboardPublic:
    kpis, timeline = _compute_week_kpis(session, current_user.id, week_start)
    previous_kpis, _ = _compute_week_kpis(
        session, current_user.id, week_start - timedelta(days=7)
    )

    tokens = session.exec(
        select(AuthToken).where(AuthToken.user_id == current_user.id)
    ).all()
    connected = {token.provider for token in tokens}

    logs = session.exec(
        select(SyncLog)
        .where(SyncLog.user_id == current_user.id)
        .order_by(col(SyncLog.started_at).desc())
        .limit(100)
    ).all()
    last_by_provider: dict[str, SyncLog] = {}
    for log in logs:
        if log.provider not in last_by_provider:
            last_by_provider[log.provider] = log

    sync_state = [
        SyncStateEntry(
            provider="strava",
            connected="strava" in connected,
            last_status=last_by_provider["strava"].status
            if "strava" in last_by_provider
            else None,
            last_message=str(last_by_provider["strava"].details.get("message") or "")
            if "strava" in last_by_provider
            and isinstance(last_by_provider["strava"].details, dict)
            else None,
            last_run_at=last_by_provider["strava"].completed_at
            if "strava" in last_by_provider
            else None,
        )
    ]

    upcoming = session.exec(
        select(Race)
        .where(
            Race.user_id == current_user.id,
            Race.date >= datetime.now(UTC),
        )
        .order_by(col(Race.date))
    ).first()
    upcoming_race = (
        UpcomingRacePublic(
            id=upcoming.id,
            event_name=upcoming.event_name,
            date=upcoming.date,
            location=upcoming.location,
            distance_km=upcoming.distance_km,
        )
        if upcoming
        else None
    )

    return DashboardPublic(
        week_start=week_start,
        week_end=week_start + timedelta(days=6),
        kpis=kpis,
        timeline=timeline,
        upcoming_race=upcoming_race,
        previous_kpis=previous_kpis,
        sync_state=sync_state,
    )


def _compute_week_kpis(
    session: SessionDep, user_id: object, week_start: date
) -> tuple[DashboardKPIs, list[DashboardDay]]:
    """Calcula KPIs y timeline para una semana que comienza en week_start."""
    start, end = _week_bounds(week_start)
    activities = session.exec(
        select(Activity)
        .where(
            Activity.user_id == user_id,
            Activity.timestamp >= start,
            Activity.timestamp < end,
        )
        .order_by(col(Activity.timestamp))
    ).all()

    activity_ids = [activity.id for activity in activities]
    cardio_by_activity = (
        {
            metric.activity_id: metric
            for metric in session.exec(
                select(ActivityCardio).where(
                    col(ActivityCardio.activity_id).in_(activity_ids)
                )
            ).all()
        }
        if activity_ids
        else {}
    )

    cardio_distance = sum(
        metric.distance_meters for metric in cardio_by_activity.values()
    )
    cardio_duration = sum(
        activity.duration_seconds
        for activity in activities
        if activity.id in cardio_by_activity
    )
    cardio_pace = (
        cardio_duration / (cardio_distance / 1000) if cardio_distance else None
    )

    timeline_by_day: dict[date, list[DashboardActivity]] = {
        week_start + timedelta(days=offset): [] for offset in range(7)
    }
    for activity in activities:
        day = activity.timestamp.astimezone(UTC).date()
        cardio = cardio_by_activity.get(activity.id)
        timeline_by_day[day].append(
            DashboardActivity(
                id=activity.id,
                timestamp=activity.timestamp,
                name=activity.name,
                source_type=activity.source_type,
                duration_seconds=activity.duration_seconds,
                distance_meters=cardio.distance_meters if cardio else None,
            )
        )

    kpis = DashboardKPIs(
        cardio_distance_meters=cardio_distance,
        cardio_duration_seconds=cardio_duration,
        cardio_avg_pace_seconds_per_km=cardio_pace,
        sessions=len(activities),
        active_days=sum(
            bool(day_activities) for day_activities in timeline_by_day.values()
        ),
    )
    timeline = [
        DashboardDay(date=day, activities=day_activities)
        for day, day_activities in timeline_by_day.items()
    ]
    return kpis, timeline


@router.get("/cardio/monthly")
def read_cardio_monthly(
    session: SessionDep, current_user: CurrentUser, months: int = 12
) -> list[dict[str, object]]:
    """Serie mensual de volumen cardio (distancia, desnivel y sesiones)."""
    start = datetime.combine(
        date.today().replace(day=1), time.min, tzinfo=UTC
    ) - timedelta(days=months * 31)
    rows = session.exec(
        select(Activity, ActivityCardio)
        .join(ActivityCardio)
        .where(
            Activity.user_id == current_user.id,
            Activity.source_type == "strava",
            Activity.timestamp >= start,
        )
        .order_by(col(Activity.timestamp))
    ).all()

    buckets: dict[str, dict[str, float]] = {}
    for activity, cardio in rows:
        key = activity.timestamp.astimezone(UTC).strftime("%Y-%m")
        bucket = buckets.setdefault(
            key, {"distance_meters": 0.0, "elevation_gain_meters": 0.0, "sessions": 0.0}
        )
        bucket["distance_meters"] += cardio.distance_meters
        bucket["elevation_gain_meters"] += cardio.elevation_gain_meters
        bucket["sessions"] += 1

    return [
        {
            "month": key,
            "distance_meters": round(float(value["distance_meters"]), 2),
            "elevation_gain_meters": round(float(value["elevation_gain_meters"]), 2),
            "sessions": int(value["sessions"]),
        }
        for key, value in sorted(buckets.items())
    ]


@router.get("/cardio/best-paces")
def read_cardio_best_paces(
    session: SessionDep, current_user: CurrentUser
) -> list[dict[str, object]]:
    """Mejor ritmo promedio por distancia objetivo (5k, 10k, 15k, 21.1k, 42.2k)."""
    targets = [(5.0, "5k"), (10.0, "10k"), (15.0, "15k"), (21.1, "21k"), (42.2, "42k")]
    rows = session.exec(
        select(Activity, ActivityCardio)
        .join(ActivityCardio)
        .where(Activity.user_id == current_user.id, Activity.source_type == "strava")
        .order_by(col(Activity.timestamp))
    ).all()

    results: list[dict[str, object]] = []
    for target_km, label in targets:
        best: dict[str, object] | None = None
        for activity, cardio in rows:
            distance_km = cardio.distance_meters / 1000
            if activity.duration_seconds <= 0:
                continue
            if abs(distance_km - target_km) > target_km * 0.08:
                continue
            pace = activity.duration_seconds / distance_km
            if best is None or pace < float(str(best["pace_seconds_per_km"])):
                best = {
                    "distance_label": label,
                    "pace_seconds_per_km": round(pace, 2),
                    "date": activity.timestamp.astimezone(UTC).isoformat(),
                    "activity_name": activity.name,
                }
        if best:
            results.append(best)
    return results


@router.get("/cardio/hr-zones", response_model=HrZonesPublic)
def read_cardio_hr_zones(
    session: SessionDep, current_user: CurrentUser, weeks: int = 12
) -> HrZonesPublic:
    """Tiempo por zona de FC por semana (últimas N semanas)."""
    start = datetime.now(UTC) - timedelta(days=weeks * 7)
    rows = session.exec(
        select(Activity, ActivityCardio)
        .join(ActivityCardio)
        .where(
            Activity.user_id == current_user.id,
            Activity.source_type == "strava",
            Activity.timestamp >= start,
        )
        .order_by(col(Activity.timestamp))
    ).all()

    # Zonas estándar de FC (5 zonas).
    zone_defs = [
        (1, "Z1", 0, 120),
        (2, "Z2", 120, 140),
        (3, "Z3", 140, 160),
        (4, "Z4", 160, 180),
        (5, "Z5", 180, 999),
    ]

    weekly: dict[str, dict[int, int]] = {}
    for activity, cardio in rows:
        zones = cardio.heart_rate_zones
        if not isinstance(zones, list) or not zones:
            continue
        week = activity.timestamp.astimezone(UTC).strftime("%G-W%V")
        bucket = weekly.setdefault(week, dict.fromkeys(range(1, 6), 0))
        for raw in zones:
            if not isinstance(raw, dict):
                continue
            zmin = _to_float_analytic(raw.get("min"))
            zmax = _to_float_analytic(raw.get("max"))
            seconds = _to_int_analytic(raw.get("time")) or 0
            if zmin is None or zmax is None:
                continue
            for zone, _, lo, hi in zone_defs:
                if zmin >= lo and zmax <= hi:
                    bucket[zone] += seconds
                    break

    result = []
    for week in sorted(weekly.keys()):
        result.append(
            {
                "week": week,
                "zones": [
                    {"zone": z, "label": label, "seconds": weekly[week][z]}
                    for z, label, _, _ in zone_defs
                ],
            }
        )
    return HrZonesPublic(weeks=result)


@router.get("/cardio/hr-trend", response_model=HrTrendPublic)
def read_cardio_hr_trend(
    session: SessionDep, current_user: CurrentUser, weeks: int = 12
) -> HrTrendPublic:
    """FC media y máxima por semana."""
    start = datetime.now(UTC) - timedelta(days=weeks * 7)
    rows = session.exec(
        select(Activity, ActivityCardio)
        .join(ActivityCardio)
        .where(
            Activity.user_id == current_user.id,
            Activity.source_type == "strava",
            Activity.timestamp >= start,
        )
        .order_by(col(Activity.timestamp))
    ).all()

    weekly: dict[str, dict[str, float]] = {}
    for activity, cardio in rows:
        week = activity.timestamp.astimezone(UTC).strftime("%G-W%V")
        bucket = weekly.setdefault(week, {"sum_hr": 0.0, "count": 0.0, "max_hr": 0.0})
        if cardio.avg_hr:
            bucket["sum_hr"] += cardio.avg_hr
            bucket["count"] += 1
        if cardio.max_hr:
            bucket["max_hr"] = max(bucket["max_hr"], float(cardio.max_hr))

    data = [
        HrTrendPoint(
            week=week,
            avg_hr=round(bucket["sum_hr"] / bucket["count"], 1)
            if bucket["count"]
            else None,
            max_hr=round(bucket["max_hr"], 1) if bucket["max_hr"] else None,
        )
        for week, bucket in sorted(weekly.items())
    ]
    return HrTrendPublic(data=data)


def _to_float_analytic(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _to_int_analytic(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None


# Mapeo de sport_type de Strava a categorías de resumen.
_SPORT_CATEGORY = {
    "Run": "running",
    "TrailRun": "running",
    "VirtualRun": "running",
    "Ride": "cycling",
    "VirtualRide": "cycling",
    "Walk": "walking",
    "Hike": "walking",
    "Swim": "swimming",
}


def _sport_category(sport_type: str) -> str:
    return _SPORT_CATEGORY.get(sport_type, "other")


@router.get("/activities/summary", response_model=ActivitySummaryPublic)
def read_activities_summary(
    session: SessionDep,
    current_user: CurrentUser,
    month: str | None = Query(default=None, description="Mes en formato YYYY-MM"),
) -> ActivitySummaryPublic:
    """Resumen mensual de actividades cardio de Strava por tipo.

    - by_type agrupa por sport_type (Run, Ride, Walk, ...).
    - coverage es la fracción de actividades del período con sport_type no nulo.
    - monthly.target_activities es una PROYECCIÓN de la meta semanal existente
      multiplicada por ~4.33 semanas/mes.
    - calendar incluye todos los días del mes (con types vacío si no hubo
      actividad).
    """
    import calendar as _calendar

    if month:
        try:
            year, month_num = (int(part) for part in month.split("-"))
            period_start = date(year, month_num, 1)
        except ValueError:
            period_start = date.today().replace(day=1)
    else:
        period_start = date.today().replace(day=1)

    period_end = period_start.replace(
        day=_calendar.monthrange(period_start.year, period_start.month)[1]
    )
    month_key = period_start.strftime("%Y-%m")

    start_dt = datetime.combine(period_start, time.min, tzinfo=UTC)
    end_dt = datetime.combine(period_end, time.max, tzinfo=UTC)

    rows = session.exec(
        select(Activity, ActivityCardio)
        .join(ActivityCardio)
        .where(
            Activity.user_id == current_user.id,
            Activity.source_type == "strava",
            Activity.timestamp >= start_dt,
            Activity.timestamp <= end_dt,
        )
        .order_by(col(Activity.timestamp))
    ).all()

    total_activities = len(rows)
    with_sport_type = sum(1 for activity, _ in rows if activity.sport_type)
    coverage = with_sport_type / total_activities if total_activities else 0.0

    buckets: dict[str, list[tuple[Activity, ActivityCardio]]] = {}
    calendar_by_day: dict[str, list[str]] = {}
    for activity, cardio in rows:
        sport_type = activity.sport_type or "Other"
        day = activity.timestamp.astimezone(UTC).strftime("%Y-%m-%d")
        calendar_by_day.setdefault(day, [])
        if sport_type not in calendar_by_day[day]:
            calendar_by_day[day].append(sport_type)
        buckets.setdefault(sport_type, []).append((activity, cardio))

    by_type = []
    for sport_type, items in sorted(buckets.items()):
        count = len(items)
        distance = sum(cardio.distance_meters for _, cardio in items)
        duration = sum(activity.duration_seconds for activity, _ in items)
        elevation = sum(cardio.elevation_gain_meters for _, cardio in items)
        dot_days = sorted(
            {
                activity.timestamp.astimezone(UTC).strftime("%Y-%m-%d")
                for activity, _ in items
            }
        )
        by_type.append(
            ActivityTypeSummary(
                type=sport_type,
                category=_sport_category(sport_type),
                count=count,
                distance_meters=round(distance, 2),
                duration_seconds=duration,
                elevation_gain_meters=round(elevation, 2),
                avg_distance_meters=round(distance / count, 2) if count else 0.0,
                avg_duration_seconds=round(duration / count, 2) if count else 0.0,
                avg_elevation_gain_meters=round(elevation / count, 2)
                if count
                else 0.0,
                dot_days=dot_days,
            )
        )

    # Meta mensual proyectada desde la meta semanal existente.
    weekly_goal = session.exec(
        select(WeeklyGoal).where(WeeklyGoal.user_id == current_user.id)
    ).first()
    target_activities: float | None = None
    target_source: str | None = None
    progress: float | None = None
    if weekly_goal and weekly_goal.target_km:
        target_activities = weekly_goal.target_km * 4.33
        target_source = "weekly_goal_projection"
        if target_activities:
            progress = min(1.0, total_activities / target_activities)

    calendar = [
        ActivitySummaryCalendarDay(
            date=(period_start + timedelta(days=offset)).strftime("%Y-%m-%d"),
            types=calendar_by_day.get(
                (period_start + timedelta(days=offset)).strftime("%Y-%m-%d"), []
            ),
        )
        for offset in range((period_end - period_start).days + 1)
    ]

    return ActivitySummaryPublic(
        month=month_key,
        period_start=period_start.strftime("%Y-%m-%d"),
        period_end=period_end.strftime("%Y-%m-%d"),
        total_activities=total_activities,
        coverage=round(coverage, 2),
        by_type=by_type,
        monthly=ActivitySummaryMonthly(
            total_activities=total_activities,
            target_activities=round(target_activities, 2)
            if target_activities is not None
            else None,
            target_source=target_source,
            progress=round(progress, 2) if progress is not None else None,
        ),
        calendar=calendar,
    )
