from __future__ import annotations

from typing import Any, Dict

from src.repositories import briefings as briefing_repo
from src.schemas.briefings import (
    BriefingVersionSummary,
    ChatRequest,
    CommentCreateRequest,
    CreateBriefingRequest,
)
from src.services.data_pack_builder import build_data_pack
from src.services.llm_service import LLMService
from src.services.pdf_service import PdfRenderService


class BriefingService:
    def __init__(self) -> None:
        self.llm_service = LLMService()
        self.pdf_service = PdfRenderService()

    def create_briefing(self, *, request: CreateBriefingRequest, user_id: str) -> Dict[str, Any]:
        data_pack = build_data_pack(
            topic=request.topic,
            selected_series=[series.dict() for series in request.selected_series],
            options=request.options.dict(),
        )

        llm_response = self.llm_service.create_briefing(
            user_request=request.user_request,
            options=request.options.dict(),
            topic=request.topic,
            data_pack=data_pack,
        )
        title = (
            llm_response.get("briefing_meta", {}).get("title")
            or f"{request.topic.title()} briefing"
        )
        briefing = briefing_repo.create_briefing(title=title, topic=request.topic, created_by=user_id)
        version = briefing_repo.insert_version(
            briefing_id=briefing["id"],
            created_by=user_id,
            input_spec=request.model_dump(),
            data_pack=data_pack,
            content_json=llm_response,
            change_summary=None,
        )
        briefing_repo.update_latest_version(briefing["id"], version["id"])
        briefing_repo.insert_chat_message(
            briefing_id=briefing["id"],
            role="user",
            message=request.user_request,
            version_id=version["id"],
        )
        briefing_repo.insert_chat_message(
            briefing_id=briefing["id"],
            role="assistant",
            message="Generated initial briefing.",
            version_id=version["id"],
        )
        return {
            "briefing_id": briefing["id"],
            "version_id": version["id"],
            "render_model": llm_response,
        }

    def get_version(self, *, briefing_id: str, version_id: str) -> BriefingVersionSummary:
        version = briefing_repo.get_version(briefing_id, version_id)
        if not version:
            raise ValueError("Version not found.")
        return BriefingVersionSummary(
            id=version["id"],
            briefing_id=version["briefing_id"],
            version_number=version["version_number"],
            created_at=version["created_at"],
            created_by=version["created_by"],
            change_summary=version["change_summary"],
            content_json=version["content_json"],
            data_pack=version["data_pack"],
            input_spec=version["input_spec"],
        )

    def handle_chat(
        self,
        *,
        briefing_id: str,
        request: ChatRequest,
        user_id: str,
    ) -> Dict[str, Any]:
        target_version_id = request.target_version_id
        briefing = briefing_repo.get_briefing(briefing_id)
        if not briefing:
            raise ValueError("Briefing not found.")
        version_id = target_version_id or briefing["latest_version_id"]
        if not version_id:
            raise ValueError("No versions exist for this briefing.")

        current_version = briefing_repo.get_version(briefing_id, version_id)
        if not current_version:
            raise ValueError("Version not found.")

        llm_response = self.llm_service.edit_briefing(
            edit_message=request.message,
            current_briefing=current_version["content_json"],
            data_pack=current_version["data_pack"],
        )
        updated = llm_response.get("updated_briefing") or current_version["content_json"]
        change_summary = llm_response.get("change_summary") or "Applied requested edits."

        new_version = briefing_repo.insert_version(
            briefing_id=briefing_id,
            created_by=user_id,
            input_spec=current_version["input_spec"],
            data_pack=current_version["data_pack"],
            content_json=updated,
            change_summary=change_summary,
        )
        briefing_repo.update_latest_version(briefing_id, new_version["id"])
        briefing_repo.insert_chat_message(
            briefing_id=briefing_id,
            role="user",
            message=request.message,
            version_id=version_id,
        )
        briefing_repo.insert_chat_message(
            briefing_id=briefing_id,
            role="assistant",
            message=change_summary,
            version_id=new_version["id"],
        )
        return {
            "briefing_id": briefing_id,
            "new_version_id": new_version["id"],
            "change_summary": change_summary,
            "render_model": updated,
        }

    def add_comment(
        self,
        *,
        briefing_id: str,
        comment_request: CommentCreateRequest,
        user_id: str,
    ) -> Dict[str, Any]:
        briefing = briefing_repo.get_briefing(briefing_id)
        if not briefing:
            raise ValueError("Briefing not found.")
        version = briefing_repo.get_version(briefing_id, comment_request.version_id)
        if not version:
            raise ValueError("Version not found.")
        comment = briefing_repo.insert_comment(
            briefing_version_id=comment_request.version_id,
            created_by=user_id,
            anchor=comment_request.anchor,
            comment_text=comment_request.comment_text,
        )
        return {
            "comment_id": comment["id"],
            "status": comment["status"],
        }

    def export_pdf(self, *, briefing_id: str, version_id: str) -> bytes:
        version = briefing_repo.get_version(briefing_id, version_id)
        if not version:
            raise ValueError("Version not found.")
        return self.pdf_service.render(content_json=version["content_json"])

    def get_briefing_detail(self, *, briefing_id: str) -> Dict[str, Any]:
        briefing = briefing_repo.get_briefing(briefing_id)
        if not briefing:
            raise ValueError("Briefing not found.")
        versions = briefing_repo.list_versions(briefing_id)
        return {
            "briefing": briefing,
            "versions": [
                {
                    "id": version["id"],
                    "version_number": version["version_number"],
                    "created_at": version["created_at"],
                    "created_by": version["created_by"],
                    "change_summary": version["change_summary"],
                }
                for version in versions
            ],
        }
