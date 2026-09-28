import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import ProgressBar from "./ProgressBar";

export default function ModuleCard({ mod }) {
  const done = mod.percent_complete === 100;

  return (
    <Link
      to={`/modules/${mod.slug}`}
      className="block rounded-lg border border-ink-700 bg-ink-900/70 px-5 py-4 hover:border-brass-600/60 transition-colors group"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display font-medium text-[15px] text-paper-100 group-hover:text-brass-300 transition-colors truncate">
            {mod.title}
          </h3>
          <p className="text-xs text-paper-600 mt-0.5">
            {mod.completed_notebooks} / {mod.total_notebooks} notebooks
            {done && <span className="text-teal-400"> · complete</span>}
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-paper-600 group-hover:text-brass-400 transition-colors" />
      </div>
      <div className="mt-3">
        <ProgressBar percent={mod.percent_complete} />
      </div>
    </Link>
  );
}
