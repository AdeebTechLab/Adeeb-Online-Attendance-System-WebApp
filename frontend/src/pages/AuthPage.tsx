import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { User } from "../types";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [show, setShow] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const { setUser } = useAuth(); const navigate = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError("");
    const form = new FormData(e.currentTarget); const body = Object.fromEntries(form.entries());
    if (typeof body.password !== "string" || body.password.trim().length === 0) { setError("Password cannot be blank."); setLoading(false); return; }
    try { const result = await api<{ user: User }>(`/auth/${mode}`, { method: "POST", body: JSON.stringify(body) }); setUser(result.user); navigate(result.user.role === "ADMIN" ? "/admin" : "/dashboard"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Could not complete your request."); } finally { setLoading(false); }
  }
  return <div className="auth-page">
    <section className="auth-story"><div className="story-content"><div className="brand auth-brand"><img src="/logo.png" alt="Adeeb Online Attendance System" /><div><strong>Adeeb</strong><span>Online Attendance System</span></div></div>
      <div className="story-copy"><span className="eyebrow light">Attendance, thoughtfully simplified</span><h1>More time teaching.<br />Less time ticking boxes.</h1><p>Manage your classes, record attendance for any date, and keep reliable reports in one calm workspace.</p>
      <ul><li><CheckCircle2 /> Your classes stay private to your account</li><li><CheckCircle2 /> Correct past attendance whenever needed</li><li><CheckCircle2 /> Download clean, ready-to-share PDF reports</li></ul></div>
      <small>Secure • Focused • Built for educators</small></div>
    </section>
    <section className="auth-form-wrap"><div className="auth-form-card"><span className="eyebrow">{mode === "login" ? "Welcome back" : "Join Adeeb Attendance"}</span><h2>{mode === "login" ? "Sign in to your account" : "Create your teacher account"}</h2><p>{mode === "login" ? "Enter your details to continue to your workspace." : "Set up your workspace in less than a minute."}</p>
      <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create account</button></div>
      <form onSubmit={submit}>
        {mode === "signup" && <><label>Full name<input name="name" required minLength={2} placeholder="e.g. Salman Adeeb" autoComplete="name" /></label><div className="form-row"><label>Designation<input name="designation" placeholder="e.g. Teacher or CR" /></label><label>Phone<input name="phone" type="tel" required minLength={7} maxLength={30} pattern="(?=(?:[^0-9]*[0-9]){7,15}[^0-9]*$)[+0-9() .-]{7,30}" title="Enter a valid phone number containing 7 to 15 digits" placeholder="e.g. +92 300 1234567" autoComplete="tel" /></label></div><div className="form-row"><label>City<input name="city" required minLength={2} maxLength={100} placeholder="e.g. Bahawalpur" autoComplete="address-level2" /></label><label>Institution Name<input name="institutionName" required minLength={2} maxLength={200} placeholder="e.g. Adeeb Public School" autoComplete="organization" /></label></div></>}
        <label>Email address<input name="email" type="email" required placeholder="you@school.edu" autoComplete="email" /></label>
        <label>Password<div className="password-field"><input name="password" type={show ? "text" : "password"} required placeholder={mode === "signup" ? "Enter any non-blank password" : "Your password"} autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff /> : <Eye />}</button></div></label>
        {error && <div className="form-error">{error}</div>}<button className="btn primary full" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={18} /></button>
      </form></div>
    </section>
  </div>;
}
