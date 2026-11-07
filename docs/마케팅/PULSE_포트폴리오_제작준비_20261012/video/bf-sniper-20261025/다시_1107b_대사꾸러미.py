# 블프 두 편 화면 밖 대사 다시 뽑기(2026-11-07, Claude) — 받아쓰기 두 겹(faster-whisper medium · 일레븐 Scribe v2)으로 걸린 두 판.
#   s4-말-준호-1: 두 받아쓰기 모두 「작전명 불프」 — 첫 마디 「블프」가 ㅜ로 들림(화면 첫 글이 「작전명: 블프」라 틀린 발음이 바로 걸린다).
#   s3-말-채원-3: 줄 길이 4.25초(콘티 11.0–14.5 = 3.5초) — 「지금 · 힘껏 · 앱에서」 사이 쉼이 0.6초씩, Scribe는 「앱에서」를 「애폐서」로 적음.
#   s4-19소리(11-07 더함): 알람 셋 · 코골이 소리만 쓰는 판 — 자료실(fairlight · sonniss)에 코골이 · 탁상 알람이 없고 일레븐 효과음은 로그아웃(키에 sound_generation 없음).
#     19b 시작 그림으로 소리 켬 4초 판(화면은 안 씀, 02_콘티 3절 효과음 「알람 셋 동시 · 코골이」).
# 옛 판의 그림 · 목소리 견본은 그대로 쓰고 지시문에 PACE · 발음 줄만 더한다(한강 11-06 「몇 초 안에 끝냄 · PACE 줄」과 같은 길).
#   python -X utf8 다시_1107b_대사꾸러미.py  → git 밖 웹올리기_블프다시_1107b/
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OLD = os.path.join(DAY, "웹올리기_여섯편")
PACK = os.path.join(DAY, "웹올리기_블프다시_1107b")

EDIT = {
    "s4-말-준호-1": {
        "비율": "16:9", "길이": 6,
        "더함": "PRONUNCIATION: 블프 is said exactly as written — 블 with the flat Korean vowel ㅡ, the same 블 as in 블랙프라이데이; never 불.\n",
        "뒤": "VOICE:",
    },
    "s3-말-채원-3": {
        "비율": "9:16", "길이": 6,
        "더함": "PACE: brisk and punchy like a real spin instructor's last shout — the whole line in one breath, starting at about 0.8 s and finished by about 4.0 s, "
                "no long pauses between 지금, 힘껏 and 앱에서; 앱에서 is said softly as one word, the ㅂ voiced.\n",
        "뒤": "VOICE:",
    },
}


SOUND19 = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people and animals, faces, hair and clothes.\n"
           "ONE SINGLE CONTINUOUS SHOT of a deadpan Korean comedy TV commercial, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n"
           "ACTION: Midnight, low on the floor in front of the operation desk: Junho, the Korean man aged 38 of the first frame, lies fast asleep on his side under the grey fleece blanket, "
           "eyes closed, mouth open. On the desk above him an old twin-bell alarm clock and two phones ring; at 1.0 s they all stop at once. He sleeps straight through it and snores.\n"
           "CAMERA: the frame stays exactly where it is from the first frame to the last.\n"
           "SOUND: loud and clear, close-miked — from the very first frame three alarms ring together: the old twin-bell alarm clock rattling fast and two smartphones beeping their alarm tones; "
           "at exactly 1.0 s all three stop at once, then a quiet room tone. At about 1.5 s he lets out one long, loud, comically deep snore (드르렁—), and at about 2.9 s a second, even bigger snore. "
           "No music, no speech, no other voices.")


def main():
    if os.path.isdir(PACK):
        shutil.rmtree(PACK)
    os.makedirs(PACK)
    order = []
    for k, (pid, e) in enumerate(EDIT.items(), 1):
        src = os.path.join(OLD, next(f for f in os.listdir(OLD) if f.endswith("_" + pid)))
        folder = f"{k:03d}_{pid}"
        d = os.path.join(PACK, folder)
        os.makedirs(d)
        for f in ("1_시작.jpg", "3_목소리견본.mp3"):
            shutil.copyfile(os.path.join(src, f), os.path.join(d, f))
        old = open(os.path.join(src, "지시문.txt"), encoding="utf-8").read()
        i = old.index(e["뒤"])
        new = old[:i] + e["더함"] + old[i:]
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(new)
        order.append({"순서": k, "id": pid, "편": pid.split("-")[0], "컷": [], "폴더": folder, "길이": e["길이"], "비율": e["비율"], "소리": "켬", "묶음": False, "대안": False,
                      "방식": "B", "시험": False, "낱판": [], "쓰는초": [], "파일": ["1_시작.jpg", "3_목소리견본.mp3"], "빠진 파일": [], "지시문 머리": new[:120], "지시문 글자 수": len(new), "샷수": 1})
        print(f"{pid}: {len(old)} → {len(new)}자")
    k += 1
    folder = f"{k:03d}_s4-19소리"
    d = os.path.join(PACK, folder)
    os.makedirs(d)
    shutil.copyfile(os.path.join(OLD, next(f for f in os.listdir(OLD) if f.endswith("_s4-19b")), "1_시작.jpg"), os.path.join(d, "1_시작.jpg"))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(SOUND19)
    order.append({"순서": k, "id": "s4-19소리", "편": "s4", "컷": ["19"], "폴더": folder, "길이": 4, "비율": "16:9", "소리": "켬", "묶음": False, "대안": False,
                  "시험": False, "낱판": [], "쓰는초": [], "파일": ["1_시작.jpg"], "빠진 파일": [], "지시문 머리": SOUND19[:120], "지시문 글자 수": len(SOUND19), "샷수": 1})
    json.dump(order, open(os.path.join(PACK, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(PACK)


if __name__ == "__main__":
    main()
