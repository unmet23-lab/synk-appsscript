# 10번 도담중공업 최종 편집 다시 뽑기 꾸러미(2026-11-07, Claude) — 드리미나 울트라로 낸다(시댄스무제한/드리미나내기.py).
#   python -X utf8 다시_1107_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p10다시_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p10-19c p10-19c … --받을곳 <받음> --계정 ultra [--실행]
#   (같은 id를 두 번 주면 두 벌 — 둘째는 <판>__2.mp4)
# 받은 판 점검(편집전점검.py · 겹친장.py · 장마다 확대, 02_콘티 12절)에서 걸린 것만 다시 낸다:
# p10-19c: 받은 p10-19는 2.75~3.25초에 시작 그림(밝은 흙받이 · 둥근 등)과 참고 그림 R5(검은 흙받이 · 네모 등)가 반투명으로 겹친다(디졸브) — 참고를 옴니로 넣어
#   모델이 두 그림 사이를 섞었다. 앞뒤 번호판 숫자(7743)도 생겼다. → 시작 그림 S19와 같은 흙받이 · 등 · 바퀴로 GPT 이미지 2.5에 끝 그림(E19)을 따로 굽고
#   첫 · 끝 프레임으로(현장노트 브라우저_게시 「카메라를 지시대로 움직이려면 … 첫 · 끝 프레임」).
# p10-24b: 받은 p10-24는 판 내내 멈춘 그림(0.25초 차이 0.12)이라 음악이 가장 크게 차오르는 2.09초가 사진으로 읽힌다 → 고정 카메라는 그대로, 작업자의 숨 · 고개 · 빛줄기의 옅은 연무만.
# p10-11m: 받은 p10-11(바우처 첫 프레임 판)은 4장마다 같은 장(겹친장.py 창 6/6, 움직임 0.48~0.55) → 시작 그림을 참고(m2v)로, 작업자가 라쳇을 짧게 돌리는 움직임.
# p10-12b: 받은 p10-12의 「날개」가 가늘고 휜 쇠 띠라 칼로 읽힌다(슬롭 점검표 21번 「정체가 다르게 읽힘」) → 넓고 비틀린 날개 · 뿌리 덩어리.
# p10-말-준호-3: 끝 문장 「어디서든, 잘 돌아갑니다」 — 화면 글 대신 준호 목소리로(슬롭 점검표 24번 · 곡이 연주곡이라 원본의 노래 한 줄 자리를 말이 받는다).
# p10-말-준호-2b: 받은 판의 「이 아이를 보냅니다」가 0.92초(초당 8.7음절)로 빠르다 — 절정 줄을 느리게 한 판을 견줘 고른다.
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기_여섯편")
OUT = os.path.join(DAY, "웹올리기_p10다시_1107")
E19 = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10/고름/E19.png"   # 굽기_gpt.cjs 다시_1107 판에서 고른 끝 그림
S19B = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10/고름/S19b.png"
S01B = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p10/고름/S01b.png"  # S01의 눈동자만 자연스러운 갈색 + 옅은 도면 반사로 고친 시작 그림(GPT 이미지 2.5 편집)
# p10-01b: 편집본 Fable 1차 「눈동자에 파란 반사만 → 컬러렌즈 · CG 눈처럼 보임」 — 첫 장면이 첫인상이라 눈동자만 고친 시작 그림으로 다시 낸다(지시문도 「눈이 빛나지 않음」).  # E19의 흙받이 자리(1/4 크기)를 잘라 GPT로 같은 구도 그대로 선명하게 다시 그린 시작 그림
# p10-19d: 19c도 1.2~1.9초에 위쪽이 반투명으로 겹쳤다 — S19의 위쪽(크림색 몸통)과 E19의 흡입구가 다른 물건이라 모델이 둘을 섞었다.
#   시작 그림을 끝 그림의 확대판(S19b)으로 바꿔 두 그림이 같은 사진이 되게 했다(현장노트 브라우저_게시 「넓은 사진 한 장에서 첫 · 끝 프레임」).

HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people and animals, faces, hair and clothes.\n"
        "ONE SINGLE CONTINUOUS SHOT of a cinematic, documentary-style brand film for a Korean heavy-industry company that builds gas turbines for power plants, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n")
TURBINE = "TURBINE: the same big power-plant gas turbine in every shot — a long cream-white casing with rows of bolts and a round black bladed intake with a black cone at its front end; no logo, letters or numbers anywhere on it.\n"
CREW = "CREW: every other worker is seen only as hands, a back, a far-away figure or behind a welding helmet or mask, exactly as in the first frame — no other face is ever shown, and nobody turns toward the camera.\n"
LOOK = ("LOOK: a cinematic documentary brand film — real cinema camera, shallow depth of field, fine film grain, natural motion blur, true-to-life textures of steel, sparks and skin. "
        "Each shot keeps its first frame's light — direction, color, white balance and darkness — to the very end; only the light changes written in ACTION may happen. "
        "No new text, letters, numbers, logos or signs anywhere; never add anyone who is neither in the first frame nor written in ACTION; every machine keeps exactly the shape, size and parts it has in the first frame.\n")
VOICE = ("VOICE: @오디오 1 is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, but never play it and never say its words; "
         "perform only the Korean lines written above, the way this moment demands.\n")
JUNHO = "The Korean man in his early forties with short, neat black hair, in a navy zip-up work jacket over a grey T-shirt, looking just past the camera,"

P19C = (HEAD.replace("faces, hair and clothes.\n", "faces, hair and clothes. @이미지 2 is the exact last frame: the camera arrives at exactly that framing at the very end.\n") + TURBINE +
        "ACTION: Close-up of the rear mud flap of a heavy low-bed trailer standing still on a concrete yard: a scuffed, dusty light-grey flap with a small yellow diamond sign that shows only a baby's face, no letters; "
        "big tires on the right and round red tail lights on the left. The camera rises and pulls back in one smooth crane move and reveals what the trailer carries: the huge cream-white gas turbine, strapped down, "
        "its black bladed intake facing the camera — exactly as in the last frame. It is the SAME mud flap, the same sign and the same tail lights from the first frame to the last; they only get smaller and sink toward the bottom of the frame. "
        "Nothing in the scene moves. One real camera move over one real place — no dissolve, no second image fading in.\n"
        "CAMERA: a smooth crane move that rises and pulls back: it starts slowly in the first 0.5 s, speeds up, is fastest between 1.5 s and 2.5 s, keeps moving a little slower until 4.0 s, "
        "then eases to a stop by 4.5 s and holds the last frame's framing to the end. Perfectly smooth, no shake.\n"
        + LOOK +
        "SOUND: a heavy truck's diesel engine idling nearby, low and steady, and one short hiss of air brakes at about 4.6 s — no music, no voices.\n")

P24B = (HEAD + TURBINE + CREW +
        "ACTION: In the dark test cell lined with rows of square sound-absorbing panels, the turbine faces the camera head-on at the end of the long room, its blades completely still. "
        "At the bottom centre a worker in a white hard hat stands with his back to the camera, looking up at the turbine: he takes one slow, deep breath — his shoulders rise and settle — "
        "and at about 1.2 s he tilts his head up a little more toward the turbine; his face is never seen and he never turns around. "
        "A faint haze hangs in the beams of the work lights and drifts very slowly sideways; the reflections on the wet floor shimmer slightly.\n"
        "CAMERA: the frame stays exactly where it is from the first frame to the last — the room and the turbine never shift; no push-in, no zoom, no drift, no shake; only the worker and the haze move.\n"
        + LOOK +
        "SOUND: the deep, quiet hum of a huge empty room and distant ventilation — no music, no voices.\n")

P11M = (HEAD + CREW +
        "ACTION: Low under the curved belly of the turbine casing, which fills the top of the frame: at the bottom, a worker in a white hard hat bends over his work, seen from above and behind — "
        "only the top of his hat and his shoulder show; his face is never seen. He is tightening a bolt with a ratchet wrench: his shoulder and arm move in short, steady strokes and his hard hat nods slightly with each stroke. "
        "The bright hall glows behind.\n"
        "CAMERA: almost still — the frame stays where it is with only a tiny handheld float in place; no push-in, no zoom, no pan.\n"
        + LOOK +
        "SOUND: the dry clicking of a ratchet wrench in short strokes and the low hum of a big factory hall — no music, no voices.\n")

P12B = (HEAD + CREW +
        "ACTION: In a dim workshop full of workbenches under warm work lamps, a worker stands at his bench, seen from behind; his face is never seen. Then a second worker, who has been waiting just outside the right edge of the frame, "
        "walks past close in front of the camera, seen only from the chest down, carrying in both gloved hands a single fan blade for the turbine: a broad, gently twisted airfoil as long as his arm and as wide as two hands, "
        "dark grey with a polished metal leading edge and a thick square root block at its lower end — clearly a heavy machine part, never a thin, sword-like strip of metal. "
        "From about 1.2 s the blade sweeps into the lower half of the frame and fills the middle of the frame by the end, his gloved hands on it. No one appears except the two workers written in ACTION.\n"
        "CAMERA: handheld with a natural shake; from the very first frame the camera tilts down, slowly at first and faster and faster (fastest around 1.5–1.75 s), "
        "so the picture moves up by about 40% of the frame height by 2 s, while the camera also moves in a little (about 12%).\n"
        + LOOK +
        "SOUND: heavy footsteps on a concrete floor and the soft hum of the workshop — no music, no voices.\n")

P_SAY3 = (HEAD +
          f"ACTION: {JUNHO} says the last line of the film in Korean — warm, quiet and assured, a small proud smile in his voice, slowly, with a short pause after the comma: \"어디서든, 잘 돌아갑니다.\" "
          "His lips clearly form the Korean words. Everyone else in the frame keeps still with lips closed.\n"
          "PACE: the line starts at about 0.5 s and is finished by about 2.6 s — about five syllables per second, unhurried, every word said clearly and fully.\n"
          "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.\n"
          + LOOK +
          "SOUND: only his calm narrating voice saying this one Korean line, over quiet room tone — no music, no other voices, no sound effects.\n"
          + VOICE)

P_SAY2B = (HEAD +
           f"ACTION: {JUNHO} says in Korean, quietly and slowly, holding back emotion: first one short word, \"오늘은,\" — then he pauses for about one second and takes a small breath — "
           "then the last line, gently and slowly, letting each word land: \"이 아이를 보냅니다.\" His lips clearly form the Korean words. Everyone else in the frame keeps still with lips closed.\n"
           "PACE: 「오늘은,」 from about 0.5 s to 1.2 s; 「이 아이를 보냅니다.」 from about 2.2 s to 3.9 s — about five syllables per second, unhurried, never rushed.\n"
           "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.\n"
           + LOOK +
           "SOUND: only his calm narrating voice saying these Korean lines, over quiet room tone — no music, no other voices, no sound effects.\n"
           + VOICE)

P01B = (HEAD +
        "JUNHO: the same Korean man in his early forties in every shot — short, neat black hair, no glasses, exactly the face of the first frame; a navy zip-up work jacket over a plain grey T-shirt. "
        "He never speaks: his lips stay closed, and his face stays calm, quiet and serious — no big expressions.\n"
        "ACTION: Extreme close-up of Junho's face from his eyes down to his cheek, lit from below by the cold blue glow of a turbine blueprint on the desk below the frame. "
        "His irises stay natural dark brown the whole time — only a faint reflection of a few thin blue lines shows in his dark pupils; his eyes never glow and never turn blue. "
        "He studies the drawing in silence — his eyes move slowly along it; he blinks once; his lips stay closed.\n"
        "CAMERA: handheld and almost still for the first 1.1 s — only a slow float that slides the picture about 4% of the frame width to the right; then from 1.1 s to 1.6 s the camera tilts up by about 10% of the frame height "
        "(the picture moves down, so his eyes sink toward the lower part of the frame), with no zoom; from 1.6 s it holds still.\n"
        + LOOK +
        "SOUND: a quiet drafting room — the faint hum of a light table, no music, no voices.\n")

# (id, 꾸러미 폴더, [(가져올 곳, 넣을 이름)], 지시문, 길이, 소리, 쓰는초, 컷)
JOBS = [
    ("p10-19c", "001_p10-19c", [(os.path.join(SRC, "013_p10-19", "1_시작.jpg"), "1_시작.jpg"), (E19, "2_끝.jpg")], P19C, 6, "켬", 5.0, ["19"]),
    ("p10-19d", "007_p10-19d", [(S19B, "1_시작.jpg"), (E19, "2_끝.jpg")], P19C.replace(
        "It is the SAME mud flap", "The first frame is simply a close, tight view of the same scene as the last frame — it is the SAME mud flap"), 6, "켬", 5.0, ["19"]),
    ("p10-01b", "008_p10-01b", [(S01B, "1_시작.jpg")], P01B, 4, "켬", 1.63, ["1"]),
    ("p10-24b", "002_p10-24b", [(os.path.join(SRC, "101_p10-24", "1_시작.jpg"), "1_시작.jpg")], P24B, 4, "켬", 2.09, ["24"]),
    ("p10-11m", "003_p10-11m", [(os.path.join(SRC, "134_p10-11", "1_시작.jpg"), "2_참고1_시작.jpg")], P11M, 4, "켬", 1.54, ["11"]),
    ("p10-12b", "004_p10-12b", [(os.path.join(SRC, "092_p10-12", "1_시작.jpg"), "1_시작.jpg")], P12B, 4, "켬", 1.96, ["12"]),
    ("p10-말-준호-3", "005_p10-말-준호-3", [(os.path.join(SRC, "116_p10-말-준호-1", f), f) for f in ("1_시작.jpg", "3_목소리견본.mp3")], P_SAY3, 4, "켬", None, ["37"]),
    ("p10-말-준호-2b", "006_p10-말-준호-2b", [(os.path.join(SRC, "117_p10-말-준호-2", f), f) for f in ("1_시작.jpg", "3_목소리견본.mp3")], P_SAY2B, 5, "켬", None, ["30", "33"]),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, folder, files, prompt, sec, sound, use, cuts) in enumerate(JOBS, 1):
        d = os.path.join(OUT, folder)
        os.makedirs(d, exist_ok=True)
        for src, name in files:
            if not os.path.exists(src):
                raise SystemExit(f"{pid}: {src} 가 없다")
            shutil.copyfile(src, os.path.join(d, name))
        assert "@이미지 2" not in prompt or any(n.startswith("2_끝") for _, n in files)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
        boards.append({"순서": k, "id": pid, "편": "p10", "컷": cuts, "폴더": folder, "길이": sec, "비율": "16:9", "소리": sound, "묶음": False, "대안": False,
                       "방식": "B" if any(n.endswith(".mp3") for _, n in files) else None, "시험": False, "낱판": [], "쓰는초": [use] if use else None,
                       "파일": [n for _, n in files], "빠진 파일": [], "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
        print(f"{pid}: {sec}초 · 지시문 {len(prompt)}자 · {[n for _, n in files]}")
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
