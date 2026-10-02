"""Independent offline transcription of generated narration, never a human listening claim."""
import difflib
import hashlib
import json
import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
from faster_whisper import WhisperModel

BASE = Path(__file__).resolve().parent
OUT = BASE / '_검토' / '음성대조'
OUT.mkdir(parents=True, exist_ok=True)
CACHE = Path('C:/Users/q1212/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots')

def norm(text):
    return re.sub(r'[^가-힣a-z0-9]', '', text.lower())

def main():
    snapshots = [p for p in CACHE.iterdir() if (p / 'model.bin').is_file()]
    if len(snapshots) != 1:
        raise RuntimeError('A single existing local model snapshot is required')
    model = WhisperModel(str(snapshots[0]), device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
    source = json.loads((BASE / '원고' / 'video.json').read_text(encoding='utf-8-sig'))
    active = {s['narration'] for i in source['items'] for s in i['scenes'] if s.get('narration')}
    records = []
    for source in sorted((BASE / 'audio').glob('voice-*.json')):
        manifest = json.loads(source.read_text(encoding='utf-8'))
        if manifest.get('narration') not in active:
            continue
        if manifest.get('status') != 'completed':
            continue
        wav = BASE / 'audio' / manifest['file']
        digest = hashlib.sha256(wav.read_bytes()).hexdigest()
        destination = OUT / source.name
        try:
            old = json.loads(destination.read_text(encoding='utf-8')) if destination.exists() else None
        except json.JSONDecodeError:
            old = None
        if old and old.get('sha256') == digest:
            record = old
        else:
            segments, info = model.transcribe(str(wav), language='ko', beam_size=5, word_timestamps=True, vad_filter=False, condition_on_previous_text=False, temperature=0)
            rows = [{'start': s.start, 'end': s.end, 'text': s.text,
                     'words': [{'start': w.start, 'end': w.end, 'word': w.word} for w in (s.words or [])]} for s in segments]
            actual = ''.join(s['text'] for s in rows).strip()
            expected = manifest['narration']
            matcher = difflib.SequenceMatcher(a=norm(expected), b=norm(actual), autojunk=False)
            record = {'file': manifest['file'], 'sha256': digest, 'expected': expected, 'actual': actual,
                      'characterSimilarity': matcher.ratio(), 'duration': info.duration,
                      'segments': rows, 'modelSnapshot': snapshots[0].name,
                      'offline': True, 'expectedUsedAsPrompt': False, 'audioUploaded': False,
                      'humanListening': False, 'meaningReview': 'pending'}
            temporary = destination.with_suffix('.tmp')
            temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
            temporary.replace(destination)
        records.append(record)
        print(json.dumps({'file': record['file'], 'similarity': round(record['characterSimilarity'], 3), 'actual': record['actual']}, ensure_ascii=False), flush=True)
    temporary = OUT / '전체.tmp'
    temporary.write_text(json.dumps({'count': len(records), 'records': records}, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(OUT / '전체.json')

if __name__ == '__main__':
    main()
