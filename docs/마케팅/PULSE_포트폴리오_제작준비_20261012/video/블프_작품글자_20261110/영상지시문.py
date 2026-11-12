# 블프 스나이퍼 전단 · 달력 여섯 컷을 Gemini 앱 「동영상 만들기」로 다시 굽는 지시문(2026-11-11, Claude) — 유호님 「제미나이로만 만들어. 드리미나 쓰지말고」.
# 10-31 시댄스 판 지시문(웹올리기_여섯편)의 카메라 · 연기 · 초를 그대로 두고, ① 시작 그림 지칭을 「@이미지 1」에서 「the attached image」로,
# ② CALENDAR · FLYER 소품 줄을 새 판으로(다시_1111_꾸러미.py와 같은 문장), ③ 현장 노트 gemini_사진 「동영상 만들기는 시작 그림 속 작은 글자를
# 다시 그리며 뭉갠다」대로 글자를 지키는 줄을 더한다. 시작 그림은 git 밖 콘티/bf-sniper/글자1111/받음/(카본으로 구운 판).
#   python -X utf8 영상지시문.py   → git 밖 콘티/bf-sniper/글자1111/영상/동영상.json(보내기 · 받기 실행기가 읽음)
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("꾸러미", os.path.join(HERE, "..", "bf-sniper-20261025", "다시_1111_꾸러미.py"))
K = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(K)

W = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/글자1111"
OLD_HEAD = "@이미지 1 is the exact first frame of this video"
NEW_HEAD = "The attached image is the exact first frame of this video"
KEEP = ("TEXT: every printed number, letter and handwritten mark in the first frame stays exactly the same shape and size and stays in the "
        "same place on the paper in every frame — never redrawn, blurred into new letters or replaced.")   # 카메라는 각 컷 CAMERA 줄대로(7번은 다가감)


# 5번(D-3) · 2번(D-7)은 ACTION 줄을 통째로 바꾼다 — 11-11 1차(줄 없음)도, 2차(「ONLY THE 24TH」 금지 줄을 더함)도 24일 X를 0.25초에 끝내고
# 0.5초에 25일까지 그었다. 시댄스 4초 판의 「0.8초에 다 쓰고 끝」을 10초 판에 그대로 주니 남은 9초를 다음 칸 긋기로 채운다고 보고,
# 한 획 → 손이 아래로 빠짐 → 끝까지 달력만, 그리고 끝 그림(25 · 26은 빈칸)을 금지 대신 있는 그대로 적는다.
ACTION = {"s4-05": [
    ("ACTION: Close-up of the wall calendar around the box for the 24th. A man's hand, his forearm reaching in from the lower left, holds an uncapped red marker; the box "
     "for the 24th already has one red diagonal. Between about 0.3 and 1.0 s he draws ONE stroke — the second diagonal across the box for the "
     "24th, completing its X. That single stroke is the only drawing in the whole clip. Right after it the marker lifts off the paper and the "
     "hand drops straight down and slides out of the bottom-left edge of the frame by about 2 s. From 2 s to the last frame no hand and no "
     "marker are in the frame: the calendar hangs alone, perfectly still."),
    ("END: in the last frame the 24th has its finished red X, while the boxes to its right — the 25th and the 26th — are still blank white "
     "paper exactly as in the first frame, and the 27th still shows only the red '00:00'. He crosses off only today; the days that have not "
     "come yet stay untouched."),
], "s4-02": [
    # 11-12: 「월」을 붙인 C02n 판(10:40)은 0.4초에 20일 X를 끝낸 뒤 펜이 11일로 건너가 새 획을 긋고 12 · 13일을 지나 1.75초에 빠졌다 —
    # 5번과 같은 꼴(남은 시간을 다른 칸 긋기로 채움)이라 같은 짜임(한 획 → 손이 빠짐 → 끝 그림을 있는 그대로)으로 바꾼다.
    ("ACTION: Straight-on close-up of the wall calendar. A man's hand, reaching in from the right edge of the frame, holds an uncapped red "
     "marker whose tip is already in the box for the 20th, partway through the first diagonal of an X. He finishes that first diagonal by about "
     "0.3 s, then draws the second diagonal across the 20th between about 0.5 and 1.1 s in one quick, firm stroke, so the 20th now carries a red X "
     "like the days before it. Those two strokes in the box for the 20th are the only drawing in the whole clip. At about 1.3 s the marker lifts "
     "off the paper and the hand pulls straight back to the right and slides out of the right edge of the frame by about 2 s. From 2 s to the "
     "last frame no hand and no marker are in the frame: the calendar hangs alone, perfectly still."),
    ("END: in the last frame the 20th has its finished red X; every earlier day keeps exactly the one X it had in the first frame, with no "
     "extra stroke; the boxes from the 21st to the 26th are still blank white paper exactly as in the first frame, and the 27th still shows only "
     "the red '00:00'. The marker never touches any box except the 20th."),
]}


# 11-13: 18번 11-11 판은 0.75초부터 아래 작은 10월 달력의 큰 「10」이 「16」으로 바뀌어 컷(0.87초) 끝 세 장에 걸렸다 — 그 글자를 이름으로 짚는다.
KEEP_MORE = {"s4-18": (
    "SMALL CALENDARS: the two small month calendars printed at the bottom of the page keep their big month numbers exactly '10' (October) "
    "and '12' (December) and their tiny date grids exactly as printed, in every frame to the last; the marker never goes near them.")}


def main():
    order = {x["id"]: x for x in json.load(open(os.path.join(K.OLD, "_순서.json"), encoding="utf-8"))}
    cuts = {}
    for pid, job in K.START.items():
        o = order[pid]
        text = open(os.path.join(K.OLD, o["폴더"], "지시문.txt"), encoding="utf-8").read()
        new = text.replace(K.OLD_CAL, K.NEW_CAL).replace(K.OLD_FLY, K.NEW_FLY).replace(OLD_HEAD, NEW_HEAD)
        assert new != text and "@이미지" not in new, pid
        lines = new.split("\n")
        at = next(i for i, l in enumerate(lines) if l.startswith("CAMERA:"))
        lines.insert(at + 1, KEEP)
        if pid in ACTION:   # 위 ACTION 설명 — 새 획은 그날 칸 하나만
            act = next(i for i, l in enumerate(lines) if l.startswith("ACTION:"))
            lines[act:act + 1] = ACTION[pid]
        if pid in KEEP_MORE:
            lines.insert(lines.index(KEEP) + 1, KEEP_MORE[pid])
        cuts[pid] = {"그림": f"{W}/받음/{job}.png", "글": "\n".join(lines), "쓰는초": o["쓰는초"][0], "시댄스길이": o["길이"]}
        print(pid, job, len(cuts[pid]["글"]), "자 · 쓰는", o["쓰는초"][0], "초")
    os.makedirs(f"{W}/영상", exist_ok=True)
    json.dump({"컷": cuts}, open(f"{W}/영상/동영상.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{W}/영상/동영상.json")


if __name__ == "__main__":
    main()
