"""최종 털 고정 후보 독립 검수. 제작기 build/derive 함수를 호출하지 않는다."""
import ast
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[4]
WORK=OUT.parent
RADIO=ROOT/'docs/Loom_자산/라디오차림'
KEY='여름델+전설의팻말'
CUTS=['본체','눈감음','눈웃음','궁금함','집중','안도','응원','놀람']
OPEN={'본체','궁금함','응원','놀람'}
RAW_VERSION='f3ff384ff4523407'
RADIO_VERSION='65f92a753bb5416b'


def read_json(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()
def rgba(p):
    with Image.open(p) as im:
        assert im.mode=='RGBA',str(p)
        return np.asarray(im).copy()
def bbox(m):
    y,x=np.where(m>0)
    return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def center(m):
    x0,y0,x1,y1=bbox(m)
    return ((x0+x1-1)/2,(y0+y1-1)/2)
def shift(a,dx,dy):
    out=np.zeros_like(a);h,w=a.shape[:2]
    x0,x1=max(0,-dx),min(w,w-dx);y0,y1=max(0,-dy),min(h,h-dy)
    out[y0+dy:y1+dy,x0+dx:x1+dx]=a[y0:y1,x0:x1]
    return out


def constants():
    tree=ast.parse((ROOT/'tools/라디오눈윤곽.py').read_text(encoding='utf-8-sig'))
    names={'ELLIPSES','REGISTRATION','REGISTRATION_SOURCES','SOURCE_SHA256'}
    return {n.targets[0].id:ast.literal_eval(n.value) for n in tree.body
            if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in names}


def independent_mask(frame,cut,side,boxes,ellipses):
    mask=np.zeros(frame.shape[:2],np.uint8)
    if cut in OPEN:
        cx,cy,rx,ry,angle=ellipses[cut][side]
        cv2.ellipse(mask,(round(cx*256),round(cy*256)),(round(rx*256),round(ry*256)),
                    angle,0,360,255,-1,lineType=cv2.LINE_8,shift=8)
        return mask
    x0,y0,x1,y1=boxes[cut][side]
    rgb=frame[y0:y1,x0:x1,:3].astype(int)
    green=(rgb[...,1]>rgb[...,0]+3)&(rgb[...,1]>rgb[...,2]+3)&(rgb[...,1]>35)
    count,labels,stats,_=cv2.connectedComponentsWithStats(green.astype(np.uint8))
    selected=np.zeros_like(green,dtype=np.uint8)
    for label in range(1,count):
        if stats[label,cv2.CC_STAT_AREA]>=4: selected[labels==label]=255
    mask[y0:y1,x0:x1]=cv2.dilate(selected,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
    return mask


def resample(source,transform):
    im=Image.fromarray(source);k,dx,dy=(transform[k] for k in ['k','dx','dy'])
    scaled=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(1024,1024),(0,0,0,0));canvas.paste(scaled,(dx,dy))
    return np.asarray(canvas).copy(),scaled.size


def finite_support(mask,scaled_size,dx,dy):
    """각 출력 화소의 Lanczos 반경3 유한 입력 창을 적분합으로 검사한다.
    표본 중심 반올림에 대비한 원본 1px 여유만 추가한다. 얼굴 사각 창이 아니다.
    """
    h,w=mask.shape;tw,th=scaled_size;sx,sy=tw/w,th/h
    cx=(np.arange(tw)+.5)/sx-.5;cy=(np.arange(th)+.5)/sy-.5
    rx=3/min(1,sx)+1;ry=3/min(1,sy)+1
    x0=np.clip(np.floor(cx-rx).astype(int),0,w);x1=np.clip(np.ceil(cx+rx).astype(int)+1,0,w)
    y0=np.clip(np.floor(cy-ry).astype(int),0,h);y1=np.clip(np.ceil(cy+ry).astype(int)+1,0,h)
    integral=np.pad(mask.astype(np.int32),((1,0),(1,0))).cumsum(0).cumsum(1)
    sums=integral[y1[:,None],x1]-integral[y0[:,None],x1]-integral[y1[:,None],x0]+integral[y0[:,None],x0]
    canvas=np.zeros((1024,1024),bool)
    assert dx>=0 and dy>=0 and dx+tw<=1024 and dy+th<=1024
    canvas[dy:dy+th,dx:dx+tw]=sums>0
    return canvas


def main():
    generator=read_json(WORK/'털고정검사.json');const=constants()
    entries=read_json(RADIO/'목록.json')['캐릭터']['까몽']['차림']
    entry=entries[KEY];record=entry['출처']
    assert Path(record['버전경로']).name==RADIO_VERSION
    assert Path(generator['후보폴더']).name==RAW_VERSION
    previous=read_json(OUT/'감사.json')
    old_hashes={Path(k).as_posix():v for k,v in previous['입력sha256'].items()}
    report={'대상':KEY,'원본버전':RAW_VERSION,'라디오버전':RADIO_VERSION,
            '검수방식':'build/derive 호출 없이 마스크·등록·축소를 재구성. 수치와 실제 시각 판정은 별도.',
            '입력8보존':[],'추가참조3보존':[],'원본후보':[],'라디오8':[]}
    originals={};candidate={};sources={}
    for cut in CUTS:
        item=generator['입력'][cut];p=ROOT/item['파일'];digest=sha(p)
        assert digest==item['sha256']==old_hashes[Path(item['파일']).as_posix()]
        report['입력8보존'].append({'표정':cut,'sha256':digest,'과거독립감사와동일':True})
        originals[cut]=rgba(p);sources[cut]=originals[cut].copy()
        candidate[cut]=rgba(WORK/'후보_RGBA'/RAW_VERSION/p.name)
        assert originals[cut].shape==candidate[cut].shape==(1219,1290,4)
    for path,expected in const['REGISTRATION_SOURCES'].items():
        assert sha(ROOT/path)==expected
        report['추가참조3보존'].append({'파일':path,'sha256':expected})
    version=hashlib.sha256(b''.join(candidate[c].tobytes() for c in CUTS)).hexdigest()[:16]
    assert version==RAW_VERSION
    masks={cut:[independent_mask(originals[cut],cut,s,generator['눈상자'],const['ELLIPSES']) for s in [0,1]] for cut in CUTS}
    # 응원 우측은 같은 표정 4K 원본의 실제 RGB. 등록/축소도 독립 재계산한다.
    with Image.open(ROOT/'docs/캐릭터/정본_4K/까몽_응원.png') as im:
        k=const['REGISTRATION']['k'];small=im.resize((int(im.width*k),int(im.height*k)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(1290,1219),(0,0,0,0))
    canvas.paste(small,(round(const['REGISTRATION']['dx']),round(const['REGISTRATION']['dy'])))
    donor=np.asarray(canvas);right=masks['응원'][1]>0
    assert np.all(donor[...,3][right]==255)
    sources['응원'][...,:3][right]=donor[...,:3][right]
    plate=rgba(WORK/'고정털바탕.png');reference=candidate['본체']
    targets=[center(m) for m in masks['본체']]
    active={};moved_sources={};moved_masks={}
    for cut in CUTS:
        active[cut]=np.zeros((1219,1290),bool);predicted=plate.copy();moved_sources[cut]=[];moved_masks[cut]=[]
        for side in [0,1]:
            cx,cy=center(masks[cut][side]);dx,dy=round(targets[side][0]-cx),round(targets[side][1]-cy)
            moved_mask=shift(masks[cut][side],dx,dy);moved=shift(sources[cut],dx,dy)
            active[cut]|=moved_mask>0;moved_masks[cut].append(moved_mask);moved_sources[cut].append(moved)
            distance=cv2.distanceTransform((moved_mask>0).astype(np.uint8),cv2.DIST_L2,3)
            weight=np.clip(distance/1.6,0,1)[...,None]
            predicted[...,:3]=np.rint(predicted[...,:3]*(1-weight)+moved[...,:3]*weight).astype(np.uint8)
        assert np.array_equal(candidate[cut],predicted),cut+': 눈/공통바탕 재구성 차이'
    support=np.logical_or.reduce(list(active.values()))
    assert np.array_equal(support,np.asarray(Image.open(WORK/'눈변화허용영역.png'))>0)
    assert int(support.sum())==37088
    erase=cv2.dilate(np.maximum.reduce(masks['본체']),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(31,31)))>0
    assert np.array_equal(plate[~erase],originals['본체'][~erase])
    assert np.array_equal(reference[~erase],originals['본체'][~erase])
    assert int(np.any(reference!=originals['본체'],axis=2).sum())==12772
    report['기본국소변경']={'화소':12772,'정본파일변경':False,'원래눈수리영역밖변경':0}
    report['좁은눈지원']={'화소':int(support.sum()),'전체':support.size,'비율':round(100*support.mean(),4),
                          '기하':'열린 눈 명시 타원 / 닫힌 눈 연결 초록+1px / 실제 정렬 후 8표정 합집합'}
    for cut in CUTS:
        a=candidate[cut]
        assert np.array_equal(a[~support],reference[~support])
        assert np.array_equal(a[~active[cut]],plate[~active[cut]])
        assert np.array_equal(a[...,3],originals['본체'][...,3])
        row={'표정':cut,'눈지원밖_RGBA차이':0,'자기눈밖_공통바탕차이':0,'원본알파차이':0}
        row['얼굴고정영역_기본원본RGBA차이']={}
        for name,box in {'미간':(473,312,562,453),'왼볼':(304,479,448,543),
                         '오른볼':(615,479,750,543),'이마':(432,193,599,256),
                         '코자리':(479,392,575,495)}.items():
            x0,y0,x1,y1=box
            assert np.array_equal(a[y0:y1,x0:x1],originals['본체'][y0:y1,x0:x1]),name+': 고정 영역 변화'
            row['얼굴고정영역_기본원본RGBA차이'][name]=0
        if cut not in OPEN:
            rgb=a[...,:3].astype(int);green=(rgb[...,1]>rgb[...,0]+3)&(rgb[...,1]>rgb[...,2]+3)&(rgb[...,1]>35)
            ring=erase&~active[cut]
            row['닫힌눈밖_초록잔상']=int((green&ring).sum())
            assert row['닫힌눈밖_초록잔상']==0
        if cut in {'궁금함','응원'}:
            counts=[]
            for side in [0,1]:
                m=moved_masks[cut][side];donor=moved_sources[cut][side]
                core=cv2.distanceTransform((m>0).astype(np.uint8),cv2.DIST_L2,3)>=1.6
                assert np.array_equal(a[...,:3][core],donor[...,:3][core])
                pupil=core&(donor[...,:3].max(2)<35)
                counts.append(int(pupil.sum()))
            row['동공원본일치_픽셀좌우']=counts
        report['원본후보'].append(row)
    # 후보 PNG → 실제 WebP를 새로 인코딩하지 않고, 기대 RGBA와 전체 픽셀 비교.
    baseline_webp=None;webps={};scaled_size=None
    for cut in CUTS:
        file=record['파일'][cut];source=ROOT/file['원본'];target=RADIO/file['결과']
        assert source.parent.name==RAW_VERSION and target.parent.name==RADIO_VERSION
        assert sha(source)==file['원본_sha256'] and sha(target)==file['결과_sha256']
        expected,scaled_size=resample(candidate[cut],record['변환']);actual=rgba(target)
        assert actual.shape==(1024,1024,4) and np.array_equal(expected,actual),cut+': lossless 차이'
        webps[cut]=actual
        report['라디오8'].append({'표정':cut,'재계산_RGBA차이':0,'크기':[1024,1024],
                                 '결과sha256':sha(target),'알파128초과_프레임접촉':int((actual[0,:,3]>128).sum()+(actual[-1,:,3]>128).sum()+(actual[:,0,3]>128).sum()+(actual[:,-1,3]>128).sum())})
    finite=finite_support(support,scaled_size,record['변환']['dx'],record['변환']['dy'])
    report['1024눈지원']={'화소':int(finite.sum()),'유한지원':'실제 눈 mask + Lanczos 반경3 + 원본 1px 표본 여유'}
    for row in report['라디오8']:
        a=webps[row['표정']];base=webps['본체']
        assert np.array_equal(a[~finite],base[~finite])
        assert np.array_equal(a[...,3],base[...,3])
        row['유한눈지원밖_RGBA차이']=0;row['표정간_알파차이']=0
    # 다른 128차림은 현재 개별 레코드/입력/출력 지문을 대조한다. 과거 JSON 바이트
    # 지문 목록을 확보하지 않았으므로 기록 파일의 역사적 불변까지 소급 주장하지 않는다.
    other=[];before_records={}
    for key,entry in entries.items():
        if key==KEY: continue
        path=RADIO/'_기록'/f'{key}.json';before_records[key]=sha(path);r=read_json(path)
        assert r==entry['출처']
        count=0
        for file in r['파일'].values():
            assert sha(ROOT/file['원본'])==file['원본_sha256'],key+': 입력지문'
            assert sha(RADIO/file['결과'])==file['결과_sha256'],key+': 결과지문'
            count+=1
        other.append({'차림':key,'일치파일':count,'현재기록sha256':before_records[key]})
    assert len(other)==128 and sum(v['일치파일'] for v in other)==1024
    assert all(sha(RADIO/'_기록'/f'{key}.json')==value for key,value in before_records.items())
    report['다른128차림']={'현재개별기록_입력출력일치':True,'표정파일':1024,'검수중기록불변':True,'개별기록':other,
                          '한계':'이전128개 JSON 바이트 지문 목록이 없어 이번 수정 전후 JSON 파일 자체의 역사적 불변은 소급 검증하지 않음'}
    sprout=read_json(ROOT/'docs/_ops/의상라디오검수_20260909/자산/새싹후보검사.json')
    sprout_entry=entries['앞치마+한달출석새싹']['출처']
    assert Path(sprout_entry['버전경로']).name=='84c41912778b469f'
    for cut in sprout['후보']:
        assert sha(ROOT/cut['채택후보'])==cut['sha256']
    report['새싹보존']={'후보14_이전검사해시동일':True,'활성라디오버전':'84c41912778b469f','활성8_개별기록sha검증':'다른128차림 검사에 포함'}
    report['시각판정']={'직접확인':'최신 전후 8표정 연락판과 최종 1024 눈감음·응원·궁금함',
                      '개선확인':'넓은 털 교체 및 회색 코 유입 없음. 닫힌 눈에 원형/동공 잔상 안 보임. 궁금함 검정 눈 온전, 응원 오른눈 복구.',
                      '분리한계':'일부 원본의 흰 누끼 테와 보편적인 모든 차림 자연스러움은 이 검사의 합격 범위가 아님. 브라우저 실제 왕복 검사는 주담당.'}
    (OUT/'수정후검수.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['다른128차림','입력8보존','추가참조3보존']},ensure_ascii=False,indent=2),flush=True)


if __name__=='__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()
