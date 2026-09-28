import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../api";
import ProgressBar from "../components/ProgressBar";
import { showSecurityBanner } from "../lib/securityBanner";
import { Lock, Unlock, CheckCircle2, Eye, ArrowLeft, X } from "lucide-react";

// Standard "blocked" notices surfaced when a clipboard action is prevented
// inside the Notebook_Preview_Pane (Requirement 1.6).
const COPY_BLOCKED_MESSAGE = "Copying is disabled for protected course content.";
const CUT_BLOCKED_MESSAGE = "Cutting is disabled for protected course content.";
const PASTE_BLOCKED_MESSAGE = "Pasting is disabled inside protected course content.";
// Notice surfaced when the right-click context menu is blocked inside the
// Notebook_Preview_Pane (Requirement 2.4).
const CONTEXT_MENU_BLOCKED_MESSAGE = "The right-click menu is disabled for protected course content.";

// Non-selectable text style applied to the Notebook_Preview_Pane container so it
// cascades to 100% of its rendered content, including HTML injected via
// dangerouslySetInnerHTML. Vendor prefixes cover WebKit/Firefox/legacy engines
// (Requirement 2.1). Combined with Select-All prevention, selection gestures
// yield zero selected characters (Requirement 2.2).
const NO_SELECT_STYLE = {
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
  userSelect: "none",
};

/**
 * Prevent an event's default action first, then surface a single banner notice.
 * preventDefault runs BEFORE the dispatch and the dispatch is wrapped in
 * try/catch so a banner failure can never un-block the action (Requirement 1.7).
 * @param {Event} e
 * @param {string} message
 */
function blockAndNotify(e, message) {
  e.preventDefault();
  try {
    showSecurityBanner(message);
  } catch {
    // A banner dispatch failure must never un-block the copy/cut/paste action.
  }
}

export default function ModuleDetail() {
  const { slug } = useParams();
  const [mod, setMod] = useState(null);
  const [error, setError] = useState("");
  const [openNotebook, setOpenNotebook] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = () => {
    api.get(`/api/modules/${slug}`)
      .then(({ data }) => setMod(data))
      .catch(() => setError("Could not load this module."));
  };

  useEffect(load, [slug]);

  if (error) return <p className="text-rust-400 text-sm">{error}</p>;
  if (!mod) return <p className="text-paper-400 font-display text-sm">loading…</p>;

  return (
    <div>
      <Link to="/" className="flex items-center gap-1.5 text-paper-600 hover:text-paper-300 text-sm mb-4 transition-colors w-fit">
        <ArrowLeft size={14} /> dashboard
      </Link>

      <div className="mb-4">
        <h1 className="font-display text-xl text-paper-100">{mod.title}</h1>
      </div>

      <div className="mb-6"><ProgressBar percent={mod.percent_complete} /></div>

      <article className="prose prose-invert prose-sm max-w-none mb-8 rounded-xl border border-ink-700 bg-ink-900/70 p-6
                            prose-headings:font-display prose-headings:text-paper-100 prose-a:text-brass-400 prose-code:text-brass-300">
        <ReactMarkdown>{mod.intro_markdown}</ReactMarkdown>
      </article>

      <div className="relative pl-9">
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-ink-700" aria-hidden="true" />
        {mod.notebooks.map((nb, i) => (
          <div key={nb.filename} className="relative mb-3 last:mb-0">
            <div
              className={`absolute -left-9 top-3 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-display
                ${nb.completed ? "bg-teal-500/15 border-teal-500 text-teal-400"
                  : nb.unlocked ? "bg-brass-500/15 border-brass-500 text-brass-400"
                  : "bg-ink-800 border-ink-700 text-paper-600"}`}
            >
              {i + 1}
            </div>
            <NotebookRow
              slug={slug} nb={nb}
              open={openNotebook === nb.filename}
              onToggle={() => setOpenNotebook(openNotebook === nb.filename ? null : nb.filename)}
              onCompleted={load}
              preview={preview} setPreview={setPreview}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function NotebookRow({ slug, nb, open, onToggle, onCompleted, preview, setPreview }) {
  const [response, setResponse] = useState("");
  const [selfAttest, setSelfAttest] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const submit = async () => {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await api.post(`/api/modules/${slug}/notebook/${nb.filename}/complete`, {
        response, self_attest: selfAttest,
      });
      setMsg(data.message);
      if (data.success) onCompleted();
    } catch (err) {
      setMsg(err?.response?.data?.detail || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async () => {
    // On error, surface an error indication and preserve the previous state
    // (no partial render of notebook HTML) (Requirement 10.2).
    setPreviewError("");
    try {
      const { data } = await api.get(`/api/modules/${slug}/notebook/${nb.filename}/view`);
      setPreview({ filename: nb.filename, html: data });
    } catch {
      setPreviewError("Could not load this notebook preview.");
    }
  };

  // Block copy/cut/paste keyboard shortcuts inside the Notebook_Preview_Pane
  // (Requirements 1.1–1.4). Select-All is prevented so no content is selected
  // (Requirement 2.2). Comparisons are case-insensitive via e.key.toLowerCase().
  const handlePreviewKeyDown = (e) => {
    const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    if (ctrlOrMeta && key === "c") {
      blockAndNotify(e, COPY_BLOCKED_MESSAGE);
      return;
    }
    if (ctrlOrMeta && key === "x") {
      blockAndNotify(e, CUT_BLOCKED_MESSAGE);
      return;
    }
    if (ctrlOrMeta && key === "v") {
      blockAndNotify(e, PASTE_BLOCKED_MESSAGE);
      return;
    }
    // Shift+Insert is an alternate paste shortcut (Requirement 1.4).
    if (e.shiftKey && key === "insert") {
      blockAndNotify(e, PASTE_BLOCKED_MESSAGE);
      return;
    }
    // Select-All: prevent selection so downstream copy yields zero characters
    // (Requirement 2.2). No banner — this is not a clipboard action.
    if (ctrlOrMeta && key === "a") {
      e.preventDefault();
    }
  };

  const isPreviewing = preview?.filename === nb.filename;

  return (
    <div className={`rounded-lg border px-4 py-3.5 transition-colors
      ${nb.unlocked ? "border-ink-700 bg-ink-900/70" : "border-ink-800 bg-ink-950/40 opacity-60"}`}>
      <button onClick={onToggle} disabled={!nb.unlocked} className="w-full flex items-center justify-between text-left gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {nb.completed ? <CheckCircle2 className="text-teal-400 shrink-0" size={18} />
            : nb.unlocked ? <Unlock className="text-brass-400 shrink-0" size={18} />
            : <Lock className="text-paper-600 shrink-0" size={18} />}
          <div className="min-w-0">
            <p className="font-display text-sm text-paper-100 truncate">{nb.title}</p>
            <p className="text-xs text-paper-600 truncate">{nb.filename}</p>
          </div>
        </div>
      </button>

      {open && nb.unlocked && (
        <div className="mt-4 pl-[30px] space-y-3">
          <div className="flex gap-4 text-xs font-display">
            <button onClick={loadPreview} className="flex items-center gap-1 text-paper-300 hover:text-brass-300 transition-colors">
              <Eye size={13} /> preview
            </button>
          </div>

          {previewError && (
            <p role="alert" className="text-rust-400 text-xs">{previewError}</p>
          )}

          {isPreviewing && (
            <div className="relative">
              <button onClick={() => setPreview(null)} className="absolute -top-2 -right-2 z-10 bg-ink-800 border border-ink-700 rounded-full p-1 text-paper-400 hover:text-paper-100">
                <X size={13} />
              </button>
              <div
                tabIndex={0}
                onCopy={(e) => blockAndNotify(e, COPY_BLOCKED_MESSAGE)}
                onCut={(e) => blockAndNotify(e, CUT_BLOCKED_MESSAGE)}
                onPaste={(e) => blockAndNotify(e, PASTE_BLOCKED_MESSAGE)}
                onContextMenu={(e) => blockAndNotify(e, CONTEXT_MENU_BLOCKED_MESSAGE)}
                onKeyDown={handlePreviewKeyDown}
                style={NO_SELECT_STYLE}
                className="ledger-scroll max-h-96 overflow-auto rounded-lg border border-ink-700 bg-white text-slate-900 p-3 focus:outline-none select-none"
              >
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            </div>
          )}

          {!nb.completed && nb.status === "pending" && (
            <div className="rounded-lg border border-ink-700 p-3.5 bg-ink-950/50">
              <p className="text-sm text-paper-300">Submitted — waiting for instructor approval.</p>
            </div>
          )}

          {!nb.completed && nb.status !== "pending" && (
            <div className="rounded-lg border border-ink-700 p-3.5 bg-ink-950/50">
              {nb.status === "rejected" && (
                <p className="text-sm text-rust-400 mb-2.5">
                  Rejected: {nb.review_note || "Please revise and resubmit."}
                </p>
              )}
              <p className="text-sm text-paper-300 mb-2.5">{nb.prompt}</p>
              {nb.question_type === "self_attest" ? (
                <label className="flex items-center gap-2 text-sm text-paper-300">
                  <input type="checkbox" checked={selfAttest} onChange={(e) => setSelfAttest(e.target.checked)}
                    className="accent-brass-500" />
                  I confirm I've completed this notebook.
                </label>
              ) : (
                <textarea
                  className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brass-500 transition-colors"
                  rows={3} placeholder="Your answer…" value={response} onChange={(e) => setResponse(e.target.value)}
                />
              )}
              <button
                onClick={submit} disabled={busy}
                className="mt-2.5 bg-brass-600 hover:bg-brass-500 text-ink-950 transition-colors rounded-lg px-4 py-1.5 text-xs font-display font-medium disabled:opacity-50"
              >
                {busy ? "submitting…" : "submit for review"}
              </button>
              {msg && <p className="text-xs mt-2 text-paper-400">{msg}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
