# 완성 세 편(매진 임박 · 11번 반려동물 · 2번 향수) 최종 편집 검수에서 나온 다시 뽑을 판과 빠져 있던 판(2026-11-03, 유호님 「완성된 편 최종편집해주면서 검수해서
# 다시 뽑아야 할 거 체크해서 인계문 gpt에게 전달하게 만들어줘」).
#   python -X utf8 수정꾸러미_20261103.py   → git 밖 웹올리기_수정20261103/(판 폴더 · 지시문.txt · 순서표.html · _순서.json — 다른 꾸러미와 같은 꼴)
# 첫날 · 둘째 날 꾸러미의 판 · 차례는 건드리지 않는다. 받은 영상은 받음/<판>.mp4(받기 · 재기 도구가 이 꾸러미도 읽는다).
# 화면 밖 말 판의 견본은 p7-목소리-minjae · rs-목소리-taejun을 받아 견본떼기.py로 뗀 뒤에 생긴다 — 그때 이 도구를 다시 돌리면 채워진다(그 전엔 「파일 아직」).
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_s = importlib.util.spec_from_file_location("W", os.path.join(HERE, "웹꾸러미.py"))
W = importlib.util.module_from_spec(_s)
_s.loader.exec_module(W)

DAY = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
OUT = os.path.join(DAY, "웹올리기_수정20261103")
P11 = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p11"
HS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/영상"
MINJAE_VOICE = os.path.join(W.P7_SOUND, "B", "minjae.mp3")
TAEJUN_VOICE = os.path.join(W.RS_SOUND, "B", "taejun.mp3")


def spec(folder):
    return json.load(open(os.path.join(W.VIDEO, folder, "지시문", "영상_시댄스웹.json"), encoding="utf-8"))


P2 = spec("mens-fragrance-20261026")
PET = spec("pet-ad-20261026")


def item(s, key, p, files, **kw):
    return {"id": p["id"], "편": key, "편이름": s["이름"], "컷": p["컷"], "길이": p["길이"], "비율": s["비율"], "소리": kw.pop("소리", "끔"), "설명": p["설명"],
            "파일": files, "지시문": kw.pop("지시문", None) or W.prompt(s, p), "묶음": False, "대안": False, "쓰는초": [x.get("쓰는초") for x in p.get("샷", [])], **kw}


def still(s, name):
    return os.path.join(s["그림"], name)


# ── 다시 뽑기 ────────────────────────────────────────────────────────────────────────────────
# 11번 3: 받은 판은 두 사람이 끝까지 화면 높이 1/25쯤이라 「사람들이 깜짝 놀라요」가 안 읽힌다(콘티는 1/10 → 1/4) — 끝 그림으로 그 크기 · 몸짓을 못 박는다.
p11_03b = {"id": "p11-03b", "컷": ["3"], "길이": 4, "설명": "11번 3 다시 — 해변 롱숏에서 걸어 다가가 두 사람이 화면 1/4까지 커지고, 달려온 개를 보고 몸을 젖히며 물러선다(끝 그림)",
           "샷": [{"그림": "S03.jpg", "끝그림": "다시_20261103/S03_끝.png", "쓰는초": 2.70, "누구": ["DOG"],
                  "동작": "The dog keeps running along the trail toward the two people and reaches them by about 3 s. The moment it arrives, the two people recoil: both stumble one step backward, "
                          "torsos leaning far back, hands thrown up in front of their chests, mouths open in surprise — big, clear body language that reads instantly. "
                          "Their reaction peaks in the last second.",
                  "카메라": "handheld; the operator walks briskly forward along the footprint trail with a natural walking bob, so the two people grow steadily from about one tenth to one quarter "
                           "of the frame height — they must clearly get much bigger. The camera tilts up gradually from the start and faster after 1.5 s; at the end the sky fills the top 40 percent "
                           "of the frame. The horizon is never quite level — its RIGHT end sits a few degrees low (about 5° around 1.5–2 s, 4° at the end)."}]}

# 11번 4: 꺼내 든 조끼가 넓은 남색 사다리 띠 꼴이라 5 · 6 · 7 · 8 · 9 · 10의 조끼(등 가운데 손잡이 둘 · 은빛 줄)와 다른 물건으로 보인다 — 제품이라 맞춘다.
p11_04 = next(p for p in PET["판"] if p["id"] == "p11-04")
p11_04b = {**p11_04, "id": "p11-04b", "설명": "11번 4 다시 — 꺼내 드는 조끼를 다른 컷과 같은 조끼로(참고 그림)",
           "참고말": "@이미지 2 shows the exact life vest to use, worn by the dog — it is a reference for the vest's design only, not a shot and not a framing: "
                   "the vest Minjae lifts out of the box is this same vest, a lemon-yellow padded vest with a thin silver reflective line along its edge, navy trim and two short navy handles "
                   "side by side in the middle of the back. No wide navy bands, ladders or crossing straps across its back.",
           "샷": [{**p11_04["샷"][0]}]}

# 매진 19: 집어 드는 상자가 크림색 뚜껑 상자라 #23의 납작한 분홍 인쇄 상자와 다른 물건이다 — 참고 그림으로 같은 상자에 묶는다.
HS19 = open(os.path.join(DAY, "웹올리기", "023_hs-S19", "지시문.txt"), encoding="utf-8").read()
HS19_OLD = "holding a flat square pastel-pink gift box in his left hand at his side."
assert HS19_OLD in HS19
hs19_txt = HS19.replace(HS19_OLD, "holding the flat pastel-pink printed box from @이미지 2 in his left hand at his side — exactly that box: thin like a large book, salmon-pink, printed all over, "
                                  "no separate lid, no cream or white box.")
hs19_txt = hs19_txt.replace("\n", "\n@이미지 2 is a reference for the box only — not a shot and not a framing.\n", 1)
hs19b = {"id": "hs-S19b", "편": "hs", "편이름": "매진 임박", "컷": ["19"], "길이": 4, "비율": "16:9", "소리": "끔",
         "설명": "매진 19 다시 — 집어 드는 상자를 #23과 같은 납작한 분홍 인쇄 상자로(참고 그림)",
         "파일": [("1_시작.jpg", os.path.join(HS, "시작_v5", "S19.jpg"), "시작"), ("2_참고.jpg", os.path.join(HS, "시작_v5", "_S23_상자.jpg"), "참고")],
         "지시문": hs19_txt, "묶음": False, "대안": False, "쓰는초": [2.04]}

# ── 꾸러미에 없던 판 ─────────────────────────────────────────────────────────────────────────
# 2번 6 · 9 · 10: 시작 그림이 블렌더 모양 + GPT 실사 질감이라 블렌더 렌더로 움직이면 옆 컷과 질감이 갈린다 — 7 · 8번처럼 시댄스로(블렌더 그대로인 2 · 3 · 17 · 18은 렌더).
p2_06 = {"id": "p2-06", "컷": ["6"], "길이": 4, "설명": "2번 6 — 세운 「ㅅ」 얼음의 두 다리가 갈라지는 안쪽 홈 아주 가까이, 5.00초 노래 첫 강세 컷(0.28초 씀)",
         "샷": [{"그림": "받음/S06r_g5.png", "쓰는초": 0.28, "누구": ["ICE SCULPTURE"],
                "동작": "Extremely close on the upright clear-ice sculpture where its two thick legs split apart: the ice does not move or melt, only tiny glints and a few bubbles inside catch the light as the camera moves.",
                "카메라": "a steady push-in at an even pace from the very first frame — about 1.05x in the first 0.3 s and the same pace for the whole shot — while the ice drifts up about 2% of the frame height; no easing, no shake."}]}
p2_09 = {"id": "p2-09", "컷": ["9"], "길이": 4, "설명": "2번 9 — 물 아래 2 mm에 잠긴 은빛 뚜껑, 물결이 「ㅅ」 음각 위로 지나감(0.72초 씀)",
         "샷": [{"그림": "받음/S09r_g6.png", "쓰는초": 0.72, "누구": ["BOTTLE"],
                "동작": "The square brushed-silver cap lies still just under a thin film of clear water; gentle ripples and caustic light slide across the cap's top and over the engraved ㅅ mark from the very first frame. "
                        "The cap and the engraved ㅅ keep exactly their shape and place — never warped, never redrawn.",
                "카메라": "a steady push-in at an even pace to about 1.10x by 0.72 s, turning slowly clockwise about 2.6° over the same time, and the same pace for the whole shot; no easing, no shake."}]}
p2_10 = {"id": "p2-10", "컷": ["10"], "길이": 4, "설명": "2번 10 — 파란 바탕 위 「ㅅ」 얼음 조각, 오른쪽 다리 속 솔가지, 아래 흰 바닥 안개(0.72초 씀)",
         "샷": [{"그림": "받음/S10r_g5.png", "쓰는초": 0.72, "누구": ["ICE SCULPTURE", "PINE"],
                "동작": "The clear-ice sculpture stands still with the pine sprig frozen inside its right leg; low white floor mist drifts slowly around its base and thin beams of light glow behind it. "
                        "The ice and the sprig stay exactly as they are — no melting, no new cracks.",
                "카메라": "a steady push-in at an even pace to about 1.06x by 0.72 s, and the same pace for the whole shot; no easing, no shake."}]}

# 화면 밖 말(결정 10-29 · 11-01 — 출연 배우 목소리는 시댄스 생성본이 첫 시도): 11번 민재 내레이션(콘티의 타입캐스트 자리) · 2번 태준 끝 세 마디(콘티의 범수 자리).
# 줄은 편 02_콘티 글자 그대로. 소리만 쓰고 화면은 안 쓴다.

def line(key, s, pid, pic, who, pos, n, used, act, voice, sample):
    L = [W.first_line(False),
         f"ONE SINGLE CONTINUOUS SHOT of {s['공통']['장르']}, {W.RATIO_EN[s['비율']]} — no cuts, no camera switch, no slow motion, no speed ramp, no end card.",
         f"ACTION: {who}, looking just past the camera, {act} {pos.capitalize()} lips clearly form the Korean words. Everyone else in the frame keeps still with lips closed.",
         "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.",
         s["공통"]["보기"],
         f"SOUND: only {voice} saying these Korean lines, over quiet room tone — no music, no other voices, no sound effects.",
         W.VOICE_LINES]
    return {"id": pid, "편": key, "편이름": s["이름"], "컷": used, "길이": n, "비율": s["비율"], "소리": "켬", "설명": f"화면 밖 말(컷 {' · '.join(used)}) — 소리만 씀",
            "파일": [("1_시작.jpg", still(s, pic), "시작"), ("3_목소리견본.mp3", sample, "목소리 견본")], "지시문": "\n".join(L), "묶음": False, "대안": False, "방식": "B"}


MJ = "The Korean man in the cobalt-blue sleeveless top"
LINES = [
    line("p11", PET, "p11-말-민재-1", "S04.jpg", MJ, "his", 10, ["1", "2", "3", "4"],
         'tells a friend in Korean, warm and proud with a smile in his voice, in one easy flow — a dog owner bragging about his dog, a little chuckle on the word 외계인: '
         '"외계인 닮은 우리 개는 바닷가에서 뛰어노는 걸 제일 좋아해요. 근데 사람들이 보면 깜짝 놀라요. 그래서 올해는 특별한 걸 준비했어요."', "his voice", MINJAE_VOICE),
    line("p11", PET, "p11-말-민재-2", "S04.jpg", MJ, "his", 7, ["4", "5", "6", "7"],
         'says in Korean, bright and excited, showing off a new purchase, in one flow: "첨벙댕 구명조끼! 값도 착하고 튼튼해요. 등에 손잡이가 두 개라 물에서도 번쩍 건져요."', "his voice", MINJAE_VOICE),
    line("p11", PET, "p11-말-민재-3", "S04.jpg", MJ, "his", 7, ["8", "9", "10"],
         'says in Korean, smug and playful, with a smile in his voice, in one flow with a small pause before the last phrase: "올해는 진짜 멋있을 거예요. 아무도 외계인인 줄 모를걸요? … 물놀이 가는 날엔, 첨벙댕."',
         "his voice", MINJAE_VOICE),
    line("p2", P2, "p2-말-태준", "정지컷/S16.png", "The bare-chested Korean man", "his", 6, ["18"],
         'says three short Korean phrases, very low, deep and unhurried, close to the microphone, in a calm luxury-film voice, with a clear silent pause of about a second between them: '
         '"차갑게." … "서리 앉은 솔잎의 향." … "솔서리."', "his low voice", TAEJUN_VOICE),
]

FIRST = [item(PET, "p11", p11_03b, [("1_시작.jpg", still(PET, "S03.jpg"), "시작"), ("2_끝.jpg", os.path.join(P11, "다시_20261103", "S03_끝.png"), "끝")]),
         item(P2, "p2", p2_06, [("1_시작.jpg", still(P2, "받음/S06r_g5.png"), "시작")]),
         item(P2, "p2", p2_09, [("1_시작.jpg", still(P2, "받음/S09r_g6.png"), "시작")]),
         item(P2, "p2", p2_10, [("1_시작.jpg", still(P2, "받음/S10r_g5.png"), "시작")]),
         hs19b,
         item(PET, "p11", p11_04b, [("1_시작.jpg", still(PET, "S04.jpg"), "시작"), ("2_참고.jpg", still(PET, "S08.jpg"), "참고")])]

if __name__ == "__main__":
    missing = W.write_pack(FIRST + LINES, OUT, False)
    print("판", len(FIRST + LINES), "· 빠진 파일(견본은 목소리 판 뒤에 생김):", [os.path.basename(m) for m in missing])
    print(OUT)
