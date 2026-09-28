import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookMarked, LogOut, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-ink-700 bg-ink-950/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 font-display font-semibold text-[15px] tracking-tight text-brass-400">
          <BookMarked size={19} strokeWidth={2} />
          course-ai <span className="text-paper-600 font-normal">/ platform</span>
        </Link>

        {user && (
          <nav className="flex items-center gap-6 text-sm font-display">
            <Link to="/" className="text-paper-300 hover:text-paper-100 transition-colors">dashboard</Link>
            <Link to="/certificates" className="text-paper-300 hover:text-paper-100 transition-colors">certificate</Link>
            {user.role === "instructor" && (
              <Link to="/instructor" className="flex items-center gap-1 text-brass-400 hover:text-brass-300 transition-colors">
                <ShieldCheck size={14} /> instructor
              </Link>
            )}
            <span className="h-4 w-px bg-ink-700" />
            <span className="text-paper-600">{user.full_name}</span>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              aria-label="Sign out"
              className="text-paper-600 hover:text-rust-400 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
