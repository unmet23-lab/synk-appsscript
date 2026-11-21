# 셋째 편 「명절 밥상 이어폰」 편집(2026-11-21, Claude) — 받은 영상 아홉 판을 잇고 자막 · 브랜드 · 끝 화면 · 소리를 얹어 최종본을 만든다.
#   python -X utf8 도구/편집.py [--밖 <폴더>]   → git 밖 synk-vendor/pulse-en-ep3-20261117/최종/명절밥상_이어폰.mp4 (+ _반초.jpg 띠)
#   받은 영상: synk-vendor/pulse-en-ep3-20261117/받음/<컷>.mp4(드리미나 720p — 머리에 60fps로 적히지만 실제 24fps라 24로 다시 짠다)
#   쓰는 구간: 컷표 detail의 in · out이 기본이고, 받은 판을 본 뒤 고친 자리는 아래 EDL에 적는다(까닭과 함께).
#   자막(말자막): 브랜드 폰트 정본 §10 — 아래 어두운 둥근 판, Inter Tight. 질문 넷은 아래 끝(y 1236)에 붙여 위로 쌓고 이어폰 「톡」 프레임에 한꺼번에 지운다(이 편의 장치, 컷표 글자 1).
#   브랜드: 브랜드/로고_A_GOYO.png + 「Hear only what matters.」(C7 0.3초부터 끝 화면 전까지), 끝 화면 A(어둡게 흐린 장면 + SYNK PULSE 승인 로고) — 브랜드/시안.py의 자리 · 크기를 그대로 쓴다.
#   소리: 판마다 시댄스 소리를 그 구간 그대로 잇고, 「톡」에서 끊어 낮은 웅웅거림만, C5 이어폰을 빼는 순간 방 소리 복귀, C6b 「딸깍」에서 다시 고요, 끝 화면에 「톡」 한 번. −14 LUFS.
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
EP = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(EP, "..", "..", "..", ".."))
sys.path.insert(0, os.path.join(EP, "브랜드"))
import 시안 as SA   # noqa: E402 — paste_logo · text · note · PULSE · FONT_*

VEN = "C:/Users/q1212/Documents/synk-vendor/pulse-en-ep3-20261117"
GOT = os.path.join(VEN, "받음")
FPS, W, H, SR = 24, 1080, 1920, 48000
SND = "C:/Users/q1212/Documents/synk-vendor/sound-library/sonniss_gdc2026/풀림"
TAP_SRC = os.path.join(SND, "Epic Stock Media - Board Game - Sound Set Kit for Tabletop and Digital Games",
                       "UIClick_UI Button Analog Vintage Double Click Neutral Dry Press 11_ESM_BG.wav")
FONT_M = os.path.join(ROOT, "docs", "브랜드_폰트", "InterTight", "InterTight-Medium.ttf")

# 받은 판을 보고 정한 쓰는 구간(판 안의 초, 11-21 — 장면을 뽑아 보고 소리 크기 · 받아쓰기로 잼). 컷표 in · out에서 바뀐 까닭은 줄마다.
EDL = {
    "C1": (0.80, 3.60),   # 0.8초 「So,」 · 1.9~2.8초 「any wedding plans?」 · 2.0초 눈이 고모 쪽 · 3.0초 굳은 미소
    # 마감 관문 F19(11-21): 끝 0.25초에 준호가 입을 크게 벌린 채 굳는다 → 3.15초에서 끊는다
    "C2": (0.80, 3.15),   # 준호 0.7~2.8초가 그림과 맞고, 민재 줄(3.4~4.8초)은 C3 첫머리에 소리만 넘긴다
    "C3": (1.00, 4.20),   # 3.4~4.3초 「Seeing anyone yet?」 · 3.0~4.2초 왼손이 귀로 — 「yet?」 바로 뒤에 C3b의 톡
    "C3b": (0.55, 1.60),  # 0.75~1.0초 손끝이 누름 · 1.5초부터 손이 내려가는 도중에 C4로(움직임에서 자름)
    # 11-21 낯선이 시험관 둘(GPT · 그록)이 모두 11~12초(고요한 C4)에서 「넘길 것」 — 고요 뒤 새 일이 늦게 온다.
    #   C4를 3.4초 → 3.0초로 줄여 할머니 손이 0.6초 일찍 들어온다. 3.5초 손이 들어와 3.85초 왼팔에 닿는 데서 C5의 톡톡으로.
    "C4": (0.85, 3.85),
    # 마감 관문 F10(11-21): C5 끝은 뺀 이어폰을 턱 앞에 낮게 드는데 C6 첫 장은 손이 귀 옆이라 순간이동했다.
    #   빠른 고침 — 손이 아직 귀에 있는 3.75초(뺀 직후)에서 끊고, 「Eat more.」는 C6 머리에 소리로 넘긴다.
    #   C5 끝의 젊어지는 할머니 손(F2 · F20)도 함께 빠진다.
    # 마감 다시 관문 2244 F4: 3.75초에서 끊자 C5 끝은 왼쪽 아래를 보고 C6 첫 장은 할머니 쪽을 보며 웃어 고개가 한 장 사이에 뒤집혔다
    #   → 할머니 쪽으로 고개를 돌린 4.04초(손은 아직 뺨 높이에 이어폰을 듦)에서 끊어 C6 첫 장의 눈길 · 손과 잇는다
    "C5": (0.95, 4.04),   # 1.0~1.5초 어깨 톡톡 · 2.1초 손이 귀로 · 3.5초 이어폰 뺌 · 3.9~4.0초 할머니 쪽으로 고개
    # 마감 관문 F1: 원본 2.40~2.60초 왼쪽 관자놀이 머리선에 흰 띠가 번진다 → 2.38초에서 끊고 머리를 0.6초로 당긴다
    #   (0~0.5초는 입이 열려 말하는 듯해 뺀다 · 0.6~1.25초는 다문 미소로 할머니 말을 듣는다)
    "C6": (0.60, 2.38),   # 1.35~2.0초 「Okay, Grandma.」(입 맞춤)
    "C6b": (0.05, 2.35),  # 첫 장부터 이어폰을 귀 앞에 든 손(C6 끝 손과 이음) · 0.3~0.6초 끼움 · 2.2~2.4초 손이 내려감
    # 마감 관문 F22: GOYO 2.25초 · synk PULSE 2.08초로 둘 다 2.5초에 못 미쳤다 → C7을 0.25초부터 쓰고 끝에 0.25초를 늘린다
    "C7": (0.25, 6.00),
}
PAD = {"C7": 0.25}   # 끝 화면 뒤(흐린 바탕이 4% 다가가는 동안)에 마지막 장을 늘려 붙이는 초
# 끝 화면 반전(둘째셋째_기획후보 4절 「없는 사람은 끝 화면의 반전으로 · 누가 연기를 이끌었나를 함께」).
#   11-21 낯선이 시험관 둘이 모두 「GOYO와 synk PULSE 중 누구 광고인지 모름」 · 끝 3초 「흐지부지」라 두 줄로 밝힌다.
REVEAL = ("No one at this table exists.", "Neither does GOYO.")
# 마감 관문 F21: 「Directed by an actor.」를 알아듣는 말로 — X 소개 글과 같은 말로 PULSE가 무엇을 하는지 밝힌다
# 11-21 밤 낯선이 시험 다시(GPT · 그록): 둘 다 22.1초 「synk PULSE가 제작사인지 서비스인지 · directed by an actor가 무슨 뜻인지 모름」
#   → 로고 바로 위를 「An AI ad by」로 — 이 광고를 PULSE가 AI로 만들었다는 한 가지만 말한다(「directed by an actor」는 게시 글에서 말한다)
#   셋째 시험(r3 「An AI ad by」)에서도 둘 다 22.1초 「synk PULSE가 어디인지 모름」 → 로고 아래에 하는 일을 한 줄로 말하고 위 줄은 뺀다
MAKER = "We make ads with AI actors."
BRAND_S, END_S = 0.3, 2.9    # C7 첫머리에서 GOYO 이름이 서는 초 · 끝 화면이 덮기 시작하는 초(GOYO 2.6초 · 끝 화면 3.1초)
TAP_IN_C3B = 0.85     # 손끝이 이어폰을 누르는 순간
PULL_IN_C5 = 3.50     # 이어폰이 귀에서 떨어지는 순간
CLICK_IN_C6B = 0.62   # 이어폰이 귀에 들어가는 순간
# 목소리 조각: (판, 판 안 시작, 판 안 끝, 편 시간에 놓을 자리 — None이면 그림과 같은 자리, 크기)
VOICES = [
    ("C1", 0.80, 3.60, None, 1.0),    # 고모 「So… any wedding plans?」(판 소리 그대로 — 상 소리 포함)
    ("C2", 0.60, 2.90, None, 1.0),    # 준호 「You look thin. Eating okay?」 — 입과 맞춘다(0.2초 앞당겨 C1 끝에 살짝 겹침)
    ("C2", 3.40, 4.90, 4.50, 1.0),    # 민재 「I got promoted, you know.」 — 준호 줄 끝에 겹쳐 C3 첫머리로
    ("C3", 3.35, 4.40, None, 1.0),    # 고모 「Seeing anyone yet?」 — 웅성거림 위로
    ("C5", 3.45, 4.20, "pull+0.22", 1.0),  # 할머니 「Eat more.」 — 이어폰을 빼고 방 소리가 돌아온 뒤
    ("C6", 1.25, 2.10, None, 1.0),    # 서진 「Okay, Grandma.」 — 입 맞춤(p 터짐을 콧소리로 메움, 그랜마.py)
    ("C6", 2.75, 3.55, "C6:2.15+0.0", 1.0),  # 고모 「Your boyfriend—」 — 「Okay, Grandma.」 바로 뒤, 「딸깍」에서 끊긴다
]


def sh(*a):
    r = subprocess.run(a, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise SystemExit(f"실패: {' '.join(map(str, a))[:300]}\n{r.stderr[-1500:]}")
    return r.stdout


def cuts():
    seq = json.load(open(os.path.join(EP, "컷표.json"), encoding="utf-8"))
    out, t = [], 0.0
    for d in seq["detail"]:
        a, b = EDL.get(d["cut"], (d["in"], d["out"]))
        n = round((b - a) * FPS)
        p = round(PAD.get(d["cut"], 0) * FPS)
        out.append({"cut": d["cut"], "in": a, "out": a + n / FPS, "t": t, "n": n, "pad": p})
        t += (n + p) / FPS
    return out, t


def at(cs, name, inner):
    """판 안의 초 → 편 시간."""
    c = next(x for x in cs if x["cut"] == name)
    return c["t"] + (inner - c["in"])


def start(cs, name):
    return next(x for x in cs if x["cut"] == name)["t"]


# ---------- 그림 ----------
def picture(cs, tmp):
    parts = []
    for c in cs:
        src = os.path.join(GOT, c["cut"] + ".mp4")
        p = os.path.join(tmp, f"v_{c['cut']}.mp4")
        # 실제 24fps로 다시 짜고(머리의 60은 틀림) 쓰는 구간만, 1080x1920으로
        sh("ffmpeg", "-y", "-loglevel", "error", "-r", "24", "-i", src, "-vf",
           f"trim=start_frame={round(c['in'] * FPS)}:end_frame={round(c['in'] * FPS) + c['n']},setpts=PTS-STARTPTS,"
           + (f"tpad=stop_mode=clone:stop={c['pad']}," if c.get("pad") else "")
           + f"scale={W}:{H}:flags=lanczos,setsar=1,format=yuv420p",
           "-an", "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-r", "24", p)
        parts.append(p)
    lst = os.path.join(tmp, "v.txt")
    open(lst, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in parts))
    base = os.path.join(tmp, "base.mp4")
    sh("ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", base)
    return base


# ---------- 글 ----------
def font(px):
    return ImageFont.truetype(FONT_M, px)


# 11-21 첫 편집본에서 고침: 영상 속 얼굴이 시작 그림보다 낮아(C1 · C3 턱이 화면 67~70%) 아래 끝 1236에 쌓은 자막이 입 · 턱을 덮었다.
#   그래서 아래 끝을 y 1560(릴스 · 쇼츠의 이름 · 설명 글 위)으로 내리고, 방금 들린 줄만 크게(52px) · 앞 줄은 작게(36px) 위로 쌓는다.
#   마감 관문 F30 · F31(11-21): 52 · 36px는 점검표 4(64px 이상 — 유호님 11-18 「자막이 너무 작은것같아」)보다 작다 → 64 · 44px.
#   안전선(1248) 안은 얼굴이 차지해(턱 y 1160~1200) 아래 끝은 1580(쇼츠 · 릴스 설명 글 위, 가장 넓은 줄 x 133~947로 오른쪽 단추 밖).
CAP_PX, OLD_PX, CAP_PAD_X, CAP_PAD_Y, CAP_GAP, CAP_BOTTOM = 64, 44, 28, 15, 8, 1580


def cap_box(text, px):
    f = font(px)
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    w = d.textlength(text, font=f)
    pad = CAP_PAD_Y if px == CAP_PX else 10
    return int(w + (CAP_PAD_X if px == CAP_PX else 20) * 2), px + pad * 2


def draw_caps(im, lines, now):
    """lines: [(글, 나온 초)] — 아래 끝에 붙여 위로 쌓는다(새 줄이 아래). 나오는 0.12초 동안 옅게 · 8px 아래에서."""
    d = ImageDraw.Draw(im)
    y = CAP_BOTTOM
    for k_, (text, t0) in enumerate(reversed(lines)):
        px = CAP_PX if k_ == 0 else OLD_PX
        f = font(px)
        bw, bh = cap_box(text, px)
        k = min(1.0, max(0.0, (now - t0) / 0.12))
        dy = int(8 * (1 - k))
        x0 = (W - bw) // 2
        box = (x0, y - bh + dy, x0 + bw, y + dy)
        a = 1.0 if k_ == 0 else 0.86
        d.rounded_rectangle(box, radius=16 if px == CAP_PX else 12, fill=(16, 16, 18, int(205 * k * a)))
        d.text((W / 2, y - bh / 2 + dy), text, font=f, fill=(250, 248, 243, int(255 * k * a)), anchor="mm")
        y -= bh + CAP_GAP


def draw_note(im):
    """가상 브랜드 · AI 고지 — 시안의 자리(안전 영역 아래 가운데 y 1236)는 그대로, 24px 그림자 글 대신 28px 어두운 작은 판.
    11-21 낯선이 시험관 둘이 「맨 아래 작은 글자는 휴대폰에서 못 읽음」, 카본 맹검이 「밥상 접시 위 얼룩 줄」이라 했다."""
    f = font(34)   # 셋째 시험에서 둘 다 「19.3초 아래 작은 흰 글씨 못 읽음」 → 28 → 34px
    d = ImageDraw.Draw(im)
    w = d.textlength(SA.NOTE, font=f)
    x0, y1 = (W - w) / 2 - 18, 1236 + 10
    d.rounded_rectangle((x0, y1 - 34 - 22, x0 + w + 36, y1), radius=12, fill=(16, 16, 18, 150))
    d.text((W / 2, y1 - 10), SA.NOTE, font=f, fill=(250, 248, 243, 235), anchor="ms")


def overlay_frames(cs, total, tmp, plan):
    """자막 · 브랜드 · 끝 화면 글을 투명 PNG 장으로 — 장마다 다를 때만 새로 그린다."""
    os.makedirs(os.path.join(tmp, "ov"), exist_ok=True)
    pulse = Image.open(SA.PULSE).convert("RGBA")
    # 11-21 GOYO의 두 O를 고리 안 점에서 꽉 찬 원으로(유호님이 싫어하시는 고리 · 구멍 무늬 — 11-20) — 브랜드/로고.py logo_goyo_solid
    logo = Image.open(os.path.join(EP, "브랜드", "로고_A_GOYO_찬원.png")).convert("RGBA")
    url_f, small, tag_f, rev_f, maker_f = font(40), font(30), ImageFont.truetype(SA.FONT_R, 30), font(50), font(46)   # 하는 일 줄은 반전 줄에 가깝게(마감 다시 관문 2108)
    n = round(total * FPS)
    last_key, last_img = None, None
    for i in range(n):
        t = i / FPS
        lines = [(s, t0) for s, t0, t1 in plan["caps"] if t0 <= t < t1]
        anim = any(t - t0 < 0.12 for _, t0 in lines)
        brand = plan["brand"][0] <= t < plan["brand"][1]
        endk = min(1.0, max(0.0, (t - plan["end"]) / 0.5)) if t >= plan["end"] else 0.0
        # 고지는 C7의 GOYO 자리에서만 — 끝 화면은 반전 두 줄이 같은 말을 크게 하고, 줄을 늘리지 않는다(카본 맹검 「발표 슬라이드처럼 넉 줄」)
        note_on = plan["note"] <= t < plan["end"] + 0.05   # 끝 화면 주소 줄과 겹치지 않게(2244 가벼운 흠)
        key = (tuple(lines), brand, round(endk, 2), note_on) if (anim or 0 < endk < 1) else (tuple(s for s, _ in lines), brand, endk, note_on)
        if key != last_key:
            im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            if lines:
                draw_caps(im, lines, t)
            if brand:
                b = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                # 마감 다시 관문 2244 F1: 다시 구운 C7에서 서진 머리가 높아 태그라인 끝이 검은 머리에 묻혔다 → 20% 줄이고 52px 올린다(태그라인 아래 끝 y 375 위)
                bottom = SA.paste_logo(b, logo, 320, 280, shadow=0)
                ink = plan["brand_ink"]
                if ink:
                    tint = Image.new("RGBA", b.size, SA.INK + (0,)); tint.putalpha(b.split()[-1]); b = tint
                col = SA.INK if ink else (246, 243, 236)
                SA.text(ImageDraw.Draw(b), (W / 2, bottom + 22), SA.TAGLINE, tag_f, col + (225,), spacing=1)
                im.alpha_composite(b)
            if endk > 0:
                e = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                bottom = SA.paste_logo(e, pulse, 700, 930, shadow=0)
                d = ImageDraw.Draw(e)
                SA.text(d, (W / 2, bottom + 70), MAKER, maker_f, (246, 243, 236, 235), spacing=0)
                SA.text(d, (W / 2, bottom + 150), "synk.im/en/pulse", url_f, (246, 243, 236, 235), spacing=2)
                SA.text(d, (W / 2, 560), REVEAL[0], rev_f, (250, 248, 243, 250), spacing=0)
                SA.text(d, (W / 2, 560 + 70), REVEAL[1], rev_f, (250, 248, 243, 250), spacing=0)
                if endk < 1:
                    e.putalpha(e.split()[-1].point(lambda v: int(v * endk)))
                im.alpha_composite(e)
            if note_on:
                draw_note(im)
            last_key, last_img = key, im
        last_img.save(os.path.join(tmp, "ov", f"{i:05d}.png"), compress_level=1)
    return os.path.join(tmp, "ov", "%05d.png")


def compose(base, ov, plan, out_v):
    e = plan["end"]
    # 끝 화면: 장면을 흐리고 어둡게(시안 끝 A — GaussianBlur 18 · 밝기 0.38) 0.5초에 걸쳐 덮는다
    # 끝 화면 동안 흐린 장면이 멈춘 그림으로 보이지 않게 4% 천천히 다가간다(최종본검사 「구간굳음」 11-21 · 첫 편 끝 화면과 같은 방법)
    z = f"(1+0.04*max(0\\,t-{e:.3f})/2.6)"
    fc = (f"[0:v]split[a][b];[b]gblur=sigma=18,colorchannelmixer=rr=0.38:gg=0.38:bb=0.38,"
          f"scale=w='{W}*{z}':h='{H}*{z}':eval=frame,crop={W}:{H},format=rgba,"
          f"fade=t=in:st={e:.3f}:d=0.5:alpha=1[bd];[a][bd]overlay=format=auto[s];"
          f"[1:v]format=rgba[o];[s][o]overlay=format=auto,format=yuv420p[v]")
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", base, "-framerate", "24", "-i", ov, "-filter_complex", fc,
       "-map", "[v]", "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-r", "24", "-pix_fmt", "yuv420p", out_v)


# ---------- 소리 ----------
def wav_of(src, tmp, name, a=None, b=None):
    p = os.path.join(tmp, name + ".wav")
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    if a is not None:
        args += ["-ss", f"{a:.4f}", "-t", f"{b - a:.4f}"]
    sh(*args, "-i", src, "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s16le", p)
    r, x = wavfile.read(p)
    return x.astype(np.float32) / 32768.0


def tone(dur, f0, f1, amp):
    t = np.arange(int(dur * SR)) / SR
    f = np.linspace(f0, f1, t.size)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * amp
    env = np.minimum(1, t / 0.006) * np.exp(-t / (dur * 0.35))
    return np.stack([y * env] * 2, 1).astype(np.float32)


def bell(dur=2.4, f=587.33, amp=0.09):
    """부드러운 종소리 한 음 — 배음 셋, 천천히 사라짐."""
    tt = np.arange(int(dur * SR)) / SR
    y = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.35)
         + 0.12 * np.sin(2 * np.pi * 3.01 * f * tt) * np.exp(-tt / 0.2))
    env = np.minimum(1, tt / 0.004) * np.exp(-tt / 0.75)
    y = y * env * amp
    return np.stack([y, y], 1).astype(np.float32)


def tap_sound(tmp):
    """「톡」 = 녹음 모음의 아날로그 단추 첫 딸깍 한 타(높은 쪽만) + 노이즈캔슬링이 켜지는 짧은 두 음(내려감)."""
    x = wav_of(TAP_SRC, tmp, "tap_src")
    mono = np.abs(x).mean(1)
    on = int(np.argmax(mono > mono.max() * 0.3))
    clk = x[max(0, on - int(0.004 * SR)): on + int(0.07 * SR)].copy()
    clk *= np.linspace(1, 0, clk.shape[0])[:, None] ** 2
    clk = clk / (np.abs(clk).max() + 1e-9) * 0.55
    beep = np.concatenate([tone(0.07, 1320, 1320, 0.10), tone(0.10, 880, 880, 0.10)])
    y = np.zeros((int(0.25 * SR), 2), np.float32)
    y[: clk.shape[0]] += clk
    # 귀에 꽂은 이어폰을 손끝으로 치면 귓속에서 낮게 「툭」 울린다 — 서진의 귀로 듣는 톡. 딸깍만으로는 20ms 크기가 웅성거림보다
    #   4dB밖에 안 커서 컷연속성검사 소리 사건이 걸렸다(11-21, 바탕 −17.5 · 봉우리 −13.6 dBFS)
    tt = np.arange(int(0.09 * SR)) / SR
    th = np.sin(2 * np.pi * (150 - 300 * tt) * tt) * np.exp(-tt / 0.028) * np.minimum(1, tt / 0.002) * 0.6
    y[: th.size] += np.stack([th, th], 1).astype(np.float32)
    s = int(0.03 * SR); y[s: s + beep.shape[0]] += beep[: y.shape[0] - s]
    return y


def hum(n):
    """이어폰 속 고요 — 아주 낮은 웅웅거림(분홍 잡음을 낮게 거르고 −48dB 남짓)."""
    rng = np.random.default_rng(7)
    w = rng.standard_normal(n + SR)
    from scipy.signal import butter, lfilter
    b, a = butter(2, 160 / (SR / 2), "low")
    y = lfilter(b, a, w)[SR:]
    y = y / (np.abs(y).max() + 1e-9) * 0.006
    return np.stack([y, y], 1).astype(np.float32)


def place(buf, x, t, gain=1.0):
    i = int(round(t * SR))
    j = min(buf.shape[0], i + x.shape[0])
    if j > i:
        buf[i:j] += x[: j - i] * gain


def fade(x, a=0.01, b=0.01):
    n = x.shape[0]; e = np.ones(n, np.float32)
    na, nb = int(a * SR), int(b * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nb: e[-nb:] = np.minimum(e[-nb:], np.linspace(1, 0, nb))
    return x * e[:, None]


WALLA = os.path.join(SND, "Jake Fielding - British Walla and Crowd", "CRWDWalla_Pub Walla Atmos, Restaurant, Liverpool, Scouse,_Jake Fielding_11.wav")



def walla(tmp, n):
    """밥상 웅성거림 — 녹음 모음의 식당 웅성거림을 낮게 걸러(낱말이 안 들리게) 깐다."""
    from scipy.signal import butter, sosfiltfilt
    x = wav_of(WALLA, tmp, "walla", 5.0, 5.0 + n / SR + 0.5)[:n]
    x = sosfiltfilt(butter(4, [180, 2200], "band", fs=SR, output="sos"), x, axis=0).astype(np.float32)
    return x / (np.sqrt((x ** 2).mean()) + 1e-9) * 0.018


def voice_at(cs, plan, where, cut, a):
    if where is None:
        return at(cs, cut, a)
    if isinstance(where, (int, float)):
        return float(where)
    if where.startswith("pull+"):
        return plan["pull"] + float(where[5:])
    c, rest = where.split(":"); x, d = rest.split("+")
    return at(cs, c, float(x)) + float(d)


def sound(cs, total, plan, tmp):
    import 그랜마
    n = int(total * SR) + SR
    buf = np.zeros((n, 2), np.float32)
    for cut, a, b, where, g in VOICES:
        x = wav_of(os.path.join(GOT, cut + ".mp4"), tmp, f"v_{cut}_{a}", 0.0, 6.5)
        if cut == "C6":
            x = 그랜마.patch(x)
        seg = fade(x[int(a * SR): int(b * SR)], 0.02, 0.03)
        t0 = voice_at(cs, plan, where, cut, a)
        # 「딸깍」 · 「톡」 뒤로 넘는 목소리는 그 자리에서 끊는다(15ms)
        for q in (plan["tap"], plan["click"]):
            if t0 < q < t0 + seg.shape[0] / SR:
                k = int((q - t0) * SR); seg = seg.copy(); r = int(0.015 * SR)
                seg[k - r:k] *= np.linspace(1, 0, r)[:, None]; seg[k:] = 0
        place(buf, seg * g, t0)
    # 웅성거림: 처음 ~ 톡(점점 짙게), 이어폰을 뺀 뒤 ~ 딸깍
    w = walla(tmp, n)
    env = np.zeros(n, np.float32)
    i0, i1 = 0, int(plan["tap"] * SR)
    env[i0:i1] = np.linspace(0.7, 1.25, i1 - i0)
    j0, j1 = int(plan["pull"] * SR), int(plan["click"] * SR)
    env[j0:j1] = 0.85
    env[j0:j0 + int(0.08 * SR)] *= np.linspace(0, 1, int(0.08 * SR))   # 방 소리가 한꺼번에 돌아온다(0.08초)
    buf += w * env[:, None]
    # 고요: 아주 낮은 웅웅거림
    h = hum(n)
    for q0, q1 in ((plan["tap"], plan["pull"]), (plan["click"], total)):
        a_, b_ = int(q0 * SR), int(min(q1, total) * SR)
        buf[a_:b_] += fade(h[a_:b_], 0.02, 0.05)
    tp = tap_sound(tmp)
    place(buf, tp, plan["tap"] - 0.004)
    place(buf, tp, plan["end"] - 0.004, 0.9)
    place(buf, tp[: int(0.08 * SR)] * 0.8, plan["click"] - 0.004)   # 끼우는 「딸깍」은 두 음 없이
    place(buf, tp[: int(0.06 * SR)] * 0.45, plan["pull"] - 0.004)   # 빼는 작은 소리
    place(buf, bell(), plan["end"] + 0.35)   # 끝 화면의 아주 짧은 음 하나(컷표 소리.음악) — 끝 소리 한 방(점검표 2)
    buf = np.clip(buf[: int(total * SR)], -1, 1)
    p = os.path.join(tmp, "mix.wav")
    wavfile.write(p, SR, (buf * 32767).astype(np.int16))
    return p


def loudnorm(src_v, mix, out):
    st =subprocess.run(["ffmpeg", "-hide_banner", "-i", mix, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                         "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    m = json.loads(st[st.rindex("{"): st.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", src_v, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
       "-af", af + ",aresample=48000", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", out)


def strip(out):
    """반 초마다 한 장 띠(눈으로 볼 판)."""
    p = out.replace(".mp4", "_반초.jpg")
    sh("ffmpeg", "-y", "-loglevel", "error", "-i", out, "-vf", "fps=2,scale=216:-1,tile=12x4", "-frames:v", "1", p)
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--밖", default=os.path.join(VEN, "최종"))
    ap.add_argument("--이름", default="명절밥상_이어폰")
    a = ap.parse_args()
    os.makedirs(a.밖, exist_ok=True)
    tmp = os.path.join(a.밖, "_작업")
    os.makedirs(tmp, exist_ok=True)
    cs, total = cuts()
    tap = at(cs, "C3b", TAP_IN_C3B)
    pull = at(cs, "C5", PULL_IN_C5)
    click = at(cs, "C6b", CLICK_IN_C6B)
    c7 = start(cs, "C7")
    plan = {
        "tap": tap, "pull": pull, "click": click,
        # 대사 원고(컷표 소리.원고)의 판 안 초 → 편 시간. 질문 넷은 「톡」까지, 뒤 셋은 다음 줄이 나올 때까지
        "caps": [
            # 마감 다시 관문(11-21 2108): 0.8~1.5초 고모 젓가락이 전을 얹는 손끝이 자막 판에 가려 전이 혼자 움직이는 듯했다
            #   → 전이 접시에 닿은 뒤(편 1.4초, 「any wedding plans?」가 들리는 중)에 띄운다 — 첫 2초 안이다
            ("So… any wedding plans?", at(cs, "C1", 2.20), tap),
            ("You look thin. Eating okay?", at(cs, "C2", 0.70), tap),
            ("I got promoted, you know.", 4.50, tap),
            ("Seeing anyone yet?", at(cs, "C3", 3.40), tap),
            ("Eat more.", pull + 0.22, at(cs, "C6", 1.30)),
            ("Okay, Grandma.", at(cs, "C6", 1.30), at(cs, "C6", 2.15)),
            ("Your boyfriend—", at(cs, "C6", 2.15), click),
        ],
        "brand": (c7 + BRAND_S, c7 + END_S), "end": c7 + END_S, "note": c7, "brand_ink": True,
    }
    json.dump({"컷": cs, "길이": total, "계획": plan}, open(os.path.join(tmp, "계획.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"길이 {total:.2f}초 · 톡 {tap:.2f} · 뺌 {pull:.2f} · 딸깍 {click:.2f} · 끝 화면 {plan['end']:.2f}")
    base = picture(cs, tmp)
    ov = overlay_frames(cs, total, tmp, plan)
    v = os.path.join(tmp, "v.mp4")
    compose(base, ov, plan, v)
    mix = sound(cs, total, plan, tmp)
    out = os.path.join(a.밖, a.이름 + ".mp4")
    loudnorm(v, mix, out)
    print("최종", out, "· 띠", strip(out))


if __name__ == "__main__":
    main()
