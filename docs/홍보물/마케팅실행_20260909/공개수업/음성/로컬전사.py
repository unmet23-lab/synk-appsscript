"""Generated Korean TTS only. Offline cached Whisper; not human listening or pronunciation certification."""
import argparse
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import time
import unicodedata

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
from faster_whisper import WhisperModel

BASE = Path(__file__).resolve().parent
MODEL_ROOT = Path('C:/Users/q1212/.cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots')

def read(name):
    return json.loads((BASE / name).read_text(encoding='utf-8'))

def save(name, value):
    target = BASE / name
    temporary = target.with_suffix(target.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, target)

def normalized(text):
    return re.sub(r'[^a-z0-9가-힣]', '', unicodedata.normalize('NFKC', text).lower())

def compare(expected, actual):
    a, b = normalized(expected), normalized(actual)
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    differences = [{'type': tag, 'expected': a[i:j], 'transcribed': b[k:l], 'expectedContext': a[max(0, i-10):min(len(a), j+10)]} for tag, i, j, k, l in matcher.get_opcodes() if tag != 'equal']
    return {'normalization': 'NFKC, lowercase, Hangul/ASCII letters/digits only; no semantic substitution', 'characterSimilarity': matcher.ratio(), 'expectedCharacters': len(a), 'transcribedCharacters': len(b), 'differences': differences, 'meaningReviewed': False}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--sample', action='store_true')
    parser.add_argument('--clinic', action='store_true')
    args = parser.parse_args()
    snapshots = [p for p in MODEL_ROOT.iterdir() if (p / 'model.bin').exists()]
    if len(snapshots) != 1:
        raise RuntimeError('Expected exactly one verified cached model snapshot')
    model_path = snapshots[0]
    model = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=6, local_files_only=True)
    if args.sample:
        sample = read('샘플명세.json')
        items = [{'id': 'sample', 'wavFile': 'sample-kevin.wav', 'narration': sample['narration']}]
    else:
        manifest = read('클리닉_음성명세.json' if args.clinic else '음성명세.json')
        if len(manifest['chapters']) != (5 if args.clinic else 18):
            raise RuntimeError('All approved generated chapters are required')
        items = manifest['chapters']
    summary = {'version': 1, 'method': 'faster-whisper-small automatic transcription on local CPU', 'modelSnapshot': model_path.name, 'offline': True, 'audioUploaded': False, 'expectedNarrationUsedAsPrompt': False, 'humanListening': False, 'timestampStatus': 'estimated from audio by ASR; not manually aligned', 'chapters': []}
    for item in items:
        output = f"전사-{'클리닉' if args.clinic else ''}{item['id']}.json"
        audio_path = BASE / item['wavFile']
        audio_hash = hashlib.sha256(audio_path.read_bytes()).hexdigest()
        old_path = BASE / output
        if old_path.exists() and read(output).get('audioSha256') == audio_hash:
            record = read(output)
        else:
            start = time.monotonic()
            segments, info = model.transcribe(str(audio_path), language='ko', beam_size=5, word_timestamps=True, vad_filter=False, condition_on_previous_text=False, temperature=0)
            rows = []
            for segment in segments:
                rows.append({'start': segment.start, 'end': segment.end, 'text': segment.text, 'avgLogProbability': segment.avg_logprob, 'noSpeechProbability': segment.no_speech_prob, 'words': [{'start': w.start, 'end': w.end, 'word': w.word, 'probability': w.probability} for w in (segment.words or [])]})
            transcript = ''.join(s['text'] for s in rows).strip()
            record = {'version': 1, 'id': item['id'], 'input': item['wavFile'], 'audioSha256': audio_hash, 'language': info.language, 'durationSeconds': info.duration, 'model': 'Systran/faster-whisper-small', 'modelSnapshot': model_path.name, 'offline': True, 'humanListening': False, 'expectedNarrationUsedAsPrompt': False, 'timestampStatus': summary['timestampStatus'], 'transcript': transcript, 'expectedNarration': item['narration'], 'comparison': compare(item['narration'], transcript), 'segments': rows, 'processingSeconds': round(time.monotonic()-start, 2)}
            save(output, record)
        summary['chapters'].append({'id': item['id'], 'file': output, 'durationSeconds': record['durationSeconds'], 'characterSimilarity': record['comparison']['characterSimilarity'], 'differenceCount': len(record['comparison']['differences']), 'segments': len(record['segments']), 'wordTimestamps': sum(len(s['words']) for s in record['segments']), 'meaningReviewed': False})
        print(json.dumps(summary['chapters'][-1], ensure_ascii=False), flush=True)
    save('로컬전사-샘플명세.json' if args.sample else '클리닉_로컬전사명세.json' if args.clinic else '로컬전사명세.json', summary)

if __name__ == '__main__':
    main()
