import uuid
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from app.services.file_parser import parse_fit_file, parse_gpx_file
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ActivitiesPublic,
    Activity,
    ActivityCardio,
    ActivityCreate,
    ActivityPublic,
    ActivityShoeAssignment,
    ActivityUpdate,
    Shoe,
)

router = APIRouter(prefix="/activities", tags=["activities"])


def _public_activity(
    activity: Activity,
    cardio: ActivityCardio | None = None,
) -> ActivityPublic:
    return ActivityPublic(
        **activity.model_dump(),
        cardio=cardio,
    )


def _get_owned_activity(
    session: SessionDep, user_id: uuid.UUID, activity_id: uuid.UUID
) -> Activity:
    activity = session.exec(
        select(Activity).where(Activity.id == activity_id, Activity.user_id == user_id)
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


@router.get("/", response_model=ActivitiesPublic)
def read_activities(
    session: SessionDep,
    current_user: CurrentUser,
    source_type: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
) -> ActivitiesPublic:
    filters = [Activity.user_id == current_user.id]
    if source_type:
        filters.append(Activity.source_type == source_type)
    if from_date:
        filters.append(Activity.timestamp >= datetime.combine(from_date, time.min))
    if to_date:
        filters.append(
            Activity.timestamp < datetime.combine(to_date + timedelta(days=1), time.min)
        )

    count = session.exec(
        select(func.count()).select_from(Activity).where(*filters)
    ).one()
    activities = session.exec(
        select(Activity)
        .where(*filters)
        .order_by(col(Activity.timestamp).desc())
        .offset(skip)
        .limit(limit)
    ).all()

    # Carga en batch de métricas cardio para la página.
    activity_ids = [activity.id for activity in activities]
    cardio_by_activity: dict[uuid.UUID, ActivityCardio] = (
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
    data = [
        _public_activity(activity, cardio_by_activity.get(activity.id))
        for activity in activities
    ]
    return ActivitiesPublic(data=data, count=count)


@router.get("/cardio/{activity_id}", response_model=ActivityCardio)
def read_cardio_metrics(
    session: SessionDep, current_user: CurrentUser, activity_id: uuid.UUID
) -> ActivityCardio:
    activity = _get_owned_activity(session, current_user.id, activity_id)
    cardio = session.exec(
        select(ActivityCardio).where(ActivityCardio.activity_id == activity.id)
    ).first()
    if not cardio:
        raise HTTPException(status_code=404, detail="Cardio metrics not found")
    return cardio


@router.get("/{activity_id}", response_model=ActivityPublic)
def read_activity(
    session: SessionDep, current_user: CurrentUser, activity_id: uuid.UUID
) -> ActivityPublic:
    activity = _get_owned_activity(session, current_user.id, activity_id)
    cardio = session.exec(
        select(ActivityCardio).where(ActivityCardio.activity_id == activity.id)
    ).first()
    return _public_activity(activity, cardio)


@router.post("/", response_model=ActivityPublic, status_code=status.HTTP_201_CREATED)
def create_activity(
    session: SessionDep, current_user: CurrentUser, activity_in: ActivityCreate
) -> ActivityPublic:
    activity = Activity.model_validate(activity_in, update={"user_id": current_user.id})
    session.add(activity)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(
            status_code=409, detail="Activity already exists for this source"
        ) from error
    session.refresh(activity)

    if activity_in.cardio:
        session.add(
            ActivityCardio.model_validate(
                activity_in.cardio, update={"activity_id": activity.id}
            )
        )
    session.commit()
    return read_activity(session, current_user, activity.id)


@router.put("/{activity_id}", response_model=ActivityPublic)
def update_activity(
    session: SessionDep,
    current_user: CurrentUser,
    activity_id: uuid.UUID,
    activity_in: ActivityUpdate,
) -> ActivityPublic:
    activity = _get_owned_activity(session, current_user.id, activity_id)
    activity.sqlmodel_update(activity_in.model_dump(exclude_unset=True))
    session.add(activity)
    session.commit()
    session.refresh(activity)
    return read_activity(session, current_user, activity.id)


@router.put("/{activity_id}/shoe", response_model=ActivityPublic)
def assign_activity_shoe(
    session: SessionDep,
    current_user: CurrentUser,
    activity_id: uuid.UUID,
    assignment: ActivityShoeAssignment,
) -> ActivityPublic:
    """Asigna o desasigna una zapatilla a una actividad cardio (running)."""
    activity = _get_owned_activity(session, current_user.id, activity_id)
    if assignment.shoe_id is not None:
        shoe = session.exec(
            select(Shoe).where(
                Shoe.id == assignment.shoe_id, Shoe.user_id == current_user.id
            )
        ).first()
        if not shoe:
            raise HTTPException(status_code=404, detail="Zapatilla no encontrada")
    cardio = session.exec(
        select(ActivityCardio).where(ActivityCardio.activity_id == activity.id)
    ).first()
    if not cardio:
        raise HTTPException(
            status_code=404, detail="La actividad no tiene métricas cardio"
        )
    cardio.shoe_id = assignment.shoe_id
    session.add(cardio)
    session.commit()
    session.refresh(cardio)
    return read_activity(session, current_user, activity.id)


@router.delete("/{activity_id}")
def delete_activity(
    session: SessionDep, current_user: CurrentUser, activity_id: uuid.UUID
) -> dict[str, str]:
    activity = _get_owned_activity(session, current_user.id, activity_id)
    session.delete(activity)
    session.commit()
    return {"message": "Activity deleted successfully"}


@router.post("/upload", response_model=ActivityPublic)
async def upload_activity_file(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> ActivityPublic:
    """Sube y procesa un archivo GPS .gpx o .fit directamente."""
    filename = file.filename or "carrera.gpx"
    content = await file.read()

    if filename.lower().endswith(".gpx"):
        data = parse_gpx_file(content, filename)
        source_type = "gpx_file"
    elif filename.lower().endswith(".fit"):
        data = parse_fit_file(content, filename)
        source_type = "fit_file"
    else:
        raise HTTPException(
            status_code=400, detail="Formato no soportado. Debe ser un archivo .gpx o .fit"
        )

    activity = Activity(
        user_id=current_user.id,
        name=data.name,
        source_type=source_type,
        timestamp=data.timestamp,
        has_gps=data.polyline_str is not None,
        duration_seconds=int(data.elapsed_time_seconds),
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    cardio = ActivityCardio(
        activity_id=activity.id,
        distance_meters=data.distance_meters,
        elapsed_time_seconds=int(data.elapsed_time_seconds),
        moving_time_seconds=int(data.moving_time_seconds),
        avg_hr=data.avg_hr,
        max_hr=data.max_hr,
        elevation_gain=data.elevation_gain,
        summary_polyline=data.polyline_str,
    )
    session.add(cardio)
    session.commit()
    session.refresh(cardio)

    return _public_activity(activity, cardio)

