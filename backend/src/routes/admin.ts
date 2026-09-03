import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { z } from "zod";
import { User } from "../models/User.js";
import { ClassModel } from "../models/Class.js";
import { Student } from "../models/Student.js";
import { Attendance } from "../models/Attendance.js";
import { AppError, nonBlankPassword, objectId, optionalText, phoneNumber, validate } from "../lib/http.js";
import { publicUser } from "../lib/user.js";

const router = Router();

router.get("/overview", async (_req: Request, res: Response) => {
  const [teacherCount, classCount, studentCount] = await Promise.all([
    User.countDocuments({ role: "TEACHER" }), ClassModel.countDocuments(), Student.countDocuments(),
  ]);
  res.json({ teacherCount, classCount, studentCount });
});

router.get("/teachers", async (_req: Request, res: Response) => {
  const teachers = await User.aggregate([
    { $match: { role: "TEACHER" } },
    { $lookup: { from: "classes", localField: "_id", foreignField: "teacherId", as: "classes" } },
    { $lookup: { from: "students", localField: "classes._id", foreignField: "classId", as: "students" } },
    { $addFields: { classCount: { $size: "$classes" }, studentCount: { $size: "$students" }, designation: { $ifNull: ["$designation", "$department"] }, isActive: { $ifNull: ["$isActive", true] } } },
    { $project: { passwordHash: 0, department: 0, students: 0, "classes.teacherId": 0 } },
    { $sort: { createdAt: -1 } },
  ]);
  res.json({ teachers });
});

router.get("/teachers/:teacherId", validate(z.object({ params: z.object({ teacherId: objectId }) })), async (req: Request, res: Response) => {
  const teacher = await User.findOne({ _id: req.params.teacherId, role: "TEACHER" });
  if (!teacher) throw new AppError(404, "Teacher not found.");
  const classes = await ClassModel.aggregate([
    { $match: { teacherId: new Types.ObjectId(String(req.params.teacherId)) } },
    { $lookup: { from: "students", localField: "_id", foreignField: "classId", as: "students" } },
    { $addFields: { studentCount: { $size: "$students" } } }, { $project: { students: 0 } }, { $sort: { name: 1 } },
  ]);
  res.json({ teacher: publicUser(teacher), classes });
});

router.patch("/teachers/:teacherId", validate(z.object({
  params: z.object({ teacherId: objectId }),
  body: z.object({ name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()).optional(), phone: phoneNumber, city: z.string().trim().min(2).max(100), institutionName: z.string().trim().min(2).max(200), designation: optionalText(100), newPassword: z.union([z.literal(""), nonBlankPassword]).optional() }),
})), async (req: Request, res: Response) => {
  const { newPassword, ...profile } = req.body as Record<string, string | undefined>;
  const fields: Record<string, string | undefined> = { ...profile };
  if (newPassword) fields.passwordHash = await bcrypt.hash(newPassword, 12);
  const update = profile.designation !== undefined ? { $set: fields, $unset: { department: "" } } : { $set: fields };
  const teacher = await User.findOneAndUpdate({ _id: req.params.teacherId, role: "TEACHER" }, update, { new: true, runValidators: true });
  if (!teacher) throw new AppError(404, "Teacher not found.");
  res.json({ teacher: publicUser(teacher) });
});

router.patch("/teachers/:teacherId/status", validate(z.object({
  params: z.object({ teacherId: objectId }),
  body: z.object({ isActive: z.boolean() }),
})), async (req: Request, res: Response) => {
  const teacher = await User.findOneAndUpdate(
    { _id: req.params.teacherId, role: "TEACHER" },
    { $set: { isActive: req.body.isActive } },
    { new: true, runValidators: true },
  );
  if (!teacher) throw new AppError(404, "Teacher not found.");
  res.json({ teacher: publicUser(teacher) });
});

router.delete("/teachers/:teacherId", validate(z.object({ params: z.object({ teacherId: objectId }) })), async (req: Request, res: Response) => {
  const teacher = await User.findOne({ _id: req.params.teacherId, role: "TEACHER" });
  if (!teacher) throw new AppError(404, "Teacher not found.");

  const classIds = await ClassModel.find({ teacherId: teacher._id }).distinct("_id");
  const studentIds = classIds.length ? await Student.find({ classId: { $in: classIds } }).distinct("_id") : [];
  await Attendance.deleteMany({ $or: [{ classId: { $in: classIds } }, { studentId: { $in: studentIds } }] });
  await Student.deleteMany({ classId: { $in: classIds } });
  await ClassModel.deleteMany({ teacherId: teacher._id });
  await User.deleteOne({ _id: teacher._id });
  res.status(204).end();
});

export default router;
