from pathlib import Path
import json,subprocess,io
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from build_question_cards import ROOT,CARDS,frame,W,H,MAIN,LABEL,MAIN_SIZE,LABEL_SIZE,LABEL_Y

def decode(card,f,filter_tail,pixfmt=None):
    vf=f'trim=start_frame={f%60}:end_frame={f%60+1},setpts=PTS-STARTPTS,'+filter_tail
    cmd=['ffmpeg','-v','error','-threads','1','-ss',str(f//60),'-i',card['output'],'-frames:v','1','-filter_threads','1','-vf',vf,'-fps_mode','passthrough']
    cmd+=['-pix_fmt',pixfmt,'-f','rawvideo','pipe:1'] if pixfmt else ['-f','image2pipe','-vcodec','png','-threads','1','pipe:1']
    return subprocess.run(cmd,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stdout

sheet=Image.new('RGB',(1920,1160),'#171717');draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype(str(ROOT.parents[1]/'graphics'/'fonts'/'SUIT-Medium.otf'),28)
report=[]
for i,card in enumerate(CARDS):
    raw=decode(card,120,'scale=960:540')
    pic=Image.open(io.BytesIO(raw)).convert('RGB');x=i%2*960;y=i//2*580
    sheet.paste(pic,(x,y+40));draw.text((x+20,y+4),f'Q{i+1} 실제 HEVC 출력 / 2.00초',font=font,fill='white')
    black=[]
    for f in [0,120,209]:
        data=decode(card,f,'crop=64:64:0:0,format=yuv420p10le','yuv420p10le')
        yplane=np.frombuffer(data,dtype='<u2',count=64*64)
        black.append({'frame':f,'corner_min_y_10bit':int(yplane.min()),'corner_max_y_10bit':int(yplane.max())})
        assert int(yplane.min())==64 and int(yplane.max())==64
    assert np.asarray(frame(card,0)).max()==0 and np.asarray(frame(card,209)).max()==0
    bbox=frame(card,120).getbbox()
    report.append({'id':card['id'],'decoded_black_background':black,'source_first_last_frames_fully_black':True,'final_visible_bounds':bbox,'main_font_size':MAIN_SIZE,'label_font_size':LABEL_SIZE,'typing_times_fixed':True})
sheet.save(ROOT/'question_cards_decoded_contact.jpg',quality=97,subsampling=0)
(ROOT/'question_cards_pixel_validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
