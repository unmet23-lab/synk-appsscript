# -*- coding: utf-8 -*-
"""LAB 표현 소개 EP01 「아 맞다」 v2 — 릴스 기준 재편집 렌더러 (PIL → ffmpeg, BT.709 태그).

v1 대비 바뀐 것
- 첫 프레임이 완성된 화면이다(v1은 0초가 흰 화면에서 페이드인). 피드에서 멈추는 순간 표현·뜻이 이미 보인다.
- 컷을 음악 박자(110BPM)에 맞춘 하드 컷으로 바꿨다. 음악 브레이크(음악 13.11초)가 「따라 말하기」 컷(10.30초)에 떨어진다.
- 예문은 Veo 펠트 장면을 전체 화면으로 쓴다(v1은 네모 인셋).
- 따라 말하기에서 「아·맞·다」가 내레이션 음절에 맞춰 회색→검정으로 채워지고, 실제 소리 [a · mat · tta]를 같이 보인다.
- 로고 엔딩 대신 빈칸 댓글 유도(「아 맞다, ____!」)로 끝나고 첫 화면으로 자연스럽게 되돌아간다.
- 모든 글자와 카드가 메타 통합 9:16 안전 영역(위 269·아래 672·좌우 65px, 2026-03) 안에 있다. --check 로 검사한다.
움직임 규칙은 v1과 같다: 몽글은 표정 컷·눈 깜빡임만(회전·흔들림·이동·크기 애니메이션 없음). 글자·카드만 작게 튄다."""
import sys, os, json, argparse, subprocess
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(HERE)
W, H, FPS = 1080, 1920, 30
F = lambda n: os.path.join(BASE, "fonts", n)
A = lambda n: os.path.join(BASE, "assets", n)
SAFE = (65, 269, 1015, 1248)  # x0, y0, x1, y1

TIMING = json.load(open(os.path.join(HERE, "voice_timing.json"), encoding="utf-8"))
# ── 컷: 음악을 2.91초부터 쓰면 박자(0.545초)와 브레이크가 아래 시각에 떨어진다 ─────────────
T_B2, T_B3, T_B4, T_B5, DUR = 1.58, 4.03, 10.30, 15.77, 19.31
T_PUNCH = 2.68  # 「우산」 첫소리(2.69)·음악 박자(2.67)에 맞춘 펀치인 컷 — 첫 5초 안에 컷을 하나 더(2026 스킵률 대응)
PUNCH_BOX = (0, 250, 939, 1920)  # 1.15배, 왼쪽 아래 기준 — 우산 윗부분이 예문 카드에 가리지 않게
T_SEND = 15.77 + 0.70  # 「친구에게 보내기」 줄 — 2026 인스타그램에서 가장 무겁게 치는 신호(보내기)
MUSIC_OFFSET = 2.91
VEO_START = 2.40  # 예문 장면에 쓸 Veo 원본 구간 시작(비가 충분히 내리는 구간)
VOICE_AT = {"hook": 0.07, "umbrella": 1.80, "beat": 6.27, "slow": 10.52, "confirm": 14.51}
def speech(k): return VOICE_AT[k] + TIMING["lines"][k]["speech_onset"]
def speech_end(k): return VOICE_AT[k] + TIMING["lines"][k]["duration"] - 0.15
SYL = [round(VOICE_AT["slow"] + s["start"], 3) for s in TIMING["lines"]["slow"]["syllables"]]
T_NOW = round(speech_end("slow") + 0.05, 2)
T_NICE = VOICE_AT["confirm"]
BUBBLES = [("s3_l1", T_B3 + 0.10, 6.20), ("s3_l2", 6.20, 8.14), ("s3_l3", 8.14, T_B4)]

TEXT = {
 "en": {
  "b1_l1": "Forgot something?", "b1_l2": "Koreans say…",
  "b1_meaning": "“Oh, right!”", "rom": "a matda",
  "b2_ko": "아 맞다, 우산!", "b2_sub": "Oh right — my umbrella!",
  "b3_top": "Mongle does it too…",
  "s3_l1": ("어? 창밖에 새!", "Huh? A bird outside!"),
  "s3_l2": ("…아 맞다! 숙제!", "…Oh right! Homework!"),
  "s3_l3": ("같이 하자!", "Let’s do it together!"),
  "b4_top": "Your turn — say it with me", "b4_label": "sounds like", "b4_pron": ["a", " · ", "mat", " · ", "tta"],
  "b4_now": "Now you!", "b4_nice": "Nice!",
  "b5_q": "What do you always forget?", "b5_card": "아 맞다, ____!", "b5_cta": "Comment yours below ↓", "b5_send": "Send this to a friend who always forgets",
 },
 "ko": {
  "b1_l1": "뭔가 깜빡했다면?", "b1_l2": "이렇게 말해요",
  "b1_meaning": "잊고 있던 게 떠올랐을 때", "rom": "a matda",
  "b2_ko": "아 맞다, 우산!", "b2_sub": "우산을 두고 나올 뻔했을 때",
  "b3_top": "몽글도 그래요…",
  "s3_l1": ("어? 창밖에 새!", None), "s3_l2": ("…아 맞다! 숙제!", None), "s3_l3": ("같이 하자!", None),
  "b4_top": "따라 말해 보세요", "b4_label": "소리 나는 대로", "b4_pron": ["아", " · ", "맏", " · ", "따"],
  "b4_now": "따라 해 보세요!", "b4_nice": "좋아요!",
  "b5_q": "늘 깜빡하는 게 뭐예요?", "b5_card": "아 맞다, ____!", "b5_cta": "댓글로 채워 주세요", "b5_send": "늘 깜빡하는 친구에게 보내 주세요",
 },
}
FONTS = {  # (영어판, 한국어판)
 "b1_l1": (("InterTight-Bold.ttf", 92), ("SUIT-ExtraBold.otf", 86)),
 "b1_l2": (("InterTight-SemiBold.ttf", 62), ("SUIT-SemiBold.otf", 60)),
 "b1_meaning": (("InterTight-Bold.ttf", 84), ("SUIT-SemiBold.otf", 58)),
 "rom": (("InterTight-Medium.ttf", 50), ("InterTight-Medium.ttf", 50)),
 "b2_sub": (("InterTight-Medium.ttf", 50), ("SUIT-Medium.otf", 50)),
 "top": (("InterTight-SemiBold.ttf", 62), ("SUIT-SemiBold.otf", 60)),
 "bubble_en": (("InterTight-Medium.ttf", 44), None),
 "b4_label": (("InterTight-Medium.ttf", 42), ("SUIT-Medium.otf", 42)),
 "b4_pron": (("InterTight-Bold.ttf", 72), ("SUIT-ExtraBold.otf", 70)),
 "b4_now": (("InterTight-Bold.ttf", 92), ("SUIT-ExtraBold.otf", 84)),
 "b5_q": (("InterTight-Bold.ttf", 66), ("SUIT-ExtraBold.otf", 64)),
 "b5_cta": (("InterTight-Medium.ttf", 50), ("SUIT-Medium.otf", 50)),
 "b5_send": (("InterTight-SemiBold.ttf", 52), ("SUIT-SemiBold.otf", 52)),
}
def fnt(key, lang): return FONTS[key][0 if lang == "en" else 1]

CUTS = [(0.0, "놀람"), (T_B3, "좌34"), (6.20, "놀람"), (8.14, "응원"), (9.20, "눈웃음"),
        (T_B4, "본체"), (T_NOW, "집중"), (T_NICE, "눈웃음"), (T_B5, "눈웃음"), (16.95, "윙크"), (17.55, "눈웃음")]
BLINKS = [8.70, 11.20]
MONGLE_W = {"B1": 660, "B3": 860, "B4": 560, "B5": 600}
BODY_BOTTOM = 1600  # 몸 아래 끝(바닥 자수 포함) — 아래 UI 띠 위에 앉힌다
AUDIO = [  # (시각, 버스, 파일(lab01 기준), dB, 무엇)
 (0.02, "sfx", "sounds/synk-sound-earn.wav", -17, "UI 획득 픽 — 첫 카드"),
 (VOICE_AT["hook"], "voice", "v2/voice/trim/hook.wav", 0, "내레이션 「아 맞다!」"),
 (1.22, "mascot", "sounds/synk-voice-ppong.wav", -7, "몽글 물음 「뽀옹」"),
 (T_B2 + 0.12, "sfx", "sounds/synk-sound-earn.wav", -19, "UI 픽 — 예문 카드"),
 (VOICE_AT["umbrella"], "voice", "v2/voice/trim/umbrella.wav", 0, "내레이션 「아 맞다, 우산!」"),
 (T_B3 + 0.17, "mascot", "sounds/synk-voice-ppoo.wav", -7, "몽글 물음 「뽀오」 — 새를 봄"),
 (6.20, "sfx", "sounds/synk-sound-earn.wav", -19, "UI 픽 — 알아차림"),
 (VOICE_AT["beat"], "voice", "v2/voice/trim/beat.wav", 0, "내레이션 「아 맞다!」"),
 (8.25, "mascot", "sounds/synk-voice-myang.wav", -7, "몽글 기쁨 「먀앙」 — 같이 하자"),
 (VOICE_AT["slow"], "voice", "v2/voice/trim/slow.wav", 0, "내레이션 「아… 맞다.」 천천히"),
 (VOICE_AT["confirm"], "voice", "v2/voice/trim/confirm.wav", 0, "내레이션 「아 맞다!」 다시 한 번"),
 (T_B5 + 0.02, "sfx", "sounds/synk-sound-achieve.wav", -15, "UI 성취 화음 — 댓글 유도"),
 (16.40, "mascot", "sounds/synk-voice-moong.wav", -7, "몽글 완료축하 「모오옹」"),
]
DUCK = {"voice": -6.0, "mascot": -4.0, "practice": (T_NOW, T_NICE, -4.0)}

# ── 도우미 ───────────────────────────────────────────────────────────────
_fc = {}
def font(name, size):
    if (name, size) not in _fc: _fc[(name, size)] = ImageFont.truetype(F(name), size)
    return _fc[(name, size)]
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out(x): return 1 - (1 - x) ** 3
def _is_hangul(ch):
    o = ord(ch); return 0xAC00 <= o <= 0xD7A3 or 0x1100 <= o <= 0x11FF or 0x3130 <= o <= 0x318F
def _runs(txt, fname):
    if not fname.startswith("InterTight") or not any(_is_hangul(c) for c in txt): return [(txt, fname)]
    ko = "SUIT-SemiBold.otf" if ("Bold" in fname) else "SUIT-Medium.otf"
    out, cur, cur_ko = [], "", None
    for ch in txt:
        k = _is_hangul(ch) or (cur_ko and ch == " ")
        if cur_ko is None or k == cur_ko: cur += ch; cur_ko = k if cur_ko is None else cur_ko
        else: out.append((cur, ko if cur_ko else fname)); cur, cur_ko = ch, k
    if cur: out.append((cur, ko if cur_ko else fname))
    return out
_tc = {}
def text_layer(txt, fname, size, color=(0, 0, 0, 255)):
    k = (txt, fname, size, color)
    if k in _tc: return _tc[k]
    runs = _runs(txt, fname); d = ImageDraw.Draw(Image.new("RGBA", (1, 1))); pad = 6
    if len(runs) == 1:
        f = font(fname, size); l, t, r, b = d.textbbox((0, 0), txt, font=f)
        im = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((pad - l, pad - t), txt, font=f, fill=color)
    else:
        pieces = []
        for s, fn in runs:
            f = font(fn, size); asc, desc = f.getmetrics(); l, t, r, b = d.textbbox((0, 0), s, font=f)
            pieces.append((s, f, asc, desc, r - l, l))
        ma = max(p[2] for p in pieces); md = max(p[3] for p in pieces)
        im = Image.new("RGBA", (sum(p[4] for p in pieces) + 2 * pad, ma + md + 2 * pad), (0, 0, 0, 0)); dr = ImageDraw.Draw(im); x = pad
        for s, f, asc, desc, w, l in pieces:
            dr.text((x - l, pad + ma - asc), s, font=f, fill=color); x += w
        im = im.crop(im.getbbox())
    _tc[k] = im; return im
def fit_text(txt, fname, size, color=(0, 0, 0, 255), max_w=SAFE[2] - SAFE[0] - 20):
    im = text_layer(txt, fname, size, color)
    while im.width > max_w and size > 20:
        size -= 2; im = text_layer(txt, fname, size, color)
    return im
def with_alpha(im, a):
    if a >= 0.999: return im
    a = round(a * 20) / 20
    if a <= 0: return None
    k = ("a", id(im), a)
    if k not in _tc:
        o = im.copy(); o.putalpha(o.getchannel("A").point(lambda v: int(v * a))); _tc[k] = o
    return _tc[k]
def scaled(im, s):
    if s >= 0.999: return im
    s = round(s * 100) / 100; k = ("s", id(im), s)
    if k not in _tc: _tc[k] = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    return _tc[k]
DRAWN = []  # 안전 영역 검사용 (이름, x0, y0, x1, y1)
def paste(canvas, im, cx=None, cy=None, x=None, y=None, alpha=1.0, label=None):
    if im is None or alpha <= 0: return
    im = with_alpha(im, alpha)
    if im is None: return
    if x is None: x = int(round(cx - im.width / 2))
    if y is None: y = int(round(cy - im.height / 2))
    if label: DRAWN.append((label, x, y, x + im.width, y + im.height))
    sx0, sy0 = max(0, -x), max(0, -y); sx1, sy1 = min(im.width, W - x), min(im.height, H - y)
    if sx1 <= sx0 or sy1 <= sy0: return
    part = im if (sx0, sy0, sx1, sy1) == (0, 0, im.width, im.height) else im.crop((sx0, sy0, sx1, sy1))
    canvas.alpha_composite(part, (x + sx0, y + sy0))
def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255); return m
def shadow_layer(w, h, r, blur=26, dy=14, alpha=52):
    pad = blur * 3; s = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(s).rounded_rectangle((pad, pad + dy, pad + w - 1, pad + dy + h - 1), r, fill=(0, 0, 0, alpha))
    return s.filter(ImageFilter.GaussianBlur(blur)), pad

# ── 흰 펠트(정본 Paper 스와치의 실땀 안쪽 무늬 · 밝기만 올림, 색 비율 유지) ────────────
_paper = Image.open(A("paper.png")).convert("RGB")
def _felt_fabric():
    a = np.array(_paper).astype(np.float32); bright = a.min(axis=2) > 205
    ys, xs = np.where(bright); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = x1 - x0, y1 - y0; mx, my = int(bw * 0.34), int(bh * 0.34)
    tile = a[y0 + my:y1 - my, x0 + mx:x1 - mx]
    m = tile.reshape(-1, 3).mean(axis=0); lum = m.mean()
    tile = np.clip((m / lum) * 240.0 + (tile - m) * 0.8, 0, 255)  # 평균 밝기 240, 무늬 대비 80%
    th, tw = tile.shape[:2]
    fx = tile[:, ::-1]; fy = tile[::-1]; fxy = fy[:, ::-1]
    row0 = np.concatenate([tile, fx, tile], axis=1); row1 = np.concatenate([fy, fxy, fy], axis=1)
    fab = np.concatenate([row0, row1, row0], axis=0).astype(np.uint8)
    return Image.fromarray(fab).convert("RGBA")
FELT = _felt_fabric()
def felt_panel(w, h, r):
    bw, bh = FELT.size
    if bw / bh > w / h: cw, ch = int(bh * w / h), bh
    else: cw, ch = bw, int(bw * h / w)
    src = FELT.crop(((bw - cw) // 2, (bh - ch) // 2, (bw - cw) // 2 + cw, (bh - ch) // 2 + ch)).resize((w, h), Image.LANCZOS)
    src.putalpha(rounded_mask(w, h, r)); return src
_cards = {}
def card(key, lines, w=None, h=None, r=40, padx=70, pady=46, gap=14):
    """lines: [(layer)] — 펠트 판 위에 가운데 정렬로 쌓은 카드와 그림자."""
    if key in _cards: return _cards[key]
    tw = max(l.width for l in lines); th = sum(l.height for l in lines) + gap * (len(lines) - 1)
    w = w or tw + 2 * padx; h = h or th + 2 * pady
    im = felt_panel(w, h, r); y = (h - th) // 2 - 4
    for l in lines:
        im.alpha_composite(l, ((w - l.width) // 2, y)); y += l.height + gap
    sh, pad = shadow_layer(w, h, r); _cards[key] = (im, sh, pad); return _cards[key]
def draw_card(canvas, key, lines, cx, cy, t, t0, label, first_frame=False, **kw):
    im, sh, pad = card(key, lines, **kw)
    p = clamp((t - t0) / 0.18); s = (0.97 if first_frame else 0.94) + (0.03 if first_frame else 0.06) * ease_out(p)
    a = 1.0 if first_frame else clamp((t - t0) / 0.10)
    paste(canvas, scaled(sh, s), cx=cx, cy=cy + int(14 * s) // 2, alpha=a)
    paste(canvas, scaled(im, s), cx=cx, cy=cy, alpha=a)
    DRAWN.append((label, int(cx - im.width / 2), int(cy - im.height / 2), int(cx + im.width / 2), int(cy + im.height / 2)))
_bub = {}
def bubble(ko, en, lang):
    k = (ko, en, lang)
    if k in _bub: return _bub[k]
    l1 = text_layer(ko, "SUIT-SemiBold.otf", 68)
    l2 = text_layer(en, *fnt("bubble_en", "en"), (80, 80, 80, 255)) if en else None
    tw = max(l1.width, l2.width if l2 else 0); th = l1.height + ((l2.height + 16) if l2 else 0)
    w, h = tw + 150, th + 100
    panel = felt_panel(w, h, 48)
    tail = felt_panel(130, 100, 0); tm = Image.new("L", (130, 100), 0); ImageDraw.Draw(tm).polygon([(8, 0), (122, 0), (65, 94)], fill=255); tail.putalpha(tm)
    sh, pad = shadow_layer(w, h, 48)
    full = Image.new("RGBA", (w + 2 * pad, h + 76 + 2 * pad), (0, 0, 0, 0))
    full.alpha_composite(sh, (0, 0)); full.alpha_composite(tail, (pad + w // 2 - 65, pad + h - 6)); full.alpha_composite(panel, (pad, pad))
    y = pad + 46; full.alpha_composite(l1, (pad + (w - l1.width) // 2, y)); y += l1.height + 16
    if l2: full.alpha_composite(l2, (pad + (w - l2.width) // 2, y))
    _bub[k] = (full, (pad, pad, pad + w, pad + h)); return _bub[k]
_mg = {}
def mongle(cut, w):
    if (cut, w) not in _mg: _mg[(cut, w)] = Image.open(A(f"몽글_{cut}.png")).convert("RGBA").resize((w, w), Image.LANCZOS)
    return _mg[(cut, w)]
def cut_at(t):
    c = CUTS[0][1]
    for t0, name in CUTS:
        if t >= t0: c = name
    if c in ("본체", "응원", "안도", "궁금함") and any(b <= t < b + 0.1 for b in BLINKS): return "눈감음"
    return c
def draw_mongle(canvas, t, seg):
    w = MONGLE_W[seg]; img_bottom = int(BODY_BOTTOM + (1 - 0.852) * w)
    paste(canvas, mongle(cut_at(t), w), x=W // 2 - w // 2, y=img_bottom - w)
LOGO = Image.open(A("lab_logo.png")).convert("RGBA"); LOGO = LOGO.crop(LOGO.getbbox())
LOGO = LOGO.resize((380, int(LOGO.height * 380 / LOGO.width)), Image.LANCZOS)
VEO_DIR = os.path.join(HERE, "veo_full")
_veo = {}
def veo_frame(idx, punch=False):
    if punch:
        k = ("punch", idx)
        if k not in _veo:
            if len(_veo) > 6: _veo.clear()
            _veo[k] = veo_frame(idx).crop(PUNCH_BOX).resize((W, H), Image.LANCZOS)
        return _veo[k]
    p = os.path.join(VEO_DIR, f"{idx:04d}.jpg")
    if not os.path.exists(p):
        files = sorted(os.listdir(VEO_DIR)); p = os.path.join(VEO_DIR, files[min(idx, len(files) - 1)])
    if p not in _veo:
        if len(_veo) > 6: _veo.clear()
        _veo[p] = Image.open(p).convert("RGBA")
    return _veo[p]
def syllable_card(lang, n_active, t):
    """「아 맞다!」 — 말한 음절까지 검정, 나머지 회색. n_active: 0~3."""
    k = ("syl", lang, n_active)
    if k in _cards: return _cards[k]
    f = font("SUIT-ExtraBold.otf", 150); chars = ["아", " ", "맞", "다", "!"]
    active_idx = {0: set(), 1: {0}, 2: {0, 1, 2}, 3: {0, 1, 2, 3, 4}}[n_active]
    full = "".join(chars); d = ImageDraw.Draw(Image.new("RGBA", (1, 1))); l, tt, r, b = d.textbbox((0, 0), full, font=f)
    layer = Image.new("RGBA", (r - l + 12, b - tt + 12), (0, 0, 0, 0)); dr = ImageDraw.Draw(layer)
    for i, ch in enumerate(chars):
        x = 6 - l + f.getlength("".join(chars[:i]))
        dr.text((x, 6 - tt), ch, font=f, fill=(0, 0, 0, 255) if i in active_idx else (190, 190, 190, 255))
    im, sh, pad = card(("sylbase", lang), [layer], w=860, h=320)
    base = felt_panel(860, 320, 40); base.alpha_composite(layer, ((860 - layer.width) // 2, (320 - layer.height) // 2 - 4))
    _cards[k] = (base, sh, pad); return _cards[k]
def pron_line(lang, n_active):
    k = ("pron", lang, n_active)
    if k in _tc: return _tc[k]
    parts = TEXT[lang]["b4_pron"]; fn, sz = fnt("b4_pron", lang)
    on = {0: set(), 1: {0}, 2: {0, 1, 2}, 3: {0, 1, 2, 3, 4}}[n_active]
    layers = [text_layer(p, fn, sz, (0, 0, 0, 255) if i in on else (190, 190, 190, 255)) for i, p in enumerate(parts)]
    f = font(fn, sz); asc, desc = f.getmetrics()
    im = Image.new("RGBA", (sum(int(f.getlength(p)) for p in parts) + 20, asc + desc + 12), (0, 0, 0, 0)); dr = ImageDraw.Draw(im); x = 10
    for i, p in enumerate(parts):
        dr.text((x, 6), p, font=f, fill=(0, 0, 0, 255) if i in on else (190, 190, 190, 255)); x += int(f.getlength(p))
    im = im.crop(im.getbbox()); _tc[k] = im; return im

# ── 프레임 ───────────────────────────────────────────────────────────────
def render_frame(t, lang):
    T = TEXT[lang]; canvas = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    ink2, ink3 = (51, 51, 51, 255), (102, 102, 102, 255)
    if t < T_B2:  # B1 훅 — 0초부터 완성된 화면
        draw_mongle(canvas, t, "B1")
        paste(canvas, fit_text(T["b1_l1"], *fnt("b1_l1", lang)), cx=W // 2, cy=345, label="훅1")
        paste(canvas, fit_text(T["b1_l2"], *fnt("b1_l2", lang), ink2), cx=W // 2, cy=440, label="훅2")
        draw_card(canvas, ("b1", lang), [text_layer("아 맞다!", "SUIT-ExtraBold.otf", 150)], W // 2, 650, t, 0.0, "카드", first_frame=True, w=860, h=320)
        paste(canvas, fit_text(T["b1_meaning"], *fnt("b1_meaning", lang)), cx=W // 2, cy=888, label="뜻")
        paste(canvas, text_layer(T["rom"], *fnt("rom", lang), ink3), cx=W // 2, cy=972, label="로마자")
    elif t < T_B3:  # B2 예문 — Veo 펠트 장면 전체 화면
        idx = int(round((t - T_B2) * FPS)); paste(canvas, veo_frame(idx, punch=t >= T_PUNCH), x=0, y=0)
        l1 = text_layer(T["b2_ko"], "SUIT-ExtraBold.otf", 96); l2 = text_layer(T["b2_sub"], *fnt("b2_sub", lang), (68, 68, 68, 255))
        if t >= T_B2 + 0.10: draw_card(canvas, ("b2", lang), [l1, l2], W // 2, 423, t, T_B2 + 0.10, "예문카드", gap=18)
    elif t < T_B4:  # B3 몽글
        draw_mongle(canvas, t, "B3")
        paste(canvas, fit_text(T["b3_top"], *fnt("top", lang)), cx=W // 2, cy=335, label="위줄")
        for key, t0, t1 in BUBBLES:
            if t0 <= t < t1:
                full, (bx0, by0, bx1, by1) = bubble(*T[key], lang)
                p = clamp((t - t0) / 0.18); s = 0.94 + 0.06 * ease_out(p); a = clamp((t - t0) / 0.10)
                cy = 640; paste(canvas, scaled(full, s), cx=W // 2, cy=cy, alpha=a)
                ox, oy = W // 2 - full.width // 2, cy - full.height // 2
                DRAWN.append(("말풍선", ox + bx0, oy + by0, ox + bx1, oy + by1 + 70))
    elif t < T_B5:  # B4 따라 말하기
        draw_mongle(canvas, t, "B4")
        paste(canvas, fit_text(T["b4_top"], *fnt("top", lang)), cx=W // 2, cy=335, label="위줄")
        n = sum(1 for s in SYL if t >= s)
        base, sh, pad = syllable_card(lang, n, t)
        paste(canvas, sh, cx=W // 2, cy=610 + 7); paste(canvas, base, cx=W // 2, cy=610, label="음절카드")
        paste(canvas, text_layer(T["b4_label"], *fnt("b4_label", lang), (119, 119, 119, 255)), cx=W // 2, cy=838, label="소리라벨")
        paste(canvas, pron_line(lang, n), cx=W // 2, cy=912, label="소리")
        if T_NOW <= t < T_NICE:
            im = fit_text(T["b4_now"], *fnt("b4_now", lang)); p = clamp((t - T_NOW) / 0.18)
            paste(canvas, scaled(im, 0.94 + 0.06 * ease_out(p)), cx=W // 2, cy=1045, alpha=clamp((t - T_NOW) / 0.1), label="차례")
        elif t >= T_NICE:
            im = fit_text(T["b4_nice"], *fnt("b4_now", lang)); p = clamp((t - T_NICE) / 0.18)
            paste(canvas, scaled(im, 0.94 + 0.06 * ease_out(p)), cx=W // 2, cy=1045, alpha=clamp((t - T_NICE) / 0.1), label="칭찬")
    else:  # B5 빈칸 댓글 유도 — 첫 화면으로 되돌아가는 모양
        draw_mongle(canvas, t, "B5")
        paste(canvas, LOGO, cx=W // 2, cy=335, label="로고")
        paste(canvas, fit_text(T["b5_q"], *fnt("b5_q", lang)), cx=W // 2, cy=478, label="질문")
        draw_card(canvas, ("b5", lang), [text_layer(T["b5_card"], "SUIT-ExtraBold.otf", 118)], W // 2, 672, t, T_B5 + 0.05, "빈칸카드", w=880, h=300)
        paste(canvas, fit_text(T["b5_cta"], *fnt("b5_cta", lang), (85, 85, 85, 255)), cx=W // 2, cy=880, alpha=clamp((t - T_B5 - 0.25) / 0.15), label="댓글유도")
        if t >= T_SEND:
            im = fit_text(T["b5_send"], *fnt("b5_send", lang)); p = clamp((t - T_SEND) / 0.18)
            paste(canvas, scaled(im, 0.94 + 0.06 * ease_out(p)), cx=W // 2, cy=968, alpha=clamp((t - T_SEND) / 0.10), label="보내기유도")
    return canvas.convert("RGB")

def export_table(path):
    tbl = {"id": "LAB표현소개_아맞다_20260927", "version": "v2", "line": "CL-6 LAB 표현 소개", "character": "몽글",
           "canvas": [W, H], "fps": FPS, "duration": DUR, "safe_zone": {"x0": SAFE[0], "y0": SAFE[1], "x1": SAFE[2], "y1": SAFE[3], "source": "Meta 통합 9:16 안전 영역(2026-03) — 위 269·아래 672·좌우 65px"},
           "music": {"file": "음악/lyria3_b.mp3", "model": "lyria-3-clip-preview (Vertex)", "offset": MUSIC_OFFSET, "bpm": 110, "break_music_time": 13.11, "break_video_time": T_B4},
           "cuts": {"B1 훅": [0, T_B2], "B2 예문(Veo 전체 화면)": [T_B2, T_B3], "B2 펀치인(1.15배, 「우산」)": [T_PUNCH, T_B3], "B3 몽글": [T_B3, T_B4], "B4 따라 말하기": [T_B4, T_B5], "B5 빈칸 댓글": [T_B5, DUR]},
           "veo": {"file": "소스/veo_우산_장면_원본.mp4", "source_start": VEO_START},
           "voice": {k: {"at": VOICE_AT[k], "speech": round(speech(k), 3), **TIMING["lines"][k]} for k in VOICE_AT},
           "syllable_highlight": SYL, "now_you": T_NOW, "nice": T_NICE, "send_cta": T_SEND, "punch_box": PUNCH_BOX, "bubbles": [{"key": k, "start": a, "end": b} for k, a, b in BUBBLES],
           "mongle_cuts": [{"t": t, "cut": c} for t, c in CUTS], "blinks": BLINKS, "mongle_width": MONGLE_W, "body_bottom": BODY_BOTTOM,
           "text": TEXT, "audio": [{"t": round(t, 3), "bus": b, "file": f, "gain_db": g, "what": w} for t, b, f, g, w in AUDIO], "duck_db": {"voice": DUCK["voice"], "mascot": DUCK["mascot"], "practice": DUCK["practice"][2]},
           "motion_rules": "몽글: 표정 컷·눈 깜빡임만(회전·흔들림·이동·크기 애니메이션 없음) · 글자·카드: 0.94→1.0 튀어나옴 0.18초 · 구간 사이는 박자 하드 컷"}
    json.dump(tbl, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

def encode(out, lang, n=None):
    n = n or int(round(DUR * FPS))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p",
           "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.1", "-refs", "4", "-preset", "slow", "-crf", "16", "-g", "60", "-keyint_min", "30", "-sc_threshold", "0",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-movflags", "+faststart", "-an", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        p.stdin.write(render_frame(i / FPS, lang).tobytes())
        if i % 90 == 0: print(f"  {lang} {i}/{n}", flush=True)
    p.stdin.close(); p.wait(); print("video →", out, "exit", p.returncode); return p.returncode

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en"); ap.add_argument("--out"); ap.add_argument("--preview"); ap.add_argument("--export-table")
    ap.add_argument("--check", action="store_true", help="모든 프레임의 글자·카드가 안전 영역 안인지 검사")
    ap.add_argument("--cover")
    a = ap.parse_args()
    if a.export_table: export_table(a.export_table); print("장면표 →", a.export_table)
    if a.preview:
        os.makedirs(os.path.join(HERE, "preview"), exist_ok=True)
        for s in a.preview.split(","):
            im = render_frame(float(s), a.lang); p = os.path.join(HERE, "preview", f"{a.lang}_{float(s):05.2f}.png"); im.save(p); print("preview", p)
    if a.cover:
        render_frame(0.30, a.lang).save(a.cover); print("cover →", a.cover)
    if a.check:
        bad = {}; n = int(round(DUR * FPS))
        for i in range(0, n, 3):
            DRAWN.clear(); render_frame(i / FPS, a.lang)
            for lab, x0, y0, x1, y1 in DRAWN:
                if x0 < SAFE[0] or y0 < SAFE[1] or x1 > SAFE[2] or y1 > SAFE[3]:
                    bad.setdefault(lab, (round(i / FPS, 2), x0, y0, x1, y1))
        print(json.dumps({"lang": a.lang, "safe": SAFE, "violations": bad}, ensure_ascii=False))
    if a.out: sys.exit(encode(a.out, a.lang))
