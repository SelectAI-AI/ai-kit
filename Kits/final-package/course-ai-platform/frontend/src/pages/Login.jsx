import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookMarked, GitBranch, ShieldCheck, Sparkles } from "lucide-react";

const highlights = [
  { icon: GitBranch, label: "Progressive unlocks", desc: "Finish a notebook, open the next." },
  { icon: ShieldCheck, label: "Verified certificates", desc: "QR-signed, publicly verifiable." },
  { icon: Sparkles, label: "Seven AI modules", desc: "From fundamentals to agents and ops." },
];

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
      setError(err?.response?.data?.detail || "Login failed. Check your email and password, then try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[70vh] mt-4">
      {/* Brand / value panel — hidden on small screens to keep the form front and center. */}
      <section className="hidden lg:block relative">
        <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-brass-500/20 blur-3xl animate-drift" aria-hidden="true" />
        <div className="absolute right-6 top-32 h-40 w-40 rounded-full bg-teal-500/15 blur-3xl animate-drift" style={{ animationDelay: "2s" }} aria-hidden="true" />
        <p className="relative font-display text-xs uppercase tracking-[0.22em] text-teal-400 mb-5">
          Course AI Platform
        </p>
        <h2 className="relative font-display text-4xl leading-tight tracking-tight text-paper-100 text-pretty">
          Learn AI by <span className="text-gradient">building</span>, one unlock at a time.
        </h2>
        <p className="relative text-paper-400 mt-4 max-w-md leading-relaxed">
          A self-paced path through seven hands-on modules. Clear a notebook to open the next, and earn a verifiable certificate at the finish.
        </p>
        <ul className="relative mt-8 space-y-4">
          {highlights.map(({ icon: Icon, label, desc }) => (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-ink-800/60 text-teal-400">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-display text-sm text-paper-100">{label}</span>
                <span className="block text-sm text-paper-400">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sign-in card */}
      <section className="w-full max-w-sm mx-auto lg:mx-0">
        <div className="glass rounded-2xl p-7">
          <div className="flex items-center gap-2.5 font-display mb-7">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brass-500 to-teal-500 text-ink-950 shadow-[0_0_18px_rgba(227,17,155,0.5)]">
              <BookMarked size={17} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="tracking-tight">
              <span className="text-gradient font-semibold">course-ai</span>
              <span className="text-paper-600"> / platform</span>
            </span>
          </div>

          <h1 className="text-xl font-display text-paper-100 mb-1">Sign in</h1>
          <p className="text-sm text-paper-400 mb-6">Welcome back. Pick up where you left off.</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-display uppercase tracking-wide text-paper-400">
                Email
              </label>
              <input
                id="login-email"
                className="w-full bg-ink-950/60 border border-ink-700 rounded-lg px-3 py-2.5 text-sm text-paper-100 placeholder:text-paper-600 focus:outline-none focus:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-400/40 transition-colors"
                type="email"
                name="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-display uppercase tracking-wide text-paper-400">
                Password
              </label>
              <input
                id="login-password"
                className="w-full bg-ink-950/60 border border-ink-700 rounded-lg px-3 py-2.5 text-sm text-paper-100 placeholder:text-paper-600 focus:outline-none focus:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-400/40 transition-colors"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <p aria-live="polite" className="min-h-[1.25rem] text-sm text-rust-400">
              {error}
            </p>

            <button
              disabled={busy}
              className="w-full rounded-lg bg-gradient-to-r from-brass-500 to-brass-600 py-2.5 font-display font-medium text-sm text-ink-950 shadow-[0_0_22px_rgba(227,17,155,0.35)] transition-[transform,box-shadow,opacity] hover:shadow-[0_0_30px_rgba(227,17,155,0.5)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-sm text-paper-400 mt-6 text-center">
            No account?{" "}
            <Link to="/register" className="text-teal-400 hover:text-teal-500 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
