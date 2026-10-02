import asyncio, hashlib, json, subprocess
from pathlib import Path
import edge_tts

ROOT=Path(__file__).resolve().parents[1]
JOBS=json.loads((ROOT/'audio-source/jobs.json').read_text(encoding='utf-8'))
VOICE='ko-KR-SunHiNeural'
RAW=ROOT/'audio-source/raw'
OUT=ROOT/'assets/narration'
RAW.mkdir(parents=True,exist_ok=True)
OUT.mkdir(parents=True,exist_ok=True)

def run(args):
 p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
 return p.stdout

async def render(job):
 raw=RAW/(job['id']+'.mp3');dst=OUT/(job['id']+'.mp3')
 if not raw.exists():
  for attempt in range(3):
   try:
    await edge_tts.Communicate(job['text'],VOICE,rate='-8%',pitch='+0Hz').save(str(raw))
    break
   except Exception:
    if raw.exists():raw.unlink()
    if attempt==2:raise
    await asyncio.sleep(1)
 run(['ffmpeg','-hide_banner','-v','error','-y','-i',str(raw),'-af','loudnorm=I=-16:TP=-1:LRA=7','-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','64k',str(dst)])
 info=json.loads(run(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(dst)]))
 run(['ffmpeg','-v','error','-xerror','-i',str(dst),'-f','null','NUL'])
 duration=float(info['format']['duration'])
 assert .5<duration<14,job['id']
 print('Narration: '+job['id'],flush=True)
 return {**job,'url':'assets/narration/'+job['id']+'.mp3','duration':duration,'bytes':dst.stat().st_size,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'completeDecode':True}

async def main():
 semaphore=asyncio.Semaphore(3)
 async def bounded(job):
  async with semaphore:return await render(job)
 clips=await asyncio.gather(*(bounded(job) for job in JOBS))
 report={'voice':VOICE,'engine':'edge-tts','rate':'-8%','format':'MP3 mono 24kHz 64kbps','clips':clips}
 (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 data={c['id']:{'url':c['url'],'duration':c['duration']} for c in clips}
 (ROOT/'narration.mjs').write_text('export const NARRATION='+json.dumps(data,ensure_ascii=False)+';\n',encoding='utf-8')
 print(json.dumps({'clips':len(clips),'bytes':sum(c['bytes'] for c in clips)}),flush=True)

asyncio.run(main())
