import { ArrowLeft, BookOpen, CalendarCheck, MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { api, ApiError } from "../lib/api";
import type { ClassItem, Subject } from "../types";

const blankSubject = { name: "" };
export default function ClassPage() {
  const { classId = "" } = useParams();
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Subject | "new" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [a, b] = await Promise.all([
      api<{ class: ClassItem }>(`/classes/${classId}`),
      api<{ subjects: Subject[] }>(`/classes/${classId}/subjects`),
    ]);
    setClassItem(a.class);
    setSubjects(b.subjects);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [classId]);

  const visible = useMemo(() => subjects.filter((x) => x.name.toLowerCase().includes(query.toLowerCase())), [subjects, query]);

  async function saveSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(modal === "new" ? `/classes/${classId}/subjects` : `/classes/${classId}/subjects/${(modal as Subject)._id}`, {
        method: modal === "new" ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save subject.");
    }
  }

  async function removeSubject(item: Subject) {
    if (!confirm(`Delete "${item.name}" and remove its link from students?`)) return;
    await api(`/classes/${classId}/subjects/${item._id}`, { method: "DELETE" });
    setSubjects((all) => all.filter((x) => x._id !== item._id));
  }

  if (loading) return <div className="page"><div className="skeleton tall" /></div>;

  return (
    <div className="page">
      <Link to="/dashboard" className="back-link"><ArrowLeft size={17} /> Back to classes</Link>
      <div className="class-hero">
        <div>
          <span className="eyebrow">{classItem?.subject || "Class"}</span>
          <h1>{classItem?.name}</h1>
          <p>{[classItem?.section && `Section ${classItem.section}`, classItem?.room && `Room ${classItem.room}`, classItem?.academicYear, classItem?.shift === "EVENING" ? "Evening" : "Morning"].filter(Boolean).join(" • ") || "Class details"}</p>
        </div>
        <div className="hero-actions">
          <Link className="btn secondary" to={`/attendance?classId=${classId}`}><CalendarCheck size={18} /> Attendance</Link>
          <button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Add subject</button>
        </div>
      </div>

      <section className="content-card">
        <div className="section-head">
          <div>
            <h2>Subjects</h2>
            <p>{subjects.length ? `${subjects.length} subject${subjects.length === 1 ? "" : "s"}` : "Add subjects to this class"}</p>
          </div>
          <div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subjects" /></div>
        </div>

        {visible.length ? (
          <div className="class-grid">
            {visible.map((item, i) => (
              <article className="class-card" key={item._id}>
                <div className={`class-accent accent-${i % 4}`} />
                <div className="class-card-top">
                  <div className="class-letter">{item.name.charAt(0).toUpperCase()}</div>
                  <div className="card-menu">
                    <button className="icon-btn" aria-label="Subject options"><MoreHorizontal /></button>
                    <div className="card-menu-pop">
                      <button onClick={() => setModal(item)}>Edit subject</button>
                      <button className="danger-text" onClick={() => void removeSubject(item)}>Delete subject</button>
                    </div>
                  </div>
                </div>
                <h3>{item.name}</h3>
                <p>{item.section ? `Section ${item.section}` : ""}{item.room ? ` • Room ${item.room}` : ""}{item.periodNo ? ` • Period ${item.periodNo}` : ""}{item.academicYear ? ` • ${item.academicYear}` : ""}</p>
                <div className="class-meta">
                  <span><Users size={16} /> {item.studentCount} student{item.studentCount === 1 ? "" : "s"}</span>
                </div>
                <Link className="card-link" to={`/classes/${classId}/subjects/${item._id}`}>View students <span style={{ marginLeft: 4 }}>→</span></Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title={query ? "No subjects match" : "Your first subject starts here"}
            text={query ? "Try a different search term." : "Add a subject to start managing students."}
            action={!query && <button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Add subject</button>}
          />
        )}
      </section>

      {modal && (
        <Modal title={modal === "new" ? "Add a subject" : "Edit subject"} onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={saveSubject}>
            <label>Subject name<input name="name" defaultValue={modal === "new" ? "" : (modal as Subject).name} required placeholder="e.g. Mathematics" /></label>
            <div className="form-row">
              <label>Section<input name="section" defaultValue={modal === "new" ? "" : (modal as Subject).section || ""} placeholder="e.g. A" /></label>
              <label>Room<input name="room" defaultValue={modal === "new" ? "" : (modal as Subject).room || ""} placeholder="e.g. 204" /></label>
            </div>
            <div className="form-row">
              <label>Period No<input name="periodNo" defaultValue={modal === "new" ? "" : (modal as Subject).periodNo || ""} placeholder="e.g. 1" /></label>
              <label>Academic year<input name="academicYear" defaultValue={modal === "new" ? "" : (modal as Subject).academicYear || ""} placeholder="e.g. 2026-27" /></label>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary">Save subject</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
