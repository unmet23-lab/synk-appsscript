#!/usr/bin/env python3
"""Prepare one Galaxy S26 Ultra clip for the canonical SYNK Resolve workflow.

Resolve 21.1 Python automation requires Studio (official release notes, Sep 8).
Run inside a licensed DaVinci Resolve Studio from Workspace > Scripts. The script asks
for one source video, creates a dedicated project, applies the verified project
settings, imports the clip, and saves project/render presets. An untouched source
timeline and an editorial copy are prepared with separate sound/overlay tracks.
The editorial guide is stored with the project; footage is not automatically cut.

When the free edition cannot safely consume APV or 10-bit HEVC, the source is
transcoded without a color transform to 10-bit DNxHR HQX in the work folder.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any


PROJECT_PRESET = "SYNK_S26U_APV_HQ_4K24"
MASTER_PRESET = "SYNK_MASTER_DNxHR_HQX"
EDITORIAL_GUIDE = "컷편집_리듬정본_20260910.md"
SUPPORTED_SUFFIXES = {".mp4", ".mov", ".mkv", ".mxf"}


# The same sibling module is installed with this Utility script.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from davinci_s26u_media import (
    SetupError, probe_video, canonical_rate, timeline_dimensions, is_ten_bit,
    needs_free_edition_transcode, estimate_work_bytes,
    transcode_to_dnxhr_hqx, transcode_to_dnxhr_proxy,
    _publish_no_replace,
)


def _print(message: str) -> None:
    print(f"[SYNK Resolve] {message}", flush=True)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _choose_work_root(source: Path, fusion: Any | None, probe: dict,
                      transcode: bool, work_base: Path | None = None) -> Path:
    required = estimate_work_bytes(source, probe, transcode)
    base = (work_base or source.parent).resolve()
    def enough(folder: Path) -> bool:
        return folder.is_dir() and os.access(folder, os.W_OK) and shutil.disk_usage(folder).free >= required
    if not enough(base):
        selected = fusion.RequestDir() if fusion is not None else None
        if not selected or not enough(Path(str(selected))):
            raise SetupError(f"작업용 여유 공간 {required / 2**30:.1f}GiB 이상이 필요합니다. 원본을 지우지 말고 충분한 작업 드라이브를 선택하세요.")
        base = Path(str(selected)).resolve()
    return base / "SYNK_DAVINCI" / f"{source.stem}_{file_sha256(source)[:12]}"


def verified_source_copy(source: Path, work_root: Path) -> Path:
    target = work_root / "source_backup" / source.name
    target.parent.mkdir(parents=True, exist_ok=True)
    digest = file_sha256(source)
    if target.exists():
        if file_sha256(target) != digest:
            raise SetupError(f"수정된 원본 보관 사본을 덮어쓰지 않습니다: {target}")
    else:
        fd, name = tempfile.mkstemp(prefix=".synk-source-", dir=target.parent)
        temp = Path(name)
        try:
            with os.fdopen(fd, "wb") as dest, source.open("rb") as src:
                shutil.copyfileobj(src, dest, 8 * 1024 * 1024)
                dest.flush()
                os.fsync(dest.fileno())
            if file_sha256(temp) != digest or file_sha256(source) != digest:
                raise SetupError("원본 보관 사본 지문 불일치 또는 복사 중 원본 변경")
            _publish_no_replace(temp, target)
        finally:
            # Only this invocation's private temporary file is removed.
            temp.unlink(missing_ok=True)
    return target


def atomic_report(path: Path, payload: dict) -> None:
    import uuid
    temp = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)


def build_project_settings(stream: dict[str, Any], work_root: Path, input_color_space: str = "Samsung Log") -> list[tuple[str, list[str], bool]]:
    width, height = timeline_dimensions(stream)
    rate = canonical_rate(stream)
    return [
        ("timelineResolutionWidth", [str(width)], True),
        ("timelineResolutionHeight", [str(height)], True),
        ("timelinePixelAspectRatio", ["square"], True),
        ("timelineFrameRate", [rate], True),
        ("timelineInterlaceProcessing", ["0"], True),
        ("timelineSampleRate", ["48000"], True),
        ("timelineInputResMismatchBehavior", ["scaleToFit"], False),
        ("timelineOutputResMatchTimelineRes", ["1"], False),
        ("colorScienceMode", ["davinciYRGBColorManaged"], True),
        ("isAutoColorManage", ["0"], True),
        ("rcmPresetMode", ["Custom"], True),
        ("separateColorSpaceAndGamma", ["0"], True),
        ("colorSpaceInput", [input_color_space], True),
        (
            "colorSpaceTimeline",
            ["DaVinci Wide Gamut/Intermediate", "DaVinci WG/Intermediate"],
            True,
        ),
        ("colorSpaceOutput", ["Rec.709 Gamma 2.4", "Rec.709/Gamma 2.4"], True),
        ("outputDRT", ["DaVinci"], True),
        ("timelineWorkingLuminanceMode", ["SDR 100"], True),
        ("useCATransform", ["1"], True),
        ("useColorSpaceAwareGradingTools", ["1"], True),
        ("imageResizingGamma", ["Linear"], True),
        ("perfCacheClipsLocation", [str(work_root / "cache")], True),
        # SDK: 0 disabled, 1 when available, 2 only when source unavailable.
        ("perfProxyMediaMode", ["1"], True),
        ("perfOptimisedMediaOn", ["0"], True),
        ("perfProxyResolutionRatio", ["half"], True),
        ("perfRenderCacheMode", ["smart"], True),
    ]


def apply_project_settings(project: Any, settings: list[tuple[str, list[str], bool]]) -> dict[str, Any]:
    applied: dict[str, str] = {}
    failed: dict[str, dict[str, Any]] = {}
    for key, variants, critical in settings:
        accepted = None
        errors: list[str] = []
        for value in variants:
            try:
                if project.SetSettings({key: value}) and setting_matches(key, project.GetSettings().get(key), value):
                    accepted = value
                    break
            except Exception as exc:  # Resolve native API raises implementation-specific exceptions.
                errors.append(str(exc))
        if accepted is None:
            failed[key] = {"critical": critical, "tried": variants, "errors": errors,
                           "actual": project.GetSettings().get(key)}
        else:
            applied[key] = str(project.GetSettings().get(key))
    # Later settings can invalidate earlier dependent fields. Read once more.
    actual = project.GetSettings()
    for key, variants, critical in settings:
        if key in applied and not setting_matches(key, actual.get(key), applied[key]):
            failed[key] = {"critical": critical, "actual": actual.get(key), "expected": applied[key]}
    critical_failures = [key for key, value in failed.items() if value["critical"]]
    if critical_failures:
        raise SetupError("핵심 Resolve 설정 실패: " + ", ".join(critical_failures))
    return {"applied": applied, "readback": actual, "failed_optional": failed}


def setting_matches(key: str, actual: Any, expected: Any) -> bool:
    if actual is None:
        return False
    if key.endswith("Location"):
        return os.path.normcase(os.path.normpath(str(actual))) == os.path.normcase(os.path.normpath(str(expected)))
    try:
        return abs(float(actual) - float(expected)) < 0.00001
    except (TypeError, ValueError):
        return str(actual).strip().lower() == str(expected).strip().lower()


def _unique_project_name(project_manager: Any, prefix: str = "SYNK_S26U") -> str:
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"{prefix}_{stamp}"
    existing = set(project_manager.GetProjectListInCurrentFolder() or [])
    name = base
    counter = 2
    while name in existing:
        name = f"{base}_{counter}"
        counter += 1
    return name


def _save_project_preset(project: Any, name: str = PROJECT_PRESET) -> bool:
    saved = project.SaveCurrentProjectSettingsAsNewPreset(name) or project.UpdateProjectSettingsPreset(name)
    return bool(saved and any(p.get("Name") == name for p in project.GetProjectSettingsPresetList()))


def _save_master_render_preset(project: Any, work_root: Path, width: int, height: int, rate: float) -> dict[str, Any]:
    formats = project.GetRenderFormats() or {}
    mov_format = next((ext for name, ext in formats.items() if "quicktime" in name.lower()), None)
    if not mov_format:
        return {"saved": False, "reason": "QuickTime 포맷 없음"}
    codecs = project.GetRenderCodecs(mov_format) or {}
    codec_name = next(
        (value for name, value in codecs.items() if "dnxhr hqx" in name.lower() and "10-bit" in name.lower()),
        None,
    )
    if not codec_name:
        return {"saved": False, "reason": "DNxHR HQX 코덱 없음"}
    if not project.SetCurrentRenderFormatAndCodec(mov_format, codec_name):
        return {"saved": False, "reason": "마스터 포맷 선택 실패"}
    if not project.SetCurrentRenderMode(1) or project.GetCurrentRenderMode() != 1:
        return {"saved": False, "reason": "Single Clip 렌더 모드 확인 실패"}
    if project.GetCurrentRenderFormatAndCodec() != {"format": mov_format, "codec": codec_name}:
        return {"saved": False, "reason": "마스터 코덱 읽기값 불일치"}
    exports = work_root / "exports"
    exports.mkdir(parents=True, exist_ok=True)
    ok = project.SetRenderSettings(
        {
            "SelectAllFrames": True,
            "TargetDir": str(exports),
            "CustomName": "SYNK_MASTER",
            "UseUniqueFilenames": True,
            "UniqueFilenameStyle": 1,
            "ReplaceExistingFilesInPlace": False,
            "ExportVideo": True,
            "ExportAudio": True,
            "FormatWidth": width,
            "FormatHeight": height,
            "FrameRate": rate,
            "PixelAspectRatio": "square",
            "AudioCodec": "pcm",
            "AudioBitDepth": 24,
            "AudioSampleRate": 48000,
            "ColorSpaceTag": "Same as Project",
            "GammaTag": "Same as Project",
            "DataBurnIn": "None",
        }
    )
    if not ok:
        return {"saved": False, "reason": "마스터 렌더 설정 실패"}
    saved = project.SaveAsNewRenderPreset(MASTER_PRESET)
    if not saved:
        saved = project.UpdateRenderPreset(MASTER_PRESET)
    return {"saved": bool(saved and MASTER_PRESET in project.GetRenderPresetList()),
            "format": mov_format, "codec": codec_name, "render_mode": project.GetCurrentRenderMode()}


def editorial_guide_source() -> Path:
    script = Path(__file__).resolve()
    candidates = (
        script.with_name(EDITORIAL_GUIDE),
        script.parent.parent / "docs" / "홍보물" / "기업소개20초_20260909" / EDITORIAL_GUIDE,
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise SetupError(f"컷 편집 기준 파일이 없습니다. 스크립트와 {EDITORIAL_GUIDE}를 함께 설치하세요.")


def preserve_editorial_guide(work_root: Path, source: Path) -> dict[str, str]:
    content = source.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    folder = work_root / "editorial"
    folder.mkdir(parents=True, exist_ok=True)
    destination = folder / f"{source.stem}_{digest[:12]}.md"
    if destination.exists():
        if destination.read_bytes() != content:
            raise SetupError(f"기존 편집 기준 사본이 수정되어 있습니다. 보존하고 중단합니다: {destination}")
    else:
        destination.write_bytes(content)
    return {"path": str(destination), "sha256": digest}


def prepare_editorial_timeline(project: Any, source: Any, guide: dict[str, str]) -> tuple[Any, dict[str, Any]]:
    """Only duplicate and label. Story, trim points and clip content stay untouched."""
    result: dict[str, Any] = {
        "source_timeline": source.GetName(),
        "guide": guide,
        "automatic_cuts": False,
        "ready": False,
        "failures": [],
    }
    failures = result["failures"]
    timeline = source.DuplicateTimeline("01_EDIT_RHYTHM")
    if not timeline:
        failures.append("편집용 타임라인 복제 실패")
        return source, result
    result["working_timeline"] = timeline.GetName()
    if not project.SetCurrentTimeline(timeline):
        failures.append("편집 타임라인 선택 실패")

    def rename(track_type: str, index: int, name: str) -> None:
        accepted = timeline.SetTrackName(track_type, index, name)
        if not accepted or timeline.GetTrackName(track_type, index) != name:
            failures.append(f"트랙 이름 확인 실패: {track_type} {index} {name}")

    def append(track_type: str, name: str, subtype: str = "stereo") -> None:
        before = timeline.GetTrackCount(track_type)
        ok = timeline.AddTrack(track_type, subtype) if track_type == "audio" else timeline.AddTrack(track_type)
        after = timeline.GetTrackCount(track_type)
        if not ok or after != before + 1:
            failures.append(f"트랙 추가 실패: {name}")
            return
        rename(track_type, after, name)

    if timeline.GetTrackCount("video"):
        rename("video", 1, "V_MAIN")
    for name in ("V_PROOF_BROLL", "V_GRAPHICS"):
        append("video", name)
    audio_count = timeline.GetTrackCount("audio")
    result["source_audio_tracks"] = audio_count
    for index in range(1, audio_count + 1):
        rename("audio", index, f"A_DIALOGUE_SOURCE_{index:02d}")
    if not audio_count:
        append("audio", "A_DIALOGUE_EMPTY", "mono")
    for name in ("A_AMBIENCE", "A_SFX", "A_MUSIC"):
        append("audio", name)
    # Frame zero already contains the color-management notice copied from source.
    marker_frame = 1 if timeline.GetEndFrame() - timeline.GetStartFrame() > 1 else None
    if marker_frame is not None:
        marker_ok = timeline.AddMarker(
            marker_frame, "Yellow", "편집 기준 · 자동 컷 아님",
            f"말의 의미 → 동작/시선 → 소리 연결 → 리듬 대비. 기준: {guide['path']}",
            1, "synk-editorial-guide-20260910",
        )
        if not marker_ok:
            failures.append("편집 안내 마커 추가 실패")
    result["tracks"] = {
        kind: [timeline.GetTrackName(kind, i) for i in range(1, timeline.GetTrackCount(kind) + 1)]
        for kind in ("video", "audio")
    }
    result["ready"] = not failures
    return timeline, result


def save_checked(manager: Any) -> None:
    if not manager.SaveProject():
        raise SetupError("Resolve 프로젝트 저장 실패. 준비 완료로 처리하지 않습니다.")


def input_color_contract(stream: dict, input_color_space: str | None) -> str:
    allowed = {"Samsung Log", "Rec.709 Gamma 2.4", "Rec.2100 HLG", "Rec.2100 ST2084"}
    if input_color_space not in allowed:
        raise SetupError("촬영 색공간 확인이 필요합니다. Samsung Log / SDR / HLG / PQ를 구분하세요.")
    transfer = str(stream.get("color_transfer", "")).lower()
    if input_color_space == "Samsung Log" and transfer in {"smpte2084", "arib-std-b67"}:
        raise SetupError("원본에 PQ/HLG HDR 태그가 있습니다. Samsung Log로 강제하지 않습니다. 촬영 설정을 확인하세요.")
    return input_color_space


def verify_loaded_project(project: Any, settings: list, timeline_name: str) -> dict:
    actual = project.GetSettings()
    mismatch = [key for key, variants, critical in settings
                if critical and not any(setting_matches(key, actual.get(key), v) for v in variants)]
    timeline = project.GetCurrentTimeline()
    if mismatch or not timeline or timeline.GetName() != timeline_name:
        raise SetupError("저장 후 다시 읽기 검증 실패: " + ", ".join(mismatch or ["current timeline"]))
    return {"verified": True, "settings": actual, "timeline": timeline.GetName(),
            "video_tracks": timeline.GetTrackCount("video"), "audio_tracks": timeline.GetTrackCount("audio"),
            "start_frame": timeline.GetStartFrame(), "end_frame": timeline.GetEndFrame()}


def require_python_edition(resolve_obj: Any) -> None:
    """21.1 release notes supersede the older bundled SDK's Free guidance."""
    try:
        version = resolve_obj.GetVersion()
        current = (int(version[0]), int(version[1]))
    except (TypeError, ValueError, IndexError, AttributeError) as exc:
        raise SetupError("Resolve 버전 확인 실패. 준비 작업을 시작하지 않습니다.") from exc
    if current >= (21, 1) and not resolve_obj.IsStudio():
        raise SetupError("Resolve 21.1부터 Python 자동화는 Studio 전용입니다. 무료판에서 실행을 우회하지 않습니다.")


def setup_resolve(resolve_obj: Any, source: Path, fusion: Any | None = None, *,
                  input_color_space: str | None = None, work_base: Path | None = None,
                  make_proxy: bool = True, project_prefix: str = "SYNK_S26U") -> Path:
    require_python_edition(resolve_obj)
    source = source.resolve()
    if not source.is_file() or source.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise SetupError("지원하는 영상 파일(mp4, mov, mkv, mxf) 하나를 선택하세요.")
    guide_source = editorial_guide_source()
    probe = probe_video(source)
    stream = probe["primary_video"]
    input_color_space = input_color_contract(stream, input_color_space)
    canonical_rate(stream)  # Reject unsupported rates before any app/file mutation.
    is_studio = bool(resolve_obj.IsStudio())
    transcode_used = needs_free_edition_transcode(stream, is_studio)
    work_root = _choose_work_root(source, fusion, probe, transcode_used, work_base)
    for child in ("cache", "proxy", "exports", "project_backups"):
        (work_root / child).mkdir(parents=True, exist_ok=True)
    report_path = work_root / ("resolve-setup-report-" + dt.datetime.now().strftime("%Y%m%d_%H%M%S_%f") + ".json")
    report: dict[str, Any] = {
        "created_at": dt.datetime.now().astimezone().isoformat(), "ready": False,
        "resolve_version": resolve_obj.GetVersionString(), "resolve_studio": is_studio,
        "source": str(source), "source_sha256": file_sha256(source), "source_video": stream,
        "input_color_space": input_color_space, "work_root": str(work_root),
        "transcode_used": transcode_used, "settings_saved": False, "reopen_verified": False,
        "creative_finish_complete": False, "off_device_backup_verified": False,
    }
    try:
        backup = verified_source_copy(source, work_root)
        report["source_backup"] = {"path": str(backup), "sha256_verified": True,
                                   "note": "Local verified copy; not an independent off-device backup."}
        guide = preserve_editorial_guide(work_root, guide_source)
        edit_source = backup
        if transcode_used:
            edit_source = work_root / "ingest" / f"{source.stem}_DNxHR_HQX.mov"
            _print("원본을 보존하며 DNxHR HQX 10-bit 편집본을 검증 생성합니다.")
            transcode_to_dnxhr_hqx(backup, edit_source)
        report["edit_source"] = str(edit_source)
        proxy_path = None
        if make_proxy:
            proxy_path = work_root / "proxy" / f"{source.stem}_DNxHR_LB.mov"
            transcode_to_dnxhr_proxy(edit_source, proxy_path)

        manager = resolve_obj.GetProjectManager()
        current = manager.GetCurrentProject()
        if current:
            save_checked(manager)
        project_name = _unique_project_name(manager, project_prefix)
        project = manager.CreateProject(project_name, str(work_root))
        if not project:
            raise SetupError("새 Resolve 프로젝트를 만들지 못했습니다.")
        report["project"] = project_name
        settings = build_project_settings(stream, work_root, input_color_space)
        report["project_settings"] = apply_project_settings(project, settings)
        width, height = timeline_dimensions(stream)
        rate = canonical_rate(stream)
        preset_name = PROJECT_PRESET if (width, height, rate, input_color_space) == (3840, 2160, "24", "Samsung Log") else f"SYNK_{'VERTICAL' if height > width else 'WIDE'}_4K{rate}_{input_color_space.replace(' ', '_')}"
        preset_saved = _save_project_preset(project, preset_name)
        report["project_preset"] = {"name": preset_name, "saved": preset_saved}
        if not preset_saved:
            raise SetupError("프로젝트 프리셋 저장/목록 재조회 실패")
        media_pool = project.GetMediaPool()
        imported = media_pool.ImportMedia([{"FilePath": str(edit_source)}]) or []
        if len(imported) != 1:
            raise SetupError("Resolve가 편집 원본을 하나로 가져오지 못했습니다.")
        clip = imported[0]
        if not clip.SetClipProperty("Input Color Space", input_color_space):
            raise SetupError("클립 입력 색공간 명시 실패")
        clip_color = clip.GetClipProperty("Input Color Space")
        if clip_color != input_color_space:
            raise SetupError(f"클립 입력 색공간 읽기값 불일치: {clip_color}")
        report["clip_input_color_space"] = clip_color
        if proxy_path:
            if not clip.LinkProxyMedia(str(proxy_path)):
                raise SetupError("DNxHR LB 프록시 연결 실패")
            actual_proxy = clip.GetClipProperty("Proxy Media Path")
            if not setting_matches("proxyLocation", actual_proxy, str(proxy_path)):
                raise SetupError("프록시 연결 경로 읽기값 불일치")
            report["proxy"] = {"path": actual_proxy, "codec": "DNxHR LB", "linked": True, "resolution": "half"}
        clip.SetMetadata({"Scene": "SYNK Studio Source",
                          "Comments": f"{input_color_space}; native RCM; source retained; no double Rec709 LUT"})
        timeline = media_pool.CreateTimelineFromClips("00_SOURCE_FULL", [{"mediaPoolItem": clip}])
        if not timeline or not project.SetCurrentTimeline(timeline):
            raise SetupError("원본 보관 타임라인 생성/선택 실패")
        if not timeline.SetStartTimecode("01:00:00:00"):
            raise SetupError("타임라인 시작 타임코드 설정 실패")
        timeline.AddMarker(0, "Blue", "SYNK SOURCE",
                           f"{input_color_space} -> DWG/Intermediate -> Rec.709 Gamma 2.4", 1)
        timeline, editorial = prepare_editorial_timeline(project, timeline, guide)
        report["editorial"] = editorial
        if not editorial["ready"]:
            raise SetupError("편집 작업공간 준비 실패: " + "; ".join(editorial["failures"]))
        render_result = _save_master_render_preset(project, work_root, width, height, float(rate))
        report["render_preset"] = {"name": MASTER_PRESET, **render_result}
        if not render_result["saved"]:
            raise SetupError("마스터 프리셋 저장 실패: " + str(render_result))
        save_checked(manager)
        report["settings_saved"] = True
        drp = work_root / "project_backups" / f"{project_name}.drp"
        if not manager.ExportProject(project_name, str(drp)) or not drp.is_file() or drp.stat().st_size == 0:
            raise SetupError("실제 프로젝트 백업(.drp) 생성 실패")
        report["project_backup"] = {"path": str(drp), "sha256": file_sha256(drp)}
        timeline_name = timeline.GetName()
        if not manager.CloseProject(project):
            raise SetupError("저장 검증용 프로젝트 닫기 실패")
        project = manager.LoadProject(project_name)
        if not project:
            raise SetupError("저장한 프로젝트 다시 열기 실패")
        report["reopen"] = verify_loaded_project(project, settings, timeline_name)
        report["reopen_verified"] = True
        report["ready"] = True
        resolve_obj.OpenPage("edit")
        _print(f"기술 준비 검증 완료: {project_name}. 실제 촬영 품질/최종 컷 마감은 별도입니다.")
    except Exception as exc:
        report["error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        atomic_report(report_path, report)
        _print(f"실제 적용/저장 검증 보고서: {report_path}")
    return report_path


def _resolve_instance() -> Any | None:
    internal = globals().get("resolve")
    if internal is not None and hasattr(internal, "GetVersion"):
        return internal
    try:
        import DaVinciResolveScript as dvr_script
    except ImportError:
        return None
    return dvr_script.scriptapp("Resolve")


def _choose_source(fusion: Any | None) -> Path:
    if fusion is None or not hasattr(fusion, "RequestFile"):
        raise SetupError("Resolve 내부에서 실행하거나 --video 경로를 지정하세요.")
    selected = fusion.RequestFile()
    if not selected:
        raise SetupError("영상 선택을 취소했습니다.")
    return Path(str(selected))


def self_test() -> None:
    assert canonical_rate({"avg_frame_rate": "24/1"}) == "24"
    assert canonical_rate({"avg_frame_rate": "30000/1001"}) == "29.97"
    assert timeline_dimensions({"width": 2160, "height": 3840}) == (2160, 3840)
    assert timeline_dimensions({"width": 3840, "height": 2160}) == (3840, 2160)
    assert is_ten_bit({"pix_fmt": "yuv422p10le"})
    assert needs_free_edition_transcode({"codec_name": "apv"}, False)
    assert not needs_free_edition_transcode({"codec_name": "apv"}, True)
    settings = build_project_settings({"width": 3840, "height": 2160, "avg_frame_rate": "24/1"}, Path("X:/work"))
    values = {key: variants[0] for key, variants, _ in settings}
    assert values["timelineFrameRate"] == "24"
    assert values["colorSpaceInput"] == "Samsung Log"
    assert values["outputDRT"] == "DaVinci"
    class FakeProject:
        values: dict[str, str] = {}
        def SetSettings(self, setting: dict[str, str]) -> bool:
            key, value = next(iter(setting.items()))
            if key == "colorSpaceTimeline" and value != "DaVinci WG/Intermediate":
                return False
            self.values.update(setting)
            return True

        def GetSettings(self) -> dict[str, str]:
            return dict(self.values)

    applied = apply_project_settings(
        FakeProject(),
        [("colorSpaceTimeline", ["DaVinci Wide Gamut/Intermediate", "DaVinci WG/Intermediate"], True)],
    )
    assert applied["applied"]["colorSpaceTimeline"] == "DaVinci WG/Intermediate"
    print("SELF_TEST_OK")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", type=Path)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--input-color-space", choices=["Samsung Log", "Rec.709 Gamma 2.4", "Rec.2100 HLG", "Rec.2100 ST2084"])
    parser.add_argument("--work-base", type=Path)
    args, _unknown = parser.parse_known_args()
    if args.self_test:
        self_test()
        return 0
    resolve_obj = _resolve_instance()
    if resolve_obj is None:
        raise SetupError(
            "Resolve 연결이 없습니다. 21.1부터 Python 자동화는 Studio 전용입니다. "
            "무료판에 설치된 파일만으로 자동 실행되지 않습니다. 연결/라이선스 제한을 우회하지 않습니다."
        )
    require_python_edition(resolve_obj)
    fusion = resolve_obj.Fusion()
    source = args.video.resolve() if args.video else _choose_source(fusion)
    color = args.input_color_space
    if color is None:
        # Camera Log gamma cannot reliably be inferred from codec/standard tags.
        # The confirmation is part of the installed workflow, not an auto-detection claim.
        if os.name != "nt":
            raise SetupError("--input-color-space로 실제 촬영 색공간을 지정하세요.")
        import ctypes
        answer = ctypes.windll.user32.MessageBoxW(
            0, "선택한 파일이 Samsung Log로 촬영된 원본입니까?\n\n"
            "APV HDR/일반 영상이면 아니요를 누르세요. 색공간을 잘못 적용하지 않습니다.\n\n" + source.name,
            "SYNK 촬영 색공간 확인", 4 | 0x20 | 0x100)
        if answer != 6:
            raise SetupError("Samsung Log 확인 취소. SDR/HDR 원본은 색공간을 확인한 뒤 별도로 가져오세요.")
        color = "Samsung Log"
    setup_resolve(resolve_obj, source, fusion, input_color_space=color, work_base=args.work_base)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SetupError as exc:
        _print(f"중단: {exc}")
        raise SystemExit(2)
