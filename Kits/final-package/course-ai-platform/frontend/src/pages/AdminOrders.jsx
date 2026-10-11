import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import api from "../api";
import { Building2, GraduationCap, Users } from "lucide-react";

// Admin-only bulk order creation (Req 10.1, 10.4, 10.6). Instructors onboard
// organizations without the self-serve checkout flow by creating College or
// Corporate bulk orders against the admin endpoints:
//   POST /api/admin/orders/college    { user_ids }
//   POST /api/admin/orders/corporate  { user_ids, seats }
// Both are guarded server-side by `require_instructor`; this page is reached
// only via a <PrivateRoute instructorOnly> wrapper in App.jsx. On success each
// endpoint returns the granted entitlement(s) (Req 10.5), which we surface so
// the admin can confirm who was onboarded. All HTTP goes through the `api`
// axios singleton; styling is Tailwind utilities only.

/**
 * Parse a comma/newline-separated textarea value into a clean list of user ids.
 * Blank entries and surrounding whitespace are dropped.
 */
function parseUserIds(raw) {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Normalize an axios error into a human-readable message. */
function errorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail) return JSON.stringify(detail);
  return fallback;
}

/** Render the granted entitlements returned by a bulk endpoint. */
function GrantedList({ entitlements }) {
  const list = Array.isArray(entitlements) ? entitlements : [entitlements];
  if (list.length === 0) {
    return <p className="text-paper-600 text-sm">No entitlements were granted.</p>;
  }
  return (
    <div className="mt-3 rounded-lg border border-teal-500/30 bg-ink-900/70 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-paper-600 text-left bg-ink-900/70 font-display text-xs uppercase">
          <tr>
            <th className="py-2 px-3 font-medium">User</th>
            <th className="py-2 px-3 font-medium">Selection</th>
            <th className="py-2 px-3 font-medium">Modules</th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id} className="border-t border-ink-800">
              <td className="py-2 px-3 text-paper-100">{e.user_id}</td>
              <td className="py-2 px-3 text-paper-400 font-display">{e.selection}</td>
              <td className="py-2 px-3 text-paper-300">{e.slugs_csv}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminOrders() {
  // College section state
  const [collegeIds, setCollegeIds] = useState("");
  const [collegeResult, setCollegeResult] = useState(null);
  const [collegeError, setCollegeError] = useState("");
  const [collegeBusy, setCollegeBusy] = useState(false);

  // Corporate section state
  const [corpIds, setCorpIds] = useState("");
  const [corpSeats, setCorpSeats] = useState("");
  const [corpResult, setCorpResult] = useState(null);
  const [corpError, setCorpError] = useState("");
  const [corpBusy, setCorpBusy] = useState(false);

  const submitCollege = async (e) => {
    e.preventDefault();
    setCollegeError("");
    setCollegeResult(null);
    const userIds = parseUserIds(collegeIds);
    if (userIds.length === 0) {
      setCollegeError("Enter at least one user id.");
      return;
    }
    setCollegeBusy(true);
    try {
      const { data } = await api.post("/api/admin/orders/college", { user_ids: userIds });
      setCollegeResult(data);
    } catch (err) {
      setCollegeError(errorMessage(err, "Could not create the college order."));
    } finally {
      setCollegeBusy(false);
    }
  };

  const submitCorporate = async (e) => {
    e.preventDefault();
    setCorpError("");
    setCorpResult(null);
    const userIds = parseUserIds(corpIds);
    if (userIds.length === 0) {
      setCorpError("Enter at least one user id.");
      return;
    }
    const seats = corpSeats.trim() === "" ? undefined : Number.parseInt(corpSeats, 10);
    if (seats !== undefined && (!Number.isInteger(seats) || seats < 1)) {
      setCorpError("Seats must be a positive whole number.");
      return;
    }
    setCorpBusy(true);
    try {
      const body = { user_ids: userIds };
      if (seats !== undefined) body.seats = seats;
      const { data } = await api.post("/api/admin/orders/corporate", body);
      setCorpResult(data);
    } catch (err) {
      setCorpError(errorMessage(err, "Could not create the corporate order."));
    } finally {
      setCorpBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-xl text-paper-100 mb-1 flex items-center gap-2">
        <Users className="text-brass-400" size={20} /> Bulk orders
      </h1>
      <p className="text-paper-400 text-sm mb-8">
        Onboard colleges and corporates by granting entitlements to existing user accounts.
      </p>

      {/* College section (Req 10.1) */}
      <section className="mb-10">
        <h2 className="font-display text-sm text-paper-400 mb-3 uppercase tracking-wide flex items-center gap-1.5">
          <GraduationCap size={15} className="text-teal-400" /> College order
        </h2>
        <form onSubmit={submitCollege} className="rounded-xl border border-ink-700 bg-ink-900/70 p-5">
          <p className="text-paper-400 text-sm mb-3">
            Flat ₹4,999 covering all sellable kits. Up to 1000 users per order.
          </p>
          <label htmlFor="college-ids" className="block text-xs font-display text-paper-600 mb-1 uppercase tracking-wide">
            User ids (comma or newline separated)
          </label>
          <textarea
            id="college-ids"
            value={collegeIds}
            onChange={(ev) => setCollegeIds(ev.target.value)}
            rows={4}
            placeholder="user-id-1, user-id-2, …"
            className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper-100 placeholder:text-paper-700 focus:border-brass-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={collegeBusy}
            className="mt-3 rounded-lg bg-brass-500 px-4 py-2 text-sm font-display text-ink-950 hover:bg-brass-400 transition-colors disabled:opacity-50"
          >
            {collegeBusy ? "Creating…" : "Create college order"}
          </button>
          {collegeError && <p className="mt-3 text-rust-400 text-sm">{collegeError}</p>}
          {collegeResult && <GrantedList entitlements={collegeResult} />}
        </form>
      </section>

      {/* Corporate section (Req 10.4) */}
      <section>
        <h2 className="font-display text-sm text-paper-400 mb-3 uppercase tracking-wide flex items-center gap-1.5">
          <Building2 size={15} className="text-teal-400" /> Corporate order
        </h2>
        <form onSubmit={submitCorporate} className="rounded-xl border border-ink-700 bg-ink-900/70 p-5">
          <p className="text-paper-400 text-sm mb-3">
            ₹4,999 per kit seat. Leave seats blank to bill one seat per listed user.
          </p>
          <label htmlFor="corp-ids" className="block text-xs font-display text-paper-600 mb-1 uppercase tracking-wide">
            User ids (comma or newline separated)
          </label>
          <textarea
            id="corp-ids"
            value={corpIds}
            onChange={(ev) => setCorpIds(ev.target.value)}
            rows={4}
            placeholder="user-id-1, user-id-2, …"
            className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper-100 placeholder:text-paper-700 focus:border-brass-500 focus:outline-none"
          />
          <label htmlFor="corp-seats" className="block text-xs font-display text-paper-600 mt-3 mb-1 uppercase tracking-wide">
            Seats (optional)
          </label>
          <input
            id="corp-seats"
            type="number"
            min={1}
            value={corpSeats}
            onChange={(ev) => setCorpSeats(ev.target.value)}
            placeholder="e.g. 25"
            className="w-32 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper-100 placeholder:text-paper-700 focus:border-brass-500 focus:outline-none"
          />
          <div>
            <button
              type="submit"
              disabled={corpBusy}
              className="mt-3 rounded-lg bg-brass-500 px-4 py-2 text-sm font-display text-ink-950 hover:bg-brass-400 transition-colors disabled:opacity-50"
            >
              {corpBusy ? "Creating…" : "Create corporate order"}
            </button>
          </div>
          {corpError && <p className="mt-3 text-rust-400 text-sm">{corpError}</p>}
          {corpResult && <GrantedList entitlements={corpResult} />}
        </form>
      </section>
    </div>
  );
}
