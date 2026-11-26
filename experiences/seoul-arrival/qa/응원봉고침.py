# 서울행 아이돌 객석(arena-seats.webp) 응원봉 고침(팬설계 「내 팬」 남은 일 ④, 11-27).
# 모자 쓴 남자(자리 2)의 머리 옆에 손 없이 떠 있던 응원봉은 원래 그 뒤 11번 자리 사람이 쥔 것이다(손이 그 조각에 있다).
#  1) 그 응원봉을 같은 바탕 자리 그대로 11번 자리 조각으로 옮긴다.
#  2) 남자에게는 같은 응원봉을 가슴 앞에 쥐여 준다. 알의 왼쪽은 원래 얼굴에 가려 잘려 있어 오른쪽을 뒤집어 채우고,
#     막대 아래는 앞사람 머리 윤곽(밝은 테두리 줄)부터 원래 칸으로 덮어 손이 그 뒤에 있는 것으로 읽히게 한다.
#   python experiences/seoul-arrival/qa/응원봉고침.py <원본 webp> <data.mjs> <출력 webp> [미리보기 폴더]
import sys,re,json,io
import numpy as np
from PIL import Image
from scipy import ndimage
# src: 고치기 전 판(git show <고친 커밋>~1:experiences/seoul-arrival/assets/img/arena-seats.webp)
src,data,dst=sys.argv[1:4]; prev=sys.argv[4] if len(sys.argv)>4 else None
A=json.loads(re.search(r'export const ARENA=(\{.*?\});',open(data,encoding='utf-8').read(),re.S).group(1))
x2,y2,w2,h2,sx2,sy2=A['seats'][2]; x11,y11,w11,h11,sx11,sy11=A['seats'][11]
orig=np.array(Image.open(src).convert('RGBA')); sp=orig.copy()
P=orig[sy2:sy2+h2,sx2:sx2+w2]
yy,xx=np.mgrid[0:h2,0:w2]; L=P[...,:3].astype(int).mean(-1)
box=(xx>=169)&(xx<=212)&(yy>=112)&(yy<=183)
lab,_=ndimage.label(box&(P[...,3]>0)&(L>40))
stick=np.isin(lab,list({lab[133,191],lab[170,190]}-{0}))
remove=stick|(box&(xx>=172)&(P[...,3]>0))
def over(d,s):
    a=s[3]/255.0;o=d.astype(float).copy();o[:3]=s[:3]*a+d[:3]*(1-a);o[3]=max(d[3],s[3]);return o.astype(np.uint8)
# 응원봉 한 장(투명 바탕): 원래 칸 + 알 왼쪽을 오른쪽에서 뒤집어 채움(알의 가운데 x=187)
T=np.zeros_like(P); T[stick]=P[stick]
C=187
for y in range(112,156):
    xs=np.where(stick[y])[0]
    if not len(xs): continue
    right=xs.max()
    for x in range(max(0,2*C-right),174):   # 169~173은 뺨 가장자리가 섞인 칸이라 함께 뒤집어 채운다
        m=2*C-x
        if 0<=m<w2 and stick[y,m]: T[y,x]=P[y,m]
ty,tx=np.where(T[...,3]>0)
# 1) 남자 조각: 머리 옆 응원봉을 지우고 가슴 앞에 쥐여 준다
Q=P.copy(); Q[remove]=0
dy=228-133   # 알 높이 가운데(133)를 y=228에
dx=126-C   # 알의 가운데(187)를 x=126에
for py,px in zip(ty,tx):
    ny,nx=py+dy,px+dx
    if 0<=ny<h2 and 0<=nx<w2: Q[ny,nx]=over(Q[ny,nx],T[py,px])
# 앞사람 머리: 칸마다 255~290 사이에서 처음 밝은 테두리(L≥28)가 나오는 줄부터 아래를 원래 칸으로 되돌린다(응원봉이 닿는 x만)
cols=sorted(set(int(x) for x in tx+dx if 0<=x+0<w2))
for x in cols:
    rim=next((y for y in range(255,291) if P[y,x,3]>200 and L[y,x]>=28),None)
    if rim is not None: Q[rim:,x]=P[rim:,x]
sp[sy2:sy2+h2,sx2:sx2+w2]=Q
# 2) 11번 자리 조각: 원래 응원봉을 같은 바탕 자리로(뒤집어 채운 칸은 넣지 않는다 — 원래처럼 남자 뺨 뒤에 있다)
R=sp[sy11:sy11+h11,sx11:sx11+w11]
sy_,sx_=np.where(stick)
for py,px in zip(sy_,sx_):
    lx,ly=x2+px-x11,y2+py-y11
    if 0<=lx<w11 and 0<=ly<h11: R[ly,lx]=over(R[ly,lx],P[py,px])
diff=np.any(sp!=orig,axis=-1);dys,dxs=np.where(diff)
inside=lambda X,Y,r:(r[4]<=X<r[4]+r[2]) and (r[5]<=Y<r[5]+r[3])
assert all(inside(X,Y,A['seats'][2]) or inside(X,Y,A['seats'][11]) for Y,X in zip(dys,dxs)),'두 조각 밖이 바뀌었다'
buf=io.BytesIO();Image.fromarray(sp).save(buf,'WEBP',quality=95,method=6,alpha_quality=100);open(dst,'wb').write(buf.getvalue())
print('바뀐 칸',int(diff.sum()),'크기',len(buf.getvalue()))
if prev:
    sp2=Image.open(io.BytesIO(buf.getvalue())).convert('RGBA');p=sp2.crop((sx2+60,sy2+90,sx2+213,sy2+300))
    bg=Image.new('RGBA',p.size,(60,60,60,255));bg.alpha_composite(p);bg.resize((p.width*3,p.height*3),Image.NEAREST).convert('RGB').save(prev+'/zoom_fix2.png')
