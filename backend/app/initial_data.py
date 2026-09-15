import logging

from sqlmodel import Session, select

from app.core.db import engine, init_db
from app.models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init() -> None:
    with Session(engine) as session:
        init_db(session)
        # Migra el plan de running de ejemplo (si existe el seed) al primer usuario.
        try:
            from app.services.plan_seed import import_plan_from_json

            user = session.exec(select(User)).first()
            if user:
                plan = import_plan_from_json(session, user)
                if plan:
                    logger.info("Plan de running '%s' importado", plan.name)
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo importar el plan de running seed")


def main() -> None:
    logger.info("Creating initial data")
    init()
    logger.info("Initial data created")


if __name__ == "__main__":
    main()
