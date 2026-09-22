"""
Structural smoke tests for the module-01-react-frontend backend.

Verifies that required files exist, .env.example contains all required
variable names, and requirements.txt has no range specifiers.
"""

from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent

REQUIRED_FILES = [
    "main.py",
    "requirements.txt",
    ".env.example",
]

REQUIRED_ENV_VARS = [
    "GROQ_API_KEY",
    "LANGCHAIN_API_KEY",
    "LANGCHAIN_TRACING_V2",
    "LANGCHAIN_PROJECT",
]

FORBIDDEN_SPECIFIERS = [">=", "~=", "<=", "!="]


class TestRequiredFilesExist:
    @pytest.mark.parametrize("filename", REQUIRED_FILES)
    def test_file_exists(self, filename: str) -> None:
        path = BACKEND_DIR / filename
        assert path.exists(), f"Required file not found: {path}"
        assert path.is_file(), f"Expected a file, not a directory: {path}"


class TestEnvExample:
    def test_env_example_contains_all_required_vars(self) -> None:
        env_example = BACKEND_DIR / ".env.example"
        content = env_example.read_text(encoding="utf-8")
        for var in REQUIRED_ENV_VARS:
            assert var in content, (
                f".env.example is missing required variable: {var!r}"
            )

    def test_env_example_uses_placeholder_values_not_real_credentials(self) -> None:
        env_example = BACKEND_DIR / ".env.example"
        content = env_example.read_text(encoding="utf-8")
        # Placeholder values should contain "your-" or similar, not look like real keys
        for line in content.splitlines():
            if "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                # Real Groq/LangChain keys are long alphanumeric strings
                # Placeholder values should be short descriptive strings
                assert len(value.strip()) < 60, (
                    f".env.example value for {key.strip()!r} looks like a real credential: {value!r}"
                )


class TestRequirementsTxt:
    def _get_requirement_lines(self) -> list[str]:
        req_file = BACKEND_DIR / "requirements.txt"
        lines = []
        for line in req_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                lines.append(stripped)
        return lines

    def test_requirements_txt_has_no_range_specifiers(self) -> None:
        for line in self._get_requirement_lines():
            for op in FORBIDDEN_SPECIFIERS:
                assert op not in line, (
                    f"requirements.txt uses forbidden specifier {op!r}: {line!r}"
                )

    def test_requirements_txt_all_lines_use_exact_pin(self) -> None:
        for line in self._get_requirement_lines():
            assert "==" in line, (
                f"requirements.txt line does not use '==' pin: {line!r}"
            )

    def test_requirements_txt_has_entries(self) -> None:
        lines = self._get_requirement_lines()
        assert len(lines) > 0, "requirements.txt has no dependency entries"
