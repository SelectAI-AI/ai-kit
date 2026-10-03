import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import ModuleCard from "../components/ModuleCard";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, FolderSearch, Sparkles } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/progress/me")
      .then(({ data }) => setOverview(data))
      .catch(() => setError("Could not reach the backend. Is uvicorn running, and is CONTENT_ROOT set in backend/.env?"));
  }, []);

  const firstName = user?.full_name?.split(" ")[0];

  return (
    <div>
      {/* Hero header */}
      <header className="mb-10">
        <p className="font-display text-xs uppercase tracking-[0.22em] text-teal-400 mb-3">
          Your learning path
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight text-paper-100 text-pretty">
          Welcome back,{" "}
          <span className="text-gradient">{firstName || "learner"}</span>
        </h1>
        <p className="text-paper-400 mt-2">Pick up where you left off and keep the streak going.</p>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-rust-500/40 bg-rust-500/10 p-4 text-sm text-rust-400">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {overview && (
        <div className="relative mb-10 overflow-hidden rounded-2xl glass p-6">
          <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="relative flex items-end justify-between mb-3">
            <div>
              <p className="font-display text-xs uppercase tracking-wide text-paper-400">Overall progress</p>
              <p className="mt-1 font-display text-3xl text-paper-100 tabular-nums">
                {overview.overall_percent}
                <span className="text-paper-600 text-xl">%</span>
              </p>
            </div>
            {overview.eligible_for_certificate && (
              <Link
                to="/certificates"
                className="flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 font-display text-sm text-teal-400 transition-colors hover:bg-teal-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
              >
                <Sparkles size={14} aria-hidden="true" /> Request certificate
              </Link>
            )}
          </div>
          <ProgressBar percent={overview.overall_percent} height="h-2" />
        </div>
      )}

      {/* Loading skeleton matching the final layout */}
      {!overview && !error && (
        <div className="space-y-4" aria-hidden="true">
          <div className="h-28 rounded-2xl bg-ink-900/60 animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-ink-900/40 animate-pulse" />
          ))}
        </div>
      )}

      {overview && overview.modules.length > 0 && (
        <div className="relative pl-9">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-brass-500/40 via-ink-700 to-teal-500/40" aria-hidden="true" />
          {overview.modules.map((mod, i) => {
            const state = mod.percent_complete === 100 ? "done" : mod.percent_complete > 0 ? "active" : "idle";
            return (
              <div key={mod.slug} className="relative mb-4 last:mb-0">
                <div
                  className={`absolute -left-9 top-4 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-display z-10
                    ${state === "done" ? "bg-teal-500/15 border-teal-500 text-teal-400 shadow-[0_0_12px_rgba(46,197,211,0.4)]"
                      : state === "active" ? "bg-brass-500/15 border-brass-500 text-brass-400 shadow-[0_0_12px_rgba(227,17,155,0.4)]"
                      : "bg-ink-800 border-ink-700 text-paper-600"}`}
                >
                  {i + 1}
                </div>
                <ModuleCard mod={mod} />
              </div>
            );
          })}
        </div>
      )}

      {overview && overview.modules.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink-700 p-10 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/8 bg-ink-800/60 text-paper-400">
            <FolderSearch size={22} aria-hidden="true" />
          </span>
          <p className="font-display text-paper-100 mb-1">No modules found</p>
          <p className="text-paper-400 text-sm max-w-md mx-auto">
            Point <code className="text-brass-400 font-display">CONTENT_ROOT</code> at your course folder in{" "}
            <code className="text-brass-400 font-display">backend/.env</code> and restart uvicorn.
          </p>
        </div>
      )}
    </div>
  );
}
