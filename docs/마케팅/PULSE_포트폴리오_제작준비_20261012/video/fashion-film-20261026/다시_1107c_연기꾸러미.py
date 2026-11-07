# 4번 「결채」 15초 판의 굳은 세 컷을 연기 박자 지시문으로 다시 굽는 꾸러미(2026-11-07, Claude · 유호님 「다시 구워」).
#   python -X utf8 다시_1107c_연기꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p4연기_1107/(판 폴더 · _순서.json)
# 왜: 사람움직임.py로 재니 15초 판 허리(p4-24m 64장부터) 0.07 · 붉은 옆얼굴(p4-33-34 샷1) 0.08 · 흙담(샷2) 0.01 — 「카메라만 · 사람 굳음 / 멈춘 화면」.
#   지시문이 그렇게 시켰다 — 24m 「Everything in the picture stays exactly as in the first frame and keeps still」, 33-34 「She stays still」 · 「She stays
#   relaxed and still」 · 「expressionless」(결정 11-07 · 굽기 시트 「지시문 틀」). 새 틀대로 ACTION에 몇 초에 · 어느 몸 부위가 · 얼마나를 쓰고 정지 낱말을 뺀다.
# 허리 컷: 11-07 p4-24가 「hand on her waist · eyes closed · chin raised · reflection · YUNA · OUTFIT」 낱말 조합에서 코드 20114로 다섯 번 막혀(02_콘티 8-1)
#   그 낱말 · 인물 칸 없이 통과한 24m의 짧은 꼴을 따른다. 시작 그림은 유리 겹상이 걷힌 뒤의 24m 90장(15초 판이 쓰는 모습 그대로).
# 셋 다 m2v(시작 그림을 참고로 — 4장 무늬를 덜 낸 길, 02_콘티 8-2). 4초 · 16:9 · 소리 끔.
import json
import os
import shutil
import subprocess

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기")
OUT = os.path.join(DAY, "웹올리기_p4연기_1107")
GOT = os.path.join(DAY, "받음")
M2V = "2_참고1_시작.jpg"

HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same person, face, hair and clothes.\n"
        "ONE SINGLE CONTINUOUS SHOT of a high-end Korean fashion campaign film, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n")
YUNA = ("YUNA: the same young Korean woman as in the first frame, in every frame — long dark-brown wavy hair worn loose with a center part, small gold stud earrings, "
        "long winged eyeliner, rose-coral lips. Her face is calm and neutral but alive — she breathes, blinks and her gaze moves; she does not smile and never speaks.\n")
OUTFIT = ("OUTFIT: her one outfit, exactly as in the first frame and never changing — an ivory wool-gabardine double-breasted long trench coat falling below the knee, with wide notched lapels, "
          "two rows of dark-brown horn buttons and a self-fabric belt at the waist with a fabric-covered buckle; a cream crew-neck fine-knit sweater; matching ivory wide-leg trousers; "
          "brown leather ankle boots with a low block heel. No logos, no labels, no check pattern.\n")
LOOK = ("LOOK: a high-end fashion campaign film — cinema camera, vintage prime lens, fine film grain, gentle lens falloff, natural skin and fabric texture, true-to-life colors. "
        "The shot keeps its first frame's light — direction, color and white balance — to the very end; under the red light the ivory coat keeps exactly the red-tinted color it has in the first frame "
        "and never turns white or neutral. No new text, letters, logos or labels. Never add a person who is not in the first frame.\n")
SILENT = "SOUND: silent clip — no dialogue, no narration, no music."

P24A = (HEAD +
        "ACTION: In the studio, in her ivory trench coat exactly as framed in the first frame, she comes alive: at about 0.3 s she takes a slow breath — her shoulders lift slightly and settle. "
        "From about 0.8 s to 1.6 s she lowers her gaze and turns her head a little toward the camera, until her eyes meet the lens at about 1.7 s. At about 2.3 s she blinks once and her lips soften. "
        "At about 2.8 s her weight shifts a little onto her other leg and her body turns a few degrees toward the camera. All the while a few loose strands of her hair stir and the trench lapel moves gently with her breathing.\n"
        "CAMERA: no shake. The camera creeps in only very slightly, about 2% in all, at an even speed over the whole clip.\n"
        "LOOK: the first frame's light and colour kept to the end. No new text or logos.\n" + SILENT)

P33A = (HEAD + YUNA + OUTFIT +
        "ACTION: Night, in red darkness — Yuna's bowed profile, chest-up, exactly as framed in the first frame: a warm light from the front-left catches her profile and the edges of her hair, "
        "while her clothes and the background fall to black. At about 0.3 s she draws a slow breath, her shoulders rising slightly. From about 0.7 s to 1.6 s she slowly lifts her bowed head a little "
        "and turns her face a few degrees toward the warm light, her lowered eyes opening a little more. At about 1.8 s a loose strand of hair slides forward across her cheek. "
        "At about 2.3 s she blinks, and at about 2.8 s her lips part very slightly as she breathes out.\n"
        "CAMERA: chest-up, no shake — a very slow, even drift in of about 1.5% over the whole clip.\n" + LOOK + SILENT)

P34A = (HEAD + YUNA + OUTFIT +
        "ACTION: Night — Yuna leans one shoulder against the crumbling clay wall lit deep red from the side, framed from the thighs up just left of center as in the first frame, one hand in her coat pocket. "
        "At about 0.3 s she breathes in and her shoulders rise slightly. From about 0.6 s to 1.3 s she shifts her weight along the wall, her free knee bending a little, and the trench hem sways. "
        "At about 1.6 s she tilts her head slightly and her gaze settles on the lens. At about 2.2 s she blinks, and at about 2.7 s she pushes her hand a little deeper into the coat pocket "
        "while a strand of hair stirs across her face.\n"
        "CAMERA: almost no shake — a slow, even drift about 1% to the right over the first second, then a very slow push in of about 1% to the end.\n" + LOOK + SILENT)


# 34b — 첫 판(24a · 34a)을 재니 박자를 써도 m2v는 시작 그림 자세를 붙들어 연기가 늦고 작았다(24a 눈 뜨기 1.7초 지시 → 3초, 34a 사람 0.04 · 0.07).
#   「@이미지 1 is the exact first frame … start from it unchanged — … same person, face, hair and clothes」 첫 줄이 그림을 멈춰 두라는 말로 읽히는지 본다 —
#   같은 그림 · 같은 박자에 첫 줄만 「시작 자세일 뿐 · 그림을 멈춰 두지 말 것」으로, 박자는 0.2초부터 · 더 크게(시댄스는 0.7~1초 늦게 온다).
#   33a 둘째 판이 코드 20115(붉은 어둠 · 입술 · 숨 내쉬기 낱말이 겹친 판)라 입술 · 숨 내쉬기 · 엉덩이 낱말은 쓰지 않는다
HEADB = ("@이미지 1 shows Yuna's starting pose, framing and light for this shot — from there she moves naturally and the picture never holds still; "
         "she stays the same person in the same outfit.\n"
         "ONE SINGLE CONTINUOUS SHOT of a high-end Korean fashion campaign film, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n")
P34B = (HEADB + YUNA + OUTFIT +
        "ACTION: Night — Yuna leans one shoulder against the crumbling clay wall lit deep red from the side, one hand in her coat pocket, and she is clearly alive and moving the whole time. "
        "Right from the start her shoulders visibly rise and fall with her breathing. From about 0.2 s to 1.0 s she shifts her weight along the wall, her free knee bending and her body swaying a little, "
        "so the trench hem visibly swings. From about 1.0 s to 1.8 s she turns her head toward the camera and tilts it, a strand of hair falling across her cheek; her gaze settles on the lens at about 1.8 s "
        "and she blinks. From about 2.2 s to 3.2 s she pushes off the wall a little with her shoulder and straightens, her hand moving deeper into the pocket, then leans back against the wall.\n"
        "CAMERA: almost no shake — a slow, even drift about 1% to the right over the first second, then a very slow push in of about 1% to the end.\n" + LOOK + SILENT)


# 11-08 유호님 「드리미나 세 컷 굽기」 — 아직 굳은 얼굴(A2) · 창가 실루엣(C2) · 옆얼굴(D1)을 34b처럼 「시작 자세」 첫 줄 + 0.2초부터 큰 박자로.
#   옆얼굴은 33a 둘째 판이 코드 20115라 입술 · 숨 내쉬기 · 가슴 낱말을 빼고 「shoulders up」으로
P23C = (HEADB + YUNA + OUTFIT +
        "ACTION: In the studio, a tight close shot as in the first frame — the top of the frame cuts across her forehead — under one warm peach-amber key light from the left, "
        "the right half of her face in deep shadow, one hand resting on the side of her neck at the ivory trench collar. She is clearly alive the whole time: right from the start "
        "her shoulders rise and fall slowly with her breathing. At about 0.2 s her eyes lift from under her brows and settle on the lens. At about 0.8 s she blinks. "
        "From about 1.0 s to 1.8 s she tilts her head a little to the other side and her fingers slide slowly along the collar. At about 2.2 s a loose strand of hair falls across her cheek, "
        "and at about 2.8 s her gaze softens.\n"
        "CAMERA: close shot, no shake — the camera creeps in about 1% at an even speed over the whole clip.\n" + LOOK + SILENT)

P22A = (HEADB + YUNA + OUTFIT +
        "ACTION: Inside the abandoned clay-walled house, Yuna stands in front of a large bright empty window, her body blocking the middle of it; the low sun pours through the window behind her "
        "so she is nearly a dark silhouette with a golden rim on her hair and coat edges, and warm dust drifts in the light. She is alive the whole time: right from the start a warm breeze "
        "through the window lifts the loose strands of her hair and sways the trench hem. At about 0.4 s she shifts her weight onto one leg and her shoulders settle. From about 0.9 s to 1.8 s "
        "she turns her head toward the window and looks out at the golden field, her profile catching the rim light. At about 2.2 s she draws one hand out of her coat pocket and rests it "
        "on the window frame, and at about 3.0 s she turns her head back a little toward the room.\n"
        "CAMERA: full shot, smooth, no shake — the camera pulls back slowly, about 3% over the whole clip, drifting gently to the left.\n" + LOOK + SILENT)

P33B = (HEADB + YUNA + OUTFIT +
        "ACTION: Night, in red darkness — Yuna's bowed profile framed from the shoulders up as in the first frame: a warm light from the front-left catches her profile and the edges of her hair, "
        "while her clothes and the background fall to black. She is alive the whole time: right from the start her shoulders rise and fall slowly. From about 0.3 s to 1.2 s she slowly lifts "
        "her bowed head and turns her face a few degrees toward the warm light. At about 1.4 s a loose strand of hair slides forward across her cheek. At about 2.0 s she blinks and her eyes "
        "move toward the camera, and at about 2.8 s she lowers her gaze again.\n"
        "CAMERA: shoulders-up, no shake — a very slow, even drift in of about 1.5% over the whole clip.\n" + LOOK + SILENT)


def frame_of(pid, n, out):
    """받은 판의 n번째 장을 그림으로(ffmpeg passthrough — 드리미나 파일 머리 60fps와 상관없이 실제 장 순서)"""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(GOT, pid + ".mp4"), "-fps_mode", "passthrough", "-vf", f"select=eq(n\\,{n})",
                    "-frames:v", "1", "-q:v", "2", out], check=True)
    return out


BOARDS = [
    ("p4-24a", {M2V: ("받은 판", "p4-24m", 90)}, P24A),
    ("p4-33a", {M2V: ("그림", os.path.join(SRC, "109_p4-33-34", "1_샷1.jpg"))}, P33A),
    ("p4-34a", {M2V: ("그림", os.path.join(SRC, "109_p4-33-34", "2_샷2.jpg"))}, P34A),
    ("p4-34b", {M2V: ("그림", os.path.join(SRC, "109_p4-33-34", "2_샷2.jpg"))}, P34B),
    ("p4-23c", {M2V: ("그림", "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p4/다시_1107/고름/C23_c.png")}, P23C),
    ("p4-22a", {M2V: ("그림", os.path.join(SRC, "100_p4-22", "1_시작.jpg"))}, P22A),
    ("p4-33b", {M2V: ("그림", os.path.join(SRC, "109_p4-33-34", "1_샷1.jpg"))}, P33B),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = []
    for k, (pid, files, text) in enumerate(BOARDS, 1):
        folder = f"{k:03d}_{pid}"
        d = os.path.join(OUT, folder)
        shutil.rmtree(d, ignore_errors=True)
        os.makedirs(d)
        for name, src in files.items():
            if src[0] == "받은 판":
                frame_of(src[1], src[2], os.path.join(d, name))
            else:
                shutil.copyfile(src[1], os.path.join(d, name))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(text + "\n")
        rows.append({"순서": k, "id": pid, "편": "p4", "컷": [pid[3:5]], "폴더": folder, "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False,
                     "방식": None, "낱판": [], "쓰는초": [], "파일": sorted(files), "빠진 파일": [], "지시문 글자 수": len(text), "판 수": 1})
        print(f"{pid}: {', '.join(sorted(files))} · 지시문 {len(text)}자")
    json.dump(rows, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
