import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { ClassModel } from "../models/Class.js";
import { Student } from "../models/Student.js";
import { Attendance } from "../models/Attendance.js";
import { AppError, objectId, optionalText, validate } from "../lib/http.js";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvRow(line: string): string[] {
  const row: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  row.push(current);
  return row;
}

const router = Router({ mergeParams: true });
const fields = z.object({
  name: z.string().trim().min(1).max(100), rollNumber: z.string().trim().min(1).max(50), email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: optionalText(30), guardianName: optionalText(100), guardianPhone: optionalText(30),
});
const baseParams = { classId: objectId };

async function ownClass(classId: string, userId: string) {
  const item = await ClassModel.exists({ _id: classId, teacherId: userId });
  if (!item) throw new AppError(404, "Class not found.");
}

router.get("/", validate(z.object({ params: z.object(baseParams) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const students = await Student.find({ classId: req.params.classId }).sort({ rollNumber: 1, name: 1 });
  res.json({ students });
});

router.get("/export", validate(z.object({ params: z.object(baseParams) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const students = await Student.find({ classId: req.params.classId }).sort({ rollNumber: 1, name: 1 });
  const header = ["name", "rollNumber", "email", "phone", "guardianName", "guardianPhone"];
  const lines = [header.join(",")];
  for (const s of students) {
    lines.push(header.map((h) => escapeCsv(String((s as unknown as Record<string, unknown>)[h] ?? ""))).join(","));
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="students-${req.params.classId}.csv"`);
  res.send(lines.join("\n"));
});

router.post("/import", validate(z.object({ params: z.object(baseParams) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const { csv } = req.body as { csv: string };
  if (!csv || typeof csv !== "string") throw new AppError(400, "CSV data is required.");
  const lines = csv.split(/\r?\n/).filter((l: string) => l.trim());
  if (lines.length < 2) throw new AppError(400, "CSV must have a header row and at least one student.");
  const header = parseCsvRow(lines[0]!).map((h: string) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const rollIdx = header.indexOf("rollnumber");
  if (nameIdx === -1 || rollIdx === -1) throw new AppError(400, 'CSV must contain "name" and "rollNumber" columns.');
  const emailIdx = header.indexOf("email");
  const phoneIdx = header.indexOf("phone");
  const guardianNameIdx = header.indexOf("guardianname");
  const guardianPhoneIdx = header.indexOf("guardianphone");
  const docs: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]!);
    const name = (cols[nameIdx] ?? "").trim();
    const rollNumber = (cols[rollIdx] ?? "").trim();
    if (!name || !rollNumber) continue;
    const doc: Record<string, string> = { name, rollNumber, classId: String(req.params.classId) };
    if (emailIdx !== -1 && cols[emailIdx]?.trim()) doc.email = cols[emailIdx].trim();
    if (phoneIdx !== -1 && cols[phoneIdx]?.trim()) doc.phone = cols[phoneIdx].trim();
    if (guardianNameIdx !== -1 && cols[guardianNameIdx]?.trim()) doc.guardianName = cols[guardianNameIdx].trim();
    if (guardianPhoneIdx !== -1 && cols[guardianPhoneIdx]?.trim()) doc.guardianPhone = cols[guardianPhoneIdx].trim();
    docs.push(doc);
  }
  if (docs.length === 0) throw new AppError(400, "No valid students found in CSV.");
  const result = await Student.insertMany(docs, { ordered: false }).catch((err) => {
    if (err.code === 11000) throw new AppError(409, "Some roll numbers already exist in this class.");
    throw err;
  });
  res.status(201).json({ imported: result.length });
});

router.post("/", validate(z.object({ params: z.object(baseParams), body: fields })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const student = await Student.create({ ...req.body, classId: req.params.classId });
  res.status(201).json({ student });
});

router.patch("/:studentId", validate(z.object({ params: z.object({ ...baseParams, studentId: objectId }), body: fields.partial().refine((x) => Object.keys(x).length > 0) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const student = await Student.findOneAndUpdate({ _id: req.params.studentId, classId: req.params.classId }, req.body, { new: true, runValidators: true });
  if (!student) throw new AppError(404, "Student not found.");
  res.json({ student });
});

router.delete("/:studentId", validate(z.object({ params: z.object({ ...baseParams, studentId: objectId }) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const student = await Student.findOneAndDelete({ _id: req.params.studentId, classId: req.params.classId });
  if (!student) throw new AppError(404, "Student not found.");
  await Attendance.deleteMany({ studentId: student._id });
  res.status(204).end();
});

export default router;
