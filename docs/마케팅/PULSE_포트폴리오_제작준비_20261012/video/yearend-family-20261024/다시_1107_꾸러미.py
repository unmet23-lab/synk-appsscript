# 6번 최종 편집 다시 뽑기 꾸러미(2026-11-07, Claude) — 드리미나 울트라로 낸다(시댄스무제한/드리미나내기.py).
#   python -X utf8 다시_1107_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_p6다시_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p6-07b p6-22b --받을곳 <받음> --계정 ultra [--실행]
#   (같은 id를 두 번 주면 두 벌 — 둘째는 <판>__2.mp4)
# p6-07b: 받은 p6-07은 「두 손을 짚고 문 쪽으로 기울인다」를 엎드림으로 읽어 소리치는 장면이 누워 쉬는 장면이 됐다(11-07 Fable 「1:1에서 가장 크게 어긋난 조각」),
#   말도 지시보다 1.4초 늦었다 → 끝까지 똑바로 앉은 채 상체만 문 쪽으로, 줄마다 끝나는 초 · PACE 줄(현장노트 영상 「시댄스가 낸 대사가 초당 3~4자로 늘어지고 …」).
# p6-11b: 11번은 「한 번 날카로운 손짓」을 시켰는데 넓은 화면에서 작게 나와 「무표정한 두 마네킹」(11-07 Fable) → 몸 전체로 받아치고 문을 세게 닫는 연기.
# p6-22b: 22번 끝 얼굴이 「긴장한 얼굴로 끝난다 — 반가움 · 울컥이 안 보인다」(11-07 Fable) → 받은 p6-22의 5.0초 장(고개를 들기 전)을 첫 프레임으로 잇는 4초 판.
#   도어락 번호(편집 57.00초 = 판 0.04초)에 고개를 들고, 「엄마!」(58.73초 = 판 1.77초)에 얼굴이 풀리며 눈가가 젖고 작게 웃는다 — 끝 시간표에 맞춰 판 안 초를 박았다.
#   편집은 p6-22를 120장(5.0초)까지 쓰고 이 판으로 이어 붙인다(첫 프레임 판이라 이음새가 같은 장).
import json
import os
import shutil
import subprocess

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기_여섯편")
OUT = os.path.join(DAY, "웹올리기_p6다시_1107")
JOIN22 = 120   # p6-22를 이 장 앞까지 쓰고, 이 장을 22b 첫 프레임으로

HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people and animals, faces, hair and clothes.\n"
        "ONE SINGLE CONTINUOUS SHOT of a quiet, tender Korean family brand film, shot like a cinematic short film, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.\n")
CAMERA = "CAMERA: the frame stays exactly where it is from the first frame to the last — the door, the walls and the furniture never shift; no push-in, no zoom, no pan, no drift, no shake; only the people move.\n"
LOOK = ("LOOK: a quiet, tender cinematic family film — cinema camera, soft natural light, fine film grain, natural textures, true-to-life colors. Each shot keeps its first frame's light — direction, color, white balance, exposure and darkness — exactly to the very end: no brightening, no flicker. "
        "No new text, letters, numbers, logos or signs anywhere; any poster, photo frame or book keeps exactly the picture it has in the first frame. Never add a person or an animal who is not in the first frame, and nobody looks straight into the lens. "
        "Every object keeps exactly the shape, size and place it has in the first frame unless the ACTION moves it.\n")

P07B = (HEAD +
        "MOM_SUMMER: the same Korean woman in her forties as in the first frame — dark-brown, wavy, shoulder-length hair, a white sleeveless linen top and khaki shorts, barefoot. She is small in the wide frame.\n"
        "ACTION: In the first frame the mother sits on the bamboo mat to the right of the closed door, propped back on one hand, her head turned toward the door. She stays SITTING UPRIGHT on the mat for the whole shot — she never lies down, never goes onto her hands and knees, never leans her chest toward the floor. "
        "By about 0.5 s she sits up straight, her legs folded to one side and one hand on her knee, and turns her upper body toward the closed door; from about 0.7 s to 2.4 s she shouts at the door in Korean, half annoyed, half worried: \"문 잠그고 뭐 해, 또 자?\" — "
        "then, sharper, from about 2.8 s to 4.2 s: \"수능이 코앞이야!\" — her lips clearly forming the Korean words, her shoulders lifting with each call, her hand slapping her knee once on the second line. "
        "After the second line she stays sitting upright, glaring at the shut door and fanning her face with her hand, and says nothing more. The standing fan's blades keep spinning; the door stays shut.\n"
        "PACE: each line in one quick breath, about seven syllables per second, the whole first line finished by 2.4 s and the second by 4.2 s.\n"
        + CAMERA + LOOK +
        "SOUND: only her voice shouting these two Korean lines at the door, over quiet room tone — no fan noise, no insects, no music, no narration, no other voices, no sound effects.\n"
        "VOICE: @오디오 1 is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, but never play it and never say its words; perform only the Korean lines written above, the way this moment demands.\n")

P22B = (HEAD +
        "MOM50: the same Korean woman as in the first frame, in her mid-fifties — a sleek chin-length dark bob with a few grey strands, a pearl stud earring, an oat-beige knit cardigan over a light-blue shirt, a long taupe skirt.\n"
        "BLANKET: the new winter blanket on the single bed, exactly as in the first frame — a thick, plump oatmeal-cream duvet with diamond quilting and thin terracotta piping, its top folded back to show the brick-red underside; no letters, no logo, no label.\n"
        "ACTION: Seen from the hallway through the gap of the half-open bedroom door, the mother sits on the edge of the bed, her head bowed toward the new blanket, her hair half over her face. "
        "At about 0.4 s she hears the front door being unlocked far down the hallway and slowly lifts her head and turns her face toward the open door and the hallway beyond it — the turn is finished by about 1.3 s; she listens, unsure, lips closed. "
        "At about 1.8 s she hears her grown daughter call her from the front door (the daughter is never seen): her tense, listening face melts — her brows soften, her eyes fill with tears that do not fall, and by about 2.4 s the corners of her mouth lift into a small, trembling smile of disbelief and joy — a quiet, held emotion, not a big grin, lips closed or barely parted. "
        "She holds that look toward the hallway, perfectly still, to the last frame. Her eyes stay on the hallway beyond the door, never into the lens. She stays small in the door gap; nobody else appears.\n"
        "CAMERA: the frame stays exactly where it is from the first frame to the last — the hallway walls, the door frame and the half-open door never shift; no push-in, no zoom, no pan, no drift, no shake; only she moves.\n"
        + LOOK +
        "SOUND: silent clip — no dialogue, no narration, no music.\n")


P11B = (HEAD +
        "MOM_VEST: the same Korean woman in her forties as in the first frame — dark-brown, wavy, shoulder-length hair, a mustard knit vest over a white shirt, cream trousers. She is small in the wide frame and mostly turned away from the camera.\n"
        "DAUGHTER24: the young woman standing in the doorway, exactly as in the first frame — early twenties, black hair tied low at the nape, a white blouse and black slacks; small in the frame, seen from across the living room.\n"
        "ACTION: The bedroom door stands open; the mother has just come out of her daughter's room after changing the bedding. In the doorway the daughter, tense and angry, leans forward out of the doorway toward her mother, frowning hard, and from the very start snaps at her in Korean, "
        "jabbing her finger toward her on the last word: \"내일 면접인데, 들어오지 말랬잖아!\" — the whole line finished by 2.0 s, her lips clearly forming the Korean words, her shoulders and whole upper body pushing the words out (big, clear body language — she is small in a wide frame). "
        "At about 2.1 s she grabs the edge of the door, steps back into her room and yanks the door shut hard — it slams fully closed by about 2.8 s, and the dry-cleaning bag hooked over the top of the door swings with it. "
        "The mother flinches back half a step as the daughter snaps, then, as the door slams in front of her, she steps up to the shut door, leans toward it and lifts one open hand in protest, her face turned away from the camera, and stays there. The mother makes no sound in this clip.\n"
        "PACE: the daughter's line in one quick, angry breath, about seven syllables per second.\n"
        + CAMERA + LOOK +
        "SOUND: only the daughter's voice snapping this one Korean line, then the thud of the door slamming and the rustle of the dry-cleaning bag, over quiet room tone — no music, no narration, no other voices; the mother makes no sound.\n"
        "VOICE: @오디오 1 is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, but never play it and never say its words; perform only the Korean line written above, the way this moment demands.\n")

# p6-11c: 11b는 딸 연기는 나아졌는데, 문이 닫힌 뒤(판 3.5~4.2초) 문에 걸린 세탁 비닐이 문을 떠나 공중에 떠다녔다 — 「비닐이 함께 흔들린다」를 시킨 탓.
#   비닐은 문에 납작하게 걸린 채 움직이지 않게 하고, 소리에서도 비닐 바스락을 뺐다. 나머지는 11b 그대로.
P11C = (P11B
        .replace(" — it slams fully closed by about 2.8 s, and the dry-cleaning bag hooked over the top of the door swings with it. ",
                 " — it slams fully closed by about 2.8 s. The dry-cleaning bag stays hooked at the top of the door and hangs flat against it the whole time — it never swings out, lifts off, flies or floats; it simply moves with the door. ")
        .replace("then the thud of the door slamming and the rustle of the dry-cleaning bag, over", "then the thud of the door slamming, over"))
assert P11C.count("hangs flat against it") == 1 and "rustle" not in P11C

# p6-22c: 22b는 웃음이 판 3.3초에 시작해 마지막 장(4.0초)에서야 다 피어, 편 끝에서 웃음에 머무는 시간이 0초였다(11-07 Fable 둘째 판 「꼭 고칠 것」).
#   22b 마지막 장(96장)을 첫 프레임으로 이어 웃음이 머무는 판 — 편집은 21번을 줄인 만큼 이 판 앞 1.4초를 쓴다.
#   시선이 렌즈 왼쪽 2~5°라 「카메라 보고 웃는 모델」로 읽힐 수 있어(Fable), 2초쯤 눈이 복도 왼쪽으로 조금 옮겨 가게 했다.
JOIN22B = 96
P22C = (HEAD +
        "MOM50: the same Korean woman as in the first frame, in her mid-fifties — a sleek chin-length dark bob with a few grey strands, a pearl stud earring, an oat-beige knit cardigan over a light-blue shirt, a long taupe skirt.\n"
        "BLANKET: the new winter blanket on the single bed, exactly as in the first frame — a thick, plump oatmeal-cream duvet with diamond quilting and thin terracotta piping, its top folded back to show the brick-red underside; no letters, no logo, no label.\n"
        "ACTION: Seen from the hallway through the gap of the half-open bedroom door, the mother sits on the edge of the bed with her face turned toward the hallway, already smiling a small, warm, trembling smile with glistening eyes — her grown daughter has just come home and called her from the front door (the daughter is never seen). "
        "She keeps that smile the whole shot. At about 0.6 s she lets out a small breath of relief: her shoulders soften, her smile deepens just a little and her eyes crinkle; a tear catches the light but does not fall. "
        "At about 2.0 s her eyes move slightly to her right, toward the end of the hallway, as if watching her daughter come down it toward the room. She stays seated with her hands on her knees to the last frame — she does not stand up, does not wave, does not speak. "
        "Her eyes stay on the hallway, never straight into the lens. Nobody else appears.\n"
        "CAMERA: the frame stays exactly where it is from the first frame to the last — the hallway walls, the door frame and the half-open door never shift; no push-in, no zoom, no pan, no drift, no shake; only she moves.\n"
        + LOOK +
        "SOUND: silent clip — no dialogue, no narration, no music.\n")


def frame(path, n, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-vf", f"select=eq(n\\,{n})", "-frames:v", "1", "-q:v", "1", out], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    boards = []
    d = os.path.join(OUT, "001_p6-07b")
    os.makedirs(d, exist_ok=True)
    for f in ("1_시작.jpg", "3_목소리견본.mp3"):
        shutil.copyfile(os.path.join(SRC, "069_p6-07", f), os.path.join(d, f))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(P07B)
    boards.append({"순서": 1, "id": "p6-07b", "편": "p6", "컷": ["7"], "폴더": "001_p6-07b", "길이": 6, "비율": "16:9", "소리": "켬", "묶음": False, "대안": False, "방식": "B",
                   "시험": False, "낱판": [], "쓰는초": [5.17], "파일": ["1_시작.jpg", "3_목소리견본.mp3"], "빠진 파일": [], "지시문 머리": P07B[:150], "지시문 글자 수": len(P07B)})
    d = os.path.join(OUT, "002_p6-11b")
    os.makedirs(d, exist_ok=True)
    for f in ("1_시작.jpg", "3_목소리견본.mp3"):
        shutil.copyfile(os.path.join(SRC, "070_p6-11", f), os.path.join(d, f))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(P11B)
    boards.append({"순서": 2, "id": "p6-11b", "편": "p6", "컷": ["11"], "폴더": "002_p6-11b", "길이": 6, "비율": "16:9", "소리": "켬", "묶음": False, "대안": False, "방식": "B",
                   "시험": False, "낱판": [], "쓰는초": [4.17], "파일": ["1_시작.jpg", "3_목소리견본.mp3"], "빠진 파일": [], "지시문 머리": P11B[:150], "지시문 글자 수": len(P11B)})
    d = os.path.join(OUT, "003_p6-22b")
    os.makedirs(d, exist_ok=True)
    frame(os.path.join(DAY, "받음", "p6-22.mp4"), JOIN22, os.path.join(d, "1_시작.jpg"))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(P22B)
    boards.append({"순서": 3, "id": "p6-22b", "편": "p6", "컷": ["22"], "폴더": "003_p6-22b", "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False, "방식": "A",
                   "시험": False, "낱판": [], "쓰는초": [3.04], "파일": ["1_시작.jpg"], "빠진 파일": [], "지시문 머리": P22B[:150], "지시문 글자 수": len(P22B)})
    d = os.path.join(OUT, "004_p6-11c")
    os.makedirs(d, exist_ok=True)
    for f in ("1_시작.jpg", "3_목소리견본.mp3"):
        shutil.copyfile(os.path.join(SRC, "070_p6-11", f), os.path.join(d, f))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(P11C)
    boards.append({"순서": 4, "id": "p6-11c", "편": "p6", "컷": ["11"], "폴더": "004_p6-11c", "길이": 6, "비율": "16:9", "소리": "켬", "묶음": False, "대안": False, "방식": "B",
                   "시험": False, "낱판": [], "쓰는초": [4.17], "파일": ["1_시작.jpg", "3_목소리견본.mp3"], "빠진 파일": [], "지시문 머리": P11C[:150], "지시문 글자 수": len(P11C)})
    d = os.path.join(OUT, "005_p6-22c")
    os.makedirs(d, exist_ok=True)
    frame(os.path.join(DAY, "받음", "p6-22b.mp4"), JOIN22B, os.path.join(d, "1_시작.jpg"))
    open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(P22C)
    boards.append({"순서": 5, "id": "p6-22c", "편": "p6", "컷": ["22"], "폴더": "005_p6-22c", "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False, "대안": False, "방식": "A",
                   "시험": False, "낱판": [], "쓰는초": [1.42], "파일": ["1_시작.jpg"], "빠진 파일": [], "지시문 머리": P22C[:150], "지시문 글자 수": len(P22C)})
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT, [b["id"] for b in boards], [b["지시문 글자 수"] for b in boards])


if __name__ == "__main__":
    main()
