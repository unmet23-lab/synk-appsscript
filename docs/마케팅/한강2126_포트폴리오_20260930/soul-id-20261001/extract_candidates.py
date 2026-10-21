"""Extract genuine interview frames; never retouch or synthesize a face."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, math
import cv2
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFont

DEST = Path(__file__).resolve().parent
ROOT = DEST.parents[3]
FONT = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
PLAN = json.loads((ROOT/'outputs/interview_20260925/edit_plan.json').read_text(encoding='utf-8'))
REFS = json.loads((ROOT/'docs/마케팅/LAB_카페_다시말해주세요_20260926/performance-references/interview/reference-manifest.json').read_text(encoding='utf-8'))

def box_for(raw):
    if raw == 'MVI_2548': return (600, 0, 1440, 1050)
    if raw == 'MVI_2547': return (1080, 80, 1920, 1080)
    return (170, 0, 1050, 1050)

def process(job):
    name, path, times, raw, offset, treatment = job
    cap = cv2.VideoCapture(str(path)); rows=[]
    for i,t in enumerate(times):
        cap.set(cv2.CAP_PROP_POS_MSEC, t*1000)
        ok,bgr=cap.read()
        if not ok: continue
        ident=f'{name}-{i+1:02d}'
        rgb=cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB); original=Image.fromarray(rgb)
        box=box_for(raw) if raw != '0923' else (530, 40, 1450, 1080)
        portrait=original.crop(box)
        original.save(DEST/'candidate-full'/f'{ident}.jpg',quality=96,subsampling=0)
        portrait.save(DEST/'candidate-crops'/f'{ident}.jpg',quality=96,subsampling=0)
        arr=cv2.cvtColor(np.asarray(portrait),cv2.COLOR_RGB2GRAY)
        tiny=cv2.resize(arr,(9,8)); bits=(tiny[:,1:]>tiny[:,:-1]).flatten()
        dhash=hex(sum(int(v)<<n for n,v in enumerate(bits)))
        rows.append(dict(id=ident,source=str(path),clipSeconds=round(t,3),
          originalCameraFile=raw,originalCameraSeconds=round(t+offset,3),
          sourceTreatment=treatment,cropBox=list(box),dimensions=list(portrait.size),
          sharpnessVariance=round(float(cv2.Laplacian(arr,cv2.CV_64F).var()),2),dhash=dhash,
          extractedFile=str(DEST/'candidate-crops'/f'{ident}.jpg')))
    cap.release(); return rows

def make_sheets(rows, prefix='candidates'):
    per=24; width=320; height=390
    for page in range(math.ceil(len(rows)/per)):
        subset=rows[page*per:(page+1)*per]
        sheet=Image.new('RGB',(width*4,height*math.ceil(len(subset)/4)), '#10131a')
        d=ImageDraw.Draw(sheet)
        for j,r in enumerate(subset):
            im=Image.open(r['extractedFile']); im=ImageOps.contain(im,(width-12,height-52))
            x=(j%4)*width;y=(j//4)*height
            sheet.paste(im,(x+(width-im.width)//2,y))
            d.text((x+8,y+height-48),r['id'],font=FONT,fill='white')
            d.text((x+8,y+height-26),f"{r['originalCameraFile']} / {r['originalCameraSeconds']:.1f}s",font=FONT,fill='#b4c4cc')
        sheet.save(DEST/f'{prefix}-{page+1:02d}.jpg',quality=94)

def main():
    for folder in ['candidate-full','candidate-crops']: (DEST/folder).mkdir(exist_ok=True)
    jobs=[]
    for c in PLAN['cuts']:
        duration=c['frames']/30
        count=min(8,max(2,int(duration/3)))
        times=[.5+(duration-1)*i/(count-1) for i in range(count)]
        jobs.append((c['id'],ROOT/'outputs/interview_20260925/studio/assets/selects_v2'/f"{c['id']}.mp4",times,c['source'],c['in'],'Original-color v2, range conversion and optional crop only; no face/skin edits'))
    for i,r in enumerate(REFS):
        dur=r['endSeconds']-r['startSeconds'];times=[.4+(dur-.8)*j/5 for j in range(6)]
        raw='MVI_2548' if '2548' in r['source'] else 'MVI_2550'
        jobs.append((f'R{i+1}',Path(r['output']),times,raw,r['startSeconds'],r['processing']))
    jobs.append(('D23',Path('C:/Users/q1212/Videos/SYNK_Interview_20260923/renders/interview_base.mp4'),list(range(3,159,5)),'0923',0,'Different shoot; existing color/noise and face brightness adjustments. Not an unprocessed camera original.'))
    rows=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(process,jobs):
            rows.extend(result)
            print(f'{len(rows)} frames extracted',flush=True)
    (DEST/'candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    make_sheets(rows)
    print(f'COMPLETE {len(rows)} candidates',flush=True)

if __name__=='__main__': main()
