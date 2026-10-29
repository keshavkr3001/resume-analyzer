from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)


class ResumeResponse(BaseModel):
    id: int
    original_filename: str
    file_type: str
    created_at: datetime
    latest_analysis: dict | None = None


class AnalysisResponse(BaseModel):
    id: int
    resume_id: int
    summary: str
    extracted_skills: list
    skill_categories: dict
    quality_score: int
    score_breakdown: dict
    career_recommendations: list
    skill_gaps: list
    improvement_suggestions: list
    ats_checks: list
    analysis_mode: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobDescriptionRequest(BaseModel):
    resume_id: int
    job_description: str = Field(min_length=100, max_length=30000)


class LearningTaskUpdate(BaseModel):
    completed: bool


class LearningTaskResponse(BaseModel):
    id: int
    resume_id: int | None
    target_role: str
    title: str
    description: str
    resource_url: str
    estimated_effort: str
    stage: str
    completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
