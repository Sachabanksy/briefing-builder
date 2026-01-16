from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from jinja2 import Environment, FileSystemLoader, select_autoescape


class PdfRenderService:
    """Renders briefing content into HTML then into a PDF-like byte stream.

    This scaffolding currently returns HTML bytes so the endpoint has a deterministic
    response even without Playwright installed. Integrating a headless browser for
    true PDF parity can build on this surface.
    """

    def __init__(self) -> None:
        template_path = Path(__file__).resolve().parents[1] / "templates"
        self.env = Environment(
            loader=FileSystemLoader(str(template_path)),
            autoescape=select_autoescape(["html", "xml"]),
        )
        self.template = self.env.get_template("briefing.html")

    def render(self, *, content_json: Dict[str, Any]) -> bytes:
        html = self.template.render(content=content_json)
        return html.encode("utf-8")
