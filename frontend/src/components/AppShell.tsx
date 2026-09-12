import { CalendarCheck, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin overview", icon: ShieldCheck }] : user?.role === "CR" ? [
    { to: "/cr", label: "Today's Attendance", icon: CalendarCheck },
  ] : [
    { to: "/dashboard", label: "My classes", icon: LayoutDashboard }, { to: "/attendance", label: "Attendance", icon: CalendarCheck }, { to: "/cr-manage", label: "Manage CR", icon: Users },
  ];
  return <div className="shell">
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><img src="/logo.png" alt="Adeeb logo" /><div><strong>Adeeb</strong><span>Attendance System</span></div></div>
      <button className="close-nav" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><Icon size={19} />{label}</NavLink>)}</nav>
      <div className="sidebar-user"><div className="avatar">{user?.name.slice(0, 1).toUpperCase()}</div><div><strong>{user?.name}</strong><span>{user?.role === "ADMIN" ? "Administrator" : user?.role === "CR" ? "Class Representative" : `${user?.designation || "Teacher"}${user?.city ? ` • ${user.city}` : ""}`}</span></div></div>
      <button className="logout" onClick={async () => { await logout(); navigate("/auth"); }}><LogOut size={18} /> Sign out</button>
    </aside>
    {open && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <main className="main"><header className="mobile-header"><button onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><span>Adeeb Attendance</span></header><Outlet /></main>
  </div>;
}
