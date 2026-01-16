from __future__ import annotations

from typing import Any, Dict, Optional

from psycopg2.extras import Json

from src.database import db


def create_briefing(*, title: str, topic: str, created_by: str) -> Dict[str, Any]:
    query = """
        INSERT INTO briefings (title, topic, created_by)
        VALUES (%s, %s, %s)
        RETURNING *
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (title, topic, created_by))
        return cursor.fetchone()


def get_briefing(briefing_id: str) -> Optional[Dict[str, Any]]:
    query = "SELECT * FROM briefings WHERE id = %s"
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_id,))
        return cursor.fetchone()


def _next_version_number(briefing_id: str) -> int:
    query = "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM briefing_versions WHERE briefing_id = %s"
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_id,))
        row = cursor.fetchone()
        return row["next_version"] if row else 1


def insert_version(
    *,
    briefing_id: str,
    created_by: str,
    input_spec: Dict[str, Any],
    data_pack: Dict[str, Any],
    content_json: Dict[str, Any],
    change_summary: Optional[str],
) -> Dict[str, Any]:
    version_number = _next_version_number(briefing_id)
    query = """
        INSERT INTO briefing_versions
        (briefing_id, version_number, created_by, input_spec, data_pack, content_json, change_summary)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """
    with db.get_cursor() as cursor:
        cursor.execute(
            query,
            (
                briefing_id,
                version_number,
                created_by,
                Json(input_spec),
                Json(data_pack),
                Json(content_json),
                change_summary,
            ),
        )
        return cursor.fetchone()


def update_latest_version(briefing_id: str, version_id: str) -> None:
    query = "UPDATE briefings SET latest_version_id = %s WHERE id = %s"
    with db.get_cursor() as cursor:
        cursor.execute(query, (version_id, briefing_id))


def get_version(briefing_id: str, version_id: str) -> Optional[Dict[str, Any]]:
    query = """
        SELECT *
        FROM briefing_versions
        WHERE briefing_id = %s AND id = %s
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_id, version_id))
        return cursor.fetchone()


def list_versions(briefing_id: str) -> list[Dict[str, Any]]:
    query = """
        SELECT *
        FROM briefing_versions
        WHERE briefing_id = %s
        ORDER BY version_number DESC
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_id,))
        return cursor.fetchall()


def insert_chat_message(
    *,
    briefing_id: str,
    role: str,
    message: str,
    version_id: Optional[str],
) -> Dict[str, Any]:
    query = """
        INSERT INTO briefing_chat (briefing_id, role, message, version_id)
        VALUES (%s, %s, %s, %s)
        RETURNING *
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_id, role, message, version_id))
        return cursor.fetchone()


def insert_comment(
    *,
    briefing_version_id: str,
    created_by: str,
    anchor: str,
    comment_text: str,
) -> Dict[str, Any]:
    query = """
        INSERT INTO briefing_comments (briefing_version_id, created_by, anchor, comment_text)
        VALUES (%s, %s, %s, %s)
        RETURNING *
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_version_id, created_by, anchor, comment_text))
        return cursor.fetchone()


def list_comments(briefing_version_id: str) -> list[Dict[str, Any]]:
    query = """
        SELECT *
        FROM briefing_comments
        WHERE briefing_version_id = %s
        ORDER BY created_at ASC
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_version_id,))
        return cursor.fetchall()


def list_chat_messages(briefing_id: str, limit: int = 200) -> list[Dict[str, Any]]:
    query = """
        SELECT *
        FROM briefing_chat
        WHERE briefing_id = %s
        ORDER BY created_at ASC
        LIMIT %s
    """
    with db.get_cursor() as cursor:
        cursor.execute(query, (briefing_id, limit))
        return cursor.fetchall()
