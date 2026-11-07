# 5번 새 기획(11-05 밤) 끝 화면 타이포 시안 — 유호님 「이 부분을 제대로 수정해야할것같아. CG로 깔끔하게 타이포그래피로 표현하던지 … 너무 AI 슬롭티나고 정말 초보 디자이너가 디자인한 느낌」.
# 글자는 새기획_워드마크.py가 도형으로 그린 것(글꼴을 넓게 벌려 석 줄로 쌓던 옛 판을 버림). 장면은 끝 판 N11e, 위쪽은 원판 렌즈 흐림 + 어둡게(옛 판의 가우스 흐림은 회색 얼룩처럼 보였다).
#   python -X utf8 새기획_끝타이포.py 그림   → 콘티/p5n/로고시안/<시안>_{hit,mid,end}.jpg (구도 보기)
#   python -X utf8 새기획_끝타이포.py 영상 E   → 콘티/p5n/가편집/p5n_끝타이포_E_글자만.mp4 (15초 소리 마감 그대로, 프레임 386부터 끝 판 + 글자, 뒤꿈치는 N10_본판)
#   python -X utf8 새기획_끝타이포.py 영상6 E  → 같은 판의 6초(앞 72장은 가편집 6초 판, 숨 컷 좌우 뒤집음, 뒤 108장은 15초 판 그대로)
#   python -X utf8 새기획_끝타이포.py 정지    → 정지컷_916/N11_로고.png
# 최종은 E_글자만(맹검 Fable 3차 통과). A · B · C · D는 진 시안으로 남겨 둔다.
# 시안: A 숨구멍(소문자 — 12.865초 박에 구멍이 막힌 글자가 뜨고 숨 들이쉬듯 구멍이 열린다 = 니트의 숨구멍) · B 장면 뒤 큰 글자(세로로 긴 대문자, 밑창이 앞을 가림) · C 역광 CG(같은 대문자를 블렌더로 세워 안개 앞 실루엣 — 새기획_끝타이포_블렌더.py)
import subprocess, sys, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from shapely.ops import unary_union
from shapely import affinity
sys.path.insert(0, str(Path(__file__).resolve().parent))
import 새기획_워드마크 as WM

P = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5n")
OUT = P / "로고시안"; OUT.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1080, 1920, 30
HIT = 12.865
END = "N11en"   # 끝 판 — 11-07 슬롭 점검표 25번으로 바닥 연기를 뺀 판(옛 판 N11e는 연기 · 먼지 구름이 솟음, 05_콘티 11절). 캐시도 판마다 따로
COOL = np.array([236, 241, 248], np.float32)
FONT = Path.home() / "Documents/SYNK-appsscript/docs/브랜드_폰트/InterTight/InterTight-Medium.ttf"


def disc(img, r):
    k = np.zeros((2 * r + 1, 2 * r + 1), np.float32); cv2.circle(k, (r, r), r, 1, -1, cv2.LINE_AA); k /= k.sum()
    lin = (img / 255.0) ** 2.2                       # 빛의 세기로 흐려야 렌즈처럼 빛망울이 선다
    return (np.clip(cv2.filter2D(lin, -1, k), 0, 1) ** (1 / 2.2)) * 255.0


def plate():
    f = OUT / ("_판.npy" if END == "N11e" else f"_판_{END}.npy")
    if f.exists(): return np.load(f)
    a = np.asarray(Image.open(P / f"정지컷_916/{END}.png").convert("RGB")).astype(np.float32)
    yy = np.linspace(0, 1, H)[:, None, None]
    k1 = np.clip((0.58 - yy) / 0.25, 0, 1); k2 = np.clip((0.46 - yy) / 0.20, 0, 1)
    b = a * (1 - k1) + disc(a, 14) * k1
    b = b * (1 - k2) + disc(a, 34) * k2
    b *= 0.20 + 0.80 * np.clip((yy - 0.03) / 0.50, 0, 1) ** 1.25    # 위는 거의 검정 — 글자가 올라설 어두운 하늘
    np.save(f, b.astype(np.float32)); return b.astype(np.float32)


def matte():
    f = OUT / ("_신발가림.png" if END == "N11e" else f"_신발가림_{END}.png")
    if not f.exists():
        from rembg import remove, new_session
        s = new_session("isnet-general-use")
        im = Image.open(P / f"정지컷_916/{END}.png").convert("RGB")
        Image.fromarray(np.asarray(remove(im, session=s, only_mask=True))).save(f)
    m = np.asarray(Image.open(f).convert("L")).astype(np.float32) / 255
    yy = np.linspace(0, 1, H)[:, None]
    soft = cv2.GaussianBlur(m, (0, 0), 16)                         # 위쪽은 초점이 빠져 가장자리도 부드럽게
    k = np.clip((0.46 - yy) / 0.2, 0, 1)
    return m * (1 - k) + soft * k


def warp_scale(mask, s, cx, cy):
    M = np.float32([[s, 0, cx - s * cx], [0, s, cy - s * cy]])
    return cv2.warpAffine(mask, M, (W, H), flags=cv2.INTER_LINEAR)


# ---------- 시안 A: 숨구멍 ----------
def build_a():
    g = WM.lower()
    bodies = unary_union([b for _, b, _ in g]); holes = [h for _, _, hs in g for h in hs]
    x0, y0, x1, y1 = bodies.bounds
    width = 0.80 * W; sx = width / (x1 - x0)
    ox = (W - width) / 2 - x0 * sx; oy = H * 0.175
    return {"body": WM.raster(bodies, W, H, sx, ox, oy), "holes": holes, "sx": sx, "ox": ox, "oy": oy, "left": (W - width) / 2}


def hole_mask(a, breath):
    if breath <= 0.001: return np.zeros((H, W), np.uint8)
    ss = 4; m = np.zeros((H * ss, W * ss), np.uint8)
    for cx, cy, r in a["holes"]:
        cv2.circle(m, (int((a["ox"] + cx * a["sx"]) * ss), int((a["oy"] - cy * a["sx"]) * ss)), int(r * breath * a["sx"] * ss), 255, -1, cv2.LINE_AA)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA)


def tag_layer(text, size, x, y, tracking=0.0, center=False):
    im = Image.new("L", (W, H), 0); d = ImageDraw.Draw(im); f = ImageFont.truetype(str(FONT), size)
    if center: x = (W - d.textlength(text, font=f)) / 2
    if tracking:
        for ch in text:
            d.text((x, y), ch, font=f, fill=255); x += d.textlength(ch, font=f) + tracking
    else:
        d.text((x, y), text, font=f, fill=255)
    return np.asarray(im).astype(np.float32) / 255


def ease_out(x, p=3): return 1 - (1 - np.clip(x, 0, 1)) ** p


def comp_a(base, t, st):
    a = st["a"]; dt = t - HIT
    if dt < 0: return base
    breath = ease_out(dt / 0.55, 4) * (1 + 0.05 * np.sin(np.clip(dt / 0.55, 0, 1) * np.pi))   # 숨 들이쉬듯 열리고 살짝 넘쳤다 앉는다
    m = (a["body"].astype(np.float32) - hole_mask(a, breath).astype(np.float32)).clip(0, 255) / 255
    s = 1.0 + 0.012 * (1 - ease_out(dt / 1.7, 2))
    m = warp_scale(m, s, W / 2, H * 0.16)
    # 태그는 숨이 다 열린 뒤 조용히(0.55초 뒤 0.3초에 걸쳐) — 글자 왼쪽 끝에 맞춘다
    tg = st["tag"] * np.clip((dt - 0.55) / 0.3, 0, 1)
    al = np.clip(m + tg * 0.86, 0, 1)[..., None]
    return base * (1 - al) + COOL * al


# ---------- 시안 B: 장면 뒤 큰 글자 ----------
def build_b():
    g = unary_union(WM.upper(s=19.0, h=165.0))
    x0, y0, x1, y1 = g.bounds
    width = 0.925 * W; sx = width / (x1 - x0)
    top = H * 0.075; ox = (W - width) / 2 - x0 * sx; oy = top + y1 * sx   # 위 7.5%는 앱 화면 글자 자리
    return {"mask": WM.raster(g, W, H, sx, ox, oy).astype(np.float32) / 255, "top": top, "bot": oy, "left": (W - width) / 2}


def comp_b(base, t, st):
    b = st["b"]; dt = t - HIT
    if dt < 0: return base
    s = 1.018 - 0.018 * ease_out(dt / 1.9, 2)
    m = warp_scale(b["mask"], s, W / 2, H * 0.17)
    # 평평한 흰 글자(위에서 아래로 아주 조금만 안개에 잠긴다) — 세게 준 그라데이션은 2000년대 크롬 글자처럼 보였다. 한 방에 환했다가 앉는다
    yy = np.linspace(0, 1, H)[:, None]
    fall = np.clip((b["bot"] / H - yy) / (b["bot"] / H - b["top"] / H), 0, 1)
    flash = 1.0 + 0.10 * np.exp(-dt / 0.25)
    lum = (0.74 + 0.20 * fall ** 0.8) * flash
    al = m[..., None]   # 흐린 신발이 글자를 가리면 어두운 얼룩처럼 보여 가림을 뺐다(또렷한 쪽이 아니라 초점 빠진 쪽이 앞에 오는 자리라)
    col = COOL[None, None, :] * lum[..., None]
    out = base * (1 - al) + np.minimum(col, 255) * al
    tg = st["tag"] * np.clip((dt - 0.5) / 0.3, 0, 1)
    return out * (1 - tg[..., None] * 0.86) + COOL * tg[..., None] * 0.86


# ---------- 시안 C: 역광 CG ----------
def build_c():
    CG = OUT / "cg"
    def rd(n):
        a = np.asarray(Image.open(CG / f"{n}_100.png").convert("RGBA")).astype(np.float32) / 255
        return cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA) if a.shape[1] != W else a
    r, f = rd("테두리"), rd("면")
    # 안개: 큰 결 잡음(여러 겹 흐림) — 고른 그라데이션은 띠가 지고 값싸 보인다
    rng = np.random.default_rng(5); n = np.zeros((H // 4, W // 4), np.float32)
    for sig, amp in ((160, 1.0), (70, 0.55), (30, 0.25)):
        z = cv2.GaussianBlur(rng.standard_normal((H // 4, W // 4)).astype(np.float32), (0, 0), sig / 4); n += amp * z / (z.std() + 1e-6)
    n = cv2.resize(n, (W, H), interpolation=cv2.INTER_CUBIC); n = 1 + 0.16 * n / n.std()
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); yy /= H; xx /= W
    # 빛 기둥 쪽(오른쪽)에서 번지는 안개 빛 — 글자 뒤에만 넓게
    g = np.exp(-(((xx - 0.60) / 0.62) ** 2 + ((yy - 0.17) / 0.105) ** 2)) * n
    return {"rim": r[..., :3], "alpha": r[..., 3], "face": f[..., :3], "glow": np.clip(g, 0, 1.4)}


def comp_c(base, t, st):
    c = st["c"]; dt = t - HIT
    if dt < 0: return base
    s = 1.018 - 0.018 * ease_out(dt / 1.9, 2)
    M = np.float32([[s, 0, W / 2 - s * W / 2], [0, s, H * 0.17 - s * H * 0.17]])
    wp = lambda a: cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_LINEAR)
    un = (1 - st["matte"] * 0.97)
    glow_amt = 0.60 + 0.65 * np.exp(-dt / 0.40)                  # 한 방에 뒤 안개가 환해졌다 가라앉으며 글자가 실루엣으로 선다
    cold = np.array([0.80, 0.87, 1.0], np.float32)
    out = base + (c["glow"] * glow_amt * un)[..., None] * cold * 255
    al = (wp(c["alpha"]) * un)[..., None]
    face_amt = 0.10 + 0.35 * np.exp(-dt / 0.35)                  # 면은 거의 검게 — 면이 보이면 워드 3D 글자처럼 읽혔다
    lit = np.clip(wp(c["rim"]) + wp(c["face"]) * face_amt, 0, 1) * 255
    out = out * (1 - al) + lit * al
    tg = st["tag"] * np.clip((dt - 0.5) / 0.3, 0, 1)
    return out * (1 - tg[..., None] * 0.86) + COOL * tg[..., None] * 0.86


# ---------- 본판 D: 곧은 로고타입 ----------
# 맹검(Fable 1차): 「벤치마크의 웅장함은 작은 마크 둘레의 빈 공간에서 온다」 — 화면 폭 62% · 가운데 · 흰 단색, 효과 없음. 작은 줄은 브랜드의 1/4, 한 박자 뒤.
# 맹검(Fable 2차): 빛줄기 두 줄 와이프는 「After Effects 프리셋 라이트 슬릿」, 14.6초 뒤 검정 0.4초는 「끝 카드가 아니라 번쩍임」, 작은 줄 시스템 글꼴은 따로 논다 → 다 뺐다.
# 등장: 12.865초 한 방에 두 장에 걸쳐 켜지고(1.02 → 1.00배로 앉음), P의 원 구멍이 숨 쉬듯 벌어진다 — 이 글자만의 움직임 하나. 장면은 끝까지 두고 음악만 14.6초에 끊는다.
# 맹검(아르곤 2차 · Fable 2차): 글자만으로는 「기본 글꼴로 친 모형 브랜드」 → 심벌 시험 — 숨구멍인 원을 빛 기둥 한 줄이 가른다(D_본판). Fable 3차: 심벌은 「커피콩 · 절취선 알약」으로 읽혀 기각, 글자만(E)이 「통과, 벤치마크 옆에서 실제 브랜드로 믿겠다」 → 최종은 E.
#   작은 줄을 늦게 띄우면 「제목 뒤 부제」 템플릿이고 말 뒤의 뒷북이라 한 방에 함께 띄운다(아르곤 2차).
DW = 0.56


def build_d():
    g = WM.classic(); sol = unary_union([b for _, b, _ in g]); holes = [c for _, _, hs in g for c in hs]
    x0, y0, x1, y1 = sol.bounds; width = DW * W; sx = width / (x1 - x0)
    base_y = H * 0.232; ox = (W - width) / 2 - x0 * sx
    return {"body": WM.raster(sol, W, H, sx, ox, base_y).astype(np.float32) / 255, "holes": holes, "sx": sx, "ox": ox, "oy": base_y, "cap": 100 * sx, "cx": W / 2,
            "sym_cy": base_y - 100 * sx - 46 - 46, "sym_r": 46.0}


def holes_d(d, k):
    ss = 4; m = np.zeros((H * ss, W * ss), np.uint8)
    for cx, cy, r in d["holes"]:
        cv2.circle(m, (int((d["ox"] + cx * d["sx"]) * ss), int((d["oy"] - cy * d["sx"]) * ss)), int(r * k * d["sx"] * ss), 255, -1, cv2.LINE_AA)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


def symbol_d(d, k):
    """원을 세로 틈이 가른다. k 0~1은 틈이 열린 정도(다 열리면 원 지름의 8%)."""
    ss = 4; m = np.zeros((H * ss, W * ss), np.uint8); cx, cy, r = d["cx"], d["sym_cy"], d["sym_r"]
    cv2.circle(m, (int(cx * ss), int(cy * ss)), int(r * ss), 255, -1, cv2.LINE_AA)
    half = int(r * 0.08 * k * ss)
    if half > 0: m[:, int(cx * ss) - half: int(cx * ss) + half] = 0
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255


def comp_d(base, t, st, with_symbol=True):
    d = st["d"]; dt = t - HIT
    if dt < -0.001: return base
    cap = d["cap"]; top = d["oy"] - cap; bot = d["oy"]
    # 글자 뒤를 조금 가라앉힌다(대비, 보이지 않게)
    yy = np.linspace(0, 1, H)[:, None, None]
    out = base * (1 - 0.15 * np.exp(-((yy * H - (top + bot) / 2) / (cap * 2.2)) ** 2))
    op = ease_out(dt / 0.42, 3)
    m = np.clip(d["body"] - holes_d(d, 0.40 + 0.60 * op), 0, 1)     # 숨구멍이 열린다
    if with_symbol: m = np.maximum(m, symbol_d(d, op))               # 빛의 틈이 열린다
    m = np.maximum(m, st["tag"] * 0.76)                              # 작은 줄도 한 방에 함께
    s = (1.02 - 0.02 * ease_out(dt / 0.35, 4)) * (1 + 0.006 * np.clip(dt / 2.1, 0, 1))
    m = warp_scale(m, s, d["cx"], (top + bot) / 2) * np.clip((dt + 1 / 30) / (2 / 30), 0, 1)
    al = m[..., None]
    return out * (1 - al) + COOL * al


def comp_d2(base, t, st):
    return comp_d(base, t, st, with_symbol=False)


CANDS = {"A_숨구멍": comp_a, "B_뒤에선글자": comp_b, "C_역광CG": comp_c, "D_본판": comp_d, "E_글자만": comp_d2}


def prep():
    st = {"a": build_a(), "b": build_b(), "d": build_d(), "matte": matte()}
    if (OUT / "cg/테두리_100.png").exists(): st["c"] = build_c()
    return st


def tag_right(text, size, right, y):
    d = ImageDraw.Draw(Image.new("L", (8, 8))); f = ImageFont.truetype(str(FONT), size)
    return tag_layer(text, size, right - d.textlength(text, font=f), y)


def tag_for(name, st):
    if name[0] in "DE":      # 같은 기하 대문자로 그린 작은 줄 — 대문자 높이 24px(로고의 약 0.22배, 폰에서 읽히는 바닥), 로고 밑 48px, 가운데
        d = st["d"]; g = WM.text_line("OUT OF BREATH, INTO JOY", v=16.0, track=24.0); x0, y0, x1, y1 = g.bounds; sx = 24.0 / 100
        return WM.raster(g, W, H, sx, (W - (x1 - x0) * sx) / 2 - x0 * sx, d["oy"] + 48 + 100 * sx).astype(np.float32) / 255
    if name.startswith("A"):      # g · p · p의 내림이 왼쪽을 차지하니, 한 줄은 내림 없는 eum 밑에 꼭 맞춘다
        a = st["a"]; return tag_right("Out of breath, into joy", 33, W - a["left"], a["oy"] + 12)
    b = st["b"]                   # 대문자 판은 글자 오른끝에 맞춰 바로 밑에 — 가운데에 띄우지 않는다
    return tag_right("Out of breath, into joy", 35, W - b["left"], b["bot"] + 16)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "그림"
    pl = plate(); st = prep()
    if mode == "정지":
        # 최종(E 글자만)의 끝 모습을 콘티 칸에 넣는다 — 보드 · 가편집이 같은 그림을 쓰게
        st["tag"] = tag_for("E_글자만", st)
        Image.fromarray(np.clip(comp_d2(pl, 14.5, st), 0, 255).astype(np.uint8)).save(P / "정지컷_916/N11_로고.png"); print("N11_로고")
    if mode == "그림":
        for name, fn in CANDS.items():
            if name.startswith("C") and "c" not in st: continue
            st["tag"] = tag_for(name, st)
            for lab, t in (("hit", HIT + 0.02), ("mid", HIT + 0.1), ("end", 14.5), ("black", 14.8)):
                Image.fromarray(np.clip(fn(pl, t, st), 0, 255).astype(np.uint8)).save(OUT / f"{name}_{lab}.jpg", quality=93)
        ims = [Image.open(OUT / f"{n}_{l}.jpg") for n in CANDS if n[0] in "DE" for l in ("hit", "mid", "end") if (OUT / f"{n}_{l}.jpg").exists()]
        bw = sum(i.width // 2 + 12 for i in ims); s = Image.new("RGB", (bw, H // 2), (18, 18, 18)); x = 0
        for i in ims: s.paste(i.resize((W // 2, H // 2)), (x, 0)); x += W // 2 + 12
        s.save(OUT / "시안_모아보기.jpg", quality=90); print("ok")
    if mode == "영상":
        # 11.40~12.865초(프레임 386 앞)는 15초 가편집 그대로, 프레임 386부터 끝 판 + 타이포. 소리는 15초 마감 그대로.
        src = P / "가편집/p5n_콘티가편집_15초.mp4"; aud = P / "가편집/p5n_소리마감_15초_final.mp4"
        cap = cv2.VideoCapture(str(src)); head = []
        for i in range(386):
            ok, f = cap.read(); assert ok; head.append(f)
        cap.release()
        only = sys.argv[2] if len(sys.argv) > 2 else None
        for name, fn in CANDS.items():
            if only and not name.startswith(only): continue
            st["tag"] = tag_for(name, st)
            out = P / f"가편집/p5n_끝타이포_{name}.mp4"
            pr = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(aud),
                                   "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", str(out)], stdin=subprocess.PIPE)
            n10 = P / "정지컷_916/N10_본판.png"
            for k, f in enumerate(head):
                if name[0] in "DE" and n10.exists() and 296 <= k < 342:   # 뒤꿈치 프린트도 끝 로고와 같은 글자로(가편집과 같은 다가감)
                    tt = (k - 296) / 45; z = 1 + 0.03 * tt; ccx = (0.5 + (0.488 - 0.5) * tt) * W; ccy = 0.5 * H
                    src_n10 = st.setdefault("n10", cv2.cvtColor(np.asarray(Image.open(n10).convert("RGB")), cv2.COLOR_RGB2BGR))
                    f = cv2.warpAffine(src_n10, np.float32([[z, 0, W / 2 - ccx * z], [0, z, H / 2 - ccy * z]]), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                pr.stdin.write(f.tobytes())
            rng = np.random.default_rng(1)
            for i in range(386, 450):
                t = i / FPS; z = 1 + 0.02 * (i - 386) / 63
                M = np.float32([[z, 0, W / 2 * (1 - z)], [0, z, H / 2 * (1 - z)]])
                b = cv2.warpAffine(pl, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
                f = fn(b, max(t, HIT + 0.0), st)
                f = np.clip(f + rng.uniform(-0.6, 0.6, f.shape[:2])[..., None], 0, 255).astype(np.uint8)   # 어두운 그라데이션 띠 막기
                pr.stdin.write(f[..., ::-1].tobytes())
            pr.stdin.close(); pr.wait(); print(out.name)
    if mode == "영상6":
        # 앞 72장은 가편집 6초 판(신발 전체 26 + N08s 46), 뒤 108장은 그 시안의 15초 판 프레임 342~449 그대로(그래서 프레임까지 같다)
        name = next(n for n in CANDS if n.startswith(sys.argv[2]))
        v15 = cv2.VideoCapture(str(P / f"가편집/p5n_끝타이포_{name}.mp4")); fr15 = []
        while True:
            ok, f = v15.read()
            if not ok: break
            fr15.append(f)
        v15.release(); assert len(fr15) >= 449, len(fr15); fr15 += [fr15[-1]] * (450 - len(fr15))   # 소리 길이에 맞춰 끝 한 장이 잘릴 때가 있다
        v6 = cv2.VideoCapture(str(P / "가편집/p5n_콘티가편집_6초.mp4")); first = [v6.read()[1] for _ in range(72)]; v6.release()
        out = P / f"가편집/p5n_끝타이포_{name}_6초.mp4"
        pr = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(P / "가편집/p5n_소리마감_6초_final.mp4"),
                               "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", str(out)], stdin=subprocess.PIPE)
        first[26:] = [cv2.flip(f, 1) for f in first[26:]]   # 숨 컷만 좌우를 뒤집어 빛 기둥이 신발 전체 컷 · 밑창 컷과 같은 오른쪽에 온다(글자 없는 컷, 맹검 Fable 3차)
        for f in first + fr15[342:]: pr.stdin.write(f.tobytes())
        pr.stdin.close(); pr.wait(); print(out.name)
