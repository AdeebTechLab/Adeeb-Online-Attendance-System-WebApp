import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { ClassModel } from "../models/Class.js";
import { Student } from "../models/Student.js";
import { Attendance } from "../models/Attendance.js";
import { AppError, objectId, optionalText, validate } from "../lib/http.js";

const router = Router();
const fields = z.object({ name: z.string().trim().min(1).max(100), subject: optionalText(100), section: optionalText(50), room: optionalText(50), academicYear: optionalText(30), shift: z.enum(["MORNING", "EVENING"]).optional() });
const idParams = z.object({ params: z.object({ classId: objectId }) });

router.get("/", async (req: Request, res: Response) => {
  const classes = await ClassModel.aggregate([
    { $match: { teacherId: new (await import("mongoose")).Types.ObjectId(req.auth!.userId) } },
    { $lookup: { from: "students", localField: "_id", foreignField: "classId", as: "students" } },
    { $addFields: { studentCount: { $size: "$students" } } },
    { $project: { students: 0 } }, { $sort: { createdAt: -1 } },
  ]);
  res.json({ classes });
});

router.post("/", validate(z.object({ body: fields })), async (req: Request, res: Response) => {
  const item = await ClassModel.create({ ...req.body, teacherId: req.auth!.userId });
  res.status(201).json({ class: { ...item.toObject(), studentCount: 0 } });
});

router.get("/:classId", validate(idParams), async (req: Request, res: Response) => {
  const item = await ClassModel.findOne({ _id: req.params.classId, teacherId: req.auth!.userId });
  if (!item) throw new AppError(404, "Class not found.");
  const studentCount = await Student.countDocuments({ classId: item._id });
  res.json({ class: { ...item.toObject(), studentCount } });
});

router.patch("/:classId", validate(z.object({ params: z.object({ classId: objectId }), body: fields.partial().refine((x) => Object.keys(x).length > 0) })), async (req: Request, res: Response) => {
  const item = await ClassModel.findOneAndUpdate({ _id: req.params.classId, teacherId: req.auth!.userId }, req.body, { new: true, runValidators: true });
  if (!item) throw new AppError(404, "Class not found.");
  res.json({ class: item });
});

router.delete("/:classId", validate(idParams), async (req: Request, res: Response) => {
  const item = await ClassModel.findOneAndDelete({ _id: req.params.classId, teacherId: req.auth!.userId });
  if (!item) throw new AppError(404, "Class not found.");
  const studentIds = await Student.find({ classId: item._id }).distinct("_id");
  await Promise.all([Student.deleteMany({ classId: item._id }), Attendance.deleteMany({ $or: [{ classId: item._id }, { studentId: { $in: studentIds } }] })]);
  res.status(204).end();
});

export default router;
