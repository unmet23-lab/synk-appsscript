# 10번 도담중공업 — 사람이 굳은 컷 다시 뽑기 꾸러미(2026-11-07 밤, Claude · 유호님 「손이 굳어서 그냥 화면만 움직이고있어 … 자연스러움을 왜 안챙기는거야」)
#   python -X utf8 자연_1107_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p10자연_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p10-10n --받을곳 <받음> --계정 ultra [--실행]
# 까닭: 10(조립동 와이드)은 시작 그림에서 앞사람이 팔을 뻗어 날개를 가리키는데 지시문이 「they barely move」라, 판 내내 손짓이 굳은 채
#   카메라만 물러났다(카메라 47 px/초 · 사람 자기 움직임 0.45 px/장 — 사람 있는 컷 가운데 가장 낮음, 02_콘티 16절).
# 고침: 시작 그림 · CAMERA · LOOK은 그대로, ACTION만 「손짓이 이어지는 대화」로 — 가리키던 손이 날개 줄을 따라 움직이다 내려가고,
#   옆 사람은 손을 따라 고개를 돌려 끄덕인다. 「굳은 자세 없이 처음부터 끝까지 이어서 움직인다」를 적는다.
import json
import os
import re
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"

OUT = os.path.join(DAY, "웹올리기_p10자연_1107")

ACT_10 = ("A wide view of the bright, white-lit assembly hall: a long turbine rotor with rows of blades lies on steel stands, a big casing section beside it, "
          "a yellow overhead crane above. Two workers in grey work clothes and white hard hats stand by the rotor, seen from behind, their faces turned toward it, "
          "talking it over. From the very first frame the worker in front, who is pointing at the blades, slowly moves his pointing hand along the rows of blades "
          "toward the right as he explains, then lowers his arm to his side by about 1.8 s; the worker beside him turns his head to follow the hand and nods twice, "
          "shifting his weight from one foot to the other. Both keep moving naturally and continuously, unhurried, from the first frame to the last; "
          "their faces stay turned toward the rotor and never toward the camera.")
# 받은 p10-10n(11-07 22:46 냄)은 끝 문장이 「… to the last — nobody holds a frozen pose; their faces …」였다. 부정문이어도 「frozen」은
#   사람 정지 낱말이라(점검표 26번 · 꾸러미점검.py ⚠) 뺐다 — 판은 자연스럽게 나왔다(사람 0.77 px/장 · 원본 1.06의 73%).

# 같은 짜임(11-07 밤 교차 검수 — Gemini 영상 심사 + 카메라를 맞춘 첫 · 끝 장 대조): 8은 날개 원 너머 먼 작업자가 「stays still」대로 화면 가운데서
#   굳은 실루엣(카메라만 다가감), 23은 「몇 걸음 걷는다」가 거의 제자리, 24는 고정 카메라 2초에 숨만 얕아 사진처럼 읽힘 → 박자를 쓴 연기로.
ACT_08 = ("Head-on in front of a huge compressor blade ring that fills the frame — rows of dark steel blades around a big round opening; through the opening, "
          "far away in the bright hall, one worker stands small by the tall windows, green trees outside. The blade ring stays fixed in place. The far worker is "
          "going about his work: from the very first frame he walks slowly to the right along the tall windows, his arms swinging a little; at about 1.2 s he "
          "stops and turns his head toward the windows; the leaves of the trees outside sway in the wind.")
ACT_23 = ("Midday: a wide view of the huge concrete test building's open entrance; the turbine sits in its steel frame in the doorway, a small worker standing "
          "near it, a strip of green grass in the foreground. From the very first frame the small worker walks toward the turbine at a normal walking pace — "
          "his legs and arms clearly swinging with each step — and covers about 5% of the frame width by 1.6 s; at about 1.0 s he lifts his head toward the "
          "turbine as he walks. The strip of grass in front sways gently in a light breeze.")
ACT_24 = ("In the dark test cell lined with rows of square sound-absorbing panels, the turbine stands at the end of the long room, turned a little to the left "
          "and joined to its intake and exhaust ducts; it is not running yet, and two amber warning beacons on the side walls stay off. At the bottom centre a "
          "worker in a white hard hat stands with his back to the camera, looking up at the turbine, alive and breathing: at about 0.2 s he draws a slow, deep "
          "breath that visibly lifts and lowers his shoulders; from 0.8 s to 1.4 s he tilts his head further back to follow the turbine up to its top; at "
          "about 1.6 s he takes one slow step forward toward it. His face is never seen and he never turns around. A faint haze hangs in the beams of the "
          "work lights and drifts slowly sideways; the reflections on the wet floor shimmer slightly.")

# 교차 검수(Gemini · Fable · 그록) 셋이 겹친 나머지 굳은 사람: 11 라쳇 팔이 틀 밖 · 안전모만 아주 조금, 14 손이 이음새 한 점을 쥔 채 카메라만 흐름,
#   17 작은 작업자 셋이 고정 카메라 1.6초에 거의 그대로(「They shift only slightly」). 11은 받은 11m과 같은 길(시작 그림을 참고로 · 판 소리 켬 — 라쳇 소리를 판에서 받음).
ACT_11 = ("Low under the curved belly of the turbine casing, which fills the top of the frame: at the bottom, a worker in a white hard hat bends over his work, "
          "seen from above and behind — the top of his hat, his shoulder and his right arm show; his face is never seen. He is tightening a bolt with a ratchet "
          "wrench: from the very first frame his right arm pulls the ratchet in quick, short strokes — about two strokes every second — his shoulder rocking "
          "forward with each pull and his hard hat bobbing with every stroke; at about 1.0 s he shifts his weight and leans in a little closer. The bright hall "
          "glows behind.")
ACT_14 = ("Over the shoulder of a worker in a dark cap and a dark work jacket (his face never seen): from the very first frame his gloved hand slides along the "
          "seam of the big dark casing cover, pressing it down firmly as it goes — the hand travels about a quarter of the frame width to the right by 1.2 s, "
          "fingers kept together, his shoulder and elbow pushing with it; at about 1.3 s he lifts the hand and pats the seam twice with his palm. The bright "
          "hall stretches behind.")
ACT_17 = ("A wide view in the white-lit assembly hall: the turbine stands on its heavy steel skid, turned well to the left, showing its front closed by the "
          "grey bolted transport cover at a steep angle and its long side with the bolted split flange and the combustor cans; three small workers work around "
          "its base, seen from behind or far away: from the very first frame the two on the left check the bolts on the cover — one points at a bolt and the "
          "other leans in and turns a wrench — while the worker on the right walks slowly along the skid toward the back of the turbine; all three keep moving "
          "through the whole clip.")

JOBS = [  # (id, 꾸러미 폴더, 원래 판 폴더(DAY 아래), 새 ACTION, 쓰는초, 컷, 시작 그림 파일 이름(원래 판 폴더 안 = 꾸러미 안), 소리)
    ("p10-10n", "001_p10-10n", "웹올리기_여섯편/133_p10-10", ACT_10, 2.2, ["10"], "1_시작.jpg", "끔"),
    ("p10-08n", "002_p10-08n", "웹올리기_여섯편/131_p10-08", ACT_08, 1.9, ["8"], "1_시작.jpg", "끔"),
    ("p10-23n", "003_p10-23n", "웹올리기_p10발전_1107/014_p10-23g", ACT_23, 1.6, ["23"], "1_시작.jpg", "끔"),
    ("p10-24n", "004_p10-24n", "웹올리기_p10발전_1107/007_p10-24e", ACT_24, 2.1, ["24"], "1_시작.jpg", "끔"),
    ("p10-11n", "005_p10-11n", "웹올리기_p10다시_1107/003_p10-11m", ACT_11, 1.6, ["11"], "2_참고1_시작.jpg", "켬"),
    ("p10-14n", "006_p10-14n", "웹올리기_여섯편/136_p10-14", ACT_14, 1.7, ["14"], "1_시작.jpg", "끔"),
    ("p10-17n", "007_p10-17n", "웹올리기_p10발전_1107/002_p10-17e", ACT_17, 1.7, ["17"], "1_시작.jpg", "끔"),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, folder, src, act, use, cuts, img, sound) in enumerate(JOBS, 1):
        d = os.path.join(OUT, folder)
        if os.path.exists(os.path.join(d, "지시문.txt")):   # 이미 낸 판의 폴더는 낸 그대로 둔다(지시문을 고쳐도 덮지 않음)
            new = open(os.path.join(d, "지시문.txt"), encoding="utf-8").read()
        else:
            prompt = open(os.path.join(DAY, src, "지시문.txt"), encoding="utf-8").read()
            new, n = re.subn(r"^ACTION:.*$", "ACTION: " + act, prompt, count=1, flags=re.M)
            assert n == 1, pid
            if img.startswith("2_참고"):   # m2v(시작 그림을 참고로) — 첫 줄은 「시작 자세」(굽기 시트 지시문 틀, 4번 세션 11-07: 「start from it unchanged」는 그림을 멈춰 두라는 말로 읽힘)
                new, n = re.subn(r"^@이미지 1 is the exact first frame of this video: start from it unchanged — .*$",
                                 "@이미지 1 shows the worker's starting pose, framing and light for this shot — from there he moves naturally and the picture "
                                 "never holds still; he stays the same person in the same work clothes and white hard hat.", new, count=1, flags=re.M)
                assert n == 1, pid
            os.makedirs(d, exist_ok=True)
            shutil.copyfile(os.path.join(DAY, src, img), os.path.join(d, img))
            open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(new)
        boards.append({"순서": k, "id": pid, "편": "p10", "컷": cuts, "폴더": folder, "길이": 4, "비율": "16:9", "소리": sound, "묶음": False, "대안": False,
                       "방식": None, "시험": False, "낱판": [], "쓰는초": [use], "파일": [img], "빠진 파일": [],
                       "지시문 머리": new[:150], "지시문 글자 수": len(new)})
        print(f"{pid}: 4초 · 지시문 {len(new)}자")
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
