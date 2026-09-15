import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Race, RaceCreate, RacePublic, RacesPublic, RaceUpdate

router = APIRouter(prefix="/races", tags=["races"])


def _get_owned_race(
    session: SessionDep, user_id: uuid.UUID, race_id: uuid.UUID
) -> Race:
    race = session.exec(
        select(Race).where(Race.id == race_id, Race.user_id == user_id)
    ).first()
    if not race:
        raise HTTPException(status_code=404, detail="Race not found")
    return race


@router.get("/", response_model=RacesPublic)
def read_races(
    session: SessionDep,
    current_user: CurrentUser,
    distance_km: float | None = Query(default=None, ge=0),
    search: str | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> RacesPublic:
    filters: list[Any] = [Race.user_id == current_user.id]
    if distance_km is not None:
        filters.append(Race.distance_km == distance_km)
    if search:
        filters.append(col(Race.event_name).ilike(f"%{search}%"))
    count = session.exec(select(func.count()).select_from(Race).where(*filters)).one()
    races = session.exec(
        select(Race)
        .where(*filters)
        .order_by(col(Race.date).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return RacesPublic(
        data=[RacePublic.model_validate(race) for race in races], count=count
    )


@router.get("/{race_id}", response_model=RacePublic)
def read_race(
    session: SessionDep, current_user: CurrentUser, race_id: uuid.UUID
) -> RacePublic:
    return RacePublic.model_validate(_get_owned_race(session, current_user.id, race_id))


@router.post("/", response_model=RacePublic, status_code=status.HTTP_201_CREATED)
def create_race(
    session: SessionDep, current_user: CurrentUser, race_in: RaceCreate
) -> RacePublic:
    race = Race.model_validate(race_in, update={"user_id": current_user.id})
    session.add(race)
    session.commit()
    session.refresh(race)
    return RacePublic.model_validate(race)


@router.put("/{race_id}", response_model=RacePublic)
def update_race(
    session: SessionDep,
    current_user: CurrentUser,
    race_id: uuid.UUID,
    race_in: RaceUpdate,
) -> RacePublic:
    race = _get_owned_race(session, current_user.id, race_id)
    race.sqlmodel_update(race_in.model_dump(exclude_unset=True))
    session.add(race)
    session.commit()
    session.refresh(race)
    return RacePublic.model_validate(race)


@router.delete("/{race_id}")
def delete_race(
    session: SessionDep, current_user: CurrentUser, race_id: uuid.UUID
) -> dict[str, str]:
    race = _get_owned_race(session, current_user.id, race_id)
    session.delete(race)
    session.commit()
    return {"message": "Race deleted successfully"}
