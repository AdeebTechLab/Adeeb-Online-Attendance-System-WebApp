import { Router } from "express";
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { ClassModel } from "../models/Class.js";
import { Student } from "../models/Student.js";
import { Attendance } from "../models/Attendance.js";
import { AppError, dateOnly, objectId, validate } from "../lib/http.js";

const router = Router({ mergeParams: true });
const params = z.object({ classId: objectId, date: dateOnly });
const reportParams = z.object({ classId: objectId });
const reportQuery = z.object({ startDate: dateOnly, endDate: dateOnly }).refine((value) => value.startDate <= value.endDate, { message: "Start date must be before or equal to end date.", path: ["endDate"] });
const monthlyReportQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM format") });

async function getOwnedClass(classId: string, userId: string) {
  const item = await ClassModel.findOne({ _id: classId, teacherId: userId });
  if (!item) throw new AppError(404, "Class not found.");
  return item;
}

router.get("/report/monthly/pdf", validate(z.object({ params: reportParams, query: monthlyReportQuery })), async (req: Request, res: Response) => {
  const classItem = await getOwnedClass(String(req.params.classId), req.auth!.userId);
  const month = String(req.query.month);
  const yearNumber = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const [students, records] = await Promise.all([
    Student.find({ classId: classItem._id }).collation({ locale: "en", numericOrdering: true, strength: 2 }).sort({ rollNumber: 1, name: 1 }),
    Attendance.find({ classId: classItem._id, date: { $gte: dates[0], $lte: dates[dates.length - 1] } }),
  ]);
  const safeName = classItem.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${safeName}-${month}.pdf"`);

  const rowHeight = 18;
  const headerHeight = 30;
  const margin = 20;
  const pageHeight = Math.max(842, 126 + (students.length * rowHeight) + margin);
  const pageWidth = Math.max(1191, pageHeight * 1.38);
  const doc = new PDFDocument({ size: [pageWidth, pageHeight], margin });
  doc.pipe(res);
  const statusByStudentDate = new Map(records.map((record) => [`${String(record.studentId)}|${record.date}`, record.status]));
  const numberWidth = 22;
  const studentWidth = 136;
  const rollWidth = 52;
  const summaryWidth = 38;
  const fixedWidth = numberWidth + studentWidth + rollWidth + (summaryWidth * 4);
  const dateWidth = (pageWidth - (margin * 2) - fixedWidth) / daysInMonth;
  const border = "#cfd6d2";
  const headerFill = "#10b981";
  const monthLabel = new Date(Date.UTC(yearNumber, monthNumber - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const drawCell = (text: string, x: number, y: number, width: number, height: number, options: { fill?: string; color?: string; bold?: boolean; align?: "left" | "center" | "right"; size?: number; yOffset?: number } = {}) => {
    doc.rect(x, y, width, height).fillAndStroke(options.fill || "#ffffff", border);
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.size || 6.5).fillColor(options.color || "#26332d").text(text, x + 2, y + (options.yOffset ?? 5), { width: width - 4, height: height - 4, align: options.align || "left", ellipsis: true });
  };

  doc.font("Helvetica-Bold").fontSize(17).fillColor("#163b2e").text("Adeeb Online Attendance System", margin, 18);
  doc.fontSize(12).fillColor("#111827").text(`${classItem.name}${classItem.section ? ` - ${classItem.section}` : ""}`, margin, 40);
  doc.font("Helvetica").fontSize(8.5).fillColor("#4b5563").text(`Monthly attendance: ${monthLabel}   |   Subject: ${classItem.subject || "-"}   |   Shift: ${classItem.shift === "EVENING" ? "Evening" : "Morning"}`, margin, 58);
  doc.fontSize(7.5).fillColor("#66736c").text("P = Present   A = Absent   L = Leave   - = Not marked", margin, 72);

  let x = margin;
  let y = 88;
  drawCell("#", x, y, numberWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 7, yOffset: 11 }); x += numberWidth;
  drawCell("Student Name", x, y, studentWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, size: 7, yOffset: 11 }); x += studentWidth;
  drawCell("Roll No", x, y, rollWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 7, yOffset: 11 }); x += rollWidth;
  dates.forEach((reportDate) => { drawCell(String(Number(reportDate.slice(8, 10))), x, y, dateWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 6.5, yOffset: 11 }); x += dateWidth; });
  ["Pres", "Abs", "Leave", "%"].forEach((label) => { drawCell(label, x, y, summaryWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 7, yOffset: 11 }); x += summaryWidth; });
  y += headerHeight;

  students.forEach((student, studentIndex) => {
    const studentId = String(student._id);
    const statuses = dates.map((reportDate) => statusByStudentDate.get(`${studentId}|${reportDate}`));
    const present = statuses.filter((status) => status === "PRESENT").length;
    const absent = statuses.filter((status) => status === "ABSENT").length;
    const leave = statuses.filter((status) => status === "LEAVE").length;
    const marked = present + absent + leave;
    const percentage = marked ? `${Math.round((present / marked) * 100)}%` : "-";
    const rowFill = studentIndex % 2 ? "#f8faf9" : "#ffffff";
    x = margin;
    drawCell(String(studentIndex + 1), x, y, numberWidth, rowHeight, { fill: rowFill, align: "center", size: 6.5 }); x += numberWidth;
    drawCell(student.name, x, y, studentWidth, rowHeight, { fill: rowFill, bold: true, size: 6.5 }); x += studentWidth;
    drawCell(student.rollNumber, x, y, rollWidth, rowHeight, { fill: rowFill, align: "center", size: 6.5 }); x += rollWidth;
    statuses.forEach((status) => {
      const label = status === "PRESENT" ? "P" : status === "ABSENT" ? "A" : status === "LEAVE" ? "L" : "-";
      const color = status === "PRESENT" ? "#059669" : status === "ABSENT" ? "#dc2626" : status === "LEAVE" ? "#d97706" : "#8a948f";
      drawCell(label, x, y, dateWidth, rowHeight, { fill: rowFill, color, bold: Boolean(status), align: "center", size: 6.5 }); x += dateWidth;
    });
    [String(present), String(absent), String(leave), percentage].forEach((value) => { drawCell(value, x, y, summaryWidth, rowHeight, { fill: rowFill, bold: true, align: "center", size: 6.5 }); x += summaryWidth; });
    y += rowHeight;
  });
  if (!students.length) doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text("No students are enrolled in this class.", margin, y + 16);
  doc.end();
});

router.get("/report/pdf", validate(z.object({ params: reportParams, query: reportQuery })), async (req: Request, res: Response) => {
  const classItem = await getOwnedClass(String(req.params.classId), req.auth!.userId);
  const startDate = String(req.query.startDate);
  const endDate = String(req.query.endDate);
  const [students, records] = await Promise.all([
    Student.find({ classId: classItem._id }).collation({ locale: "en", numericOrdering: true, strength: 2 }).sort({ rollNumber: 1, name: 1 }),
    Attendance.find({ classId: classItem._id, date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 }),
  ]);
  const dates = [...new Set(records.map((record) => record.date))];
  const safeName = classItem.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${safeName}-${startDate}-to-${endDate}.pdf"`);
  const doc = new PDFDocument({ size: "A3", layout: "landscape", margin: 28 });
  doc.pipe(res);
  if (!dates.length) {
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#163b2e").text("Adeeb Online Attendance System");
    doc.moveDown(0.4).fontSize(14).fillColor("#111827").text(`${classItem.name}${classItem.section ? ` — ${classItem.section}` : ""}`);
    doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Report period: ${startDate} to ${endDate}`);
    doc.moveDown(2).fontSize(12).text("No attendance records were found in the selected date range.");
    doc.end();
    return;
  }

  const statusByStudentDate = new Map(records.map((record) => [`${String(record.studentId)}|${record.date}`, record.status]));
  const dateChunks: string[][] = [];
  for (let index = 0; index < dates.length; index += 20) dateChunks.push(dates.slice(index, index + 20));
  const margin = 28;
  const numberWidth = 28;
  const studentWidth = 160;
  const rollWidth = 64;
  const summaryWidth = 46;
  const rowHeight = 27;
  const headerHeight = 36;
  const dateWidth = 35;
  const border = "#cfd6d2";
  const headerFill = "#10b981";

  const drawCell = (text: string, x: number, y: number, width: number, height: number, options: { fill?: string; color?: string; bold?: boolean; align?: "left" | "center" | "right"; size?: number } = {}) => {
    doc.rect(x, y, width, height).fillAndStroke(options.fill || "#ffffff", border);
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(options.size || 8).fillColor(options.color || "#26332d").text(text, x + 4, y + 7, { width: width - 8, height: height - 8, align: options.align || "left", ellipsis: true });
  };

  const drawPageHeader = (chunk: string[], chunkIndex: number, continuation: boolean) => {
    const tableWidth = numberWidth + studentWidth + rollWidth + (chunk.length * dateWidth) + (summaryWidth * 4);
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#163b2e").text("Adeeb Online Attendance System", margin, 25);
    doc.fontSize(13).fillColor("#111827").text(`${classItem.name}${classItem.section ? ` — ${classItem.section}` : ""}`, margin, 49);
    doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(`Attendance report: ${startDate} to ${endDate}   •   Subject: ${classItem.subject || "—"}   •   Shift: ${classItem.shift === "EVENING" ? "Evening" : "Morning"}${dateChunks.length > 1 ? `   •   Date columns ${chunkIndex + 1}/${dateChunks.length}` : ""}${continuation ? "   •   Continued" : ""}`, margin, 68, { width: tableWidth });
    doc.fontSize(8).fillColor("#66736c").text("P = Present   A = Absent   L = Leave   — = Not marked", margin, 83);
    let x = margin;
    const y = 101;
    drawCell("#", x, y, numberWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 8 }); x += numberWidth;
    drawCell("Student Name", x, y, studentWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, size: 8 }); x += studentWidth;
    drawCell("Roll No", x, y, rollWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 8 }); x += rollWidth;
    chunk.forEach((reportDate) => { const year = reportDate.slice(2, 4); const month = reportDate.slice(5, 7); const day = reportDate.slice(8, 10); drawCell(`${day}/${month}\n${year}`, x, y, dateWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 7 }); x += dateWidth; });
    ["Pres", "Abs", "Leave", "%"].forEach((label) => { drawCell(label, x, y, summaryWidth, headerHeight, { fill: headerFill, color: "#ffffff", bold: true, align: "center", size: 8 }); x += summaryWidth; });
    return y + headerHeight;
  };

  let firstPage = true;
  dateChunks.forEach((chunk, chunkIndex) => {
    if (!firstPage) doc.addPage({ size: "A3", layout: "landscape", margin });
    firstPage = false;
    let y = drawPageHeader(chunk, chunkIndex, false);
    students.forEach((student, studentIndex) => {
      if (y + rowHeight > doc.page.height - margin) { doc.addPage({ size: "A3", layout: "landscape", margin }); y = drawPageHeader(chunk, chunkIndex, true); }
      const studentId = String(student._id);
      const allStatuses = dates.map((reportDate) => statusByStudentDate.get(`${studentId}|${reportDate}`));
      const present = allStatuses.filter((status) => status === "PRESENT").length;
      const absent = allStatuses.filter((status) => status === "ABSENT").length;
      const leave = allStatuses.filter((status) => status === "LEAVE").length;
      const marked = present + absent + leave;
      const percentage = marked ? `${Math.round((present / marked) * 100)}%` : "—";
      const rowFill = studentIndex % 2 ? "#f8faf9" : "#ffffff";
      let x = margin;
      drawCell(String(studentIndex + 1), x, y, numberWidth, rowHeight, { fill: rowFill, align: "center" }); x += numberWidth;
      drawCell(student.name, x, y, studentWidth, rowHeight, { fill: rowFill, bold: true }); x += studentWidth;
      drawCell(student.rollNumber, x, y, rollWidth, rowHeight, { fill: rowFill, align: "center" }); x += rollWidth;
      chunk.forEach((reportDate) => {
        const status = statusByStudentDate.get(`${studentId}|${reportDate}`);
        const label = status === "PRESENT" ? "P" : status === "ABSENT" ? "A" : status === "LEAVE" ? "L" : "—";
        const color = status === "PRESENT" ? "#059669" : status === "ABSENT" ? "#dc2626" : status === "LEAVE" ? "#d97706" : "#7b8580";
        drawCell(label, x, y, dateWidth, rowHeight, { fill: rowFill, color, bold: Boolean(status), align: "center", size: 8 }); x += dateWidth;
      });
      [String(present), String(absent), String(leave), percentage].forEach((value) => { drawCell(value, x, y, summaryWidth, rowHeight, { fill: rowFill, bold: true, align: "center" }); x += summaryWidth; });
      y += rowHeight;
    });
  });
  doc.end();
});

router.get("/:date", validate(z.object({ params })), async (req: Request, res: Response) => {
  const classItem = await getOwnedClass(String(req.params.classId), req.auth!.userId);
  const [students, records] = await Promise.all([
    Student.find({ classId: classItem._id }).collation({ locale: "en", numericOrdering: true, strength: 2 }).sort({ rollNumber: 1, name: 1 }),
    Attendance.find({ classId: classItem._id, date: req.params.date }),
  ]);
  const byStudent = new Map(records.map((record) => [String(record.studentId), record]));
  res.json({ class: classItem, date: req.params.date, students: students.map((student) => ({ ...student.toObject(), attendance: byStudent.get(String(student._id)) || null })) });
});

router.put("/:date", validate(z.object({ params, body: z.object({ records: z.array(z.object({ studentId: objectId, status: z.enum(["PRESENT", "ABSENT", "LEAVE"]) })).max(1000) }) })), async (req: Request, res: Response) => {
  const classItem = await getOwnedClass(String(req.params.classId), req.auth!.userId);
  const uniqueIds = new Set(req.body.records.map((x: { studentId: string }) => x.studentId));
  if (uniqueIds.size !== req.body.records.length) throw new AppError(400, "Each student may appear only once.");
  const validCount = await Student.countDocuments({ _id: { $in: [...uniqueIds] }, classId: classItem._id });
  if (validCount !== uniqueIds.size) throw new AppError(400, "One or more students do not belong to this class.");
  if (req.body.records.length) {
    await Attendance.bulkWrite(req.body.records.map((record: { studentId: string; status: string }) => ({
      updateOne: { filter: { studentId: record.studentId, date: req.params.date }, update: { $set: { classId: classItem._id, status: record.status } }, upsert: true },
    })));
  }
  res.json({ message: "Attendance saved.", saved: req.body.records.length });
});

router.get("/:date/pdf", validate(z.object({ params })), async (req: Request, res: Response) => {
  const classItem = await getOwnedClass(String(req.params.classId), req.auth!.userId);
  const [students, records] = await Promise.all([Student.find({ classId: classItem._id }).collation({ locale: "en", numericOrdering: true, strength: 2 }).sort({ rollNumber: 1, name: 1 }), Attendance.find({ classId: classItem._id, date: req.params.date })]);
  const byStudent = new Map(records.map((record) => [String(record.studentId), record.status]));
  const counts = { PRESENT: 0, ABSENT: 0, LEAVE: 0, UNMARKED: 0 };
  for (const student of students) counts[byStudent.get(String(student._id)) || "UNMARKED"]++;
  const safeName = classItem.name.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${safeName}-${req.params.date}.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 44 });
  doc.pipe(res);
  doc.fontSize(20).fillColor("#163b2e").text("Adeeb Online Attendance System");
  doc.moveDown(0.4).fontSize(14).fillColor("#111827").text(`${classItem.name}${classItem.section ? ` — ${classItem.section}` : ""}`);
  doc.fontSize(10).fillColor("#4b5563").text(`Date: ${req.params.date}    Subject: ${classItem.subject || "—"}    Timing: ${classItem.shift === "EVENING" ? "Evening" : "Morning"}`);
  doc.moveDown().fillColor("#111827").text(`Present: ${counts.PRESENT}   Absent: ${counts.ABSENT}   Leave: ${counts.LEAVE}   Unmarked: ${counts.UNMARKED}`);
  doc.moveDown();
  let y = doc.y;
  const header = () => { doc.rect(44, y, 507, 24).fill("#e8f2ed"); doc.fillColor("#163b2e").fontSize(10).text("Roll #", 52, y + 7).text("Student", 120, y + 7).text("Status", 420, y + 7); y += 28; };
  header();
  students.forEach((student) => {
    if (y > 760) { doc.addPage(); y = 44; header(); }
    const status = byStudent.get(String(student._id)) || "UNMARKED";
    doc.fillColor("#111827").text(student.rollNumber, 52, y).text(student.name, 120, y, { width: 285 }).text(status[0] + status.slice(1).toLowerCase(), 420, y);
    doc.moveTo(44, y + 16).lineTo(551, y + 16).strokeColor("#e5e7eb").stroke(); y += 23;
  });
  doc.end();
});

export default router;
