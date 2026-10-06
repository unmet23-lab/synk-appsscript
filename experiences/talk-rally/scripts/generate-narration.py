"""말 랠리 — 안내 음성(나레이션)을 한국어 음성 파일로 미리 한 번 굽는다(놀이 중 AI 호출 없음, 2026-10-07).
몽글의 말(generate-voice.py)과 같은 방법: 이미 설치된 edge_tts 클라이언트(계정 키·유료 요금 없음), ffmpeg로 앞뒤 빈 소리 자르기,
mono 24 kHz MP3 96 kbps. 몽글과 헷갈리지 않게 다른 목소리(남성)로, 초급이 알아듣게 조금 천천히 읽힌다.
크기는 몽글의 말 파일(-18.4 LUFS)보다 조금 낮게(-20.5 LUFS, 재어서 고정 이득) 맞추고 게임 소리 길에서 qa/sound.cjs로 잰다(README 「소리」).
- 줄마다 만든 설정은 assets/narration/<id>.source.json(공개 묶음에서 빠짐), 확인용 목록은 assets/narration/manifest.json(제작 도구 이름 없음).
- 게임이 읽는 목록은 narration.mjs(문장과 파일 자리만). 문장이 바뀐 줄만 다시 굽는다.
쓰는 법: python experiences/talk-rally/scripts/generate-narration.py
"""
import asyncio, hashlib, json, math, re, subprocess, tempfile, array
from datetime import datetime, timezone
from pathlib import Path
import edge_tts

root = Path(__file__).resolve().parents[1]
folder = root / 'assets' / 'narration'
folder.mkdir(parents=True, exist_ok=True)
lines = json.loads(subprocess.check_output(['node', str(root / 'scripts' / 'narration-lines.mjs')], text=True, encoding='utf-8'))
# 안내: 몽글(여성, 높게)과 다른 남성 목소리, 조금 천천히
style = dict(voice='ko-KR-InJoonNeural', rate='-6%', pitch='+0Hz')
# 크기: 앞뒤를 자르고 쉼을 줄인 뒤 통합 음량(EBU R128)을 재어 한 번의 고정 이득으로 맞춘다(2026-10-07).
# 한 번에 하는 loudnorm은 두 문장 사이가 길게 빈 짧은 파일에서 -18 LUFS로 나와(목표 -20) 몽글의 말(-18.4)보다 커졌다.
TARGET_I = -20.5   # 몽글의 말 파일(-18.4 LUFS)보다 2 LU쯤 낮게
LOUDNORM = f'measured I -> volume to {TARGET_I} LUFS (linear)'
# 앞뒤 빈 소리 자르기(몽글의 말과 같은 값): 판이 바뀌는 때를 말 길이 이상으로 늦추지 않게
TRIM = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse'
# 두 문장 사이에 1.4~1.6초씩 쉬어서(2026-10-07 실측) 0.25초 넘는 쉼을 0.28초로 줄인다 — 들리는 쉼은 약 0.5초(자연스러운 문장 사이)
PAUSE = 'silenceremove=stop_periods=-1:stop_duration=0.25:stop_threshold=-40dB:stop_silence=0.28'
limit = asyncio.Semaphore(3)

def integrated(file):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(file), '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    values = re.findall(r'^\s*I:\s*(-?\d+(?:\.\d+)?) LUFS', out, re.M)
    assert values, f'통합 음량을 못 잼 {file}'
    return float(values[-1])

def inspect(file):
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(file)], text=True))
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file), '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1'])
    samples = array.array('f'); samples.frombytes(raw)
    peak = max(abs(x) for x in samples); rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    assert duration > 0.3 and 0.01 < peak < 1.0, f'소리가 이상함 {file.name}'
    return dict(durationSeconds=round(duration, 3), peakDbfs=round(20 * math.log10(peak), 2), rmsDbfs=round(20 * math.log10(rms), 2), integratedLufs=integrated(file))

async def generate(line):
    key = hashlib.sha256(json.dumps(dict(text=line['text'], trim=TRIM, loudnorm=LOUDNORM, pause=PAUSE, **style), ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    file = folder / (line['id'] + '.mp3'); stamp = folder / (line['id'] + '.source.json')
    async with limit:
        if not file.exists() or not stamp.exists() or json.loads(stamp.read_text(encoding='utf-8'))['sourceKey'] != key:
            for attempt in range(3):
                try:
                    with tempfile.TemporaryDirectory(prefix='synk-rally-narration-') as temp:
                        raw = Path(temp) / 'raw.mp3'; mid = Path(temp) / 'mid.wav'
                        await edge_tts.Communicate(line['text'], **style).save(str(raw))
                        # -map_metadata -1: 원본 태그를 옮기지 않는다(파일에 제작 도구 표기가 남지 않게)
                        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw), '-map_metadata', '-1', '-af', TRIM + ',' + PAUSE,
                                        '-ar', '24000', '-ac', '1', str(mid)], check=True)
                        gain = TARGET_I - integrated(mid)
                        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(mid), '-map_metadata', '-1', '-af', f'volume={gain:.2f}dB',
                                        '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', str(file)], check=True)
                    stamp.write_text(json.dumps(dict(sourceKey=key, text=line['text'], loudnorm=LOUDNORM, pause=PAUSE, **style), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                    break
                except Exception:
                    if attempt == 2: raise
                    await asyncio.sleep(1 + attempt * 2)
        result = dict(id=line['id'], text=line['text'], file='assets/narration/' + file.name, sha256=hashlib.sha256(file.read_bytes()).hexdigest(), bytes=file.stat().st_size, **inspect(file))
        print('ready ' + line['id'], flush=True)
        return result

async def main():
    done = await asyncio.gather(*(generate(line) for line in lines))
    manifest = dict(generatedAt=datetime.now(timezone.utc).isoformat(), humanRecording=False,
                    normalization=f'앞뒤 빈 소리 자름, 문장 사이 쉼 0.28초로 줄임, 통합 음량을 재어 {TARGET_I} LUFS로 고정 이득(몽글의 말 -18.4보다 조금 낮게); mono 24 kHz MP3 96 kbps', lines=done)
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(ok=True, lines=len(done), seconds=round(sum(x['durationSeconds'] for x in done), 2),
                          longest=max(x['durationSeconds'] for x in done), maxPeakDbfs=max(x['peakDbfs'] for x in done)), ensure_ascii=False), flush=True)

asyncio.run(main())
