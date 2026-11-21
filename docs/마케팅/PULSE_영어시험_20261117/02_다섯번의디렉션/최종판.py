# 둘째 편 「다섯 번의 디렉션」 최종 판 만들기(2026-11-20, Claude) — 거친판.py를 바탕으로 한다
#   유호님 11-20 「둘 다 굽기」로 구운 720p 여섯 판을 잇는다. 거친 판과 다른 점: 판을 1080×1920으로 키워 자막 · 끝 화면 글자를 그 크기에서 얹는다.
#   화면: 여섯 판(git 밖 synk-vendor/pulse-en-ep2-20261117/받음_720p/C1~C6.mp4)을 컷표의 in · out대로 잘라 잇는다(1080×1920 · 초당 24장).
#   소리: 시댄스가 판마다 낸 소리를 그대로 쓴다. 슬레이트 딱도 판 소리다(실제 녹음 효과음을 겹치는 일은 최종 판에서 한다). 음량은 −14 LUFS로 맞춘다.
#   말자막: 자리는 아래 CAPS 표에 손으로 적었다. 11-18 받아 온 판을 faster-whisper large-v3-turbo(VAD 켬)로 받아쓰고 0.1초 소리 세기와 맞춰 본 값이다.
#           medium은 C1을 「I'm going to go to the bathroom」으로 지어내서 쓰지 않는다. --받아쓰기를 주면 판마다 다시 받아써 찍기만 한다.
#           첫 편 자막 결(명조 · #EFE7DA · 마침표와 쉼표 없음 · 0.25초에 8px 올라옴)을 턱 아래 가슴 자리(y 1040)에 옅은 어둠 띠와 함께 둔다.
#           11-21 1차 판은 머리 위 벽(y 165)에 두었다가 릴스 위쪽 앱 자리(메타 안전 영역 위 269)에 걸려 내렸다. 화면 밖 감독 말에는 DIRECTOR 꼬리표를 단다.
#   끝 화면: C6 3.2초부터 턱 아래를 어둡게 깔고, 3.4초부터 평면 로고 → 고지 → 주소를 0.3초 간격으로 0.4초 동안 12px 올린다(첫 편 P10en.tsx 꼴).
#           11-21 1차 판은 위쪽 띠에 두어 안전 영역 밖이었고, 미학 맹검(GPT)이 펠트 로고 · 배너 같은 띠 · 붙은 두 줄로 5점 기각했다.
#           로고는 첫 편처럼 평면 판(11-18 유호님 「평면으로 바꿔」는 첫 편 범위 — 이 편은 게시 승인 때 함께 여쭌다), 고지는 첫 편 문구와 Inter Tight(cv08).
#   python -X utf8 최종판.py [--받아쓰기]
#     → git 밖 synk-vendor/pulse-en-ep2-20261117/최종/다섯번의디렉션_1080.mp4 · 다섯번의디렉션_1080_반초.jpg · _받아쓰기_720p.json
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", "..", "..", ".."))
V = os.path.normpath(os.path.join(REPO, "..", "synk-vendor", "pulse-en-ep2-20261117"))
SRC = os.path.join(V, "받음_720p")
OUT = os.path.join(V, "최종")
LOGO = os.path.join(REPO, "docs", "홍보물", "마케팅실행_20260909", "브랜드킷", "배치용", "SYNK-PULSE-Paper.png")
SERIF = "C:/Windows/Fonts/NotoSerifKR-VF.ttf"
W, H, FPS = 1080, 1920, 24
K = W / 720   # 거친 판(720 폭)에서 정한 글자 크기 · 자리를 키우는 배수
WARM = (0xEF, 0xE7, 0xDA)

# 판마다 말자막 — (판 안 시작 초, 끝 초, 보일 글[, 가운데 높이(720 기준)]). 화면 밖 감독의 That's a wrap도 소리를 끄고 보는 사람을 위해 단다.
#   11-21 720p 판을 받아쓰고(faster-whisper large-v3-turbo) 0.1초 소리 세기로 맞춘 값이다. 받아쓰기 초가 소리 세기와 어긋나면 소리 세기를 따랐다.
#   C1 3.9~4.7 · C2 2.1~2.8 · C3 4.0~4.6 · C4 「I'm fi—」 2.5~2.8, 재채기 4.0~4.4, 「I'm fine」 5.5~6.05 · C5 「I'm—」 1.4~1.55,
#   「Myself?」 2.8~3.3, 「Who's that?」 3.9~4.3, 「That's a wrap」 4.6~5.0(약 140Hz — 남자 목소리로 나옴, 하린 대사는 220~250Hz).
#   「Myself?」는 「Who's that?」까지 이어 두어 두 마디 사이에 자막이 비지 않게 한다(11-21 미학 맹검 GPT 「글이 표정을 뒤따라온다」).
#   11-21 마감 관문(마감_20261121-2226) 반영: 판마다 슬레이트가 든 동안 같은 주문을 DIRECTION 꼬리표와 함께 안전 영역(y 1040)에 단다(F20 —
#   분필 글이 y 1600~1860이라 릴스 · 쇼츠 아래 글자에 덮인다). 「Who's that?」은 「Myself?」 아래 둘째 줄로 4.5초까지 두고(F16),
#   「That's a wrap」은 웃음이 터지기 직전 5.45초까지 둔다(F21). 글의 \n은 줄바꿈이다.
CAPS = {
    "C1": [(0.0, 1.45, "She just got dumped."), (3.80, 4.85, "I’m fine")],
    "C2": [(0.0, 1.20, "Lying to her mom\non the phone."), (2.05, 2.95, "I’m fine!")],
    "C3": [(0.0, 1.10, "Just won the lottery.\nAt work. Hide it."), (3.95, 4.75, "I’m fine")],
    "C4": [(0.0, 1.40, "About to sneeze."), (2.40, 3.00, "I’m fi—"), (5.45, 6.25, "I’m fine", 1130)],   # 다가감 15%로 5.5초 뒤 턱이 990까지 내려와 그 자막만 내린다
    "C5": [(0.0, 1.15, "Be yourself."), (1.35, 1.95, "I’m—"), (2.75, 4.50, "Myself?"), (3.85, 4.50, "Who’s that?", 1142), (4.55, 5.45, "That’s a wrap")],
    "C6": [(1.25, 3.40, "She doesn’t exist.\nBut she takes direction.")],
}
DIRECTOR = {"That’s a wrap"}   # 화면 밖 감독 목소리(약 140Hz) — 하린 말과 헷갈리지 않게 꼬리표를 단다(11-21 그록 · 소네트 「누가 한 말인지 모름」)
DIRECTION = {"She just got dumped.", "Lying to her mom\non the phone.", "Just won the lottery.\nAt work. Hide it.", "About to sneeze.", "Be yourself."}
# 판 안 빠르기 — (판 안 시작 초, 끝 초, 배). 1보다 작으면 늦추고 그만큼 앞에 빈 소리를 넣어 딱 소리를 그림에 맞춘다, 크면 소리도 atempo로 당긴다.
#   C2 · C3은 딱(0.70 · 0.60초) 앞 들고 있는 구간을 반 빠르기로 늘려 주문을 1.7초쯤 읽게 한다(F13). C1은 눈 감고 참는 2.1~3.6초를 1.5배로 당겨
#   첫 「I'm fine」이 3.3초에 오게 한다(F17).
SPEED = {"C1": [(2.1, 3.6, 1.5)], "C2": [(0.0, 0.65, 0.5)], "C3": [(0.0, 0.55, 0.5)]}
CAP_Y = 1040   # 말자막 가운데 높이(1080×1920 화소) — 턱(약 860) 아래, C3 휴대폰 윗변(약 1130) 위. 메타 안전 영역 y 269~1248 안
CARD = {"어둠": 3.8, "로고": 4.0, "고지": 4.3, "주소": 4.6}   # C6 판 안의 초 — 슬레이트가 판 3.5~4.0초에 빠진 뒤 연다. 로고가 4.4초에 멈춰 판 끝(7.0)까지 2.6초 선다
FONTS = os.path.join(REPO, "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012", "video", "자막시안_20261103", "remotion", "public", "fonts")
CREAM = (239, 230, 216)


def run(*a):
    subprocess.run(a, check=True)


def cuts():
    d = json.load(open(os.path.join(HERE, "컷표.json"), encoding="utf-8"))
    return [(c["cut"], float(c["in"]), float(c["out"]), c) for c in d["detail"]]


def font(size, weight=500):
    f = ImageFont.truetype(SERIF, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def transcribe(table):
    from faster_whisper import WhisperModel
    m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
    out = {}
    for cut, a, b, _ in table:
        wav = os.path.join(OUT, "_소리", f"{cut}.wav")
        os.makedirs(os.path.dirname(wav), exist_ok=True)
        run("ffmpeg", "-y", "-v", "error", "-i", os.path.join(SRC, f"{cut}.mp4"), "-ac", "1", "-ar", "16000", wav)
        segs, _ = m.transcribe(wav, language="en", word_timestamps=True, vad_filter=True, vad_parameters={"min_silence_duration_ms": 200})
        words = [(round(w.start, 2), round(w.end, 2), w.word.strip()) for s in segs for w in (s.words or [])]
        out[cut] = words
        print(cut, " ".join(f"{w}@{s:.2f}" for s, e, w in words), flush=True)
    return out


def pieces(cut, a, b):
    """판 구간 [a, b]를 SPEED 경계로 나눈 (시작, 끝, 배) 목록"""
    cuts_ = sorted({a, b} | {x for s_, e_, _ in SPEED.get(cut, []) for x in (s_, e_) if a < x < b})
    out = []
    for s_, e_ in zip(cuts_, cuts_[1:]):
        f = next((f for x0, x1, f in SPEED.get(cut, []) if x0 <= s_ and e_ <= x1), 1.0)
        out.append((s_, e_, f))
    return out


def edit_len(cut, a, b):
    return sum((e_ - s_) / f for s_, e_, f in pieces(cut, a, b))


def to_edit(cut, a, b, x):
    """판 안 초 x를 그 판의 편집 안 초로"""
    t = 0.0
    for s_, e_, f in pieces(cut, a, b):
        if x <= s_:
            break
        t += (min(x, e_) - s_) / f
    return t


def place(table):
    """판마다 말자막의 (편 초 시작, 끝, 글) — CAPS 표를 판의 in · out · 빠르기에 맞춰 편 시각으로 옮긴다"""
    caps, t0 = [], 0.0
    for cut, a, b, _ in table:
        for c in CAPS[cut]:
            x, y, text = c[:3]
            if a <= x < b:
                caps.append((t0 + to_edit(cut, a, b, x), t0 + to_edit(cut, a, b, min(y, b)), text, c[3] if len(c) > 3 else CAP_Y))
        t0 += edit_len(cut, a, b)
    return caps


def text_patch(text, size, shadow=True, weight=500):
    f = font(size, weight)
    l, t, r, b = f.getbbox(text)
    pad = round(24 * W / 720)
    w, h = r - l + 2 * pad, b - t + 2 * pad
    txt = Image.new("L", (w, h), 0)
    ImageDraw.Draw(txt).text((pad - l, pad - t), text, font=f, fill=255)
    rgba = np.zeros((h, w, 4), np.float32)
    if shadow:
        far = np.asarray(txt.filter(ImageFilter.GaussianBlur(7 * W / 720)), np.float32) / 255 * 0.55
        near = np.asarray(txt.filter(ImageFilter.GaussianBlur(1.5 * W / 720)), np.float32) / 255 * 0.7
        rgba[..., 3] = np.maximum(far, near)
    a = np.asarray(txt, np.float32) / 255
    rgba[..., :3] = np.asarray(WARM, np.float32)[None, None, :] * a[..., None]
    rgba[..., 3] = a + rgba[..., 3] * (1 - a)
    rgba[..., :3] = np.where(rgba[..., 3:4] > 0, rgba[..., :3] / np.maximum(rgba[..., 3:4], 1e-6), 0)
    return rgba


def logo_patch(width):
    """평면 판 로고 — 첫 편 영어판.py trim_logo(flat=True)와 같은 법: 승인 파일의 외곽선(알파)을 그대로 두고 synk는 크림 한 색,
    PULSE는 베리 몸통 색 한 색으로 채운다. 첫 편 마지막 판처럼 그늘을 두지 않는다."""
    im = Image.open(LOGO).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    a = np.asarray(im).astype(np.float32)
    A = a[..., 3]
    col = (A > 128).sum(axis=0)
    w = len(col)
    gap = [x for x in np.where(col == 0)[0] if w * 0.4 < x < w * 0.75]      # synk와 PULSE 사이 빈 기둥
    cut = int(np.median(gap))
    px = a[:, cut:, :3][A[:, cut:] > 200]
    berry = np.median(px[(px.max(1) - px.min(1)) > 60], axis=0)            # 흰 실땀을 뺀 베리 몸통 색
    flat = np.zeros_like(a)
    flat[..., 3] = A
    flat[:, :cut, :3] = CREAM
    flat[:, cut:, :3] = berry
    im = Image.fromarray(flat.astype(np.uint8)).resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = np.asarray(im, np.float32)
    out[..., 3] /= 255
    return out


_INTER = {}


def inter(name, size):
    """Inter Tight — 「AI」의 I가 l로 읽히지 않게 cv08(가로획 붙은 I)을 기본 글자로 바꾼 사본을 쓴다(첫 편 끝 화면과 같은 글자꼴).
    Pillow에 raqm이 없어 글꼴 기능을 켤 수 없어서 cmap의 I를 I.1로 돌린 사본을 git 밖 최종/_글꼴에 만든다."""
    if name not in _INTER:
        from fontTools.ttLib import TTFont
        dst = os.path.join(OUT, "_글꼴", name.replace(".ttf", "-cv08.ttf"))
        if not os.path.exists(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            f = TTFont(os.path.join(FONTS, name))
            for t in f["cmap"].tables:
                if t.isUnicode() and ord("I") in t.cmap:
                    t.cmap[ord("I")] = "I.1"
            f.save(dst)
        _INTER[name] = dst
    return ImageFont.truetype(_INTER[name], size)


def plain_patch(text, f, color=CREAM, spacing=0.0):
    """그늘 없는 글 한 줄(어두운 바탕 위 끝 화면용). spacing은 글자 사이를 크기의 몇 배로 벌릴지."""
    if spacing:
        ws = [f.getlength(ch) for ch in text]
        tw = sum(ws) + spacing * f.size * (len(text) - 1)
    else:
        tw = f.getlength(text)
    asc, desc = f.getmetrics()
    pad = 6
    w, h = int(tw) + 2 * pad, asc + desc + 2 * pad
    txt = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(txt)
    if spacing:
        x = pad
        for ch, cw in zip(text, ws):
            d.text((x, pad), ch, font=f, fill=255)
            x += cw + spacing * f.size
    else:
        d.text((pad, pad), text, font=f, fill=255)
    a = np.asarray(txt, np.float32) / 255
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = color
    out[..., 3] = a
    return out


def caption_patch(text):
    """말자막 — 명조 600 글을 옅은 어둠 띠(둥근 모서리) 위에 얹는다. 크림 스웨터 위에서도 읽히게(11-21).
    슬레이트 주문과 끝 슬레이트 글은 한 단계 작게, 두 줄까지 — 띠 폭을 오른쪽 단추 자리(x 920) 안에 둔다."""
    small = "\n" in text or text in DIRECTION
    f = font(round((38 if small else 44) * K), 600)
    l, t, r, b = (int(round(v)) for v in ImageDraw.Draw(Image.new("L", (8, 8))).multiline_textbbox((0, 0), text, font=f, align="center", spacing=round(8 * K)))
    padx, pady = round(17 * K), round(9 * K)
    label = None
    if text in DIRECTOR or text in DIRECTION:
        label = plain_patch("DIRECTOR" if text in DIRECTOR else "DIRECTION", inter("InterTight-SemiBold.ttf", round(18 * K)), color=(200, 205, 215), spacing=0.16)
    lh = 0 if label is None else label.shape[0] - 4
    w = max(r - l, 0 if label is None else label.shape[1] - 12) + 2 * padx
    h = (b - t) + 2 * pady + lh
    box = Image.new("L", (w, h), 0)
    ImageDraw.Draw(box).rounded_rectangle((0, 0, w - 1, h - 1), radius=round(12 * K), fill=255)
    box = box.filter(ImageFilter.GaussianBlur(1.2))
    txt = Image.new("L", (w, h), 0)
    ImageDraw.Draw(txt).multiline_text(((w - (r - l)) / 2 - l, pady + lh - t), text, font=f, fill=255, align="center", spacing=round(8 * K))
    a_box = np.asarray(box, np.float32) / 255 * 0.72   # 크림 니트(회색 약 230) 위에서 글 둘레가 회색 80 아래가 되는 짙기 — 0.5 · 0.58은 올리기전검사 「흰 기본 글자」(둘레 어두운 칸 18 · 42%)에 걸렸다(11-21 3차 판)
    a_txt = np.asarray(txt, np.float32) / 255
    out = np.zeros((h, w, 4), np.float32)
    out[..., :3] = (14, 12, 18)
    out[..., 3] = a_box
    if label is not None:
        lx, ly = (w - label.shape[1]) // 2, pady - 4
        la = label[..., 3] * 0.85
        reg = out[ly:ly + label.shape[0], lx:lx + label.shape[1]]
        na = la + reg[..., 3] * (1 - la)
        reg[..., :3] = (label[..., :3] * la[..., None] + reg[..., :3] * (reg[..., 3:4] * (1 - la[..., None]))) / np.maximum(na[..., None], 1e-6)
        reg[..., 3] = na
    na = a_txt + out[..., 3] * (1 - a_txt)
    out[..., :3] = (np.asarray(WARM, np.float32) * a_txt[..., None] + out[..., :3] * (out[..., 3:4] * (1 - a_txt[..., None]))) / np.maximum(na[..., None], 1e-6)
    out[..., 3] = na
    return out


def blend(frame, patch, cx, cy, alpha):
    if alpha <= 0:
        return
    h, w = patch.shape[:2]
    x, y = int(round(cx - w / 2)), int(round(cy - h / 2))
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1:
        return
    p = patch[y0 - y:y1 - y, x0 - x:x1 - x]
    a = p[..., 3:4] * alpha
    region = frame[y0:y1, x0:x1].astype(np.float32)
    frame[y0:y1, x0:x1] = (region * (1 - a) + p[..., :3] * a).astype(np.uint8)


def ramp(t, a, d):
    if t <= a:
        return 0.0
    k = min(1.0, (t - a) / d)
    return 1 - (1 - k) ** 3   # 빠르게 나와 천천히 멎음


def 음량맞춤(path):
    """공용 tools/음량마감.mjs로 −14.5 LUFS(±0.5) · 봉우리 −1.2 dBFS 아래 · AAC 384k(실측 320k 미만이면 품질 모드로 다시)로 마감한다.
    11-21 2차 판까지는 이 파일 안의 리미터 반복을 썼는데 AAC 실측이 194~286kbps로 올리기전검사 기준(320)에 못 미쳤다."""
    tmp = path[:-4] + "_마감.mp4"
    run("node", os.path.join(REPO, "tools", "음량마감.mjs"), path, tmp, "--리미터", "0.68", "--덮어쓰기")   # 공용 기준 −14.5±0.5 LUFS · 봉우리 −1.2 아래. 품질 모드 AAC가 봉우리를 1~2dB 올려 리미터를 0.68로 낮췄다(11-21 3차 판 −14.9 · −1.6)
    os.replace(tmp, path)


def main():
    os.makedirs(OUT, exist_ok=True)
    table = cuts()
    if "--받아쓰기" in sys.argv:
        json.dump(transcribe(table), open(os.path.join(OUT, "_받아쓰기_720p.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return
    caps = place(table)
    cut_starts, acc = set(), 0.0
    for cut, a, b, _ in table:
        cut_starts.add(round(acc, 3))
        acc += edit_len(cut, a, b)
    for a, b, s, _ in caps:
        print(f"  자막 {a:5.2f}~{b:5.2f} {s}")

    # 1) 잘라 잇기 — 판과 컷표 구간이 그대로면 앞 회차의 이음 판을 다시 쓴다(PC가 바쁠 때 10분 걸렸다)
    joined = os.path.join(OUT, "_이음_720p.mov")
    key = json.dumps([(cut, a, b, SPEED.get(cut), os.path.getmtime(os.path.join(SRC, f"{cut}.mp4"))) for cut, a, b, _ in table])
    keyf = joined + ".key"
    if not (os.path.exists(joined) and os.path.exists(keyf) and open(keyf, encoding="utf-8").read() == key):
        args, fc, parts = ["ffmpeg", "-y", "-v", "error"], [], []
        for i, (cut, a, b, _) in enumerate(table):
            args += ["-i", os.path.join(SRC, f"{cut}.mp4")]
            ps = pieces(cut, a, b)
            fc.append(f"[{i}:v]split={len(ps)}" + "".join(f"[s{i}_{j}]" for j in range(len(ps))))
            fc.append(f"[{i}:a]asplit={len(ps)}" + "".join(f"[t{i}_{j}]" for j in range(len(ps))))
            for j, (s_, e_, f) in enumerate(ps):
                tag = f"{i}_{j}"
                fc.append(f"[s{tag}]trim={s_}:{e_},setpts=(PTS-STARTPTS)/{f},scale={W}:-2:flags=lanczos,crop={W}:{H},fps={FPS},setsar=1[v{tag}]")
                au = f"[t{tag}]atrim={s_}:{e_},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo"
                if f > 1:
                    fc.append(f"{au},atempo={f}[a{tag}]")
                elif f < 1:   # 늘린 만큼 앞에 빈 소리 — 딱 소리가 늘린 그림의 딱에 온다
                    pad = (e_ - s_) / f - (e_ - s_)
                    fc.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{pad:.4f},asetpts=PTS-STARTPTS[z{tag}]")
                    fc.append(f"{au}[y{tag}]")
                    fc.append(f"[z{tag}][y{tag}]concat=n=2:v=0:a=1[a{tag}]")
                else:
                    fc.append(f"{au}[a{tag}]")
                parts.append(tag)
        fc.append("".join(f"[v{t}][a{t}]" for t in parts) + f"concat=n={len(parts)}:v=1:a=1[v][a]")
        run(*args, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-crf", "14", "-preset", "fast",
            "-c:a", "pcm_s16le", joined)
        open(keyf, "w", encoding="utf-8").write(key)

    # 2) 자막과 끝 화면 얹기
    cap_p = {s: caption_patch(s) for _, _, s, _ in caps}
    c6 = sum(edit_len(cut, a, b) for cut, a, b, _ in table if cut != "C6")
    c6_in = next(a for cut, a, b, _ in table if cut == "C6")
    total = sum(edit_len(cut, a, b) for cut, a, b, _ in table)
    logo = logo_patch(600)
    disc = plain_patch("Every person in this film is AI-generated", inter("InterTight-SemiBold.ttf", 42))
    url = plain_patch("synk.im/en/pulse", inter("InterTight-Medium.ttf", 36))
    # 끝 묶음은 턱(C6 약 800) 아래부터 안전 영역 아랫선(1248) 안에 쌓는다 — 로고, 44px, 고지, 26px, 주소
    hs = [logo.shape[0], disc.shape[0], url.shape[0]]
    top = 1236 - (hs[0] + 44 + hs[1] + 26 + hs[2])
    card_y = [top + hs[0] / 2, top + hs[0] + 44 + hs[1] / 2, top + hs[0] + 44 + hs[1] + 26 + hs[2] / 2]
    # 글 묶음 뒤에만 부드러운 타원 그늘(가장 짙은 곳 0.72) — 11-21 1차 마감 관문 F18: 화면 폭 띠는 목을 가로지르는 수평선이 되고
    #   크림 니트가 숯색으로 보여 마지막 장이 「옷이 바뀐 그림」으로 남았다
    gy, gx = np.mgrid[0:H, 0:W].astype(np.float32)
    rr = np.sqrt(((gx - W / 2) / 640) ** 2 + ((gy - (top + 1236) / 2) / 260) ** 2)
    s = np.clip((1 - rr) / 0.55, 0, 1)
    shade = (0.72 * s * s * (3 - 2 * s))[:, :, None]

    # 음량 −14 LUFS — 한 번에 거는 loudnorm은 34초 판에서 −15.6에 머물러(11-18), 먼저 재고 그 값으로 다시 건다
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", joined, "-vn", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    m = json.loads(r.stderr[r.stderr.rindex("{"):r.stderr.rindex("}") + 1])
    norm = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
            f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    n = int(round(total * FPS))
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", joined, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    final = os.path.join(OUT, "다섯번의디렉션_1080.mp4")
    enc = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-i", joined, "-map", "0:v", "-map", "1:a", "-af", norm, "-ar", "48000",
                            # 올리기전검사 기준: 영상 8Mbps 이상(30fps 이하) · 소리 320kbps 이상(목표 384) · BT.709 표시(11-21 2차 판에서 6.6Mbps · 194kbps · 표시 없음으로 걸림)
                            "-vf", "scale=out_color_matrix=bt709:out_range=tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                            "-c:v", "libx264", "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709", "-b:v", "12M", "-minrate", "9M", "-maxrate", "16M", "-bufsize", "24M", "-preset", "medium", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-b:a", "384k",
                            "-movflags", "+faststart", "-shortest", final], stdin=subprocess.PIPE)
    for i in range(n):
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        fr = np.frombuffer(buf, np.uint8).reshape(H, W, 3).copy()
        t = i / FPS
        for a, b, s, cy in caps:
            if a <= t < b:
                k = 1.0 if round(a, 3) in cut_starts else ramp(t, a, 0.25)   # 컷과 함께 뜨는 주문 자막은 흐리게 오르지 않는다(11-21 3차 판)
                o = min(k, 1.0 if t < b - 0.2 else (b - t) / 0.2)
                blend(fr, cap_p[s], W / 2, cy + (1 - k) * 8 * K, o)
        tc = t - c6 + c6_in   # C6 판 안의 초
        if tc >= CARD["어둠"]:
            g = ramp(tc, CARD["어둠"], 0.5)
            fr[:] = (fr.astype(np.float32) * (1 - shade * g) + np.array([10, 8, 14], np.float32) * shade * g).astype(np.uint8)
            for key, patch, cy in (("로고", logo, card_y[0]), ("고지", disc, card_y[1]), ("주소", url, card_y[2])):
                k = ramp(tc, CARD[key], 0.4)
                blend(fr, patch, W / 2, cy + (1 - k) * 12 * K, k * (0.9 if key == "주소" else 1.0))
        enc.stdin.write(fr.tobytes())
    enc.stdin.close()
    enc.wait()
    dec.stdout.close()   # 이음 판이 n장보다 한두 장 길면 디코더가 남은 장을 내보내려다 막힌다(11-18 첫 굽기에서 10분 멈춤)
    dec.kill()
    dec.wait()
    음량맞춤(final)
    run("ffmpeg", "-y", "-v", "error", "-i", final, "-vf", "fps=2,scale=144:-2,tile=12x7:padding=3", "-frames:v", "1", "-q:v", "4",
        os.path.join(OUT, "다섯번의디렉션_1080_반초.jpg"))
    print(final, f"{total:.1f}초")


if __name__ == "__main__":
    main()
