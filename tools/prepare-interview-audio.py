"""Generate PATH interview prompts locally with pinned Supertonic 3 ONNX assets.

Run with the existing Python that has numpy and onnxruntime:
  python tools/prepare-interview-audio.py --download
Later runs are offline by default. No model server, paid API, or custom voice clone.
Model files stay under .tmp; only generated audio and provenance enter the app.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import time
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_REPO = "supertone-oss-archive/supertonic-3"
MODEL_REVISION = "aafc6e32416a594460b32413efc49d7fe4ce6d46"
CODE_REVISION = "1e9799e964ea4c0dad7cde993b65c3c813a7b373"
CODE_BASE = f"https://raw.githubusercontent.com/supertone-oss-archive/supertonic/{CODE_REVISION}"
VOICE_MAP = {"lead": "M1", "specialist": "F1", "observer": "M2"}
MODEL_FILES = [
    "onnx/duration_predictor.onnx", "onnx/text_encoder.onnx",
    "onnx/vector_estimator.onnx", "onnx/vocoder.onnx", "onnx/tts.json",
    "onnx/unicode_indexer.json", "voice_styles/M1.json", "voice_styles/M2.json",
    "voice_styles/F1.json", "LICENSE",
]


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def download(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".download")
    with urllib.request.urlopen(url, timeout=180) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)
    temporary.replace(target)
    print(f"Downloaded {target.name}: {target.stat().st_size} bytes", flush=True)


def prepare_models(cache: Path, allow_download: bool) -> dict:
    provenance_path = cache / "model-provenance.json"
    if allow_download:
        api = f"https://huggingface.co/api/models/{MODEL_REPO}/tree/{MODEL_REVISION}?recursive=true"
        with urllib.request.urlopen(api, timeout=30) as response:
            tree = json.load(response)
        rows = {row["path"]: row for row in tree}
        tasks = []
        for name in MODEL_FILES:
            target = cache / "assets" / name
            expected = rows[name]
            if not target.is_file() or target.stat().st_size != expected["size"]:
                tasks.append((f"https://huggingface.co/{MODEL_REPO}/resolve/{MODEL_REVISION}/{name}", target))
        for remote, local in [("py/helper.py", "helper.py"), ("LICENSE", "CODE-LICENSE")]:
            if not (cache / local).is_file():
                tasks.append((f"{CODE_BASE}/{remote}", cache / local))
        with ThreadPoolExecutor(max_workers=3) as pool:
            for result in pool.map(lambda task: download(*task), tasks):
                pass
        files = []
        for name in MODEL_FILES:
            target = cache / "assets" / name
            sha = digest(target)
            expected_sha = rows[name].get("lfs", {}).get("oid")
            if expected_sha and sha != expected_sha:
                raise RuntimeError(f"Model checksum mismatch: {name}")
            files.append({"path": name, "bytes": target.stat().st_size, "sha256": sha})
        provenance = {"modelRepository": MODEL_REPO, "modelRevision": MODEL_REVISION,
                      "codeRevision": CODE_REVISION, "files": files,
                      "helperSha256": digest(cache / "helper.py")}
        provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding="utf-8")
        return provenance
    if not provenance_path.is_file():
        raise RuntimeError("Local model assets are missing. Explicit --download is required to prepare them.")
    provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
    for row in provenance["files"]:
        if digest(cache / "assets" / row["path"]) != row["sha256"]:
            raise RuntimeError(f"Local model checksum mismatch: {row['path']}")
    if digest(cache / "helper.py") != provenance["helperSha256"]:
        raise RuntimeError("Local inference helper checksum mismatch")
    return provenance


def load_prompts() -> list[dict]:
    module = (ROOT / "experiences/path-vr/interview/content.mjs").as_uri()
    source = (f"import {{PROMPTS,FOLLOWUPS,REPAIRS}} from {json.dumps(module)};"
              "process.stdout.write(JSON.stringify([...Object.values(PROMPTS),"
              "...Object.values(FOLLOWUPS),...Object.values(REPAIRS)]));")
    result = subprocess.run(["node", "--input-type=module", "-e", source], check=True, capture_output=True)
    return json.loads(result.stdout.decode("utf-8"))


def verify_audio(output_dir: Path, asr_model: Path, only: str | None = None) -> None:
    """Check known scripted speech with an existing model, never download an ASR model."""
    from faster_whisper import WhisperModel
    model = WhisperModel(str(asr_model.resolve()), device="cpu", compute_type="int8",
                         cpu_threads=4, local_files_only=True)
    manifest_path = output_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    clean = lambda text: re.sub(r"[^가-힣a-z0-9]", "", text.lower())
    for clip in manifest["clips"]:
        if only and clip["id"] != only:
            continue
        segments, _ = model.transcribe(str(output_dir / f"{clip['id']}.mp3"), language="ko",
                                       beam_size=5, vad_filter=False, condition_on_previous_text=False)
        transcript = " ".join(segment.text.strip() for segment in segments)
        similarity = difflib.SequenceMatcher(None, clean(clip["text"]), clean(transcript)).ratio()
        clip["asrCheck"] = {"engine": "faster-whisper local CPU int8", "transcript": transcript,
                            "normalizedTextSimilarity": round(similarity, 4), "humanListeningVerified": False}
        print(f"ASR {clip['id']}: {similarity:.4f} {transcript}", flush=True)
    complete = all(clip.get("asrCheck") for clip in manifest["clips"])
    manifest["reviewStatus"] = ("Local ASR comparison complete; human listening and headset playback review required"
                                if complete else "Partial local ASR comparison; human listening review required")
    manifest["localAsrModel"] = {"snapshot": asr_model.name, "downloads": 0}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    results = [{"id": clip["id"], **clip["asrCheck"]} for clip in manifest["clips"] if clip.get("asrCheck")]
    (output_dir / "asr-verification.json").write_text(json.dumps({
        "note": "Automatic transcript comparison does not verify naturalness or headset playback.",
        "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Explicitly download the pinned free model assets")
    parser.add_argument("--cache", type=Path, default=ROOT / ".tmp/path-interview-tts")
    parser.add_argument("--out", type=Path, default=ROOT / "experiences/path-vr/assets/interview/audio")
    parser.add_argument("--only", default=None, help="Generate one prompt id while testing a voice")
    parser.add_argument("--force", action="store_true", help="Regenerate existing matching audio")
    parser.add_argument("--steps", type=int, default=12)
    parser.add_argument("--speed", type=float, default=1.03)
    parser.add_argument("--verify-asr", type=Path, help="Only compare existing audio with an existing local faster-whisper model")
    args = parser.parse_args()
    if args.verify_asr:
        verify_audio(args.out, args.verify_asr, args.only)
        return
    args.cache.mkdir(parents=True, exist_ok=True)
    provenance = prepare_models(args.cache, args.download)
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("Existing ffmpeg is required for the browser MP3 files")
    import numpy as np
    import onnxruntime as ort
    spec = importlib.util.spec_from_file_location("path_interview_supertonic_helper", args.cache / "helper.py")
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    # CPU thread limits avoid running four independent ONNX pools at full machine size.
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    onnx_dir = str(args.cache / "assets/onnx")
    cfg = helper.load_cfgs(onnx_dir)
    sessions = helper.load_onnx_all(onnx_dir, options, ["CPUExecutionProvider"])
    tts = helper.TextToSpeech(cfg, helper.load_text_processor(onnx_dir), *sessions)
    styles = {speaker: helper.load_voice_style([str(args.cache / f"assets/voice_styles/{voice}.json")])
              for speaker, voice in VOICE_MAP.items()}
    prompts = load_prompts()
    args.out.mkdir(parents=True, exist_ok=True)
    old_manifest = args.out / "manifest.json"
    old = json.loads(old_manifest.read_text(encoding="utf-8")) if old_manifest.is_file() else {}
    prior_clips = {row["id"]: row for row in old.get("clips", [])}
    clips = []
    for index, prompt in enumerate(prompts):
        if args.only and prompt["id"] != args.only:
            if prompt["id"] in prior_clips:
                clips.append(prior_clips[prompt["id"]])
            continue
        wav_path = args.out / f"{prompt['id']}.wav"
        mp3_path = args.out / f"{prompt['id']}.mp3"
        prior = prior_clips.get(prompt["id"], {})
        if (not args.force and prior.get("text") == prompt["text"]
                and prior.get("voice") == VOICE_MAP[prompt["speakerId"]]
                and prior.get("speed") == args.speed and prior.get("steps") == args.steps
                and mp3_path.is_file() and digest(mp3_path) == prior.get("sha256")):
            clips.append(prior)
            print(f"Kept {prompt['id']}", flush=True)
            continue
        np.random.seed(20261011 + index)
        started = time.monotonic()
        audio, durations = tts(prompt["text"], "ko", styles[prompt["speakerId"]], args.steps, args.speed)
        samples = audio[0, :int(tts.sample_rate * durations[0].item())]
        if not np.isfinite(samples).all() or samples.size < tts.sample_rate * 0.3:
            raise RuntimeError(f"Invalid generated waveform: {prompt['id']}")
        pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
        with wave.open(str(wav_path), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(tts.sample_rate)
            output.writeframes(pcm.tobytes())
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
                        "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k",
                        str(mp3_path)], check=True)
        row = {**prompt, "voice": VOICE_MAP[prompt["speakerId"]],
               "src": f"/assets/interview/audio/{mp3_path.name}",
               "duration": round(len(samples) / tts.sample_rate, 3), "sampleRate": 44100,
               "channels": 1, "bytes": mp3_path.stat().st_size, "sha256": digest(mp3_path),
               "wavSha256": digest(wav_path), "seed": 20261011 + index,
               "speed": args.speed, "steps": args.steps,
               "waveformPeak": round(float(np.abs(samples).max()), 5),
               "waveformRms": round(float(np.sqrt(np.mean(samples ** 2))), 5)}
        clips.append(row)
        print(f"Generated {prompt['id']}: {row['duration']}s in {time.monotonic()-started:.1f}s", flush=True)
    manifest = {"version": 1, "engine": "Supertonic 3 ONNX CPU",
                "generatedAt": datetime.now(timezone.utc).isoformat(), "language": "ko",
                "voices": VOICE_MAP, "machineGenerated": True, "paidApiCalls": 0,
                "synthesisNetworkRequests": 0, "modelDownloadPerformedThisRun": args.download,
                "reviewStatus": ("Local ASR comparison complete; human listening and headset playback review required"
                                 if all(row.get("asrCheck") for row in clips) else "generated; listening review required"), "clips": clips,
                "model": provenance, "modelLicense": "OpenRAIL-M", "inferenceCodeLicense": "MIT",
                "sourceUrl": f"https://huggingface.co/{MODEL_REPO}/tree/{MODEL_REVISION}",
                "notice": "면접관 음성은 AI로 생성했습니다. 가상 인물이며 실존 인물의 음성을 모사하지 않았습니다."}
    old_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    shutil.copyfile(args.cache / "assets/LICENSE", args.out / "MODEL-LICENSE.txt")
    shutil.copyfile(args.cache / "CODE-LICENSE", args.out / "INFERENCE-CODE-LICENSE.txt")
    print(f"Saved {len(clips)}/{len(prompts)} clips to {args.out}", flush=True)


if __name__ == "__main__":
    main()
