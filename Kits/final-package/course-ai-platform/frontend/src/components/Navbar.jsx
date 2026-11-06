import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GraduationCap, LogOut, ShieldCheck, Users } from "lucide-react";
import BrandLogo from "./BrandLogo";

const navLink =
  "text-paper-300 hover:text-paper-100 transition-colors rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-ink-700 bg-white/85 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link
          to="/"
          aria-label="selectAi home"
          className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/70"
        >
          <BrandLogo className="h-9" />
        </Link>

        <nav className="flex items-center gap-6 text-sm font-display">
          {/* The pricing page is public (Req 11.1) — surfaced to everyone, signed in or not. */}
          <Link to="/pricing" className={`flex items-center gap-1 ${navLink}`}>
            <GraduationCap size={14} aria-hidden="true" /> enroll
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
