import re
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db, settings
from app.models import JobMatch, LearningTask, Resume, ResumeAnalysis, User
from app.schemas import (
    AnalysisResponse,
    JobDescriptionRequest,
    LearningTaskResponse,
    LearningTaskUpdate,
    LoginRequest,
    RegisterRequest,
    ResumeResponse,
    UserResponse,
)
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.services.ai_service import summarize_with_provider
from app.services.analysis import ROLE_REQUIREMENTS, analyze_resume, match_job_description
from app.services.resume_parser import ResumeParseError, extract_resume_text

router = APIRouter(prefix="/api")


def _owned_resume(db: Session, user_id: int, resume_id: int) -> Resume:
    resume = db.scalar(select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id))
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Name cannot be blank")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(name=name, email=email, hashed_password=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    db.refresh(user)
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": UserResponse.model_validate(user)}


@router.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return {"access_token": create_access_token(user.id), "token_type": "bearer", "user": UserResponse.model_validate(user)}


@router.get("/auth/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user


@router.get("/config")
def public_config():
    return {
        "max_upload_mb": settings.max_upload_mb,
        "ai_enabled": bool(settings.ai_api_base_url and settings.ai_api_key and settings.ai_model),
    }


@router.post("/auth/logout")
def logout(user: User = Depends(get_current_user)):
    return {"message": "Session ended. Remove the access token from the client."}


@router.delete("/auth/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    upload_dir = Path(settings.upload_dir).resolve()
    for resume in user.resumes:
        stored_path = upload_dir / f"{resume.stored_file_reference}.{resume.file_type}"
        if stored_path.exists():
            stored_path.unlink()
    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/resumes/upload", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".pdf", ".docx"}:
        raise HTTPException(status_code=415, detail="Upload a PDF or DOCX resume.")
    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds the {settings.max_upload_mb} MB limit.")
    try:
        extracted_text = extract_resume_text(content, extension)
    except ResumeParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    file_id = uuid.uuid4().hex
    upload_dir = Path(settings.upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / f"{file_id}{extension}").write_bytes(content)
    safe_name = re.sub(r"[^A-Za-z0-9._ -]", "_", Path(file.filename or "resume").name)[:255]
    resume = Resume(
        user_id=user.id,
        original_filename=safe_name,
        stored_file_reference=file_id,
        file_type=extension[1:],
        extracted_text=extracted_text,
    )
    db.add(resume)
    try:
        db.commit()
    except SQLAlchemyError:
        (upload_dir / f"{file_id}{extension}").unlink(missing_ok=True)
        db.rollback()
        raise
    db.refresh(resume)
    return ResumeResponse(
        id=resume.id,
        original_filename=resume.original_filename,
        file_type=resume.file_type,
        created_at=resume.created_at,
    )


@router.get("/resumes", response_model=list[ResumeResponse])
def list_resumes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resumes = db.scalars(select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())).all()
    return [
        ResumeResponse(
            id=resume.id,
            original_filename=resume.original_filename,
            file_type=resume.file_type,
            created_at=resume.created_at,
            latest_analysis=(
                {
                    "quality_score": resume.analyses[-1].quality_score,
                    "created_at": resume.analyses[-1].created_at,
                }
                if resume.analyses
                else None
            ),
        )
        for resume in resumes
    ]


@router.get("/resumes/{resume_id}")
def get_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resume = _owned_resume(db, user.id, resume_id)
    return {
        "id": resume.id,
        "original_filename": resume.original_filename,
        "file_type": resume.file_type,
        "created_at": resume.created_at,
        "extracted_text": resume.extracted_text,
    }


@router.get("/resumes/{resume_id}/text")
def get_resume_text(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resume = _owned_resume(db, user.id, resume_id)
    return {"text": resume.extracted_text}


@router.delete("/resumes/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resume = _owned_resume(db, user.id, resume_id)
    upload_dir = Path(settings.upload_dir).resolve()
    stored_path = upload_dir / f"{resume.stored_file_reference}.{resume.file_type}"
    if stored_path.exists():
        stored_path.unlink()
    db.delete(resume)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/resumes/{resume_id}/analyze", response_model=AnalysisResponse)
async def create_analysis(
    resume_id: int,
    target_role: str | None = Query(default=None, max_length=120),
    ai_consent: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    resume = _owned_resume(db, user.id, resume_id)
    if target_role is not None and target_role not in ROLE_REQUIREMENTS:
        raise HTTPException(status_code=422, detail="Choose a supported target role.")
    result = analyze_resume(resume.extracted_text, target_role)
    if ai_consent:
        if not (settings.ai_api_base_url and settings.ai_api_key and settings.ai_model):
            raise HTTPException(status_code=400, detail="AI is not configured. Rule-based analysis remains available.")
        try:
            result["summary"] = await summarize_with_provider(resume.extracted_text)
            result["analysis_mode"] = "rule-based + AI summary"
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise HTTPException(status_code=502, detail="The configured AI provider failed to return a valid result.") from exc
    analysis = ResumeAnalysis(resume_id=resume.id, **result)
    db.add(analysis)
    db.flush()
    role = target_role or (result["career_recommendations"][0]["title"] if result["career_recommendations"] else "Career exploration")
    existing_tasks = set(
        db.scalars(
            select(LearningTask.title).where(
                LearningTask.user_id == user.id,
                LearningTask.resume_id == resume.id,
            )
        ).all()
    )
    for gap in result["skill_gaps"]:
        resource = gap["resource"]
        learning_stages = [
            (
                "Beginner",
                f"Learn {gap['skill']} foundations",
                f"Study the fundamentals of {gap['skill']}. {gap['reason']} It was not found in your resume; you may still have the skill.",
                resource["url"] if resource else "",
                "Estimate: 1-2 weeks",
            ),
            (
                "Intermediate",
                f"Practice {gap['skill']} with exercises",
                f"Complete focused exercises in {gap['skill']} and write down what you learned. Add it to your resume only if it reflects genuine experience.",
                "",
                "Estimate: 1-2 weeks",
            ),
            (
                "Advanced",
                f"Build a portfolio project using {gap['skill']}",
                f"Create a small original project demonstrating {gap['skill']}. Document the problem, your contribution, and verifiable results; do not claim work you did not complete.",
                "",
                "Estimate: 2-4 weeks",
            ),
        ]
        for stage, task_title, description, resource_url, effort in learning_stages:
            if task_title not in existing_tasks:
                db.add(
                    LearningTask(
                        user_id=user.id,
                        resume_id=resume.id,
                        target_role=role,
                        title=task_title,
                        description=description,
                        resource_url=resource_url,
                        estimated_effort=effort,
                        stage=stage,
                    )
                )
                existing_tasks.add(task_title)
    db.commit()
    db.refresh(analysis)
    return analysis


@router.get("/resumes/{resume_id}/analysis", response_model=AnalysisResponse)
def latest_analysis(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_resume(db, user.id, resume_id)
    analysis = db.scalar(
        select(ResumeAnalysis).where(ResumeAnalysis.resume_id == resume_id).order_by(ResumeAnalysis.created_at.desc())
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis found for this resume")
    return analysis


@router.get("/resumes/{resume_id}/analysis/history", response_model=list[AnalysisResponse])
def analysis_history(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_resume(db, user.id, resume_id)
    return db.scalars(
        select(ResumeAnalysis).where(ResumeAnalysis.resume_id == resume_id).order_by(ResumeAnalysis.created_at.desc())
    ).all()


@router.get("/resumes/{resume_id}/report/json")
def export_json(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    analysis = _get_latest(db, user.id, resume_id)
    return AnalysisResponse.model_validate(analysis).model_dump(mode="json")


@router.get("/resumes/{resume_id}/report/pdf")
def export_pdf(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from io import BytesIO

    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    analysis = _get_latest(db, user.id, resume_id)
    resume = _owned_resume(db, user.id, resume_id)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 50
    lines = [
        "CareerLens AI - Resume Analysis",
        f"Resume: {resume.original_filename}",
        f"Quality assessment: {analysis.quality_score}/100 (heuristic; not an ATS score)",
        "",
        "Summary",
        analysis.summary,
        "",
        "Detected skills",
        ", ".join(item["name"] for item in analysis.extracted_skills) or "No skills detected",
        "",
        "Career recommendations",
    ]
    lines.extend(f"{item['title']} - {item['match_score']}% heuristic match" for item in analysis.career_recommendations)
    lines.extend(["", "Suggestions"])
    lines.extend(item["suggestion"] for item in analysis.improvement_suggestions)
    for line in lines:
        chunks = [line[i:i + 95] for i in range(0, max(1, len(line)), 95)]
        for chunk in chunks:
            if y < 50:
                pdf.showPage()
                y = height - 50
            pdf.drawString(50, y, chunk.encode("latin-1", errors="replace").decode("latin-1"))
            y -= 15
    pdf.save()
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="careerlens-analysis-{resume.id}.pdf"'},
    )


def _get_latest(db: Session, user_id: int, resume_id: int) -> ResumeAnalysis:
    _owned_resume(db, user_id, resume_id)
    analysis = db.scalar(
        select(ResumeAnalysis).where(ResumeAnalysis.resume_id == resume_id).order_by(ResumeAnalysis.created_at.desc())
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis found for this resume")
    return analysis


@router.post("/job-descriptions/analyze")
def analyze_job_description(
    payload: JobDescriptionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    resume = _owned_resume(db, user.id, payload.resume_id)
    result = match_job_description(resume.extracted_text, payload.job_description)
    job = JobMatch(user_id=user.id, resume_id=resume.id, job_description=payload.job_description, **result)
    db.add(job)
    db.commit()
    db.refresh(job)
    return {
        "id": job.id,
        "match_score": job.match_score,
        "matched_skills": job.matched_skills,
        "missing_skills": job.missing_skills,
        "suggestions": job.suggestions,
        "score_method": result["score_method"],
    }


@router.get("/learning/roadmap", response_model=list[LearningTaskResponse])
def learning_roadmap(
    resume_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(LearningTask).where(LearningTask.user_id == user.id)
    if resume_id is not None:
        _owned_resume(db, user.id, resume_id)
        query = query.where(LearningTask.resume_id == resume_id)
    return db.scalars(query.order_by(LearningTask.created_at.desc())).all()


@router.patch("/learning/tasks/{task_id}", response_model=LearningTaskResponse)
def update_learning_task(
    task_id: int,
    payload: LearningTaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.scalar(select(LearningTask).where(LearningTask.id == task_id, LearningTask.user_id == user.id))
    if task is None:
        raise HTTPException(status_code=404, detail="Learning task not found")
    task.completed = payload.completed
    db.commit()
    db.refresh(task)
    return task


@router.get("/careers/roles")
def career_roles(user: User = Depends(get_current_user)):
    return [{"title": role, "required_skills": data["skills"], "preferred_skills": data["preferred"]} for role, data in ROLE_REQUIREMENTS.items()]


@router.get("/careers/recommendations")
def career_recommendations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    analyses = db.scalars(
        select(ResumeAnalysis)
        .join(Resume)
        .where(Resume.user_id == user.id)
        .order_by(ResumeAnalysis.created_at.desc())
    ).all()
    latest_by_resume: dict[int, ResumeAnalysis] = {}
    for analysis in analyses:
        latest_by_resume.setdefault(analysis.resume_id, analysis)
    return [
        {
            "resume_id": resume_id,
            "recommendations": analysis.career_recommendations,
            "analysis_created_at": analysis.created_at,
        }
        for resume_id, analysis in latest_by_resume.items()
    ]


@router.post("/careers/match")
def match_career_role(
    resume_id: int,
    target_role: str = Query(min_length=1, max_length=120),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if target_role not in ROLE_REQUIREMENTS:
        raise HTTPException(status_code=422, detail="Choose a supported target role.")
    resume = _owned_resume(db, user.id, resume_id)
    result = analyze_resume(resume.extracted_text, target_role)
    return next(role for role in result["career_recommendations"] if role["title"] == target_role)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    resumes = db.scalars(select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())).all()
    tasks = db.scalars(select(LearningTask).where(LearningTask.user_id == user.id)).all()
    latest = None
    if resumes:
        analysis = db.scalar(
            select(ResumeAnalysis)
            .join(Resume)
            .where(Resume.user_id == user.id)
            .order_by(ResumeAnalysis.created_at.desc())
        )
        if analysis:
            latest = {
                "resume_id": analysis.resume_id,
                "quality_score": analysis.quality_score,
                "summary": analysis.summary,
                "career_recommendations": analysis.career_recommendations[:3],
                "extracted_skills": analysis.extracted_skills[:8],
                "skill_gaps": analysis.skill_gaps[:5],
            }
    return {
        "resumes_analyzed": len({analysis.resume_id for resume in resumes for analysis in resume.analyses}),
        "resume_count": len(resumes),
        "learning_progress": {
            "completed": sum(task.completed for task in tasks),
            "total": len(tasks),
        },
        "latest_analysis": latest,
        "recent_resumes": [
            {"id": resume.id, "original_filename": resume.original_filename, "created_at": resume.created_at}
            for resume in resumes[:5]
        ],
    }


@router.get("/resumes/compare-versions")
def compare_resumes(
    first_id: int,
    second_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    first = _get_latest(db, user.id, first_id)
    second = _get_latest(db, user.id, second_id)
    first_skills = {item["name"] for item in first.extracted_skills}
    second_skills = {item["name"] for item in second.extracted_skills}
    return {
        "added_skills": sorted(second_skills - first_skills),
        "removed_skills": sorted(first_skills - second_skills),
        "quality_change": second.quality_score - first.quality_score,
        "first_quality_score": first.quality_score,
        "second_quality_score": second.quality_score,
    }
