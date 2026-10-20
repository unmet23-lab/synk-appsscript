# 지유 세트 2 · 손에 든 병 컷(컷7손_세트2): 병 인쇄 글자 얹기(10-20).
# H3(768×1344)가 작은 글자를 뭉개고 SeedVR2가 그 자리를 엉뚱한 글자 모양으로 다시 그렸다 — 「malgeum」 · 「약산성 무향 토너」 ·
# 「pH 5.5 · 150 ml」가 깨지고 「맑음」 획도 겹선처럼 일그러짐. 끝 프레임은 시작 그림(키프레임_세트2/컷7손_틀.jpg, 글자 맞음)에
# 고정돼 있으니 그 키프레임을 프레임마다 병 둘레에 맞춰 글자 두 덩어리만 덮는다(연기는 그대로 두고 물건만 한 장 판으로).
#   ① 키프레임 → 1080×1920(본편_편집.fit과 같게) ② 프레임마다 병 둘레 ECC 아핀(끝 프레임부터 거꾸로, 앞 값에서 시작)
#   ③ 글자 덩어리 사각형(부드러운 가장자리)만 섞고, 둘레 띠 평균 색에 판을 맞춤(컷4_가지지우기.py와 같은 식)
#   ④ 피부손 마스크는 병을 뺀 것이라 글자 자리와 겹치지 않는다(겹치면 멈춤) → 마스크 기록의 원본 지문만 새 프레임으로 고친다
#      (프레임 PNG가 바뀌면 본편_편집.py가 SAM으로 마스크를 다시 만들려 한다 — GPU는 다른 세션 학습 중)
#   python 컷7손_글자얹기.py [--확인만]   → 업/컷7손_세트2/컷7손_세트2/ 를 고친 프레임으로, 원본은 업/컷7손_세트2/원본_글자깨짐/
#   --확인만: 바꾸지 않고 0 · 24 · 47번의 병 자리 전후를 3배로(…/영상_H3/컷7손_글자얹기_확인.jpg)
import glob
import json
import os
import shutil
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "색감"))
import 부분보정  # noqa: E402  (마스크 기록의 원본 지문)

V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
H3 = os.path.join(V, "영상_H3")
KEY = os.path.join(V, "키프레임_세트2", "컷7손_틀.jpg")
UPD = os.path.join(H3, "업", "컷7손_세트2", "컷7손_세트2")
KEEP = os.path.join(H3, "업", "컷7손_세트2", "원본_글자깨짐")
MASK_DIR = os.path.join(V, "색감", "마스크", "컷7손_세트2_피부손")
W, H, N = 1080, 1920, 72
# 프레임 좌표(1080×1920) 글자 덩어리: 「맑음 · malgeum」(x 310~375 · y 1002~1067)과 아래 두 줄(x 320~383 · y 1231~1255)에 5~8px 여유
# 아래 덩어리 왼쪽은 302까지: 0번 피부손 마스크가 깨진 글자를 잡은 자리(x 302~390)까지 판으로 덮는다. 상자는 모두 병 유리 위
# (손가락 x<300, 얼굴 x>400)라 피부가 없다
BOXES = [(302, 995, 382, 1073), (302, 1220, 395, 1265)]
SOFT = 4          # 사각형 가장자리 부드럽게(가우스 시그마, px)
ROI = (150, 700, 560, 1500)  # 병 · 손 둘레(ECC를 이 안에서만)
CRIT = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)


def keyframe():
    k = Image.open(KEY).convert("RGB")
    s = W / k.width
    k = k.resize((W, round(k.height * s)), Image.LANCZOS)
    top = (k.height - H) // 2
    return np.asarray(k.crop((0, top, W, top + H)), np.float32)


def gray(a):
    return cv2.GaussianBlur(cv2.cvtColor(a.clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32), (0, 0), 1.5)


def align(K, F, M):
    """키프레임 K를 프레임 F에 맞추는 아핀(K를 WARP_INVERSE_MAP으로 펴면 F 자리). M은 시작값."""
    roi = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = ROI
    roi[y0:y1, x0:x1] = 255
    cc, M = cv2.findTransformECC(gray(F), gray(K), M.copy(), cv2.MOTION_AFFINE, CRIT, roi, 5)
    return cc, M


def first_guess(K, F):
    M = np.eye(2, 3, dtype=np.float32)
    small = lambda a: cv2.resize(a, (W // 4, H // 4), interpolation=cv2.INTER_AREA)  # noqa: E731
    _, M = cv2.findTransformECC(small(gray(F)), small(gray(K)), M, cv2.MOTION_AFFINE, CRIT, None, 5)
    M[:, 2] *= 4
    return M


def box_mask():
    m = np.zeros((H, W), np.float32)
    for x0, y0, x1, y1 in BOXES:
        m[y0:y1, x0:x1] = 1.0
    return cv2.GaussianBlur(m, (0, 0), SOFT)


def patch(F, K, M, mask):
    Kw = cv2.warpAffine(K, M, (W, H), flags=cv2.INTER_LANCZOS4 + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    out = F.copy()
    gains = []
    for x0, y0, x1, y1 in BOXES:  # 덩어리마다 둘레 띠(사각형 밖 6~14px)의 평균 색에 판을 맞춘다
        X0, Y0, X1, Y1 = x0 - 14, y0 - 14, x1 + 14, y1 + 14
        ring = np.zeros((H, W), bool)
        ring[Y0:Y1, X0:X1] = True
        ring[y0 - 6:y1 + 6, x0 - 6:x1 + 6] = False
        gain = (F[ring].mean(0) + 1) / (Kw[ring].mean(0) + 1)
        gains.append(gain)
        sl = (slice(Y0, Y1), slice(X0, X1))
        m = mask[sl][..., None]
        out[sl] = F[sl] * (1 - m) + (Kw[sl] * gain) * m
    return out, gains


def load(f):
    return np.asarray(Image.open(f).convert("RGB"), np.float32)


def main():
    only_check = "--확인만" in sys.argv
    src_dir = KEEP if (os.path.isdir(KEEP) and len(glob.glob(os.path.join(KEEP, "*.png"))) == N) else UPD  # 다시 돌릴 땐 원본에서
    files = sorted(glob.glob(os.path.join(src_dir, "컷7손_세트2_*.png")))
    assert len(files) == N, f"프레임 {len(files)}장({N}장이어야 함)"
    K = keyframe()
    mask = box_mask()
    # 피부손 마스크: 아래 두 줄 뒤로는 유리 너머 손바닥이 비쳐 프레임마다 옅게(0.1~0.28) 잡힌다 — 그건 그대로 둔다.
    # 10-20 첫 판은 0번 한 장만 깨진 글자까지 손으로 잡아 0.46으로 튀었다 → 글자 자리 안에서 앞뒤 프레임(±2) 중앙값보다
    # 30 넘게 튀는 화소만 그 중앙값으로(원본은 마스크_원본/) — 마스크_다듬기.py처럼 깜빡이는 덩어리만 정리
    mfiles = sorted(glob.glob(os.path.join(MASK_DIR, "마스크", "*.png")))
    near = np.zeros((H, W), bool)
    for x0, y0, x1, y1 in BOXES:  # 상자 안쪽 + 3px(그 밖 손가락 · 얼굴은 진짜 피부)
        near[y0 - 3:y1 + 3, x0 - 3:x1 + 3] = True
    ms = [np.asarray(Image.open(f).convert("L"))[near].astype(np.int16) for f in mfiles]
    hit = []
    for i, f in enumerate(mfiles):
        med = np.median(np.stack(ms[max(0, i - 2):i + 3]), axis=0)
        spike = ms[i] - med > 30
        if spike.any():
            hit.append((f, int(spike.sum()), int(ms[i].max()), med))
    print(f"글자 자리에서 튀는 피부손 마스크 {len(hit)}장 {[(os.path.basename(f), n, v) for f, n, v, _ in hit]}")
    if len(hit) > 3:
        raise SystemExit("글자 자리 마스크가 여러 프레임에서 튐 — 마스크를 다시 봐야 함")
    # 끝 프레임(시작 그림에 고정)부터 거꾸로 맞춘다: 47 → 0, 48~71은 47과 같은 그림
    last = N - 1
    Ms, ccs = {}, {}
    Ff = load(files[last])
    M = first_guess(K, Ff)
    for i in range(last, -1, -1):
        F = Ff if i == last else load(files[i])
        cc, M = align(K, F, M)
        Ms[i], ccs[i] = M.copy(), cc
    lo = min(ccs, key=ccs.get)
    shift = [float(np.hypot(*(Ms[i][:, 2] - Ms[last][:, 2]))) for i in range(N)]
    print(f"ECC 상관 {min(ccs.values()):.4f}(#{lo}) ~ {max(ccs.values()):.4f} · 끝 프레임 대비 판 이동 최대 {max(shift):.2f}px(#{int(np.argmax(shift))})")
    if min(ccs.values()) < 0.98:
        raise SystemExit("ECC 상관이 낮음 — 맞춤을 다시 봐야 함")
    if only_check:
        tiles = []
        x0, y0, x1, y1 = 280, 975, 420, 1280
        for i in (0, 24, last):
            F = load(files[i])
            out, gains = patch(F, K, Ms[i], mask)
            print(f"  #{i} 색 맞춤 {[np.round(g, 3).tolist() for g in gains]}")
            for a in (F, out):
                tiles.append(Image.fromarray(a[y0:y1, x0:x1].clip(0, 255).round().astype(np.uint8)).resize(((x1 - x0) * 3, (y1 - y0) * 3), Image.LANCZOS))
        S = Image.new("RGB", (len(tiles) * (tiles[0].width + 8), tiles[0].height + 30), (24, 24, 24))
        d = ImageDraw.Draw(S)
        for j, (t, name) in enumerate(zip(tiles, ["#0 전", "#0 후", "#24 전", "#24 후", "#47 전", "#47 후"])):
            S.paste(t, (j * (t.width + 8), 30))
            d.text((j * (t.width + 8) + 6, 8), name, fill=(255, 255, 0))
        out = os.path.join(H3, "컷7손_글자얹기_확인.jpg")
        S.save(out, quality=92)
        print(out)
        return
    if src_dir == UPD:
        os.makedirs(KEEP, exist_ok=True)
        for f in files:
            shutil.copy2(f, os.path.join(KEEP, os.path.basename(f)))
        files = sorted(glob.glob(os.path.join(KEEP, "컷7손_세트2_*.png")))
    all_gains = []
    for i, f in enumerate(files):
        out, gains = patch(load(f), K, Ms[i], mask)
        Image.fromarray(out.clip(0, 255).round().astype(np.uint8)).save(os.path.join(UPD, os.path.basename(f)))
        all_gains += gains
    g = np.array(all_gains)
    print(f"{N}장 고침 → {UPD} (원본 {KEEP}) · 색 맞춤 범위 {np.round(g.min(0), 3)} ~ {np.round(g.max(0), 3)}")
    for f, _, _, med in hit:
        keep = os.path.join(MASK_DIR, "마스크_원본")
        os.makedirs(keep, exist_ok=True)
        if not os.path.exists(os.path.join(keep, os.path.basename(f))):
            shutil.copy2(f, os.path.join(keep, os.path.basename(f)))
        m = np.asarray(Image.open(f).convert("L")).copy()
        sub = m[near].astype(np.int16)
        m[near] = np.where(sub - med > 30, med, sub).astype(np.uint8)
        Image.fromarray(m).save(f)
    if hit:
        print(f"피부손 마스크 {len(hit)}장의 튀는 글자 자리를 앞뒤 중앙값으로(원본 {os.path.join(MASK_DIR, '마스크_원본')})")
    rec_path = os.path.join(MASK_DIR, "잰값.json")
    rec = json.load(open(rec_path, encoding="utf-8"))
    rec["원본_지문"] = 부분보정._지문(UPD)
    rec["글자얹기"] = "10-20 컷7손_글자얹기.py: 병 글자 자리만 바꿈(피부손 마스크 밖) — 마스크는 그대로 쓰고 지문만 새 프레임으로"
    json.dump(rec, open(rec_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"마스크 기록 지문 고침 → {rec_path}")


if __name__ == "__main__":
    main()
