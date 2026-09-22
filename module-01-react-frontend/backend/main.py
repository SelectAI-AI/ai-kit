"""
FastAPI backend for Module 01 React frontend.
Wraps chains.py, classify_query.py, and eval_utils.py from module-01-foundations/.

Key resolution order (per request):
  1. Request header  (student-provided via the browser UI)
  2. Environment variable  (local dev / server-side fallback)
"""

import os
import sys
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from typing import Any, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Load environment variables from .env before anything reads os.environ
load_dotenv()

# Inject module-01-foundations/ onto sys.path so we can import chains, etc.
_foundations_path = str(Path(__file__).resolve().parent.parent.parent / "module-01-foundations")
if _foundations_path not in sys.path:
    sys.path.insert(0, _foundations_path)

# ---------------------------------------------------------------------------
# Required environment variables
# ---------------------------------------------------------------------------

REQUIRED_VARS = [
    "GROQ_API_KEY",
    "LANGCHAIN_API_KEY",
    "LANGCHAIN_TRACING_V2",
    "LANGCHAIN_PROJECT",
]


def validate_env_vars(
    required_vars: list[str],
    env: dict[str, str],
) -> list[str]:
    """Return variable names that are absent or empty in *env*."""
    return [v for v in required_vars if not env.get(v)]


def resolve_keys(request: Request) -> dict[str, str]:
    """Resolve API keys from request headers, falling back to env vars.

    Header → env var mapping:
      x-groq-api-key          → GROQ_API_KEY
      x-langchain-api-key     → LANGCHAIN_API_KEY
      x-langchain-tracing-v2  → LANGCHAIN_TRACING_V2
      x-langchain-project     → LANGCHAIN_PROJECT
    """
    h = request.headers
    return {
        "GROQ_API_KEY":          h.get("x-groq-api-key")         or os.environ.get("GROQ_API_KEY", ""),
        "LANGCHAIN_API_KEY":     h.get("x-langchain-api-key")    or os.environ.get("LANGCHAIN_API_KEY", ""),
        "LANGCHAIN_TRACING_V2":  h.get("x-langchain-tracing-v2") or os.environ.get("LANGCHAIN_TRACING_V2", ""),
        "LANGCHAIN_PROJECT":     h.get("x-langchain-project")    or os.environ.get("LANGCHAIN_PROJECT", ""),
    }


@contextmanager
def _apply_keys(keys: dict[str, str]):
    """Temporarily set student keys in os.environ so LangChain picks them up."""
    old = {k: os.environ.get(k) for k in keys}
    for k, v in keys.items():
        if v:
            os.environ[k] = v
    try:
        yield
    finally:
        for k, old_v in old.items():
            if old_v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = old_v


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ApiStatusResponse(BaseModel):
    connected: bool
    langsmith_project: Optional[str] = None
    groq_model: str

class CheckEnvResponse(BaseModel):
    vars_present: list[str]
    vars_missing: list[str]

class InvokeModelRequest(BaseModel):
    query: str = Field(min_length=1)
    temperature: float = Field(ge=0.0, le=1.0)

class InvokeModelResponse(BaseModel):
    response: str
    input_tokens: int
    output_tokens: int
    total_tokens: int

class PromptTechniqueRequest(BaseModel):
    technique: Literal["zero_shot", "few_shot", "cot", "role", "json_output", "multi_step"]
    user_input: str = Field(min_length=1)

class PromptTechniqueResponse(BaseModel):
    response: str
    technique: str

class InvokeChainRequest(BaseModel):
    chain_type: Literal["basic", "json", "pydantic"]
    query: str = Field(min_length=1)

class InvokeChainResponse(BaseModel):
    output: Any
    chain_type: str

class RouteQueryRequest(BaseModel):
    query: str = Field(min_length=1)

class RouteQueryResponse(BaseModel):
    category: str
    response: str

class DimScores(BaseModel):
    correctness: float
    relevance: float

class EvalResultsResponse(BaseModel):
    dataset_name: str
    example_count: int
    aggregate_score: float
    dim_scores: DimScores
    has_results: bool

class HealthResponse(BaseModel):
    status: str

# Legacy models
class ClassifyRequest(BaseModel):
    query: str = Field(min_length=1)

class ClassifyResponse(BaseModel):
    category: str
    response: str

# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # In hosted mode env vars are optional — students supply keys via headers.
    # Set STRICT_ENV=true for local dev to enforce env var presence at startup.
    if os.environ.get("STRICT_ENV", "").lower() == "true":
        missing = validate_env_vars(REQUIRED_VARS, dict(os.environ))
        if missing:
            for var in missing:
                print(f"Missing required environment variable: {var}", file=sys.stderr)
            sys.exit(1)
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Module 01 Backend", lifespan=lifespan)

_allowed_origins = ["http://localhost:5173"]
_extra = os.environ.get("ALLOWED_ORIGINS", "")
if _extra:
    _allowed_origins.extend([o.strip() for o in _extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "x-groq-api-key", "x-langchain-api-key",
                   "x-langchain-tracing-v2", "x-langchain-project"],
)

# ---------------------------------------------------------------------------
# Spec endpoints
# ---------------------------------------------------------------------------

@app.get("/api/status", response_model=ApiStatusResponse)
async def get_status(request: Request):
    keys = resolve_keys(request)
    all_present = all(keys.get(v) for v in REQUIRED_VARS)
    return ApiStatusResponse(
        connected=all_present,
        langsmith_project=keys.get("LANGCHAIN_PROJECT") or None,
        groq_model="llama3-8b-8192",
    )


@app.post("/api/steps/1/check-env", response_model=CheckEnvResponse)
async def check_env(request: Request):
    keys = resolve_keys(request)
    present = [v for v in REQUIRED_VARS if keys.get(v)]
    missing = [v for v in REQUIRED_VARS if not keys.get(v)]
    return CheckEnvResponse(vars_present=present, vars_missing=missing)


@app.post("/api/steps/2/invoke", response_model=InvokeModelResponse)
async def invoke_model(request: Request, body: InvokeModelRequest):
    keys = resolve_keys(request)
    if not keys.get("GROQ_API_KEY"):
        raise HTTPException(status_code=503,
                            detail="Missing required environment variable: GROQ_API_KEY")
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage
        with _apply_keys(keys):
            llm = ChatGroq(model="llama3-8b-8192", temperature=body.temperature)
            result = llm.invoke([HumanMessage(content=body.query)])
        usage = getattr(result, "usage_metadata", {}) or {}
        return InvokeModelResponse(
            response=result.content,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
        )
    except Exception as exc:
        if "GROQ_API_KEY" in str(exc) or not keys.get("GROQ_API_KEY"):
            raise HTTPException(status_code=503,
                                detail="Missing required environment variable: GROQ_API_KEY") from exc
        raise HTTPException(status_code=500, detail=f"Model invocation failed: {exc}") from exc


@app.post("/api/steps/3/prompt", response_model=PromptTechniqueResponse)
async def run_prompt(request: Request, body: PromptTechniqueRequest):
    keys = resolve_keys(request)
    if not keys.get("GROQ_API_KEY"):
        raise HTTPException(status_code=503,
                            detail="Missing required environment variable: GROQ_API_KEY")
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage

        technique = body.technique
        user_input = body.user_input

        if technique == "zero_shot":
            messages = [HumanMessage(content=f"Answer the following question:\n\n{user_input}")]
        elif technique == "few_shot":
            messages = [HumanMessage(content=(
                "Here are some examples:\n"
                "Q: What is 2+2? A: 4\n"
                "Q: What is the capital of France? A: Paris\n\n"
                f"Now answer: {user_input}"
            ))]
        elif technique == "cot":
            messages = [HumanMessage(content=(
                f"Think through this step-by-step:\n\n{user_input}\n\n"
                "Show your reasoning, then provide your Final Answer:"
            ))]
        elif technique == "role":
            messages = [
                SystemMessage(content="You are an expert AI/ML engineer with deep knowledge of LangChain and LLM systems."),
                HumanMessage(content=user_input),
            ]
        elif technique == "json_output":
            messages = [HumanMessage(content=(
                f"Answer the following and return your response as a JSON object "
                f"with keys 'answer' and 'confidence' (0.0-1.0):\n\n{user_input}"
            ))]
        else:  # multi_step
            messages = [HumanMessage(content=(
                f"Step 1: Identify the key concepts in this question: {user_input}\n"
                f"Step 2: Using those concepts, provide a comprehensive answer."
            ))]

        with _apply_keys(keys):
            llm = ChatGroq(model="llama3-8b-8192", temperature=0.7)
            result = llm.invoke(messages)
        return PromptTechniqueResponse(response=result.content, technique=technique)
    except Exception as exc:
        if "GROQ_API_KEY" in str(exc) or not keys.get("GROQ_API_KEY"):
            raise HTTPException(status_code=503,
                                detail="Missing required environment variable: GROQ_API_KEY") from exc
        raise HTTPException(status_code=500, detail=f"Prompt invocation failed: {exc}") from exc


@app.post("/api/steps/4/chain", response_model=InvokeChainResponse)
async def invoke_chain_step(request: Request, body: InvokeChainRequest):
    keys = resolve_keys(request)
    if not keys.get("GROQ_API_KEY"):
        raise HTTPException(status_code=503,
                            detail="Missing required environment variable: GROQ_API_KEY")
    input_data = {"query": body.query} if body.chain_type == "pydantic" else {"question": body.query}
    try:
        from chains import make_basic_chain, make_json_chain, make_pydantic_chain, QueryAnalysis
        with _apply_keys(keys):
            if body.chain_type == "basic":
                output = make_basic_chain().invoke(input_data)
            elif body.chain_type == "json":
                output = make_json_chain().invoke(input_data)
            else:
                result = make_pydantic_chain(QueryAnalysis).invoke(input_data)
                output = result.model_dump()
    except Exception as exc:
        if "GROQ_API_KEY" in str(exc) or not keys.get("GROQ_API_KEY"):
            raise HTTPException(status_code=503,
                                detail="Missing required environment variable: GROQ_API_KEY") from exc
        raise HTTPException(status_code=500, detail=f"Chain invocation failed: {exc}") from exc
    return InvokeChainResponse(output=output, chain_type=body.chain_type)


@app.post("/api/steps/5/route", response_model=RouteQueryResponse)
async def route_query(request: Request, body: RouteQueryRequest):
    keys = resolve_keys(request)
    if not keys.get("GROQ_API_KEY"):
        raise HTTPException(status_code=503,
                            detail="Missing required environment variable: GROQ_API_KEY")
    try:
        from classify_query import classify_query, routing_chain
        with _apply_keys(keys):
            category = classify_query(body.query)
            response_text = routing_chain.invoke(body.query)
        return RouteQueryResponse(category=category, response=response_text)
    except Exception as exc:
        if "GROQ_API_KEY" in str(exc) or not keys.get("GROQ_API_KEY"):
            raise HTTPException(status_code=503,
                                detail="Missing required environment variable: GROQ_API_KEY") from exc
        raise HTTPException(status_code=500, detail=f"Routing failed: {exc}") from exc


@app.get("/api/steps/6/eval", response_model=EvalResultsResponse)
async def get_eval(request: Request):
    keys = resolve_keys(request)
    from datetime import datetime
    try:
        from langsmith import Client
        with _apply_keys(keys):
            client = Client()
            experiments = list(
                client.list_projects(reference_dataset_name="module-01-week1-checkpoint")
            )
        if not experiments:
            return EvalResultsResponse(
                has_results=False, aggregate_score=0.0,
                dim_scores=DimScores(correctness=0.0, relevance=0.0),
                dataset_name="module-01-week1-checkpoint", example_count=0,
            )
        latest = max(experiments, key=lambda e: e.start_time or datetime.min)
        feedback_stats = latest.feedback_stats or {}
        correctness = feedback_stats.get("correctness", {}).get("avg", 0.0) or 0.0
        relevance = feedback_stats.get("relevance", {}).get("avg", 0.0) or 0.0
        return EvalResultsResponse(
            has_results=True,
            aggregate_score=(correctness + relevance) / 2,
            dim_scores=DimScores(correctness=correctness, relevance=relevance),
            dataset_name="module-01-week1-checkpoint",
            example_count=latest.run_count or 0,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="LangSmith service unreachable") from exc


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok")


# ---------------------------------------------------------------------------
# Legacy routes
# ---------------------------------------------------------------------------

@app.post("/api/chain/invoke", response_model=InvokeChainResponse)
async def invoke_chain_legacy(request: Request, body: InvokeChainRequest):
    return await invoke_chain_step(request, body)


@app.post("/api/classify", response_model=ClassifyResponse)
async def classify_legacy(request: Request, body: ClassifyRequest):
    keys = resolve_keys(request)
    try:
        from classify_query import classify_query, routing_chain
        with _apply_keys(keys):
            category = classify_query(body.query)
            response_text = routing_chain.invoke(body.query)
        return ClassifyResponse(category=category, response=response_text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Classification failed: {exc}") from exc


@app.get("/api/eval/results", response_model=EvalResultsResponse)
async def eval_results_legacy(request: Request):
    return await get_eval(request)
