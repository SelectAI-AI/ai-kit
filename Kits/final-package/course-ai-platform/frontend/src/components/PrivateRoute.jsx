import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children, instructorOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-8 text-paper-400 font-display text-sm">loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (instructorOnly && user.role !== "instructor") return <Navigate to="/" replace />;

  return children;
}
