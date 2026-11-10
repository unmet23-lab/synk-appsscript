# 블프 두 편 로고타입 다시(2026-11-10, Claude) — 슬롭 점검표 55번 훑기 · 폰트 정본 §10-2 「브랜드 이름 · 끝 로고: 그린다 · 묶는다」.
# 11-07 판(../블프_워드마크.py)은 도형으로 그렸지만 둥근 고른 획(느지막) · 굵은 기운 사각 획(힘껏)이 기성 글꼴처럼 읽혔고, 끝에서 빛 번짐까지 얹어
# 11-10 훑기에서 「SUIT로 친 글자 + 주황 네모」 · 「SUIT Heavy + 빛」으로 걸렸다. 이번 판은 브랜드 뜻에서 꼴을 끌어낸다.
#   느지막(가전 · 생활 온라인몰, 「서두르지 않는」): 가는 단선 · 둥근 끝 · ㅡ와 받침 ㄱ의 가로획이 해먹처럼 축 늘어진 글자 + 감은 눈 심벌
#     (그 편 끝이 「주무세요」라 브랜드 표지가 잠). 끝 작은 줄(「블프, 자고 일어나서」)은 같은 결의 가는 고딕을 끝만 둥글린 것.
#   힘껏(운동복, 스핀 스튜디오): 무거운 글자를 출발점으로 ㅎ의 ㅇ을 스핀 자전거 플라이휠 원판(가운데 축 구멍)으로 바꾸고 10° 앞으로 기울임.
#     「70%」도 같은 결 — %의 두 동그라미가 같은 원판(그린숫자 시안).
# 좌표는 글자 높이 100(y 위가 +). 돌리면 Remotion이 읽는 경로 JSON(src/bf/로고2.json)과 git 밖 미리 보기를 낸다.
#   python -X utf8 로고.py
import json
import math
import os
import sys

from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Point, Polygon
from shapely.ops import unary_union

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from 글자윤곽 import SANS, SERIF, 경로, 마스크, 맞춤, 조판, 글자도형  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUTJ = os.path.join(HERE, "..", "자막시안_20261103", "remotion", "src", "bf", "로고2.json")
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/글자다시_1110"


def ell(cx, cy, rx, ry, n=96):
    return affinity.scale(Point(cx, cy).buffer(1, quad_segs=n), rx, ry)


def 획(pts, w):
    return LineString(pts).buffer(w / 2, cap_style="round", join_style="round", quad_segs=24)


def 늘어짐(x0, x1, y, depth, n=48):
    """양 끝을 잡고 가운데가 depth만큼 내려앉은 가로획(해먹)."""
    return [(x0 + (x1 - x0) * i / n, y - depth * math.sin(math.pi * i / n)) for i in range(n + 1)]


# ── 느지막 ───────────────────────────────────────────────────────────────
def 감은눈(w=100.0, arc_deg=150, s=10.0, lash=0.19, ls=9.0):
    """감은 눈 — 아래로 둥근 눈꺼풀 호 하나 + 바깥으로 퍼지는 짧은 속눈썹 셋."""
    r = w / 2
    a0, a1 = math.radians(270 - arc_deg / 2), math.radians(270 + arc_deg / 2)
    pts = [(r * math.cos(a0 + (a1 - a0) * k / 96), r * math.sin(a0 + (a1 - a0) * k / 96)) for k in range(97)]
    parts = [LineString(pts).buffer(s / 2, cap_style="round", join_style="round", quad_segs=24)]
    for d in (-38, 0, 38):
        t = math.radians(270 + d)
        x0, y0 = r * math.cos(t), r * math.sin(t)
        parts.append(LineString([(x0, y0), (x0 + math.cos(t) * w * lash, y0 + math.sin(t) * w * lash)]).buffer(ls / 2, cap_style="round", quad_segs=16))
    return unary_union(parts)


def 느지막(S=8.0, D=5.0):
    P = []
    # 느 — ㄴ(위) + ㅡ(아래, 늘어진 획)
    P.append(획([(12, 94), (12, 60), (72, 60)], S))
    P.append(획(늘어짐(2, 96, 24, D), S))
    # 지 — ㅈ + ㅣ
    x = 112
    P.append(획([(x + 2, 90), (x + 50, 90)], S))
    P.append(획([(x + 27, 90), (x + 24, 70), (x + 14, 44), (x + 0, 22)], S))
    P.append(획([(x + 30, 66), (x + 40, 44), (x + 56, 24)], S))
    P.append(획([(x + 78, 100), (x + 78, 2)], S))
    # 막 — ㅁ + ㅏ + 받침 ㄱ(늘어진 가로)
    x = 210
    P.append(획([(x + 4, 94), (x + 50, 94), (x + 50, 56), (x + 4, 56), (x + 4, 94)], S))
    P.append(획([(x + 72, 100), (x + 72, 44)], S))
    P.append(획([(x + 72, 72), (x + 90, 72)], S))
    P.append(획(늘어짐(x + 2, x + 88, 26, D * 0.8) + [(x + 88, 0)], S))
    return 맞춤(unary_union(P))


def 늘어뜨림(x0, x1, y, d, n=48):
    """x0 쪽만 붙은 가로획 — 풀린 끝(x1)이 d만큼 처진다(나뭇가지처럼)."""
    return [(x0 + (x1 - x0) * i / n, y - d * (i / n) ** 2) for i in range(n + 1)]


def 느지막3(S=11.0, k=0.085, lash=True, eye_k=0.16, only_neu=False, lash_w=0.55, lash_fan=40, lash_len=15):
    """11-10 밤 판 — 맹검(스나A3) 「'지·막'은 기성 고딕, '느'의 아랫줄만 휜 급조 로고 · 위에 띄운 눈은 클립아트」를 받아
    한 규칙을 모든 가로획에 건다: 힘을 빼 처진다(양 끝이 붙은 획은 가운데가, 한 끝만 붙은 획은 풀린 끝이 — 길이에 비례).
    따로 띄운 눈 아이콘은 없애고 느의 ㅡ를 감은 눈(더 깊은 호 + 아래로 난 속눈썹 셋)으로 — 이름 첫 글자가 곧 잠든 눈."""
    P = []
    # 느 — ㄴ(세로 + 풀린 끝이 처지는 가로) · ㅡ = 감은 눈
    P.append(획([(12, 94)] + 늘어뜨림(12, 72, 62, 60 * k)[0:], S))
    ex0, ex1, ey, ed = 4, 94, 28, 90 * eye_k
    P.append(획(늘어짐(ex0, ex1, ey, ed), S))
    if lash:
        # 속눈썹 — 글자 획과 같은 굵기로 곧게 내리면 ㅡ 아래 다리(ㅜ · ㅠ)로 읽혀 「뉴지막」이 된다(11-10 밤 실측).
        # 가늘게(획의 lash_w배) · 부채꼴로 바깥으로 벌려(가운데는 짧게) 글자 획과 다른 결로 둔다.
        for tp, ang, ln in ((0.2, -lash_fan, 1.0), (0.5, 0.0, 0.78), (0.8, lash_fan, 1.0)):
            x = ex0 + (ex1 - ex0) * tp
            y = ey - ed * math.sin(math.pi * tp)
            a = math.radians(ang)
            L = lash_len * ln
            P.append(획([(x, y - S * 0.2), (x + math.sin(a) * L, y - S * 0.2 - math.cos(a) * L)], S * lash_w))
    if only_neu:   # 앱 아이콘 · 알림용 한 글자(느 = 감은 눈)
        return 맞춤(unary_union(P))
    # 지 — ㅈ(처진 윗가로 + 두 삐침) + ㅣ
    x = 112
    P.append(획(늘어짐(x + 2, x + 50, 90, 48 * k), S))
    P.append(획([(x + 26, 90 - 48 * k), (x + 23, 70), (x + 13, 44), (x + 0, 22)], S))
    P.append(획([(x + 29, 64), (x + 39, 43), (x + 55, 24)], S))
    P.append(획([(x + 78, 100), (x + 78, 2)], S))
    # 막 — ㅁ(위 · 아래 가로가 처진 상자) + ㅏ(풀린 끝이 처지는 곁가지) + 받침 ㄱ(왼쪽 풀린 끝이 처짐)
    x = 210
    top = 늘어짐(x + 4, x + 50, 94, 46 * k)
    bot = 늘어짐(x + 50, x + 4, 56, 46 * k)
    P.append(획(top + [(x + 50, 56)] + bot + [(x + 4, 94)], S))
    P.append(획([(x + 72, 100), (x + 72, 44)], S))
    P.append(획(늘어뜨림(x + 72, x + 91, 73, 19 * k * 1.6), S))
    P.append(획(list(reversed(늘어뜨림(x + 88, x + 2, 27, 86 * k))) + [(x + 88, 0)], S))
    return 맞춤(unary_union(P))


def 느지막명조(word_w=700, track=80, sub="가전 · 생활 온라인몰", sub_w=500, sub_track=260, gap=0.34, sub_h=0.2, only=None):
    """11-11 새벽 판 — 맹검 4차(스나A4)가 「느」 밑 속눈썹을 「누」로 읽고(「누지막」) 처진 획을 「어설픈 손글씨풍」으로 봤다.
    3 · 4차 모두 장치(늘어진 획 · 감은 눈)를 「초보 로고」로 읽어 장치를 빼고, 폰트 정본 §10-2 「로고타입으로 묶어 작게 · 효과 없이」
    (霜の肌理 — 명조 + 작은 줄)대로 묶는다. 명조는 이 브랜드의 전단 제목(고운바탕) · 노트북 화면과 같은 결이고,
    작은 줄은 처음 보는 눈에 무슨 가게인지 알린다(맹검 4차 「무슨 몰인지 알 수 없다」 · 11-05 「이름만 두면 뜻을 모른다」)."""
    w = 맞춤(조판(SERIF, word_w, "느지막", track=track))
    if only == "word":
        return w
    if only == "mono":
        return 맞춤(조판(SERIF, word_w, "느"))
    t = 맞춤(조판(SERIF, sub_w, sub, track=sub_track), h=100 * sub_h)
    wx0, wy0, wx1, wy1 = w.bounds
    tx0, ty0, tx1, ty1 = t.bounds
    t = affinity.translate(t, (wx1 - wx0) / 2 - (tx1 - tx0) / 2, -(100 * gap) - (ty1 - ty0))
    return 맞춤(unary_union([w, t]), h=100 * (1 + gap + sub_h))


def 작은줄(text, wght=300, r=14):
    """끝 작은 줄 — 가는 고딕(Noto Sans KR 300)을 끝만 둥글려 단선 로고와 같은 결로."""
    g = 조판(SANS, wght, text, track=10)
    g = g.buffer(-r, join_style="round").buffer(r, join_style="round")
    return 맞춤(g)


# ── 힘껏 ─────────────────────────────────────────────────────────────────
def 힘껏(skew=10, hub=0.2, rx_k=0.92, grow=1.08, round_k=1.12, track=-60, groove=(0.78, 0.70)):
    """Noto Sans KR 900을 출발점으로 — ㅎ의 ㅇ 고리를 플라이휠 원판(축 구멍)으로 바꾸고 앞으로 기울인다."""
    g, adv = 글자도형(SANS, 900, "힘")
    g2, _ = 글자도형(SANS, 900, "껏")
    keep, ring = [], None
    for p in (list(g.geoms) if isinstance(g, MultiPolygon) else [g]):
        if p.interiors and p.bounds[1] > 200:   # 받침 ㅁ(아래)이 아닌 구멍 난 덩어리 = ㅇ
            ring = p
        else:
            keep.append(p)
    x0, y0, x1, y1 = ring.bounds
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ry = (y1 - y0) / 2 * grow
    rx = ry * round_k   # 납작한 타원이면 홈 고리가 눈 · 과녁처럼 읽혀 바퀴처럼 둥글게(11-10)
    # 11-10: 속이 찬 원판만으로는 굵은 글꼴의 메운 ㅇ으로 읽혀(B 카드 맹검 「기성 굵은 이탤릭」) 바퀴의 가는 홈 고리를 판다
    disc = groove_disc(cx, cy, rx, ry, hub_r=hub / ry if hub > 1 else hub, groove=groove)
    disc = disc.difference(unary_union(keep).buffer(18))   # 커진 원판이 ㅎ 가로 · 받침에 닿지 않게
    g = unary_union(keep + [disc, affinity.translate(g2, adv + track, 0)])
    minx, miny, _, _ = g.bounds
    return 맞춤(affinity.skew(g, xs=skew, origin=(minx, miny)))


def groove_disc(cx, cy, rx, ry, hub_r=0.2, groove=(0.78, 0.70)):
    """플라이휠 원판 — 가는 홈 고리 하나와 가운데 축 구멍."""
    d = ell(cx, cy, rx, ry)
    if groove:
        d = d.difference(ell(cx, cy, rx * groove[0], ry * groove[0]).difference(ell(cx, cy, rx * groove[1], ry * groove[1])))
    return d.difference(ell(cx, cy, rx * hub_r, ry * hub_r))


def 칠십퍼센트(skew=10, hub=0.22):
    """「70%」 — 같은 무거운 숫자, %의 두 동그라미를 플라이휠 원판으로."""
    g7, a7 = 글자도형(SANS, 900, "7")
    g0, a0 = 글자도형(SANS, 900, "0")
    gp, ap = 글자도형(SANS, 900, "%")
    keep, rings = [], []
    for p in (list(gp.geoms) if isinstance(gp, MultiPolygon) else [gp]):
        (rings if p.interiors else keep).append(p)
    discs = []
    for rg in rings:
        x0, y0, x1, y1 = rg.bounds
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        discs.append(ell(cx, cy, rx, ry).difference(ell(cx, cy, rx * hub, ry * hub)))   # %는 속 찬 원판 + 축(홈 고리를 넣으면 과녁 ◎처럼 번잡 — 11-10)
    gp2 = unary_union(keep + discs)
    g = unary_union([g7, affinity.translate(g0, a7 - 30, 0), affinity.translate(gp2, a7 + a0 - 40, 0)])
    minx, miny, _, _ = g.bounds
    return 맞춤(affinity.skew(g, xs=skew, origin=(minx, miny)))


VARIANTS = {
    "neujimak2": ("느지막 — 늘어진 단선", 느지막),
    "neujimak_serif": ("느지막 — 명조 묶음 + 가전 · 생활 온라인몰", 느지막명조),
    "neujimak_serif_mono": ("느 한 글자 명조 — 앱 아이콘", lambda: 느지막명조(only="mono")),
    "neujimak_serif_word": ("느지막 명조 글자만 — 웹 · 전단 머리", lambda: 느지막명조(only="word")),
    "neujimak3": ("느지막 — 모든 가로획이 처짐 · ㅡ가 감은 눈", 느지막3),
    "neujimak3_mono": ("느 한 글자 — 앱 아이콘", lambda: 느지막3(only_neu=True)),
    "neujimak3_plain": ("느지막 — 모든 가로획이 처짐(속눈썹 없음)", lambda: 느지막3(lash=False, eye_k=0.085)),
    "neujimak_eye": ("느지막 심벌 — 감은 눈", lambda: 맞춤(감은눈(100))),
    "neujimak_tag": ("느지막 끝 작은 줄", lambda: 작은줄("블프, 자고 일어나서")),
    "himkkeot2": ("힘껏 — 플라이휠 원판", 힘껏),
    "seventy": ("70% — 같은 원판", 칠십퍼센트),
    "jeonpummok": ("전 품목 — 같은 무거운 기운 글자", lambda: 맞춤(affinity.skew(조판(SANS, 900, "전 품목", track=-30), xs=10, origin=(0, 0)))),
}


def preview_sheet(geoms):
    from PIL import Image, ImageDraw
    W = 1600
    rows = []
    for key, (label, g) in geoms.items():
        bg = (20, 16, 44) if key in ("himkkeot2", "seventy") else (14, 18, 30)
        fg = (255, 244, 236)
        H = 280
        img = Image.new("RGB", (W, H), bg)
        minx, miny, maxx, maxy = g.bounds
        sc = min(190 / (maxy - miny), 1100 / (maxx - minx))
        m = 마스크(g, W, H, 60, 45, sc)
        img.paste(Image.new("RGB", (W, H), fg), (0, 0), m)
        small_w = 108
        sc2 = small_w / (maxx - minx)
        sh = int((maxy - miny) * sc2) + 4
        m2 = 마스크(g, small_w + 4, sh, 2, 2, sc2)
        img.paste(Image.new("RGB", m2.size, fg), (W - 200, 110), m2)
        d = ImageDraw.Draw(img)
        d.text((W - 200, 70), "108px", fill=(150, 150, 170))
        rows.append(img)
    sheet = Image.new("RGB", (W, sum(r.height for r in rows)), (0, 0, 0))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, "_로고_시안_한장.png")
    sheet.save(p)
    return p


def main():
    geoms, data = {}, {}
    for key, (label, fn) in VARIANTS.items():
        g = fn()
        geoms[key] = (label, g)
        d, w, h = 경로(g)
        data[key] = {"d": d, "w": w, "h": h}
        print(key, w, h)
    os.makedirs(os.path.dirname(OUTJ), exist_ok=True)
    json.dump(data, open(OUTJ, "w", encoding="utf-8"), ensure_ascii=False)
    print(os.path.normpath(OUTJ))
    print(preview_sheet(geoms))
    return geoms


if __name__ == "__main__":
    main()
