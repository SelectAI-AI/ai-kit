// A signed-out visitor who opens a private page goes to the login page, and the
// login page knows where to send them back to.

import React from "react"; // eslint-disable-line no-unused-vars
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockAuth } = vi.hoisted(() => ({ mockAuth: { user: null, loading: false } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => mockAuth }));

import PrivateRoute from "./PrivateRoute.jsx";

function LoginProbe() {
  const location = useLocation();
  return <div data-testid="login-page">login from={location.state?.from}</div>;
}

function renderAt(path, props = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/" element={<div>Home</div>} />
        <Route
          path="/modules/:slug"
          element={
            <PrivateRoute {...props}>
              <div>Secret module</div>
            </PrivateRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("PrivateRoute", () => {
  beforeEach(() => {
    mockAuth.user = null;
    mockAuth.loading = false;
  });

  it("sends a signed-out visitor to the login page, remembering the address", () => {
    renderAt("/modules/MCP?tab=1");
    expect(screen.getByTestId("login-page")).toHaveTextContent("from=/modules/MCP?tab=1");
    expect(screen.queryByText("Secret module")).not.toBeInTheDocument();
  });

  it("shows the page to a signed-in user", () => {
    mockAuth.user = { id: "u1", role: "student" };
    renderAt("/modules/MCP");
    expect(screen.getByText("Secret module")).toBeInTheDocument();
  });

  it("waits while the sign-in is being checked instead of redirecting", () => {
    mockAuth.loading = true;
    renderAt("/modules/MCP");
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("keeps a student out of instructor-only pages", () => {
    mockAuth.user = { id: "u1", role: "student" };
    renderAt("/modules/MCP", { instructorOnly: true });
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Secret module")).not.toBeInTheDocument();
  });

  it("lets an instructor into instructor-only pages", () => {
    mockAuth.user = { id: "i1", role: "instructor" };
    renderAt("/modules/MCP", { instructorOnly: true });
    expect(screen.getByText("Secret module")).toBeInTheDocument();
  });
});
