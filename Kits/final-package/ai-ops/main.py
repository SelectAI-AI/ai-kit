"""
DiffSage -- Kestrel Software's AI pull-request review agent.
FastAPI deployment reference: /invoke + /stream, auto-trace middleware,
aiosqlite connection pooling, LangGraph checkpointer + threads.
"""
import asyncio
import hashlib
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, List, Literal, Optional, TypedDict

import aiosqlite
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage, HumanMessage
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, StateGraph
from pydantic import BaseModel

load_dotenv()

GROQ_LIVE = bool(os.getenv("GROQ_API_KEY"))
TAVILY_LIVE = bool(os.getenv("TAVILY_API_KEY"))
LANGSMITH_LIVE = bool(os.getenv("LANGSMITH_API_KEY")) and os.getenv("LANGSMITH_TRACING", "").lower() == "true"


def stable_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:8]


class FakeChatModel(BaseChatModel):
    def _make_reply(self, messages: List[BaseMessage]) -> str:
        last = str(messages[-1].content) if messages else ""
        seed = stable_hash(last)
        return (
            f"[offline review seed={seed}] Found 1 dependency advisory and "
            "1 style guideline note. Recommend request_changes."
        )

    def _generate(self, messages, stop=None, run_manager=None, **kwargs: Any) -> ChatResult:
        text = self._make_reply(messages)
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=text))])

    async def _astream(self, messages, stop=None, run_manager=None, **kwargs: Any) -> AsyncIterator[ChatGenerationChunk]:
        text = self._make_reply(messages)
        for word in text.split(" "):
            await asyncio.sleep(0)
            yield ChatGenerationChunk(message=AIMessageChunk(content=word + " "))

    @property
    def _llm_type(self) -> str:
        return "fake-chat-model"


def build_chat_model() -> BaseChatModel:
    if GROQ_LIVE:
        from langchain_groq import ChatGroq
        return ChatGroq(model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"), api_key=os.getenv("GROQ_API_KEY"), streaming=True, temperature=0.2)
    return FakeChatModel()


class DeterministicEmbedder(EmbeddingFunction):
    DIM = 64

    def __init__(self) -> None:
        pass

    def __call__(self, input: Documents) -> Embeddings:
        out = []
        for doc in input:
            vec = [0.0] * self.DIM
            for tok in doc.lower().split():
                h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
                vec[h % self.DIM] += 1.0
            norm = sum(v * v for v in vec) ** 0.5 or 1.0
            out.append([v / norm for v in vec])
        return out


STYLE_GUIDE = [
    "Wrap external HTTP calls to third-party webhooks in the shared retry decorator.",
    "Never catch bare Exception; catch the specific exception type you expect.",
    "Pin dependency versions exactly in requirements.txt, do not use loose ranges.",
    "Database queries in request handlers must go through the connection pool, never a raw sqlite3.connect call.",
    "Log request IDs, never log full request bodies for endpoints that touch customer data.",
]


def build_style_guide_collection():
    client = chromadb.Client()
    coll = client.get_or_create_collection("style_guide", embedding_function=DeterministicEmbedder())
    if coll.count() == 0:
        coll.add(ids=[f"sg{i}" for i in range(len(STYLE_GUIDE))], documents=STYLE_GUIDE)
    return coll


FAKE_ADVISORIES = {
    "requests==2.25.0": "requests==2.25.0 has a known CVE; pin >=2.31.0 instead.",
}


async def check_dependency_advisory(package_line: str) -> Optional[str]:
    if TAVILY_LIVE:
        from tavily import TavilyClient
        client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        result = await asyncio.to_thread(client.search, f"{package_line} security advisory CVE", max_results=1)
        hits = result.get("results", [])
        return hits[0]["content"][:200] if hits else None
    return FAKE_ADVISORIES.get(package_line.strip())


class SQLitePool:
    """N pooled aiosqlite connections. PRAGMA busy_timeout is required, not
    optional -- see the notebook for what happens without it."""

    def __init__(self, path: str, size: int = 5, busy_timeout_ms: int = 5000):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=size)
        self._path, self._size, self._busy_timeout_ms = path, size, busy_timeout_ms

    async def open(self) -> None:
        for _ in range(self._size):
            conn = await aiosqlite.connect(self._path)
            await conn.execute("PRAGMA journal_mode=WAL;")
            await conn.execute(f"PRAGMA busy_timeout={self._busy_timeout_ms};")
            await self._queue.put(conn)
        setup = await self.acquire()
        try:
            await setup.execute(
                "CREATE TABLE IF NOT EXISTS reviews ("
                "id TEXT PRIMARY KEY, repo TEXT, pr_number INTEGER, "
                "decision TEXT, summary TEXT, latency_ms INTEGER, created_at TEXT)"
            )
            await setup.execute(
                "CREATE TABLE IF NOT EXISTS review_comments ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, review_id TEXT, "
                "file TEXT, line INTEGER, severity TEXT, text TEXT)"
            )
            await setup.commit()
        finally:
            await self.release(setup)

    async def acquire(self):
        return await self._queue.get()

    async def release(self, conn) -> None:
        await self._queue.put(conn)

    async def close(self) -> None:
        while not self._queue.empty():
            conn = await self._queue.get()
            await conn.close()


# Postgres/asyncpg: shown for contrast only -- a lazy pool, never opened here.
#   pg_pool: "asyncpg.Pool | None" = None
#   # pg_pool = await asyncpg.create_pool(dsn=POSTGRES_DSN, min_size=5, max_size=20)


MANIFEST_FILES = {"requirements.txt", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"}


class ReviewState(TypedDict):
    repo: str
    pr_number: int
    branch: str
    files_changed: List[str]
    diff: str
    guidelines: List[str]
    advisories: List[str]
    history_note: str
    review_text: str
    decision: str
    comments: List[dict]


async def parse_diff(state: ReviewState) -> dict:
    return {}


async def retrieve_guidelines(state: ReviewState) -> dict:
    coll = build_style_guide_collection()
    query = " ".join(state["files_changed"]) + " " + state["diff"][:200]
    res = coll.query(query_texts=[query], n_results=2)
    return {"guidelines": res["documents"][0] if res["documents"] else []}


def route_after_guidelines(state: ReviewState) -> str:
    touched = set(state["files_changed"]) & MANIFEST_FILES
    return "check_dependencies" if touched else "lookup_history"


async def check_dependencies(state: ReviewState) -> dict:
    advisories = []
    for line in state["diff"].splitlines():
        line = line.strip().lstrip("+").strip()
        if not line or line.startswith(("diff", "@@", "---", "+++")):
            continue
        if "==" in line:
            note = await check_dependency_advisory(line)
            if note:
                advisories.append(note)
    return {"advisories": advisories}


async def lookup_history(state: ReviewState, pool: SQLitePool) -> dict:
    conn = await pool.acquire()
    try:
        cur = await conn.execute("SELECT decision, COUNT(*) FROM reviews WHERE repo = ? GROUP BY decision", (state["repo"],))
        rows = await cur.fetchall()
    finally:
        await pool.release(conn)
    if not rows:
        return {"history_note": "no prior reviews for this repo"}
    return {"history_note": "past outcomes: " + ", ".join(f"{c} {d}" for d, c in rows)}


async def synthesize_review(state: ReviewState, model: BaseChatModel) -> dict:
    prompt = (
        f"Review this diff for repo {state['repo']} PR #{state['pr_number']}.\n"
        f"Style guidelines: {state['guidelines']}\n"
        f"Dependency advisories: {state['advisories']}\n"
        f"History: {state['history_note']}\n"
        f"Diff:\n{state['diff']}"
    )
    resp = await model.ainvoke([HumanMessage(content=prompt)])
    decision = "request_changes" if state["advisories"] or state["guidelines"] else "approve"
    comments = []
    if state["advisories"]:
        comments.append({"file": "requirements.txt", "line": 1, "severity": "warning", "text": state["advisories"][0]})
    if state["guidelines"]:
        comments.append({"file": state["files_changed"][0] if state["files_changed"] else "unknown", "line": 1, "severity": "info", "text": state["guidelines"][0]})
    return {"review_text": resp.content, "decision": decision, "comments": comments}


async def persist(state: ReviewState, pool: SQLitePool, review_id: str) -> dict:
    conn = await pool.acquire()
    try:
        await conn.execute(
            "INSERT INTO reviews (id, repo, pr_number, decision, summary, latency_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
            (review_id, state["repo"], state["pr_number"], state["decision"], state["review_text"][:200], 0),
        )
        for c in state["comments"]:
            await conn.execute(
                "INSERT INTO review_comments (review_id, file, line, severity, text) VALUES (?, ?, ?, ?, ?)",
                (review_id, c["file"], c["line"], c["severity"], c["text"]),
            )
        await conn.commit()
    finally:
        await pool.release(conn)
    return {}


def build_graph(checkpointer, model: BaseChatModel, pool: SQLitePool):
    async def _lookup_history(state: ReviewState) -> dict:
        return await lookup_history(state, pool)

    async def _synthesize_review(state: ReviewState) -> dict:
        return await synthesize_review(state, model)

    async def _persist(state: ReviewState) -> dict:
        review_id = stable_hash(state["repo"] + str(state["pr_number"]) + str(time.time()))
        return await persist(state, pool, review_id)

    builder = StateGraph(ReviewState)
    builder.add_node("parse_diff", parse_diff)
    builder.add_node("retrieve_guidelines", retrieve_guidelines)
    builder.add_node("check_dependencies", check_dependencies)
    builder.add_node("lookup_history", _lookup_history)
    builder.add_node("synthesize_review", _synthesize_review)
    builder.add_node("persist", _persist)

    builder.set_entry_point("parse_diff")
    builder.add_edge("parse_diff", "retrieve_guidelines")
    builder.add_conditional_edges(
        "retrieve_guidelines", route_after_guidelines,
        {"check_dependencies": "check_dependencies", "lookup_history": "lookup_history"},
    )
    builder.add_edge("check_dependencies", "lookup_history")
    builder.add_edge("lookup_history", "synthesize_review")
    builder.add_edge("synthesize_review", "persist")
    builder.add_edge("persist", END)

    return builder.compile(checkpointer=checkpointer)


class ReviewRequest(BaseModel):
    repo: str
    pr_number: int
    branch: str = "main"
    files_changed: List[str]
    diff: str


class ReviewCommentOut(BaseModel):
    file: str
    line: int
    severity: Literal["info", "warning", "critical"]
    text: str


class ReviewResponse(BaseModel):
    request_id: str
    decision: Literal["approve", "request_changes", "comment"]
    summary: str
    comments: List[ReviewCommentOut]
    latency_ms: int


LOCAL_TRACE_LOG: List[dict] = []


class AutoTraceMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid.uuid4().hex[:8]
        start = time.perf_counter()
        scope["state"] = scope.get("state", {})
        scope["state"]["request_id"] = request_id

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                latency_ms = int((time.perf_counter() - start) * 1000)
                headers = message.setdefault("headers", [])
                headers.append((b"x-request-id", request_id.encode()))
                headers.append((b"x-latency-ms", str(latency_ms).encode()))
                if not LANGSMITH_LIVE:
                    LOCAL_TRACE_LOG.append({"request_id": request_id, "path": scope["path"], "latency_ms": latency_ms})
            await send(message)

        await self.app(scope, receive, send_wrapper)


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = SQLitePool(os.getenv("DIFFSAGE_DB", "reviews.db"))
    await pool.open()
    model = build_chat_model()

    async with AsyncSqliteSaver.from_conn_string(os.getenv("DIFFSAGE_CHECKPOINT_DB", "checkpoints.db")) as checkpointer:
        graph = build_graph(checkpointer, model, pool)
        app.state.pool = pool
        app.state.graph = graph
        app.state.mode = {
            "groq": "live" if GROQ_LIVE else "offline",
            "tavily": "live" if TAVILY_LIVE else "offline",
            "langsmith": "live" if LANGSMITH_LIVE else "offline",
        }
        yield

    await pool.close()


app = FastAPI(title="DiffSage", lifespan=lifespan)
app.add_middleware(AutoTraceMiddleware)


@app.get("/health")
async def health():
    return {"status": "ok", "mode": app.state.mode}


def _thread_config(req: ReviewRequest) -> dict:
    return {"configurable": {"thread_id": f"{req.repo}:{req.pr_number}"}}


@app.post("/invoke", response_model=ReviewResponse)
async def invoke(req: ReviewRequest, request: Request):
    t0 = time.perf_counter()
    result = await app.state.graph.ainvoke(
        {"repo": req.repo, "pr_number": req.pr_number, "branch": req.branch, "files_changed": req.files_changed, "diff": req.diff,
         "guidelines": [], "advisories": [], "history_note": "", "review_text": "", "decision": "", "comments": []},
        config=_thread_config(req),
    )
    return ReviewResponse(
        request_id=request.scope.get("state", {}).get("request_id", "unknown"),
        decision=result["decision"] or "comment",
        summary=result["review_text"][:200],
        comments=result["comments"],
        latency_ms=int((time.perf_counter() - t0) * 1000),
    )


@app.post("/stream")
async def stream(req: ReviewRequest, request: Request):
    async def event_gen():
        input_state = {
            "repo": req.repo, "pr_number": req.pr_number, "branch": req.branch,
            "files_changed": req.files_changed, "diff": req.diff,
            "guidelines": [], "advisories": [], "history_note": "", "review_text": "", "decision": "", "comments": [],
        }
        t0 = time.perf_counter()
        node_names = {"parse_diff", "retrieve_guidelines", "check_dependencies", "lookup_history", "synthesize_review", "persist"}
        async for event in app.state.graph.astream_events(input_state, config=_thread_config(req), version="v2"):
            if event["event"] == "on_chain_start" and event["name"] in node_names:
                yield f"data: {json.dumps({'event': 'node_start', 'node': event['name']})}\n\n"
            elif event["event"] == "on_chat_model_stream":
                chunk = event["data"]["chunk"].content
                if chunk:
                    yield f"data: {json.dumps({'event': 'token', 'content': chunk})}\n\n"
            elif event["event"] == "on_chain_end" and event["name"] == "LangGraph":
                output = event["data"]["output"]
                yield f"data: {json.dumps({'event': 'done', 'decision': output.get('decision'), 'latency_ms': int((time.perf_counter() - t0) * 1000)})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
