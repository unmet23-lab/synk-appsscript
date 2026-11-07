# 8번 최종 편집 전 점검에서 고칠 판 꾸러미(2026-11-07, Claude) — 드리미나 울트라로 두 벌씩 낸다(시댄스무제한/드리미나내기.py).
#   python -X utf8 다시_1107_꾸러미.py [01c 04c]   → git 밖 pulse-seedance-day-20261028/웹올리기_p8다시_1107/(_순서.json · 판 폴더)
#   python -X utf8 ../../시댄스무제한/드리미나내기.py <꾸러미> p8-07b p8-07b p8-19b p8-19b --받을곳 <받음> --계정 ultra [--실행]
# 점검(받음/_편집전점검/p8_띠_*.jpg · 겹친장.py):
#  · p8-07 · p8-19 — 「4장마다 같은 장」이 움직이는 자리에 걸렸다(07 창 5/6 · 19 창 6/6 — 다시 냄). 같은 시작(· 끝) 그림 · 같은 글로 다시 뽑는다.
#    07은 바로 앉기가 판 1.0~1.5초에 끝나(지시 0.8초) 편집이 판 앞을 잘라 쓰므로, 글은 그대로 두고 「0.6초에 이미 바로 앉음」만 더 박았다.
#  · p8-01 · p8-04 — 가운데 정면 · 평평한 빛 · 민무늬 회청 바탕(11-05 로맨스 「앵글이 맹해」와 같은 짜임) → 다시_1107_그림.py로 빛 한쪽 · 의자에 젖힌 자리 ·
#    먼 바닥 흐림으로 다시 구운 시작 그림(01c · 04c — 고른 판을 START에 적는다). 01c는 콘티 1절 「0.5 · 1.4초 심심한 한숨 · 음」을 시댄스 소리로 받는다
#    (제작 규칙 「소리」 — 말 아닌 소리도 첫 시도는 시댄스 생성본).
import json
import os
import shutil
import sys

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기_여섯편")
OUT = os.path.join(DAY, "웹올리기_p8다시_1107")
NEW = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p8/다시_1107"
START = {"p8-01c": os.path.join(NEW, "C01_pick.jpg"), "p8-04c": os.path.join(NEW, "C04_pick.jpg")}   # 고른 다시 구운 판(돌린 판)


def old(folder):
    return open(os.path.join(SRC, folder, "지시문.txt"), encoding="utf-8").read()


P07 = old("033_p8-07")
P07B = P07.replace("reaching the upright pose by about 0.8 s with the phone held at chest height in both hands, and looks down at the screen;",
                   "already sitting fully upright by about 0.6 s with the phone held at chest height in both hands — the whole rise takes about half a second — and looks down at the screen;")
assert P07B != P07

P19B = old("045_p8-19")

P01 = old("028_p8-01")
P01C = (P01
        .replace("so her face is seen upside down and fills the lower half of the frame, her hair hanging down toward the bottom edge against the plain blue-gray background — only her face, hair, hands, phone and that plain background are in the frame;",
                 "her head tipped back over the top rail of the chair's backrest, so her face is seen upside down and fills the lower half of the frame, her hair hanging down toward the bottom edge; far behind her the café floor is only a soft, dark blur — only her face, hair, hands, phone, the chair rail and that blur are in the frame;")
        .replace(" The soft blue-gray background stays featureless.", " The blurred floor far behind her stays a soft blur.")
        .replace("her upside-down face, the phone and the soft blue-gray background never shift;", "her upside-down face, the phone and the blurred floor behind her never shift;")
        .replace("SOUND: silent clip — no dialogue, no narration, no music.",
                 "SOUND: only the sound of this moment in a quiet, empty café — at about 0.5 s one slow, bored sigh out through her nose, and at about 1.4 s a tiny bored hum \"음…\" with her lips closed; "
                 "a faint fridge hum and a wall clock ticking. No words, no music, no narration, no other voices."))
assert P01C.count("blurred floor") == 2 and "plain blue-gray" not in P01C, P01C

P04 = old("030_p8-04")
P04C = (P04
        .replace("her forearms and the edge of her phone at the top edge.", "her forearms and the edge of her phone at the top edge; far behind her the café floor is only a soft, dark blur.")
        .replace("her face, the phone edge and the soft blue-gray background never shift;", "her face, the phone edge and the blurred floor behind her never shift;"))
assert P04C != P04 and "blue-gray" not in P04C, P04C

# 2차(v1 Fable 맹검 뒤): p8-07c — 7번 「가운데 정면 · 평평한 빛」 → 왼쪽 창빛 한 방향 · 뒤 그늘로 다시 구운 시작 · 끝 그림(C07s · C07e), 글은 07b 그대로.
#   p8-20b — 20번 「끝 3초에 모델이 없다」 → 19번 포스터와 같은 벽(창 모서리)에 하린 포스터를 건 시작 그림(C20p), 글에 포스터가 그대로라는 줄만 더함.
START.update({"p8-07c": os.path.join(NEW, "C07s_pick.jpg"), "p8-07c_끝": os.path.join(NEW, "C07e_pick.jpg"), "p8-20b": os.path.join(NEW, "C20p_pick.jpg")})
P20 = old("046_p8-20")
P20B = P20.replace("The long sun shadows on the wooden floor stay still.",
                   "The long sun shadows on the wooden floor stay still. The framed poster on the wall by the window corner — a printed photo of a young woman laughing with a strawberry latte — stays a flat, still print.")
assert P20B != P20

# 3차: p8-07c 둘째 벌은 빛은 맞았지만 눈을 감은 채 판 0.75~1.9초에 걸쳐 일어나(얼굴을 천장으로 젖힘) 「폰을 보다 일어남」이 아니라 「낮잠에서 깸」으로 읽혔다
#   (첫 벌은 빠르게 일어났지만 4장 무늬). 옛 07b__2는 눈을 뜬 채 0.6초에 일어났다 — 같은 새 빛 그림에 「눈은 늘 폰 화면에, 감지 않음」을 박는다.
START.update({"p8-07d": START["p8-07c"], "p8-07d_끝": START["p8-07c_끝"]})
P07C = P07B.replace("From the first frame she sits up straight in one smooth movement, already sitting fully upright",
                    "From the first frame she sits up straight in one quick, smooth movement, bringing the phone down from above her face to her chest while her eyes stay open "
                    "and fixed on its screen the whole way up — she never closes her eyes, never blinks slowly and never tips her face up toward the ceiling — already sitting fully upright")
assert P07C != P07B

# 4차(v3 Fable 2차 「기각」 뒤, 다시_1107_그림.py P_V4의 시작 그림) — 2 · 5번 자세(의자째 넘어감 → 등받이 위로 머리만), 5번 가방(다리 옆 · 카드와 같은 웃음 사진),
#   11번 스티커(유리문 바깥 · 손바닥만 함), 20번 포스터(화면 높이 약 30%). 5번은 가방이 다리 옆이라 원래 글(0.6초에 다리가 나감)이면 금방 사라져 천천히 걷게 했다.
START.update({k: os.path.join(NEW, f"{c}_pick.jpg") for k, c in (("p8-02b", "C02n"), ("p8-05c", "C05n"), ("p8-11c", "C11n"), ("p8-20c", "C20q"))})
P02B = old("029_p8-02").replace(
    "slumped far back in a wooden chair on the customer side of the counter,",
    "sitting back in a wooden chair on the customer side of the counter — the chair stands on all four legs, her back rests against the backrest and only her head is tipped back over its top —")
P05C = (old("031_p8-05")
        .replace("the walker strides to the right across the frame — the legs leave the frame on the right at about 0.6 s.",
                 "the walker strolls slowly to the right — an easy, unhurried walk, so the legs and the bag are still in the frame at 1.5 s and leave it on the right only at about 2.5 s.")
        .replace("The white paper shopping bag in the walker's trailing hand swings gently along behind, its front — a printed photo of a smiling young woman lying on grass — facing the camera the whole time, and it leaves the frame on the right at about 1.0 s.",
                 "The white paper shopping bag hangs from the walker's hand right beside the walker's leg and swings gently with each step, its front — a printed photo of a smiling young woman with shoulder-length light-brown hair and bangs, in a white T-shirt — facing the camera the whole time.")
        .replace("Behind the glass, Soyeon stays slumped back in her chair with her phone held up, almost still.",
                 "Behind the glass, Soyeon stays sitting back in her chair, her head tipped back over the backrest and her phone held up, almost still."))
P11C = old("037_p8-11").replace("a sticker on the glass shows a printed photo of a smiling young woman;",
                                "a photo sticker stuck on the outside of the glass door shows a smiling young woman, a white die-cut border around it;")
P20C = P20.replace("The long sun shadows on the wooden floor stay still.",
                   "The long sun shadows on the wooden floor stay still. The large framed poster on the wall near the window — a printed photo of a young woman laughing with a strawberry latte — stays a flat, still print.")
for a_, b_ in ((P02B, "029_p8-02"), (P05C, "031_p8-05"), (P11C, "037_p8-11"), (P20C, "046_p8-20")):
    assert a_ != old(b_), b_
assert P05C.count("slowly") >= 1 and "lying on grass" not in P05C and "slumped" not in P05C

BOARDS = [
    ("p8-07b", "7", ["1_시작.jpg", "2_끝.jpg"], "033_p8-07", P07B, "끔", 2.47),
    ("p8-19b", "19", ["1_시작.jpg"], "045_p8-19", P19B, "켬", 3.07),
    ("p8-01c", "1", ["1_시작.jpg"], None, P01C, "켬", 1.44),
    ("p8-04c", "4", ["1_시작.jpg"], None, P04C, "끔", 1.83),
    ("p8-07c", "7", ["1_시작.jpg", "2_끝.jpg"], None, P07B, "끔", 2.47),
    ("p8-20b", "20", ["1_시작.jpg"], None, P20B, "끔", 1.71),
    ("p8-07d", "7", ["1_시작.jpg", "2_끝.jpg"], None, P07C, "끔", 2.47),
    ("p8-02b", "2", ["1_시작.jpg"], None, P02B, "끔", 0.97),
    ("p8-05c", "5", ["1_시작.jpg"], None, P05C, "끔", 1.50),
    ("p8-11c", "11", ["1_시작.jpg"], None, P11C, "끔", 0.67),
    ("p8-20c", "20", ["1_시작.jpg"], None, P20C, "끔", 1.71),
]


def main(only):
    os.makedirs(OUT, exist_ok=True)
    boards = []
    for k, (pid, cut, files, src, prompt, snd, use) in enumerate(BOARDS, 1):
        if only and pid.split("-")[1] not in only:
            continue
        d = os.path.join(OUT, f"{k:03d}_{pid}")
        os.makedirs(d, exist_ok=True)
        if src:
            for f in files:
                shutil.copyfile(os.path.join(SRC, src, f), os.path.join(d, f))
        else:
            if not os.path.exists(START[pid]):
                raise SystemExit(f"{pid}: 고른 시작 그림이 없다 — {START[pid]}")
            shutil.copyfile(START[pid], os.path.join(d, "1_시작.jpg"))
            if "2_끝.jpg" in files:
                shutil.copyfile(START[pid + "_끝"], os.path.join(d, "2_끝.jpg"))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(prompt)
        boards.append({"순서": k, "id": pid, "편": "p8", "컷": [cut], "폴더": os.path.basename(d), "길이": 4, "비율": "16:9", "소리": snd, "묶음": False, "대안": False,
                       "방식": "A", "시험": False, "낱판": [], "쓰는초": [use], "파일": files, "빠진 파일": [], "지시문 머리": prompt[:150], "지시문 글자 수": len(prompt)})
    path = os.path.join(OUT, "_순서.json")
    keep = [b for b in (json.load(open(path, encoding="utf-8")) if os.path.exists(path) else []) if b["id"] not in {x["id"] for x in boards}]
    allb = sorted(keep + boards, key=lambda b: b["순서"])
    json.dump(allb, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(OUT, [(b["id"], b["지시문 글자 수"]) for b in allb])


if __name__ == "__main__":
    main(sys.argv[1:])
