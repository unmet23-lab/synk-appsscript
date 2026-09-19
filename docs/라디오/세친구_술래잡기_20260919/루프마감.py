"""Remove the late motion hold and close a forward loop with a short motion-aligned bridge."""
from pathlib import Path
import argparse, subprocess, json, hashlib
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--preview', action='store_true')
args = parser.parse_args()
width, height = (1280, 720) if args.preview else (3840, 2160)
name = '세친구_자연루프_검수.mp4' if args.preview else '세친구_자연루프_4K.mp4'
out = ROOT / name
source = ROOT / 'H3_몽글눈웃음_4K_무음.mp4'
start, end, overlap, fps = 6, 183, 10, 48
cap = cv2.VideoCapture(str(source))
writer = subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-y',
    '-f','rawvideo','-pix_fmt','bgr24','-s',f'{width}x{height}','-r',str(fps),'-i','pipe:0',
    '-an','-c:v','libx264','-preset','medium' if args.preview else 'slow','-crf','16',
    '-pix_fmt','yuv420p','-movflags','+faststart',str(out)], stdin=subprocess.PIPE)
early = {}
grid_y, grid_x = np.mgrid[0:height, 0:width].astype(np.float32)
flow_w, flow_h = 960, 540
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
dis.setUseSpatialPropagation(True)
flow_stats = []

def bridge(a, b, alpha):
    if alpha <= 0: return a
    if alpha >= 1: return b
    ag = cv2.cvtColor(cv2.resize(a,(flow_w,flow_h),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY)
    bg = cv2.cvtColor(cv2.resize(b,(flow_w,flow_h),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY)
    ab = dis.calc(ag,bg,None)
    ba = dis.calc(bg,ag,None)
    flow_stats.append({'alpha':alpha,'forwardP99':float(np.percentile(np.linalg.norm(ab,axis=2),99))})
    ab = cv2.resize(ab,(width,height),interpolation=cv2.INTER_LINEAR)
    ba = cv2.resize(ba,(width,height),interpolation=cv2.INTER_LINEAR)
    ab[:,:,0] *= width/flow_w; ab[:,:,1] *= height/flow_h
    ba[:,:,0] *= width/flow_w; ba[:,:,1] *= height/flow_h
    wa = cv2.remap(a,grid_x-alpha*ab[:,:,0],grid_y-alpha*ab[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
    wb = cv2.remap(b,grid_x-(1-alpha)*ba[:,:,0],grid_y-(1-alpha)*ba[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
    return cv2.addWeighted(wa,1-alpha,wb,alpha,0)

written=0
try:
    for i in range(end+1):
        ok, frame = cap.read()
        if not ok: raise RuntimeError(f'Missing source frame {i}')
        if (width,height)!=(frame.shape[1],frame.shape[0]):
            frame=cv2.resize(frame,(width,height),interpolation=cv2.INTER_AREA)
        if start <= i < start+overlap: early[i]=frame.copy()
        if i < start+overlap: continue
        if i >= end-overlap+1:
            j=i-(end-overlap+1)
            t=j/(overlap-1)
            alpha=t*t*(3-2*t)
            frame=bridge(frame,early[start+j],alpha)
        writer.stdin.write(frame.tobytes())
        written+=1
        if written%48==0: print(f'{name}: {written}/168 frames',flush=True)
finally:
    cap.release()
    writer.stdin.close()
rc=writer.wait()
if rc: raise RuntimeError(f'ffmpeg exited {rc}')
assert written==168
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries',
    'stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration,size','-of','json',str(out)]))
record={'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'file':name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'probe':probe,
    'sourceStartFrame':start,'sourceEndFrame':end,'sourceExcludedFromSeconds':184/48,
    'overlapFrames':overlap,'frames':written,'fps':fps,'cycleSeconds':written/fps,
    'method':'forward playback; 10-frame bidirectional optical-flow alignment with smoothstep blend; no reverse playback',
    'flowStats':flow_stats,'native4K':False,'audio':False}
(ROOT/('루프마감_검수.json' if args.preview else '루프마감_결과.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(record,ensure_ascii=False,indent=2),flush=True)
