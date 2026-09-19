"""Deterministic eyes-only scene with one distant kite. No camera or body motion."""
from pathlib import Path
import math,json,sys,subprocess,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
P=Path(__file__).resolve().parent
DURATION=60
BLINKS=[6.3,18.1,32.8,46.7,57.0]
LENSES=[12.9,38.2,52.1]
def pulse(t,events,width):
 d=min(abs(t-e) for e in events)
 if d<=.045:return 1
 return math.cos((d-.045)/(width-.045)*math.pi/2)**2 if d<width else 0
class Scene:
 def __init__(self,w):
  self.w=w;self.h=w*9//16;self.s=w/1667;self.crop=(round(944*3840/1667)-2160)//2*w/3840
  self.base=Image.open(P/'해질녘_정지마당_4K.png').convert('RGB').resize((w,self.h),Image.Resampling.LANCZOS)
  self.closed=Image.open(P/'해질녘_눈감음_4K.png').convert('RGB').resize((w,self.h),Image.Resampling.LANCZOS)
  self.eye_box=(round(1203*self.s),round(490*self.s-self.crop),round(1312*self.s),round(543*self.s-self.crop))
  self.openpatch=self.base.crop(self.eye_box);self.closepatch=self.closed.crop(self.eye_box)
  self.open_eye=np.array(self.openpatch);self.closed_eye=np.array(self.closepatch)
  ey,ex=np.mgrid[:self.open_eye.shape[0],:self.open_eye.shape[1]];ex=ex+self.eye_box[0];ey=ey+self.eye_box[1]
  self.eye_vertical=np.zeros(ex.shape,float)
  for cx,cy,rx,ry in [(1223,514,15,19),(1287,519,19,19)]:
   region=np.abs(ex-cx*self.s)<(rx+3)*self.s
   self.eye_vertical[region]=np.abs((ey[region]-(cy*self.s-self.crop))/(ry*self.s))
  self.lens_box=(round(773*self.s),round(474*self.s-self.crop),round(888*self.s),round(549*self.s-self.crop))
  self.lens=np.array(self.base.crop(self.lens_box));rgb=self.lens.astype(float)
  # Yellow material only; navy rim and all surrounding felt remain unchanged.
  color=(rgb[:,:,0]>110)&(rgb[:,:,1]>75)&(rgb[:,:,0]>rgb[:,:,2]*1.6)&(rgb[:,:,1]>rgb[:,:,2]*1.4)
  yy,xx=np.mgrid[:rgb.shape[0],:rgb.shape[1]];xx+=self.lens_box[0];yy+=self.lens_box[1]
  contour=np.zeros(color.shape,bool)
  for x,y,rx,ry in [(802,516,24,28),(868,505,15,27)]:contour|=((xx-x*self.s)/(rx*self.s))**2+((yy-(y*self.s-self.crop))/(ry*self.s))**2<1
  self.lensmask=color&contour
  k=Image.open(P/'연_생성참조.png').convert('RGBA');a=np.array(k);a[a[:,:,3]<8]=0
  self.kite=Image.fromarray(a).resize((round(1024*.075*self.s),round(1536*.075*self.s)),Image.Resampling.LANCZOS)
  self.allowed=Image.new('L',(w,self.h));draw=ImageDraw.Draw(self.allowed)
  draw.rectangle(self.eye_box,fill=255);draw.rectangle(self.lens_box,fill=255)
  draw.rectangle((round(1030*self.s),round(92*self.s-self.crop),round(1190*self.s),round(383*self.s-self.crop)),fill=255)
 def frame(self,t):
  t=t%DURATION;im=self.base.copy();b=pulse(t,BLINKS,.19)
  if b>0:
   # Opaque upper/lower lids cover a shrinking aperture; pupils never dissolve.
   if b>=.999:patch=self.closepatch
   else:
    lid=np.clip((self.eye_vertical-(1-b))*19*self.s+.5,0,1)[:,:,None]
    patch=Image.fromarray(np.rint(self.open_eye*(1-lid)+self.closed_eye*lid).astype(np.uint8))
   im.paste(patch,self.eye_box[:2])
  q=pulse(t,LENSES,.3)
  if q>0:
   a=self.lens.copy();a[self.lensmask]=np.rint(a[self.lensmask]*(1-.18*q)).astype(np.uint8);im.paste(Image.fromarray(a),self.lens_box[:2])
  phase=2*math.pi*t/60;dx=5*math.sin(phase)+1.8*math.sin(phase*2);dy=2.2*math.sin(phase*2+.4)
  anchor=((1090+dx)*self.s,(141+dy)*self.s-self.crop)
  angle=2.2*math.sin(phase+.3)
  k=self.kite.rotate(angle,Image.Resampling.BICUBIC,expand=False,center=(self.kite.width*517/1024,self.kite.height*335/1536))
  # Cloth tail displacement begins below its tied attachment and stays connected.
  a=np.array(k);start=round(750*.075*self.s)
  for y in range(start,a.shape[0]):
   weight=(y-start)/max(1,a.shape[0]-start);shift=round(1.5*self.s*weight*math.sin(phase*3-weight*1.5));a[y]=np.roll(a[y],shift,axis=0)
  k=Image.fromarray(a)
  layer=Image.new('RGBA',im.size);draw=ImageDraw.Draw(layer)
  end=(1164*self.s,380*self.s-self.crop);control=(1120*self.s+dx*self.s*.5,258*self.s-self.crop)
  points=[]
  for u in np.linspace(0,1,81):points.append(((1-u)**2*anchor[0]+2*(1-u)*u*control[0]+u*u*end[0],(1-u)**2*anchor[1]+2*(1-u)*u*control[1]+u*u*end[1]))
  draw.line(points,fill=(235,211,171,105),width=max(1,round(.45*self.s)))
  layer.alpha_composite(k,(round(anchor[0]-self.kite.width*517/1024),round(anchor[1]-self.kite.height*335/1536)))
  im=Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')
  return im
def qa():
 scene=Scene(3840);base=np.array(scene.base);allowed=np.array(scene.allowed)>0;maxoutside=0
 for t in [0,6.11,6.2,6.3,6.4,6.49,12.9,18.1,30,38.2,59.958333,60]:
  f=scene.frame(t);a=np.array(f);maxoutside=max(maxoutside,int(np.any(a[~allowed]!=base[~allowed],axis=1).sum()))
  if t in [0,6.3,12.9]:f.save(P/('검토_'+str(t)+'.png'))
 assert maxoutside==0
 assert np.array_equal(np.array(scene.frame(0)),np.array(scene.frame(60)))
 scene.frame(0).save(P/'최종정지컷.png');scene.allowed.save(P/'움직임_허용영역.png')
 grid=Image.new('RGB',(1440,810))
 for i,t in enumerate([0,6.2,6.3,6.4,12.9,30]):grid.paste(scene.frame(t).resize((480,270)),((i%3)*480,(i//3)*405))
 grid.save(P/'시간별_검토.jpg',quality=95)
 report={'outsideAllowedChangedPixels':maxoutside,'t0EqualsT60':True,'duration':60,'blinkTimes':BLINKS,'lensResponseTimes':LENSES,'cameraMotion':False,'bodyMotion':False,'marinSkinEyelids':False,'kiteCount':1,'native4K':False}
 (P/'합성검수.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report),flush=True)
def render(w,fps,name):
 scene=Scene(w);dest=P/name;log=P/(name+'.log')
 with log.open('w') as f:
  p=subprocess.Popen(['ffmpeg','-hide_banner','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{scene.h}','-r',str(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','18' if w==3840 else '19','-threads','8','-pix_fmt','yuv420p','-movflags','+faststart','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',str(dest)],stdin=subprocess.PIPE,stdout=f,stderr=f)
  for i in range(DURATION*fps):
   p.stdin.write(scene.frame(i/fps).tobytes())
   if i%(fps*10)==0:print(name,i//fps,flush=True)
  p.stdin.close();assert p.wait()==0
 print('done',name,hashlib.sha256(dest.read_bytes()).hexdigest(),flush=True)
if __name__=='__main__':
 mode=sys.argv[1] if len(sys.argv)>1 else 'qa'
 if mode=='qa':qa()
 elif mode=='broadcast':render(1280,12,'해질녘_연_눈깜빡임_720p.mp4')
 elif mode=='master':render(3840,24,'해질녘_연_눈깜빡임_4K.mp4')
