"""Generate local Korean neural recordings from the frozen story master.
Uses the already installed edge_tts client; no account keys or paid plan.
"""
import asyncio, hashlib, json, math, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path
import edge_tts

root=Path(__file__).resolve().parents[1]
folder=root/'assets'/'voice'
jobs=json.loads((folder/'jobs.json').read_text(encoding='utf-8'))
styles={
 'teacher':dict(voice='ko-KR-SunHiNeural',rate='-7%',pitch='-2Hz'),
 'narrator':dict(voice='ko-KR-SunHiNeural',rate='-8%',pitch='+0Hz'),
 'mongle':dict(voice='ko-KR-SunHiNeural',rate='-3%',pitch='+8Hz'),
 'marin':dict(voice='ko-KR-InJoonNeural',rate='-10%',pitch='-4Hz'),
 'kkamong':dict(voice='ko-KR-HyunsuMultilingualNeural',rate='-4%',pitch='+3Hz'),
}
limit=asyncio.Semaphore(3)
def inspect(file):
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(file)],text=True))
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-f','f32le','-ac','1','-ar','24000','pipe:1'])
 import array
 samples=array.array('f');samples.frombytes(raw)
 peak=max(abs(x) for x in samples);rms=math.sqrt(sum(x*x for x in samples)/len(samples))
 assert duration>0.2 and peak>0.01 and peak<1.0, f'Invalid audio {file.name}'
 return dict(durationSeconds=round(duration,3),peakDbfs=round(20*math.log10(peak),2),rmsDbfs=round(20*math.log10(rms),2))

async def generate(line):
 config=styles[line['speaker']]
 key=hashlib.sha256(json.dumps(dict(text=line['text'],**config),ensure_ascii=False,sort_keys=True).encode()).hexdigest()
 file=folder/(line['id']+'.mp3');stamp=folder/(line['id']+'.source.json')
 async with limit:
  if not file.exists() or not stamp.exists() or json.loads(stamp.read_text())['sourceKey']!=key:
   for attempt in range(3):
    try:
     with tempfile.TemporaryDirectory(prefix='synk-story-voice-') as temp:
      raw=Path(temp)/'raw.mp3'
      await edge_tts.Communicate(line['text'],**config).save(str(raw))
      subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af','loudnorm=I=-18:TP=-2.5:LRA=7','-ar','24000','-ac','1','-codec:a','libmp3lame','-b:a','96k',str(file)],check=True)
     stamp.write_text(json.dumps(dict(sourceKey=key,text=line['text'],speaker=line['speaker'],**config),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
     break
    except Exception:
     if attempt==2:raise
     await asyncio.sleep(1+attempt*2)
  result=dict(line,**config,file='assets/voice/'+file.name,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),bytes=file.stat().st_size,**inspect(file))
  print('ready '+line['id'],flush=True)
  return result

async def main():
 lines=await asyncio.gather(*(generate(line) for line in jobs['lines']))
 manifest={k:jobs[k] for k in ['storyVersion','textVersion','sourceHashes']}
 manifest.update(generatedAt=datetime.now(timezone.utc).isoformat(),engine='Microsoft Korean neural speech via edge_tts',humanRecording=False,normalization='ffmpeg loudnorm I=-18 TP=-2.5 LRA=7; mono 24 kHz MP3 96 kbps',voices=styles,lines=lines)
 (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(dict(pass_=True,lines=len(lines),seconds=round(sum(x['durationSeconds'] for x in lines),2),maxPeakDbfs=max(x['peakDbfs'] for x in lines)),ensure_ascii=False),flush=True)

asyncio.run(main())
