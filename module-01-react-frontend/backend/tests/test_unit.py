"""
Unit tests for the module-01-react-frontend backend.

All LLM calls are mocked — no API keys required.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure env vars are set before importing the FastAPI app
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("LANGCHAIN_API_KEY", "test-langchain-key")
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "test-project")

# Headers to simulate a student who has entered their keys in the browser
TEST_KEY_HEADERS = {
    "x-groq-api-key": "test-groq-key",
    "x-langchain-api-key": "test-langchain-key",
    "x-langchain-tracing-v2": "true",
    "x-langchain-project": "test-project",
}

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# GET /api/health
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_health_returns_200(self) -> None:
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_returns_ok_status(self) -> None:
        response = client.get("/api/health")
        assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/status
# ---------------------------------------------------------------------------

class TestStatusEndpoint:
    def test_status_returns_200(self) -> None:
        response = client.get("/api/status", headers=TEST_KEY_HEADERS)
        assert response.status_code == 200

    def test_status_connected_when_all_vars_present(self) -> None:
        response = client.get("/api/status", headers=TEST_KEY_HEADERS)
        body = response.json()
        assert body["connected"] is True
        assert body["groq_model"] == "llama3-8b-8192"
        assert body["langsmith_project"] == "test-project"

    def test_status_disconnected_when_no_keys(self) -> None:
        # No headers, no env vars
        env_without_keys = {k: v for k, v in os.environ.items()
                            if k not in ("GROQ_API_KEY", "LANGCHAIN_API_KEY",
                                         "LANGCHAIN_TRACING_V2", "LANGCHAIN_PROJECT")}
        with patch.dict(os.environ, env_without_keys, clear=True):
            response = client.get("/api/status")  # no key headers
        assert response.status_code == 200
        assert response.json()["connected"] is False


# ---------------------------------------------------------------------------
# POST /api/steps/1/check-env
# ---------------------------------------------------------------------------

class TestCheckEnvEndpoint:
    def test_check_env_returns_200(self) -> None:
        response = client.post("/api/steps/1/check-env")
        assert response.status_code == 200

    def test_check_env_returns_vars_present_and_missing(self) -> None:
        response = client.post("/api/steps/1/check-env")
        body = response.json()
        assert "vars_present" in body
        assert "vars_missing" in body
        assert isinstance(body["vars_present"], list)
        assert isinstance(body["vars_missing"], list)

    def test_check_env_all_present_when_all_set(self) -> None:
        response = client.post("/api/steps/1/check-env")
        body = response.json()
        # All four vars are set in test env
        assert len(body["vars_missing"]) == 0
        assert len(body["vars_present"]) == 4


# ---------------------------------------------------------------------------
# POST /api/steps/2/invoke
# ---------------------------------------------------------------------------

class TestInvokeModelEndpoint:
    def test_returns_503_when_groq_api_key_absent(self) -> None:
        env_without_key = {k: v for k, v in os.environ.items() if k != "GROQ_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            response = client.post(
                "/api/steps/2/invoke",
                json={"query": "test", "temperature": 0.0},
            )
        assert response.status_code == 503
        assert "GROQ_API_KEY" in response.json().get("detail", "")

    def test_returns_422_for_missing_query(self) -> None:
        response = client.post("/api/steps/2/invoke", json={"temperature": 0.0})
        assert response.status_code == 422

    def test_returns_422_for_empty_query(self) -> None:
        response = client.post("/api/steps/2/invoke", json={"query": "", "temperature": 0.0})
        assert response.status_code == 422

    def test_returns_200_with_mocked_llm(self) -> None:
        mock_result = MagicMock()
        mock_result.content = "mocked response"
        mock_result.usage_metadata = {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30}
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_result

        with patch("langchain_groq.ChatGroq", return_value=mock_llm):
            response = client.post(
                "/api/steps/2/invoke",
                json={"query": "What is LangChain?", "temperature": 0.0},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["response"] == "mocked response"
        assert body["input_tokens"] == 10
        assert body["output_tokens"] == 20
        assert body["total_tokens"] == 30


# ---------------------------------------------------------------------------
# POST /api/steps/3/prompt
# ---------------------------------------------------------------------------

class TestPromptEndpoint:
    def test_returns_503_when_groq_api_key_absent(self) -> None:
        env_without_key = {k: v for k, v in os.environ.items() if k != "GROQ_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            response = client.post(
                "/api/steps/3/prompt",
                json={"technique": "zero_shot", "user_input": "test"},
            )
        assert response.status_code == 503
        assert "GROQ_API_KEY" in response.json().get("detail", "")

    def test_returns_422_for_missing_user_input(self) -> None:
        response = client.post("/api/steps/3/prompt", json={"technique": "zero_shot"})
        assert response.status_code == 422

    def test_returns_422_for_empty_user_input(self) -> None:
        response = client.post("/api/steps/3/prompt", json={"technique": "zero_shot", "user_input": ""})
        assert response.status_code == 422

    def test_returns_422_for_invalid_technique(self) -> None:
        response = client.post("/api/steps/3/prompt", json={"technique": "invalid", "user_input": "test"})
        assert response.status_code == 422

    def test_returns_200_with_mocked_llm(self) -> None:
        mock_result = MagicMock()
        mock_result.content = "mocked prompt response"
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_result

        with patch("langchain_groq.ChatGroq", return_value=mock_llm):
            response = client.post(
                "/api/steps/3/prompt",
                json={"technique": "zero_shot", "user_input": "What is LCEL?"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["response"] == "mocked prompt response"
        assert body["technique"] == "zero_shot"


# ---------------------------------------------------------------------------
# POST /api/steps/4/chain (spec endpoint)
# ---------------------------------------------------------------------------

class TestChainStepEndpoint:
    def test_returns_503_when_groq_api_key_absent(self) -> None:
        env_without_key = {k: v for k, v in os.environ.items() if k != "GROQ_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            response = client.post(
                "/api/steps/4/chain",
                json={"chain_type": "basic", "query": "test"},
            )
        assert response.status_code == 503
        assert "GROQ_API_KEY" in response.json().get("detail", "")

    def test_returns_422_for_missing_query(self) -> None:
        response = client.post("/api/steps/4/chain", json={"chain_type": "basic"})
        assert response.status_code == 422

    def test_returns_422_for_empty_query(self) -> None:
        response = client.post("/api/steps/4/chain", json={"chain_type": "basic", "query": ""})
        assert response.status_code == 422

    def test_returns_422_for_invalid_chain_type(self) -> None:
        response = client.post("/api/steps/4/chain", json={"chain_type": "invalid", "query": "hello"})
        assert response.status_code == 422

    def test_returns_200_with_mocked_chain(self) -> None:
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = "mocked response"
        with patch("chains.make_basic_chain", return_value=mock_chain):
            response = client.post(
                "/api/steps/4/chain",
                json={"chain_type": "basic", "query": "test question"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["output"] == "mocked response"
        assert body["chain_type"] == "basic"


# ---------------------------------------------------------------------------
# POST /api/steps/5/route
# ---------------------------------------------------------------------------

class TestRouteEndpoint:
    def test_returns_503_when_groq_api_key_absent(self) -> None:
        env_without_key = {k: v for k, v in os.environ.items() if k != "GROQ_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            response = client.post("/api/steps/5/route", json={"query": "test"})
        assert response.status_code == 503
        assert "GROQ_API_KEY" in response.json().get("detail", "")

    def test_returns_422_for_missing_query(self) -> None:
        response = client.post("/api/steps/5/route", json={})
        assert response.status_code == 422

    def test_returns_422_for_empty_query(self) -> None:
        response = client.post("/api/steps/5/route", json={"query": ""})
        assert response.status_code == 422

    def test_returns_200_with_mocked_classify(self) -> None:
        mock_routing = MagicMock()
        mock_routing.invoke.return_value = "routed response"
        with (
            patch("classify_query.classify_query", return_value="technical"),
            patch("classify_query.routing_chain", mock_routing),
        ):
            response = client.post("/api/steps/5/route", json={"query": "How does LCEL work?"})
        assert response.status_code == 200
        body = response.json()
        assert body["category"] == "technical"
        assert body["response"] == "routed response"


# ---------------------------------------------------------------------------
# GET /api/steps/6/eval
# ---------------------------------------------------------------------------

class TestEvalStepEndpoint:
    def test_returns_502_when_langsmith_raises(self) -> None:
        with patch("langsmith.Client") as mock_client_cls:
            mock_client_cls.return_value.list_projects.side_effect = Exception("LangSmith unreachable")
            response = client.get("/api/steps/6/eval")
        assert response.status_code == 502
        assert "detail" in response.json()

    def test_returns_has_results_false_when_no_experiments(self) -> None:
        with patch("langsmith.Client") as mock_client_cls:
            mock_client_cls.return_value.list_projects.return_value = iter([])
            response = client.get("/api/steps/6/eval")
        assert response.status_code == 200
        body = response.json()
        assert body["has_results"] is False


# ---------------------------------------------------------------------------
# Legacy endpoints — POST /api/chain/invoke, POST /api/classify, GET /api/eval/results
# ---------------------------------------------------------------------------

class TestLegacyChainInvokeEndpoint:
    def test_returns_503_when_groq_api_key_absent(self) -> None:
        env_without_key = {k: v for k, v in os.environ.items() if k != "GROQ_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            with patch("chains.make_basic_chain") as mock_factory:
                mock_factory.side_effect = Exception("GROQ_API_KEY not set")
                response = client.post(
                    "/api/chain/invoke",
                    json={"chain_type": "basic", "query": "test"},
                )
        assert response.status_code == 503
        assert "GROQ_API_KEY" in response.json().get("detail", "")

    def test_returns_422_for_missing_query(self) -> None:
        response = client.post("/api/chain/invoke", json={"chain_type": "basic"})
        assert response.status_code == 422

    def test_returns_422_for_empty_query(self) -> None:
        response = client.post("/api/chain/invoke", json={"chain_type": "basic", "query": ""})
        assert response.status_code == 422

    def test_returns_422_for_missing_chain_type(self) -> None:
        response = client.post("/api/chain/invoke", json={"query": "hello"})
        assert response.status_code == 422

    def test_returns_422_for_invalid_chain_type(self) -> None:
        response = client.post("/api/chain/invoke", json={"chain_type": "invalid", "query": "hello"})
        assert response.status_code == 422

    def test_returns_200_with_mocked_chain(self) -> None:
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = "mocked response"
        with patch("chains.make_basic_chain", return_value=mock_chain):
            response = client.post(
                "/api/chain/invoke",
                json={"chain_type": "basic", "query": "test question"},
            )
        assert response.status_code == 200
        body = response.json()
        assert body["output"] == "mocked response"
        assert body["chain_type"] == "basic"


class TestLegacyClassifyEndpoint:
    def test_returns_422_for_missing_query(self) -> None:
        response = client.post("/api/classify", json={})
        assert response.status_code == 422

    def test_returns_422_for_empty_query(self) -> None:
        response = client.post("/api/classify", json={"query": ""})
        assert response.status_code == 422

    def test_returns_200_with_mocked_classify(self) -> None:
        mock_routing = MagicMock()
        mock_routing.invoke.return_value = "routed response"
        with (
            patch("classify_query.classify_query", return_value="technical"),
            patch("classify_query.routing_chain", mock_routing),
        ):
            response = client.post("/api/classify", json={"query": "How does LCEL work?"})
        assert response.status_code == 200
        body = response.json()
        assert body["category"] == "technical"
        assert body["response"] == "routed response"


class TestLegacyEvalResultsEndpoint:
    def test_returns_502_when_langsmith_raises(self) -> None:
        with patch("langsmith.Client") as mock_client_cls:
            mock_client_cls.return_value.list_projects.side_effect = Exception("LangSmith unreachable")
            response = client.get("/api/eval/results")
        assert response.status_code == 502
        assert "detail" in response.json()

    def test_returns_has_results_false_when_no_experiments(self) -> None:
        with patch("langsmith.Client") as mock_client_cls:
            mock_client_cls.return_value.list_projects.return_value = iter([])
            response = client.get("/api/eval/results")
        assert response.status_code == 200
        body = response.json()
        assert body["has_results"] is False


# ---------------------------------------------------------------------------
# CORS — header present for http://localhost:5173
# ---------------------------------------------------------------------------

class TestCORS:
    def test_cors_header_present_for_vite_origin(self) -> None:
        response = client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert (
            response.headers.get("access-control-allow-origin") == "http://localhost:5173"
            or response.headers.get("access-control-allow-origin") == "*"
        )

    def test_cors_header_on_get_request(self) -> None:
        response = client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert "access-control-allow-origin" in response.headers
