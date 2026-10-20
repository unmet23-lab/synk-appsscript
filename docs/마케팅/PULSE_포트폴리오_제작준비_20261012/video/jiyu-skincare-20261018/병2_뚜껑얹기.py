# 지유 새 병(병 2) 컷 2 · 6의 뚜껑만 바꾸기(10-20 v5 Fable P2).
# 블렌더 뚜껑 「alu」(Metallic 1 · 거칠기 0.3)는 어두운 주변을 흐리게 비춰 속 심이 비치는 젖빛 유리처럼 보였고, 손 장면(키프레임)
# 뚜껑은 불투명 무광 은회색이라 컷 6 → 7에서 다른 병으로 읽혔다. 블렌더/병_장면.py --cap2 satin(금속 1 · 거칠기 0.5 · 바탕 0.62)으로
# 뚜껑 둘레 칸만 렌더(--border)해 기존 최종 프레임에 얹는다(48장씩 다시 렌더하면 GPU를 다른 세션 학습과 나눠 1시간 남짓):
#   컷 2: 카메라 고정이라 1번 한 장(뚜껑 · 목 고리 칸, 첫 프레임 물방울은 y≈833로 칸 밖)을 48장 모두와 「숨」(컷2_soom_0001)에
#   컷 6: 4% 밀어 들어가 프레임마다(뚜껑은 1~48번에 걸쳐 커진다)
#   칸 가장자리 16px는 부드럽게 섞는다(테두리 렌더는 가장자리에서 잡음 제거가 조금 다르다). 원본은 최종_세트2_병2/원본_뚜껑alu/
#   렌더: blender -b --python 블렌더/병_장면.py -- --cut 2 --quality final --device GPU --set 2 --bottle 2 --frames 1 --border 330,170,860,800 --out <V>/블렌더/뚜껑_satin
#         blender -b --python 블렌더/병_장면.py -- --cut 6 --quality final --device GPU --set 2 --bottle 2 --border 410,480,670,790 --out <V>/블렌더/뚜껑_satin
#   python 병2_뚜껑얹기.py [--확인만]   (--확인만: 바꾸지 않고 컷 2 · 6 첫 · 끝 프레임 전후를 …/블렌더/뚜껑_satin/_확인.jpg로)
import glob
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
V = os.path.join(os.environ["USERPROFILE"], "Documents", "synk-vendor", "jiyu-skincare-20261018")
FIN = os.path.join(V, "블렌더", "최종_세트2_병2")
NEW = os.path.join(V, "블렌더", "뚜껑_satin")
KEEP = os.path.join(FIN, "원본_뚜껑alu")
W, H, EDGE = 1080, 1920, 16
BOX = {"컷2": (330, 170, 860, 800), "컷6": (410, 480, 670, 790)}


def mask(box):
    x0, y0, x1, y1 = box
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).rectangle((x0 + EDGE, y0 + EDGE, x1 - EDGE, y1 - EDGE), fill=255)
    a = np.asarray(m.filter(ImageFilter.GaussianBlur(EDGE / 2.5)), np.float32) / 255
    out = np.zeros_like(a)
    out[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    return out


def jobs():
    """(원본 프레임, 새 칸 렌더, 칸 이름)"""
    out = []
    for i in range(1, 49):
        out.append((f"컷2_{i:04d}.png", "컷2_0001.png", "컷2"))
    out.append(("컷2_soom_0001.png", "컷2_0001.png", "컷2"))
    for i in range(1, 49):
        out.append((f"컷6_{i:04d}.png", f"컷6_{i:04d}.png", "컷6"))
    return out


def blend(old, new, m):
    a = np.asarray(old, np.float32)
    b = np.asarray(new, np.float32)
    return Image.fromarray((a * (1 - m[..., None]) + b * m[..., None]).clip(0, 255).round().astype(np.uint8))


def main():
    only_check = "--확인만" in sys.argv
    masks = {k: mask(b) for k, b in BOX.items()}
    todo = jobs()
    for name, new, _ in todo:
        assert os.path.exists(os.path.join(NEW, new)), f"새 칸 렌더 없음: {new}"
        assert os.path.exists(os.path.join(KEEP if os.path.exists(os.path.join(KEEP, name)) else FIN, name)), f"원본 없음: {name}"
    if only_check:
        tiles = []
        for name, new, k in [todo[0], todo[47], todo[49], todo[-1]]:
            src = os.path.join(KEEP if os.path.exists(os.path.join(KEEP, name)) else FIN, name)
            old = Image.open(src).convert("RGB")
            fixed = blend(old, Image.open(os.path.join(NEW, new)).convert("RGB"), masks[k])
            x0, y0, x1, y1 = BOX[k]
            for im in (old, fixed):
                t = im.crop((x0 - 40, y0 - 40, x1 + 40, y1 + 40))
                tiles.append(t.resize((round(t.width * 520 / t.height), 520), Image.LANCZOS))
        S = Image.new("RGB", (sum(t.width + 8 for t in tiles), 520), (24, 24, 24))
        x = 0
        for t in tiles:
            S.paste(t, (x, 0))
            x += t.width + 8
        out = os.path.join(NEW, "_확인.jpg")
        S.save(out, quality=90)
        print(out)
        return
    os.makedirs(KEEP, exist_ok=True)
    edge_diff = []
    for name, new, k in todo:
        keep = os.path.join(KEEP, name)
        if not os.path.exists(keep):
            shutil.copy2(os.path.join(FIN, name), keep)
        old = Image.open(keep).convert("RGB")
        nw = Image.open(os.path.join(NEW, new)).convert("RGB")
        x0, y0, x1, y1 = BOX[k]
        band = np.zeros((H, W), bool)  # 칸 안쪽 가장자리 띠(뚜껑 밖) — 새 렌더와 원본이 얼마나 같은지
        band[y0 + 4:y1 - 4, x0 + 4:x0 + 24] = True
        band[y0 + 4:y1 - 4, x1 - 24:x1 - 4] = True
        edge_diff.append(float(np.abs(np.asarray(old, np.float32)[band] - np.asarray(nw, np.float32)[band]).mean()))
        blend(old, nw, masks[k]).save(os.path.join(FIN, name))
    print(f"{len(todo)}장 뚜껑 바꿈 → {FIN} (원본 {KEEP}) · 칸 가장자리 띠 원본과 차 평균 {np.mean(edge_diff):.2f} · 최대 {max(edge_diff):.2f}")


if __name__ == "__main__":
    main()
