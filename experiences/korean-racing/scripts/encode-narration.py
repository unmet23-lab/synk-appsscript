import concurrent.futures, json, subprocess, wave, math, array, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
jobs = json.loads((ROOT / 'audio-source' / (sys.argv[1] if len(sys.argv)>1 else 'jobs.json')).read_text(encoding='utf-8'))
out = ROOT / 'assets/narration'
out.mkdir(parents=True, exist_ok=True)
def encode(job):
    src = ROOT / 'audio-source/wav' / (job['id'] + '.wav')
    dst = out / (job['id'] + '.mp3')
    with wave.open(str(src)) as wav:
        duration = wav.getnframes() / wav.getframerate()
        samples = array.array('h', wav.readframes(wav.getnframes()))
        rms = math.sqrt(sum(s*s for s in samples) / max(1,len(samples)))
    assert duration > .1 and rms > 50, job['id'] + ' is empty/silent'
    if not dst.exists():
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-i',str(src),
                        '-ac','1','-ar','24000','-codec:a','libmp3lame','-b:a','48k',str(dst)],check=True)
    return {**job, 'duration': round(duration,3), 'bytes': dst.stat().st_size, 'rms': round(rms)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    clips = list(pool.map(encode,jobs))
(out/(sys.argv[2] if len(sys.argv)>2 else 'challenge-manifest.json' if len(sys.argv)>1 else 'manifest.json')).write_text(json.dumps({'voice':'Microsoft Heami Desktop','engine':'Windows System.Speech',
    'format':'MP3 mono 24kHz 48kbps','clips':clips},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'clips':len(clips),'bytes':sum(c['bytes'] for c in clips),'minRms':min(c['rms'] for c in clips)}))
