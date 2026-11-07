# 로맨스 「다 비침」 편집 전 다시 낼 판(2026-11-07, Claude) — git 밖 pulse-seedance-day-20261028/웹올리기_로맨스_편집1107/
#   python -X utf8 다시_1107_꾸러미.py   → 판 폴더(1_시작 그림 · 3_목소리견본 · 지시문.txt) + _순서.json — 드리미나내기.py가 그대로 읽는다
# 무엇을 왜:
#   손 인서트 넷(C15 · C30 · C56 · C67) — 10-31 판 손을 그대로 둔 시작 그림이라 손이 그을리고 나이 들어 보여, 11-07 Gemini 판 태준(우유 피부)의
#     바로 옆 컷 손(C17 · C28 · C55 · C66)과 갈렸다. 시작 그림의 손만 Codex(GPT 2.5 구독)로 태준 손 참고에 맞춰 고친 판(콘티/romance/손다시_20261107/)에서 다시 낸다.
#     C10 · C46 손은 옆 컷과 맞아 그대로 쓴다.
#   C64 물보라 — 받은 판이 이미 꽂힌 우산 · 공중의 물방울에서 시작해 2초 넘게 멈춰 있었다(사진처럼). 원본 64처럼 떨어지기 직전(공중) 그림에서 낸다.
#   속말 넷 — 속말 다섯(C23 · C46 · C48 뒤 · C54 · C60)은 아직 목소리가 없었다. 6번 「말 판」과 같은 길로 배역 목소리 견본을 넣어 시댄스가 말하게 하고 소리만 쓴다.
#   python -X utf8 다시_1107_꾸러미.py --m2v   → 둘째 꾸러미(웹올리기_로맨스_편집1107_m2v, 아래 BOARDS_M2V)
#   python -X utf8 다시_1107_꾸러미.py --m2v2  → 셋째 꾸러미(웹올리기_로맨스_편집1107_m2v2 — 첫 편집본 맹검이 짚은 C28 · C48 우산, 아래 BOARDS_M2V2)
#   python -X utf8 다시_1107_꾸러미.py --m2v3  → 넷째 꾸러미(웹올리기_로맨스_편집1107_m2v3 — 4장 겹침으로 걸린 C32 · C67, 아래 BOARDS_M2V3)
#   python -X utf8 다시_1107_꾸러미.py --m2v4  → 다섯째 꾸러미(웹올리기_로맨스_편집1107_m2v4 — 떠서 내려앉던 C64, 아래 BOARDS_M2V4)
import json
import os
import shutil
import sys

DAY ="C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028"
SRC = os.path.join(DAY, "웹올리기_로맨스")
OUT = os.path.join(DAY, "웹올리기_로맨스_편집1107")
CONTI = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/romance"
FIX = os.path.join(CONTI, "손다시_20261107")
STILL = os.path.join(CONTI, "선버스트", "정지컷")
VOICE_T = os.path.join(SRC, "029_rs-C25", "3_목소리견본.mp3")   # 태준 견본(rs-목소리-taejun에서 뗀 판 — 태준 대사 판 모두 같은 파일)
VOICE_Y = os.path.join(SRC, "055_rs-C57", "3_목소리견본.mp3")   # 유나 견본

FIRST = "@이미지 1 is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and white balance, same people, faces, hair and clothes."
ONE = "ONE SINGLE CONTINUOUS SHOT of a Korean romance brand film (a premium short-film advert), horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card."
ONE_HS = "ONE SINGLE CONTINUOUS SHOT of a Korean romance brand film (a premium short-film advert), horizontal 16:9 — no cuts, no camera switch, no end card."
LOOK = ("LOOK: a premium Korean romance brand film — real cinema camera, natural skin texture, matte lips, true-to-life colors. Keep the first frame's light, colors and white balance "
        "to the very end — the pink-and-teal neon of the rainy night, the soft grey daylight rain, the warm pub, the cool store light, the sunshine after the rain — with no new light "
        "and no color shift; wherever rain falls in the first frame it keeps falling. The acting is subtle and natural, as in a calm Korean romance drama: small, believable "
        "expressions, never exaggerated, no big toothy grins. The camera moves only as written in CAMERA — where CAMERA says still, it is still. No new text, letters, logos or "
        "labels. Never add a person who is not in the first frame unless ACTION says so.")
SILENT = "SOUND: silent clip — no dialogue, no narration, no music."
STATIC = "CAMERA: static frame — the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake."
HANDHELD = ("CAMERA: handheld, the camera stays in place: small constant handheld jitters of about 0.3% of the frame width — it shakes but does not travel, no push-in, no zoom, "
            "holding the same framing to the end.")
T_SHIRT = ("TAEJUN (shirt, no tie): Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in a white "
           "dress shirt with no tie, the top button open and the sleeves rolled to the elbows, charcoal trousers, a black-strap smartwatch on his left wrist.")
T_JACKET = ("TAEJUN (navy jacket): Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in an "
            "unstructured navy chore jacket with a shirt-style collar (no lapels) over a plain white T-shirt, charcoal trousers and black leather shoes.")
Y_CARDIGAN = ("YUNA (cardigan): Yuna — the same Korean woman as in the first frame (late twenties, long dark-brown wavy hair in a low ponytail, small gold stud earrings) in a soft "
              "blush-pink chunky knit cardigan over a white collared blouse and cream wide-leg trousers.")
Y_BLAZER = ("YUNA (taupe blazer): Yuna — the same Korean woman as in the first frame (long dark-brown wavy hair worn down, small gold stud earrings) in a taupe tailored blazer "
            "over a black knit top and black trousers.")
UMB = ("CLEAR UMBRELLA: the premium clear umbrella exactly as in the first frame — a crystal-clear, glass-like canopy (not cloudy vinyl), thin silver ribs and a thin silver shaft, "
       "and a straight clear acrylic handle with a small frosted milky-white cap; whoever carries it grips the handle; no logo, no text.")
UMB_BLUE = ("MISTY-BLUE UMBRELLA: the same premium umbrella in its new color — a see-through misty-blue tinted canopy, the same thin silver ribs and shaft, the same straight clear "
            "acrylic handle with a small frosted milky-white cap; no logo, no text.")
HANDS = "His hand keeps exactly the same fair, smooth, young skin as in the first frame — slender fingers, no tan, no wrinkles."
VOICE = ("VOICE: @오디오 1 is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, but never play it and never say its words; "
         "perform only the Korean lines written above, the way this moment demands.")

BOARDS = [
    # (id, 컷, 길이, 시작 그림, 목소리 견본, 지시문 줄들, 메모)
    ("rs-C15h", ["C15"], 4, os.path.join(FIX, "C15h.png"), None, [
        FIRST, ONE, T_SHIRT,
        "ACTION: Insert of Taejun's left wrist near the pub table edge: on the black smartwatch's dark screen the small pink heart glows and pulses twice; at about 1.0 s his "
        "other hand quickly slides in from the left and covers the watch face, hiding the heart, and stays there. " + HANDS.replace("His hand keeps", "Both hands keep"),
        HANDHELD, LOOK, SILENT],
     "손 인서트 — 10-31 판 손이 그을리고 나이 들어 C17 손과 갈림. 시작 그림의 손만 고친 C15h(Codex)에서"),
    ("rs-C30h", ["C30"], 5, os.path.join(FIX, "C30h.png"), None, [
        FIRST, ONE, T_SHIRT, Y_CARDIGAN,
        "ACTION: Macro insert at hip height, rainy night: Taejun's empty hand hangs by his side; Yuna's hand comes in from the upper left and slips into his; his hand hesitates "
        "for a beat, then his fingers slowly close around hers. " + HANDS,
        "CAMERA: very slow push-in: the camera physically moves about 8% closer toward the two hands over the whole shot in one slow, steady move — no lens zoom, no shake.",
        LOOK, SILENT],
     "손 인서트 — 태준 손이 C28보다 그을림. C30h(Codex)에서, C31은 옛 rs-C30-31 둘째 샷을 그대로 쓴다"),
    ("rs-C56h", ["C56"], 4, os.path.join(FIX, "C56h.png"), None, [
        FIRST, ONE, T_JACKET, UMB_BLUE,
        "ACTION: Insert under the awning, grey daylight rain behind: Taejun's hand holds out the folded misty-blue umbrella toward her and moves it a little closer to her, "
        "offering it; it waits there. " + HANDS,
        STATIC, LOOK, SILENT],
     "손 인서트 — 손이 C55보다 그을림. C56h(Codex)에서, 목소리는 rs-C55-56의 판 소리를 그대로"),
    ("rs-C67h", ["C67"], 4, os.path.join(FIX, "C67h.png"), None, [
        FIRST, ONE, T_JACKET, UMB,
        "ACTION: Insert in bright sun after the rain: Taejun's hand slowly lifts his folded clear umbrella a little higher up into the sunlight; the water drops on the canopy "
        "glitter and a few drip off; a soft lens flare drifts across. " + HANDS,
        STATIC, LOOK, SILENT],
     "손 인서트 — 손이 C66(흰 손)보다 그을림. C67h(Codex)에서, C68은 옛 rs-C67-68 둘째 샷"),
    ("rs-C64n", ["C64"], 5, os.path.join(FIX, "C64n.png"), None, [
        FIRST, ONE_HS, UMB, UMB_BLUE,
        "ACTION: High-speed product shot in grey daylight rain: the two folded umbrellas, still in the air, fall the last hand's width and land flat on the wet pavement side by "
        "side; at the touch the shallow water bursts up around them in splashing crowns and many droplets fly outward and upward, arc and fall back down; the umbrellas bounce "
        "slightly once and settle, rocking a little. The water keeps moving the whole time — nothing freezes in mid-air.",
        "CAMERA: the camera holds still, low at the pavement; real high-speed slow motion for this shot only — everything moves smoothly and continuously.",
        LOOK.replace("The acting is subtle and natural, as in a calm Korean romance drama: small, believable expressions, never exaggerated, no big toothy grins. ", ""),
        "SOUND: silent clip — no dialogue, no narration, no music."],
     "받은 판은 꽂힌 우산 · 공중 물방울에서 시작해 멈춤 — 원본 64처럼 떨어지기 직전(공중) 그림 C64n(Codex)에서"),
    ("rs-말-태준-1", ["C23"], 7, os.path.join(STILL, "C25.jpg"), VOICE_T, [
        FIRST, ONE, T_SHIRT,
        "ACTION: Rainy night under the shop awning, close on Taejun looking down: he says to himself in Korean — an inner thought, very quiet and low, slow and close to the "
        "microphone, almost a murmur but every syllable clear, with a long pause at each period and a short pause at the comma: \"몰랐다. 숨긴다고 숨긴 게, 다 보이고 있었다는 걸.\" "
        "His lips form the Korean words softly. He does not look at the camera.",
        STATIC, LOOK,
        "SOUND: only his quiet voice saying this Korean line, over soft rain — no music, no other voices, no sound effects.", VOICE],
     "속말 C23 — 소리만 쓴다(그림 버림). 낮고 느리게(초당 4~5음절)"),
    ("rs-말-태준-2", ["C46", "C48"], 8, os.path.join(STILL, "C39.jpg"), VOICE_T, [
        FIRST, ONE, T_JACKET,
        "ACTION: Close on Taejun under his clear umbrella in the grey rain, eyes lowered: he says to himself in Korean two separate inner thoughts — very quiet and low, slow, "
        "almost a murmur but every syllable clear. First, at about 0.5 s: \"그날, 내 손을 피했지.\" Then a full silent pause of about two seconds, and then: "
        "\"넌 눈 하나 깜짝 안 하더라.\" His lips form the Korean words softly. He does not look at the camera.",
        STATIC, LOOK,
        "SOUND: only his quiet voice saying these two Korean lines, over soft rain — no music, no other voices, no sound effects.", VOICE],
     "속말 C46 · C48 뒤 — 소리만 쓴다"),
    ("rs-말-태준-3", ["C60"], 10, os.path.join(STILL, "C39.jpg"), VOICE_T, [
        FIRST, ONE, T_JACKET,
        "ACTION: Close on Taejun under his clear umbrella in the grey rain, his eyes wet: he says to himself in Korean — an inner thought, very quiet and low, slow, close to the "
        "microphone, almost a murmur but every syllable clear, with a short pause at each comma and a long pause after the first sentence: "
        "\"우산을 접고 나니, 서로의 얼굴이 다 말해 버렸다. 여기까지라는 걸.\" His lips form the Korean words softly. He does not look at the camera.",
        STATIC, LOOK,
        "SOUND: only his quiet voice saying this Korean line, over soft rain — no music, no other voices, no sound effects.", VOICE],
     "속말 C60 — 소리만 쓴다"),
    ("rs-말-유나-1", ["C54"], 5, os.path.join(STILL, "C57.jpg"), VOICE_Y, [
        FIRST, ONE, Y_BLAZER,
        "ACTION: Close on Yuna under the shop awning in the grey rain, eyes lowered: she says to herself in Korean — an inner thought, very quiet and low, slow, almost a "
        "murmur but every syllable clear, with a short pause at the comma: \"우리, 한때는 서로가 다 보였다.\" Her lips form the Korean words softly. She does not look at the camera.",
        STATIC, LOOK,
        "SOUND: only her quiet voice saying this Korean line, over soft rain — no music, no other voices, no sound effects.", VOICE],
     "속말 C54 — 소리만 쓴다"),
]


# 둘째 꾸러미(m2v) — 첫 · 끝 프레임으로 받은 rs-C67h · rs-C64n이 4장마다 같은 장(겹친장.py — C67h 창 4/6, C64n 8/8)이고, C64n은 우산이 거의
# 떨어지지 않고 물보라가 낮았다. 시작 그림을 참고(2_참고1_시작)로 넣은 m2v로 다시 낸다(11-07 로맨스 m2v 다시 내기와 같은 길).
M2V = os.path.join(DAY, "웹올리기_로맨스_편집1107_m2v")
SPLASH = ("ACTION: Real high-speed slow-motion product shot in grey daylight rain: the two folded umbrellas from @이미지 1 — the crystal-clear one and the misty-blue one — "
          "drop from a little higher, side by side, and land flat on the wet pavement at about 0.8 s; at the impact the shallow water explodes upward in two splashing crowns "
          "and a spray of hundreds of droplets that rise high above the umbrellas, hang for a moment and fall back in slow motion; the umbrellas bounce once and settle, "
          "rocking. The water keeps moving smoothly the whole time — nothing freezes.")
BOARDS_M2V = [
    ("rs-C67m", ["C67"], 4, os.path.join(FIX, "C67h.png"), None, [b for b in BOARDS if b[0] == "rs-C67h"][0][5], "rs-C67h 4장 겹침 — 같은 그림 · 글로 m2v"),
    ("rs-C64m", ["C64"], 5, os.path.join(FIX, "C64n.png"), None,
     [ln if not ln.startswith("ACTION:") else SPLASH for ln in [b for b in BOARDS if b[0] == "rs-C64n"][0][5]], "rs-C64n 겹침 · 물보라 약함 — 더 높이서 떨어져 크게 튀는 글로 m2v"),
    # C32 — 받은 판이 두 우산 끝이 붙은 채 물보라 왕관이 솟은 정지컷에서 시작해 분홍으로 반짝이는 그래픽처럼 부풀었다(11-07 Gemini 낯선 사람 · 심사 둘 다
    #   「그래픽 같은 이질감 · 물리 법칙 무시」). 원본 32 첫 장처럼 닿기 직전(공중) 밤 네온 그림 C32n(Codex)에서 — 끝 편 C64와 거울이 된다
    ("rs-C32m", ["C32"], 4, os.path.join(FIX, "C32n.png"), None, [
        FIRST, ONE_HS, UMB,
        "ACTION: Real high-speed slow-motion product shot on a rainy night: the two folded crystal-clear umbrellas from @이미지 1 drop the last hand's width and land "
        "side by side in the neon-lit puddle at about 0.6 s; the shallow water splashes up around them in a natural splash and the droplets catch the pink and teal "
        "neon, then fall back; the two umbrellas roll a little toward each other and gently knock together. Natural water physics — no glowing sparkles, no magic "
        "particles, no light flashes.",
        "CAMERA: the camera holds still, low at the puddle; real high-speed slow motion for this shot only — everything moves smoothly and continuously.",
        LOOK.replace("The acting is subtle and natural, as in a calm Korean romance drama: small, believable expressions, never exaggerated, no big toothy grins. ", ""),
        "SOUND: silent clip — no dialogue, no narration, no music."],
     "받은 판 물보라가 그래픽처럼 부풂(맹검 둘) — 원본 32처럼 닿기 직전 그림 C32n에서 m2v"),
]


# 셋째 꾸러미(m2v2) — 첫 편집본 Fable 맹검(11-07, 「고치고 통과」)이 짚은 우산 둘. 시작 그림의 우산만 Codex로 고친 판(손다시_20261107/C28n · C48n)에서.
#   C28 — 시작 그림부터 손잡이 위로 검은 대가 솟아 「마이크처럼 세워 든」 꼴(제품은 곧은 투명 손잡이 끝이 젖빛 마개). C29는 옛 rs-C28-29 둘째 샷 · 「다 보여요,」 소리도 옛 판.
#   C48 — 접은 우산이 술상 뒤에 똑바로 서 「술상 위에 선 우산」으로 읽힘 → 부스 벽에 비스듬히 기대 흐리게. 대사 판이라 두 벌을 내 연기를 견준다.
M2V2 = os.path.join(DAY, "웹올리기_로맨스_편집1107_m2v2")
T_BLUE = ("TAEJUN (blue shirt): Taejun — the same Korean man as in the first frame (short side-parted black hair exactly as in the first frame, clean-shaven, slim) in a pale-blue "
          "dress shirt with a slim charcoal tie and grey trousers, a black-strap smartwatch on his left wrist.")
MINJAE = "MINJAE (green vest): Minjae — the same Korean man as in the first frame (round face, short black hair with messy bangs) in a dark-green knit vest over a white shirt."
VOICE_T48 = os.path.join(SRC, "047_rs-C48", "3_목소리견본.mp3")
BOARDS_M2V2 = [
    ("rs-C28n", ["C28"], 4, os.path.join(FIX, "C28n.png"), None, [
        FIRST, ONE, T_SHIRT, UMB,
        "ACTION: Close on Taejun under the shop awning on the rainy night: his fist holds the folded clear umbrella by its straight clear handle at chest height, the small "
        "frosted milky-white cap at the very top — nothing ever sticks up above the cap. He glances at the cap, then slowly looks down at his rain-soaked left shoulder, caught "
        "out, and back at the umbrella; lips closed, silent. " + HANDS,
        STATIC, LOOK, SILENT],
     "시작 그림부터 손잡이 위 검은 대(맹검 「마이크처럼」) — 우산만 고친 C28n에서"),
    ("rs-C48n", ["C48"], 5, os.path.join(FIX, "C48n.png"), VOICE_T48, [
        FIRST, ONE, T_BLUE, MINJAE, UMB,
        "ACTION: Taejun leans forward and pours beer from a plain brown bottle into Minjae's glass, cutting him off in Korean at about 0.1 s, dry and even: "
        "\"쓸데없는 소리 말고 잔이나 비워.\" Then he sets the bottle down and glances across the table toward Yuna (off screen, left), silent. Minjae, blurred at the right edge, "
        "keeps quiet. The folded clear umbrella stays where it is, leaning out of focus against the wooden booth wall behind the table — it never stands on the table.",
        STATIC, LOOK,
        "SOUND: Taejun speaks only this one Korean line with natural Korean pronunciation and the timing written in ACTION, the lips clearly forming the Korean words wherever "
        "the mouth is visible. No music, no narration, no other voices; Minjae keeps his lips closed and silent the whole time.",
        VOICE + " Only that dialogue and quiet room sound — no music, no other voices."],
     "술상 뒤에 선 우산(맹검 「술상 위에 선 우산」) — 부스 벽에 기댄 C48n에서, 두 벌"),
]


# 넷째 꾸러미(m2v3) — 겹친장.py로 쓰는 구간을 다시 재니(11-07) rs-C32m__2(물보라 왕관은 자연스러움)가 창 6/6, rs-C67m이 창 3개(움직임 0.57–0.61)에서
#   4장마다 같은 장이었고, rs-C32m__3은 매끄럽지만 물이 전혀 튀지 않았다. C32는 「닿는 순간에만 물이 반응」을 더 또렷이 쓴 글로 두 벌, C67은 같은 글로 한 벌.
M2V3 = os.path.join(DAY, "웹올리기_로맨스_편집1107_m2v3")
BOARDS_M2V3 = [
    ("rs-C32m", ["C32"], 4, os.path.join(FIX, "C32n.png"), None,
     [ln if not ln.startswith("ACTION:") else (
         "ACTION: Real high-speed slow-motion product shot on a rainy night: the two folded crystal-clear umbrellas from @이미지 1 fall the last hand's width and land "
         "side by side, flat in the shallow neon-lit puddle, at about 0.6 s. Only at the moment they touch the water does it react: a natural low splash runs along both "
         "umbrellas, small droplets jump up and catch the pink and teal neon, then fall back while the ripples spread; the umbrellas settle and roll a little toward each "
         "other until they gently touch. Natural water physics — no glowing sparkles, no magic particles, no light flashes, nothing frozen in the air.")
      for ln in [b for b in BOARDS_M2V if b[0] == "rs-C32m"][0][5]],
     "rs-C32m__2 겹침 6/6 · __3 물이 안 튐 — 닿는 순간 물이 반응하는 글로 두 벌"),
    ("rs-C67m", ["C67"], 4, os.path.join(FIX, "C67h.png"), None, [b for b in BOARDS if b[0] == "rs-C67h"][0][5], "rs-C67m 겹침 창 3(0.57–0.61) — 같은 글로 한 벌"),
]


# 다섯째 꾸러미(m2v4) — 둘째 판 맹검(Fable · Gemini 둘 다): C64 rs-C64m은 두 우산이 「공중에 떠 있다 엘리베이터처럼 내려온다」(물리 어긋남).
#   「크게 터지는 물보라」를 시킨 글은 떠서 내려앉는 판이 됐고, C32에서 통한 「닿는 순간에만 물이 반응」 글에 무게(중력) · 뜨지 않음을 더해 두 벌.
M2V4 = os.path.join(DAY, "웹올리기_로맨스_편집1107_m2v4")
BOARDS_M2V4 = [
    ("rs-C64g", ["C64"], 5, os.path.join(FIX, "C64n.png"), None,
     [ln if not ln.startswith("ACTION:") else (
         "ACTION: Real high-speed slow-motion product shot in grey daylight rain: the two folded umbrellas from @이미지 1 — the crystal-clear one and the misty-blue "
         "one — fall with their real weight the last hand's width and hit the wet pavement flat, side by side, at about 0.5 s. They never float or hover and never "
         "sink slowly: gravity pulls them straight down. Only at the moment they touch the ground does the water react: it splashes out from under them along their "
         "whole length, droplets jump up and fall back while ripples spread; the umbrellas bounce slightly once, roll a little toward each other and settle. Natural "
         "water physics — no glowing sparkles, no magic particles, nothing frozen in the air.")
      for ln in [b for b in BOARDS if b[0] == "rs-C64n"][0][5]],
     "rs-C64m 「떠 있다 내려옴」(둘째 맹검 둘) — 무게로 떨어지고 닿는 순간에만 물이 반응하는 글로 두 벌"),
    # C20 — 옛 rs-C20(시작 · 끝 그림 + 목소리 견본 → m2v)이 3.7~4.5초에 두 구도를 1초 동안 겹쳐(이중 노출) 넘어갔다(둘째 맹검 Fable — 첫 맹검이 놓침).
    #   현장노트 「끝 그림을 참고로 넣은 m2v는 … 반투명하게 겹쳤다」와 같은 함정 — 끝 그림을 빼고 초점 이동을 글로만, 겹침 금지를 적어 두 벌.
    ("rs-C20n", ["C20"], 7, os.path.join(SRC, "024_rs-C20", "1_시작.jpg"), os.path.join(SRC, "024_rs-C20", "3_목소리견본.mp3"), [
        FIRST, ONE, Y_CARDIGAN, T_SHIRT,
        "ACTION: Two faces at different depths: Yuna's profile in front, sharp — she glances at his wet shoulder, then peers down into the shop window and, at about "
        "0.3 s, mutters to herself in Korean at an easy pace: \"어깨 다 젖으셨네… 하나 사야겠다. 어디 있더라.\" Behind her, out of focus, Taejun stands still and "
        "watches her quietly; when the focus reaches him his face is soft and unguarded, lips closed. Both stay where they are in the first frame — nobody walks closer.",
        "CAMERA: static frame — the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake. Rack focus: from about "
        "4.2 s to 5.2 s the focus shifts smoothly from Yuna's profile in front to Taejun behind her, and stays there — only the focus changes. ONE continuous take: "
        "no dissolve, no crossfade, no double exposure, no second image fading in.",
        LOOK,
        "SOUND: Yuna speaks only this one Korean line with natural Korean pronunciation and the timing written in ACTION, the lips clearly forming the Korean words "
        "wherever the mouth is visible. No music, no narration, no other voices; Taejun keeps his lips closed and silent the whole time.",
        VOICE + " Only that dialogue and quiet room sound — no music, no other voices."],
     "옛 rs-C20 판 안 1초 이중 노출(끝 그림이 겹쳐 들어옴) — 끝 그림 없이 초점 이동만 글로, 두 벌"),
]


def main():
    m2v = "--m2v" in sys.argv
    m2v2 = "--m2v2" in sys.argv
    m2v3 = "--m2v3" in sys.argv
    m2v4 = "--m2v4" in sys.argv
    out_dir, boards = ((M2V4, BOARDS_M2V4) if m2v4 else (M2V3, BOARDS_M2V3) if m2v3 else (M2V2, BOARDS_M2V2) if m2v2 else (M2V, BOARDS_M2V) if m2v
                       else (OUT, BOARDS))
    m2v = m2v or m2v2 or m2v3 or m2v4
    os.makedirs(out_dir, exist_ok=True)
    order = []
    for k, (pid, cuts, sec, start, voice, lines, memo) in enumerate(boards, 1):
        folder = f"{k:03d}_{pid}"
        d = os.path.join(out_dir, folder)
        os.makedirs(d, exist_ok=True)
        ext = os.path.splitext(start)[1].lower()
        first = ("2_참고1_시작" if m2v else "1_시작") + ext
        shutil.copyfile(start, os.path.join(d, first))
        files = [first]
        if voice:
            shutil.copyfile(voice, os.path.join(d, "3_목소리견본.mp3"))
            files.append("3_목소리견본.mp3")
        text = "\n".join(lines)
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(text)
        order.append({"순서": k, "id": pid, "편": "rs", "컷": cuts, "폴더": folder, "길이": sec, "비율": "16:9", "소리": "켬" if voice else "끔",
                      "묶음": False, "대안": False, "방식": "B" if voice else None, "시험": False, "낱판": [], "파일": files, "빠진 파일": [],
                      "지시문 글자 수": len(text), "판 수": 1, "메모": memo})
        print(folder, sec, "초", len(text), "자")
    json.dump(order, open(os.path.join(out_dir, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(out_dir, len(order), "판 ·", sum(b["길이"] for b in order), "초")


if __name__ == "__main__":
    main()
