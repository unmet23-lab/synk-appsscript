# 동네 지도: 까몽만 바꿔 구운 조각을 원본 조각에 맞춰(ECC 닮음 변환) 까몽 둘레 상자만 원본에 되끼운다 — 장소 단추 자리는 원본 화소 그대로.
# 사용: python town_patch.py <이름> <원본 webp> <출력 webp> <상자 x0,y0,x1,y1(조각 비율)[;상자…]>
import os, sys, json, numpy as np, cv2
ROOT = os.path.dirname(os.path.abspath(__file__))
from PIL import Image
name,src,dst=sys.argv[1],sys.argv[2],sys.argv[3]; boxes=[[float(v) for v in b.split(',')] for b in sys.argv[4].split(';')]
plan=json.load(open(os.path.join(ROOT,'town','plan.json'),encoding='utf-8')); kind='port' if 'port' in name else 'land'; x,y,s=plan['crop'][kind]
orig=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
C=orig[y:y+s,x:x+s]
R=np.asarray(Image.open(os.path.join(ROOT,'boards',name+'.png')).convert('RGB').resize((s,s),Image.LANCZOS)).astype(np.float32)
g0=cv2.cvtColor(C.astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)/255; g1=cv2.cvtColor(R.astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)/255
# 까몽 자리를 뺀 곳으로 맞춘다(바뀐 곳이 맞춤을 끌지 않게)
m=np.ones((s,s),np.uint8)
for box in boxes:
    bx=[int(v*s) for v in box]; m[max(0,bx[1]-30):bx[3]+30,max(0,bx[0]-30):bx[2]+30]=0
W=np.eye(2,3,dtype=np.float32)
_,W=cv2.findTransformECC(g0,g1,W,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-6),m,5)
A=cv2.warpAffine(R,W,(s,s),flags=cv2.INTER_LINEAR+cv2.WARP_INVERSE_MAP,borderMode=cv2.BORDER_REFLECT)
# 상자 마스크(가장자리 14칸 부드럽게)
mask=np.zeros((s,s),np.float32)
for box in boxes:
    bx=[int(v*s) for v in box]; mask[bx[1]:bx[3],bx[0]:bx[2]]=1
f=14; mask=cv2.GaussianBlur(mask,(0,0),f/2)
# 상자 밖 바탕의 밝기 차이를 맞춘다(빛 판정 흔들림)
ring=(cv2.dilate((mask>0.02).astype(np.uint8),np.ones((25,25)))>0)&(mask<0.02)
gain=(C[ring].mean(0)+1)/(A[ring].mean(0)+1); A=np.clip(A*gain,0,255)
out=orig.copy(); out[y:y+s,x:x+s]=C*(1-mask[...,None])+A*mask[...,None]
Image.fromarray(out.astype(np.uint8)).save(dst,'WEBP',quality=88,method=6)
d=np.abs(C-A)[ring].mean(); print(name,'맞춤',np.round(W,3).tolist(),'둘레 차이',round(float(d),1),'밝기 보정',np.round(gain,3).tolist())
