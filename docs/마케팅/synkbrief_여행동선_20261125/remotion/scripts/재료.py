# synkbrief B77 「여행 동선」 화면 재료 — 2026-11-25 ChatGPT 임시 채팅(어두운 화면, 휴대폰 크기 430 × 932 · 배율 2.5)과
# 카카오맵 자동차 길찾기에서 실제로 받은 화면을 조각으로 자른다.
# 원본 화면은 git 밖 %USERPROFILE%/ego/synkbrief-travel-20261125/ 에 있다(실험 E02 · E06 · E08, 지도 map_E02c, 카카오맵 kakao). 끝 화면(E08)만 밝은 화면이다.
# 사용: python -I -X utf8 scripts/재료.py   (remotion 폴더에서) → public/img/<이름>.png · src/sizes.json · 편 폴더 그림/
import json, os
from PIL import Image, ImageChops

SRC = os.path.join(os.path.expanduser("~"), "ego", "synkbrief-travel-20261125")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "public", "img")  # 영상용 사본(git 밖) — 정본은 편 폴더 그림/
KEEP = os.path.join(os.path.dirname(HERE), "그림")
os.makedirs(OUT, exist_ok=True)
os.makedirs(KEEP, exist_ok=True)
BG = (14, 14, 14)  # ChatGPT 어두운 화면 바탕

# 이름: (원본 파일, x0, y0, x1, y1, 맞춤 여부)
CUTS = {
    # 보낸 글 — 가고 싶은 곳 열두 곳과 붙인 한 줄(말풍선 전체)
    "bubble": ("runs/E02/답_00.png", 330, 205, 1045, 1310, True),
    # 말풍선 아래 끝의 붙인 한 줄(「부산 2박 3일이야. 하루에 세 곳만, 이동은 30분 안으로 묶어 줘.」)
    "bubble_line": ("runs/E02/답_00.png", 345, 1125, 1040, 1300, True),
    # 답 첫 문단(하루 3곳씩 총 9곳 · 12곳 중 3곳은 제외)
    "intro1": ("runs/E02/답_00.png", 25, 1385, 1060, 1680, True),
    # 답 둘째 문단(택시 · 자가용 기준, 관광지 사이 이동 30분 이내)
    "intro2": ("runs/E02/답_00.png", 25, 1690, 1060, 1850, True),
    # 제외한 3곳과 까닭
    "excluded": ("runs/E02/답_04.png", 25, 630, 1060, 1000, True),
    # 아래 입력 칸
    "composer": ("runs/E02/답_04.png", 0, 2040, 1075, 2290, False),
    # 지도를 펼친 화면 — 모든 날짜 · 1일차 · 2일차 · 3일차(위 날짜 고르기부터 지도 아래 「9곳 · 3곳」 줄 위까지).
    # 날짜를 고르면 지도가 길에 꼭 맞춰 핀 이름이 화면 끝에 잘려서(첫 컷 검사 v1 #5), 휠로 한두 칸 줄인 화면을 쓴다(map_E02c)
    "map_all": ("map_E02c/11_모든 날짜_휠2.png", 0, 120, 1075, 1340, False),
    # 「구간마다」 장면용 — 같은 화면을 지도 아래 바다까지 길게(판을 위로 올려 구간 시간 글자를 화면 아래 캡션 자리 위에 두려고)
    "map_all_tall": ("map_E02c/11_모든 날짜_휠2.png", 0, 120, 1075, 1480, False),
    "map_d1": ("map_E02c/09_1일차_휠2.png", 0, 120, 1075, 1340, False),
    "map_d2": ("map_E02c/03_2일차_휠1.png", 0, 120, 1075, 1340, False),
    "map_d3": ("map_E02c/05_3일차_휠1.png", 0, 120, 1075, 1340, False),
    # 카카오맵 자동차 길찾기(태종대유원지 → 흰여울문화마을 21분 6.7km) — 왼쪽 길찾기 칸 위쪽과 지도 위 길(계정 그림 · 날씨 · 접속 지역은 자르지 않는다)
    "kakao_panel": ("kakao/태종대_흰여울문화마을.png", 20, 205, 600, 660, False),
    # 이해 시험 2회(s · h 「카카오맵 화면 글씨가 작다」) — 길찾기 칸을 셋으로 잘라 크게: 출발 · 도착 / 자동차 / 「21분 6.7km」
    "kakao_route": ("kakao/태종대_흰여울문화마을.png", 40, 215, 545, 345, False),
    "kakao_mode": ("kakao/태종대_흰여울문화마을.png", 115, 355, 490, 425, False),
    "kakao_time": ("kakao/태종대_흰여울문화마을.png", 40, 565, 205, 620, False),
    # 한 줄 없이 보낸 실험 E06(「부산 2박 3일이야. 동선 짜 줘.」만) — 날마다 네 곳 표와 열두 곳 지도(이해 시험 2회 볼 이유 심사 「한 줄 없이와 견줘야」)
    "e06_table": ("runs/E06/답_01.png", 25, 188, 1060, 738, True),
    "e06_map": ("runs/E06/답_01.png", 40, 905, 1035, 1912, False),
    "kakao_map": ("kakao/태종대_흰여울문화마을.png", 820, 215, 2320, 1140, False),
    # 끝 — 세 번째로 보낸 E07(밝은 화면, 같은 글)에는 지도가 없었고, 같은 채팅에 이어 보낸 「지도로도 보여 줘.」(E08)에 지도가 나왔다.
    # 그 말풍선과 지도 카드(올리기 전 검사 ⑯ 「11-27 편과 같은 어두운 무대」 · 미학 맹검 「끝 화면에 같은 지도 · 말풍선 띠」로 끝을 바꿈)
    "end_ask": ("runs/E08/답_05.png", 628, 322, 1044, 455, False),
    "end_map": ("runs/E08/답_05.png", 36, 778, 1039, 1786, False),
}

def fit(im, pad=14):
    diff = ImageChops.difference(im.convert("RGB"), Image.new("RGB", im.size, BG)).convert("L").point(lambda v: 255 if v > 18 else 0)
    box = diff.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

sizes = {}
for name, (f, x0, y0, x1, y1, trim) in CUTS.items():
    src = Image.open(os.path.join(SRC, f)).convert("RGB")
    im = src.crop((x0, y0, x1, y1))
    if trim:
        im = fit(im)
    im.save(os.path.join(OUT, f"{name}.png"))
    im.save(os.path.join(KEEP, f"{name}.png"))
    sizes[name] = [im.width, im.height]
    print(name, im.size)

json.dump(sizes, open(os.path.join(HERE, "src", "sizes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("sizes.json", len(sizes))
