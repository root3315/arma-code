# ✅ Новый импорт (SQLAlchemy 2.0)
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models here so Alembic can detect them
def import_models():
    """Import all models for Alembic autogenerate."""
    from app.infrastructure.database.models import user  # noqa
    from app.infrastructure.database.models import material  # noqa
    from app.infrastructure.database.models import embedding  # noqa
    from app.infrastructure.database.models import flashcard  # noqa
    from app.infrastructure.database.models import quiz  # noqa
    from app.infrastructure.database.models import quiz_attempt  # noqa
    from app.infrastructure.database.models import subscription  # noqa
    from app.infrastructure.database.models import project  # noqa
