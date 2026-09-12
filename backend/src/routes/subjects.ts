import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { ClassModel } from "../models/Class.js";
import { Subject } from "../models/Subject.js";
import { Student } from "../models/Student.js";
import { Attendance } from "../models/Attendance.js";
import { AppError, objectId, optionalText, validate } from "../lib/http.js";

const router = Router({ mergeParams: true });
const fields = z.object({ name: z.string().trim().min(1).max(100), section: optionalText(50), room: optionalText(50), periodNo: optionalText(20), academicYear: optionalText(30) });
const baseParams = { classId: objectId };

async function ownClass(classId: string, userId: string) {
  const item = await ClassModel.exists({ _id: classId, teacherId: userId });
  if (!item) throw new AppError(404, "Class not found.");
}

router.get("/", validate(z.object({ params: z.object(baseParams) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const subjects = await Subject.aggregate([
    { $match: { classId: new (await import("mongoose")).Types.ObjectId(String(req.params.classId)) } },
    { $lookup: { from: "students", localField: "_id", foreignField: "subjectId", as: "students" } },
    { $addFields: { studentCount: { $size: "$students" } } },
    { $project: { students: 0 } },
    { $sort: { createdAt: -1 } },
  ]);
  res.json({ subjects });
});

router.post("/", validate(z.object({ params: z.object(baseParams), body: fields })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const subject = await Subject.create({ ...req.body, classId: req.params.classId, teacherId: req.auth!.userId });
  res.status(201).json({ subject: { ...subject.toObject(), studentCount: 0 } });
});

router.patch("/:subjectId", validate(z.object({ params: z.object({ ...baseParams, subjectId: objectId }), body: fields.partial().refine((x) => Object.keys(x).length > 0) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const subject = await Subject.findOneAndUpdate({ _id: req.params.subjectId, classId: req.params.classId }, req.body, { new: true, runValidators: true });
  if (!subject) throw new AppError(404, "Subject not found.");
  res.json({ subject });
});

router.delete("/:subjectId", validate(z.object({ params: z.object({ ...baseParams, subjectId: objectId }) })), async (req: Request, res: Response) => {
  await ownClass(String(req.params.classId), req.auth!.userId);
  const subject = await Subject.findOneAndDelete({ _id: req.params.subjectId, classId: req.params.classId });
  if (!subject) throw new AppError(404, "Subject not found.");
  await Student.updateMany({ subjectId: subject._id }, { $unset: { subjectId: "" } });
  res.status(204).end();
});

export default router;
