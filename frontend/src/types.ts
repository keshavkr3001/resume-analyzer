export interface Skill {
  name: string;
  evidence: string;
  status: string;
}

export interface Recommendation {
  title: string;
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
  why: string;
  next_steps: string[];
  score_method: string;
}

export interface Gap {
  skill: string;
  importance: string;
  reason: string;
  documentation_status: string;
  estimated_effort: string;
  resource: { title: string; url: string } | null;
}

export interface Analysis {
  id: number;
  resume_id: number;
  summary: string;
  extracted_skills: Skill[];
  skill_categories: Record<string, Skill[]>;
  quality_score: number;
  score_breakdown: Record<string, number>;
  career_recommendations: Recommendation[];
  skill_gaps: Gap[];
  improvement_suggestions: { priority: string; issue: string; why: string; suggestion: string }[];
  ats_checks: { check: string; status: string; detail: string }[];
  analysis_mode: string;
  created_at: string;
}

export interface Resume {
  id: number;
  original_filename: string;
  file_type: string;
  created_at: string;
  latest_analysis?: { quality_score: number; created_at: string } | null;
}

export interface LearningTask {
  id: number;
  resume_id: number | null;
  target_role: string;
  title: string;
  description: string;
  resource_url: string;
  estimated_effort: string;
  stage: string;
  completed: boolean;
}
