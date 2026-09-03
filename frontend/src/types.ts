export type Role = "TEACHER" | "ADMIN";
export type User = { id: string; _id?: string; name: string; email: string; phone: string; city: string; institutionName: string; designation: string; role: Role; isActive?: boolean; createdAt: string; classCount?: number; studentCount?: number; classes?: ClassItem[] };
export type ClassItem = { _id: string; name: string; subject?: string; section?: string; room?: string; academicYear?: string; shift?: "MORNING" | "EVENING"; studentCount: number; createdAt: string };
export type Student = { _id: string; name: string; rollNumber: string; email?: string; phone?: string; guardianName?: string; guardianPhone?: string; attendance?: { status: AttendanceStatus } | null };
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE";
