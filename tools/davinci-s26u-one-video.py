#!/usr/bin/env python3
"""Prepare one Galaxy S26 Ultra clip for the canonical SYNK Resolve workflow.

Run inside DaVinci Resolve from Workspace > Scripts > Utility. The script asks
for one source video, creates a dedicated project, applies the verified project
settings, imports the clip, creates a timeline, and saves project/render presets.

When the free edition cannot safely consume APV or 10-bit HEVC, the source is
transcoded without a color transform to 10-bit DNxHR HQX next to the source.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any


PROJECT_PRESET = "SYNK_S26U_APV_HQ_4K24"
MASTER_PRESET = "SYNK_MASTER_DNxHR_HQX"
SUPPORTED_SUFFIXES = {".mp4", ".mov", ".mkv", ".mxf"}


class SetupError(RuntimeError):
    pass


def _print(message: str) -> None:
    print(f"[SYNK Resolve] {message}")


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def _find_tool(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SetupError(f"{name} 실행 파일을 찾지 못했습니다.")
    return path


def probe_video(path: Path) -> dict[str, Any]:
    result = _run(
        [
            _find_tool("ffprobe"),
            "-v",
            "error",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(path),
        ]
    )
    if result.returncode != 0:
        raise SetupError(f"영상 정보를 읽지 못했습니다: {result.stderr.strip()}")
    payload = json.loads(result.stdout)
    videos = [s for s in payload.get("streams", []) if s.get("codec_type") == "video"]
    if not videos:
        raise SetupError("영상 스트림이 없습니다.")
    payload["primary_video"] = videos[0]
    return payload


def _parse_rate(value: str | None) -> float:
    if not value or value == "0/0":
        return 24.0
    if "/" in value:
        numerator, denominator = value.split("/", 1)
        return float(numerator) / float(denominator)
    return float(value)


def canonical_rate(stream: dict[str, Any]) -> str:
    rate = _parse_rate(stream.get("avg_frame_rate") or stream.get("r_frame_rate"))
    choices = ((23.976, "23.976"), (24.0, "24"), (29.97, "29.97"), (30.0, "30"))
    return min(choices, key=lambda item: abs(rate - item[0]))[1]


def timeline_dimensions(stream: dict[str, Any]) -> tuple[int, int]:
    width = int(stream.get("width") or 3840)
    height = int(stream.get("height") or 2160)
    return (2160, 3840) if height > width else (3840, 2160)


def is_ten_bit(stream: dict[str, Any]) -> bool:
    pixel_format = str(stream.get("pix_fmt") or "").lower()
    bits = int(stream.get("bits_per_raw_sample") or 0)
    return bits >= 10 or any(token in pixel_format for token in ("p10", "p12", "10le", "12le"))


def needs_free_edition_transcode(stream: dict[str, Any], is_studio: bool) -> bool:
    if is_studio:
        return False
    codec = str(stream.get("codec_name") or "").lower()
    return codec == "apv" or (codec in {"hevc", "h265"} and is_ten_bit(stream))


def _choose_work_root(source: Path, fusion: Any | None) -> Path:
    source_size = source.stat().st_size
    required = source_size * 2 + 1_073_741_824
    candidate = source.parent / "SYNK_DAVINCI" / source.stem
    try:
        free = shutil.disk_usage(source.parent).free
        writable = os.access(source.parent, os.W_OK)
    except OSError:
        free, writable = 0, False
    if writable and free >= required:
        return candidate
    if fusion is not None and hasattr(fusion, "RequestDir"):
        selected = fusion.RequestDir()
        if selected:
            selected_path = Path(str(selected))
            if shutil.disk_usage(selected_path).free >= required:
                return selected_path / "SYNK_DAVINCI" / source.stem
    required_gib = required / 1_073_741_824
    raise SetupError(
        f"원본과 편집본을 둘 공간이 부족합니다. 여유 {required_gib:.1f}GiB 이상의 외장 SSD를 선택하세요."
    )


def transcode_to_dnxhr_hqx(source: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        check = probe_video(output)["primary_video"]
        if check.get("codec_name") == "dnxhd" and is_ten_bit(check):
            _print(f"검증된 기존 DNxHR HQX 사용: {output}")
            return
        raise SetupError(f"같은 이름의 검증되지 않은 파일이 있습니다: {output}")
    command = [
        _find_tool("ffmpeg"),
        "-hide_banner",
        "-v",
        "error",
        "-stats",
        "-i",
        str(source),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-map_metadata",
        "0",
        "-c:v",
        "dnxhd",
        "-profile:v",
        "dnxhr_hqx",
        "-pix_fmt",
        "yuv422p10le",
        "-c:a",
        "pcm_s24le",
        "-ar",
        "48000",
        "-fps_mode",
        "passthrough",
        "-n",
        str(output),
    ]
    result = subprocess.run(command, check=False)
    if result.returncode != 0 or not output.exists():
        raise SetupError("APV/10-bit 원본의 DNxHR HQX 변환에 실패했습니다.")
    check = probe_video(output)["primary_video"]
    if check.get("codec_name") != "dnxhd" or not is_ten_bit(check):
        raise SetupError("변환본이 DNxHR 10-bit로 검증되지 않았습니다.")


def build_project_settings(stream: dict[str, Any], work_root: Path) -> list[tuple[str, list[str], bool]]:
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
        ("colorSpaceInput", ["Samsung Log"], True),
        (
            "colorSpaceTimeline",
            ["DaVinci Wide Gamut/Intermediate", "DaVinci WG/Intermediate"],
            True,
        ),
        ("colorSpaceOutput", ["Rec.709 Gamma 2.4", "Rec.709/Gamma 2.4"], True),
        ("outputDRT", ["DaVinci"], True),
        ("timelineWorkingLuminanceMode", ["SDR 100"], False),
        ("useCATransform", ["1"], False),
        ("useColorSpaceAwareGradingTools", ["1"], False),
        ("imageResizingGamma", ["Linear"], False),
        ("perfCacheClipsLocation", [str(work_root / "cache")], True),
        ("perfProxyMediaMode", ["1"], False),
        ("perfProxyResolutionRatio", ["half"], False),
        ("perfRenderCacheMode", ["smart"], False),
    ]


def apply_project_settings(project: Any, settings: list[tuple[str, list[str], bool]]) -> dict[str, Any]:
    applied: dict[str, str] = {}
    failed: dict[str, dict[str, Any]] = {}
    for key, variants, critical in settings:
        accepted = None
        for value in variants:
            try:
                if project.SetSettings({key: value}):
                    accepted = value
                    break
            except Exception as exc:  # Resolve native API raises implementation-specific exceptions.
                failed[key] = {"critical": critical, "error": str(exc), "tried": variants}
        if accepted is None:
            failed.setdefault(key, {"critical": critical, "tried": variants})
        else:
            applied[key] = accepted
    critical_failures = [key for key, value in failed.items() if value["critical"]]
    if critical_failures:
        raise SetupError("핵심 Resolve 설정 실패: " + ", ".join(critical_failures))
    return {"applied": applied, "failed_optional": failed}


def _unique_project_name(project_manager: Any) -> str:
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    base = f"SYNK_S26U_{stamp}"
    existing = set(project_manager.GetProjectListInCurrentFolder() or [])
    name = base
    counter = 2
    while name in existing:
        name = f"{base}_{counter}"
        counter += 1
    return name


def _save_project_preset(project: Any) -> bool:
    if project.SaveCurrentProjectSettingsAsNewPreset(PROJECT_PRESET):
        return True
    return bool(project.UpdateProjectSettingsPreset(PROJECT_PRESET))


def _save_master_render_preset(project: Any, work_root: Path, width: int, height: int, rate: float) -> dict[str, Any]:
    formats = project.GetRenderFormats() or {}
    mov_format = next((ext for name, ext in formats.items() if "quicktime" in name.lower()), None)
    if not mov_format:
        return {"saved": False, "reason": "QuickTime 포맷 없음"}
    codecs = project.GetRenderCodecs(mov_format) or {}
    codec_name = next(
        (value for name, value in codecs.items() if "dnxhr hqx" in name.lower()),
        None,
    )
    if not codec_name:
        return {"saved": False, "reason": "DNxHR HQX 코덱 없음"}
    if not project.SetCurrentRenderFormatAndCodec(mov_format, codec_name):
        return {"saved": False, "reason": "마스터 포맷 선택 실패"}
    exports = work_root / "exports"
    exports.mkdir(parents=True, exist_ok=True)
    ok = project.SetRenderSettings(
        {
            "SelectAllFrames": True,
            "TargetDir": str(exports),
            "CustomName": "SYNK_MASTER",
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
    return {"saved": bool(saved), "format": mov_format, "codec": codec_name}


def setup_resolve(resolve_obj: Any, source: Path, fusion: Any | None = None) -> Path:
    if not source.is_file() or source.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise SetupError("지원하는 영상 파일(mp4, mov, mkv, mxf) 하나를 선택하세요.")
    probe = probe_video(source)
    stream = probe["primary_video"]
    work_root = _choose_work_root(source, fusion)
    for child in ("cache", "proxy", "exports", "project_backups"):
        (work_root / child).mkdir(parents=True, exist_ok=True)

    is_studio = bool(resolve_obj.IsStudio())
    edit_source = source
    transcode_used = needs_free_edition_transcode(stream, is_studio)
    if transcode_used:
        edit_source = work_root / "ingest" / f"{source.stem}_DNxHR_HQX.mov"
        _print("무료판 호환을 위해 Log 픽셀값을 유지한 DNxHR HQX 10-bit 편집본을 만듭니다.")
        transcode_to_dnxhr_hqx(source, edit_source)

    project_manager = resolve_obj.GetProjectManager()
    project_manager.SaveProject()
    project_name = _unique_project_name(project_manager)
    project = project_manager.CreateProject(project_name, str(work_root))
    if not project:
        raise SetupError("새 Resolve 프로젝트를 만들지 못했습니다.")

    setting_result = apply_project_settings(project, build_project_settings(stream, work_root))
    preset_saved = _save_project_preset(project)
    media_pool = project.GetMediaPool()
    imported = media_pool.ImportMedia([{"FilePath": str(edit_source)}]) or []
    if not imported:
        raise SetupError(f"Resolve가 편집 원본을 가져오지 못했습니다: {edit_source}")
    clip = imported[0]
    clip.SetMetadata(
        {
            "Scene": "SYNK Studio Source",
            "Comments": "Samsung Log; RCM native transform; do not add Samsung Rec.709 LUT again",
        }
    )
    timeline = media_pool.CreateTimelineFromClips(
        "MASTER_STUDIO",
        [{"mediaPoolItem": clip}],
    )
    if not timeline:
        raise SetupError("마스터 타임라인을 만들지 못했습니다.")
    project.SetCurrentTimeline(timeline)
    timeline.SetStartTimecode("01:00:00:00")
    if timeline.GetTrackCount("video"):
        timeline.SetTrackName("video", 1, "A-ROLL_ORIGINAL")
    if timeline.GetTrackCount("audio"):
        timeline.SetTrackName("audio", 1, "DIALOGUE_ORIGINAL")
    timeline.AddMarker(
        0,
        "Blue",
        "SYNK STUDIO START",
        "RCM Samsung Log -> DaVinci Wide Gamut/Intermediate -> Rec.709 Gamma 2.4. LUT 중복 적용 금지.",
        1,
    )

    width, height = timeline_dimensions(stream)
    rate_value = float(canonical_rate(stream))
    render_result = _save_master_render_preset(project, work_root, width, height, rate_value)
    project_manager.SaveProject()
    resolve_obj.OpenPage("edit")

    report = {
        "created_at": dt.datetime.now(dt.timezone.utc).astimezone().isoformat(),
        "resolve_version": resolve_obj.GetVersionString(),
        "resolve_studio": is_studio,
        "project": project_name,
        "project_preset": {"name": PROJECT_PRESET, "saved": preset_saved},
        "render_preset": {"name": MASTER_PRESET, **render_result},
        "source": str(source),
        "edit_source": str(edit_source),
        "transcode_used": transcode_used,
        "source_video": stream,
        "project_settings": setting_result,
        "timeline": {
            "name": timeline.GetName(),
            "width": width,
            "height": height,
            "frame_rate": canonical_rate(stream),
            "start_timecode": timeline.GetStartTimecode(),
        },
    }
    report_path = work_root / "resolve-setup-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    _print(f"완료: {project_name}")
    _print(f"검증 보고서: {report_path}")
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
        def SetSettings(self, setting: dict[str, str]) -> bool:
            key, value = next(iter(setting.items()))
            if key == "colorSpaceTimeline":
                return value == "DaVinci WG/Intermediate"
            return True

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
    args, _unknown = parser.parse_known_args()
    if args.self_test:
        self_test()
        return 0
    resolve_obj = _resolve_instance()
    if resolve_obj is None:
        raise SetupError(
            "Resolve 연결이 없습니다. 무료판에서는 외부 연결 대신 Workspace > Scripts > Utility에서 실행하세요."
        )
    fusion = resolve_obj.Fusion()
    source = args.video.resolve() if args.video else _choose_source(fusion)
    setup_resolve(resolve_obj, source, fusion)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SetupError as exc:
        _print(f"중단: {exc}")
        raise SystemExit(2)
