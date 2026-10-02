"""Compare publicly received AAC audio to the exact normalized radio source."""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from scipy.signal import correlate

ROOT = Path(__file__).resolve().parent
RATE = 4000

def samples(file, limit=None):
    args = ['ffmpeg', '-v', 'error', '-i', str(file)]
    if limit:
        args += ['-t', str(limit)]
    args += ['-vn', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', 'pipe:1']
    p = subprocess.run(args, capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype='<f4').astype(np.float64)

name = sys.argv[1]
reference = Path(sys.argv[2])
captured = samples(ROOT / (name + '.mp4'))
snippet = captured[2 * RATE:14 * RATE]
assert len(snippet) == 12 * RATE and np.sqrt(np.mean(snippet ** 2)) > 0.005, 'Missing or silent public audio'
source = samples(reference, 210)
dot = correlate(source, snippet, mode='valid', method='fft')
energy = np.concatenate(([0.], np.cumsum(source ** 2)))
denom = np.sqrt((energy[len(snippet):] - energy[:-len(snippet)]) * np.sum(snippet ** 2))
corr = dot / np.maximum(denom, 1e-12)
index = int(np.argmax(corr))
report = {'publicCapture': str(ROOT / (name + '.mp4')), 'source': str(reference),
    'sampleRate': RATE, 'comparedSeconds': 12, 'sourcePositionSeconds': index / RATE,
    'normalizedCorrelation': float(corr[index]), 'rms': float(np.sqrt(np.mean(snippet ** 2))),
    'passed': bool(corr[index] > 0.85), 'scope': 'Public live audio matches the exact source; this is not a subjective music review.'}
(ROOT / (name + '-comparison.json')).write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
assert report['passed'], 'Public audio did not match the expected song'
