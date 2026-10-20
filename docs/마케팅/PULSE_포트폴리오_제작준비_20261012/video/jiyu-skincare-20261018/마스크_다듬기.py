# 지유 세트 2 · 피부손 마스크 다듬기(10-20): 컷 안에서 켜졌다 꺼졌다 하는 큰 덩어리(얼굴 · 볼에 댄 손이 아닌 「다른 쪽 팔」)를 모든 프레임에서 뺀다.
#   찾은 것: 훅 C는 오른쪽 아래 팔뚝(4만 화소)이 31~44번에서 한 프레임씩 켜졌다 꺼짐, 컷 4(가지 지운 뒤 다시 만든 마스크)는
#   왼쪽 팔(5.8만 화소)이 14번부터 갑자기 들어옴. +0.2스톱이 그 팔에서 깜빡이고, 부분보정.마스크()가 이웃 프레임을 무게중심으로
#   맞춰 섞을 때 덩어리 때문에 무게중심이 수십 px 움직여 얼굴 테두리까지 어긋나게 섞인다.
#   방법: 프레임마다 0.5 넘는 자리의 「있는 비율」 F를 재고, 0.05 < F < 0.95인 자리 가운데 두께 40px 넘는 큰 덩어리(2만 화소 이상)만
#   골라(움직이는 얼굴 테두리의 가는 띠는 열림 연산으로 빠짐) 넓힌 뒤 모든 프레임에서 0으로. 원본은 <컷>_피부손/마스크_원본/에 둔다.
#   부분보정.마스크_준비는 원본(업스케일 프레임) 지문과 장수만 보므로 다듬은 마스크를 다시 덮지 않는다 — 원본 프레임이 바뀌면 다시 돌릴 것.
#   python 마스크_다듬기.py [컷 …]   (기본: 세트 2 얼굴 컷 다섯) [--확인만]
import os
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
MASKS = Path(os.environ["USERPROFILE"]) / "Documents" / "synk-vendor" / "jiyu-skincare-20261018" / "색감" / "마스크"
CUTS = ["컷1_세트2", "컷4_세트2", "컷5_세트2", "컷7_세트2", "훅C_세트2"]
OPEN_R, GROW, MIN_AREA = 20, 14, 20000


def load(folder):
    files = sorted(folder.glob("*.png"))
    return files, np.stack([np.asarray(Image.open(f).convert("L"), np.uint8) for f in files])


def ious(stack):
    b = stack > 127
    return [1.0] + [float((b[i] & b[i - 1]).sum() / max(1, (b[i] | b[i - 1]).sum())) for i in range(1, len(b))]


def blobs(stack):
    F = (stack > 127).mean(axis=0)
    uns = ((F > 0.05) & (F < 0.95)).astype(np.uint8) * 255
    im = Image.fromarray(uns)
    k = 2 * OPEN_R + 1
    opened = np.asarray(im.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))) > 127
    # 덩어리별 넓이(작은 것은 둔다)
    try:
        import cv2
        n, lab, st, _ = cv2.connectedComponentsWithStats(opened.astype(np.uint8), 8)
        keep = np.zeros_like(opened)
        found = []
        for j in range(1, n):
            if st[j, cv2.CC_STAT_AREA] >= MIN_AREA:
                keep |= lab == j
                found.append((int(st[j, cv2.CC_STAT_LEFT]), int(st[j, cv2.CC_STAT_TOP]), int(st[j, cv2.CC_STAT_WIDTH]),
                              int(st[j, cv2.CC_STAT_HEIGHT]), int(st[j, cv2.CC_STAT_AREA])))
    except ImportError:
        keep, found = opened, [("cv2 없음", int(opened.sum()))]
    grown = np.asarray(Image.fromarray(keep.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * GROW + 1))) > 127
    return grown, found, F


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only_check = "--확인만" in sys.argv
    for c in args or CUTS:
        folder = MASKS / f"{c}_피부손" / "마스크"
        backup = MASKS / f"{c}_피부손" / "마스크_원본"
        src = backup if backup.exists() and len(list(backup.glob("*.png"))) == len(list(folder.glob("*.png"))) else folder
        files, stack = load(src)
        before = ious(stack)
        B, found, F = blobs(stack)
        out = stack.copy()
        out[:, B] = 0
        after = ious(out)
        print(f"{c}: {len(files)}장 · 뺄 덩어리 {found} · 이웃 겹침 최저 {min(before):.3f} → {min(after):.3f} · "
              f"넓이 {int((stack > 127).sum(axis=(1, 2)).min())}~{int((stack > 127).sum(axis=(1, 2)).max())} → "
              f"{int((out > 127).sum(axis=(1, 2)).min())}~{int((out > 127).sum(axis=(1, 2)).max())}", flush=True)
        if only_check or not B.any():
            continue
        if src == folder:
            backup.mkdir(exist_ok=True)
            for f in files:
                shutil.copy2(f, backup / f.name)
        for f, m in zip(sorted(folder.glob("*.png")), out):
            Image.fromarray(m).save(f)


if __name__ == "__main__":
    main()
