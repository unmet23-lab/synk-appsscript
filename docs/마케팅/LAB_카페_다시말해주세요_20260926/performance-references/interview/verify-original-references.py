from pathlib import Path
import subprocess,json
from PIL import Image,ImageDraw,ImageFont
p=Path(r'C:\Users\q1212\Documents\SYNK-appsscript\docs\마케팅\LAB_카페_다시말해주세요_20260926\performance-references\interview')
ff=Path(r'C:\Users\q1212\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe'); probe=ff.with_name('ffprobe.exe')
records=json.loads((p/'reference-manifest.json').read_text(encoding='utf-8'));font=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',20)
for k,rec in enumerate(records,1):
    clip=Path(rec['output']);folder=p/f'original-{k:02d}-frames';folder.mkdir(exist_ok=True)
    subprocess.run([str(ff),'-hide_banner','-loglevel','error','-i',str(clip),'-vf','select=not(mod(n\\,30))','-fps_mode','vfr','-q:v','3','-y',str(folder/'%03d.jpg')],check=True)
    frames=sorted(folder.glob('*.jpg'));crop=(660,40,1320,780) if '2548' in clip.name else (120,70,810,850)
    sheet=Image.new('RGB',(1800,1720),(20,20,20));d=ImageDraw.Draw(sheet)
    for j,f in enumerate(frames[:20]):
        t=rec['startSeconds']+j*30*1001/60000;im=Image.open(f).crop(crop);im.thumbnail((360,400))
        x=(j%5)*360;y=(j//5)*430;sheet.paste(im,(x,y));d.text((x+8,y+401),f'{int(t)//60:02d}:{t%60:05.2f}',font=font,fill='white')
    sheet.save(p/f'original-{k:02d}-motion-sheet.jpg',quality=94)
    meta=json.loads(subprocess.check_output([str(probe),'-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,avg_frame_rate,nb_frames','-of','json',str(clip)]))
    check=subprocess.run([str(ff),'-v','error','-i',str(clip),'-f','null','-'],capture_output=True,text=True,timeout=60)
    rec['probe']=meta;rec['fullDecodeOK']=check.returncode==0 and not check.stderr;rec['motionSheet']=str(p/f'original-{k:02d}-motion-sheet.jpg')
(p/'reference-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print([(Path(r['output']).name,r['probe']['format']['duration'],r['fullDecodeOK']) for r in records])
