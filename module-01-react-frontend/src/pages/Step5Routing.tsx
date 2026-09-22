import { useState } from 'react'
import NotebookPage, { SectionHeader } from '../components/NotebookPage'
import MarkdownCell, { Code, CodeBlock, Callout } from '../components/MarkdownCell'
import CodeCell from '../components/CodeCell'
import ConceptCheck from '../components/ConceptCheck'
import { useProgress } from '../hooks/useProgress'

const PREAMBLE = `import os, sys
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
sys.path.insert(0, str(Path("/foundations")))
`

const SCAFFOLD_CLASSIFY = PREAMBLE + `
# Cell 1 — classify_query()
# TODO: Import classify_query from classify_query.py (already on sys.path).
# Call it with three different queries — one technical, one creative, one general.
# Print the query and its category for each.

try:
    from classify_query import classify_query

    queries = [
        "How does LCEL work?",
        "Write a haiku about neural networks",
        "What is LangChain?",
    ]
    for q in queries:
        category = classify_query(q)
        print(f"Query:    {q}")
        print(f"Category: {category}")
        print()
except Exception as e:
    print(f"classify_query failed: {e}")
`

const SCAFFOLD_ROUTING = PREAMBLE + `
# Cell 2 — routing_chain
# TODO: Import routing_chain from classify_query.py.
# Invoke it with a query and print the category and response.
# The routing_chain uses RunnableBranch to dispatch to the correct chain.

try:
    from classify_query import classify_query, routing_chain

    query = "How does the pipe operator work in LangChain?"
    category = classify_query(query)
    response = routing_chain.invoke(query)

    print(f"Query:    {query}")
    print(f"Category: {category}")
    print(f"Response: {response}")
except Exception as e:
    print(f"routing_chain failed: {e}")
`

export default function Step5Routing() {
  const { completed, markComplete } = useProgress()
  const [passed, setPassed] = useState({ classify: false, routing: false })
  const mark = (k: keyof typeof passed) => setPassed(p => ({ ...p, [k]: true }))

  return (
    <NotebookPage
      stepNumber={5}
      title="Query Routing"
      subtitle="Classify queries into categories and dispatch them to category-specific chains using RunnableBranch."
    >
      <MarkdownCell>
        <p><strong>Query routing</strong> is a pattern where you first classify an input, then dispatch it to a different chain based on the classification result.</p>
        <CodeBlock code={`# Two-step routing pattern
category = classify_query(query)      # "technical" | "creative" | "general"
response = routing_chain.invoke(query) # dispatches to the right chain`} />
      </MarkdownCell>

      <MarkdownCell>
        <p className="font-semibold mb-1">How RunnableBranch works:</p>
        <CodeBlock code={`from langchain_core.runnables import RunnableBranch, RunnableLambda

routing_chain = (
    RunnableLambda(lambda q: {"query": q, "category": classify_query(q)})
    | RunnableBranch(
        (lambda x: x["category"] == "technical", technical_chain),
        (lambda x: x["category"] == "creative",  creative_chain),
        general_chain,  # default branch
    )
)`} />
        <p className="mt-2"><Code>RunnableBranch</Code> evaluates each predicate in order and runs the first matching chain. The last argument is the default (no predicate needed).</p>
      </MarkdownCell>

      <SectionHeader label="Exercise 1 — classify_query()" />
      <MarkdownCell>
        <p>Import <Code>classify_query</Code> from <Code>classify_query.py</Code> and test it with three queries — one per category.</p>
        <Callout type="tip">The module is already on <Code>sys.path</Code> via the preamble. Just import and call it.</Callout>
      </MarkdownCell>
      <CodeCell cellId="5.classify" initialCode={SCAFFOLD_CLASSIFY} onPass={() => mark('classify')} passed={passed.classify} />

      <SectionHeader label="Exercise 2 — routing_chain" />
      <MarkdownCell>
        <p>Import <Code>routing_chain</Code> and invoke it. Print both the detected category and the chain's response.</p>
      </MarkdownCell>
      <CodeCell cellId="5.routing" initialCode={SCAFFOLD_ROUTING} onPass={() => mark('routing')} passed={passed.routing} />

      <SectionHeader label="Concept check" />
      <ConceptCheck
        question="What does `RunnableBranch` do in the routing chain?"
        options={[
          { label: 'It classifies the query into a category', value: 'classify' },
          { label: 'It dispatches to a different chain based on the category', value: 'dispatch' },
          { label: 'It parses the model output into JSON', value: 'parse' },
          { label: 'It retries failed requests', value: 'retry' },
        ]}
        correctValue="dispatch"
        remediationText={`RunnableBranch dispatches to a different chain based on a condition.\n\nclassify_query() does the classification — RunnableBranch does the dispatching.\n\nIt evaluates each branch predicate in order and runs the first matching chain.`}
        stepIndex={5}
        isCompleted={completed[5] === true}
        onComplete={() => markComplete(5)}
      />
    </NotebookPage>
  )
}
