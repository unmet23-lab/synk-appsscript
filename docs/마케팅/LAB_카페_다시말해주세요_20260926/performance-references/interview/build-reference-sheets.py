from pathlib import Path
import subprocess,json
from PIL import Image,ImageDraw,ImageFont
p=Path(r'C:\Users\q1212\Documents\SYNK-appsscript\docs\마케팅\LAB_카페_다시말해주세요_20260926\performance-references\interview')
ff=Path(r'C:\Users\q1212\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe')
src=Path(r'C:\Users\q1212\Videos\SYNK_Premium_Interview_20260925\revision9\render\SYNK_Founder_Film_1080p_v9.mp4')
font=ImageFont.truetype(r'C:\Windows\Fonts\arial.ttf',20)
files=sorted((p/'survey-frames').glob('*.jpg'))
for page,start in enumerate(range(0,len(files),20),1):
    sheet=Image.new('RGB',(1920,1500),(20,20,20));d=ImageDraw.Draw(sheet)
    for j,f in enumerate(files[start:start+20]):
        t=(start+j)*4;im=Image.open(f);x=(j%4)*480;y=(j//4)*300
        sheet.paste(im,(x,y));d.text((x+8,y+272),f'{start+j+1:03d} | {t//60:02d}:{t%60:02d}.00',font=font,fill='white')
    sheet.save(p/f'survey-{page:02d}.jpg',quality=94)
ranges=[('candidate-A',14,12,(240,50,960,850)),('candidate-B',94,14,(930,80,1770,920)),('candidate-C',218,10,(240,40,960,840)),('candidate-D',34,12,(690,30,1410,830))]
for label,start,duration,crop in ranges:
    folder=p/label;folder.mkdir(exist_ok=True)
    subprocess.run([str(ff),'-hide_banner','-loglevel','error','-ss',str(start),'-i',str(src),'-t',str(duration),'-vf','select=not(mod(n\\,30))','-fps_mode','vfr','-q:v','3','-y',str(folder/'%03d.jpg')],check=True)
    frames=sorted(folder.glob('*.jpg'))
    for page,offset in enumerate(range(0,len(frames),20),1):
        group=frames[offset:offset+20];rows=(len(group)+4)//5
        sheet=Image.new('RGB',(1800,rows*430),(20,20,20));d=ImageDraw.Draw(sheet)
        for j,f in enumerate(group):
            t=start+(offset+j)*.5;im=Image.open(f).crop(crop);im.thumbnail((360,400))
            x=(j%5)*360;y=(j//5)*430;sheet.paste(im,(x,y));d.text((x+8,y+401),f'{int(t)//60:02d}:{t%60:05.2f}',font=font,fill='white')
        sheet.save(p/f'{label}-detail-{page:02d}.jpg',quality=94)
print('saved full survey and exact half-second candidate sheets')
