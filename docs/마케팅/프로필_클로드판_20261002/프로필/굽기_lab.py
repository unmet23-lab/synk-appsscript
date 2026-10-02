"""LAB 프로필 사진(모든 LAB 계정 공통) 굽기.

몽글 정본 4K 컷을 크림 펠트 바탕에 앉힌다. 정본 누끼의 가장자리(떨어진 부스러기, 계단진 알파,
둘레의 검은 털·흰 점)를 다듬은 뒤 바탕에 부드러운 접지 그림자를 그려 넣는다.
네모난 그림자 판이나 덧댄 조각 없이 한 장으로 합친다.

    python 굽기_lab.py            # avatar-lab.png (1080×1080)
    python 굽기_lab.py --컷 본체   # 다른 정본 컷으로 시험
"""
import argparse
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
SRC = os.path.join(ROOT, "docs/캐릭터/정본_4K")
TEX = os.path.join(ROOT, "docs/디자인/펠트부품/assets/배경/tex-cream.webp")
S = 1080


def clean_cutout(path, light=(241, 236, 228)):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255.0
    # 떨어진 부스러기: 가장 큰 덩어리의 0.5%보다 작은 섬은 지운다
    lab, n = ndimage.label(al > 0.04)
    if n > 1:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool)
        keep[1:] = sizes >= sizes.max() * 0.005
        al = al * keep[lab]
    # 안쪽: 윤곽을 메운 실루엣에서 18px 안. 정본은 눈의 빛점과 실밥 사이 틈을 «투명»으로 남겨
    # 밝은 바탕이 비쳐 보이게 만들었다. 그 모습 그대로 밝은 색을 깔고 불투명하게 굳힌다
    # (투명한 픽셀의 색은 검정으로 저장돼 있어, 알파만 올리면 검은 점이 된다).
    silhouette = ndimage.binary_fill_holes(ndimage.binary_closing(al > 0.5, iterations=3))
    core = ndimage.binary_erosion(silhouette, iterations=18)
    lit = rgb * al[..., None] + np.array(light, np.float32) * (1 - al[..., None])
    rgb = np.where(core[..., None], lit, rgb)
    al = np.where(core, 1.0, al)
    # 둘레 띠: 반투명 픽셀의 검은 색을 불투명한 이웃 색으로 바꿔 둔 뒤,
    # 몸 색과 다른 픽셀(밝은 네모 조각·검은 털)은 걷고 몸 색 솜털만 남긴다
    valid = al > 0.5
    ok = valid.astype(np.float32)
    bleed = np.zeros_like(rgb)
    for sig in (48, 16, 4):  # 넓게 번진 색 위에 가까운 색을 덮는다
        wk = ndimage.gaussian_filter(ok, sig)
        col = np.stack([ndimage.gaussian_filter(rgb[..., c] * ok, sig) for c in range(3)], -1) / (wk[..., None] + 1e-6)
        bleed = np.where((wk > 0.02)[..., None], col, bleed)
    rgb = np.where(valid[..., None], rgb, bleed)
    mc = core.astype(np.float32)
    wc = ndimage.gaussian_filter(mc, 14) + 1e-6
    local = np.stack([ndimage.gaussian_filter(rgb[..., c] * mc, 14) for c in range(3)], -1) / wc[..., None]
    diff = np.sqrt(((rgb - local) ** 2).sum(-1))
    keep = np.where(core, 1.0, np.exp(-((diff / 30.0) ** 2)))
    al = al * keep
    rgb = rgb * keep[..., None] + local * (1 - keep[..., None])
    # 계단진 알파를 살짝 흐린 뒤 다시 조인다
    ab = ndimage.gaussian_filter(al, 1.8)
    al = np.clip((ab - 0.5) * 1.3 + 0.5, 0, 1) * (ab > 0.02)
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8), "RGBA")


def felt_bg(size, scale=1.3, seed=11):
    """반복 무늬가 보이지 않는 크림 펠트 바탕(tools/펠트결_넓히기.py와 같은 방법)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("wide", os.path.join(ROOT, "tools", "펠트결_넓히기.py"))
    wide = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(wide)
    t = Image.open(TEX)
    t = t.resize((round(t.width * scale), round(t.height * scale)), Image.LANCZOS)
    return wide.synth(t, size, size, seed=seed)


def place(cut, width_frac, eye_y, eye_at=0.33):
    c = cut.crop(cut.getbbox())
    k = width_frac * S / c.width
    c = c.resize((round(c.width * k), round(c.height * k)), Image.LANCZOS)
    return c, (round(S / 2 - c.width / 2), round(S * eye_y - c.height * eye_at))


def shadow(bg, cut, pos, strength=0.26, blur=16, dy=10, ao=0.32):
    al = Image.new("L", bg.size, 0)
    al.paste(cut.getchannel("A"), pos)
    a = np.asarray(al).astype(np.float32) / 255
    soft = ndimage.shift(ndimage.gaussian_filter(a, blur), (dy, 0), order=1)
    tight = ndimage.shift(ndimage.gaussian_filter(a, 4), (3, 0), order=1)
    mul = 1 - np.clip(soft * strength + tight * ao * (1 - a), 0, 0.6)
    return Image.fromarray(np.clip(np.asarray(bg).astype(np.float32) * mul[..., None], 0, 255).astype(np.uint8))


def bake(cut_name="놀람", width_frac=0.86, eye_y=0.42):
    cut = clean_cutout(os.path.join(SRC, f"몽글_{cut_name}.png"))
    c, pos = place(cut, width_frac, eye_y)
    bg = shadow(felt_bg(S), c, pos).convert("RGBA")
    bg.alpha_composite(c, pos)
    return bg.convert("RGB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--컷", default="놀람")
    ap.add_argument("--out", default=os.path.join(HERE, "avatar-lab.png"))
    args = ap.parse_args()
    bake(args.컷).save(args.out, optimize=True)
    print(args.out)
