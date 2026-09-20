import { CalendarDays, Check, Download, PhoneCall, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { api, ApiError } from "../lib/api";
import type { AttendanceStatus, ClassItem, Student, Subject } from "../types";
import * as XLSX from "xlsx";

type Mark = { status?: AttendanceStatus };
const today = new Date().toLocaleDateString("en-CA");
const currentMonth = today.slice(0, 7);
const rollNumberSorter = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export default function AttendancePage() {
  const [params] = useSearchParams(); const [classes, setClasses] = useState<ClassItem[]>([]); const [subjectsByClass, setSubjectsByClass] = useState<Record<string, Subject[]>>({}); const [classId, setClassId] = useState(params.get("classId") || ""); const [date, setDate] = useState(today); const [students, setStudents] = useState<Student[]>([]); const [marks, setMarks] = useState<Record<string, Mark>>({}); const [loading, setLoading] = useState(false); const [rowSaveStates, setRowSaveStates] = useState<Record<string, "saving" | "saved" | "error">>({}); const [error, setError] = useState(""); const [reportOpen, setReportOpen] = useState(false); const [reportType, setReportType] = useState<"single" | "range" | "month">("single"); const [reportDate, setReportDate] = useState(date); const [reportStart, setReportStart] = useState(date); const [reportEnd, setReportEnd] = useState(date); const [reportMonth, setReportMonth] = useState(date.slice(0, 7)); const [reporting, setReporting] = useState(false); const [reportError, setReportError] = useState(""); const saveHintTimers = useRef<Record<string, number>>({}); const retryTimers = useRef<Record<string, number>>({});
  useEffect(() => { api<{ classes: ClassItem[] }>("/classes").then((x) => { setClasses(x.classes); if (!classId && x.classes[0]) setClassId(x.classes[0]._id); x.classes.forEach((c) => { api<{ subjects: Subject[] }>(`/classes/${c._id}/subjects`).then((s) => setSubjectsByClass((prev) => ({ ...prev, [c._id]: s.subjects }))).catch(() => {}); }); }); }, []);
  useEffect(() => { if (!classId || !date) { setStudents([]); return; } setLoading(true); setError(""); api<{ students: Student[] }>(`/classes/${classId}/attendance/${date}`).then((x) => { const sortedStudents = [...x.students].sort((a, b) => rollNumberSorter.compare(a.rollNumber, b.rollNumber) || a.name.localeCompare(b.name)); setStudents(sortedStudents); setMarks(Object.fromEntries(sortedStudents.map((s) => [s._id, { status: s.attendance?.status }]))); }).catch((e) => setError(e instanceof ApiError ? e.message : "Could not load attendance.")).finally(() => setLoading(false)); }, [classId, date]);
  const counts = useMemo(() => students.reduce((x, student) => { const key = marks[student._id]?.status || "UNMARKED"; x[key]++; return x; }, { PRESENT: 0, ABSENT: 0, LEAVE: 0, UNMARKED: 0 }), [students, marks]);
  async function persist(records: { studentId: string; status: AttendanceStatus }[]) { const ids = records.map((record) => record.studentId); ids.forEach((id) => { window.clearTimeout(saveHintTimers.current[id]); window.clearTimeout(retryTimers.current[id]); }); setRowSaveStates((all) => ({ ...all, ...Object.fromEntries(ids.map((id) => [id, "saving"])) })); try { await api(`/classes/${classId}/attendance/${date}`, { method: "PUT", body: JSON.stringify({ records }) }); setError(""); setRowSaveStates((all) => ({ ...all, ...Object.fromEntries(ids.map((id) => [id, "saved"])) })); ids.forEach((id) => { saveHintTimers.current[id] = window.setTimeout(() => setRowSaveStates((all) => { const next = { ...all }; delete next[id]; return next; }), 1600); }); } catch (e) { setRowSaveStates((all) => ({ ...all, ...Object.fromEntries(ids.map((id) => [id, "error"])) })); setError(e instanceof ApiError ? `${e.message} Attendance will retry automatically.` : "Attendance is not saved yet. It will retry automatically."); const retry = window.setTimeout(() => void persist(records), 3000); ids.forEach((id) => { retryTimers.current[id] = retry; }); } }
  const setStatus = (id: string, status: AttendanceStatus) => { setMarks((all) => ({ ...all, [id]: { ...all[id], status } })); void persist([{ studentId: id, status }]); };
  const markAll = (status: AttendanceStatus) => { setMarks(Object.fromEntries(students.map((student) => [student._id, { status }]))); void persist(students.map((student) => ({ studentId: student._id, status }))); };
  function openReport() { setReportDate(date); setReportStart(date); setReportEnd(date); setReportMonth(date.slice(0, 7)); setReportType("single"); setReportError(""); setReportOpen(true); }
  async function pdf(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const item = classes.find((x) => x._id === classId);
    if (reportType === "range" && reportStart > reportEnd) { setReportError("End date must be on or after the start date."); return; }
    setReporting(true); setReportError("");
    try {
      if (reportType === "single") {
        const data = await api<{ students: Student[] }>(`/classes/${classId}/attendance/${reportDate}`);
        const wb = XLSX.utils.book_new();
        const rows: (string | number)[][] = [["Roll Number", "Name", "Status"]];
        for (const s of data.students) {
          const st = s.attendance?.status;
          rows.push([s.rollNumber, s.name, st === "PRESENT" ? "P" : st === "ABSENT" ? "A" : st === "LEAVE" ? "L" : "UNMARKED"]);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `attendance-${item?.name || "class"}-${reportDate}.xlsx`);
      } else {
        const startDate = new Date(reportType === "month" ? reportMonth + "-01" : reportStart);
        const endDate = new Date(reportType === "month" ? reportMonth + "-28" : reportEnd);
        if (reportType === "month") endDate.setMonth(endDate.getMonth() + 1, 0);
        const dates: string[] = [];
        for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) dates.push(d.toISOString().slice(0, 10));
        const allStudents: Student[] = [];
        const marks: Record<string, Record<string, AttendanceStatus | null>> = {};
        for (const dt of dates) {
          try {
            const data = await api<{ students: Student[] }>(`/classes/${classId}/attendance/${dt}`);
            if (!allStudents.length) allStudents.push(...data.students);
            for (const s of data.students) {
              if (!marks[s._id]) marks[s._id] = {};
              marks[s._id][dt] = s.attendance?.status || null;
            }
          } catch { continue; }
        }
        const wb = XLSX.utils.book_new();
        const rows: (string | number)[][] = [["Roll Number", "Name", ...dates, "Present", "Absent", "Leave"]];
        for (const s of allStudents) {
          const row: (string | number)[] = [s.rollNumber, s.name];
          let p = 0, ab = 0, l = 0;
          for (const dt of dates) {
            const st = marks[s._id]?.[dt] || null;
            row.push(st === "PRESENT" ? "P" : st === "ABSENT" ? "A" : st === "LEAVE" ? "L" : "");
            if (st === "PRESENT") p++; else if (st === "ABSENT") ab++; else if (st === "LEAVE") l++;
          }
          row.push(p, ab, l);
          rows.push(row);
        }
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [{ wch: 15 }, { wch: 25 }, ...dates.map(() => ({ wch: 10 })), { wch: 9 }, { wch: 9 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        const label = reportType === "month" ? reportMonth : `${reportStart}-to-${reportEnd}`;
        XLSX.writeFile(wb, `attendance-${item?.name || "class"}-${label}.xlsx`);
      }
      setReportOpen(false);
    } catch (e) { setReportError(e instanceof ApiError ? e.message : "Could not generate the report."); } finally { setReporting(false); }
  }
  return <div className="page"><div className="page-heading"><div><span className="eyebrow">Daily records</span><h1>Attendance</h1><p>Select any class and date to record or correct attendance.</p></div>{classId && <div className="hero-actions"><button className="btn secondary" onClick={openReport}><Download size={18} /> Download Report</button></div>}</div>
    <section className="attendance-controls content-card"><label>Class<select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Select a class</option>{classes.map((x) => { const subs = subjectsByClass[x._id]; return subs && subs.length > 0 ? subs.map((s) => <option key={`${x._id}-${s._id}`} value={x._id}>{x.name} — {s.name}</option>) : <option key={x._id} value={x._id}>{x.name}</option>; })}</select></label><label>Date<input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></label>{students.length > 0 && <div className="mark-all"><span>Mark everyone:</span><button onClick={() => markAll("PRESENT")}>Present</button><button onClick={() => markAll("ABSENT")}>Absent</button></div>}</section>
    {students.length > 0 && <div className="attendance-summary"><span className="present"><Check /> {counts.PRESENT} Present</span><span className="absent"><X /> {counts.ABSENT} Absent</span><span className="leave"><CalendarDays /> {counts.LEAVE} Leave</span><span>{counts.UNMARKED} Unmarked</span></div>}
    {error && <div className="alert error">{error}</div>}
    <section className="content-card attendance-sheet">{loading ? <div className="skeleton tall" /> : !classId ? <EmptyState icon={<CalendarDays />} title="Choose a class" text="Select a class and date above to open its attendance sheet." /> : !students.length ? <EmptyState icon={<Users />} title="No students in this class" text="Add students from the class page before marking attendance." /> : <div className="table-wrap"><table className="attendance-table"><thead><tr><th>Student</th><th>Roll number</th><th>Phone</th><th>Attendance</th></tr></thead><tbody>{students.map((student) => { const saveState = rowSaveStates[student._id]; return <tr key={student._id}><td data-label="Student"><div className="student-name"><div className="mini-avatar">{student.name.slice(0,1).toUpperCase()}</div><strong>{student.name}</strong></div></td><td data-label="Roll number"><span className="roll-chip">{student.rollNumber}</span></td><td data-label="Phone">{student.phone ? <a href={`tel:${student.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#245b45", fontWeight: 700 }} title={`Call ${student.name}`}><PhoneCall size={14} />{student.phone}</a> : "—"}</td><td data-label="Attendance"><div style={{ display: "flex", alignItems: "center", minHeight: 36 }}>{saveState === "saving" || saveState === "error" ? <span aria-live="polite" style={{ color: saveState === "error" ? "#b3343b" : "#68756e", fontSize: 12, fontWeight: 800 }}>{saveState === "saving" ? "Saving…" : "Not saved — retrying…"}</span> : <div className="status-toggle" aria-label={`Attendance for ${student.name}`}>{(["PRESENT", "ABSENT", "LEAVE"] as const).map((status) => <button key={status} className={`${status.toLowerCase()} ${marks[student._id]?.status === status ? "active" : ""}`} onClick={() => setStatus(student._id, status)} title={status[0] + status.slice(1).toLowerCase()}>{status[0]}</button>)}</div>}</div></td></tr>; })}</tbody></table></div>}</section>
    {reportOpen && <Modal title="Download attendance report" onClose={() => !reporting && setReportOpen(false)}><form className="modal-form" onSubmit={pdf}><label>Report period<select value={reportType} onChange={(e) => setReportType(e.target.value as "single" | "range" | "month")}><option value="single">One date</option><option value="range">Date range</option><option value="month">Full month</option></select></label>{reportType === "single" ? <label>Attendance date<input type="date" value={reportDate} max={today} onChange={(e) => setReportDate(e.target.value)} required /></label> : reportType === "month" ? <label>Attendance month<input type="month" value={reportMonth} max={currentMonth} onChange={(e) => setReportMonth(e.target.value)} required /></label> : <div className="form-row"><label>Start date<input type="date" value={reportStart} max={today} onChange={(e) => setReportStart(e.target.value)} required /></label><label>End date<input type="date" value={reportEnd} min={reportStart} max={today} onChange={(e) => setReportEnd(e.target.value)} required /></label></div>}{reportError && <div className="form-error">{reportError}</div>}<div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setReportOpen(false)} disabled={reporting}>Cancel</button><button className="btn primary" disabled={reporting}><Download size={17} /> {reporting ? "Preparing…" : "Download Excel"}</button></div></form></Modal>}
  </div>;
}
