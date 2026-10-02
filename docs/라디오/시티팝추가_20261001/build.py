"""Append the three delivered Suno masters without changing the existing 19 tracks."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
PROOF = Path(__file__).resolve().parent
OUTPUT = REPO.parent / 'SYNK-radio-20261001'
SOURCE = REPO / 'experiences/korean-rhythm/qa/citypop-20261001'

def run(args):
    p = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if p.returncode:
        raise RuntimeError(p.stderr[-3000:])
    return p

def sha(file):
    return hashlib.file_digest(file.open('rb'), 'sha256').hexdigest()

def probe(file):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_entries',
        'format=duration:stream=codec_name,sample_rate,channels,sample_fmt,bits_per_raw_sample',
        '-of', 'json', str(file)]).stdout)

def main():
    OUTPUT.mkdir(exist_ok=True)
    tracks = json.loads((SOURCE / 'audio-verification.json').read_text(encoding='utf-8'))['audio']
    result = []
    for n, t in enumerate(tracks, 1):
        source = Path(t['file'])
        assert sha(source) == t['sha256'], 'Delivered source changed'
        target = OUTPUT / f'{n:02d}.flac'
        measured = run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(source), '-af',
            'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', 'NUL']).stderr
        m = json.loads(re.findall(r'\{\s*"input_i".*?\}', measured, re.S)[-1])
        af = ('loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:'
            f'measured_I={m["input_i"]}:measured_TP={m["input_tp"]}:'
            f'measured_LRA={m["input_lra"]}:measured_thresh={m["input_thresh"]}:'
            f'offset={m["target_offset"]}')
        run(['ffmpeg', '-y', '-hide_banner', '-v', 'error', '-i', str(source), '-af', af,
            '-ar', '44100', '-ac', '2', '-sample_fmt', 's32', '-bits_per_raw_sample', '24',
            '-c:a', 'flac', '-frame_size', '4608', str(target)])
        p = probe(target)
        assert p['streams'][0]['bits_per_raw_sample'] == '24'
        result.append({**t, 'normalized': str(target), 'normalizedSha256': sha(target),
            'normalizedDuration': float(p['format']['duration']), 'loudnessMeasurement': m})
        print(f'Prepared {n}/3: {t["title"]}', flush=True)
    block = OUTPUT / 'synk-radio-citypop3-20261001.flac'
    args = ['ffmpeg', '-y', '-hide_banner', '-v', 'error']
    for t in result:
        args += ['-i', t['normalized']]
    args += ['-filter_complex', '[0:a][1:a]acrossfade=d=3:c1=tri:c2=tri[x];'
        '[x][2:a]acrossfade=d=3:c1=tri:c2=tri[out]', '-map', '[out]',
        '-ar', '44100', '-ac', '2', '-sample_fmt', 's32', '-bits_per_raw_sample', '24',
        '-c:a', 'flac', '-frame_size', '4608', str(block)]
    run(args)
    run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(block), '-f', 'null', 'NUL'])
    p = probe(block)
    header = block.open('rb').read(12)
    assert header[:4] == b'fLaC' and header[8:12] == bytes.fromhex('12001200'), 'FLAC block size must match existing radio'
    expected = sum(t['normalizedDuration'] for t in result) - 6
    assert abs(float(p['format']['duration']) - expected) < 0.002
    report = {'createdAt': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'tracks': result, 'crossfadeSeconds': 3, 'output': str(block), 'outputSha256': sha(block),
        'probe': p, 'duration': float(p['format']['duration']), 'completeDecode': True}
    (PROOF / 'audio-build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'block': str(block), 'duration': report['duration'], 'sha256': report['outputSha256']}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    main()
