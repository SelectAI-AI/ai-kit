from __future__ import annotations

from pathlib import Path

from mcp.server.fastmcp import FastMCP

BASE_DIR = Path(__file__).resolve().parents[2]
mcp = FastMCP("guided-lab-filesystem", json_response=True)


@mcp.resource("file://tree")
def file_tree() -> list[str]:
    """Return a shallow project file tree."""
    paths = []
    for p in sorted(BASE_DIR.rglob("*")):
        if p.is_file() and len(p.relative_to(BASE_DIR).parts) <= 3:
            paths.append(str(p.relative_to(BASE_DIR)))
    return paths


@mcp.tool()
def list_files(relative_dir: str = ".", suffix: str = "") -> list[str]:
    """List files in a directory."""
    base = (BASE_DIR / relative_dir).resolve()
    if not str(base).startswith(str(BASE_DIR)):
        raise ValueError("Path escapes the project directory.")
    results = []
    for p in sorted(base.rglob("*")):
        if p.is_file():
            if not suffix or p.name.endswith(suffix):
                results.append(str(p.relative_to(BASE_DIR)))
    return results


@mcp.tool()
def read_text_file(relative_path: str, max_chars: int = 6000) -> str:
    """Read a text file from the project."""
    path = (BASE_DIR / relative_path).resolve()
    if not str(path).startswith(str(BASE_DIR)):
        raise ValueError("Path escapes the project directory.")
    return path.read_text(encoding="utf-8")[:max_chars]


@mcp.prompt()
def file_prompt(path: str, audience: str = "student") -> str:
    """Create a prompt for explaining a file."""
    return f"Explain {path} to a {audience}. Focus on what it does, why it exists, and how to modify it safely."


if __name__ == "__main__":
    mcp.run(transport="stdio")
