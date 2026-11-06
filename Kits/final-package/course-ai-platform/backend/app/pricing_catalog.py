"""Kit and pricing catalog (Catalog_Service).

Configuration-sourced catalog of sellable kits, their covered module slugs, and
list prices. All monetary amounts are integers in the currency's **minor unit**
(paise for INR, cents for USD; 100 minor units = 1 major unit). The kit -> slug
mapping lives here as config data (Req 1.1) so pricing and coverage can be
retuned without touching router/business logic. A kit is *purchasable* iff its
slug set is non-empty (Req 1.7); the bundle covers the union of every sellable
kit's slugs plus the capstone (Req 1.5).
"""

from dataclasses import dataclass, field

# --- Config data (Req 1.1) -------------------------------------------------

# Currencies the platform can sell in. A client that names no currency is
# charged in DEFAULT_CURRENCY (INR keeps older clients and tests unchanged).
SUPPORTED_CURRENCIES: tuple[str, ...] = ("INR", "USD")
DEFAULT_CURRENCY = "INR"

# USD list prices in cents, from the selectAi pricing page. These are the source
# of truth: INR prices are derived from them below.
_USD_KIT_CENTS: dict[str, int] = {
    "kit1": 6900,   # $69
    "kit2": 7900,   # $79
    "kit3": 2900,   # $29
    "kit4": 3900,   # $39
}
_USD_BUNDLE_CENTS = 19900   # $199

# Rupees charged per US dollar. Rounded from the market rate on 2026-11-03
# (about 94.93). Change this one number to reprice every INR kit and the bundle;
# each INR price is rounded to a whole rupee.
USD_TO_INR_RATE = 95


def _inr_from_usd(cents: int) -> int:
    """Convert USD cents to INR paise at ``USD_TO_INR_RATE``, rounded to a whole rupee."""
    return round(cents * USD_TO_INR_RATE / 100) * 100


# Per-currency list prices in minor units. A kit missing from a currency's table
# has no price in it (kit5 is not for sale yet).
KIT_PRICES_MINOR: dict[str, dict[str, int]] = {
    "USD": dict(_USD_KIT_CENTS),
    "INR": {kit_id: _inr_from_usd(cents) for kit_id, cents in _USD_KIT_CENTS.items()},
}
BUNDLE_PRICES_MINOR: dict[str, int] = {
    "USD": _USD_BUNDLE_CENTS,
    "INR": _inr_from_usd(_USD_BUNDLE_CENTS),
}

# Kit -> covered module slugs (config data, Req 1.1 / A2).
# An empty slug set => the kit is non-purchasable (Req 1.7).
KIT_CATALOG: dict[str, dict] = {
    "kit1": {"name": "Foundations", "slugs": ["fundamentals", "db", "rag-engineering"]},
    "kit2": {"name": "Agentic AI & Guardrails", "slugs": ["agentic-ai", "ai-guardrails"]},
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
    base_price_paise: int            # INR list price (legacy field name)
    purchasable: bool
    prices: dict[str, int] = field(default_factory=dict)   # currency -> list price in minor units


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
        base_price_paise=KIT_PRICES_MINOR["INR"].get(kit_id, 0),   # 0 when the kit has no INR price
        purchasable=len(slugs) > 0,
        prices={cur: table[kit_id] for cur, table in KIT_PRICES_MINOR.items() if kit_id in table},
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
    """INR list price in paise for a ``selection`` (a kit id or ``"bundle"``).

    Raises ``KeyError`` for an unknown selection or a kit with no INR price.
    """
    return price_minor(selection, "INR")


def price_minor(selection: str, currency: str) -> int:
    """List price in minor units for ``selection`` in ``currency``.

    Raises ``KeyError`` for an unknown selection or currency, or when the kit
    has no price in that currency.
    """
    if currency not in SUPPORTED_CURRENCIES:
        raise KeyError(f"Unsupported currency: {currency!r}")
    if selection == BUNDLE_SELECTION:
        return BUNDLE_PRICES_MINOR[currency]
    try:
        return KIT_PRICES_MINOR[currency][selection]
    except KeyError:
        raise KeyError(f"No {currency} price for selection: {selection!r}") from None
