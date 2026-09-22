import { useState } from 'react'
import NotebookPage, { SectionHeader } from '../components/NotebookPage'
import MarkdownCell, { Code } from '../components/MarkdownCell'
import CodeCell from '../components/CodeCell'
import ConceptCheck from '../components/ConceptCheck'
import { useProgress } from '../hooks/useProgress'

const PREAMBLE = `import os
from dotenv import load_dotenv
load_dotenv()
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.output_parsers import JsonOutputParser
llm = ChatGroq(model="llama3-8b-8192", temperature=0)
`

const SCAFFOLD_ZERO_SHOT = PREAMBLE + `
# Cell 1 — Zero-shot prompting
# TODO: Write a zero-shot prompt that classifies a customer review as
# Positive, Negative, or Neutral. Reply with a single word only.
# Invoke llm and print the response.

try:
    zero_shot_prompt = (
        "Classify the following customer review as Positive, Negative, or Neutral. "
        "Reply with a single word only.\\n\\n"
        "Review: 'The product arrived on time and works exactly as described.'"
    )
    response_zs = llm.invoke(zero_shot_prompt)
    print("Zero-shot prompting")
    print("===================")
    print(f"Response: {response_zs.content}")
except Exception as e:
    print(f"Zero-shot failed: {e}")
`

const SCAFFOLD_FEW_SHOT = PREAMBLE + `
# Cell 2 — Few-shot prompting
# TODO: Add 2 examples (Positive, Negative) before the actual query.
# The model should classify: 'The product arrived on time and works exactly as described.'

try:
    few_shot_prompt = (
        "Classify each customer review as Positive, Negative, or Neutral. "
        "Reply with a single word only.\\n\\n"
        "Review: 'Absolutely love this product — exceeded all my expectations!'\\n"
        "Classification: Positive\\n\\n"
        "Review: 'Stopped working after two days. Very disappointed.'\\n"
        "Classification: Negative\\n\\n"
        "Review: 'The product arrived on time and works exactly as described.'\\n"
        "Classification:"
    )
    response_fs = llm.invoke(few_shot_prompt)
    print("Few-shot prompting")
    print("==================")
    print("Examples provided: 2 (Positive, Negative)")
    print(f"Response: {response_fs.content}")
except Exception as e:
    print(f"Few-shot failed: {e}")
`

const SCAFFOLD_COT = PREAMBLE + `
# Cell 3 — Chain-of-thought (CoT) prompting
# TODO: Write a CoT prompt that asks the model to reason step-by-step,
# then provide a "Final Answer:" on a new line.
# Problem: Train A travels 120 km in 1.5 hours. Train B travels 200 km in 2.5 hours.
# Which is faster and by how many km/h?

try:
    cot_prompt = (
        "Solve the following problem. "
        "First, reason through it step-by-step. "
        "Then provide your final answer on a new line labelled 'Final Answer:'.\\n\\n"
        "Problem: A train travels 120 km in 1.5 hours. "
        "Another train travels 200 km in 2.5 hours. "
        "Which train is faster, and by how many km/h?"
    )
    response_cot = llm.invoke(cot_prompt)
    output_text = response_cot.content
    if "Final Answer:" in output_text:
        parts = output_text.split("Final Answer:", 1)
        print("Reasoning Trace:")
        print(parts[0].strip())
        print("\\nFinal Answer:")
        print(parts[1].strip())
    else:
        print(output_text)
except Exception as e:
    print(f"CoT failed: {e}")
`

const SCAFFOLD_ROLE = PREAMBLE + `
# Cell 4 — Role prompting
# TODO: Create a SystemMessage that assigns the model a "senior software engineer" persona.
# Compare the role-assigned response to a baseline (no system message).
# Query: "Explain recursion."

role_query = "Explain recursion."

try:
    baseline_response = llm.invoke(role_query)
    print("Baseline (no system message):")
    print("-" * 40)
    print(baseline_response.content[:300])
except Exception as e:
    print(f"Baseline failed: {e}")

try:
    role_messages = [
        SystemMessage(content=(
            "You are a senior software engineer with 15 years of experience. "
            "You explain concepts using precise technical language and concrete examples. "
            "Keep your answer under 100 words."
        )),
        HumanMessage(content=role_query),
    ]
    role_response = llm.invoke(role_messages)
    print("\\nRole-assigned (senior software engineer):")
    print("-" * 40)
    print(role_response.content[:300])
except Exception as e:
    print(f"Role prompting failed: {e}")
`

const SCAFFOLD_JSON = PREAMBLE + `
# Cell 5 — JSON output formatting
# TODO: Write a prompt that instructs the model to return a JSON object with keys:
# "capital", "population_millions", "continent" for France.
# End with: "Respond with JSON only. No markdown fences."
# Parse the result with JsonOutputParser and print each key-value pair.

from langchain_core.exceptions import OutputParserException

try:
    json_prompt = (
        "Provide information about France. "
        "Return a JSON object with exactly these keys: "
        '\\"capital\\", \\"population_millions\\", \\"continent\\". '
        "Respond with JSON only. No markdown fences."
    )
    response_json = llm.invoke(json_prompt)
    parser_json = JsonOutputParser()
    result_json = parser_json.parse(response_json.content)
    print("JSON output formatting")
    print("======================")
    print(f"Parsed result (type={type(result_json).__name__}):")
    for key, value in result_json.items():
        print(f"  {key}: {value}")
except OutputParserException as e:
    print(f"JsonOutputParser failed: {e}")
except Exception as e:
    print(f"JSON formatting failed: {e}")
`

const SCAFFOLD_MULTISTEP = PREAMBLE + `
# Cell 6 — Multi-step prompt flow
# TODO: Chain two LLM calls:
# Step 1: Generate a one-sentence sci-fi story premise.
# Step 2: Use that premise to write an opening paragraph (3-4 sentences).
# Print both steps clearly labelled.

try:
    step1_prompt = (
        "Generate a one-sentence science fiction story premise. "
        "Be creative and specific. Output only the premise sentence."
    )
    step1_response = llm.invoke(step1_prompt)
    premise = step1_response.content.strip()
    print("Step 1 — Story premise:")
    print(f"  {premise}")

    step2_prompt = (
        f"Using this story premise: '{premise}'\\n\\n"
        "Write the opening paragraph of the story (3-4 sentences). "
        "Make it engaging and set the scene vividly."
    )
    step2_response = llm.invoke(step2_prompt)
    print("\\nStep 2 — Opening paragraph (uses Step 1 output as input):")
    print(step2_response.content)
except Exception as e:
    print(f"Multi-step flow failed: {e}")
`

export default function Step3Prompts() {
  const { completed, markComplete } = useProgress()
  const [passed, setPassed] = useState({
    zero_shot: false, few_shot: false, cot: false,
    role: false, json: false, multistep: false,
  })
  const mark = (k: keyof typeof passed) => setPassed(p => ({ ...p, [k]: true }))

  return (
    <NotebookPage
      stepNumber={3}
      title="Prompt Engineering"
      subtitle="Apply six prompt engineering techniques and observe how each shapes the model's output."
    >
      <MarkdownCell>
        <p className="font-semibold mb-2">Six techniques — when to use each:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-secondary">
              <th className="border border-border px-2 py-1 text-left">Technique</th>
              <th className="border border-border px-2 py-1 text-left">Best for</th>
            </tr></thead>
            <tbody>
              {[
                ['Zero-shot', 'Simple, well-defined tasks'],
                ['Few-shot', 'Non-standard format or style'],
                ['Chain-of-thought', 'Multi-step reasoning, arithmetic'],
                ['Role prompting', 'Tone and vocabulary shaping'],
                ['JSON output', 'Structured, parseable responses'],
                ['Multi-step', 'Tasks too complex for one prompt'],
              ].map(([t, u]) => (
                <tr key={t}>
                  <td className="border border-border px-2 py-1 font-mono font-semibold">{t}</td>
                  <td className="border border-border px-2 py-1 text-muted-foreground">{u}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MarkdownCell>

      <SectionHeader label="Exercise 1 — Zero-shot" />
      <MarkdownCell>
        <p>Give the task instruction with no examples. The model relies entirely on its pre-training knowledge.</p>
      </MarkdownCell>
      <CodeCell cellId="3.zero_shot" initialCode={SCAFFOLD_ZERO_SHOT} onPass={() => mark('zero_shot')} passed={passed.zero_shot} />

      <SectionHeader label="Exercise 2 — Few-shot" />
      <MarkdownCell>
        <p>Include 2–5 input/output examples before the actual query. This teaches the model the expected output format.</p>
      </MarkdownCell>
      <CodeCell cellId="3.few_shot" initialCode={SCAFFOLD_FEW_SHOT} onPass={() => mark('few_shot')} passed={passed.few_shot} />

      <SectionHeader label="Exercise 3 — Chain-of-thought" />
      <MarkdownCell>
        <p>Instruct the model to reason step-by-step before giving a final answer. Dramatically improves accuracy on multi-step reasoning tasks. Your prompt must produce a <Code>Final Answer:</Code> label.</p>
      </MarkdownCell>
      <CodeCell cellId="3.cot" initialCode={SCAFFOLD_COT} onPass={() => mark('cot')} passed={passed.cot} />

      <SectionHeader label="Exercise 4 — Role prompting" />
      <MarkdownCell>
        <p>Assign a named persona via the <Code>SystemMessage</Code>. Compare the role-assigned response to a no-system-message baseline.</p>
      </MarkdownCell>
      <CodeCell cellId="3.role" initialCode={SCAFFOLD_ROLE} onPass={() => mark('role')} passed={passed.role} />

      <SectionHeader label="Exercise 5 — JSON output formatting" />
      <MarkdownCell>
        <p>Instruct the model to return structured JSON, then parse it with <Code>JsonOutputParser</Code>. End your prompt with <Code>Respond with JSON only. No markdown fences.</Code></p>
      </MarkdownCell>
      <CodeCell cellId="3.json" initialCode={SCAFFOLD_JSON} onPass={() => mark('json')} passed={passed.json} />

      <SectionHeader label="Exercise 6 — Multi-step flow" />
      <MarkdownCell>
        <p>Chain two LLM calls where the output of the first becomes the input of the second. Useful for decomposing complex tasks.</p>
      </MarkdownCell>
      <CodeCell cellId="3.multistep" initialCode={SCAFFOLD_MULTISTEP} onPass={() => mark('multistep')} passed={passed.multistep} />

      <SectionHeader label="Concept check" />
      <ConceptCheck
        question="Which technique is most appropriate when you need the model to return a Python-parseable structured object?"
        options={[
          { label: 'Zero-shot', value: 'zero_shot' },
          { label: 'Few-shot', value: 'few_shot' },
          { label: 'JSON output formatting', value: 'json_output' },
          { label: 'Role prompting', value: 'role' },
        ]}
        correctValue="json_output"
        remediationText={`JSON output formatting instructs the model to return a structured JSON object with specific keys.\n\nThis makes the response directly parseable by Python's json.loads() or LangChain's JsonOutputParser.\n\nFor typed, validated Python objects, use PydanticOutputParser (covered in Step 4).`}
        stepIndex={3}
        isCompleted={completed[3] === true}
        onComplete={() => markComplete(3)}
      />
    </NotebookPage>
  )
}
