import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, XCircle, Clock, BookMarked } from "lucide-react";
import { API_BASE } from "../api";

export default function Verify() {
  const { certId } = useParams();
  const [result, setResult] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/certificates/verify/${certId}`).then(({ data }) => setResult(data));
  }, [certId]);

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="flex items-center gap-2 text-brass-400 font-display mb-8 justify-center">
        <BookMarked size={20} />
        <span className="tracking-tight">course-ai / platform</span>
      </div>

      {!result ? (
        <p className="text-center text-paper-400 font-display text-sm">checking…</p>
      ) : (
        <div className="text-center rounded-xl border border-ink-700 bg-ink-900/70 p-8">
          {result.valid ? (
            <CheckCircle2 className="mx-auto text-teal-400 mb-3" size={44} />
          ) : result.status === "pending" ? (
            <Clock className="mx-auto text-brass-400 mb-3" size={44} />
          ) : (
            <XCircle className="mx-auto text-rust-400 mb-3" size={44} />
          )}
          <h1 className="font-display text-lg text-paper-100 mb-1">
            {result.valid ? "Certificate Valid"
              : result.status === "not_found" ? "Certificate Not Found"
              : `Certificate ${result.status}`}
          </h1>
          {result.recipient && <p className="text-paper-300 text-sm">{result.recipient} · {result.course}</p>}
          {result.issued_at && (
            <p className="text-paper-600 text-xs mt-1">Issued {new Date(result.issued_at).toLocaleDateString()}</p>
          )}
          {result.revoked_reason && <p className="text-rust-400 text-sm mt-2">{result.revoked_reason}</p>}
        </div>
      )}
    </div>
  );
}
