"""One offline probe of the existing synthetic WAV; no student audio or downloads."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
import sys
import json
import time
import socket
import hashlib
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
attempts = 0
def no_network(*args, **kwargs):
    global attempts
    attempts += 1
    raise RuntimeError('PROBE_NETWORK_DISABLED')
socket.socket.connect = no_network
socket.socket.connect_ex = no_network
socket.socket.sendto = no_network
socket.create_connection = no_network
socket.getaddrinfo = no_network

here = Path(__file__).resolve().parent
studio = here.parent.parent
config = json.loads((studio / '.runtime/local-stt.json').read_text(encoding='utf-8-sig'))
audio = Path(os.environ['LOCALAPPDATA']) / 'SYNK/patent-studio/samples/original.wav'
sha = hashlib.sha256(audio.read_bytes()).hexdigest()
assert sha == 'd9e45d3fb33a6060c3d9cde162a2ac1c395ee84c6cca0c14bc2d8e235328955b'
assert audio.stat().st_size == 131196
from faster_whisper import WhisperModel
import faster_whisper
started = time.monotonic()
model = WhisperModel(config['modelPath'], device='cpu', compute_type='int8', cpu_threads=6, local_files_only=True)
segments, info = model.transcribe(str(audio), language='ko', beam_size=5, temperature=0.0,
    condition_on_previous_text=False, vad_filter=False, initial_prompt=None, prefix=None, word_timestamps=True)
segments = list(segments)
words = [{'text': word.word.strip(), 'startMs': word.start * 1000, 'endMs': word.end * 1000,
    'probability': word.probability} for segment in segments for word in segment.words]
result = {'scope': 'one existing synthetic audio; estimated word timestamps, not verified ground truth',
    'audioSha256': sha, 'bytes': audio.stat().st_size, 'modelId': config['modelId'], 'fasterWhisper': faster_whisper.__version__,
    'durationMs': info.duration * 1000, 'text': ''.join(segment.text for segment in segments).strip(),
    'words': words, 'elapsedMs': round((time.monotonic() - started) * 1000, 2), 'networkAttempts': attempts,
    'candidateCount': 1, 'suppliesAlternativeHypothesisAlignment': False,
    'conclusion': '단일 실제 전사의 시각 추정만 얻음. 다른 가상 후보의 정렬이나 실제 후보 불일치를 생성한 것이 아님.'}
(here / 'AUDIO_PROBE.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
