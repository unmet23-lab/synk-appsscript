"""기존 Resolve 타임라인용 검정 질문 카드. 음성/음악/알파 오버레이 없음."""
from pathlib import Path
import json,subprocess,sys,io,math
from PIL import Image,ImageDraw,ImageFont
import numpy as np

ROOT=Path(__file__).resolve().parent;R=ROOT.parents[1]
FONT=R/'graphics'/'fonts'/'SUIT-SemiBold.otf'
LABEL_FONT=R/'graphics'/'fonts'/'SUIT-Medium.otf'
W,H,FPS,FRAMES=3840,2160,60,210
MAIN_SIZE=128;LABEL_SIZE=60;LINE_HEIGHT=192
MAIN_Y=963;LABEL_Y=850
INK=238;LABEL_INK=174
TYPING_FIRST,TYPING_LAST=12,90
FADE_START,FADE_LAST=198,209
TEXTS=[
 ('왜 이 시스템을 만들기 시작했나요?',['왜 이 시스템을','만들기 시작했나요?']),
 ('왜 TOPIK 4급이 중요한가요?',['왜 TOPIK 4급이','중요한가요?']),
 ('AI 시대, 어떤 교육 철학이 필요한가요?',['AI 시대, 어떤 교육 철학이','필요한가요?']),
 ('기술이 만든 시간을 어떻게 쓰고 싶나요?',['기술이 만든 시간을','어떻게 쓰고 싶나요?']),
]
MAIN=ImageFont.truetype(str(FONT),MAIN_SIZE)
LABEL=ImageFont.truetype(str(LABEL_FONT),LABEL_SIZE)

def make_card(number,text,lines):
    width=max(MAIN.getlength(line) for line in lines)
    x=round((W-width)/2)
    units=[]
    for row,line in enumerate(lines):
        for i,ch in enumerate(line):
            units.append({'char':ch,'line':row,'x':round(x+MAIN.getlength(line[:i]),4),'y':MAIN_Y+row*LINE_HEIGHT,'visible':not ch.isspace()})
        if row<len(lines)-1:units.append({'char':'\n','line':row,'visible':False})
    # A Unicode Hangul syllable is always a complete unit; no decomposed jamo.
    weights=[.45 if not u['visible'] else (.65 if ord(u['char'])<128 else 1.) for u in units]
    prefix=[0.]
    for weight in weights[:-1]:prefix.append(prefix[-1]+weight)
    denom=prefix[-1]
    for u,p in zip(units,prefix):
        u['frame']=TYPING_FIRST+round((TYPING_LAST-TYPING_FIRST)*p/denom)
        u['time_seconds']=u['frame']/FPS
    visible=[u for u in units if u['visible']]
    indices=sorted(set(round(i*(len(visible)-1)/15) for i in range(16)))
    strokes=[{'index':j+1,'frame':visible[i]['frame'],'time_seconds':visible[i]['frame']/FPS,'revealed_unit':visible[i]['char']} for j,i in enumerate(indices)]
    return {'id':f'question_{number:02}','question':text,'lines':lines,'output':str(ROOT/f'question_{number:02}_4K60.mov'),'width':W,'height':H,'fps':FPS,'frames':FRAMES,'duration_seconds':FRAMES/FPS,'text_block_x':x,'text_block_max_width':round(width,4),'main_first_line_y':MAIN_Y,'main_line_height':LINE_HEIGHT,'label_x':x,'label_y':LABEL_Y,'typing_units':units,'keystrokes':strokes}

CARDS=[make_card(i+1,*item) for i,item in enumerate(TEXTS)]

def frame(card,f):
    pic=Image.new('L',(W,H),0);draw=ImageDraw.Draw(pic)
    fade=1 if f<FADE_START else max(0,(FADE_LAST-f)/(FADE_LAST-FADE_START))
    # Small label precedes typing with a brief soft appearance.
    label_fade=min(1,max(0,(f-3)/6))*fade
    if label_fade:draw.text((card['label_x'],LABEL_Y+LABEL.getmetrics()[0]),'Q.',font=LABEL,fill=round(LABEL_INK*label_fade),anchor='ls')
    for u in card['typing_units']:
        if not u['visible'] or f<u['frame']:continue
        strength=(1 if u['frame']==TYPING_LAST else min(1,(f-u['frame']+1)/2))*fade
        draw.text((u['x'],u['y']+MAIN.getmetrics()[0]),u['char'],font=MAIN,fill=round(INK*strength),anchor='ls')
    return pic

def preview():
    manifest={'version':1,'scope':'질문 카드 로컬 시간. 이 파일에는 사운드가 없으며 keystrokes를 오디오 제작에 사용한다.','main_font':str(FONT),'label_font':str(LABEL_FONT),'main_size_px_at_4K':MAIN_SIZE,'label_size_px_at_4K':LABEL_SIZE,'background':'opaque black RGB 0,0,0','text_color':'neutral off-white RGB 238,238,238','label_color':'RGB 174,174,174','typing_start_frame':TYPING_FIRST,'typing_last_unit_frame':TYPING_LAST,'typing_last_unit_full_opacity_frame':TYPING_LAST,'fade_out_start_frame':FADE_START,'last_frame_black':FADE_LAST,'cards':CARDS}
    (ROOT/'question_typing_events.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    contact=Image.new('RGB',(1920,4*590),'#171717');draw=ImageDraw.Draw(contact)
    caption=ImageFont.truetype(str(LABEL_FONT),28)
    for row,card in enumerate(CARDS):
        for col,f in enumerate([60,120]):
            pic=frame(card,f).resize((960,540),Image.Resampling.LANCZOS).convert('RGB')
            contact.paste(pic,(col*960,row*590+50))
            draw.text((col*960+22,row*590+8),f"Q{row+1} · {'1.00초 입력 중' if f==60 else '2.00초 완성 문구'}",font=caption,fill='white')
    contact.save(ROOT/'question_cards_preview.png')
    print('PREVIEW',ROOT/'question_cards_preview.png',flush=True)

def render():
    validations=[]
    for card in CARDS:
        dest=Path(card['output'])
        if dest.exists():raise FileExistsError(dest)
        cmd=['ffmpeg','-hide_banner','-loglevel','error','-n','-f','rawvideo','-pixel_format','gray','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-an','-filter_threads','2','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=p010le','-c:v','hevc_qsv','-global_quality','16','-preset','medium','-profile:v','main10','-r',str(FPS),'-frames:v',str(FRAMES),'-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-tag:v','hvc1',str(dest)]
        with (ROOT/(card['id']+'_render.log')).open('wb') as log:
            enc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log)
            try:
                for f in range(FRAMES):enc.stdin.write(frame(card,f).tobytes())
                enc.stdin.close()
                if enc.wait(timeout=90):raise RuntimeError(f'{card["id"]} encode failed')
            except BaseException:
                enc.kill();enc.wait();raise
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(dest)],stdin=subprocess.DEVNULL,stderr=subprocess.PIPE))
        s=probe['streams'][0]
        assert (s['width'],s['height'],s['r_frame_rate'],s['pix_fmt'],int(s['nb_frames']))==(W,H,'60/1','yuv420p10le',FRAMES)
        assert len(probe['streams'])==1
        dec=subprocess.run(['ffmpeg','-v','error','-xerror','-threads','2','-i',str(dest),'-f','null','-'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        if dec.returncode or dec.stderr:raise RuntimeError(dec.stderr.decode(errors='replace'))
        item={'id':card['id'],'path':str(dest),'frames':int(s['nb_frames']),'duration':float(probe['format']['duration']),'codec':s['codec_name'],'profile':s.get('profile'),'pix_fmt':s['pix_fmt'],'file_size':dest.stat().st_size,'full_decode':'pass','opaque_background':True}
        validations.append(item);print(json.dumps(item),flush=True)
    (ROOT/'question_cards_validation.json').write_text(json.dumps(validations,indent=2),encoding='utf-8')

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='render':render()
    else:preview()
