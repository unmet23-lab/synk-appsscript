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
# 11-13: 이 한 획 판은 11-12 10:36 · 13:45 · 11-13 05:04 세 번 모두 영상 없이 「error」로 끝났고, 같은 짜임의 2번은 같은 날 두 번 다 받았다.
# 5번에만 있던 「hand drops straight down」 · 「hangs alone」 · 「the days that have not come yet」가 카운트다운과 겹쳐 걸렸을 수 있다고 보고(확인 안 함) 그 말만 덜어 낸다.
ACTION = {"s4-05": [
    ("ACTION: Close-up of the wall calendar around the box for the 24th. A man's hand, his forearm reaching in from the lower left, holds an uncapped red marker; the box "
     "for the 24th already has one red diagonal. Between about 0.3 and 1.0 s he draws ONE stroke — the second diagonal across the box for the "
     "24th, completing its X. That single stroke is the only drawing in the whole clip. Right after it he lifts the marker off the paper and "
     "his hand moves away toward the lower left, leaving the frame by about 2 s. From 2 s to the last frame only the calendar is in view, "
     "perfectly still."),
    ("END: in the last frame the 24th has its finished red X, while the boxes to its right — the 25th and the 26th — are still blank white "
     "paper exactly as in the first frame, and the 27th still shows only the red '00:00'. Only the box for the 24th gets a new mark."),
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
    "and '12' (December) and their tiny date grids exactly as printed, in every frame to the last; the marker never goes near them."),
    # 11-13: 13r(마커 빨강 판)은 0.25초부터 「30」 오른쪽 빈칸에 작은 달력 칸이 생기고 0.58초에 「30」이 「31」로 — 18번처럼 그 자리를 이름으로 짚는다
    "s4-13": (
    "BOTTOM ROW: the bottom row of the calendar shows only the box with '30' and plain empty white boxes to its right, exactly as in the first "
    "frame, in every frame to the last — '30' stays '30', and no small calendar, grid, number or letter appears in those boxes.")}


# 11-13 06:27: 위 5번 한 획 ACTION은 말을 덜어 낸 뒤에도 영어 거절(「hard time fulfilling」)이었다 — 이 ACTION으로 넷 다 실패, 10-31 ACTION으로는
# 같은 C05n 그림이 세 번 다 받았다. 그래서 받던 문장을 그대로 두고 손이 빠지는 줄(c) · 끝 그림 줄까지(b)만 더한 두 판을 한 차례에 낸다.
LEAVE_05 = ("LEAVE: right after the X is complete, his hand moves away toward the lower left and leaves the frame by about 2 s; from then on only "
            "the calendar is in view, perfectly still, to the last frame.")
EXTRA = {"s4-05b": ("s4-05", [LEAVE_05, ACTION["s4-05"][1]]), "s4-05c": ("s4-05", [LEAVE_05])}
# 7번은 같은 글로 F07A3 그림은 받고 F07A4 그림은 다섯 번(거절 1 · 오류 3 · 주소놓침 1) 못 받았다 — 그림을 JPEG로 새로 저장하고
# 싸움 · 죽음 쪽으로 읽힐 수 있는 낱말(soldier on a mission · deadly)만 바꾼다(확인 안 함).
IMG = {"s4-07": "F07A4_j.jpg"}
# 11-13 08:47 F07A4 여섯째는 보낸 뒤 대화가 안 생김(사라짐). 그림 탓인지 가르려고 같은 글을 받은 적 있는 F07A3 그림으로도 한 판 낸다 — A3는 작은 줄이 무너져 본편엔 못 쓴다.
ALT_IMG = {"s4-07a3": ("s4-07", "F07A3.png"),
           # 11-13 독립 검수: 13번만 마커 몸통이 검정(시작 그림 C13n부터) — 몸통만 빨강으로 고친 C13r로, 11-11에 받은 13번 글 그대로 다시
           "s4-13r": ("s4-13", "C13r.png"), "s4-13s": ("s4-13", "C13r.png"), "s4-13t": ("s4-13", "C13r.png")}   # s · t = 아래 KEEP_MORE 「BOTTOM ROW」 줄이 든 13번 글로 두 번 뽑기
# 11-13 12시: A3 · A4 둘 다 11:15 · 11:21에 「encountering an error」 — 11-11 저녁부터 7번만 열 번 넘게 막혔고, 같은 날 다른 편의 사람 컷은 받았다.
# 얼굴 그림 탓인지 긴 글 탓인지 가르려고 인물 설명 줄 · 「deadpan comedy TV commercial」 틀을 뺀 짧은 글로 F07A4를 낸다(연기 · 카메라 · 글자 · 빛만).
SHORT = {"s4-07m": ("s4-07", "F07A4.png", "\n".join([
    "The attached image is the exact first frame of this video: start from it unchanged — same framing, same room, same light and colors, same man, same clothes.",
    "One continuous shot, horizontal 16:9, no cuts.",
    "ACTION: The man reads the open sale flyer he holds at chest height, looking over the thin reading glasses at the tip of his nose. At about 1.3 s, still "
    "reading, he slowly takes the glasses off with his hand on the right side of the frame while his other hand keeps the flyer open, and leans his face a "
    "little closer to the flyer, eyes narrowing at the price. At about 2.4 s he tilts the flyer a few millimetres closer. His face stays calm and serious, "
    "lips closed.",
    "CAMERA: the frame holds still until about 1.2 s, then the camera slowly moves in toward him and rises slightly until about 3.3 s — smooth, no zoom, no shake.",
    "TEXT: every printed letter and number on the flyer stays exactly the same shape, size and place in every frame — never redrawn or blurred into new letters.",
    "Keep the first frame's soft daylight to the very end. Silent clip — no dialogue, no music."]))}
# 11-13 독립 검수: 7m은 안경을 벗은 뒤(2.6~3.3초) 안경다리 하나가 얼굴 앞을 세로 검은 줄로 지나갔다(눈 꼬리 → 콧등 → 볼 → 턱) — 같은 짧은 글에 벗는 길만 적어 다시.
SHORT["s4-07n"] = ("s4-07", "F07A4.png", SHORT["s4-07m"][2].replace(
    "At about 1.3 s, still reading, he slowly takes the glasses off with his hand on the right side of the frame while his other hand keeps the flyer open, "
    "and leans his face a little closer to the flyer, eyes narrowing at the price.",
    "At about 1.0 s, still reading, he lifts his hand on the right side of the frame, takes the glasses off by the frame and by about 1.8 s lowers them, "
    "folded, to chest height beside the flyer — the glasses stay one solid piece in his hand and nothing passes in front of his face — while his other hand "
    "keeps the flyer open; then he leans his face a little closer to the flyer, eyes narrowing at the price."))
assert SHORT["s4-07n"][2] != SHORT["s4-07m"][2]
# 11-13 13시: 7n도 2.17~2.5초에 안경다리가 볼 위 검은 줄로 지나갔다 — 벗는 동작마다 가는 다리를 피부 위 줄로 그린다. 두 판을 함께 낸다:
# p = 안경을 이마로 밀어 올림(다리가 귀에 걸린 채 — 얼굴을 안 지남, 원본의 「벗고」와 동작은 다르나 「값을 더 가까이 본다」 뜻은 같음),
# q = 원본대로 벗되 코받침을 잡고 앞으로 곧게 빼 다리가 얼굴에서 떨어진 채 앞쪽으로 나옴.
_M = SHORT["s4-07m"][2]
_OLD = ("At about 1.3 s, still reading, he slowly takes the glasses off with his hand on the right side of the frame while his other hand keeps the flyer open, "
        "and leans his face a little closer to the flyer, eyes narrowing at the price.")
SHORT["s4-07p"] = ("s4-07", "F07A4.png", _M.replace(_OLD,
    "At about 1.0 s, still reading, he lifts his hand on the right side of the frame and with one fingertip slowly pushes the glasses up off his nose onto "
    "his forehead, where they rest above his eyebrows with the arms still over his ears, while his other hand keeps the flyer open; then he leans his face a "
    "little closer to the flyer, eyes narrowing at the price."))
SHORT["s4-07q"] = ("s4-07", "F07A4.png", _M.replace(_OLD,
    "At about 1.0 s, still reading, he pinches the bridge of the glasses between thumb and finger of his hand on the right side of the frame and pulls them "
    "straight forward, away from his face, so the thin metal arms slide off his ears and come forward in the air in front of him, never touching his cheeks; "
    "by about 1.8 s he holds them low at chest height beside the flyer while his other hand keeps the flyer open; then he leans his face a little closer to "
    "the flyer, eyes narrowing at the price."))
assert _OLD in _M and SHORT["s4-07p"][2] != _M and SHORT["s4-07q"][2] != _M
SOFT = {"s4-07": [("like a soldier on a mission", "fully absorbed in the task"), ("that deadly serious look", "that intensely serious look")]}


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
        text = "\n".join(lines)
        for a, b in SOFT.get(pid, []):
            assert a in text, (pid, a)
            text = text.replace(a, b)
        cuts[pid] = {"그림": f"{W}/받음/{IMG.get(pid, job + '.png')}", "글": text, "쓰는초": o["쓰는초"][0], "시댄스길이": o["길이"]}
        print(pid, job, len(cuts[pid]["글"]), "자 · 쓰는", o["쓰는초"][0], "초")
    for vid, (pid, more) in EXTRA.items():   # 위 EXTRA 설명 — 10-31 ACTION 줄 뒤에 더한다
        o, job = order[pid], K.START[pid]
        text = open(os.path.join(K.OLD, o["폴더"], "지시문.txt"), encoding="utf-8").read()
        lines = text.replace(K.OLD_CAL, K.NEW_CAL).replace(K.OLD_FLY, K.NEW_FLY).replace(OLD_HEAD, NEW_HEAD).split("\n")
        lines.insert(next(i for i, l in enumerate(lines) if l.startswith("CAMERA:")) + 1, KEEP)
        act = next(i for i, l in enumerate(lines) if l.startswith("ACTION:"))
        lines[act + 1:act + 1] = more
        cuts[vid] = {"그림": f"{W}/받음/{job}.png", "글": "\n".join(lines), "쓰는초": o["쓰는초"][0], "시댄스길이": o["길이"]}
        print(vid, job, len(cuts[vid]["글"]), "자 · 10-31 ACTION +", len(more), "줄")
    for vid, (pid, img) in ALT_IMG.items():   # 위 ALT_IMG 설명 — 글은 그 편 그대로, 그림만
        cuts[vid] = dict(cuts[pid], 그림=f"{W}/받음/{img}")
        print(vid, img, "· 글은", pid, "그대로")
    for vid, (pid, img, text) in SHORT.items():   # 위 SHORT 설명 — 짧은 글
        cuts[vid] = dict(cuts[pid], 그림=f"{W}/받음/{img}", 글=text)
        print(vid, img, len(text), "자 · 짧은 글")
    os.makedirs(f"{W}/영상", exist_ok=True)
    json.dump({"컷": cuts}, open(f"{W}/영상/동영상.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{W}/영상/동영상.json")


if __name__ == "__main__":
    main()
