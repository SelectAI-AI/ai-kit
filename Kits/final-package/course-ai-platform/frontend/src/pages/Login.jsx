import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookMarked } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
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
      <h1 className="text-lg font-display text-paper-100 mb-6">Sign in</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass-500 transition-colors"
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-brass-500 transition-colors"
          type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
        />
        {error && <p className="text-rust-400 text-sm">{error}</p>}
        <button
          disabled={busy}
          className="w-full bg-brass-600 hover:bg-brass-500 text-ink-950 transition-colors rounded-lg py-2.5 font-display font-medium text-sm disabled:opacity-50"
        >
          {busy ? "signing in…" : "sign in"}
        </button>
      </form>
      <p className="text-sm text-paper-600 mt-5 text-center">
        No account? <Link to="/register" className="text-brass-400 hover:text-brass-300">Register</Link>
      </p>
    </div>
  );
}
