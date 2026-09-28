import { useEffect, useState } from "react";
import api from "../api";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export default function Instructor() {
  const [students, setStudents] = useState([]);
  const [pending, setPending] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  const load = () => {
    api.get("/api/instructor/students").then(({ data }) => setStudents(data));
    api.get("/api/instructor/certificates/pending").then(({ data }) => setPending(data));
    api.get("/api/instructor/submissions/pending").then(({ data }) => setSubmissions(data));
  };

  useEffect(load, []);

  const approve = async (id) => {
    await api.post(`/api/instructor/certificates/${id}/approve`);
    load();
  };

  const revoke = async (id) => {
    const reason = window.prompt("Reason for rejecting?") || "";
    await api.post(`/api/instructor/certificates/${id}/revoke`, null, { params: { reason } });
    load();
  };

  const approveSubmission = async (progressId) => {
    await api.post(`/api/instructor/submissions/${progressId}/approve`);
    load();
  };

  const rejectSubmission = async (progressId) => {
    const note = window.prompt("Reason for rejecting? (shown to the student)") || "";
    await api.post(`/api/instructor/submissions/${progressId}/reject`, { note });
    load();
  };

  return (
    <div>
      <h1 className="font-display text-xl text-paper-100 mb-8 flex items-center gap-2">
        <ShieldCheck className="text-brass-400" size={20} /> Instructor
      </h1>

      <section className="mb-10">
        <h2 className="font-display text-sm text-paper-400 mb-3 uppercase tracking-wide">Pending notebook submissions</h2>
        {submissions.length === 0 && <p className="text-paper-600 text-sm">Nothing pending.</p>}
        <div className="space-y-2">
          {submissions.map((s) => (
            <div key={s.progress_id} className="rounded-lg border border-ink-700 bg-ink-900/70 px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-paper-100">
                    {s.user_name} <span className="text-paper-600">({s.user_email})</span>
                  </p>
                  <p className="text-xs text-paper-600 mt-0.5">{s.module_title} — {s.notebook_title}</p>
                  <p className="text-sm text-paper-300 mt-2 whitespace-pre-wrap">{s.submission_text}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => approveSubmission(s.progress_id)} className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-display transition-colors">
                    <CheckCircle2 size={15} /> approve
                  </button>
                  <button onClick={() => rejectSubmission(s.progress_id)} className="flex items-center gap-1 text-rust-400 hover:text-rust-300 text-xs font-display transition-colors">
                    <XCircle size={15} /> reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-sm text-paper-400 mb-3 uppercase tracking-wide">Pending certificate requests</h2>
        {pending.length === 0 && <p className="text-paper-600 text-sm">Nothing pending.</p>}
        <div className="space-y-2">
          {pending.map((p) => (
            <div key={p.id} className="rounded-lg border border-ink-700 bg-ink-900/70 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-paper-100">
                {p.user_name} <span className="text-paper-600">({p.user_email})</span>
              </span>
              <div className="flex gap-3">
                <button onClick={() => approve(p.id)} className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-xs font-display transition-colors">
                  <CheckCircle2 size={15} /> approve
                </button>
                <button onClick={() => revoke(p.id)} className="flex items-center gap-1 text-rust-400 hover:text-rust-300 text-xs font-display transition-colors">
                  <XCircle size={15} /> reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-sm text-paper-400 mb-3 uppercase tracking-wide">Students</h2>
        <div className="rounded-lg border border-ink-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-paper-600 text-left bg-ink-900/70 font-display text-xs uppercase">
              <tr>
                <th className="py-2.5 px-4 font-medium">Name</th>
                <th className="py-2.5 px-4 font-medium">Email</th>
                <th className="py-2.5 px-4 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-t border-ink-800">
                  <td className="py-2.5 px-4 text-paper-100">{s.full_name}</td>
                  <td className="py-2.5 px-4 text-paper-400">{s.email}</td>
                  <td className="py-2.5 px-4 text-paper-300 font-display">{s.overall_percent}%</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={3} className="py-4 px-4 text-paper-600 text-center">No students registered yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
