# 8번 Gemini Flash 「꼭 고칠 것」 두 컷을 하루 몫으로 다시 낸다(2026-11-09, Claude · 유호님 「하루 몫으로 천천히」).
#   python -X utf8 다시_1109_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p8다시_1109/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p8-07e --받을곳 <받음> --계정 ultra --상한 76 [--실행]
#
# 7번(p8-07e) — 받은 두 벌 모두 판 1.25초 뒤 사람이 멈춘다(사람 움직임 0.02~0.07, 문턱 0.12 — 점검표 26). 옛 지시문의 「then she holds that pose, still, until the end」와
#   끝 그림이 그렇게 시켰다. 앉는 동작(판 0.33~1.5초)은 Fable · 낯선 시험관을 넘겼으니 그대로 두고, 앉은 뒤 멎은 장(p8-07d 36장 — 판 1.5초)을 첫 장으로 뒤 토막만 새로 낸다.
#   끝 그림을 넣지 않아(첫 장은 얼굴이 보여 같은 사람이 잠긴다) 끝 자세로 빨려 들어가 멎는 일이 없다. 연기는 원본 7번을 재서 잡았다 — 눈썹이 올라가고(원본 11.08초)
#   시선이 폰에서 빠져 옆으로 간다(원본 11.24초). 우리 판은 창이 화면 왼쪽이고 다음 컷이 길 건너 가게라, 창 쪽을 보면 8번이 소연이 본 것으로 읽힌다(「저 집은 좋겠다」).
#   박자 · 문구는 Fable 사전 검수(11-09 「고치고 굽는다」)대로 — 엄지 스크롤을 빼 손 · 폰 뭉개짐을 막고(동작 넷 → 셋), 받은 판 앞 1.04초에 고개 돌림이 끝나게 0.1초씩 당기고, 고개 30도 안 · 두 눈 보임 · 웃지 않음을 박았다.
# 11번(p8-11e) — 다시_1109_스티커원고.py의 원고를 Gemini로 유리문에 구운 시작 그림(콘티/p8/다시_1109/C11s_pick.jpg — 두 장 중 C11s2, C11s1은 들린 귀퉁이가 「떼」를 가림).
#   Fable 심사 「이대로 굽는다」(읽힘 8 · 글자 9) — 스티커 위 반사 띠가 유리로 안 이어져 띠만 움직이면 「화면 광택」이 되니, 띠는 그대로 두고 문 전체 광택만 함께 바뀌게.
import json
import os
import subprocess

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
GOT = os.path.join(DAY, "받음")
OUT = os.path.join(DAY, "웹올리기_p8다시_1109")
NEW = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/다시_1109"
JOIN = 36   # p8-07d에서 첫 장으로 쓰는 장(판 1.5초 — 흐름이 바닥 값 0.15 안팎으로 내려앉은 자리)

SOYEON = ("SOYEON: the same Korean woman as in the first frame, in every frame — collarbone-length dark brown hair with softly curled ends, a light-blue chambray shirt under a plain "
          "canvas work apron, exactly as in the first frame. She does not speak; her lips part a little but no words come out.")
LOOK = ("LOOK: true-to-life cinematic commercial footage with a shallow depth of field and natural motion blur; keep the first frame's own light, colors, brightness and white balance exactly "
        "to the very end — no new light, no flicker, no color shift. Every printed photo in the scene (on a bag, a window poster, a sticker, a street banner or a wall frame) is a flat print whose "
        "picture never moves or changes. No added text, letters, numbers, logos or captions anywhere; never add a person or an object that is not in the first frame.")
HEAD = "ONE SINGLE CONTINUOUS SHOT of a cinematic live-action Korean app commercial, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card."
P07E = "\n".join([
    "@이미지 1 is the exact first frame of this video: the same framing, same place, same light, colors and white balance, same woman, face, hair and clothes. This first frame is one instant in a living moment — she is already moving on from it.",
    HEAD,
    SOYEON,
    "ACTION: A medium shot from seated eye level in front of the café counter. Soyeon has just sat up and is reading the phone she holds at chest height in both relaxed hands; "
    "from the very first frame her eyes move along the lines on the screen as she reads. At about 0.3 s her eyebrows rise and her eyes widen a little — she has just recognized the face on the screen; she does not smile. "
    "At about 0.5 s her eyes lift off the phone. From 0.6 s to 1.0 s her head turns smoothly about 25 degrees — never more than 30 — toward the big window at the left edge of the frame, which is to her own right: "
    "her eyes lead, her chin comes up a little, her face stays three-quarters to the camera with both eyes visible, and the phone stays at her chest. She is looking out through the window at something out of frame across the street. "
    "From 1.0 s on she keeps looking out, taking it in: she blinks at about 1.5 s, breathes out through slightly parted lips at about 2.0 s so her shoulders settle, "
    "her brows draw together a little wistfully at about 2.6 s, and her gaze drifts slightly along the street at about 3.3 s.",
    "CAMERA: the frame stays exactly where it is from the first frame to the last — the counter, the shelves, the espresso machine and the drinks fridge never shift; no push-in, no zoom, no drift, no shake; only Soyeon moves.",
    LOOK + " Nothing appears or passes outside the window.",
    "SOUND: silent clip — no dialogue, no narration, no music.",
])
# 7번 둘째 벌(p8-07f, 11-10) — 첫 벌 p8-07e는 연기가 지시보다 약 1초 늦게 시작했고(0~1.17초 사람 0.01~0.02), 「폰에서 눈을 뗀다」를 렌즈 보기로 받아
#   1.42~1.92초 카메라를 정면으로 봤고, 2.0초 눈을 굴리듯 돌린 뒤 2.5초에 거의 옆모습까지 돌았다(30도 상한 무시). 잇는 후보 둘 다 끝 1.3초 사람 0.033 · 0.082(원본 0.135)라 안 쓴다.
#   둘째 벌은 눈을 폰에서 떼지 않는 연기 — 원본도 폰을 본 채 눈썹이 오른다 — 를 몸통 · 손이 함께 움직이는 다가감으로 키워 사람 값을 올리고, 늦게 시작하는 버릇은 받은 판에서 창을 뒤로 밀어 고른다.
#   Fable 사전 검수(11-10 「고치고 굽는다」): 축소어(a little · slightly)가 많아 또 0.12 아래로 줄 수 있다 — 손 · 폰에 도착점(가슴 → 턱 아래)을 주고 0.8초 느린 한 동작으로,
#   첫 벌 1.83~2.17초처럼 입이 열려 말하는 얼굴이 되지 않게 입은 첫 장 그대로, 「camera」 낱말 · 고개 기울임(돌림으로 읽힘) · 「eyes widen」(놀란 큰 눈)은 뺐다.
P07F = P07E.replace(P07E[P07E.index("ACTION:"):P07E.index("\nCAMERA:")],
    "ACTION: A medium shot from seated eye level in front of the café counter. Soyeon has just sat down and is reading the phone she holds at chest height in both relaxed hands; "
    "her gaze is locked downward on the phone screen for the whole clip, her face angled down toward the phone in her hands. "
    "At about 0.3 s her eyebrows lift — a flicker of recognition at what she sees on the screen; her eyes stay focused on the screen, her mouth does not change and she does not smile. "
    "From 0.4 s to 1.2 s, in one slow, smooth, unhurried movement, she leans her upper body forward toward the phone and both hands raise the phone from chest height up to just below her chin, "
    "her head dipping toward the screen as it comes up — studying it intently, the phone and her fingers staying sharp and clearly shaped. "
    "At about 1.5 s she draws a breath so her shoulders rise and settle; from then on she keeps leaning in and reading closely, with a slow blink at about 2.6 s and another at about 3.4 s, "
    "her face toward the phone until the end.")
P07F = (P07F.replace(" Nothing appears or passes outside the window.", "")
        .replace("She does not speak; her lips part a little but no words come out.",
                 "She does not speak and does not mouth any words; her lips stay exactly as they are in the first frame.")
        .replace("Every printed photo in the scene (on a bag, a window poster, a sticker, a street banner or a wall frame) is a flat print whose picture never moves or changes.",
                 "Any printed picture already in the scene is a flat print that never moves or changes."))
assert P07F != P07E and "camera" not in P07F[P07F.index("ACTION:"):P07F.index("\nCAMERA:")] and "lips stay exactly" in P07F and "Any printed picture" in P07F

P11E = "\n".join([
    "@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same fridge, bottles and sticker.",
    HEAD,
    "ACTION: Close on the glass door of the drinks fridge beside the counter, a glossy printed sticker stuck on the outside of the glass. The sticker, its photo, its letters "
    "and the reflection streak on it stay exactly as in the first frame — a flat, unchanging print. Behind the glass the bottles stand in soft focus in the cold white light. "
    "The only movement is a very faint, slow change in the overall sheen of the whole door — the glass and the sticker together, never the streak on the sticker alone.",
    "CAMERA: the frame stays exactly where it is from the first frame to the last — the fridge door, the sticker and the bottles never shift; no push-in, no zoom, no drift, no shake; only the faint sheen of the whole door changes.",
    LOOK,
    "SOUND: silent clip — no dialogue, no narration, no music.",
])


def frame_jpg(src, n, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", "-q:v", "1", dst], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    boards = []
    pick = os.path.join(NEW, "C11s_pick.jpg")
    for k, (pid, cut, prompt, use) in enumerate((("p8-07e", "7", P07E, 1.04), ("p8-11e", "11", P11E, 0.67), ("p8-07f", "7", P07F, 1.04)), 1):
        d = os.path.join(OUT, f"{k:03d}_{pid}")
        if pid == "p8-11e" and not os.path.exists(pick):
            print(pid, "시작 그림을 아직 안 골랐다 — 건너뜀")
            continue
        os.makedirs(d, exist_ok=True)
        start = os.path.join(d, "1_시작.jpg")
        if pid in ("p8-07e", "p8-07f"):
            frame_jpg(os.path.join(GOT, "p8-07d.mp4"), JOIN, start)
        else:
            import shutil
            shutil.copyfile(pick, start)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
        boards.append({"순서": k, "id": pid, "편": "p8", "컷": [cut], "폴더": os.path.basename(d), "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
                       "방식": "A", "시험": False, "낱판": [], "쓰는초": [use], "파일": ["1_시작.jpg"], "빠진 파일": [], "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT, [(b["id"], b["지시문 글자 수"]) for b in boards])


if __name__ == "__main__":
    main()
