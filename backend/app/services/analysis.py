import re
from collections import defaultdict

SKILLS: dict[str, dict[str, list[str]]] = {
    "Programming languages": {"python": ["python"], "javascript": ["javascript", "js"], "typescript": ["typescript"], "java": ["java"], "c++": ["c++"], "sql": ["sql"], "go": ["golang", "go language"]},
    "Frameworks and libraries": {"react": ["react", "react.js"], "fastapi": ["fastapi"], "django": ["django"], "flask": ["flask"], "node.js": ["node.js", "nodejs"], "spring": ["spring boot", "spring"]},
    "Databases": {"postgresql": ["postgresql", "postgres"], "mysql": ["mysql"], "sqlite": ["sqlite"], "mongodb": ["mongodb", "mongo"]},
    "Developer tools": {"git": ["git", "github"], "docker": ["docker"], "linux": ["linux"], "figma": ["figma"]},
    "Cloud and DevOps": {"aws": ["aws", "amazon web services"], "azure": ["azure"], "gcp": ["google cloud", "gcp"], "kubernetes": ["kubernetes", "k8s"], "ci/cd": ["ci/cd", "continuous integration"]},
    "Data science and AI": {"machine learning": ["machine learning", "scikit-learn"], "pandas": ["pandas"], "numpy": ["numpy"], "tensorflow": ["tensorflow"], "pytorch": ["pytorch"], "data analysis": ["data analysis", "data analytics"]},
    "Soft skills": {"communication": ["communication", "presentations"], "teamwork": ["teamwork", "collaboration"], "problem solving": ["problem solving", "analytical thinking"], "leadership": ["leadership", "led a team"]},
}

ROLE_REQUIREMENTS: dict[str, dict[str, object]] = {
    "Frontend Developer": {"skills": ["javascript", "typescript", "react", "git", "html", "css"], "preferred": ["figma", "testing"]},
    "Backend Developer": {"skills": ["python", "fastapi", "sql", "postgresql", "git"], "preferred": ["docker", "aws", "rest api"]},
    "Full-Stack Developer": {"skills": ["javascript", "react", "python", "sql", "git"], "preferred": ["docker", "fastapi", "node.js"]},
    "Data Analyst": {"skills": ["sql", "python", "pandas", "data analysis", "excel"], "preferred": ["tableau", "power bi", "statistics"]},
    "Data Scientist": {"skills": ["python", "sql", "pandas", "numpy", "machine learning"], "preferred": ["tensorflow", "pytorch", "statistics"]},
    "Machine Learning Engineer": {"skills": ["python", "machine learning", "sql", "git"], "preferred": ["tensorflow", "pytorch", "docker"]},
    "QA Engineer": {"skills": ["testing", "python", "sql", "git"], "preferred": ["selenium", "automation"]},
    "Cloud Engineer": {"skills": ["linux", "aws", "docker", "ci/cd"], "preferred": ["kubernetes", "terraform", "azure"]},
    "Cybersecurity Analyst": {"skills": ["linux", "networking", "python"], "preferred": ["security", "siem", "aws"]},
    "UI/UX Designer": {"skills": ["figma", "communication", "user research"], "preferred": ["prototyping", "accessibility"]},
    "Business Analyst": {"skills": ["sql", "communication", "data analysis", "excel"], "preferred": ["tableau", "power bi", "requirements analysis"]},
}

RESOURCES = {
    "python": ("Python tutorial", "https://docs.python.org/3/tutorial/"),
    "javascript": ("JavaScript guide", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"),
    "typescript": ("TypeScript handbook", "https://www.typescriptlang.org/docs/handbook/intro.html"),
    "react": ("React Learn", "https://react.dev/learn"),
    "fastapi": ("FastAPI tutorial", "https://fastapi.tiangolo.com/tutorial/"),
    "sql": ("SQLBolt interactive lessons", "https://sqlbolt.com/"),
    "postgresql": ("PostgreSQL tutorial", "https://www.postgresql.org/docs/current/tutorial.html"),
    "git": ("Pro Git book", "https://git-scm.com/book/en/v2"),
    "docker": ("Docker getting started", "https://docs.docker.com/get-started/"),
    "pandas": ("pandas getting started", "https://pandas.pydata.org/docs/getting_started/"),
}


def _contains(text: str, term: str) -> bool:
    return bool(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.IGNORECASE))


def _evidence(text: str, term: str) -> str:
    for line in text.splitlines():
        if _contains(line, term):
            return line[:240]
    return ""


def analyze_resume(text: str, target_role: str | None = None) -> dict:
    lower = text.lower()
    categorized: dict[str, list[dict]] = defaultdict(list)
    for category, entries in SKILLS.items():
        for skill, aliases in entries.items():
            matched = next((alias for alias in aliases if _contains(text, alias)), None)
            if matched:
                categorized[category].append({"name": skill, "evidence": _evidence(text, matched), "status": "mentioned"})

    section_terms = {
        "contact information": ["@", "linkedin", "phone", "mobile"],
        "education": ["education", "university", "college", "bachelor", "degree"],
        "experience": ["experience", "intern", "employment", "work history"],
        "projects": ["project", "github", "portfolio"],
        "skills": ["skills", "technologies", "tools"],
    }
    sections = {name: any(term in lower for term in terms) for name, terms in section_terms.items()}
    achievement_lines = [line for line in text.splitlines() if re.search(r"\b\d+(?:\.\d+)?%?\b", line) and len(line) > 40]
    scores = {
        "Section completeness": round(100 * sum(sections.values()) / len(sections)),
        "Relevant skills": min(100, sum(len(skills) for skills in categorized.values()) * 12),
        "Achievement specificity": min(100, len(achievement_lines) * 25),
        "Readable text": 85 if len(text) > 200 else 55,
    }
    quality = round(sum(scores.values()) / len(scores))
    summary_parts = []
    for label in ("education", "experience", "projects", "certifications"):
        evidence = _evidence(text, label)
        summary_parts.append(f"{label.title()}: mentioned" if evidence else f"{label.title()}: not clearly identified")
    summary_parts.append(
        "Detected skills: " + (", ".join(item["name"] for group in categorized.values() for item in group) or "none identified")
    )

    roles = []
    target_order = [target_role] if target_role in ROLE_REQUIREMENTS else []
    target_order += [role for role in ROLE_REQUIREMENTS if role not in target_order]
    all_resume_terms = [skill["name"] for group in categorized.values() for skill in group]
    for role in target_order:
        requirements = ROLE_REQUIREMENTS[role]
        required = requirements["skills"]
        preferred = requirements["preferred"]
        matched = [skill for skill in required + preferred if _contains(text, skill)]
        missing = [skill for skill in required if skill not in matched]
        score = round(100 * ((len([s for s in required if s in matched]) + 0.5 * len([s for s in preferred if s in matched])) / (len(required) + 0.5 * len(preferred))))
        roles.append({
            "title": role,
            "match_score": score,
            "matching_skills": matched,
            "missing_skills": missing,
            "why": f"{len(matched)} of {len(required) + len(preferred)} listed role skills were found in the resume text.",
            "next_steps": [f"Document genuine experience with {missing[0]}." if missing else "Build a portfolio project demonstrating your strongest matching skills."],
            "score_method": "Required matches count 1 point; preferred matches count 0.5; normalized to 100. Keyword presence is not proof of proficiency or an ATS score.",
        })
    roles.sort(key=lambda row: row["match_score"], reverse=True)
    selected = next((role for role in roles if role["title"] == target_role), roles[0] if roles else None)
    if target_role and selected:
        roles.remove(selected)
        roles.insert(0, selected)
    roles = roles[:5]
    gaps = []
    if selected:
        for skill in selected["missing_skills"]:
            resource = RESOURCES.get(skill)
            gaps.append({
                "skill": skill, "importance": "high", "reason": f"Listed as a required skill for {selected['title']}.",
                "related_existing_skills": all_resume_terms[:3],
                "documentation_status": "Not found in the resume; this does not prove the student lacks the skill.",
                "resource": {"title": resource[0], "url": resource[1]} if resource else None,
                "estimated_effort": "Estimate: 2-4 weeks of regular practice",
            })
    suggestions = []
    missing_sections = [name for name, present in sections.items() if not present]
    if missing_sections:
        suggestions.append({"priority": "high", "issue": "Some standard resume sections were not identified.", "why": "Clear sections help readers scan your background.", "suggestion": "Add or clearly label: " + ", ".join(missing_sections) + "."})
    if not achievement_lines:
        suggestions.append({"priority": "medium", "issue": "No measurable outcomes were detected.", "why": "Specific outcomes help communicate the scope of your work.", "suggestion": "Where accurate, add real counts, time saved, scale, or other outcomes. Do not estimate or invent figures."})
    if not any(term in lower for term in ("linkedin", "github", "portfolio")):
        suggestions.append({"priority": "medium", "issue": "No portfolio link was identified.", "why": "A portfolio can help reviewers inspect relevant work.", "suggestion": "Add a link to a genuine professional profile or project portfolio if available."})
    if not suggestions:
        suggestions.append({"priority": "low", "issue": "No major rule-based content gaps detected.", "why": "This heuristic check only evaluates text patterns.", "suggestion": "Review formatting and tailor examples to each role; this is not an ATS score."})
    ats_checks = [
        {"check": "Extractable text", "status": "Pass", "detail": "Text was extracted from the uploaded document."},
        {"check": "Standard headings", "status": "Pass" if any(sections.values()) else "Review", "detail": "Heuristic check of common section labels."},
        {"check": "Contact information", "status": "Pass" if sections["contact information"] else "Review", "detail": "Email, phone, or professional profile not fully verified."},
        {"check": "Measurable outcomes", "status": "Pass" if achievement_lines else "Review", "detail": "Numeric patterns are not proof of achievement quality."},
    ]
    return {
        "summary": "Rule-based overview from resume text. " + "; ".join(summary_parts) + ". Missing sections indicate text was not detected, not necessarily absent from the original.",
        "extracted_skills": [skill for group in categorized.values() for skill in group],
        "skill_categories": dict(categorized),
        "quality_score": quality,
        "score_breakdown": scores,
        "career_recommendations": roles,
        "skill_gaps": gaps,
        "improvement_suggestions": suggestions,
        "ats_checks": ats_checks,
        "analysis_mode": "rule-based",
    }


def match_job_description(text: str, job_description: str) -> dict:
    skills = sorted({skill for entries in SKILLS.values() for skill in entries if _contains(job_description, skill)})
    matched = [skill for skill in skills if _contains(text, skill)]
    missing = [skill for skill in skills if skill not in matched]
    score = round(100 * len(matched) / len(skills)) if skills else 0
    return {
        "match_score": score,
        "matched_skills": matched,
        "missing_skills": missing,
        "suggestions": [
            "Tailor the summary and project bullets to relevant experience already supported by your resume.",
            "Only add missing skills if you genuinely have that experience; do not keyword-stuff or misrepresent qualifications.",
        ] if skills else ["No skills from the built-in dictionary were detected in this job description."],
        "score_method": "Matched recognized skills divided by recognized skills in the description. This is a keyword heuristic, not a hiring prediction.",
    }
