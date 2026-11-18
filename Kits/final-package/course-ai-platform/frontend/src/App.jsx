import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { DemoModeProvider } from "./context/DemoModeContext";
import DemoBanner from "./components/DemoBanner";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import SecurityBanner from "./components/SecurityBanner";
import { useScreenCaptureGuard } from "./hooks/useScreenCaptureGuard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ModuleDetail from "./pages/ModuleDetail";
import Certificates from "./pages/Certificates";
import Verify from "./pages/Verify";
import Instructor from "./pages/Instructor";
import AdminOrders from "./pages/AdminOrders";
import Pricing from "./pages/Pricing";
import KitRedirect from "./pages/KitRedirect";

export default function App() {
  // Screen_Capture_Guard drives a full-app blur while the window is inactive.
  // The hook does not depend on the auth/demo contexts, so it runs at the top
  // of the component body (Req 3.5, 3.7).
  const blurred = useScreenCaptureGuard();

  return (
    <DemoModeProvider>
      <AuthProvider>
        {/* SecurityBanner is mounted exactly once here, outside <Routes> so it
            persists across route transitions (Req 7.1, 7.2), and outside the
            blurred region so the notice stays legible (Req 3.5). */}
        <SecurityBanner />
        <div
          className={`min-h-screen text-paper-100 transition-[filter] duration-200 ${
            blurred ? "blur-xl" : ""
          }`}
        >
          <DemoBanner />
          <Navbar />
          <main className="max-w-5xl mx-auto px-5 py-10 animate-rise">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify/:certId" element={<Verify />} />
              {/* Pricing is public so visitors can see cost before purchasing (Req 11.1). */}
              <Route path="/pricing" element={<Pricing />} />
              {/* The marketing site links here: /kits (Enroll Now) and /kits/<slug> (Explore Kit). */}
              <Route path="/kits" element={<Navigate to="/pricing" replace />} />
              <Route path="/kits/:kitSlug" element={<KitRedirect />} />
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/modules/:slug" element={<PrivateRoute><ModuleDetail /></PrivateRoute>} />
              <Route path="/certificates" element={<PrivateRoute><Certificates /></PrivateRoute>} />
              <Route path="/instructor" element={<PrivateRoute instructorOnly><Instructor /></PrivateRoute>} />
              <Route path="/admin/orders" element={<PrivateRoute instructorOnly><AdminOrders /></PrivateRoute>} />
              {/* Any other address goes home (the login page when signed out) instead of a blank page. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </DemoModeProvider>
  );
}
