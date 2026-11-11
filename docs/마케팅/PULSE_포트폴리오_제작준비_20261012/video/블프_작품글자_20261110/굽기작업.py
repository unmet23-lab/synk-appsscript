# 블프 스나이퍼 시작 그림 다시 굽기 작업표(2026-11-11, Claude) — 유호님 「추천대로」(전단 A → A2, 벽 달력 새 원고).
# 엔진은 이 편 그대로 Gemini 나노바나나(77yuhbs, 공용 차례) — 굽기는 git 밖 실행기(콘티/bf-sniper/글자1110/굽기.sh)가 한다.
#   python -X utf8 굽기작업.py   → 글자1110/ego/jobs_1111.json + refs/(전단_A2.jpg · 달력_Cxx.png)
#   cd <글자1110> && JOBS=jobs_1111.json bash 굽기.sh
# 전단: 지금 시작 그림 S07의 오른쪽 면만 원고 A2(전단.py flyer_a2)로 — F07A2와 같은 편집 지시에 「TV 화면은 사진」 · 「없는 작은 글을 더하지 말 것」.
# 달력: 10-27 이미지콘티_지시문.py의 달력 편집(판은 그대로 · 손과 펜만 더함)을 새 원고(달력.py)에 그대로 — 문구는 그 파일에서 옮겼다.
import json
import os

from PIL import Image

W = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/글자1110"
SRC = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/최종/글자다시_1110"

HAND = ("The hands belong to a Korean man in his late thirties: average male hands with short clean nails, no rings, no watch; the cuff "
        "of a heather-grey sweatshirt sleeve shows at the wrist. Only the hands and a little of the forearms are in the frame — no face.")
CAL_EDIT = ("Edit Image 1. Image 1 is a photo of a paper wall calendar — keep the calendar EXACTLY as it is: every printed number, every red "
            "X, the half-drawn red stroke and the handwritten red '00:00' must stay exactly where they are and look the same; do not add, "
            "remove, redraw or move any number, letter or mark, and keep the framing and perspective. Only add, in front of the paper: ")
CAL_LOOK = ("Make the whole picture look like a real photograph of paper on a wall: soft daylight from the left, fine paper texture, natural "
            "lens falloff, the hand slightly out of focus where it is closest to the lens. No other changes.")
WHERE = {
    "C02": "a man's right hand coming in from the BOTTOM edge of the frame, just below the box for the 20th, holding an uncapped red marker whose tip touches the lower-right end of the half-drawn red stroke in the box for the 20th, as if it has just drawn that stroke. The hand is SMALL in the frame — only the fingers, the marker and a little of the grey sleeve show, below and around the box for the 20th; it must NOT cover the boxes for the 1st to the 19th, nor the 27th with its '00:00'",
    "C05": "a man's right hand coming in from the lower left of the frame, holding an uncapped red marker whose tip touches the lower-right end of the half-drawn red stroke in the box for the 24th, as if it has just drawn that stroke",
    "C13": "a man's right hand coming in from the lower left of the frame, holding an uncapped red marker whose tip touches the lower-right end of the half-drawn red stroke in the box for the 25th, as if it has just drawn that stroke",
    "C15": "a man's right hand coming in from the lower left of the frame, holding an uncapped marker with a RED body (the same red marker as in the other calendar shots) whose tip touches the TOP-RIGHT corner INSIDE the box for the 26th — just below the box's top line and just left of the vertical line between the 26th and the 27th, at the opposite top corner from where the existing stroke starts (NOT at the number 26), never inside the box for the 27th — about to draw the second stroke of the X from top-right down to bottom-left. The half-drawn stroke already in the box for the 26th must stay exactly as it is, in the same direction",
    "C18": "a man's right hand coming in from the lower left of the frame, holding an uncapped red marker whose tip touches the red circle around '00:00' in the box for the 27th, as if it has just finished drawing the circle",
}
FLYER = ("Edit Image 1. Image 1 is a frame from a Korean TV commercial: a man in a heather-grey sweatshirt stands in an apartment entrance hall and "
         "reads an open folded paper flyer that he holds at chest height, looking at it over thin reading glasses. Keep EVERYTHING in Image 1 exactly "
         "as it is — his face, hair, glasses, expression, both hands and every finger, the sweatshirt, the blank white LEFT page of the flyer, the room "
         "behind him, the light, the framing, the focus and the colours. Change ONLY the printing on the RIGHT page of the flyer (the page facing the "
         "camera, held by his right hand): replace the whole printed design on that page with the design of Image 2. Copy Image 2 exactly — the same "
         "wordmark, the same Korean words, the same numbers, the same layout, sizes and colours; do not add, remove, translate or change any letter or "
         "number, do not add any small print, QR code or model number that is not in Image 2, and do not keep anything of the old orange-and-red design. "
         "The TV on the page shows a real photograph of a soft sunrise over hills, printed like a product photo — not a drawing. Print it on matte cream "
         "paper (not glossy) that fills the same page area with the same position, size, perspective and gentle curve as the right page in Image 1, lit "
         "by the same soft daylight with the same soft shadows across it. His right hand's thumb and fingers stay in front of the paper exactly where they "
         "are now, covering a little of the bottom edge of the page. No other changes.")


def main():
    refs = os.path.join(W, "refs")
    os.makedirs(refs, exist_ok=True)
    a2 = os.path.join(refs, "전단_A2.jpg")
    Image.open(os.path.join(SRC, "전단", "전단_A2.png")).convert("RGB").save(a2, quality=94)
    a3 = os.path.join(refs, "전단_A3.jpg")
    Image.open(os.path.join(SRC, "전단", "전단_A3.png")).convert("RGB").save(a3, quality=94)
    J = {"F07A3": {"ratio": "16:9", "refs": [os.path.join(refs, "S07.jpg"), a2], "prompt": FLYER,
                   "메모": "7번 전단 면만 원고 A2로(11-11 「추천대로」) — 사람 · 방은 S07 그대로"},
         # 11-11 저녁: A2 판으로 구운 동영상이 작은 줄을 뭉개(「정인지 1,6000000원」) 큰 글 다섯만 남긴 A3로 다시
         "F07A4": {"ratio": "16:9", "refs": [os.path.join(refs, "S07.jpg"), a3], "prompt": FLYER.replace("The TV on the page shows", "The page has only five large printed elements, exactly as in Image 2 — keep it that sparse. The TV on the page shows"),
                   "메모": "7번 전단 면만 원고 A3(큰 글 다섯)로 — 동영상 판에서 작은 글이 무너지지 않게"}}
    for k, where in WHERE.items():
        p = os.path.join(refs, f"달력_{k}.png")
        Image.open(os.path.join(SRC, "달력", f"{k}.png")).convert("RGB").save(p)
        J[f"{k}n"] = {"ratio": "16:9", "refs": [p], "prompt": " ".join([CAL_EDIT + where + ".", HAND, CAL_LOOK]),
                      "메모": f"{k[1:]} 달력 새 원고(달력.py) — Gemini는 손 · 펜만"}
    out = os.path.join(W, "ego", "jobs_1111.json")
    json.dump({k: {**v, "refs": [r.replace("/", "\\") for r in v["refs"]]} for k, v in J.items()}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(out, list(J))


if __name__ == "__main__":
    main()
