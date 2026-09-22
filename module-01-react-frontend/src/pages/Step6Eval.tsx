import { useState } from 'react'
import NotebookPage, { SectionHeader } from '../components/NotebookPage'
import MarkdownCell, { Code, CodeBlock, Callout } from '../components/MarkdownCell'
import CodeCell from '../components/CodeCell'
import ConceptCheck from '../components/ConceptCheck'
import { useEvalResults } from '../hooks/useEvalResults'
import { useProgress } from '../hooks/useProgress'
import { Skeleton } from '../components/ui/skeleton'

const SCAFFOLD_EVAL = `import os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
sys.path.insert(0, str(Path("/foundations")))

# Final Mock — Module 01 Checkpoint
# This is your graded evaluation. Run the LangSmith evaluation against the
# frozen dataset "module-01-week1-checkpoint" and print your aggregate score.
#
# TODO:
# 1. Import evaluate from langsmith and the evaluators from eval_utils.py
# 2. Define a target function that calls your routing_chain
# 3. Run evaluate() with the dataset and both evaluators
# 4. Print the aggregate score

from langsmith import evaluate
from eval_utils import correctness_evaluator, relevance_evaluator
from classify_query import routing_chain

def target(inputs: dict) -> dict:
    # TODO: Call routing_chain.invoke() with inputs["input"] and return {"output": response}
    response = routing_chain.invoke(inputs["input"])
    return {"output": response}

try:
    results = evaluate(
        target,
        data="module-01-week1-checkpoint",
        evaluators=[correctness_evaluator, relevance_evaluator],
        experiment_prefix="module-01-challenge",
    )
    # TODO: Compute and print the aggregate score
    scores = []
    for r in results:
        for eval_result in r.get("evaluation_results", {}).get("results", []):
            if eval_result.score is not None:
                scores.append(eval_result.score)

    if scores:
        aggregate = sum(scores) / len(scores)
        print(f"Evaluation complete!")
        print(f"  Aggregate score: {aggregate:.2f}")
        print(f"  Correctness + Relevance scores: {len(scores)} total")
        if aggregate >= 0.75:
            print(f"  ✓ PASS — score {aggregate:.2f} >= 0.75")
        else:
            print(f"  ✗ FAIL — score {aggregate:.2f} < 0.75 (threshold)")
    else:
        print("Evaluation ran. Check LangSmith for detailed results.")
except Exception as e:
    print(f"Evaluation failed: {e}")
    print("Check your LANGCHAIN_API_KEY and ensure the dataset exists.")
`

function ScoreDashboard() {
  const { data, error, loading, refresh } = useEvalResults()

  if (loading) {
    return (
      <div data-testid="loading-skeleton" className="space-y-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" data-testid="error-panel" className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300 space-y-2">
        <p>{error.message}{error.status ? ` (HTTP ${error.status})` : ''}</p>
        <button onClick={refresh} data-testid="retry-btn" className="px-3 py-1 bg-red-600 text-white rounded text-xs">Retry</button>
      </div>
    )
  }

  if (!data || !data.has_results) {
    return (
      <div data-testid="no-results-panel" className="rounded-md border border-border bg-secondary p-4 text-sm text-muted-foreground">
        <p>No results yet. Run the evaluation cell above, then click <strong>Refresh</strong>.</p>
        <button onClick={refresh} className="mt-2 px-3 py-1 border border-border rounded text-xs text-muted-foreground hover:bg-secondary/60">Refresh</button>
      </div>
    )
  }

  const pass = data.aggregate_score >= 0.75
  const lowest = data.dim_scores.correctness <= data.dim_scores.relevance ? 'correctness' : 'relevance'

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-4">
        <span data-testid="aggregate-score" className="text-4xl font-bold text-foreground">
          {data.aggregate_score.toFixed(2)}
        </span>
        {pass
          ? <span data-testid="pass-badge" className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500/10 text-green-400 border border-green-500/40">PASS</span>
          : <span data-testid="fail-badge" className="px-3 py-1 rounded-full text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/40">FAIL</span>
        }
        <button onClick={refresh} data-testid="refresh-btn" className="ml-auto px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:bg-secondary/60">Refresh</button>
      </div>

      {!pass && (
        <p data-testid="lowest-dimension" className="text-sm text-muted-foreground">
          Lowest dimension: <strong>{lowest}</strong> — focus your improvements here.
        </p>
      )}

      <div className="space-y-3">
        {(['correctness', 'relevance'] as const).map(dim => (
          <div key={dim}>
            <div className="flex justify-between text-sm mb-1">
              <span className="capitalize text-foreground/80">{dim}</span>
              <span className="text-muted-foreground">{data.dim_scores[dim].toFixed(2)}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div
                data-testid={`progress-${dim}`}
                className="bg-gradient-primary h-2.5 rounded-full transition-all"
                style={{ width: `${data.dim_scores[dim] * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Dataset: <strong>{data.dataset_name}</strong> — {data.example_count} examples
      </p>
    </div>
  )
}

export default function Step6Eval() {
  const { completed, markComplete } = useProgress()
  const [evalPassed, setEvalPassed] = useState(false)

  return (
    <NotebookPage
      stepNumber={6}
      title="Final Mock — Evaluation Challenge"
      subtitle="Run the LangSmith evaluation against the frozen checkpoint dataset and achieve a score ≥ 0.75 to pass."
    >
      <MarkdownCell>
        <p className="font-semibold text-amber-700">🏆 This is your graded checkpoint.</p>
        <p className="mt-1">You will run your <Code>routing_chain</Code> against the <Code>module-01-week1-checkpoint</Code> dataset (30 examples) using two LLM-based evaluators:</p>
        <div className="mt-2 space-y-1 text-sm">
          <div><Code>correctness_evaluator</Code> — Is the answer factually correct?</div>
          <div><Code>relevance_evaluator</Code> — Is the answer on-topic and useful?</div>
        </div>
        <p className="mt-2">The aggregate score is the arithmetic mean of all evaluator scores. You need <strong>≥ 0.75</strong> to pass.</p>
      </MarkdownCell>

      <Callout type="warning">
        This cell makes real LangSmith API calls and runs 30 evaluations. It will take 1–3 minutes. Make sure your <Code>LANGCHAIN_API_KEY</Code> and <Code>LANGCHAIN_PROJECT</Code> are set correctly before running.
      </Callout>

      <MarkdownCell>
        <p className="font-semibold mb-1">How LangSmith evaluation works:</p>
        <CodeBlock code={`from langsmith import evaluate

results = evaluate(
    target,                    # your function: inputs -> {"output": str}
    data="dataset-name",       # frozen dataset in LangSmith
    evaluators=[...],          # list of evaluator functions
    experiment_prefix="name",  # prefix for the experiment in LangSmith
)`} />
        <p className="mt-2">Each example in the dataset has an <Code>input</Code> and a <Code>reference_output</Code>. The evaluators compare your output to the reference and return a score between 0 and 1.</p>
      </MarkdownCell>

      <SectionHeader label="Challenge — Run the evaluation" />
      <MarkdownCell>
        <p>Complete the <Code># TODO</Code> sections. The cell passes when your output shows an aggregate score and the evaluation completes without errors.</p>
      </MarkdownCell>

      <CodeCell
        cellId="6.eval"
        initialCode={SCAFFOLD_EVAL}
        onPass={() => setEvalPassed(true)}
        passed={evalPassed}
      />

      <SectionHeader label="Your latest score" />
      <ScoreDashboard />

      <SectionHeader label="Concept check" />
      <ConceptCheck
        question="What is the minimum aggregate score required to pass the Module 01 checkpoint?"
        options={[
          { label: '0.50', value: '0.50' },
          { label: '0.70', value: '0.70' },
          { label: '0.75', value: '0.75' },
          { label: '1.00', value: '1.00' },
        ]}
        correctValue="0.75"
        remediationText={`The pass threshold is 0.75 (75%).\n\nThe aggregate score is the arithmetic mean of all correctness and relevance scores across all 30 examples.\n\nIf your score is below 0.75, the dashboard shows which dimension is lowest — focus your improvements there and re-run the evaluation.`}
        stepIndex={6}
        isCompleted={completed[6] === true}
        onComplete={() => markComplete(6)}
      />
    </NotebookPage>
  )
}
