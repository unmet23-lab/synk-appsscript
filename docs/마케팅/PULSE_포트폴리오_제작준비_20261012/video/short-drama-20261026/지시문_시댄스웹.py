# 7번 「사랑 한 칸」 — 시댄스 2.5 1일 무제한 웹 판 지시문을 만든다(2026-10-29).
#   python -X utf8 지시문_시댄스웹.py            → 지시문/영상_시댄스웹.json(조율 세션의 ../../시댄스무제한/웹꾸러미.py가 읽는 꼴) · 판 수 · 길이 합
#   python -X utf8 지시문_시댄스웹.py --보기 <판 id> [A|B|없음]   → 그 판의 웹 지시문을 꾸러미와 같은 순서로 찍는다(소리 줄은 고른 방식)
# 다른 편(11번 · 4번)의 영상_시댄스웹.json과 같은 칸에 7번만의 칸을 더했다 — 판의 「소리」(켬 · 끔 · B만 켬) · 「소리참고」(방식마다 파일 자리),
# 샷의 「말」(누가 · 대사 · 시작 초 · 입 보임/가림)과 「소리줄」(A 타입캐스트 대사로 입 맞춤 · B 목소리 견본 + 생성 목소리 · 없음 참고 없이).
# 카메라는 02_콘티 2절 카메라 칸(원본 프레임 실측 · 눈 확인)을 그대로 옮기고, 흔들림 크기는 원본 가장자리 띠 실측(콘티/p7/카메라_우리_배경.json)이다.
# 「요즘 기법으로 바꾼 컷」(CHANGES)만 카메라 줄을 바꾸고, 원본 카메라는 「원본카메라」 칸에 남긴다(02_콘티 「시댄스 지시문(10-29)」 절).
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
V = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7/"
OUT = os.path.join(HERE, "지시문", "영상_시댄스웹.json")
CUTS_JSON = json.load(open(V + "컷목록.json", encoding="utf-8"))
SHAKE_BG = json.load(open(V + "카메라_우리_배경.json", encoding="utf-8"))
INFO = {f"{c['화']}-{c['컷']}": c for c in CUTS_JSON}

# ── 누구(공통) — 웹꾸러미가 「키: 설명」 줄로 붙인다. 얼굴은 시작 그림이 정하므로 머리 · 옷 · 소품만 적는다 ──
WHO = {
    "IAN (office)": "Ian — the same young Korean man as in the first frame (late twenties, medium-brown wavy hair with a center part) in his navy two-button suit, white dress shirt and plain dark-navy tie.",
    "IAN (home from work)": "Ian — the same young Korean man as in the first frame (medium-brown wavy hair with a center part) in his navy suit, just home from work, the dark-navy tie loosened and the top shirt button open.",
    "IAN (sweatshirt)": "Ian — the same young Korean man as in the first frame (medium-brown wavy hair with a center part) in a plain charcoal-grey crew-neck sweatshirt and light-grey sweatpants.",
    "IAN (pajamas)": "Ian — the same young Korean man as in the first frame (medium-brown wavy hair with a center part) in a plain oatmeal-beige long-sleeve cotton t-shirt and navy pajama pants.",
    "IAN (white backdrop)": "Ian — the same young Korean man as in the first frame (medium-brown wavy hair with a center part) in a plain grey t-shirt, alone in front of a seamless pure-white backdrop.",
    "SEOJIN (cardigan)": "Seojin — the same Korean woman as in the first frame (late twenties, black hair in a low ponytail, small gold hoop earrings) in a cream chunky-knit cardigan over a pale-blue striped button-up shirt.",
    "SEOJIN (apron)": "Seojin — the same Korean woman as in the first frame (black hair in a low ponytail, small gold hoop earrings) in a white long-sleeve t-shirt under a sage-green apron.",
    "SEOJIN (white shirt)": "Seojin — the same Korean woman as in the first frame (black hair in a low ponytail, small gold hoop earrings) in a crisp white button-up shirt.",
    "SEOJIN (wine dress)": "Seojin — the same Korean woman as in the first frame (black hair in a low ponytail, small gold hoop earrings) in a fitted wine-red long-sleeve knit dress, black ankle boots and a thin gold necklace.",
    "SEOJIN (cable knit)": "Seojin — the same Korean woman as in the first frame (black hair in a low ponytail, small gold hoop earrings) in a cream cable-knit sweater, a canvas tote bag on her shoulder.",
    "SEOJIN (navy sweater)": "Seojin — the same Korean woman as in the first frame (black hair in a low ponytail, small gold hoop earrings) in a navy crew-neck sweater.",
    "SEOJIN (pajamas)": "Seojin — the same Korean woman as in the first frame (black hair in a low ponytail, small gold hoop earrings) in rose-mauve satin pajamas.",
    "MINJAE": "Minjae — the same Korean man as in the first frame (Ian's co-worker, late twenties, short black hair with messy bangs) in a dark-grey knit cardigan over a light-blue button-down shirt.",
    "SOYEON": "Soyeon — the same Korean woman as in the first frame (Seojin's friend, mid-thirties, shoulder-length dark-brown hair) in a mustard-yellow cardigan over a cream t-shirt.",
    "LUNCHBOX": "Ian's lunchbox — a rectangular two-compartment box in matte cream-white plastic with a light-oak lid: plain white rice with one red pickled plum in the long compartment, and the small side-dish compartment completely empty.",
    "LUNCHBOXES": "the two lunchboxes packed for tomorrow — cream-white boxes full of side dishes (rolled omelet, seasoned greens, braised beef, cherry tomatoes) and white rice with black sesame, exactly as in the first frame.",
    "DELIVERY BOX": "the plain kraft-paper delivery box; any flat bright-green label on it stays one solid chroma green with nothing written on it.",
    "GREEN SHEET": "the sheet of paper on the table is a flat, solid bright-green rectangle (chroma key) with nothing written on it — it stays exactly that green, flat and blank; no writing, no lines, no shadows of text ever appear on it.",
    "NEW DRESS": "the new emerald-green satin slip dress with a white paper price tag on a string.",
}
NAME = {k: k.split(" ")[0].title() for k in WHO if k.split(" ")[0] in ("IAN", "SEOJIN", "MINJAE", "SOYEON")}

LOOK = ("LOOK: a modern Korean web-drama look — real cinema camera, natural skin texture, true-to-life colors. Keep the first frame's light, colors and white balance "
        "to the very end — the soft warm lamp light of the flat at night, the bright soft daylight of the office and the café — with no new light, no brightening and no "
        "color shift. The acting is subtle and natural, as in a calm Korean romance drama: small, believable expressions, never exaggerated or cartoonish, no big toothy grins. "
        "The camera is operated by hand close to the actors and moves only as written in CAMERA — where CAMERA says still or smooth, it is still or smooth. No new text, "
        "letters, logos or labels; any flat "
        "bright-green rectangle stays one even chroma green with nothing on it. Never add a person who is not in the first frame.")
SILENT = "SOUND: silent clip — no dialogue, no narration, no music."


def shake(k):
    v = SHAKE_BG.get(k, {}).get("흔들림%")
    return 0.2 if v is None else v


# 고정은 긍정문 먼저, 그다음 하지 말 것 — 「locked off」만으로는 0.17초부터 움직이고 부정문만으로는 계속 밀고 들어간 보고(10-29 5번 세션 조사, 공용 메모)
def still():
    return "static frame — the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake."


def jit(k, cap=0.5):
    x = max(0.1, min(cap, round(shake(k) * 20) / 20))
    return (f"handheld, the camera stays in place: small constant handheld jitters of about {x:g}% of the frame width — it shakes but does not travel, "
            "no push-in, no zoom, holding the same framing to the end.")


def strong(k):
    x = round(shake(k) * 10) / 10
    return f"strong constant handheld shake (about {x:g}% of the frame width), the frame leaning a degree or two off level, a little motion blur on the jolts"


# ── 컷마다: 누구 · 동작 · 카메라(원본) · 말 ──
# 말 = (누가 키, 대사, 시작 초, 꼴) — 꼴: 입(입이 보이는 입 맞춤 48컷) · 가림(입이 가려진 · 화면 밖 말, 방식 B일 때만 생성)
C = {}


def cut(k, who, action, camera, say=None, closed=None):
    C[k] = {"누구": who, "동작": action, "카메라": camera, "말": say, "다문입": closed}


# 1화 ① 회사 점심(오늘)
cut("1-1", ["IAN (office)", "MINJAE", "LUNCHBOX"],
    "At his office desk, Ian holds the open lunchbox in front of him, its wooden lid lifted in his other hand, and stares down into it, stunned; Minjae, leaning over him "
    "from behind with both hands on his shoulders, peers into the box with wide eyes. Quick, small reactions only; both keep their lips closed.",
    "quick push-in: right after the first frame the camera physically darts forward toward Ian and the open lunchbox, about 13% closer, done by about 0.4 s, at an even "
    "speed; then the camera stays in place with small handheld jitters (about 0.15% of the frame width), ending a little tighter on the two men and the box.")
cut("1-2", ["LUNCHBOX"],
    "Over Ian's shoulder: his two hands hold the open lunchbox low above the white desk — white rice with a single red pickled plum in one compartment, the other compartment "
    "completely empty; the wooden lid is tucked under the box. The hands hold it still. No face is seen. Off screen, Minjae's voice asks in Korean: "
    "\"야, 반찬 칸이 왜 비었어?\"",
    still(),
    ("MINJAE", "야, 반찬 칸이 왜 비었어?", 0.0, "가림"))
cut("1-3", ["LUNCHBOX"],
    "A close-up of the lunchbox's empty compartment with a pair of light wooden chopsticks lying in it; the light-oak lid rests beside the box. Nothing moves.",
    jit("1-3"))
cut("1-4", ["IAN (office)", "LUNCHBOX"],
    "With Minjae's hands resting on his shoulders from behind (Minjae's face is out of frame), Ian holds the lunchbox low, looks up from it with a sheepish wince and explains "
    "with his right hand raised palm up. Right away he says in Korean, at a brisk natural pace: \"결혼 얘기 피한 벌이야.\"",
    jit("1-4"),
    ("IAN (office)", "결혼 얘기 피한 벌이야.", 0.1, "입"))
# 1화 ② 회상 · 어젯밤 집 식탁
cut("1-5", ["SEOJIN (cardigan)", "IAN (sweatshirt)"],
    "Night, at the kitchen table: Seojin leans forward over the table, holding her open planner notebook toward him, and right away says in Korean, firm but calm: "
    "\"우리 내년이면 칠 년이야. 이제 날 잡자.\" The soft, blurred head at the right edge is Ian seen from behind; he stays still and silent.",
    jit("1-5", cap=0.4),
    ("SEOJIN (cardigan)", "우리 내년이면 칠 년이야. 이제 날 잡자.", 0.1, "입"))
cut("1-6", ["IAN (sweatshirt)", "SEOJIN (cardigan)"],
    "Over Seojin's blurred shoulder (her back to the camera): across the table Ian drinks from a glass of water, his eyes darting to her as she keeps talking. His lips stay "
    "on the glass; Seojin's face is never seen. Under the shot, Seojin's voice (off-camera) says in Korean: \"식장, 집, 아이 계획까지 다 정리해 놨어.\"",
    jit("1-6"),
    ("SEOJIN (cardigan)", "식장, 집, 아이 계획까지 다 정리해 놨어.", 0.1, "가림"))
cut("1-7", ["IAN (sweatshirt)"],
    "Close-up: Ian, mid-sip, chokes on the water at her words — he jerks the glass away from his lips and coughs hard once or twice, eyes squeezing shut. A real, small "
    "cough; no water sprays out.",
    "handheld jolt on the choke: as he chokes (about 0.2–1.1 s) the camera jerks upward about 10% of the frame height and rolls around the lens axis so the frame leans "
    "about 12° counter-clockwise, slowing to a stop, with motion blur on the jolt; " + strong("1-7") + " throughout.")
cut("1-8", ["IAN (sweatshirt)", "SEOJIN (cardigan)"],
    "Over Seojin's blurred shoulder: Ian straightens up in his chair, pressing a white paper napkin over his mouth, and holds up his other hand, palm out — \"wait, slow "
    "down\". The napkin covers his mouth the whole time. Under the shot his muffled voice says in Korean: \"잠깐만, 천천히…\" and, right after it, \"알았어, 알았어…\"",
    "sideways follow: as he straightens up (about 0.3–1.2 s) the camera travels to its left about 12% of the frame width, following him, and ends with him upright in "
    "his chair, the napkin still at his mouth; small handheld jitters of about 0.25% of the frame width.",
    ("IAN (sweatshirt)", "잠깐만, 천천히…", 0.2, "가림"))
cut("1-9", ["SEOJIN (cardigan)", "IAN (sweatshirt)"],
    "Over Ian's blurred shoulder (his back to the camera at the right): Seojin, at the table, listens for a beat, then from about 0.7 s answers in Korean, low and firm: "
    "\"나 내년이면…\" Ian does not turn; his face is not seen.",
    jit("1-9"),
    ("SEOJIN (cardigan)", "나 내년이면…", 0.7, "입"))
cut("1-10", ["SEOJIN (cardigan)"],
    "Close-up: Seojin looks straight at Ian, just off camera to the right, and right away finishes in Korean, calm and deadly serious, eyebrows slightly raised: "
    "\"…앞자리 3이야.\"",
    still(),
    ("SEOJIN (cardigan)", "…앞자리 3이야.", 0.0, "입"))
cut("1-11", ["IAN (sweatshirt)", "SEOJIN (cardigan)"],
    "Over Seojin's blurred shoulder: Ian hesitates, glances aside with an awkward half-smile and says in Korean, a little sheepish: \"난 아직… 2인데.\" Seojin's face is "
    "not seen.",
    jit("1-11"),
    ("IAN (sweatshirt)", "난 아직… 2인데.", 0.2, "입"))
cut("1-12", ["IAN (sweatshirt)", "SEOJIN (cardigan)"],
    "Bust: Seojin's hand, in its cream knit sleeve reaching in from the lower left, is already pinching Ian's cheek from the first frame; on the beat her fingers "
    "squeeze a little harder and his cheek puffs up — he winces slightly and blinks, lips closed. Small and comic, never rough.",
    jit("1-12", cap=0.3))
cut("1-13", ["SEOJIN (cardigan)"],
    "Bust: Seojin stares at him in disbelief, one hand lifted mid-gesture, and lets out one short scoffing breath — \"하.\" — her lips parting just for it; then she holds the look.",
    jit("1-13", cap=0.35),
    ("SEOJIN (cardigan)", "하.", 0.1, "입"))
cut("1-14", ["IAN (sweatshirt)", "SEOJIN (cardigan)"],
    "Bust, the same as before: with his cheek still pinched by Seojin's fingers, Ian right away mumbles in Korean, squished and sheepish: \"…미안.\" — then he keeps his "
    "lips closed to the end.",
    jit("1-14"),
    ("IAN (sweatshirt)", "…미안.", 0.15, "입"))
# 1화 ③ 회사 — 브랜드 한 줄
cut("1-15", ["MINJAE", "IAN (office)"],
    "Office, bust: across the desk Minjae looks at Ian and right away calls out in Korean with a teasing grin: \"야~\" In the foreground Ian's hand with chopsticks hovers "
    "over Minjae's lunch; Ian's face is not seen.",
    "handheld, the camera stays in place with light constant jitters of about 0.5% of the frame width, holding the framing.",
    ("MINJAE", "야~", 0.0, "입"))
cut("1-16", ["MINJAE", "IAN (office)"],
    "Bust: Minjae points his finger down and to the right — toward Ian's lunchbox, off frame — and asks in Korean with a smug, teasing face: "
    "\"그 도시락, 사랑 한 칸은 있냐?\" His own black lunchbox, full of side dishes, stays where it is at the lower right, and the navy suit sleeve at the bottom edge "
    "(Ian's arm) stays still.",
    jit("1-16"),
    ("MINJAE", "그 도시락, 사랑 한 칸은 있냐?", 0.2, "입"))
cut("1-17", ["IAN (office)"],
    "Side profile, medium: Ian, chopsticks in hand at his desk, looks toward Minjae (off frame to the left) and grumbles in Korean, half to himself, trailing off: "
    "\"이미 같이 사는데, 종이 한 장이 뭐…\"",
    jit("1-17"),
    ("IAN (office)", "이미 같이 사는데, 종이 한 장이 뭐…", 0.1, "입"))
cut("1-18", ["IAN (office)"],
    "Close-up: Ian chews the sour pickled plum with a pinched face, the chopsticks still at his lips, and from about 0.3 s mutters through the chewing in Korean: "
    "\"…반찬도 안 싸 주고.\"",
    jit("1-18"),
    ("IAN (office)", "…반찬도 안 싸 주고.", 0.3, "입"))
cut("1-19", ["MINJAE"],
    "Bust: Minjae sips coffee from a white paper cup held at his lips and eyes Ian over the rim; the cup covers his mouth the whole time. Under the shot his voice says in "
    "Korean: \"여자친구 내년에 몇이야?\"",
    jit("1-19"),
    ("MINJAE", "여자친구 내년에 몇이야?", 0.1, "가림"))
cut("1-20", ["IAN (office)", "LUNCHBOX"],
    "Bust: Ian, head bowed over his lunchbox, answers quietly in Korean without looking up: \"…서른.\" — his lips still visible.",
    jit("1-20"),
    ("IAN (office)", "…서른.", 0.2, "입"))
cut("1-21", ["MINJAE", "IAN (office)"],
    "Over Ian's blurred shoulder: Minjae leans back a little, nods knowingly and says in Korean: \"그럼 너 같아도 급하겠다.\"",
    jit("1-21"),
    ("MINJAE", "그럼 너 같아도 급하겠다.", 0.2, "입"))
# 1화 ④ 오늘 저녁 집 — 서류
cut("1-22", ["IAN (home from work)"],
    "Evening, the flat's entrance: the wooden door with frosted-glass panes swings open toward the camera as Ian, a blurred silhouette behind the glass, pushes the handle. "
    "Only the door moves.",
    "static frame — the camera stays in place, almost perfectly still; only the door moves.")
cut("1-23", ["IAN (home from work)", "SEOJIN (apron)"],
    "Wide, from inside the flat: Ian steps in through the hallway door, tired, and from about 0.3 s says in Korean toward the kitchen: \"나 오늘 점심에 매실만 먹었어.\" In the "
    "soft, out-of-focus foreground at the left, Seojin in her apron crosses and briefly covers the left of the frame; her face is not seen speaking.",
    "small follow: handheld with light constant shake (about 0.5% of the frame width); as Ian comes in the camera turns slightly to its right with him, ending on him "
    "inside the doorway.",
    ("IAN (home from work)", "나 오늘 점심에 매실만 먹었어.", 0.3, "입"))
cut("1-24", ["SEOJIN (apron)"],
    "Close-up at the kitchen sink: water runs from the chrome faucet; Seojin's hand pushes the lever down and the water stops. Nothing else moves.",
    jit("1-24"))
cut("1-25", ["SEOJIN (apron)"],
    "Bust in the kitchen: Seojin, without smiling, flicks her eyes toward the dining table (off to the side) and says in Korean, cool and even: "
    "\"반찬 먹고 싶으면, 저기 이름 써.\" — then looks back at him.",
    jit("1-25"),
    ("SEOJIN (apron)", "반찬 먹고 싶으면, 저기 이름 써.", 0.2, "입"))
cut("1-26", ["IAN (home from work)", "GREEN SHEET"],
    "Looking down past Ian's chin and loosened tie (at the bottom of the frame) onto the wooden dining table: the flat bright-green sheet of paper with a black pen lying on "
    "it. He looks down at it; nothing else moves.",
    jit("1-26"))
cut("1-27", ["GREEN SHEET"],
    "A close-up of the flat bright-green sheet of paper on the wooden table; it lies still. Nothing moves.",
    jit("1-27"))
cut("1-28", ["SEOJIN (apron)", "IAN (home from work)"],
    "Close on their hands: Seojin's hand in its white sleeve grabs Ian's wrist and tugs him along toward the table, to the left.",
    "whip follow: as she tugs (about 0.2–0.7 s) the camera whips to its left about 35% of the frame width with the pulled hands, with " + strong("1-28")
    + "; it ends on their hands moving toward the table — the same room, still one continuous shot.")
cut("1-29", ["SEOJIN (apron)", "IAN (home from work)"],
    "Over Ian's shoulder: Seojin hugs his arm with both hands and presses her cheek to his sleeve, looking up at him coaxingly and swaying a little; her mouth stays hidden "
    "against his arm. Under the shot her muffled voice says in Korean: \"구청은 내가 갈게. 너는 펜만 들어.\"",
    "slow pull-back: handheld with a constant small shake of about 0.45% of the frame width; as she clings to his arm (about 0.3–1.9 s) the camera eases back about 10% at an "
    "even pace, ending a little wider on the two of them.",
    ("SEOJIN (apron)", "구청은 내가 갈게. 너는 펜만 들어.", 0.2, "가림"))
cut("1-30", ["IAN (home from work)", "SEOJIN (apron)"],
    "Over the back of Seojin's head: Ian, troubled, looks down at her and says in Korean, gently but firmly: \"이렇게 떠밀려서 쓰긴 싫어.\" Seojin's face is not seen.",
    "handheld, the camera stays in place with strong constant shake (about 0.6% of the frame width); over the shot it rolls around the lens axis so the frame leans a "
    "few degrees clockwise.",
    ("IAN (home from work)", "이렇게 떠밀려서 쓰긴 싫어.", 0.2, "입"))
cut("1-31", ["IAN (home from work)"],
    "Bust from another angle in the hallway: Ian stands with a troubled, conflicted face and lets out a quiet breath through his nose; his lips stay closed.",
    jit("1-31"))
# 1화 ⑤ 카페
cut("1-32", ["SOYEON", "SEOJIN (white shirt)"],
    "Daytime café: Soyeon, across the table from Seojin, cradles her coffee cup and asks in Korean with a knowing little smile: \"너 아직도 계획표 들고 다녀?\" Seojin's "
    "blurred shoulder at the right edge stays still.",
    still(),
    ("SOYEON", "너 아직도 계획표 들고 다녀?", 0.1, "입"))
cut("1-33", ["SEOJIN (white shirt)", "SOYEON"],
    "Over Soyeon's blurred shoulder: Seojin, holding her coffee cup on the table, answers in Korean with a tired sigh: \"응. 걔만 안 움직여.\"",
    jit("1-33"),
    ("SEOJIN (white shirt)", "응. 걔만 안 움직여.", 0.1, "입"))
cut("1-34", ["SEOJIN (white shirt)"],
    "Close-up: Seojin looks down at the calendar on her phone (at the bottom edge) and mutters to herself in Korean with a sigh: \"달력에 동그라미까지 쳐 놨는데.\"",
    jit("1-34"),
    ("SEOJIN (white shirt)", "달력에 동그라미까지 쳐 놨는데.", 0.1, "입"))
cut("1-35", ["SOYEON", "SEOJIN (white shirt)"],
    "Soyeon, her cup in hand, tilts her head and says in Korean, warm and knowing: \"원래 남자는 등 떠밀면 더 버텨.\" Seojin's sleeve in the foreground stays still.",
    "slow sideways drift: from about 0.4 s to 2.1 s the camera travels to its right about 12% of the frame width, slowing to a stop, ending with Soyeon a little left of "
    "center; small handheld jitters of about 0.2% of the frame width.",
    ("SOYEON", "원래 남자는 등 떠밀면 더 버텨.", 0.2, "입"))
cut("1-36", ["SEOJIN (white shirt)", "SOYEON"],
    "Over Soyeon's shoulder: Seojin opens both hands palm up above the table in frustration and says in Korean: \"그럼 어떡해. 손 놓고 기다려?\"",
    jit("1-36"),
    ("SEOJIN (white shirt)", "그럼 어떡해. 손 놓고 기다려?", 0.1, "입"))
# 1화 ⑥ 회사 — 업힘
cut("1-37", ["IAN (office)", "MINJAE"],
    "Wide, office: Ian, standing at the left of the frame, takes a couple of steps over to Minjae's desk and starts to lean down over Minjae's back as Minjae slumps "
    "forward onto the desk with a sigh. "
    "Both keep their lips closed.",
    "sideways follow: as Ian walks to Minjae's desk (about 0.3–1.5 s) the camera travels to its right about 11% of the frame width at an even speed, following him; "
    "small handheld jitters.")
cut("1-38", ["IAN (office)", "MINJAE"],
    "Close: Minjae lies with his cheek on the desk; Ian, draped over his back, rests his chin near Minjae's head and whines in Korean: "
    "\"이러다 계획표에 나도 한 줄로 들어가겠어.\" Minjae keeps his lips closed.",
    jit("1-38"),
    ("IAN (office)", "이러다 계획표에 나도 한 줄로 들어가겠어.", 0.2, "입"))
cut("1-39", ["MINJAE", "IAN (office)"],
    "Close: Minjae's head rests on the desk under Ian's arm, which covers his mouth; Minjae's eyes look up toward Ian at the top edge. Under the shot Minjae's muffled voice "
    "says in Korean: \"너 그러다 진짜 놓친다?\"",
    jit("1-39"),
    ("MINJAE", "너 그러다 진짜 놓친다?", 0.2, "가림"))
cut("1-40", ["IAN (office)", "MINJAE"],
    "Close: Ian, chin propped on his hands on top of Minjae's head, scoffs and says in Korean, a bit too confident: \"놓치긴. 육 년인데.\" Minjae, face down, keeps his "
    "lips closed.",
    jit("1-40"),
    ("IAN (office)", "놓치긴. 육 년인데.", 0.2, "입"))
cut("1-41", ["MINJAE", "IAN (office)"],
    "Close: Minjae lifts his face from the desk, glances up sideways at Ian and says in Korean, dry: \"육 년 된 사이가 제일 잘 놓쳐.\" Ian, above him, keeps his lips closed.",
    jit("1-41"),
    ("MINJAE", "육 년 된 사이가 제일 잘 놓쳐.", 0.2, "입"))
# 1화 ⑦ 걸이
cut("1-42", ["SOYEON"],
    "Café, bust: Soyeon leans forward across the table toward Seojin with a sly look, about to whisper; her lips stay closed.",
    still())
cut("1-43", ["SOYEON"],
    "Extreme close-up of Soyeon's lips and lower face: she whispers in Korean, slow and secretive: \"등 떠밀지 말고… 한 발 빼 봐.\"",
    jit("1-43", cap=0.3),
    ("SOYEON", "등 떠밀지 말고… 한 발 빼 봐.", 0.1, "입"))
cut("1-44", ["SEOJIN (white shirt)", "SOYEON"],
    "Over Soyeon's blurred shoulder: Seojin's eyes widen in surprise at the whisper; she freezes, lips slightly parted, not speaking.",
    "slight push-in: from about 0.3 s to 0.8 s the camera physically moves a little toward Seojin, about 4% closer, speeding up, ending slightly tighter on her surprised "
    "face; small handheld jitters of about 0.2% of the frame width.")
cut("1-45", ["SEOJIN (white shirt)"],
    "Close-up (punch-in): Seojin leans in toward Soyeon, eyes wide, and right away asks in a hushed, eager voice in Korean: \"…어떻게?\"",
    jit("1-45"),
    ("SEOJIN (white shirt)", "…어떻게?", 0.15, "입"))

# 2화 ① 밤 — 세탁기 · 현관
cut("2-1", ["IAN (sweatshirt)"],
    "Night, by the washing machine: seen from behind, Ian, folding laundry out of the top-loader, pulls out an unfamiliar garment and pauses.",
    "quick push-in: right after the first frame the camera physically darts forward toward Ian at the washing machine, about 13% closer, done by about 0.3 s, at an "
    "even speed; then the camera stays in place, almost still.")
cut("2-2", ["IAN (sweatshirt)", "NEW DRESS"],
    "Bust: Ian holds up the emerald-green satin dress by its strap and tilts his head, puzzled; his lips stay closed.",
    jit("2-2", cap=0.4))
cut("2-3", ["NEW DRESS"],
    "Close on the dress: Ian's hands hold up the emerald-green satin slip dress; the white price tag on its string swings a little.",
    jit("2-3", cap=0.4))
cut("2-4", ["SEOJIN (wine dress)", "DELIVERY BOX"],
    "Low at the entrance: Seojin's legs in black ankle boots and the hem of her wine-red dress step in onto the stone floor beside the plain kraft delivery box, and she "
    "stops. Her face is not seen. Her voice (off-camera) says in Korean: \"다녀왔어.\"",
    jit("2-4"),
    ("SEOJIN (wine dress)", "다녀왔어.", 0.2, "가림"))
cut("2-5", ["IAN (sweatshirt)", "NEW DRESS"],
    "Bust: hearing her come in, Ian quickly stuffs the green satin dress back into the laundry basket, glancing toward the hallway; his lips stay closed.",
    jit("2-5", cap=0.4))
cut("2-6", ["IAN (sweatshirt)"],
    "Bust in the hallway: Ian looks at her (off camera) and right away says in Korean, flat and quiet: \"열한 시 넘었네.\"",
    jit("2-6"),
    ("IAN (sweatshirt)", "열한 시 넘었네.", 0.1, "입"))
cut("2-7", ["SEOJIN (wine dress)", "IAN (sweatshirt)"],
    "Over Ian's blurred shoulder: Seojin tucks her hair behind her ear as she turns her head away and says lightly in Korean: \"응, 좀 늦었지.\"",
    jit("2-7"),
    ("SEOJIN (wine dress)", "응, 좀 늦었지.", 0.1, "입"))
cut("2-8", ["IAN (sweatshirt)", "SEOJIN (wine dress)"],
    "As Seojin brushes past in the blurred foreground, Ian leans after her, sniffs the air and from about 0.4 s asks in Korean, suspicious: \"향수… 바꿨어?\"",
    jit("2-8"),
    ("IAN (sweatshirt)", "향수… 바꿨어?", 0.4, "입"))
cut("2-9", ["SEOJIN (wine dress)"],
    "Close-up: Seojin glances back over her shoulder with a small, teasing closed-mouth smile and from about 0.3 s says in Korean: \"비밀.\" — then smiles again, lips closed.",
    jit("2-9", cap=0.4),
    ("SEOJIN (wine dress)", "비밀.", 0.3, "입"))
cut("2-10", ["SEOJIN (wine dress)", "IAN (sweatshirt)"],
    "Night, the hallway at home: Seojin, in profile, walks forward out of the frame to the right, passing close by the camera; as she goes, her body sweeps across the "
    "frame and she is gone, revealing the hallway seen straight down its length and Ian standing alone at its far end, staring after her, lips closed.",
    "static frame at about chest height — the camera stays in place, almost still; while her passing body covers much of the frame (about 0.2–0.7 s) the view settles "
    "to the hallway seen head-on, and Ian is revealed exactly as in the last frame — the same hallway, still one continuous shot.")
C["2-10"]["끝그림"] = "2-10e.jpg"
# 10-31 검수 · 대조: 선버스트 두 길(얼굴흐림 · 새로)의 2-10 시작 그림은 서진이 정면으로 카메라를 향해 걸어오는 판이라(확정 판은 옆모습),
# 그 길로 낼 때만 쓰는 글 — 웹꾸러미.py --7번비교는 늘, --둘째날은 --선버스트를 붙였을 때만 바꿔 쓴다(원본 11의 블로킹에도 더 가깝다)
C["2-10"]["선버스트동작"] = (
    "Night, the hallway at home: Seojin walks straight toward the camera and passes it on its left, so close that her body sweeps across and "
    "briefly fills the frame; then she is gone behind the camera, leaving the hallway seen straight down its length with Ian standing alone at "
    "its far end, staring after her, lips closed.")
C["2-10"]["선버스트카메라"] = (
    "static frame at about chest height, looking down the hallway — the camera stays in place, almost still; her passing body covers much of "
    "the frame (about 0.2–0.7 s) and then the view is the hallway seen head-on with Ian exactly as in the last frame — the same hallway, still "
    "one continuous shot.")
# 2화 ② 회사 — 빈 도시락
cut("2-11", ["MINJAE", "IAN (office)"],
    "Office, over Ian's blurred head: Minjae walks up and leans over the desk toward Ian, asking in Korean with a teasing look: \"오늘은 매실도 없냐?\"",
    jit("2-11"),
    ("MINJAE", "오늘은 매실도 없냐?", 0.1, "입"))
cut("2-12", ["IAN (office)"],
    "Close on Ian's hand holding up a half-eaten egg sandwich in its plastic wrap over the desk, as if showing it. Nothing else moves.",
    jit("2-12"))
cut("2-13", ["IAN (office)"],
    "Bust: Ian, deadpan and a little sorry for himself, says in Korean: \"도시락 대신 만 원 놓고 갔더라.\"",
    "handheld, the camera stays in place with light constant jitters of about 0.35% of the frame width, holding the framing.",
    ("IAN (office)", "도시락 대신 만 원 놓고 갔더라.", 0.1, "입"))
# 2화 ③ 회상 — 혼자 장보기
cut("2-14", ["SEOJIN (cable knit)"],
    "Weekend morning at the entrance: Seojin, a canvas tote bag on her shoulder, stops and looks at Ian (off camera); her lips stay closed.",
    jit("2-14"))
cut("2-15", ["IAN (sweatshirt)"],
    "Bust: Ian brightly suggests in Korean, with a small hopeful smile: \"주말 장 같이 보러 가자.\"",
    jit("2-15", cap=0.45),
    ("IAN (sweatshirt)", "주말 장 같이 보러 가자.", 0.1, "입"))
cut("2-16", ["SEOJIN (cable knit)", "IAN (sweatshirt)"],
    "Seojin, the tote bag on her shoulder, says in Korean, light but final: \"아니. 오늘은 혼자 갈게.\" — and turns away toward the door.",
    "small follow: as she turns away the camera turns slightly with her, a few percent of the frame, and ends on her turning toward the door; small handheld jitters.",
    ("SEOJIN (cable knit)", "아니. 오늘은 혼자 갈게.", 0.2, "입"))
cut("2-17", ["IAN (sweatshirt)", "SEOJIN (cable knit)"],
    "Over Seojin's shoulder: Ian, startled and hurt, stares at her, lips closed; near the end Seojin passes in front of the lens as a soft blur.",
    "handheld, the camera stays in place with light constant shake (about 0.5% of the frame width); near the end her blurred body passes across the foreground.")
cut("2-18", ["IAN (sweatshirt)"],
    "Bust from another angle: Ian, left behind, murmurs in Korean, hurt: \"…맨날 같이 갔잖아.\"",
    jit("2-18"),
    ("IAN (sweatshirt)", "…맨날 같이 갔잖아.", 0.1, "입"))
# 2화 ④ 회사 → ⑤ 카페 — 짝 맞춤
cut("2-19", ["IAN (office)", "MINJAE"],
    "Wide, office, from a high position: Ian slumps back in his office chair, sandwich in hand, staring at the ceiling, and from about 0.3 s says to himself in Korean: "
    "\"설마… 아니겠지.\" Minjae, beside him, grabs his arm; his laugh settles into a closed-mouth grin within the first 0.3 s and his lips never move like speech.",
    "static high wide — the camera stays in place, almost still, with only a slight sideways drift of about 4% of the frame width over the shot; almost no shake.",
    ("IAN (office)", "설마… 아니겠지.", 0.3, "입"),
    closed="Minjae makes no sound; after his first-moment laugh his lips stay closed and never move like speech.")
cut("2-20", ["SEOJIN (navy sweater)", "SOYEON"],
    "Café: Seojin, already slumped against Soyeon's shoulder with her face buried, squirms and rubs her face into the shoulder in frustration (the same flop as Ian's in the "
    "office); Soyeon, holding her takeout cup, laughs silently — her laugh softens into a closed-lip smile and her lips never move like speech. Under the shot Seojin's "
    "muffled voice says in Korean: \"아, 이거 내가 더 괴로워.\"",
    "handheld follow-down: " + strong("2-20") + "; as she slides lower onto Soyeon's shoulder (about 0.3–2.1 s) the camera tilts down with her and rolls around the lens "
    "axis so the frame leans, ending lower on the two of them.",
    ("SEOJIN (navy sweater)", "아, 이거 내가 더 괴로워.", 0.3, "가림"), closed=["SOYEON"])
cut("2-21", ["SEOJIN (navy sweater)", "SOYEON"],
    "Over Soyeon's blurred shoulder: Seojin, holding her takeout cup, winces guiltily and says in Korean: \"현관에서 날 보는 그 눈을 봤어야 돼.\"",
    jit("2-21", cap=0.45),
    ("SEOJIN (navy sweater)", "현관에서 날 보는 그 눈을 봤어야 돼.", 0.2, "입"))
cut("2-22", ["IAN (white backdrop)"],
    "Against the seamless pure-white backdrop, Ian looks straight into the lens with big, sad, abandoned-puppy eyes, his lower lip trembling slightly — a silent, "
    "heart-melting stare (her imagination). Lips closed.",
    still())
# 2화 ⑥ 침실 — 대면
cut("2-23", ["IAN (pajamas)"],
    "Night, the bedroom in warm lamp light: Ian, lying on his side on the bed, looks up at Seojin (out of frame) and asks quietly in Korean: \"…혹시, 좋아하는 사람 생겼어?\"",
    still(),
    ("IAN (pajamas)", "…혹시, 좋아하는 사람 생겼어?", 0.2, "입"))
cut("2-24", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Over Ian's blurred shoulder: Seojin, sitting up in bed, glances at him calmly, unbothered, and smooths her ponytail with one hand; her lips stay closed.",
    jit("2-24"))
cut("2-25", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Over Seojin's shoulder (her head and hands soft in the foreground): she rubs hand cream into her hands; beyond her Ian lies on his side facing away, his mouth hidden. "
    "Under the shot Ian's voice says in Korean: \"새 옷에, 늦게 오고, 향수도…\"",
    jit("2-25"),
    ("IAN (pajamas)", "새 옷에, 늦게 오고, 향수도…", 0.2, "가림"))
cut("2-26", ["IAN (pajamas)"],
    "Medium close: Ian, his cheek on the pillow, eyes up at her, right away finishes quietly in Korean: \"…바뀌었고.\" — his lips visible above the pillow.",
    jit("2-26"),
    ("IAN (pajamas)", "…바뀌었고.", 0.0, "입"))
cut("2-27", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Over Ian's blurred shoulder: Seojin, sitting on the bed, shakes her head with a too-casual little laugh and says in Korean: \"그런 거 아니라니까.\"",
    jit("2-27"),
    ("SEOJIN (pajamas)", "그런 거 아니라니까.", 0.1, "입"))
cut("2-28", ["IAN (pajamas)"],
    "Medium: Ian, already sitting up in bed, straightens and leans a little toward her, and from about 0.3 s says in Korean, quiet and hurt: "
    "\"너 거짓말하면 귀 빨개져.\"",
    # 원본 47은 누웠다 일어나는 남자를 따라 20% 오르지만, 우리 시작 그림(과 앞 컷 2-27의 어깨)은 이미 앉은 자세라 오름을 10%로 줄였다(10-29 아르곤 대조)
    "handheld rise: as he straightens and leans in (about 0.2–0.9 s) the camera rises a little with him, about 10% of the frame height, slowing to a stop, ending on "
    "him sitting upright; " + strong("2-28") + ".",
    ("IAN (pajamas)", "너 거짓말하면 귀 빨개져.", 0.3, "입"))
cut("2-29", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Seojin sits on the bed holding the hand-cream tube, frozen; Ian gets up and walks past in the soft foreground, his body sweeping across the frame between 0.5 s and "
    "1.0 s. Seojin's lips stay closed. Under the shot Ian's voice says in Korean: \"…잠깐 나가 있을게.\"",
    "static frame — the camera stays in place, almost perfectly still; only Ian's passing body moves across the foreground.",
    ("IAN (pajamas)", "…잠깐 나가 있을게.", 0.2, "가림"), closed=["SEOJIN (pajamas)"])
cut("2-30", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Over Seojin's back: Ian walks out through the bedroom door and pulls it shut behind him; the door closes. Nobody speaks.",
    still())
cut("2-31", ["SEOJIN (pajamas)"],
    "Seojin, alone on the bed, hugs the pillow, stunned, staring at the closed door; she does not move.",
    "short sideways drift: right after the first frame (about 0.1–0.4 s) the camera travels to its left about 10% of the frame width, slowing to a stop, then stays in "
    "place, almost still, on Seojin hugging the pillow.")
# 2화 ⑦ 복선 · ⑧ 자백
cut("2-32", ["IAN (pajamas)"],
    "Late at night in the dim kitchen: Ian, alone, stands bent over the wooden dining table with both hands on it, looking down at a sheet of paper and a pen, and begins "
    "to sit down; his writing hand is never seen.",
    "static frame — the camera stays in place, almost still, with only a faint drift; almost no shake.")
cut("2-33", ["IAN (pajamas)"],
    "Bust: Ian sits at the table with his head bowed, looking down at the paper (out of frame below), breathing slowly; his lips stay closed.",
    jit("2-33", cap=0.4))
cut("2-34", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    # 10-31 검수: 미끄러짐에 시각이 없어 쓰는 0.93초 밖으로 밀리지 않게
    "From a high position looking down the kitchen: Seojin rushes out of the hallway toward the table in her satin pajamas; her feet slip on the wooden floor "
    "within the first second — by about 1.0 s she is already sliding and by about 1.5 s she is down on the floor; the slip is the one action of this shot.",
    "handheld follow from a high position: " + strong("2-34") + "; the camera follows her as she rushes in and slides, tilting down with her, ending on her on the floor.")
cut("2-35", ["IAN (pajamas)", "SEOJIN (pajamas)"],
    "Wide: Ian, turning on his chair at the table, stares at Seojin sprawled on the floor in front of him and right away says in Korean, alarmed: \"왜, 왜 그래.\" Seojin, "
    "face down, does not speak.",
    jit("2-35"),
    ("IAN (pajamas)", "왜, 왜 그래.", 0.1, "입"))
cut("2-36", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "From a high angle over Ian's blurred head: Seojin kneels in a deep bow with her forehead to the floor, her ponytail fallen forward, her shoulders shaking; her face is "
    "never seen. Under the shot her voice says in Korean: \"다 연기였어.\"",
    "looking down from a high position, " + jit("2-36"),
    ("SEOJIN (pajamas)", "다 연기였어.", 0.2, "가림"))
cut("2-37", ["SEOJIN (pajamas)"],
    "Close-up: Seojin slowly lifts her head from the bow, eyes wet, and from about 0.4 s confesses in Korean, her voice breaking: \"늦은 것도, 원피스도, 향수도.\"",
    jit("2-37", cap=0.35),
    ("SEOJIN (pajamas)", "늦은 것도, 원피스도, 향수도.", 0.4, "입"))
cut("2-38", ["IAN (pajamas)", "SEOJIN (pajamas)"],
    "Over Seojin's back as she kneels on the floor: Ian sits at the table facing her, his eyes filling with tears; his lips stay closed. Under the shot Seojin's voice "
    "says in Korean: \"나가지 마…\"",
    jit("2-38"),
    ("SEOJIN (pajamas)", "나가지 마…", 0.2, "가림"), closed=["IAN (pajamas)"])
cut("2-39", ["IAN (pajamas)"],
    "Bust: Ian, at the table, tears welling up and his chin trembling, holds it in for a beat, then from about 0.8 s says in Korean in a shaky voice: \"…나 진짜 무서웠어.\" "
    "A small, real cry — no sobbing, no big face.",
    "handheld, the camera stays in place: light constant jitters of about 0.6% of the frame width, holding the same framing to the end.",
    ("IAN (pajamas)", "…나 진짜 무서웠어.", 0.8, "입"))
cut("2-40", ["SEOJIN (pajamas)"],
    "Crying, Seojin moves toward him, one arm reaching out, and from about 0.4 s says in Korean through tears: \"계획표, 다 버릴게.\"",
    "handheld follow: " + strong("2-40") + "; as she moves toward him (about 0.2–1.4 s) the camera follows her up and to the side, slowing, ending on her tearful face.",
    ("SEOJIN (pajamas)", "계획표, 다 버릴게.", 0.4, "입"))
cut("2-41", ["IAN (pajamas)", "SEOJIN (pajamas)"],
    "Over Seojin's blurred shoulder: Ian shakes his head slightly and right away says softly in Korean: \"버리지 마.\"",
    jit("2-41"),
    ("IAN (pajamas)", "버리지 마.", 0.1, "입"))
# 2화 ⑨ 공개 · ⑩ 끝
cut("2-42", ["IAN (pajamas)", "SEOJIN (pajamas)", "DELIVERY BOX", "LUNCHBOXES"],
    "Wide, at the dining table: Ian, seated, points to the things on the table (the white form with a pen, the opened kraft box of side-dish jars and the two open "
    "lunchboxes with their wooden lids beside them) and right away says in Korean, shy: "
    "\"이거… 일주일 전부터 쓰던 거야.\" Seojin, standing beside him, looks down at the table; her lips stay closed.",
    still(),
    ("IAN (pajamas)", "이거… 일주일 전부터 쓰던 거야.", 0.1, "입"), closed=["SEOJIN (pajamas)"])
cut("2-43", ["GREEN SHEET", "DELIVERY BOX", "LUNCHBOXES"],
    "Top-down insert of the dining table: the flat bright-green sheet with a black pen, the kraft delivery box and two lunchboxes packed full of side dishes; at the lower "
    "edge Ian's and Seojin's hands hold each other. Nothing moves.",
    still())
cut("2-44", ["GREEN SHEET"],
    "Close on the flat bright-green sheet of paper on the wooden table; it lies still. Nothing moves.",
    jit("2-44"))
cut("2-45", ["IAN (pajamas)", "SEOJIN (pajamas)"],
    "Medium: standing, Ian holds Seojin close in a hug, his cheek near her hair, and from about 0.4 s says in Korean, warm and certain: \"우리 결혼하자.\" Her face stays "
    "against his shoulder.",
    "handheld: " + strong("2-45") + "; the camera drifts up a little with Ian as he straightens into the hug.",
    ("IAN (pajamas)", "우리 결혼하자.", 0.4, "입"))
cut("2-46", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Bust: Seojin cries with her face pressed into Ian's shoulder, eyes shut, her mouth hidden against his shoulder; Ian's hand rubs her back. Under the shot her muffled "
    "voice says in Korean, crying: \"진짜 미안해…\"",
    "handheld, the camera stays in place with " + strong("2-46") + ", swaying gently with the hug.",
    ("SEOJIN (pajamas)", "진짜 미안해…", 0.3, "가림"))
cut("2-47", ["SEOJIN (pajamas)", "IAN (pajamas)"],
    "Close, in the hug: Seojin's tearful face rests on Ian's shoulder (we see the back of his head); her eyes close and a small relieved smile appears. Ian's mouth is hidden "
    "behind his head. Under the shot his voice says softly in Korean: \"내일부턴 내가 채울게. 사랑 한 칸.\"",
    "handheld arc around the hug: from about 0.4 s to 1.3 s the camera travels to its right around the two of them, about 35% of the frame width, while it rolls "
    "around the lens axis so the frame leans about 27° counter-clockwise, at an even speed, ending on Seojin's face over his shoulder; light handheld shake.",
    ("IAN (pajamas)", "내일부턴 내가 채울게. 사랑 한 칸.", 0.2, "가림"), closed=["SEOJIN (pajamas)"])
cut("2-48", ["LUNCHBOXES"],
    "Top-down still life: two lunchboxes packed full of side dishes on the light-oak table, wooden lids and chopsticks beside them. Nothing moves. (The logo and words are "
    "added later in editing — draw none.)",
    "static top-down frame — the camera stays in place, perfectly still.")

assert len(C) == 93, len(C)

# ── 한 컷에 두 사람 말이 겹치는 자리(콘티 2절 · 5절 ②) — 「말」은 그 판에서 입을 맞추는 한 줄이고, 겹치는 화면 밖 말은 「덧말」로 적는다 ──
# 방식 A · 없음: 덧말은 편집에서 얹는다(그 판 소리 참고 mp3에는 넣지 않는다 — 입이 남의 목소리를 따라 움직이지 않게).
# 방식 B: 1-9 첫 0.7초 이안 말은 1-8 판이 앞 말에 이어 만들고(「B이어말」 — 원본도 말이 컷을 넘어 이어짐), 1-14 끝 민재 「야~」는 1-15 판의 같은 말을 앞당긴다(J컷).
C["1-9"]["덧말"] = [("IAN (sweatshirt)", "알았어, 알았어…", 0.0, "화면 밖", "방식 B: p7-1-8 판이 앞 말에 이어 만든 것을 이 컷 첫머리에 깐다 · 방식 A · 없음: 편집에서 얹음")]
C["1-14"]["덧말"] = [("MINJAE", "야~", 0.43, "J컷", "1-15 판의 「야~」를 편집에서 앞당겨 이 컷 끝 0.8초에 깐다(이안 입은 다묾)")]
C["1-8"]["B이어말"] = "알았어, 알았어…"

# ── 두 샷 묶음(굽기 시트 「두 샷 묶기 규칙」: 같은 곳 · 같은 때 · 같은 사람/물건, 쓰는 초 합 6초 안, 끝 그림 · 아주 복잡한 카메라 · 빛 바뀜 없음) ──
# 말이 있는 묶음은 한 사람이 두 샷에 걸쳐 말하는 짝만(목소리 · 얼굴이 판 안에서 이어진다) — 두 사람이 번갈아 말하는 짝은 묶지 않는다.
BUNDLES = [("1-2", "1-3"), ("1-9", "1-10"), ("1-17", "1-18"), ("1-26", "1-27"), ("1-33", "1-34"), ("1-42", "1-43"), ("1-44", "1-45"),
           ("2-2", "2-3"), ("2-12", "2-13"), ("2-17", "2-18"), ("2-25", "2-26"), ("2-36", "2-37"), ("2-43", "2-44")]

# ── 요즘 기법으로 바꾼 컷(02_콘티 8-2절 「요즘 기법으로 바꾼 컷」 표와 같은 내용) ──
# 조건(10-29 조율 지시): 그 컷의 구실이 더 세지고 · 인기 · 호평 근거가 있고 · 지금 시작 그림으로 되며 · 시댄스 2.5에서 될 때만. 컷 경계 · 길이 · 이야기는 그대로.
# 근거 원자료: git 밖 레퍼런스/카메라요즘/p7/{웹,yt,시댄스}/요약.md(확인일 10-29).
CHANGES = {
    "2-39": {
        "짧게": "눈높이 느린 다가감 약 8%",
        "카메라": "slow push-in at eye level: from about 0.5 s the camera physically travels forward toward Ian's face in one slow, steady, smooth move — only a faint "
                 "handheld breath, no jolts — about 8% closer, no lens zoom; it ends on a slightly tighter close-up with his tear-filled eyes in the upper third, and holds.",
        "까닭": "자백 · 눈물의 정점(3.44초, 편에서 가장 긴 컷). 감정 박에 한 번의 느린 다가감 — 2025 훙궈 연간 1위 로맨스 《盛夏芬德拉》(44.4억 재생) 감독이 감정 박에 "
               "느린 이동 · 롱테이크 · 손 초점을 썼다고 직접 씀, Heimann 외 2019(PLoS ONE, EEG 16명): 몸으로 다가가는 숏이 고정 · 줌보다 감각운동 반응과 실감이 큼, "
               "눈높이가 신뢰를 가장 높임(Baranowski & Hecht 2018). 시댄스 2.5 천천히 다가가기 「확인됨」(공식 기본어 + 우리 10-12 실측) — 얼굴 컷이라 10% 안쪽.",
    },
    "2-22": {
        "짧게": "렌즈를 보는 눈에 느린 다가감 약 10%",
        "카메라": "slow push-in toward his eyes: right after the first frame the camera physically moves straight toward Ian's face in one slow, steady move, about 10% "
                 "closer, no lens zoom, while he keeps looking right into the lens; it ends on a closer frame of his sad puppy eyes and holds. The pure-white backdrop "
                 "stays plain white.",
        "까닭": "서진의 상상 속 「버려진 강아지 눈」 웃음 박(원본 고정). 렌즈를 보는 눈에 천천히 다가가 마음이 녹는 박을 키움 — 한국 숏드라마는 배우가 관객과 눈을 "
               "맞추듯 연기하는 1인칭 앵글을 적극 씀(엘르 코리아 2025-08-20), 눈 맞춤은 호감 얼굴의 매력을 키움(Kampe 외 2001, Nature), 다가가는 숏의 몰입(Heimann 외 "
               "2019). 시작 그림이 이미 렌즈를 봐 새 그림이 필요 없음. 시댄스 다가가기 「확인됨」.",
    },
    "2-48": {
        "짧게": "위에서 느린 다가감 약 5% · 밥에서 오르는 김",
        "카메라": "very slow top-down push-in: the camera physically lowers straight toward the two lunchboxes in one slow, steady move, about 5% closer, no lens zoom, no "
                 "shake; it ends with the two boxes a little larger, still centered, and holds.",
        "동작": "Top-down still life: two lunchboxes packed full of side dishes on the light-oak table, wooden lids and chopsticks beside them; a few thin wisps of steam "
               "rise slowly from the white rice in both boxes and drift up out of the frame. Everything else is still. (The logo and words are added later in editing — "
               "draw none.)",
        "까닭": "끝 장(브랜드). 움직이는 김이 먹음직함을 올리고 정지된 김은 효과가 없음(Zhang · Spence 외 2024, 실험 3개), 제품만 천천히 보이면 고급스러움 · "
               "지불 의사 · 클릭이 오름(Jung & Dubois 2023, JMR, 실험 12개 · 2만 7천 명). 끝 그림을 가장 세게. 시댄스 느린 다가가기 「확인됨」은 눈높이 얼굴 "
               "근거이고 위에서 내려다보며 다가가기는 공식 시연뿐, 김은 시험 근거 없음 — 원본 카메라 판 p7-2-48o와 나란히 보고 고른다. 로고 · 글자는 편집에서 "
               "고정으로 얹음(밑판만 천천히 움직임).",
    },
}

# ── 후보(시작 그림을 새로 구운 요즘 기법) — 10-29 쓰지 않기로 함(2-1p 드럼 세탁기 ↔ 2-3 · 2-5 통돌이 · 이안 닮음 0.303, 1-1p 칸 안 시점 안 나옴). 「후보판」 칸에 기록으로만 ──
# 원본 제작사 고코 클럽이 자사 글에서 권하는 「있을 수 없는 각도」 첫 걸이(세탁기 · 냉장고 안 시점, 첫 2초 사건 · 5초 유지율 50% 기준).
# 그림은 정지컷/_후보_20261029/(순서표에 넣지 않음).
CANDIDATES = {
    "2-1": {"그림": "_후보_20261029/2-1p.jpg", "누구": ["IAN (sweatshirt)", "NEW DRESS"],
            "동작": "An impossible point of view from inside the drum of a washing machine at night: through the round opening, Ian, puzzled, holds up the "
                   "unfamiliar emerald-green satin dress with its price tag and peers into the drum; the steel drum wall rings the frame and a few clothes lie at the "
                   "bottom. His lips stay closed.",
            "카메라": "quick push-in: right after the first frame the camera physically darts forward toward Ian through the round opening, about 13% closer, done by "
                     "about 0.3 s, at an even speed; then the camera stays in place, almost still.",
            "까닭": "2화 첫 0.43초 걸이. 원본 제작사 고코 클럽 자사 글이 권하는 「세탁기 안에서 보는 시점」(첫 2초 사건 · 5초 유지율 50% 기준, 2026-02-03 · 04-12). "
                   "이안 얼굴 닮음 0.303이라 고르시면 얼굴만 다시 굽는다."},
    "1-1": {"그림": "_후보_20261029/1-1p.jpg", "누구": ["IAN (office)", "MINJAE", "LUNCHBOX"],
            "동작": "A low angle from the desk, right behind the open lunchbox: the box's empty side-dish compartment and its rice compartment fill the bottom of "
                   "the frame; above it Ian, stunned, stares down into the box while Minjae peers over his shoulder with wide eyes; Ian holds the light-oak lid up "
                   "at the left. Both keep their lips closed.",
            "카메라": "quick push-in: right after the first frame the camera physically darts forward toward the two men, about 13% closer, done by about 0.4 s, at "
                     "an even speed; then the camera stays in place with small handheld jitters (about 0.15% of the frame width).",
            "까닭": "1화 첫 0.53초 걸이 — 같은 고코 클럽 「있을 수 없는 각도」. 「도시락 칸 안」 시점까지는 안 나왔고 뚜껑이 세워져 떠 보여 지금 판으로는 권하지 않음."},
}


def candidates():
    out = []
    for k, c in CANDIDATES.items():
        out.append({"id": f"p7-{k}p", "컷": [k], "길이": length_single(k), "후보": True, "대신할판": f"p7-{k}",
                    "설명": f"쓰지 않음(10-29 · 기록용 — 순서표 밖) — {k} 「있을 수 없는 각도」 첫 걸이 후보", "쓰지않음": True, "소리": "끔",
                    "샷": [{"컷": k, "그림": c["그림"], "쓰는초": used(k), "누구": c["누구"], "동작": c["동작"], "카메라": c["카메라"],
                            "원본카메라": C[k]["카메라"], "바꾼까닭": c["까닭"]}]})
    return out


# ── 소리 ──
def syl(s):
    return len(re.findall(r"[가-힣0-9]", s))


def line_secs(s):
    return round(syl(s) / 6.0 + 0.25, 2)   # 또박또박 빠른 대화 초당 6음절 + 숨


def closed_text(keys):
    if isinstance(keys, str):     # 컷이 따로 적은 문장(2-19처럼 첫 순간 웃음이 있는 자리)
        return keys
    names = [NAME[k] for k in keys]
    if not names:
        return "no one else speaks."
    if len(names) == 1:
        return f"{names[0]} keeps his lips closed and silent the whole time." if names[0] in ("Ian", "Minjae") else f"{names[0]} keeps her lips closed and silent the whole time."
    return " and ".join(names) + " keep their lips closed and silent the whole time."


# 방식 B의 목소리 견본 줄 — 굽기 시트 목소리 시험(매진 #7 · #12 B 판)의 웹꾸러미.py voice_b와 글자까지 같게(두 줄일 때 「lines」만 다름) — 그 시험 결과가 7번에 그대로 옮겨진다
def voice(two=False):
    return ("VOICE: @오디오 1 is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, but never play it and never "
            f"say its words; perform only the Korean {'lines' if two else 'line'} written above, the way this moment demands. Only that dialogue and quiet room sound — "
            "no music, no other voices.")


def sound_lines(keys):
    """판 하나의 SOUND 줄(방식마다) — 묶음이어도 말하는 사람은 한 사람(묶음 규칙), 다문입은 두 샷을 합친다. 방식 B는 끝에 VOICE 줄을 붙인다."""
    says = [C[k]["말"] for k in keys if C[k]["말"]]
    if not says:
        return None
    n = NAME[says[0][0]]
    assert all(NAME[s[0]] == n for s in says), keys
    others, ct = [], None
    for k in keys:
        cl = C[k].get("다문입")
        if isinstance(cl, str):
            ct = cl
            continue
        if cl is None:
            cl = [w for w in C[k]["누구"] if w in NAME and NAME[w] != n]
        others += [w for w in cl if w not in others]
    ct = ct or closed_text(others)
    lip = any(s[3] == "입" for s in says)
    more = any(C[k].get("B이어말") for k in keys)
    two = len(says) > 1 or more
    words = "the Korean words written in ACTION" if len(says) > 1 else ("the two Korean phrases written in ACTION, one right after the other" if more else "this one Korean line")
    # 묶음에서 한 샷은 입이 가려진 말 · 다른 샷은 입이 보이는 말이면, 가려진 샷에서 얼굴을 돌려 입을 보이지 않게 그 샷을 짚는다
    hidden = [i + 1 for i, k in enumerate(keys) if C[k]["말"] and C[k]["말"][3] == "가림"] if len(keys) > 1 else []
    hid = "".join(f" In SHOT {i} {n}'s mouth stays hidden exactly as written there." for i in hidden)
    if lip:
        return {
            "A": f"SOUND: the reference audio is the exact recorded {'lines' if two else 'line'} for this video — {n}'s lips move exactly with it, word for word, wherever the "
                 f"mouth is visible; do not re-voice, re-time or change it.{hid} No music, no narration, no other voices; {ct}",
            "B": f"SOUND: {n} speaks only {words} with natural Korean pronunciation and the timing written in ACTION, the lips clearly forming the Korean words wherever the "
                 f"mouth is visible.{hid} No music, no narration, no other voices; {ct}\n{voice(two)}",
            "없음": f"SOUND: {n} speaks only {words} with natural Korean pronunciation and the timing written in ACTION, the lips clearly forming the Korean words wherever "
                    f"the mouth is visible.{hid} No music, no narration, no other voices; {ct}",
        }
    return {   # 가림 — 방식 A · 없음은 소리 끔(목소리는 편집에서), B만 그 판에서 목소리를 만든다
        "A": SILENT,
        "B": f"SOUND: only {n}'s voice saying {words}, with the timing written in ACTION; {n}'s mouth is not seen, exactly as written in ACTION. No music, no narration, "
             f"no other voices; {ct}\n{voice(two)}",
        "없음": SILENT,
    }


def used(k):
    return INFO[k]["길이"]


def length_single(k):
    return max(4, math.ceil(used(k) + 0.8 - 1e-9))


def length_b(k, sh, base):
    """방식 B(그 판에서 생성한 목소리를 그대로 씀)는 대사가 컷보다 길면 말이 끝날 때까지 받아야 한다 — 다음 컷 밑에 깔리는 몫(원본처럼 말이 컷을 넘어감)."""
    if not sh.get("말"):
        return base
    m = sh["말"]
    if sh.get("B이어말"):
        return max(base, min(7, math.ceil(m["시작초"] + m["어림초"] + 0.1 + sh["B이어말"]["어림초"] + 0.8 - 1e-9)))
    return max(base, min(7, math.ceil(m["시작초"] + m["어림초"] + 0.8 - 1e-9)))


def shot(k):
    s = C[k]
    out = {"컷": k, "그림": f"{k}.jpg", "쓰는초": used(k), "누구": s["누구"], "동작": s["동작"], "카메라": s["카메라"]}
    if s.get("끝그림"):
        out["끝그림"] = s["끝그림"]
    for f in ("선버스트동작", "선버스트카메라"):   # 10-31 — 선버스트 길 그림일 때만 웹꾸러미가 바꿔 쓴다
        if s.get(f):
            out[f] = s[f]
    if k in CHANGES:
        out["카메라"] = CHANGES[k]["카메라"]
        out["원본카메라"] = s["카메라"]
        out["바꾼까닭"] = CHANGES[k]["까닭"]
        if CHANGES[k].get("동작"):
            out["동작"] = CHANGES[k]["동작"]
            out["원본동작"] = s["동작"]
    if s["말"]:
        who, line, t0, kind = s["말"]
        out["말"] = {"누가": who, "대사": line, "시작초": t0, "꼴": "입 맞춤" if kind == "입" else "입 가림 · 화면 밖", "음절": syl(line), "어림초": line_secs(line)}
    if s.get("덧말"):
        out["덧말"] = [{"누가": w, "대사": l, "시작초": t, "꼴": kd, "어디서": how, "어림초": line_secs(l)} for w, l, t, kd, how in s["덧말"]]
    if s.get("B이어말"):
        out["B이어말"] = {"대사": s["B이어말"], "어림초": line_secs(s["B이어말"]), "까닭": "다음 컷(1-9) 첫머리 화면 밖 말 — 방식 B에서만 이 판이 이어 만든다"}
    return out


def sound_flag(shots):
    kinds = [C[s["컷"]]["말"][3] for s in shots if C[s["컷"]]["말"]]
    if "입" in kinds:
        return "켬"
    if kinds:
        return "B만 켬"
    return "끔"


def desc(k):
    i = INFO[k]
    return f"{i['화면']} — 카메라 {INFO[k]['카메라'] if k not in CHANGES else '요즘 기법: ' + CHANGES[k]['짧게']}"


def build():
    in_bundle = {a: b for a, b in BUNDLES}
    second = {b for a, b in BUNDLES}
    order = [f"{c['화']}-{c['컷']}" for c in CUTS_JSON]
    pans, alts = [], []
    for k in order:
        if k in second:
            continue
        if k in in_bundle:
            a, b = k, in_bundle[k]
            sa, sb = shot(a), shot(b)
            cut_at = round(max(1.0, used(a) + 0.7), 1)
            ln = max(4, math.ceil(cut_at + used(b) + 0.8 - 1e-9))
            lb = ln
            for s_, base_t in ((sa, 0.0), (sb, cut_at)):
                if s_.get("말"):
                    lb = max(lb, min(7, math.ceil(base_t + s_["말"]["시작초"] + s_["말"]["어림초"] + 0.8 - 1e-9)))
            p = {"id": f"p7-{a}-{b.split('-')[1]}", "컷": [a, b], "길이": ln, "자르는초": cut_at, "낱판": [f"p7-{a}", f"p7-{b}"],
                 "설명": f"두 샷 묶음 — {INFO[a]['화면'].split(' — ')[0]} → {INFO[b]['화면'].split(' — ')[0]}", "소리": sound_flag([sa, sb]), "샷": [sa, sb]}
            if p["소리"] != "끔":
                p["소리참고"] = {"A": "", "B": "", "없음": None}
                p["소리줄"] = sound_lines([a, b])
                if lb != ln:
                    p["B길이"] = lb
            pans.append(p)
            for k2 in (a, b):
                alts.append(single(k2, alt=True))
        else:
            pans.append(single(k))
    # 요즘 기법으로 바꾼 컷은 원본 카메라 판을 대안으로 하나씩 — 받은 뒤 나란히 보고 고른다
    for k in CHANGES:
        p = single(k, alt=True)
        sh = p["샷"][0]
        sh["카메라"] = sh.pop("원본카메라")
        if "원본동작" in sh:
            sh["동작"] = sh.pop("원본동작")
        sh.pop("바꾼까닭", None)
        p["id"] = f"p7-{k}o"
        p["설명"] = f"원본 카메라 — 요즘 기법 판(p7-{k})과 나란히 보고 고름 · {INFO[k]['화면']}"
        alts.append(p)
    return pans + alts


def single(k, alt=False):
    s = shot(k)
    ln = length_single(k)
    note = f" — 요즘 기법: {CHANGES[k]['짧게']}" if k in CHANGES else ""
    p = {"id": f"p7-{k}", "컷": [k], "길이": ln, "설명": ("묶음 대신 — " if alt else "") + INFO[k]["화면"] + note, "소리": sound_flag([s]), "샷": [s]}
    if alt:
        p["대안"] = True
    if p["소리"] != "끔":
        p["소리참고"] = {"A": "", "B": "", "없음": None}
        p["소리줄"] = sound_lines([k])
        lb = length_b(k, s, ln)
        if lb != ln:
            p["B길이"] = lb
    return p


MEMO = ("7번 브랜디드 숏드라마 「사랑 한 칸」 60초 × 2화 — 시댄스 2.5 1일 무제한 웹 판 지시문(2026-10-29). 시작 그림은 10-28 확정 이미지 콘티(git 밖 콘티/p7/정지컷, "
        "1080×1920) — 10-29 시댄스 앞 일관성 검수(Opus + 아르곤 대조)로 고친 컷(유호님 확인 끝 10-29 「이대로 좋아」): 1-1(도시락 속) · 1-10(1-9 판을 같은 자리 "
        "펀치인으로 잘라 서진 시선을 이안 쪽으로) · 1-12(1-14 판을 같이 씀) · 2-10e(지나가는 다른 옷 다리 지움) · 2-16(잘린 오른팔) · 2-20(허공의 찻잔 지움) · "
        "2-31(방문을 흰 문으로), Fable 지시문 검수로 2-42(식탁 물건을 2-43과 같게)까지 여덟 — 옛 판 정지컷/_옛_20261029(02_콘티 8-1 · 8-5). 「후보판」 2-1p · 1-1p는 쓰지 않기로 한 첫 걸이 후보(10-29 — 기록용, 순서표 밖 · 2-1 · 1-1은 원본대로). "
        "카메라는 02_콘티 2절(원본 프레임 실측 · 눈 확인) 그대로이고, 흔들림 크기는 원본 가장자리 띠 실측(콘티/p7/카메라_우리_배경.json); 요즘 기법으로 바꾼 컷만 "
        "「원본카메라」 · 「바꾼까닭」이 붙는다(02_콘티 「요즘 기법으로 바꾼 컷」). 동작은 2절 「우리 화면」 · 이야기 한 장대로 한 가지씩, 리액션은 부드럽게. "
        "길이 = max(4, ⌈쓰는 초 + 0.8⌉), 두 샷 묶음은 ⌈자르는 초 + 둘째 쓰는 초 + 0.8⌉(자르는 초 = 첫 쓰는 초 + 0.7). "
        "【7번만의 칸 — 조율 세션이 웹꾸러미에 붙일 때】 판의 「소리」: 켬(입 맞춤 48컷 — 웹에서 소리 켬) · 끔 · 「B만 켬」(입이 가려진 · 화면 밖 말 — 방식 B일 때만 켜고 "
        "목소리를 그 판에서 만든다). 판의 「소리참고」: 방식 A(타입캐스트로 구운 그 판의 입 맞춤 대사만, 앞 0.3초 무음 뒤 샷 「말」의 시작초에 놓은 mp3 — 최종은 "
        "후시녹음) · 방식 B(배역마다 목소리 견본 하나 — 생성 목소리를 최종으로) 파일 자리 — 목소리 방식이 정해지면 채운다(지금 비움). 판의 「소리줄」 {A, B, 없음}: "
        "지시문 끝 SOUND 줄을 방식에 따라 바꿔 쓴다(B는 끝에 굽기 시트 목소리 시험과 같은 VOICE 줄, 「없음」은 소리 참고를 그림과 함께 못 넣거나 첫 화면을 다시 짤 때 — "
        "매진 임박 「소리 참고 없이」와 같은 길). 「B길이」: 방식 B에서 대사가 컷보다 길면 말이 끝날 때까지 받는 길이(원본처럼 말이 다음 컷 밑으로 넘어감). "
        "샷의 「덧말」: 그 컷에 겹치는 다른 사람의 화면 밖 말(1-9 이안 · 1-14 민재 J컷) — A · 없음은 편집에서 얹고 B는 「어디서」대로. 샷의 「B이어말」(1-8): 방식 B에서 "
        "이 판이 다음 컷 첫머리 말까지 이어 만든다. 대사가 없는 판의 소리는 공통 「소리」(무음).")


def main():
    pans = build()
    spec = {"메모": MEMO, "편": "p7", "이름": "7번 숏드라마 「사랑 한 칸」", "비율": "9:16",
            "그림": "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p7/정지컷",
            "공통": {"장르": "a Korean romantic-comedy vertical short drama (a branded web drama)", "누구": WHO, "보기": LOOK, "소리": SILENT},
            "판": pans, "후보판": candidates()}
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        mode = sys.argv[sys.argv.index("--보기") + 2] if len(sys.argv) > sys.argv.index("--보기") + 2 else "A"
        p = next(x for x in pans + spec["후보판"] if x["id"] == k)
        txt = preview(spec, p, mode)
        print(txt)
        print(f"\n({len(txt)}자 · 판 길이 {p['길이']}초{' · B길이 ' + str(p['B길이']) if p.get('B길이') else ''} · 소리 {p['소리']})")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(spec, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    main_p = [p for p in pans if not p.get("대안")]
    alt_p = [p for p in pans if p.get("대안")]
    print(f"판 {len(pans)} — 주판 {len(main_p)}(묶음 {sum(len(p['샷']) > 1 for p in main_p)}) · 대안 {len(alt_p)} · 컷 {sum(len(p['컷']) for p in main_p)}")
    print(f"길이 합 — 주판 {sum(p['길이'] for p in main_p)}초 · 대안 {sum(p['길이'] for p in alt_p)}초 · 방식 B일 때 주판 {sum(p.get('B길이', p['길이']) for p in main_p)}초")
    print("소리 —", {f: sum(1 for p in main_p if p['소리'] == f) for f in ("켬", "B만 켬", "끔")})
    longest = max(pans, key=lambda p: len(preview(spec, p, "B")))
    print("가장 긴 지시문", longest["id"], len(preview(spec, longest, "B")), "자 · 가장 긴 판", max(p.get('B길이', p['길이']) for p in pans), "초")
    print("→", OUT)


def first_line(has_end):
    s = ("@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people and "
         "animals, faces, hair and clothes.")
    if has_end:
        s += " @이미지 2 is the exact last frame: the camera arrives at exactly that framing at the very end."
    return s


def preview(spec, p, mode):
    """웹꾸러미.py prompt()와 같은 순서 — 소리 줄만 샷의 「소리줄」[방식]으로(조율 세션이 꾸러미에 붙일 몫)."""
    c = spec["공통"]
    shots = p["샷"]
    L = []
    if len(shots) == 1:
        s = shots[0]
        L.append(first_line(bool(s.get("끝그림"))))
        L.append(f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, vertical 9:16 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.")
        L += [f"{k}: {c['누구'][k]}" for k in s["누구"]]
        L.append("ACTION: " + s["동작"])
        L.append("CAMERA: " + s["카메라"])
        L.append(c["보기"])
        L.append((p.get("소리줄") or {}).get(mode) or c["소리"])
    else:
        t = p["자르는초"]
        L.append(f"This video is TWO SHOTS of {c['장르']}, vertical 9:16, joined by ONE hard cut at {t:g} s — the same moment in the same place under the same light; any "
                 "person or object seen in both shots looks exactly the same in both; nobody is added who is not described for that shot; no other cuts, no slow motion, "
                 "no speed ramp, no end card.")
        keys = []
        for s in shots:
            for k in s["누구"]:
                if k not in keys:
                    keys.append(k)
        L += [f"{k}: {c['누구'][k]}" for k in keys]
        for i, s in enumerate(shots):
            a, b = (0, t) if i == 0 else (t, None)
            tok = "@이미지 1" if i == 0 else "@이미지 2"
            span = f"{a:g}–{b:g} s" if b else f"{a:g} s to the end"
            L.append(f"SHOT {i + 1} ({span}) begins exactly on {tok} — same framing, light and colors. ACTION: {s['동작']} CAMERA: {s['카메라']}")
        L.append(c["보기"])
        L.append((p.get("소리줄") or {}).get(mode) or c["소리"])
    return "\n".join(L)


if __name__ == "__main__":
    main()
