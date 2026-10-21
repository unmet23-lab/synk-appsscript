"""Four-second original-performance proof. Only alpha and background change."""
from pathlib import Path
import argparse, json, subprocess, time, shutil
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent
MARKETING = OUT.parents[2]
SOURCE = MARKETING/'LAB_카페_다시말해주세요_20260926/performance-references/upload-ready/yuho-genuine-smile-under10s-compatible.mp4'
MODEL = Path(r'C:\Users\q1212\.rembg\models\isnet-general-use\isnet-general-use.onnx')
FFMPEG = Path(shutil.which('ffmpeg') or 'ffmpeg')
FPS, COUNT = 24, 96
FACE = (285,270,175,240)
CROP = (64,0,608,1080)
BG_CROP = (530,0,608,1080)
cv2.setNumThreads(2)

def init_session():
    opts=ort.SessionOptions()
    opts.intra_op_num_threads=4
    opts.inter_op_num_threads=1
    return ort.InferenceSession(str(MODEL),sess_options=opts,providers=['CPUExecutionProvider'])

def alpha_for(rgb, session):
    ar=np.asarray(Image.fromarray(rgb).resize((1024,1024),Image.Resampling.LANCZOS)).astype(np.float32)
    ar=ar/max(float(ar.max()),1e-6)-.5
    pred=session.run(['output_image'],{'input_image':ar.transpose(2,0,1)[None]})[0][0,0]
    pred=(pred-pred.min())/max(float(pred.max()-pred.min()),1e-6)
    alpha=cv2.resize(pred,(1920,1080),interpolation=cv2.INTER_LINEAR)
    alpha=cv2.erode(alpha,np.ones((3,3),np.uint8),iterations=1)
    alpha=cv2.GaussianBlur(alpha,(0,0),.6)
    alpha[alpha>=.93]=1.0
    alpha[alpha<=.035]=0.0
    return np.clip(alpha,0,1)

def backdrop():
    rgb=np.asarray(Image.open(OUT/'pulse-empty-plate.png').convert('RGB'))
    rgb=cv2.resize(rgb,(1920,1080),interpolation=cv2.INTER_LANCZOS4)
    rgb=cv2.GaussianBlur(rgb,(0,0),2.3).astype(np.float32)
    gray=cv2.cvtColor(rgb.astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)[...,None]
    rgb=(gray+(rgb-gray)*.76)*.82+10
    return np.clip(rgb,0,255).astype(np.uint8)

def mix(rgb, alpha, bg):
    return np.rint(rgb.astype(np.float32)*alpha[...,None]+bg.astype(np.float32)*(1-alpha[...,None])).astype(np.uint8)

def writer(name,width,height):
    log=open(OUT/(name+'.encode.log'),'w',encoding='utf-8')
    args=[str(FFMPEG),'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r',str(FPS),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','15','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-frames:v',str(COUNT),'-movflags','+faststart',str(OUT/name)]
    return subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log),log

def make_sample(i,rgb,alpha,full,portrait):
    Image.fromarray(rgb).save(OUT/f'source-{i:03}.png')
    Image.fromarray(full).save(OUT/f'composite-{i:03}.png')
    Image.fromarray(np.rint(alpha*255).astype(np.uint8)).save(OUT/f'alpha-{i:03}.png')
    Image.fromarray(portrait).save(OUT/f'portrait-{i:03}.png')
    sheet=Image.new('RGB',(1280,390),'#141414')
    d=ImageDraw.Draw(sheet)
    for j,(label,im) in enumerate([('ORIGINAL PERFORMANCE',rgb),('BACKGROUND COMPOSITE',full)]):
        sheet.paste(Image.fromarray(im).resize((640,360),Image.Resampling.LANCZOS),(j*640,30))
        d.text((j*640+12,8),label+' | '+f'{i/FPS:.3f}s',fill='white')
    sheet.save(OUT/f'compare-{i:03}.jpg',quality=95)

def main(preflight):
    if not SOURCE.exists(): raise RuntimeError(str(SOURCE))
    cap=cv2.VideoCapture(str(SOURCE)); source_fps=cap.get(cv2.CAP_PROP_FPS)
    session=init_session(); bg=backdrop()
    Image.fromarray(bg).save(OUT/'background-adapted.png')
    x,y,w,h=BG_CROP; bg_portrait=bg[y:y+h,x:x+w]
    Image.fromarray(bg_portrait).save(OUT/'background-portrait.png')
    streams=[]; stats=[]; source_index=-1; current=None; started=time.perf_counter()
    if not preflight:
        streams=[writer('source-master.mp4',1920,1080),writer('composite-master.mp4',1920,1080),writer('portrait-480p.mp4',480,854),writer('source-portrait-480p.mp4',480,854)]
    try:
        for i in range(1 if preflight else COUNT):
            desired=round(i/FPS*source_fps)
            while source_index<desired:
                ok,bgr=cap.read()
                if not ok: raise RuntimeError(f'Source ended at {desired}')
                current=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB); source_index+=1
            rgb=current
            alpha=alpha_for(rgb,session)
            full=mix(rgb,alpha,bg)
            x,y,w,h=CROP
            foreground=rgb[y:y+h,x:x+w]; small_alpha=alpha[y:y+h,x:x+w]
            portrait=mix(foreground,small_alpha,bg_portrait)
            opaque=alpha==1
            delta=int(np.abs(full.astype(np.int16)-rgb.astype(np.int16))[opaque].max())
            fx,fy,fw,fh=FACE
            face_alpha=float(alpha[fy:fy+fh,fx:fx+fw].min())
            stats.append({'frame':i,'source_index':source_index,'source_time_seconds':source_index/source_fps,'opaque_rgb_max_delta':delta,'central_face_alpha_min':face_alpha})
            if i in [0,24,48,72,95]: make_sample(i,rgb,alpha,full,portrait)
            if streams:
                outputs=[rgb,full,cv2.resize(portrait,(480,854),interpolation=cv2.INTER_AREA),cv2.resize(foreground,(480,854),interpolation=cv2.INTER_AREA)]
                for ((proc,_),arr) in zip(streams,outputs): proc.stdin.write(arr.tobytes())
            if i%12==0 or i==COUNT-1:
                progress={'frame':i+1,'total':1 if preflight else COUNT,'elapsed_seconds':round(time.perf_counter()-started,1),'opaque_rgb_delta':delta,'central_face_alpha_min':face_alpha}
                (OUT/'progress.json').write_text(json.dumps(progress,indent=2),encoding='utf-8')
                print(json.dumps(progress),flush=True)
    finally:
        cap.release()
        for proc,log in streams:
            proc.stdin.close(); proc.wait(); log.close()
            if proc.returncode: raise RuntimeError(f'Encode error {proc.returncode}')
    report={'status':'preflight' if preflight else 'rendered_pending_independent_verification','source':str(SOURCE),'source_original_fps':source_fps,'output_fps':FPS,'duration_seconds':4 if not preflight else 1/FPS,'frame_count':len(stats),'foreground_processing':'Source RGB unchanged, no face generation, color grading, relighting, warping or motion interpolation. Frame sampling at original time for 24fps output. Crop/resize only for portrait.','matte_processing':'ISNet cached ONNX; 1px erosion then sigma0.6 feather; opaque threshold0.93; no temporal averaging.','background':'Built-in image_gen empty PULSE plate; background alone saturation0.76 brightness0.82+10 blur2.3. Generated lettering is uppercase and not final brand approved.','audio':'Deliberately silent expression and matte review; source audio untouched in original file.','portrait_source_crop_xywh':CROP,'portrait_background_crop_xywh':BG_CROP,'all_opaque_rgb_deltas_zero':all(s['opaque_rgb_max_delta']==0 for s in stats),'central_face_all_opaque':all(s['central_face_alpha_min']==1.0 for s in stats),'source_cost_credits':0,'higgsfield_credits_spent':0,'source_plate_notes':'One built-in generated background; no Higgsfield generation or external person upload. No claim that all model usage is universally free.','elapsed_seconds':round(time.perf_counter()-started,2),'frames':stats}
    (OUT/('preflight.json' if preflight else 'render-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['frames','source']},ensure_ascii=True),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--preflight',action='store_true')
    main(p.parse_args().preflight)
