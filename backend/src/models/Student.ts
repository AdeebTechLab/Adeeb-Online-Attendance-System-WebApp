import { Schema, model } from "mongoose";

const studentSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  rollNumber: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, trim: true, lowercase: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  guardianName: { type: String, trim: true, maxlength: 100 },
  guardianPhone: { type: String, trim: true, maxlength: 30 },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
}, { timestamps: true });

studentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true });
export const Student = model("Student", studentSchema);
