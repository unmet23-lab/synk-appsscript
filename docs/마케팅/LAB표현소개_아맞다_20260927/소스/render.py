# -*- coding: utf-8 -*-
"""LAB 표현 소개 EP01 「아 맞다」 · 몽글 편 — 프레임 렌더러 (PIL → ffmpeg rawvideo 파이프).
장면표(SCENE)가 유일한 원천이다. --export-table 로 장면표.json 을 낸다.
움직임 규칙: 페이드·작은 팝(≤6%)·표정 컷·눈 깜빡임만. 회전·흔들림·이동 없음(사용자 멀미 기록)."""
import sys, os, json, math, argparse, subprocess
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
DUR = 22.0
F = lambda n: os.path.join(HERE, "fonts", n)
A = lambda n: os.path.join(HERE, "assets", n)
BLACK = (0, 0, 0, 255); GRAY = (85, 85, 85, 255); GRAY2 = (51, 51, 51, 255)

# ── 장면표 ───────────────────────────────────────────────────────────────
TEXT = {
 "en": {
  "s1_top": "When you suddenly remember something…",
  "s1_meaning": "“Oh, right!”",
  "s1_sub": "a matda",
  "s2_top": "For example…",
  "s2_ko": "아 맞다, 우산!",
  "s2_sub": "“Oh right, my umbrella!”",
  "s3_top": "Mongle does it too…",
  "s3_l1": ("어? 창밖에 새!", "Huh? A bird outside!"),
  "s3_l2": ("…아 맞다! 숙제!", "…Oh right! Homework!"),
  "s3_l3": ("같이 하자!", "Let’s do it together!"),
  "s4_top": "Your turn — say it out loud",
  "s4_sub": "a matda",
  "s5_cta": "Tell us your 아 맞다 moment in the comments",
 },
 "ko": {
  "s1_top": "갑자기 생각났을 때…",
  "s1_meaning": "잊고 있던 게 떠오를 때 쓰는 말",
  "s1_sub": "a matda",
  "s2_top": "예를 들면…",
  "s2_ko": "아 맞다, 우산!",
  "s2_sub": "두고 나올 뻔했을 때",
  "s3_top": "몽글도 그래요…",
  "s3_l1": ("어? 창밖에 새!", None),
  "s3_l2": ("…아 맞다! 숙제!", None),
  "s3_l3": ("같이 하자!", None),
  "s4_top": "따라 말해 보세요",
  "s4_sub": "a matda",
  "s5_cta": "당신의 ‘아 맞다’ 순간을 댓글로 알려 주세요",
 },
}
SEG = [  # (id, start, end, 몽글 폭, 몽글 바닥 y)
 ("S1 훅", 0.0, 2.4, 780, 1800),
 ("S2 예문", 2.4, 8.6, 660, 1830),
 ("S3 캐릭터", 8.6, 15.2, 900, 1790),
 ("S4 따라 말하기", 15.2, 19.4, 780, 1800),
 ("S5 LAB 표시", 19.4, 22.0, 780, 1800),
]
CUTS = [  # (t, 컷) — 표정은 컷으로 바뀐다(생명감 §1-a: 같은 몸, 눈만)
 (0.0, "궁금함"), (0.6, "놀람"), (2.4, "본체"), (3.0, "놀람"), (4.8, "안도"), (6.4, "본체"),
 (8.6, "좌34"), (11.0, "놀람"), (13.2, "응원"), (14.3, "눈웃음"),
 (15.2, "응원"), (19.4, "눈웃음"),
]
BLINKS = [6.6, 12.5, 17.6]  # 0.1초 눈감음 (눈웃음·좌34·놀람 구간은 피한다)
AUDIO = [  # (t, 파일, dB, 설명) — 목소리는 mix.py 가 --no-voice 로 뺀다
 (0.15, "sounds/synk-voice-ppong.wav", -8, "몽글 물음 「뽀옹」"),
 (0.50, "sounds/synk-sound-earn.wav", -14, "UI 획득 픽(카드 등장)"),
 (0.60, "tts/hook.wav", 0, "내레이션 「아 맞다!」"),
 (3.00, "tts/umbrella.wav", 0, "내레이션 「아 맞다, 우산!」"),
 (5.00, "sounds/synk-voice-mii.wav", -8, "몽글 안심 「미이」"),
 (8.80, "sounds/synk-voice-ppoo.wav", -8, "몽글 물음 「뽀오」"),
 (11.00, "sounds/synk-sound-earn.wav", -14, "UI 획득 픽"),
 (11.05, "tts/beat.wav", 0, "내레이션 「아 맞다!」"),
 (13.30, "sounds/synk-voice-myang.wav", -8, "몽글 기쁨 「먀앙」"),
 (15.40, "tts/practice.wav", 0, "내레이션 「아 맞다!」(천천히) → 2.6초 여백"),
 (19.50, "sounds/synk-sound-achieve.wav", -12, "UI 성취 화음(LAB 표시)"),
 (20.30, "sounds/synk-voice-moong.wav", -8, "몽글 완료축하 「모오옹」"),
]

# ── 도우미 ───────────────────────────────────────────────────────────────
_font_cache = {}
def font(name, size):
    k = (name, size)
    if k not in _font_cache: _font_cache[k] = ImageFont.truetype(F(name), size)
    return _font_cache[k]
def ease_out(x): return 1 - (1 - x) ** 3
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def fade(t, t0, dur=0.25): return clamp((t - t0) / dur)
def fade_io(t, t0, t1, fi=0.25, fo=0.2):
    if t < t0 or t >= t1: return 0.0
    return min(clamp((t - t0) / fi), clamp((t1 - t) / fo))
_text_cache = {}
def _is_hangul(ch):
    o = ord(ch)
    return 0xAC00 <= o <= 0xD7A3 or 0x1100 <= o <= 0x11FF or 0x3130 <= o <= 0x318F
def _runs(txt, fname):
    """라틴 서체(Inter Tight) 줄에 한글이 섞이면 한글 구간만 SUIT 로 그린다(DESIGN: 한글 SUIT · 라틴 Inter Tight)."""
    if not fname.startswith("InterTight") or not any(_is_hangul(c) for c in txt): return [(txt, fname)]
    ko_font = "SUIT-SemiBold.otf" if "SemiBold" in fname or "Bold" in fname else "SUIT-Medium.otf"
    out = []; cur = ""; cur_ko = None
    for ch in txt:
        ko = _is_hangul(ch) or (cur_ko and ch == " ")
        if cur_ko is None or ko == cur_ko: cur += ch; cur_ko = ko if cur_ko is None else cur_ko
        else: out.append((cur, ko_font if cur_ko else fname)); cur = ch; cur_ko = ko
    if cur: out.append((cur, ko_font if cur_ko else fname))
    return out
def text_layer(txt, fname, size, color=BLACK):
    k = (txt, fname, size, color)
    if k in _text_cache: return _text_cache[k]
    runs = _runs(txt, fname)
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    pad = 6
    if len(runs) == 1:
        f = font(fname, size)
        l, t, r, b = d.textbbox((0, 0), txt, font=f)
        im = Image.new("RGBA", (r - l + pad * 2, b - t + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((pad - l, pad - t), txt, font=f, fill=color)
    else:
        # 구간마다 서체가 다르므로 기준선(ascent)으로 맞춰 가로로 잇는다
        pieces = []
        for s, fn in runs:
            f = font(fn, size); asc, desc = f.getmetrics()
            l, t, r, b = d.textbbox((0, 0), s, font=f)
            pieces.append((s, f, asc, desc, r - l, l))
        max_asc = max(p[2] for p in pieces); max_desc = max(p[3] for p in pieces)
        total = sum(p[4] for p in pieces)
        im = Image.new("RGBA", (total + pad * 2, max_asc + max_desc + pad * 2), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
        x = pad
        for s, f, asc, desc, w, l in pieces:
            dr.text((x - l, pad + (max_asc - asc)), s, font=f, fill=color); x += w
        im = im.crop(im.getbbox()) if im.getbbox() else im
    _text_cache[k] = im
    return im
def with_alpha(im, a):
    if a >= 0.999: return im
    a = round(a * 20) / 20
    if a <= 0: return None
    k = ("alpha", id(im), a)
    if k in _text_cache: return _text_cache[k]
    out = im.copy(); out.putalpha(out.getchannel("A").point(lambda v: int(v * a)))
    _text_cache[k] = out
    return out
def paste(canvas, im, cx=None, cy=None, x=None, y=None, alpha=1.0):
    if im is None or alpha <= 0: return
    im = with_alpha(im, alpha)
    if im is None: return
    if x is None: x = int(round(cx - im.width / 2))
    if y is None: y = int(round(cy - im.height / 2))
    # 캔버스 밖으로 나가는 부분은 잘라 붙인다
    sx0, sy0 = max(0, -x), max(0, -y)
    sx1, sy1 = min(im.width, W - x), min(im.height, H - y)
    if sx1 <= sx0 or sy1 <= sy0: return
    part = im.crop((sx0, sy0, sx1, sy1)) if (sx0, sy0, sx1, sy1) != (0, 0, im.width, im.height) else im
    canvas.alpha_composite(part, (x + sx0, y + sy0))
def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return m
def shadow_layer(w, h, r, blur=26, dy=14, alpha=52):
    pad = blur * 3
    s = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle((pad, pad + dy, pad + w - 1, pad + dy + h - 1), r, fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(blur)), pad
_paper = Image.open(A("paper.png")).convert("RGBA")
def _white_region(im):
    """스와치는 어두운 받침 위에 흰 펠트 사각이 놓인 사진이다 — 흰 펠트 부분만 찾는다(밝은 픽셀의 상자, 6% 안쪽)."""
    import numpy as np
    a = np.array(im.convert("RGB")); bright = (a.min(axis=2) > 205)
    ys, xs = np.where(bright)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mx, my = int((x1 - x0) * 0.08), int((y1 - y0) * 0.08)
    return (x0 + mx, y0 + my, x1 - mx, y1 - my)
_FELT_BOX = _white_region(_paper)
def _felt_mosaic():
    """스와치의 실땀 안쪽(가장자리 26% 제외) 무늬만 떼어 거울 타일 3×3 으로 이어 붙인다 — 이음새 없는 흰 펠트 원단."""
    x0, y0, x1, y1 = _FELT_BOX; bw, bh = x1 - x0, y1 - y0
    ix, iy = int(bw * 0.26), int(bh * 0.26)
    tile = _paper.crop((x0 + ix, y0 + iy, x1 - ix, y1 - iy)).convert("RGB")
    tw, th = tile.size
    fx = tile.transpose(Image.FLIP_LEFT_RIGHT); fy = tile.transpose(Image.FLIP_TOP_BOTTOM); fxy = fx.transpose(Image.FLIP_TOP_BOTTOM)
    m = Image.new("RGB", (tw * 3, th * 3))
    for r in range(3):
        for c in range(3):
            src = tile if (r % 2 == 1 and c % 2 == 1) else (fx if (r % 2 == 1) else (fy if (c % 2 == 1) else fxy))
            m.paste(src, (c * tw, r * th))
    return m.convert("RGBA")
_FELT = _felt_mosaic()
def felt_crop(w, h):
    """이음새 없는 흰 펠트 원단에서 (w:h) 비율로 가장 크게 잘라 (w,h)로 맞춘다. 재칠 없음."""
    bw, bh = _FELT.size
    if bw / bh > w / h: cw, ch = int(bh * w / h), bh
    else: cw, ch = bw, int(bw * h / w)
    cx, cy = bw // 2, bh // 2
    return _FELT.crop((cx - cw // 2, cy - ch // 2, cx - cw // 2 + cw, cy - ch // 2 + ch)).resize((w, h), Image.LANCZOS)
def felt_panel(w, h, r):
    """흰 펠트(정본 Paper 스와치)를 잘라 둥근 판으로."""
    src = felt_crop(w, h)
    src.putalpha(rounded_mask(w, h, r))
    return src
_scaled = {}
def mongle(cut, w):
    k = (cut, w)
    if k not in _scaled:
        _scaled[k] = Image.open(A(f"몽글_{cut}.png")).convert("RGBA").resize((w, w), Image.LANCZOS)
    return _scaled[k]
def cut_at(t):
    c = CUTS[0][1]
    for t0, name in CUTS:
        if t >= t0: c = name
    for b in BLINKS:
        if b <= t < b + 0.1 and c in ("본체", "궁금함", "응원", "안도"): return "눈감음"
    return c
def seg_at(t):
    for s in SEG:
        if s[1] <= t < s[2]: return s
    return SEG[-1]

# 미리 만든 판
CARD_W, CARD_H = 920, 340
CARD = felt_panel(CARD_W, CARD_H, 40); CARD_SH, CARD_PAD = shadow_layer(CARD_W, CARD_H, 40)
LOGO = Image.open(A("lab_logo.png")).convert("RGBA"); LOGO = LOGO.crop(LOGO.getbbox()); LOGO = LOGO.resize((640, int(LOGO.height * 640 / LOGO.width)), Image.LANCZOS)
INSET = 680; INSET_MASK = rounded_mask(INSET, INSET, 44); INSET_SH, INSET_PAD = shadow_layer(INSET, INSET, 44, blur=30, dy=16, alpha=60)
INSET_X, INSET_Y = 200, 360
_inset_cache = {}
def inset_frame(idx, frames_dir):
    if frames_dir is None: return None
    p = os.path.join(frames_dir, f"{idx:04d}.png")
    if not os.path.exists(p): p = os.path.join(frames_dir, "0000.png")
    if p in _inset_cache: return _inset_cache[p]
    im = Image.open(p).convert("RGBA")
    if im.size != (INSET, INSET): im = im.resize((INSET, INSET), Image.LANCZOS)
    im.putalpha(INSET_MASK)
    if len(_inset_cache) > 8: _inset_cache.clear()
    _inset_cache[p] = im
    return im
def card_with_text(txt):
    k = ("card", txt)
    if k in _text_cache: return _text_cache[k]
    im = CARD.copy(); tl = text_layer(txt, "SUIT-ExtraBold.otf", 150)
    im.alpha_composite(tl, ((CARD_W - tl.width) // 2, (CARD_H - tl.height) // 2 - 6))
    _text_cache[k] = im; return im
def draw_card(canvas, txt, t, t0, cy, t_end=None):
    if t < t0: return
    if t_end is not None and t >= t_end: return
    p = clamp((t - t0) / 0.22); s = 0.94 + 0.06 * ease_out(p); a = clamp((t - t0) / 0.15)
    if t_end is not None: a = min(a, clamp((t_end - t) / 0.2))
    im = card_with_text(txt)
    if s < 0.999:
        im = im.resize((int(CARD_W * s), int(CARD_H * s)), Image.LANCZOS)
        sh = CARD_SH.resize((int(CARD_SH.width * s), int(CARD_SH.height * s)), Image.LANCZOS)
    else: sh = CARD_SH
    paste(canvas, sh, cx=W // 2, cy=cy, alpha=a); paste(canvas, im, cx=W // 2, cy=cy, alpha=a)
_bubble_cache = {}
def bubble(ko, en):
    k = ("bubble", ko, en)
    if k in _bubble_cache: return _bubble_cache[k]
    l1 = text_layer(ko, "SUIT-SemiBold.otf", 64)
    l2 = text_layer(en, "InterTight-Medium.ttf", 42, GRAY) if en else None
    tw = max(l1.width, l2.width if l2 else 0); th = l1.height + ((l2.height + 14) if l2 else 0)
    w, h = tw + 140, th + 96
    panel = felt_panel(w, h, 46)
    # 꼬리(아래로) — 같은 펠트에서 삼각형을 잘라 붙인다
    tail = felt_crop(120, 96)
    tm = Image.new("L", (120, 96), 0); ImageDraw.Draw(tm).polygon([(6, 0), (114, 0), (60, 90)], fill=255); tail.putalpha(tm)
    sh, pad = shadow_layer(w, h, 46)
    full = Image.new("RGBA", (w + pad * 2, h + 70 + pad * 2), (0, 0, 0, 0))
    full.alpha_composite(sh, (0, 0)); full.alpha_composite(tail, (pad + w // 2 - 60, pad + h - 6)); full.alpha_composite(panel, (pad, pad))
    y = pad + 44
    full.alpha_composite(l1, (pad + (w - l1.width) // 2, y)); y += l1.height + 14
    if l2: full.alpha_composite(l2, (pad + (w - l2.width) // 2, y))
    _bubble_cache[k] = full; return full

# ── 프레임 ───────────────────────────────────────────────────────────────
def render_frame(t, lang, frames_dir):
    T = TEXT[lang]; ko = lang == "ko"
    LAT_SB, LAT_M, LAT_B = "InterTight-SemiBold.ttf", "InterTight-Medium.ttf", "InterTight-Bold.ttf"
    KO_SB, KO_M = "SUIT-SemiBold.otf", "SUIT-Medium.otf"
    top_font = (KO_SB, 56) if ko else (LAT_SB, 52)
    canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    seg = seg_at(t); sid, s0, s1, mw, mb = seg
    # S2 인셋(영상) — 몽글보다 먼저(뒤에) 놓는다
    if sid.startswith("S2"):
        a = fade_io(t, 2.4, 8.6, 0.3, 0.2)
        idx = int(round((t - 2.4) * FPS))
        fr = inset_frame(idx, frames_dir)
        if fr is not None:
            paste(canvas, INSET_SH, x=INSET_X - INSET_PAD, y=INSET_Y - INSET_PAD, alpha=a)
            paste(canvas, fr, x=INSET_X, y=INSET_Y, alpha=a)
    # 몽글
    cut = cut_at(t); mi = mongle(cut, mw)
    ma = fade(t, 0.0, 0.25) if t < 0.5 else 1.0
    paste(canvas, mi, x=W // 2 - mw // 2, y=mb - mw, alpha=ma)
    # 위 안내줄
    top_key = {"S1": "s1_top", "S2": "s2_top", "S3": "s3_top", "S4": "s4_top"}.get(sid[:2])
    if top_key:
        a = fade_io(t, s0, s1, 0.3, 0.2)
        paste(canvas, text_layer(T[top_key], *top_font), cx=W // 2, cy=300, alpha=a)
    if sid.startswith("S1"):
        draw_card(canvas, "아 맞다!", t, 0.6, 660, t_end=2.4)
        a = fade_io(t, 1.1, 2.4, 0.25, 0.2)
        paste(canvas, text_layer(T["s1_meaning"], KO_M if ko else LAT_B, 52 if ko else 76), cx=W // 2, cy=900, alpha=a)
        paste(canvas, text_layer(T["s1_sub"], LAT_M, 48, GRAY), cx=W // 2, cy=985, alpha=a)
    elif sid.startswith("S2"):
        a1 = fade_io(t, 2.9, 8.6); a2 = fade_io(t, 3.6, 8.6)
        paste(canvas, text_layer(T["s2_ko"], KO_SB, 74), cx=W // 2, cy=1092, alpha=a1)
        paste(canvas, text_layer(T["s2_sub"], KO_M if ko else LAT_M, 48 if ko else 50, GRAY2), cx=W // 2, cy=1170, alpha=a2)
    elif sid.startswith("S3"):
        for key, t0, t1 in (("s3_l1", 8.8, 11.0), ("s3_l2", 11.0, 13.2), ("s3_l3", 13.2, 15.2)):
            a = fade_io(t, t0, t1, 0.2, 0.12)
            if a > 0:
                b = bubble(*T[key]); paste(canvas, b, cx=W // 2, cy=780, alpha=a)
    elif sid.startswith("S4"):
        draw_card(canvas, "아 맞다!", t, 15.3, 700, t_end=19.4)
        a = fade_io(t, 15.6, 19.4)
        paste(canvas, text_layer(T["s4_sub"], LAT_M, 56, GRAY), cx=W // 2, cy=950, alpha=a)
    else:
        a = fade(t, 19.5, 0.4)
        paste(canvas, LOGO, cx=W // 2, cy=620, alpha=a)
        a2 = fade(t, 19.9, 0.3)
        cta = text_layer(T["s5_cta"], KO_M if ko else LAT_M, 44)
        if cta.width > W - 160:  # 두 줄로
            words = T["s5_cta"].split(" "); half = len(words) // 2
            l1 = text_layer(" ".join(words[:half]), KO_M if ko else LAT_M, 44); l2 = text_layer(" ".join(words[half:]), KO_M if ko else LAT_M, 44)
            paste(canvas, l1, cx=W // 2, cy=860, alpha=a2); paste(canvas, l2, cx=W // 2, cy=920, alpha=a2)
        else:
            paste(canvas, cta, cx=W // 2, cy=880, alpha=a2)
    # 끝 페이드(흰색으로)
    if t > DUR - 0.3:
        k = clamp((t - (DUR - 0.3)) / 0.3)
        white = Image.new("RGBA", (W, H), (255, 255, 255, int(255 * k))); canvas.alpha_composite(white)
    return canvas.convert("RGB")

def export_table(path):
    tbl = {"id": "LAB표현소개_아맞다_20260927", "line": "CL-6 LAB 표현 소개", "character": "몽글", "canvas": [W, H], "fps": FPS, "duration": DUR,
           "expression": {"ko": "아 맞다!", "romanization": "a matda", "meaning_en": "Oh, right! / Oh wait! - said when you suddenly remember something", "meaning_ko": "잊고 있던 것이 갑자기 떠올랐을 때 쓰는 감탄",
                          "examples": [{"ko": "아 맞다, 우산!", "en": "Oh right, my umbrella!"}, {"ko": "…아 맞다! 숙제!", "en": "…Oh right! Homework!"}],
                          "note": "몽글의 감탄사 지문(가이드 정본 §2-3)이라 첫 편은 몽글."},
           "segments": [{"id": s[0], "start": s[1], "end": s[2], "mongle_width": s[3], "mongle_bottom": s[4]} for s in SEG],
           "cuts": [{"t": t, "cut": c} for t, c in CUTS], "blinks": BLINKS,
           "text": TEXT, "audio": [{"t": t, "file": f, "gain_db": g, "what": w} for t, f, g, w in AUDIO],
           "motion_rules": "페이드 0.2~0.3초 · 카드 팝 0.94→1.0(0.22초) · 표정 컷 · 눈 깜빡임 0.1초 · 회전·흔들림·이동 없음"}
    json.dump(tbl, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en"); ap.add_argument("--out"); ap.add_argument("--frames"); ap.add_argument("--preview", help="쉼표로 나눈 초 목록 → PNG")
    ap.add_argument("--export-table")
    a = ap.parse_args()
    if a.export_table: export_table(a.export_table); print("장면표 →", a.export_table)
    if a.preview:
        os.makedirs(os.path.join(HERE, "preview"), exist_ok=True)
        for s in a.preview.split(","):
            t = float(s); im = render_frame(t, a.lang, a.frames)
            p = os.path.join(HERE, "preview", f"{a.lang}_{t:05.2f}.png"); im.save(p); print("preview", p)
    if a.out:
        n = int(round(DUR * FPS))
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
               "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", a.out]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i in range(n):
            proc.stdin.write(render_frame(i / FPS, a.lang, a.frames).tobytes())
            if i % 60 == 0: print(f"  {i}/{n}", flush=True)
        proc.stdin.close(); proc.wait(); print("video →", a.out, "exit", proc.returncode)
