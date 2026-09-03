export function publicUser(user: any) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    city: user.city || "",
    institutionName: user.institutionName || "",
    designation: user.designation || user.department || "",
    role: user.role,
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
  };
}
