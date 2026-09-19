"""Register generated lids within the original eye contours; freeze every other pixel."""
from pathlib import Path
import cv2, numpy as np, json, subprocess
from PIL import Image
P=Path(__file__).resolve().parent
base=np.array(Image.open(P/'원본.png').convert('RGB'));generated=np.array(Image.open(P/'눈감음_생성참조.png').convert('RGB'))
H,W=base.shape[:2]
eyes=[{'name':'kkamong-left','target':[1226,515,15,19],'source':[1228,518,23,25]},
      {'name':'kkamong-right','target':[1290,521,20,20],'source':[1292,523,27,25]}]
closed=base.copy();mask=np.zeros((H,W),np.uint8)
for e in eyes:
    cx,cy,rx,ry=e['target'];sx,sy,srx,sry=e['source']
    yy,xx=np.mgrid[:H,:W].astype(np.float32)
    patch=cv2.remap(generated,sx+(xx-cx)*srx/rx,sy+(yy-cy)*sry/ry,cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT_101)
    d=np.sqrt(((xx-cx)/rx)**2+((yy-cy)/ry)**2)
    a=np.clip((1.03-d)*min(rx,ry),0,1)
    closed=np.rint(closed*(1-a[:,:,None])+patch*a[:,:,None]).astype(np.uint8)
    mask[a>0]=255
Image.fromarray(closed).save(P/'눈감음_원본크기.png')
Image.fromarray(mask).save(P/'허용영역_원본크기.png')
assert np.array_equal(base[mask==0],closed[mask==0])
Image.fromarray(closed).crop((1180,480,1330,558)).resize((900,468)).save(P/'눈감음_합성확대.png')
cache=Path('C:/Users/q1212/.cache/synk-media/radio-eyes-only-20260919')
exe='C:/Users/q1212/.cache/synk-media/realesrgan-ncnn-v0.2.0/realesrgan-ncnn-vulkan-v0.2.0-windows/realesrgan-ncnn-vulkan.exe'
with (cache/'closed-upscale.log').open('w') as log:
    subprocess.run([exe,'-i',str(P/'눈감음_원본크기.png'),'-o',str(cache/'closed-x4.png'),'-m','C:/Users/q1212/.cache/synk-media/realesrgan-general/models','-n','realesrgan-x4plus','-s','4','-t','256','-j','1:2:2','-f','png'],stdout=log,stderr=subprocess.STDOUT,check=True)
def fit(a,mode=Image.Resampling.LANCZOS):
    a=a.resize((3840,round(a.height*3840/a.width)),mode);y=(a.height-2160)//2
    return np.array(a.crop((0,y,3840,y+2160)))
b4=np.array(Image.open(P/'정지마당_4K.png'));c4=fit(Image.open(cache/'closed-x4.png'))
m4=fit(Image.fromarray(mask),Image.Resampling.NEAREST)>0
# Include only the two-pixel resampling footprint, never the generated face/fur.
m4=cv2.dilate(m4.astype(np.uint8),np.ones((5,5),np.uint8)).astype(bool)
final=b4.copy();final[m4]=c4[m4]
Image.fromarray(final).save(P/'눈감음_4K.png');Image.fromarray(np.uint8(m4)*255).save(P/'까몽눈_허용영역_4K.png')
assert np.array_equal(b4[~m4],final[~m4])
report={'coordinateSpace':[W,H],'eyes':eyes,'outsideMaskChangedPixels':0,'nativeAllowedPixels':int(np.count_nonzero(mask)),'4KAllowedPixels':int(np.sum(m4)),'4KResampleFootprintPixels':2,'noWholeFacePatch':True,'native4K':False}
(P/'눈자산_검수.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report),flush=True)
