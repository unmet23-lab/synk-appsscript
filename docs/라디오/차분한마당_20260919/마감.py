"""Calm forward loop: fixed environment, original character performance, half speed."""
from pathlib import Path
import cv2, numpy as np, subprocess, json, hashlib, time
P=Path(__file__).resolve().parent
C=Path('C:/Users/q1212/.cache/synk-media/radio-calm-20260919')
I,O=C/'input',C/'output'
I.mkdir(parents=True,exist_ok=True);O.mkdir(parents=True,exist_ok=True)
v=cv2.VideoCapture(str(P/'H3_쉬는마당_원본.mp4'));frames=[]
while True:
    ok,f=v.read()
    if not ok:break
    frames.append(f)
assert len(frames)==247
h,w=frames[0].shape[:2];base=frames[96]
mask=np.zeros((h,w),np.uint8)
polys=[[(548,408),(552,370),(580,335),(630,320),(692,325),(735,359),(750,410),(742,476),(750,522),(737,568),(566,568),(560,508)],
       [(751,558),(759,510),(775,442),(790,401),(823,376),(882,370),(927,386),(947,421),(961,484),(979,559)],
       [(973,566),(964,510),(941,453),(966,420),(978,374),(996,338),(1032,333),(1060,349),(1110,330),(1145,365),(1164,425),(1185,447),(1179,488),(1213,452),(1240,467),(1234,528),(1204,557),(1150,564)]]
for pts in polys:cv2.fillPoly(mask,[np.array(pts,np.int32)],255)
mask=cv2.dilate(mask,np.ones((7,7),np.uint8));mask=cv2.GaussianBlur(mask,(15,15),3)
alpha=mask[:,:,None].astype(np.float32)/255
bg=mask==0
eccmask=np.uint8(bg)*255
g=cv2.cvtColor(base,cv2.COLOR_BGR2GRAY)
stable=[];transforms=[]
for n,f in enumerate(frames[:224]):
    cc,m=cv2.findTransformECC(g,cv2.cvtColor(f,cv2.COLOR_BGR2GRAY),np.eye(2,3,dtype=np.float32),cv2.MOTION_EUCLIDEAN,(cv2.TERM_CRITERIA_COUNT|cv2.TERM_CRITERIA_EPS,35,.0001),eccmask,3)
    z=cv2.warpAffine(f,m,(w,h),flags=cv2.INTER_CUBIC|cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_REFLECT_101)
    # A single channel offset removes generated exposure drift without changing character contrast.
    delta=np.median(base[bg].astype(float)-z[bg].astype(float),axis=0)
    z=np.clip(z.astype(float)+delta,0,255)
    stable.append(np.uint8(np.clip(z*alpha+base*(1-alpha),0,255)))
    transforms.append(m.tolist())
dis=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
yy,xx=np.mgrid[:h,:w].astype(np.float32)
def bridge(a,b,t):
    ag=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY);bg2=cv2.cvtColor(b,cv2.COLOR_BGR2GRAY)
    ab=dis.calc(ag,bg2,None);ba=dis.calc(bg2,ag,None)
    aa=cv2.remap(a,xx-t*ab[:,:,0],yy-t*ab[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
    bb=cv2.remap(b,xx-(1-t)*ba[:,:,0],yy-(1-t)*ba[:,:,1],cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
    out=cv2.addWeighted(aa,1-t,bb,t,0);out[bg]=base[bg]
    return out
result=[]
for j,i in enumerate(range(32,224)):
    f=stable[i]
    if i>=192:
        k=i-192;t=k/31;t=t*t*(3-2*t)
        f=bridge(f,stable[k],t)
    assert np.array_equal(f[bg],base[bg])
    cv2.imencode('.png',f)[1].tofile(str(I/f'{j+1:06d}.png'))
    result.append(f)
print('Prepared 192 frames; fixed background pixels verified.',flush=True)
def encode(inp,out,width,height,fps=24):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(fps),'-i',str(inp/'%06d.png'),'-an','-vf',f'scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,crop={width}:{height}','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],check=True)
encode(I,P/'세친구_차분한루프_검수.mp4',1280,720)
ex=Path('C:/Users/q1212/.cache/synk-media/realesrgan-ncnn-v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows/realesrgan-ncnn-vulkan.exe')
with (C/'upscale.log').open('w') as log:
    subprocess.run([str(ex),'-i',str(I),'-o',str(O),'-m','C:/Users/q1212/.cache/synk-media/realesrgan-general/models','-n','realesrgan-x4plus','-s','4','-t','256','-j','1:2:2','-f','png'],stdout=log,stderr=subprocess.STDOUT,check=True)
assert len(list(O.glob('*.png')))==192
print('Upscale complete; encoding 4K archive.',flush=True)
encode(O,P/'세친구_차분한루프_4K.mp4',3840,2160)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-stream_loop','8','-i',str(P/'세친구_차분한루프_4K.mp4'),'-an','-vf','scale=1280:720:flags=lanczos,fps=12','-t','72','-c:v','libx264','-preset','slow','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(P/'세친구_차분한마당_송출72초.mp4')],check=True)
report={'frames':192,'fps':24,'loopSeconds':8,'sourceFPS':48,'native4K':False,'upscale':'Real-ESRGAN general-x4v3','fixedBackgroundPixels':int(np.sum(bg)),'totalPixels':w*h,'sourceFrames':'32..223; final 32 frames bridge to 0..31','backgroundPixelEquality':True,'sourceSha256':hashlib.sha256((P/'H3_쉬는마당_원본.mp4').read_bytes()).hexdigest()}
(P/'마감결과.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)
