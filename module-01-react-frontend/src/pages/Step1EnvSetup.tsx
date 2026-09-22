import { useState } from 'react'
import NotebookPage, { SectionHeader } from '../components/NotebookPage'
import MarkdownCell, { Code, CodeBlock, Callout } from '../components/MarkdownCell'
import CodeCell from '../components/CodeCell'
import ConceptCheck from '../components/ConceptCheck'
import { useProgress } from '../hooks/useProgress'
import { useApiKeys } from '../hooks/useApiKeys'
import type { ApiKeys } from '../hooks/useApiKeys'

// ── Key entry form ────────────────────────────────────────────────────────────

const FIELD_META: Record<keyof ApiKeys, { label: string; placeholder: string; isSecret: boolean }> = {
  groqApiKey:         { label: 'GROQ_API_KEY',         placeholder: 'gsk_…',         isSecret: true  },
  langchainApiKey:    { label: 'LANGCHAIN_API_KEY',    placeholder: 'ls__…',         isSecret: true  },
  langchainTracingV2: { label: 'LANGCHAIN_TRACING_V2', placeholder: 'true',          isSecret: false },
  langchainProject:   { label: 'LANGCHAIN_PROJECT',    placeholder: 'module-01-dev', isSecret: false },
}
const FIELD_ORDER: (keyof ApiKeys)[] = [
  'groqApiKey', 'langchainApiKey', 'langchainTracingV2', 'langchainProject',
]

function KeyForm() {
  const { keys, saveKeys } = useApiKeys()
  const [draft, setDraft] = useState<ApiKeys>({ ...keys })
  const [show, setShow] = useState<Partial<Record<keyof ApiKeys, boolean>>>({})
  const [saved, setSaved] = useState(false)

  function handleSave() {
    saveKeys(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="bg-secondary px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground/90">Your API Keys</span>
        <span className="text-xs text-muted-foreground">
          Stored in browser only · used for this site's interactive exercises
        </span>
      </div>

      <div className="divide-y divide-border">
        {FIELD_ORDER.map(field => {
          const meta = FIELD_META[field]
          const visible = show[field] ?? false
          return (
            <div key={field} className="px-4 py-3 flex items-center gap-3">
              <label
                htmlFor={`key-${field}`}
                className="w-52 shrink-0 text-xs font-mono font-semibold text-accent"
              >
                {meta.label}
              </label>
              <input
                id={`key-${field}`}
                type={meta.isSecret && !visible ? 'password' : 'text'}
                value={draft[field]}
                onChange={e => {
                  setDraft(p => ({ ...p, [field]: e.target.value }))
                  setSaved(false)
                }}
                placeholder={meta.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={meta.label}
              />
              {meta.isSecret && (
                <button
                  type="button"
                  onClick={() => setShow(p => ({ ...p, [field]: !visible }))}
                  className="text-xs text-muted-foreground hover:text-foreground w-10 shrink-0"
                >
                  {visible ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 bg-secondary border-t border-border flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-gradient-primary hover:opacity-90 text-white text-sm font-medium rounded-md transition-colors"
        >
          Save Keys
        </button>
        {saved && (
          <span className="text-sm text-green-400 font-medium">
            ✓ Saved — will be used for this site's exercises
          </span>
        )}
      </div>
    </div>
  )
}

// ── Scaffold code ─────────────────────────────────────────────────────────────

const SCAFFOLD_ENV = `# Cell 1 — Verify environment variables
# Run this in your own local environment with a real .env file
# (the same four values you entered in the form above).
# TODO: Print all four required variables (mask the values for security).

from dotenv import load_dotenv
import os

load_dotenv()  # reads your local .env file into os.environ

REQUIRED_VARS = [
    "GROQ_API_KEY",
    "LANGCHAIN_API_KEY",
    "LANGCHAIN_TRACING_V2",
    "LANGCHAIN_PROJECT",
]

print("Environment variable check:")
for var in REQUIRED_VARS:
    value = os.environ.get(var, "")
    # TODO: Mask the value — show only first 4 chars followed by "****"
    display = (value[:4] + "****") if len(value) > 4 else "(not set)"
    print(f"  {var}: {display}")

print(f"\\n✓ Active LangSmith project: {os.environ.get('LANGCHAIN_PROJECT', 'not set')}")
`

const SCAFFOLD_LANGSMITH = `# Cell 2 — Verify LangSmith connection
# TODO: Import Client from langsmith, create a client, and list your projects.

import os
from dotenv import load_dotenv
load_dotenv()

from langsmith import Client

try:
    client_ls = Client()
    # TODO: Call list_projects() and wrap in list()
    projects = list(client_ls.list_projects())
    active_project = os.environ.get("LANGCHAIN_PROJECT", "not set")
    print(f"✓ LangSmith connected. Active project: {active_project}")
    print(f"  Available projects: {[p.name for p in projects[:5]]}")
except Exception as e:
    print(f"LangSmith connection failed: {e}")
    print("Check your LANGCHAIN_API_KEY — make sure it is saved in the form above.")
`

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Step1EnvSetup() {
  const { completed, markComplete } = useProgress()
  const [cell1Passed, setCell1Passed] = useState(false)
  const [cell2Passed, setCell2Passed] = useState(false)

  return (
    <NotebookPage
      stepNumber={1}
      title="Environment & Setup"
      subtitle="Enter your API keys, then verify your environment and LangSmith connection."
    >
      {/* ── What you'll do ── */}
      <MarkdownCell>
        <p className="font-semibold text-foreground">What you'll do in this step:</p>
        <ol className="list-decimal list-inside space-y-1 text-foreground/80 mt-1">
          <li>Enter your four API keys in the form below</li>
          <li>Run the verification cell to confirm all keys are loaded</li>
          <li>Verify your LangSmith connection is working</li>
        </ol>
      </MarkdownCell>

      <Callout type="tip">
        <strong>Keys here power the interactive exercises on this page</strong> (Steps 2–6 call
        Groq/LangSmith through this site's backend using whatever you save below). Code cells
        themselves run in <em>your own</em> local Python environment, not in the browser — so
        for those you'll still need a real <Code>.env</Code> file with the same four values.
      </Callout>

      {/* ── Key entry form ── */}
      <SectionHeader label="Step 1 — Enter your API keys" />
      <KeyForm />

      {/* ── What each key does ── */}
      <MarkdownCell>
        <p className="font-semibold mb-2">What each key does:</p>
        <div className="space-y-1.5 text-sm">
          <div>
            <Code>GROQ_API_KEY</Code> — Authenticates with Groq for fast LLM inference
            using <Code>llama3-8b-8192</Code>.
          </div>
          <div>
            <Code>LANGCHAIN_API_KEY</Code> — Authenticates with LangSmith for tracing
            and evaluation.
          </div>
          <div>
            <Code>LANGCHAIN_TRACING_V2</Code> — Set to <Code>true</Code> to enable
            automatic tracing of every LangChain call.
          </div>
          <div>
            <Code>LANGCHAIN_PROJECT</Code> — The LangSmith project that receives your
            traces. Use <Code>module-01-dev</Code> for this module.
          </div>
        </div>
      </MarkdownCell>

      {/* ── How python-dotenv works ── */}
      <SectionHeader label="How python-dotenv works" />

      <MarkdownCell>
        <p>
          <Code>load_dotenv()</Code> reads a <Code>.env</Code> file in your project
          directory and injects each key=value pair into <Code>os.environ</Code>, so
          <Code>os.environ.get(...)</Code> can find them. Create a <Code>.env</Code> file
          locally with the same four values you saved above before running these cells.
        </p>
        <CodeBlock code={`from dotenv import load_dotenv
import os

load_dotenv()  # reads your local .env file

api_key = os.environ.get("GROQ_API_KEY")
print(api_key[:4] + "****")  # mask the key`} />
      </MarkdownCell>

      {/* ── Exercise 1 ── */}
      <SectionHeader label="Exercise 1 — Verify env vars" />
      <MarkdownCell>
        <p>
          Complete the <Code># TODO</Code> section. The cell passes when all four
          variables are printed with masked values.
        </p>
      </MarkdownCell>

      <CodeCell
        cellId="1.env"
        initialCode={SCAFFOLD_ENV}
        onPass={() => setCell1Passed(true)}
        passed={cell1Passed}
      />

      {/* ── LangSmith tracing ── */}
      <SectionHeader label="LangSmith tracing" />

      <MarkdownCell>
        <p>
          LangSmith automatically records every <Code>chain.invoke()</Code> call when
          these three env vars are set:
        </p>
        <CodeBlock code={`LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=<your-key>
LANGCHAIN_PROJECT=module-01-dev`} language="bash" />
        <p className="mt-2">
          <Code>LANGCHAIN_PROJECT</Code> determines <em>where</em> traces go. Use
          <Code>module-01-dev</Code> for development and <Code>module-01-prod</Code> for
          evaluation runs — mixing them makes it impossible to separate exploratory
          experiments from official runs.
        </p>
      </MarkdownCell>

      {/* ── Exercise 2 ── */}
      <SectionHeader label="Exercise 2 — Verify LangSmith connection" />

      <CodeCell
        cellId="1.langsmith"
        initialCode={SCAFFOLD_LANGSMITH}
        onPass={() => setCell2Passed(true)}
        passed={cell2Passed}
      />

      {/* ── Concept check ── */}
      <SectionHeader label="Concept check" />

      <ConceptCheck
        question="Which environment variable controls which LangSmith project receives your traces?"
        options={[
          { label: 'GROQ_API_KEY',          value: 'GROQ_API_KEY'          },
          { label: 'LANGCHAIN_PROJECT',      value: 'LANGCHAIN_PROJECT'     },
          { label: 'LANGCHAIN_TRACING_V2',   value: 'LANGCHAIN_TRACING_V2'  },
          { label: 'LANGCHAIN_API_KEY',      value: 'LANGCHAIN_API_KEY'     },
        ]}
        correctValue="LANGCHAIN_PROJECT"
        remediationText={`LANGCHAIN_PROJECT sets the project name in LangSmith where traces are stored.\n\nLANGCHAIN_TRACING_V2=true enables tracing, but LANGCHAIN_PROJECT determines *where* those traces go.\n\nLANGCHAIN_API_KEY authenticates you with LangSmith. GROQ_API_KEY authenticates you with Groq.`}
        stepIndex={1}
        isCompleted={completed[1] === true}
        onComplete={() => markComplete(1)}
      />
    </NotebookPage>
  )
}
