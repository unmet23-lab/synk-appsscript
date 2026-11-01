# 한강2126 재촬영(v40 · v41) — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-11-01).
#   python -X utf8 시댄스지시문.py              → 지시문/영상_시댄스웹.json(굽기 시트의 웹꾸러미.py --한강이 읽는다)
#   python -X utf8 시댄스지시문.py --보기 <판>  → 그 판의 지시문만(글자 수 · 길이)
# 작업본은 git 밖 Videos/한강2126_새판_20261009/재촬영_v40/ — 컷과 쓰는 초는 가편집 8판 시간표(2분 50.6초 · 88칸), 카메라는 04 샷표(1절 층 이동
# 기술 · 2절 생성 단위 · ⑤ 카메라 말투), 동작 · 대사는 03 대본 v40과 05 v41 수정안, 사람 · 마스코트 · 세트 문장은 02 바이블(v41 몸 문장)에서 줄여 왔다
# (시작 그림이 생김새를 쥐므로 영상에서는 정체 · 옷 · 까몽 자리 · 컵 손만 — 바이블 문장을 다 붙이면 웹 칸 실측 3,693자를 넘는다).
# 시작 그림은 시댄스그림.py가 git 밖 재촬영_v40/시댄스/그림/<K>.jpg로 모은 것(3:4 얼굴 열 장은 가편집과 같은 자리로 9:16 자름).
# 길이 = max(4, ⌈쓰는 초 + 0.8⌉)(굽기 시트 「지시문 틀」 — 시댄스가 0.7초쯤 늦게 온다), 여러 샷 판은 첫 컷 = 첫 샷 + 0.7(0.1초 올림),
# 가운데 샷은 쓰는 초 + 0.1, 끝 샷은 + 0.8. 한 판은 8초 안(하루권 상한).
# 짜임은 04 샷표 생성 단위(G)를 따른다 — 한강 장면은 시작 그림 하나에서 하드컷 여럿을 한 번에 뽑는 멀티샷이 승인 방식이다(장부 S08 · S11 · S14 · S15).
# 그래서 시작 그림이 하나인 판(로비 · PATH 헤드셋 · VR 방)은 뒤 샷을 글로만 쓰고(「SHOT k …, new angle:」), 그림이 둘인 판은 굽기 시트의
# 두 샷 꼴 그대로다. 같은 그림에서 이어지는 컷(O2+O3 · O10+O11 · S2a+S2b · L1+L2 · L5~L7 등)은 한 샷으로 이어 찍고 편집에서 자른다.
# 대사(10-19 결정 — 03 대본 3절): 조연 여섯은 v34 목소리 견본(견본만들기.py)을 3_목소리견본.mp3로 넣는 새 방식(B) — 시댄스가 그 결로 연기한다.
#   11-01 저녁 유호님 「지금 여기서 생성하는 목소리가 다 ai같아 …」 → 「사람 목소리 들어가는곳은 왠만하면 전체적으로 … 첫 시도는 시댄스 생성본으로
#   하고 이상할떄에만 대비책」(10-29 제작 규칙 「소리」 그대로): 그(유호님)의 줄도 소리 켬 — 시댄스가 v34 그 목소리 견본으로 그 판에서 연기한 소리가
#   주판이다(「읍!」 · 한숨 · 「모악산 배네치아요」 · 「네.」 · 「잘 부탁드립니다!」 · 새 대사 · 「아니요」). 얼굴 정지컷에 소리 참고를 같이 주면 첫 화면을
#   다시 짠 적이 있어(현장노트 higgsfield · 장부 S15) 얼굴 판마다 소리 끔 「-무음」 판을 대비책으로 두고, 그때만 v34 녹음(새 대사는 hg-말-그)을 얹는다.
#   화면 밖 줄(L3 선생님 · P8 상담사 · F7 면접관 · 대비책 F2)은 매진 「화면 밖 대사 판」 꼴로 그 배역 그림 · 견본에서 소리만 쓴다. 인사 다섯(2C)은 소리 켬 —
#   넷은 견본 없이 시댄스가 그 나라 말로(그 사람들은 이 한 줄뿐), 빨간머리는 2D와 같은 사람이라 그 견본으로. 본뜬 CosyVoice · Gemini TTS는 안 쓴다.
# 굽지 않는 것: 1층 옷 교차 몽타주 S2c~S2e(v20 장면 S2_v19 그대로 — 업스케일/S2_v19_1층_4.92-12.63_1080p.mp4), O8 타이틀 글자(시안1 — 컵 착지
#   1.0초에 후반으로), 층 자막 · 2B 「AI 처리」 숫자 · VR STAGE 글자 · Q 카드, F3 크래시 줌(F1 끝을 후반에서 2.4배 + 움직임 흐림), TAIL 로고 카드.
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
V40 = "C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40"
IMG = V40 + "/시댄스/그림"
SAMPLES = V40 + "/시댄스/견본"
GENRE = "a photoreal live-action deadpan-comedy brand film"
RATIO = "vertical 9:16"
NUM = {1: "ONE", 2: "TWO", 3: "THREE", 4: "FOUR", 5: "FIVE", 6: "SIX"}

WHO = {
    "HIM": ("the same man as in the first frame, exactly as he looks there - an East Asian man in his early thirties with broad shoulders on a "
            "lean, fit frame (flat stomach, visible waist taper, narrow hips, long slim legs); about ten thin, tight cornrows braided straight back "
            "with short loose tails at the nape, never tied; a charcoal-grey cotton work jacket worn open over a plain white crew-neck tee, slim "
            "black trousers, white leather low-top sneakers and a black nylon backpack on both shoulders."),
    "HIM_ROOM": ("the same man as in the first frame, exactly as he looks there - an East Asian man in his early thirties, lean and broad-shouldered, "
                 "about ten thin, tight cornrows braided straight back, a charcoal-grey cotton work jacket worn open over a plain white crew-neck tee, "
                 "no backpack on him."),
    "GLASSES": "his thick black rectangular acetate glasses on his face - thick black rims and temples, exactly one pair.",
    "KKAMONG": ("a fist-sized dark charcoal-brown fluffy felt kitten with two small pointed ears and two round green eyes, hanging on a 10 cm silver "
                "ball chain clipped to the top of his LEFT backpack shoulder strap just below the collarbone - exactly one, never anywhere else "
                "(camera-right when he faces the camera; hidden when he is seen from directly behind)."),
    "KKAMONG_FAR": ("a fist-sized dark charcoal-brown fluffy felt kitten with round green eyes already hangs on a 10 cm silver ball chain on "
                    "his far (left) backpack strap at chest height, half hidden by his body - keep exactly one; nothing hangs on the near strap."),
    "KKAMONG_RACK": ("his black backpack hangs on the coat rack by the door, and KKAMONG - a fist-sized dark charcoal-brown fluffy felt kitten with "
                     "round green eyes - dangles from its shoulder strap on a 10 cm silver ball chain; no other chain."),
    # 11-01 콘티 검수: 오프닝 넷(K00a · K00b · K01b · K03)만 돔 뚜껑, T0(K08)부터 끝까지는 평평한 뚜껑. K01b 커피가 연한 호박색이라 「dark」를 박는다
    "CUP": "his dark iced americano in a clear plastic cup with a flat clear lid, a kraft paper sleeve and a black straw, always in his right hand.",
    "CUP_DOME": ("his dark iced americano in a clear plastic cup with a domed clear lid, a kraft paper sleeve and a black straw, always in his "
                 "right hand."),
    "CUP_SAME": ("his dark iced americano in a clear plastic cup with a flat clear lid, a kraft paper sleeve and a black straw, held in "
                 "exactly the same hand as in the first frame - it never changes hands."),   # K11은 먼 손(왼손)에 들려 있다 — 바이블과 다르지만 K10에서 이어져 보여 그대로
    "CUP_DESK": ("his dark iced americano in a clear plastic cup with a flat clear lid, a kraft paper sleeve and a black straw stands on the "
                 "desk just in front of him."),
    "MARIN": ("the knee-high needle-felted figure of the first frame - a navy felt helmet covering its whole head, two big round yellow felt eyes, "
              "an oatmeal-beige felt body with short stubby arms and legs and a tiny felt crossbody pouch with a tiny white felt daisy and one green "
              "leaf poking out; it stands "
              "and walks on its own two feet with a soft contact shadow, never floats, never flies, never bows; its stubby arms are never longer "
              "than its body; its eyes change colour only when stated."),
    "MARIN_S": "the knee-high felt figure of the first frame with a navy felt helmet and big round yellow eyes; it never floats or flies.",
    "MONGLE_S": "the small round coral wool-felt ghost with two black bead eyes and no mouth.",
    "MONGLE": ("the small round coral wool-felt ghost of the first frame with a wavy stitched hem and two black bead eyes - only two eyes, no "
               "eyebrows, no mouth, ever; its feelings show only through its eyes (they turn into small stars when delighted) and the tilt of its body."),
    "SHARK": ("a person in a full grey great-white-shark costume - grey shark head and body with a white belly, rows of white felt teeth and "
              "side fins for arms - with a human's bare legs in bright blue sneakers."),
    "DIRECTOR": ("a Korean woman in her forties with a silver-grey chin-length bob, a black turtleneck and black trousers; brisk and "
                 "matter-of-fact."),
    "RECEPTIONIST": "a young Korean woman with a short black bob and blunt bangs, a white shirt under a deep-blue felt vest; polite and unbothered.",
    "COLLEAGUE": "a young woman with long wavy copper-red hair and freckles in a cream cable-knit sweater; curious, friendly.",
    "TEACHER": ("a Korean woman in her forties, black hair pulled back, a coral cardigan over a white tee, an eerily wide, fixed, cheerful smile, "
                "wide-open eyes - exactly the face and smile of the first frame, never wider."),
    "COUNSELOR": ("a Korean man in his fifties with neat grey hair and thin glasses, a sage-green cardigan over a white shirt; gentle, "
                  "gracious."),
    "INTERVIEWER": ("a Korean woman in her fifties with short black hair, a charcoal blazer, hands folded on the desk; completely dry - "
                    "exactly the face of the first frame."),
    "MAGPIE": ("one Eurasian magpie - black head and breast, white belly and shoulder patches, white wing panels, a long iridescent blue-green "
               "tail; even against the low sun its feathers stay black and white, never brown, beige or grey."),
    "BUILDING": ("THE SYNK BUILDING, a four-storey building clad in thick white fluffy wool felt, its floor slabs soft and wavy like stacked "
                 "pillows, full-height glass between them, each floor glowing its own colour through the glass (berry, deep blue, coral, warm "
                 "white from the ground up), a dark grey 3D \"synk\" wordmark above the glass entrance and wide granite steps - exactly as in "
                 "@이미지 2."),
    "OFFICE": ("the long bright second-floor office - rows of honey-oak desks with deep-blue felt partitions, tall windows along the river "
               "side, cream walls, pendant lamps, plants, large synk / SHIFT felt letters on the far wall, colleagues of many nationalities, and small "
               "deep-blue felt robot arms the size of desk lamps working at the desks."),
    "SHIP": ("a large white two-deck cruise ship on the Han River hosting a students' river party - a dense crowd with colourful flags on the "
             "top deck and a small white stage at the stern."),
    "LOUNGE": ("THE PATH LOUNGE, calm, with sage-green felt walls and white arched openings, sage sofas and armchairs, people sitting in white "
               "VR headsets, plants and round felt pendant lamps."),
}
LOOK = ("LOOK: photoreal documentary-plate realism, light 35mm film grain, faint halation, natural micro motion blur, wool felt with visible "
        "fibers, skin with pores and no retouching; no teal, no HDR, no added sharpening, no plastic sheen. The first frame's light - its "
        "direction, colour, white balance and time of day - holds to the very end; only light changes written above may happen. No new text, "
        "letters, numbers or logos anywhere; felt \"synk\" signs already in the first frame stay exactly as they are. Never add a person or "
        "creature who is not in the first frame unless ACTION brings them in.")
SILENT = "SOUND: silent clip - no dialogue, no narration, no music."
NATURAL = "casual, like greeting a coworker across the office - an ordinary person's voice, not a voice actor or announcer"
VOICE = ("VOICE: @오디오 1 is a sample of this speaker's own voice from earlier takes - copy its timbre, age, pitch, pace and Korean accent "
         "exactly, but never play the sample itself; perform only the Korean words written above, once, live in this shot, in sync with the "
         "speaker's lips.")
# 견본 배역 → (WHO 키, 소리 줄에 쓸 이름, 대명사) — 파일은 SAMPLES/<배역>.mp3(견본만들기.py)
ROLE = {"director": ("DIRECTOR", "the director", "her"), "receptionist": ("RECEPTIONIST", "the receptionist", "her"),
        "colleague": ("COLLEAGUE", "the red-haired colleague", "her"), "teacher": ("TEACHER", "the teacher", "her"),
        "counselor": ("COUNSELOR", "the counselor", "his"), "interviewer": ("INTERVIEWER", "the interviewer", "her"),
        "him": ("HIM", "his", "his")}

STILL = "the frame stays exactly where it is from the first frame to the last."
HOLD = "the frame stays exactly where it is for the whole shot."   # 여러 샷 판 안의 고정 샷
SWAY = "handheld, with only a breath-like sway in place"


def ceil10(x):
    return math.ceil(round(x * 10, 3)) / 10


def timing(shots):
    t = [s["쓰는초"] for s in shots]
    if len(t) == 1:
        return max(4, math.ceil(round(t[0] + 0.8, 2))), None
    cuts = [ceil10(t[0] + 0.7)]
    for x in t[1:-1]:
        cuts.append(round(cuts[-1] + ceil10(x + 0.1), 2))
    return max(4, math.ceil(round(cuts[-1] + t[-1] + 0.8, 2))), cuts


def S(k, used, who, act, cam, end=None, slow=False):
    s = {"그림": f"{k}.jpg" if k else None, "K": k, "쓰는초": used, "누구": who, "동작": act, "카메라": cam}
    if end:
        s["끝그림"] = f"{end}.jpg"
    if slow:
        s["슬로"] = True
    return s


PANS = []


def pan(pid, cuts, desc, shots, **kw):
    length, cut_at = timing(shots)
    p = {"id": "hg-" + pid, "컷": cuts, "길이": length, "설명": desc, "샷": shots}
    if cut_at:
        p["자르는초"] = cut_at
    p.update(kw)
    assert p["길이"] <= 8, f"{p['id']}: {p['길이']}초 — 하루권 한 판 상한 8초를 넘는다"
    PANS.append(p)
    return p


def alt(src, pid, desc, **change):
    # 대안 판 — 주판을 본떠 칸만 바꾼다(끝 그림 길 · 참고 그림 없이 · 목소리 B · 묶음 낱판)
    p = json.loads(json.dumps(src, ensure_ascii=False))
    p.update({"id": "hg-" + pid, "설명": desc, "대안": True})
    for k, v in change.items():
        if v is None:
            p.pop(k, None)
        else:
            p[k] = v
    PANS.append(p)
    return p


# ── 0. 오프닝(광고처럼 시작 → 어깨빵 → 슬로모션 → 한숨 → 컵 착지 타이틀 → 상어 풍덩 → 마린) ─────────────────────────────
pan("O1", ["O1"], "광고 첫 장면 — 강 경계 난간에 팔을 걸치고 한강을 보며 빨대로 한 모금, 천천히 밀고 들어감(K00a)", [S(
    "K00a", 1.792, ["HIM", "GLASSES", "CUP_DOME"],
    "Like the first shot of a coffee commercial on a clear late-winter morning: he leans with both forearms on the black steel railing of the "
    "riverside promenade, gazing out over the glittering Han River; in the first second he lifts the cup and takes a visible sip through the "
    "black straw, and a light river breeze stirs the loose tails of his cornrows. He stays relaxed and unhurried and never turns his face "
    "toward the camera.",
    "a smooth commercial move: from 0 s to 1.8 s the camera drifts slowly to the right along the railing while pushing in, ending close on "
    "his shoulder and profile; no shake.")])
pan("O1b", ["O1b"], "커피 광고 클로즈업 — 왼쪽 옆얼굴로 한 모금 도중에서 시작, 끝에 컵을 내리고 난간에서 몸을 떼 산책로로 돌아섬(K00b · 3:4 자름 cx 0.52)", [S(
    "K00b", 1.6, ["HIM", "GLASSES", "KKAMONG", "CUP_DOME"],
    "Close-up of his left profile against the blue river, starting mid-sip through the black straw - the ice shifts in the cup and "
    "condensation drops slide down the clear plastic. By about 1.2 s he lowers the cup, pushes off the railing with his free hand and turns "
    "right onto the stone walkway, still looking down at his cup, not ahead. Kkamong swings on its chain.",
    f"85 mm close-up, {SWAY} - no push-in, so the domed lid stays whole in the frame; the camera stays where it is while he turns away - it "
    "never cuts.")],
    메모=["얼굴 컷(3:4 → 9:16, 돔 뚜껑이 안 잘리게 cx 0.52) — 소리 끔. 11-01 콘티 검수: 1.2 → 1.6초(편집에서 O2를 0.3초 줄이거나 전체를 0.4초 늘림)"])
o23 = pan("O2-O3", ["O2", "O3"], "옆에서 본 투샷 — 폰만 보는 상어와 컵을 내려다보며 걷는 그가 가운데서 어깨빵(K01b, 한 샷을 O2 · O3로 자름)", [S(
    "K01b", 2.5, ["HIM", "GLASSES", "KKAMONG", "CUP_DOME", "SHARK"],
    "Side two-shot at shoulder height, the river and the black railing behind them: in the first frame they are already within one step of "
    "each other, both looking down - he at the iced americano in his right hand, the shark at the phone in its fin - and neither ever looks "
    "up. Within the first 0.4 s each takes that last step and they bump shoulder to shoulder, head-on, right in the middle of the frame, with "
    "a hard jolt: his head snaps back and the cup jerks up in his hand. Right after the hit both stagger half a step apart, still not looking "
    "up, and the shot holds on them to the end.",
    "handheld at shoulder height from the side, 50 mm, small constant jitters; at the moment of impact it jolts once with the hit, then "
    "holds.")],
    메모=["11-01 Fable P1: 시작 그림이 어깨가 닿기 직전이라 충돌은 첫 0.4초 안 — 편집에서 O2 1.5초는 O1b 끝(돌아섬) + 이 판 앞 0.4~0.7초로 채운다",
          "그의 「읍!」은 이 판에서 시댄스가 낸 소리를 먼저 쓴다(11-01 저녁) — 얼굴이 바뀌면 대비책 hg-O2-O3-무음 + v34 녹음 01"])
pan("O4", ["O4"], "초고속 슬로모션 — 뒤로 붕 뜬 그, 안경이 떨어지고 컵이 돌고 까몽이 턱까지 튐(K03 시작 · 같은 옆 카메라)", [S(
    "K03", 2.5, ["HIM", "KKAMONG", "SHARK"],
    "The instant after the collision, in extreme high-speed slow motion at about one-tenth of real speed: he hangs in mid-air tipping over "
    "backward to the left, arms flung "
    "up; his thick black glasses float off his face and drift upward, his iced americano tumbles slowly end over end with ice and a few "
    "droplets catching the sun, and Kkamong swings up on its chain toward his chin. Behind him the shark slowly spins away toward the "
    "railing, the phone still in its fin. Everything moves very slowly; nothing lands during the shot.",
    "a high-speed slow-motion camera: the same side camera drops smoothly from chest height to knee height from 0 s to 2.5 s, ending low and "
    "looking up at him as he hangs in the air; no shake.", slow=True)],
    메모=["시작 그림이 O6과 같은 K03 — 슬로 2.5초는 실제로 0.25초쯤이라 O6이 같은 순간에서 다시 이어도 겹침이 거의 안 보인다(편집에서 확인)",
          "편집: O3는 충돌 프레임 직후까지만 쓰고 O4로 붙인다(K03은 이미 30도 기운 순간 — 액션 점프, Fable P3)"])
pan("O5", ["O5"], "공중의 얼굴 극 클로즈업 — 안경이 위로 떠나고 까몽이 턱 앞으로 휙(K02 · 3:4 자름 · 슬로모션)", [S(
    "K02", 0.792, ["HIM", "KKAMONG"],
    "In smooth slow motion: an extreme close-up of his face in mid-air against the pale blue sky and bare branches, almost expressionless - "
    "only faintly surprised, eyes open. His thick black glasses drift slowly upward above his head, the loose tails of his cornrows float, and "
    "Kkamong swings up on its chain right across the front of his chin.",
    "slow-motion 85 mm close-up floating with him: almost still, it drifts in by about 3% over the whole shot; no shake.", slow=True)],
    메모=["얼굴 컷(3:4 → 9:16) — 0.8초만 쓴다(안경 없는 얼굴 위험, 04 샷표 G02)"])
pan("O6", ["O6"], "같은 옆 카메라 — 그는 왼쪽 바닥으로 넘어지고, 상어는 빙글 돌아 난간을 한 지느러미로 잡고 겨우 멈춤(K03)", [S(
    "K03", 1.5, ["HIM", "KKAMONG", "SHARK"],
    "At normal speed: he falls the rest of the way and lands flat on his back on the granite pavers at the left (about 0.5 s); his glasses clatter "
    "down beside him and the cup flies up out of the top of the frame. The shark, still spinning, staggers backward against the railing, grabs "
    "the top rail with one fin and just barely stops itself - it does not go over.",
    "the same side camera, handheld at chest height with small constant jitters; at about 0.5 s, as he hits the ground, it jolts once with the "
    "impact, then holds; it never cuts.")])
o7 = pan("O7", ["O7"], "누운 얼굴 클로즈업 — 눈을 감았다 뜨고 긴 한숨(K04 · 3:4 자름)", [S(
    "K04", 3.5, ["HIM", "KKAMONG"],
    "Close-up from slightly above: he lies flat on his back on the granite pavers, his thick black glasses lying beside his head, no cup. He keeps "
    "still, closes his eyes for about one second, opens them and stares straight up at the sky; then, from about 2.0 s, he lets out one long, "
    "slow, defeated sigh - his chest sinks, his lips part slightly and close again - with no other expression. He keeps lying still to the end.",
    "no push-in: the frame stays where it is with only a breath-like sway, and the glasses beside his head stay fully in the frame to the end.")],
    메모=["얼굴 컷(3:4 → 9:16, 옆 안경이 다 들어오게 cx 0.42) — 한숨 「하아……」는 이 판에서 시댄스가 낸 소리를 먼저 쓴다(11-01 저녁), 얼굴이 바뀌면 "
          "대비책 hg-O7-무음 + v34 녹음 02. 정적 1초 이상 · 한숨 여유 1초(03 대본)"])
pan("O8", ["O8"], "수직 탑뷰 — 대자로 누운 그, 위에서 컵이 떨어져 머리 오른쪽에 똑바로 착지 = 타이틀 히트(K04b)", [S(
    "K04b", 3.0, ["HIM", "KKAMONG"],
    "A straight top-down view: he lies spread-eagle on the granite pavers, perfectly still, staring straight up, his glasses on the paving beside "
    "his head at the left. At about 1.0 s his iced americano drops into the frame from above and lands perfectly upright on the paving right "
    "beside his head on the right side of the frame - one small bounce and it stands still, straw in, not a single drop spilled. He does not "
    "move or react.",
    f"a straight-down overhead shot: {STILL}")],
    메모=["후반: 타이틀 시안1(10-19 유호님 「시안1이 좋아보여」)을 컵 착지 프레임에 맞춰 얹는다 — 몸 가림판은 이 영상 프레임마다 SAM으로 따라감"])
pan("O9a", ["O9a"], "타이틀 뒤 — 상어가 첫 장면의 그를 따라 난간에 멋있게 기대다 머리가 무거워 앞으로 고꾸라짐(K05a)", [S(
    "K05a", 1.583, ["SHARK"],
    "On the riverside promenade, the shark copies his cool lean from the opening shot: it rests both fins on the black railing and leans toward "
    "the river, legs crossed, phone in one fin. Its big heavy shark head keeps tipping it forward, and at about 1.2 s it topples head-first over "
    "the top rail toward the water.",
    "handheld at chest height from the walkway, small constant jitters; from 0 s to 1.6 s it drifts in by about 4%; it never cuts.")])
pan("O9", ["O9"], "풍덩 — 같은 난간 너머 강에 거꾸로 빠진 상어의 파란 운동화가 버둥(K05)", [S(
    "K05", 1.0, ["SHARK"],
    "Looking down past the same railing: the shark has just plunged head-first into the Han River - its bare legs in bright blue sneakers stick "
    "straight up out of the white splash and kick wildly; spray falls back and ripples spread. Nothing else moves.",
    "handheld, looking down over the railing with small constant jitters; from 0 s to 1.0 s it leans in by about 4%.")])
pan("O10-O11", ["O10", "O11"], "그의 시점(바닥) — 안경을 든 마린이 내려다보다 손을 잡아 끌어 올림, 카메라가 함께 일어섬(K06)", [S(
    "K06", 4.292, ["MARIN"],
    "His point of view, lying on his back looking up at the sky through bare branches: Marin peers down at him through his thick black glasses, "
    "holding them in front of its yellow eyes with both stubby hands, and tilts its helmet once, curious (0-2.5 s). At about 2.6 s Marin "
    "tucks the glasses against its chest with one hand and reaches the other stubby felt hand down; his own right hand in a charcoal jacket "
    "sleeve rises from the bottom edge and Marin grips it. From about 3.0 s Marin pulls, and the view rises off the ground until he is standing.",
    "first-person point of view, handheld with small breath-like jitters: from 0 s to 2.5 s it keeps looking up; from about 3.0 s to 4.3 s "
    "it rises steadily, as if he is being pulled up to standing, tilting down toward Marin, who ends small near his feet.")])
pan("O12", ["O12"], "일어선 그에게 마린이 안경을 내밂 — 무표정으로 받아 씀(K07 · 3:4 자름)", [S(
    "K07", 1.5, ["HIM", "KKAMONG", "MARIN"],
    "Low angle: Marin holds his thick black glasses up toward him with both stubby arms; expressionless, he takes them with his right hand "
    "and, in one simple move, puts them on - by about 1.2 s they sit on his nose. His face stays blank.",
    f"low angle from near Marin's height, {SWAY}; from 0 s to 1.5 s it drifts in by about 4%.")],
    메모=["얼굴 컷(3:4 → 9:16) — 소리 끔"])

# ── T0 드론 상승 공개 ──────────────────────────────────────────────────────────────────────────────
t0 = pan("T0", ["T0"], "드론 상승 공개 — 산책로를 걷는 그와 마린 뒤 어깨 높이에서 솟아 앞으로, 흰 펠트 건물이 화면을 채움(K08 시작 · K09 도착 참고)", [S(
    "K08", 3.5, ["HIM", "KKAMONG", "CUP", "MARIN_S", "BUILDING"],
    "From behind: he walks away along the granite riverside path with his iced americano in his right hand (Kkamong hidden from behind), Marin "
    "waddling beside him on his left; they keep walking toward the white felt building at the end of the path, the river on the right.",
    "a drone reveal in one unbroken move, 24 mm: from 0 s to 3.5 s the drone rises from shoulder height behind them, climbing and gliding "
    "forward over their heads - fast at first, then easing - until the SYNK BUILDING fills the frame from above in three-quarter view with the "
    "two of them tiny on the plaza before its steps; then it holds. It never cuts.")],
    참고그림="K09.jpg",
    참고말=("@이미지 2 is a reference only for the framing the drone arrives at by the end and for the exact look of the SYNK BUILDING - it is "
           "not the first frame, not the last frame and not a separate shot."),
    메모=["_참고 그림은 끝 그림이 아님 — 옴니 레퍼런스(참조) 모드로 1_시작 다음에 올리고, 시작 / 끝 프레임 칸의 끝 칸에 넣지 않는다",
          "건물 생김새가 참고와 다르거나 도착 구도가 안 맞으면 대안 hg-T0e(K09를 끝 그림으로 잠금 — 하드컷이 날 수 있음)"])

# ── 1. 로비 · 1층 PULSE ───────────────────────────────────────────────────────────────────────────
pan("S1a-S1d", ["S1a", "S1b", "S1c", "S1d"], "로비 멀티샷 넷 — 와이드 입장 → 안내판 올려다봄 → 펠트 시계 10:14 → 왼쪽 옆 한 모금 · 까몽(K10 하나 + 글, S14 S1 짜임)", [
    S("K10", 1.583, ["HIM", "KKAMONG", "CUP"],
      "Wide: he walks in across the oak floor while Marin (the small navy-helmeted felt figure of the first frame) waddles ahead toward the "
      "tall berry felt arch; the "
      "lobby attendant in a grey cardigan keeps talking on the phone at the oak desk.",
      "handheld wide at chest height, small constant jitters, drifting in by about 3%."),
    S(None, 0.917, [],
      "Low angle behind his right shoulder, face turned away: he glances up at the felt directory - the small felt synk sign, four colour "
      "swatches (berry, deep blue, coral, sage) and the round felt clock.",
      "handheld, tilting up a little with his gaze."),
    S(None, 0.917, [],
      "Insert: the round grey felt wall clock with no numbers; its hands show 10:14 (hour hand just past 10, minute hand just before 3) and the "
      "second hand ticks.",
      HOLD),
    S(None, 1.208, [],
      "From his left side at shoulder height, framed from the nose down (his eyes above the top edge): he turns his head a little to the left "
      "and sips through the black straw, while Kkamong clearly swings on its chain on his left shoulder strap.",
      f"{SWAY}, drifting in slightly."),
], 메모=["시작 그림 하나 + 글 샷 셋(장부 S14 멀티샷) — 둘째 샷부터는 그림 없이 같은 로비의 새 각도. 안 되면 생성기에서 샷을 나눠 다시 만든다"])
pan("S1e-S1f", ["S1e", "S1f"], "로비 멀티샷 셋 — (와이드 닻) → 마린이 베리 아치로 → 그가 아치를 지나 베리 빛 속으로(K10 하나 + 글)", [
    S("K10", 0.8, ["HIM", "KKAMONG", "CUP", "MARIN_S"],
      "Wide, exactly as the first frame: he walks in across the oak floor while Marin waddles ahead toward the tall berry felt arch.",
      "handheld wide at chest height, small constant jitters."),
    S(None, 1.208, [],
      "A low shot at the back of the lobby: Marin waddles on its own two feet through the tall berry felt arch into the warm berry light of the "
      "studio beyond.",
      "handheld at knee height with small jitters, following Marin into the arch."),
    S(None, 1.208, [],
      "From just behind him at shoulder height - his backpack and cornrows, Kkamong hidden: he walks through the tall berry arch into the warm "
      "berry light.",
      "handheld half a step behind him, moving forward with him."),
], 메모=["첫 샷(0.8초)은 둘째 · 셋째 샷의 닻 — 편집은 S1e · S1f만 쓴다(S1a 대신 쓸 수도 있음)"])
pan("S2a-S2b", ["S2a", "S2b"], "1층 와이드 — 감독 「모델분, 늦으셨네요. 이쪽이요.」 → 그가 사이클로라마로, 몽글이 붐을 따라(K11, 한 샷을 S2a · S2b로)", [S(
    "K11", 4.792, ["HIM", "GLASSES", "KKAMONG_FAR", "CUP_SAME", "DIRECTOR", "MONGLE"],
    "Wide in the berry-walled PULSE studio: the director turns to him and, with a brisk wave of her hand toward the white cyclorama, says in "
    "Korean, businesslike: \"모델분, 늦으셨네요. 이쪽이요.\" He says nothing. Right after her line, at about 2.8 s, he walks toward the "
    "cyclorama at the right with his iced americano, expressionless - he keeps the cup in the same hand as he walks; it never changes hands - "
    "and Mongle follows him across the floor with the boom microphone; the crew keeps working.",
    "handheld multicam-style wide at chest height, small constant jitters; from about 2.8 s it pans right with him as he walks, drifting "
    "slightly closer (about 8%).")],
    소리="켬", 목소리견본="director",
    메모=["다음 S2c~S2e(나란히 · 스트로브 → 몽글 움찔 → 옷 교차 몽타주)는 v20 장면 그대로 — 업스케일/S2_v19_1층_4.92-12.63_1080p.mp4(11-01 SeedVR2)"])
pan("S2f", ["S2f"], "로우 앵글 — LED 벽에 방금 찍은 광고 속 그의 거대한 무표정으로 빠른 푸시 인(K12 · 3:4 자름)", [S(
    "K12", 2.0, [],
    "Low angle in the PULSE studio: the huge LED video wall shows the advert just shot - his giant, expressionless face, his glasses and charcoal "
    "coat, an iced americano in his hand - perfectly still like a photograph, the LED pixels shimmering faintly. In front of it the robot-arm "
    "camera rests still.",
    "a fast push-in toward his giant face: from 0 s to 2.0 s the camera physically moves closer by about 30%, quick at first and easing to a stop.")])
pan("G1", ["G1"], "감독 어깨 너머(그는 뒤통수) — 「수고하셨어요. 4층은 저 계단이요.」 베리 문틀의 계단을 가리킴(K13)", [S(
    "K13", 2.5, ["HIM", "DIRECTOR"],
    "Over his shoulder (the back of his head and cornrows, out of focus at the right): the director points toward the berry-framed doorway to "
    "the stairwell at the back and says in Korean, already turning back to her work: \"수고하셨어요. 4층은 저 계단이요.\" He stays still and "
    "says nothing.",
    f"over his shoulder, {SWAY}, drifting in by about 4% over 2.5 s.")],
    소리="켬", 목소리견본="director")

# ── T1 계단 FPV + 크레인 업 → 2층 공개 ────────────────────────────────────────────────────────────────
t1 = pan("T1", ["T1"], "FPV 원테이크 + 크레인 업 — 계단을 오르는 그 → 문에서 머리 위로 솟음 → 높은 각도로 AI가 일하는 2층 전체(K14 시작 · K15 도착 참고)", [S(
    "K14", 6.5, ["HIM", "CUP", "OFFICE", "MARIN_S", "MONGLE_S"],
    "From behind, he climbs the dim wooden stairs between berry felt walls toward the bright open doorway at the top (Kkamong hidden from "
    "behind). At the top he steps through into the bright second-floor office and walks on down the aisle between the deep-blue felt "
    "partitions, where small felt robot arms type and turn pages at the desks while colleagues stretch and sip tea; Marin and Mongle wait near "
    "the lower left.",
    "one unbroken FPV move, 24 mm: from 0 s to 1.5 s it follows him up the stairs at shoulder height; from 1.5 s to 3.5 s, at the doorway, it "
    "rises over his head and flies through into the office; from 3.5 s to 6.5 s it keeps climbing and tilts down into a high angle over the "
    "whole office as he walks down the aisle below - fast at first, easing to a stop on the framing of @이미지 2. The large synk / SHIFT felt "
    "letters on the far wall stay sharp and unchanged; the camera passes through the doorway without the letters filling the frame. It never "
    "cuts.")],
    참고그림="K15.jpg",
    참고말=("@이미지 2 is a reference only for the high-angle framing the camera arrives at by the end and for the look of the office, its felt "
           "robot arms, Marin and Mongle - it is not the first frame, not the last frame and not a separate shot."),
    메모=["_참고 그림은 끝 그림이 아님 — 옴니 레퍼런스(참조) 모드로 올린다",
          "길이 8초(쓰는 6.5초) — 원테이크라 편집에서 자르지 않는다(04 샷표 1절). 도착이 안 맞으면 대안 hg-T1e(K15 끝 그림)"])

# ── 2. 2층 SHIFT ────────────────────────────────────────────────────────────────────────────────
a2 = pan("2A-2B", ["2A", "2B"], "어깨 너머 접수원 「면접이시죠? 14분 늦으셨네요.」 → 하드컷 빈 펠트 화면판(K16 · K16b 두 샷)", [
    S("K16", 2.5, ["HIM", "GLASSES", "CUP", "RECEPTIONIST"],
      "Over his shoulder (the back of his head with cornrows at the left, his iced americano at the bottom): behind the deep-blue felt reception "
      "counter the receptionist looks up at him and says in Korean, politely and without interest: \"면접이시죠? 14분 늦으셨네요.\" He stays "
      "still and says nothing.",
      f"over his shoulder, {SWAY}, drifting in by about 4%."),
    S("K16b", 1.208, [],
      "Insert: the wall-mounted felt screen board - its screen stays plain and blank, with nothing on it; colleagues pass far behind, out of "
      "focus. No one speaks.",
      HOLD),
], 소리="켬", 목소리견본="receptionist", 낱판=["hg-2A", "hg-2B"],
    메모=["두 샷 판 — 옴니 레퍼런스(참조) 모드에서 그림 둘. 안 되면 대안 낱판 hg-2A(소리 켬) · hg-2B", "후반: 화면판에 「AI 처리」 + 올라가는 숫자(1,284 → 1,287)"])
GREET = [   # (K, 쓰는초, 사람, 인사 동작, 인사말, 로봇 팔, 카메라 — 11-01 콘티 검수: 다섯 칸이 모두 눈높이 미디엄이라 카메라로 반복을 푼다)
    ("2C1", "K18e", 1.0, "the Mongolian colleague in a grey sweater, round face and long hair tied high, at her desk",
     "waves at him with both hands and a bright smile", "Сайн байна уу!",
     "beside her, the small deep-blue felt robot arm on her desk keeps writing notes in her notebook by itself.",
     "from the very first frame the camera, slightly above eye level, tilts down toward the felt arm writing in the notebook, arriving within "
     "the first second, then holds with small constant jitters."),
    ("2C2", "K18b", 0.792, "the Vietnamese colleague with round glasses at her desk behind a deep-blue felt partition",
     "waves at him with one hand, smiling", "Xin chào!",
     "the small deep-blue felt robot arm on her desk holds a teacup to her lips for her; her hands never touch the cup.",
     "from the very first frame the camera pushes in quickly toward her over the felt partition, closing about 8% within the first second, "
     "then holds there with small constant jitters."),
    ("2C3", "K18", 1.0, "the Middle-Eastern colleague in a navy cardigan at his desk",
     "raises one hand in greeting, then lays it on his chest, smiling warmly", "السلام عليكم",
     "the small deep-blue felt robot arm on his desk keeps typing on his keyboard by itself.",
     "from the very first frame a quick pan to the left eases into a gentle push-in, both within the first second, then it holds with small "
     "constant jitters."),
    ("2C4", "K18c2", 0.917, "the bearded Russian colleague leaning back in his chair by the window",
     "waves at him with one raised hand", "Здравствуйте!",
     "the small deep-blue felt robot arm on his desk stamps the stack of papers twice, bang bang, by itself.",
     "from the very first frame the camera sinks quickly to desk height so the stamping felt arm looms large in the foreground within the first "
     "second, then holds with small constant jitters."),
    ("2C5", "K18d", 0.917, "the red-haired colleague in a cream cable-knit sweater at her desk",
     "waves at him cheerfully", "你好!",
     "on her desk a small deep-blue felt quadcopter drone sits still on its charging pad.",
     "85 mm: from the very first frame a quick push-in toward her face, closing about 10% within the first second, the drone soft in the "
     "foreground, then it holds."),
]
# 인사말 → (그 나라 말, 소리 줄의 목소리, 대명사, 읽는 법). 11-01 저녁: 소리 켬 — 넷은 견본 없이 시댄스가 그 나라 말로, 빨간머리(2C5)는 2D와 같은
# 사람이라 그 견본(colleague)으로 결만 따른다. 빨간머리만 일부러 그에게 「니하오!」
SPEAK = {"Сайн байна уу!": ("Mongolian", "a young Mongolian woman's natural, bright voice", "her", "sain baina uu"),
         "Xin chào!": ("Vietnamese", "a young Vietnamese woman's natural, warm voice", "her", "sin chow"),
         "السلام عليكم": ("Arabic", "a Middle-Eastern man's natural, warm voice", "his", "as-salamu alaykum"),
         "Здравствуйте!": ("Russian", "a Russian man's natural, hearty voice", "his", "zdravstvuyte"),
         "你好!": ("Mandarin Chinese with a light American accent", "a young American woman's natural, cheerful voice", "her", "nǐ hǎo")}
GREET_VOICE = ("VOICE: @오디오 1 is a sample of this speaker's own voice from earlier takes - copy its timbre, age and pitch exactly, but never "
               "play the sample itself; perform only the greeting written above, once, live in this shot, in sync with the speaker's lips.")
for pid, k, used, who, wave, word, robot, cam in GREET:
    lang, voice, pron, rom = SPEAK[word]
    same = word == "你好!"
    pan(pid, [pid], f"인사 퀵컷 — {word} ({k}, 소리 켬 · 시댄스가 그 나라 말로{' · 2D와 같은 빨간머리 견본' if same else ''})", [S(
        k, used, ["COLLEAGUE"] if same else [],
        f"In the bright SHIFT office, {who} {wave} and, right at the start (by about 0.2 s), says the greeting aloud once in {lang}: "
        f"\"{word}\" ({rom}) - {pron} lips clearly forming the words; {robot} Everyone else keeps working.",
        cam)],
        소리="켬", 소리줄=f"SOUND: only {pron} voice saying \"{word}\" once in {lang} - {voice}, {NATURAL} - over quiet office room tone; "
        "no music, no narration, no other voices.",
        **({"목소리견본": "colleague", "목소리줄": GREET_VOICE} if same else {}),
        메모=["인사 소리는 시댄스가 이 판에서 낸 목소리를 쓴다(11-01 저녁 유호님 — Gemini TTS는 「ai같아」). 발음이 틀리면 다시 뽑는다(몽골어 · "
              "베트남어는 시험에서 먼저)"])
pan("2D", ["2D"], "자기 책상의 빨간머리가 몸을 내밀어 그의 컵을 빤히 — 「음.. 커피 어디서 샀어요?」 → 그가 돌아봄(K19)", [S(
    "K19", 3.208, ["HIM", "KKAMONG", "CUP_SAME", "COLLEAGUE"],
    "At her own desk, the red-haired colleague leans out of her chair toward him and stares at the iced americano he holds up between them, sniffs the "
    "air and asks in Korean, curious and friendly: \"음.. 커피 어디서 샀어요?\" At about 2.6 s he slowly turns his head toward her - we see him "
    "from behind and the side, his face stays mostly turned away - and says nothing. They never touch.",
    "handheld at desk height, small breath-like sway, drifting in by about 5% over 3.2 s.")],
    소리="켬", 목소리견본="colleague")
e2 = pan("2E", ["2E"], "그 정면 미디엄 — 무표정 「…모악산 배네치아요.」 → 초점이 뒤 접수대 위 마린으로(K20 · 3:4 자름)", [S(
    "K20", 1.792, ["HIM", "GLASSES", "KKAMONG", "CUP", "MARIN_S"],
    "Front medium shot in the bright office: he stands still, completely expressionless; after a short pause (at about 0.6 s) he silently "
    "mouths the Korean words, flat and expressionless, his lips moving clearly but only a little (no sound is recorded): \"…모악산 배네치아요.\" "
    "Then the focus racks from him to Marin standing on the reception counter "
    "behind him, which comes sharp while he softens.",
    "85 mm, handheld with only a breath-like sway, drifting in by about 3%; the rack focus to Marin runs from about 1.4 s to 1.8 s.")],
    메모=["얼굴 컷 — 첫 시도는 이 판에서 시댄스가 v34 그 목소리 견본으로 낸 목소리(11-01 저녁). 얼굴 정지컷 + 소리 참고는 첫 화면을 다시 짠 적이 "
          "있다(장부 S15) — 재기 첫 장 · 얼굴 닮음부터 보고, 바뀌면 대비책 hg-2E-무음 + v34 녹음 09"])
pan("2F", ["2F"], "접수대 위 종이컵 옆 마린 — 그의 대답에 고개를 갸웃(K21)", [S(
    "K21", 1.0, ["MARIN"],
    "Marin, standing on the deep-blue felt reception counter beside a white paper cup, reacts to his answer by tilting its whole helmet to one "
    "side, puzzled; behind it the receptionist keeps working, out of focus.",
    "handheld at counter height, breath-like sway, drifting in by about 5%.")])
pan("2G", ["2G"], "접수원이 위를 가리킴 「4층이에요. 계속 올라가세요.」 → 그가 끄덕 → 걸어 나감(K22, 끝에 뱃고동은 후반)", [S(
    "K22", 3.792, ["HIM", "GLASSES", "CUP_SAME", "RECEPTIONIST"],
    "Over his shoulder: the receptionist points one finger up at the ceiling and says in Korean, politely: \"4층이에요. 계속 올라가세요.\" He "
    "gives one small nod (about 2.2 s), says nothing, and walks off out of the frame by about 3.5 s; she goes back to her screen.",
    f"over his shoulder, {SWAY}; it stays in place as he walks out of the frame.")],
    소리="켬", 목소리견본="receptionist")

# ── T2 뱃고동 → 유리 플레어 → 강으로 다이브 → 갑판 → 구조된 상어 → 3층 띠 창 → 계단 ──────────────────────────────
pan("T2a1", ["T2a"], "창 앞을 지나는 그를 두고 카메라가 뱃고동 쪽 창으로 → 유리에 닿는 순간 햇빛 플레어(K23, 숨은 이음 = 플레어)", [S(
    "K23", 1.0, ["HIM", "GLASSES", "CUP"],
    "He walks along the tall river-side windows of the office with his iced americano; outside, the white cruise ship glides down the river. "
    "He keeps walking; the camera leaves him behind.",
    "a smooth gimbal move: from 0 s to 1.0 s the camera turns away from him and glides toward the window glass, faster and faster, until it "
    "touches the glass at 1.0 s and a bright burst of sunlight flares across the whole lens, turning the frame almost white.")],
    메모=["다음 판(T2a2)과 플레어에서 잇는다"])
pan("T2a2", ["T2a", "T2b"], "유리 밖 → 강으로 다이브 → 갑판 위 저공(깃발이 렌즈를 덮는 순간 = 숨은 이음)(K24)", [S(
    "K24", 4.0, ["SHIP"],
    "Outside the building in the late-morning sun: below, the white cruise ship glides along the Han River, its top deck packed with a crowd, "
    "colourful flags fluttering, a small white stage at the stern.",
    "a drone dive in one unbroken move, 24 mm: from 0 s to 2.5 s it tips forward off the building and dives steeply toward the river and the "
    "ship; from 2.5 s to 4.0 s it levels out and skims low over the top deck - the crowd seen from above as heads and raised phones, flags "
    "rushing past - until at about 4.0 s one colourful flag sweeps across and covers the whole lens, and the frame stays filled by the flag to "
    "the end. It never cuts.")], 길이=6,
    메모=["11-01 Fable: 깃발 와이프(4.0초)가 숨은 이음이라 지연에 밀려도 클립 안에 있게 6초"])
pan("T2b", ["T2b"], "뱃전 — 아까 빠진 상어가 담요 · 구명환 차림으로 젖은 폰을 털고, 승무원이 등을 두드림 → 드론이 기울며 솟음(K24b)", [S(
    "K24b", 1.0, ["SHARK"],
    "On the ship's deck at the rail: the shark that fell into the river sits wrapped in a grey blanket with an orange life ring around its "
    "waist, shaking water out of its soaked phone, while a crew member pats it on the back; its bright blue sneakers stick out in front.",
    "the drone glides in low and slows almost to a hover beside the blanket-wrapped shark from 0 s to 1.0 s - its bright blue sneakers first, "
    "then the crew member patting its back - and from about 1.2 s it banks and climbs away toward the white felt building.")],
    메모=["11-01 콘티 검수: 한 생성 안 패스(G21)와 낱판 하드컷 중 낱판으로 정함 — 앞 판 T2a2의 깃발이 렌즈를 덮는 순간에서 잇고, 이 판이 상어 생김새(K24b)를 쥔다"])
pan("T2c1", ["T2b", "T2c"], "하늘에서 건물 3층 띠 창으로 곧장 → 유리 통과(흰 번쩍임 = 숨은 이음)(K25)", [S(
    "K25", 2.5, [],
    "Facing the white felt SYNK building in the late-morning sun: through the third-floor ribbon window, a white stairwell with blue-carpeted "
    "stairs leads up to a coral door. No one is in the stairwell yet.",
    "a drone flies straight at the window in one unbroken move: from 0 s to 2.0 s it accelerates toward the third-floor ribbon window, the "
    "wavy felt slabs above and below filling more and more of the frame; at about 2.0 s it passes straight through the glass in a quick burst "
    "of white glare and ends inside, at the foot of the blue-carpeted stairs.")],
    메모=["다음 판(T2c2)과 유리 번쩍임에서 잇는다"])
pan("T2c2", ["T2c"], "파란 계단을 오르는 그와 뒤따르는 마린 → 코랄 문(K26)", [S(
    "K26", 3.0, ["HIM", "KKAMONG", "CUP", "MARIN"],
    "In the white stairwell: he climbs the blue-carpeted stairs toward the coral door at the top, iced americano in his right hand, seen from "
    "behind (Kkamong hidden), and Marin climbs after him one step at a time. At about 2.6 s he pushes the coral door open.",
    "FPV, 24 mm: the drone follows them up the stairs at a low height, gliding smoothly and slowing as they reach the coral door.")])

# ── 3. 3층 LAB ──────────────────────────────────────────────────────────────────────────────────
pan("L1-L2", ["L1", "L2"], "LAB 입장 — 어깨 너머 핸드헬드 한 샷: 선생님이 카메라 앞까지 달려와 소매를 잡고 「어. 서. 오. 세. 요~!」(K27, 한 샷을 L1 · L2로)", [S(
    "K27", 5.0, ["HIM", "CUP", "TEACHER"],
    "Handheld over his shoulder (his shoulder and the iced americano at the frame edge): he steps through the coral door into the sunny coral "
    "LAB classroom; the teacher runs up from across the room right to the camera, grabs his jacket sleeve and beams with the same wide, fixed "
    "smile and wide-open eyes, and at about 2.6 s says in Korean, syllable by syllable: \"어. 서. 오. 세. 요~!\" He says nothing. Students "
    "sit along the side and watch.",
    "handheld just behind his shoulder, small constant jitters, drifting in by about 5% as she arrives.")],
    소리="켬", 목소리견본="teacher", 메모=["11-01 콘티 검수: 시점(POV)을 어깨 너머 한 샷으로(K26 → K27 뒷모습 9초를 푸는 자리) — 웃음은 v34 L2 그대로, 더 밀지 않는다(장부 S15)"])
pan("L3", ["L3"], "코랄 펠트 핸들을 두 손으로 받는 그 정면(오른손은 컵 그대로), 선생님 「한 번 해 보세요. 병원!」은 화면 밖(K28 · 3:4 자름)", [S(
    "K28", 2.208, ["HIM", "GLASSES", "KKAMONG", "CUP"],
    "Front medium shot in the coral LAB: the teacher's hand at the left edge of the frame, in a coral cardigan sleeve, lets go of a coral felt "
    "steering wheel and withdraws out of the frame within the first 0.3 s; he holds "
    "the wheel in front of him with both hands like a driver, expressionless - his right hand still holding the iced americano against the "
    "rim. Kkamong hangs beside the rim on his left strap.",
    f"85 mm, {SWAY}, drifting in by about 4%.")],
    메모=["얼굴 컷 — 소리 끔. 선생님 「한 번 해 보세요. 병원!」은 화면 밖 대사 판 hg-말-선생님(또는 v34 녹음)"])
pan("L4", ["L4"], "뒤에서 — 핸들을 든 채 병원 관문 통과, 관문 위 몽글 눈이 별로, 학생들 박수(K28b)", [S(
    "K28b", 3.5, ["HIM", "CUP", "MONGLE"],
    "From behind: holding the coral felt steering wheel up like a driver, he walks straight through the coral felt word gate with the hospital "
    "icon; on top of the gate Mongle watches him pass, and at about 1.5 s its two black bead eyes turn into small stars and stay stars to the "
    "end; the students along the side clap.",
    "handheld behind him at chest height, small constant jitters, following him to the gate and slowing as he passes under it.")])
pan("L5-L7", ["L5", "L7"], "선생님 클로즈업 — 웃음이 굳으며 「…한국 분이세요?」 → (그의 「네.」) → 클립보드를 보고 「아, 면접?」 + 옆 아치를 가리킴(K29, 한 샷)", [S(
    "K29", 3.875, ["TEACHER"],
    "Close-up: the teacher's wide smile freezes and slowly stiffens as she asks in Korean, unsure: \"…한국 분이세요?\" She waits a beat with "
    "her mouth closed, as if hearing a short answer (about 1.5-2.3 s). Then she glances down at her coral felt clipboard, realises, says in "
    "Korean, clearly: \"아, 면접?\" and points off to the side, toward the deep coral archway (about 3.5 s).",
    "handheld close-up, small breath-like sway, drifting in by about 5% over the whole shot.")],
    소리="켬", 목소리견본="teacher", 메모=["한 샷을 L5(앞 1.5초) · L7(뒤 1.6초)로 자르고 사이에 L6(그의 「네.」)이 들어간다"])
l6 = pan("L6", ["L6"], "LAB 그 정면 — 무표정 「네.」(시선은 화면 오른쪽)(K30 · 3:4 자름)", [S(
    "K30", 0.792, ["HIM", "GLASSES", "KKAMONG", "CUP"],
    "Front medium shot: he stands still, expressionless, his eyes turned to the right of the frame, the coral steering wheel low in his hands; "
    "at about 0.3 s he silently mouths one flat Korean word, his lips barely moving (no sound is recorded): \"네.\" Then he stays still.",
    f"85 mm, {SWAY}.")],
    메모=["얼굴 컷 — 첫 시도는 이 판에서 시댄스가 낸 목소리(11-01 저녁), 얼굴이 바뀌면 대비책 hg-L6-무음 + v34 녹음 14"])

# ── T3 코랄 아치 터널 → PATH ─────────────────────────────────────────────────────────────────────
t3 = pan("T3", ["T3"], "스테디캠 — 그를 뒤따라 깊이 1m 코랄 아치 터널 → 어둠 0.3초 → 세이지 PATH 라운지(K31 → K32 끝 그림)", [S(
    "K31", 3.5, ["HIM", "KKAMONG", "CUP", "LOUNGE"],
    "From behind: he walks through the deep coral felt arch tunnel, about a metre deep, passes through its dark middle and steps out into the "
    "calm sage-green PATH lounge, where people sit on the sofas in white VR headsets.",
    "a steadicam follow, 35 mm, half a step behind him at mid-thigh height: from 0 s to 3.5 s it glides after him into the arch; inside the "
    "tunnel the frame goes nearly dark for about 0.3 s (around 1.8 s), then it comes out into the sage lounge and eases to a stop. The felt "
    "\"synk LAB\" sign above the arch stays sharp and identical; the camera passes under it without the letters filling the frame.",
    end="K32")],
    메모=["끝 그림 판(시작 · 끝이 같은 뒷모습 구도) — 끝 그림이 하드컷 · 녹음이 되면 대안 hg-T3b(끝 그림 없이)"])

# ── 3층 PATH ───────────────────────────────────────────────────────────────────────────────────
pan("P1-P2", ["P1", "P2"], "어깨 너머 상담사가 헤드셋을 내밂 「면접이시죠? 한 번 연습하고 가세요.」 → 헤드셋 시점 하얘짐(K33 하나 + 글)", [
    S("K33", 3.0, ["HIM", "GLASSES", "CUP", "COUNSELOR"],
      "Over his shoulder (his cornrows, glasses edge and shoulder at the left, his iced americano at the bottom): the counselor in the sage "
      "cardigan holds out a plain white VR headset with no markings to him and says in Korean, gently: \"면접이시죠? 한 번 연습하고 가세요.\" "
      "He says nothing.",
      f"over his shoulder, {SWAY}, drifting in by about 4%."),
    S(None, 0.792, [],
      "His point of view: the plain white VR headset is lowered over the camera - its dark lenses fill the frame, then everything turns pure "
      "white.",
      "first-person point of view, still."),
], 소리="켬", 목소리견본="counselor", 메모=["후반: 하얀 빛에서 VR 세계가 펠트 조각으로 「착착」 조립되며 열림(편집 효과)"])
pan("P2a", ["P2a"], "VR STAGE 1 · 비자 — 그의 시점, 출입국 창구의 마린이 두 손으로 도장 쾅, 몽글은 옆에서 둥실(K33b)", [S(
    "K33b", 1.083, ["MARIN", "MONGLE"],
    "His point of view inside a white wool-felt virtual world: at the immigration booth, Marin lifts the stamp with both stubby hands and brings "
    "it down with a bang on the plain navy felt booklet that his left hand holds out on the counter (about 0.5 s); Mongle hovers beside the "
    "booth and bobs once. The booklet has no writing and no photo - only the round blue star seal already on the page.",
    f"first-person point of view, {SWAY}.")],
    메모=["후반 글자 「STAGE 1 · 비자」 + 도장 순간 작은 「CLEAR」"])
pan("P2b", ["P2b"], "VR STAGE 2 · 수업 — 그의 시점, 손을 번쩍 든 그를 본 몽글 눈이 별로(K33c)", [S(
    "K33c", 1.083, ["MONGLE"],
    "His point of view in a white felt virtual lecture hall: his left hand stays raised high at the bottom of the frame; in front of the plain "
    "green blackboard (no writing, no chalk marks) Mongle looks at his raised hand - its two eyes are already small stars, exactly as in the "
    "first frame, and stay stars - and at about 0.5 s it bobs once, delighted, with a little tilt of its body.",
    f"first-person point of view, {SWAY}.")],
    메모=["후반 글자 「STAGE 2 · 수업」 + 「CLEAR」, 끝 0.35초에 「FINAL STAGE · 면접」"])
pan("P3-P4", ["P3", "P4"], "VR 방 대칭 와이드(뒤에서) — 판 ①을 가리킴 → 마린 눈이 빨강, 방에 빨간 맥박(K34 하나 + 글)", [
    S("K34", 2.5, ["HIM", "CUP", "MARIN", "MONGLE"],
      "Symmetrical wide of the white virtual room, from behind him: he stands facing Marin and Mongle, who sit at the two white felt tables as "
      "interviewers, two blank white felt panels floating above them. At about 1.5 s he lifts his LEFT arm and points at the LEFT panel; the "
      "iced americano stays in his right hand, hanging by his side.",
      "a 24 mm symmetrical frame that stays exactly where it is for the whole shot."),
    S(None, 1.0, [],
      "Close-up of Marin's helmet at the left table: both big round eyes glow red, and the whole white room pulses red.",
      HOLD),
], 메모=["판에 글자 없음 — 「Q. 왜 늦었어요?」 · ① ② · 「삑! 거짓말 감지」는 후반 글자"])
pan("P5", ["P5"], "같은 와이드 — 손을 거둬 판 ②를 가리킴 → 마린 눈 노랑, 몽글 제자리 콩, 꽃가루(K34 하나 + 글)", [
    S("K34", 1.5, ["HIM", "CUP", "MARIN", "MONGLE"],
      "The same symmetrical wide from behind him, both arms down as in the first frame: at about 0.8 s he lifts his left arm again and points "
      "across at the RIGHT panel; the iced americano stays in his right hand by his side.",
      "a 24 mm symmetrical frame that stays exactly where it is for the whole shot."),
    S(None, 1.5, [],
      "Close-up of the two tables: Marin's eyes glow yellow again, Mongle hops once in place on its table, and soft coral felt confetti "
      "flutters down.",
      HOLD),
], 메모=["후반 글자 「솔직함 +100」 「PERFECT」"])
p6 = pan("P6", ["P6"], "뒤에서 — 면접관 마린 · 몽글 쪽으로 90도 절(K35a 꼿꼿이 → K35 절 끝 그림, P7과 같은 구도)", [S(
    "K35a", 2.5, ["HIM", "CUP", "MARIN", "MONGLE"],
    "The same symmetrical wide from behind him: he faces Marin and Mongle at the white tables and, at about 0.9 s, bows deeply from the waist "
    "to a full 90 degrees toward them and holds the bow - his face stays hidden the whole time; his backpack stays on, the iced americano in "
    "his right hand by his side.",
    STILL, end="K35")],
    메모=["그의 「잘 부탁드립니다!」는 이 판에서 시댄스가 낸 목소리를 먼저 쓴다(11-01 저녁), 어색하면 같은 영상에 v34 녹음 17을 얹는다(얼굴이 안 "
          "보여 소리만 바꿈)", "절 끝 구도 = P7 첫 구도(매치컷)"])
pan("P7", ["P7"], "매치컷 반전 — 같은 구도로 라운지의 빈 안락의자 둘에 절하는 그(헤드셋), 의자 너머 소파 사람들, 발치의 마린(K36)", [S(
    "K36", 3.0, ["HIM", "CUP", "MARIN"],
    "In the real sage-green lounge, from behind: he is still bowed deeply at 90 degrees, a white VR headset on his head, toward two EMPTY sage "
    "armchairs, the iced americano still in his right hand by his side. Beyond the chairs on the sofa, a woman in a VR headset keeps her hand raised high as if in class, a man in a headset sits "
    "perfectly still, and a woman with her headset pushed up on her forehead stares at him and slowly sips her drink. Marin stands at his "
    "feet looking up at him.",
    "the first frame's framing holds; after about 1.0 s the camera eases back very slowly by about 4%.")])
pan("P8", ["P8"], "헤드셋이 이마 위로 벗겨진 그 정면, 가장자리 상담사 엄지 — 「좋아요. 진짜는 4층이에요.」는 화면 밖(K37 · 3:4 자름)", [S(
    "K37", 3.0, ["HIM", "GLASSES", "KKAMONG", "CUP"],
    "Front medium shot in the lounge: the white VR headset sits pushed up on his forehead; he looks straight ahead, expressionless, slightly "
    "dazed. At the left edge of the frame the counselor's hand gives him a thumbs-up and holds it - the whole thumb stays inside the frame to "
    "the end. He doesn't react.",
    f"85 mm, {SWAY}, drifting in by about 4%.")],
    메모=["얼굴 컷(3:4 → 9:16, 상담사 엄지가 다 들어오게 cx 0.43) — 소리 끔. 상담사 줄은 화면 밖 대사 판 hg-말-상담사(또는 v34 녹음)"])

# ── T4 조명 매치컷 ───────────────────────────────────────────────────────────────────────────────
pan("T4a", ["T4a"], "라운지 펜던트로 틸트업 → 하얘짐(K38, 이음 = 하얀 빛)", [S(
    "K38", 2.0, [],
    "Looking up at the round sage felt pendant lamp hanging from the white ceiling of the lounge; its bulb glows warmly.",
    "the camera keeps tilting up and moves closer into the glowing bulb: from 0 s to 2.0 s it rises into the light until, from about 1.5 s, the "
    "glow blooms and the whole frame fades to pure white.")])
pan("T4b", ["T4b"], "하얀 빛 = 4층 펜던트 → 틸트다운 → 문을 열고 들어오는 그(K39)", [S(
    "K39", 2.5, ["HIM_ROOM", "GLASSES", "CUP", "KKAMONG_RACK"],
    "The fourth-floor interview room: under the glowing round felt pendant lamp, his black backpack with Kkamong already hangs on the chrome "
    "coat rack by the door; the wooden door opens at about 1.0 s and he steps in without the backpack, fully inside the room by about 2.0 s, "
    "his iced americano in his right hand - he is the only person who enters.",
    "the shot begins almost white in the pendant's glow: from 0 s to 1.0 s the glow settles and the camera tilts down from the lamp, past the "
    "round wall clock, to the wooden door, and holds there as the door opens.")],
    메모=["후반 자막 「4F — 면접실」"])

# ── 4. 4층 면접실 ────────────────────────────────────────────────────────────────────────────────
pan("F0", ["F0"], "숫자 없는 펠트 벽시계 — 바늘 5시 50분쯤(K42)", [S(
    "K42", 0.583, [],
    "Insert: the round grey felt wall clock with no numbers, its hands at about ten to six; the minute hand ticks forward once.",
    STILL)])
pan("F1", ["F1"], "그의 뒤쪽에서 면접관 정면 고정 — 「왜 늦었어요?」(K40, 끝 0.3초는 후반 크래시 줌으로)", [S(
    "K40", 1.709, ["HIM_ROOM", "CUP_DESK", "KKAMONG_RACK", "INTERVIEWER", "MARIN_S"],
    "From behind him (his shoulder and cornrows at the lower right): the interviewer sits at the honey-oak desk with her hands folded, looks at "
    "him and asks in Korean, completely dry: \"왜 늦었어요?\" Then she waits, motionless. He says nothing. Marin sits on the felt stool by the "
    "wall.",
    STILL)],
    소리="켬", 목소리견본="interviewer", 메모=["F3 크래시 줌은 이 판 끝 4~6프레임을 후반에서 2.4배로 키우고 움직임 흐림 → F3-F4(K40b)로 잇는다"])
f2 = pan("F2", ["F2"], "창 쪽에서 본 그의 오른쪽 옆얼굴 — 0.6초 무표정 뒤 「…상어랑 어깨빵했어요.」(K41 · 3:4 자름)", [S(
    "K41", 2.792, ["HIM_ROOM", "GLASSES", "CUP_DESK", "MARIN_S"],
    "His right profile, seen from the window side: he sits at the desk, completely expressionless, and holds still for about 0.6 s; then he "
    "silently mouths the Korean words, very seriously, like a factual report, his lips moving clearly but only a little (no sound is "
    "recorded): \"…상어랑 어깨빵했어요.\" Then he holds still again. Behind him Marin sits on the felt stool by the wall.",
    f"85 mm, {SWAY}, drifting in by about 3%.")],
    메모=["얼굴 컷 — 새 대사(v34에 없음)도 첫 시도는 이 판에서 시댄스가 v34 그 목소리 견본으로 낸 목소리(11-01 저녁, 본뜬 CosyVoice 판은 안 씀). "
          "재기 첫 장 · 얼굴 닮음부터(장부 S15), 바뀌면 대비책 hg-F2-무음 + 화면 밖 대사 판 hg-말-그 소리"])
pan("F3-F4", ["F3", "F4"], "면접관 85mm 클로즈업 — 무표정 → 눈이 창밖 강으로 갔다 돌아옴 → 「수영 잘해요?」(K40b)", [S(
    "K40b", 2.292, ["INTERVIEWER", "KKAMONG_RACK"],
    "Close-up of the interviewer: she stays completely still and expressionless for about 0.5 s; then her eyes slide slowly to the window at "
    "the right of the frame - toward the river - and come back to him (about 0.6-1.2 s); then she asks in Korean, completely dry: "
    "\"수영 잘해요?\"",
    f"85 mm: {STILL}")],
    소리="켬", 목소리견본="interviewer", 메모=["앞 0.5초는 F3(크래시 줌 도착), 뒤가 F4"])
pan("F5", ["F5"], "안경 너머 그의 눈 극 클로즈업(K41b)", [S(
    "K41b", 0.792, [],
    "Extreme close-up of his eye behind the thick black glasses: it stares, completely still, then blinks once, slowly (about 0.4 s).",
    STILL)])
f6 = pan("F6", ["F6"], "그 옆얼굴 — 한 박 쉬고 「…아니요.」(F2 받은 영상의 끝 프레임에서 시작 · 받기 전 자리는 K41)", [S(
    "K41", 1.208, ["HIM_ROOM", "GLASSES", "CUP_DESK", "MARIN_S"],
    "His right profile, seen from the window side: after a beat of stillness (about 0.6 s) he silently mouths the Korean words, flatly, his "
    "lips moving only a little (no sound is recorded): \"…아니요.\" Then he holds still.",
    f"85 mm, {SWAY}, drifting in by about 3%.")],
    앞토막="hg-F2",
    메모=["11-01 콘티 검수: F2의 끝 프레임에서 시작한다(같은 K41에서 시작하면 F5 → F6 컷에서 자세가 F2 첫 자세로 되돌아감) — hg-F2를 받은 뒤 "
          "웹꾸러미.py --한강을 다시 돌리면 1_시작이 채워진다(끝 프레임이 망가졌으면 K41)",
          "얼굴 컷 — 첫 시도는 이 판에서 시댄스가 낸 목소리(11-01 저녁), 얼굴이 바뀌면 대비책 hg-F6-무음 + v34 녹음 22"])
pan("F7", ["F7"], "면접관 손이 분홍 펠트 카드를 책상에 내려놓음 — 「솔직해서, 합격.」은 화면 밖(K43)", [S(
    "K43", 2.792, ["KKAMONG_RACK"],
    "On the honey-oak desk, the interviewer's hand in a charcoal blazer sleeve slides a small pink felt card - completely blank, no writing - "
    "across the desk toward him and lets go; then the hand withdraws. Everything else stays still.",
    STILL)],
    메모=["면접관 「솔직해서, 합격.」은 화면 밖 대사 판 hg-말-면접관(또는 v34 녹음) + 0.4초 정적, 끝에 PERFECT 아주 작게(유호님 들어 보고)"])
f8 = pan("F8", ["F8 마린", "F8 까몽"], "스툴 위 마린 갸웃 → 하드컷 코트걸이 가방의 까몽 눈 깜빡(K43b · K42b 두 샷)", [
    S("K43b", 0.5, ["MARIN"],
      "Marin sits on the small felt stool by the wall and slowly tilts its helmet to one side, puzzled.",
      HOLD),
    S("K42b", 0.5, ["KKAMONG_RACK"],
      "Close-up of the backpack hanging on the coat rack: Kkamong, dangling from its shoulder strap, blinks its round green eyes once.",
      HOLD),
], 낱판=["hg-F8a", "hg-F8b"], 메모=["두 샷 판 — 옴니 레퍼런스(참조) 모드에서 그림 둘. 안 되면 대안 낱판 hg-F8a · hg-F8b"])

# ── 5. T5 · 엔딩 ─────────────────────────────────────────────────────────────────────────────────
t5 = pan("T5", ["T5"], "노을 창 어깨 너머 → 유리 통과 → 강변 나무의 까치(K44 시작 · K45 도착 참고)", [S(
    "K44", 4.5, ["HIM_ROOM", "GLASSES", "CUP", "MAGPIE"],
    "Over his shoulder at the tall window of the interview room at golden hour: he looks out at the riverside park below - people on picnic "
    "mats in thick coats and blankets, a delivery rider passing, a bare tree by the railing with a magpie perched on a branch.",
    "one unbroken move: from 0 s to 4.5 s the camera glides past his shoulder, passes straight through the window glass and flies down over "
    "the park toward the bare tree, slowing as it reaches the magpie on its branch - ending on the framing of @이미지 2. It never cuts.")],
    참고그림="K45.jpg",
    참고말=("@이미지 2 is a reference only for the framing the camera arrives at by the end - the magpie on its bare branch in the low golden "
           "light - it is not the first frame, not the last frame and not a separate shot."),
    메모=["_참고 그림은 끝 그림이 아님 — 옴니 레퍼런스(참조) 모드로 올린다", "도착이 안 맞으면 대안 hg-T5e(K45 끝 그림)"])
pan("E1", ["E1"], "까치가 가지를 차고 날아오름(K45, 이륙 직후 날개 흐림 = 숨은 이음)", [S(
    "K45", 2.0, ["MAGPIE"],
    "The magpie on the bare branch crouches, then at about 0.8 s springs off the branch toward the left of the frame, its black-and-white wings "
    "opening into a blur.",
    "handheld long lens with small constant jitters; as it springs off, the camera whip-pans left to follow and the wings blur across the "
    "lens.")],
    메모=["11-01 콘티 검수: 끝 잠금 없이 K45 시작 그림만 — 날개 흐림에서 E2(K46)로 컷"])
pan("E2", ["E2"], "라이드 얼롱 — 까치 뒤를 따라 노을 강 위로, 날갯짓 · 활공, 배로(K46)", [S(
    "K46", 5.5, ["MAGPIE", "SHIP"],
    "Right behind the magpie as it flies low over the golden river toward the white cruise ship: it flaps a few times, glides, flaps again, "
    "closing in on the ship's crowded deck and the white stage at the stern.",
    "a ride-along drone that stays right behind the magpie in one unbroken move, matching its speed and its rises and dips, the ship growing "
    "larger ahead. No daylight shift at any point - the low golden sunset light stays the same to the end.")],
    메모=["현장노트: 노을 역광 까치가 다른 새가 되거나 대낮 하드컷이 붙은 적이 있다 — 색 문장을 MAGPIE 줄에 박음"])
pan("E3", ["E3"], "로우 앵글 — 무대 위 혼자 춤추던 상어 머리에 까치 착지 → 얼음 → 콕콕 → 으쓱 → 다시 춤 → 마지막 포즈(K47)", [S(
    "K47", 6.5, ["SHARK", "MAGPIE"],
    "Low angle from behind the cheering crowd (backs of heads and raised phones in the foreground): alone on the white stage, the shark - the one "
    "rescued from the river - is dancing; the magpie has just landed on top of its head and is folding its wings (0-0.5 s). The shark freezes "
    "mid-move; the magpie pecks "
    "its head twice (about 1.5 s and 2.0 s); the shark shrugs (about 3.0 s) and goes back to dancing with the magpie riding on its head, ending "
    "in a big final pose (about 5.3 s) that it holds. No other dancers on the stage.",
    "handheld low angle from the crowd, small constant jitters, slowly pushing in by about 15% over the whole shot.")],
    메모=["마지막 포즈 정지 1.2초는 편집에서 프레임 정지"])
pan("E4", ["E4"], "하드컷 — 방 안쪽에서 옆으로, 창 앞 그의 오른쪽 옆 실루엣이 오른손 컵 빨대로 한 모금, 전경에 코트걸이 까몽(K48)", [S(
    "K48", 2.0, ["HIM_ROOM", "CUP", "KKAMONG_RACK"],
    "Inside the interview room at sunset, starting mid-sip: he stands at the window in silhouette, his right side to us and facing the right of "
    "the frame, sipping iced americano through the black straw; he lowers the cup and holds completely still for the last 0.6 s. A thin warm "
    "rim light traces the edge of his glasses and the cup; in the foreground Kkamong on the bag on the coat rack catches a sliver of window "
    "light. Nothing else moves; his face stays a dark silhouette.",
    "the frame stays almost still, drifting in by about 3%.")],
    메모=["11-01 콘티 검수(넷 가운데 그림 힘이 가장 약한 끝): 편집은 빨대 소리가 끝나면 검정으로 하드컷, 다음 박에 로고 — 2.0초는 늘리지 않는다"])

# ── 화면 밖 대사 판(매진 꼴) — 그 배역 그림 · 견본으로 소리만 쓴다(화면은 안 씀) ─────────────────────────────────
OFF = [   # (판 꼬리, 배역, 그림 K, 누구, 화면 속 사람, 쓰는 컷, 연기 · 줄, 고르는 법)
    ("선생님", "teacher", "K29", ["TEACHER"], "The teacher", ["L3"],
     "says in Korean like a cheerful game-show host: \"한 번 해 보세요. 병원!\"", "v34 녹음과 들어 보고 고름"),
    ("상담사", "counselor", "K33", ["COUNSELOR"], "The counselor in the sage cardigan", ["P8"],
     "says in Korean, warmly pleased: \"좋아요. 진짜는 4층이에요.\"", "v34 녹음과 들어 보고 고름"),
    ("면접관", "interviewer", "K40b", ["INTERVIEWER"], "The interviewer", ["F7"],
     "says in Korean, completely dry, with a half-beat pause at the comma: \"솔직해서, 합격.\"", "v34 녹음과 들어 보고 고름"),
    ("그", "him", "K41", ["HIM_ROOM", "GLASSES"], "He, sitting at the interview desk", ["F2"],   # 11-01 저녁 — 대비책 hg-F2-무음의 소리
     "after a short pause says in Korean, very seriously, like a factual report: \"…상어랑 어깨빵했어요.\"",
     "F2 소리 켬 판이 얼굴을 지키면 안 씀"),
]
for tail, role, k, keys, who, used, act, how in OFF:
    pan("말-" + tail, used, f"{tail} 화면 밖 대사 — 소리만 씀({k} 그림 · v34 {tail} 목소리 견본으로 시댄스가 연기)", [S(
        k, 3.0, keys, f"{who}, looking just past the camera, {act}", STILL)],
        소리="켬", 목소리견본=role, 화면밖=True,
        메모=[f"소리만 쓴다 — {' · '.join(used)} 자리에 얹음({how})"])

# ── 그의 목소리 — 첫 시도는 이 판에서 시댄스가 낸 목소리(11-01 저녁 유호님), 얼굴 판은 소리 끔 「-무음」이 대비책 ─────────────────
SAYS = {   # 판 → (소리 끔 글, 소리 켬 글) — 나머지 얼굴 판은 「silently mouths … (no sound is recorded)」를 「says」로
    "hg-O2-O3": ("his head snaps back and the cup jerks up in his hand.",
                 "his head snaps back, the cup jerks up in his hand and he lets out one short, choked grunt: \"읍!\""),
    "hg-O7": ("he lets out one long, slow, defeated sigh - ", "he lets out one long, slow, defeated sigh out loud, \"하아……\" - "),
    "hg-P6": ("bows deeply from the waist to a full 90 degrees toward them and holds the bow",
              "bows deeply from the waist to a full 90 degrees toward them, saying loudly and earnestly in Korean as he goes down: "
              "\"잘 부탁드립니다!\" - and holds the bow"),
}
for src, n in ((o23, "01"), (o7, "02"), (e2, "09"), (l6, "14"), (f2, None), (f6, "22"), (p6, "17")):
    over = f"v34 녹음 {n}" if n else "화면 밖 대사 판 hg-말-그의 소리"
    if src is not p6:   # P6은 얼굴이 안 보여 같은 영상에 소리만 바꾼다
        alt(src, src["id"][3:] + "-무음", src["설명"] + f" — 대비책: 소리 끔(소리 켬 판이 얼굴을 바꿀 때), 소리는 {over}를 입에 맞춰 얹음",
            메모=[f"소리 켬 주판 {src['id']}의 얼굴이 바뀌거나 목소리가 어색할 때만 낸다 — 소리는 {over}"]
            + (["F2도 소리 끔 판으로 가면 앞토막을 hg-F2-무음으로 바꿔 꾸러미를 다시 만든다"] if src is f6 else []))
    a, b = SAYS.get(src["id"], ("silently mouths", "says"))
    s0 = src["샷"][0]
    assert s0["동작"].count(a) == 1, src["id"]
    s0["동작"] = s0["동작"].replace(a, b).replace(" (no sound is recorded)", "")
    src.update(소리="켬", 목소리견본="him")

# ── 대안 ──────────────────────────────────────────────────────────────────────────────────────
for src, k in ((t0, "K09"), (t1, "K15"), (t5, "K45")):   # 도착 구도를 참고 대신 끝 그림으로 잠금(하드컷 위험 — 현장노트)
    s = dict(src["샷"][0], 끝그림=f"{k}.jpg", 카메라=src["샷"][0]["카메라"].replace("on the framing of @이미지 2", "on exactly the last frame")
             .replace("; then it holds", "; then it holds on exactly the last frame"))
    alt(src, src["id"][3:] + "e", src["설명"] + " — 둘째 길: 도착 그림을 끝 그림으로 잠금(참고 판의 건물 · 구도가 틀릴 때)",
        샷=[s], 참고그림=None, 참고말=None, 메모=["끝 그림 판 — 시작 · 끝 구도가 크게 달라 하드컷이 날 수 있다(현장노트 higgsfield)"])
for src in (t3, p6):   # 끝 그림 판의 둘째 길 — 끝 그림 없이 끝 모습을 글로만
    s = {k: v for k, v in src["샷"][0].items() if k != "끝그림"}
    alt(src, src["id"][3:] + "b", src["설명"] + " — 둘째 길: 끝 그림 없이(끝 그림 판이 하드컷 · 녹음이 되면)", 샷=[s], 메모=None)
for src in [p for p in PANS if p["id"] in ("hg-F1", "hg-F3-F4")]:   # 11-01 Fable P2 ⑭ — 소리 참고 판이 첫 화면을 다시 짜면 낼 둘째 길(같은 구도 끝 그림이 닻)
    s0 = dict(src["샷"][0], 끝그림=src["샷"][0]["그림"], 동작=src["샷"][0]["동작"] + " The shot ends on exactly the first frame's framing and her resting pose.")
    alt(src, src["id"][3:] + "-E", src["설명"] + " — 대안: 시작과 같은 그림을 끝 그림으로(소리 참고 판이 첫 화면을 다시 짤 때의 닻)", 샷=[s0],
        메모=["시험 hg-F1이 괜찮으면 내지 않는다(현장노트 higgsfield 10-31 — 같은 구도의 끝 그림이 닻, 면접관은 「waits, motionless」라 되감김이 무해)"])
for src in (a2, f8):   # 두 샷 묶음의 낱판
    for i, s in enumerate(src["샷"]):
        one = dict(s)
        kw = {"샷": [one], "낱판": None, "메모": None, "자르는초": None, "컷": [src["컷"][i]]}
        if src is a2 and i == 1:
            kw.update(소리=None, 목소리견본=None)
        q = alt(src, src["낱판"][i][3:], f"{src['설명']} — 낱판 {i + 1}(두 샷 판이 안 될 때)", **kw)
        q["길이"] = timing([one])[0]


def first_line(has_end):
    s = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white "
         "balance, same people and animals, faces, hair and clothes.")
    if has_end:
        s += " @이미지 2 is the exact last frame: the camera arrives at exactly that framing at the very end."
    return s


def who_lines(keys):
    return [f"{k.split('_')[0]}: {WHO[k]}" for k in keys]


def sound_line(p):
    if p.get("소리줄"):
        return p["소리줄"]
    if not p.get("목소리견본"):
        return SILENT
    name = ROLE[p["목소리견본"]][1]
    many = sum(s["동작"].count("\"") for s in p["샷"]) > 2
    owner = "his own voice" if p["목소리견본"] == "him" else f"{name}'s voice"
    return (f"SOUND: only {owner} saying the Korean line{'s' if many else ''} written above, over quiet room tone - no music, no narration, no "
            "other voices.")


def preview(spec, p):
    shots = p["샷"]
    L = []
    if p.get("화면밖"):
        s = shots[0]
        L += [first_line(False), f"ONE SINGLE CONTINUOUS SHOT of {GENRE}, {RATIO} — no cuts, no camera switch, no slow motion, no speed ramp, "
              "no end card."]
        L += who_lines(s["누구"])
        pos = ROLE[p["목소리견본"]][2]
        L.append(f"ACTION: {s['동작']} {pos.capitalize()} lips clearly form the Korean words. Everyone else in the frame keeps still with lips "
                 "closed.")
        L.append("CAMERA: " + s["카메라"])
    elif len(shots) == 1:
        s = shots[0]
        L.append(first_line(bool(s.get("끝그림"))))
        if p.get("참고말"):
            L.append(p["참고말"])
        L.append(f"ONE SINGLE CONTINUOUS SHOT of {GENRE}, {RATIO} — no cuts, no camera switch, "
                 + ("in smooth slow motion for the whole shot, no speed ramp, no end card." if s.get("슬로")
                    else "no slow motion, no speed ramp, no end card."))
        L += who_lines(s["누구"])
        L.append("ACTION: " + s["동작"])
        L.append("CAMERA: " + s["카메라"])
    else:
        n, cuts = len(shots), p["자르는초"]
        pics = [s for s in shots if s.get("그림")]
        one = len(pics) == 1
        if one:
            L.append(first_line(False))
        if n == 2:
            head = f"This video is TWO SHOTS of {GENRE}, {RATIO}, joined by ONE hard cut at {cuts[0]:g} s"
        else:
            times = [f"{t:g} s" for t in cuts]
            head = f"This video is {NUM[n]} SHOTS of {GENRE}, {RATIO}, joined by {NUM[n - 1]} hard cuts, at {', '.join(times[:-1])} and {times[-1]}"
        if one:
            head += (" — one moment in one place under the same light: SHOT 1 opens on @이미지 1 and each later shot is a new camera angle in "
                     "that same place, where every person and object looks exactly the same; nobody is added who is not described for that "
                     "shot; no other cuts, no slow motion, no speed ramp, no end card.")
        else:
            head += (" — the same moment in the same place under the same light; any person or object seen in both shots looks exactly the "
                     "same in both; nobody is added who is not described for that shot; no other cuts, no slow motion, no speed ramp, no end "
                     "card.")
        L.append(head)
        keys = []
        for s in shots:
            keys += [k for k in s["누구"] if k not in keys]
        L += who_lines(keys)
        for i, s in enumerate(shots):
            a = 0 if i == 0 else cuts[i - 1]
            span = f"{a:g}–{cuts[i]:g} s" if i < n - 1 else f"{a:g} s to the end"
            if s.get("그림"):
                L.append(f"SHOT {i + 1} ({span}) begins exactly on @이미지 {pics.index(s) + 1} — same framing, light and colors. ACTION: "
                         f"{s['동작']} CAMERA: {s['카메라']}")
            else:
                L.append(f"SHOT {i + 1} ({span}), new angle: ACTION: {s['동작']} CAMERA: {s['카메라']}")
    L.append(LOOK)
    L.append(sound_line(p))
    if p.get("목소리견본"):
        L.append(p.get("목소리줄") or VOICE)
    return "\n".join(L)


def build():
    return PANS


SPEC = {
    "메모": ("한강2126 재촬영(v40 · v41) — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-11-01, 시댄스지시문.py가 만듦). 시작 그림은 시댄스그림.py가 모은 "
             "git 밖 재촬영_v40/시댄스/그림/<K>.jpg(가편집 8판 시간표의 고른 판, 3:4 얼굴 열 장은 9:16으로 자름), 목소리 견본은 견본만들기.py의 "
             "재촬영_v40/시댄스/견본/<배역>.mp3(v34 목소리). 컷 · 쓰는 초는 가편집 8판, 카메라는 04 샷표, 동작 · 대사는 03 대본 v40 · 05 v41 "
             "수정안. 꾸러미는 ../../PULSE_포트폴리오_제작준비_20261012/시댄스무제한/웹꾸러미.py --한강."),
    "편": "hg",
    "이름": "한강2126 브랜드 필름(재촬영)",
    "비율": "9:16",
    "그림": IMG,
    "견본": SAMPLES,
    "공통": {"장르": GENRE, "누구": WHO, "보기": LOOK, "소리": SILENT, "목소리": VOICE},
}


def spec():
    return dict(SPEC, 판=build())


if __name__ == "__main__":
    sp = spec()
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        p = next(p for p in sp["판"] if p["id"] == k)
        t = preview(sp, p)
        print(t)
        print(f"\n({len(t)}자 · {p['길이']}초)")
        sys.exit(0)
    out = HERE / "지시문" / "영상_시댄스웹.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(sp, ensure_ascii=False, indent=1), encoding="utf-8")
    main = [p for p in sp["판"] if not p.get("대안")]
    alts = [p for p in sp["판"] if p.get("대안")]
    lens = {p["id"]: len(preview(sp, p)) for p in sp["판"]}
    longest = max(lens, key=lens.get)
    print(f"판 {len(sp['판'])} — 주판 {len(main)}(여러 샷 {sum(len(p['샷']) > 1 for p in main)} · 소리 켬 {sum(bool(p.get('소리')) for p in main)}) · "
          f"대안 {len(alts)} · 주판 길이 합 {sum(p['길이'] for p in main)}초 · 가장 긴 판 {max(p['길이'] for p in sp['판'])}초 · "
          f"가장 긴 지시문 {lens[longest]}자({longest})")
    over = [f"{k} {v}" for k, v in lens.items() if v > 3600]
    if over:
        print("  3,600자 넘는 판:", over)
