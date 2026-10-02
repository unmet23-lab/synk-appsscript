"""기존 2D 픽셀을 수정하지 않는 독립 3D 깊이 후보 계측. 출력은 새 시험 폴더뿐."""
import hashlib
import importlib.util
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/_ops/삼디문지기/깊이시험'
REF = ROOT / 'docs/캐릭터/정본_4K/까몽_본체.png'
OLD = ROOT / 'docs/_ops/삼디문지기/까몽_블렌더_누끼.png'
NEW = OUT / '까몽_전체프레임.png'
sys.stdout.reconfigure(encoding='utf-8')

def module(filename):
    spec = importlib.util.spec_from_file_location(filename, ROOT / 'tools' / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

gate = module('삼디실루엣대조.py')
measure = module('마스코트치수재기.py')

def bbox(mask):
    y, x = np.where(mask)
    return [int(x.min()), int(y.min()), int(x.max() + 1), int(y.max() + 1)]

def image_info(path):
    im = np.asarray(Image.open(path).convert('RGBA'))
    mask = im[..., 3] > 128
    box = bbox(mask)
    normalized = gate.상자맞춤(mask)
    x0,y0,x1,y1 = box
    bw,bh=x1-x0,y1-y0
    # 치수 정본과 같은 초록 홍채 자. 네이티브 해상도에 비례한 최소 덩어리만 조절.
    r,g,b=(im[...,k].astype(int) for k in range(3))
    lum=.2126*r+.7152*g+.0722*b
    key=mask & measure.EYE_KEY['까몽'](r,g,b,lum)
    key[y0+int(bh*.7):]=False
    # 정본의 4096→1024 표본 간격(4px)을 유지하면서 1024 렌더는 1px로 잰다.
    # 양쪽 모두 stride=4면 렌더 눈 폭의 4px 양자화로 ±10% 경계 판정이 뒤집힌다.
    stride=max(1,round(im.shape[1]/1024))
    blobs=measure._blobs(key[::stride,::stride],150)[:2]
    assert len(blobs)==2, f'눈 두 개를 찾지 못함: {path}'
    eyes=[]
    for blob in sorted(blobs,key=lambda v:v['cx']):
        eyes.append({'center':[blob['cx']*stride,blob['cy']*stride],
                     'box':[blob['x0']*stride,blob['y0']*stride,blob['x1']*stride,blob['y1']*stride]})
    eye_width=sum(e['box'][2]-e['box'][0]+1 for e in eyes)/2
    span=eyes[1]['center'][0]-eyes[0]['center'][0]
    profile=[]
    for i in range(20):
        xs=np.where(mask[y0+bh*i//20:y0+bh*(i+1)//20].any(axis=0))[0]
        profile.append(0 if len(xs)==0 else int(xs.max()-xs.min()+1))
    info={'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
          'size':[im.shape[1],im.shape[0]],'bbox':box,
          'edge_pixels':{'top':int(mask[0].sum()),'bottom':int(mask[-1].sum()),
                         'left':int(mask[:,0].sum()),'right':int(mask[:,-1].sum())},
          'aspect':bw/bh,'widest_band_percent':int(np.argmax(profile))*5,
          'widest_bands_percent':[i*5 for i,v in enumerate(profile) if v==max(profile)],
          'eye_sample_stride':stride,
          'width_profile':profile,
          'eyes':eyes,'eye_width_to_body_width':eye_width/bw,
          'eye_span_to_width':span/eye_width,
          'eye_gap_to_width':(eyes[1]['box'][0]-eyes[0]['box'][2])/eye_width,
          'eye_height_percent':100*(sum(e['center'][1] for e in eyes)/2-y0)/bh}
    return info,im,mask,normalized

def fitted_point(p,info):
    x,y,x2,y2=info['bbox']; long=max(x2-x,y2-y)
    return [(p[0]-(x+x2)/2)/long+.5,(p[1]-(y+y2)/2)/long+.5]

def landmarks(info,mask):
    x0,y0,x1,y1=info['bbox']; bw=x1-x0;bh=y1-y0
    landmarks={f'눈{side}':fitted_point(e['center'],info) for side,e in zip(['왼','오른'],info['eyes'])}
    # 라벨은 지정한 이미지 영역의 바깥선 극점. 정밀 수작업 부위분할과 같다고 부르지 않는다.
    for name,region,axis,maximum in [
        ('귀왼',(0,.50,0,.20),1,False),('귀오른',(.5,1,0,.20),1,False),
        ('날개왼',(0,.5,.25,.50),0,False),('날개오른',(.5,1,.25,.50),0,True),
        ('꼬리끝',(.65,1,.70,1),1,True)]:
        a,b,c,d=region
        xx0,xx1=x0+int(bw*a),x0+int(bw*b)
        yy0,yy1=y0+int(bh*c),y0+int(bh*d)
        yy,xx=np.where(mask[yy0:yy1,xx0:xx1]);xx=xx+xx0;yy=yy+yy0
        coords=xx if axis==0 else yy
        edge=coords.max() if maximum else coords.min()
        sel=np.abs(coords-edge)<=max(1,bw*.002)
        point=[float(np.median(xx[sel])),float(np.median(yy[sel]))]
        landmarks[name]=fitted_point(point,info)
    return landmarks

def main():
    original,orig_rgba,orig_mask,orig_norm=image_info(REF)
    old,*_=image_info(OLD)
    render,new_rgba,new_mask,new_norm=image_info(NEW)
    common=orig_norm & new_norm
    result={'images':[original,old,render], 'iou':float(common.sum()/(orig_norm|new_norm).sum()),
            'measurement_note':'alpha>128, bbox uniform scale/center only; no geometry/image deformation used for alignment',
            'landmark_note':'Eye green-iris connected components use canonical key; ears/wings/tail are silhouette extrema in explicit regions, not hand-segmented anatomical centers.'}
    a,b=landmarks(original,orig_mask),landmarks(render,new_mask)
    result['landmarks']=[{'name':name,'reference':a[name],'model':b[name],
                         'error_body_long_percent':float(np.linalg.norm(np.array(a[name])-b[name])*100)} for name in a]
    # 정본 §6의 이미 확정된 재굽기 눈금을 쓰며 시험결과에 맞춰 문턱을 바꾸지 않는다.
    result['canonical_checks']=[
        {'name':'가로세로비','relative_error':abs(render['aspect']/original['aspect']-1),'limit':.05},
        {'name':'눈폭/몸폭','relative_error':abs(render['eye_width_to_body_width']/original['eye_width_to_body_width']-1),'limit':.10},
        {'name':'눈사이/눈폭','relative_error':abs(render['eye_span_to_width']/original['eye_span_to_width']-1),'limit':.10},
        {'name':'눈틈/눈폭','relative_error':abs(render['eye_gap_to_width']/original['eye_gap_to_width']-1),'limit':.10},
        {'name':'눈높이','error_percentage_points':abs(render['eye_height_percent']-original['eye_height_percent']),'limit':3},
        {'name':'가장넓은띠','error_percentage_points':min(abs(a-b) for a in original['widest_bands_percent'] for b in render['widest_bands_percent']),'limit':5,
         'note':'최댓값 동률 띠는 모두 유지한다. 첫 argmax만 선택해 없는 오차를 만들지 않는다.'}]
    for check in result['canonical_checks']:
        error=check.get('relative_error',check.get('error_percentage_points'))
        # 정본은 가장 넓은 띠가 5% 이상 옮겨지면 재굽기. 이 항목은 경계도 탈락이다.
        check['pass']=error < check['limit'] if check['name']=='가장넓은띠' else error <= check['limit']
    raw=np.load(OUT/'모델표면깊이.npz'); depth=raw['depth_camera'];part=raw['part_id']
    # 등방 상자 맞춤을 역산해 정본의 전체 4096 정사각 좌표마다 모델 광선의 깊이를 고른다.
    sx,sy,sx2,sy2=original['bbox'];tx,ty,tx2,ty2=render['bbox']
    source_long=max(sx2-sx,sy2-sy); target_long=max(tx2-tx,ty2-ty)
    def transfer(px,py):
        nx=(px-(sx+sx2)/2)/source_long
        ny=(py-(sy+sy2)/2)/source_long
        xx=((tx+tx2)/2+nx*target_long)/render['size'][0]*512
        yy=((ty+ty2)/2+ny*target_long)/render['size'][1]*512
        ix,iy=int(math.floor(xx)),int(math.floor(yy))
        if ix<0 or iy<0 or ix>=512 or iy>=512:return None,0
        v=float(depth[iy,ix])
        return (v if np.isfinite(v) else None),int(part[iy,ix])
    N=28
    z=[];valid=[];missing=[];part_grid=[]
    back=float(np.nanmax(depth));front=float(np.nanmin(depth))
    for row in range(N+1):
        for col in range(N+1):
            # 실제 깊이격자.js의 P=256 최근접 표본 좌표를 그대로 따라간다.
            # Python bankers-round가 아니라 JS Math.round(양수)와 같은 반올림.
            ix=min(255,math.floor(col/N*255+.5));iy=min(255,math.floor((1-row/N)*255+.5))
            px=ix*16;py=iy*16
            d,p=transfer(px,py)
            inside=orig_rgba[py,px,3]>60
            has=inside and d is not None
            value=(back-d)/(back-front)*1.3 if has else 0
            z.append(value);valid.append(has);part_grid.append(p)
            if inside and not has:missing.append([col,row])
    js="const d=require('./tools/lib/깊이격자.js');let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const v=JSON.parse(s);const c=d.부드럽게(v.z,28,5);console.log(JSON.stringify({old:d.앱용뽑기(v.ref),candidate:{N:28,z:c,기준:d.기준뽑기(c)}}));});"
    call=subprocess.run(['node','-e',js],cwd=ROOT,input=json.dumps({'z':z,'ref':str(REF)}),text=True,capture_output=True,encoding='utf-8',check=True)
    grids=json.loads(call.stdout)
    grids['candidate']['normalization']='(farthest-camera-depth - camera-depth)/visible-mesh-range * 1.3; app drive comparison only, arbitrary model units are not measured body thickness'
    grids['candidate']['missing_reference_vertices']=missing
    grids['candidate']['raw']=z
    grids['candidate']['part_grid']=part_grid
    for key in ['old','candidate']:
        vals=np.array(grids[key]['z']); live=vals[vals>0];base=grids[key]['기준']
        jump=max(abs(vals[y*29+x+1]-vals[y*29+x]) for y in range(29) for x in range(28) if min(vals[y*29+x],vals[y*29+x+1])>0)
        grids[key]['summary']={'positive_vertices':len(live),'max':float(live.max()),'mean':float(live.mean()),
                               'eye_to_body_proxy':float((live.max()-base)/(live.mean()-base)),
                               'max_positive_horizontal_neighbor_jump':float(jump)}
    result['depth']={'raw_camera_range':[front,back],'mesh_hit_pixels':int(np.isfinite(depth).sum()),
                     'reference_grid_vertices_with_model':int(sum(valid)),
                     'reference_grid_vertices_missing_model':len(missing),
                     'grid_coverage':sum(valid)/(sum(valid)+len(missing)),
                     'old':grids['old']['summary'],'candidate':grids['candidate']['summary']}
    result['verdict']='현 모델 깊이 비채택으로 시험 완료: 눈 간격 불일치와 깊이 빈칸이 남아 기존 정본 및 앱 깊이 유지' if not all(v['pass'] for v in result['canonical_checks']) else '치수 조건만 통과; 깊이 정확도 및 실제 화면 시각검수 별도'
    (OUT/'계측결과.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'깊이비교격자.json').write_text(json.dumps(grids,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'iou':result['iou'],'checks':result['canonical_checks'],'depth':result['depth'],'verdict':result['verdict']},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
