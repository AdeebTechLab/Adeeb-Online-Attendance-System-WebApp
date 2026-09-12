import { Schema, model } from "mongoose";

const subjectSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  section: { type: String, trim: true, maxlength: 50 },
  room: { type: String, trim: true, maxlength: 50 },
  periodNo: { type: String, trim: true, maxlength: 20 },
  academicYear: { type: String, trim: true, maxlength: 30 },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
}, { timestamps: true });

subjectSchema.index({ classId: 1, name: 1 }, { unique: true });
export const Subject = model("Subject", subjectSchema);
