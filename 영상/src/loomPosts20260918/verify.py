from pathlib import Path
import json, subprocess, hashlib, numpy as np, io, wave
from PIL import Image, ImageDraw
base=Path(__file__).resolve().parents[2]
out=base/'out'/'loom-posts-20260918'
exe=base/'node_modules'/'@remotion'/'compositor-win32-x64-msvc'
report={'fps':30,'cut_frames':78,'cut_seconds':2.6,'cuts_per_film':8,'loom_runtime':'tools/lib/loom-scene.mjs','videos':[]}
for name in ('LAB','SHIFT'):
 path=out/f'SYNK-{name}.mp4'
 probe=json.loads(subprocess.check_output([str(exe/'ffprobe.exe'),'-v','error','-show_streams','-show_format','-of','json',str(path)]))
 video=next(s for s in probe['streams'] if s['codec_type']=='video')
 assert (video['width'],video['height'],video['r_frame_rate'],int(video['nb_frames']))==(1080,1920,'30/1',624),video
 assert any(s['codec_type']=='audio' for s in probe['streams'])
 subprocess.run([str(exe/'ffmpeg.exe'),'-v','error','-i',str(path),'-c:v','rawvideo','-c:a','pcm_s16le','-f','null','-'],check=True)
 pcm=subprocess.check_output([str(exe/'ffmpeg.exe'),'-v','error','-i',str(path),'-vn','-sn','-c:a','pcm_s16le','-f','wav','-'])
 with wave.open(io.BytesIO(pcm),'rb') as wav:
  audio=np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').astype(float)/32768
 levels={'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(audio**2)))),'peak_dbfs':float(20*np.log10(np.max(np.abs(audio))))}
 assert levels['peak_dbfs'] < -.1 and levels['rms_dbfs'] > -60, levels
 sheet=Image.new('RGB',(1080,1030),'#dedad4')
 for i in range(8):
  frame=out/f'{name}-{i+1:02}.jpg'
  subprocess.run([str(exe/'ffmpeg.exe'),'-v','error','-ss',str(i*2.6+1.1),'-i',str(path),'-frames:v','1','-vf','scale=270:480','-y',str(frame)],check=True)
  sheet.paste(Image.open(frame),(i%4*270,i//4*515))
  ImageDraw.Draw(sheet).text((i%4*270+8,i//4*515+485),f'{i+1:02} | {i*2.6:.1f}-{(i+1)*2.6:.1f}s',fill='#2b2320')
 sheet.save(out/f'{name}-contact.jpg',quality=95)
 report['videos'].append({'name':name,'duration':probe['format']['duration'],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'full_decode':'passed','audio':levels})
(out/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
