import { Schema, model } from "mongoose";

const classSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  subject: { type: String, trim: true, maxlength: 100 },
  section: { type: String, trim: true, maxlength: 50 },
  room: { type: String, trim: true, maxlength: 50 },
  academicYear: { type: String, trim: true, maxlength: 30 },
  shift: { type: String, enum: ["MORNING", "EVENING"], default: "MORNING" },
  teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
}, { timestamps: true });

classSchema.index({ teacherId: 1, name: 1, section: 1 }, { unique: true });
export const ClassModel = model("Class", classSchema);
