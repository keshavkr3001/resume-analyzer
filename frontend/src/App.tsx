import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowRight, BarChart3, BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleHelp,
  FileCheck2, FileText, GraduationCap, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck,
  Sparkles, Target, Trash2, UploadCloud, X,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, errorMessage } from "./api";
import type { Analysis, LearningTask, Resume } from "./types";

type User = { id: number; name: string; email: string };
const authSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").optional(),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters"),
});
type AuthValues = z.infer<typeof authSchema>;

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("careerlens-token");
    if (!token) {
      setChecking(false);
      return;
    }
    api.get<User>("/api/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => sessionStorage.removeItem("careerlens-token"))
      .finally(() => setChecking(false));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // The short-lived bearer token is still removed locally if the API is unreachable.
    }
    sessionStorage.removeItem("careerlens-token");
    setUser(null);
    navigate("/");
  }, [navigate]);

  if (checking) return <div className="loading-screen"><div className="spinner" />Loading CareerLens</div>;
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="login" onAuth={setUser} />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage mode="register" onAuth={setUser} />} />
      <Route path="/*" element={user ? <Workspace user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function Landing() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link className="brand" to="/"><span className="brand-mark"><Sparkles size={18} /></span> CareerLens <span className="brand-ai">AI</span></Link>
        <div className="nav-actions"><Link className="text-button" to="/login">Log in</Link><Link className="button button-primary small" to="/register">Get started <ArrowRight size={16} /></Link></div>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> BUILT FOR YOUR NEXT STEP</div>
          <h1>Your resume is a starting point. <em>Make it a strategy.</em></h1>
          <p>Get a clear view of your strengths, explore entry-level roles that fit, and turn skill gaps into a practical learning plan.</p>
          <div className="hero-actions"><Link className="button button-primary" to="/register">Analyze my resume <ArrowRight size={17} /></Link><a className="text-button" href="#how-it-works">See how it works <ChevronRight size={16} /></a></div>
          <div className="privacy-note" id="privacy"><ShieldCheck size={16} /> Your resume stays private to your account. External AI processing is opt-in.</div>
        </div>
        <div className="hero-visual" aria-label="Overview of CareerLens features">
          <div className="visual-top"><div><div className="visual-label">YOUR CAREER WORKSPACE</div><strong>Guidance built from your resume</strong></div><span className="ready-chip"><span /> READY WHEN YOU ARE</span></div>
          <div className="visual-divider" />
          <div className="visual-label">AFTER YOU UPLOAD A RESUME</div>
          <div className="visual-feature"><span className="role-icon"><FileCheck2 size={17} /></span><div><strong>Skill evidence</strong><small>Skills and their resume context</small></div><ChevronRight size={16} /></div>
          <div className="visual-feature"><span className="role-icon"><BriefcaseBusiness size={17} /></span><div><strong>Career directions</strong><small>Transparent role-fit estimates</small></div><ChevronRight size={16} /></div>
          <div className="visual-feature"><span className="role-icon"><GraduationCap size={17} /></span><div><strong>Practical next steps</strong><small>Learning tasks connected to gaps</small></div><ChevronRight size={16} /></div>
          <div className="visual-note"><ShieldCheck size={16} /><span><b>Private by default.</b> External AI use is optional and requires your consent.</span></div>
        </div>
      </section>
      <section id="how-it-works" className="steps-section">
        <div className="section-heading"><span className="eyebrow">A CLEARER CAREER PATH</span><h2>Turn your experience into momentum</h2><p>No vague scores. Just practical guidance based on what your resume actually says.</p></div>
        <div className="steps-grid">
          <Feature icon={<FileText />} number="01" title="Understand your resume" text="Extract skills and identify content strengths with transparent, explainable checks." />
          <Feature icon={<Target />} number="02" title="Explore your fit" text="Compare your documented skills with entry-level role requirements and job descriptions." />
          <Feature icon={<GraduationCap />} number="03" title="Plan what’s next" text="Turn underrepresented skills into manageable learning tasks and portfolio ideas." />
        </div>
      </section>
      <footer className="landing-footer"><Link className="brand" to="/"><span className="brand-mark"><Sparkles size={15} /></span> CareerLens <span className="brand-ai">AI</span></Link><span>Private by design. Built for students and fresh graduates.</span><a href="#privacy">Privacy</a></footer>
    </main>
  );
}

function Feature({ icon, number, title, text }: { icon: React.ReactNode; number: string; title: string; text: string }) {
  return <article className="feature-card"><div className="feature-head"><span className="feature-icon">{icon}</span><span>{number}</span></div><h3>{title}</h3><p>{text}</p></article>;
}

function AuthPage({ mode, onAuth }: { mode: "login" | "register"; onAuth: (user: User) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const submit = async (values: AuthValues) => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/api/auth/${mode}`, values);
      sessionStorage.setItem("careerlens-token", data.access_token);
      onAuth(data.user);
      navigate("/dashboard");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" to="/"><span className="brand-mark"><Sparkles size={17} /></span> CareerLens <span className="brand-ai">AI</span></Link>
      <form className="auth-card" onSubmit={handleSubmit(submit)} noValidate>
        <div className="eyebrow">YOUR CAREER, WITH CLARITY</div>
        <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p>{mode === "register" ? "Start building a more intentional next step." : "Pick up where you left off."}</p>
        {mode === "register" && <label>Your name<input autoComplete="name" placeholder="Alex Morgan" {...register("name")} />{errors.name && <span className="field-error">{errors.name.message}</span>}</label>}
        <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
        <label>Password<input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="At least 10 characters" {...register("password")} />{errors.password && <span className="field-error">{errors.password.message}</span>}</label>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="button button-primary full" disabled={busy}>{busy ? <><span className="spinner small-spinner" />Please wait…</> : mode === "register" ? "Create account" : "Log in"} <ArrowRight size={16} /></button>
        <p className="auth-switch">{mode === "register" ? "Already have an account?" : "New to CareerLens?"} <Link to={mode === "register" ? "/login" : "/register"}>{mode === "register" ? "Log in" : "Create an account"}</Link></p>
        <div className="privacy-card"><ShieldCheck size={17} /><span>Your uploaded resume is only visible to your account. AI processing is off unless you opt in.</span></div>
      </form>
      <span className="auth-footnote">Career guidance is informational and does not guarantee employment.</span>
    </main>
  );
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const nav = useMemo(() => [
    { to: "/dashboard", title: "Overview", icon: <LayoutDashboard size={18} /> },
    { to: "/resumes", title: "My resumes", icon: <FileCheck2 size={18} /> },
    { to: "/learning", title: "Learning plan", icon: <BookOpen size={18} /> },
    { to: "/job-match", title: "Job description match", icon: <Target size={18} /> },
    { to: "/settings", title: "Privacy & settings", icon: <Settings size={18} /> },
  ], []);
  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3800);
  }, []);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link className="brand side-brand" to="/dashboard"><span className="brand-mark"><Sparkles size={17} /></span> CareerLens <span className="brand-ai">AI</span></Link>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">{nav.map(item => <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>{item.icon}<span>{item.title}</span></Link>)}</nav>
        <div className="sidebar-bottom">
          <div className="help-card"><CircleHelp size={17} /><b>Need a hand?</b><span>Review how your score works.</span><a href="#scoring-note">Scoring details <ArrowRight size={13} /></a></div>
          <div className="user-card"><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="user-copy"><b>{user.name}</b><span>{user.email}</span></div><button className="icon-button" title="Log out" onClick={onLogout}><LogOut size={17} /></button></div>
        </div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <div className="app-main">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumb">Workspace <ChevronRight size={14} /> <span>Career dashboard</span></div><div className="topbar-right"><span className="secure-label"><ShieldCheck size={15} /> Private workspace</span><div className="avatar small-avatar">{user.name.slice(0, 1).toUpperCase()}</div></div></header>
        <main className="page-content"><Routes>
          <Route path="/dashboard" element={<Dashboard notify={notify} />} />
          <Route path="/resumes" element={<ResumeLibrary notify={notify} />} />
          <Route path="/analysis/:resumeId" element={<AnalysisPage notify={notify} />} />
          <Route path="/learning" element={<LearningPage notify={notify} />} />
          <Route path="/job-match" element={<JobMatchPage notify={notify} />} />
          <Route path="/settings" element={<SettingsPage onLogout={onLogout} notify={notify} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes></main>
      </div>
      {toast && <div className="toast" role="status"><Check size={17} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>
  );
}

function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>;
}

function Dashboard({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/api/dashboard").then(({ data: result }) => setData(result)).catch(reason => setError(errorMessage(reason))); }, []);
  if (error) return <ErrorState message={error} />;
  if (!data) return <div className="loading-inline"><div className="spinner" />Loading your dashboard…</div>;
  const latest = data.latest_analysis;
  return <>
    <PageTitle eyebrow="YOUR CAREER DASHBOARD" title="A clearer view of your next step." detail="Your resume insights, career matches, and learning progress in one place." action={<Link className="button button-primary" to="/resumes"><Plus size={17} /> Add resume</Link>} />
    <div className="stat-grid">
      <Stat icon={<FileText size={18} />} label="Resumes analyzed" value={data.resumes_analyzed} note={`${data.resume_count} resume${data.resume_count === 1 ? "" : "s"} uploaded`} />
      <Stat icon={<BarChart3 size={18} />} label="Latest quality check" value={latest ? `${latest.quality_score}/100` : "—"} note={latest ? "Heuristic content assessment" : "Upload a resume to begin"} />
      <Stat icon={<BookOpen size={18} />} label="Learning tasks done" value={`${data.learning_progress.completed}/${data.learning_progress.total}`} note="Your progress, at a glance" />
    </div>
    {latest ? <section className="dashboard-grid">
      <article className="panel latest-panel"><div className="panel-heading"><div><span className="eyebrow">LATEST RESUME REVIEW</span><h2>Start with what you already have</h2></div><span className="score-chip">{latest.quality_score}<small>/100</small></span></div><p>{latest.summary}</p><div className="chip-list">{latest.extracted_skills.map((skill: { name: string }) => <span className="chip" key={skill.name}>{skill.name}</span>)}</div><Link className="inline-link" to={`/analysis/${latest.resume_id}`}>View complete analysis <ArrowRight size={15} /></Link></article>
      <article className="panel roles-panel"><div className="eyebrow">CAREER DIRECTIONS</div><h2>Roles to explore</h2>{latest.career_recommendations.map((role: any) => <div className="role-row" key={role.title}><div><b>{role.title}</b><span>{role.matching_skills.slice(0, 3).join(" · ") || "Explore the requirements"}</span></div><div className="match-meter"><span style={{ width: `${role.match_score}%` }} /></div><strong>{role.match_score}%</strong></div>)}<p className="fine-print">Heuristic keyword match—not a hiring prediction.</p></article>
    </section> : <EmptyState icon={<Sparkles />} title="Your next step starts with a resume" text="Upload a PDF or DOCX to extract your skills, review your resume, and find roles worth exploring." action={<Link className="button button-primary" to="/resumes"><UploadCloud size={17} /> Upload a resume</Link>} />}
    <div className="section-row"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Your resumes</h2></div><Link className="inline-link" to="/resumes">View all <ArrowRight size={15} /></Link></div>
    <RecentResumes resumes={data.recent_resumes} notify={notify} />
    <p id="scoring-note" className="scoring-note"><ShieldCheck size={16} /><span><b>About the score:</b> a transparent rule-based quality estimate from section completeness, detected skills, achievement specificity, and text readability. It is not an ATS score and does not predict selection.</span></p>
  </>;
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: React.ReactNode; note: string }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><b>{value}</b><small>{note}</small></article>;
}

function RecentResumes({ resumes, notify }: { resumes: Resume[]; notify: (message: string) => void }) {
  if (!resumes?.length) return <div className="panel empty-inline">No resume uploads yet. Your files will appear here after upload.</div>;
  return <div className="panel resume-list">{resumes.map(resume => <div className="resume-row" key={resume.id}><span className="file-icon"><FileText size={18} /></span><div><b>{resume.original_filename}</b><small>{new Date(resume.created_at).toLocaleDateString()}</small></div><div className="resume-quality">{resume.latest_analysis ? <span>Score {resume.latest_analysis.quality_score}</span> : <span>Not analyzed</span>}</div><Link className="icon-button" to={`/analysis/${resume.id}`} aria-label={`Open ${resume.original_filename}`}><ChevronRight size={18} /></Link><button className="icon-button danger-hover" title="Delete resume" onClick={() => deleteResume(resume.id, notify)}><Trash2 size={16} /></button></div>)}</div>;
}

async function deleteResume(id: number, notify: (message: string) => void) {
  if (!window.confirm("Delete this resume and its analyses? This cannot be undone.")) return;
  try { await api.delete(`/api/resumes/${id}`); notify("Resume and associated analysis deleted."); window.location.reload(); }
  catch (error) { notify(errorMessage(error)); }
}

function ResumeLibrary({ notify }: { notify: (message: string) => void }) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [maxUploadMb, setMaxUploadMb] = useState(8);
  const load = useCallback(() => api.get<Resume[]>("/api/resumes").then(({ data }) => setResumes(data)).catch(reason => setError(errorMessage(reason))), []);
  useEffect(() => {
    void load();
    api.get<{ max_upload_mb: number }>("/api/config").then(({ data }) => setMaxUploadMb(data.max_upload_mb)).catch(reason => setError(errorMessage(reason)));
  }, [load]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) { setError("Choose a PDF or DOCX file."); return; }
    if (file.size > maxUploadMb * 1024 * 1024) { setError(`Your file must be ${maxUploadMb} MB or smaller.`); return; }
    setBusy(true); setError("");
    const form = new FormData(); form.append("file", file);
    try {
      const { data } = await api.post<Resume>("/api/resumes/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      notify("Resume uploaded and text extracted.");
      setFile(null);
      await load();
      window.location.assign(`/analysis/${data.id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  return <>
    <PageTitle eyebrow="RESUME LIBRARY" title="Your experience, organized." detail="Upload a resume to extract its text and generate a private, evidence-based review." />
    <form className="upload-panel" onSubmit={submit}>
      <label className="dropzone" htmlFor="resume-file" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }}><span className="upload-icon"><UploadCloud size={24} /></span><b>{file ? file.name : "Choose a resume to get started"}</b><span>Drop a file here or <strong>browse your device</strong></span><small>PDF or DOCX · {maxUploadMb} MB maximum · Scanned PDFs require OCR, which is not enabled.</small><input id="resume-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <div className="upload-actions"><div className="upload-privacy"><ShieldCheck size={16} /> Stored privately with your account</div><button className="button button-primary" disabled={!file || busy}>{busy ? <><span className="spinner small-spinner" />Extracting text…</> : <>Upload resume <ArrowRight size={16} /></>}</button></div>
    </form>
    <div className="section-row"><div><span className="eyebrow">YOUR DOCUMENTS</span><h2>Uploaded resumes <span className="count-badge">{resumes.length}</span></h2></div></div>
    {resumes.length ? <div className="panel resume-list">{resumes.map(resume => <div className="resume-row" key={resume.id}><span className="file-icon"><FileText size={18} /></span><div><b>{resume.original_filename}</b><small>{resume.file_type.toUpperCase()} · Added {new Date(resume.created_at).toLocaleDateString()}</small></div><div className="resume-quality">{resume.latest_analysis ? `Score ${resume.latest_analysis.quality_score}/100` : "Ready to analyze"}</div><Link className="button button-quiet small" to={`/analysis/${resume.id}`}>{resume.latest_analysis ? "Open analysis" : "Analyze"} <ArrowRight size={14} /></Link><button className="icon-button danger-hover" title="Delete resume" onClick={() => deleteResume(resume.id, notify)}><Trash2 size={16} /></button></div>)}</div> : <EmptyState icon={<FileText />} title="No documents yet" text="Your uploaded resumes stay private and are never overwritten." />}
    {resumes.filter(resume => resume.latest_analysis).length > 1 && <ResumeComparison resumes={resumes.filter(resume => resume.latest_analysis)} />}
    <p className="scoring-note"><ShieldCheck size={16} /><span>CareerLens extracts selectable text only. If your PDF is a scan, OCR is not configured; try uploading a text-based PDF or DOCX.</span></p>
  </>;
}

function ResumeComparison({ resumes }: { resumes: Resume[] }) {
  const [first, setFirst] = useState(String(resumes[0].id));
  const [second, setSecond] = useState(String(resumes[1].id));
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const compare = async () => {
    setError(""); setResult(null);
    try {
      const { data } = await api.get("/api/resumes/compare-versions", { params: { first_id: first, second_id: second } });
      setResult(data);
    } catch (reason) { setError(errorMessage(reason)); }
  };
  return <section className="panel compare-panel"><div className="eyebrow">RESUME VERSION COMPARISON</div><h2>See what changed between versions</h2><p>Both resumes need a completed analysis. Comparison covers detected skills and quality estimates.</p><div className="compare-controls"><label>Earlier version<select value={first} onChange={event => setFirst(event.target.value)}>{resumes.map(resume => <option value={resume.id} key={resume.id}>{resume.original_filename}</option>)}</select></label><label>Newer version<select value={second} onChange={event => setSecond(event.target.value)}>{resumes.map(resume => <option value={resume.id} key={resume.id}>{resume.original_filename}</option>)}</select></label><button className="button button-quiet" onClick={compare} disabled={first === second}>Compare versions</button></div>{error && <div className="error-box">{error}</div>}{result && <div className="comparison-result"><b>Quality estimate change: {result.quality_change > 0 ? "+" : ""}{result.quality_change} points</b><div className="match-columns"><div><b>Newly detected</b><div className="chip-list">{result.added_skills.map((skill: string) => <span className="chip" key={skill}>{skill}</span>)}{!result.added_skills.length && <small className="muted">No new detected skills</small>}</div></div><div><b>No longer detected</b><div className="chip-list">{result.removed_skills.map((skill: string) => <span className="chip chip-warn" key={skill}>{skill}</span>)}{!result.removed_skills.length && <small className="muted">No removed detected skills</small>}</div></div></div><small className="muted">Changes reflect text detection, not necessarily actual skill gain or loss.</small></div>}</section>;
}

function AnalysisPage({ notify }: { notify: (message: string) => void }) {
  const { resumeId } = useParams();
  const [resume, setResume] = useState<any>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [roles, setRoles] = useState<{ title: string }[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [aiConsent, setAiConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = Number(resumeId);
  useEffect(() => {
    Promise.all([
      api.get(`/api/resumes/${id}`), api.get<Analysis>(`/api/resumes/${id}/analysis`).catch(() => null),
      api.get<{ title: string }[]>("/api/careers/roles"), api.get<{ ai_enabled: boolean }>("/api/config"),
    ]).then(([resumeResponse, analysisResponse, roleResponse, configResponse]) => {
      setResume(resumeResponse.data); setAnalysis(analysisResponse?.data ?? null); setRoles(roleResponse.data);
      setAiAvailable(configResponse.data.ai_enabled);
      if (analysisResponse?.data?.career_recommendations?.[0]) setTargetRole(analysisResponse.data.career_recommendations[0].title);
    }).catch(reason => setError(errorMessage(reason))).finally(() => setLoading(false));
  }, [id]);
  const analyze = async () => {
    setBusy(true); setError("");
    try {
      const { data } = await api.post<Analysis>(`/api/resumes/${id}/analyze`, null, { params: { target_role: targetRole || undefined, ai_consent: aiConsent } });
      setAnalysis(data); notify("Resume analysis is ready.");
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  const exportReport = async (format: "pdf" | "json") => {
    try {
      const response = await api.get(`/api/resumes/${id}/report/${format}`, { responseType: format === "pdf" ? "blob" : "json" });
      const blob = format === "pdf" ? response.data as Blob : new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `careerlens-analysis-${id}.${format}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(errorMessage(reason)); }
  };
  if (loading) return <div className="loading-inline"><div className="spinner" />Loading your resume…</div>;
  if (error && !resume) return <ErrorState message={error} />;
  return <>
    <PageTitle eyebrow="RESUME REVIEW" title={resume.original_filename} detail="Evidence-based observations to help you choose your next improvement." action={<Link className="button button-quiet" to="/resumes">← All resumes</Link>} />
    <details className="panel extracted-preview"><summary>Review extracted resume text before analysis</summary><pre>{resume.extracted_text}</pre></details>
    <div className="panel analysis-control"><div><b>{analysis ? "Refresh your analysis" : "Ready to analyze"}</b><span>Choose an optional target role. You can compare the same resume against a different role at any time.</span></div><select aria-label="Target career role" value={targetRole} onChange={event => setTargetRole(event.target.value)}><option value="">Recommend roles for me</option>{roles.map(role => <option key={role.title}>{role.title}</option>)}</select>{aiAvailable ? <label className="consent-check"><input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} /><span>Allow external AI processing for a resume summary only. The configured provider will receive resume text. Optional; rule-based review works without it.</span></label> : <span className="consent-check">External AI is not configured. Analysis will use rule-based methods only.</span>}<button className="button button-primary" onClick={analyze} disabled={busy}>{busy ? <><span className="spinner small-spinner" />Analyzing…</> : <>{analysis ? "Run analysis again" : "Analyze resume"} <Sparkles size={16} /></>}</button>{error && <div className="error-box" role="alert">{error}</div>}</div>
    {!analysis ? <EmptyState icon={<Sparkles />} title="Your results will appear here" text="Analysis uses detected resume text, documented role requirements, and transparent heuristics. It does not infer proficiency from a keyword." /> : <AnalysisResults analysis={analysis} exportReport={exportReport} notify={notify} />}
  </>;
}

function AnalysisResults({ analysis, exportReport, notify }: { analysis: Analysis; exportReport: (format: "pdf" | "json") => void; notify: (message: string) => void }) {
  const chartData = Object.entries(analysis.skill_categories).map(([category, skills]) => ({ category, skills: skills.length }));
  return <>
    <div className="results-heading"><div><span className="eyebrow">YOUR RESULTS</span><h2>A starting point, not a verdict.</h2><p>Generated {new Date(analysis.created_at).toLocaleString()} · {analysis.analysis_mode}</p></div><div className="export-actions"><button className="button button-quiet small" onClick={() => exportReport("json")}>Export JSON</button><button className="button button-quiet small" onClick={() => exportReport("pdf")}>Download PDF</button></div></div>
    <div className="results-grid">
      <article className="panel score-panel"><div className="panel-heading"><div><span className="eyebrow">RESUME QUALITY ESTIMATE</span><h2>Content checklist</h2></div><div className="large-score">{analysis.quality_score}<small>/100</small></div></div><div className="score-components">{Object.entries(analysis.score_breakdown).map(([name, value]) => <div key={name}><span>{name}</span><div className="bar-track"><i style={{ width: `${value}%` }} /></div><b>{value}</b></div>)}</div><p className="fine-print">Each component is equally weighted. Section completeness checks for five common sections; relevant skills count up to 12 points each; achievement specificity counts up to 25 per numeric bullet; readability is a coarse text-length heuristic. This is not an ATS score or employment guarantee.</p></article>
      <article className="panel chart-panel"><div className="eyebrow">SKILL DISTRIBUTION</div><h2>Skills found in the text</h2>{chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={225}><BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} hide /><YAxis dataKey="category" type="category" width={125} tick={{ fontSize: 11, fill: "#64748b" }} /><Tooltip /><Bar dataKey="skills" fill="#4355c7" radius={[0, 5, 5, 0]} barSize={13} /></BarChart></ResponsiveContainer></div> : <p className="muted">No categorized skills were detected in the resume text.</p>}<p className="fine-print">Mentioned keywords are not proof of mastery. Evidence is shown below for review.</p></article>
    </div>
    <article className="panel summary-panel"><div className="eyebrow">RESUME SUMMARY</div><h2>What your resume communicates</h2><p>{analysis.summary}</p></article>
    <section className="result-section"><div className="section-row"><div><span className="eyebrow">CAREER MATCHES</span><h2>Roles to explore</h2></div></div><div className="role-cards">{analysis.career_recommendations.map(role => <article className="panel career-card" key={role.title}><div className="career-title"><span className="role-icon"><BriefcaseBusiness size={17} /></span><div><h3>{role.title}</h3><span className="match-score">{role.match_score}% heuristic match</span></div></div><p>{role.why}</p><div className="skill-label">MATCHING SKILLS</div><div className="chip-list">{role.matching_skills.length ? role.matching_skills.map(skill => <span className="chip" key={skill}>{skill}</span>) : <span className="muted">No matching keywords found</span>}</div><div className="skill-label">UNDERREPRESENTED</div><div className="chip-list">{role.missing_skills.length ? role.missing_skills.map(skill => <span className="chip chip-warn" key={skill}>{skill}</span>) : <span className="muted">No required skills missing from text</span>}</div><details><summary>How this match was calculated</summary><p>{role.score_method}</p></details></article>)}</div></section>
    <div className="results-grid">
      <article className="panel"><div className="eyebrow">SKILLS & EVIDENCE</div><h2>What was detected</h2>{Object.entries(analysis.skill_categories).length ? Object.entries(analysis.skill_categories).map(([category, skills]) => <div className="evidence-group" key={category}><b>{category}</b>{skills.map(skill => <div className="evidence-row" key={skill.name}><span>{skill.name}</span><small>{skill.status} · “{skill.evidence}”</small></div>)}</div>) : <p className="muted">No skills detected. Check extracted resume text and document formatting.</p>}</article>
      <article className="panel"><div className="eyebrow">SKILL GAPS</div><h2>Skills to investigate</h2><p className="fine-print">“Not found” means the resume text did not mention a keyword; it does not mean you lack the skill.</p>{analysis.skill_gaps.length ? analysis.skill_gaps.map(gap => <div className="gap-row" key={gap.skill}><div><b>{gap.skill}</b><p>{gap.reason}</p><small>{gap.estimated_effort}</small>{gap.resource && <a className="resource-link" href={gap.resource.url} target="_blank" rel="noreferrer">{gap.resource.title} <ArrowRight size={13} /></a>}</div><span className="priority">{gap.importance}</span></div>) : <p className="muted">No missing required skills for the selected role were found.</p>}</article>
    </div>
    <div className="results-grid">
      <article className="panel"><div className="eyebrow">IMPROVEMENT IDEAS</div><h2>Actionable suggestions</h2>{analysis.improvement_suggestions.map((suggestion, index) => <div className="suggestion-row" key={index}><span className={`priority-dot ${suggestion.priority}`} /><div><b>{suggestion.issue}</b><p>{suggestion.why}</p><p className="suggested-copy">{suggestion.suggestion}</p><button className="copy-button" onClick={() => { void navigator.clipboard.writeText(suggestion.suggestion); notify("Suggestion copied."); }}>Copy suggestion</button></div></div>)}</article>
      <article className="panel"><div className="eyebrow">ATS-FRIENDLY CHECKS</div><h2>Basic document checks</h2><p className="fine-print">Heuristic checks only—not a guarantee for any applicant tracking system.</p>{analysis.ats_checks.map(item => <div className="check-row" key={item.check}><span className={item.status === "Pass" ? "check-pass" : "check-review"}>{item.status === "Pass" ? <Check size={15} /> : <CircleHelp size={15} />}</span><div><b>{item.check}</b><small>{item.detail}</small></div></div>)}</article>
    </div>
    <p className="scoring-note"><ShieldCheck size={16} /><span>Results are estimates based on text extraction and transparent keyword rules. Review every suggestion; do not add skills, outcomes, or qualifications you cannot substantiate.</span></p>
  </>;
}

function LearningPage({ notify }: { notify: (message: string) => void }) {
  const [tasks, setTasks] = useState<LearningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => api.get<LearningTask[]>("/api/learning/roadmap").then(({ data }) => setTasks(data)).catch(reason => setError(errorMessage(reason))).finally(() => setLoading(false)), []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (task: LearningTask) => {
    try { await api.patch(`/api/learning/tasks/${task.id}`, { completed: !task.completed }); setTasks(current => current.map(item => item.id === task.id ? { ...item, completed: !item.completed } : item)); }
    catch (reason) { notify(errorMessage(reason)); }
  };
  const completed = tasks.filter(task => task.completed).length;
  return <>
    <PageTitle eyebrow="YOUR LEARNING PLAN" title="Small steps add up." detail="Learning tasks are created from gaps in your resume analysis. Mark tasks complete as you make progress." />
    {loading ? <div className="loading-inline"><div className="spinner" />Loading your plan…</div> : error ? <ErrorState message={error} /> : tasks.length ? <>
      <div className="panel progress-panel"><div><span className="eyebrow">OVERALL PROGRESS</span><h2>{completed} of {tasks.length} tasks complete</h2></div><div className="progress-meter"><span style={{ width: `${tasks.length ? completed / tasks.length * 100 : 0}%` }} /></div></div>
      <div className="roadmap-list">{tasks.map(task => <article className={`panel task-card ${task.completed ? "task-done" : ""}`} key={task.id}><button className={`task-checkbox ${task.completed ? "checked" : ""}`} onClick={() => toggle(task)} aria-label={task.completed ? "Mark incomplete" : "Mark complete"}>{task.completed && <Check size={15} />}</button><div className="task-content"><div className="task-meta"><span>{task.stage}</span><span>{task.target_role}</span><span>{task.estimated_effort}</span></div><h3>{task.title}</h3><p>{task.description}</p>{task.resource_url && <a className="resource-link" href={task.resource_url} target="_blank" rel="noreferrer">Open learning resource <ArrowRight size={14} /></a>}</div><span className="task-status">{task.completed ? "Complete" : "In progress"}</span></article>)}</div>
    </> : <EmptyState icon={<GraduationCap />} title="Your roadmap will grow from your analysis" text="Analyze a resume and choose a target role. CareerLens will suggest tasks connected to documented skill gaps." action={<Link className="button button-primary" to="/resumes">View my resumes <ArrowRight size={16} /></Link>} />}
    <p className="scoring-note"><BookOpen size={16} /><span>Estimated effort is approximate. Learning links are provided when a curated official or reputable resource is available.</span></p>
  </>;
}

function JobMatchPage({ notify }: { notify: (message: string) => void }) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get<Resume[]>("/api/resumes").then(({ data }) => { setResumes(data); if (data.length) setResumeId(String(data[0].id)); }).catch(reason => setError(errorMessage(reason))); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try { const { data } = await api.post("/api/job-descriptions/analyze", { resume_id: Number(resumeId), job_description: description }); setResult(data); notify("Job description match is ready."); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  return <>
    <PageTitle eyebrow="JOB DESCRIPTION MATCH" title="Compare your resume to a role." detail="Paste a real job description to see which recognized skills appear in your resume text—and what was not found." />
    {resumes.length ? <div className="panel job-form-panel"><form onSubmit={submit}><label>Select a resume<select value={resumeId} onChange={event => setResumeId(event.target.value)}>{resumes.map(resume => <option key={resume.id} value={resume.id}>{resume.original_filename}</option>)}</select></label><label>Job description<textarea value={description} onChange={event => setDescription(event.target.value)} minLength={100} maxLength={30000} placeholder="Paste the job description here (at least 100 characters)…" rows={10} required /></label><small className="char-count">{description.length.toLocaleString()} / 30,000 characters · Job descriptions are used only for this account’s analysis.</small>{error && <div className="error-box" role="alert">{error}</div>}<button className="button button-primary" disabled={busy || description.trim().length < 100}>{busy ? "Comparing…" : "Compare description"} <ArrowRight size={16} /></button></form></div> : <EmptyState icon={<FileText />} title="Upload a resume first" text="Job description matching compares text against one of your private resumes." action={<Link className="button button-primary" to="/resumes">Upload resume</Link>} />}
    {result && <article className="panel job-result"><div className="panel-heading"><div><span className="eyebrow">KEYWORD OVERLAP</span><h2>Text match estimate</h2></div><div className="large-score">{result.match_score}<small>/100</small></div></div><p>{result.score_method}</p><div className="match-columns"><div><b>Found in resume</b><div className="chip-list">{result.matched_skills.map((skill: string) => <span className="chip" key={skill}>{skill}</span>)}</div></div><div><b>Not found in resume</b><div className="chip-list">{result.missing_skills.map((skill: string) => <span className="chip chip-warn" key={skill}>{skill}</span>)}</div></div></div>{result.suggestions.map((suggestion: string, index: number) => <p className="suggested-copy" key={index}>{suggestion}</p>)}</article>}
    <p className="scoring-note"><ShieldCheck size={16} /><span>Keyword overlap is a limited heuristic, not a measure of qualification or a hiring prediction. Do not add keywords that misrepresent your experience.</span></p>
  </>;
}

function SettingsPage({ onLogout, notify }: { onLogout: () => void; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const removeAccount = async () => {
    const confirmed = window.confirm("Permanently delete your account, uploaded resumes, analyses, learning tasks, and job matches? This cannot be undone.");
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.delete("/api/auth/account");
      sessionStorage.removeItem("careerlens-token");
      onLogout();
    } catch (error) {
      notify(errorMessage(error));
      setBusy(false);
    }
  };
  return <>
    <PageTitle eyebrow="PRIVACY & SETTINGS" title="Your data stays yours." detail="Manage what CareerLens stores and how it uses your resume." />
    <article className="panel privacy-settings"><span className="settings-icon"><ShieldCheck size={20} /></span><div><h2>How your data is used</h2><p>Uploaded files and extracted text are stored in the application database and private upload folder. Your resume is not sent to an external AI provider unless you explicitly opt in during analysis and the provider is configured.</p><p>AI summaries may be processed by the provider configured by the service operator. Review that provider’s privacy terms before opting in.</p></div></article>
    <article className="panel delete-account"><div><div className="eyebrow">ACCOUNT CONTROL</div><h2>Delete your account and data</h2><p>This permanently removes your account, uploaded resumes, analyses, learning progress, and job-description comparisons.</p><button className="button button-danger" onClick={removeAccount} disabled={busy}>{busy ? "Deleting…" : "Permanently delete account"}</button></div></article>
  </>;
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{text}</p>{action}</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="error-state"><span className="error-icon"><X size={18} /></span><div><b>We couldn’t load this section</b><p>{message}</p></div></div>;
}

export default App;
