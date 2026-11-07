# 11-07 얼굴 시험 꾸러미(Claude) — 최종본 볼 이유 심사가 두 번 3점이었다. 원본은 4 · 9 · 11 · 19 · 27 · 30에서 얼굴로 감정을 싣는데 우리는 그 자리를
# 실루엣으로 바꿨다(02_콘티 정한 것 ①). 유호님 「울림이 있는 컨셉인데 3점이었던 걸 왜 그냥 지나친 거야」 — 원본처럼 얼굴을 두는 두 컷(4 · 30)을 먼저 굽는다.
#   python -X utf8 얼굴시험꾸러미.py s1-04f=C04g1 s1-30f=C30f1   (둘째: s1-15n=C15n? s1-30g=C30g? s1-34s=C34s?)   → git 밖 pulse-seedance-day-20261028/웹올리기_옆집얼굴_1107/
# 시작 그림은 이미지콘티_지시문.py의 C04f* · C30f*(나노바나나, 고정 얼굴 세트 M04)에서 닮음(이미지콘티_닮음.py)과 눈으로 고른다.
# 1_시작.jpg를 첫 프레임으로 고정하는 길(첫 · 끝 프레임)이라 얼굴이 시작 그림에 잠긴다 — 받은 판은 4장마다 같은 장이 되풀이되는지 재고,
# 걸리면 시작 그림을 참고(2_참고1_시작.jpg)로 바꿔 m2v로 다시 낸다(현장노트 브라우저_게시 드리미나 절).
import json
import os
import shutil
import sys

SRC = "C:/Users/q1212/Documents/synk-vendor/pulse-season4-20261025/콘티/xmas-neighbors/받음"
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_옆집얼굴_1107"

HEAD = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white "
        "balance, same people, faces, hair and clothes.")
SHOT = ("ONE SINGLE CONTINUOUS SHOT of a quiet, tender Korean Christmas brand film, shot like a cinematic short film, horizontal 16:9 — no cuts, "
        "no camera switch, no slow motion, no speed ramp, no end card.")
LOOK = ("LOOK: a quiet, tender cinematic Christmas film — cinema camera, soft natural light, fine film grain, gentle lens falloff, natural "
        "textures, true-to-life colors. The shot keeps its first frame's light — direction, color, white balance and darkness — to the very "
        "end; night stays night and dusk stays dusk. No new text, letters, numbers, logos or signs anywhere. Never add a person who is not in "
        "the first frame. Every face stays exactly the same person as in the first frame from the first to the last frame.")
SOUND = "SOUND: silent clip — no dialogue, no narration, no music."

CUTS = {
    "s1-04f": {
        "컷": "4", "쓰는초": 1.16, "길이": 4,
        "설명": "4를 원본처럼 얼굴로 — 502 할머니의 인사에 작게 목례하는 민재, 지친 눈",
        "사람": ("MINJAE: the young Korean man of the first frame — twenty-eight, short black hair with messy straight bangs, a thin dark-navy "
                "zip-up blouson over a light-grey hoodie. Keep his face exactly as in the first frame — the same person, softly lit, in "
                "three-quarter view."),
        "동작": ("ACTION: Late-autumn night, the open-air corridor on the 5th floor of his old apartment block. Close-up, three-quarter view "
                "facing left: the old neighbor at the far end of the corridor (out of frame) has just greeted Minjae. He gives her a small "
                "polite bow of the head — tipping his head forward and down with a tired, faint closed-mouth smile — then lifts it again, and "
                "his tired eyes drift down, a little lonely. Lips closed the whole time."),
        "카메라": ("CAMERA: handheld, following his bowing head: from the start to 1.12 s the camera moves about 5% to the right and about 3% "
                  "down and eases back about 1%, starting slowly and speeding up; light tremble."),
    },
    "s1-30f": {
        "컷": "30", "쓰는초": 2.4, "길이": 4,
        "설명": "30을 원본처럼 알아챈 얼굴로 — 숨이 멎고 눈가가 젖고 떨리는 미소가 번짐",
        "사람": ("MINJAE: the young Korean man of the first frame — twenty-eight, short black hair with messy straight bangs, snowflakes in his "
                "hair, a navy padded jacket and a grey knitted scarf. Keep his face exactly as in the first frame — the same person."),
        "동작": ("ACTION: Christmas Eve, blue dusk, gentle snow, the open-air corridor on the 5th floor. Minjae's face, big and right of center: "
                "he looks up at the newly lit lamp above his door — his breath catches, his eyes glisten with tears he holds back in the warm "
                "light, and a small, trembling smile slowly breaks across his face. Lips closed. He does not cry openly; no tear runs down."),
        "카메라": ("CAMERA: handheld, one slow arc that follows him: from 0.08 s to 2.36 s the camera travels in an arc to the left around him — "
                  "quick at first, slowing to a stop — so that the background behind him sweeps about half the frame width: the snowy "
                  "rooftops slide out to the right and the decorated corridor doors come in from the left, while his face stays in about the "
                  "same place in the frame; along the way it rises a little, eases back about 2.6%, and the picture turns about 7° "
                  "counter-clockwise; light tremble (0.9%). It never cuts."),
    },
    # ── 11-08 둘째 시험(15 · 30 · 34) — 얼굴 판 심사(opus 3 · Fable 3.5)가 짚은 셋 ──
    "s1-15n": {
        "컷": "15", "쓰는초": 1.32, "길이": 4, "방식": "m2v",
        "설명": "15를 원본처럼 모호한 복선으로 — 하린이 빈손으로 점원에게 무언가 묻기만(전구 상자 없음)",
        "사람": ("HARIN: the young Korean woman of the first frame — early twenties, light-brown shoulder-length layered hair worn half-up and "
                "tied with a crimson velvet ribbon bow, an oversized cream cable-knit cardigan. Her face is never seen: it stays hidden exactly "
                "as in the first frame — turned away from the camera — and she never turns her face toward the lens."),
        "동작": ("ACTION: Through his window (blurred window frames and a curtain at both edges), a telephoto view across the street into the "
                "bright convenience store: Harin (from behind, three-quarters — crimson ribbon, cream cardigan) stands at the counter and asks "
                "the clerk something; her hands are empty — no box, no product appears anywhere near her; the clerk answers with a small nod. "
                "She keeps her face turned toward the clerk."),
        "카메라": ("CAMERA: handheld long lens, peeking through the window: from 0 s to 1.16 s the camera tilts down about 4% of the frame "
                  "height at an even speed; light tremble."),
    },
    "s1-30g": {
        "컷": "30", "쓰는초": 2.4, "길이": 4,
        "설명": "30에 「알아채는 박자」 — 멈칫한 얼굴로 시작해 1초 뒤 젖은 눈의 작은 미소로 풀림",
        "사람": ("MINJAE: the young Korean man of the first frame — twenty-eight, short black hair with messy straight bangs, snowflakes in his "
                "hair, a navy padded jacket and a grey knitted scarf. Keep his face exactly as in the first frame — the same person."),
        "동작": ("ACTION: Christmas Eve, blue dusk, gentle snow, the open-air corridor on the 5th floor. Minjae's face, big and right of center: "
                "he looks up at the newly lit lamp above his door — for a beat he is completely still, stunned, his brows lifted a little and "
                "his lips slightly parted; then, from about 1.0 s, his face slowly softens: his eyes glisten a little in the warm light and a "
                "small, moved, closed-mouth smile spreads. No tear runs down. Natural skin, not glossy."),
        "카메라": "",
    },
    "s1-34s": {
        "컷": "34", "쓰는초": 3.0, "길이": 4,
        "설명": "34 하린의 마지막 얼굴에 혼자 짓는 작은 미소 → 창 쪽으로 돌아 입이 안 보인 채 「메리 크리스마스, 옆집」",
        "사람": ("HARIN_FACE: the same young Korean woman as in the first frame — early twenties, light-brown shoulder-length layered hair with "
                "see-through bangs, worn half-up with a crimson velvet ribbon bow, a round soft face, exactly the face of the first frame; an "
                "oversized cream cable-knit cardigan over a white T-shirt. Her lips stay closed; she never speaks."),
        "동작": ("ACTION: Harin's face in the warm light of the desk lamp she has just switched on: a small, private smile, her eyes lowered "
                "toward the lower left as if thinking of someone next door; around 1.0 s the smile deepens for a moment — the corners of her "
                "closed lips lift and her eyes soften. At about 1.4 s, in about half a second, she turns her head toward the window on the "
                "left until the camera sees only the back of her head and her crimson ribbon — her face and lips are no longer visible — and "
                "she holds that pose for the rest of the shot."),
        "카메라": ("CAMERA: handheld, very gentle: from 0.28 s to 3.0 s the camera drifts about 4% to the left and about 1% up and eases back "
                  "about 1.5%, slowing to a stop."),
    },
}
CUTS["s1-30g"]["카메라"] = CUTS["s1-30f"]["카메라"]

# ── 11-08 셋째(9 · 4) — 종이 판 시험(02_콘티 14절)에서 9 알아챔만 Fable 견주기 3 → 4, 4는 30과 다른 사람처럼(opus 두 번 · Fable).
#   유호님 「둘 다 굽기(약 290)」. 9는 두 길 한 벌씩: a = 원본 카메라 그대로 첫 장만 고정, b = 첫 장(C09s1 웃음) · 끝 장(C09n1 알아챔)을 둘 다
#   고정(같은 틀이라 카메라는 떨림만). 4는 30 얼굴에 맞춘 C04h2로 첫 장 고정 두 벌.
#   python -X utf8 얼굴시험꾸러미.py --폴더 웹올리기_옆집얼굴_1108 s1-09a=C09s1 s1-09b=C09s1 s1-04h=C04h2
HARIN9 = ("HARIN: the young Korean woman of the first frame — early twenties, light-brown shoulder-length layered hair with see-through bangs, "
          "worn half-up with a crimson velvet ribbon bow, a round soft face, exactly the face of the first frame; an oversized cream cable-knit "
          "cardigan over a white T-shirt, a can of drink in her hand. Far down the dark corridor at the left, the young man hunched at the next "
          "door stays the same small, out-of-focus figure in the same place.")
ACT9 = ("ACTION: Late-autumn night, Harin at the edge of her open front doorway, the party off the right edge of the frame. From the start to "
        "about 0.4 s she is laughing with her friends toward the right, her shoulders shaking a little with the laugh. At about 0.4 s her eyes "
        "catch the small cold light down the dark corridor; from 0.5 s to 1.0 s she turns her head toward the LEFT edge of the frame as her "
        "laugh fades; from 1.0 s she looks down the corridor at him — a short, quiet glance: her lips close, her eyes soften for a moment, no "
        "big reaction, no pitying face. She breathes and blinks naturally. Far down the corridor the young man keeps scratching at his "
        "keyhole with his key under the trembling phone light, small and out of focus.")
CUTS["s1-09a"] = {
    "컷": "9", "쓰는초": 1.72, "길이": 4,
    "설명": "9 알아챔(카메라 원본) — 파티 쪽으로 웃던 하린이 고개를 돌려 어둠 속 그의 폰 불빛을 힐끗",
    "사람": HARIN9, "동작": ACT9,
    "카메라": ("CAMERA: handheld, following her face: from 0 s to 1.68 s the camera pushes in about 3.3%, moves about 5% to the right and 1% "
              "down, and the picture turns about 2.5° clockwise — quick at first, slowing to a stop; very light tremble."),
}
CUTS["s1-09b"] = {
    "컷": "9", "쓰는초": 1.72, "길이": 4, "끝그림": "C09n1",
    "설명": "9 알아챔(끝 장 고정) — 같은 동작, 끝 장이 C09n1(알아챈 얼굴 · 뒤 어둠 속 그)",
    "사람": HARIN9,
    "동작": ACT9 + " From about 1.2 s to the end she keeps that quiet look, exactly as in the last frame.",
    "카메라": "CAMERA: handheld, the framing stays as in the first and last frames — only a very light, natural handheld tremble.",
}
CUTS["s1-04h"] = {
    "컷": "4", "쓰는초": 1.16, "길이": 4,
    "설명": "4 얼굴을 30에 맞춤 — 지친 목례(C04h2: 앞머리가 눈썹 위 · 둥근 얼굴)",
    "사람": ("MINJAE: the young Korean man of the first frame — twenty-eight, short black hair with messy straight bangs that end above his "
            "eyebrows, a round soft face with full cheeks, a thin dark-navy zip-up blouson over a light-grey hoodie. Keep his face exactly as in "
            "the first frame — the same person, softly lit, in three-quarter view. Natural skin, not glossy."),
    "동작": ("ACTION: Late-autumn night, the open-air corridor on the 5th floor of his old apartment block. Close-up, three-quarter view facing "
            "left: the old neighbor at the far end of the corridor (out of frame) has just greeted Minjae. At about 0.2 s he gives her a small "
            "polite nod — his head dips forward and down a little and comes back up by about 0.8 s; then his tired eyes lower again toward "
            "the phone in his hand and he lets out a quiet breath. A faint, tired courtesy at the corners of his closed mouth that never "
            "becomes a smile. He blinks naturally. Lips closed the whole time."),
    "카메라": CUTS["s1-04f"]["카메라"],
}


def latest(cid):
    names = sorted((n for n in os.listdir(SRC) if n.startswith(cid + "_") and n.endswith(".jpg")),
                   key=lambda n: os.path.getmtime(os.path.join(SRC, n)))
    if not names:
        raise SystemExit(f"받은 그림이 없다: {cid}")
    return os.path.join(SRC, names[-1])


def main():
    args = sys.argv[1:]
    out = OUT
    if "--폴더" in args:   # 셋째부터는 새 폴더에(11-08) — 앞 시험 폴더의 판 · 순서표를 덮지 않게
        k = args.index("--폴더")
        out = os.path.join(os.path.dirname(OUT), args[k + 1])
        del args[k:k + 2]
    pick = dict(a.split("=", 1) for a in args)
    if not pick:
        raise SystemExit("쓰는 법: python -X utf8 얼굴시험꾸러미.py [--폴더 <이름>] s1-04f=C04f1 s1-30f=C30f2")
    os.makedirs(out, exist_ok=True)
    order = []
    for n, (pid, cid) in enumerate(pick.items(), 1):
        c = CUTS[pid]
        d = os.path.join(out, f"{n:03d}_{pid}")
        os.makedirs(d, exist_ok=True)
        src = latest(cid)
        m2v = c.get("방식") == "m2v"   # 얼굴 없는 컷은 4장 겹침이 없는 옴니 길로 — 시작 그림을 참고로(1_로 시작하지 않는 이름)
        name = "2_참고1_시작.jpg" if m2v else "1_시작.jpg"
        shutil.copyfile(src, os.path.join(d, name))
        files, head = [name], HEAD
        if c.get("끝그림"):   # 끝 장도 프레임으로 고정 — 드리미나내기.py는 이름에 「끝」이 든 그림을 끝 프레임으로 올린다
            shutil.copyfile(latest(c["끝그림"]), os.path.join(d, "2_끝.jpg"))
            files.append("2_끝.jpg")
            head = HEAD + " @이미지 2 is the exact last frame of this video."
        text = "\n".join([head, SHOT, c["사람"], c["동작"], c["카메라"], LOOK, SOUND])
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(text)
        order.append({"순서": n, "id": pid, "편": "s1", "컷": [c["컷"]], "폴더": os.path.basename(d), "길이": c["길이"], "비율": "16:9",
                      "소리": "끔", "묶음": False, "대안": False,
                      "방식": "m2v" if m2v else ("첫 · 끝 프레임 고정" if c.get("끝그림") else "첫 프레임 고정(얼굴 잠금)"), "낱판": [],
                      "쓰는초": [c["쓰는초"]], "파일": files, "빠진 파일": [], "판 수": 2, "설명": c["설명"], "시작 그림": os.path.basename(src)})
        print(pid, "←", os.path.basename(src), ("→ " + c["끝그림"]) if c.get("끝그림") else "")
    json.dump(order, open(os.path.join(out, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("꾸러미", out)


if __name__ == "__main__":
    main()
