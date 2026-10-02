from pathlib import Path
import subprocess,json
p=Path(r'C:\Users\q1212\Documents\SYNK-appsscript\docs\마케팅\LAB_카페_다시말해주세요_20260926\performance-references\interview')
ff=Path(r'C:\Users\q1212\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe')
raw=Path(r'C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)')
ranges=[('MVI_2548',345.5,10,'frontal-speaking-to-smile'),('MVI_2550',1098,10,'three-quarter-teeth-smile'),('MVI_2548',998,10,'frontal-ending-smile'),('MVI_2550',1110,10,'three-quarter-smiling-speech')]
records=[]
for name,start,dur,kind in ranges:
    src=raw/(name+'.MP4');out=p/f'{name}_{start:07.1f}_{start+dur:07.1f}_{kind}.mp4'
    args=[str(ff),'-hide_banner','-loglevel','error','-ss',str(start),'-i',str(src),'-t',str(dur),'-map','0:v:0','-map','0:a:0','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','-y',str(out)]
    subprocess.run(args,check=True,timeout=150)
    records.append({'source':str(src),'startSeconds':start,'endSeconds':start+dur,'output':str(out),'processing':'trim only; no retiming, cropping, color correction, face or expression edits; H264/AAC compatibility transcode'})
(p/'reference-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(records,ensure_ascii=False,indent=2))
