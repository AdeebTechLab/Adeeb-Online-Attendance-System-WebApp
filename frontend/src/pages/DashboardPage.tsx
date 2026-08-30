import { ArrowRight, BookOpen, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { ClassItem } from "../types";

const blank = { name: "", subject: "", section: "", room: "", academicYear: "", shift: "MORNING" as const };
export default function DashboardPage() {
  const { user } = useAuth(); const [classes, setClasses] = useState<ClassItem[]>([]); const [loading, setLoading] = useState(true); const [query, setQuery] = useState(""); const [modal, setModal] = useState<ClassItem | "new" | null>(null); const [error, setError] = useState("");
  const load = () => api<{ classes: ClassItem[] }>("/classes").then((x) => setClasses(x.classes)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => classes.filter((x) => `${x.name} ${x.subject} ${x.section}`.toLowerCase().includes(query.toLowerCase())), [classes, query]);
  const totalStudents = classes.reduce((sum, x) => sum + x.studentCount, 0);
  async function save(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(""); const body = Object.fromEntries(new FormData(e.currentTarget)); try { await api(modal === "new" ? "/classes" : `/classes/${modal!._id}`, { method: modal === "new" ? "POST" : "PATCH", body: JSON.stringify(body) }); setModal(null); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : "Could not save class."); } }
  async function remove(item: ClassItem) { if (!confirm(`Delete “${item.name}” and all of its students and attendance records? This cannot be undone.`)) return; await api(`/classes/${item._id}`, { method: "DELETE" }); setClasses((all) => all.filter((x) => x._id !== item._id)); }
  return <div className="page">
    <div className="page-heading"><div><span className="eyebrow">Teacher workspace</span><h1>Good to see you, {user?.name.split(" ")[0]}</h1><p>Keep your classes organised and attendance up to date.</p></div><button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> New class</button></div>
    <div className="stats-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}><article className="stat"><div className="stat-icon green"><BookOpen /></div><div><strong>{classes.length}</strong><span>Total classes</span></div></article><article className="stat"><div className="stat-icon amber"><Users /></div><div><strong>{totalStudents}</strong><span>Enrolled students</span></div></article></div>
    <section className="content-card"><div className="section-head"><div><h2>Your classes</h2><p>{classes.length ? `${classes.length} active class${classes.length === 1 ? "" : "es"}` : "Create your first class to get started"}</p></div><div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search classes" /></div></div>
      {loading ? <div className="skeleton-grid">{[1,2,3].map((x) => <div className="skeleton" key={x} />)}</div> : visible.length ? <div className="class-grid">{visible.map((item, i) => <article className="class-card" key={item._id}>
        <div className={`class-accent accent-${i % 4}`} /><div className="class-card-top"><div className="class-letter">{item.name.charAt(0).toUpperCase()}</div><div className="card-menu"><button className="icon-btn" aria-label="Class options"><MoreHorizontal /></button><div className="card-menu-pop"><button onClick={() => setModal(item)}>Edit class</button><button className="danger-text" onClick={() => void remove(item)}>Delete class</button></div></div></div>
        <h3>{item.name}</h3><p>{item.subject || "No subject"}{item.section ? ` • Section ${item.section}` : ""}</p><div className="class-meta"><span><Users size={16} /> {item.studentCount} student{item.studentCount === 1 ? "" : "s"}</span>{item.room && <span>Room {item.room}</span>}<span>{item.shift === "EVENING" ? "Evening" : "Morning"}</span></div><Link className="card-link" to={`/classes/${item._id}`}>Manage class <ArrowRight size={17} /></Link>
      </article>)}</div> : <EmptyState icon={<BookOpen />} title={query ? "No classes match" : "Your first class starts here"} text={query ? "Try a different search term." : "Create a class, add your students, and attendance is ready to go."} action={!query && <button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Create class</button>} />}
    </section>
    {modal && <Modal title={modal === "new" ? "Create a class" : "Edit class"} onClose={() => setModal(null)}><ClassForm initial={modal === "new" ? blank : modal} onSubmit={save} error={error} onCancel={() => setModal(null)} /></Modal>}
  </div>;
}

function ClassForm({ initial, onSubmit, error, onCancel }: { initial: typeof blank | ClassItem; onSubmit: (e: FormEvent<HTMLFormElement>) => void; error: string; onCancel: () => void }) {
  return <form className="modal-form" onSubmit={onSubmit}><label>Class name<input name="name" defaultValue={initial.name} required placeholder="e.g. Information Technology (IT)" /></label><label>Subject<input name="subject" defaultValue={initial.subject || ""} placeholder="e.g. Mathematics" /></label><div className="form-row"><label>Section<input name="section" defaultValue={initial.section || ""} placeholder="e.g. A" /></label><label>Room<input name="room" defaultValue={initial.room || ""} placeholder="e.g. 204" /></label></div><div className="form-row"><label>Academic year<input name="academicYear" defaultValue={initial.academicYear || ""} placeholder="e.g. 2026–27" /></label><label>Class Shift<select name="shift" defaultValue={initial.shift || "MORNING"} required><option value="MORNING">Morning</option><option value="EVENING">Evening</option></select></label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button><button className="btn primary">Save class</button></div></form>;
}
