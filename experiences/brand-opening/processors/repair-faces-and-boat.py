"""Local video edit: tracked original felt faces, continuous full boat passage.
The source footage remains the verified Vertex Veo clip. No model call is made.
"""
from pathlib import Path
import sys, json, subprocess, hashlib, math
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'.tmp/brand-opening-face-fix/deps'))
import cv2
import numpy as np

SHARED=ROOT/'experiences/brand-opening'
QA=SHARED/'qa/felt-v3'; QA.mkdir(parents=True,exist_ok=True)
CONFIG={
 'portrait':{'source':'world-menu-mobile-veo31-v2.mp4','out':'world-menu-mobile-veo31-v3.mp4',
  'faces':[
   {'name':'mongle','track':(410,1010,710,1310),'patch':(440,1080,665,1270),'center':(551,1173),'axes':(105,94)},
   {'name':'marin','track':(674,969,990,1270),'patch':(680,1060,981,1250),'center':(831,1112),'axes':(153,140)}],
  'boat':(747,886,847,937),'river':[(320,855),(1079,854),(1079,945),(380,958),(300,921)],'start':240,'end':1220},
 'landscape':{'source':'world-menu-desktop-veo31-v2.mp4','out':'world-menu-desktop-veo31-v3.mp4',
  'faces':[
   {'name':'mongle','track':(1207,609,1454,877),'patch':(1227,654,1430,822),'center':(1328,738),'axes':(98,80)},
   {'name':'marin','track':(1425,551,1720,812),'patch':(1427,627,1710,799),'center':(1567,685),'axes':(150,120)}],
  'boat':(724,617,823,675),'river':[(260,585),(1770,584),(1748,681),(422,698),(257,660)],'start':185,'end':2050}
}

def face_setup(ref,gray,spec):
 h,w=gray.shape; track=np.zeros_like(gray)
 x0,y0,x1,y1=spec['track']; track[y0:y1,x0:x1]=255
 # Track surrounding wool, not the hallucinated facial marks themselves.
 px0,py0,px1,py1=spec['patch']; track[py0-8:py1+8,px0-8:px1+8]=0
 pts=cv2.goodFeaturesToTrack(gray,180,.012,6,mask=track,blockSize=5)
 if pts is None or len(pts)<12: raise RuntimeError('Not enough original wool tracking points: '+spec['name'])
 alpha=np.zeros(gray.shape,np.float32)
 cv2.ellipse(alpha,spec['center'],spec['axes'],0,0,360,1,-1)
 # Opaque face interior guarantees that no generated pupil/mouth survives.
 alpha=cv2.GaussianBlur(alpha,(17,17),3); alpha[alpha>.96]=1
 return {'spec':spec,'original':pts.copy(),'points':pts.copy(),'alpha':alpha,'matrix':np.array([[1.,0,0],[0,1.,0]],np.float32),'records':[]}

def apply_face(frame,gray,prev,ref,face):
 pts=face['points']; original=face['original']
 nxt,status,error=cv2.calcOpticalFlowPyrLK(prev,gray,pts,None,winSize=(21,21),maxLevel=3,
  criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,30,.01))
 if nxt is None: raise RuntimeError('Wool tracking failed: '+face['spec']['name'])
 back,bst,_=cv2.calcOpticalFlowPyrLK(gray,prev,nxt,None,winSize=(21,21),maxLevel=3)
 valid=(status.reshape(-1)==1)&(bst.reshape(-1)==1)&(np.linalg.norm(back-pts,axis=2).reshape(-1)<1.8)
 if valid.sum()<8: raise RuntimeError('Insufficient stable face tracking: '+face['spec']['name'])
 matrix,inliers=cv2.estimateAffinePartial2D(original[valid].reshape(-1,2),nxt[valid].reshape(-1,2),method=cv2.RANSAC,ransacReprojThreshold=3,maxIters=2000,confidence=.99)
 if matrix is None: raise RuntimeError('No original-face transform')
 scale=math.hypot(matrix[0,0],matrix[1,0]); angle=math.degrees(math.atan2(matrix[1,0],matrix[0,0]))
 if not .72<scale<1.28 or abs(angle)>44: raise RuntimeError('Unexpected face transform')
 face['matrix']=matrix.astype(np.float32);face['points']=nxt[valid];face['original']=original[valid]
 h,w=gray.shape; alpha=cv2.warpAffine(face['alpha'],face['matrix'],(w,h),flags=cv2.INTER_LINEAR)
 rgb=cv2.warpAffine(ref,face['matrix'],(w,h),flags=cv2.INTER_LINEAR)
 frame[:]=(frame.astype(np.float32)*(1-alpha[:,:,None])+rgb.astype(np.float32)*alpha[:,:,None]).astype(np.uint8)
 face['records'].append({'points':int(valid.sum()),'scale':round(scale,4),'angle':round(angle,3)})

def boat_sprite(ref,box):
 x0,y0,x1,y1=box; sprite=ref[y0:y1,x0:x1].copy(); h,w=sprite.shape[:2]
 alpha=np.zeros((h,w),np.float32)
 # Trace the distant cabin/hull and its warm reflection; avoid a rectangle of water.
 polygon=np.array([(int(w*.10),int(h*.29)),(int(w*.28),int(h*.10)),(int(w*.63),int(h*.10)),(int(w*.74),int(h*.28)),(int(w*.92),int(h*.40)),(int(w*.85),int(h*.67)),(int(w*.24),int(h*.73)),(int(w*.03),int(h*.52))],np.int32)
 cv2.fillPoly(alpha,[polygon],1);alpha=cv2.GaussianBlur(alpha,(7,7),1.2)
 return sprite,alpha

def run(name):
 cfg=CONFIG[name]; source=SHARED/'assets'/cfg['source']; cap=cv2.VideoCapture(str(source))
 fps=round(cap.get(cv2.CAP_PROP_FPS)); ok,ref=cap.read()
 if not ok: raise RuntimeError('Cannot decode the Veo source')
 h,w=ref.shape[:2]; prev=cv2.cvtColor(ref,cv2.COLOR_BGR2GRAY)
 faces=[face_setup(ref,prev,s) for s in cfg['faces']]
 bx0,by0,bx1,by1=cfg['boat']; boatTemplate=ref[by0:by1,bx0:bx1].copy(); boatGray=cv2.cvtColor(boatTemplate,cv2.COLOR_BGR2GRAY)
 boatPos=(bx0,by0); sprite,spriteAlpha=boat_sprite(ref,cfg['boat'])
 encoded=[]; boatScores=[]; index=0
 while ok:
  # Remove the original short-travel boat/wake from each original frame.
  gray=cv2.cvtColor(ref if index==0 else frame,cv2.COLOR_BGR2GRAY)
  frame=(ref if index==0 else frame).copy()
  if index:
   for face in faces: apply_face(frame,gray,prev,ref,face)
  x,y=boatPos; sx0=max(0,x-28);sy0=max(0,y-10);sx1=min(w,x+boatGray.shape[1]+28);sy1=min(h,y+boatGray.shape[0]+10)
  match=cv2.matchTemplate(gray[sy0:sy1,sx0:sx1],boatGray,cv2.TM_CCOEFF_NORMED);_,score,_,loc=cv2.minMaxLoc(match)
  if score>.35: boatPos=(sx0+loc[0],sy0+loc[1])
  boatScores.append(round(float(score),4));x,y=boatPos
  # Adjacent moving water is a cleaner plate than diffusion inpainting, which
  # can pull gold reflections into a visible diamond-shaped smear.
  bh,bw=boatGray.shape;pad=5;rx0=max(0,x-pad);ry0=max(0,y-pad);rx1=min(w,x+bw+pad);ry1=min(h,y+bh+pad)
  rw,rh=rx1-rx0,ry1-ry0;cloneX=max(0,rx0-rw-18)
  clean=frame[ry0:ry1,cloneX:cloneX+rw].copy()
  feather=np.zeros((rh,rw),np.float32);cv2.rectangle(feather,(5,5),(rw-6,rh-6),1,-1);feather=cv2.GaussianBlur(feather,(11,11),2)
  region=frame[ry0:ry1,rx0:rx1]
  frame[ry0:ry1,rx0:rx1]=(region.astype(np.float32)*(1-feather[:,:,None])+clean.astype(np.float32)*feather[:,:,None]).astype(np.uint8)
  success,jpg=cv2.imencode('.jpg',frame,[cv2.IMWRITE_JPEG_QUALITY,96]);
  if not success: raise RuntimeError('Cannot cache an edited frame')
  encoded.append(jpg);prev=gray;index+=1;ok,frame=cap.read()
 cap.release()
 river=np.zeros((h,w),np.float32);cv2.fillPoly(river,[np.array(cfg['river'],np.int32)],1);river=cv2.GaussianBlur(river,(9,9),1.5)
 # Two complete 16-second breathing cycles; their endpoints match. The boat
 # moves independently in one direction for the full 32-second menu period.
 total=fps*32; out=SHARED/'assets'/cfg['out'];
 command=['ffmpeg','-y','-v','error','-f','rawvideo','-pixel_format','bgr24','-video_size',f'{w}x{h}','-framerate',str(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-g',str(fps),'-keyint_min',str(fps),'-movflags','+faststart',str(out)]
 encoder=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
 samples=[];route=[];n=len(encoded)
 for i in range(total):
  phase=i%(2*(n-1)); base=phase if phase<n else 2*(n-1)-phase
  frame=cv2.imdecode(encoded[base],cv2.IMREAD_COLOR)
  t=i/fps; progress=min(1,max(0,(t-1.0)/28.0))
  boatX=int(cfg['start']+(cfg['end']-cfg['start'])*progress);boatY=by0+int(1.4*math.sin(t*1.7))
  sh,sw=sprite.shape[:2];x0=max(0,boatX);x1=min(w,boatX+sw);y0=max(0,boatY);y1=min(h,boatY+sh)
  if x1>x0 and y1>y0:
   alpha=spriteAlpha[y0-boatY:y1-boatY,x0-boatX:x1-boatX]*river[y0:y1,x0:x1]
   src=sprite[y0-boatY:y1-boatY,x0-boatX:x1-boatX]
   frame[y0:y1,x0:x1]=(frame[y0:y1,x0:x1].astype(np.float32)*(1-alpha[:,:,None])+src.astype(np.float32)*alpha[:,:,None]).astype(np.uint8)
  if i in [0,fps*3,fps*6,fps*12,fps*20,fps*27,total-1]:
   shot=QA/f'{name}-{i/fps:.2f}.png';cv2.imwrite(str(shot),frame);samples.append({'time':round(t,3),'file':str(shot.relative_to(SHARED)),'boatX':boatX})
  route.append(boatX);encoder.stdin.write(frame.tobytes())
 encoder.stdin.close();error=encoder.stderr.read().decode('utf8','replace');code=encoder.wait()
 if code: raise RuntimeError(error)
 poster=SHARED/'assets'/f'felt-world-scene-{ "mobile" if name=="portrait" else "desktop" }-v3.webp'
 first=cv2.imdecode(encoded[0],cv2.IMREAD_COLOR);cv2.imwrite(str(poster),first,[cv2.IMWRITE_WEBP_QUALITY,95])
 result={'date':'2026-10-09','variant':name,'source':str(source.relative_to(SHARED)),'output':str(out.relative_to(SHARED)),'sourceModel':'veo-3.1-generate-001','generationCalls':0,'durationSeconds':32,'fps':fps,'originalFacesTracked':True,'faceStats':[{ 'name':f['spec']['name'],'minPoints':min(r['points'] for r in f['records']),'minScale':min(r['scale'] for r in f['records']),'maxScale':max(r['scale'] for r in f['records']),'maxAbsoluteAngle':max(abs(r['angle']) for r in f['records']) } for f in faces],'boatOriginalTrackingMinScore':min(boatScores),'boatRoute':{'start':cfg['start'],'end':cfg['end'],'visibleUntilSeconds':29,'monotonic':all(b>=a for a,b in zip(route,route[1:])),'exitsFrame':route[-1]>w},'samples':samples,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'editNote':'Tracked original face texture overlays; original boat removed, its source sprite completes an independent 28-second one-way passage; background uses forward/return source motion cycles.'}
 (QA/f'{name}-repair.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps({'variant':name,'output':str(out),'duration':32,'faces':result['faceStats'],'boat':result['boatRoute']},ensure_ascii=False),flush=True)

if __name__=='__main__': run(sys.argv[1])
