import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookMarked, LogOut, ShieldCheck, Tag, Users } from "lucide-react";

const navLink =
  "text-paper-300 hover:text-paper-100 transition-colors rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-ink-950/70 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="group flex items-center gap-2.5 font-display font-semibold text-[15px] tracking-tight focus-visible:outline-none"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brass-500 to-teal-500 text-ink-950 shadow-[0_0_18px_rgba(227,17,155,0.5)] transition-transform group-hover:scale-105">
            <BookMarked size={16} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="text-gradient">course-ai</span>
          <span className="text-paper-600 font-normal">/ platform</span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-display">
          {/* Pricing is public (Req 11.1) — surfaced to everyone, signed in or not. */}
          <Link to="/pricing" className={`flex items-center gap-1 ${navLink}`}>
            <Tag size={14} aria-hidden="true" /> pricing
          </Link>

          {user && (
            <>
              <Link to="/" className={navLink}>dashboard</Link>
              <Link to="/certificates" className={navLink}>certificate</Link>
              {user.role === "instructor" && (
                <>
                  <Link to="/instructor" className="flex items-center gap-1 text-brass-400 hover:text-brass-300 transition-colors rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400/70">
                    <ShieldCheck size={14} aria-hidden="true" /> instructor
                  </Link>
                  <Link to="/admin/orders" className="flex items-center gap-1 text-brass-400 hover:text-brass-300 transition-colors rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400/70">
                    <Users size={14} aria-hidden="true" /> bulk orders
                  </Link>
                </>
              )}
              <span className="h-4 w-px bg-ink-700" />
              <span className="text-paper-400 max-w-[12ch] truncate" title={user.full_name}>
                {user.full_name}
              </span>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                aria-label="Sign out"
                className="text-paper-600 hover:text-rust-400 transition-colors rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust-400/70"
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
