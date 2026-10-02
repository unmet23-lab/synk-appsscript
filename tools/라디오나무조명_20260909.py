"""Freeze the whole persimmon tree in the approved video; modulate window light only.

No generated imagery, warp, optical flow, synthetic camera movement or audio edits.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/_ops/라디오생동_20260909/v4'
SOURCE = ROOT / 'docs/_ops/라디오생동_20260909/v3/생성_A_15초.mp4'
TARGET = ROOT / 'docs/라디오/무대영상/추석_나무고정_조명_20260909.mp4'
FPS, W, H, SECONDS = 30, 1280, 720, 60
TREE = [(1196,88),(1279,88),(1279,468),(1074,468),(1074,240),(1117,215),(1127,148),(1196,148)]
LEFT = [[(204,322),(233,322),(233,401),(204,401)],
        [(239,322),(267,322),(267,400),(239,400)],
        [(342,322),(370,322),(370,401),(342,401)],
        [(377,322),(406,322),(406,402),(377,402)],
        [(445,305),(461,308),(461,349),(445,348)]]
RIGHT = [[(1118,331),(1131,333),(1131,410),(1118,407)],
         [(1193,333),(1206,331),(1206,420),(1193,418)],
         [(1209,332),(1219,333),(1219,420),(1209,420)]]

def sha(p):
    return hashlib.file_digest(open(p, 'rb'), 'sha256').hexdigest()

def polygon_mask(polys, sigma=1.0):
    mask = np.zeros((H,W), np.float32)
    for poly in polys:
        cv2.fillPoly(mask, [np.array(poly,np.int32)], 1)
    return cv2.GaussianBlur(mask,(0,0),sigma) if sigma else mask

def smoothstep(u):
    u = min(1.0,max(0.0,u))
    return u*u*u*(u*(u*6-15)+10)

def darkness(t,start,fade_out,hold,fade_in):
    if t < start: return 0.0
    if t < start+fade_out: return smoothstep((t-start)/fade_out)
    if t < start+fade_out+hold: return 1.0
    if t < start+fade_out+hold+fade_in:
        return 1-smoothstep((t-start-fade_out-hold)/fade_in)
    return 0.0

def main():
    cv2.setNumThreads(4)
    OUT.mkdir(parents=True,exist_ok=True)
    assert sha(SOURCE) == 'f647e4bb1e2b33a4f96cdb69d0ce970b14525479ce7f45e23d96f4b562e96c28'
    cap=cv2.VideoCapture(str(SOURCE)); ok, first=cap.read()
    assert ok and first.shape==(H,W,3)
    assert round(cap.get(cv2.CAP_PROP_FRAME_COUNT))==450
    core=polygon_mask([TREE],0)
    tree=cv2.GaussianBlur(cv2.dilate(core,np.ones((5,5),np.uint8)),(0,0),1.3)
    tree[core==1]=1
    tree[:148,:1190]=0  # Keep the approved moving upper-cloud fibres intact.
    left=polygon_mask(LEFT,0.65); right=polygon_mask(RIGHT,0.65)
    # Fully restore the light-emitting interiors from one fixed source frame,
    # including a small margin, so source-model shimmer cannot fight the fades.
    windows=np.maximum(left,right)
    window_restore=cv2.dilate(windows,np.ones((7,7),np.uint8))
    window_restore=cv2.GaussianBlur(window_restore,(0,0),1)
    freeze=np.maximum(tree,window_restore)[:,:,None]
    base=first.astype(np.float32)
    # Modest spill reduction near each window, not a screen-wide exposure pulse.
    spill_left=cv2.GaussianBlur(left,(0,0),10)*0.16
    spill_right=cv2.GaussianBlur(right,(0,0),8)*0.16
    shade_left=np.maximum(left*0.80,spill_left)[:,:,None]
    shade_right=np.maximum(right*0.80,spill_right)[:,:,None]
    temp=OUT/'임시_방송.mp4'
    args=['ffmpeg','-hide_banner','-loglevel','warning','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0',
          '-an','-c:v','libx264','-threads','4','-preset','medium','-crf','17','-pix_fmt','yuv420p','-g','60','-keyint_min','60','-sc_threshold','0','-movflags','+faststart','-y',str(temp)]
    encoder=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    keep={0,300,390,480,630,1020,1110,1260,1799}
    max_cloud_error=0; max_tree_range=0; sample=[]
    try:
        for i in range(FPS*SECONDS):
            if i%450==0:
                cap.set(cv2.CAP_PROP_POS_FRAMES,0)
            ok,frame=cap.read(); assert ok, i
            a=darkness(i/FPS,11,2.2,4.8,3)
            b=darkness(i/FPS,34,2,3,3.5)
            result=frame.copy()
            # Work only on the two houses/tree. The rest remains exact input bytes.
            for y0,y1,x0,x1 in [(270,450,155,500),(65,515,1010,1280)]:
                sl=np.s_[y0:y1,x0:x1]
                composed=frame[sl].astype(np.float32)*(1-freeze[sl])+base[sl]*freeze[sl]
                composed *= (1-a*shade_left[sl])*(1-b*shade_right[sl])
                result[sl]=np.clip(np.rint(composed),0,255).astype(np.uint8)
            max_cloud_error=max(max_cloud_error,int(np.abs(result[65:145,820:1170].astype(np.int16)-frame[65:145,820:1170]).max()))
            max_tree_range=max(max_tree_range,int(np.abs(result[150:300,1195:1270].astype(np.int16)-first[150:300,1195:1270]).max()))
            encoder.stdin.write(result.tobytes())
            if i in keep:
                encoded_ok, png=cv2.imencode('.png',result)
                assert encoded_ok
                png.tofile(str(OUT/f'검수_{i:04d}.png'))
                sample.append({'frame':i,'seconds':i/FPS,'leftOff':a,'rightOff':b})
            if i%300==0: print(f'render {i}/{FPS*SECONDS}',flush=True)
        encoder.stdin.close()
        err=encoder.stderr.read().decode(errors='replace')
        assert encoder.wait(timeout=120)==0,err
    finally:
        cap.release()
        if encoder.poll() is None: encoder.kill()
    TARGET.parent.mkdir(parents=True,exist_ok=True)
    temp.replace(TARGET)
    receipt={'source':str(SOURCE),'sourceSha256':sha(SOURCE),'output':str(TARGET),'sha256':sha(TARGET),'fps':FPS,'seconds':SECONDS,
             'treePolygon':TREE,'leftWindows':LEFT,'rightWindows':RIGHT,'samples':sample,
             'preEncodeCloudROIExactMaxDifference':max_cloud_error,'preEncodeTreeROIExactMaxDifference':max_tree_range,
             'modelUsedForThisEdit':None,'method':'Static video-frame restoration for tree and windows; quintic eased window/spill brightness. Approved cloud frames unchanged outside masks; no resampling/warping or added audio.',
             'leftLight':{'fadeOut':[11,13.2],'off':[13.2,18],'fadeIn':[18,21]},
             'rightLight':{'fadeOut':[34,36],'off':[36,39],'fadeIn':[39,42.5]},'encodeWarnings':err}
    (OUT/'편집제작.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(receipt,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
