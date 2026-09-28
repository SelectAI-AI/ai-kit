import json
from pathlib import Path
from typing import Optional

from .config import settings

# Looked up in this order — covers the different intro-doc names already in use
# across your modules (README.md, FLOW_GUIDE.md, RUN.md, setup.md, ...).
INTRO_CANDIDATES = [
    "README.md", "FLOW_GUIDE.md", "RUN.md", "setup.md", "SETUP.md",
    "GUIDE.md", "INSTRUCTIONS.md",
]
CONFIG_FILENAME = "course_config.json"


def content_root() -> Path:
    return Path(settings.content_root).expanduser()


def humanize(filename: str) -> str:
    """agent_patterns_langgraph.ipynb -> 'Agent Patterns Langgraph'"""
    name = Path(filename).stem
    parts = name.split("_")
    if parts and parts[0].isdigit():
        parts = parts[1:]
    words = " ".join(parts).replace("-", " ").strip()
    return words.title() or name


def list_module_slugs() -> list:
    root = content_root()
    if not root.exists():
        return []
    return sorted(p.name for p in root.iterdir() if p.is_dir() and not p.name.startswith("."))


def find_intro_file(module_dir: Path) -> Optional[Path]:
    for candidate in INTRO_CANDIDATES:
        f = module_dir / candidate
        if f.exists():
            return f
    md_files = sorted(module_dir.glob("*.md"))
    return md_files[0] if md_files else None


def load_course_config(module_dir: Path) -> Optional[dict]:
    config_file = module_dir / CONFIG_FILENAME
    if config_file.exists():
        try:
            return json.loads(config_file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
    return None


def get_module_manifest(slug: str) -> Optional[dict]:
    """Builds { slug, title, intro_path, notebooks: [...], module_dir }.
    If a course_config.json is present in the module folder, its order/titles/
    questions win. Otherwise notebooks are auto-discovered, sorted alphabetically,
    and default to a 'reflection' unlock prompt."""
    root = content_root()
    module_dir = root / slug
    if not module_dir.exists() or not module_dir.is_dir():
        return None

    config = load_course_config(module_dir)
    notebook_files = sorted(p.name for p in module_dir.glob("*.ipynb"))

    if config and config.get("notebooks"):
        notebooks = []
        configured = set()
        for entry in config["notebooks"]:
            if entry["file"] in notebook_files:
                configured.add(entry["file"])
                notebooks.append({
                    "filename": entry["file"],
                    "title": entry.get("title") or humanize(entry["file"]),
                    "description": entry.get("description"),
                    "question_type": entry.get("question_type", "reflection"),
                    "prompt": entry.get("prompt"),
                    "answer": entry.get("answer"),
                })
        # any notebook added on disk since the config was written still shows up, at the end
        for f in notebook_files:
            if f not in configured:
                notebooks.append({
                    "filename": f, "title": humanize(f), "description": None,
                    "question_type": "reflection", "prompt": None, "answer": None,
                })
        title = config.get("title") or humanize(slug)
        intro_name = config.get("intro_file")
        intro_path = (
            module_dir / intro_name if intro_name and (module_dir / intro_name).exists()
            else find_intro_file(module_dir)
        )
    else:
        notebooks = [
            {"filename": f, "title": humanize(f), "description": None,
             "question_type": "reflection", "prompt": None, "answer": None}
            for f in notebook_files
        ]
        title = humanize(slug)
        intro_path = find_intro_file(module_dir)

    return {
        "slug": slug, "title": title, "intro_path": intro_path,
        "notebooks": notebooks, "module_dir": module_dir,
    }


def read_intro_markdown(manifest: dict) -> str:
    path = manifest.get("intro_path")
    if path and path.exists():
        return path.read_text(encoding="utf-8", errors="replace")
    return f"# {manifest['title']}\n\n_No intro document found for this module yet. Add a README.md to get started._"


def notebook_path(slug: str, filename: str) -> Optional[Path]:
    manifest = get_module_manifest(slug)
    if not manifest:
        return None
    p = manifest["module_dir"] / filename
    if p.exists() and p.suffix == ".ipynb" and p.parent == manifest["module_dir"]:
        return p
    return None


def render_notebook_html(path: Path) -> str:
    """Renders an already-executed notebook's stored cells/outputs to HTML.
    Does NOT re-run the notebook, so it works without your langchain/groq/etc.
    dependencies or API keys installed in the platform's backend env."""
    import nbformat
    from nbconvert import HTMLExporter

    nb = nbformat.read(str(path), as_version=4)
    for template_name in ("classic", "basic", None):
        try:
            exporter = HTMLExporter(template_name=template_name) if template_name else HTMLExporter()
            body, _ = exporter.from_notebook_node(nb)
            return body
        except Exception:
            continue
    raise RuntimeError("Could not render notebook to HTML")
