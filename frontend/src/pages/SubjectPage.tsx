import { ArrowLeft, CalendarCheck, Download, Mail, Pencil, Phone, Plus, Search, Trash2, Upload, UserRoundPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { api, ApiError, downloadFile, uploadCsv } from "../lib/api";
import type { ClassItem, Student, Subject } from "../types";

const blank = { name: "", rollNumber: "", email: "", phone: "", guardianName: "", guardianPhone: "" };
export default function SubjectPage() {
  const { classId = "", subjectId = "" } = useParams();
  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Student | "new" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const uploadRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [a, b, c] = await Promise.all([
      api<{ class: ClassItem }>(`/classes/${classId}`),
      api<{ subjects: Subject[] }>(`/classes/${classId}/subjects`),
      api<{ students: Student[] }>(`/classes/${classId}/students`),
    ]);
    setClassItem(a.class);
    setSubject(b.subjects.find((s) => s._id === subjectId) || null);
    setStudents(c.students.filter((s) => s.subjectId === subjectId));
    setLoading(false);
  };
  useEffect(() => { void load(); }, [classId, subjectId]);

  const visible = useMemo(() => students.filter((x) => `${x.name} ${x.rollNumber} ${x.email || ""}`.toLowerCase().includes(query.toLowerCase())), [students, query]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    body.subjectId = subjectId;
    try {
      await api(modal === "new" ? `/classes/${classId}/students` : `/classes/${classId}/students/${modal!._id}`, {
        method: modal === "new" ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save student.");
    }
  }

  async function remove(student: Student) {
    if (!confirm(`Remove ${student.name} and their attendance history?`)) return;
    await api(`/classes/${classId}/students/${student._id}`, { method: "DELETE" });
    setStudents((all) => all.filter((x) => x._id !== student._id));
  }

  async function handleDownload() {
    try { await downloadFile(`/classes/${classId}/students/export`, `students-${classId}.csv`); } catch (e) { alert(e instanceof ApiError ? e.message : "Download failed."); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try { const result = await uploadCsv(`/classes/${classId}/students/import`, text); alert(`${result.imported} student(s) imported successfully.`); await load(); } catch (e) { alert(e instanceof ApiError ? e.message : "Upload failed."); }
    e.target.value = "";
  }

  if (loading) return <div className="page"><div className="skeleton tall" /></div>;

  return (
    <div className="page">
      <Link to={`/classes/${classId}`} className="back-link"><ArrowLeft size={17} /> Back to {classItem?.name || "class"}</Link>
      <div className="class-hero">
        <div>
          <span className="eyebrow">{classItem?.name || "Class"}</span>
          <h1>{subject?.name || "Subject"}</h1>
          <p>{[subject?.section && `Section ${subject.section}`, subject?.room && `Room ${subject.room}`, subject?.periodNo && `Period ${subject.periodNo}`, subject?.academicYear, classItem?.shift === "EVENING" ? "Evening" : "Morning"].filter(Boolean).join(" • ") || "Subject details"}</p>
        </div>
        <div className="hero-actions">
          <Link className="btn secondary" to={`/attendance?classId=${classId}`}><CalendarCheck size={18} /> Attendance</Link>
          <button className="btn secondary" onClick={handleDownload}><Download size={18} /> Download Data</button>
          <button className="btn secondary" onClick={() => uploadRef.current?.click()}><Upload size={18} /> Upload Data</button>
          <input ref={uploadRef} type="file" accept=".csv" className="sr-only" onChange={handleUpload} />
          <button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Add student</button>
        </div>
      </div>

      <section className="content-card">
        <div className="section-head">
          <div>
            <h2>Students</h2>
            <p>{students.length} enrolled student{students.length === 1 ? "" : "s"}</p>
          </div>
          <div className="search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or roll number" /></div>
        </div>

        {visible.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Student</th><th>Roll number</th><th>Contact</th><th>Guardian</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {visible.map((student) => (
                  <tr key={student._id}>
                    <td><div className="student-name"><div className="mini-avatar">{student.name.slice(0,1).toUpperCase()}</div><strong>{student.name}</strong></div></td>
                    <td><span className="roll-chip">{student.rollNumber}</span></td>
                    <td><div className="contact-lines">{student.email && <span><Mail />{student.email}</span>}{student.phone && <span><Phone />{student.phone}</span>}{!student.email && !student.phone && "—"}</div></td>
                    <td>{student.guardianName || "—"}</td>
                    <td><div className="row-actions"><button className="icon-btn" onClick={() => setModal(student)} aria-label={`Edit ${student.name}`}><Pencil /></button><button className="icon-btn danger-text" onClick={() => void remove(student)} aria-label={`Remove ${student.name}`}><Trash2 /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={query ? <Search /> : <UserRoundPlus />}
            title={query ? "No students match" : "Add your first student"}
            text={query ? "Try another name or roll number." : "Students in this subject will appear here."}
            action={!query && <button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Add student</button>}
          />
        )}
      </section>

      {modal && (
        <Modal title={modal === "new" ? "Add a student" : "Edit student"} onClose={() => setModal(null)} wide>
          <StudentForm initial={modal === "new" ? blank : modal} onSubmit={save} onCancel={() => setModal(null)} error={error} />
        </Modal>
      )}
    </div>
  );
}

function StudentForm({ initial, onSubmit, onCancel, error }: { initial: typeof blank | Student; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void; error: string }) {
  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <div className="form-row">
        <label>Student name<input name="name" defaultValue={initial.name} required placeholder="Full name" /></label>
        <label>Roll number<input name="rollNumber" defaultValue={initial.rollNumber} required placeholder="e.g. 08-014" /></label>
      </div>
      <div className="form-row">
        <label>Email <span>(optional)</span><input type="email" name="email" defaultValue={initial.email || ""} placeholder="student@example.com" /></label>
        <label>Phone <span>(optional)</span><input name="phone" defaultValue={initial.phone || ""} placeholder="Phone number" /></label>
      </div>
      <div className="form-row">
        <label>Guardian name <span>(optional)</span><input name="guardianName" defaultValue={initial.guardianName || ""} /></label>
        <label>Guardian phone <span>(optional)</span><input name="guardianPhone" defaultValue={initial.guardianPhone || ""} /></label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button className="btn primary">Save student</button>
      </div>
    </form>
  );
}
