import { useState } from 'react'
import NotebookPage, { SectionHeader } from '../components/NotebookPage'
import MarkdownCell, { Code, CodeBlock, Callout } from '../components/MarkdownCell'
import CodeCell from '../components/CodeCell'
import ConceptCheck from '../components/ConceptCheck'
import { useProgress } from '../hooks/useProgress'

const SCAFFOLD_INIT = `# Cell 1 — Initialise ChatGroq
# TODO: Import ChatGroq from langchain_groq.
# Create an llm instance with model="llama3-8b-8192" and temperature=0.
# Print a confirmation message showing the model name.

import os
from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq

try:
    # TODO: Create the ChatGroq client
    llm = ChatGroq(model="llama3-8b-8192", temperature=0)
    print("✓ ChatGroq client created successfully")
    print(f"  Model: {llm.model_name}")
except Exception as e:
    print(f"ChatGroq init failed: {e}")
    print("Check your GROQ_API_KEY in .env")
`

const SCAFFOLD_INVOKE = `# Cell 2 — Make your first LLM call
# TODO: Call llm.invoke() with a question and print the response content.
# Also print the type of the response object.

import os
from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

llm = ChatGroq(model="llama3-8b-8192", temperature=0)

try:
    # TODO: Build a messages list with SystemMessage + HumanMessage
    # and call llm.invoke(messages). Print response.content.
    messages = [
        SystemMessage(content="You are a concise technical assistant. Answer in one sentence."),
        HumanMessage(content="What is a REST API?"),
        AIMessage(content="A REST API uses HTTP methods to expose resources over a network."),
        HumanMessage(content="Give me one concrete example endpoint."),
    ]
    response = llm.invoke(messages)
    print("Message roles demo")
    print("==================")
    for msg in messages:
        role = type(msg).__name__.replace("Message", "")
        print(f"[{role:6s}] {msg.content}")
    print(f"[AI    ] {response.content}")
except Exception as e:
    print(f"Invocation failed: {e}")
`

const SCAFFOLD_TEMPERATURE = `# Cell 3 — Temperature comparison
# TODO: Create two ChatGroq instances — one with temperature=0.0, one with temperature=1.0.
# Invoke both with the same prompt and print both responses labelled clearly.

import os
from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq

temp_prompt = "Describe the colour blue in one sentence."

try:
    # TODO: Create llm_cold with temperature=0.0 and invoke it
    llm_cold = ChatGroq(model="llama3-8b-8192", temperature=0.0)
    response_cold = llm_cold.invoke(temp_prompt)
    print("temperature=0.0 (deterministic):")
    print(f"  {response_cold.content}")
except Exception as e:
    print(f"temperature=0.0 call failed: {e}")

try:
    # TODO: Create llm_hot with temperature=1.0 and invoke it
    llm_hot = ChatGroq(model="llama3-8b-8192", temperature=1.0)
    response_hot = llm_hot.invoke(temp_prompt)
    print("\\ntemperature=1.0 (creative):")
    print(f"  {response_hot.content}")
except Exception as e:
    print(f"temperature=1.0 call failed: {e}")
`

const SCAFFOLD_TOKENS = `# Cell 4 — Token usage monitoring
# TODO: Invoke the model and print the token usage from response.usage_metadata.
# Print: input_tokens, output_tokens, total_tokens.

import os
from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq

llm = ChatGroq(model="llama3-8b-8192", temperature=0)

try:
    response = llm.invoke("What is the Pythagorean theorem?")
    # TODO: Access response.usage_metadata and print the three token counts
    usage = response.usage_metadata
    print("Token usage breakdown:")
    print(f"  input_tokens:  {usage['input_tokens']}")
    print(f"  output_tokens: {usage['output_tokens']}")
    print(f"  total_tokens:  {usage['total_tokens']}")
    print(f"\\nResponse: {response.content[:120]}...")
except Exception as e:
    print(f"Token usage failed: {e}")
`

export default function Step2Groq() {
  const { completed, markComplete } = useProgress()
  const [passed, setPassed] = useState({ init: false, invoke: false, temp: false, tokens: false })
  const mark = (k: keyof typeof passed) => setPassed(p => ({ ...p, [k]: true }))

  return (
    <NotebookPage
      stepNumber={2}
      title="Groq & ChatGroq"
      subtitle="Initialise ChatGroq, make your first LLM call, and explore temperature and token usage."
    >
      <MarkdownCell>
        <p><strong>ChatGroq</strong> is LangChain's wrapper around the Groq inference API. It follows the standard <Code>BaseChatModel</Code> interface, so it works seamlessly inside LCEL chains.</p>
        <CodeBlock code={`from langchain_groq import ChatGroq

llm = ChatGroq(model="llama3-8b-8192", temperature=0)
response = llm.invoke("Hello!")
print(response.content)`} />
        <p className="mt-2">The <Code>GROQ_API_KEY</Code> env var is picked up automatically — no need to pass it explicitly.</p>
      </MarkdownCell>

      <SectionHeader label="Exercise 1 — Initialise ChatGroq" />
      <CodeCell cellId="2.init" initialCode={SCAFFOLD_INIT} onPass={() => mark('init')} passed={passed.init} />

      <SectionHeader label="Message roles: system, human, ai" />
      <MarkdownCell>
        <p>LangChain uses typed message objects for the three chat roles:</p>
        <div className="space-y-1 text-sm mt-1">
          <div><Code>SystemMessage</Code> — sets the model's persona / instructions</div>
          <div><Code>HumanMessage</Code> — the user's turn</div>
          <div><Code>AIMessage</Code> — a previous assistant turn (for multi-turn context)</div>
        </div>
      </MarkdownCell>

      <SectionHeader label="Exercise 2 — Invoke the model" />
      <CodeCell cellId="2.invoke" initialCode={SCAFFOLD_INVOKE} onPass={() => mark('invoke')} passed={passed.invoke} />

      <SectionHeader label="Temperature: deterministic vs creative" />
      <MarkdownCell>
        <p><Code>temperature=0.0</Code> → always picks the highest-probability token → deterministic, consistent output. Best for classification, extraction, structured tasks.</p>
        <p className="mt-1"><Code>temperature=1.0</Code> → samples broadly from the distribution → varied, creative output. Best for writing, brainstorming.</p>
        <Callout type="tip">Run the same prompt twice at <Code>temperature=0.0</Code> — you'll get identical responses. Try it at <Code>temperature=1.0</Code> and they'll differ.</Callout>
      </MarkdownCell>

      <SectionHeader label="Exercise 3 — Temperature comparison" />
      <CodeCell cellId="2.temperature" initialCode={SCAFFOLD_TEMPERATURE} onPass={() => mark('temp')} passed={passed.temp} />

      <SectionHeader label="Token usage" />
      <MarkdownCell>
        <p>Every Groq response includes token counts in <Code>response.usage_metadata</Code>. Monitoring this helps you estimate costs and stay within rate limits.</p>
        <CodeBlock code={`usage = response.usage_metadata
print(usage['input_tokens'])   # prompt tokens
print(usage['output_tokens'])  # completion tokens
print(usage['total_tokens'])   # sum`} />
      </MarkdownCell>

      <SectionHeader label="Exercise 4 — Token usage" />
      <CodeCell cellId="2.tokens" initialCode={SCAFFOLD_TOKENS} onPass={() => mark('tokens')} passed={passed.tokens} />

      <SectionHeader label="Concept check" />
      <ConceptCheck
        question="Which temperature setting produces more deterministic (consistent) output?"
        options={[
          { label: '0.0', value: '0.0' },
          { label: '1.0', value: '1.0' },
          { label: 'Both are equally deterministic', value: 'both' },
          { label: 'Temperature has no effect on output', value: 'none' },
        ]}
        correctValue="0.0"
        remediationText={`At temperature=0.0 the model always picks the highest-probability next token, making responses highly consistent.\n\nAt temperature=1.0 the model samples more broadly, producing varied and creative responses.\n\nFor deterministic tasks (classification, structured output) use 0.0. For creative tasks use higher values.`}
        stepIndex={2}
        isCompleted={completed[2] === true}
        onComplete={() => markComplete(2)}
      />
    </NotebookPage>
  )
}
