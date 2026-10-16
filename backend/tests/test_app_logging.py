"""The app-level logging configuration must keep INFO observability records (G5).

The recalibration routes emit INFO records (for example the ``empty_evidence``
event) through module loggers that used to inherit the ROOT logger's level. If
another module configured the root logger first, ``logging.basicConfig`` inside
``app.utils`` became a no-op and those records were silently dropped.
``app.core.logging_config.configure_logging`` pins the app's own logger instead.
"""

import logging

from app.core.logging_config import configure_logging

ROUTE_LOGGER = "app.api.routes.running_plans"
FITNESS_LOGGER = "app.services.fitness"


def test_configure_logging_keeps_app_info_records_enabled_under_a_warning_root():
    root = logging.getLogger()
    previous_level = root.level
    try:
        # Simulate another library configuring the root logger at WARNING first:
        # basicConfig is then a no-op and every app INFO record would be dropped.
        root.setLevel(logging.WARNING)

        configure_logging()

        assert logging.getLogger(ROUTE_LOGGER).isEnabledFor(logging.INFO)
        assert logging.getLogger(FITNESS_LOGGER).isEnabledFor(logging.INFO)
    finally:
        root.setLevel(previous_level)


def test_configure_logging_delivers_app_info_records_to_a_real_handler():
    records: list[logging.LogRecord] = []

    class _Collector(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    collector = _Collector()
    root = logging.getLogger()
    previous_level = root.level
    try:
        # A host already configured root at WARNING with its own handler, so
        # basicConfig would be a no-op. The app record must still be emitted.
        root.addHandler(collector)
        root.setLevel(logging.WARNING)

        configure_logging()
        logging.getLogger(ROUTE_LOGGER).info(
            "empty_evidence plan_id=x", extra={"event": "empty_evidence"}
        )
    finally:
        root.removeHandler(collector)
        root.setLevel(previous_level)

    assert [getattr(record, "event", None) for record in records] == ["empty_evidence"]

