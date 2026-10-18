"""Resume existing result delivery through the registered SYNK recovery command.

This gateway lifecycle hook starts no agent or native CLI work. The plugin owns
the direct-delivery mode filter, process recovery and persisted send deduplication.
"""

import asyncio
import json
import logging
import os
from pathlib import Path
import re


_running = set()
_logger = logging.getLogger(__name__)


def _authorized_routes(rows, allowed):
    """Accept only existing, allowlisted Telegram private origins; never invent one."""
    seen = set()
    for key, raw in rows.items():
        try:
            row = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if not isinstance(row, dict) or not isinstance(row.get("origin"), dict):
            continue
        origin = row["origin"]
        user = str(origin.get("user_id") or "")
        chat = str(origin.get("chat_id") or "")
        session_id = row.get("session_id")
        if (origin.get("platform") != "telegram" or origin.get("chat_type") != "dm"
                or not user.isdecimal() or user not in allowed or chat != user
                or not isinstance(key, str) or not key
                or not isinstance(session_id, str) or not session_id
                or (user, chat) in seen):
            continue
        seen.add((user, chat))
        yield {"platform": "telegram", "source": "telegram", "chat_type": "dm",
               "user_id": user, "chat_id": chat, "session_key": key,
               "session_id": session_id, "async_delivery": True,
               "session_history_delivery": "1"}


def _recover_sync():
    allowed = {part for part in re.split(r"[\s,;]+", os.environ.get("TELEGRAM_ALLOWED_USERS", "")) if part}
    if not allowed:
        return 0
    from hermes_constants import get_hermes_home
    from hermes_state import SessionDB
    from hermes_cli.plugins import get_plugin_command_handler
    from gateway.session_context import set_session_vars, clear_session_vars

    home = Path(get_hermes_home())
    db = SessionDB(read_only=True)
    try:
        rows = db.load_gateway_routing_entries(scope=str((home / "sessions").resolve()))
    finally:
        db.close()
    command = get_plugin_command_handler("synk-recover")
    if command is None:
        _logger.warning("SYNK pending result recovery command is unavailable.")
        return 0
    checked = 0
    for bindings in _authorized_routes(rows, allowed):
        tokens = set_session_vars(**bindings)
        try:
            # The same handler rechecks the live allowlist and resumes only the
            # user's existing direct-mode records. Ignore its conversational reply.
            command("")
            checked += 1
        except Exception:
            # Do not expose identifiers, saved conversations or exception payloads.
            _logger.warning("SYNK pending result recovery failed for a private route.")
        finally:
            clear_session_vars(tokens)
    _logger.info("SYNK pending result recovery checked %d authorized private routes.", checked)
    return checked


async def _recover():
    try:
        # Binding and clearing happen only inside this copied thread context, so
        # startup and concurrent inbound messages keep their own session variables.
        await asyncio.to_thread(_recover_sync)
    except Exception:
        _logger.warning("SYNK automatic result recovery is unavailable; use /synk_recover in the private chat.")


async def handle(event_type, context):
    if event_type != "gateway:startup" or _running:
        return
    task = asyncio.create_task(_recover(), name="synk-pending-result-recovery")
    _running.add(task)
    task.add_done_callback(_running.discard)
