# 로맨스 단편 「다 비침」 — 시댄스 2.5 웹 판 지시문을 만든다(2026-10-30, 7번 지시문_시댄스웹.py와 같은 꼴).
#   python -X utf8 지시문_시댄스웹.py            → 지시문/영상_시댄스웹.json(조율 세션의 ../../시댄스무제한/웹꾸러미.py가 읽는 꼴) · 판 수 · 길이 합
#   python -X utf8 지시문_시댄스웹.py --보기 <판 id> [A|B|없음]   → 그 판의 웹 지시문을 꾸러미와 같은 순서로 찍는다(소리 줄은 고른 방식)
# 시작 그림은 이미지 콘티 정지컷(git 밖 콘티/romance/선버스트/정지컷, 1920×1080 — GPT Image 2.5, 태준 컷은 10-31부터 유호님 얼굴 · 이미지콘티_태준.py). 끝 그림이 있는 컷(C01 · C11 · C14 · C18 · C20 ·
# C43 · C50)은 「@이미지 2」로 끝 구도를 준다. 카메라는 02_콘티 4절 카메라 칸(원본 프레임 실측 · 눈 확인)을 그대로 옮기고, 손떨림 크기는 원본 배경 실측
# (레퍼런스/romance/원본실측/romance_컷확정.json 「카메라 · 배경 · 흔들림%」)이다. 동작은 4절 「우리 화면」 · 이야기 3.1판대로 한 가지씩, 리액션은 낮게.
# 10-30 연출 · 앵글 검수(git 밖 검수/제대로_20261030/답_연출앵글.md 표 2): 말 없는 판이 「looks at her, silent」 한 상태로 끝나 감정의 박이 없던 자리에
# 시선 · 침 삼킴 · 숨 · 손의 박을 때와 함께 적었다(C03 · C27 · C37 · C54 · C60 · C63 · C66 · C35 · 중 열). 요즘 기법 셋은 CHANGES(원본 카메라 판은 대안).
# 7번과 다른 칸: 샷의 「말」이 목록이다(한 컷에 두 사람이 입을 맞추는 C14 · C41 · C47 · C53 — 7번은 한 판 한 사람). 속말 다섯 · 손글씨 · 앞 가림 ·
# 휴대폰 사진 · 화면 글은 굽지 않고 편집에서 얹는다(샷의 「후반」 칸). 회상 31컷은 16:9로 받고 좌우 띠는 편집에서 씌운다(샷의 「회상」).
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
VEN = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/"
V = VEN + "콘티/romance/"
OUT = os.path.join(HERE, "지시문", "영상_시댄스웹.json")
INFO = {c["컷"]: c for c in json.load(open(V + "컷목록.json", encoding="utf-8"))}
SHAKE = {f"C{c['컷']:02d}": ((c.get("카메라") or {}).get("배경") or {}).get("흔들림%")
         for c in json.load(open(VEN + "레퍼런스/romance/원본실측/romance_컷확정.json", encoding="utf-8"))["컷"]}

# ── 누구(공통) — 웹꾸러미가 「키: 설명」 줄로 붙인다. 얼굴은 시작 그림이 정하므로 머리 · 옷 · 소품만 적는다(02_콘티 1절) ──
WHO = {
    "YUNA (cardigan)": "Yuna — the same Korean woman as in the first frame (late twenties, long dark-brown wavy hair in a low ponytail, small gold stud earrings) in a soft blush-pink chunky knit cardigan over a white collared blouse and cream wide-leg trousers.",
    "YUNA (white blouse)": "Yuna — the same Korean woman as in the first frame (long dark-brown wavy hair worn down, small gold stud earrings) in a plain white silk blouse and dark-grey slacks.",
    "YUNA (taupe blazer)": "Yuna — the same Korean woman as in the first frame (long dark-brown wavy hair worn down, small gold stud earrings) in a taupe tailored blazer over a black knit top and black trousers.",
    "TAEJUN (shirt and tie)": "Taejun — the same Korean man as in the first frame (mid-thirties, short side-parted black hair exactly as in the first frame, clean-shaven, slim) in a white dress shirt with a slim dark-navy tie and charcoal trousers, a black-strap smartwatch on his left wrist.",
    "TAEJUN (shirt, no tie)": "Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in a white dress shirt with no tie, the top button open and the sleeves rolled to the elbows, charcoal trousers, a black-strap smartwatch on his left wrist.",
    "TAEJUN (blue shirt)": "Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in a pale-blue dress shirt with a slim charcoal tie and grey trousers, a black-strap smartwatch on his left wrist.",
    "TAEJUN (blue shirt, headphones)": "Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in a pale-blue dress shirt with a slim charcoal tie, black over-ear headphones on his head.",
    "TAEJUN (navy jacket)": "Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in an unstructured navy chore jacket with a shirt-style collar (no lapels) over a plain white T-shirt, charcoal trousers and black leather shoes.",
    "MINJAE (beige vest)": "Minjae — the same Korean man as in the first frame (Taejun's junior, late twenties, round face, short black hair with messy bangs) in a beige knit vest over a white shirt.",
    "MINJAE (green vest)": "Minjae — the same Korean man as in the first frame (round face, short black hair with messy bangs) in a dark-green knit vest over a white shirt.",
    "CLEAR UMBRELLA": "the premium clear umbrella exactly as in the first frame — a crystal-clear, glass-like canopy (not cloudy vinyl), thin silver ribs and a thin silver shaft, and a straight clear acrylic handle with a small frosted milky-white cap; whoever carries it grips the handle; no logo, no text.",
    "BLUE UMBRELLA": "the same premium umbrella with a misty pale-blue, still see-through canopy, exactly as in the first frame; no logo, no text.",
    "BLACK UMBRELLA": "Yuna's plain opaque black full-length stick umbrella with a straight black handle, exactly as in the first frame; no logo.",
    "GREEN SCREEN": "the phone screen is one flat, solid bright-green rectangle (chroma key) with nothing on it — it stays exactly that green, flat and blank; no picture, no text ever appears on it.",
}
NAME = {k: k.split(" ")[0].title() for k in WHO if k.split(" ")[0] in ("YUNA", "TAEJUN", "MINJAE")}

GENRE = "a Korean romance brand film (a premium short-film advert)"
LOOK = ("LOOK: a premium Korean romance brand film — real cinema camera, natural skin texture, matte lips, true-to-life colors. "
        "Keep the first frame's light, colors and white balance to the very end — the pink-and-teal neon of the rainy night, the soft grey daylight "
        "rain, the warm pub, the cool store light, the sunshine after the rain — with no new light and no color shift; wherever rain falls in the first "
        "frame it keeps falling. The acting is subtle and natural, as in a calm Korean romance drama: small, believable expressions, never "
        "exaggerated, no big toothy grins. The camera moves only as written in CAMERA — where CAMERA says still, it is still. No new text, letters, "
        "logos or labels. Never add a person who is not in the first frame unless ACTION says so.")
SILENT = "SOUND: silent clip — no dialogue, no narration, no music."
MAXLEN = 8   # 웹 판 길이 상한(꾸러미점검 4~8초) — 쓰는 초 + 0.8이 넘으면 여유를 줄이고 「여유」 칸에 적는다


def shake(k):
    v = SHAKE.get(k)
    return 0.15 if v is None else v


# 고정은 긍정문 먼저, 그다음 하지 말 것 — 「locked off」만으로는 0.17초부터 움직이고 부정문만으로는 계속 밀고 들어간 보고(7번 · 5번 세션 메모)
def still():
    return "static frame — the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake."


def jit(k, cap=0.4):
    x = max(0.1, min(cap, round(shake(k) * 20) / 20))
    return (f"handheld, the camera stays in place: small constant handheld jitters of about {x:g}% of the frame width — it shakes but does not travel, "
            "no push-in, no zoom, holding the same framing to the end.")


def focus(a, b, t0, t1):
    return f" Rack focus: from about {t0:g} s to {t1:g} s the focus shifts smoothly from {a} to {b}, and stays there."


# ── 컷마다: 누구 · 동작 · 카메라(원본) · 말[(누가 키, 대사, 시작 초, 꼴)] · 끝 그림 · 후반 ──
# 꼴: 입(입이 보이는 입 맞춤 26컷) · 가림(화면 밖 · 입이 가려진 말 — 방식 B일 때만 그 판에서 목소리를 만든다)
C = {}


def cut(k, who, action, camera, says=(), end=None, post=None, closed=None):
    C[k] = {"누구": who, "동작": action, "카메라": camera, "말": list(says), "끝그림": end, "후반": post, "다문입": closed}


YC, TN, TT, MB = "YUNA (cardigan)", "TAEJUN (shirt, no tie)", "TAEJUN (shirt and tie)", "MINJAE (beige vest)"
YW, YB, TB, TH, TJ, MG = "YUNA (white blouse)", "YUNA (taupe blazer)", "TAEJUN (blue shirt)", "TAEJUN (blue shirt, headphones)", "TAEJUN (navy jacket)", "MINJAE (green vest)"
CU, BU, BK = "CLEAR UMBRELLA", "BLUE UMBRELLA", "BLACK UMBRELLA"

# ── 시작 편 ① 현재 — 물음(밤비 · 편의점 처마 밑) ──
cut("C01", [YC, TN, CU],
    "Night, steady rain, the small convenience store at the left: Yuna stands under the awning holding a folded clear umbrella, waiting. Taejun, a "
    "folded clear umbrella in his hand, walks a few steps from the glass door to her and stops beside her; both face the street. Rain pours off the "
    "awning edge; the wet street shimmers with pink and cyan reflections. Both keep their lips closed.",
    still(), end="C01e.jpg", post="앞 가림 층(어두운 흐린 평면이 오른쪽으로 비켜남, 가림 폭 48%→29%) · 「시작.」")
cut("C02", [YC, TN],
    "Under the awning at night, over Taejun's blurred right shoulder: Yuna looks up at him and, at about 1 s, asks him in Korean, quiet and direct, "
    "with a hint of a knowing smile: \"저 좋아하죠?\" Then she waits, eyes on him. Taejun is seen only as the blurred shoulder; he stays still and silent.",
    jit("C02"), [(YC, "저 좋아하죠?", 1.0, "입")])
cut("C03", [TN, YC],
    "Over Yuna's blurred left shoulder: Taejun looks down at her, caught off guard. At about 0.4 s his eyes drop to her lips and come straight back "
    "up to her eyes; at about 1.0 s he swallows — his throat moves — and his lips part as if to answer, then close again. He does not answer; lips "
    "closed at the end.",
    still())
cut("C04", [YC, TN],
    "Over Taejun's blurred right shoulder: Yuna waits for his answer, then at about 2.5 s asks again in Korean, more firmly, no smile now, her chin "
    "lifted slightly: \"좋아하냐고요.\" Taejun stays still and silent.",
    jit("C04"), [(YC, "좋아하냐고요.", 2.5, "입")])
cut("C05", [TN],
    "Close on Taejun: flustered, his lips part as if to answer but no sound comes; at about 1.5 s his eyes flick up to her once more, then drop "
    "again; a short breath out through the nose. Silent.",
    "slow truck to the camera's right: from about 0.3 s the camera physically slides sideways to its right by about 15% of the frame width, easing out "
    "and settling by about 2.9 s, with small handheld jitters (about 0.2% of the frame width); the pink neon band behind him drifts left across the frame.",
    closed=[TN])
# ② 제목 카드
cut("C06", [CU],
    "Product title shot behind a sheet of rain-beaded glass: the open clear umbrella stands still in the left third; a few raindrops slowly run down the "
    "glass. Nothing else moves; the right half stays empty glass.",
    still(), post="뿌연 밝은 판이 0.8–2.1초에 가라앉음 · 「다 비치는 우산, 비침」")
# ③ 회상 — 사무실
cut("C07", [TT, MB],
    "Office, daytime: Minjae leans on the low frosted-glass partition and at about 0.1 s teasingly asks Taejun in Korean: \"과장님, 연애 안 하세요?\" "
    "Taejun, at his desk, turns his head toward him. Small natural movements only.",
    still(), [(MB, "과장님, 연애 안 하세요?", 0.1, "입")])
cut("C08", [TT, YC],
    "Taejun at his desk answers Minjae (off screen, left) with a small shrug, at about 0.2 s in Korean: \"뭐, 아직은….\" and trails off: at about 3.1 s "
    "Yuna walks past in the foreground from right to left, very close to the lens and completely out of focus — a soft pink-and-white blur crossing the "
    "frame in about 1.2 s (she is the only person who enters) — and Taejun's eyes follow her.",
    still(), [(TT, "뭐, 아직은….", 0.2, "입")], post="앞을 지나는 흐린 유나 — 태준 얼굴이 흔들리면 후반 합성")
# ④ 엘리베이터
cut("C09", [TT],
    "Taejun stands alone in the walnut-paneled elevator, hands in his pockets; the steel doors slide shut from both sides. From off screen, Yuna's "
    "voice calls out in Korean at about 0.1 s: \"잠깐만요!\" — Taejun looks up.",
    still(), [(YC, "잠깐만요!", 0.1, "가림")], closed=[TT])
cut("C10", [TT],
    "Insert: Taejun's hand quickly reaches in from the right and presses the round door-open button.",
    still(), closed=[])
cut("C11", [TT, YC],
    "The elevator doors slide open again: Taejun inside holds the door with his outstretched arm; Yuna steps in quickly from the right, turns around "
    "and stands beside him with a small polite gap; he lowers his arm. Both keep their lips closed.",
    still(), end="C11e.jpg", post="오른쪽 아래 노래 표기 「♪ 태준」")
cut("C12", [TT, YC],
    "Side by side in the elevator: at about 0.1 s Yuna turns her face slightly to him and says in Korean with a small polite nod: \"고맙습니다.\" Taejun "
    "gives a small, stiff nod back and looks ahead again.",
    still(), [(YC, "고맙습니다.", 0.1, "입")])
cut("C13", [TT],
    "Close profile of Taejun facing left: tense, he keeps his head still and slides his eyes sideways to the right, toward Yuna (off screen), then "
    "quickly back; his Adam's apple moves once; one slow blink. Lips closed.",
    still())
# ⑤ 회식
cut("C14", [TN, MB, CU],
    "In the warm pub, Minjae leans toward Taejun with a teasing grin and asks in Korean at about 1.0 s: \"이 자리에 좋아하는 사람 있죠?\" Taejun laughs "
    "and waves his raised hand to brush it off, saying in Korean at about 4.0 s: \"에이, 없어요.\" The other customers stay blurred; in the foreground the "
    "folded clear umbrella hangs from the bench back, a drop of water falling from its tip.",
    "slow push-in that speeds up: from about 0.7 s the camera physically moves forward toward the two men, gently at first and faster toward the end, "
    "ending about 2.5 times closer at about 7.0 s, where it nearly stops — it arrives exactly at the framing of @이미지 2. No lens zoom.",
    [(MB, "이 자리에 좋아하는 사람 있죠?", 1.0, "입"), (TN, "에이, 없어요.", 4.0, "입")], end="C14e.jpg")
cut("C15", [TN],
    "Insert of Taejun's left wrist near the table edge: on the smartwatch's dark screen one pink heart icon pulses once; his other hand quickly comes "
    "in from the left and covers the watch.",
    jit("C15"), post="시계 하트 — AI가 틀리면 후반 합성(숫자 없이 하트 하나)")
cut("C16", [YC],
    "Yuna lifts her beer glass halfway, stops, and looks across the table toward the left of frame at Taejun over its rim — a quiet, searching "
    "look; she does not drink. Lips closed.",
    still())
cut("C17", [TN, MB],
    "Taejun keeps his right hand wrapped around his left wrist, hiding the watch, and awkwardly looks away to the lower right; Minjae beside him "
    "laughs and sips his beer, unaware. No one speaks.",
    jit("C17", cap=0.25))
# ⑥ 빗길 — 우산 하나
cut("C18", [TN, YC, CU],
    "Night, heavy rain, seen from behind: Taejun walks slowly under the one clear umbrella; as the view widens, Yuna is revealed walking close beside "
    "him under the same umbrella — his right hand grips the handle between them and tilts the canopy over her head, while his left shoulder is out "
    "in the rain, the white shirt soaked. They walk in step, silent.",
    "the camera physically pulls back and slides to its right: from about 1.5 s to 5.3 s, at an even speed, it moves back about 40–50% and to its "
    "right about 20%, revealing Yuna at the right; it arrives exactly at the framing of @이미지 2.",
    end="C18e.jpg")
# ⑦ 편의점
cut("C19", [YC, TN, CU],
    "Under the awning at night: Yuna in front tucks wet strands of hair behind her ear and glances down; behind her Taejun shakes the rain off his "
    "folded clear umbrella and brushes his soaked left shoulder. At about 4.5 s he glances at the back of her head and looks away the moment she "
    "half-turns; at about 6 s her eyes land on his wet shoulder — she notices. Neither speaks.",
    still())
cut("C20", [YC, TN],
    "Two faces at different depths: Yuna's profile in front, sharp — she glances at his wet shoulder, then peers down into the shop window and, at "
    "about 0.3 s, mutters to herself in Korean at an easy pace: \"어깨 다 젖으셨네… 하나 사야겠다. 어디 있더라.\" Behind her, out of focus, Taejun "
    "watches her quietly; when the focus reaches him his face is soft and unguarded, lips closed.",
    still() + focus("Yuna's profile in front", "Taejun behind her", 4.2, 5.2) + " It ends exactly on @이미지 2 — Taejun sharp, Yuna a soft blur.",
    [(YC, "어깨 다 젖으셨네… 하나 사야겠다. 어디 있더라.", 0.3, "입")], end="C20e.jpg", closed=[TN])
cut("C21", [YC, TN, CU],
    "Over Yuna's shoulder inside the store: she looks along the rows of folded umbrellas on the open-backed stand, her hand hovering. From off screen "
    "Taejun's voice says in Korean at about 0.5 s: \"거기, 투명한 거요.\" Yuna's face is not seen.",
    still(), [(TN, "거기, 투명한 거요.", 0.5, "가림")], closed=[YC])
cut("C22", [YC, TN],
    "Seen through the umbrella stand, its folded umbrellas a soft pale blur in front of the lens: Yuna, at the right, turns her head toward Taejun "
    "with a curious half-smile and asks him in Korean at about 1.8 s: \"제가 투명한 거 좋아하는 건 어떻게 알아요?\" Taejun, in profile at the left, "
    "keeps his lips closed; his eyes slide away from her for a moment.",
    still(), [(YC, "제가 투명한 거 좋아하는 건 어떻게 알아요?", 1.8, "입")])
cut("C23", [TN, YC, CU],
    "Taejun, embarrassed, rubs his ear and lowers his eyes; behind him, out of focus, Yuna lifts one premium clear umbrella off the stand and looks at "
    "it. At about 1.5 s he glances back over his shoulder toward her for half a second and turns away again, rubbing his ear. Nobody speaks.",
    still(), closed=[TN, YC], post="김 서린 유리 · 손글씨 겹침(2.1–3.2초) · 좌우 띠 열림(6.1–7.8초) · 태준 속말 「몰랐다. 숨긴다고 숨긴 게, 다 보이고 있었다는 걸.」(2.5초~)")
# ⑨ 현재 — 들킴
cut("C24", [YC, TN],
    "Under the awning at night, over Taejun's blurred shoulder: Yuna looks up at him and asks again, gently and directly, in Korean at about 1.7 s: "
    "\"저 좋아하죠?\"",
    jit("C24"), [(YC, "저 좋아하죠?", 1.7, "입")])
cut("C25", [TN],
    "Taejun drops his gaze and mumbles in Korean at about 0.7 s, evasive: \"아니, 뭐….\" then falls silent with a short, embarrassed breath of a laugh.",
    jit("C25"), [(TN, "아니, 뭐….", 0.7, "입")])
cut("C26", [YC, TN, CU],
    "Night rain: Yuna and Taejun stand side by side under the awning, small in the frame, each holding a folded clear umbrella, looking out at the rain. "
    "Rain pours off the awning; the reflections on the wet street shimmer. They barely move.",
    still())
cut("C27", [YC, TN],
    "Side by side under the awning: Yuna, beyond Taejun's blurred profile, smiles to herself, then turns her head toward him and points it out in Korean "
    "at about 2.5 s, warm and teasing: \"아까 우산, 다 제 쪽으로 기울였잖아요. 어깨 다 젖고.\" Taejun, out of focus in the foreground, reacts in profile "
    "without a word: a slow blink at the word 우산, his jaw tightens, and at about 5 s his eyes drop toward his own wet shoulder.",
    "slow truck to the camera's left: from about 0.5 s the camera physically slides sideways to its left by about 7% of the frame width, easing out by "
    "about 5.9 s; no push-in, no zoom.",
    [(YC, "아까 우산, 다 제 쪽으로 기울였잖아요. 어깨 다 젖고.", 2.5, "입")])
cut("C28", [TN, CU],
    "Taejun, the folded clear umbrella held at chest height, looks down at his soaked left shoulder, then at the umbrella, caught out; lips closed. At about 2.9 s "
    "Yuna's voice, off screen, begins in Korean: \"다 보여요,\"",
    still(), [(YC, "다 보여요,", 2.9, "가림")], closed=[TN])
cut("C29", [YC],
    "Yuna, in near profile with her face low in the frame, lifts her eyes to him and, smiling warmly, right away finishes in Korean: \"…과장님.\"",
    still(), [(YC, "…과장님.", 0.1, "입")])
cut("C30", [TN, YC],
    "Macro insert at hip height: Taejun's empty hand hangs by his side (his folded umbrella is in his other hand, out of frame); Yuna's hand comes "
    "in from the upper left and slips into his; his hand hesitates for a beat, then his fingers close around hers.",
    still(), closed=[])
cut("C31", [TN],
    "Close on Taejun from low below his chin: he looks down at her, surprised, his eyes widening; lips just parted, silent.",
    jit("C31"), closed=[TN])
# ⑩ 제품 · 끝
cut("C32", [CU],
    "High-speed slow-motion product shot: two folded clear umbrellas lying on their sides in a neon-lit puddle roll together and knock; a crown of water "
    "splashes up between them, droplets hanging in the air; a pink flash of light sweeps across the frame twice (at about 0.5 s and 2.3 s).",
    "the camera holds still, low at the puddle; real high-speed slow motion for this shot only.",
    post="물리가 어색하면 블렌더 우산 모델로 다시")
cut("C33", [],
    "Insert of the rain puddle at night: the water ripples, smearing the pink, purple and gold neon reflections; no person is recognizable.",
    "static frame — only the reflection drifts slowly right and up (about 10%) as the water ripples; the camera itself does not move.")
cut("C34", [TN, YC],
    "Under the awning in soft pink light: Taejun gently takes Yuna's arm and steps closer; she looks up at him; they stand face to face, a hand's "
    "breadth apart, silent.",
    still(), closed=[TN, YC], post="노래 후렴 — C34 마지막 1초 페이드(시작 편 끝 카드를 뺀 자리)")

# ── 끝 편 ① 현재 — 마주 섬(낮비) ──
cut("C35", [YB, TJ, CU, BU, BK],
    "Daytime rain in front of the same convenience store, seen from the ground in a tilted low angle: Taejun, from behind and close to the camera, "
    "stands under his open clear umbrella, the folded misty-blue umbrella in his other hand; a few metres beyond him Yuna faces him under her black "
    "umbrella. They stand still, looking at each other; rain falls steadily. At about 1.5 s Yuna lowers her black umbrella an inch so its rim hides "
    "her eyes from him; Taejun's clear umbrella does not move. Lips closed.",
    still(), closed=[YB, TJ], post="「끝.」은 두 화 판에만(오른쪽)")
cut("C36", [YB, BK],
    "Yuna under her black umbrella looks at Taejun and says quietly in Korean at about 0.1 s: \"넌 그대로다.\" She says it flatly, eyes steady, "
    "almost without expression; one drop falls from the rim of the black canopy in front of her face.",
    still(), [(YB, "넌 그대로다.", 0.1, "입")])
cut("C37", [TJ, CU],
    "Taejun under his clear umbrella, seen from below, the grey sky and treetops visible through the canopy, looks down at her; his eyes move once "
    "across her face as if searching for the old expression; at about 1.2 s he draws a breath to answer and lets it go without a word; rain beads "
    "slide down the canopy above him. Lips closed.",
    "slow roll: from about 0.3 s to 1.8 s the camera slowly rolls about 3 degrees counter-clockwise at an even speed, with small handheld jitters (about "
    "0.15% of the frame width); no push-in, no zoom.")
cut("C38", [TJ, YB],
    "Taejun under his clear umbrella looks at Yuna; as the view slides right and the focus comes to Yuna in the foreground, she lowers her eyes and says "
    "softly in Korean at about 3.4 s: \"여전히 다 보여.\"",
    "slow truck to the camera's right: from about 0.6 s to 3.9 s the camera physically slides sideways to its right by about 16% of the frame width at an "
    "even speed; no push-in, no zoom." + focus("Taejun", "Yuna in the foreground", 1.1, 1.9),
    [(YB, "여전히 다 보여.", 3.4, "입")], closed=[TJ])
cut("C39", [TJ, CU],
    "Close on Taejun under the clear canopy beaded with rain: his eyes redden and fill with tears, but he holds it in, lips pressed together; one "
    "blink pushes a tear to the lower lid; it does not fall.",
    jit("C39"), closed=[TJ])
# ② 제목 카드
cut("C40", [BU],
    "Product title shot behind rain-beaded glass: the open misty pale-blue umbrella stands still in the left third; a few raindrops run down the glass.",
    still(), post="뿌연 판이 0.5–2.1초에 가라앉음 · 글자 없음")
# ③ 회상 — 사무실(앞날)
cut("C41", [TB, MG],
    "Office, daytime: Minjae leans on the partition and asks Taejun with a suspicious grin in Korean at about 0.1 s: \"과장님, 요즘 사내 연애 하시는 거 "
    "아니죠?\" Taejun, at his desk, lets out a short sigh in Korean at about 2.5 s: \"아….\"",
    still(), [(MG, "과장님, 요즘 사내 연애 하시는 거 아니죠?", 0.1, "입"), (TB, "아….", 2.5, "입")])
cut("C42", [YW, TB],
    "In the office, Taejun in the background turns to look at Yuna; she keeps her eyes lowered, cool and closed off. No one speaks.",
    still() + focus("Taejun in the background", "Yuna in the foreground", 1.9, 2.4), closed=[YW, TB])
# ④ 엘리베이터
cut("C43", [TH, YW],
    "Taejun inside the elevator, headphones on, holds the door open with his outstretched arm; from off screen Yuna's voice says flatly in Korean at "
    "about 0.1 s: \"잠깐만요.\" She steps in from the right without a word, turns around and stands beside him, a little apart, not looking at him.",
    still(), [(YW, "잠깐만요.", 0.1, "가림")], end="C43e.jpg", closed=[TH], post="오른쪽 아래 노래 표기 「♪ 유나」")
cut("C44", [YW, TH],
    "Over Taejun's blurred shoulder: Yuna glances up at him with a hurt, wistful look, then lowers her eyes; his hand rises toward his headphones at "
    "the left edge. Lips closed.",
    still(), closed=[YW])
cut("C45", [TH, YW],
    "Taejun belatedly pulls his headphones down around his neck; Yuna glances at him sideways, then looks ahead. Silent.",
    still(), closed=[TH, YW])
cut("C46", [TB, YW],
    "Insert on the steel handrail: Taejun's hand with the smartwatch moves toward Yuna's hand to hold it; just before he touches it, she slides her hand "
    "away off the rail.",
    still(), closed=[], post="태준 속말 「그날, 내 손을 피했지.」")
# ⑤ 회식
cut("C47", [YW],
    "In the warm pub, Minjae's voice asks from off screen in Korean at about 0.1 s: \"이 자리에 좋아하는 사람 있죠?\" Yuna, looking at him, freezes for a "
    "moment, then answers coldly in Korean at about 3.5 s: \"아니요.\"",
    still(), [(MG, "이 자리에 좋아하는 사람 있죠?", 0.1, "가림"), (YW, "아니요.", 3.5, "입")])
cut("C48", [TB, MG, CU],
    "Taejun leans forward and pours beer from a plain brown bottle into Minjae's glass, cutting him off in Korean at about 0.1 s, dry and even: "
    "\"쓸데없는 소리 말고 잔이나 비워.\" Then he sets the bottle down and glances across the table toward Yuna (off screen, left), silent. Minjae, "
    "blurred at the right edge, keeps quiet.",
    still(), [(TB, "쓸데없는 소리 말고 잔이나 비워.", 0.1, "입")], closed=[MG], post="태준 속말 「넌 눈 하나 깜짝 안 하더라.」(2.4초~)")
# ⑥ 빗길 — 우산 둘
cut("C49", [YB, TJ, CU, BK],
    "Daytime rain on a tree-lined sidewalk: Yuna walks under her black umbrella, eyes down; Taejun walks a few steps ahead under his clear umbrella; at "
    "about 4.5 s he stops and turns to look back at her. A clear gap between them. Lips closed.",
    "tracking: from about 1.2 s the camera physically moves sideways to its right alongside them at walking pace, about 30% of the frame width by about "
    "5.5 s, and stops when Taejun stops.", closed=[YB, TJ])
# ⑦ 편의점
cut("C50", [TJ, YB, CU, BK],
    "Under the awning: the shot starts on Taejun's out-of-focus jacket shoulder right in front of the lens; as the camera rises, Taejun, his clear "
    "umbrella just folded in one hand, takes out his phone and looks down at it; behind him Yuna, her black umbrella folded in her hand, looks at him "
    "and asks in Korean at about 4.9 s: \"뭐 봐?\"",
    "following: the shot starts close on Taejun's chest and jacket, his face cut by the top edge; from about 1.0 s the camera rises about 16% and "
    "eases back, speeding up a little, and by about 6.1 s it arrives exactly at the framing of @이미지 2 — Taejun in a medium shot looking down at "
    "his phone, his folded umbrella in his other hand, Yuna behind him under the awning. No lens zoom.",
    [(YB, "뭐 봐?", 4.9, "입")], end="C50e.jpg", closed=[TJ])
cut("C51", [TJ, YB, "GREEN SCREEN"],
    "Over Yuna's blurred shoulder: Taejun, caught looking at his phone, lowers it — for the first 1.2 s its green screen is tilted toward the camera — "
    "and says too quickly in Korean at about 0.3 s: \"응? 아무것도 아냐.\" He slips the phone into his inside pocket and avoids her eyes.",
    "almost static: the frame drifts slowly to the right by about 3% between 0.5 s and 3.8 s; no push-in, no zoom.",
    [(TJ, "응? 아무것도 아냐.", 0.3, "입")], post="휴대폰 화면 사진 — 우리 C18e 그림을 초록 화면에 합성")
cut("C52", [TJ, BU],
    "From knee height inside the umbrella stand, looking steeply up past the ceiling lights: Taejun lifts a folded misty-blue umbrella off the stand, "
    "looks down at it, and at about 1.2 s starts to say softly in Korean: \"이거,\"",
    still(), [(TJ, "이거,", 1.2, "입")])
cut("C53", [TJ, YB, BU, BK],
    "In the store aisle, Taejun holds the folded misty-blue umbrella a little toward Yuna and says gently in Korean at about 0.2 s: \"…너 좋아하겠다.\" "
    "Yuna, holding her own folded black umbrella, looks at it and does not take it; a long silence; at about 6.0 s she looks up at him and asks quietly "
    "in Korean: \"바빠?\" Taejun lowers the umbrella and answers in Korean at about 8.5 s: \"아니, 괜찮아.\" He looks at her face for a moment, "
    "understands, and says quietly in Korean at about 11.8 s: \"…할 말 있구나.\" Yuna holds his gaze, then looks down.",
    still(), [(TJ, "…너 좋아하겠다.", 0.2, "입"), (YB, "바빠?", 6.0, "입"), (TJ, "아니, 괜찮아.", 8.5, "입"), (TJ, "…할 말 있구나.", 11.8, "입")])
cut("C54", [YB, BK],
    "Yuna holds her folded black umbrella low in front of her and lowers her eyes. At about 2 s her thumb rubs the umbrella handle once; at about "
    "3.5 s she closes her eyes for a slow second and opens them; at about 5.5 s she breathes out and her shoulders drop a little. No words.",
    still(), closed=[YB], post="김 서린 유리 · 손글씨 겹침(2.1–3.2초) · 좌우 띠 열림(4.6–6.8초) · 유나 속말 「우리, 한때는 서로가 다 보였다.」")
# ⑨ 현재 — 끝맺음(처마 밑 · 두 우산 다 접힘)
cut("C55", [TJ, YB, CU, BU],
    "Under the awning, over Yuna's blurred shoulder: Taejun, his own clear umbrella folded in his hand, looks down at her and says gently in Korean at "
    "about 1.15 s: \"검은 거 말고 이거 써.\"",
    still(), [(TJ, "검은 거 말고 이거 써.", 1.15, "입")])
cut("C56", [TJ, BU],
    "Insert: Taejun's hand holds out the folded misty-blue umbrella toward her; under the shot his voice goes straight on in Korean: "
    "\"너 투명한 거 좋아하잖아.\"",
    still(), [(TJ, "너 투명한 거 좋아하잖아.", 0.0, "가림")])
cut("C57", [YB],
    "Under the awning: for the first half Yuna's eyes are on the offered umbrella (below the frame), not on him; at about 0.8 s she says quietly in "
    "Korean: \"이런 거 자꾸 챙겨 주지 마. 나중에 생각나.\" — she swallows before 나중에 생각나, and only at the end lifts her eyes to him.",
    still(), [(YB, "이런 거 자꾸 챙겨 주지 마. 나중에 생각나.", 0.8, "입")])
cut("C58", [TJ, YB],
    "Over Yuna's blurred shoulder: Taejun answers with forced calm in Korean at about 1.7 s: \"그냥… 비 맞을까 봐.\" and drops his gaze.",
    still(), [(TJ, "그냥… 비 맞을까 봐.", 1.7, "입")])
cut("C59", [YB],
    "Extreme close-up of Yuna's eyes: tears well up and tremble on the lower lids but do not fall; one slow blink at about 1.0 s; she keeps "
    "looking at him. No words.",
    still(), closed=[YB])
cut("C60", [TJ],
    "Extreme close-up of Taejun's eyes, wet: he looks at her; at about 2 s his eyes move down (to the umbrella in her hands, off screen) and come "
    "back up at about 3 s; his lips press together; at about 5 s one tear reaches his lower lashes and stays there; his face drifts very slightly "
    "to the right. No words.",
    "almost static: the camera holds; only his face drifts very slightly to the right; no push-in, no zoom.", closed=[TJ],
    post="태준 속말 「우산을 접고 나니, 서로의 얼굴이 다 말해 버렸다. 여기까지라는 걸.」")
cut("C61", [YB],
    "Close on Yuna, tears in her eyes: she says goodbye in Korean at about 0.3 s, small and broken: \"…잘 지내.\"",
    still(), [(YB, "…잘 지내.", 0.3, "입")])
cut("C62", [TJ, YB, BU, CU, BK],
    "Wide, daytime rain: Yuna, under the open misty-blue umbrella and with her folded black umbrella in her other hand, walks away to the right with "
    "her back to him; Taejun, under the awning with his folded clear umbrella, turns and watches her go. Neither speaks.",
    still(), closed=[TJ, YB], post="오른쪽 아래 노래 표기 「♪ 태준」")
cut("C63", [TJ],
    "Close on Taejun under the awning: his eyes track her slowly to the right as she walks away; at about 2 s he swallows; at about 3.5 s his gaze "
    "drops to the folded clear umbrella in his hand and he exhales. No other movement.",
    jit("C63"), closed=[TJ])
# ⑩ 제품 · 비 그침 · 끝
cut("C64", [CU, BU],
    "High-speed slow-motion product shot in the daytime: a folded clear umbrella and a folded misty-blue umbrella fall and hit the shallow puddle side by "
    "side; water splashes up around them, droplets hanging in the air.",
    "the camera holds still, low at the puddle; real high-speed slow motion for this shot only.")
cut("C66", [TJ, CU],
    "Under the awning, seen from below: Taejun's open hand comes forward toward the camera, palm up, large in the frame; he watches it — no rain lands "
    "on it — then looks up at the sky as sunlight breaks through, and at about 1.8 s says softly in Korean, a little surprised: \"어, 비 그쳤네.\"",
    still(), [(TJ, "어, 비 그쳤네.", 1.8, "입")], post="검은 화면에서 페이드 인(0–0.95초)")
cut("C67", [CU],
    "Insert in bright sun: Taejun's hand lifts his folded clear umbrella up into the sunlight; the water drops on the canopy glitter; a soft lens flare "
    "drifts across.",
    still())
cut("C68", [TJ],
    "Close profile of Taejun: eyes closed, he lifts his face to the warm sun and takes a slow breath.",
    still(), closed=[TJ])
cut("C69", [],
    "Insert of the puddle mirroring blue sky and white clouds: at about 2.4 s a man's black leather shoe steps into it, splashing; another foot passes "
    "after it. (The shoe is Taejun's — only his foot is seen.)",
    still())
cut("C70", [TJ],
    "Taejun walks toward the camera down the tree-lined street after the rain, his hands below the frame; wet eyes and a faint smile — not "
    "relief, the smile of letting go while it still hurts; near the end he passes the camera on its left.",
    "the camera physically pulls back at walking speed as Taejun walks toward it, about 26% back and about 20% up between 0.3 s and 2.0 s at an even "
    "speed, so his face stays the same size; no lens zoom.",
    closed=[TJ], post="끝 카드 「비 오는 날, 서로가 보이게 — 다 비치는 우산, 비침 · 새 색」(두 우산 나란히, 2.4초부터)")

# 두 샷 묶음 — 편집 차례로 붙은 두 컷이 같은 장소 · 같은 때 · 같은 사람이고 쓰는 초 합이 6초 안팎일 때만, 말하는 사람은 한 사람(시댄스무제한 README 「두 샷 묶기 규칙」)
BUNDLES = [("C09", "C10"), ("C15", "C16"), ("C28", "C29"), ("C30", "C31"), ("C36", "C37"), ("C55", "C56"), ("C67", "C68")]
SPLIT = {"C53": 7.2}   # 14.39초 롱테이크 — 「바빠?」 뒤 침묵에서 두 토막(뒤 토막 첫 그림 = 앞 토막 받은 영상의 끝 프레임, 안 되면 C53.jpg)

# ── 요즘 기법으로 바꾼 컷(10-30 연출 · 앵글 검수 「요즘 기법」 절 가운데 근거 · 시작 그림 · 시댄스 셋이 다 되는 것만 — 7번 CHANGES와 같은 꼴) ──
# 주판은 바꾼 카메라, 원본 카메라 판은 「대안」(id 끝 o)으로 하나씩 — 받은 뒤 나란히 보고 고른다. 컷 길이 · 순서 · 이야기는 그대로.
# 근거 원자료: git 밖 레퍼런스/카메라요즘/p7/{웹,시댄스}/요약.md(7번이 10-29에 모은 것). 뺀 제안: C31 스냅 푸시(0.79초 · 근거 약함), C23 · C54 푸시(김 서림 ·
# 손글씨 합성이 카메라를 따라가야 함), C66 손바닥→얼굴 틸트(새 시작 그림이 필요 — 다시 구운 C66이 손을 렌즈 쪽으로 내밀어 차례는 지시문으로), C01 행인 와이프(후반 계획을 바꿈).
SLOW_WHY = ("근거: Heimann 외 2019(PLoS ONE 14(3):e0211026, EEG 16명) — 몸으로 다가가는 숏이 고정 · 줌보다 감각운동 반응과 실감이 큼, 2025 훙궈 연간 1위 "
            "로맨스 《盛夏芬德拉》 감독 穆裕가 감정 박에 느린 움직임을 썼다고 직접 씀(7번 근거 원자료 레퍼런스/카메라요즘/p7/웹/요약.md, 확인일 10-29). "
            "시댄스 2.5 천천히 다가가기 「확인됨」(같은 곳 시댄스/요약.md). 움직임만으로 감정이 세지지는 않아(Yilmaz) 원본 고정 판과 나란히 보고 고른다.")
CHANGES = {
    "C30": {
        "짧게": "손에 느린 다가감 약 8%",
        "카메라": "very slow push-in: the camera physically moves about 8% closer toward the two hands over the whole shot in one slow, steady move — no "
                 "lens zoom, no shake.",
        "까닭": "손잡음 인서트(2.46초) — 손이 닿는 순간 화면이 조금 다가가면 「잡힘」이 사건이 된다(연출 · 앵글 검수). " + SLOW_WHY,
    },
    "C59": {
        "짧게": "눈에 거의 안 보이는 다가감 약 3%",
        "카메라": "an almost imperceptible push-in: the camera physically moves about 3% closer to her eyes over the shot in one slow, steady move — no "
                 "lens zoom, no shake.",
        "까닭": "눈물 클로즈업 — 고정보다 눈물의 때를 기다리게 만드는 「속마음 샷」(연출 · 앵글 검수). 얼굴이 화면 대부분이라 3%로 작게(크게 주면 얼굴이 "
               "뭉개짐). " + SLOW_WHY,
    },
    "C60": {
        "짧게": "눈에 거의 안 보이는 다가감 약 3%",
        "카메라": "an almost imperceptible push-in: the camera physically moves about 3% closer to his eyes over the whole shot in one slow, steady move "
                 "while his face drifts very slightly to the right — no lens zoom, no shake.",
        "까닭": "속말이 깔리는 6.9초 — 편에서 가장 긴 얼굴 컷. 눈물이 맺히는 때(5초)를 향해 아주 조금 다가간다(연출 · 앵글 검수). " + SLOW_WHY,
    },
}


# ── 소리 ──
def syl(s):
    return len(re.findall(r"[가-힣0-9]", s))


def line_secs(s):
    return round(syl(s) / 5.5 + 0.25, 2)   # 광고 대사는 7번 숏드라마(6음절)보다 느리게 — 초당 5.5음절 + 숨


def voice(names, two_lines):
    if len(names) == 1:
        return ("VOICE: @오디오 1 is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, but never play it "
                f"and never say its words; perform only the Korean {'lines' if two_lines else 'line'} written above, the way this moment demands. Only that "
                "dialogue and quiet room sound — no music, no other voices.")
    samples = " and ".join(f"@오디오 {i + 1} is only a sample of {n}'s voice" for i, n in enumerate(names))
    return (f"VOICE: {samples} — copy each one's timbre, age, pitch and Korean accent exactly, but never play the samples and never say their words; each "
            "person performs only their own Korean lines written above, the way this moment demands. Only that dialogue and quiet room sound — no music, "
            "no other voices.")


def closed_text(keys):
    names = [NAME[k] for k in keys if k in NAME]
    if not names:
        return "no one else speaks."
    pron = {"Yuna": "her", "Taejun": "his", "Minjae": "his"}
    if len(names) == 1:
        return f"{names[0]} keeps {pron[names[0]]} lips closed and silent the whole time."
    return " and ".join(names) + " keep their lips closed and silent the whole time."


def sound_lines(keys):
    """판 하나의 SOUND 줄(방식마다). 말하는 사람이 둘이면 VOICE 견본도 둘(@오디오 1 · 2, 말하는 차례대로)."""
    says = [s for k in keys for s in C[k]["말"]]
    if not says:
        return None
    speakers = []
    for s in says:
        if NAME[s[0]] not in speakers:
            speakers.append(NAME[s[0]])
    others = []
    for k in keys:
        cl = C[k].get("다문입")
        if cl is None:
            cl = [w for w in C[k]["누구"] if w in NAME and NAME[w] not in speakers]
        others += [w for w in cl if w not in others and NAME.get(w) not in speakers]
    ct = closed_text(others)
    lip = any(s[3] == "입" for s in says)
    two = len(says) > 1
    who = " and ".join(speakers)
    words = "the Korean words written in ACTION" if two else "this one Korean line"
    hidden = [i + 1 for i, k in enumerate(keys) if C[k]["말"] and all(s[3] == "가림" for s in C[k]["말"])] if len(keys) > 1 else []
    hid = "".join(f" In SHOT {i} the speaker's mouth stays hidden exactly as written there." for i in hidden)
    off = [NAME[s[0]] for s in says if s[3] == "가림"]
    offt = f" {', '.join(sorted(set(off)))} is heard but not seen speaking, exactly as written in ACTION." if off and lip and len(keys) == 1 else ""
    if lip:
        return {
            "A": f"SOUND: the reference audio is the exact recorded {'lines' if two else 'line'} for this video — the speaker's lips move exactly with it, word for "
                 f"word, wherever the mouth is visible; do not re-voice, re-time or change it.{hid}{offt} No music, no narration, no other voices; {ct}",
            "B": f"SOUND: {who} {'speak' if len(speakers) > 1 else 'speaks'} only {words} with natural Korean pronunciation and the timing written in ACTION, the "
                 f"lips clearly forming the Korean words wherever the mouth is visible.{hid}{offt} No music, no narration, no other voices; {ct}\n{voice(speakers, two)}",
            "없음": f"SOUND: {who} {'speak' if len(speakers) > 1 else 'speaks'} only {words} with natural Korean pronunciation and the timing written in ACTION, the "
                    f"lips clearly forming the Korean words wherever the mouth is visible.{hid}{offt} No music, no narration, no other voices; {ct}",
        }
    return {   # 가림 — 방식 A · 없음은 소리 끔(목소리는 편집에서), B만 그 판에서 목소리를 만든다
        "A": SILENT,
        "B": f"SOUND: only {who}'s voice saying {words}, with the timing written in ACTION; the speaker's mouth is not seen, exactly as written in ACTION. No "
             f"music, no narration, no other voices; {ct}\n{voice(speakers, two)}",
        "없음": SILENT,
    }


def used(k):
    return INFO[k]["길이"]


def fit_len(x):
    return min(MAXLEN, max(4, math.ceil(x - 1e-9)))


def says_out(k, base=0.0, lo=0.0, hi=None):
    out = []
    for w, line, t0, kind in C[k]["말"]:
        if t0 < lo or (hi is not None and t0 >= hi):
            continue
        out.append({"누가": w, "대사": line, "시작초": round(base + t0 - lo, 2), "꼴": "입 맞춤" if kind == "입" else "입 가림 · 화면 밖",
                    "음절": syl(line), "어림초": line_secs(line)})
    return out


def shot(k, lo=0.0, hi=None, orig=False):
    s = C[k]
    i = INFO[k]
    u = round((hi if hi is not None else used(k)) - lo, 2)
    new = k in CHANGES and not orig
    out = {"컷": k, "그림": f"{k}.jpg", "쓰는초": u, "누구": s["누구"], "동작": s["동작"], "카메라": CHANGES[k]["카메라"] if new else s["카메라"],
           "회상": i["회상"]}
    if new:
        out["요즘기법"] = {"짧게": CHANGES[k]["짧게"], "까닭": CHANGES[k]["까닭"], "원본카메라": s["카메라"]}
    if s.get("끝그림"):
        out["끝그림"] = s["끝그림"]
    m = says_out(k, 0.0, lo, hi)
    if m:
        out["말"] = m
    if s.get("후반"):
        out["후반"] = s["후반"]
    return out


def sound_flag(keys):
    kinds = [x[3] for k in keys for x in C[k]["말"]]
    return "켬" if "입" in kinds else ("B만 켬" if kinds else "끔")


def single(k, orig=False):
    s = shot(k, orig=orig)
    want = used(k) + 0.8
    p = {"id": f"rs-{k}", "컷": [k], "길이": fit_len(want), "설명": INFO[k]["화면"], "소리": sound_flag([k]), "샷": [s]}
    if want > MAXLEN:
        p["여유"] = f"쓰는 초 {used(k):.2f} + 0.8초가 {MAXLEN}초를 넘어 앞 여유를 {MAXLEN - used(k):.2f}초로 줄임 — 시댄스가 늦게 오면 끝을 0.9배로 늘린다"
    if p["소리"] != "끔":
        p["소리참고"] = {"A": "", "B": "", "없음": None}
        p["소리줄"] = sound_lines([k])
        m = s.get("말") or []
        if m:
            end = max(x["시작초"] + x["어림초"] for x in m) + 0.8
            if end > p["길이"]:
                p["B길이"] = fit_len(end)
    return p


def split(k, at):
    a, b = shot(k, 0.0, at), shot(k, at, None)
    b["그림"] = f"(rs-{k}a 받은 영상의 끝 프레임 — 안 되면 {k}.jpg)"
    b["동작"] = ("The same long take continues from the end of the previous clip. Taejun lowers the umbrella and answers in Korean at about 1.3 s: "
                "\"아니, 괜찮아.\" He looks at her face for a moment, understands, and says quietly in Korean at about 4.6 s: \"…할 말 있구나.\" Yuna holds "
                "his gaze, then looks down.")
    a["동작"] = ("In the store aisle, Taejun holds the folded misty-blue umbrella a little toward Yuna and says gently in Korean at about 0.2 s: "
                "\"…너 좋아하겠다.\" Yuna, holding her own folded black umbrella, looks at it and does not take it; a long silence; at about 6.0 s she "
                "looks up at him and asks quietly in Korean: \"바빠?\"")
    pans = []
    for tag, s, keys_says in (("a", a, [x for x in C[k]["말"] if x[2] < at]), ("b", b, [x for x in C[k]["말"] if x[2] >= at])):
        tmp = dict(C[k], 말=[(w, l, t - (0 if tag == "a" else at), kd) for w, l, t, kd in keys_says])
        C[f"{k}{tag}"] = tmp
        p = {"id": f"rs-{k}{tag}", "컷": [k], "토막": tag, "길이": fit_len(s["쓰는초"] + 0.8), "설명": f"{INFO[k]['화면']} — {'앞' if tag == 'a' else '뒤'} 토막",
             "소리": sound_flag([f"{k}{tag}"]), "샷": [s]}
        p["소리참고"] = {"A": "", "B": "", "없음": None}
        p["소리줄"] = sound_lines([f"{k}{tag}"])
        pans.append(p)
    return pans


def bundle(a, b, orig=False):
    sa, sb = shot(a, orig=orig), shot(b, orig=orig)
    cut_at = round(max(1.0, used(a) + 0.7), 1)
    ln = fit_len(cut_at + used(b) + 0.8)
    for x in sb.get("말", []):
        x["시작초"] = round(x["시작초"] + cut_at, 2)
    p = {"id": f"rs-{a}-{b[1:]}", "컷": [a, b], "길이": ln, "자르는초": cut_at,
         "설명": f"두 샷 묶음 — {INFO[a]['화면'].split(' — ')[0]} → {INFO[b]['화면'].split(' — ')[0]}", "소리": sound_flag([a, b]), "샷": [sa, sb]}
    if p["소리"] != "끔":
        p["소리참고"] = {"A": "", "B": "", "없음": None}
        p["소리줄"] = sound_lines([a, b])
    return p


def build():
    first = {a: b for a, b in BUNDLES}
    second = {b for _, b in BUNDLES}
    pans = []
    for k in INFO:
        if k in second or k == "C65":   # C65 검은 화면은 굽지 않는다
            continue
        if k in first:
            pans.append(bundle(k, first[k]))
        elif k in SPLIT:
            pans += split(k, SPLIT[k])
        else:
            pans.append(single(k))
    # 요즘 기법으로 바꾼 컷은 원본 카메라 판을 대안으로 하나씩(7번과 같은 꼴) — 받은 뒤 나란히 보고 고른다
    alts = []
    for p in pans:
        ch = [k for k in p["컷"] if k in CHANGES]
        if not ch:
            continue
        p["설명"] += " — 요즘 기법: " + " · ".join(f"{k} {CHANGES[k]['짧게']}" for k in ch)
        o = bundle(*p["컷"], orig=True) if len(p["샷"]) > 1 else single(p["컷"][0], orig=True)
        o["id"] = p["id"] + "o"
        o["대안"] = True
        o["설명"] = f"원본 카메라 — 요즘 기법 판({p['id']})과 나란히 보고 고름 · " + o["설명"]
        alts.append(o)
    return pans + alts


MEMO = ("로맨스 단편 「다 비침」 4분 34.9초 · 70컷 — 시댄스 2.5 웹 판 지시문(2026-10-30). 시작 그림은 이미지 콘티 정지컷(git 밖 콘티/romance/선버스트/정지컷, "
        "1920×1080, GPT Image 2.5 Sunburst · max — 유호님 확정 판으로 갈아 끼운다). 끝 그림 판은 C01 · C11 · C14 · C18 · C20 · C43 · C50(「끝그림」 = @이미지 2). "
        "요즘 기법으로 바꾼 컷 C30 · C59 · C60(느린 다가감)은 주판이 바꾼 카메라이고, 원본 카메라 판이 「대안」(id 끝 o)으로 따로 있다 — 받은 뒤 나란히 보고 "
        "고른다(샷의 「요즘기법」 칸에 까닭 · 원본 카메라). 카메라는 "
        "02_콘티 4절(원본 프레임 실측) 그대로, 손떨림 크기는 원본 배경 실측. 길이 = max(4, ⌈쓰는 초 + 0.8⌉), 상한 8초(넘으면 「여유」 칸), 두 샷 묶음은 "
        "⌈자르는 초 + 둘째 쓰는 초 + 0.8⌉(자르는 초 = 첫 쓰는 초 + 0.7). C53 14.39초 롱테이크는 두 토막(rs-C53a · rs-C53b — 뒤 토막 첫 그림은 앞 토막 받은 "
        "영상의 끝 프레임). C65 검은 화면 · 속말 다섯 · 손글씨 · 앞 가림(C01) · 휴대폰 사진(C51) · 화면 글 · 노래는 굽지 않고 편집에서(샷의 「후반」). 회상 31컷은 "
        "16:9로 받고 좌우 띠를 편집에서 씌운다(샷의 「회상」). 【7번과 같은 칸】 판의 「소리」: 켬(입 맞춤) · 끔 · 「B만 켬」(화면 밖 · 입이 가려진 말 — 방식 B일 "
        "때만 그 판에서 목소리를 만든다). 「소리참고」 {A: 그 판의 입 맞춤 대사를 앞 0.3초 무음 뒤 「말」의 시작 초에 놓은 mp3, B: 배역 목소리 견본, 없음}: "
        "목소리 방식이 정해지면 채운다(지금 비움 — 결정 10-29대로 광고 배우 대사는 B: 배역마다 목소리 판에서 처음 나온 목소리를 견본으로). 「소리줄」 {A, B, "
        "없음}: 지시문 끝 SOUND 줄. 「B길이」: 방식 B에서 대사가 컷보다 길 때 말이 끝날 때까지 받는 길이. 【7번과 다른 칸】 샷의 「말」은 목록이다(C14 · C41 · "
        "C47 · C53a는 두 사람 — 방식 B는 견본 둘 @오디오 1 · 2를 말하는 차례대로).")


def first_line(has_end):
    s = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same "
         "people, faces, hair and clothes.")
    if has_end:
        s += " @이미지 2 is the exact last frame: the camera and the people arrive at exactly that framing at the very end."
    return s


def preview(spec, p, mode):
    """웹꾸러미.py prompt()와 같은 순서 — 소리 줄만 판의 「소리줄」[방식]으로."""
    c = spec["공통"]
    shots = p["샷"]
    L = []
    slow = any("slow motion" in s["카메라"] for s in shots)
    head_tail = ("in real high-speed slow motion — no cuts, no camera switch, no speed ramp, no end card." if slow else
                 "no cuts, no camera switch, no slow motion, no speed ramp, no end card.")
    if len(shots) == 1:
        s = shots[0]
        L.append(first_line(bool(s.get("끝그림"))))
        L.append(f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, horizontal 16:9 — {head_tail}")
        L += [f"{k}: {c['누구'][k]}" for k in s["누구"]]
        L.append("ACTION: " + s["동작"])
        L.append("CAMERA: " + s["카메라"])
    else:
        t = p["자르는초"]
        L.append(f"This video is TWO SHOTS of {c['장르']}, horizontal 16:9, joined by ONE hard cut at {t:g} s — the same moment in the same place under the "
                 "same light; any person or object seen in both shots looks exactly the same in both; nobody is added who is not described for that shot; no "
                 "other cuts, no slow motion, no speed ramp, no end card.")
        keys = []
        for s in shots:
            for k in s["누구"]:
                if k not in keys:
                    keys.append(k)
        L += [f"{k}: {c['누구'][k]}" for k in keys]
        for i, s in enumerate(shots):
            a, b = (0, t) if i == 0 else (t, None)
            span = f"{a:g}–{b:g} s" if b else f"{a:g} s to the end"
            L.append(f"SHOT {i + 1} ({span}) begins exactly on @이미지 {i + 1} — same framing, light and colors. ACTION: {s['동작']} CAMERA: {s['카메라']}")
    L.append(c["보기"])
    L.append((p.get("소리줄") or {}).get(mode) or c["소리"])
    return "\n".join(L)


def main():
    pans = build()
    spec = {"메모": MEMO, "편": "romance", "이름": "로맨스 단편 「다 비침」", "비율": "16:9", "그림": V + "선버스트/정지컷",
            "공통": {"장르": GENRE, "누구": WHO, "보기": LOOK, "소리": SILENT}, "판": pans}
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        mode = sys.argv[sys.argv.index("--보기") + 2] if len(sys.argv) > sys.argv.index("--보기") + 2 else "B"
        p = next(x for x in pans if x["id"] == k)
        txt = preview(spec, p, mode)
        print(txt)
        print(f"\n({len(txt.split())}낱말 · 판 길이 {p['길이']}초{' · B길이 ' + str(p['B길이']) if p.get('B길이') else ''} · 소리 {p['소리']})")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(spec, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    main_p = [p for p in pans if not p.get("대안")]
    alt_p = [p for p in pans if p.get("대안")]
    cuts = sorted({c for p in main_p for c in p["컷"]})
    print(f"판 {len(pans)} — 주판 {len(main_p)}(묶음 {sum(len(p['샷']) > 1 for p in main_p)} · 토막 {sum(1 for p in main_p if p.get('토막'))}) · "
          f"대안 {len(alt_p)}(원본 카메라 {[p['id'] for p in alt_p]}) · 컷 {len(cuts)}(C65 검은 화면 빼고 69)")
    print(f"길이 합 — 주판 {sum(p['길이'] for p in main_p)}초 · 대안 {sum(p['길이'] for p in alt_p)}초 · 방식 B일 때 주판 "
          f"{sum(p.get('B길이', p['길이']) for p in main_p)}초 · 여유 줄인 판 {[p['id'] for p in main_p if p.get('여유')]}")
    print("소리(주판) —", {f: sum(1 for p in main_p if p['소리'] == f) for f in ("켬", "B만 켬", "끔")})
    longest = max(pans, key=lambda p: len(preview(spec, p, "B").split()))
    print("가장 긴 지시문", longest["id"], len(preview(spec, longest, "B").split()), "낱말 · 가장 긴 판", max(p.get('B길이', p['길이']) for p in pans), "초")
    print("→", OUT)


if __name__ == "__main__":
    main()
