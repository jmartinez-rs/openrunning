"""initial migration

Revision ID: 1a0000000000
Revises: 
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '1a0000000000'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. user
    op.create_table(
        'user',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_superuser', sa.Boolean(), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_email'), 'user', ['email'], unique=True)

    # 2. shoe
    op.create_table(
        'shoe',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('brand', sa.String(length=100), nullable=True),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=32), nullable=False),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('target_distance_km', sa.Float(), nullable=True),
        sa.Column('color', sa.String(length=50), nullable=True),
        sa.Column('photo_url', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.String(length=4000), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('strava_gear_id', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'strava_gear_id', name='uq_shoe_user_strava_gear')
    )
    op.create_index(op.f('ix_shoe_user_id'), 'shoe', ['user_id'], unique=False)
    op.create_index(op.f('ix_shoe_strava_gear_id'), 'shoe', ['strava_gear_id'], unique=False)

    # 3. activity
    op.create_table(
        'activity',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('source_id', sa.String(length=255), nullable=False),
        sa.Column('source_type', sa.String(length=32), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('sport_type', sa.String(length=32), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'source_type', 'source_id', name='uq_activity_user_source')
    )

    # 4. activitycardio
    op.create_table(
        'activitycardio',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('activity_id', sa.Uuid(), nullable=False),
        sa.Column('distance_meters', sa.Float(), nullable=False),
        sa.Column('avg_pace_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('avg_hr', sa.Integer(), nullable=True),
        sa.Column('max_hr', sa.Integer(), nullable=True),
        sa.Column('elevation_gain_meters', sa.Float(), nullable=False),
        sa.Column('calories', sa.Integer(), nullable=True),
        sa.Column('cadence_avg', sa.Integer(), nullable=True),
        sa.Column('map_summary_polyline', sa.String(length=20000), nullable=True),
        sa.Column('splits', sa.JSON(), nullable=False),
        sa.Column('heart_rate_zones', sa.JSON(), nullable=False),
        sa.Column('rpe', sa.Integer(), nullable=True),
        sa.Column('perceived_effort_notes', sa.String(length=2000), nullable=True),
        sa.Column('shoe_id', sa.Uuid(), nullable=True),
        sa.Column('gear_id', sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(['activity_id'], ['activity.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shoe_id'], ['shoe.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('activity_id')
    )
    op.create_index(op.f('ix_activitycardio_shoe_id'), 'activitycardio', ['shoe_id'], unique=False)
    op.create_index(op.f('ix_activitycardio_gear_id'), 'activitycardio', ['gear_id'], unique=False)

    # 5. race
    op.create_table(
        'race',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('activity_id', sa.Uuid(), nullable=True),
        sa.Column('shoe_id', sa.Uuid(), nullable=True),
        sa.Column('event_name', sa.String(length=255), nullable=False),
        sa.Column('date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=False),
        sa.Column('priority', sa.String(length=1), nullable=False),
        sa.Column('target_time_seconds', sa.Integer(), nullable=True),
        sa.Column('target_pace_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('official_time_seconds', sa.Integer(), nullable=True),
        sa.Column('official_pace_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('chip_time_seconds', sa.Integer(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('bib_number', sa.String(length=50), nullable=True),
        sa.Column('photos_urls', sa.JSON(), nullable=False),
        sa.Column('notes', sa.String(length=20000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['activity_id'], ['activity.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['shoe_id'], ['shoe.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_race_shoe_id'), 'race', ['shoe_id'], unique=False)

    # 6. weeklygoal
    op.create_table(
        'weeklygoal',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('target_km', sa.Float(), nullable=True),
        sa.Column('target_sessions', sa.Integer(), nullable=True),
        sa.Column('target_long_run_km', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 7. syncschedule
    op.create_table(
        'syncschedule',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('interval_hours', sa.Integer(), nullable=False),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 8. synclog
    op.create_table(
        'synclog',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 9. authtoken
    op.create_table(
        'authtoken',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('provider', sa.String(length=32), nullable=False),
        sa.Column('access_token', sa.String(), nullable=False),
        sa.Column('refresh_token', sa.String(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 10. runningplan
    op.create_table(
        'runningplan',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('race_id', sa.Uuid(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('goal', sa.String(length=2000), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('distance_unit', sa.String(length=2), nullable=False),
        sa.Column('target_time_seconds', sa.Integer(), nullable=True),
        sa.Column('target_pace_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.String(length=4000), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['race_id'], ['race.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_runningplan_user_id'), 'runningplan', ['user_id'], unique=False)
    op.create_index(op.f('ix_runningplan_race_id'), 'runningplan', ['race_id'], unique=False)

    # 11. runningphase
    op.create_table(
        'runningphase',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('plan_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('color', sa.String(length=16), nullable=False),
        sa.Column('start_week', sa.Integer(), nullable=False),
        sa.Column('end_week', sa.Integer(), nullable=False),
        sa.Column('objective', sa.String(length=2000), nullable=True),
        sa.Column('description', sa.String(length=4000), nullable=True),
        sa.ForeignKeyConstraint(['plan_id'], ['runningplan.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_runningphase_plan_id'), 'runningphase', ['plan_id'], unique=False)

    # 12. runningweek
    op.create_table(
        'runningweek',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('phase_id', sa.Uuid(), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('objective', sa.String(length=2000), nullable=True),
        sa.Column('notes', sa.String(length=4000), nullable=True),
        sa.ForeignKeyConstraint(['phase_id'], ['runningphase.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_runningweek_phase_id'), 'runningweek', ['phase_id'], unique=False)

    # 13. runningworkout
    op.create_table(
        'runningworkout',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('week_id', sa.Uuid(), nullable=False),
        sa.Column('plan_id', sa.Uuid(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False),
        sa.Column('objective', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('pace_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('intensity', sa.String(length=16), nullable=False),
        sa.Column('description', sa.String(length=4000), nullable=True),
        sa.Column('notes', sa.String(length=4000), nullable=True),
        sa.Column('cancelled', sa.Boolean(), nullable=False),
        sa.Column('status_override', sa.String(length=16), nullable=True),
        sa.ForeignKeyConstraint(['plan_id'], ['runningplan.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['week_id'], ['runningweek.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('plan_id', 'date', name='uq_runningworkout_plan_date')
    )
    op.create_index(op.f('ix_runningworkout_plan_id'), 'runningworkout', ['plan_id'], unique=False)
    op.create_index(op.f('ix_runningworkout_week_id'), 'runningworkout', ['week_id'], unique=False)

    # 14. workoutblock
    op.create_table(
        'workoutblock',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('workout_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('block_type', sa.String(length=32), nullable=False),
        sa.Column('repeats', sa.Integer(), nullable=False),
        sa.Column('distance_m', sa.Float(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('pace_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('pace_range_end_seconds_per_km', sa.Float(), nullable=True),
        sa.Column('recovery_seconds', sa.Integer(), nullable=True),
        sa.Column('recovery_type', sa.String(length=32), nullable=True),
        sa.Column('notes', sa.String(length=4000), nullable=True),
        sa.ForeignKeyConstraint(['workout_id'], ['runningworkout.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workoutblock_workout_id'), 'workoutblock', ['workout_id'], unique=False)


def downgrade() -> None:
    op.drop_table('workoutblock')
    op.drop_table('runningworkout')
    op.drop_table('runningweek')
    op.drop_table('runningphase')
    op.drop_table('runningplan')
    op.drop_table('authtoken')
    op.drop_table('synclog')
    op.drop_table('syncschedule')
    op.drop_table('weeklygoal')
    op.drop_table('race')
    op.drop_table('activitycardio')
    op.drop_table('activity')
    op.drop_table('shoe')
    op.drop_table('user')
