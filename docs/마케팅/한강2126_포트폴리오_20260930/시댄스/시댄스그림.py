# 한강2126 재촬영 — 시댄스 2.5 시작 그림 모으기(2026-11-01).
#   python -X utf8 시댄스그림.py   → git 밖 재촬영_v40/시댄스/그림/<K>.jpg · _그림목록.json · _한장.jpg(눈으로 보는 대조판)
# 칸마다 고른 판은 가편집 8판 시간표(가편집/가편집8_어깨빵하늘까몽고침_시간표.json)가 정본이다 — 시간표에 없는 K04b(O8은 가편집에서 타이틀
# 시안1 영상이 덮음)만 콘티 페이지의 첫 판을 쓴다. 3:4(1792×2400)로 남은 얼굴 열 장은 가편집 · 콘티 페이지와 같은 가로 가운데 값(cx — 콘티 페이지
# 생성기 도구/콘티페이지_만들기.py의 k(…, cx=))으로 9:16(1350×2400)을 잘라 시작 그림으로 쓴다. 9:16 판(1536×2752)은 그대로 옮긴다.
# 그림을 다시 굽거나 시간표의 판이 바뀌면 다시 돌리고, 시댄스지시문.py · 웹꾸러미.py --한강도 다시 돌린다.
import json
import os
import re

from PIL import Image, ImageDraw, ImageFont

V40 = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40"
TIMETABLE = os.path.join(V40, "가편집", "가편집8_어깨빵하늘까몽고침_시간표.json")
KONTI = os.path.join(V40, "도구", "콘티페이지_만들기.py")
SRC = os.path.join(V40, "이미지콘티")
OUT = os.path.join(V40, "시댄스", "그림")
EXTRA = {"K04b": "K04b_수직탑뷰_대자"}   # 시간표 밖 — O8 컵 착지(타이틀은 후반에 얹는다)
# 판 갈아 끼우기 — 유호님이 새 판을 승인하면 여기에 「K: 이미지콘티 파일 이름(확장자 없이)」을 적고 다시 돌린다(시간표보다 앞섬).
#   11-01 콘티 검수(review/Fable_1101_콘티검수/ — 일관성.md 6절 · 이야기앵글.md 8절)의 그림 고침 넷은 유호님 11-01 「넷 다 고쳐」로 고친 판이다
#   (K10 뒷머리 번 → 꼬리를 푼 콘로우 · K39 코트걸이에 가방과 까몽 · K21 남색 판 흰 글자 · K15 큰 synk / SHIFT 벽 글자, 전후 review/…/그림고침_넷_고친판.jpg).
OVERRIDE = {
    "K10": "K10_7판_로비와이드_10시14분_꼬리",
    "K39": "K39_3판_4층펜던트_하얀빛_가방걸림",
    "K21": "K21_4판_접수대위_마린과종이컵_판간판",
    "K15": "K15_4판_2층전경_AI로봇팔_벽글자",
}
# 시댄스 시작 그림만 가로 가운데를 옮긴 칸(11-01 콘티 검수 — 가편집 · 콘티 페이지의 cx는 그대로): K37 0.47이면 상담사 엄지가 반쯤 잘려 「진짜는 4층」
#   박자가 사라진다 → 0.43(엄지 전체 + 까몽 대부분, 0.40은 까몽이 반 잘림), K00b 돔 뚜껑이 잘리지 않게 0.52, K04 옆 안경이 다 들어오게 0.42
CX_SEEDANCE = {"K37": 0.43, "K00b": 0.52, "K04": 0.42}


def crop_x():
    # 콘티 페이지 생성기의 k('K20', …, cx=0.62) — 가편집 · 콘티 페이지가 3:4 그림을 9:16으로 자른 가로 가운데
    src = open(KONTI, encoding="utf-8").read()
    return {m.group(1): float(m.group(2)) for m in re.finditer(r"^k\('(K\w+)'.*cx=([\d.]+)\)\s*$", src, re.M)}


def picks():
    rows = json.load(open(TIMETABLE, encoding="utf-8"))
    out = {}
    for r in rows:
        if r["K"] and not r["그림"].endswith(".mp4"):
            assert out.get(r["K"], r["그림"]) == r["그림"], f"{r['K']}: 시간표에 판이 둘 — {out[r['K']]} · {r['그림']}"
            out[r["K"]] = r["그림"]
    out.update(EXTRA)
    out.update(OVERRIDE)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    cx = dict(crop_x(), **CX_SEEDANCE)
    listing = {}
    for k, name in picks().items():
        im = Image.open(os.path.join(SRC, name + ".jpg")).convert("RGB")
        w, h = im.size
        cw = round(h * 9 / 16)
        box = None
        if cw < w:   # 3:4 얼굴 판 — 9:16 창을 cx 자리에서
            assert k in cx, f"{k}: 3:4 판인데 콘티 페이지에 cx가 없다"
            x0 = min(max(0, round(w * cx[k] - cw / 2)), w - cw)
            box = [x0, 0, x0 + cw, h]
            im = im.crop(box)
        im.save(os.path.join(OUT, k + ".jpg"), quality=95)
        listing[k] = {"원본": name + ".jpg", "원본크기": [w, h], "자름": box, "크기": list(im.size), **({"cx": cx[k]} if box else {})}
    json.dump(listing, open(os.path.join(OUT, "_그림목록.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sheet(listing)
    cropped = [k for k, v in listing.items() if v["자름"]]
    print(f"시작 그림 {len(listing)}장 → {OUT} (3:4에서 9:16으로 자른 {len(cropped)}장: {' · '.join(cropped)})")


def sheet(listing):
    # 대조판 — 칸 이름 + 판 이름, 한 줄 여덟 장
    font = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 20)
    W, H, top, per = 270, 480, 26, 8
    keys = list(listing)
    rows = (len(keys) + per - 1) // per
    board = Image.new("RGB", (W * per, (H + top) * rows), "white")
    d = ImageDraw.Draw(board)
    for i, k in enumerate(keys):
        x, y = (i % per) * W, (i // per) * (H + top)
        board.paste(Image.open(os.path.join(OUT, k + ".jpg")).resize((W, H)), (x, y + top))
        d.text((x + 4, y + 2), k + (" ✂" if listing[k]["자름"] else ""), fill="black", font=font)
    board.save(os.path.join(OUT, "_한장.jpg"), quality=85)


if __name__ == "__main__":
    main()
