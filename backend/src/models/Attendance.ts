import { Schema, model } from "mongoose";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE";

const attendanceSchema = new Schema({
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ["PRESENT", "ABSENT", "LEAVE"], required: true },
  classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true, index: true },
}, { timestamps: true });

attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ classId: 1, date: 1 });
export const Attendance = model("Attendance", attendanceSchema);
