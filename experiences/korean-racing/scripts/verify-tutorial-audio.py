"""Check the actual encoded MP3s and add decoder facts to their manifest."""
import array
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / 'assets/narration/tutorial-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert len(manifest['clips']) == 9
assert len({clip['id'] for clip in manifest['clips']}) == 9
for clip in manifest['clips']:
    path = manifest_path.parent / (clip['id'] + '.mp3')
    data = path.read_bytes()
    assert data.startswith(b'ID3') or (data[0] == 0xFF and data[1] & 0xE0 == 0xE0), clip['id']
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'a:0',
        '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate,duration',
        '-of', 'json', str(path),
    ]))['streams'][0]
    assert probe['codec_name'] == 'mp3'
    assert int(probe['sample_rate']) == 24000 and probe['channels'] == 1
    assert int(probe['bit_rate']) == 48000
    pcm = subprocess.check_output([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
        '-i', str(path), '-ac', '1', '-ar', '24000', '-f', 's16le', 'pipe:1',
    ])
    samples = array.array('h', pcm)
    if sys.byteorder != 'little':
        samples.byteswap()
    decoded_duration = len(samples) / 24000
    decoded_rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    assert decoded_duration > .1 and decoded_rms > 50, clip['id'] + ' is empty/silent'
    assert abs(decoded_duration - clip['duration']) < .025, clip['id'] + ' duration differs from source'
    assert len(data) == clip['bytes']
    clip.update({
        'mp3Duration': round(float(probe['duration']), 3),
        'decodedDuration': round(decoded_duration, 3),
        'decodedRms': round(decoded_rms),
        'header': 'ID3' if data.startswith(b'ID3') else 'MPEG frame sync',
        'sha256': hashlib.sha256(data).hexdigest(),
    })
manifest['verification'] = 'ffprobe MP3 stream and ffmpeg decoded signed 16-bit PCM'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({
    'verifiedClips': len(manifest['clips']),
    'bytes': sum(clip['bytes'] for clip in manifest['clips']),
    'minDecodedRms': min(clip['decodedRms'] for clip in manifest['clips']),
    'maxDecodedRms': max(clip['decodedRms'] for clip in manifest['clips']),
    'decodedDurations': {clip['id']: clip['decodedDuration'] for clip in manifest['clips']},
}, ensure_ascii=False))
