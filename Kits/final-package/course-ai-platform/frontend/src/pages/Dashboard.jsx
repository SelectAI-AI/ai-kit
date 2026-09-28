import { useEffect, useState } from "react";
import api from "../api";
import ModuleCard from "../components/ModuleCard";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/AuthContext";
import { Sparkles } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/progress/me")
      .then(({ data }) => setOverview(data))
      .catch(() => setError("Could not reach the backend. Is uvicorn running, and is CONTENT_ROOT set in backend/.env?"));
  }, []);

  return (
    <div>
      <h1 className="font-display text-xl text-paper-100 mb-1">
        Welcome back, {user?.full_name?.split(" ")[0]}
      </h1>
      <p className="text-paper-400 text-sm mb-8">Pick up where you left off.</p>

      {error && <p className="text-rust-400 text-sm">{error}</p>}

      {overview && (
        <div className="mb-10 rounded-xl border border-ink-700 bg-ink-900/70 p-5">
          <div className="flex justify-between text-sm mb-2 font-display">
            <span className="text-paper-400">overall progress</span>
            <span className="text-paper-100">{overview.overall_percent}%</span>
          </div>
          <ProgressBar percent={overview.overall_percent} height="h-2" />
          {overview.eligible_for_certificate && (
            <p className="flex items-center gap-1.5 text-teal-400 text-sm mt-3 font-display">
              <Sparkles size={14} /> all modules complete — request your certificate
            </p>
          )}
        </div>
      )}

      {overview && overview.modules.length > 0 && (
        <div className="relative pl-9">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-ink-700" aria-hidden="true" />
          {overview.modules.map((mod, i) => {
            const state = mod.percent_complete === 100 ? "done" : mod.percent_complete > 0 ? "active" : "idle";
            return (
              <div key={mod.slug} className="relative mb-4 last:mb-0">
                <div
                  className={`absolute -left-9 top-3 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-display
                    ${state === "done" ? "bg-teal-500/15 border-teal-500 text-teal-400"
                      : state === "active" ? "bg-brass-500/15 border-brass-500 text-brass-400"
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
        <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center">
          <p className="text-paper-400 text-sm">
            No modules found under <code className="text-brass-400 font-display">CONTENT_ROOT</code>.
            Point it at your course folder in <code className="text-brass-400 font-display">backend/.env</code> and restart uvicorn.
          </p>
        </div>
      )}
    </div>
  );
}
