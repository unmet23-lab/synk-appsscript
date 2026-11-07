# 10번 도담중공업 — 얼굴 컷 편집 뒤 얼굴 되돌림(2026-11-07, Claude). 이 편의 나눔(02_콘티 7절 · 장부 S37): 얼굴 없는 컷 = GPT 이미지 2.5, 준호 얼굴 컷 = Gemini 나노바나나.
# 터빈을 발전용으로 바꾸려고 얼굴 컷(16 · 30)까지 GPT로 편집하자 얼굴도 다시 그려졌다(원래 그림 대비 SFace 0.63~0.69) → Gemini로 만든 원래 시작 그림의 준호 화소를
# 새 그림에 되돌려 얹는다: 원래 그림을 새 그림 크기로 줄이고, 사람 둘레의 특징점으로 닮음 변환을 맞춘 뒤, rembg 사람 오리기(u2net_human_seg)로 사람만 가려 가장자리를 섞는다.
#   C:/SYNK-LoRA/tools/demucs/venv/Scripts/python.exe 얼굴되돌림.py <원래> <새> <출력> <사람 자리 x0,y0,x1,y1(0~1, 특징점 찾을 곳)>
import sys

import cv2
import numpy as np
from rembg import new_session, remove


def rd(p):
    return cv2.imdecode(np.fromfile(p, np.uint8), cv2.IMREAD_COLOR)


orig_p, new_p, out_p, box = sys.argv[1], sys.argv[2], sys.argv[3], [float(v) for v in sys.argv[4].split(",")]
new = rd(new_p)
H, W = new.shape[:2]
orig = cv2.resize(rd(orig_p), (W, H), interpolation=cv2.INTER_AREA)

# 사람 둘레에서 특징점 맞춤(기계가 바뀐 자리는 빼고) → 원래 그림을 새 그림 자리로 옮기는 닮음 변환
x0, y0, x1, y1 = int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)
roi = np.zeros((H, W), np.uint8)
roi[y0:y1, x0:x1] = 255
sift = cv2.SIFT_create(4000)
ga, gb = cv2.cvtColor(orig, cv2.COLOR_BGR2GRAY), cv2.cvtColor(new, cv2.COLOR_BGR2GRAY)
ka, da = sift.detectAndCompute(ga, roi)
kb, db = sift.detectAndCompute(gb, roi)
m = cv2.BFMatcher().knnMatch(da, db, k=2)
good = [a for a, b in m if a.distance < 0.7 * b.distance]
src = np.float32([ka[g.queryIdx].pt for g in good])
dst = np.float32([kb[g.trainIdx].pt for g in good])
M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=2.0)
sc = float(np.hypot(M[0, 0], M[0, 1]))
print(f"맞춤점 {len(good)} · 들어맞음 {int(inl.sum())} · 배율 {sc:.4f} · 옮김 ({M[0, 2]:.1f}, {M[1, 2]:.1f})")
warped = cv2.warpAffine(orig, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)

# 준호만 가리기(옮긴 원래 그림에서) — 사람 오리기 모델, 상자 밖은 0
sess = new_session("u2net_human_seg")
rgba = remove(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB), session=sess, post_process_mask=True)
mask = rgba[..., 3].astype(np.float32) / 255.0
keep = np.zeros_like(mask)
keep[y0:y1, x0:x1] = 1.0
mask *= keep
mask = (mask > 0.5).astype(np.float32)
mask = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=1)
mask = cv2.GaussianBlur(mask, (0, 0), 1.5)[..., None]
out = (warped.astype(np.float32) * mask + new.astype(np.float32) * (1 - mask)).round().clip(0, 255).astype(np.uint8)
open(out_p, "wb").write(cv2.imencode(".png", out)[1].tobytes())
open(out_p[:-4] + "_가림.png", "wb").write(cv2.imencode(".png", (mask[..., 0] * 255).astype(np.uint8))[1].tobytes())
print("사람 면적", round(float(mask.mean()) * 100, 2), "% →", out_p)
