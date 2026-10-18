"""Behavior tests for the small Hermes adapter. No model/network/Telegram calls."""

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import types
import unittest
from contextlib import contextmanager
from unittest.mock import patch


SOURCE = Path(__file__).resolve().parents[1] / "tools/hermes-synk/plugin/__init__.py"
NODE = shutil.which("node")
spec = importlib.util.spec_from_file_location("synk_work_plugin", SOURCE)
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)


class FakeContext:
    def __init__(self, env):
        self.env = env
        self.commands = {}
        self.tools = {}
        self.calls = []
        self.process_status = "running"
        self.exit_code = 0
        self.terminal_error = None
        self.terminal_exception = False
        self.notify = True
        self.poll_error = False
        self.native_log = ""
        self.cleanup = None

    def on_unload(self, callback):
        self.cleanup = callback

    def register_command(self, name, handler, **kwargs):
        self.commands[name] = handler

    def register_tool(self, name, handler, **kwargs):
        self.tools[name] = handler

    def dispatch_tool(self, name, args):
        self.calls.append((name, args, self.env.get("HERMES_SESSION_ID")))
        if name == "terminal":
            if self.terminal_exception:
                raise RuntimeError("SECRET must not appear")
            if self.terminal_error:
                return json.dumps({"error": self.terminal_error})
            return json.dumps({"session_id": "proc_1234abcd", "notify_on_complete": self.notify, "exit_code": 0})
        if self.poll_error:
            return json.dumps({"error": "not found", "status": "not_found"})
        if args.get("action") == "log":
            lines = self.native_log.splitlines()
            offset, limit = args.get("offset"), args.get("limit", 200)
            selected = lines[-limit:] if offset is None else lines[offset:offset + limit]
            return json.dumps({"status": self.process_status, "output": "\n".join(selected)})
        return json.dumps({"status": self.process_status, "exit_code": self.exit_code,
                           "completion_reason": "exited", "output_preview": "SECRET raw log"})


class PluginTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / "SYNK repo"
        self.repo.mkdir()
        (self.repo / "AGENTS.md").write_text("read canonical rules", encoding="utf-8")
        self.env = {"HERMES_SESSION_PLATFORM": "telegram", "HERMES_SESSION_CHAT_TYPE": "dm",
                    "HERMES_SESSION_USER_ID": "12345", "HERMES_SESSION_CHAT_ID": "12345",
                    "HERMES_SESSION_KEY": "agent:main:telegram:dm:12345", "HERMES_SESSION_ID": "hermes-origin",
                    "HERMES_SESSION_MESSAGE_ID": "1"}
        self.message_sequence = 1
        self.ctx = FakeContext(self.env)
        self.real_start_worker = plugin._start_delivery_worker
        self.real_prepare_workspace = plugin._prepare_workspace

        def fake_workspace(source, directory, task_id, scope=None):
            workspace = directory / "workspace"
            workspace.mkdir()
            (workspace / ".git").write_text("gitdir: fake-test-only", encoding="utf-8")
            return {"source_root": str(source.resolve()), "workspace_root": str(workspace.resolve()),
                    "snapshot_id": "test-snapshot", "baseline_ref": "test-snapshot-commit",
                    "scope": scope or ["AGENTS.md"], "integration": "not_merged"}

        @contextmanager
        def scope(value):
            old = self.env.get("HERMES_SESSION_ID", "")
            if value is not None:
                self.env["HERMES_SESSION_ID"] = value
            try:
                yield
            finally:
                self.env["HERMES_SESSION_ID"] = old

        self.session = types.ModuleType("gateway.session_context")
        self.session.get_session_env = lambda key, default="": self.env.get(key, default)
        self.session.scoped_current_session_id = scope
        self.constants = types.ModuleType("hermes_constants")
        self.constants.get_hermes_home = lambda: self.root / "hermes"
        self.patchers = [
            patch.object(plugin, "REPO_ROOT", self.repo),
            patch.dict(sys.modules, {"gateway.session_context": self.session, "hermes_constants": self.constants}),
            patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": "12345"}),
            patch.object(plugin.shutil, "which", side_effect=lambda name: "C:/trusted bin/" + name),
            patch.object(plugin, "_start_delivery_worker", return_value=True),
            patch.object(plugin, "_prepare_workspace", side_effect=fake_workspace),
            patch.object(plugin, "_send_native_message", return_value={"success": True, "message_id": "telegram-proof-1"}),
        ]
        for patcher in self.patchers:
            patcher.start()
        plugin.register(self.ctx)

    def tearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.temp.cleanup()

    def records(self):
        return plugin._load_records()

    def request(self, engine="claude", task="AGENTS.md를 읽기만 하고 확인했다고 답해줘"):
        self.message_sequence += 1
        self.env["HERMES_SESSION_MESSAGE_ID"] = str(self.message_sequence)
        return self.ctx.commands["synk-" + engine](task)

    def auto_record(self):
        self.request("codex")
        record=self.records()[0]
        self.ctx.process_status="exited"
        self.ctx.native_log=json.dumps({"type":"item.completed","item":{"type":"agent_message","text":"작업본 변경과 검사 결과를 기록했습니다. 라이브 배포는 하지 않았습니다."}},ensure_ascii=False)
        return record

    def policy_result(self,name,record):
        if name=="validation":
            return {"status":"passed","needs_attention":False,"checks":[{"kind":"node_test","path":"tests/existing.test.cjs"}]}
        return {"state":"integrated","needs_attention":False,"verified":True}

    def test_registers_native_commands_and_tool(self):
        self.assertEqual(set(self.ctx.commands), {"synk", "synk-status", "synk-tasks", "synk-claude", "synk-codex", "synk-release", "synk-recover", "synk-today"})
        self.assertEqual(set(self.ctx.tools), {"synk_work"})
        self.assertIn("recover", plugin.SCHEMA["parameters"]["properties"]["action"]["enum"])
        self.assertIn("기존 팁 봇", self.ctx.commands["synk"](""))

    def test_only_known_private_telegram_sender_is_allowed(self):
        variants = [("HERMES_SESSION_PLATFORM", "discord"), ("HERMES_SESSION_CHAT_TYPE", "group"),
                    ("HERMES_SESSION_CHAT_TYPE", "private"), ("HERMES_SESSION_USER_ID", "999"),
                    ("HERMES_SESSION_CHAT_ID", "-10012345"), ("HERMES_SESSION_KEY", "")]
        for key, invalid in variants:
            with self.subTest(key=key, value=invalid):
                old = self.env[key]
                self.env[key] = invalid
                self.assertNotIn("접수했습니다", self.request())
                self.env[key] = old
        self.assertEqual(self.ctx.calls, [])
        self.assertEqual(self.records(), [])

    def test_empty_allowed_users_denies_even_known_sender(self):
        with patch.dict(os.environ, {"TELEGRAM_ALLOWED_USERS": ""}):
            self.assertIn("등록된 사용자", self.request())
        self.assertEqual(self.ctx.calls, [])

    def test_user_input_never_enters_shell_command(self):
        attack = '읽기만. $(touch injected); `rm danger` "quotes"\n한글 & exit 9'
        reply = self.request(task=attack)
        self.assertIn("접수했습니다", reply)
        record = self.records()[0]
        command = self.ctx.calls[0][1]["command"]
        self.assertNotIn("touch injected", command)
        self.assertNotIn("rm danger", command)
        self.assertIn(attack, (plugin._tasks_dir() / record["id"] / "prompt.txt").read_text(encoding="utf-8"))
        args = self.ctx.calls[0][1]
        self.assertTrue(args["background"])
        self.assertFalse(args["notify"])
        self.assertTrue(args["persist_on_release"])
        self.assertIn("--permission-mode auto", command)
        self.assertNotIn("--model", command)
        self.assertNotIn("--effort", command)
        self.assertNotIn("skip-permissions", command)
        self.assertTrue(command.startswith("env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN"))
        self.assertIn("-u OPENAI_API_KEY -u OPENAI_BASE_URL", command)
        self.assertEqual(self.ctx.calls[0][2], "hermes-origin")

    def test_codex_native_defaults_and_workspace_sandbox(self):
        reply = self.request("codex")
        self.assertIn("접수했습니다", reply)
        command = self.ctx.calls[0][1]["command"]
        self.assertIn("exec --json --sandbox workspace-write -C", command)
        self.assertIn("-c windows.sandbox=mxc exec", command)
        self.assertIn(" - < ", command)
        self.assertNotIn("bypass", command)
        self.assertNotIn("--model", command)

    def test_only_one_existing_allowlisted_repo_is_selected_and_cli_scope_is_isolated(self):
        for name in ("SYNK-talk", "SYNK-website", "SYNK-other"):
            directory = self.root / name
            directory.mkdir()
            (directory / ".git").mkdir()
        expected = [(self.root / name).resolve() for name in ("SYNK-talk", "SYNK-website")]
        self.assertEqual(plugin._additional_workspaces(), expected)
        self.assertEqual(plugin._select_source("SYNK-talk 화면 수정"), expected[0])
        self.assertEqual(plugin._select_source("웹 작업"), self.repo.resolve())
        prompt = self.root / "prompt.txt"
        workspace = {"source_root": str(expected[0]), "workspace_root": str(self.root / "isolated"), "baseline_ref": "snapshot"}
        for engine in ("claude", "codex"):
            with self.subTest(engine=engine):
                command = plugin._command(engine, prompt, "native-id", Path(workspace["workspace_root"]))
                for directory in expected:
                    self.assertNotIn(str(directory).replace("\\", "/"), command)
                self.assertNotIn("SYNK-other", command)
                self.assertNotIn("--add-dir", command)
        content = plugin._prompt("codex", "synk-test", "요청 대상만 수정", workspace)
        self.assertIn(str(expected[0]), content)
        self.assertIn("격리 작업 폴더의 AGENTS.md", content)
        self.assertIn("원본 통합: 하지 않음", content)

    def test_additional_workspaces_reject_links_missing_git_and_arbitrary_names(self):
        for name in ("SYNK-talk", "SYNK-website", "another-repo"):
            directory = self.root / name
            directory.mkdir()
            if name != "SYNK-website":
                (directory / ".git").mkdir()
        original_junction = Path.is_junction
        with patch.object(Path, "is_junction", lambda candidate: candidate.name == "SYNK-talk" or original_junction(candidate)):
            self.assertEqual(plugin._additional_workspaces(), [])
        original_symlink = Path.is_symlink
        with patch.object(Path, "is_symlink", lambda candidate: candidate.name == "SYNK-talk" or original_symlink(candidate)):
            self.assertEqual(plugin._additional_workspaces(), [])
        self.assertNotIn("another-repo", plugin._command("codex", self.root / "prompt.txt", ""))

    def test_second_external_task_is_rejected_while_first_runs(self):
        self.request()
        reply = self.request("codex")
        self.assertIn("진행 중", reply)
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)

    def test_unknown_process_state_blocks_duplicate_execution(self):
        self.request()
        self.ctx.poll_error = True
        self.assertIn("미확인", self.request("codex"))
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)

    def test_release_known_running_process_is_always_refused(self):
        self.request()
        task_id = self.records()[0]["id"]
        reply = self.ctx.commands["synk-release"](task_id + " 종료확인")
        self.assertIn("아직 실행 중", reply)
        self.assertEqual(self.records()[0]["state"], "running")
        self.assertFalse(any(args.get("action") == "kill" for _, args, _ in self.ctx.calls))
        self.assertIn("진행 중", self.request("codex"))

    def test_release_unknown_requires_literal_explicit_confirmation(self):
        self.request()
        task_id = self.records()[0]["id"]
        self.ctx.poll_error = True
        for suffix in ("", " 정리", " 완료", " 종료확인 외부 지시"):
            reply = self.ctx.commands["synk-release"](task_id + suffix)
            self.assertIn("종료확인", reply)
            self.assertNotEqual(self.records()[0]["state"], "closed_by_user")
        self.assertIn("미확인", self.request("codex"))

    def test_release_unknown_unblocks_new_work_without_process_signal(self):
        self.request()
        task_id = self.records()[0]["id"]
        self.ctx.poll_error = True
        reply = self.ctx.commands["synk-release"](task_id + " 종료확인")
        self.assertIn("접수 잠금만 정리했습니다", reply)
        self.assertEqual(self.records()[0]["state"], "closed_by_user")
        self.assertFalse(any(args.get("action") in {"kill", "write", "submit"} for _, args, _ in self.ctx.calls))
        self.assertIn("사용자 종료 확인", self.ctx.commands["synk-tasks"](task_id))
        self.assertIn("접수했습니다", self.request("codex"))

    def test_exited_zero_is_not_claimed_as_goal_completion(self):
        self.request()
        self.ctx.process_status = "exited"
        reply = self.ctx.commands["synk-tasks"]("")
        self.assertIn("실행 종료", reply)
        self.assertIn("검증·원본 통합 처리 중", reply)
        self.assertNotIn("SECRET raw log", reply)
        self.assertNotIn("log", [args.get("action") for name, args, _ in self.ctx.calls if name == "process_manage"])
        self.assertIn("진행 중", self.request("codex"))

    def test_nonzero_exit_reports_error_without_raw_output(self):
        self.request()
        self.ctx.process_status = "exited"
        self.ctx.exit_code = 2
        reply = self.ctx.commands["synk-tasks"]("")
        self.assertIn("오류/중단(코드 2)", reply)
        self.assertNotIn("SECRET", reply)

    def test_dispatch_failure_does_not_leak_error_or_auto_retry(self):
        self.ctx.terminal_error = "TOKEN=secret"
        reply = self.request()
        self.assertIn("시작하지 못했습니다", reply)
        self.assertNotIn("secret", reply)
        self.assertEqual(self.records()[0]["state"], "launch_failed")

    def test_dispatch_unknown_is_preserved_and_blocks_retry(self):
        self.ctx.terminal_exception = True
        reply = self.request()
        self.assertIn("미확인", reply)
        self.assertNotIn("SECRET", reply)
        self.ctx.terminal_exception = False
        self.assertIn("미확인", self.request("codex"))
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)

    def test_direct_delivery_parses_codex_result_without_new_model_turn(self):
        self.request("codex")
        record = self.records()[0]
        self.assertEqual(record["delivery_mode"], plugin.DELIVERY_MODE)
        self.assertFalse(record["notify_on_complete"])
        self.ctx.native_log = "\n".join(json.dumps(event, ensure_ascii=False) for event in [
            {"type": "thread.started", "thread_id": "official-thread"},
            {"type": "item.completed", "item": {"type": "command_execution", "aggregated_output": "SECRET TOOL TRACE"}},
            {"type": "item.completed", "item": {"type": "agent_message", "text": "문서 읽기 도구가 응답하지 않아 실제 내용은 확인하지 못했습니다."}},
            {"type": "turn.completed"},
        ])
        self.assertTrue(plugin._deliver_finished(self.ctx, record, {"status": "exited", "exit_code": 0}))
        receipt = plugin._delivery(record)
        self.assertEqual(receipt["status"], "sent")
        self.assertEqual(receipt["message_id"], "telegram-proof-1")
        self.assertTrue(receipt["final_found"])
        text = plugin._send_native_message.call_args.args[1]
        self.assertIn("확인하지 못했습니다", text)
        self.assertNotIn("SECRET TOOL TRACE", text)
        self.assertNotIn("작업을 완료했습니다", text)
        self.assertEqual(self.records()[0]["native_session_id"], "official-thread")

    def test_long_codex_execution_reads_final_tail_and_independent_head_thread_reference(self):
        self.request("codex")
        record = self.records()[0]
        events = [{"type": "thread.started", "thread_id": "head-thread-reference"}]
        events.extend({"type": "item.completed", "item": {"type": "command_execution"}} for _ in range(2100))
        events.extend([
            {"type": "item.completed", "item": {"type": "agent_message", "text": "긴 작업의 마지막 결과입니다."}},
            {"type": "turn.completed"},
        ])
        self.ctx.native_log = "\n".join(json.dumps(event, ensure_ascii=False) for event in events)
        self.assertGreater(len(self.ctx.native_log.splitlines()), 2000)
        self.assertTrue(plugin._deliver_finished(self.ctx, record, {"status": "exited", "exit_code": 0}))
        delivered = plugin._send_native_message.call_args.args[1]
        self.assertIn("긴 작업의 마지막 결과입니다", delivered)
        self.assertIn("head-thread-reference", delivered)
        self.assertTrue(plugin._delivery(record)["final_found"])
        log_calls = [args for name, args, _ in self.ctx.calls if name == "process_manage" and args.get("action") == "log"]
        self.assertNotIn("offset", log_calls[0])
        self.assertEqual(log_calls[0]["limit"], 2000)
        self.assertEqual(log_calls[1]["offset"], 0)
        self.assertEqual(log_calls[1]["limit"], 20)

    def test_claude_success_subtype_with_error_429_is_reported_as_quota_failure(self):
        self.request()
        record = self.records()[0]
        self.ctx.native_log = json.dumps({"type": "result", "subtype": "success", "is_error": True,
            "terminal_reason": "api_error", "api_error_status": 429, "api_error": "usage_limit_reached",
            "result": "You've hit your weekly limit · resets 12pm (Asia/Seoul)", "modelUsage": {}})
        self.assertTrue(plugin._deliver_finished(self.ctx, record, {"status": "exited", "exit_code": 1}))
        receipt = plugin._delivery(record)
        self.assertTrue(receipt["quota_limited"])
        self.assertTrue(receipt["native_error"])
        text = plugin._send_native_message.call_args.args[1]
        self.assertIn("사용량 한도로 실행하지 못했거나 중단", text)
        self.assertIn("모델·계정은 바꾸지 않았습니다", text)

    def test_persisted_claim_prevents_duplicate_delivery(self):
        self.request()
        record = self.records()[0]
        self.ctx.native_log = json.dumps({"type": "result", "subtype": "success", "result": "읽기 확인"})
        snapshot = {"status": "exited", "exit_code": 0}
        self.assertTrue(plugin._deliver_finished(self.ctx, record, snapshot))
        self.assertFalse(plugin._deliver_finished(self.ctx, record, snapshot))
        self.assertEqual(plugin._send_native_message.call_count, 1)

    def test_unknown_send_is_not_retried_and_saved_result_is_readable(self):
        self.request()
        record = self.records()[0]
        self.ctx.native_log = json.dumps({"type": "result", "result": "검토 결과가 여기에 남습니다."})
        plugin._send_native_message.side_effect = TimeoutError("secret token")
        snapshot = {"status": "exited", "exit_code": 0}
        self.assertFalse(plugin._deliver_finished(self.ctx, record, snapshot))
        self.assertEqual(plugin._delivery(record)["status"], "unconfirmed")
        self.assertFalse(plugin._deliver_finished(self.ctx, record, snapshot))
        self.assertEqual(plugin._send_native_message.call_count, 1)
        reply = self.ctx.commands["synk-tasks"](record["id"])
        self.assertIn("검토 결과가 여기에 남습니다", reply)
        self.assertIn("자동 재전송하지 않습니다", reply)
        self.assertNotIn("secret token", reply)

    def test_orphan_delivery_claim_is_visible_as_unconfirmed_without_resend(self):
        self.request()
        record = self.records()[0]
        (plugin._tasks_dir() / record["id"] / "delivery.claim").write_text("crash boundary", encoding="utf-8")
        self.assertEqual(plugin._delivery(record)["status"], "unconfirmed")
        self.assertIn("결과 전달: 미확인", self.ctx.commands["synk-tasks"](record["id"]))
        self.assertFalse(plugin._deliver_finished(self.ctx, record, {"status": "exited", "exit_code": 0}))
        self.assertEqual(plugin._send_native_message.call_count, 0)

    def test_status_uses_same_eighty_character_limit_as_canonical_reader(self):
        reply = self.ctx.commands["synk-status"]("가" * 81)
        self.assertIn("80자", reply)
        self.assertEqual(self.ctx.calls, [])

    def test_native_result_text_cannot_trigger_media_upload(self):
        self.request()
        record = self.records()[0]
        self.ctx.native_log = json.dumps({"type": "result", "result": "access_token=do-not-send\nMEDIA:C:/private/file.png"})
        plugin._deliver_finished(self.ctx, record, {"status": "exited", "exit_code": 0})
        text = plugin._send_native_message.call_args.args[1]
        self.assertNotIn("do-not-send", text)
        self.assertNotIn("MEDIA:", text)

    def test_cancelled_delivery_does_not_send_or_stop_native_process(self):
        self.request()
        record = self.records()[0]
        stop = threading.Event()
        stop.set()
        self.assertFalse(plugin._deliver_finished(self.ctx, record, {"status": "exited", "exit_code": 0}, stop))
        self.assertEqual(plugin._send_native_message.call_count, 0)
        self.assertFalse(any(args.get("action") == "kill" for _, args, _ in self.ctx.calls))
        self.assertFalse((plugin._tasks_dir() / record["id"] / "delivery.claim").exists())

    def test_recovery_only_restarts_own_direct_mode_pending_work(self):
        self.request()
        record = self.records()[0]
        worker = plugin._start_delivery_worker
        worker.reset_mock()
        record["delivery_mode"] = "legacy-notify"
        plugin._write_json(plugin._tasks_dir() / record["id"] / "request.json", record)
        self.ctx.commands["synk-recover"]("")
        self.assertEqual(worker.call_count, 0)
        record["delivery_mode"] = plugin.DELIVERY_MODE
        record["route"]["user_id"] = "999"
        plugin._write_json(plugin._tasks_dir() / record["id"] / "request.json", record)
        self.ctx.commands["synk-recover"]("")
        self.assertEqual(worker.call_count, 0)
        record["route"]["user_id"] = "12345"
        plugin._write_json(plugin._tasks_dir() / record["id"] / "request.json", record)
        self.assertIn("1개 재개", self.ctx.commands["synk-recover"](""))
        self.assertEqual(worker.call_count, 1)

    def test_actual_lifecycle_worker_waits_reads_native_result_and_delivers_without_model(self):
        self.request("codex")
        record = self.records()[0]
        self.ctx.process_status = "exited"
        self.ctx.native_log = json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": "읽기 시험 결과"}})
        finished = threading.Event()
        real_watch = plugin._watch_delivery

        def watch(*args):
            try:
                real_watch(*args)
            finally:
                finished.set()

        with patch.object(plugin, "_watch_delivery", side_effect=watch):
            self.assertTrue(self.real_start_worker(self.ctx, record))
            self.assertTrue(finished.wait(timeout=3))
        self.assertEqual(plugin._delivery(record)["status"], "sent")
        self.assertTrue(any(name == "process_manage" and args.get("action") == "wait" for name, args, _ in self.ctx.calls))
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)

    def test_unload_cancels_lifecycle_worker_without_killing_official_cli(self):
        self.request()
        record = self.records()[0]
        entered = threading.Event()
        ended = threading.Event()

        def waiting(ctx, task_id, stop):
            entered.set()
            stop.wait(timeout=3)
            ended.set()

        with patch.object(plugin, "_watch_delivery", side_effect=waiting):
            self.assertTrue(self.real_start_worker(self.ctx, record))
            self.assertTrue(entered.wait(timeout=2))
            self.ctx.cleanup()
            self.assertTrue(ended.wait(timeout=2))
        # The test double replaced the worker's finally block, so dispose its map entry.
        with plugin._WORKERS_LOCK:
            plugin._WORKERS.pop(record["id"], None)
        self.assertEqual(plugin._send_native_message.call_count, 0)
        self.assertFalse(any(args.get("action") == "kill" for _, args, _ in self.ctx.calls))

    def test_tool_handler_uses_same_permissions_and_runtime(self):
        reply = json.loads(self.ctx.tools["synk_work"]({"action": "request", "engine": "codex", "task": "읽기만"}))
        self.assertIn("접수했습니다", reply["text"])
        self.assertEqual(len(self.records()), 1)

    def test_task_id_traversal_cannot_read_other_files(self):
        self.assertIn("작업 ID", self.ctx.commands["synk-tasks"]("../../auth.json"))
        self.assertEqual(self.ctx.calls, [])

    def test_tasks_redact_secret_like_request_snippets(self):
        self.request(task="이 문서 읽기. access_token=not-for-output")
        reply = self.ctx.commands["synk-tasks"]("")
        self.assertNotIn("not-for-output", reply)
        self.assertIn("인증값 숨김", reply)

    def test_status_subprocess_is_argv_only_and_limited(self):
        (self.repo / "tools/hermes-synk").mkdir(parents=True)
        (self.repo / "tools/hermes-synk/status.cjs").write_text("", encoding="utf-8")
        with patch.object(plugin.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "상태" * 2500, "")) as run:
            result = self.ctx.commands["synk"]("상태 한글; touch nope")
        args, kwargs = run.call_args
        self.assertEqual(args[0][-1], "한글; touch nope")
        self.assertFalse(kwargs["shell"])
        self.assertEqual(len(result), plugin.MAX_REPLY_CHARS)
        self.assertEqual(self.ctx.calls, [])

    def test_status_exception_is_not_leaked(self):
        with patch.object(plugin, "_status", side_effect=OSError("secret personal text")):
            result = self.ctx.commands["synk-status"]("")
        self.assertIn("미확인", result)
        self.assertNotIn("personal", result)

    def test_missing_session_never_creates_a_new_conversation(self):
        self.env["HERMES_SESSION_ID"] = ""
        with patch.object(plugin, "_existing_session_id", return_value=""):
            reply = self.request()
        self.assertIn("먼저 일반 메시지", reply)
        self.assertEqual(self.records(), [])
        self.assertEqual(self.ctx.calls, [])

    def test_official_routing_lookup_is_read_only_and_pinned(self):
        self.env["HERMES_SESSION_ID"] = ""
        observed = []

        class FakeDB:
            def __init__(self, read_only):
                observed.append(read_only)

            def load_gateway_routing_entries(inner, *, scope):
                observed.append(scope)
                return {self.env["HERMES_SESSION_KEY"]: json.dumps({"session_id": "persisted-origin"})}

            def close(inner):
                observed.append("closed")

        state = types.ModuleType("hermes_state")
        state.SessionDB = FakeDB
        with patch.dict(sys.modules, {"hermes_state": state}):
            reply = self.request()
        self.assertIn("접수했습니다", reply)
        self.assertTrue(observed[0])
        self.assertEqual(observed[-1], "closed")
        self.assertEqual(self.ctx.calls[0][2], "persisted-origin")
        self.assertEqual(self.env["HERMES_SESSION_ID"], "")

    def test_concurrent_telegram_requests_launch_only_one_process(self):
        barrier = threading.Barrier(2)
        replies = []

        def request(engine):
            barrier.wait()
            replies.append(self.request(engine))

        threads = [threading.Thread(target=request, args=(engine,)) for engine in ("claude", "codex")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=4)
            self.assertFalse(thread.is_alive())
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)
        self.assertEqual(sum("접수했습니다" in reply for reply in replies), 1)

    def test_same_message_id_is_deduplicated_after_exit_and_context_recreation(self):
        first = self.request("codex")
        record = self.records()[0]
        self.ctx.process_status = "exited"
        self.ctx.commands["synk-tasks"](record["id"])
        self.ctx = FakeContext(self.env)
        plugin.register(self.ctx)
        with patch.object(plugin, "_REQUEST_LOCK", threading.RLock()):
            second = self.ctx.commands["synk-claude"]("내용·담당이 달라져도 같은 메시지")
        self.assertIn(record["id"], first)
        self.assertIn(record["id"], second)
        self.assertIn("새로 실행하지 않았습니다", second)
        self.assertEqual(self.ctx.calls, [])
        self.assertEqual(len(self.records()), 1)

    def test_atomic_intake_claim_allows_only_one_claim_across_threads(self):
        path = plugin._intake_path(plugin._authorized())
        barrier = threading.Barrier(2)
        claimed = []

        def attempt(task_id):
            barrier.wait()
            claimed.append((task_id, plugin._claim_intake(path, task_id)))

        threads = [threading.Thread(target=attempt, args=(task_id,))
                   for task_id in ("synk-123456789abc", "synk-abcdef123456")]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=3)
        winners = [task_id for task_id, success in claimed if success]
        self.assertEqual(len(winners), 1)
        self.assertEqual(plugin._existing_intake(path), winners[0])

    def test_missing_original_message_id_and_orphan_claim_never_launch_cli(self):
        self.env["HERMES_SESSION_MESSAGE_ID"] = ""
        self.assertIn("메시지 ID", self.ctx.commands["synk-codex"]("읽기만"))
        self.env["HERMES_SESSION_MESSAGE_ID"] = "31"
        intake = plugin._intake_path(plugin._authorized())
        intake.parent.mkdir(parents=True)
        intake.write_text("", encoding="utf-8")
        self.assertIn("기존 접수 기록이 미확인", self.ctx.commands["synk-codex"]("읽기만"))
        self.assertEqual(self.ctx.calls, [])

    def test_ambiguous_dispatch_deduplicates_redelivery_instead_of_relaunching(self):
        self.ctx.terminal_exception = True
        first = self.request()
        record = self.records()[0]
        self.ctx.terminal_exception = False
        second = self.ctx.commands["synk-claude"]("원래 메시지 재전달")
        self.assertIn("미확인", first)
        self.assertIn(record["id"], second)
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)

    def test_isolated_workspace_is_only_cwd_and_source_is_never_auto_integrated(self):
        self.request("codex")
        record = self.records()[0]
        args = self.ctx.calls[0][1]
        self.assertNotEqual(args["workdir"], str(self.repo.resolve()))
        self.assertEqual(args["workdir"], record["workspace_root"])
        self.assertEqual(record["source_root"], str(self.repo.resolve()))
        self.assertEqual(record["integration"], "not_merged")
        self.assertEqual(record["baseline_ref"], "test-snapshot-commit")
        self.assertNotIn("--add-dir", args["command"])
        self.assertIn("원본 통합: 아직 반영하지 않음", plugin._result_text(record, {"status": "응답", "text": "검사 미실행"}))

    def test_multi_repository_request_is_held_before_workspace_or_intake(self):
        reply = self.request(task="SYNK-talk 및 SYNK-website 둘 다 고쳐줘")
        self.assertIn("복수 저장소", reply)
        self.assertEqual(self.records(), [])
        self.assertEqual(self.ctx.calls, [])
        plugin._prepare_workspace.assert_not_called()

    def test_workspace_failure_never_launches_and_same_message_is_not_auto_retried(self):
        plugin._prepare_workspace.side_effect = plugin.UserError("secret details")
        first = self.request()
        second = self.ctx.commands["synk-claude"]("재전달")
        self.assertIn("실행하지 않았습니다", first)
        self.assertNotIn("secret", first)
        self.assertIn("새로 실행하지 않았습니다", second)
        self.assertEqual(self.ctx.calls, [])
        self.assertEqual(self.records()[0]["state"], "launch_failed")

    def test_durable_output_survives_missing_process_registry_without_model_or_reexecution(self):
        self.request("codex")
        record = self.records()[0]
        directory = plugin._tasks_dir() / record["id"]
        events = [{"type": "thread.started", "thread_id": "durable-official-thread"}]
        events.extend({"type": "item.completed", "item": {"type": "command_execution"}} for _ in range(2100))
        events.append({"type": "item.completed", "item": {"type": "agent_message", "text": "격리 작업본만 수정. 검사 2건 통과, 라이브 미확인."}})
        (directory / "native.stdout.jsonl").write_text("\n".join(json.dumps(event, ensure_ascii=False) for event in events), encoding="utf-8")
        (directory / "native.stderr.log").write_text("access_token=not-for-message", encoding="utf-8")
        (directory / "native.exit").write_text("0\n", encoding="ascii")
        self.ctx.poll_error = True
        finished = threading.Event()
        real_watch = plugin._watch_delivery

        def watch(*args):
            try:
                real_watch(*args)
            finally:
                finished.set()

        with patch.object(plugin, "_watch_delivery", side_effect=watch):
            self.assertTrue(self.real_start_worker(self.ctx, record))
            self.assertTrue(finished.wait(timeout=3))
        self.assertEqual(plugin._delivery(record)["status"], "sent")
        self.assertEqual(plugin._delivery(record)["exit_code"], 0)
        self.assertEqual(self.records()[0]["state"], "exited")
        receipt = json.loads((directory / "native-result.json").read_text(encoding="utf-8"))
        self.assertEqual(receipt["native_session_id"], "durable-official-thread")
        text = plugin._send_native_message.call_args.args[1]
        self.assertIn("검사 2건 통과, 라이브 미확인", text)
        self.assertIn("원본 통합: 보류", text)
        self.assertNotIn("not-for-message", text)
        self.assertEqual(sum(name == "terminal" for name, _, _ in self.ctx.calls), 1)
        self.assertFalse(any(name == "process_manage" for name, _, _ in self.ctx.calls))

    def test_orphan_delivery_claim_still_exposes_durable_final_without_sending(self):
        self.request()
        record = self.records()[0]
        directory = plugin._tasks_dir() / record["id"]
        (directory / "native.stdout.jsonl").write_text(json.dumps({"type": "result", "result": "작업본 결과 보존됨"}), encoding="utf-8")
        (directory / "native.exit").write_text("0", encoding="ascii")
        (directory / "delivery.claim").write_text("crashed", encoding="utf-8")
        self.ctx.poll_error = True
        reply = self.ctx.commands["synk-tasks"](record["id"])
        self.assertIn("작업본 결과 보존됨", reply)
        self.assertIn("자동 재전송하지 않습니다", reply)
        plugin._send_native_message.assert_not_called()

    def test_partial_exit_receipt_is_never_assumed_to_be_finished(self):
        self.request()
        record = self.records()[0]
        directory = plugin._tasks_dir() / record["id"]
        (directory / "native.exit.tmp").write_text("0", encoding="ascii")
        self.assertEqual(plugin._durable_snapshot(record), {})
        (directory / "native.exit").write_text("0; unexpected", encoding="ascii")
        self.assertEqual(plugin._durable_snapshot(record), {})

    def test_deadline_is_saved_only_when_explicit_and_timezone_is_present(self):
        response = json.loads(self.ctx.tools["synk_work"]({"action": "request", "engine": "codex", "task": "읽기만",
            "due_at": "2026-10-19T18:00:00+09:00", "due_source": "user"}))
        self.assertIn("접수했습니다", response["text"])
        record = self.records()[0]
        self.assertEqual(record["due_source"], "user")
        self.assertEqual(record["due_at"], "2026-10-19T18:00:00+09:00")
        for due_at, due_source in (("2026-10-19T18:00:00", "user"), ("2026-10-19T18:00:00+09:00", "inferred")):
            with self.subTest(due_at=due_at, due_source=due_source):
                with self.assertRaises(plugin.UserError):
                    plugin._deadline(due_at, due_source)
        self.assertEqual(plugin._deadline("", ""), {})

    def test_overview_slash_and_tool_are_deterministic_argv_only(self):
        script = self.repo / "tools/hermes-synk/overview.cjs"
        script.parent.mkdir(parents=True)
        script.write_text("", encoding="utf-8")
        with patch.object(plugin.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "통합 상태", "")) as run:
            self.assertEqual(self.ctx.commands["synk-today"](""), "통합 상태")
            self.assertIn("통합 상태", self.ctx.tools["synk_work"]({"action": "overview"}))
        self.assertEqual(run.call_args.args[0][-1], str(script))
        self.assertFalse(run.call_args.kwargs["shell"])
        self.assertEqual(self.ctx.calls, [])

    def test_workspace_adapter_receipt_cannot_select_source_or_external_link(self):
        script = self.repo / "tools/hermes-synk/workspace.cjs"
        script.parent.mkdir(parents=True)
        script.write_text("", encoding="utf-8")
        directory = plugin._tasks_dir() / "synk-0123456789ab"
        workspace = directory / "workspace"
        workspace.mkdir(parents=True)
        (workspace / ".git").write_text("gitdir: fake-test-only", encoding="utf-8")
        receipt = {"ok": True, "workspace_root": str(workspace), "source_root": str(self.repo), "integration": "not_merged"}
        with patch.object(plugin.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, json.dumps(receipt), "")) as run:
            accepted = self.real_prepare_workspace(self.repo, directory, "synk-0123456789ab")
            self.assertEqual(accepted["workspace_root"], str(workspace.resolve()))
            self.assertFalse(run.call_args.kwargs["shell"])
            self.assertIn("--task-id", run.call_args.args[0])
            receipt["source_root"] = str(self.root)
            run.return_value.stdout = json.dumps(receipt)
            with self.assertRaises(plugin.UserError):
                self.real_prepare_workspace(self.repo, directory, "synk-0123456789ab")
            receipt["source_root"] = str(self.repo)
            run.return_value.stdout = json.dumps(receipt)
            original = Path.is_junction
            with patch.object(Path, "is_junction", lambda path: path == workspace or original(path)):
                with self.assertRaises(plugin.UserError):
                    self.real_prepare_workspace(self.repo, directory, "synk-0123456789ab")

    def test_global_admission_is_exclusive_across_independent_python_processes(self):
        child = self.root / "admission-child.py"
        child.write_text("""import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('child_synk', sys.argv[1])
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)
plugin._home = lambda: pathlib.Path(sys.argv[2])
try:
    with plugin._admission():
        print('UNEXPECTED_ADMISSION')
except plugin.UserError:
    print('BLOCKED')
""", encoding="utf-8")
        with plugin._admission():
            result = subprocess.run([sys.executable, str(child), str(SOURCE), str(self.root / "hermes")],
                                    capture_output=True, text=True, timeout=8)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "BLOCKED")
        self.assertFalse((plugin._tasks_dir() / "admission.lock").exists())

    def test_admission_reclaims_only_proven_dead_owner_and_fails_closed_otherwise(self):
        root = plugin._tasks_dir()
        root.mkdir(parents=True)
        lock = root / "admission.lock"
        stale = {"pid": 999999999, "owner": "previous-process"}
        plugin._write_json(lock, stale)
        with patch.object(plugin, "_owner_alive", return_value=False):
            with plugin._admission():
                self.assertEqual(json.loads(lock.read_text())["pid"], os.getpid())
        self.assertFalse(lock.exists())
        for alive in (True, None):
            plugin._write_json(lock, stale)
            with patch.object(plugin, "_owner_alive", return_value=alive):
                with self.assertRaises(plugin.UserError):
                    with plugin._admission():
                        self.fail("must fail closed")
            self.assertEqual(json.loads(lock.read_text())["owner"], "previous-process")
        lock.write_text("partial crash", encoding="utf-8")
        with self.assertRaises(plugin.UserError):
            with plugin._admission():
                self.fail("must not reclaim unknown owner")

    def test_linked_task_spool_is_rejected_before_any_cli(self):
        original = Path.is_junction
        with patch.object(Path, "is_junction", lambda path: path.name == "synk-tasks" or original(path)):
            reply = self.request()
        self.assertIn("링크", reply)
        self.assertEqual(self.ctx.calls, [])

    def test_workspace_failure_reports_only_known_code(self):
        script = self.repo / "tools/hermes-synk/workspace.cjs"
        script.parent.mkdir(parents=True)
        script.write_text("", encoding="utf-8")
        directory = plugin._tasks_dir() / "synk-0123456789ab"
        for code in ("SOURCE_CHANGED", "IGNORED_SCOPE_SOURCE", "PREPARATION_TIME_LIMIT", "secret-user-file-secret"):
            response = subprocess.CompletedProcess([], 1, json.dumps({"ok": False, "code": code}), "secret stderr")
            with patch.object(plugin.subprocess, "run", return_value=response):
                with self.assertRaises(plugin.UserError) as raised:
                    self.real_prepare_workspace(self.repo, directory, "synk-0123456789ab")
            self.assertNotIn("secret", str(raised.exception))
            self.assertIn(code if code in {"SOURCE_CHANGED", "IGNORED_SCOPE_SOURCE", "PREPARATION_TIME_LIMIT"} else "WORKSPACE_PREPARE_FAILED", str(raised.exception))

    def test_scope_is_bounded_relative_path_argv_and_explicit_in_prompt(self):
        response = json.loads(self.ctx.tools["synk_work"]({"action": "request", "engine": "codex", "task": "기능을 고쳐줘",
            "scope": ["tools/test.cjs", "tests"]}))
        self.assertIn("접수했습니다", response["text"])
        record = self.records()[0]
        self.assertEqual(record["scope"], ["tools/test.cjs", "tests"])
        self.assertEqual(plugin._prepare_workspace.call_args.args[-1], record["scope"])
        content = (plugin._tasks_dir() / record["id"] / "prompt.txt").read_text(encoding="utf-8")
        self.assertIn("sparse worktree", content)
        self.assertIn("없는 코드가 삭제되거나 신규 파일이라는 뜻은 아닙니다", content)
        self.assertIn("tools/test.cjs", content)
        for bad in (["../secrets"], ["C:/private"], ["/private"], ["tools/*"], "tools", ["x"] * 33):
            with self.subTest(scope=bad):
                with self.assertRaises(plugin.UserError):
                    plugin._request_scope("요청", bad)
        task, paths = plugin._request_scope('--scope "tools/file name.cjs" tests -- 범위 안만 고쳐줘', None)
        self.assertEqual(task, "범위 안만 고쳐줘")
        self.assertEqual(paths, ["tools/file name.cjs", "tests"])
        self.assertEqual(plugin._request_scope("tools/file.cjs 읽기", None)[1], ["tools/file.cjs"])

    def test_native_shell_spools_stdout_stderr_and_atomic_exit_without_real_cli(self):
        bash = next((path for path in (Path("C:/Program Files/Git/bin/bash.exe"), Path("/bin/bash")) if path.is_file()), None)
        if not bash:
            self.skipTest("Bash is unavailable")
        directory = self.root / "durable output"
        directory.mkdir()
        fake = directory / "fake official cli.sh"
        fake.write_text("""#!/bin/sh
cat >/dev/null
printf '%s\\n' '{"type":"result","result":"native-stub-result"}'
printf '%s\\n' 'private-fake-stderr' >&2
exit 37
""", encoding="utf-8", newline="\n")
        fake.chmod(0o700)
        prompt = directory / "prompt.txt"
        prompt.write_text("literal $(touch SHOULD_NOT_EXIST)", encoding="utf-8")
        with patch.object(plugin.shutil, "which", return_value=str(fake)):
            command = plugin._command("claude", prompt, "stub-session", directory)
        result = subprocess.run([str(bash), "-c", command], cwd=str(directory), capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 37)
        self.assertEqual(result.stdout, b"")
        self.assertIn("native-stub-result", (directory / "native.stdout.jsonl").read_text())
        self.assertEqual((directory / "native.stderr.log").read_text().strip(), "private-fake-stderr")
        self.assertEqual((directory / "native.exit").read_text().strip(), "37")
        self.assertFalse((directory / "native.exit.tmp").exists())
        self.assertFalse((directory / "SHOULD_NOT_EXIST").exists())

    def test_actual_node_workspace_contract_validates_current_dirty_scoped_snapshot(self):
        if not NODE:
            self.skipTest("Node is unavailable")
        # Only the temporary repository is allowlisted by this test bridge. The
        # production CLI's Documents allowlist remains unchanged.
        script = self.repo / "tools/hermes-synk/workspace.cjs"
        script.parent.mkdir(parents=True)
        bridge = "const {prepareWorkspace}=require(" + json.dumps(str(SOURCE.parent.parent / "workspace.cjs")) + ");\n"
        bridge += """const values=process.argv.slice(3),args={};
for(let i=0;i<values.length;i+=2) args[values[i]]=values[i+1];
prepareWorkspace({repo:args['--repo'],taskDir:args['--task-dir'],taskId:args['--task-id'],scope:JSON.parse(args['--scope-json']||'[]'),allowedRoots:[args['--repo']]}).then(result=>{console.log(JSON.stringify(result));process.exitCode=result.ok?0:2});
"""
        script.write_text(bridge, encoding="utf-8")
        for name in ("git-storage-check.cjs", "git-storage-policy.json"):
            (self.repo / "tools" / name).write_bytes((SOURCE.parents[2] / name).read_bytes())
        (self.repo / "package.json").write_text(json.dumps({"scripts": {"check:storage": "node tools/git-storage-check.cjs --cached"}}), encoding="utf-8")
        (self.repo / "src").mkdir()
        current = self.repo / "src/current.js"
        current.write_text("const value = 'base';\n", encoding="utf-8")

        def git(*args):
            result = subprocess.run(["git", "-c", "core.hooksPath=" + str(self.root / "no-hooks"), *args],
                                    cwd=str(self.repo), capture_output=True, text=True, encoding="utf-8", timeout=12)
            self.assertEqual(result.returncode, 0, "temporary fixture Git command failed")
            return result.stdout.strip()

        git("init", "-q", "-b", "main")
        git("config", "user.name", "Fixture")
        git("config", "user.email", "fixture@localhost")
        git("config", "extensions.worktreeConfig", "true")
        git("add", ".")
        git("commit", "-qm", "fixture baseline")
        before = git("rev-parse", "HEAD")
        index = (self.repo / ".git/index").read_bytes()
        current.write_text("const value = 'current uncommitted';\n", encoding="utf-8")
        task_id = "synk-0123456789ab"
        directory = plugin._tasks_dir() / task_id
        with patch.object(plugin.shutil, "which", return_value=NODE):
            result = self.real_prepare_workspace(self.repo, directory, task_id, ["src"])
        self.assertEqual(result["integration"], "not_merged")
        self.assertIn("src", result["scope"])
        self.assertEqual(Path(result["workspace_root"]).parent, directory)
        self.assertEqual((Path(result["workspace_root"]) / "src/current.js").read_text(encoding="utf-8"), current.read_text(encoding="utf-8"))
        self.assertEqual(git("rev-parse", "HEAD"), before)
        self.assertEqual((self.repo / ".git/index").read_bytes(), index)

    def test_new_requests_have_explicit_auto_policy_and_completion_report_contract(self):
        self.request()
        record=self.records()[0]
        self.assertEqual(record['integration_policy'],'auto_verified_v1')
        self.assertEqual(record['notification_policy'],'attention_only_v1')
        self.assertEqual(record['finalization_state'],'pending')
        text=(plugin._tasks_dir()/record['id']/'prompt.txt').read_text(encoding='utf-8')
        self.assertIn('.synk-completion.json',text)
        self.assertIn('node_test',text)
        self.assertIn('종료 뒤 최신 원본과 합친 후보를 별도로 재검증',text)
        for adapter in ['python_unittest','typescript','json_schema','browser']:
            self.assertIn(adapter,text)
        self.assertIn('validation-preview.cjs',text)
        self.assertIn('현재 공식 세션 안에서 수정하고 다시 검사',text)

    def test_verified_integration_is_quiet_and_preserved_for_manual_tasks(self):
        record=self.auto_record()
        with patch.object(plugin,'_policy_tool',side_effect=self.policy_result) as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
        self.assertEqual([call.args[0] for call in tools.call_args_list],['validation','integration'])
        self.assertEqual(plugin._delivery(record)['status'],'suppressed_success')
        self.assertFalse(plugin._delivery(record)['needs_attention'])
        current=self.records()[0]
        self.assertEqual(current['integration'],'integrated')
        self.assertEqual(current['validation_status'],'passed')
        self.assertEqual(current['finalization_state'],'completed')
        plugin._send_native_message.assert_not_called()
        reply=self.ctx.commands['synk-tasks'](record['id'])
        self.assertIn('검증 후 원본 작업 파일에 반영됨',reply)
        self.assertIn('성공·무변경으로 생략',reply)
        self.assertIn('라이브 배포는 하지 않았습니다',reply)
        self.assertFalse((plugin._tasks_dir()/record['id']/'delivery.claim').exists())

    def test_verified_no_changes_is_quiet_after_both_deterministic_helpers(self):
        record=self.auto_record()
        def policy(name,record):
            return {'status':'no_changes','needs_attention':False} if name=='validation' else {'state':'no_changes','verified':True,'needs_attention':False}
        with patch.object(plugin,'_policy_tool',side_effect=policy) as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
        self.assertEqual(tools.call_count,2)
        self.assertEqual(self.records()[0]['integration'],'no_changes')
        self.assertEqual(plugin._delivery(record)['status'],'suppressed_success')
        plugin._send_native_message.assert_not_called()

    def test_exit_zero_with_failed_validation_notifies_once_without_integration(self):
        record=self.auto_record()
        with patch.object(plugin,'_policy_tool',return_value={'status':'needs_attention','reason_code':'TEST_FAILED','needs_attention':True}) as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
            self.assertFalse(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
        self.assertEqual([call.args[0] for call in tools.call_args_list],['validation'])
        self.assertEqual(self.records()[0]['attention']['status'],'pending')
        self.assertEqual(self.records()[0]['finalization_state'],'attention')
        self.assertEqual(plugin._send_native_message.call_count,1)
        self.assertIn('TEST_FAILED',plugin._send_native_message.call_args.args[1])

    def test_validation_requires_explicit_pass_before_apply_and_verified_receipt_before_quiet(self):
        record=self.auto_record()
        with patch.object(plugin,'_policy_tool',return_value={'status':'passed'}) as tools:
            plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0})
        self.assertEqual(tools.call_count,1)
        self.assertEqual(self.records()[0]['integration'],'needs_attention')
        self.assertEqual(plugin._delivery(record)['status'],'sent')

    def test_integration_conflict_or_unknown_needs_attention_without_replay(self):
        record=self.auto_record()
        def policy(name,record):
            if name=='validation':return {'status':'passed','needs_attention':False}
            raise TimeoutError('SECRET never print')
        with patch.object(plugin,'_policy_tool',side_effect=policy) as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
            plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0})
        self.assertEqual(tools.call_count,2)
        self.assertEqual(self.records()[0]['integration'],'unknown')
        self.assertIn('INTEGRATION_RESULT_UNCONFIRMED',plugin._send_native_message.call_args.args[1])
        self.assertNotIn('SECRET',plugin._send_native_message.call_args.args[1])

    def test_native_quota_error_skips_validation_and_integration(self):
        record=self.auto_record()
        self.ctx.native_log=json.dumps({'type':'error','message':'usage_limit_reached'})
        with patch.object(plugin,'_policy_tool') as tools:
            plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':1})
        tools.assert_not_called()
        self.assertIn('NATIVE_QUOTA_LIMITED',plugin._send_native_message.call_args.args[1])

    def test_legacy_records_keep_original_result_delivery_without_auto_integration(self):
        record=self.auto_record()
        record.pop('integration_policy')
        record.pop('notification_policy')
        plugin._write_json(plugin._tasks_dir()/record['id']/'request.json',record)
        with patch.object(plugin,'_policy_tool') as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
        tools.assert_not_called()
        self.assertEqual(plugin._delivery(record)['status'],'sent')
        self.assertEqual(self.records()[0]['integration'],'not_merged')

    def test_finalization_is_busy_until_checks_and_integration_finish(self):
        record=self.auto_record()
        def policy(name,record):
            if name=='validation':
                self.assertIn('진행 중',self.request('claude'))
                self.assertIn('검증·원본 통합을 처리 중',self.ctx.commands['synk-release'](record['id']+' 종료확인'))
            return self.policy_result(name,record)
        with patch.object(plugin,'_policy_tool',side_effect=policy):
            plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0})
        self.assertEqual(sum(name=='terminal' for name,_,_ in self.ctx.calls),1)
        self.assertIn('접수했습니다',self.request('claude'))

    def test_restart_reuses_persisted_finalization_without_checks_apply_or_send(self):
        record=self.auto_record()
        plugin._write_json(plugin._tasks_dir()/record['id']/'finalization.json',{
            'version':1,'task_id':record['id'],'policy':'auto_verified_v1','status':'completed','needs_attention':False,
            'reason_code':'VERIFIED_INTEGRATION','validation_status':'passed','integration_state':'integrated','verified':True})
        with patch.object(plugin,'_policy_tool') as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
            self.assertFalse(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
        tools.assert_not_called()
        plugin._send_native_message.assert_not_called()
        self.assertEqual(plugin._delivery(record)['status'],'suppressed_success')

    def test_unload_between_validation_and_apply_can_resume_without_notification_claim(self):
        record=self.auto_record()
        stop=threading.Event()
        def stopping(name,record):
            self.assertEqual(name,'validation')
            stop.set()
            return {'status':'passed','needs_attention':False}
        with patch.object(plugin,'_policy_tool',side_effect=stopping) as tools:
            self.assertFalse(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0},stop))
        self.assertEqual(tools.call_count,1)
        self.assertFalse((plugin._tasks_dir()/record['id']/'delivery.claim').exists())
        self.assertEqual(plugin._delivery(record),{})
        stop.clear()
        with patch.object(plugin,'_policy_tool',side_effect=self.policy_result):
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0},stop))
        self.assertEqual(plugin._delivery(record)['status'],'suppressed_success')
        plugin._send_native_message.assert_not_called()

    def test_incomplete_success_receipt_never_silently_claims_verified_integration(self):
        record=self.auto_record()
        plugin._write_json(plugin._tasks_dir()/record['id']/'finalization.json',{
            'version':1,'task_id':record['id'],'policy':'auto_verified_v1','status':'completed','needs_attention':False})
        with patch.object(plugin,'_policy_tool') as tools:
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
        tools.assert_not_called()
        self.assertEqual(self.records()[0]['integration'],'unknown')
        self.assertEqual(plugin._delivery(record)['status'],'sent')
        self.assertIn('FINALIZATION_RECEIPT_UNCONFIRMED',plugin._send_native_message.call_args.args[1])

    def test_concurrent_finalization_guard_cannot_apply_twice(self):
        record=self.auto_record()
        with plugin._finalization_guard(record) as held:
            self.assertTrue(held)
            with patch.object(plugin,'_policy_tool') as tools:
                self.assertFalse(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))
            tools.assert_not_called()
        with patch.object(plugin,'_policy_tool',side_effect=self.policy_result):
            self.assertTrue(plugin._deliver_finished(self.ctx,record,{'status':'exited','exit_code':0}))

    def test_policy_tools_use_fixed_scripts_and_argv_only(self):
        record=self.auto_record()
        for name in ('validation','integration'):
            script=self.repo/'tools/hermes-synk'/(name+'.cjs')
            script.parent.mkdir(parents=True,exist_ok=True)
            script.write_text('',encoding='utf-8')
            payload={'status':'passed','needs_attention':False} if name=='validation' else {'state':'integrated','verified':True,'needs_attention':False}
            with patch.object(plugin.subprocess,'run',return_value=subprocess.CompletedProcess([],0,json.dumps(payload),'')) as run:
                self.assertEqual(plugin._policy_tool(name,record),payload)
            argv=run.call_args.args[0]
            self.assertEqual(argv[1],str(script))
            self.assertEqual(argv[-2:],["--task-dir",str(plugin._tasks_dir()/record['id'])])
            self.assertEqual('apply' in argv,name=='integration')
            self.assertFalse(run.call_args.kwargs['shell'])


if __name__ == "__main__":
    unittest.main(verbosity=2)
