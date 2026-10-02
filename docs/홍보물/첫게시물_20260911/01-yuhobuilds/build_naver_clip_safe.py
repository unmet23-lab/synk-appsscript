"""Build the Naver Clip upload copy with a currently verifiable Pixabay BGM.

The visual stream and approved 4.88 s introduction remain unchanged.  Only the
music bed is replaced because the original Suno track lacks proof that it was
created during a commercial-use subscription.
"""

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
WORK = OUT / "audio-pixabay-safe"
VOICE = OUT / "audio/voice.wav"
MUSIC = REPO / "docs/홍보물/BGM/01_Joyful-Happy-Upbeat_alex-morgan.mp3"
MUTED_VIDEO = OUT / "render-muted.mp4"
VIDEO = OUT / "video_네이버클립_권리확인본.mp4"

SR, CHANNELS, DURATION = 48000, 2, 29.4
FRAMES = round(SR * DURATION)
VOICE_END = 4.88
MUSIC_START = 6.0
EXPECTED_VOICE_SHA = "edbd1013ec12981c783c5e5f4e5c15a8522864e075c6358329f48ae7a8066519"
EXPECTED_MUSIC_SHA = "d617651b6c7ee0518299cc4c89397c0e1ec4bfc8a1824b67621b1e84a6fff758"
EXPECTED_MUTED_VIDEO_SHA = "c77ea3be7205ec458fdeb848b8aa9ba8d50b9c0f5ab9d8f1bf0638667502d89b"
TRACK_URL = "https://pixabay.com/music/pop-joyful-happy-upbeat-background-music-587376/"
LICENSE_URL = "https://pixabay.com/service/license-summary/"


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, check=True)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path: Path, *, start: float = 0, duration: float = DURATION) -> np.ndarray:
    args = ["ffmpeg", "-v", "error", "-i", str(path)]
    if start:
        args += ["-ss", str(start)]
    args += ["-t", str(duration), "-vn", "-ar", str(SR), "-ac", str(CHANNELS), "-f", "s32le", "-acodec", "pcm_s32le", "-"]
    raw = run(args).stdout
    samples = np.frombuffer(raw, dtype="<i4").reshape(-1, CHANNELS).astype(np.float64) / 2**31
    if len(samples) < FRAMES:
        samples = np.pad(samples, ((0, FRAMES - len(samples)), (0, 0)))
    return samples[:FRAMES]


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
    log = run([
        "ffmpeg", "-hide_banner", "-ss", str(start), "-t", str(duration), "-i", str(path),
        "-vn", "-af", "loudnorm=I=-23:TP=-3:LRA=7:print_format=json", "-f", "null", "-",
    ]).stderr.decode("utf-8", errors="replace")
    data = json.loads(re.search(r'\{\s*"input_i".*?\}', log, re.S).group())
    return {
        "integrated_lufs": float(data["input_i"]),
        "true_peak_dbtp": float(data["input_tp"]),
        "loudness_range_lu": float(data["input_lra"]),
    }


def smooth_rise(t: np.ndarray, begin: float, end: float) -> np.ndarray:
    phase = np.clip((t - begin) / (end - begin), 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * phase)


def envelope(t: np.ndarray, speech_gain_db: float, free_gain_db: float) -> np.ndarray:
    narration = np.minimum(smooth_rise(t, -0.12, 0), 1 - smooth_rise(t, VOICE_END - 0.12, VOICE_END + 0.5))
    gain_db = free_gain_db - (free_gain_db - speech_gain_db) * narration
    gain_db += 3 * smooth_rise(t, 25.8, 26.4) * (1 - narration)
    fade_in = np.sin(np.clip(t / 0.1, 0, 1) * np.pi / 2)
    fade_out = np.cos(np.clip((t - 28.4) / (DURATION - 1 / SR - 28.4), 0, 1) * np.pi / 2)
    return 10 ** (gain_db / 20) * fade_in * fade_out


def full_decode(path: Path) -> None:
    run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"])


def video_stream_hash(path: Path) -> str:
    result = run(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:v:0", "-c", "copy", "-f", "hash", "-hash", "sha256", "-"])
    return result.stdout.decode("ascii").strip().split("=", 1)[1].lower()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    WORK.mkdir(parents=True, exist_ok=True)
    expected = {VOICE: EXPECTED_VOICE_SHA, MUSIC: EXPECTED_MUSIC_SHA, MUTED_VIDEO: EXPECTED_MUTED_VIDEO_SHA}
    assert all(sha(path) == digest for path, digest in expected.items()), "A source differs from the reviewed input"

    voice = decode(VOICE)
    assert voice.shape == (FRAMES, CHANNELS)
    assert np.count_nonzero(voice[round(VOICE_END * SR):]) == 0
    music = decode(MUSIC, start=MUSIC_START)

    source_loudness = measure(MUSIC, start=MUSIC_START, duration=DURATION)
    speech_gain_db = -39.5 - source_loudness["integrated_lufs"]
    free_gain_db = -33.5 - source_loudness["integrated_lufs"]
    t = np.arange(FRAMES) / SR
    bed = music * envelope(t, speech_gain_db, free_gain_db)[:, None]
    bed[0] = 0
    bed[-1] = 0
    master = voice + bed

    shutil.copyfile(VOICE, WORK / "voice.wav")
    write24(WORK / "bed.wav", bed)
    write24(WORK / "master.wav", master)
    assert sha(WORK / "voice.wav") == EXPECTED_VOICE_SHA

    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(MUTED_VIDEO), "-i", str(WORK / "master.wav"),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k",
        "-ar", str(SR), "-t", str(DURATION), "-movflags", "+faststart", str(VIDEO),
    ])

    files = {}
    for key, path in (("bed", WORK / "bed.wav"), ("master", WORK / "master.wav"), ("video", VIDEO)):
        full_decode(path)
        decoded = decode(path)
        files[key] = {
            "path": str(path.relative_to(OUT)).replace("\\", "/"),
            "sha256": sha(path),
            **measure(path),
            "decoded_sample_frames": len(decoded),
            "clipped_samples": int(np.count_nonzero(np.abs(decoded) >= 1)),
            "full_decode_passed": True,
        }
        assert files[key]["clipped_samples"] == 0

    source_video_hash = video_stream_hash(MUTED_VIDEO)
    output_video_hash = video_stream_hash(VIDEO)
    assert source_video_hash == output_video_hash, "Visual stream changed while replacing BGM"
    assert all(sha(path) == digest for path, digest in expected.items()), "A source was modified"

    audit = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "네이버 클립 모바일 업로드용 권리 확인본. 영상은 유지하고 BGM만 교체.",
        "rights": {
            "track": "Joyful Happy Upbeat Background Music",
            "creator": "alex-morgan",
            "track_url": TRACK_URL,
            "license": "Pixabay Content License",
            "license_url": LICENSE_URL,
            "verified_on": "2026-09-11",
            "current_page_evidence": "Track page states free use under the Pixabay Content License. License summary permits free use, adaptation, and use without attribution, subject to prohibited uses.",
            "use": "29.4초 SYNK SHIFT 소개 영상의 낮은 음량 배경음. 원곡 단독 재배포가 아님.",
            "attribution_required": False,
        },
        "music": {
            "source": str(MUSIC.relative_to(REPO)).replace("\\", "/"),
            "source_sha256": EXPECTED_MUSIC_SHA,
            "source_range_seconds": [MUSIC_START, MUSIC_START + DURATION],
            "source_measurement": source_loudness,
            "speech_target_lufs": -39.5,
            "speech_gain_db": speech_gain_db,
            "free_target_lufs": -33.5,
            "free_gain_db": free_gain_db,
            "voice_to_music_rise_seconds": [VOICE_END - 0.12, VOICE_END + 0.5],
            "ending_rise_seconds": [25.8, 26.4],
            "ending_fade_seconds": [28.4, DURATION],
        },
        "voice": {
            "source": str(VOICE.relative_to(REPO)).replace("\\", "/"),
            "source_sha256": EXPECTED_VOICE_SHA,
            "copied_pcm_file_sha256_equal": True,
            "after_4_88_seconds_digital_silence": True,
        },
        "visual": {
            "source": str(MUTED_VIDEO.relative_to(REPO)).replace("\\", "/"),
            "source_sha256": EXPECTED_MUTED_VIDEO_SHA,
            "source_video_stream_sha256": source_video_hash,
            "output_video_stream_sha256": output_video_hash,
            "video_stream_exact_match": True,
        },
        "files": files,
        "sources_unmodified": True,
        "verification_limits": "권리 페이지·출처·해시·PCM·영상 스트림·음량·클리핑·전체 디코드는 확인. 직접 청취와 네이버 앱 실제 게시는 사용자 기기 단계.",
    }
    (WORK / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"video": str(VIDEO), "audit": str(WORK / "audit.json"), "video_sha256": sha(VIDEO), "video_stream_exact_match": True, "master": files["master"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
