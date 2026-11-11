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


ONLY = {"s4-05": ("ONLY THE 24TH: the only new red line in the whole clip is the second diagonal of the X in the box for the 24th. The boxes for the 25th, "
                  "26th, 27th and every later day stay completely empty of new marks from the first frame to the last — the marker never touches them; "
                  "after finishing the 24th the hand lifts off and moves down and away to the lower left, out of the boxes.")}


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
        if pid in ONLY:   # 11-11 1차 판이 24일 X를 마친 뒤 25일까지 그었다(D-3 컷) — 새 획은 그날 칸 하나만
            act = next(i for i, l in enumerate(lines) if l.startswith("ACTION:"))
            lines.insert(act + 1, ONLY[pid])
        cuts[pid] = {"그림": f"{W}/받음/{job}.png", "글": "\n".join(lines), "쓰는초": o["쓰는초"][0], "시댄스길이": o["길이"]}
        print(pid, job, len(cuts[pid]["글"]), "자 · 쓰는", o["쓰는초"][0], "초")
    os.makedirs(f"{W}/영상", exist_ok=True)
    json.dump({"컷": cuts}, open(f"{W}/영상/동영상.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{W}/영상/동영상.json")


if __name__ == "__main__":
    main()
