import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleDashed, Loader } from "lucide-react";
import ProgressBar from "./ProgressBar";

export default function ModuleCard({ mod }) {
  const done = mod.percent_complete === 100;
  const started = mod.percent_complete > 0 && !done;

  const status = done
    ? { Icon: CheckCircle2, label: "Complete", cls: "text-teal-400" }
    : started
      ? { Icon: Loader, label: "In progress", cls: "text-brass-400" }
      : { Icon: CircleDashed, label: "Not started", cls: "text-paper-600" };

  return (
    <Link
      to={`/modules/${mod.slug}`}
      className="group relative block overflow-hidden rounded-xl border border-white/6 bg-ink-900/60 px-5 py-4 transition-all duration-300 hover:border-brass-500/40 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60"
    >
      {/* Spotlight glow that fades in on hover — purely decorative. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brass-500/0 blur-2xl transition-colors duration-500 group-hover:bg-brass-500/20"
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display font-medium text-[15px] text-paper-100 group-hover:text-brass-300 transition-colors truncate">
            {mod.title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-paper-400">
            <status.Icon size={13} className={status.cls} aria-hidden="true" />
            <span className={status.cls}>{status.label}</span>
            <span className="text-paper-600">·</span>
            <span>{mod.completed_notebooks} / {mod.total_notebooks} notebooks</span>
          </p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-ink-800/60 text-paper-400 transition-all group-hover:border-brass-500/50 group-hover:text-brass-400 group-hover:translate-x-0.5">
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="relative mt-3.5 flex items-center gap-3">
        <ProgressBar percent={mod.percent_complete} />
        <span className="font-display text-xs text-paper-400 tabular-nums w-9 text-right">
          {mod.percent_complete}%
        </span>
      </div>
    </Link>
  );
}
