"""Local-only Whisper worker. Audio and model files never leave this process."""
import os
os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1")
import sys
import json
import io
import hashlib
import base64
import time
import socket

network_attempts = 0

def no_network(*args, **kwargs):
    global network_attempts
    network_attempts += 1
    raise RuntimeError("LOCAL_WORKER_NETWORK_DISABLED")

# This worker is deliberately offline, including dependency downloads/telemetry.
socket.socket.connect = no_network
socket.socket.connect_ex = no_network
socket.socket.sendto = no_network
socket.create_connection = no_network
socket.getaddrinfo = no_network

def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)

sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")
try:
    from faster_whisper import WhisperModel
    import faster_whisper
    import ctranslate2
    started = time.monotonic()
    model_path = sys.argv[1]
    if not os.path.isdir(model_path):
        raise ValueError("MODEL_DIRECTORY_MISSING")
    model_files = []
    for name in ["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"]:
        file_path = os.path.join(model_path, name)
        digest = hashlib.sha256()
        with open(file_path, "rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        model_files.append({"name": name, "bytes": os.path.getsize(file_path), "sha256": digest.hexdigest()})
    model = WhisperModel(model_path, device="cpu", compute_type="int8",
                         cpu_threads=6, num_workers=1, local_files_only=True)
    emit({"type": "ready", "loadMs": round((time.monotonic()-started)*1000, 2),
          "engine": "faster-whisper", "version": faster_whisper.__version__,
          "ctranslate2": ctranslate2.__version__, "python": sys.version.split()[0],
          "networkAttempts": network_attempts, "modelFiles": model_files})
except Exception as error:
    emit({"type": "fatal", "code": "LOCAL_MODEL_LOAD_FAILED", "errorType": type(error).__name__})
    sys.exit(1)

for line in sys.stdin:
    request = None
    try:
        request = json.loads(line)
        data = base64.b64decode(request["audioBase64"], validate=True)
        if not data or len(data) > 20 * 1024 * 1024:
            raise ValueError("INVALID_AUDIO_SIZE")
        sha = hashlib.sha256(data).hexdigest()
        if sha != request["audioSha256"]:
            raise ValueError("AUDIO_HASH_MISMATCH")
        started = time.monotonic()
        segments, info = model.transcribe(io.BytesIO(data), language="ko", beam_size=5,
            temperature=0.0, condition_on_previous_text=False, vad_filter=False,
            initial_prompt=None, prefix=None, word_timestamps=False)
        rows = [{"start": s.start, "end": s.end, "text": s.text,
                 "avgLogprob": s.avg_logprob, "noSpeechProbability": s.no_speech_prob}
                for s in segments]
        emit({"type": "result", "id": request["id"], "audioSha256": sha,
              "text": "".join(s["text"] for s in rows).strip(), "segments": rows,
              "durationSeconds": info.duration, "language": info.language,
              "elapsedMs": round((time.monotonic()-started)*1000, 2),
              "networkAttempts": network_attempts})
    except Exception as error:
        emit({"type": "error", "id": request.get("id") if isinstance(request, dict) else None,
              "code": "LOCAL_TRANSCRIPTION_FAILED", "errorType": type(error).__name__})
