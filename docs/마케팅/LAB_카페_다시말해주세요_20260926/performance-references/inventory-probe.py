from pathlib import Path
import json, subprocess, datetime
out=Path(r'C:\Users\q1212\Documents\SYNK-appsscript\docs\마케팅\LAB_카페_다시말해주세요_20260926\performance-references')
ff=Path(r'C:\Users\q1212\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin')
items=[
('raw2547',r'C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2547.MP4',None),
('raw2548',r'C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2548.MP4',None),
('raw2549',r'C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2549.MP4',None),
('raw2550',r'C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2550.MP4',None),
('interview0923-front',r'C:\Users\q1212\Videos\SYNK_Interview_20260923\renders\ResolveClean\04.mp4',3),
('interview0923-full',r'C:\Users\q1212\Videos\SYNK_Interview_20260923\renders\SYNK_Interview_FINAL_1080p.mp4',None),
('pulse-source-natural',r'C:\Users\q1212\Videos\OneDrive_video_local_20260924\Desktop\SYNK PULSE\인물\완성 영상\source-natural-5s.mp4',2),
('pulse-yuho-cafe',r'C:\Users\q1212\Videos\OneDrive_video_local_20260924\Desktop\SYNK PULSE\인물\완성 영상\yuho-cafe-5s-final.mp4',2),
('kakao0911',r'C:\Users\q1212\Videos\OneDrive_video_local_20260924\문서\카카오톡 받은 파일\KakaoTalk_20260911_183823135.mp4',3),
('kakao0905',r'C:\Users\q1212\Videos\OneDrive_video_local_20260924\문서\카카오톡 받은 파일\KakaoTalk_20260905_164441733.mp4',3),
('kakao0921',r'C:\Users\q1212\Videos\OneDrive_video_local_20260924\문서\카카오톡 받은 파일\KakaoTalk_20260921_183737975.mp4',1),
]
res=[]
for label,src,at in items:
 p=Path(src); row={'id':label,'source':src,'exists':p.exists()}
 if not p.exists(): res.append(row);continue
 row.update(bytes=p.stat().st_size,modified=datetime.datetime.fromtimestamp(p.stat().st_mtime).isoformat())
 try:
  r=subprocess.run([str(ff/'ffprobe.exe'),'-v','error','-show_entries','format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate','-of','json',src],capture_output=True,text=True,timeout=15)
  row['probe']=json.loads(r.stdout) if r.returncode==0 else {'error':r.stderr}
  if at is not None:
   dest=out/f'inventory-{label}.jpg'
   r=subprocess.run([str(ff/'ffmpeg.exe'),'-v','error','-threads','2','-ss',str(at),'-i',src,'-frames:v','1','-vf','scale=960:-2','-q:v','3','-y',str(dest)],capture_output=True,text=True,timeout=15)
   row['sample']=str(dest) if r.returncode==0 else r.stderr
 except Exception as exc:row['error']=str(exc)
 res.append(row)
 print(label,row.get('probe',{}).get('format',{}),row.get('error',''),flush=True)
(out/'inventory-probes.json').write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
