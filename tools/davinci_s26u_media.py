"""Stdlib-only, fail-closed media preparation for the S26U Resolve workflow.

Conversions never overwrite an existing destination. A .mov.manifest.json
sidecar is the commit marker: both files and all evidence must match for reuse.
FFMPEG/FFPROBE (or FFMPEG_PATH/FFPROBE_PATH) override executable discovery.
"""

from __future__ import annotations

from fractions import Fraction
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import Any


class SetupError(RuntimeError):
    pass


_RATES = {"23.976": Fraction(24000, 1001), "24": Fraction(24),
          "25": Fraction(25), "29.97": Fraction(30000, 1001),
          "30": Fraction(30), "50": Fraction(50),
          "59.94": Fraction(60000, 1001), "60": Fraction(60)}
_GIB = 1024 ** 3
_SCHEMA = 1


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(command, check=False, capture_output=True,
                              text=True, encoding="utf-8", errors="replace")
    except OSError as exc:
        raise SetupError(f"미디어 도구 실행 실패: {exc}") from exc


def _find_tool(name: str) -> str:
    override = os.environ.get(name.upper()) or os.environ.get(name.upper() + "_PATH")
    if override:
        found = shutil.which(override)
        if found:
            return found
        raise SetupError(f"{name} 환경변수의 실행 파일을 찾지 못했습니다.")
    found = shutil.which(name)
    if not found and name == "ffprobe":
        ffmpeg = _find_tool("ffmpeg")
        sibling = Path(ffmpeg).with_name("ffprobe" + Path(ffmpeg).suffix)
        found = shutil.which(str(sibling))
    if not found:
        raise SetupError(f"{name} 실행 파일을 찾지 못했습니다.")
    return found


def _probe(path: Path, count_frames: bool = False) -> dict[str, Any]:
    command = [_find_tool("ffprobe"), "-v", "error"]
    if count_frames:
        command += ["-count_frames"]
    result = _run(command + ["-show_streams", "-show_format", "-of", "json", str(path)])
    if result.returncode or result.stderr.strip():
        raise SetupError(f"영상 정보를 읽거나 디코딩하지 못했습니다: {result.stderr.strip()}")
    try:
        payload = json.loads(result.stdout)
        videos = [s for s in payload.get("streams", [])
                  if s.get("codec_type") == "video"
                  and not s.get("disposition", {}).get("attached_pic")]
        if not videos:
            raise SetupError("영상 스트림이 없습니다.")
        payload["primary_video"] = videos[0]
        return payload
    except (ValueError, TypeError, AttributeError) as exc:
        raise SetupError("ffprobe 응답이 올바른 영상 정보가 아닙니다.") from exc


def probe_video(path: Path) -> dict[str, Any]:
    return _probe(Path(path))


def _fraction(value: Any) -> Fraction | None:
    try:
        parsed = Fraction(str(value))
        return parsed if parsed > 0 else None
    except (ValueError, ZeroDivisionError, TypeError):
        return None


def canonical_rate(stream: dict[str, Any]) -> str:
    """Accept only supported rates; invalid average falls back to r_frame_rate."""
    rate = _fraction(stream.get("avg_frame_rate")) or _fraction(stream.get("r_frame_rate"))
    if rate is not None:
        for label, exact in _RATES.items():
            # Accommodate only decimal rounding of 24000/1001 etc., never 25->24.
            if abs(rate - exact) <= Fraction(1, 10000):
                return label
    raise SetupError(f"지원하지 않거나 알 수 없는 프레임률: {rate}")


def _rotation(stream: dict[str, Any]) -> int:
    value = stream.get("tags", {}).get("rotate", 0)
    for item in stream.get("side_data_list", []):
        if "rotation" in item:
            value = item["rotation"]
            break
    try:
        angle = float(value)
        if not math.isfinite(angle) or abs(angle / 90 - round(angle / 90)) > .001:
            raise ValueError
        return int(round(angle / 90) * 90) % 360
    except (TypeError, ValueError, OverflowError) as exc:
        raise SetupError("90도 단위가 아닌 회전 정보는 지원하지 않습니다.") from exc


def _positive_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (ValueError, TypeError, OverflowError):
        return 0


def _display_dimensions(stream: dict[str, Any]) -> tuple[int, int]:
    width, height = _positive_int(stream.get("width")), _positive_int(stream.get("height"))
    if not width or not height:
        raise SetupError("영상의 실제 해상도를 확인할 수 없습니다.")
    sar = _fraction(str(stream.get("sample_aspect_ratio", "1:1")).replace(":", "/"))
    width = max(1, round(width * (sar or Fraction(1))))
    return (height, width) if _rotation(stream) in (90, 270) else (width, height)


def timeline_dimensions(stream: dict[str, Any]) -> tuple[int, int]:
    width, height = _display_dimensions(stream)
    return (2160, 3840) if height > width else (3840, 2160)


def is_ten_bit(stream: dict[str, Any]) -> bool:
    pix = str(stream.get("pix_fmt") or "").lower()
    return (_positive_int(stream.get("bits_per_raw_sample")) >= 10
            or bool(re.search(r"(?:p|gray|gbrp|gbrap)(?:10|12|14|16)", pix))
            or pix.startswith(("p010", "p012", "p016", "p210", "p212", "p216", "x2rgb10", "x2bgr10")))


def needs_free_edition_transcode(stream: dict[str, Any], is_studio: bool) -> bool:
    codec = str(stream.get("codec_name") or "").lower()
    return not is_studio and (codec == "apv" or (codec in {"hevc", "h265"} and is_ten_bit(stream)))


def _seconds(value: Any) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) and result > 0 else None
    except (ValueError, TypeError, OverflowError):
        return None


def _duration(stream: dict[str, Any], probe: dict[str, Any]) -> float:
    duration = _seconds(stream.get("duration"))
    if duration is None:
        ticks, base = _seconds(stream.get("duration_ts")), _fraction(stream.get("time_base"))
        if ticks and base:
            duration = ticks * float(base)
    if duration is None:
        duration = _seconds(probe.get("format", {}).get("duration"))
    if duration is None:
        raise SetupError("미디어 길이를 확인할 수 없습니다.")
    return duration


def _audio(probe: dict[str, Any]) -> list[dict[str, Any]]:
    return [s for s in probe.get("streams", []) if s.get("codec_type") == "audio"]


def _output_dimensions(stream: dict[str, Any], proxy: bool) -> tuple[int, int]:
    divisor = 4 if proxy else 2
    # Half display dimensions, rounded DOWN to even pixels for 4:2:2 encoding.
    return tuple(max(2, int(n // divisor) * 2) for n in _display_dimensions(stream))


def _dnxhr_frame_bytes(width: int, height: int, proxy: bool = False) -> int:
    # FFmpeg libavcodec/dnxhddata.c, CID 1271 HQX / 1274 LB packet_scale.
    # https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/dnxhddata.c
    blocks = ((width + 15) // 16) * ((height + 15) // 16)
    raw = blocks * (5888 if proxy else 28672) // 255
    return max(8192, ((raw + 2048) // 4096) * 4096)


def estimate_work_bytes(source: Path, probe: dict, transcode: bool) -> int:
    """Additional workspace bytes, including media, masters, cache and headroom.

    Budget: source copy + optional HQX + half-size LB + 4K HQX master + master
    backup + one full 4K HQX cache (at least 1 GiB). Add 3% mux overhead,
    then 25% headroom (at least 1 GiB). Original source is never deleted.
    """
    stream = probe["primary_video"]
    rate = float(_RATES[canonical_rate(stream)])
    duration = max(_duration(stream, probe), _seconds(probe.get("format", {}).get("duration")) or 0)
    frames = max(math.ceil(duration * rate), _positive_int(stream.get("nb_frames")),
                 _positive_int(stream.get("nb_read_frames")))
    channels = 0
    for audio in _audio(probe):
        count = _positive_int(audio.get("channels"))
        if not count:
            raise SetupError("오디오 채널 수를 확인할 수 없습니다.")
        channels += count
    # Master has at least a stereo mix, even for an originally silent clip.
    source_audio = math.ceil(duration * 48000 * 3 * channels)
    master_audio = math.ceil(duration * 48000 * 3 * max(2, channels))

    def media_bytes(dimensions: tuple[int, int], proxy: bool, audio_bytes: int) -> int:
        return math.ceil((_dnxhr_frame_bytes(*dimensions, proxy) * frames + audio_bytes) * 1.03)

    hqx = media_bytes(_output_dimensions(stream, False), False, source_audio) if transcode else 0
    proxy = media_bytes(_output_dimensions(stream, True), True, source_audio)
    master = media_bytes(timeline_dimensions(stream), False, master_audio)
    cache = max(_GIB, master)
    total = Path(source).stat().st_size + hqx + proxy + 2 * master + cache
    return total + max(_GIB, math.ceil(total * .25))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _evidence(path: Path, probe: dict[str, Any]) -> dict[str, Any]:
    video = probe["primary_video"]
    frames = _positive_int(video.get("nb_read_frames"))
    declared = _positive_int(video.get("nb_frames"))
    if not frames or (declared and frames != declared):
        raise SetupError("실제 디코딩 프레임 수가 없거나 선언된 수와 다릅니다.")
    audio = []
    for item in _audio(probe):
        if not _positive_int(item.get("nb_read_frames")):
            raise SetupError("오디오 스트림을 끝까지 디코딩하지 못했습니다.")
        audio.append({"codec": item.get("codec_name"), "channels": _positive_int(item.get("channels")),
                      "sample_rate": _positive_int(item.get("sample_rate")),
                      "duration": _duration(item, probe), "start": float(item.get("start_time") or 0)})
    return {"sha256": _sha256(path), "size": path.stat().st_size,
            "frames": frames, "duration": _duration(video, probe),
            "start": float(video.get("start_time") or 0), "rate": canonical_rate(video),
            "dimensions": list(_display_dimensions(video)), "rotation": _rotation(video),
            "codec": video.get("codec_name"), "profile": video.get("profile"),
            "pix_fmt": video.get("pix_fmt"), "audio": audio}


def _validate_output(source: dict, output: dict, conditions: dict) -> None:
    expected_profile = "DNXHR LB" if conditions["proxy"] else "DNXHR HQX"
    tolerance = max(.002, .1 / float(_RATES[source["rate"]]))
    if (output["codec"] != "dnxhd" or str(output["profile"]).upper() != expected_profile
            or output["pix_fmt"] != conditions["pix_fmt"]
            or output["dimensions"] != conditions["dimensions"] or output["rotation"] != 0
            or output["rate"] != source["rate"] or output["frames"] != source["frames"]
            or abs(output["duration"] - source["duration"]) > tolerance):
        raise SetupError("변환본의 코덱·표시 크기·회전·프레임률·길이·프레임 수 검증 실패.")
    if len(source["audio"]) != len(output["audio"]):
        raise SetupError("변환본에서 오디오 스트림이 유실되거나 추가됐습니다.")
    for before, after in zip(source["audio"], output["audio"]):
        if (after["codec"] != "pcm_s24le" or after["sample_rate"] != 48000
                or not after["channels"] or after["channels"] != before["channels"]
                or abs(before["duration"] - after["duration"]) > .05
                or abs((before["start"] - source["start"]) - (after["start"] - output["start"])) > .05):
            raise SetupError("변환본 오디오의 PCM24·48kHz·채널·길이·동기 검증 실패.")


def _publish_no_replace(temp: Path, destination: Path) -> None:
    """Atomic no-clobber commit on NTFS/POSIX, including competing processes."""
    if os.name == "nt":
        # Windows rename fails if destination exists, including on exFAT.
        os.rename(temp, destination)
    else:
        os.link(temp, destination)
        temp.unlink()


def _transcode(source: Path, output: Path, proxy: bool) -> None:
    source, output = Path(source), Path(output).absolute()
    manifest = output.with_name(output.name + ".manifest.json")
    temp: Path | None = None
    manifest_temp: Path | None = None
    try:
        if (source.resolve() in (output.resolve(), manifest.resolve())
                or (output.exists() and source.samefile(output))
                or (manifest.exists() and source.samefile(manifest))):
            raise SetupError("원본을 변환본이나 manifest로 덮어쓸 수 없습니다.")
        if not source.is_file():
            raise SetupError("원본 영상 파일이 없습니다.")
        if output.suffix.lower() != ".mov":
            raise SetupError("DNxHR 변환본은 .mov 경로를 사용하세요.")
        before_hash = _sha256(source)
        source_probe = _probe(source, count_frames=True)
        source_evidence = _evidence(source, source_probe)
        if source_evidence["sha256"] != before_hash:
            raise SetupError("검증 도중 원본이 변경됐습니다.")
        video = source_probe["primary_video"]
        width, height = _output_dimensions(video, proxy)
        if min(width, height) < 256:
            raise SetupError("DNxHR 인코더는 가로·세로 각각 256픽셀 이상이어야 합니다.")
        ffmpeg = _find_tool("ffmpeg")
        version = _run([ffmpeg, "-version"])
        if version.returncode or not version.stdout:
            raise SetupError("FFmpeg 버전을 확인하지 못했습니다.")
        conditions = {"proxy": proxy, "profile": "dnxhr_lb" if proxy else "dnxhr_hqx",
                      "pix_fmt": "yuv422p" if proxy else "yuv422p10le",
                      "dimensions": [width, height], "autorotate": True, "square_pixels": True,
                      "audio_codec": "pcm_s24le", "audio_rate": 48000, "all_audio": True,
                      "fps_mode": "passthrough", "copyts": True,
                      "ffmpeg": version.stdout.splitlines()[0]}
        if output.exists() or manifest.exists() or output.is_symlink() or manifest.is_symlink():
            try:
                record = json.loads(manifest.read_text(encoding="utf-8"))
                if (record["schema"] != _SCHEMA or record["source"] != source_evidence
                        or record["conditions"] != conditions):
                    raise SetupError("기존 변환본의 원본·변환 조건이 일치하지 않습니다.")
                if _sha256(output) != record["output"]["sha256"]:
                    raise SetupError("기존 변환본의 SHA-256 지문이 다릅니다.")
                current = _evidence(output, _probe(output, count_frames=True))
                _validate_output(source_evidence, current, conditions)
                if current != record["output"]:
                    raise SetupError("기존 변환본의 검증 기록이 일치하지 않습니다.")
                if _sha256(source) != before_hash:
                    raise SetupError("재사용 검증 도중 원본이 변경됐습니다.")
                return
            except (OSError, ValueError, KeyError, TypeError) as exc:
                raise SetupError("검증되지 않은 기존 파일 또는 불완전한 manifest가 있습니다.") from exc
        output.parent.mkdir(parents=True, exist_ok=True)
        # A private directory makes -n safe without an insecure delete/recreate gap.
        with tempfile.TemporaryDirectory(prefix=".synk-dnxhr-", dir=output.parent) as staging:
            temp = Path(staging) / "media.mov"
            manifest_temp = Path(staging) / "manifest.json"
            command = [ffmpeg, "-hide_banner", "-v", "error", "-nostdin", "-xerror", "-n",
                       "-copyts", "-start_at_zero", "-i", str(source),
                       "-map", f"0:{video['index']}", "-map", "0:a?", "-map_metadata", "0",
                       "-vf", f"scale={width}:{height},setsar=1", "-metadata:s:v:0", "rotate=0",
                       "-c:v", "dnxhd", "-profile:v", conditions["profile"],
                       "-pix_fmt", conditions["pix_fmt"], "-threads:v", "2",
                       "-c:a", "pcm_s24le", "-ar", "48000", "-fps_mode", "passthrough",
                       "-f", "mov", str(temp)]
            result = _run(command)
            if result.returncode or not temp.is_file():
                raise SetupError(f"DNxHR 변환 실패: {result.stderr.strip()}")
            converted = _evidence(temp, _probe(temp, count_frames=True))
            _validate_output(source_evidence, converted, conditions)
            if _sha256(source) != before_hash:
                raise SetupError("변환 도중 원본이 변경됐습니다.")
            record = {"schema": _SCHEMA, "source": source_evidence,
                      "conditions": conditions, "output": converted}
            with manifest_temp.open("x", encoding="utf-8") as handle:
                json.dump(record, handle, ensure_ascii=False, indent=2, allow_nan=False)
                handle.flush()
                os.fsync(handle.fileno())
            with temp.open("r+b") as handle:
                os.fsync(handle.fileno())
            _publish_no_replace(temp, output)
            # A crash here leaves an untrusted media file, never a reusable result.
            _publish_no_replace(manifest_temp, manifest)
    except OSError as exc:
        raise SetupError(f"미디어 파일 처리 실패 (기존 파일은 덮어쓰지 않음): {exc}") from exc


def transcode_to_dnxhr_hqx(source: Path, output: Path) -> None:
    _transcode(source, output, proxy=False)


def transcode_to_dnxhr_proxy(source: Path, output: Path) -> None:
    _transcode(source, output, proxy=True)
