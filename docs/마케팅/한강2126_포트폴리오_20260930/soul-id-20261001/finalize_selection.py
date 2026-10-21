from pathlib import Path
import json, hashlib, zipfile
from PIL import Image, ImageOps, ImageDraw, ImageFont

D=Path(__file__).resolve().parent
ids=['R3-04','01_intro-02','05_personal-03','06_experience-02','06_experience-03','08_time-03','08b_ai-01','R3-01','08_time-01',
     '02_origin-01','03_start-01','04_taste-05','09_values-01','10_experience-02','R2-01','R2-03','R4-03',
     '11_future-01','11_future-03','11_future-05','D23-02','D23-25','D23-29','D23-21']
allrows={r['id']:r for r in json.loads((D/'candidates.json').read_text(encoding='utf-8'))}
(D/'selected').mkdir(exist_ok=True)
rows=[]
for i,id in enumerate(ids,1):
    r=allrows[id].copy(); original=Image.open(D/'candidate-full'/f'{id}.jpg')
    if id=='D23-21': r['cropBox']=[880,0,1810,1080]
    photo=original.crop(r['cropBox']); out=D/'selected'/f'YUHO_{i:02d}_{id}.jpg'
    photo.save(out,quality=97,subsampling=0)
    r.update(selectedIndex=i,selectedFile=str(out),dimensions=list(photo.size),sha256=hashlib.sha256(out.read_bytes()).hexdigest(),
       addedProcessing='Spatial crop and JPEG export only. No upscale, beautification, denoise, color adjustments, AI face recreation, or horizontal flip.')
    rows.append(r)
assert len(rows)==24 and len({r['sha256'] for r in rows})==24
assert len({(r['originalCameraFile'],round(r['originalCameraSeconds'],1)) for r in rows})==24
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
title=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',29)
sheet=Image.new('RGB',(1800,1520),'#111821');draw=ImageDraw.Draw(sheet)
draw.text((25,16),'YUHO · 실제 인터뷰에서 선별한 Soul ID 사진 24장',font=title,fill='white')
draw.text((25,62),'정면 · 양쪽 사선 · 실제 미소 | AI로 만든 얼굴 없음 | 원본 시각·처리 이력 별도 기록',font=font,fill='#bac6d1')
for i,r in enumerate(rows):
    im=ImageOps.contain(Image.open(r['selectedFile']),(286,315));x=(i%6)*300;y=105+(i//6)*350
    sheet.paste(im,(x+(300-im.width)//2,y));draw.text((x+10,y+320),f"{i+1:02d} · {r['id']}",font=font,fill='white')
sheet.save(D/'YUHO_SoulID_24_contact-sheet.jpg',quality=95)
sample_ids=['R3-04','03_start-01','R2-03','11_future-03','D23-25','D23-21']
preview=Image.new('RGB',(1200,1020),'#111821');pd=ImageDraw.Draw(preview)
pd.text((22,10),'새로 생성한 얼굴이 아닌, 실제 인터뷰 장면',font=title,fill='white')
labels=['정면 · 잔미소','사선 · 편안한 표정','실제 웃는 표정','반대쪽 사선','다른 촬영일 · 다른 복장','측면 · 얼굴 윤곽']
for i,id in enumerate(sample_ids):
    r=next(r for r in rows if r['id']==id); im=ImageOps.contain(Image.open(r['selectedFile']),(386,425));x=(i%3)*400;y=65+(i//3)*475
    preview.paste(im,(x+(400-im.width)//2,y));pd.text((x+15,y+432),labels[i],font=font,fill='white')
preview.save(D/'YUHO_SoulID_representative-6.jpg',quality=95)
payload=dict(date='2026-10-01',candidateCount=132,selectedCount=24,
     status='selected_and_locally_reviewed_not_trained',
     selectionReview='All 132 candidates viewed as contact sheets; independent visual review; selected contact sheet and representative files checked.',
     originalColorCount=20,existingColorAdjustedOtherShootCount=4,
     limitations=['Seated upper body dominates; no verified standing full-body or walking source.',
                 'Two indoor shoots with limited lighting and clothing variety; frames are not equivalent to 24 independent photo shoots.',
                 'Soul ID likeness and generated motion remain untested.'],photos=rows)
(D/'selection-manifest.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
with zipfile.ZipFile(D/'YUHO_SoulID_24_photos.zip','w',zipfile.ZIP_DEFLATED) as z:
    for r in rows:z.write(r['selectedFile'],Path(r['selectedFile']).name)
print(json.dumps({'selected':len(rows),'dimensions':sorted(set(tuple(r['dimensions']) for r in rows)),'zipBytes':(D/'YUHO_SoulID_24_photos.zip').stat().st_size}))
