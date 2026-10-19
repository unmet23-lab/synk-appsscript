# PULSE 광고 색감(색보정) — 같은 장면에 이름 붙은 색감을 입힌다. 클라이언트가 색감을 골라 납품받는 흐름의 씨앗
# (10-19 유호님 「펄스 클라이언트들이 색감 고르기 편하도록 색감도 추가」, 첫 적용은 지유 스킨케어 광고).
# 순서는 팁 장부 8행(「The Process of Color Grading」 릴스, S-log → … → LUT 8단계)을 Rec.709 AI 영상에 맞춘 것:
#   ① 1차 보정(노출·색온도·대비·채도)  ② 부분 창(창 쪽 그라디언트 빛, 가장자리 어둡게)  ③ 곡선 + 블리치 바이패스
#   ④ 색 나눔(그림자·밝은 곳 색 = LUT 몫)  ⑤ 밝은 곳 눌러 담기  ⑥ 확산(밝은 곳이 부드럽게 번짐)  ⑦ 할레이션(붉은 빛 번짐)
#   ⑧ 안개(검정을 띄우고 옅게 덮음). 로그·색공간 변환은 원본이 이미 Rec.709라 뺀다. 필름 입자는 인코딩 때(ffmpeg noise) 한 번.
#   python 색감.py 비교 <출력.jpg> <그림…> [--색감 원본,맑은아침,…] [--이름 컷1,컷2,…]   → 줄 = 그림, 칸 = 색감
#   python 색감.py 큐브 <색감> <출력.cube>   → ①③④⑤(공간 효과 뺀 색 부분)만 33³ LUT(다빈치·ffmpeg lut3d로 다른 영상에)
# 병 라벨·글자처럼 색이 정해진 겹은 색감을 입힌 뒤에 얹는다(편집 스크립트가 순서를 지킨다).
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# 색감 이름 → 값. 빈 칸은 손대지 않음. 값의 뜻은 grade() 주석.
LOOKS = {
    "원본": {},
    # 지금 화면 그대로에 가깝게: 아주 옅은 따뜻함·밝은 곳 번짐만
    "맑은아침": {"ev": 0.06, "temp": 0.12, "sat": 1.02, "rolloff": 0.86, "window": (0.10, 0.08), "diffusion": 0.25,
                 "vignette": 0.05},
    # 팁 릴스의 결을 스킨케어에 맞게 은은하게: 창 쪽 빛·확산·할레이션·옅은 안개·약한 블리치·청록 그림자/따뜻한 밝은 곳.
    # 10-19 유호님 「필름아침 좋네」(만족 사례 S25) 뒤 Fable P2 반영(v3b): 채도 0.94 → 0.97·블리치 0.14 → 0.10(입술),
    # 확산 0.45 → 0.30·검정 띄우기 0.025 → 0.012·안개 0.05 → 0.04(머리카락이 회색으로 뜨고 윤곽에 빛무리)
    "필름아침": {"ev": 0.03, "temp": 0.16, "contrast": 1.04, "sat": 0.97, "curve": 0.22, "bleach": 0.10,
                 "split": ((-0.012, 0.004, 0.018), (0.022, 0.008, -0.016)), "rolloff": 0.82, "window": (0.14, 0.12),
                 "diffusion": 0.30, "halation": 0.10, "haze": (0.04, (0.97, 0.96, 0.94), 0.6), "lift": 0.012,
                 "vignette": 0.12},
    # 청록·주황 영화 색: 색 나눔과 대비를 세게
    "시네마청록": {"temp": 0.05, "contrast": 1.12, "sat": 1.04, "curve": 0.30, "bleach": 0.08,
                   "split": ((-0.035, 0.012, 0.045), (0.045, 0.012, -0.035)), "rolloff": 0.84, "window": (0.08, 0.05),
                   "diffusion": 0.25, "halation": 0.14, "lift": 0.015, "vignette": 0.18},
    # 늦은 오후 햇빛: 노랗게 따뜻하고 부드럽게
    "따뜻한오후": {"ev": 0.02, "temp": 0.42, "tint": 0.05, "sat": 1.06, "curve": 0.15, "rolloff": 0.84,
                   "window": (0.16, 0.20), "diffusion": 0.40, "halation": 0.08, "haze": (0.04, (1.0, 0.95, 0.86), 0.4),
                   "vignette": 0.10},
    # 차분한 무채: 채도를 빼고 블리치 바이패스로 단단하게(프리미엄·남성 그루밍 쪽). 차갑게 하면 입술이 보라로 가서 색온도는 그대로
    "차분한무채": {"contrast": 1.08, "sat": 0.80, "curve": 0.24, "bleach": 0.28, "rolloff": 0.86,
                   "split": ((-0.010, 0.0, 0.014), (0.008, 0.004, -0.004)), "lift": 0.02, "vignette": 0.14},
}
LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
_MAPS = {}


def _luma(x):
    return x @ LUMA


def _red(x):
    """붉은 정도(입술·볼) 0~1: R이 G·B보다 얼마나 큰지. 탈색에서 입술을 지킨다(10-19 Fable P2 — 지유 v3 입술 채도 38 → 29)."""
    return np.clip((x[..., 0] - np.maximum(x[..., 1], x[..., 2])) / 0.22, 0, 1)[..., None]


def color_part(x, p):
    """공간과 상관없는 색 부분(LUT로도 뽑는 ①③④⑤). x: …×3, 0~1(감마 적용된 화면 값)."""
    ev, temp, tint = p.get("ev", 0.0), p.get("temp", 0.0), p.get("tint", 0.0)
    if ev or temp or tint:  # ① 노출·색온도는 빛의 양이라 선형에서
        lin = np.power(np.clip(x, 0, 1), 2.2) * (2.0 ** ev)
        lin = lin * np.array([1 + 0.07 * temp, 1 - 0.04 * tint, 1 - 0.07 * temp], dtype=np.float32)
        x = np.power(np.clip(lin, 0, None), 1 / 2.2)
    c = p.get("contrast", 1.0)
    if c != 1.0:
        x = (x - 0.45) * c + 0.45
    s = p.get("sat", 1.0)
    if s != 1.0:  # 붉은 곳(입술)은 채도를 절반만 뺀다
        L = _luma(x)[..., None]
        x = L + (x - L) * (s + (1 - s) * 0.5 * _red(x))
    x = np.clip(x, 0, 1)
    k = p.get("curve", 0.0)
    if k:  # ③ S자 곡선
        x = x + k * (x * x * (3 - 2 * x) - x)
    b = p.get("bleach", 0.0)
    if b:  # ③ 블리치 바이패스: 밝기 겹을 오버레이로 얹고 채도를 덜어 낸다
        L = _luma(x)[..., None]
        ov = np.where(x < 0.5, 2 * x * L, 1 - 2 * (1 - x) * (1 - L))
        x = x + b * (ov - x)
        L = _luma(x)[..., None]
        x = L + (x - L) * (1 - 0.5 * b * (1 - 0.5 * _red(x)))  # 붉은 곳은 탈색 절반
    sp = p.get("split")
    if sp:  # ④ 그림자·밝은 곳에 다른 색(이 색감의 「LUT」 몫). 거의 흰 곳(병·흰 벽·흰 티)은 희게 남긴다
        L = np.clip(_luma(x), 0, 1)[..., None]
        keep_white = 1 - np.clip((L - 0.82) / 0.13, 0, 1) ** 2
        x = x + ((1 - L) ** 2) * np.array(sp[0], dtype=np.float32) + (L ** 2) * keep_white * np.array(sp[1], dtype=np.float32)
    r = p.get("rolloff")
    if r:  # ⑤ 밝은 곳을 하얗게 날리지 않고 눌러 담기
        x = np.where(x > r, r + (1 - r) * np.tanh((x - r) / (1 - r)), x)
    return np.clip(x, 0, 1)


def _maps(w, h, p):
    key = (w, h, p.get("window"), p.get("vignette"), (p.get("haze") or (0, 0, 0))[2])
    if key not in _MAPS:
        X = np.linspace(0, 1, w, dtype=np.float32)[None, :]
        Y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
        win = np.clip(1 - X / 0.62, 0, 1)  # ② 창은 화면 왼쪽(브리프 1절) — 왼쪽 62%에서 부드럽게 사라짐
        win = (win * win * (3 - 2 * win)) * np.ones_like(Y)
        r2 = ((X - 0.5) / 0.5) ** 2 + ((Y - 0.46) / 0.5) ** 2
        vig = np.clip((r2 - 0.25) / 1.75, 0, 1)
        top = np.clip(1 - Y / 0.7, 0, 1) * np.ones_like(X)  # ⑧ 안개는 위쪽(창·벽)에 더
        _MAPS[key] = (win, vig, top)
    return _MAPS[key]


def _blur(a, w, h, frac):
    """밝은 곳 겹을 1/4로 줄여 흐린 뒤 되키운다(1080 화면 한 장 수십 ms)."""
    sw, sh = max(1, w // 4), max(1, h // 4)
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = im.resize((sw, sh), Image.BILINEAR).filter(ImageFilter.GaussianBlur(max(1.0, frac * sw)))
    return np.asarray(im.resize((w, h), Image.BILINEAR), dtype=np.float32) / 255


PRODUCT_KEYS = ("ev", "temp", "tint", "sat", "split")


def grade(img, look, product=False):
    """PIL RGB 한 장에 색감을 입혀 PIL RGB로. look은 LOOKS 이름이나 값 dict.
    product=True(제품 접사)는 색조(노출·색온도·채도·색 나눔)만 — 흰 병 위 옅은 라벨은 밝은 곳 눌러 담기·곡선·블리치·확산·안개가
    대비를 깎아 지워진다(10-19 지유 컷 2·6 비교). 사람 컷과 색은 맞고 라벨은 그대로 남는다."""
    p = LOOKS[look] if isinstance(look, str) else look
    if product:
        p = {k: v for k, v in p.items() if k in PRODUCT_KEYS}
    if not p:
        return img
    x = np.asarray(img.convert("RGB"), dtype=np.float32) / 255
    h, w = x.shape[:2]
    win, vig, top = _maps(w, h, p)
    if p.get("window"):  # ② 창 쪽 빛: 노출(선형)과 따뜻함을 그라디언트로
        wev, wwarm = p["window"]
        lin = np.power(x, 2.2)
        lin = lin * (2.0 ** (wev * win))[..., None]
        lin = lin * (1 + np.array([0.07, 0.0, -0.07], dtype=np.float32) * (wwarm * win)[..., None])
        x = np.power(np.clip(lin, 0, None), 1 / 2.2)
    x = color_part(x, p)
    L = _luma(x)
    d = p.get("diffusion", 0.0)
    if d:  # ⑥ 확산(블랙 프로미스트): 흐린 판이 더 밝은 곳만 밝힌다 — 밝은 곳이 어두운 이웃으로 번지고, 하얀 화면 전체가 뜨지 않는다
        glow = np.stack([_blur(x[..., i], w, h, 0.035) for i in range(3)], -1)
        # 머리카락처럼 어두운 곳에는 얹지 않는다 — 밝은 벽과 맞닿은 윤곽에 회색 빛무리가 생겼다(10-19 Fable P2)
        dark_off = np.clip((L - 0.12) / 0.2, 0, 1)[..., None]
        x = x + d * np.clip(glow - x, 0, None) * dark_off
    hal = p.get("halation", 0.0)
    if hal:  # ⑦ 할레이션: 아주 밝은 곳의 바깥 테두리에만 붉은 번짐
        m = np.clip((L - 0.8) / 0.2, 0, 1)
        ring = np.clip(_blur(m, w, h, 0.02) - m, 0, 1)[..., None]
        x = 1 - (1 - x) * (1 - hal * 2.5 * ring * np.array([1.0, 0.32, 0.12], dtype=np.float32))
    hz = p.get("haze")
    if hz:  # ⑧ 안개: 위쪽일수록 옅은 빛 막을 덮는다
        amt, col, topw = hz
        a = (amt * ((1 - topw) + topw * top))[..., None]
        x = x * (1 - a) + np.array(col, dtype=np.float32) * a
    lift = p.get("lift", 0.0)
    if lift:  # ⑧ 검정 띄우기
        x = lift + x * (1 - lift)
    v = p.get("vignette", 0.0)
    if v:  # ② 가장자리 어둡게
        x = x * (1 - v * vig)[..., None]
    return Image.fromarray((np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8))


def write_cube(look, path, n=33):
    """색 부분만 n³ .cube로(R이 가장 빨리 변하는 순서, 다빈치·ffmpeg lut3d 형식)."""
    p = LOOKS[look]
    g = np.linspace(0, 1, n, dtype=np.float32)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")
    rgb = np.stack([r, gg, b], -1).reshape(-1, 3)
    out = color_part(rgb, p)
    with open(path, "w", encoding="ascii", newline="\n") as f:
        f.write(f'TITLE "PULSE {look}"\nLUT_3D_SIZE {n}\n')
        for row in out:
            f.write(f"{row[0]:.6f} {row[1]:.6f} {row[2]:.6f}\n")
    return path


def compare_sheet(out, paths, looks, names=None, cell_w=300, products=()):
    font = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", 22)
    ims = [Image.open(q).convert("RGB") for q in paths]
    cell_h = round(cell_w * ims[0].height / ims[0].width)
    head = 40
    sheet = Image.new("RGB", (cell_w * len(looks), head + cell_h * len(ims) + 6 * len(ims)), "white")
    d = ImageDraw.Draw(sheet)
    for j, lk in enumerate(looks):
        d.text((j * cell_w + 8, 8), lk, fill="black", font=font)
    for i, im in enumerate(ims):
        small = im.resize((cell_w, cell_h), Image.LANCZOS)
        for j, lk in enumerate(looks):
            sheet.paste(grade(small, lk, product=i in products), (j * cell_w, head + i * (cell_h + 6)))
        if names:
            d.text((6, head + i * (cell_h + 6) + 6), names[i], fill="white", font=font, stroke_width=2, stroke_fill="black")
    sheet.save(out, quality=90)
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    a = sys.argv[1:]
    if a and a[0] == "비교":
        looks = a[a.index("--색감") + 1].split(",") if "--색감" in a else list(LOOKS)
        names = a[a.index("--이름") + 1].split(",") if "--이름" in a else None
        prods = [int(v) for v in a[a.index("--제품") + 1].split(",")] if "--제품" in a else []  # 제품 접사 줄 번호(0부터)
        files = [x for i, x in enumerate(a[2:], 2) if not x.startswith("--") and a[i - 1] not in ("--색감", "--이름", "--제품")]
        print(compare_sheet(a[1], files, looks, names, products=prods))
    elif a and a[0] == "큐브":
        print(write_cube(a[1], a[2]))
    else:
        print(__doc__ if __doc__ else "python 색감.py 비교|큐브 …")
