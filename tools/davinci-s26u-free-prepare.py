#!/usr/bin/env python3
"""External, stdlib-only media preparation for the free Resolve UI workflow.

Requires sibling davinci_s26u_media.py and davinci-s26u-one-video.py. runpy loads
only the latter's helper definitions; no Resolve SDK, bridge or UI is invoked.
Each run writes a new timestamp/UUID JSON report, including failed runs when the
explicit work base is writable. A completed report certifies media files only.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile
import uuid
from typing import Any


HERE = Path(__file__).resolve().parent
_shared = runpy.run_path(str(HERE / "davinci-s26u-one-video.py"), run_name="synk_free_media_helpers")
SetupError = _shared["SetupError"]
file_sha256 = _shared["file_sha256"]
verified_source_copy = _shared["verified_source_copy"]
input_color_contract = _shared["input_color_contract"]
editorial_guide_source = _shared["editorial_guide_source"]
_choose_work_root = _shared["_choose_work_root"]

import davinci_s26u_media as media

INPUT_COLOR_SPACES = ("Samsung Log", "Rec.709 Gamma 2.4", "Rec.2100 HLG", "Rec.2100 ST2084")


def _fingerprint(path: Path) -> tuple[int, ...]:
    stat = path.stat()
    return stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns


def _snapshot(path: Path) -> dict[str, Any]:
    before = _fingerprint(path)
    digest = file_sha256(path)
    if _fingerprint(path) != before:
        raise SetupError(f"검증 중 파일이 변경됐습니다: {path}")
    return {"path": str(path), "sha256": digest, "size": before[2], "fingerprint": before}


def _assert_unchanged(snapshot: dict[str, Any]) -> None:
    if _snapshot(Path(snapshot["path"])) != snapshot:
        raise SetupError(f"준비 중 파일이 변경됐습니다: {snapshot['path']}")


def _public_file(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in snapshot.items() if key != "fingerprint"}


def _inside(path: Path, base: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(base):
        raise SetupError(f"작업 폴더 밖으로 연결된 출력 경로입니다: {path}")
    return resolved


def _publish_bytes(path: Path, data: bytes) -> None:
    """Publish a complete new file without replacing an existing/racing writer."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".synk-free-", dir=path.parent) as staging:
        temp = Path(staging) / "complete"
        with temp.open("xb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        media._publish_no_replace(temp, path)


def _preserve_guide(source: Path, work_root: Path) -> tuple[dict, dict]:
    before = _snapshot(source)
    content = source.read_bytes()
    if hashlib.sha256(content).hexdigest() != before["sha256"]:
        raise SetupError("안내서 읽기 중 내용이 변경됐습니다.")
    destination = _inside(work_root / "editorial" / f"{source.stem}_{before['sha256'][:12]}.md", work_root)
    if destination.exists():
        if destination.read_bytes() != content:
            raise SetupError("수정된 기존 안내서를 덮어쓰지 않습니다.")
    else:
        _publish_bytes(destination, content)
    copied = _snapshot(destination)
    if copied["sha256"] != before["sha256"]:
        raise SetupError("안내서 사본 지문이 일치하지 않습니다.")
    _assert_unchanged(before)
    return copied, before


def _conversion_record(path: Path, input_sha256: str, profile: str) -> tuple[dict, list[dict]]:
    """Bind the converter's validated manifest to the exact prepared input bytes."""
    manifest = path.with_name(path.name + ".manifest.json")
    manifest_snapshot = _snapshot(manifest)
    try:
        record = json.loads(manifest.read_text(encoding="utf-8"))
        output_snapshot = _snapshot(path)
        if (record["schema"] != 1 or record["source"]["sha256"] != input_sha256
                or record["output"]["sha256"] != output_snapshot["sha256"]
                or record["output"]["size"] != output_snapshot["size"]
                or record["conditions"]["profile"] != profile):
            raise SetupError("변환 기록의 원본·출력 지문 또는 변환 조건 불일치")
    except (ValueError, KeyError, TypeError) as exc:
        raise SetupError("변환 검증 기록이 올바르지 않습니다.") from exc
    _assert_unchanged(manifest_snapshot)
    return {**_public_file(output_snapshot), "manifest": str(manifest),
            "verified_media": record["output"]}, [output_snapshot, manifest_snapshot]


def _write_report(path: Path, report: dict) -> None:
    _publish_bytes(path, (json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8"))


def prepare_media(source: Path, work_base: Path, input_color_space: str, *, make_proxy: bool = True) -> Path:
    """Return the immutable result report; raise SetupError with report_path on failure.

    Work-base must be an existing writable directory. For invalid CLI arguments,
    or a missing/unwritable work-base, there is no safe report location and the
    CLI exits nonzero. It never reports a Resolve project or creative completion.
    """
    base = Path(work_base).resolve()
    if not base.is_dir() or not os.access(base, os.W_OK):
        raise SetupError("--work-base는 존재하고 쓰기 가능한 작업 폴더여야 합니다.")
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
    report_path = _inside(base / "SYNK_DAVINCI" / "free-prepare-reports" /
                          f"free-prepare-{stamp}-{uuid.uuid4().hex}.json", base)
    report: dict[str, Any] = {
        "schema": 1, "workflow": "free_external_media_then_official_ui",
        "started_at": dt.datetime.now(dt.timezone.utc).isoformat(), "state": "preparing",
        "media_prepared": False, "resolve_project_ready": False, "creative_finish_complete": False,
        "source": str(Path(source).absolute()), "work_base": str(base),
        "input_color_space": input_color_space, "proxy_requested": make_proxy,
        "report_path": str(report_path),
    }
    failure: BaseException | None = None
    try:
        source = Path(source).resolve(strict=True)
        if not source.is_file() or source.suffix.lower() not in _shared["SUPPORTED_SUFFIXES"]:
            raise SetupError("지원하는 원본 영상(mp4, mov, mkv, mxf)을 지정하세요.")
        original = _snapshot(source)
        report["source"] = str(source)
        report["source_sha256"] = original["sha256"]
        probe = media._probe(source, count_frames=True)
        # Full decode/count also verifies no-proxy inputs, which skip transcoding.
        evidence = media._evidence(source, probe)
        if evidence["sha256"] != original["sha256"]:
            raise SetupError("원본 정보 확인 중 내용이 변경됐습니다.")
        color = input_color_contract(probe["primary_video"], input_color_space)
        rate = media.canonical_rate(probe["primary_video"])
        dimensions = media.timeline_dimensions(probe["primary_video"])
        transcode = media.needs_free_edition_transcode(probe["primary_video"], is_studio=False)
        report["source_video"] = probe["primary_video"]
        report["transcode_used"] = transcode
        # Conservatively retains the shared downstream master/cache/proxy budget
        # even when --no-proxy is selected. This is not a byte-exact disk promise.
        report["required_work_bytes"] = media.estimate_work_bytes(source, probe, transcode)
        work_root = _inside(_choose_work_root(source, None, probe, transcode, base), base)
        _assert_unchanged(original)
        work_root.mkdir(parents=True, exist_ok=True)
        report["work_root"] = str(work_root)
        for directory in ("source_backup", "ingest", "proxy", "editorial"):
            _inside(work_root / directory, work_root)
        # Use the verified workspace copy as the stable conversion/import input.
        backup_path = verified_source_copy(source, work_root)
        backup = _snapshot(backup_path)
        if backup["sha256"] != original["sha256"] or source.samefile(backup_path):
            raise SetupError("원본 보관 사본이 원본과 다르거나 독립된 파일이 아닙니다.")
        _assert_unchanged(original)
        report["source_backup"] = {**_public_file(backup), "sha256_verified": True,
                                   "off_device_backup_verified": False}
        guide, guide_source = _preserve_guide(editorial_guide_source().resolve(), work_root)
        report["editorial_guide"] = _public_file(guide)
        verified = [original, backup, guide, guide_source]
        edit = {**_public_file(backup), "verified_media": evidence}
        if transcode:
            output = _inside(work_root / "ingest" / f"{source.stem}_DNxHR_HQX.mov", work_root)
            media.transcode_to_dnxhr_hqx(backup_path, output)
            edit, snapshots = _conversion_record(output, backup["sha256"], "dnxhr_hqx")
            verified.extend(snapshots)
        report["edit_source"] = edit
        report["proxy"] = {"prepared": False, "linked_in_resolve": False}
        if make_proxy:
            proxy_path = _inside(work_root / "proxy" / f"{source.stem}_DNxHR_LB.mov", work_root)
            media.transcode_to_dnxhr_proxy(Path(edit["path"]), proxy_path)
            proxy, snapshots = _conversion_record(proxy_path, edit["sha256"], "dnxhr_lb")
            verified.extend(snapshots)
            report["proxy"] = {**proxy, "prepared": True, "linked_in_resolve": False,
                               "resolution": "half_display_even_pixels"}
        for snapshot in verified:
            _assert_unchanged(snapshot)
        report["ui_handoff"] = {
            "import_video": edit["path"],
            "link_proxy": report["proxy"].get("path"),
            "input_color_space": color,
            "timeline_width": dimensions[0], "timeline_height": dimensions[1], "timeline_frame_rate": rate,
            "instructions": "공식 Resolve UI에서 영상을 가져오고 입력 색공간을 확인하세요. "
                            "준비된 프록시는 UI에서 연결하고, 버전된 편집 안내서를 참고하세요.",
        }
        report["media_prepared"] = True
        report["state"] = "prepared"
    except BaseException as exc:
        failure = exc
        report["media_prepared"] = False
        report["state"] = "failed"
        report["error"] = f"{type(exc).__name__}: {exc}"
    report["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        _write_report(report_path, report)
    except Exception as exc:
        raise SetupError(f"준비 완료를 확정하지 못했습니다. 보고서 저장 실패: {exc}") from exc
    if failure is not None:
        if isinstance(failure, (KeyboardInterrupt, SystemExit)):
            raise failure
        error = SetupError(f"미디어 준비 실패: {failure}; 보고서: {report_path}")
        error.report_path = report_path
        raise error from failure
    return report_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="무료 Resolve용 외부 미디어 준비. Resolve API/UI를 실행하지 않습니다.")
    parser.add_argument("--video", type=Path, required=True, help="원본 영상 경로")
    parser.add_argument("--work-base", type=Path, required=True, help="존재하는 작업 폴더")
    parser.add_argument("--input-color-space", required=True, choices=INPUT_COLOR_SPACES)
    parser.add_argument("--no-proxy", action="store_true", help="절반 크기 DNxHR LB 프록시 생략")
    args = parser.parse_args(argv)
    try:
        report_path = prepare_media(args.video, args.work_base, args.input_color_space, make_proxy=not args.no_proxy)
    except (SetupError, OSError) as exc:
        print(json.dumps({"media_prepared": False, "resolve_project_ready": False,
                          "creative_finish_complete": False, "error": str(exc),
                          "report_path": str(getattr(exc, "report_path", ""))}, ensure_ascii=False), file=sys.stderr)
        return 2
    print(json.dumps({"media_prepared": True, "resolve_project_ready": False,
                      "creative_finish_complete": False, "report_path": str(report_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
