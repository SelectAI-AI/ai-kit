import React from "react";
import { useDemoMode } from "../context/DemoModeContext";
import { useAuth } from "../context/AuthContext";

export default function DemoBanner() {
  const { demoMode } = useDemoMode();
  const { user } = useAuth();

  if (!demoMode || !user) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-amber-400 text-amber-950 text-sm font-medium text-center py-2 px-4"
    >
      Demo Mode — All content unlocked for showcase purposes
    </div>
  );
}
