"""Plan week arithmetic shared by the generator and the recalibration core.

Deliberately dependency-free (it imports nothing from the app): the recalibration
core must be importable without ``app.core.config``, and the generator and
``app.services.fitness`` must compute week boundaries with ONE formula instead of
two copies that can drift apart.
"""


def week_start_offset(iso_weekday: int, week_start_day: int) -> int:
    """Days from the plan's week start to `iso_weekday` (ISO: 1=Mon .. 7=Sun).

    The result is always in ``0..6``, so `week_start_day` itself maps to 0 and a
    weekday before the week start wraps into the previous week.
    """
    return (iso_weekday - week_start_day + 7) % 7
