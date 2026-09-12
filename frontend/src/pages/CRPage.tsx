import { CalendarCheck, Check, CalendarDays, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { AttendanceStatus, Student, Subject } from "../types";

const today = new Date().toLocaleDateString("en-CA");
type SubjectWithClass = Subject & { classId: { _id: string; name: string } | string };
type Option = { classId: string; subjectId: string; label: string };
type Mark = { status?: AttendanceStatus };

export default function CRPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [rowSaveStates, setRowSaveStates] = useState<Record<string, "saving" | "saved" | "error">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const saveHintTimers = useRef<Record<string, number>>({});
  const retryTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    api<{ subjects: SubjectWithClass[] }>("/cr/subjects").then((x) => {
      const opts = x.subjects.map((s) => {
        const classObj = typeof s.classId === "object" ? s.classId : null;
        return { classId: classObj?._id || String(s.classId), subjectId: s._id, label: `${classObj?.name || "Class"} — ${s.name}` };
      });
      setOptions(opts);
      if (opts[0]) setSelected(`${opts[0].classId}|${opts[0].subjectId}`);
    }).finally(() => setLoading(false));
  }, []);

  const [classId, subjectId] = selected.split("|");

  useEffect(() => {
    if (!classId || !subjectId) { setStudents([]); return; }
    setLoading(true);
    setError("");
    api<{ students: Student[] }>(`/classes/${classId}/attendance/${today}`)
      .then((x) => {
        const filtered = x.students.filter((s) => s.subjectId === subjectId);
        setStudents(filtered);
        setMarks(Object.fromEntries(filtered.map((s) => [s._id, { status: s.attendance?.status }])));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load attendance."))
      .finally(() => setLoading(false));
  }, [classId, subjectId]);

  const counts = useMemo(() => students.reduce((x, s) => {
    const key = marks[s._id]?.status || "UNMARKED";
    x[key]++;
    return x;
  }, { PRESENT: 0, ABSENT: 0, LEAVE: 0, UNMARKED: 0 }), [students, marks]);

  async function persist(records: { studentId: string; status: AttendanceStatus }[]) {
    const ids = records.map((r) => r.studentId);
    ids.forEach((id) => { window.clearTimeout(saveHintTimers.current[id]); window.clearTimeout(retryTimers.current[id]); });
    setRowSaveStates((all) => ({ ...all, ...Object.fromEntries(ids.map((id) => [id, "saving"])) }));
    try {
      await api(`/classes/${classId}/attendance/${today}`, { method: "PUT", body: JSON.stringify({ records }) });
      setError("");
      setRowSaveStates((all) => ({ ...all, ...Object.fromEntries(ids.map((id) => [id, "saved"])) }));
      ids.forEach((id) => { saveHintTimers.current[id] = window.setTimeout(() => setRowSaveStates((all) => { const next = { ...all }; delete next[id]; return next; }), 1600); });
    } catch (e) {
      setRowSaveStates((all) => ({ ...all, ...Object.fromEntries(ids.map((id) => [id, "error"])) }));
      setError(e instanceof ApiError ? e.message : "Could not save attendance.");
      const retry = window.setTimeout(() => void persist(records), 3000);
      ids.forEach((id) => { retryTimers.current[id] = retry; });
    }
  }

  const setStatus = (id: string, status: AttendanceStatus) => {
    setMarks((all) => ({ ...all, [id]: { ...all[id], status } }));
    void persist([{ studentId: id, status }]);
  };

  const markAll = (status: AttendanceStatus) => {
    setMarks(Object.fromEntries(students.map((s) => [s._id, { status }])));
    void persist(students.map((s) => ({ studentId: s._id, status })));
  };

  if (loading && !selected) return <div className="page"><div className="skeleton tall" /></div>;

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Class Representative</span>
          <h1>Today's Attendance</h1>
          <p>{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <section className="attendance-controls content-card">
        <label>Class
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a class</option>
            {options.map((o, i) => <option key={i} value={`${o.classId}|${o.subjectId}`}>{o.label}</option>)}
          </select>
        </label>
        {students.length > 0 && (
          <div className="mark-all">
            <span>Mark everyone:</span>
            <button onClick={() => markAll("PRESENT")}>Present</button>
            <button onClick={() => markAll("ABSENT")}>Absent</button>
          </div>
        )}
      </section>

      {students.length > 0 && (
        <div className="attendance-summary">
          <span className="present"><Check /> {counts.PRESENT} Present</span>
          <span className="absent"><X /> {counts.ABSENT} Absent</span>
          <span className="leave"><CalendarDays /> {counts.LEAVE} Leave</span>
          <span>{counts.UNMARKED} Unmarked</span>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <section className="content-card attendance-sheet">
        {loading ? <div className="skeleton tall" /> : !selected ? (
          <div style={{ padding: 40, textAlign: "center", color: "#68756e" }}>
            <CalendarCheck size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>Select a class to view today's attendance.</p>
          </div>
        ) : !students.length ? (
          <div style={{ padding: 40, textAlign: "center", color: "#68756e" }}>
            <p>No students in this subject.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="attendance-table">
              <thead>
                <tr><th>Student</th><th>Roll number</th><th>Attendance</th></tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const saveState = rowSaveStates[student._id];
                  return (
                    <tr key={student._id}>
                      <td data-label="Student">
                        <div className="student-name">
                          <div className="mini-avatar">{student.name.slice(0,1).toUpperCase()}</div>
                          <strong>{student.name}</strong>
                        </div>
                      </td>
                      <td data-label="Roll number"><span className="roll-chip">{student.rollNumber}</span></td>
                      <td data-label="Attendance">
                        <div style={{ display: "flex", alignItems: "center", minHeight: 36 }}>
                          {saveState === "saving" || saveState === "error" ? (
                            <span aria-live="polite" style={{ color: saveState === "error" ? "#b3343b" : "#68756e", fontSize: 12, fontWeight: 800 }}>
                              {saveState === "saving" ? "Saving\u2026" : "Not saved \u2014 retrying\u2026"}
                            </span>
                          ) : (
                            <div className="status-toggle" aria-label={`Attendance for ${student.name}`}>
                              {(["PRESENT", "ABSENT", "LEAVE"] as const).map((status) => (
                                <button key={status} className={`${status.toLowerCase()} ${marks[student._id]?.status === status ? "active" : ""}`} onClick={() => setStatus(student._id, status)} title={status[0] + status.slice(1).toLowerCase()}>{status[0]}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
