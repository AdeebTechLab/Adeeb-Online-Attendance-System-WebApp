import { Ban, BookOpen, Building2, CircleCheckBig, Eye, EyeOff, GraduationCap, Pencil, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { api, ApiError } from "../lib/api";
import type { ClassItem, User } from "../types";

type Overview = { teacherCount: number; classCount: number; studentCount: number };
type SelectedTeacher = User & { classes?: ClassItem[] };

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview>({ teacherCount: 0, classCount: 0, studentCount: 0 });
  const [teachers, setTeachers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedTeacher | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");

  const load = async () => {
    const [summary, accounts] = await Promise.all([
      api<Overview>("/admin/overview"),
      api<{ teachers: User[] }>("/admin/teachers"),
    ]);
    setOverview(summary);
    setTeachers(accounts.teachers.map((teacher) => ({ ...teacher, id: teacher.id || teacher._id! })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(
    () => teachers.filter((teacher) => `${teacher.name} ${teacher.email} ${teacher.designation} ${teacher.city} ${teacher.institutionName}`.toLowerCase().includes(query.toLowerCase())),
    [teachers, query],
  );

  async function open(teacher: User) {
    const data = await api<{ teacher: User; classes: ClassItem[] }>(`/admin/teachers/${teacher.id}`);
    setShowPassword(false);
    setSelected({ ...data.teacher, id: data.teacher.id || data.teacher._id!, classes: data.classes });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError("");
    try {
      await api(`/admin/teachers/${selected.id}`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      setSelected(null);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not update teacher.");
    }
  }

  async function toggleStatus(teacher: User) {
    const isActive = teacher.isActive !== false;
    const action = isActive ? "stop" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${teacher.name}'s account?`)) return;
    setPageError("");
    setActionId(teacher.id);
    try {
      await api(`/admin/teachers/${teacher.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
      await load();
    } catch (caught) {
      setPageError(caught instanceof ApiError ? caught.message : `Could not ${action} teacher.`);
    } finally {
      setActionId("");
    }
  }

  async function removeTeacher(teacher: User) {
    if (!window.confirm(`Permanently delete ${teacher.name}? Their classes, students, and attendance records will also be deleted. This cannot be undone.`)) return;
    setPageError("");
    setActionId(teacher.id);
    try {
      await api(`/admin/teachers/${teacher.id}`, { method: "DELETE" });
      if (selected?.id === teacher.id) setSelected(null);
      await load();
    } catch (caught) {
      setPageError(caught instanceof ApiError ? caught.message : "Could not delete teacher.");
    } finally {
      setActionId("");
    }
  }

  return <div className="page">
    <div className="page-heading">
      <div><span className="eyebrow">Administration</span><h1>System overview</h1><p>Teacher accounts, classes, and enrolment at a glance.</p></div>
      <div className="admin-badge"><ShieldCheck /> Administrator</div>
    </div>
    <div className="stats-grid admin-stats">
      <article className="stat"><div className="stat-icon green"><GraduationCap /></div><div><strong>{overview.teacherCount}</strong><span>Registered teachers</span></div></article>
      <article className="stat"><div className="stat-icon blue"><BookOpen /></div><div><strong>{overview.classCount}</strong><span>Total classes</span></div></article>
      <article className="stat"><div className="stat-icon amber"><Users /></div><div><strong>{overview.studentCount}</strong><span>Total students</span></div></article>
    </div>
    {pageError && <div className="alert error">{pageError}</div>}
    <section className="content-card">
      <div className="section-head"><div><h2>Teacher accounts</h2><p>Review and maintain registered teacher information</p></div><div className="search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teachers" /></div></div>
      {loading ? <div className="skeleton tall" /> : visible.length ? <div className="table-wrap admin-teacher-wrap">
        <table className="admin-teacher-table">
          <thead><tr><th>Teacher</th><th>Designation</th><th>Institution / City</th><th>Classes</th><th>Students</th><th>Joined</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{visible.map((teacher) => {
            const isActive = teacher.isActive !== false;
            const busy = actionId === teacher.id;
            return <tr key={teacher.id} className={isActive ? "" : "teacher-stopped"}>
              <td data-label="Teacher"><div className="student-name"><div className="mini-avatar admin-avatar">{teacher.name.slice(0, 1).toUpperCase()}</div><div><strong>{teacher.name}</strong><small>{teacher.email}</small>{!isActive && <span className="status-pill stopped">Stopped</span>}</div></div></td>
              <td data-label="Designation">{teacher.designation || "—"}</td>
              <td data-label="Institution / City"><div className="contact-lines"><strong>{teacher.institutionName || "—"}</strong>{teacher.city && <span>{teacher.city}</span>}</div></td>
              <td data-label="Classes"><span className="metric-chip"><BookOpen />{teacher.classCount || 0}</span></td>
              <td data-label="Students"><span className="metric-chip"><Users />{teacher.studentCount || 0}</span></td>
              <td data-label="Joined">{new Date(teacher.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
              <td data-label="Actions"><div className="row-actions admin-row-actions">
                <button className="icon-btn" onClick={() => void open(teacher)} disabled={busy} aria-label={`Review ${teacher.name}`} title="Review teacher"><Pencil /></button>
                <button className={`icon-btn ${isActive ? "warning-text" : "success-text"}`} onClick={() => void toggleStatus(teacher)} disabled={busy} aria-label={`${isActive ? "Stop" : "Activate"} ${teacher.name}`} title={isActive ? "Stop account" : "Activate account"}>{isActive ? <Ban /> : <CircleCheckBig />}</button>
                <button className="icon-btn danger-text" onClick={() => void removeTeacher(teacher)} disabled={busy} aria-label={`Delete ${teacher.name}`} title="Delete teacher"><Trash2 /></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <EmptyState icon={<GraduationCap />} title="No teacher accounts" text="New teacher registrations will appear here." />}
    </section>

    {selected && <Modal title="Teacher information" onClose={() => setSelected(null)} wide>
      <form className="modal-form" onSubmit={save}>
        <div className="teacher-summary"><div className="avatar large">{selected.name.slice(0, 1)}</div><div><strong>{selected.name}</strong><span>{selected.institutionName || "Institution not provided"}{selected.city ? ` • ${selected.city}` : ""} • Joined {new Date(selected.createdAt).toLocaleDateString()}</span></div></div>
        <div className="form-row"><label>Full name<input name="name" defaultValue={selected.name} required /></label><label>Email address<input name="email" type="email" defaultValue={selected.email} required /></label></div>
        <div className="form-row"><label>Designation<input name="designation" defaultValue={selected.designation || ""} placeholder="e.g. Teacher or CR" /></label><label>Phone<input name="phone" type="tel" defaultValue={selected.phone || ""} required minLength={7} maxLength={30} pattern="(?=(?:[^0-9]*[0-9]){7,15}[^0-9]*$)[+0-9() .-]{7,30}" title="Enter a valid phone number containing 7 to 15 digits" placeholder="e.g. +92 300 1234567" autoComplete="tel" /></label></div>
        <div className="form-row"><label>City<input name="city" defaultValue={selected.city || ""} required minLength={2} maxLength={100} placeholder="e.g. Bahawalpur" autoComplete="address-level2" /></label><label>Institution Name<input name="institutionName" defaultValue={selected.institutionName || ""} required minLength={2} maxLength={200} placeholder="e.g. Adeeb Public School" autoComplete="organization" /></label></div>
        <label>New password <span>(leave blank to keep current password)</span><div className="password-field"><input name="newPassword" type={showPassword ? "text" : "password"} placeholder="Set a new password" autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide new password" : "Show new password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        <div className="teacher-classes"><h3><Building2 size={17} /> Classes and enrolment</h3>{selected.classes?.length ? selected.classes.map((item) => <div key={item._id}><span><strong>{item.name}</strong><small>{item.subject || "No subject"}{item.section ? ` • Section ${item.section}` : ""}</small></span><b>{item.studentCount} students</b></div>) : <p>No classes created yet.</p>}</div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setSelected(null)}>Cancel</button><button className="btn primary">Save changes</button></div>
      </form>
    </Modal>}
  </div>;
}
