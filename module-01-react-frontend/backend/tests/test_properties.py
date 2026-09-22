# Feature: module-01-react-frontend, Property 4: requirements.txt uses == version specifiers only
# Feature: module-01-react-frontend, Property 2: Backend startup rejects missing environment variables
# Feature: module-01-react-frontend, Property 5: Chain endpoint maps query to correct input key
# Feature: module-01-react-frontend, Property 6: Route endpoint always returns a valid category
# Feature: module-01-react-frontend, Property 7: Backend returns 422 for invalid request bodies

"""
Property-based tests for the module-01-react-frontend backend.

Properties covered:
  2 - Backend startup rejects missing environment variables (Req 3.4)
  4 - requirements.txt uses == version specifiers only (Req 14.9)
  5 - Chain endpoint maps query to correct input key (Req 2.6)
  6 - Route endpoint always returns a valid category (Req 2.7)
  7 - Backend returns 422 for invalid request bodies (Req 2.10)
"""

import io
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

# ---------------------------------------------------------------------------
# Shared setup — set required env vars BEFORE importing the FastAPI app so
# the lifespan validator does not call sys.exit(1) during test collection.
# ---------------------------------------------------------------------------

os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("LANGCHAIN_API_KEY", "test-langchain-key")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "test-project")

# Ensure the backend directory is on sys.path
_backend_path = str(Path(__file__).resolve().parent.parent)
if _backend_path not in sys.path:
    sys.path.insert(0, _backend_path)

from fastapi.testclient import TestClient  # noqa: E402
from main import REQUIRED_VARS, app, validate_env_vars  # noqa: E402

# Single shared TestClient used by Properties 5, 6, 7
_test_client = TestClient(app, raise_server_exceptions=False)

REQUIREMENTS_TXT = Path(__file__).resolve().parent.parent / "requirements.txt"

_VALID_CATEGORIES = {"technical", "creative", "general"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_requirement_lines() -> list[str]:
    """Return all non-comment, non-blank lines from requirements.txt."""
    lines = []
    with open(REQUIREMENTS_TXT, encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                lines.append(stripped)
    return lines


_REQUIREMENT_LINES = _get_requirement_lines()


# ---------------------------------------------------------------------------
# Property 4: requirements.txt uses == version specifiers only
# Validates: Req 14.9
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    len(_REQUIREMENT_LINES) == 0,
    reason="requirements.txt has no non-comment, non-blank lines",
)
@settings(max_examples=100)
@given(st.sampled_from(_REQUIREMENT_LINES))
def test_requirements_txt_uses_exact_version_pins(line: str) -> None:
    """
    Property 4: For any non-comment, non-blank line in requirements.txt,
    the line must contain '==' and must NOT contain '>=', '~=', '<=', '!='.

    Validates: Req 14.9
    """
    assert "==" in line, f"Line does not use '==' version specifier: {line!r}"

    for op in [">=", "~=", "<=", "!="]:
        assert op not in line, f"Line uses forbidden operator {op!r}: {line!r}"


# ---------------------------------------------------------------------------
# Property 2: Backend startup rejects missing environment variables
# Validates: Req 3.4
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(st.frozensets(st.sampled_from(REQUIRED_VARS), min_size=1))
def test_validate_env_vars_returns_all_missing(missing_subset: frozenset) -> None:
    """
    Property 2 (part a): For any non-empty subset of the four required
    environment variables that are absent from the environment, validate_env_vars
    SHALL return exactly those variable names.

    Validates: Req 3.4
    """
    env: dict[str, str] = {
        v: "dummy-value" for v in REQUIRED_VARS if v not in missing_subset
    }
    result = validate_env_vars(REQUIRED_VARS, env)

    for var in missing_subset:
        assert var in result, (
            f"Expected missing var {var!r} to be reported, but result was {result!r}"
        )
    assert set(result) == set(missing_subset), (
        f"validate_env_vars reported unexpected vars. "
        f"Expected {set(missing_subset)!r}, got {set(result)!r}"
    )


@settings(max_examples=100)
@given(st.frozensets(st.sampled_from(REQUIRED_VARS), min_size=1))
def test_startup_logs_each_missing_var_to_stderr_and_exits(
    missing_subset: frozenset,
) -> None:
    """
    Property 2 (part b): For any non-empty subset of the four required
    environment variables that are absent at startup, the backend SHALL log an
    error message to stderr that names each missing variable AND SHALL call
    sys.exit with a non-zero status code.

    Validates: Req 3.4
    """
    present_env: dict[str, str] = {
        v: "dummy-value" for v in REQUIRED_VARS if v not in missing_subset
    }
    env_overrides = {v: "" for v in missing_subset}
    env_overrides.update(present_env)

    stderr_capture = io.StringIO()

    with (
        patch.dict(os.environ, env_overrides, clear=False),
        patch("sys.exit") as mock_exit,
        patch("sys.stderr", stderr_capture),
    ):
        for var in missing_subset:
            os.environ.pop(var, None)

        missing = validate_env_vars(REQUIRED_VARS, dict(os.environ))

        if missing:
            for var in missing:
                print(f"Missing required environment variable: {var}", file=sys.stderr)
            sys.exit(1)

    stderr_output = stderr_capture.getvalue()

    for var in missing_subset:
        assert var in stderr_output, (
            f"Expected stderr to contain {var!r}, but got: {stderr_output!r}"
        )

    mock_exit.assert_called_once()
    exit_code = mock_exit.call_args[0][0]
    assert exit_code != 0, (
        f"Expected sys.exit to be called with a non-zero code, got {exit_code!r}"
    )


# ---------------------------------------------------------------------------
# Property 5: Chain endpoint maps query to correct input key
# Validates: Req 2.6
# ---------------------------------------------------------------------------

@settings(max_examples=100, deadline=None)
@given(
    st.sampled_from(["basic", "json", "pydantic"]),
    st.text(min_size=1, max_size=500),
)
def test_chain_input_key_mapping(chain_type: str, query: str) -> None:
    """
    Property 5: For any chain_type and any non-empty query string,
    POST /api/steps/4/chain SHALL pass the query under "question" for
    "basic"/"json" and under "query" for "pydantic".

    Validates: Req 2.6
    """
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = "mocked output"

    mock_pydantic_chain = MagicMock()
    pydantic_result = MagicMock()
    pydantic_result.model_dump.return_value = {
        "category": "technical",
        "confidence": 0.9,
        "reasoning": "test",
    }
    mock_pydantic_chain.invoke.return_value = pydantic_result

    with (
        patch("chains.make_basic_chain", return_value=mock_chain),
        patch("chains.make_json_chain", return_value=mock_chain),
        patch("chains.make_pydantic_chain", return_value=mock_pydantic_chain),
    ):
        response = _test_client.post(
            "/api/steps/4/chain",
            json={"chain_type": chain_type, "query": query},
        )

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    if chain_type == "pydantic":
        mock_pydantic_chain.invoke.assert_called_with({"query": query})
    else:
        mock_chain.invoke.assert_called_with({"question": query})


# ---------------------------------------------------------------------------
# Property 6: Route endpoint always returns a valid category
# Validates: Req 2.7
# ---------------------------------------------------------------------------

@settings(max_examples=100, deadline=None)
@given(
    query=st.text(min_size=1, max_size=500),
    mocked_category=st.sampled_from(["technical", "creative", "general"]),
)
def test_route_endpoint_returns_valid_category(
    query: str, mocked_category: str
) -> None:
    """
    Property 6: For any non-empty query string, POST /api/steps/5/route SHALL
    return a category in {"technical","creative","general"} and a non-empty response.

    Validates: Req 2.7
    """
    mock_routing_chain = MagicMock()
    mock_routing_chain.invoke.return_value = "mocked response text"

    with (
        patch("classify_query.classify_query", return_value=mocked_category),
        patch("classify_query.routing_chain", mock_routing_chain),
    ):
        response = _test_client.post("/api/steps/5/route", json={"query": query})

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    body = response.json()
    assert "category" in body, f"Response missing 'category' field: {body}"
    assert "response" in body, f"Response missing 'response' field: {body}"
    assert body["category"] in _VALID_CATEGORIES, (
        f"category {body['category']!r} is not one of {_VALID_CATEGORIES}"
    )
    assert isinstance(body["response"], str) and len(body["response"]) > 0, (
        f"'response' field must be a non-empty string, got: {body['response']!r}"
    )


# ---------------------------------------------------------------------------
# Property 7: Backend returns 422 for invalid request bodies
# Validates: Req 2.10
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    invalid_body=st.one_of(
        st.just({"chain_type": "basic"}),
        st.just({"chain_type": "json"}),
        st.just({"chain_type": "pydantic"}),
        st.just({"chain_type": "basic", "query": ""}),
        st.just({"chain_type": "json", "query": ""}),
        st.just({"chain_type": "pydantic", "query": ""}),
        st.just({"query": "hello"}),
        st.just({"chain_type": "invalid", "query": "hello"}),
        st.just({"chain_type": "", "query": "hello"}),
        st.just({"chain_type": "BASIC", "query": "hello"}),
        st.just({}),
    )
)
def test_chain_step_returns_422_for_invalid_body(invalid_body: dict) -> None:
    """
    Property 7 (steps/4/chain): For any request body that violates the schema,
    the backend SHALL return HTTP 422 with a `detail` field.

    Validates: Req 2.10
    """
    response = _test_client.post("/api/steps/4/chain", json=invalid_body)
    assert response.status_code == 422, (
        f"Expected 422 for invalid body {invalid_body!r}, got {response.status_code}"
    )
    data = response.json()
    assert "detail" in data, (
        f"Response for invalid body {invalid_body!r} missing 'detail' field: {data!r}"
    )


@settings(max_examples=100)
@given(
    invalid_body=st.one_of(
        st.just({}),
        st.just({"query": ""}),
        st.just({"query": None}),
        st.just({"query": 123}),
        st.just({"query": []}),
    )
)
def test_route_step_returns_422_for_invalid_body(invalid_body: dict) -> None:
    """
    Property 7 (steps/5/route): For any request body that violates the schema,
    the backend SHALL return HTTP 422 with a `detail` field.

    Validates: Req 2.10
    """
    response = _test_client.post("/api/steps/5/route", json=invalid_body)
    assert response.status_code == 422, (
        f"Expected 422 for invalid body {invalid_body!r}, got {response.status_code}"
    )
    data = response.json()
    assert "detail" in data, (
        f"Response for invalid body {invalid_body!r} missing 'detail' field: {data!r}"
    )


# ---------------------------------------------------------------------------
# Legacy endpoint property tests (kept for backward compat)
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    invalid_body=st.one_of(
        st.just({"chain_type": "basic"}),
        st.just({"chain_type": "basic", "query": ""}),
        st.just({"query": "hello"}),
        st.just({"chain_type": "invalid", "query": "hello"}),
        st.just({}),
    )
)
def test_chain_invoke_legacy_returns_422_for_invalid_body(invalid_body: dict) -> None:
    """Legacy /api/chain/invoke also returns 422 for invalid bodies."""
    response = _test_client.post("/api/chain/invoke", json=invalid_body)
    assert response.status_code == 422
    assert "detail" in response.json()


@settings(max_examples=100)
@given(
    invalid_body=st.one_of(
        st.just({}),
        st.just({"query": ""}),
        st.just({"query": None}),
    )
)
def test_classify_legacy_returns_422_for_invalid_body(invalid_body: dict) -> None:
    """Legacy /api/classify also returns 422 for invalid bodies."""
    response = _test_client.post("/api/classify", json=invalid_body)
    assert response.status_code == 422
    assert "detail" in response.json()


@settings(max_examples=100, deadline=None)
@given(
    st.sampled_from(["basic", "json", "pydantic"]),
    st.text(min_size=1, max_size=500),
)
def test_chain_input_key_mapping_legacy(chain_type: str, query: str) -> None:
    """Legacy /api/chain/invoke also maps input keys correctly."""
    mock_chain = MagicMock()
    mock_chain.invoke.return_value = "mocked output"

    mock_pydantic_chain = MagicMock()
    pydantic_result = MagicMock()
    pydantic_result.model_dump.return_value = {
        "category": "technical",
        "confidence": 0.9,
        "reasoning": "test",
    }
    mock_pydantic_chain.invoke.return_value = pydantic_result

    with (
        patch("chains.make_basic_chain", return_value=mock_chain),
        patch("chains.make_json_chain", return_value=mock_chain),
        patch("chains.make_pydantic_chain", return_value=mock_pydantic_chain),
    ):
        response = _test_client.post(
            "/api/chain/invoke",
            json={"chain_type": chain_type, "query": query},
        )

    assert response.status_code == 200

    if chain_type == "pydantic":
        mock_pydantic_chain.invoke.assert_called_with({"query": query})
    else:
        mock_chain.invoke.assert_called_with({"question": query})


@settings(max_examples=100, deadline=None)
@given(
    query=st.text(min_size=1, max_size=500),
    mocked_category=st.sampled_from(["technical", "creative", "general"]),
)
def test_classify_endpoint_returns_valid_category(
    query: str, mocked_category: str
) -> None:
    """Legacy /api/classify also returns valid category."""
    mock_routing_chain = MagicMock()
    mock_routing_chain.invoke.return_value = "mocked response text"

    with (
        patch("classify_query.classify_query", return_value=mocked_category),
        patch("classify_query.routing_chain", mock_routing_chain),
    ):
        response = _test_client.post("/api/classify", json={"query": query})

    assert response.status_code == 200
    body = response.json()
    assert body["category"] in _VALID_CATEGORIES
    assert isinstance(body["response"], str) and len(body["response"]) > 0
