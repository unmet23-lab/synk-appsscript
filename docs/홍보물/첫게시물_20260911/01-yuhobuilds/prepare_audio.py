"""Build the 29.4 s SHIFT intro from approved, local audio only.

No voice synthesis, resampling, normalization, compression, or source edits.
LUFS measurements use ffmpeg loudnorm's input fields; its output is discarded.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
AUDIO = OUT / "audio"
APPROVED_BED_BACKUP = OUT / "_이전_문구v1/bed.wav"
VOICE_SOURCE = REPO / "docs/브랜드_목소리/20260910/수노_유호보컬/말하기_시험01/A_음질보정_v1.wav"
BED_SOURCE = REPO / "영상/public/firstposts20260910/bed-shift.wav"
WHISPER_CACHE = Path.home() / ".cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots/536b0662742c02347bc0e980a01041f333bce120"
EXPECTED_VOICE_SHA = "367b6013e5595abdf90d869c9bcb6938cf07002e55d507c23357dd0415770e53"
EXPECTED_BED_SHA = "09fba871e084d47f79dd159f4ad4071ff0ac13f3235b6867502b655919985e62"
EXPECTED_RENDERED_BED_SHA = "0c58485b9b973b2dfc6d1bba00eb8310f20a99b56b183c488baf79467c4f0b26"
RATE = 48000
CHANNELS = 2
DURATION = 29.4
FRAMES = round(DURATION * RATE)
VOICE_END = 4.88
VOICE_FADE = 0.01
BASE_GAIN_DB = -29.4
PLATEAU_TARGET_LUFS = -33.5


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path: Path, duration: float | None = None) -> np.ndarray:
    args = ["ffmpeg", "-v", "error", "-i", str(path)]
    if duration is not None:
        args += ["-t", str(duration)]
    args += ["-f", "s32le", "-acodec", "pcm_s32le", "-"]
    raw = run(args).stdout
    return np.frombuffer(raw, dtype="<i4").reshape(-1, CHANNELS).astype(np.float64) / 2**31


def write_pcm24(path: Path, samples: np.ndarray) -> None:
    assert np.max(np.abs(samples)) < 1.0, "Audio would clip"
    integers = np.rint(samples * 2**23).astype(np.int32).reshape(-1)
    packed = np.stack([integers & 255, (integers >> 8) & 255, (integers >> 16) & 255], axis=1).astype(np.uint8)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(3)
        wav.setframerate(RATE)
        wav.writeframes(packed.tobytes())


def measure(path: Path, start: float | None = None, duration: float | None = None) -> dict:
    args = ["ffmpeg", "-hide_banner"]
    if start is not None:
        args += ["-ss", str(start)]
    if duration is not None:
        args += ["-t", str(duration)]
    args += ["-i", str(path), "-af", "loudnorm=I=-23:TP=-3:LRA=7:print_format=json", "-f", "null", "-"]
    log = run(args).stderr.decode("utf-8", errors="replace")
    values = json.loads(re.search(r'\{\s*"input_i".*?\}', log, re.S).group())
    return {"integrated_lufs": float(values["input_i"]), "true_peak_dbtp": float(values["input_tp"]), "loudness_range_lu": float(values["input_lra"])}


def dbfs(samples: np.ndarray) -> float:
    return 20 * math.log10(max(float(np.max(np.abs(samples))), 1e-15))


def smooth_rise(t: np.ndarray, begin: float, end: float) -> np.ndarray:
    phase = np.clip((t - begin) / (end - begin), 0, 1)
    return 0.5 - 0.5 * np.cos(np.pi * phase)


def transcribe(model, path: Path, end: float | None = None) -> list[dict]:
    options = {"language": "ko", "beam_size": 5, "word_timestamps": True, "vad_filter": False, "condition_on_previous_text": False}
    if end is not None:
        options["clip_timestamps"] = f"0,{end}"
    segments, _ = model.transcribe(str(path), **options)
    return [{"start": s.start, "end": s.end, "text": s.text,
             "words": [{"start": w.start, "end": w.end, "word": w.word, "probability": w.probability} for w in s.words]} for s in segments]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    AUDIO.mkdir(parents=True, exist_ok=True)
    assert sha(VOICE_SOURCE) == EXPECTED_VOICE_SHA, "Approved voice source changed"
    assert sha(BED_SOURCE) == EXPECTED_BED_SHA, "Approved music source changed"

    source_voice = decode(VOICE_SOURCE)
    assert sha(APPROVED_BED_BACKUP) == EXPECTED_RENDERED_BED_SHA, "Approved music backup changed"
    assert sha(AUDIO / "bed.wav") == EXPECTED_RENDERED_BED_SHA, "Approved rendered music changed"
    bed = decode(AUDIO / "bed.wav")
    assert bed.shape == (FRAMES, CHANNELS)
    assert np.array_equal(bed, decode(APPROVED_BED_BACKUP))
    cut = round(VOICE_END * RATE)
    fade_frames = round(VOICE_FADE * RATE)
    boundary_peak = dbfs(source_voice[cut - fade_frames:cut])
    assert boundary_peak < -32, "Trim fade must remain in the measured low-energy phrase boundary"

    voice = np.zeros((FRAMES, CHANNELS), dtype=np.float64)
    voice[:cut] = source_voice[:cut]
    voice[cut - fade_frames:cut] *= np.cos(np.linspace(0, np.pi / 2, fade_frames))[:, None]
    voice[cut - 1] = 0

    plateau_source = measure(BED_SOURCE, start=10.6, duration=15.2)
    plateau_gain = PLATEAU_TARGET_LUFS - plateau_source["integrated_lufs"]
    # Preserve the approved rendered bed verbatim. Do not write or process it.
    master = voice + bed

    for name, samples in [("voice", voice), ("master", master)]:
        write_pcm24(AUDIO / f"{name}.wav", samples)

    rendered_voice = decode(AUDIO / "voice.wav")
    preserved_samples = cut - fade_frames
    preserved_equal = np.array_equal(rendered_voice[:preserved_samples], source_voice[:preserved_samples])
    assert preserved_equal, "Approved speech samples were altered outside the 10 ms silent fade"
    assert np.count_nonzero(rendered_voice[cut:]) == 0

    print("Audio written. Running local cached ASR and measurements...", flush=True)
    os.environ["HF_HUB_OFFLINE"] = "1"
    from faster_whisper import WhisperModel
    model = WhisperModel(str(WHISPER_CACHE), device="cpu", compute_type="int8", cpu_threads=2, local_files_only=True)
    source_asr = transcribe(model, VOICE_SOURCE)
    trimmed_asr = transcribe(model, AUDIO / "voice.wav", end=VOICE_END)
    trimmed_text = " ".join(s["text"].strip() for s in trimmed_asr)
    assert all(word not in trimmed_text for word in ("직접", "쓸만", "나눌", "오늘")), "Excluded speech may remain"
    assert "있어요" in trimmed_text, "ASR did not retain the intended final phrase"

    files = {}
    for name in ("voice", "bed", "master"):
        path = AUDIO / f"{name}.wav"
        samples = decode(path)
        with wave.open(str(path), "rb") as wav:
            info = {"sample_rate": wav.getframerate(), "channels": wav.getnchannels(), "bits_per_sample": wav.getsampwidth() * 8, "sample_frames": wav.getnframes(), "duration_seconds": wav.getnframes() / wav.getframerate()}
        assert info["sample_frames"] == FRAMES
        run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"])
        files[name] = {"path": str(path.relative_to(OUT)).replace("\\", "/"), "sha256": sha(path), **info,
                       **measure(path), "sample_peak_dbfs": dbfs(samples), "clipped_samples": int(np.count_nonzero(np.abs(samples) >= 1)),
                       "last_sample_both_channels_zero": bool(np.all(samples[-1] == 0)), "full_decode_passed": True}

    plateau_rendered = measure(AUDIO / "bed.wav", start=10.6, duration=15.2)
    assert abs(plateau_rendered["integrated_lufs"] - PLATEAU_TARGET_LUFS) <= 0.1
    assert sha(VOICE_SOURCE) == EXPECTED_VOICE_SHA
    assert sha(BED_SOURCE) == EXPECTED_BED_SHA
    assert sha(AUDIO / "bed.wav") == EXPECTED_RENDERED_BED_SHA
    assert sha(APPROVED_BED_BACKUP) == EXPECTED_RENDERED_BED_SHA
    audit = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "purpose": "29.4초 SHIFT 첫 게시물. 승인된 임시 남성 음성의 소개 부분만 사용.",
        "source_voice": {"path": str(VOICE_SOURCE.relative_to(REPO)).replace("\\", "/"), "sha256": EXPECTED_VOICE_SHA, "unmodified_after_run": True},
        "source_music": {"path": str(BED_SOURCE.relative_to(REPO)).replace("\\", "/"), "sha256": EXPECTED_BED_SHA, "unmodified_after_run": True},
        "voice_edit": {"cut_seconds": VOICE_END, "fade_seconds": VOICE_FADE,
                       "measured_low_energy_phrase_boundary_seconds": [4.854604, 4.891979], "silence_detection": "ffmpeg silencedetect, noise=-32dB, duration=0.018s; low-energy phrase boundary, not digital silence",
                       "final_fade_region_peak_dbfs": boundary_peak,
                       "unmodified_pcm_until_seconds": preserved_samples / RATE, "unmodified_pcm_exact_match": preserved_equal,
                       "tone_pitch_speed_gain_eq_compression_changes": "none", "padding_after_cut": "digital silence to 29.4 seconds",
                       "retained_sentence": "안녕하세요. 유호입니다. 저는 AI와 함께 회사를 만들고 있어요.",
                       "excluded_sentences": ["직접 해보고, 막히면 고치고", "쓸 만한 방법을 함께 나눌게요", "오늘은 우리 목소리부터 만들어볼까요?"], "excluded_sentences_absent_from_trimmed_asr": True},
        "music_edit": {"status": "approved rendered bed preserved without writing or processing", "approved_rendered_sha256": EXPECTED_RENDERED_BED_SHA, "backup_pcm_exact_match": True,
                       "source_range_seconds": [0, DURATION], "initial_fade_in_seconds": 0.1,
                       "initial_gain_db": BASE_GAIN_DB, "narration_to_music_rise_seconds": [9.4, 10.6],
                       "plateau_seconds": [10.6, 25.8], "plateau_source_measurement": plateau_source,
                       "plateau_target_lufs": PLATEAU_TARGET_LUFS, "plateau_gain_db": plateau_gain, "plateau_rendered_measurement": plateau_rendered,
                       "ending_rise_seconds": [25.8, 26.4], "ending_additional_gain_db": 3.0,
                       "ending_hold_seconds": [26.4, 28.4], "cosine_fade_out_seconds": [28.4, DURATION],
                       "rise_curve": "raised cosine in dB", "normalization_or_compression_applied": False},
        "asr": {"engine": "faster-whisper small, cached locally, CPU int8", "source_segments": source_asr,
                "trimmed_segments": trimmed_asr, "trimmed_text": trimmed_text,
                "limitations": "ASR는 단어와 대략적 경계 확인에만 사용. 원본의 유호를 요호로 인식한 부분은 이름 변경 또는 음성 변경을 뜻하지 않음."},
        "files": files,
        "quality_limits": {"direct_listening": "확인 불가: 이 하네스에서는 음성 입력을 직접 청취할 수 없음.",
                           "naturalness_and_studio_quality": "추가 향상했다고 주장하지 않음. 사용자가 승인한 음질·말투를 그대로 보존함.",
                           "verified": "원본 해시, 승인 발화의 PCM 동일성, 낮은 음량의 문장 절단 경계, ASR에서 제외 문장 부재, 승인 음악의 해시·PCM 동일성, 길이·형식·LUFS·true peak·클리핑·전체 디코드"}
    }
    (OUT / "audio-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"voice_cut_seconds": VOICE_END, "plateau_gain_db": plateau_gain, "plateau_lufs": plateau_rendered["integrated_lufs"], "master": files["master"], "trimmed_asr_text": trimmed_text, "audit": str(OUT / "audio-audit.json")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
