"""Official local Supertonic 3 preset audition. No paid service or voice cloning."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import time

base = Path(__file__).resolve().parent
os.environ['SUPERTONIC_CACHE_DIR'] = str(base / 'model')
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
import numpy as np
import soundfile as sf
from supertonic import TTS
from supertonic.config import get_model_repo, get_model_revision

text = '같이 들어볼까요? 좋아요, 이번에는 조금 다르게 해볼게요. 작은 차이가 모이면, 우리만의 목소리가 돼요.'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest = {'status': 'initializing', 'generatedBy': 'local synthetic TTS', 'model': get_model_repo('supertonic-3'), 'revision': get_model_revision('supertonic-3'), 'text': text, 'lang': 'ko', 'speed': 1.0, 'steps': 8, 'seed': 42, 'normalization': 'none; raw original WAVs', 'humanListening': False, 'userApproved': False, 'packages': {p: importlib.metadata.version(p) for p in ['supertonic', 'onnxruntime', 'numpy', 'soundfile', 'huggingface-hub']}, 'results': []}
def save():
    p = base / 'manifest.json'
    tmp = p.with_suffix('.json.pending')
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(p)
save()
try:
    started = time.perf_counter()
    tts = TTS(model='supertonic-3', auto_download=True, intra_op_num_threads=4, inter_op_num_threads=1)
    manifest['loadSeconds'] = time.perf_counter() - started
    manifest['providers'] = ['CPUExecutionProvider']
    print('Official model ready; generating F1-F5', flush=True)
    for name in ['F1', 'F2', 'F3', 'F4', 'F5']:
        output = base / (name + '-raw.wav')
        if output.exists():
            raise RuntimeError('Existing raw result preserved: ' + str(output))
        np.random.seed(42)
        started = time.perf_counter()
        wav, duration = tts.synthesize(text, voice_style=tts.get_voice_style(voice_name=name), lang='ko', speed=1.0, total_steps=8)
        tts.save_audio(wav, str(output))
        info = sf.info(output)
        data, rate = sf.read(output)
        manifest['results'].append({'voice': name, 'file': str(output), 'sha256': sha(output), 'sampleRate': rate, 'channels': info.channels, 'frames': info.frames, 'durationSeconds': info.duration, 'subtype': info.subtype, 'elapsedSeconds': time.perf_counter() - started, 'peak': float(np.max(np.abs(data))), 'rms': float(np.sqrt(np.mean(data ** 2)))})
        manifest['status'] = 'generating'
        save()
        print(name + ' ready: ' + str(round(info.duration, 3)) + 's', flush=True)
    manifest['modelFiles'] = [{'file': str(p.relative_to(base)), 'sha256': sha(p), 'bytes': p.stat().st_size} for p in sorted((base / 'model').rglob('*')) if p.is_file()]
    manifest['status'] = 'completed raw audition files; not human-listened'
except Exception as error:
    manifest['status'] = 'failed; no automatic retry'
    manifest['error'] = str(error)
    save()
    raise
save()
print('F1-F5 raw manifest complete', flush=True)
