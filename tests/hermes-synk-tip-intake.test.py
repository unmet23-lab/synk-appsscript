"""Tip receipts: isolated files and fake ledger replies, no model/network/send."""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("tip_intake_tested", ROOT / "tools/hermes-synk/plugin/tip_intake.py")
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)
AT = "2026-10-28T06:00:00+00:00"
URL = "https://www.instagram.com/reel/ExampleTip01/?igsh=test"


def event(text=URL, **changes):
    values = dict(text=text, source=types.SimpleNamespace(platform="telegram", chat_type="dm", user_id="12345", chat_id="12345"),
                  message_id="10", internal=False, media_urls=[], media_types=[], reply_to_is_own_message=False)
    values.update(changes)
    return types.SimpleNamespace(**values)


class TipIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name)
        self.owner = intake.owner_hash({"chat_id": "12345", "user_id": "12345"})

    def tearDown(self):
        self.temp.cleanup()

    def capture(self, message=None):
        return intake.capture(self.home, message or event(), {"12345"}, now=AT)

    def path(self, row):
        return self.home / "runtime/synk-tip-intake" / (row["id"] + ".json")

    def test_shared_public_url_identity_fixtures(self):
        cases = json.loads((ROOT / "tests/fixtures/hermes-tip-url-cases.json").read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(name=case["name"]):
                result = intake.canonical_url(case["input"])
                if case.get("reject"):
                    self.assertIsNone(result)
                else:
                    self.assertEqual((result["url"], result["lookupKey"], result["exact"]),
                                     (case["url"], case["key"], case["exact"]))

    def test_share_receipt_is_minimal_and_durable_before_any_model(self):
        row = self.capture(event(URL + "\n이런 그림은 어떻게 만드는거야?"))
        saved = self.path(row).read_text(encoding="utf-8")
        self.assertEqual(row["status"], "pending")
        self.assertEqual(row["refs"][0]["lookupKey"], "ExampleTip01")
        self.assertEqual(row["ownerHash"], self.owner)
        self.assertNotIn("이런 그림", saved)
        self.assertNotIn('"12345"', saved)
        self.assertNotIn("igsh", saved)

    def test_duplicate_delivery_does_not_rewrite_or_change_time(self):
        row = self.capture()
        before = self.path(row).read_bytes(), self.path(row).stat().st_mtime_ns
        again = intake.capture(self.home, event(), {"12345"}, now="2026-11-01T00:00:00Z")
        self.assertEqual(again, row)
        self.assertEqual(before, (self.path(row).read_bytes(), self.path(row).stat().st_mtime_ns))

    def test_new_media_in_same_album_is_merged_without_losing_old_reference(self):
        row = self.capture()
        source = self.home / "cache/photo.jpg"
        source.parent.mkdir()
        source.write_bytes(b"fixture")
        row2 = self.capture(event(media_urls=[str(source)], media_types=["image/jpeg"]))
        self.assertEqual(row2["id"], row["id"])
        self.assertEqual(len(row2["refs"]), 2)
        self.assertEqual(row2["refs"][1]["reference"], "cache/photo.jpg")

    def test_other_channels_senders_commands_and_work_requests_are_not_tips(self):
        variants = [event(internal=True), event(message_id="../bad"), event(text="/synk_claude " + URL),
                    event(text=URL + " 이 코드 고쳐줘"), event(text=URL + " 이 파일 배포해"),
                    event(prompt_response={"option_id": "yes"}),
                    event(source=types.SimpleNamespace(platform="telegram", chat_type="group", user_id="12345", chat_id="12345")),
                    event(source=types.SimpleNamespace(platform="telegram", chat_type="dm", user_id="67890", chat_id="67890")),
                    event(source=types.SimpleNamespace(platform="discord", chat_type="dm", user_id="12345", chat_id="12345"))]
        for item in variants:
            with self.subTest(item=item):
                self.assertIsNone(self.capture(item))
        self.assertFalse((self.home / "runtime").exists())

    def test_normal_reply_to_bot_can_share_a_new_tip(self):
        row = self.capture(event(reply_to_is_own_message=True, reply_to_message_id="older-bot-response"))
        self.assertEqual(row["status"], "pending")
        self.assertEqual(row["refs"][0]["lookupKey"], "ExampleTip01")

    def test_general_make_or_apply_share_keeps_minimal_receipt(self):
        for caption in ["이거 적용해보자", "이렇게 만들어줘", "이 팁으로 그림 만들어주세요", "이거 고쳐줘"]:
            with self.subTest(caption=caption):
                self.assertEqual(self.capture(event(URL + " " + caption))["status"], "pending")

    def test_descriptive_code_words_are_not_explicit_work_requests(self):
        for caption in ["git push 명령을 설명하는 영상이야", "code commit push 차이를 설명하는 팁",
                        "Git tutorial: add, commit, push explained", "git basics: clone, commit, push"]:
            with self.subTest(caption=caption):
                self.assertEqual(self.capture(event(URL + " " + caption))["status"], "pending")

    def test_explicit_code_scope_or_cli_delegation_still_excludes_receipt(self):
        for caption in ["이 코드 고쳐줘", "main.py 수정해줘", "저장소에 적용해줘", "please fix the code", "코덱스에 이 작업 맡겨"]:
            with self.subTest(caption=caption):
                self.assertIsNone(self.capture(event(URL + " " + caption)))

    def test_polite_english_code_requests_are_excluded(self):
        for caption in ["Can you fix the code?", "Could you please deploy this repo?",
                        "Would you update main.py?", "Will you please commit this file?",
                        "Hey, can you fix the code?", "Claude, could you update main.py?"]:
            with self.subTest(caption=caption):
                self.assertIsNone(self.capture(event(URL + " " + caption)))

    def test_english_code_explanations_remain_shared_tips(self):
        for caption in ["Can you explain how git push works?", "Could you explain this repo's deployment?",
                        "This video explains how to fix code.", "git push 설명하는 영상이야"]:
            with self.subTest(caption=caption):
                self.assertEqual(self.capture(event(URL + " " + caption))["status"], "pending")

    def test_polite_general_creation_without_code_scope_keeps_receipt(self):
        for caption in ["Can you create this illustration?", "Could you please build a story like this?"]:
            with self.subTest(caption=caption):
                self.assertEqual(self.capture(event(URL + " " + caption))["status"], "pending")

    def test_signed_or_private_refs_keep_only_source_message(self):
        secret = "VERY_SECRET_CREDENTIAL"
        row = self.capture(event(text="https://user:" + secret + "@example.com/video https://example.com/?token=" + secret,
                                 media_urls=["https://api.telegram.org/file/bot" + secret + "/photo.jpg"], media_types=["image/jpeg"]))
        saved = self.path(row).read_text(encoding="utf-8")
        self.assertNotIn(secret, saved)
        self.assertNotIn("api.telegram", saved)
        self.assertTrue(all(ref["exact"] is False for ref in row["refs"]))

    def test_external_local_media_paths_are_not_copied_or_exposed(self):
        row = self.capture(event(text="", media_urls=[str(self.home.parent / "private-name.jpg")]))
        self.assertEqual(row["refs"][0]["reference"], "platform-message:10#media0")
        self.assertNotIn("private-name", self.path(row).read_text())

    def test_meaningful_query_and_fragment_are_not_exact_matches(self):
        for url in ["https://example.com/view?id=1", "https://example.com/#/document/2"]:
            with self.subTest(url=url):
                ref = intake.canonical_url(url)
                self.assertFalse(ref["exact"])
                self.assertIsNone(ref["lookupKey"])

    def test_youtube_identity_preserves_video_id(self):
        expected = "https://www.youtube.com/watch?v=abcdefghijk"
        for url in ["https://youtu.be/abcdefghijk?si=x", "https://www.youtube.com/shorts/abcdefghijk?feature=share",
                    "https://youtube.com/watch?v=abcdefghijk&t=30"]:
            self.assertEqual(intake.canonical_url(url)["lookupKey"], expected)
        self.assertFalse(intake.canonical_url("https://youtube.com/watch?v=short")["exact"])

    def test_public_tracking_is_stripped_but_path_case_is_kept(self):
        ref = intake.canonical_url("https://EXAMPLE.com:443/Case/?utm_source=x&gclid=y")
        self.assertEqual(ref["url"], "https://example.com/Case/")
        self.assertTrue(ref["exact"])

    def test_private_hosts_or_api_credentials_are_rejected(self):
        for url in ["http://127.0.0.1/a", "http://localhost/a", "https://service.internal/a",
                    "https://example.com/?api_key=secret", "https://example.com/?X-Amz-Signature=secret",
                    "https://api.telegram.org/file/bot123/a", "https://t.me/+private"]:
            self.assertIsNone(intake.canonical_url(url), url)

    def test_reference_overflow_cannot_be_marked_complete(self):
        row = self.capture(event(" ".join("https://example.com/" + str(i) for i in range(12))))
        self.assertEqual(len(row["refs"]), 10)
        self.assertEqual(row["refs"][-1]["reason"], "reference-limit")

    def test_reconcile_requires_find_and_exact_recent_identity(self):
        row = self.capture()
        calls = []
        def read(command, argument):
            calls.append((command, argument))
            return {"ok": True, "rows": [{"row": 33, **({"게시물ID": "ExampleTip01"} if command == "recent" else {})}]}
        updated = intake.reconcile(self.home, self.owner, row["id"], read, now=AT)
        self.assertEqual(updated["status"], "reconciled")
        self.assertEqual(updated["ledgerMatches"], [{"lookupKey": "ExampleTip01", "row": 33}])
        self.assertEqual(calls, [("recent", "50"), ("find", "ExampleTip01")])

    def test_substring_hit_or_old_unverifiable_row_remains_pending(self):
        for recent_rows in [[], [{"row": 33, "게시물ID": "OtherTip"}]]:
            row = self.capture()
            result = intake.reconcile(self.home, self.owner, row["id"], lambda cmd, arg: {"ok": True, "rows": recent_rows if cmd == "recent" else [{"row": 33}]})
            self.assertEqual(result["status"], "pending")
            self.assertEqual(result["errorCode"], "TIP_LEDGER_IDENTITY_UNVERIFIED")

    def test_multiple_substring_results_do_not_claim_duplicate_identity(self):
        for recent_rows in [[], [{"row": 3, "게시물ID": "ExampleTip01"}]]:
            row = self.capture()
            result = intake.reconcile(self.home, self.owner, row["id"], lambda cmd, arg: {
                "ok": True, "rows": recent_rows if cmd == "recent" else [{"row": 3}, {"row": 4}]})
            self.assertEqual(result["status"], "pending")
            self.assertEqual(result["errorCode"], "TIP_LEDGER_IDENTITY_UNVERIFIED")
            self.assertEqual(result["ledgerMatches"], [])

    def test_duplicate_exact_ledger_results_remain_ambiguous(self):
        row = self.capture()
        result = intake.reconcile(self.home, self.owner, row["id"], lambda cmd, arg: {
            "ok": True, "rows": [{"row": 3, "게시물ID": "ExampleTip01"}, {"row": 4, "게시물ID": "ExampleTip01"}]})
        self.assertEqual(result["status"], "ambiguous")

    def test_unicode_url_reconciles_to_encoded_ledger_identity(self):
        row = self.capture(event("https://example.com/한글"))
        encoded = "https://example.com/%ED%95%9C%EA%B8%80"
        result = intake.reconcile(self.home, self.owner, row["id"], lambda cmd, arg: {
            "ok": True, "rows": [{"row": 3, **({"게시물ID": encoded} if cmd == "recent" else {})}]})
        self.assertEqual(result["status"], "reconciled")
        self.assertEqual(result["refs"][0]["lookupKey"], encoded)

    def test_youtube_original_ledger_id_is_used_for_find(self):
        row = self.capture(event("https://youtube.com/watch?v=abcdefghijk"))
        original = "https://youtu.be/abcdefghijk?si=x"
        calls = []
        def read(cmd, arg):
            calls.append((cmd, arg))
            return {"ok": True, "rows": [{"row": 3, **({"게시물ID": original} if cmd == "recent" else {})}]}
        self.assertEqual(intake.reconcile(self.home, self.owner, row["id"], read)["status"], "reconciled")
        self.assertEqual(calls[-1], ("find", original))

    def test_media_or_unknown_query_is_not_completed_by_url_match(self):
        row = self.capture(event(media_urls=["https://api.telegram.org/private"], media_types=["image/jpeg"]))
        read = lambda cmd, arg: {"ok": True, "rows": [{"row": 3, "게시물ID": "ExampleTip01"}]}
        self.assertEqual(intake.reconcile(self.home, self.owner, row["id"], read)["status"], "pending")

    def test_ledger_failure_does_not_drop_pending_receipt(self):
        row = self.capture()
        result = intake.reconcile(self.home, self.owner, row["id"], lambda cmd, arg: {"ok": False, "error": "SECRET"})
        self.assertEqual(result["status"], "pending")
        self.assertNotIn("SECRET", self.path(row).read_text())

    def test_reconcile_cannot_query_another_owners_receipt(self):
        row = self.capture()
        with self.assertRaisesRegex(intake.IntakeError, "TIP_NOT_OWNED"):
            intake.reconcile(self.home, "other", row["id"], lambda *a: self.fail("must not query"))

    def test_read_listing_is_scoped_and_does_not_write(self):
        row = self.capture()
        before = self.path(row).read_bytes(), self.path(row).stat().st_mtime_ns
        self.assertEqual(intake.list_receipts(self.home, self.owner)["items"], [row])
        self.assertEqual(intake.list_receipts(self.home, "other")["items"], [])
        self.assertEqual(before, (self.path(row).read_bytes(), self.path(row).stat().st_mtime_ns))

    def test_direct_id_read_reaches_receipt_outside_latest_hundred_and_checks_owner(self):
        oldest = self.capture()
        os.utime(self.path(oldest), (1, 1))
        for message_id in range(11, 111):
            self.capture(event(message_id=str(message_id)))
        self.assertEqual(len(list(self.path(oldest).parent.glob("*.json"))), 101)
        snapshot = intake.list_receipts(self.home, self.owner)
        self.assertFalse(snapshot["complete"])
        self.assertNotIn(oldest["id"], [row["id"] for row in snapshot["items"]])
        before = self.path(oldest).read_bytes(), self.path(oldest).stat().st_mtime_ns
        self.assertEqual(intake.read_receipt(self.home, self.owner, oldest["id"]), oldest)
        with self.assertRaisesRegex(intake.IntakeError, "TIP_NOT_OWNED"):
            intake.read_receipt(self.home, "another-owner", oldest["id"])
        with self.assertRaisesRegex(intake.IntakeError, "TIP_ID_INVALID"):
            intake.read_receipt(self.home, self.owner, "../private")
        self.assertEqual(before, (self.path(oldest).read_bytes(), self.path(oldest).stat().st_mtime_ns))

    def test_failed_atomic_replace_preserves_old_bytes(self):
        row = self.capture()
        before = self.path(row).read_bytes()
        with patch.object(intake.os, "replace", side_effect=OSError("test")):
            with self.assertRaises(OSError):
                self.capture(event(URL + " https://example.com/new"))
        self.assertEqual(self.path(row).read_bytes(), before)
        self.assertFalse(list(self.path(row).parent.glob("*.tmp")))

    def test_changed_receipt_during_ledger_read_is_not_overwritten(self):
        row = self.capture()
        def read(cmd, arg):
            if cmd == "recent":
                self.capture(event(URL + " https://example.com/new"))
            return {"ok": True, "rows": [{"row": 3, "게시물ID": "ExampleTip01"}]}
        with self.assertRaisesRegex(intake.IntakeError, "TIP_RECEIPT_CHANGED"):
            intake.reconcile(self.home, self.owner, row["id"], read)
        self.assertEqual(len(json.loads(self.path(row).read_text())["refs"]), 2)

    def test_process_crash_releases_os_lock_without_deleting_lock_file(self):
        row = self.capture()
        code = """import importlib.util, os, sys
spec = importlib.util.spec_from_file_location('tip_intake_child', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with module._locked(sys.argv[2], sys.argv[3]):
    os._exit(17)
"""
        result = subprocess.run([sys.executable, "-X", "utf8", "-c", code, intake.__file__, str(self.home), row["id"]],
                                capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 17, result.stderr)
        self.assertTrue(self.path(row).with_suffix(".lock").exists())
        after = self.capture(event(URL + " https://example.com/recovered"))
        self.assertEqual(len(after["refs"]), 2)

    def test_live_lock_has_bounded_wait_and_recovers_after_release(self):
        row = self.capture()
        with ThreadPoolExecutor(max_workers=1) as pool:
            with intake._locked(self.home, row["id"]):
                future = pool.submit(self.capture, event(URL + " https://example.com/after"))
                with self.assertRaisesRegex(intake.IntakeError, "TIP_RECEIPT_BUSY"):
                    future.result(timeout=3)
            self.assertEqual(len(self.capture(event(URL + " https://example.com/after"))["refs"]), 2)

    def test_concurrent_captures_merge_all_refs_under_os_lock(self):
        barrier = threading.Barrier(2)
        original_write = intake._write
        def slow_write(*args):
            time.sleep(0.08)
            return original_write(*args)
        def capture(url):
            barrier.wait(timeout=3)
            return self.capture(event(url))
        with patch.object(intake, "_write", side_effect=slow_write), ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(capture, url) for url in [URL, "https://example.com/concurrent"]]
            rows = [future.result(timeout=3) for future in futures]
        self.assertEqual(rows[0]["id"], rows[1]["id"])
        saved = json.loads(self.path(rows[0]).read_text(encoding="utf-8"))
        self.assertEqual(len(saved["refs"]), 2)
        self.assertEqual({ref["lookupKey"] for ref in saved["refs"]}, {"ExampleTip01", "https://example.com/concurrent"})


if __name__ == "__main__":
    unittest.main()
