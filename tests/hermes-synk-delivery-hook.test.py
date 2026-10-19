"""Gateway startup recovery checks. No real DB, model, CLI or Telegram calls."""

import asyncio
from contextvars import ContextVar
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[1] / "tools/hermes-synk/delivery-hook/handler.py"
spec = importlib.util.spec_from_file_location("synk_delivery_hook", SOURCE)
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


def route(user="10001", **changes):
    origin = {"platform": "telegram", "chat_type": "dm", "user_id": user, "chat_id": user}
    origin.update(changes)
    return json.dumps({"session_id": "existing-" + user, "origin": origin})


class StartupDeliveryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name) / "profile-home"
        self.rows = {"stored-dm-route": route()}
        self.db_calls = []
        self.closed = 0
        self.lookup_calls = []
        self.command_calls = []
        self.binding_calls = []
        self.clear_calls = 0
        self.command_available = True
        self.command_effect = None
        self.db_error = None
        self.session = ContextVar("fake_gateway_session", default={})
        outer = self

        class DB:
            def __init__(self, **kwargs):
                outer.db_calls.append(kwargs)

            def load_gateway_routing_entries(self, **kwargs):
                outer.db_calls.append(kwargs)
                if outer.db_error:
                    raise outer.db_error
                return outer.rows

            def close(self):
                outer.closed += 1

        def command(raw):
            current = dict(self.session.get())
            self.command_calls.append((raw, current, threading.get_ident()))
            if self.command_effect:
                self.command_effect(current)
            return "The plugin may report zero pending direct-mode records."

        def lookup(name):
            self.lookup_calls.append(name)
            return command if self.command_available else None

        def bind(**values):
            self.binding_calls.append(values)
            return [self.session.set(values)]

        def clear(tokens):
            self.clear_calls += 1
            # Mirrors the official API's explicit clear, rather than nesting/restoring.
            self.session.set({})

        constants = types.ModuleType("hermes_constants")
        constants.get_hermes_home = lambda: self.home
        state = types.ModuleType("hermes_state")
        state.SessionDB = DB
        plugins = types.ModuleType("hermes_cli.plugins")
        plugins.get_plugin_command_handler = lookup
        context = types.ModuleType("gateway.session_context")
        context.set_session_vars = bind
        context.clear_session_vars = clear
        context.get_session_env = lambda name, default="": self.session.get().get(name, default)
        self.patchers = [
            patch.dict(sys.modules, {"hermes_constants": constants, "hermes_state": state,
                                    "hermes_cli.plugins": plugins, "gateway.session_context": context}),
            patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "10001"}),
        ]
        for patcher in self.patchers:
            patcher.start()

    async def asyncTearDown(self):
        if hook._running:
            await asyncio.gather(*list(hook._running), return_exceptions=True)
        await asyncio.sleep(0)
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.temp.cleanup()

    async def startup(self):
        await hook.handle("gateway:startup", {"platforms": ["telegram"]})
        await asyncio.gather(*list(hook._running))
        await asyncio.sleep(0)

    async def test_reads_only_scoped_existing_routing_and_calls_only_recovery(self):
        await self.startup()
        self.assertEqual(self.db_calls, [{"read_only": True}, {"scope": str((self.home / "sessions").resolve())}])
        self.assertEqual(self.closed, 1)
        self.assertEqual(self.lookup_calls, ["synk-recover"])
        self.assertEqual(len(self.command_calls), 1)
        raw, bound, _ = self.command_calls[0]
        self.assertEqual(raw, "")
        self.assertEqual(bound["platform"], "telegram")
        self.assertEqual(bound["user_id"], "10001")
        self.assertEqual(bound["chat_id"], "10001")
        self.assertEqual(bound["chat_type"], "dm")
        self.assertEqual(bound["session_key"], "stored-dm-route")
        self.assertEqual(bound["session_id"], "existing-10001")
        self.assertIs(bound["async_delivery"], True)
        self.assertEqual(bound["session_history_delivery"], "1")
        self.assertEqual(self.clear_calls, 1)

    async def test_background_binding_does_not_clobber_parent_session(self):
        parent = {"user_id": "unrelated-inbound", "session_id": "parent-session"}
        self.session.set(parent)
        parent_thread = threading.get_ident()
        await self.startup()
        self.assertEqual(self.session.get(), parent)
        self.assertNotEqual(self.command_calls[0][2], parent_thread)

    async def test_rejects_groups_other_platforms_missing_origins_and_unauthorized_routes(self):
        self.rows = {
            "not-json": "{broken",
            "list": "[]",
            "missing": "{}",
            "bad-origin": '{"origin":[],"session_id":"existing"}',
            "discord": route(platform="discord"),
            "group": route(chat_type="group"),
            "private-alias": route(chat_type="private"),
            "not-allowed": route("10002"),
            "different-chat": route(chat_id="10002"),
            "empty-user": route(user_id=""),
            "group-id": route(chat_id="-10001"),
            "no-id": json.dumps({"origin": json.loads(route())["origin"]}),
            "non-string-id": json.dumps({"session_id": {}, "origin": json.loads(route())["origin"]}),
            "": route(),
            "valid": route(),
        }
        await self.startup()
        self.assertEqual([call[1]["session_key"] for call in self.command_calls], ["valid"])

    async def test_no_allowlist_means_no_db_read_or_command_lookup(self):
        with patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": ""}):
            await self.startup()
        self.assertEqual(self.db_calls, [])
        self.assertEqual(self.lookup_calls, [])
        self.assertEqual(self.binding_calls, [])

    async def test_multiple_allowed_users_have_separate_context_and_duplicate_dm_is_skipped(self):
        self.rows = {"one": route(), "one-alias": route(), "two": route("10002")}
        with patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "10001; 10002,\n10003"}):
            await self.startup()
        self.assertEqual([call[1]["user_id"] for call in self.command_calls], ["10001", "10002"])
        self.assertEqual(self.clear_calls, 2)

    async def test_missing_registered_command_does_not_bind_or_launch_anything(self):
        self.command_available = False
        with self.assertLogs(hook._logger, level="WARNING"):
            await self.startup()
        self.assertEqual(self.binding_calls, [])
        self.assertEqual(self.command_calls, [])

    async def test_db_failure_closes_read_only_connection_and_does_not_expose_details(self):
        self.db_error = RuntimeError("PRIVATE_TOKEN_must_not_appear")
        with self.assertLogs(hook._logger, level="WARNING") as captured:
            await self.startup()
        self.assertEqual(self.closed, 1)
        self.assertEqual(self.lookup_calls, [])
        self.assertNotIn("PRIVATE_TOKEN", "\n".join(captured.output))

    async def test_command_failure_clears_context_and_continues_without_logging_private_data(self):
        self.rows = {"one": route(), "two": route("10002")}

        def fail_first(current):
            if current["user_id"] == "10001":
                raise RuntimeError("PRIVATE_CONVERSATION_must_not_appear")

        self.command_effect = fail_first
        with patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "10001,10002"}):
            with self.assertLogs(hook._logger, level="WARNING") as captured:
                await self.startup()
        self.assertEqual(len(self.command_calls), 2)
        self.assertEqual(self.clear_calls, 2)
        self.assertNotIn("PRIVATE_CONVERSATION", "\n".join(captured.output))

    async def test_other_lifecycle_events_never_start_recovery(self):
        for event in ["agent:start", "session:start", "command:synk-claude", "gateway:stop"]:
            await hook.handle(event, {})
        self.assertFalse(hook._running)
        self.assertEqual(self.db_calls, [])

    async def test_duplicate_startup_does_not_schedule_parallel_recovery(self):
        entered, release = asyncio.Event(), asyncio.Event()
        calls = []

        async def paused():
            calls.append(True)
            entered.set()
            await release.wait()

        with patch.object(hook, "_recover", paused):
            await hook.handle("gateway:startup", {})
            await entered.wait()
            try:
                await hook.handle("gateway:startup", {})
                self.assertEqual(len(hook._running), 1)
                self.assertEqual(len(calls), 1)
            finally:
                release.set()
                await asyncio.gather(*list(hook._running))
        await asyncio.sleep(0)
        self.assertFalse(hook._running)


if __name__ == "__main__":
    unittest.main()
