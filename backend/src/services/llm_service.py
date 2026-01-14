from __future__ import annotations

import json
import os
from hashlib import sha256
from typing import Any, Dict, Optional

from cachetools import TTLCache

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore


SYSTEM_PROMPT = """
You are a briefing-drafting assistant for economic policy. You must produce concise, high-quality ministerial briefings grounded strictly in the provided Data Pack. Do not invent numbers, facts, or context not present in the Data Pack. If information is missing, say so explicitly and propose what additional series would be needed. All quantitative claims must include citations that reference the exact series_key and period(s) from the Data Pack. Output must be valid JSON matching the required schema and nothing else.
"""


class LLMService:
    def __init__(self, *, model: str = "gpt-4o-mini", cache_ttl_seconds: int = 600) -> None:
        self.model = model
        api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(api_key=api_key) if OpenAI and api_key else None
        self.cache: TTLCache[str, Dict[str, Any]] = TTLCache(maxsize=64, ttl=cache_ttl_seconds)

    def _prompt_create(self, *, user_request: str, options: Dict[str, Any], topic: str, data_pack: Dict[str, Any]) -> str:
        return f"""You will create a briefing using ONLY the provided Data Pack.

User request:
{user_request}

Briefing options:
{json.dumps(options)}

Selected topic:
{topic}

Data Pack:
{json.dumps(data_pack)}

Return JSON with this schema:
{{"briefing_meta":{{"title": "string","topic":"string","as_of":"string","tone":"string","length":"string"}},"quality_banner":{{"status":"green|amber|red","summary":"string","checks":[{{"name":"string","ok":true,"detail":"string"}}]}},"sections":[{{"id":"string","title":"string","blocks":[{{"type":"paragraph|bullets|table|chart_spec|callout","content":{{}},"citations":[{{"series_key":"string","period_start":"string","value":0,"note":"string"}}]}}]}}],"recommended_charts":[{{"chart_id":"string","title":"string","unit":"string","series_keys":["string"],"suggested_range":{{"start":"string","end":"string"}}}}],"export_markdown":"string"}}
"""

    def _prompt_edit(
        self,
        *,
        edit_message: str,
        current_briefing: Dict[str, Any],
        data_pack: Dict[str, Any],
    ) -> str:
        return f"""You will apply the user's requested edits to the briefing. You MUST keep all quantitative statements grounded in the Data Pack. If the user asks for content not supported by the Data Pack, explain that in the change_summary and add a placeholder note in the briefing indicating missing data.

User edit request:
{edit_message}

Target briefing (current content_json):
{json.dumps(current_briefing)}

Data Pack (same grounding data as original unless explicitly provided otherwise):
{json.dumps(data_pack)}

Return JSON with this schema:
{{"change_summary":"string","updated_briefing":{{"briefing_meta":{{"title":"string","topic":"string","as_of":"string","tone":"string","length":"string"}},"quality_banner":{{"status":"green|amber|red","summary":"string","checks":[{{"name":"string","ok":true,"detail":"string"}}]}},"sections":[{{"id":"string","title":"string","blocks":[{{"type":"paragraph|bullets|table|chart_spec|callout","content":{{}},"citations":[{{"series_key":"string","period_start":"string","value":0,"note":"string"}}]}}]}}],"recommended_charts":[{{"chart_id":"string","title":"string","unit":"string","series_keys":["string"],"suggested_range":{{"start":"string","end":"string"}}}}],"export_markdown":"string"}}}}
"""

    def _hash_key(self, *, mode: str, payload: Dict[str, Any]) -> str:
        return sha256(f"{mode}:{json.dumps(payload, sort_keys=True)}".encode("utf-8")).hexdigest()

    def _call_model(self, *, user_prompt: str) -> Dict[str, Any]:
        if not self.client:
            return self._fallback_response(user_prompt=user_prompt)

        response = self.client.responses.create(  # type: ignore[attr-defined]
            model=self.model,
            temperature=0,
            system=SYSTEM_PROMPT,
            response_format={"type": "json_object"},
            input=user_prompt,
        )
        content = response.output[0].content[0].text  # type: ignore[index]
        return json.loads(content)

    def _fallback_response(self, *, user_prompt: str) -> Dict[str, Any]:
        # Deterministic placeholder used when no LLM credentials are configured.
        return {
            "briefing_meta": {
                "title": "Data-only briefing",
                "topic": "unknown",
                "as_of": "latest",
                "tone": "ministerial",
                "length": "one_page",
            },
            "quality_banner": {
                "status": "amber",
                "summary": "LLM unavailable — generated deterministic structure.",
                "checks": [
                    {
                        "name": "llm_fallback",
                        "ok": False,
                        "detail": "Used server-side fallback content.",
                    }
                ],
            },
            "sections": [],
            "recommended_charts": [],
            "export_markdown": f"```text\n{user_prompt[:400]}\n```",
        }

    def create_briefing(self, *, user_request: str, options: Dict[str, Any], topic: str, data_pack: Dict[str, Any]) -> Dict[str, Any]:
        payload = {"user_request": user_request, "options": options, "topic": topic, "data_pack": data_pack}
        cache_key = self._hash_key(mode="CREATE_BRIEFING", payload=payload)
        if cache_key in self.cache:
            return self.cache[cache_key]

        user_prompt = self._prompt_create(user_request=user_request, options=options, topic=topic, data_pack=data_pack)
        response = self._call_model(user_prompt=user_prompt)
        self.cache[cache_key] = response
        return response

    def edit_briefing(
        self,
        *,
        edit_message: str,
        current_briefing: Dict[str, Any],
        data_pack: Dict[str, Any],
    ) -> Dict[str, Any]:
        payload = {"edit_message": edit_message, "current_briefing": current_briefing, "data_pack": data_pack}
        cache_key = self._hash_key(mode="EDIT_BRIEFING", payload=payload)
        if cache_key in self.cache:
            return self.cache[cache_key]

        user_prompt = self._prompt_edit(edit_message=edit_message, current_briefing=current_briefing, data_pack=data_pack)
        response = self._call_model(user_prompt=user_prompt)
        self.cache[cache_key] = response
        return response
