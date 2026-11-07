# 오미톡 15초 「치익이 톡이 될 때까지」 편집 전 다시 뽑기 꾸러미(2026-11-07, Claude) — 드리미나 울트라로 낸다(시댄스무제한/드리미나내기.py).
#   python -X utf8 다시_1107_꾸러미.py   → git 밖 pulse-seedance-day-20261028/웹올리기_om2다시_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> om2-3b om2-3b om2-6b om2-6b --받을곳 <받음> --계정 ultra [--실행]
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> om2-끝말b om2-끝말b --받을곳 <받음> --계정 ultra [--실행]   (목소리 판 — 아래)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> om2-3c om2-3c --받을곳 <받음> --계정 ultra [--실행]   (편집본 심사 뒤 — 아래)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> om2-7c om2-6c --받을곳 <받음> --계정 ultra [--실행] 를 두 번(같은 판 두 벌은 차례로)   (Fable 맹검 뒤 — 아래)
#   (같은 id를 두 번 주면 두 벌 — 둘째는 <판>__2.mp4)
# 받은 판 점검(01_새판_기획 10절)에서 걸린 것만 다시 낸다 — 이 편의 무기인 「뜨거운 주황 → 차가운 남색」 대비가 두 컷에서 흐려졌다:
# om2-3b: 받은 om2-3(친구 손이 캔을 놓음)은 대낮(파란 하늘 · 초록 나무, b* +3.9)이라 앞뒤 노을 컷(b* +15~+31) 사이에서 시간이 낮으로 되돌아간다.
#   → 같은 사진의 빛만 해 질 녘 역광으로 고친 시작 그림(GPT 이미지 2.5 편집, 지시문/시작그림_om2-3b_노을_GPT.txt)에 리허설 블렌더 캔 렌더를 다시 얹은 판(시안_합성.py, b* +24).
# om2-6b: 받은 om2-6(식은 코트에 누움)은 밝은 중간 톤(L 37 · b* +4.2)이라 식음 뒤 푸른 저녁(L 24~27 · b* −3~−6) 사이에서 다시 낮처럼 보인다.
#   → 같은 사진의 빛만 푸른 저녁 · 코트 조명으로 고친 시작 그림(지시문/시작그림_om2-6b_푸른저녁_GPT.txt, 1:2로 와서 아래를 지키고 위 아스팔트를 덜어 9:16, b* −8.3).
# 지시문은 받은 판과 같은 글(지시문/영상_시댄스웹.json의 om2-3 · om2-6) — 빛만 바뀌었으니 「첫 장면의 빛을 끝까지」 줄이 새 빛을 지킨다.
import json
import os
import shutil

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기")
OUT = os.path.join(DAY, "웹올리기_om2다시_1107")
NEW = "C:/Users/q1212/Documents/synk-vendor/pulse-rehearsal-20261029/새판/본판_1107"


def prompt_of(folder):
    return open(os.path.join(SRC, folder, "지시문.txt"), encoding="utf-8").read().replace("\r\n", "\n").strip() + "\n"


P3 = prompt_of("141_om2-3")
P6 = prompt_of("144_om2-6")
# om2-끝말b: 받은 om2-끝말(한결 견본 목소리)은 Gemini 3.6 Flash 소리 맹검에서 자연스러움 5 · 감정 4 — 「다섯 가지만 톡」으로 들리고 「읽는 속도와 음높이가
#   너무 일정해 TTS가 무감정하게 읊는 듯」(11-07). 견본 · 그림은 그대로 두고 연기 지시만 고친다: 시원해진 뒤의 만족한 미소, 「맛」의 받침, 「톡」은 기포 터지듯 짧고 또렷하게,
#   줄마다 끝나는 초(현장노트 영상 「시댄스 대사가 초당 3~4자로 늘어지고 …」 — ACTION에 끝나는 초 + PACE 줄).
P_END = prompt_of("146_om2-끝말").replace(
    'ACTION: He lies on his back exactly as in the first frame and, after one slow breath, says calmly in Korean in his own natural voice, with a small satisfied smile: '
    '"다섯 가지 맛, 톡." — a short pause — "오미톡." His lips clearly form the Korean words; nothing else moves.',
    'ACTION: He lies on his back exactly as in the first frame, completely cooled down and content. After one slow, relieved breath out, he says in Korean in his own '
    'natural voice, softly and warmly, with a bright satisfied smile you can hear — every syllable clear, the word 「맛」 fully pronounced with its final consonant: '
    '"다섯 가지 맛," — a tiny pause — then lightly and crisply, like a bubble popping: "톡." — a short pause with a small happy breath — then the brand name, '
    'warm, bright and assured: "오미톡." His lips clearly form the Korean words; nothing else moves.\n'
    'PACE: 「다섯 가지 맛,」 from about 0.6 s to 1.6 s, 「톡.」 at about 1.9 s, 「오미톡.」 from about 2.6 s to 3.2 s — unhurried, about five syllables per second, never flat or monotone.').replace(
    "SOUND: only his own calm voice saying these two Korean lines, over quiet outdoor court ambience",
    "SOUND: only his own warm, smiling voice saying these Korean lines, over quiet evening court ambience")
assert "PACE:" in P_END and "smiling voice" in P_END
# om2-3c: om2-3b__2를 넣은 편집본의 볼 이유 심사(opus, 11-07)가 4초를 가장 약한 자리로 — 「물기 없는 캔 옆에서 불꽃 같은 김이 올라 찬 음료가 오히려 뜨거워 보인다」.
#   노을 역광에서 김이 주황으로 빛나고 캔 뚜껑 위로 피어올랐다(뜨거운 캔처럼 읽힘, Fable 결제 전 검수 「김은 연기 · 불 금지」와 어긋남). 김은 캔 밑 젖은 고리에서만 낮게 · 희게,
#   캔은 찬 물방울이 맺힌 채로. 머리 줄의 「from a hot late afternoon to blue dusk」는 첫 벌이 1.75초부터 저녁으로 바뀐 까닭이라 이 컷만 해 지기 직전으로 둔다.
P3C = P3.replace(
    "from a hot late afternoon to blue dusk, vertical 9:16",
    "on a hot late afternoon just before sunset, vertical 9:16").replace(
    "STEAM: any steam is thin, translucent white water vapour — never smoke, never fire, never flames, never a puddle.",
    "STEAM: any steam is thin, pale, translucent white water vapour that stays white even against the orange backlight — never orange, never glowing, never smoke, never fire, never flames, never a puddle.").replace(
    "Around its base the ring of meltwater on the hot asphalt hisses up into a thin wisp of white steam that rises and thins out.",
    "The can is ice-cold: its surface stays beaded with cold condensation droplets. Only at the very bottom, the thin ring of cold meltwater on the hot asphalt around the can's base "
    "sends up a few faint, low wisps of pale white vapour that hug the ground and fade within a second — the vapour never rises from the can itself, never above its lid and never in front of it.")
assert P3C.count("ice-cold") == 1 and "just before sunset" in P3C and "never orange" in P3C
# 받은 om2-6은 숨(0.8초 지시)이 2.05초에야 나왔다 — 쓰는 2초 안에 들도록 시각을 그대로 두고 「한 번」을 지킨다(글은 같게 둔다)
# om2-6c: 편집본 Fable 맹검(11-07) 「9.0~10.5초 가슴 위 캔은 라벨 없는 무지 남색 캔이라 다른 제품으로 읽힌다 … 라벨 면이 보이게 다시 굽거나 캔을 뺀다」 →
#   부감에서 라벨을 얹을 렌더 각이 없어 캔을 뺀 시작 그림(지시문/시작그림_om2-6c_캔없이_GPT.txt, 1:2로 와서 위 40px만 덜고 9:16). 빛은 이미 푸른 저녁이라 머리 줄도 저녁으로.
P6C = P6.replace("from a hot late afternoon to blue dusk, vertical 9:16", "at blue dusk under the court floodlights, vertical 9:16").replace(
    "one arm behind his head, the opened navy can resting on his chest under his loose hand.", "one arm behind his head, his other hand resting open and relaxed on his chest.").replace(
    " The plain navy side of the can faces up; no label or letters ever appear on it.", " There is no can or bottle anywhere in the frame.")
assert "There is no can" in P6C and "navy can" not in P6C and "blue dusk under" in P6C
# om2-7c: 같은 맹검 「끝 3초가 편에서 가장 조용한 그림 … 레퍼런스 셋은 마지막 칸이 브랜드가 제일 큰 칸」 · 「맑아야 할 마지막 방울이 불투명 검붉은 웅덩이로 끝난다」 →
#   캔을 화면 가운데에 크게 다시 짠 시작 그림(지시문/시작그림_om2-7c_캔가운데_GPT.txt + 리허설 렌더 라벨, 시안_합성.py) · 방울은 자국 없이 스며들고 카메라는 캔으로 다가간다.
P7C = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance.\n"
       "ONE SINGLE CONTINUOUS SHOT of a live-action Korean sparkling-drink commercial on an outdoor public basketball court in Seoul at blue dusk under the court floodlights, "
       "vertical 9:16 — no cuts, no camera switch, in smooth slow motion for the whole shot, no speed ramp, no end card.\n"
       "DRINK: the drink is a clear, sparkling, translucent ruby-pink liquid with fine bubbles, glowing when lit; it soaks straight into the asphalt and never forms a pool, a stain or a dark mark.\n"
       "CAN: the soda can exactly as in the first frame — dark navy and red with its printed label; the printing, logo and letters never change, move, melt or multiply, "
       "the can never changes shape, and no new text appears on it.\n"
       "ACTION: In the lower-left foreground the clear ruby crown of the last drop on the cool wet asphalt rises a little higher and then settles back over the first 1.2 s, "
       "the tiny bead at its centre falling back in; then the liquid sinks straight down into the asphalt and vanishes completely — no stain, no dark mark, no puddle: "
       "that spot ends up looking exactly like the wet, glistening ground around it. There is no steam at all — the air stays perfectly clear. The can in the centre stays "
       "perfectly still, upright and sharp for the whole clip. No new drop falls, nothing enters the frame. The floodlight bokeh glows steadily. "
       "Shot on a high-speed macro camera at 1000 fps, played back slowly.\n"
       "CAMERA: at ground level, a slow, steady push-in straight toward the can — about 12% closer by the last frame, the can staying in the centre of the frame — no pan, no tilt, no shake.\n"
       "LOOK: keep the first frame's light, colors, brightness and white balance to the very end; natural motion blur and real texture, no beauty filter; "
       "no new text, letters or logos appear anywhere — nothing beyond what the first frame already shows; no people.\n"
       "SOUND: silent clip — no dialogue, no narration, no music.\n")

# (id, 꾸러미 폴더, [(가져올 곳, 넣을 이름)], 지시문, 길이, 소리, 쓰는초, 컷)
JOBS = [
    ("om2-3b", "001_om2-3b", [(os.path.join(NEW, "om2-3b_라벨.png"), "1_시작.jpg")], P3, 4, None, 1.5, ["3"]),
    ("om2-6b", "002_om2-6b", [(os.path.join(NEW, "om2-6b_916.png"), "1_시작.jpg")], P6, 4, None, 2.0, ["6"]),
    ("om2-끝말b", "003_om2-끝말b", [(os.path.join(SRC, "146_om2-끝말", f), f) for f in ("1_시작.jpg", "3_목소리견본.mp3")], P_END, 4, "켬", None, ["7"]),
    ("om2-3c", "004_om2-3c", [(os.path.join(NEW, "om2-3c_라벨.png"), "1_시작.jpg")], P3C, 4, None, 1.5, ["3"]),   # 시작 그림: 라벨 합성의 깨끗한 판이 캔 뚜껑 위에 남긴 주황 번짐을 GPT 편집으로 고친 자리만 바꾼 판(지시문/시작그림_om2-3c_번짐고침_GPT.txt)
    ("om2-6c", "005_om2-6c", [(os.path.join(NEW, "om2-6c_916.png"), "1_시작.jpg")], P6C, 4, None, 1.75, ["6"]),
    ("om2-7c", "006_om2-7c", [(os.path.join(NEW, "om2-7c_라벨.png"), "1_시작.jpg")], P7C, 6, None, 4.9, ["7"]),
]


def main():
    from PIL import Image
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, folder, files, prompt, sec, sound, use, cuts) in enumerate(JOBS, 1):
        d = os.path.join(OUT, folder)
        os.makedirs(d, exist_ok=True)
        for src, name in files:
            if not os.path.exists(src):
                raise SystemExit(f"{pid}: {src} 가 없다")
            if not name.endswith(".jpg") or src.endswith(".jpg"):
                shutil.copyfile(src, os.path.join(d, name))   # 견본 소리 · 이미 올린 그림은 그대로
                continue
            im = Image.open(src).convert("RGB")
            if im.size != (1152, 2048):
                raise SystemExit(f"{pid}: {src} 크기 {im.size} — 1152×2048이어야 한다")
            im.save(os.path.join(d, name), quality=93)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
        boards.append({"순서": k, "id": pid, "편": "om2", "컷": cuts, "폴더": folder, "길이": sec, "비율": "9:16", "소리": sound, "묶음": False, "대안": False,
                       "방식": "B" if any(n.endswith(".mp3") for _, n in files) else None, "시험": False, "낱판": [], "쓰는초": [use] if use else None,
                       "파일": [n for _, n in files], "빠진 파일": [], "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
        print(f"{pid}: {sec}초 · 지시문 {len(prompt)}자 · {[n for _, n in files]}")
    json.dump(boards, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT)


if __name__ == "__main__":
    main()
