"""Bounded, read-only crawl of official voice documentation and a public Korean benchmark."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.request import Request, urlopen
import hashlib
import json
import sys

BASE = Path(__file__).resolve().parent / '조사' / '한국어_설정_20260910'
SOURCES = {
    'eleven-voice-library': 'https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md',
    'eleven-tts-settings': 'https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech.md',
    'eleven-best-practices': 'https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices.md',
    'eleven-models': 'https://elevenlabs.io/docs/overview/models.md',
    'eleven-voice-design': 'https://elevenlabs.io/docs/eleven-creative/voices/voice-design.md',
    'eleven-output-api': 'https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md',
    'eleven-v3-ga': 'https://elevenlabs.io/blog/eleven-v3-is-now-generally-available',
    'korean-arena': 'https://channelcorp-ko-tts-arena.hf.space/leaderboard',
    'korean-arena-method': 'https://channelcorp-ko-tts-arena.hf.space/about',
    'humelo-dive': 'https://console.humelo.com/docs/dive',
    'typecast-tts': 'https://typecast.ai/docs/api-reference/text-to-speech/text-to-speech.md',
}

def fetch(item):
    key, url = item
    row = {'source': key, 'requestedUrl': url, 'requestedAtUtc': datetime.now(timezone.utc).isoformat()}
    try:
        with urlopen(Request(url, headers={'User-Agent': 'SYNK-Voice-Research/1.0', 'Cache-Control': 'no-cache'}), timeout=30) as response:
            content = response.read()
            mime = response.headers.get('Content-Type', '')
            ext = '.html' if 'html' in mime else '.md'
            target = BASE / (key + ext)
            target.write_bytes(content)
            row.update(status=response.status, finalUrl=response.url, responseDate=response.headers.get('Date'), contentType=mime, file=str(target), bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
    except Exception as error:
        row.update(status='unavailable', error=str(error))
    print(json.dumps(row, ensure_ascii=True), flush=True)
    return row

if __name__ == '__main__':
    BASE.mkdir(parents=True, exist_ok=True)
    requested = {key: url for key, url in SOURCES.items() if not sys.argv[1:] or key in sys.argv[1:]}
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(fetch, requested.items()))
    manifest = BASE / 'crawl-manifest.json'
    if sys.argv[1:] and manifest.exists():
        previous = json.loads(manifest.read_text(encoding='utf-8'))['sources']
        results = [row for row in previous if row['source'] not in requested] + results
    manifest.write_text(json.dumps({'dateKst': '2026-09-10', 'purpose': 'Current Korean narration voice/model/settings guidance; no speech generation or account change', 'scope': 'Eleven allowlisted public primary-source pages, not an exhaustive internet crawl', 'sources': results}, ensure_ascii=False, indent=2), encoding='utf-8')
