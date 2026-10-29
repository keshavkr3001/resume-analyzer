from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resumes: Mapped[list["Resume"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    tasks: Mapped[list["LearningTask"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    job_matches: Mapped[list["JobMatch"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    stored_file_reference: Mapped[str] = mapped_column(String(64), unique=True)
    file_type: Mapped[str] = mapped_column(String(10))
    extracted_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="resumes")
    analyses: Mapped[list["ResumeAnalysis"]] = relationship(
        back_populates="resume",
        cascade="all, delete-orphan",
        order_by="ResumeAnalysis.created_at",
    )
    tasks: Mapped[list["LearningTask"]] = relationship(cascade="all, delete-orphan")
    job_matches: Mapped[list["JobMatch"]] = relationship(cascade="all, delete-orphan")


class ResumeAnalysis(Base):
    __tablename__ = "resume_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    summary: Mapped[str] = mapped_column(Text)
    extracted_skills: Mapped[list] = mapped_column(JSON)
    skill_categories: Mapped[dict] = mapped_column(JSON)
    quality_score: Mapped[int] = mapped_column(Integer)
    score_breakdown: Mapped[dict] = mapped_column(JSON)
    career_recommendations: Mapped[list] = mapped_column(JSON)
    skill_gaps: Mapped[list] = mapped_column(JSON)
    improvement_suggestions: Mapped[list] = mapped_column(JSON)
    ats_checks: Mapped[list] = mapped_column(JSON)
    analysis_mode: Mapped[str] = mapped_column(String(30), default="rule-based")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resume: Mapped[Resume] = relationship(back_populates="analyses")


class LearningTask(Base):
    __tablename__ = "learning_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resume_id: Mapped[int | None] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), nullable=True)
    target_role: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    resource_url: Mapped[str] = mapped_column(String(500), default="")
    estimated_effort: Mapped[str] = mapped_column(String(80), default="Estimate: self-paced")
    stage: Mapped[str] = mapped_column(String(30), default="Beginner")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="tasks")


class JobMatch(Base):
    __tablename__ = "job_matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resume_id: Mapped[int] = mapped_column(ForeignKey("resumes.id", ondelete="CASCADE"), index=True)
    job_description: Mapped[str] = mapped_column(Text)
    match_score: Mapped[int] = mapped_column(Integer)
    matched_skills: Mapped[list] = mapped_column(JSON)
    missing_skills: Mapped[list] = mapped_column(JSON)
    suggestions: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[User] = relationship(back_populates="job_matches")
