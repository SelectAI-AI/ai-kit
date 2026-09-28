import io
import json
import logging
from pathlib import Path

import qrcode
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .config import settings

logger = logging.getLogger(__name__)

CERT_DIR = Path("certificates_store")
CERT_DIR.mkdir(exist_ok=True)

APP_DIR = Path(__file__).resolve().parent
ASSETS_DIR = APP_DIR / "assets"
LAYOUT_PATH = APP_DIR / "certificate_layout.json"

# Legacy palette — used only by the fallback design when no template image exists.
INK = colors.HexColor("#0B0E14")
BRASS = colors.HexColor("#D8A657")
PAPER = colors.HexColor("#E4E8F1")
MUTED = colors.HexColor("#7C879C")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _qr_bytes(url: str) -> io.BytesIO:
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def _load_layout() -> dict:
    try:
        with open(LAYOUT_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("certificate_layout.json unreadable (%s); using empty layout", e)
        return {}


def _hex(layout: dict, key: str, default: str = "#000000"):
    palette = layout.get("colors", {})
    return colors.HexColor(palette.get(key, key if key.startswith("#") else default))


def _resolve_text(field: dict, ctx: dict) -> str:
    """Build the display string for a field from its config and the value context."""
    source = field.get("text_source")
    value = ctx.get(source)
    fmt = field.get("format")
    if fmt:
        try:
            return fmt.format(cert_id=ctx["cert_id"], date=ctx["issued_at_dt"], value=value)
        except (KeyError, ValueError):
            return str(value)
    return str(value)


def _draw_field(c: canvas.Canvas, field: dict, text: str, w: float, h: float, layout: dict):
    x = field["x"] * w
    y = field["y"] * h
    c.setFont(field.get("font", "Helvetica"), field.get("size", 12))
    c.setFillColor(_hex(layout, field.get("color", "#000000")))
    align = field.get("align", "center")
    if align == "left":
        c.drawString(x, y, text)
    elif align == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawCentredString(x, y, text)


def _draw_placeholder(c: canvas.Canvas, field: dict, label: str, w: float, h: float, layout: dict):
    """Outlined box + label to visually tune coordinates (debug mode)."""
    x = field["x"] * w
    y = field["y"] * h
    bw = field.get("max_width", 0.4) * w
    bh = (field.get("size", 12) * 1.6)
    c.setStrokeColor(_hex(layout, "placeholder_outline", "#D8A657"))
    c.setLineWidth(0.6)
    c.rect(x - bw / 2, y - bh * 0.25, bw, bh, fill=0, stroke=1)
    c.setFont("Helvetica", 6)
    c.setFillColor(_hex(layout, "placeholder_outline", "#D8A657"))
    c.drawCentredString(x, y + bh * 0.9, label)


# --------------------------------------------------------------------------- #
# Template renderer (image background + config-driven overlays)
# --------------------------------------------------------------------------- #
def _render_with_template(path: Path, template_path: Path, layout: dict, ctx: dict) -> Path:
    reader = ImageReader(str(template_path))
    img_w, img_h = reader.getSize()

    if layout.get("page", {}).get("size_from_image", True):
        # Map image pixels to points 1:1 (keeps aspect ratio exact).
        width, height = float(img_w), float(img_h)
    else:
        width, height = landscape(A4)

    c = canvas.Canvas(str(path), pagesize=(width, height))
    c.drawImage(reader, 0, 0, width=width, height=height, mask="auto")

    debug = layout.get("debug_placeholders", False)

    for name, field in layout.get("fields", {}).items():
        text = _resolve_text(field, ctx)
        _draw_field(c, field, text, width, height, layout)
        if debug:
            _draw_placeholder(c, field, name, width, height, layout)

    qr_cfg = layout.get("qr", {})
    if qr_cfg.get("enabled", True):
        verify_url = qr_cfg.get("url_template", "{frontend_base_url}/verify/{cert_id}").format(
            frontend_base_url=settings.frontend_base_url, cert_id=ctx["cert_id"]
        )
        qr_size = qr_cfg.get("size", 0.14) * min(width, height)
        qx = qr_cfg.get("x", 0.88) * width
        qy = qr_cfg.get("y", 0.1) * height
        if qr_cfg.get("anchor", "center") == "center":
            draw_x, draw_y = qx - qr_size / 2, qy - qr_size / 2
        else:  # bottom-left anchor
            draw_x, draw_y = qx, qy
        c.drawImage(ImageReader(_qr_bytes(verify_url)), draw_x, draw_y, qr_size, qr_size, mask="auto")

        caption = qr_cfg.get("caption")
        if caption:
            c.setFont(qr_cfg.get("caption_font", "Helvetica"), qr_cfg.get("caption_size", 8))
            c.setFillColor(_hex(layout, qr_cfg.get("caption_color", "caption"), "#3A4152"))
            cap_y = qy + qr_cfg.get("caption_offset_y", -0.035) * height
            c.drawCentredString(qx, cap_y, caption)

        if debug:
            c.setStrokeColor(_hex(layout, "placeholder_outline", "#D8A657"))
            c.setLineWidth(0.6)
            c.rect(qx - qr_size / 2, qy - qr_size / 2, qr_size, qr_size, fill=0, stroke=1)

    c.showPage()
    c.save()
    return path


# --------------------------------------------------------------------------- #
# Legacy fallback (used when the template image is missing)
# --------------------------------------------------------------------------- #
def _render_fallback(path: Path, cert_id: str, full_name: str, course_title: str, issued_at) -> Path:
    width, height = landscape(A4)
    c = canvas.Canvas(str(path), pagesize=landscape(A4))

    c.setFillColor(INK)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(BRASS)
    c.setLineWidth(2)
    c.rect(1 * cm, 1 * cm, width - 2 * cm, height - 2 * cm, fill=0, stroke=1)

    c.setFillColor(PAPER)
    c.setFont("Helvetica-Bold", 30)
    c.drawCentredString(width / 2, height - 3.6 * cm, "Certificate of Completion")

    c.setFont("Helvetica", 13)
    c.setFillColor(MUTED)
    c.drawCentredString(width / 2, height - 4.7 * cm, "This certifies that")

    c.setFont("Helvetica-Bold", 27)
    c.setFillColor(BRASS)
    c.drawCentredString(width / 2, height - 6.2 * cm, full_name)

    c.setFont("Helvetica", 13)
    c.setFillColor(MUTED)
    c.drawCentredString(width / 2, height - 7.4 * cm, "has successfully completed")

    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(PAPER)
    c.drawCentredString(width / 2, height - 8.6 * cm, course_title)

    c.setFont("Helvetica", 10)
    c.setFillColor(MUTED)
    c.drawCentredString(width / 2, height - 9.8 * cm,
                        f"Issued {issued_at.strftime('%B %d, %Y')}  \u00b7  Certificate ID {cert_id}")

    verify_url = f"{settings.frontend_base_url}/verify/{cert_id}"
    qr_img = ImageReader(_qr_bytes(verify_url))
    qr_size = 3 * cm
    c.drawImage(qr_img, width - qr_size - 2 * cm, 1.6 * cm, qr_size, qr_size, mask="auto")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawCentredString(width - qr_size / 2 - 2 * cm, 1.3 * cm, "Scan to verify")

    c.showPage()
    c.save()
    return path


# --------------------------------------------------------------------------- #
# Public API — signature and return type preserved exactly.
# --------------------------------------------------------------------------- #
def generate_certificate_pdf(cert_id: str, full_name: str, course_title: str, issued_at) -> Path:
    path = CERT_DIR / f"{cert_id}.pdf"
    layout = _load_layout()
    template_name = layout.get("template_file", "certificate_template.jpeg")
    template_path = ASSETS_DIR / template_name

    if template_path.exists():
        ctx = {
            "cert_id": cert_id,
            "full_name": full_name,
            "course_title": course_title,
            "issued_at": issued_at,
            "issued_at_dt": issued_at,
        }
        try:
            return _render_with_template(path, template_path, layout, ctx)
        except Exception as e:  # never let artwork issues break issuance
            logger.error("Template render failed (%s); using fallback layout", e)

    return _render_fallback(path, cert_id, full_name, course_title, issued_at)
