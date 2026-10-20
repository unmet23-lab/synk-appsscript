# 지유 스킨케어 광고 · 부속물 그림(브리프 6절, 10-19 유호님 「v3c로 하고 나머지 전부 진행하자」)
#   python 부속물_만들기.py [후보]   → Documents/synk-vendor/jiyu-skincare-20261018/부속물/
#   python 부속물_만들기.py --손 [후보]   → 부속물_v5/ (10-20 새 병 · 손에 든 병 마지막 장면 v5, 제품 교체는 최종_세트2_병2의 새 병)
#   python 부속물_만들기.py --세트2 [후보]   → 부속물_세트2/ (10-19 새 욕실 v4. 제품 교체는 블렌더/최종_세트2의 컷2_soom_0001이 있어야 한다:
#     blender -b --python 블렌더/병_장면.py -- --cut alt --quality final --device GPU --set 2 --frames 1 --out <V>/블렌더/최종_세트2)
#   ① 상세페이지 컷 3장(컷 1·4·7): v3c와 같은 그림(색감 필름아침 + 피부손 +0.2스톱)을 인코딩 없이 원본 화질로.
#      컷마다 동작에 맞는 구간(브리프 3절)에서 얼굴이 가장 또렷한 프레임을 고른다(마스크 안 라플라시안 분산).
#      1080×1920 PNG(원본) + 상세페이지 폭 860px JPG.
#   ② 제품 교체 시연: 같은 장면 · 같은 빛의 컷 2를 라벨만 바꿔 다시 렌더한 「숨 SOOM」(블렌더/최종/컷2_soom_0001.png)과
#      지금 라벨 「맑음 MALGEUM」을 색감(제품 접사는 색조만)을 입혀 나란히.
#   ③ AI 표시 자리 견본: 짧은 표시를 9:16 안전 영역 왼쪽 위에 얹은 첫 장면 · 엔드카드(긴 문장은 게시 글 첫 줄).
#   후보: 컷마다 고르는 구간의 프레임을 한 장에 늘어놓아 고른 프레임을 확인한다(_후보.jpg) · AI표시만: ③만 다시
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import 본편_편집 as ed  # noqa: E402  같은 경로 · 함수(fit · numbered · 마스크 · 색감)를 그대로 쓴다

부분보정, 색감 = ed.부분보정, ed.색감
OUT = os.path.join(ed.V, "부속물")
LOOK, LIFT = "필름아침", 0.2
FONT_B = r"C:\Windows\Fonts\malgunbd.ttf"
# 컷마다 고르는 구간(컷 안 프레임 번호) — 브리프 3절의 동작: 컷 1은 시선을 렌즈 옆까지 든 끝, 컷 4는 눈을 내리기 전,
# 컷 7은 반달 눈웃음이 뜬 뒤 엔드카드(14.0초 = 48번) 전
PICK = {"컷1": (32, 47), "컷4": (0, 14), "컷7": (24, 47)}
AI_LINE = "이 광고의 모델과 내레이션은 AI로 만든 가상 인물·음성입니다"
# 정지 그림 손질(10-19 Fable): 컷 1 #45 턱 끝에 매달린 물방울은 정지 그림에서 땀처럼 읽혀 그 하나만 메운다
# (이마 물방울은 「세안 직후」 결이라 둔다). 고른 프레임이 바뀌면 자리가 달라지니 프레임 번호와 함께 적는다
RETOUCH = {("컷1", 45): [(474, 1062, 509, 1085)]}
FILL = {}  # 상자 안을 통째로 메울 곳(턱선 아래 방울 몸통처럼 피부색과 비슷해 RETOUCH 차 기준에 안 걸리는 것)
CUT7_45 = (0, 272, 860, 1347)  # 컷 7 얼굴 중심 4:5(860×1075, 10-19 Fable — 2차에서 헤어밴드 위 여백을 28px 더)
VER = "v3c"  # 엔드카드 · AI 표시 견본에 쓰는 인코딩 전 프레임(색감/<VER>_확인/인코딩전/)


def use_set2():
    """세트 2(10-19 새 욕실 「호텔 욕실」로 전체 다시): 컷 이름 · 고르는 구간 · 엔드카드 · 제품 교체 렌더를 세트 2 것으로.
    결과는 부속물_세트2/ — v3c 부속물은 그대로 둔다."""
    global OUT, PICK, RETOUCH, FILL, CUT7_45, VER
    ed.use_set2()  # ed.BLF → 블렌더/최종_세트2(제품 교체의 컷2_0001 · 컷2_soom_0001도 세트 2 렌더)
    OUT = os.path.join(ed.V, "부속물_세트2")
    PICK = {"컷1_세트2": (32, 47), "컷4_세트2": (0, 20), "컷7_세트2": (24, 47)}
    RETOUCH = {("컷1_세트2", 38): [(548, 978, 598, 1025)]}  # 세트 1과 같이 턱 끝 방울만(정지 그림에서 땀처럼 읽힘)
    FILL = {("컷1_세트2", 38): [(551, 991, 590, 1015)]}  # 위 손질 뒤에도 턱선 아래 남은 방울 몸통(볼록한 자국)
    # 세트 2 컷 7은 사람이 왼쪽에 작게(x 118~614, 머리 위 y≈500, 세면대 끝선 y≈1280) — 사람 중심 4:5(720×900),
    # 머리 위 80px · 아래는 세면대 끝선과 수전 끝까지. 860 JPG는 키워 맞춘다
    CUT7_45 = (20, 420, 740, 1320)
    VER = "v4"


# 제품 교체 시연의 라벨 그림 · 라벨 파일에서 오릴 자리 · 렌더에서 라벨을 크게 볼 자리(병 1 기본값, --손이면 병 2)
LABELS = ("라벨_malgeum.png", "라벨_soom.png")
LABEL_CROP = (1300, 300, 2800, 1700)
LABEL_BOX = (380, 1480, 900, 1920)


def use_hand():
    """--손(10-20 유호님 「병 CG가 촌스럽다」 → 새 병 · 손에 든 병 마지막 장면, v5): 세트 2 위에 컷 7 · 병 컷 · 라벨을 새 판으로.
    결과는 부속물_v5/ — 부속물 · 부속물_세트2는 그대로 둔다."""
    global OUT, PICK, CUT7_45, VER, LABELS, LABEL_CROP, LABEL_BOX
    use_set2()
    ed.use_hand()  # ed.BLF → 블렌더/최종_세트2_병2(컷2_0001 · 컷2_soom_0001이 새 병)
    OUT = os.path.join(ed.V, "부속물_v5")
    PICK = {"컷1_세트2": (32, 47), "컷4_세트2": (0, 20), "컷7손_세트2": (24, 47)}
    # 손에 든 병 장면(1080×1920): 헤어밴드 위 y≈503 · 턱 ≈1113 · 병 y 833~1313 · 손 아래 ≈1473, 손 x≈170 ~ 머리카락 ≈900
    # → 얼굴 · 병 · 손이 다 드는 4:5(860×1075), 헤어밴드 위 70px
    CUT7_45 = (90, 430, 950, 1505)
    VER = "v5"
    LABELS = ("라벨_malgeum_v2.png", "라벨_soom_v2.png")
    # 두 자리 모두 시연판 칸(라벨 파일 220×205 · 렌더 확대 246×208)과 가로세로 비가 같아야 글자가 눌리지 않는다
    LABEL_CROP = (1640, 160, 2456, 920)    # 병 2 인쇄 그림(30px/mm)의 「맑음 / malgeum」 덩어리(x 1787~2307 · y 270~803)
    LABEL_BOX = (404, 1060, 877, 1460)     # 병 2 컷 2(1080×1920)에서 「맑음 / malgeum」이 보이는 자리


def fill(im, boxes):
    """상자 안을 통째로 둘레에서 메운다(cv2 inpaint, 텔레아) — 방울 몸통이 피부와 비슷해 retouch의 차 기준에 안 걸릴 때.
    턱선 같은 경계가 상자를 지나지 않게 작게(경계 아래만) 잡는다."""
    import cv2
    a = np.asarray(im, np.uint8).copy()
    mask = np.zeros(a.shape[:2], np.uint8)
    for x0, y0, x1, y1 in boxes:
        mask[y0:y1, x0:x1] = 255
    return Image.fromarray(cv2.inpaint(a, mask, 6, cv2.INPAINT_TELEA)), int((mask > 0).sum())


def retouch(im, boxes):
    """상자 안에서 둘레와 다른 밝은 반사 · 어두운 테두리(물방울)만 골라 둘레 피부로 메운다(cv2 inpaint, 텔레아)."""
    import cv2
    a = np.asarray(im, np.uint8).copy()
    y = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32)
    smooth = cv2.medianBlur(a, 21)
    ys = cv2.cvtColor(smooth, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mask = np.zeros(y.shape, np.uint8)
    for x0, y0, x1, y1 in boxes:
        sub = np.abs(y[y0:y1, x0:x1] - ys[y0:y1, x0:x1]) > 14
        mask[y0:y1, x0:x1] = sub.astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    out = cv2.inpaint(a, mask, 5, cv2.INPAINT_TELEA)
    return Image.fromarray(out), int((mask > 0).sum())


def graded(cut, i):
    """v3c와 같은 그림 한 장: 업스케일 프레임 → 색감 → 피부손 마스크 안만 +0.2스톱."""
    up = ed.numbered(os.path.join(ed.H3, "업", cut, cut), f"{cut}_")
    im = ed.fit(Image.open(up[i]).convert("RGB"))
    g = 색감.grade(im, LOOK)
    m = 부분보정.마스크(os.path.join(ed.MASKS, f"{cut}_피부손", "마스크"), i)
    return 부분보정.밝히기(g, m, LIFT), m


def sharpness(im, m):
    """얼굴(마스크 안) 라플라시안 분산 — 클수록 또렷하다."""
    y = np.asarray(im.convert("L"), np.float32)
    lap = -4 * y[1:-1, 1:-1] + y[:-2, 1:-1] + y[2:, 1:-1] + y[1:-1, :-2] + y[1:-1, 2:]
    core = m[1:-1, 1:-1] > 0.9
    return float(lap[core].var())


def detail_cuts(show=False):
    os.makedirs(OUT, exist_ok=True)
    font = ImageFont.truetype(FONT_B, 26)
    rows, chosen = [], {}
    for cut, (a, b) in PICK.items():
        scores = []
        for i in range(a, b + 1):
            im, m = graded(cut, i)
            scores.append((sharpness(im, m), i, im))
        best = max(scores, key=lambda s: s[0])
        chosen[cut] = best[1]
        im = best[2]
        if (cut, best[1]) in RETOUCH:  # 손질 전 그림도 남긴다
            im.save(os.path.join(OUT, f"상세페이지_{cut}_물방울그대로.png"))
            im, n = retouch(im, RETOUCH[(cut, best[1])])
            print(f"  {cut} 손질: {n}화소", flush=True)
        if (cut, best[1]) in FILL:
            im, n = fill(im, FILL[(cut, best[1])])
            print(f"  {cut} 메움: {n}화소", flush=True)
        im.save(os.path.join(OUT, f"상세페이지_{cut}.png"))
        im.resize((860, round(1920 * 860 / 1080)), Image.LANCZOS).save(os.path.join(OUT, f"상세페이지_{cut}_860.jpg"), quality=92)
        if cut.startswith("컷7"):  # 얼굴이 화면의 1/4이라 얼굴 중심 4:5 판과, 병 · 글자가 든 엔드카드 판을 더한다
            c = im.crop(CUT7_45)
            c.save(os.path.join(OUT, "상세페이지_컷7_4x5.png"))
            c860 = c if c.width == 860 else c.resize((860, round(c.height * 860 / c.width)), Image.LANCZOS)
            c860.save(os.path.join(OUT, "상세페이지_컷7_4x5_860.jpg"), quality=92)
            end = Image.open(os.path.join(ed.V, "색감", f"{VER}_확인", "인코딩전", f"본편_9x16_{VER}_필름아침_f350.png")).convert("RGB")
            end.save(os.path.join(OUT, "상세페이지_컷7_엔드카드.png"))
            end.resize((860, round(1920 * 860 / 1080)), Image.LANCZOS).save(os.path.join(OUT, "상세페이지_컷7_엔드카드_860.jpg"), quality=92)
        print(f"{cut}: 프레임 {best[1]} (또렷함 {best[0]:.1f}, 구간 {a}~{b} 중 최저 {min(s[0] for s in scores):.1f})", flush=True)
        if show:  # 구간의 프레임을 넷씩 건너 늘어놓고 고른 것에 노란 테두리
            tiles = []
            for s, i, t in scores[::4] + ([best] if best not in scores[::4] else []):
                t = t.resize((216, 384))
                d = ImageDraw.Draw(t)
                d.text((6, 6), f"{cut} #{i}", font=font, fill=(255, 255, 0), stroke_width=2, stroke_fill=(0, 0, 0))
                if i == best[1]:
                    d.rectangle((0, 0, 215, 383), outline=(255, 220, 0), width=6)
                tiles.append(t)
            row = Image.new("RGB", (216 * len(tiles), 384))
            for k, t in enumerate(tiles):
                row.paste(t, (216 * k, 0))
            rows.append(row)
    if show:
        S = Image.new("RGB", (max(r.width for r in rows), 384 * len(rows)))
        for k, r in enumerate(rows):
            S.paste(r, (0, 384 * k))
        S.save(os.path.join(OUT, "_상세페이지_후보.jpg"), quality=88)
    return chosen


def product_swap():
    """같은 장면 · 같은 빛, 라벨만 바꾼 렌더. 제품 접사는 색조만(라벨이 지워지지 않게)."""
    font, small = ImageFont.truetype(FONT_B, 34), ImageFont.truetype(FONT_B, 24)
    ims = []
    for tag, f in (("맑음", "컷2_0001.png"), ("숨", "컷2_soom_0001.png")):
        im = 색감.grade(ed.fit(Image.open(os.path.join(ed.BLF, f)).convert("RGB")), LOOK, product=True)
        im.save(os.path.join(OUT, f"제품교체_{tag}.png"))
        ims.append((tag, im))
    W, H, STRIP = 540, 960, 336
    S = Image.new("RGB", (W * 2 + 12, H + 120 + STRIP), (246, 245, 242))
    d = ImageDraw.Draw(S)
    d.text((24, 22), "같은 장면 · 같은 빛, 라벨 파일만 바꿔 다시 렌더", font=font, fill=(52, 52, 50))
    label_box = LABEL_BOX  # 9:16 렌더에서 라벨 글자 자리
    for k, (tag, im) in enumerate(ims):
        x = k * (W + 12)
        S.paste(im.resize((W, H), Image.LANCZOS), (x, 120))
        name = "지금 라벨 · 맑음 MALGEUM" if k == 0 else "바꾼 라벨 · 숨 SOOM"
        w = d.textlength(name, font=small)
        d.rounded_rectangle((x + 14, 134, x + 14 + w + 24, 176), 10, fill=(52, 52, 50))
        d.text((x + 26, 155), name, font=small, fill=(255, 255, 255), anchor="lm")
        # 아래 띠: 라벨 파일(흰 잉크라 짙은 바탕 위) → 렌더된 라벨 확대
        y = 120 + H + 16
        lab = Image.open(os.path.join(ed.V, "블렌더", LABELS[k])).convert("RGBA")
        lab = lab.crop(LABEL_CROP)  # 글자 둘레만
        bg = Image.new("RGBA", lab.size, (88, 88, 86, 255))
        bg.alpha_composite(lab)
        thumb = bg.convert("RGB").resize((220, 205), Image.LANCZOS)
        S.paste(thumb, (x + 14, y + 34))
        d.text((x + 14, y + 4), "라벨 파일", font=small, fill=(52, 52, 50))
        d.text((x + 246, y + 120), "→", font=font, fill=(52, 52, 50))
        crop = im.crop(label_box).resize((246, 208), Image.LANCZOS)
        S.paste(crop, (x + 288, y + 34))
        d.text((x + 288, y + 4), "렌더 확대", font=small, fill=(52, 52, 50))
    d.text((24, H + 120 + STRIP - 34), "병 모양 · 색도 고객 도면대로 바꿀 수 있습니다.", font=small, fill=(52, 52, 50))
    tiny = ImageFont.truetype(FONT_B, 18)
    for k in range(2):  # 라벨 파일 칸이 짙어 라벨이 어두운 줄 알 수 있다(10-19 Fable 2차) — 흰 잉크임을 칸 바로 아래에 밝힌다
        d.text((k * (W + 12) + 14, 120 + H + 16 + 34 + 205 + 6), "흰 잉크 라벨 · 바탕은 보기용", font=tiny, fill=(110, 110, 106))
    S.save(os.path.join(OUT, "제품교체_시연.jpg"), quality=92)


AI_SHORT = "AI로 만든 가상 모델·음성"
SAFE = (65, 269, 920, 1248)  # 9:16 글자 자리(후반 가이드 · SNS 키트 cover916): 아래 672px · 오른쪽 160px는 플랫폼 글자 · 단추가 덮는다


def ai_label_sample():
    """AI 표시 자리 견본: 영상 안에는 짧은 표시를 안전 영역 왼쪽 위(65, 281)에 흰 알약 위 짙은 글자(SUIT Medium 28px)로,
    긴 문장(AI_LINE)은 게시 글 첫 줄에 둔다. 아래쪽에 두면 플랫폼 글자 · 단추가 덮어 가려진다(첫 견본에서 확인).
    첫 프레임(컷 1)과 엔드카드(14.6초) 두 순간 + 안전 영역 선을 그린 확인판."""
    font = ImageFont.truetype(ed.SUIT_M, 34)  # 28 → 34(10-19 Fable P3: 폰에서 읽히게)
    small = ImageFont.truetype(FONT_B, 24)
    clean, check = [], []
    for f, name in (("f024", "첫 장면(1.0초)"), ("f350", "엔드카드(14.6초)")):
        im = Image.open(os.path.join(ed.V, "색감", f"{VER}_확인", "인코딩전", f"본편_9x16_{VER}_필름아침_{f}.png")).convert("RGBA")
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        w = d.textlength(AI_SHORT, font=font)
        x0, y0 = SAFE[0], SAFE[1] + 12
        d.rounded_rectangle((x0, y0, x0 + w + 40, y0 + 60), 30, fill=(255, 255, 255, 215))
        d.text((x0 + 20, y0 + 30), AI_SHORT, font=font, fill=ed.INK + (255,), anchor="lm")
        im.alpha_composite(layer)
        rgb = im.convert("RGB")
        rgb.save(os.path.join(OUT, f"AI표시_자리견본_{f}.png"))
        c = rgb.copy()
        dc = ImageDraw.Draw(c)
        dc.rectangle(SAFE, outline=(255, 60, 60), width=4)
        dc.rectangle((0, 1248, 1080, 1920), outline=(255, 60, 60), width=2)
        dc.text((SAFE[0] + 8, 1260), "아래 672px: 플랫폼 글자·단추 자리", font=small, fill=(255, 60, 60))
        clean.append((name, rgb.resize((540, 960), Image.LANCZOS)))
        check.append((name, c.resize((540, 960), Image.LANCZOS)))
    for tag, tiles in (("", clean), ("_안전영역", check)):
        S = Image.new("RGB", (540 * 2 + 12, 960 + 60), (246, 245, 242))
        d = ImageDraw.Draw(S)
        for k, (name, t) in enumerate(tiles):
            S.paste(t, (k * 552, 60))
            d.text((k * 552 + 8, 30), name, font=small, fill=(52, 52, 50), anchor="lm")
        S.save(os.path.join(OUT, f"AI표시_자리견본{tag}.jpg"), quality=92)
    # 4:5 · 1:1(피드): 플랫폼 글자가 그림을 덮지 않으니 왼쪽 위 여백(40, 40)에 같은 크기
    tiles = []
    for r, name in (("4x5", "4:5"), ("1x1", "1:1")):
        im = Image.open(os.path.join(ed.V, "색감", f"{VER}_확인", "인코딩전", f"본편_{r}_{VER}_필름아침_f024.png")).convert("RGBA")
        layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        w = d.textlength(AI_SHORT, font=font)
        d.rounded_rectangle((40, 40, 40 + w + 40, 100), 30, fill=(255, 255, 255, 215))
        d.text((60, 70), AI_SHORT, font=font, fill=ed.INK + (255,), anchor="lm")
        im.alpha_composite(layer)
        rgb = im.convert("RGB")
        rgb.save(os.path.join(OUT, f"AI표시_자리견본_{r}.png"))
        tiles.append((name, rgb.resize((540, round(540 * rgb.height / rgb.width)), Image.LANCZOS)))
    S = Image.new("RGB", (540 * 2 + 12, max(t.height for _, t in tiles) + 60), (246, 245, 242))
    d = ImageDraw.Draw(S)
    for k, (name, t) in enumerate(tiles):
        S.paste(t, (k * 552, 60))
        d.text((k * 552 + 8, 30), name, font=small, fill=(52, 52, 50), anchor="lm")
    S.save(os.path.join(OUT, "AI표시_자리견본_비율.jpg"), quality=92)


DOCS = os.path.join(HERE, "부속물")
SUIT_WOFF = os.path.join(ed.ROOT, "docs", "브랜드_폰트", "SUIT", "SUIT-Variable.woff2")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
CSS = """
@font-face { font-family: SUIT; src: url('%s') format('woff2'); font-weight: 100 900; }
@page { size: A4; margin: 18mm 16mm 16mm; }
body { font-family: SUIT, sans-serif; color: #343432; font-size: 10.5pt; line-height: 1.6; font-weight: 450; }
h1 { font-size: 21pt; font-weight: 680; margin: 0 0 2pt; letter-spacing: -0.2pt; }
.sub { color: #6b6a66; font-size: 10pt; margin: 0 0 12pt; }
h2 { font-size: 12.5pt; font-weight: 650; margin: 16pt 0 6pt; padding-top: 8pt; border-top: 1px solid #e5e3de; }
blockquote { margin: 0 0 10pt; padding: 7pt 10pt; background: #f6f5f2; border-left: 3px solid #c9c6bf; color: #4a4946; }
table { width: 100%%; border-collapse: collapse; margin: 4pt 0 6pt; font-size: 9.8pt; page-break-inside: avoid; }
th, td { border: 1px solid #e5e3de; padding: 5pt 7pt; text-align: left; vertical-align: top; }
th { background: #f4f3f0; font-weight: 600; }
td:first-child { width: 22%%; font-weight: 550; }
ul { margin: 2pt 0 6pt 14pt; padding: 0; page-break-inside: avoid; } li { margin: 2pt 0; }
h2 { page-break-after: avoid; }
h2:last-of-type + table td { height: 34pt; }
strong { font-weight: 650; }
"""


def md_to_html(text):
    """이 두 견본에 쓰는 마크다운만(#, ##, >, -, 표, **굵게**). 「<!-- 여기부터 내부 -->」 뒤는 넣지 않는다."""
    import html
    import re
    text = text.split("<!-- 여기부터 내부 -->")[0]
    inline = lambda s: re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html.escape(s.strip()))  # noqa: E731
    out, lines, i, first_p = [], text.splitlines(), 0, True
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("# "):
            out.append(f"<h1>{inline(ln[2:])}</h1>")
        elif ln.startswith("## "):
            out.append(f"<h2>{inline(ln[3:])}</h2>")
        elif ln.startswith("> "):
            out.append(f"<blockquote>{inline(ln[2:])}</blockquote>")
        elif ln.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{inline(lines[i][2:])}</li>")
                i += 1
            out.append("<ul>" + "".join(items) + "</ul>")
            continue
        elif ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c for c in lines[i].strip().strip("|").split("|")])
                i += 1
            head, body = rows[0], [r for r in rows[2:]]
            t = "<table><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr>"
            t += "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</table>"
            out.append(t)
            continue
        elif ln.strip():
            out.append(f"<p class='sub'>{inline(ln)}</p>" if first_p else f"<p>{inline(ln)}</p>")
            first_p = False
        i += 1
    return "\n".join(out)


def docs_pdf():
    """저장소 견본 문서(부속물/*.md) → A4 PDF(Edge 머리 없는 인쇄). 글꼴은 저장소 SUIT Variable."""
    import pathlib
    import subprocess
    import tempfile
    font_url = pathlib.Path(SUIT_WOFF).as_uri()
    for name in ("AI_표시_문구_견본", "사용권_확인서_견본"):
        body = md_to_html(open(os.path.join(DOCS, f"{name}.md"), encoding="utf-8").read())
        page = f"<!doctype html><html lang='ko'><head><meta charset='utf-8'><style>{CSS % font_url}</style></head><body>{body}</body></html>"
        with tempfile.TemporaryDirectory() as td:
            src = os.path.join(td, f"{name}.html")
            open(src, "w", encoding="utf-8").write(page)
            out = os.path.join(OUT, f"{name}.pdf")
            subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--print-to-pdf-no-header",
                            f"--print-to-pdf={out}", pathlib.Path(src).as_uri()], check=True, capture_output=True, timeout=120)
            print(out, os.path.getsize(out))


if __name__ == "__main__":
    if "--손" in sys.argv:
        use_hand()
    elif "--세트2" in sys.argv:
        use_set2()
    if "AI표시만" in sys.argv:
        ai_label_sample()
    elif "문서" in sys.argv:
        docs_pdf()
    else:
        print(detail_cuts(show="후보" in sys.argv))
        product_swap()
        ai_label_sample()
    print(OUT)
