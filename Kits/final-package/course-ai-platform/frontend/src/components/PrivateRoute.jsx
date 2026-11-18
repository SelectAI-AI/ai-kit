import React from "react"; // eslint-disable-line no-unused-vars
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children, instructorOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-paper-400 font-display text-sm">loading…</div>;
  // Signed out: go to the login page and remember where to come back to.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (instructorOnly && user.role !== "instructor") return <Navigate to="/" replace />;

  return children;
}
