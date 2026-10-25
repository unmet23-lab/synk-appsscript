# 8번 이미지 콘티 보드(2026-10-25, 「매진 임박」 콘티보드_v4.py와 같은 꼴) — 줄마다 원본 첫 프레임 | 우리 그림 | 초 · 원본 화면 · 우리 화면 · 소리 · 글자.
#   python -X utf8 콘티보드.py  → 보드/p8_이미지콘티_1~4.jpg · p8_이미지콘티_한눈.jpg · p8_녹화맞춤.jpg · p8_거꾸로견줌.jpg (원본 프레임이 들어가 git 밖에만 둔다)
import json, glob, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

P8 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8")
FONT = r"C:/Users/q1212/Documents/SYNK-appsscript/docs/브랜드_폰트/SUIT"
OUT = P8 / "보드"
F540 = Path(r"C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/레퍼런스/원본실측/p8_네이버/프레임540")   # 원본 900프레임 960×540(ffmpeg로 뽑음, n번 프레임 = n+1번 파일)
START = [0, 43, 72, 123, 178, 223, 264, 338, 363, 425, 455, 475, 500, 525, 568, 602, 629, 670, 708, 800, 852, 900]   # 원본 컷 첫 프레임(29.97fps)

# 컷: (초, 원본 화면, 우리 화면, 소리 · 말 · 글자) — 02_콘티.md 2절 표를 줄인 것
ROWS = {
    1: ("0.00–1.44 (1.44)", "거꾸리에 거꾸로 매달린 남자, 두 손에 폰 · 무심", "카운터 뒤 의자 등받이 너머로 머리를 젖힌 소연 — 거꾸로 보이는 얼굴, 두 손에 폰 · 심심", "카페 바탕 소리만"),
    2: ("1.44–2.40 (0.97)", "와이드 — 공원 운동기구 사이 가운데 매달린 남자", "와이드 — 빈 테이블들, 카운터 뒤 가운데 작게 젖혀 앉은 소연", "〃"),
    3: ("2.40–4.10 (1.70)", "한 손에 폰 · 검지로 두 번 올려 넘기다 니트 사진에서 멈춤", "같은 손 — 캐스팅북 보드를 두 번 넘겨 하린 · 서진 줄에서 멈춤(녹화 R3)", "끌림 소리 둘"),
    4: ("4.10–5.94 (1.83)", "거꾸로 얼굴 클로즈업, 눈이 멈춤(4% 다가감)", "소연 거꾸로 얼굴 클로즈업, 눈이 멈춤", "4.10 음악 시작"),
    5: ("5.94–7.44 (1.50)", "낮은 앵글 — 니트 옷 개 · 행인 다리, 뒤에 매달린 남자", "보도 바닥 높이 — 행인 다리와 하린 쇼핑백, 창 너머 소연", "발소리 · 종이봉투"),
    6: ("7.44–8.81 (1.37)", "화면 접사 — 니트 글 사진 · 제목, 엄지가 닿음", "화면 접사 — 하린 모델 북 대표 사진의 얼굴, 엄지(녹화 R6)", "음악"),
    7: ("8.81–11.28 (2.47)", "아래에서 올라와 바로 앉음 · 눈썹이 올라감", "젖혔던 몸을 일으켜 바로 앉음(첫 그림 = 아래에 손 · 폰만)", "의자 삐걱"),
    8: ("11.28–12.11 (0.83)", "와이드 — 벤치에서 뜨개하는 두 사람", "길 건너 — 하린 포스터를 건 옆 가게 앞 두 사람(뒷모습)", "길 소리"),
    9: ("12.11–14.18 (2.07)", "클로즈업 — 눈을 내리깔고 집중", "소연 클로즈업 — 집중", "음악"),
    10: ("14.18–15.18 (1.00)", "기운 화면 극접사 — 빠른 넘김", "기운 화면 극접사 — 하린 모델 북 장면 격자를 빠르게 끌어 올림(녹화 R10)", "끌림 소리"),
    11: ("15.18–15.85 (0.67)", "가방의 뜨개 키링 접사", "음료 냉장고 유리문의 하린 스티커 접사", "냉장고 웅"),
    12: ("15.85–16.68 (0.83)", "두 손에 든 폰 — 스크롤", "두 손 — 「딸기 라떼 신메뉴」 보드 → 01 하린(녹화 R12)", "음악"),
    13: ("16.68–17.52 (0.84)", "니트 옷 입은 나무", "가로등 배너 속 하린 · 먼 배너도 하린", "음악"),
    14: ("17.52–18.95 (1.43)", "클로즈업 — 입을 살짝 벌리고 빠져듦", "소연 클로즈업 — 입을 살짝 벌리고 빠져듦", "말 없는 감탄 숨 · 음악"),
    15: ("18.95–20.09 (1.13)", "비스듬히 든 폰 — 피드 → 숏폼 · 왼쪽 글자 한 줄", "비스듬히 든 폰 — 하린 카페 · 딸기 라떼 사진 → 크게 보기(녹화 R15)", "글자 1 「이 얼굴이다 싶으면」"),
    16: ("20.09–20.99 (0.90)", "폰 빛 받은 얼굴 · 글자 두 줄", "소연 클로즈업 · 폰 빛 · 작은 결심", "글자 2 「패키지에 담아 / 우리 가게 광고까지」"),
    17: ("20.99–22.36 (1.37)", "화면 극접사 · 1.4배 다가감 — 단추가 초록으로", "화면 극접사 — 하린 「+ 패키지」 → 베리 「패키지에 담김」(녹화 R17)", "톡 · 글자 2 계속"),
    18: ("22.36–23.62 (1.27)", "따뜻한 공방 — 뜨개하는 손", "따뜻한 빛 — 딸기 라떼에 우유를 붓는 손", "붓는 소리 · 음악 고조"),
    19: ("23.62–26.69 (3.07)", "미디엄 — 남자가 여성 넷과 웃으며 뜨개", "미디엄 — 손님(어깨 너머 실루엣)에게 라떼를 건네며 웃는 소연, 벽에 하린 포스터", "손님 「포스터 보고 왔어요」 · 소연 웃음"),
    20: ("26.69–28.43 (1.74)", "높은 앵글 와이드 + 큰 제목", "높은 앵글 — 손님 둘(뒷모습) · 카운터 뒤 소연 + 제목 「손님을 부르는 모델」", "26.69 제목과 함께 내레이션 「손님을 부르는 모델,」"),
    21: ("28.43–30.03 (1.60)", "흰 바탕 · 앱 아이콘 → 로고", "흰 바탕 · synk PULSE 로고", "「PULSE 캐스팅북에서.」(28.45–29.6) · 30.0 뚝"),
}


def f(w, s):
    return ImageFont.truetype(os.path.join(FONT, f"SUIT-{w}.otf"), s)


def ours(n):
    c = f"C{n:02d}"
    for p in (P8 / "컷" / f"{c}_글자.jpg", P8 / "컷" / f"{c}.jpg", P8 / "정지컷" / f"{c}.png"):
        if p.exists():
            return Image.open(p).convert("RGB"), p.name
    g = sorted(glob.glob(str(P8 / "받음" / f"{c}_*.jpg")), key=os.path.getmtime)
    return (Image.open(g[-1]).convert("RGB"), Path(g[-1]).name) if g else (None, "")


def safe(text):
    """SUIT에 없는 글리프(— –)를 있는 것으로 — 없으면 빈칸이나 엉뚱한 꼴로 찍힌다."""
    return text.replace(" — ", " · ").replace("—", "·").replace("–", "-")


def wrap(d, text, font, width):
    text = safe(text)
    out, cur = [], ""
    for word in text.split(" "):
        t = (cur + " " + word).strip()
        if d.textlength(t, font=font) > width and cur:
            out.append(cur); cur = word
        else:
            cur = t
    return out + ([cur] if cur else [])


def board(nums, name):
    IW, IH, TW, PAD = 720, 405, 820, 18
    rowh = IH + PAD
    W = PAD * 4 + IW * 2 + TW
    Hh = 90 + rowh * len(nums) + PAD
    bd = Image.new("RGB", (W, Hh), (16, 16, 16)); d = ImageDraw.Draw(bd)
    d.text((PAD, 22), "8번 캐스팅북 앱 소개 30초 · 이미지 콘티 — 왼쪽 원본 첫 프레임 | 가운데 우리 판 | 오른쪽 초 · 원본 · 우리 · 소리", font=f("SemiBold", 30), fill=(240, 240, 240))
    y = 90
    for n in nums:
        org = Image.open(P8 / "원본첫프레임" / f"C{n:02d}.png").convert("RGB").resize((IW, IH))
        bd.paste(org, (PAD, y))
        im, src = ours(n)
        if im:
            bd.paste(im.resize((IW, IH)), (PAD * 2 + IW, y))
        else:
            d.rectangle([PAD * 2 + IW, y, PAD * 2 + IW * 2, y + IH], outline=(90, 90, 90)); d.text((PAD * 2 + IW + 20, y + 20), "아직", font=f("Medium", 28), fill=(160, 160, 160))
        tx = PAD * 3 + IW * 2
        t, a, b, s = ROWS[n]
        d.text((tx, y + 2), safe(f"#{n}  {t}"), font=f("ExtraBold", 34), fill=(255, 214, 90))
        yy = y + 54
        for label, text, col in (("원본", a, (170, 170, 170)), ("우리", b, (245, 245, 245)), ("소리 · 글자", s, (200, 225, 255))):
            d.text((tx, yy), label, font=f("SemiBold", 22), fill=(130, 130, 130)); yy += 28
            for line in wrap(d, text, f("Medium", 27), TW - 10):
                d.text((tx, yy), line, font=f("Medium", 27), fill=col); yy += 34
            yy += 10
        d.text((tx, y + IH - 26), src, font=f("Regular", 18), fill=(110, 110, 110))
        y += rowh
    OUT.mkdir(parents=True, exist_ok=True)
    bd.save(OUT / name, quality=88)
    print(name, bd.size)


def overview():
    w, h, cols = 480, 270, 7
    bd = Image.new("RGB", (cols * w, 3 * (h + 34) + 70), (16, 16, 16)); d = ImageDraw.Draw(bd)
    d.text((14, 16), "8번 우리 판 21컷 한눈 — 차가운 회청(1~17) → 따뜻한 카페(18~20) → 끝 화면", font=f("SemiBold", 30), fill=(240, 240, 240))
    for i, n in enumerate(range(1, 22)):
        im, _ = ours(n)
        x, y = (i % cols) * w, 70 + (i // cols) * (h + 34)
        if im:
            bd.paste(im.resize((w - 6, h)), (x + 3, y + 34))
        d.text((x + 8, y + 4), safe(f"#{n} {ROWS[n][0]}"), font=f("SemiBold", 22), fill=(255, 214, 90))
    bd.save(OUT / "p8_이미지콘티_한눈.jpg", quality=88); print("한눈", bd.size)


def rec_sheet():
    """녹화 맞춤: 폰 컷 여섯 — 원본 화면(위) | 우리 녹화(아래)를 같은 시각에."""
    CUTS = [(3, "R3"), (6, "R6"), (10, "R10"), (12, "R12"), (15, "R15"), (17, "R17")]
    TS = 6
    cw, ch, rw = 300, 169, 130
    blocks = []
    for n, rid in CUTS:
        a, b = START[n - 1], START[n]
        dur = (b - a) / 29.97
        st = json.load(open(P8 / "녹화" / rid / "states.json", encoding="utf-8"))
        ts = [dur * k / (TS - 1) for k in range(TS)]
        blk = Image.new("RGB", (TS * (cw + 6) + 120, ch + 300 + 70), (22, 22, 22)); d = ImageDraw.Draw(blk)
        d.text((10, 8), f"#{n} 원본 {ROWS[n][0]} — 위 원본 화면 · 아래 녹화 {rid}", font=f("SemiBold", 24), fill=(255, 214, 90))
        for k, t in enumerate(ts):
            fr = min(b - 1, a + int(round(t * 29.97)))
            o = Image.open(F540 / f"{fr + 1:04d}.jpg").convert("RGB").resize((cw, ch))
            blk.paste(o, (120 + k * (cw + 6), 44))
            i = min(st["n"] - 1, int(round(t * 30)))
            r = Image.open(P8 / "녹화" / rid / "frames" / f"{i:04d}.png").convert("RGB")
            r = r.resize((rw, int(r.height * rw / r.width)))
            r = r.crop((0, 0, rw, min(r.height, 300)))
            blk.paste(r, (120 + k * (cw + 6) + (cw - rw) // 2, 44 + ch + 8))
            s = st["states"][i]
            tag = f"{t:.2f}s" + (" 눌림" if s.get("pressed") else "") + (" 크게" if s.get("opened") else "") + (f" 사진{s['photo']}" if "photo" in s else "")
            d.text((120 + k * (cw + 6) + 4, 44 + ch + 300 - 20), tag, font=f("SemiBold", 20), fill=(220, 220, 220))
        d.text((10, 60), "원본", font=f("SemiBold", 22), fill=(170, 170, 170)); d.text((10, 44 + ch + 20), "녹화", font=f("SemiBold", 22), fill=(170, 170, 170))
        blocks.append(blk)
    Wd = max(x.width for x in blocks)
    sheet = Image.new("RGB", (Wd, sum(x.height for x in blocks) + 60), (16, 16, 16))
    ImageDraw.Draw(sheet).text((12, 14), "폰 화면 녹화 — 원본 손가락 타이밍과 같은 시각에 놓은 녹화 프레임", font=f("SemiBold", 28), fill=(240, 240, 240))
    y = 60
    for x in blocks:
        sheet.paste(x, (0, y)); y += x.height
    sheet.save(OUT / "p8_녹화맞춤.jpg", quality=86); print("녹화맞춤", sheet.size)


def flip_sheet():
    """거꾸로 얼굴 길 견줌 — 줄마다 원본 첫 프레임 | 우리 판들. 1번: 바로 굽기(C01) · 위에서 굽고 돌림(C01r) · 돌린 참조 바로 굽기(C01c) ·
    카메라 거꾸로 굽고 돌림(C01u). 4번: 바로 굽기(C04) · 돌린 참조(C04b) · 위에서 굽고 돌림(C04r). 소연 닮음(SFace, 바로 선 얼굴로 잼)과 함께."""
    sim = json.load(open(P8 / "받음" / "_닮음.json", encoding="utf-8")) if (P8 / "받음" / "_닮음.json").exists() else {}
    w, h = 560, 315
    ROWS2 = [(1, [("C01", "바로 굽기", False), ("C01r", "위에서 굽고 180° 돌림", True), ("C01c", "돌린 참조 + 바로 굽기", False), ("C01u", "카메라 거꾸로 굽고 돌림", True), ("C01d", "C01r를 참조로 뒤만 카페", False), ("C01e", "위에서 굽고 돌림(흐린 회청)", True)]),
             (4, [("C04", "바로 굽기", False), ("C04b", "돌린 참조 + 바로 굽기", False), ("C04r", "위에서 굽고 180° 돌림", True), ("C04s", "같은 길 + 자리 문장(고름)", True)])]
    cols = 1 + max(len(r[1]) for r in ROWS2)
    bd = Image.new("RGB", (cols * (w + 14) + 14, len(ROWS2) * (h + 96) + 20), (16, 16, 16)); d = ImageDraw.Draw(bd)
    for ri, (n, items) in enumerate(ROWS2):
        y = 14 + ri * (h + 96)
        panes = [(f"원본 #{n} 첫 프레임", Image.open(P8 / "원본첫프레임" / f"C{n:02d}.png").convert("RGB"), "")]
        for cid, label, rot in items:
            g = sorted(glob.glob(str(P8 / "받음" / f"{cid}_*.jpg")), key=os.path.getmtime)
            if not g:
                panes.append((f"{cid} {label}", None, "아직")); continue
            im = Image.open(g[-1]).convert("RGB")
            if rot:
                im = im.rotate(180)
            s = sim.get(Path(g[-1]).name, {}).get("닮음")
            panes.append((f"{cid} {label}", im, f"닮음 {s}" if s is not None else ""))
        for k, (label, im, note) in enumerate(panes):
            x = 14 + k * (w + 14)
            d.text((x, y), safe(label), font=f("SemiBold", 22), fill=(255, 214, 90))
            if im is not None:
                bd.paste(im.resize((w, h)), (x, y + 34))
            else:
                d.rectangle([x, y + 34, x + w, y + 34 + h], outline=(90, 90, 90))
            d.text((x, y + 34 + h + 8), safe(note), font=f("Medium", 22), fill=(220, 220, 220))
    bd.save(OUT / "p8_거꾸로견줌.jpg", quality=88); print("거꾸로견줌", bd.size)


if __name__ == "__main__":
    for i, nums in enumerate([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11], [12, 13, 14, 15, 16], [17, 18, 19, 20, 21]], 1):
        board(nums, f"p8_이미지콘티_{i}.jpg")
    overview()
    rec_sheet()
    flip_sheet()
