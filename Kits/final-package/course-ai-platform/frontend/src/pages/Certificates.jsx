import { useEffect, useState } from "react";
import api from "../api";
import { downloadFile } from "../download";
import { Award, Download, Clock, ShieldOff } from "lucide-react";

export default function Certificates() {
  const [certs, setCerts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [legalName, setLegalName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/api/certificates/me").then(({ data }) => setCerts(data));
    api.get("/api/progress/me").then(({ data }) => setOverview(data));
  };

  useEffect(load, []);

  const requestCert = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.post("/api/certificates/request", { confirm_identity: confirm, legal_name: legalName });
      setMsg("Requested. It may need instructor approval before the PDF is issued.");
      load();
    } catch (err) {
      setMsg(err?.response?.data?.detail || "Could not request a certificate.");
    } finally {
      setBusy(false);
    }
  };

  const activeCerts = certs.filter((c) => c.status !== "revoked");
  const hasActive = activeCerts.length > 0;

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-xl text-paper-100 mb-8 flex items-center gap-2">
        <Award className="text-brass-400" size={20} /> Certificate
      </h1>

      {!hasActive && (
        <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-6 mb-6">
          {overview?.eligible_for_certificate ? (
            <>
              <p className="text-paper-300 text-sm mb-4">
                Every module is complete. Confirm your identity to request your certificate.
              </p>
              <input
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-brass-500"
                placeholder="Full legal name for the certificate" value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-paper-300 mb-4">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="accent-brass-500" />
                I confirm this submission is really me.
              </label>
              <button
                onClick={requestCert} disabled={busy || !confirm || !legalName}
                className="bg-brass-600 hover:bg-brass-500 text-ink-950 font-display font-medium text-sm rounded-lg px-4 py-2 disabled:opacity-50 transition-colors"
              >
                {busy ? "submitting…" : "request certificate"}
              </button>
            </>
          ) : (
            <p className="text-paper-400 text-sm">Complete every module to unlock certificate requests.</p>
          )}
          {msg && <p className="text-sm text-brass-300 mt-3">{msg}</p>}
        </div>
      )}

      <div className="space-y-3">
        {certs.map((c) => (
          <div key={c.id} className="rounded-xl border border-ink-700 bg-ink-900/70 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {c.status === "issued" && <Award className="text-teal-400" size={18} />}
              {c.status === "pending" && <Clock className="text-brass-400" size={18} />}
              {c.status === "revoked" && <ShieldOff className="text-rust-400" size={18} />}
              <div>
                <p className="font-display text-sm text-paper-100 capitalize">{c.status}</p>
                <p className="text-xs text-paper-600">ID {c.id.slice(0, 8)}</p>
                {c.issued_at && <p className="text-xs text-paper-600">Issued {new Date(c.issued_at).toLocaleDateString()}</p>}
                {c.revoked_reason && <p className="text-xs text-rust-400">{c.revoked_reason}</p>}
              </div>
            </div>
            {c.status === "issued" && (
              <button
                onClick={() => downloadFile(`/api/certificates/${c.id}/pdf`, `certificate-${c.id}.pdf`)}
                className="flex items-center gap-1 text-brass-400 hover:text-brass-300 text-xs font-display transition-colors"
              >
                <Download size={14} /> download pdf
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
