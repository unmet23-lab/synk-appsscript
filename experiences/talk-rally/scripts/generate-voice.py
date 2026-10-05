"""말 랠리 — 몽글의 말을 한국어 음성 파일로 미리 한 번 굽는다(놀이 중 AI 호출 없음).
이미 설치된 edge_tts 클라이언트를 쓴다(계정 키·유료 요금 없음). 이야기 교실(story-classroom/scripts/generate-voice.py)과 같은 방식:
ffmpeg loudnorm I=-18 TP=-2.5 LRA=7, mono 24 kHz MP3 96 kbps. 원고(content.mjs)가 바뀐 줄만 다시 굽는다.
- 줄마다 만든 설정은 assets/voice/<id>.source.json(공개 묶음에서 빠짐), 확인용 목록은 assets/voice/manifest.json(제작 도구 이름 없음).
쓰는 법: python experiences/talk-rally/scripts/generate-voice.py
"""
import asyncio, hashlib, json, math, subprocess, tempfile, array
from datetime import datetime, timezone
from pathlib import Path
import edge_tts

root = Path(__file__).resolve().parents[1]
folder = root / 'assets' / 'voice'
folder.mkdir(parents=True, exist_ok=True)
lines = json.loads(subprocess.check_output(['node', str(root / 'scripts' / 'lines.mjs')], text=True, encoding='utf-8'))
# 몽글: 이야기 교실의 몽글과 같은 목소리, 초급이 알아듣게 조금 천천히
style = dict(voice='ko-KR-SunHiNeural', rate='-8%', pitch='+8Hz')
# 앞뒤의 빈 소리를 잘라, 말이 끝나는 순간 몽글이 공을 치게 한다(약한 첫소리가 잘리지 않게 -55dB 아래만, 앞 0.05초·끝 0.08초는 남김)
TRIM = 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse'
limit = asyncio.Semaphore(3)

def inspect(file):
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(file)], text=True))
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file), '-f', 'f32le', '-ac', '1', '-ar', '24000', 'pipe:1'])
    samples = array.array('f'); samples.frombytes(raw)
    peak = max(abs(x) for x in samples); rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    assert duration > 0.2 and 0.01 < peak < 1.0, f'소리가 이상함 {file.name}'
    return dict(durationSeconds=round(duration, 3), peakDbfs=round(20 * math.log10(peak), 2), rmsDbfs=round(20 * math.log10(rms), 2))

async def generate(line):
    key = hashlib.sha256(json.dumps(dict(text=line['text'], trim=TRIM, **style), ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    file = folder / (line['id'] + '.mp3'); stamp = folder / (line['id'] + '.source.json')
    async with limit:
        if not file.exists() or not stamp.exists() or json.loads(stamp.read_text(encoding='utf-8'))['sourceKey'] != key:
            for attempt in range(3):
                try:
                    with tempfile.TemporaryDirectory(prefix='synk-rally-voice-') as temp:
                        raw = Path(temp) / 'raw.mp3'
                        await edge_tts.Communicate(line['text'], **style).save(str(raw))
                        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(raw), '-af', TRIM + ',loudnorm=I=-18:TP=-2.5:LRA=7',
                                        '-ar', '24000', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k', str(file)], check=True)
                    stamp.write_text(json.dumps(dict(sourceKey=key, text=line['text'], **style), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                    break
                except Exception:
                    if attempt == 2: raise
                    await asyncio.sleep(1 + attempt * 2)
        result = dict(id=line['id'], text=line['text'], file='assets/voice/' + file.name, sha256=hashlib.sha256(file.read_bytes()).hexdigest(), bytes=file.stat().st_size, **inspect(file))
        print('ready ' + line['id'], flush=True)
        return result

async def main():
    done = await asyncio.gather(*(generate(line) for line in lines))
    manifest = dict(generatedAt=datetime.now(timezone.utc).isoformat(), humanRecording=False,
                    normalization='앞뒤 빈 소리 자름, loudnorm I=-18 TP=-2.5 LRA=7; mono 24 kHz MP3 96 kbps', lines=done)
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(ok=True, lines=len(done), seconds=round(sum(x['durationSeconds'] for x in done), 2),
                          longest=max(x['durationSeconds'] for x in done), maxPeakDbfs=max(x['peakDbfs'] for x in done)), ensure_ascii=False), flush=True)

asyncio.run(main())
