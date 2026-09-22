import { NavLink, Outlet } from 'react-router-dom'
import { useApiStatus } from '../hooks/useApiStatus'
import { useProgress } from '../hooks/useProgress'
import { useScreenCaptureGuard } from '../hooks/useScreenCaptureGuard'
import SecurityBanner from './SecurityBanner'

const STEPS = [
  { index: 1, label: '1 · Environment & Setup' },
  { index: 2, label: '2 · Groq & ChatGroq' },
  { index: 3, label: '3 · Prompt Engineering' },
  { index: 4, label: '4 · LCEL Chains' },
  { index: 5, label: '5 · Query Routing' },
  { index: 6, label: '6 · Evaluation Dashboard' },
]

export default function AppShell() {
  const { connected, langsmithProject } = useApiStatus()
  const { completed, isLocked, completedCount } = useProgress()
  const blurred = useScreenCaptureGuard()

  const progressPct = (completedCount / 6) * 100

  return (
    <div className="min-h-screen flex flex-col">
      <SecurityBanner />
      <div className={`flex flex-col flex-1 transition-[filter] duration-200 ${blurred ? 'blur-xl' : ''}`}>
        {/* Header */}
        <header className="border-b border-border bg-background px-6 py-3 flex items-center gap-4 flex-wrap">
          <h1 className="text-lg font-bold tracking-wide text-foreground mr-auto">
            Module 01 — Foundations
          </h1>

          {/* API Status Badge */}
          <div
            data-testid="api-status-badge"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              connected
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {connected ? (
              <>
                <span>API: Connected ✓</span>
                {langsmithProject && (
                  <span className="ml-1 text-green-400/80">· {langsmithProject}</span>
                )}
              </>
            ) : (
              <span>API: Disconnected ✗</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-40 flex items-center gap-2">
            <div
              className="flex-1 h-2 rounded-full bg-secondary overflow-hidden"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={6}
              aria-label="Overall progress"
            >
              <div
                data-testid="progress-bar-fill"
                className="h-full bg-gradient-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{completedCount}/6</span>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav
            className="w-56 shrink-0 border-r border-border bg-card py-4 overflow-y-auto"
            aria-label="Step navigation"
          >
            {STEPS.map(step => {
              const locked = isLocked(step.index)
              const done = completed[step.index]

              if (locked) {
                return (
                  <button
                    key={step.index}
                    data-testid={`step-nav-${step.index}`}
                    data-locked="true"
                    onClick={() => {
                      // Show inline lock message via alert (simple approach)
                      alert('Complete the previous step first.')
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2 cursor-not-allowed"
                    aria-disabled="true"
                  >
                    <span>🔒</span>
                    <span>{step.label}</span>
                  </button>
                )
              }

              return (
                <NavLink
                  key={step.index}
                  to={`/step/${step.index}`}
                  data-testid={`step-nav-${step.index}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-secondary text-accent font-medium border-r-2 border-accent'
                        : 'text-foreground/80 hover:bg-secondary/60'
                    }`
                  }
                >
                  <span>{done ? '✓' : '○'}</span>
                  <span>{step.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
