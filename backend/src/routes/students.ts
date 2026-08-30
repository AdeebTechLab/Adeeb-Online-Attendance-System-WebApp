import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { ClassModel } from "../models/Class.js";
import { Student } from "../models/Student.js";
import { Attendance } from "../models/Attendance.js";
import { AppError, objectId, optionalText, validate } from "../lib/http.js";

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
