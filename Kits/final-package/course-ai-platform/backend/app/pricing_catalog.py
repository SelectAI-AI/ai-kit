"""Kit and pricing catalog (Catalog_Service).

Configuration-sourced catalog of sellable kits, their covered module slugs, and
base prices. All monetary amounts are integer **paise** (INR only; ₹1 = 100
paise). The kit -> slug mapping lives here as config data (Req 1.1) so pricing
and coverage can be retuned without touching router/business logic. A kit is
*purchasable* iff its slug set is non-empty (Req 1.7); the bundle covers the
union of every sellable kit's slugs plus the capstone (Req 1.5).
"""

from dataclasses import dataclass

# --- Config data (Req 1.1) -------------------------------------------------

# All amounts are integer paise. INR only.
KIT_BASE_PAISE = 999900          # ₹9,999 per sellable kit (Req 1.3)
BUNDLE_BASE_PAISE = 3999900      # ₹39,999 bundle (Req 1.4)

# Kit -> covered module slugs (config data, Req 1.1 / A2).
# An empty slug set => the kit is non-purchasable (Req 1.7).
KIT_CATALOG: dict[str, dict] = {
    "kit1": {"name": "Foundations", "slugs": ["fundamentals", "db", "rag-engineering"]},
    "kit2": {"name": "Agentic & Guardrails", "slugs": ["agentic-ai", "ai-guardrails"]},
    "kit3": {"name": "MCP", "slugs": ["MCP"]},
    "kit4": {"name": "AI Ops", "slugs": ["ai-ops"]},
    # A1: Kit 5 has no slug yet -> non-purchasable.
    "kit5": {"name": "AI Fine-Tuning & Local Models", "slugs": []},
}

# A3: default none free; configurable (Req 9.5).
FREE_SLUGS: set[str] = set()

# A6: capstone covered by the bundle (Req 1.5, 8.2).
CAPSTONE_SLUG = "capstone"

# "bundle" is the reserved selection id for the Full Bundle.
BUNDLE_SELECTION = "bundle"


@dataclass(frozen=True)
class KitView:
    """A read-only view of a single kit in the catalog (Req 1.2)."""

    kit_id: str
    name: str
    slugs: list[str]
    base_price_paise: int
    purchasable: bool


# --- Public API ------------------------------------------------------------

def is_purchasable(kit_id: str) -> bool:
    """A kit is purchasable iff it exists and its slug set is non-empty (Req 1.7)."""
    entry = KIT_CATALOG.get(kit_id)
    if entry is None:
        return False
    return len(entry.get("slugs") or []) > 0


def get_kit(kit_id: str) -> KitView | None:
    """Return the KitView for ``kit_id`` or ``None`` when it is not in the catalog."""
    entry = KIT_CATALOG.get(kit_id)
    if entry is None:
        return None
    slugs = list(entry.get("slugs") or [])
    return KitView(
        kit_id=kit_id,
        name=entry["name"],
        slugs=slugs,
        base_price_paise=KIT_BASE_PAISE,
        purchasable=len(slugs) > 0,
    )


def list_kits() -> list[KitView]:
    """Return a KitView for every configured kit (Req 1.2, 1.6)."""
    return [get_kit(kit_id) for kit_id in KIT_CATALOG]


def bundle_slugs() -> list[str]:
    """Bundle coverage: union of all sellable kits' slugs plus the capstone (Req 1.5).

    Preserves catalog order and de-duplicates while appending the capstone last.
    """
    seen: set[str] = set()
    ordered: list[str] = []
    for kit_id, entry in KIT_CATALOG.items():
        if not is_purchasable(kit_id):
            continue
        for slug in entry.get("slugs") or []:
            if slug not in seen:
                seen.add(slug)
                ordered.append(slug)
    if CAPSTONE_SLUG not in seen:
        ordered.append(CAPSTONE_SLUG)
    return ordered


def base_price_paise(selection: str) -> int:
    """Base price in paise for a ``selection`` (a kit id or ``"bundle"``).

    Returns ``BUNDLE_BASE_PAISE`` for the bundle and ``KIT_BASE_PAISE`` for any
    kit id (Req 1.3, 1.4). Raises ``KeyError`` for an unknown selection.
    """
    if selection == BUNDLE_SELECTION:
        return BUNDLE_BASE_PAISE
    if selection in KIT_CATALOG:
        return KIT_BASE_PAISE
    raise KeyError(f"Unknown selection: {selection!r}")
