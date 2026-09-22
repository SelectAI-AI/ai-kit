"""
Fintech Research & Risk Analysis Agent.

Local stack only:
- Groq -> LLM calls (writer + QA agents, PDF note summarization)
- HuggingFace sentence-transformers -> embeddings (no API calls)
- Chroma (langchain_chroma) -> local persisted vector store for PDF RAG
- SQLite -> local structured store (companies, financial_metrics, products, risks)
"""

from __future__ import annotations

import os
import sqlite3
import operator
from pathlib import Path
from typing import Any, Literal, TypedDict, Annotated

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, HumanMessage
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langgraph.checkpoint.memory import MemorySaver
from langgraph.constants import START, END
from langgraph.graph import StateGraph
from langgraph.types import Send
from langgraph.prebuilt import ToolNode, create_react_agent
from langgraph.types import Command, interrupt

from src.tools.db_utils import rows_from_summary

# ---------------------------------------------------------------------------
# Local paths - everything lives on disk, nothing leaves the machine except
# the Groq LLM calls themselves.
# ---------------------------------------------------------------------------
DATA_DIR = Path("data")
PDF_DIR = DATA_DIR / "pdfs"                # drop fintech PDFs here (annual reports, etc.)
CHROMA_DIR = DATA_DIR / "chroma_fintech"   # persisted local Chroma store
DB_PATH = DATA_DIR / "fintech.db"          # local SQLite database

EMBEDDING_MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)


def build_groq_model(model_name: str | None = None, temperature: float = 0.0):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return ChatGroq(
        model=model_name or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        temperature=temperature,
        api_key=api_key,
    )


def format_tool_inputs(messages: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"{m.get('role', 'user')}: {m.get('content', '')}"
        for m in messages
    )


def build_react_agent_with_tools(
    tools: list[Any],
    model: Any | None = None,
    system_prompt: str | None = None,
):
    llm = model or build_groq_model()
    if llm is None:
        raise RuntimeError("Set GROQ_API_KEY to run the real ReAct agent.")

    prompt = system_prompt or (
        "You are a guided-lab assistant. Use tools when helpful, "
        "keep answers concise, and show the tool path in a teaching-friendly way."
    )

    return create_react_agent(llm, tools=tools, prompt=prompt)


class ApprovalState(TypedDict, total=False):
    request: str
    approved: bool
    result: str


def approval_gate(state: ApprovalState):
    decision = interrupt(
        {
            "title": "Approval required",
            "request": state.get("request", ""),
            "allowed": ["approve", "reject"],
        }
    )

    approved = False

    if isinstance(decision, dict):
        approved = (
            str(decision.get("decision", "")).lower() == "approve"
            or bool(decision.get("approved"))
        )
    elif isinstance(decision, str):
        approved = decision.strip().lower() in {
            "approve",
            "yes",
            "y",
            "true",
        }

    return {"approved": approved}


def execute_sensitive_action(state: ApprovalState):
    if not state.get("approved"):
        return {"result": "Action was not approved."}

    return {
        "result": f"Approved and executed: {state.get('request', '')}"
    }


def build_approval_demo_graph(checkpointer=None):
    builder = StateGraph(ApprovalState)

    builder.add_node("approval", approval_gate)
    builder.add_node("execute", execute_sensitive_action)

    builder.add_edge(START, "approval")

    builder.add_conditional_edges(
        "approval",
        lambda state: "execute" if state.get("approved") else END,
        {
            "execute": "execute",
            END: END,
        },
    )

    builder.add_edge("execute", END)

    return builder.compile(
        checkpointer=checkpointer or MemorySaver()
    )


# ---------------------------------------------------------------------------
# Local PDF RAG (Chroma + HuggingFace embeddings)
# ---------------------------------------------------------------------------

def build_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)


def ingest_pdfs(
    pdf_dir: Path | str = PDF_DIR,
    persist_dir: Path | str = CHROMA_DIR,
) -> Chroma:
    """Chunk + embed every PDF in pdf_dir and persist it to a local Chroma store."""
    pdf_dir = Path(pdf_dir)
    persist_dir = Path(persist_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)

    pdf_paths = sorted(pdf_dir.glob("*.pdf")) if pdf_dir.exists() else []
    if not pdf_paths:
        raise FileNotFoundError(
            f"No PDFs found in {pdf_dir}. Drop fintech annual reports, "
            "investor presentations, or risk disclosures there before ingesting."
        )

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = []
    for pdf_path in pdf_paths:
        pages = PyPDFLoader(str(pdf_path)).load()
        for page in pages:
            page.metadata["source"] = pdf_path.name
        chunks.extend(splitter.split_documents(pages))

    return Chroma.from_documents(
        chunks,
        embedding=build_embeddings(),
        persist_directory=str(persist_dir),
    )


def get_vectorstore(persist_dir: Path | str = CHROMA_DIR) -> Chroma:
    """Load the persisted local Chroma store, ingesting PDFs on first run."""
    persist_dir = Path(persist_dir)
    embeddings = build_embeddings()

    if persist_dir.exists() and any(persist_dir.iterdir()):
        return Chroma(persist_directory=str(persist_dir), embedding_function=embeddings)

    return ingest_pdfs(persist_dir=persist_dir)


# ---------------------------------------------------------------------------
# Local SQLite (structured fintech data)
# ---------------------------------------------------------------------------

def init_fintech_db(db_path: Path | str = DB_PATH) -> None:
    """Create the fintech schema and seed demo rows if the database is empty."""
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                sector TEXT
            );

            CREATE TABLE IF NOT EXISTS financial_metrics (
                id INTEGER PRIMARY KEY,
                company TEXT NOT NULL,
                year INTEGER NOT NULL,
                revenue REAL,
                profit REAL
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                company TEXT NOT NULL,
                product_name TEXT NOT NULL,
                category TEXT
            );

            CREATE TABLE IF NOT EXISTS risks (
                id INTEGER PRIMARY KEY,
                company TEXT NOT NULL,
                risk_description TEXT NOT NULL,
                severity TEXT
            );
            """
        )

        if conn.execute("SELECT COUNT(*) FROM financial_metrics").fetchone()[0] == 0:
            conn.executemany(
                "INSERT INTO companies (name, sector) VALUES (?, ?)",
                [("DemoFintech Ltd", "Digital Payments")],
            )
            conn.executemany(
                "INSERT INTO financial_metrics (company, year, revenue, profit) VALUES (?, ?, ?, ?)",
                [
                    ("DemoFintech Ltd", 2023, 1200, 180),
                    ("DemoFintech Ltd", 2024, 1550, 250),
                ],
            )
            conn.executemany(
                "INSERT INTO products (company, product_name, category) VALUES (?, ?, ?)",
                [
                    ("DemoFintech Ltd", "UPI Payments", "Payments"),
                    ("DemoFintech Ltd", "Merchant Lending", "Credit"),
                ],
            )
            conn.executemany(
                "INSERT INTO risks (company, risk_description, severity) VALUES (?, ?, ?)",
                [
                    ("DemoFintech Ltd", "Regulatory changes to UPI fee structure", "High"),
                    ("DemoFintech Ltd", "Cybersecurity and data-protection exposure", "Medium"),
                ],
            )

        conn.commit()


def _query(db_path: Path | str, sql: str, params: tuple = ()) -> list[dict]:
    init_fintech_db(db_path)
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def query_financial_metrics(company: str, db_path: Path | str = DB_PATH) -> list[dict]:
    return _query(
        db_path,
        "SELECT year, revenue, profit FROM financial_metrics WHERE company = ? ORDER BY year",
        (company,),
    )


def query_products(company: str, db_path: Path | str = DB_PATH) -> list[dict]:
    return _query(
        db_path,
        "SELECT product_name, category FROM products WHERE company = ?",
        (company,),
    )


def query_risks(company: str, db_path: Path | str = DB_PATH) -> list[dict]:
    return _query(
        db_path,
        "SELECT risk_description, severity FROM risks WHERE company = ?",
        (company,),
    )


class SupervisorState(TypedDict, total=False):
    question: str
    company: str

    # IMPORTANT: reducer for parallel researchers
    research_notes: Annotated[list[str], operator.add]

    draft: str
    qa_notes: str
    final: str
    mode: Literal["research", "write", "qa", "done"]


def supervisor_route(state: SupervisorState):
    if not state.get("research_notes"):
        return "fanout"

    if not state.get("draft"):
        return "writer"

    if not state.get("qa_notes"):
        return "qa"

    return END


def fanout_research(state: SupervisorState):
    company = state.get("company") or state.get("question", "")
    question = state.get("question", "")

    return [
        Send(
            "pdf_researcher",
            {
                "question": question,
                "company": company,
            },
        ),
        Send(
            "sqlite_researcher",
            {
                "question": question,
                "company": company,
            },
        ),
    ]


def pdf_researcher(state: SupervisorState):
    """RAG over locally-indexed fintech PDFs (annual reports, risk disclosures, etc.)."""
    question = state.get("question", "")

    vectorstore = get_vectorstore()
    docs = vectorstore.as_retriever(search_kwargs={"k": 4}).invoke(question)

    if not docs:
        return {"research_notes": ["No relevant passages found in the indexed PDFs."]}

    context = "\n\n".join(
        f"[{doc.metadata.get('source', 'pdf')} p.{doc.metadata.get('page', '?')}] {doc.page_content}"
        for doc in docs
    )

    llm = build_groq_model()
    if llm is None:
        raise RuntimeError("Set GROQ_API_KEY to run the PDF researcher.")

    summary_prompt = (
        "You are a fintech research analyst. Read the PDF excerpts below and "
        "extract 3-5 short, factual bullet notes that help answer the question. "
        "One fact per line, no preamble, no numbering.\n\n"
        f"Question: {question}\n\nPDF excerpts:\n{context}"
    )

    response = llm.invoke(summary_prompt)
    notes = [
        line.strip("-• ").strip()
        for line in response.content.splitlines()
        if line.strip()
    ]

    return {"research_notes": notes}


def sqlite_researcher(state: SupervisorState):
    """Structured lookups against the local fintech SQLite database."""
    question = state.get("question", "").lower()
    company = state.get("company", "")

    notes: list[str] = []

    if any(word in question for word in ("revenue", "profit", "financial", "growth")):
        rows = query_financial_metrics(company)
        for prev, curr in zip(rows, rows[1:]):
            growth = (
                ((curr["revenue"] - prev["revenue"]) / prev["revenue"]) * 100
                if prev["revenue"]
                else 0
            )
            notes.append(
                f"{curr['year']}: revenue {curr['revenue']} (YoY {growth:.1f}%), "
                f"profit {curr['profit']}"
            )
        if rows and not notes:
            r = rows[0]
            notes.append(f"{r['year']}: revenue {r['revenue']}, profit {r['profit']}")

    elif any(word in question for word in ("risk", "regulatory", "compliance")):
        notes = [
            f"{r['risk_description']} (severity: {r['severity']})"
            for r in query_risks(company)
        ]

    elif "product" in question:
        notes = [
            f"{r['product_name']} ({r['category']})"
            for r in query_products(company)
        ]

    else:
        notes = [
            f"{r['year']}: revenue {r['revenue']}, profit {r['profit']}"
            for r in query_financial_metrics(company)
        ]

    return {"research_notes": notes or [f"No structured records found for {company}."]}


# fan-in join node
def gather_research(state: SupervisorState):
    return {}


def writer_node(state: SupervisorState):
    llm = build_groq_model()
    if llm is None:
        raise RuntimeError("Set GROQ_API_KEY to run the writer agent.")

    notes = state.get("research_notes", [])
    question = state.get("question", "")
    company = state.get("company", "")

    prompt = (
        "You are a fintech analyst. Using only the research notes below, write "
        f"a concise executive summary (3-4 short paragraphs) for {company} that "
        "answers the question.\n\n"
        f"Question: {question}\n\n"
        "Research notes:\n" + "\n".join(f"- {n}" for n in notes)
    )

    response = llm.invoke(prompt)

    return {"draft": "# Executive Summary\n\n" + response.content}


def qa_node(state: SupervisorState):
    llm = build_groq_model()
    if llm is None:
        raise RuntimeError("Set GROQ_API_KEY to run the QA agent.")

    draft = state.get("draft", "")
    notes = state.get("research_notes", [])

    prompt = (
        "You are a meticulous fintech QA reviewer. Check the draft report "
        "against the research notes below for factual consistency, missing "
        "information, and unsupported claims. Reply with a short bullet list "
        "of findings, or exactly 'No major issues found.' if it checks out.\n\n"
        "Research notes:\n" + "\n".join(f"- {n}" for n in notes) + "\n\n"
        f"Draft report:\n{draft}"
    )

    response = llm.invoke(prompt)
    qa_notes = response.content.strip()

    return {
        "qa_notes": qa_notes,
        "final": draft + "\n\n## QA Review\n" + qa_notes,
    }


def build_supervisor_graph(checkpointer=None):
    builder = StateGraph(SupervisorState)

    builder.add_node(
        "fanout",
        lambda state: {
            "question": state.get("question", ""),
            "company": state.get("company", ""),
        },
    )

    builder.add_node(
        "pdf_researcher",
        pdf_researcher,
    )

    builder.add_node(
        "sqlite_researcher",
        sqlite_researcher,
    )

    builder.add_node(
        "gather",
        gather_research,
    )

    builder.add_node(
        "writer",
        writer_node,
    )

    builder.add_node(
        "qa",
        qa_node,
    )

    builder.add_edge(START, "fanout")

    builder.add_conditional_edges(
        "fanout",
        fanout_research,
        [
            "pdf_researcher",
            "sqlite_researcher",
        ],
    )

    # fan-in
    builder.add_edge(
        "pdf_researcher",
        "gather",
    )

    builder.add_edge(
        "sqlite_researcher",
        "gather",
    )

    builder.add_edge(
        "gather",
        "writer",
    )

    builder.add_edge(
        "writer",
        "qa",
    )

    builder.add_edge(
        "qa",
        END,
    )

    return builder.compile(
        checkpointer=checkpointer or MemorySaver()
    )


def run_supervisor_demo(
    question: str,
    company: str = "DemoFintech Ltd",
    thread_id: str = "demo",
):
    graph = build_supervisor_graph()

    return graph.invoke(
        {
            "question": question,
            "company": company,
        },
        {
            "configurable": {
                "thread_id": thread_id,
            }
        },
    )


def rows_from_agent_summary(summary: str) -> list[dict[str, str]]:
    return rows_from_summary(summary)


def create_mcp_tool_agent(
    tools: list[Any],
    model: Any | None = None,
):
    llm = model or build_groq_model()

    if llm is None:
        raise RuntimeError(
            "Set GROQ_API_KEY to run the tool-using agent."
        )

    return create_agent(
        llm,
        tools=tools,
    )
