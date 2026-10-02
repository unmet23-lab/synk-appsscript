"""Repair the BGM transition only; additional section narration is still pending."""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent
REPO = OUT.parents[3]
REPAIR = OUT / "audio-bgm-repair"
VOICE = OUT / "audio/voice.wav"
ORIGINAL_VOICE = REPO / "docs/브랜드_목소리/20260910/수노_유호보컬/말하기_시험01/A_음질보정_v1.wav"
MUSIC = REPO / "영상/public/firstposts20260910/bed-shift.wav"
MUTED_VIDEO = OUT / "render-muted.mp4"
VIDEO = OUT / "video_BGM연결수정_내레이션추가전.mp4"
SR, CHANNELS, DURATION = 48000, 2, 29.4
FRAMES = round(SR * DURATION)
VOICE_END = 4.88
EXPECTED_VOICE_SHA = "edbd1013ec12981c783c5e5f4e5c15a8522864e075c6358329f48ae7a8066519"
EXPECTED_ORIGINAL_VOICE_SHA = "367b6013e5595abdf90d869c9bcb6938cf07002e55d507c23357dd0415770e53"
EXPECTED_MUSIC_SHA = "09fba871e084d47f79dd159f4ad4071ff0ac13f3235b6867502b655919985e62"


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, check=True)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path: Path, duration: float = DURATION) -> np.ndarray:
    raw = run(["ffmpeg", "-v", "error", "-i", str(path), "-t", str(duration), "-vn", "-f", "s32le", "-acodec", "pcm_s32le", "-"]).stdout
    return np.frombuffer(raw, dtype="<i4").reshape(-1, CHANNELS).astype(np.float64) / 2**31


def write24(path: Path, samples: np.ndarray) -> None:
    assert np.max(np.abs(samples)) < 1, "Audio would clip"
    values = np.rint(samples * 2**23).astype(np.int32).reshape(-1)
    packed = np.stack([values & 255, (values >> 8) & 255, (values >> 16) & 255], axis=1).astype(np.uint8)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(3)
        wav.setframerate(SR)
        wav.writeframes(packed.tobytes())


def measure(path: Path, start: float = 0, duration: float = DURATION) -> dict:
    log = run(["ffmpeg", "-hide_banner", "-ss", str(start), "-t", str(duration), "-i", str(path), "-vn", "-af", "loudnorm=I=-23:TP=-3:LRA=7:print_format=json", "-f", "null", "-"]).stderr.decode("utf-8", errors="replace")
    data = json.loads(re.search(r'\{\s*"input_i".*?\}', log, re.S).group())
    return {"integrated_lufs": float(data["input_i"]), "true_peak_dbtp": float(data["input_tp"]), "loudness_range_lu": float(data["input_lra"])}


def smooth_rise(t: np.ndarray, begin: float, end: float) -> np.ndarray:
    return 0.5 - 0.5 * np.cos(np.pi * np.clip((t - begin) / (end - begin), 0, 1))


def music_envelope(t: np.ndarray, narration_ranges: list[tuple[float, float]], speech_gain_db: float, free_gain_db: float) -> np.ndarray:
    """Reuse with the final narration time map; nearby phrases do not create a hard step.

    For the current sole range (0, 4.88), music rises from 4.76 to 5.38 s.
    Starts duck 120 ms ahead. Releases start 120 ms before the range end and
    complete 500 ms after it. This range should include the voice's quiet tail.
    Ending gain is suppressed while a narration range is active.
    """
    narration_presence = np.zeros_like(t)
    for start, end in narration_ranges:
        assert end > start >= 0
        attack = smooth_rise(t, start - 0.12, start)
        release = 1 - smooth_rise(t, end - 0.12, end + 0.5)
        narration_presence = np.maximum(narration_presence, np.minimum(attack, release))
    gain_db = free_gain_db - (free_gain_db - speech_gain_db) * narration_presence
    gain_db += 3 * smooth_rise(t, 25.8, 26.4) * (1 - narration_presence)
    fade_in = np.sin(np.clip(t / 0.1, 0, 1) * np.pi / 2)
    fade_out = np.cos(np.clip((t - 28.4) / (DURATION - 1 / SR - 28.4), 0, 1) * np.pi / 2)
    return 10 ** (gain_db / 20) * fade_in * fade_out


def full_decode(path: Path) -> None:
    run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"])


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    REPAIR.mkdir(parents=True, exist_ok=True)
    sources = {VOICE: EXPECTED_VOICE_SHA, ORIGINAL_VOICE: EXPECTED_ORIGINAL_VOICE_SHA, MUSIC: EXPECTED_MUSIC_SHA, MUTED_VIDEO: sha(MUTED_VIDEO)}
    assert all(sha(path) == expected for path, expected in sources.items()), "An input differs from the approved source"
    voice = decode(VOICE)
    assert voice.shape == (FRAMES, CHANNELS)
    assert np.count_nonzero(voice[round(VOICE_END * SR):]) == 0, "This intermediate requires only the existing introduction"

    source_music = decode(MUSIC)
    speech_source = measure(MUSIC, 0, 4.76)
    plateau_source = measure(MUSIC, 10.6, 15.2)
    speech_gain = -39.5 - speech_source["integrated_lufs"]
    free_gain = -33.5 - plateau_source["integrated_lufs"]
    t = np.arange(FRAMES) / SR
    bed = source_music * music_envelope(t, [(0, VOICE_END)], speech_gain, free_gain)[:, None]
    bed[0] = 0
    bed[-1] = 0
    master = voice + bed
    shutil.copyfile(VOICE, REPAIR / "voice.wav")
    write24(REPAIR / "bed.wav", bed)
    write24(REPAIR / "master.wav", master)
    assert sha(REPAIR / "voice.wav") == EXPECTED_VOICE_SHA
    assert np.array_equal(decode(REPAIR / "voice.wav"), voice)
    print("BGM repaired; muxing the intermediate and checking segment levels...", flush=True)

    run(["ffmpeg", "-v", "error", "-y", "-i", str(MUTED_VIDEO), "-i", str(REPAIR / "master.wav"), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", str(SR), "-t", str(DURATION), "-movflags", "+faststart", str(VIDEO)])

    files = {}
    for key, path in [("voice", REPAIR / "voice.wav"), ("bed", REPAIR / "bed.wav"), ("master", REPAIR / "master.wav"), ("intermediate_video", VIDEO)]:
        full_decode(path)
        info = json.loads(run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,sample_rate,channels,bits_per_sample,width,height", "-of", "json", str(path)]).stdout)
        assert abs(float(info["format"]["duration"]) - DURATION) < 1e-6
        samples = decode(path)
        assert len(samples) == FRAMES or key == "intermediate_video"
        files[key] = {"path": str(path.relative_to(OUT)).replace("\\", "/"), "sha256": sha(path), "probe": info, **measure(path), "decoded_sample_frames": len(samples), "clipped_samples": int(np.count_nonzero(np.abs(samples) >= 1)), "full_decode_passed": True}
        assert files[key]["clipped_samples"] == 0

    segments = []
    for start, end in [(0, 4.88), (4.88, 9.4), (9.4, 13.9), (13.9, 22), (22, 25.8), (25.8, 29.4)]:
        segments.append({"seconds": [start, end], "bed": measure(REPAIR / "bed.wav", start, end - start), "master": measure(REPAIR / "master.wav", start, end - start), "video": measure(VIDEO, start, end - start)})
    assert segments[1]["video"]["integrated_lufs"] > -35, "The original quiet gap remains"
    gap = decode(REPAIR / "master.wav")[round(4.88 * SR):round(9.4 * SR)]
    gap_rms = 20 * math.log10(float(np.sqrt(np.mean(gap * gap))))
    assert all(sha(path) == expected for path, expected in sources.items()), "A source was modified"

    audit = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "BGM 연결 수정 중간본. 섹션별 남성 내레이션 추가 전.",
        "pending": "4.88초 이후 새 내레이션은 아직 없으며 추가 내레이션 완료본이 아님.",
        "narration_ranges_seconds": [[0, VOICE_END]],
        "voice_preservation": {"reference": "audio/voice.wav", "sha256": EXPECTED_VOICE_SHA, "full_file_sha256_equal": True, "full_pcm_equal": True, "first_4_88_seconds_pcm_equal": True, "after_4_88_seconds_digital_silence": True, "voice_tone_gain_speed_eq_changes": "none"},
        "music": {"source": str(MUSIC.relative_to(REPO)).replace("\\", "/"), "source_sha256": EXPECTED_MUSIC_SHA, "source_range_seconds": [0, DURATION], "speech_target_lufs": -39.5, "speech_source_measurement": speech_source, "speech_gain_db": speech_gain, "free_target_lufs": -33.5, "free_source_measurement": plateau_source, "free_gain_db": free_gain, "intro_fade_seconds": 0.1, "voice_to_music_rise_seconds": [4.76, 5.38], "ending_rise_seconds": [25.8, 26.4], "ending_gain_db": 3, "ending_hold_seconds": [26.4, 28.4], "ending_fade_seconds": [28.4, 29.4], "envelope_reusable_for_narration_map": True},
        "problem_interval_check": {"seconds": [4.88, 9.4], "previous_video_lufs": -46.56, "repaired_video_lufs": segments[1]["video"]["integrated_lufs"], "repaired_master_rms_dbfs": gap_rms, "digital_zero_sample_frames": int(np.count_nonzero(np.all(gap == 0, axis=1)))},
        "sources_unmodified": [{"path": str(path.relative_to(REPO)).replace("\\", "/"), "sha256": expected, "unchanged_after_run": True} for path, expected in sources.items()],
        "files": files, "segments": segments,
        "verification_limits": "수치·파형·디코드·원본 보존 검사는 완료. 이 하네스에서는 직접 청취 확인 불가. 음질·자연스러움이 개선되었다거나 추가 내레이션을 완료했다고 주장하지 않음."
    }
    (REPAIR / "audio-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"video": str(VIDEO), "status": audit["status"], "voice_pcm_equal": True, "problem_interval": audit["problem_interval_check"], "master_lufs": files["master"]["integrated_lufs"], "master_dbtp": files["master"]["true_peak_dbtp"], "video_sha256": files["intermediate_video"]["sha256"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
