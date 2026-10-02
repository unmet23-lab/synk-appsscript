"""Bounded public-document crawl for the 2026-09-10 personal voice study.

No credentials, account APIs, speech uploads, or media downloads are used.
TLS verification stays enabled. Every result is retained, including failures.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.request import Request, urlopen
import hashlib
import json
import sys

BASE = Path(__file__).resolve().parent / '조사' / '본인목소리_20260910'
SOURCES = {
    'eleven-pvc': 'https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning.md',
    'eleven-pvc-api': 'https://elevenlabs.io/docs/eleven-api/guides/how-to/voices/professional-voice-cloning.md',
    'eleven-models': 'https://elevenlabs.io/docs/overview/models.md',
    'eleven-voice-design': 'https://elevenlabs.io/docs/eleven-creative/voices/voice-design.md',
    'eleven-tts-settings': 'https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech.md',
    'eleven-tts-api': 'https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md',
    'eleven-voice-changer-api': 'https://elevenlabs.io/docs/api-reference/speech-to-speech/convert.md',
    'eleven-pricing': 'https://elevenlabs.io/pricing',
    'eleven-data-use': 'https://help.elevenlabs.io/hc/en-us/articles/29952728805393-Is-my-data-used-to-improve-ElevenLabs-AI-models',
    'eleven-voice-access': 'https://help.elevenlabs.io/hc/en-us/articles/20828410638097-Who-has-access-to-my-voices',
    'minimax-clone': 'https://platform.minimax.io/docs/api-reference/voice-cloning-clone',
    'minimax-speech28': 'https://www.minimax.io/news/minimax-speech-28',
    'fish-s21-release': 'https://fish.audio/blog/s2-1-pro-free-api/',
    'fish-s2-card': 'https://huggingface.co/fishaudio/s2-pro/raw/main/README.md',
    'qwen3-base-card': 'https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base/raw/main/README.md',
    'chatterbox-v3': 'https://www.resemble.ai/resources/chatterbox-multilingual-v3-tts-with-embedded-watermarking-for-25-languages',
    'dive-saved-voices': 'https://console.humelo.com/docs/saved-voices',
}


def fetch(item):
    key, url = item
    row = {'id': key, 'requestedUrl': url, 'retrievedAtUtc': datetime.now(timezone.utc).isoformat()}
    try:
        request = Request(url, headers={'User-Agent': 'SYNK-Voice-Research/1.0', 'Cache-Control': 'no-cache'})
        with urlopen(request, timeout=25) as response:
            content = response.read(5_000_001)
            if len(content) > 5_000_000:
                raise ValueError('Document exceeds 5 MB bound')
            mime = response.headers.get('Content-Type', '')
            if not any(value in mime for value in ('text/', 'application/json', 'application/xhtml')):
                raise ValueError('Not a permitted document content type: ' + mime)
            filename = key + ('.html' if 'html' in mime else '.md')
            (BASE / filename).write_bytes(content)
            row.update(status=response.status, finalUrl=response.url, responseDate=response.headers.get('Date'), contentType=mime, file=filename, bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
    except Exception as error:
        row.update(status='unavailable', error=str(error))
    print(json.dumps({'id': key, 'status': row['status'], 'bytes': row.get('bytes'), 'error': row.get('error')}, ensure_ascii=True), flush=True)
    return row


if __name__ == '__main__':
    BASE.mkdir(parents=True, exist_ok=True)
    extra = BASE / 'extra-sources.json'
    if extra.exists():
        SOURCES.update(json.loads(extra.read_text(encoding='utf-8')))
    manifest_path = BASE / 'crawl-manifest.json'
    previous = json.loads(manifest_path.read_text(encoding='utf-8'))['sources'] if '--new-only' in sys.argv and manifest_path.exists() else []
    existing_ids = {row['id'] for row in previous}
    requested = {key: url for key, url in SOURCES.items() if key not in existing_ids}
    with ThreadPoolExecutor(max_workers=3) as pool:
        rows = previous + list(pool.map(fetch, requested.items()))
    manifest = {'asOfDateKst': '2026-09-10', 'scope': 'Allowlisted public primary-source documents, not an exhaustive internet crawl', 'speechGenerationPerformed': False, 'sources': rows}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    bad = [row['id'] for row in rows if row['status'] == 200 and hashlib.sha256((BASE / row['file']).read_bytes()).hexdigest() != row['sha256']]
    print(json.dumps({'total': len(rows), 'http200': sum(row['status'] == 200 for row in rows), 'hashMismatches': bad}))
    if bad:
        raise SystemExit(1)
