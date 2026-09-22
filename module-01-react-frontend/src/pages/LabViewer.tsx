import PageHeader from '../components/PageHeader'
import { useChecklist } from '../hooks/useChecklist'

const LABS = [
  {
    title: 'Guided Lab',
    file: '01_guided_lab.ipynb',
    estimatedMinutes: 90,
    description:
      'A fill-in-the-blanks notebook covering LCEL chain composition, prompt templates, and output parsers. Over 60% of the code is pre-written — you complete 9 TODO sections.',
    objectives: [
      'Set up the Groq API client and verify connectivity',
      'Build a basic LCEL chain with StrOutputParser',
      'Build a JSON chain with JsonOutputParser',
      'Build a Pydantic chain with PydanticOutputParser',
      'Trace all chain calls with LangSmith',
    ],
    completionCriteria: 'All 9 TODO sections completed and all cells run without errors',
  },
  {
    title: 'Solo Exercise',
    file: '02_solo_exercise.ipynb',
    estimatedMinutes: 60,
    description:
      'Implement a query classifier and routing chain from scratch. Blank implementation cells — no scaffolding provided.',
    objectives: [
      'Implement classify_query() using a ChatGroq chain',
      'Build a RunnableBranch routing chain',
      'Run 10 diverse queries and verify routing',
    ],
    completionCriteria: '10/10 pytest cases pass (`pytest test_cells.py -v`)',
  },
  {
    title: 'Challenge',
    file: '03_challenge.ipynb',
    estimatedMinutes: 90,
    description:
      'Open-ended challenge: run a LangSmith evaluation on the frozen checkpoint dataset and achieve a score ≥ 0.75.',
    objectives: [
      'Upload the evaluation dataset to LangSmith',
      'Implement LLM-based correctness and relevance evaluators',
      'Run evaluate() and inspect per-dimension scores',
      'Iterate until aggregate score ≥ 0.75',
    ],
    completionCriteria: 'LangSmith aggregate eval score ≥ 0.75',
  },
]

const MODULE_OBJECTIVES = [
  'Set up a local Python environment with Groq API and LangChain',
  'Build LCEL chains with three different output parsers',
  'Implement query classification and routing with RunnableBranch',
  'Trace all LLM calls with LangSmith from day one',
  'Run LLM-based evaluation and interpret aggregate scores',
  'Apply environment separation (dev vs prod) from the start',
]

const CHECKLIST_LABELS = [
  'Completed `01_guided_lab.ipynb` and `02_solo_exercise.ipynb` with all cells executed and no errors',
  'LangSmith trace share link added to PR description',
  'LangSmith evaluation experiment link added to PR description',
  'Peer review comment posted on at least one other student\'s PR',
]

export default function LabViewer() {
  const { items, toggle, completedCount } = useChecklist()

  return (
    <div>
      <PageHeader sectionName="Lab Viewer" />
      <main className="p-6 max-w-4xl space-y-8">

        {/* Module learning objectives */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Module Learning Objectives</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            {MODULE_OBJECTIVES.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ol>
        </section>

        {/* Lab cards */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Labs</h2>
          {LABS.map(lab => (
            <div
              key={lab.file}
              data-testid={`lab-card-${lab.file}`}
              className="border rounded-lg p-5 bg-white space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{lab.title}</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {lab.estimatedMinutes} min
                </span>
              </div>
              <p className="text-sm text-gray-600">{lab.description}</p>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Learning objectives:</p>
                <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-600">
                  {lab.objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-gray-500">
                <strong>Completion criteria:</strong> {lab.completionCriteria}
              </p>
              <p className="text-xs text-gray-400">
                File: <code className="bg-gray-100 px-1 rounded">{lab.file}</code>
              </p>
            </div>
          ))}
        </section>

        {/* Submission checklist */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Submission Checklist</h2>
          <p
            data-testid="progress-summary"
            className="text-sm text-gray-500 mb-3"
          >
            {completedCount} / 4 complete
          </p>
          <div className="space-y-3">
            {CHECKLIST_LABELS.map((label, i) => (
              <label
                key={i}
                data-testid={`checklist-item-${i}`}
                className="flex items-start gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={items[String(i)] === true}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
