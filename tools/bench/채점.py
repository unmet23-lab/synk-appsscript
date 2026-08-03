#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""벤더 실측 채점기 — 작업장 하나를 채점해 JSON으로 뱉는다.

    python 채점.py <작업장경로>

설계 두 가지가 중요하다:

1. **벤더에게 이 파일을 주지 않는다.** 명세는 자연어로만 줬다(유호님 실사용이 그렇다).
   테스트를 주면 "명세 준수"가 아니라 "테스트 맞추기"를 재게 된다.

2. **`agents/__init__.py`를 실행하지 않는다.** 그 파일은 langgraph·smolagents·arcengine을
   전부 import하므로, 그대로 로드하면 벤더 능력이 아니라 `uv sync` 성공 여부를 재게 된다.
   → sys.modules에 경로만 가진 가짜 `agents` 패키지를 먼저 심어 하위 모듈만 로드한다.
"""
import ast
import importlib
import importlib.util
import json
import os
import sys
import types

FIXTURE_OK = '{"timestamp": "2026-08-03T00:00:00+00:00", "data": {"action_input": {"id": 1}}}'
FIXTURE_BAD = '{"timestamp": "2026-08-03T00:00:00+00:00", "data": {oops'


def build_fixture(root):
    """녹화 디렉터리 픽스처. 기대값은 아래 EXPECTED에 못박혀 있다."""
    d = os.path.join(root, "_fixture_recordings")
    os.makedirs(d, exist_ok=True)
    files = {
        # 정상 3줄 + 깨진 1줄 + 빈 줄 2개
        "locksmith.random.50.aaa-111.recording.jsonl":
            [FIXTURE_OK, FIXTURE_OK, "", FIXTURE_BAD, FIXTURE_OK, "   "],
        "ls20.llm.10.bbb-222.recording.jsonl": [FIXTURE_OK, FIXTURE_OK],
        "locksmith.random.5.ccc-333.recording.jsonl": [FIXTURE_OK],
        # 대상 아님 — 무시돼야 한다
        "notes.txt": ["not a recording"],
        "locksmith.random.9.ddd-444.recording.jsonl.bak": [FIXTURE_OK],
    }
    for name, lines in files.items():
        with open(os.path.join(d, name), "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    os.makedirs(os.path.join(d, "sub"), exist_ok=True)  # 하위 디렉터리도 무시 대상
    return d


EXPECTED = {
    "files": 3,
    "events": 6,
    "malformed": 1,
    "games": {"locksmith": 2, "ls20": 1},
    "sessions_files": [
        "locksmith.random.5.ccc-333.recording.jsonl",
        "locksmith.random.50.aaa-111.recording.jsonl",
        "ls20.llm.10.bbb-222.recording.jsonl",
    ],
    "sessions_events": [1, 3, 2],
    "sessions_guids": ["ccc-333", "aaa-111", "bbb-222"],
    "sessions_games": ["locksmith", "locksmith", "ls20"],
}


def load_submission(workdir):
    """agents/__init__.py를 건너뛰고 제출물만 로드한다."""
    agents_dir = os.path.join(workdir, "agents")
    pkg = types.ModuleType("agents")
    pkg.__path__ = [agents_dir]
    sys.modules["agents"] = pkg
    # 제출물이 `from agents import Recorder`를 써도 통과시킨다(관대하게).
    rec_spec = importlib.util.spec_from_file_location(
        "agents.recorder", os.path.join(agents_dir, "recorder.py")
    )
    rec = importlib.util.module_from_spec(rec_spec)
    sys.modules["agents.recorder"] = rec
    rec_spec.loader.exec_module(rec)
    pkg.Recorder = rec.Recorder
    return importlib.import_module("agents.recordings_summary")


def check(results, name, ok, detail=""):
    results.append({"check": name, "ok": bool(ok), "detail": detail})


def main():
    workdir = sys.argv[1]
    label = os.path.basename(workdir)
    results = []
    src_path = os.path.join(workdir, "agents", "recordings_summary.py")

    # ── 1. 제출 존재 ────────────────────────────────────────────────
    exists = os.path.isfile(src_path)
    check(results, "파일 제출", exists, src_path)
    if not exists:
        print(json.dumps({"label": label, "results": results,
                          "score": 0, "total": 13}, ensure_ascii=False))
        return

    src = open(src_path, encoding="utf-8").read()

    # ── 2. 정적 규칙 ────────────────────────────────────────────────
    # 문자열 매칭으로 재사용을 판정하면 **주석·docstring에 단어만 있어도 통과**한다
    # (자기검증에서 실제로 오답 픽스처가 이 항목을 통과했다). AST로 실제 사용만 센다.
    uses_recorder = False
    third_party = []
    # 손으로 적은 화이트리스트는 **거짓양성**을 낸다 — 자기검증에서 `importlib`가
    # 목록에 없다는 이유로 감점됐다(과잉 차단은 가드 불신을 만든다).
    # 추측하지 말고 인터프리터가 아는 진짜 목록을 쓴다.
    STDLIB_OK = set(getattr(sys, "stdlib_module_names", ())) | {
        "__future__", "agents",   # agents = 이 저장소 자신(서드파티가 아니다)
    }
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        check(results, "Recorder 재사용(규칙5)", False, "구문 오류로 판정 불가: %s" % e)
        check(results, "표준 라이브러리만(규칙4)", False, "구문 오류로 판정 불가")
    else:
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                if any(a.name == "Recorder" for a in node.names):
                    uses_recorder = True
                root = (node.module or "").split(".")[0]
                if node.level == 0 and root and root not in STDLIB_OK:
                    third_party.append(root)
            elif isinstance(node, ast.Import):
                for a in node.names:
                    root = a.name.split(".")[0]
                    if root not in STDLIB_OK:
                        third_party.append(root)
            elif (isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name)
                  and node.value.id == "Recorder"):
                uses_recorder = True
        check(results, "Recorder 재사용(규칙5)", uses_recorder,
              "" if uses_recorder else "기존 클래스메서드를 쓰지 않고 파싱을 새로 짰다")
        check(results, "표준 라이브러리만(규칙4)", not third_party,
              ", ".join(sorted(set(third_party))))

    # ── 3. 로드 ────────────────────────────────────────────────────
    try:
        mod = load_submission(workdir)
    except Exception as e:
        check(results, "import 성공", False, "%s: %s" % (type(e).__name__, e))
        print(json.dumps({"label": label, "results": results,
                          "score": sum(r["ok"] for r in results), "total": 13},
                         ensure_ascii=False))
        return
    check(results, "import 성공", True)

    fn = getattr(mod, "summarize_recordings", None)
    check(results, "함수 이름 정확", callable(fn))
    if not callable(fn):
        print(json.dumps({"label": label, "results": results,
                          "score": sum(r["ok"] for r in results), "total": 13},
                         ensure_ascii=False))
        return

    # ── 4. 동작 ────────────────────────────────────────────────────
    fixture = build_fixture(os.path.dirname(os.path.abspath(__file__)))
    try:
        out = fn(fixture)
    except Exception as e:
        check(results, "정상 실행", False, "%s: %s" % (type(e).__name__, e))
        print(json.dumps({"label": label, "results": results,
                          "score": sum(r["ok"] for r in results), "total": 13},
                         ensure_ascii=False))
        return
    check(results, "정상 실행", True)

    g = lambda k: out.get(k) if isinstance(out, dict) else None
    check(results, "files 정확", g("files") == EXPECTED["files"],
          "기대 %s / 실제 %s" % (EXPECTED["files"], g("files")))
    check(results, "events 정확(빈 줄 무시·규칙2)", g("events") == EXPECTED["events"],
          "기대 %s / 실제 %s" % (EXPECTED["events"], g("events")))
    check(results, "malformed 정확(규칙1)", g("malformed") == EXPECTED["malformed"],
          "기대 %s / 실제 %s" % (EXPECTED["malformed"], g("malformed")))
    check(results, "games 집계 정확", g("games") == EXPECTED["games"],
          "기대 %s / 실제 %s" % (EXPECTED["games"], g("games")))

    sess = g("sessions") or []
    got_files = [s.get("file") for s in sess if isinstance(s, dict)]
    check(results, "sessions 정렬·구성", got_files == EXPECTED["sessions_files"],
          "기대 %s / 실제 %s" % (EXPECTED["sessions_files"], got_files))
    got_guids = [s.get("guid") for s in sess if isinstance(s, dict)]
    got_events = [s.get("events") for s in sess if isinstance(s, dict)]
    check(results, "guid·events 정확",
          got_guids == EXPECTED["sessions_guids"] and got_events == EXPECTED["sessions_events"],
          "guid %s / events %s" % (got_guids, got_events))

    # ── 5. 에지 ────────────────────────────────────────────────────
    try:
        empty = fn(os.path.join(fixture, "_없는_디렉터리_"))
        ok = (isinstance(empty, dict) and empty.get("files") == 0
              and empty.get("events") == 0 and not empty.get("sessions"))
        check(results, "없는 디렉터리(규칙3)", ok, str(empty)[:120])
    except Exception as e:
        check(results, "없는 디렉터리(규칙3)", False, "예외를 던졌다: %s" % type(e).__name__)

    score = sum(r["ok"] for r in results)
    print(json.dumps({"label": label, "results": results,
                      "score": score, "total": 13,
                      "loc": len(src.splitlines())}, ensure_ascii=False))


if __name__ == "__main__":
    main()
