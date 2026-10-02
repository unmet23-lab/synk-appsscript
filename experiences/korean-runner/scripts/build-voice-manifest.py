"""Record the local speech files and refresh the timing used by the game."""
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
jobs = json.loads((root / 'assets/voice/jobs.json').read_text(encoding='utf-8-sig'))
clips = []
for job in jobs:
    audio_file = root / 'assets/voice' / (job['id'] + '.mp3')
    info = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', str(audio_file)
    ], text=True))
    seconds = float(info['format']['duration'])
    if not .5 < seconds < 5.3:
        raise ValueError('Check speech length and update corridor spacing: ' + job['id'])
    clips.append({**job, 'seconds': seconds, 'bytes': audio_file.stat().st_size,
                  'sha256': hashlib.sha256(audio_file.read_bytes()).hexdigest(),
                  'codec': info['streams'][0]['codec_name'],
                  'sampleRate': int(info['streams'][0]['sample_rate']),
                  'channels': info['streams'][0]['channels']})
manifest = {'voice': 'Microsoft Heami Desktop', 'rate': 0,
            'clips': clips, 'totalBytes': sum(c['bytes'] for c in clips)}
(root / 'assets/voice/manifest.json').write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'voice-timing.mjs').write_text(
    '// Generated from the local MP3 durations; allow full speech before the first action.\n'
    'export const VOICE_SECONDS=' +
    json.dumps({c['id']: round(c['seconds'], 4) for c in clips}, indent=2) + ';\n', encoding='utf-8')
print('Speech metadata: ' + str(len(clips)) + ' clips')
