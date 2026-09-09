"""대표 한 차림의 털 변화 읽기 전용 감사. 이미지/코드 원본을 바꾸지 않는다."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[4]
TOKEN = '여름델+전설의팻말'
NAME = '까몽_'+TOKEN
CUTS = ['본체', '눈감음', '눈웃음', '궁금함', '집중', '안도', '응원', '놀람']
PALETTE = {v['이름']:v['hex'] for v in json.loads((ROOT/'docs/디자인_토큰.json').read_text(encoding='utf-8'))['색']['킷']}
FONT = ImageFont.truetype(str(ROOT/'docs/브랜드_폰트/SUIT/SUIT-Medium.otf'), 22)
PATCHES = {'이마': (400, 265, 505, 305), '미간': (426, 340, 482, 428),
           '왼볼': (320, 445, 410, 485), '오른볼': (515, 445, 600, 485)}
record = json.loads((ROOT/'docs/Loom_자산/라디오차림/_기록'/f'{TOKEN}.json').read_text(encoding='utf-8'))
K, DX, DY = (record['변환'][x] for x in ['k','dx','dy'])


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metric(base, other, box):
    x0,y0,x1,y1 = box
    a, b = base[y0:y1,x0:x1], other[y0:y1,x0:x1]
    visible = (a[...,3]>128)&(b[...,3]>128)
    diff = np.abs(a[...,:3].astype(int)-b[...,:3].astype(int)).max(2)
    return {'분모': int(visible.sum()), '차이2초과': int(((diff>2)&visible).sum()),
            '차이10초과': int(((diff>10)&visible).sum()), '차이25초과': int(((diff>25)&visible).sum()),
            '평균최대채널차이': round(float(diff[visible].mean()),2), '최대':int(diff[visible].max())}


def mapped(box, kind):
    if kind=='raw':
        return tuple(round((v-(DX if i%2==0 else DY))/K) for i,v in enumerate(box))
    if kind=='4k':
        return tuple(v*4 for v in box)
    return box


def panel(image, size):
    back = Image.new('RGBA', image.size, PALETTE['Oat'])
    back.alpha_composite(image)
    return back.convert('RGB').resize(size, Image.Resampling.LANCZOS)


def main():
    stages = [
        ('표정 RGB', 'docs/Loom_자산/옷/GPT_표정', 'png', 'raw', NAME+'_'),
        ('표정 누끼', 'docs/Loom_자산/옷/GPT_표정_누끼', 'png', 'raw', NAME+'_'),
        ('표정 4K틀', 'docs/Loom_자산/옷/GPT_표정_누끼_틀', 'png', '4k', NAME+'_'),
        ('현재 라디오DJ', 'docs/Loom_자산/라디오DJ', 'webp', '1024', NAME+'_'),
        ('새 라디오차림', 'docs/Loom_자산/라디오차림/까몽', 'webp', '1024', TOKEN+'_'),
    ]
    inputs = [ROOT/folder/(prefix+cut+'.'+ext) for _,folder,ext,_,prefix in stages for cut in CUTS]
    inputs += [ROOT/'docs/Loom_자산/옷/GPT정액시험'/f'{NAME}.png']
    fingerprints = {str(p.relative_to(ROOT)):sha(p) for p in inputs}
    report = {'대상':NAME, '표정':CUTS, '영역_1024좌표':PATCHES,
              '주의':'네 사각형은 기본/깜빡에서 눈 없는 털 영역이다. 응원처럼 눈이 이동한 표정은 별도 8표정 눈 합집합 제외 검사로 판정한다. 차이10/25는 채널 강도이며 품질 합격선이 아니다.', '단계':[]}
    dj = {}
    for title, folder, ext, kind, prefix in stages:
        base = np.asarray(Image.open(ROOT/folder/(prefix+'본체.'+ext)).convert('RGBA'))
        rows=[]
        for cut in CUTS:
            im = Image.open(ROOT/folder/(prefix+cut+'.'+ext)).convert('RGBA')
            arr=np.asarray(im)
            if title=='현재 라디오DJ':
                dj[cut]=im.copy()
            rows.append({'표정':cut, '영역':{name:metric(base, arr, mapped(box,kind)) for name,box in PATCHES.items()}})
        report['단계'].append({'단계':title,'크기':list(base.shape[1::-1]),'비교':rows})
        print(title, next(r for r in rows if r['표정']=='눈감음'), flush=True)
    # 눈이 내려가는 응원 등도 털로 잘못 세지 않도록 8표정 실제 초록 눈 위치의
    # 합집합을 넉넉한 각 눈 상자(+12px)로 제외한다. 새로 보이는 코 자리도 제외한다.
    fur=np.zeros((1024,1024),bool);fur[280:510,300:660]=True
    boxes=[]
    for cut,im in dj.items():
        a=np.asarray(im).astype(int)
        green=(a[...,1]>a[...,0]+10)&(a[...,1]>a[...,2]+10)&(a[...,:3].mean(2)>30)
        for start,end in [(290,485),(485,715)]:
            local=green[280:510,start:end]
            yy,xx=np.where(local)
            if not len(xx):
                raise ValueError('눈 위치 확인 실패: '+cut)
            x0,x1=max(0,int(xx.min())+start-12),min(1024,int(xx.max())+start+13)
            y0,y1=max(0,int(yy.min())+280-12),min(1024,int(yy.max())+280+13)
            fur[y0:y1,x0:x1]=False
            boxes.append({'표정':cut,'상자':[x0,y0,x1,y1]})
    fur[390:455,430:490]=False
    report['8표정눈합집합제외']={'눈상자':boxes,'1024털분모':int(fur.sum()),'단계':[]}
    for title,folder,ext,kind,prefix in stages:
        base=np.asarray(Image.open(ROOT/folder/(prefix+'본체.'+ext)).convert('RGBA'))
        h,w=base.shape[:2]
        if kind=='raw':
            xx=np.clip(np.rint(np.arange(w)*K+DX).astype(int),0,1023)
            yy=np.clip(np.rint(np.arange(h)*K+DY).astype(int),0,1023)
        elif kind=='4k':
            xx=np.arange(w)//4;yy=np.arange(h)//4
        else:
            xx=np.arange(w);yy=np.arange(h)
        region=fur[yy[:,None],xx[None,:]]&(base[...,3]>128)
        rows=[]
        for cut in CUTS[1:]:
            other=np.asarray(Image.open(ROOT/folder/(prefix+cut+'.'+ext)).convert('RGBA'))
            diff=np.abs(base[...,:3].astype(int)-other[...,:3].astype(int)).max(2)
            rows.append({'표정':cut,'분모':int(region.sum()),'차이10초과':int(((diff>10)&region).sum()),
                         '차이25초과':int(((diff>25)&region).sum())})
        report['8표정눈합집합제외']['단계'].append({'단계':title,'비교':rows})
    # 여덟 얼굴은 모두 같은 크기·같은 자리를 잘라 나란히 확인한다.
    sheet=Image.new('RGB',(1664,740),PALETTE['Paper']);draw=ImageDraw.Draw(sheet)
    draw.text((24,16),'현재 라디오DJ · 같은 차림 8표정 · 얼굴 털 비교',font=FONT,fill=PALETTE['Ink'])
    for i,cut in enumerate(CUTS):
        x,y=24+(i%4)*410,64+(i//4)*334
        crop=dj[cut].crop((270,255,670,555))
        sheet.paste(panel(crop,(400,300)),(x,y))
        draw.text((x,y+302),cut,font=FONT,fill=PALETTE['Ink'])
    sheet.save(OUT/'현재DJ_8표정_얼굴.png')
    # 기본/깜빡 및 눈과 분리한 네 영역의 변화 지도.
    sheet=Image.new('RGB',(1254,390),PALETTE['Paper']);draw=ImageDraw.Draw(sheet)
    for i,cut in enumerate(['본체','눈감음']):
        sheet.paste(panel(dj[cut].crop((270,255,670,555)),(400,300)),(16+i*414,48))
        draw.text((16+i*414,16),cut,font=FONT,fill=PALETTE['Ink'])
    base=np.asarray(dj['본체']);blink=np.asarray(dj['눈감음'])
    diff=np.abs(base[...,:3].astype(int)-blink[...,:3].astype(int)).max(2)
    overlay=dj['본체'].copy();ar=np.asarray(overlay).copy()
    for box in PATCHES.values():
        x0,y0,x1,y1=box;m=diff[y0:y1,x0:x1]>10
        patch=ar[y0:y1,x0:x1];patch[m,:3]=[249,104,89];patch[m,3]=255
    overlay=Image.fromarray(ar)
    sheet.paste(panel(overlay.crop((270,255,670,555)),(400,300)),(844,48))
    draw.text((844,16),'코랄: 눈 밖 털 변화>10',font=FONT,fill=PALETTE['Ink'])
    sheet.save(OUT/'기본_깜빡_털변화.png')
    report['원본해시불변']=all(sha(ROOT/p)==digest for p,digest in fingerprints.items())
    report['입력파일수']=len(fingerprints)
    report['입력sha256']=fingerprints
    assert report['원본해시불변']
    (OUT/'감사.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()
