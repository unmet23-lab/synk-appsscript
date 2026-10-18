"""Fixed local Python checks: real tests, zero skips and changed-line trace.

This script never installs dependencies or calls an AI service. Candidate output
is discarded, so assertion messages cannot disclose credentials in the receipt.
"""
from __future__ import annotations

import argparse
import ast
import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import trace
import types
import unittest


class Attention(Exception):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def regular(root, relative):
    if not isinstance(relative, str) or not relative or "\\" in relative or ":" in relative:
        raise Attention("PYTHON_UNSAFE_PATH")
    parts = relative.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise Attention("PYTHON_UNSAFE_PATH")
    current = root
    for part in parts:
        current = current / part
        if current.is_symlink() or getattr(current, "is_junction", lambda: False)():
            raise Attention("PYTHON_SYMLINK")
    if not current.is_file() or not current.resolve().is_relative_to(root) or current.stat().st_size > 4 * 1024 * 1024:
        raise Attention("PYTHON_FILE_LIMIT")
    return current


def executable_lines(code):
    lines = {line for _, _, line in code.co_lines() if line and line > 0}
    for value in code.co_consts:
        if isinstance(value, types.CodeType):
            lines.update(executable_lines(value))
    return lines


def changed_requirements(manifest, root):
    required = {}
    for item in manifest["files"]:
        source = regular(root, item["path"]).read_bytes()
        if digest(source) != item["sha256"]:
            raise Attention("CANDIDATE_CHANGED_DURING_VALIDATION")
        try:
            tree = ast.parse(source, filename=item["path"])
            code = compile(tree, str(root / item["path"]), "exec", dont_inherit=True)
        except (SyntaxError, ValueError, TypeError, UnicodeError):
            raise Attention("PYTHON_SYNTAX_FAILED") from None
        executable = executable_lines(code)
        if item["all"]:
            wanted = executable
            if not wanted:
                raise Attention("PYTHON_CHANGED_LINES_NOT_EXECUTABLE")
        else:
            changed = set()
            for span in item["ranges"]:
                if not isinstance(span.get("start"), int) or not isinstance(span.get("count"), int) or span["start"] < 1 or span["count"] < 1:
                    raise Attention("PYTHON_CHANGED_LINES_UNAVAILABLE")
                changed.update(range(span["start"], span["start"] + span["count"]))
            wanted = executable & changed
            if not wanted:
                try:
                    before = ast.parse(base64.b64decode(item["before"], validate=True))
                except (SyntaxError, ValueError, TypeError, UnicodeError):
                    raise Attention("PYTHON_SOURCE_EVIDENCE_UNAVAILABLE") from None
                # Comments/formatting have no executable delta, but still need
                # actual successful tests. Semantic changes cannot use that exit.
                if ast.dump(before, include_attributes=False) != ast.dump(tree, include_attributes=False):
                    raise Attention("PYTHON_CHANGED_LINES_NOT_EXECUTABLE")
        required[item["path"]] = sorted(wanted)
    return required


class Discard(io.TextIOBase):
    def write(self, text):
        return len(text)

    def flush(self):
        pass


def unittest_file(root, entry, index):
    target = regular(root, entry["path"])
    module_name = ".".join(target.relative_to(root).with_suffix("").parts)
    if any(not part.isidentifier() for part in module_name.split(".")):
        module_name = "_synk_explicit_test_" + str(index)
    spec = importlib.util.spec_from_file_location(module_name, target)
    if spec is None or spec.loader is None:
        raise Attention("PYTHON_TEST_IMPORT_FAILED")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    try:
        spec.loader.exec_module(module)
        suite = unittest.TestLoader().loadTestsFromModule(module)
        result = unittest.TestResult()
        suite.run(result)
    except BaseException:
        raise Attention("PYTHON_TEST_EXECUTION_FAILED") from None
    failed, errors, skipped = len(result.failures), len(result.errors), len(result.skipped)
    expected, unexpected = len(result.expectedFailures), len(result.unexpectedSuccesses)
    return {"kind": entry["kind"], "path": entry["path"], "tests": result.testsRun,
            "passed": result.testsRun - failed - errors - skipped - expected - unexpected,
            "failed": failed, "errors": errors, "skipped": skipped,
            "expected_failures": expected, "unexpected_successes": unexpected}


class PytestEvidence:
    def __init__(self, root, entries):
        self.root = root
        self.entries = entries
        self.collected = {entry["path"]: set() for entry in entries}
        self.passed = set()
        self.failed = set()
        self.skipped = set()
        self.xfail = set()
        self.xpass = set()
        self.errors = set()

    def pytest_collection_modifyitems(self, items):
        for item in items:
            file = Path(str(item.path)).resolve()
            if not file.is_relative_to(self.root):
                raise Attention("PYTHON_TEST_PATH_INVALID")
            relative = file.relative_to(self.root).as_posix()
            if relative not in self.collected:
                raise Attention("PYTHON_TEST_PATH_INVALID")
            self.collected[relative].add(item.nodeid)

    def pytest_runtest_logreport(self, report):
        if getattr(report, "wasxfail", None):
            (self.xpass if report.passed else self.xfail).add(report.nodeid)
        elif report.skipped:
            self.skipped.add(report.nodeid)
        elif report.failed:
            (self.failed if report.when == "call" else self.errors).add(report.nodeid)
        elif report.when == "call" and report.passed:
            self.passed.add(report.nodeid)

    def results(self):
        output = []
        for entry in self.entries:
            nodes = self.collected[entry["path"]]
            output.append({"kind": entry["kind"], "path": entry["path"], "tests": len(nodes),
                           "passed": len(nodes & self.passed), "failed": len(nodes & self.failed),
                           "errors": len(nodes & self.errors), "skipped": len(nodes & self.skipped),
                           "expected_failures": len(nodes & self.xfail), "unexpected_successes": len(nodes & self.xpass)})
        return output


def run_tests(manifest, root):
    results = {}
    for index, entry in enumerate(manifest["tests"]):
        if entry["kind"] == "python_unittest":
            results[(entry["kind"], entry["path"])] = unittest_file(root, entry, index)
    requested_pytest = [entry for entry in manifest["tests"] if entry["kind"] == "python_pytest"]
    if requested_pytest:
        try:
            import pytest
        except ImportError:
            raise Attention("PYTHON_PYTEST_UNAVAILABLE") from None
        plugin = PytestEvidence(root, requested_pytest)
        status = pytest.main(["-q", "-p", "no:cacheprovider", "-c", manifest["pytest_config"],
                              "--rootdir=" + str(root), "--confcutdir=" + str(root), "--import-mode=importlib",
                              *[str(regular(root, entry["path"])) for entry in requested_pytest]], plugins=[plugin])
        if int(status) != 0:
            raise Attention("PYTHON_TESTS_FAILED_OR_INCOMPLETE")
        for item in plugin.results():
            results[(item["kind"], item["path"])] = item
    if sys.gettrace() is None:
        raise Attention("PYTHON_TRACE_DISABLED")
    return [results[(entry["kind"], entry["path"])] for entry in manifest["tests"]]


def validate(manifest, root):
    expected = {item["path"]: item["sha256"] for item in manifest["candidate_files"]}
    for relative, sha256 in expected.items():
        if digest(regular(root, relative).read_bytes()) != sha256:
            raise Attention("CANDIDATE_CHANGED_DURING_VALIDATION")
    required = changed_requirements(manifest, root)
    sys.path.insert(0, str(root))
    os.chdir(root)
    tracer = trace.Trace(count=True, trace=False, ignoredirs=[sys.prefix, sys.base_prefix])
    with contextlib.redirect_stdout(Discard()), contextlib.redirect_stderr(Discard()):
        results = tracer.runfunc(run_tests, manifest, root)
    if any(item["tests"] < 1 or item["passed"] != item["tests"] or any(item[name] for name in ("failed", "errors", "skipped", "expected_failures", "unexpected_successes")) for item in results):
        raise Attention("PYTHON_TESTS_FAILED_OR_INCOMPLETE")
    counts = tracer.results().counts
    executed = {}
    for (filename, line), count in counts.items():
        file = Path(filename).resolve()
        if count > 0 and file.is_relative_to(root):
            executed.setdefault(file.relative_to(root).as_posix(), set()).add(line)
    coverage = []
    for relative, wanted in required.items():
        hit = executed.get(relative, set())
        if not set(wanted).issubset(hit):
            raise Attention("PYTHON_CHANGED_CODE_NOT_EXERCISED")
        coverage.append({"path": relative, "required_lines": wanted, "executed_lines": sorted(hit), "non_executable_only": not wanted})
    for relative, sha256 in expected.items():
        if digest(regular(root, relative).read_bytes()) != sha256:
            raise Attention("CANDIDATE_CHANGED_DURING_VALIDATION")
    return {"status": "passed", "tests": results, "coverage": coverage}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--result", required=True)
    args = parser.parse_args()
    raw = Path(args.manifest).read_bytes()
    manifest = json.loads(raw)
    output = {"version": 1, "task_id": manifest.get("task_id"), "manifest_sha256": digest(raw), "runtime": sys.version.split()[0]}
    try:
        if manifest.get("version") != 1:
            raise Attention("PYTHON_MANIFEST_INVALID")
        root = Path(manifest["candidate_root"]).resolve(strict=True)
        output.update(validate(manifest, root))
    except Attention as error:
        output.update(status="needs_attention", code=str(error))
    except BaseException:
        output.update(status="needs_attention", code="PYTHON_EXECUTION_FAILED")
    with open(args.result, "x", encoding="utf-8") as target:
        json.dump(output, target, ensure_ascii=False, separators=(",", ":"))
        target.flush()
        os.fsync(target.fileno())
    return 0 if output["status"] == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
