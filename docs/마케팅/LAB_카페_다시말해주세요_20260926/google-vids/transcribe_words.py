import json
import sys
from pathlib import Path
from faster_whisper import WhisperModel

root = Path(__file__).resolve().parents[4]
config = json.loads((root / 'tools/patent-studio/.runtime/local-stt.json').read_text(encoding='utf-8'))
model = WhisperModel(config['modelPath'], device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
for item in sys.argv[1:]:
    source = Path(item).resolve()
    segments, info = model.transcribe(str(source), language='ko', beam_size=5, temperature=0,
                                      condition_on_previous_text=False, vad_filter=False, word_timestamps=True)
    rows = []
    for segment in segments:
        rows.append({'start': segment.start, 'end': segment.end, 'text': segment.text,
                     'words': [{'start': w.start, 'end': w.end, 'word': w.word, 'probability': w.probability}
                               for w in (segment.words or [])]})
    payload = {'source': source.name, 'language': info.language, 'duration': info.duration,
               'provider': 'local faster-whisper-small', 'segments': rows,
               'note': 'Automatic transcript; not proof of acting quality or exact lip sync.'}
    dest = source.with_suffix('.words.json')
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(payload, ensure_ascii=False))
