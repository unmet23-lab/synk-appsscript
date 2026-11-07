# 세일 ⑬ 끝 다시 뽑기(2026-11-07, Claude) — Fable 맹검 「12.8~14.3 안장에 옆으로 앉아 몸만 카메라로 돌린 자세와 옅은 스톡 미소(가장 맹한 자리)」 ·
# 끝(결)이 늘 약함(메모). 같은 시작 그림(확정 C13 원천)에 ACTION만 바꾼다 — 안장에서 일어나 페달 위에 서며 카메라를 정면으로 보고 두 주먹을 든다.
# 휙(1.8초 → 2.24초 빈 벽)은 옛 판이 판 안 0.7초로 느렸으니 「in under half a second」를 박는다.
#   python -X utf8 다시_1107_끝꾸러미.py  → git 밖 웹올리기_블프다시_1107c/
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OLD = os.path.join(DAY, "웹올리기_여섯편", "024_s3-13")
PACK = os.path.join(DAY, "웹올리기_블프다시_1107c")

ACTION = ("ACTION: In the dark navy spin studio, Chaewon is on her white spin bike on the right, hands on the handlebar, already looking into the lens. From the very first frame she "
          "pushes up out of the saddle and stands on the pedals, turning her whole body square to the camera, and at about 0.6 s she throws both fists up above her shoulders with a huge, "
          "open-mouthed, triumphant cheer — eyes bright, a real burst of joy like she just won — then bounces on the pedals pumping both fists twice more, still beaming at the lens.\n")
CAMERA = ("CAMERA: From the first frame to 1.8 s the frame stays exactly where it is — the room, the bikes and the screen never shift; no push-in, no zoom, no shake. At 1.8 s the camera "
          "whips hard to the right in under half a second, so she and the bikes streak out to the left in heavy horizontal motion blur; by 2.2 s it has stopped on an empty stretch of the dark "
          "navy studio wall where one thin vertical light strip glows — no bikes, no objects, nothing written on it — and holds there to the end.\n")


def main():
    old = open(os.path.join(OLD, "지시문.txt"), encoding="utf-8").read()
    a, b = old.index("ACTION:"), old.index("LOOK:")
    new = old[:a] + ACTION + CAMERA + old[b:]
    if os.path.isdir(PACK):
        shutil.rmtree(PACK)
    d = os.path.join(PACK, "001_s3-13")
    os.makedirs(d)
    shutil.copyfile(os.path.join(OLD, "1_시작.jpg"), os.path.join(d, "1_시작.jpg"))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(new)
    json.dump([{"순서": 1, "id": "s3-13", "편": "s3", "컷": ["13"], "폴더": "001_s3-13", "길이": 4, "비율": "9:16", "소리": "끔", "묶음": False, "대안": False, "시험": False,
                "낱판": [], "쓰는초": [2.44], "파일": ["1_시작.jpg"], "빠진 파일": [], "지시문 머리": new[:120], "지시문 글자 수": len(new), "샷수": 1}],
              open(os.path.join(PACK, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(old), "→", len(new), PACK)


if __name__ == "__main__":
    main()
