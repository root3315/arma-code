from datetime import datetime

from sqlalchemy import Column, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector

from app.infrastructure.database.base import Base


class MaterialChunk(Base):
    __tablename__ = "material_chunks"

    id = Column(
        PGUUID(as_uuid=True),
        primary_key=True,
    )

    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    material_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("materials.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content = Column(
        Text,
        nullable=False,
    )

    # pgvector already provides the SQL type. Avoid SQLAlchemy 2 trying to
    # resolve a Python generic annotation for this column during declarative scan.
    embedding = Column(
        Vector(3072),
        nullable=False,
    )

    page = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    material = relationship("Material", back_populates="chunks")
