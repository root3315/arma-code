import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.infrastructure.database.base import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column("title", String(255), nullable=False)  # Column name in DB is 'title'

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # relations
    owner = relationship("User", backref="projects")
    materials = relationship(
        "Material",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    content = relationship(
        "ProjectContent",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )
    tutor_messages = relationship(
        "ProjectTutorMessage",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    progress = relationship(
        "ProjectProgress",
        back_populates="project",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ProjectProgress(Base):
    """Tracks the learning progression through a project's AI-generated content."""
    __tablename__ = "project_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Summary stage
    summary_read = Column(Boolean, default=False, nullable=False)
    summary_read_at = Column(DateTime, nullable=True)

    # Flashcards stage (unlocked after summary read)
    flashcards_unlocked = Column(Boolean, default=False, nullable=False)
    flashcards_unlocked_at = Column(DateTime, nullable=True)
    flashcards_completed = Column(Boolean, default=False, nullable=False)
    flashcards_completed_at = Column(DateTime, nullable=True)

    # Quiz stage (unlocked after flashcards completed)
    quiz_unlocked = Column(Boolean, default=False, nullable=False)
    quiz_unlocked_at = Column(DateTime, nullable=True)
    quiz_completed = Column(Boolean, default=False, nullable=False)
    quiz_completed_at = Column(DateTime, nullable=True)
    quiz_best_score = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    # Relationships
    project = relationship("Project", back_populates="progress")

    __table_args__ = (
        Index("idx_project_progress_user", "user_id"),
    )

    def __repr__(self):
        return (
            f"<ProjectProgress project_id={self.project_id} "
            f"summary_read={self.summary_read} "
            f"flashcards_unlocked={self.flashcards_unlocked} "
            f"quiz_unlocked={self.quiz_unlocked}>"
        )