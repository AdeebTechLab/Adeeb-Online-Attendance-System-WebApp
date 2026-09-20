import { ArrowLeft, BookOpen, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { api, ApiError } from "../lib/api";
import type { Subject } from "../types";

type CR = { _id: string; name: string; email: string; phone: string; city?: string; isActive: boolean; createdAt: string };
type SubjectWithClass = Omit<Subject, "classId"> & { classId: { _id: string; name: string } | string };

const blank = { name: "", email: "", password: "", phone: "", city: "" };
export default function CRManagePage() {
  const [crs, setCRs] = useState<CR[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"new" | null>(null);
  const [editModal, setEditModal] = useState<CR | null>(null);
  const [assignModal, setAssignModal] = useState<CR | null>(null);
  const [allSubjects, setAllSubjects] = useState<SubjectWithClass[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => api<{ crs: CR[] }>("/cr").then((x) => setCRs(x.crs)).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("/cr", { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create CR account.");
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    form.forEach((v, k) => { if (v) body[k] = String(v); });
    try {
      await api(`/cr/${editModal!._id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditModal(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update CR.");
    }
  }

  async function toggleStatus(cr: CR) {
    await api(`/cr/${cr._id}/status`, { method: "PATCH" });
    setCRs((all) => all.map((x) => x._id === cr._id ? { ...x, isActive: !x.isActive } : x));
  }

  async function remove(cr: CR) {
    if (!confirm(`Delete CR "${cr.name}"?`)) return;
    await api(`/cr/${cr._id}`, { method: "DELETE" });
    setCRs((all) => all.filter((x) => x._id !== cr._id));
  }

  async function openAssign(cr: CR) {
    setAssignModal(cr);
    setSelectedSubjectIds([]);
    try {
      const [subRes, crSubRes] = await Promise.all([
        api<{ subjects: SubjectWithClass[] }>("/cr/subjects"),
        api<{ subjects: SubjectWithClass[] }>(`/cr/${cr._id}/subjects`),
      ]);
      setAllSubjects(subRes.subjects);
      setSelectedSubjectIds(crSubRes.subjects.map((s) => s._id));
    } catch {
      setAllSubjects([]);
    }
  }

  async function saveAssign() {
    if (!assignModal) return;
    setSaving(true);
    try {
      await api(`/cr/${assignModal._id}/subjects`, { method: "PATCH", body: JSON.stringify({ subjectIds: selectedSubjectIds }) });
      setAssignModal(null);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Could not save assignments.");
    } finally {
      setSaving(false);
    }
  }

  function toggleSubject(id: string) {
    setSelectedSubjectIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function getClassName(s: SubjectWithClass): string {
    if (typeof s.classId === "object" && s.classId?.name) return s.classId.name;
    return "";
  }

  return (
    <div className="page">
      <Link to="/dashboard" className="back-link"><ArrowLeft size={17} /> Back to dashboard</Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Manage CR</span>
          <h1>Class Representatives</h1>
          <p>Add CR accounts and assign subjects to them.</p>
        </div>
        <button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Add CR</button>
      </div>

      <section className="content-card">
        {loading ? <div className="skeleton tall" /> : crs.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {crs.map((cr) => (
                  <tr key={cr._id}>
                    <td><div className="student-name"><div className="mini-avatar">{cr.name.slice(0,1).toUpperCase()}</div><strong>{cr.name}</strong></div></td>
                    <td>{cr.email}</td>
                    <td>{cr.phone}</td>
                    <td>
                      <button className={`status-pill ${cr.isActive ? "present" : "stopped"}`} onClick={() => void toggleStatus(cr)}>
                        {cr.isActive ? "Active" : "Stopped"}
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={() => { setEditModal(cr); setError(""); }} aria-label={`Edit ${cr.name}`}><Pencil /></button>
                        <button className="btn secondary" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => void openAssign(cr)}><BookOpen size={14} /> Assign Subjects</button>
                        <button className="icon-btn danger-text" onClick={() => void remove(cr)} aria-label={`Remove ${cr.name}`}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Users />} title="No CR accounts yet" text="Add a CR so they can view today's attendance." action={<button className="btn primary" onClick={() => setModal("new")}><Plus size={18} /> Add CR</button>} />
        )}
      </section>

      {modal && (
        <Modal title="Add a CR" onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={save}>
            <label>Name<input name="name" defaultValue={blank.name} required placeholder="Full name" /></label>
            <label>Email<input type="email" name="email" defaultValue={blank.email} required placeholder="cr@example.com" /></label>
            <label>Password<input type="password" name="password" defaultValue={blank.password} required placeholder="Password" /></label>
            <label>Phone<input name="phone" defaultValue={blank.phone} required placeholder="Phone number" /></label>
            <label>City<input name="city" defaultValue={blank.city} placeholder="City (optional)" /></label>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn primary">Create CR</button>
            </div>
          </form>
        </Modal>
      )}

      {editModal && (
        <Modal title={`Edit ${editModal.name}`} onClose={() => setEditModal(null)}>
          <form className="modal-form" onSubmit={saveEdit}>
            <label>Name<input name="name" defaultValue={editModal.name} required placeholder="Full name" /></label>
            <label>Email<input type="email" name="email" defaultValue={editModal.email} required placeholder="cr@example.com" /></label>
            <label>Phone<input name="phone" defaultValue={editModal.phone} required placeholder="Phone number" /></label>
            <label>City<input name="city" defaultValue={editModal.city || ""} placeholder="City" /></label>
            <label>New Password <span>(leave blank to keep current)</span><input type="password" name="password" placeholder="Enter new password" /></label>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn primary">Save changes</button>
            </div>
          </form>
        </Modal>
      )}

      {assignModal && (
        <Modal title={`Assign subjects to ${assignModal.name}`} onClose={() => setAssignModal(null)}>
          <div style={{ maxHeight: 400, overflowY: "auto", padding: "8px 0" }}>
            {allSubjects.length === 0 ? (
              <p style={{ color: "#68756e", textAlign: "center", padding: 20 }}>No subjects found. Create subjects first.</p>
            ) : (
              allSubjects.map((s) => (
                <label key={s._id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selectedSubjectIds.includes(s._id) ? "#e6f0eb" : "transparent", marginBottom: 4, border: "1px solid " + (selectedSubjectIds.includes(s._id) ? "#163c2e" : "#dfe6e2") }}>
                  <input type="checkbox" checked={selectedSubjectIds.includes(s._id)} onChange={() => toggleSubject(s._id)} style={{ width: 18, height: 18, accentColor: "#163c2e" }} />
                  <div>
                    <strong style={{ fontSize: 14 }}>{s.name}</strong>
                    <span style={{ fontSize: 12, color: "#68756e", marginLeft: 8 }}>{getClassName(s)}</span>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={() => setAssignModal(null)}>Cancel</button>
            <button className="btn primary" onClick={() => void saveAssign()} disabled={saving}>{saving ? "Saving..." : "Save assignments"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
