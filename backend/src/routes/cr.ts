import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { User } from "../models/User.js";
import { ClassModel } from "../models/Class.js";
import { Subject } from "../models/Subject.js";
import { AppError, nonBlankPassword, objectId, phoneNumber, validate } from "../lib/http.js";

const router = Router();

const createCR = z.object({ body: z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()),
  password: nonBlankPassword,
  phone: phoneNumber,
}) });

router.get("/classes", async (req: Request, res: Response) => {
  const assignedClassIds = await Subject.distinct("classId", { crIds: req.auth!.userId });
  const classes = await ClassModel.aggregate([
    { $match: { _id: { $in: assignedClassIds.map((id) => new Types.ObjectId(String(id))) } } },
    { $lookup: { from: "students", localField: "_id", foreignField: "classId", as: "students" } },
    { $addFields: { studentCount: { $size: "$students" } } },
    { $project: { students: 0 } },
    { $sort: { createdAt: -1 } },
  ]);
  res.json({ classes });
});

router.get("/subjects", async (req: Request, res: Response) => {
  const user = await User.findById(req.auth!.userId).select("role city");
  const teacherId = user?.role === "CR" ? user.city : req.auth!.userId;
  const classes = await ClassModel.find({ teacherId }).select("_id name");
  const classIds = classes.map((c) => c._id);
  const subjects = await Subject.find({ classId: { $in: classIds }, ...(user?.role === "CR" ? { crIds: req.auth!.userId } : {}) }).populate("classId", "name").sort({ createdAt: -1 });
  res.json({ subjects, classes });
});

router.get("/:crId/subjects", validate(z.object({ params: z.object({ crId: objectId }) })), async (req: Request, res: Response) => {
  const cr = await User.findOne({ _id: req.params.crId, role: "CR", city: req.auth!.userId });
  if (!cr) throw new AppError(404, "CR not found.");
  const subjects = await Subject.find({ crIds: cr._id }).populate("classId", "name");
  res.json({ subjects });
});

router.patch("/:crId/subjects", validate(z.object({ params: z.object({ crId: objectId }), body: z.object({ subjectIds: z.array(objectId) }) })), async (req: Request, res: Response) => {
  const cr = await User.findOne({ _id: req.params.crId, role: "CR", city: req.auth!.userId });
  if (!cr) throw new AppError(404, "CR not found.");
  const classes = await ClassModel.find({ teacherId: req.auth!.userId }).select("_id");
  const classIds = classes.map((c) => c._id);
  await Subject.updateMany({ _id: { $in: req.body.subjectIds }, classId: { $in: classIds } }, { $addToSet: { crIds: cr._id } });
  await Subject.updateMany({ _id: { $nin: req.body.subjectIds }, classId: { $in: classIds }, crIds: cr._id }, { $pull: { crIds: cr._id } });
  res.json({ message: "Subjects updated." });
});

router.get("/", async (req: Request, res: Response) => {
  const crs = await User.find({ role: "CR", city: req.auth!.userId }).select("name email phone city isActive createdAt").sort({ createdAt: -1 });
  res.json({ crs });
});

router.post("/", validate(createCR), async (req: Request, res: Response) => {
  if (await User.exists({ email: req.body.email })) throw new AppError(409, "An account already exists for this email.");
  const cr = await User.create({
    ...req.body,
    password: undefined,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: "CR",
    city: req.auth!.userId,
    institutionName: "CR",
  });
  res.status(201).json({ cr: { _id: cr._id, name: cr.name, email: cr.email, phone: cr.phone, role: cr.role, isActive: cr.isActive, createdAt: cr.createdAt } });
});

router.patch("/:crId/status", async (req: Request, res: Response) => {
  const cr = await User.findOneAndUpdate({ _id: req.params.crId, role: "CR", city: req.auth!.userId }, [{ $set: { isActive: { $not: "$isActive" } } }], { new: true });
  if (!cr) throw new AppError(404, "CR not found.");
  res.json({ cr: { _id: cr._id, name: cr.name, isActive: cr.isActive } });
});

const updateCR = z.object({ body: z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(200).transform((v) => v.toLowerCase()).optional(),
  phone: phoneNumber.optional(),
  city: z.string().trim().min(1).max(100).optional(),
  password: nonBlankPassword.optional(),
}).refine((x) => Object.keys(x).length > 0) });

router.patch("/:crId", validate(updateCR), async (req: Request, res: Response) => {
  const cr = await User.findOne({ _id: req.params.crId, role: "CR", city: req.auth!.userId });
  if (!cr) throw new AppError(404, "CR not found.");
  const update: Record<string, unknown> = {};
  if (req.body.name) update.name = req.body.name;
  if (req.body.email) {
    if (req.body.email !== cr.email && await User.exists({ email: req.body.email })) throw new AppError(409, "Email already in use.");
    update.email = req.body.email;
  }
  if (req.body.phone) update.phone = req.body.phone;
  if (req.body.city !== undefined) update.city = req.body.city;
  if (req.body.password) update.passwordHash = await bcrypt.hash(req.body.password, 12);
  const updated = await User.findByIdAndUpdate(cr._id, update, { new: true, runValidators: true });
  res.json({ cr: { _id: updated!._id, name: updated!.name, email: updated!.email, phone: updated!.phone, city: updated!.city, isActive: updated!.isActive } });
});

router.delete("/:crId", async (req: Request, res: Response) => {
  const cr = await User.findOneAndDelete({ _id: req.params.crId, role: "CR", city: req.auth!.userId });
  if (!cr) throw new AppError(404, "CR not found.");
  res.status(204).end();
});

export default router;
