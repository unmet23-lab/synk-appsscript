"""Compare decoded final AAC against the new narration sources and quiet endings."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import numpy as np
from scipy import signal

BASE = Path(__file__).resolve().parent
PUB = BASE.parents[2] / '영상' / 'public' / 'firstposts20260910'
QA = BASE / '_검토' / '02-나머지일관화'
IDS = ['03-lab-tiktok', '04-yuhobuilds-youtube', '05-yuhobuilds-instagram', '06-yuhobuilds-tiktok', '07-synkbrief-youtube', '09-synkbrief-tiktok']
RATE = 48000
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))

def pcm(p):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-vn', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', 'pipe:1'], capture_output=True, check=True)
    return np.frombuffer(out.stdout, dtype='<f4').astype(np.float64)

def db(v):
    return float(20*np.log10(max(float(v), 1e-12)))

def main():
    selected = sys.argv[1:] or IDS
    films = read(PUB / 'films.json')
    sos = signal.butter(4, 300, 'highpass', fs=RATE, output='sos')
    results = []
    for ident in selected:
        item = next(i for i in films if i['id'] == ident)
        final = BASE / ident / 'video.mp4'
        candidate = QA / '최종후보' / ident / 'video.mp4'
        movie = candidate if candidate.exists() else final
        movie_sha = sha(movie)
        output = pcm(movie)
        y = signal.sosfilt(sos, output)
        at = 0
        rows = []
        for index, scene in enumerate(item['scenes']):
            if scene.get('audio'):
                source = PUB / scene['audio']
                x = signal.sosfilt(sos, pcm(source))
                nominal = round((at/30 + .3)*RATE)
                pad = round(.04*RATE)
                start = max(0, nominal-pad)
                window = y[start:nominal+len(x)+pad]
                match = signal.correlate(window, x, mode='valid', method='fft')
                lag = int(np.argmax(match))
                actual = window[lag:lag+len(x)]
                gain = float(np.dot(actual, x)/np.dot(x, x))
                residual = actual-gain*x
                snr = db(np.sqrt(np.mean((gain*x)**2))/max(np.sqrt(np.mean(residual**2)), 1e-12))
                rows.append({'scene': index, 'file': scene['audio'], 'sourceSha256': sha(source), 'nominalStartSeconds': nominal/RATE, 'alignmentOffsetSamples': start+lag-nominal, 'measuredOutputOverSourceGain': gain, 'expectedGain': .7, 'withinFivePercentOfPointSeven': abs(gain-.7)<=.035, 'voiceToResidualDb': snr, 'sufficientSourceCorrespondence': snr>12, 'sourcePlaybackRateConfigured': 1})
            at += round(scene['duration']*30)
        end_at = (at-round(item['scenes'][-1]['duration']*30))/30
        tail = output[round((end_at+.1)*RATE):round(at/30*RATE)]
        ending = {'startSeconds': end_at, 'durationSeconds': item['scenes'][-1]['duration'], 'peakAfter100msDbFS': db(np.max(np.abs(tail))), 'quietAfter100ms': bool(np.max(np.abs(tail))<1e-4)}
        result = {'account': ident, 'movie': str(movie), 'sha256': movie_sha, 'sourceStableDuringRead': movie_sha==sha(movie), 'voices': rows, 'ending': ending, 'humanListening': False, 'scope': 'Signal correspondence, gain and decoded ending silence. Does not judge vocal appeal or native pronunciation.'}
        result['pass'] = result['sourceStableDuringRead'] and ending['quietAfter100ms'] and all(r['withinFivePercentOfPointSeven'] and r['sufficientSourceCorrespondence'] for r in rows)
        (QA / ('음성출력-'+ident+'.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        results.append(result)
        print(json.dumps({'account': ident, 'voices': len(rows), 'gainRange': [min(r['measuredOutputOverSourceGain'] for r in rows), max(r['measuredOutputOverSourceGain'] for r in rows)], 'quietEnding': ending['quietAfter100ms'], 'pass': result['pass']}, ensure_ascii=False), flush=True)
    if set(selected)==set(IDS):
        (QA / '음성출력검증.json').write_text(json.dumps({'results': results, 'pass': all(r['pass'] for r in results), 'humanListening': False}, ensure_ascii=False, indent=2), encoding='utf-8')
    if not all(r['pass'] for r in results):
        raise RuntimeError('Decoded sound comparison needs inspection')

if __name__=='__main__':
    main()
