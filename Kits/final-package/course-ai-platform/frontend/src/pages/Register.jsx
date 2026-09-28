import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookMarked } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", instructor_code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.detail || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-20">
      <div className="flex items-center gap-2 text-brass-400 font-display mb-8 justify-center">
        <BookMarked size={20} />
        <span className="tracking-tight">course-ai / platform</span>
      </div>
      <h1 className="text-lg font-display text-paper-100 mb-6">Create your account</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass-500 transition-colors"
          placeholder="Full name" value={form.full_name} onChange={update("full_name")} required
        />
        <input
          className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass-500 transition-colors"
          type="email" placeholder="Email" value={form.email} onChange={update("email")} required
        />
        <input
          className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass-500 transition-colors"
          type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={update("password")}
          required minLength={6}
        />
        <input
          className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass-500 transition-colors"
          placeholder="Instructor code (optional)" value={form.instructor_code} onChange={update("instructor_code")}
        />
        {error && <p className="text-rust-400 text-sm">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-brass-600 hover:bg-brass-500 text-ink-950 transition-colors rounded-lg py-2.5 font-display font-medium text-sm disabled:opacity-50"
        >
          {busy ? "creating…" : "create account"}
        </button>
      </form>
      <p className="text-sm text-paper-600 mt-5 text-center">
        Already have an account? <Link to="/login" className="text-brass-400 hover:text-brass-300">Sign in</Link>
      </p>
    </div>
  );
}
