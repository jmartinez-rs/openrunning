import uuid
from statistics import mean
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import col, func, or_, select

from app.api.deps import CurrentUser, SessionDep
from app.api.routes.activities import _public_activity
from app.models import (
    Activity,
    ActivityCardio,
    Race,
    RacePublic,
    Shoe,
    ShoeActivitiesPublic,
    ShoeCategory,
    ShoeCreate,
    ShoeImportResult,
    ShoePublic,
    ShoesPublic,
    ShoeStatsPublic,
    ShoeUpdate,
)
from app.services.sync_services import import_strava_gear

router = APIRouter(prefix="/shoes", tags=["shoes"])


def _get_owned_shoe(
    session: SessionDep, user_id: uuid.UUID, shoe_id: uuid.UUID
) -> Shoe:
    shoe = session.exec(
        select(Shoe).where(Shoe.id == shoe_id, Shoe.user_id == user_id)
    ).first()
    if not shoe:
        raise HTTPException(status_code=404, detail="Zapatilla no encontrada")
    return shoe


@router.get("/", response_model=ShoesPublic)
def read_shoes(
    session: SessionDep,
    current_user: CurrentUser,
    category: ShoeCategory | None = None,
    search: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> ShoesPublic:
    filters: list[Any] = [Shoe.user_id == current_user.id]
    if category:
        filters.append(Shoe.category == category)
    if search:
        filters.append(col(Shoe.name).ilike(f"%{search}%"))
    count = session.exec(
        select(func.count()).select_from(Shoe).where(*filters)
    ).one()
    shoes = session.exec(
        select(Shoe)
        .where(*filters)
        .order_by(col(Shoe.created_at).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return ShoesPublic(
        data=[ShoePublic.model_validate(shoe) for shoe in shoes], count=count
    )


@router.post("/import-strava", response_model=ShoeImportResult)
def import_strava_shoes(
    session: SessionDep, current_user: CurrentUser
) -> ShoeImportResult:
    """Importa las zapatillas guardadas en Strava como calzado local."""
    result = import_strava_gear(session, current_user)
    return ShoeImportResult(**result)


@router.get("/{shoe_id}", response_model=ShoePublic)
def read_shoe(
    session: SessionDep, current_user: CurrentUser, shoe_id: uuid.UUID
) -> ShoePublic:
    return ShoePublic.model_validate(_get_owned_shoe(session, current_user.id, shoe_id))


@router.post("/", response_model=ShoePublic, status_code=status.HTTP_201_CREATED)
def create_shoe(
    session: SessionDep, current_user: CurrentUser, shoe_in: ShoeCreate
) -> ShoePublic:
    shoe = Shoe.model_validate(shoe_in, update={"user_id": current_user.id})
    session.add(shoe)
    session.commit()
    session.refresh(shoe)
    return ShoePublic.model_validate(shoe)


@router.put("/{shoe_id}", response_model=ShoePublic)
def update_shoe(
    session: SessionDep,
    current_user: CurrentUser,
    shoe_id: uuid.UUID,
    shoe_in: ShoeUpdate,
) -> ShoePublic:
    shoe = _get_owned_shoe(session, current_user.id, shoe_id)
    shoe.sqlmodel_update(shoe_in.model_dump(exclude_unset=True))
    session.add(shoe)
    session.commit()
    session.refresh(shoe)
    return ShoePublic.model_validate(shoe)


@router.delete("/{shoe_id}")
def delete_shoe(
    session: SessionDep, current_user: CurrentUser, shoe_id: uuid.UUID
) -> dict[str, str]:
    shoe = _get_owned_shoe(session, current_user.id, shoe_id)
    session.delete(shoe)
    session.commit()
    return {"message": "Zapatilla eliminada"}


@router.get("/{shoe_id}/stats", response_model=ShoeStatsPublic)
def read_shoe_stats(
    session: SessionDep, current_user: CurrentUser, shoe_id: uuid.UUID
) -> ShoeStatsPublic:
    shoe = _get_owned_shoe(session, current_user.id, shoe_id)

    cardio_rows = session.exec(
        select(ActivityCardio, Activity)
        .join(Activity)
        .where(
            Activity.user_id == current_user.id,
            ActivityCardio.shoe_id == shoe.id,
        )
    ).all()

    total_distance = sum(row[0].distance_meters for row in cardio_rows)
    sessions = len(cardio_rows)
    paces = [
        row[0].avg_pace_seconds_per_km
        for row in cardio_rows
        if row[0].avg_pace_seconds_per_km is not None
    ]
    hrs = [
        row[0].avg_hr for row in cardio_rows if row[0].avg_hr is not None
    ]

    # Carreras con este calzado: asignadas directo o vía su actividad vinculada.
    activity_ids = [row[1].id for row in cardio_rows]
    shoe_conditions: list[Any] = [Race.shoe_id == shoe.id]
    if activity_ids:
        shoe_conditions.append(col(Race.activity_id).in_(activity_ids))
    races = session.exec(
        select(Race)
        .where(Race.user_id == current_user.id, or_(*shoe_conditions))
        .order_by(col(Race.date).desc())
    ).all()
    # Dedup por id (una carrera puede matchear por ambas vías).
    unique_races = {race.id: race for race in races}.values()

    return ShoeStatsPublic(
        total_distance_meters=total_distance,
        sessions=sessions,
        avg_pace_seconds_per_km=round(mean(paces), 2) if paces else None,
        avg_hr=round(mean(hrs), 2) if hrs else None,
        target_distance_km=shoe.target_distance_km,
        races=[RacePublic.model_validate(race) for race in unique_races],
    )


@router.get("/{shoe_id}/activities", response_model=ShoeActivitiesPublic)
def read_shoe_activities(
    session: SessionDep,
    current_user: CurrentUser,
    shoe_id: uuid.UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
) -> ShoeActivitiesPublic:
    _get_owned_shoe(session, current_user.id, shoe_id)

    count = session.exec(
        select(func.count())
        .select_from(ActivityCardio)
        .join(Activity)
        .where(
            Activity.user_id == current_user.id,
            ActivityCardio.shoe_id == shoe_id,
        )
    ).one()
    rows = session.exec(
        select(ActivityCardio, Activity)
        .join(Activity)
        .where(
            Activity.user_id == current_user.id,
            ActivityCardio.shoe_id == shoe_id,
        )
        .order_by(col(Activity.timestamp).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    data = [_public_activity(activity, cardio) for cardio, activity in rows]
    return ShoeActivitiesPublic(data=data, count=count)
