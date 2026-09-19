from pathlib import Path
import cv2,numpy as np,json,subprocess
from PIL import Image
P=Path(__file__).resolve().parent
cache=Path('C:/Users/q1212/.cache/synk-media/radio-eyes-only-20260919')
base=np.array(Image.open(P/'해질녘_원본.png').convert('RGB')); old=np.array(Image.open(P/'원본.png').convert('RGB')); gen=np.array(Image.open(P/'눈감음_생성참조.png').convert('RGB'))
H,W=base.shape[:2];yy,xx=np.mgrid[:H,:W].astype(np.float32)
eyes=[{'target':[1223,514,15,19],'source':[1228,518,23,25]},{'target':[1287,519,19,19],'source':[1292,523,27,25]}]
closed=base.copy();mask=np.zeros((H,W),np.uint8)
for e in eyes:
 cx,cy,rx,ry=e['target'];sx,sy,srx,sry=e['source']
 patch=cv2.remap(gen,sx+(xx-cx)*srx/rx,sy+(yy-cy)*sry/ry,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101).astype(float)
 # Match the warm light using nearby fur, not the green eyes.
 offset=np.median(base[cy-34:cy-24,cx-10:cx+11].reshape(-1,3),0)-np.median(old[cy-34:cy-24,cx-10:cx+11].reshape(-1,3),0)
 patch=np.clip(patch+np.clip(offset,-25,25),0,255)
 d=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2);a=np.clip((1.015-d)*min(rx,ry),0,1)
 closed=np.rint(closed*(1-a[:,:,None])+patch*a[:,:,None]).astype(np.uint8);mask[a>0]=255
Image.fromarray(closed).save(P/'해질녘_눈감음_원본.png')
assert np.array_equal(base[mask==0],closed[mask==0])
exe='C:/Users/q1212/.cache/synk-media/realesrgan-ncnn-v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows/realesrgan-ncnn-vulkan.exe'
def fit(a,mode=Image.Resampling.LANCZOS):
 a=a.resize((3840,round(a.height*3840/a.width)),mode);y=(a.height-2160)//2
 return np.array(a.crop((0,y,3840,y+2160)))
for name,src in [('dusk','해질녘_원본.png'),('dusk-closed','해질녘_눈감음_원본.png')]:
 dest=cache/(name+'-x4.png')
 with (cache/(name+'-upscale.log')).open('w') as log:
  subprocess.run([exe,'-i',str(P/src),'-o',str(dest),'-m','C:/Users/q1212/.cache/synk-media/realesrgan-general/models','-n','realesrgan-x4plus','-s','4','-t','256','-j','1:2:2','-f','png'],stdout=log,stderr=subprocess.STDOUT,check=True)
 print('upscaled',name,flush=True)
b4=fit(Image.open(cache/'dusk-x4.png'));c4=fit(Image.open(cache/'dusk-closed-x4.png'));m4=cv2.dilate((fit(Image.fromarray(mask),Image.Resampling.NEAREST)>0).astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
final=b4.copy();final[m4]=c4[m4]
Image.fromarray(b4).save(P/'해질녘_정지마당_4K.png');Image.fromarray(final).save(P/'해질녘_눈감음_4K.png');Image.fromarray(m4.astype(np.uint8)*255).save(P/'노을_까몽눈_허용영역_4K.png')
assert np.array_equal(final[~m4],b4[~m4])
Image.fromarray(closed).crop((1180,480,1330,558)).resize((900,468)).save(P/'노을_눈감음_검토.png')
(P/'노을_눈자산_검수.json').write_text(json.dumps({'nativeSize':[W,H],'eyes':eyes,'outsideMaskChangedPixels':0,'allowedPixels4K':int(m4.sum()),'resamplingFootprint':2,'native4K':False},indent=2),encoding='utf-8')
