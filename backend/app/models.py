import uuid
import datetime as dt
from datetime import UTC, datetime
from typing import Literal, Self

from pydantic import EmailStr, model_validator
from sqlalchemy import JSON, Column, DateTime, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )


class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# ---------------------------------------------------------------------------
# Auth / JWT
# ---------------------------------------------------------------------------


class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Activities (Running)
# ---------------------------------------------------------------------------


class ActivityBase(SQLModel):
    source_id: str = Field(min_length=1, max_length=255)
    source_type: str = Field(min_length=1, max_length=32)
    timestamp: datetime = Field(sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    duration_seconds: int = Field(default=0, ge=0)
    name: str | None = Field(default=None, max_length=255)
    sport_type: str | None = Field(default=None, max_length=32)


class Activity(ActivityBase, table=True):
    __table_args__ = (
        UniqueConstraint(
            "user_id", "source_type", "source_id", name="uq_activity_user_source"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class ActivityCardioBase(SQLModel):
    distance_meters: float = Field(default=0, ge=0)
    avg_pace_seconds_per_km: float | None = Field(default=None, ge=0)
    avg_hr: int | None = Field(default=None, ge=0)
    max_hr: int | None = Field(default=None, ge=0)
    elevation_gain_meters: float = Field(default=0, ge=0)
    calories: int | None = Field(default=None, ge=0)
    cadence_avg: int | None = Field(default=None, ge=0)
    map_summary_polyline: str | None = Field(default=None, max_length=20000)
    splits: list[dict[str, object]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    heart_rate_zones: list[dict[str, object]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    rpe: int | None = Field(default=None, ge=1, le=10)
    perceived_effort_notes: str | None = Field(default=None, max_length=2000)
    shoe_id: uuid.UUID | None = Field(
        default=None, foreign_key="shoe.id", ondelete="SET NULL", index=True
    )
    gear_id: str | None = Field(default=None, max_length=64, index=True)


class ActivityCardio(ActivityCardioBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    activity_id: uuid.UUID = Field(
        foreign_key="activity.id", nullable=False, unique=True, ondelete="CASCADE"
    )


class ActivityCreate(ActivityBase):
    cardio: ActivityCardioBase | None = None


class ActivityUpdate(SQLModel):
    timestamp: datetime | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    name: str | None = Field(default=None, max_length=255)


class ActivityPublic(ActivityBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    cardio: ActivityCardioBase | None = None


class ActivitiesPublic(SQLModel):
    data: list[ActivityPublic]
    count: int


# ---------------------------------------------------------------------------
# Weekly Goals (Running-only)
# ---------------------------------------------------------------------------


class WeeklyGoalBase(SQLModel):
    target_km: float | None = Field(default=None, ge=0)
    target_sessions: int | None = Field(default=None, ge=0)
    target_long_run_km: float | None = Field(default=None, ge=0)


class WeeklyGoal(WeeklyGoalBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class WeeklyGoalPublic(WeeklyGoalBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


# ---------------------------------------------------------------------------
# Dashboard DTOs
# ---------------------------------------------------------------------------


class DashboardActivity(SQLModel):
    id: uuid.UUID
    timestamp: datetime
    name: str | None
    source_type: str
    duration_seconds: int
    distance_meters: float | None = None


class DashboardDay(SQLModel):
    date: dt.date
    activities: list[DashboardActivity]


class UpcomingRacePublic(SQLModel):
    id: uuid.UUID
    event_name: str
    date: datetime
    location: str | None
    distance_km: float


class DashboardKPIs(SQLModel):
    cardio_distance_meters: float
    cardio_duration_seconds: int
    cardio_avg_pace_seconds_per_km: float | None
    sessions: int
    active_days: int


class DashboardPublic(SQLModel):
    week_start: dt.date
    week_end: dt.date
    kpis: DashboardKPIs
    timeline: list[DashboardDay]
    upcoming_race: UpcomingRacePublic | None = None
    previous_kpis: DashboardKPIs | None = None
    sync_state: list["SyncStateEntry"] = Field(default_factory=list)


class SyncStateEntry(SQLModel):
    provider: str
    connected: bool
    last_status: str | None = None
    last_message: str | None = None
    last_run_at: datetime | None = None


# ---------------------------------------------------------------------------
# Sync Schedule & Logs
# ---------------------------------------------------------------------------


class SyncScheduleBase(SQLModel):
    provider: str = Field(min_length=1, max_length=32)
    enabled: bool = True
    interval_hours: int = Field(default=24, ge=1, le=168)


class SyncSchedule(SyncScheduleBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    last_run_at: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True)
    )  # type: ignore[call-overload]
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class SyncScheduleUpdate(SQLModel):
    enabled: bool | None = None
    interval_hours: int | None = Field(default=None, ge=1, le=168)


class SyncSchedulePublic(SyncScheduleBase):
    id: uuid.UUID
    user_id: uuid.UUID
    last_run_at: datetime | None = None


class SyncLogBase(SQLModel):
    provider: str = Field(min_length=1, max_length=32)
    status: str = Field(min_length=1, max_length=32)
    details: dict[str, object] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )


class SyncLog(SyncLogBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    started_at: datetime = Field(  # type: ignore[call-overload]
        sa_type=DateTime(timezone=True)
    )
    completed_at: datetime | None = Field(  # type: ignore[call-overload]
        default=None, sa_type=DateTime(timezone=True)
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )


class SyncLogPublic(SyncLogBase):
    id: uuid.UUID
    started_at: datetime
    completed_at: datetime | None = None
    user_id: uuid.UUID


class SyncLogsPublic(SQLModel):
    data: list[SyncLogPublic]
    count: int


# ---------------------------------------------------------------------------
# Races (Carreras)
# ---------------------------------------------------------------------------

RacePriority = Literal["A", "B", "C"]


class RaceBase(SQLModel):
    event_name: str = Field(min_length=1, max_length=255)
    date: datetime = Field(sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    location: str | None = Field(default=None, max_length=255)
    distance_km: float = Field(ge=0)
    priority: RacePriority = Field(
        default="B", sa_column=Column("priority", String(1), nullable=False)
    )
    target_time_seconds: int | None = Field(default=None, ge=0)
    target_pace_seconds_per_km: float | None = Field(default=None, ge=0)
    official_time_seconds: int | None = Field(default=None, ge=0)
    official_pace_seconds_per_km: float | None = Field(default=None, ge=0)
    chip_time_seconds: int | None = Field(default=None, ge=0)
    position: int | None = Field(default=None, ge=1)
    category: str | None = Field(default=None, max_length=100)
    bib_number: str | None = Field(default=None, max_length=50)
    photos_urls: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    notes: str | None = Field(default=None, max_length=20000)
    shoe_id: uuid.UUID | None = Field(
        default=None, foreign_key="shoe.id", ondelete="SET NULL", index=True
    )


class Race(RaceBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    activity_id: uuid.UUID | None = Field(
        default=None, foreign_key="activity.id", ondelete="SET NULL"
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class RaceCreate(RaceBase):
    activity_id: uuid.UUID | None = None


class RaceUpdate(SQLModel):
    event_name: str | None = Field(default=None, min_length=1, max_length=255)
    date: datetime | None = None
    location: str | None = Field(default=None, max_length=255)
    distance_km: float | None = Field(default=None, ge=0)
    priority: RacePriority | None = None
    target_time_seconds: int | None = Field(default=None, ge=0)
    target_pace_seconds_per_km: float | None = Field(default=None, ge=0)
    official_time_seconds: int | None = Field(default=None, ge=0)
    official_pace_seconds_per_km: float | None = Field(default=None, ge=0)
    chip_time_seconds: int | None = Field(default=None, ge=0)
    position: int | None = Field(default=None, ge=1)
    category: str | None = Field(default=None, max_length=100)
    bib_number: str | None = Field(default=None, max_length=50)
    photos_urls: list[str] | None = None
    notes: str | None = Field(default=None, max_length=20000)
    activity_id: uuid.UUID | None = None
    shoe_id: uuid.UUID | None = None


class RacePublic(RaceBase):
    id: uuid.UUID
    activity_id: uuid.UUID | None
    user_id: uuid.UUID
    created_at: datetime


class RacesPublic(SQLModel):
    data: list[RacePublic]
    count: int


# ---------------------------------------------------------------------------
# Shoes (Zapatillas)
# ---------------------------------------------------------------------------

ShoeCategory = Literal["training", "race", "trail", "easy", "mixed"]


class ShoeBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    category: ShoeCategory = Field(
        sa_column=Column("category", String(32), nullable=False)
    )
    purchase_date: dt.date | None = None
    target_distance_km: float | None = Field(default=None, ge=0)
    color: str | None = Field(default=None, max_length=50)
    photo_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=4000)
    is_active: bool = True


class Shoe(ShoeBase, table=True):
    __table_args__ = (
        UniqueConstraint(
            "user_id", "strava_gear_id", name="uq_shoe_user_strava_gear"
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    strava_gear_id: str | None = Field(default=None, max_length=64, index=True)
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class ShoeCreate(ShoeBase):
    pass


class ShoeUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    category: ShoeCategory | None = None
    purchase_date: dt.date | None = None
    target_distance_km: float | None = Field(default=None, ge=0)
    color: str | None = Field(default=None, max_length=50)
    photo_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=4000)
    is_active: bool | None = None


class ShoePublic(ShoeBase):
    id: uuid.UUID
    user_id: uuid.UUID
    strava_gear_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ShoesPublic(SQLModel):
    data: list[ShoePublic]
    count: int


class ShoeStatsPublic(SQLModel):
    total_distance_meters: float = 0
    sessions: int = 0
    avg_pace_seconds_per_km: float | None = None
    avg_hr: float | None = None
    target_distance_km: float | None = None
    races: list[RacePublic] = Field(default_factory=list)


class ShoeActivitiesPublic(SQLModel):
    data: list[ActivityPublic]
    count: int


class ActivityShoeAssignment(SQLModel):
    shoe_id: uuid.UUID | None = None


class ShoeImportResult(SQLModel):
    imported: int = 0
    updated: int = 0
    linked: int = 0
    assigned: int = 0
    message: str = ""


# ---------------------------------------------------------------------------
# Integration credentials (Strava)
# ---------------------------------------------------------------------------


class AuthTokenBase(SQLModel):
    provider: str = Field(min_length=1, max_length=32)
    access_token: str
    refresh_token: str | None = None
    expires_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))  # type: ignore[call-overload]
    metadata_json: dict[str, object] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )


class AuthToken(AuthTokenBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class StravaCredentialsIn(SQLModel):
    client_id: str | None = Field(default=None, max_length=64)
    client_secret: str | None = Field(default=None, max_length=255)
    access_token: str | None = Field(default=None, max_length=255)
    refresh_token: str | None = Field(default=None, max_length=255)
    expires_at: datetime | None = None


class IntegrationTestResult(SQLModel):
    provider: str
    success: bool
    message: str


class IntegrationStatus(SQLModel):
    provider: str
    connected: bool
    message: str | None = None


class ConnectionStatus(SQLModel):
    provider: str
    connected: bool
    expires_at: datetime | None = None


class SettingsPublic(SQLModel):
    connections: list[ConnectionStatus]
    goals: WeeklyGoalPublic | None = None


# ---------------------------------------------------------------------------
# Running Plans (fases → semanas → sesiones → bloques)
# ---------------------------------------------------------------------------

WorkoutType = Literal[
    "easy_run",
    "regeneration",
    "intervals",
    "tempo",
    "long_run",
    "test",
    "activation",
    "race",
]
WorkoutStatus = Literal["planned", "completed", "missed", "cancelled"]
PlanStatus = Literal["planned", "active", "completed"]
Intensity = Literal["easy", "moderate", "hard"]
BlockType = Literal["warmup", "main", "interval", "recovery", "cooldown", "strides"]


class RunningPlanBase(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    goal: str | None = Field(default=None, max_length=2000)
    distance_km: float | None = Field(default=None, ge=0)
    distance_unit: str = Field(default="km", max_length=2)
    target_time_seconds: int | None = Field(default=None, ge=0)
    target_pace_seconds_per_km: float | None = Field(default=None, ge=0)
    start_date: dt.date
    end_date: dt.date | None = None
    notes: str | None = Field(default=None, max_length=4000)


class RunningPlan(RunningPlanBase, table=True):
    __tablename__ = "runningplan"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    race_id: uuid.UUID | None = Field(
        default=None, foreign_key="race.id", ondelete="SET NULL", index=True
    )
    status: PlanStatus = Field(sa_column=Column("status", String(16), nullable=False))
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]
    updated_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),
    )  # type: ignore[call-overload]


class RunningPhase(SQLModel, table=True):
    __tablename__ = "runningphase"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    plan_id: uuid.UUID = Field(
        foreign_key="runningplan.id", nullable=False, ondelete="CASCADE", index=True
    )
    position: int = Field(default=1, ge=1)
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="emerald", max_length=16)
    start_week: int = Field(ge=1)
    end_week: int = Field(ge=1)
    objective: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=4000)


class RunningWeek(SQLModel, table=True):
    __tablename__ = "runningweek"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phase_id: uuid.UUID = Field(
        foreign_key="runningphase.id", nullable=False, ondelete="CASCADE", index=True
    )
    number: int = Field(ge=1)
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    name: str | None = Field(default=None, max_length=255)
    objective: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)


class RunningWorkout(SQLModel, table=True):
    __tablename__ = "runningworkout"
    __table_args__ = (
        UniqueConstraint("plan_id", "date", name="uq_runningworkout_plan_date"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    week_id: uuid.UUID = Field(
        foreign_key="runningweek.id", nullable=False, ondelete="CASCADE", index=True
    )
    plan_id: uuid.UUID = Field(
        foreign_key="runningplan.id", nullable=False, ondelete="CASCADE", index=True
    )
    date: dt.date
    type: WorkoutType = Field(sa_column=Column("type", String(32), nullable=False))
    objective: str | None = Field(default=None, max_length=255)
    name: str | None = Field(default=None, max_length=255)
    distance_km: float | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    pace_seconds_per_km: float | None = Field(default=None, ge=0)
    intensity: Intensity = Field(
        sa_column=Column("intensity", String(16), nullable=False)
    )
    description: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)
    cancelled: bool = False
    status_override: Literal["completed", "missed"] | None = Field(
        default=None, sa_column=Column("status_override", String(16), nullable=True)
    )


class WorkoutBlock(SQLModel, table=True):
    __tablename__ = "workoutblock"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    workout_id: uuid.UUID = Field(
        foreign_key="runningworkout.id", nullable=False, ondelete="CASCADE", index=True
    )
    position: int = Field(default=1, ge=1)
    block_type: BlockType = Field(
        sa_column=Column("block_type", String(32), nullable=False)
    )
    repeats: int = Field(default=1, ge=1)
    distance_m: float | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    pace_seconds_per_km: float | None = Field(default=None, ge=0)
    pace_range_end_seconds_per_km: float | None = Field(default=None, ge=0)
    recovery_seconds: int | None = Field(default=None, ge=0)
    recovery_type: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=4000)


# Running Plan input schemas (nested: phases → weeks → workouts → blocks)


class WorkoutBlockIn(SQLModel):
    position: int = Field(default=1, ge=1)
    block_type: BlockType = "main"
    repeats: int = Field(default=1, ge=1)
    distance_m: float | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    pace_seconds_per_km: float | None = Field(default=None, ge=0)
    pace_range_end_seconds_per_km: float | None = Field(default=None, ge=0)
    recovery_seconds: int | None = Field(default=None, ge=0)
    recovery_type: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=4000)


class WorkoutIn(SQLModel):
    date: dt.date
    type: WorkoutType
    objective: str | None = Field(default=None, max_length=255)
    name: str | None = Field(default=None, max_length=255)
    distance_km: float | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    pace_seconds_per_km: float | None = Field(default=None, ge=0)
    intensity: Intensity = "easy"
    description: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)
    cancelled: bool = False
    status_override: Literal["completed", "missed"] | None = None
    blocks: list[WorkoutBlockIn] = Field(default_factory=list)


class WeekIn(SQLModel):
    number: int = Field(ge=1)
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    name: str | None = Field(default=None, max_length=255)
    objective: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=4000)
    workouts: list[WorkoutIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_dates(self) -> Self:
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date debe ser mayor o igual a start_date")
        return self


class PhaseIn(SQLModel):
    position: int = Field(default=1, ge=1)
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="emerald", max_length=16)
    start_week: int = Field(ge=1)
    end_week: int = Field(ge=1)
    objective: str | None = Field(default=None, max_length=2000)
    description: str | None = Field(default=None, max_length=4000)
    weeks: list[WeekIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_weeks(self) -> Self:
        if self.end_week < self.start_week:
            raise ValueError("end_week debe ser mayor o igual a start_week")
        return self


class RunningPlanCreate(RunningPlanBase):
    distance_unit: Literal["km", "mi"] = "km"
    status: PlanStatus = "planned"
    race_id: uuid.UUID | None = None
    phases: list[PhaseIn] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_plan(self) -> Self:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date debe ser mayor o igual a start_date")
        if not self.phases:
            raise ValueError("El plan debe tener al menos una fase")
        if not any(phase.weeks for phase in self.phases):
            raise ValueError("El plan debe tener al menos una semana")
        return self


class RunningPlanUpdate(RunningPlanCreate):
    """Reemplazo completo del plan: usa los mismos campos que la creación."""


class RunningWorkoutUpdate(SQLModel):
    """Campos editables de una sesión (PATCH parcial)."""

    cancelled: bool | None = None
    status_override: Literal["completed", "missed"] | None = None
    date: dt.date | None = None
    type: WorkoutType | None = None
    objective: str | None = Field(default=None, max_length=255)
    name: str | None = Field(default=None, max_length=255)
    distance_km: float | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)
    pace_seconds_per_km: float | None = Field(default=None, ge=0)
    intensity: Intensity | None = None
    description: str | None = Field(default=None, max_length=4000)
    notes: str | None = Field(default=None, max_length=4000)


class WorkoutDuplicateIn(SQLModel):
    """Body opcional de duplicación: permite elegir la fecha destino."""

    date: dt.date | None = None


# Running Plan output schemas


class WorkoutBlockPublic(SQLModel):
    id: uuid.UUID
    position: int
    block_type: BlockType
    repeats: int
    distance_m: float | None
    duration_seconds: int | None
    pace_seconds_per_km: float | None
    pace_range_end_seconds_per_km: float | None
    recovery_seconds: int | None
    recovery_type: str | None
    notes: str | None


class RunningWorkoutPublic(SQLModel):
    id: uuid.UUID
    date: dt.date
    type: WorkoutType
    objective: str | None
    name: str | None
    distance_km: float | None
    duration_seconds: int | None
    pace_seconds_per_km: float | None
    intensity: Intensity
    description: str | None
    notes: str | None
    cancelled: bool
    status_override: Literal["completed", "missed"] | None = None
    status: WorkoutStatus
    matched_activity: dict[str, object] | None
    blocks: list[WorkoutBlockPublic] = Field(default_factory=list)


class RunningWeekPublic(SQLModel):
    id: uuid.UUID
    number: int
    start_date: dt.date | None
    end_date: dt.date | None
    name: str | None
    objective: str | None
    notes: str | None
    workouts: list[RunningWorkoutPublic] = Field(default_factory=list)


class RunningPhasePublic(SQLModel):
    id: uuid.UUID
    position: int
    name: str
    color: str
    start_week: int
    end_week: int
    objective: str | None
    description: str | None
    weeks: list[RunningWeekPublic] = Field(default_factory=list)


class RunningPlanPublic(SQLModel):
    id: uuid.UUID
    user_id: uuid.UUID
    race_id: uuid.UUID | None
    name: str
    goal: str | None
    distance_km: float | None
    distance_unit: str
    target_time_seconds: int | None
    target_pace_seconds_per_km: float | None
    start_date: dt.date
    end_date: dt.date | None
    status: PlanStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime
    phases: list[RunningPhasePublic] = Field(default_factory=list)


class RunningPlanSummaryPublic(SQLModel):
    id: uuid.UUID
    name: str
    goal: str | None
    status: PlanStatus
    start_date: dt.date
    end_date: dt.date | None
    distance_km: float | None
    distance_unit: str
    race_id: uuid.UUID | None
    updated_at: datetime
    weeks: int
    sessions: int
    planned_km: float
    completed: int
    missed: int
    planned: int


class RunningPlansPublic(SQLModel):
    data: list[RunningPlanSummaryPublic]
    count: int


# ---------------------------------------------------------------------------
# Analytics (running-only: HR zones, HR trend, pace trend)
# ---------------------------------------------------------------------------


class HrZoneBucket(SQLModel):
    zone: int
    label: str
    seconds: int


class HrZonesPublic(SQLModel):
    weeks: list[dict[str, object]] = Field(default_factory=list)


class HrTrendPoint(SQLModel):
    week: str
    avg_hr: float | None = None
    max_hr: float | None = None


class HrTrendPublic(SQLModel):
    data: list[HrTrendPoint] = Field(default_factory=list)


class CardioAnalyticsPublic(SQLModel):
    from_date: dt.date | None
    to_date: dt.date | None
    distance_meters: float
    duration_seconds: int
    average_pace_seconds_per_km: float | None
    sessions: int


class ActivityTypeSummary(SQLModel):
    type: str
    category: str
    count: int
    distance_meters: float
    duration_seconds: int
    elevation_gain_meters: float
    avg_distance_meters: float
    avg_duration_seconds: float
    avg_elevation_gain_meters: float
    dot_days: list[str]


class ActivitySummaryMonthly(SQLModel):
    total_activities: int
    target_activities: float | None = None
    target_source: str | None = None
    progress: float | None = None


class ActivitySummaryCalendarDay(SQLModel):
    date: str
    types: list[str]


class ActivitySummaryPublic(SQLModel):
    month: str
    period_start: str
    period_end: str
    total_activities: int
    coverage: float
    by_type: list[ActivityTypeSummary]
    monthly: ActivitySummaryMonthly
    calendar: list[ActivitySummaryCalendarDay]
