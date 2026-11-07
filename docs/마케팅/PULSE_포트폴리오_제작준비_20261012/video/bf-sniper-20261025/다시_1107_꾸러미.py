# 블프 스나이퍼 다시 뽑기(2026-11-07, Claude) — 편집 전 점검(시댄스무제한/편집전점검.py)에서 걸린 두 판을 같은 시작 그림 · 고친 ACTION · CAMERA로 다시 낸다.
#   s4-08 선반 휙 팬: 판 4초 동안 카메라가 화면 폭 25.8%만 움직였고(지시 1.25초에 88%), 그는 화면 가운데에서 정면으로 서서 눈을 감았다(로맨스 「앵글이 맹해」와 같은 짜임).
#         옛 글의 「he keeps pace with the camera, staying in the right part of the frame」가 카메라를 붙잡았다고 보고, 그가 선반을 옆얼굴로 훑으며 빠르게 지나가는 꼴로 바꿨다.
#   s4-14 담요 저격 자세: 판 내내 멈춤(0.25초 사이 움직임 0.2~0.4 — 압축 잡음 수준). 옛 글의 「stays perfectly still」 · 「only he moves」를 빼고,
#         팔꿈치로 기어가는 몸짓 · 담요 주름 · 두 번 딸깍 · 뒤로 지나가는 로봇 청소기(원본 14의 지나가는 사람 자리, 콘티 5절 3)를 박았다.
#   python -X utf8 다시_1107_꾸러미.py  → git 밖 pulse-seedance-day-20261028/웹올리기_블프다시_1107/
#   내기: python -X utf8 ../../시댄스무제한/드리미나내기.py <그 폴더> s4-08 s4-08 s4-14 s4-14 --받을곳 <받음> --계정 ultra [--실행]
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OLD = os.path.join(DAY, "웹올리기_여섯편")
PACK = os.path.join(DAY, "웹올리기_블프다시_1107")
PIC = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/bf-sniper/시댄스"

HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people and animals, faces, hair and clothes.\n"
        "ONE SINGLE CONTINUOUS SHOT of a deadpan Korean comedy TV commercial, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n")
JUNHO = ("JUNHO: the same Korean man aged 38 as in the first frame, in every frame — short black hair neatly side-parted, clean-shaven with a smooth jaw, exactly the face of the first frame, "
         "in exactly the clothes of the first frame (a plain heather-grey crewneck sweatshirt and navy track pants). His face stays serious and deadpan, like a soldier on a mission — "
         "steady eyes, eyebrows level, mouth a flat line, lips closed. He never speaks, never smiles, never grimaces.\n")
LOOK = ("LOOK: a polished, high-end TV-commercial look — a real Korean apartment, realistic textures, natural skin, crisp focus, slight film grain. Keep the first frame's light — its direction, "
        "brightness, color and white balance — to the very end: the bright daytime room stays bright and warm. No new text, letters, numbers, logos or signs appear anywhere. Never add a person who is not described.\n"
        "SOUND: silent clip — no dialogue, no narration, no music.")

TAKES = {
    "s4-08": {
        "그림": "S08.jpg", "길이": 4, "쓰는초": 1.29,
        "글": HEAD + JUNHO.replace("JUNHO:", "JUNHO (wearing a black over-ear headset):") +
        "ACTION: Junho is in a hurry, on a supply run: he strides fast to the left along the living-room shelf, his head turned toward the shelf so we only ever see his face in profile, "
        "eyes darting over the rows of plain drink cans, small white eye-drop bottles and black wrist braces like a soldier checking his supplies. He never turns toward the camera and never stops; "
        "he stays in the right third of the frame, moving left just as fast as the camera swings.\n"
        "CAMERA: a real whip pan — from the very first frame the camera swings hard to the left along the shelf, so fast that the shelf smears into long horizontal motion-blur streaks; "
        "in the first 1.2 seconds it travels almost one full frame width of shelf, fastest in the middle, then slows and settles by about 1.3 s while he carries on out of the left edge of the frame.\n" + LOOK,
    },
    "s4-14": {
        "그림": "S14.jpg", "길이": 4, "쓰는초": 1.30,
        "글": HEAD + JUNHO +
        "CLOAK: the grey fleece blanket draped over his head and back like a sniper's camouflage cloak, exactly as in the first frame.\n"
        "ACTION: In the bright living room, Junho lies on his stomach on the floor like a sniper in position, under the blanket cloak, his face turned toward the operation desk on the right. "
        "From the very first frame he army-crawls forward on his elbows, slowly and steadily, dragging himself about a hand's width toward the desk; the blanket slides and wrinkles over his back with every pull, "
        "and his shoulders rise and fall. At about 0.5 s his eyes narrow and the index finger of his hand on the mouse clicks twice, quick and sharp, the finger visibly pressing down. "
        "Behind him, the small white round robot vacuum at the right of the room glides slowly to the left across the floor under the desk.\n"
        "CAMERA: a low camera about 40 cm above the floor, level — the frame stays exactly where it is from the first frame to the last; no push-in, no zoom, no drift, no shake; "
        "only Junho, the blanket and the robot vacuum move.\n" + LOOK,
    },
}


def main():
    if os.path.isdir(PACK):
        shutil.rmtree(PACK)
    os.makedirs(PACK)
    order = []
    for k, (pid, t) in enumerate(TAKES.items(), 1):
        folder = f"{k:03d}_{pid}"
        d = os.path.join(PACK, folder)
        os.makedirs(d)
        shutil.copyfile(os.path.join(PIC, t["그림"]), os.path.join(d, "1_시작.jpg"))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(t["글"])
        order.append({"순서": k, "id": pid, "편": "s4", "컷": [pid.split("-")[1]], "폴더": folder, "길이": t["길이"], "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
                      "시험": False, "낱판": [], "쓰는초": [t["쓰는초"]], "파일": ["1_시작.jpg"], "빠진 파일": [], "지시문 머리": t["글"][:120], "지시문 글자 수": len(t["글"]), "샷수": 1})
        old = open(os.path.join(OLD, next(f for f in os.listdir(OLD) if f.endswith("_" + pid)), "지시문.txt"), encoding="utf-8").read()
        print(f"{pid}: {len(old)} → {len(t['글'])}자")
    json.dump(order, open(os.path.join(PACK, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(PACK)


if __name__ == "__main__":
    main()
