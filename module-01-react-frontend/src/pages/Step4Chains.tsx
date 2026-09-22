import { useState } from 'react'
import NotebookPage, { SectionHeader } from '../components/NotebookPage'
import MarkdownCell, { Code, CodeBlock, Callout } from '../components/MarkdownCell'
import CodeCell from '../components/CodeCell'
import ConceptCheck from '../components/ConceptCheck'
import { useProgress } from '../hooks/useProgress'

const PREAMBLE = `import os
from dotenv import load_dotenv
load_dotenv()
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser, PydanticOutputParser
`

const SCAFFOLD_BASIC = PREAMBLE + `
# Cell 1 — Basic LCEL chain: prompt | llm | StrOutputParser
# TODO: Assemble the chain using the pipe operator |
# Connect: prompt_basic | llm_chain | parser_str
# Invoke with {"question": "What is LangChain?"} and print the result type and value.

try:
    prompt_basic = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. Answer in two sentences."),
        ("human", "{question}"),
    ])
    llm_chain = ChatGroq(model="llama3-8b-8192", temperature=0)
    parser_str = StrOutputParser()

    # TODO: Use the | operator to compose the chain
    basic_chain = prompt_basic | llm_chain | parser_str

    result_basic = basic_chain.invoke({"question": "What is LangChain?"})
    print("Basic chain (StrOutputParser)")
    print("=============================")
    print(f"Output type: {type(result_basic).__name__}")
    print(f"Output: {result_basic}")
except Exception as e:
    print(f"Basic chain failed: {e}")
`

const SCAFFOLD_JSON = PREAMBLE + `
# Cell 2 — JSON chain: prompt | llm | JsonOutputParser
# TODO: Build a chain that returns a JSON dict.
# The prompt should ask for a JSON object with keys: "answer", "confidence" (0-1), "category".
# Use JsonOutputParser as the output parser.

try:
    prompt_json = ChatPromptTemplate.from_messages([
        ("system", (
            "You are a helpful assistant. "
            "Always respond with a JSON object containing keys: "
            '\\"answer\\", \\"confidence\\" (float 0-1), \\"category\\" (technical/general/creative). '
            "No markdown fences."
        )),
        ("human", "{question}"),
    ])
    llm_chain = ChatGroq(model="llama3-8b-8192", temperature=0)
    parser_json = JsonOutputParser()

    # TODO: Compose the chain with |
    json_chain = prompt_json | llm_chain | parser_json

    result_json = json_chain.invoke({"question": "What is Python?"})
    print("JSON chain (JsonOutputParser)")
    print("=============================")
    print(f"Output type: {type(result_json).__name__}")
    for key, value in result_json.items():
        print(f"  {key}: {value}")
except Exception as e:
    print(f"JSON chain failed: {e}")
`

const SCAFFOLD_PYDANTIC = PREAMBLE + `
# Cell 3 — Pydantic chain: prompt | llm | PydanticOutputParser
# The chains.py module provides make_pydantic_chain() and QueryAnalysis.
# TODO: Import them, invoke the chain with {"query": "How does LCEL work?"},
# and print the category, confidence, and reasoning fields.

import sys
from pathlib import Path
sys.path.insert(0, str(Path("/foundations")))

try:
    from chains import make_pydantic_chain, QueryAnalysis

    pydantic_chain = make_pydantic_chain(QueryAnalysis)
    result = pydantic_chain.invoke({"query": "How does LCEL work?"})

    print("Pydantic chain (PydanticOutputParser)")
    print("======================================")
    print(f"Output type: {type(result).__name__}")
    print(f"  category:   {result.category}")
    print(f"  confidence: {result.confidence}")
    print(f"  reasoning:  {result.reasoning}")
except Exception as e:
    print(f"Pydantic chain failed: {e}")
`

export default function Step4Chains() {
  const { completed, markComplete } = useProgress()
  const [passed, setPassed] = useState({ basic: false, json: false, pydantic: false })
  const mark = (k: keyof typeof passed) => setPassed(p => ({ ...p, [k]: true }))

  return (
    <NotebookPage
      stepNumber={4}
      title="LCEL Chains"
      subtitle="Compose reusable LLM pipelines using the pipe operator and compare three output parsers."
    >
      <MarkdownCell>
        <p><strong>LCEL (LangChain Expression Language)</strong> lets you compose chains with Python's <Code>|</Code> pipe operator:</p>
        <CodeBlock code={`chain = prompt | model | parser
result = chain.invoke({"question": "What is Python?"})`} />
        <p className="mt-2">Each component is a <Code>Runnable</Code> — an object with an <Code>.invoke()</Code> method. The pipe connects them so the output of one becomes the input of the next.</p>
      </MarkdownCell>

      <MarkdownCell>
        <p className="font-semibold mb-2">Three output parsers:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-secondary">
              <th className="border border-border px-2 py-1 text-left">Parser</th>
              <th className="border border-border px-2 py-1 text-left">Returns</th>
              <th className="border border-border px-2 py-1 text-left">Use when</th>
            </tr></thead>
            <tbody>
              {[
                ['StrOutputParser', 'str', 'You want the raw text response'],
                ['JsonOutputParser', 'dict', 'Model returns JSON, you need a Python dict'],
                ['PydanticOutputParser', 'Pydantic model', 'You need a typed, validated Python object'],
              ].map(([p, r, u]) => (
                <tr key={p}>
                  <td className="border border-border px-2 py-1 font-mono">{p}</td>
                  <td className="border border-border px-2 py-1 font-mono text-accent">{r}</td>
                  <td className="border border-border px-2 py-1 text-muted-foreground">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MarkdownCell>

      <SectionHeader label="Exercise 1 — Basic chain (StrOutputParser)" />
      <MarkdownCell>
        <p>Compose <Code>prompt | llm | StrOutputParser()</Code> using the <Code>|</Code> operator. The result is a plain Python string.</p>
      </MarkdownCell>
      <CodeCell cellId="4.basic" initialCode={SCAFFOLD_BASIC} onPass={() => mark('basic')} passed={passed.basic} />

      <SectionHeader label="Exercise 2 — JSON chain (JsonOutputParser)" />
      <MarkdownCell>
        <p>Compose a chain that returns a Python <Code>dict</Code>. The prompt must instruct the model to return JSON only.</p>
      </MarkdownCell>
      <CodeCell cellId="4.json" initialCode={SCAFFOLD_JSON} onPass={() => mark('json')} passed={passed.json} />

      <SectionHeader label="Exercise 3 — Pydantic chain (PydanticOutputParser)" />
      <MarkdownCell>
        <p>Use the pre-built <Code>make_pydantic_chain(QueryAnalysis)</Code> from <Code>chains.py</Code>. It returns a typed <Code>QueryAnalysis</Code> object with <Code>category</Code>, <Code>confidence</Code>, and <Code>reasoning</Code> fields.</p>
        <Callout type="tip">The input key for the pydantic chain is <Code>"query"</Code> (not <Code>"question"</Code>). Check <Code>chains.py</Code> if unsure.</Callout>
      </MarkdownCell>
      <CodeCell cellId="4.pydantic" initialCode={SCAFFOLD_PYDANTIC} onPass={() => mark('pydantic')} passed={passed.pydantic} />

      <SectionHeader label="Concept check" />
      <ConceptCheck
        question="Which output parser returns a typed, validated Python object?"
        options={[
          { label: 'StrOutputParser', value: 'str' },
          { label: 'JsonOutputParser', value: 'json' },
          { label: 'PydanticOutputParser', value: 'pydantic' },
          { label: 'All three return the same type', value: 'all' },
        ]}
        correctValue="pydantic"
        remediationText={`PydanticOutputParser returns a typed Pydantic model instance — a validated Python object with named fields and type checking.\n\nStrOutputParser returns a plain str.\nJsonOutputParser returns an untyped dict.\nPydanticOutputParser returns a Pydantic BaseModel instance with field validation.`}
        stepIndex={4}
        isCompleted={completed[4] === true}
        onComplete={() => markComplete(4)}
      />
    </NotebookPage>
  )
}
