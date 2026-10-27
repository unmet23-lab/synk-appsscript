# 12번 이미지 콘티 지시문(2026-10-26) — 컷마다 Gemini Ultra 웹 나노바나나 2.1(4 Argon · 사고 수준 최고가)로 새 대화에 굽는다.
# 짜임은 만족 사례 장부 S33(「이제 닮았어」 — korea-run-montage ego/v3/jobs_v3.py) 그대로:
#   장면 → 배치도 문단 → HIS FACE → HAIR → BODY AND WARDROBE → EXPRESSION → LIGHT → FINISH
# 참고 그림: 1 · 2 확정 얼굴 B · C, 3~5 실제 사진(pro02 · V181 · V204), (6 오른쪽 45° 승인 각도 — 어깨 너머로 돌아보는 컷), 끝 = 배치도(이미지콘티_배치도.py).
# 속사포 6컷(C10~C15)은 원본 프레임이 없어 배치도 없이 화면 안 자리를 숫자로 쓴다(현장노트 gemini_사진 10-25).
#   python -X utf8 이미지콘티_지시문.py  →  git 밖 콘티/p12/ego/jobs.json (run.sh가 id로 읽는다)
import json
import os

V = "C:/Users/q1212/Documents/synk-vendor/"
R = V + "korea-run-montage-20261021/참조_유호/"          # 고정 얼굴 세트 사본(장부 S33과 같은 다섯 장 · 읽기만)
P = V + "pulse-portfolio12-20261024/콘티/p12/"
LAY = P + "배치/"
OUT = P + "정지컷/"
FACE = [R + "1_B정면.jpg", R + "2_C정면.jpg", R + "3_실제_pro02.jpg", R + "4_실제_V181.jpg", R + "5_실제_V204.jpg"]
R45 = R + "6_각도_R45a.jpg"
C16_PLACE = OUT + "C16_g2.png"   # 16a · 16b의 장소 참고 — 같은 차례에서 C16 2판을 먼저 굽는다

PHONE = ("It is a real vertical smartphone photo taken by a fellow traveler holding the phone at eye height — candid, natural handheld framing, "
         "like a single frame from a travel video, not a posed portrait. It is late October in Jeju. Any bystanders are adults with their faces "
         "turned away from the camera or hidden behind others — never blurred, pixelated or smeared — unless described otherwise.")
LAYOUT = ("Image {L} is a layout map from our storyboard: the black silhouette is him, dark grey silhouettes are other people, and the flat light grey "
          "is only empty background. Copy exactly the camera position, height and angle, the framing, and his position, size and pose in the picture; "
          "put the other people where the dark grey silhouettes are. Do not copy the grey — draw the real place described above.")
HIS_FACE = ("HIS FACE: he is the exact same Korean man as in Images 1 and 2 — keep exactly that face in every detail. "
            "Images 3 to 5 are his real photos, for identity only (ignore the short hair in Image 3 and all backgrounds and clothing).{angle} "
            "Show him at his best, as on a good shooting day: well-rested, freshly groomed, clear healthy skin, bright eyes. "
            "His skin is fair and bright with the natural warm undertone it has in Images 1 and 2 — not pale grey, not porcelain-white.")
ANGLE = " Image 6 is a real photo of him with his face turned the same way as in this shot, also for identity only."
HAIR = ("HAIR: his real hair as in Images 1, 2, 4 and 5 — about ten thin, tight cornrows braided straight back flat against the scalp, "
        "every row a separate line all the way to the nape, ending in short thin separate braided tails that only just touch the collar. "
        "No long braids, not gathered into a bun or ponytail. No hat, no cap. He does not wear glasses or sunglasses.")
BODY = ("BODY AND WARDROBE: a slim, lean build — not muscular, not broad. {w} Plain fabrics with no logo, no print, no lettering. "
        "No jewelry, no watch, no rings, no bracelet.")
FINISH = ("FINISH: a real photograph, natural colors, true-to-life skin texture (not airbrushed, no beauty filter, no plastic sheen), "
          "realistic lens perspective, no distortion of his face. No blurred, pixelated or mosaic faces anywhere. No text, no letters, no numbers, no logos, "
          "no signs with readable writing, no labels or decals, no watermark.")
DAY = ("LIGHT: bright clear Jeju daylight, plus a large soft light on his face from the camera side — gentle natural shadows modelling his cheekbones, "
       "nose and jaw, no harsh contrast, no dark shadow on his face.")
LOOK = "calm and relaxed, a natural neutral face, lips closed, no smile, eyes open and looking straight into the lens."

W_TEE = "A plain white crew-neck T-shirt with a regular fit, light beige chino trousers."
W_LINEN = "An ivory linen shirt with the sleeves rolled to the elbow and the top button open, light beige linen trousers, white low-top canvas sneakers."
W_CAMEL = "A camel-colored lightweight windbreaker jacket, unzipped, over a plain white T-shirt; light beige chino trousers; white low-top sneakers."
W_KNIT = "A fine ivory crew-neck knit sweater, light beige chino trousers."
W_CHAR = "A fine charcoal-grey crew-neck knit sweater, dark trousers."


def job(id_, scene, wardrobe, expression=LOOK, light=DAY, layout=True, angle=False, place=None):
    # place: 같은 컷 안 앞 그림(16 → 16a · 16b) — 굽는 차례에 앞 그림이 먼저 생기므로 만들 때는 없어도 된다
    refs = list(FACE) + ([R45] if angle else []) + ([place] if place else []) + ([LAY + id_[:3] + ".png"] if layout else [])
    L = len(refs)
    paras = [scene.format(L=L, S=refs.index(place) + 1 if place else 0) + " " + PHONE]
    if layout:
        paras.append(LAYOUT.format(L=L))
    paras += [HIS_FACE.format(angle=ANGLE if angle else ""), HAIR, BODY.format(w=wardrobe), "EXPRESSION: " + expression, light, FINISH]
    return {"id": id_, "ratio": "9:16", "refs": refs, "prompt": "\n\n".join(paras)}


# 10-27 Fable 이미지콘티 1차(답 git 밖 레퍼런스/p12/검수/fable_이미지콘티_20261027/답.md)로 고친 컷: 3 · 4 구도 · 자세 원본대로, 5 3/4 몸 · 곁눈,
# 7 넥게이터 귀 위 · 헬멧 둘, 8 바지, 11 옆모습 · 번짐, 13 「다들 사진사를 보는데 그만 이쪽」(2판은 그가 작아 3판에서 가슴 위로), 15 간판 글자 없음,
# 16 줌 전 크기 · 16a · 16b는 16 2판을 장소 참고로. 공통 — 둘레 얼굴은 흐리게 쓰면 픽셀 모자이크가 나와 「돌리거나 가림」으로.
JOBS = [
    job("C01",
        "INSIDE A KOREAN DOMESTIC AIRLINER CABIN ON A FLIGHT FROM SEOUL TO JEJU, 9:16, exactly as in Image {L}: seen from across the aisle at seated eye "
        "height and very close, he sits in the middle seat of a row, filling most of the picture from the top of his head down to his lap, his upper body "
        "turned a little toward the camera. A woman companion sits in the seat beside him on the right side of the picture, looking ahead, her face mostly "
        "turned away. Grey seat backs and other passengers' heads behind; small oval windows with bright daylight at the upper left.",
        W_TEE,
        # 원본은 0초부터 이미 이쪽을 보고 있다가 1.2초에 돌린다(Fable 1차 P1-1)
        expression="he is already looking straight into the lens with his head turned toward it — a calm neutral face, lips closed, one eyebrow "
                   "raised very slightly, a tiny dry questioning look; no smile.",
        light="LIGHT: soft bright daylight from the cabin windows plus a large soft frontal light on his face from the camera side — gentle natural shadows."),
    # 원본은 밤 · 뒤보기 좌석 · 오른손(화면 왼쪽)으로 천장 손잡이 · 동행은 카메라 앞 좌석(Fable 1차 P1-2)
    job("C02",
        "AT NIGHT INSIDE AN AIRPORT RENTAL-CAR SHUTTLE BUS IN JEJU, 9:16, exactly as in Image {L}: seen from a seat a couple of rows away at seated eye "
        "height, he sits in a rear-facing grey bus seat on the right side of the picture, his body facing the camera, his right arm (on the left side of the picture) raised holding the "
        "overhead grab handle. In the seat right in front of the camera, at the lower left of the picture, only the back of a woman companion's head (hair "
        "clip) and a man companion's shoulder show. Grey bus seats, half-drawn curtains, and dark windows with orange streetlights outside.",
        W_TEE,
        expression="he is already looking straight into the lens — eyes a little wide and both eyebrows lifted very slightly, a mild surprised deadpan, "
                   "lips closed, no smile.",
        light="LIGHT: warm interior bus lights at night, dark outside, plus a large soft frontal light on his face from the camera side — his face clearly lit."),
    job("C03",
        "A HOTEL INFINITY POOL ON THE JEJU COAST, 9:16, exactly as in Image {L}: the camera stands at the pool edge at standing eye height looking a little "
        "down across a wide sheet of bright turquoise water that fills most of the picture; the horizon and the far side of the pool (white sun loungers, "
        "palm trees, a low stone hotel building) run along the top fifth of the picture, with only a thin strip of pale sky above. He is a small far figure "
        "a little right of center at about 40 percent of the picture height, his head about one twentieth of the picture height: he rests his chest and "
        "forearms on a large inflatable swim ring with wide white and blue stripes from behind it, the ring clearly visible and bigger than his head, his "
        "wet head and shoulders above the water, looking toward the camera. No one else is in the water near him.",
        "A plain white short-sleeve rash guard, wet.",
        light="LIGHT: bright clear midday sun, sparkling water, soft reflected light from the water on his face."),
    job("C04",
        # 4판(10-27 Fable 2차): 배치도를 넣으면 한 발을 벤치에 올리거나 난간 위에 앉힌다(1 · 3판) — 배치도 없이 자세를 말로만
        "ON THE DECK OF A WHITE TOUR YACHT OFF THE JEJU COAST, 9:16: seen from a few steps away at standing height looking slightly down, he sits on the "
        "low seat of the white bench along the rail in the upper right of the picture, his head in the top fifth of the picture: both sneakers flat on the "
        "deck, knees apart, leaning forward with his forearms crossed on his knees — not sitting on the rail or the bench back, no foot up on the bench. "
        "A young woman companion sits on the same bench to the left of him, and a young man companion sits on the deck bench nearer the camera in the lower "
        "middle of the picture, turned away toward the sea. Striped shadows from the canopy fall across the white deck in the lower half. Beyond the rail: "
        "deep blue sea and a green island with a low volcanic peak on the horizon.",
        W_LINEN, layout=False),
    job("C05",
        "AT A BEACH CAFE ON JEJU'S NORTH COAST, 9:16, exactly as in Image {L}: under a sand-colored canvas sun shade, he sits cross-legged on a large white "
        "outdoor daybed with white cushions in the center of the picture, his body turned three-quarters to the left, the small white plate with a slice of "
        "orange cake in his left hand and a fork in his right, caught mid-bite. "
        "More empty white daybeds and canvas shades behind him, palm-like green plants, and a glimpse of emerald sea and white sand. Seen from standing "
        "height a few steps away, looking slightly down.",
        "An ivory linen short-sleeve shirt with an open collar and camel linen shorts, barefoot.",
        expression="he has just lifted his eyes sideways to the lens while chewing — a flat, unimpressed stare, lips closed, no smile."),
    job("C06",
        "ON A GRASSY VOLCANIC HILL (OREUM) IN JEJU IN AUTUMN, 9:16, exactly as in Image {L}: silver eulalia grass covers the slope, a gentle green ridge and "
        "a soft blue sky behind. He sits on the grass beside the dirt trail in the center of the picture, a little below camera height, his body facing the "
        "left side of the picture and his head turned to the lens. Behind him on the slope stands a small cone-shaped Jeju stone tower made of black lava "
        "rocks, and a few hikers far away on the ridge.",
        W_CAMEL),
    # 원본 7 · 8: 두건으로 코까지 덮은 채 뒤돌아 앉아 있다가(7) 가까이 붙으면 손가락으로 두건을 턱 밑까지 내려 얼굴을 드러낸다(8, 21.9~22.3초 — 아르곤 대조 · 0.1초 프레임)
    job("C07",
        "AT AN ATV RIDING PARK IN JEJU, 9:16, exactly as in Image {L}: seen from behind at standing height a few steps away, he sits astride a red "
        "four-wheel ATV in the center of the picture with his back to the camera, his left hand on the handlebar and his right hand pinching a grey neck "
        "gaiter beside his ear. The gaiter is pulled up high over his nose and mouth, so from behind its top edge runs above his ears and wraps the back of "
        "his head up to the roots of the braided tails — only the back of his head with the cornrows, the gaiter, his neck and shoulders show, no face. "
        "Two dark riding helmets rest on the rear rack of the ATV in the lower foreground. Dark volcanic-rock gravel ground, a low black stone wall, other "
        "ATVs parked at the left, and a green oreum ridge with blue sky in the distance. No lettering on clothing, signs or vehicles.",
        "A plain white T-shirt, a plain grey neck gaiter pulled up over his nose and mouth, light beige trousers.",
        expression="not visible — he faces away from the camera.",
        light="LIGHT: bright clear Jeju daylight from the side, soft shadows."),
    job("C08",
        "THE SAME ATV PARK, 9:16, exactly as in Image {L}: a close shot from just behind him at standing height — he sits on the red ATV with his back "
        "mostly to the camera, his shoulder and upper arm filling the left side of the picture, and he looks back over his shoulder straight into the "
        "lens. With the fingers of his right hand he has just hooked the plain grey neck gaiter down from his nose to under his chin, so his whole face "
        "is revealed. In the lower foreground two dark riding helmets rest on the ATV's rear rack; behind him other red ATVs at the right, a dark "
        "volcanic ridge and blue sky.",
        "A plain white T-shirt, light beige chino trousers, the plain grey neck gaiter pulled down and bunched under his chin.",
        expression="his eyes look straight into the lens, calm and completely deadpan — lips closed, no smile, as if this is the most normal place to meet again.",
        angle=True),
    job("C09",
        "ON A WHITE-SAND BEACH IN JEJU WITH A SMALL GREEN ISLAND OFFSHORE, 9:16, exactly as in Image {L}: seen from standing height looking down a little, "
        "he crouches on the sand in the middle of the picture beside a small child who is building a sand castle in the lower left of the picture (the "
        "child is seen from behind, wearing a sun hat and striped arm floats — no child's face); his hand rests on a small light-blue plastic sand bucket. "
        "Clear turquoise shallow water, the small island in the distance, a row of beach umbrellas far away.",
        "A white long-sleeve rash guard and beige swim shorts, barefoot.",
        # 원본 9: 아이와 웃으며 놀다가(23.9 · 24.3초) 고개를 들어 웃음을 거두고 정색해 노려본다(24.8초부터 — 아르곤 대조 · 0.1초 프레임)
        expression="he has just looked up from playing with the child straight into the lens and his smile has just dropped — a serious, slightly stern "
                   "straight face, brows drawn together a little, lips closed, no smile."),
    # 속사포 6컷 — 0.7초씩이라 장소가 한눈에 읽히고 얼굴이 커야 한다(얼굴 폭을 숫자로). 순서는 얼굴이 큰 컷부터, 해 질 녘 → 밤(Fable 1차 P2-9 · P2-10)
    job("C10",
        "IN A QUEUE OUTSIDE A HAENYEO (WOMEN DIVERS) SEAFOOD RESTAURANT ON THE JEJU COAST, 9:16: the camera is right behind him in the line at eye height; "
        "he stands just in front of the camera and looks back over his left shoulder straight into the lens — his head and shoulders fill the upper half "
        "of the picture, his face about one third of the picture width. Beyond him: a low black-stone house with a plain wooden board (no writing), other "
        "people waiting in line, the sea and black lava rocks.",
        W_CAMEL, layout=False, angle=True),
    job("C11",
        "ON A COASTAL ROAD ON UDO ISLAND, JEJU, 9:16: shot from a bicycle riding right beside him in the same direction — he rides a plain rental bicycle "
        "next to the camera, seen from his left side in profile at handlebar height, both hands on one handlebar in front of him, only his head turned to "
        "look straight into the lens; his head and shoulders in the upper middle, his face about one quarter of the picture width. Turquoise sea, black "
        "lava rocks and a low black stone wall behind, streaked with horizontal motion blur. No lettering on the bicycle frame.",
        W_CAMEL, layout=False, angle=True),
    job("C12",
        "IN A TANGERINE ORCHARD IN JEJU, 9:16: dense dark-green tangerine trees full of orange fruit; he stands between two trees, framed by leafy branches "
        "in the near foreground (softly out of focus), holding a small wicker basket of tangerines at his chest; his head and shoulders in the upper "
        "middle, his face about one quarter of the picture width; he looks straight into the lens through the gap in the branches.",
        W_KNIT, layout=False),
    job("C13",
        "AT THE TOP OF SEONGSAN ILCHULBONG (SUNRISE PEAK) IN JEJU, 9:16: a group of eight to ten adult tourists poses in two rows for a group photo at the "
        "crater-rim viewpoint, the huge green grassy crater bowl and the sea behind them. A photographer holding up a phone stands at the LEFT edge of the "
        "picture with his back to us. Every person in the group smiles at that photographer, their faces turned three-quarters to the left, away from our "
        "lens. Seen at standing eye height from a few steps away: he stands at the right end of the front row as the person nearest to our camera, seen "
        "from the chest up and filling the right third of the picture, his face about one fifth of the picture width — the only one not posing, looking "
        "straight into our lens; the photographer and the group stay fully visible to his left.",
        W_CAMEL, layout=False),
    job("C14",
        "IN A SEASIDE CAFE IN AEWOL, JEJU, AT SUNSET, 9:16: seen from our table at seated eye height, he sits at the next table by a big window and has just "
        "lowered his phone after photographing the same slice of orange cake that is on his table; his head and shoulders in the middle of the picture, "
        "his face about one quarter of the picture width, looking straight into the lens. Behind him through the glass the sea glows orange under the "
        "setting sun.",
        W_CHAR, layout=False,
        light="LIGHT: warm golden sunset light from the window behind him plus a large soft frontal light on his face from the camera side, so his face "
              "is clearly and evenly lit, not a silhouette."),
    job("C15",
        "AT A NIGHT MARKET IN JEJU CITY AFTER DARK, 9:16: a skewer stall with a glowing charcoal grill and drifting white smoke in the foreground; "
        "through the smoke he stands in the queue just behind the grill, his head and shoulders in the middle of the picture, his face about one quarter "
        "of the picture width, looking straight into the lens. Behind him only hanging paper lanterns, plain red and yellow cloth awnings and warm string "
        "bulbs — no shop signs or banners with lettering; the crowd of adults behind is out of focus with their faces turned away.",
        W_CHAR, layout=False,
        light="LIGHT: warm night-market light — string bulbs and the orange glow of the grill on his face, plus a soft frontal fill from the camera side; "
              "his face clearly lit, the background darker."),
    # 원본 대표 프레임(29.5초)은 1.42배 줌 뒤라 배치도는 16b가 쓴다. 16은 줌 전 도착 순간 — 배치도 없이 한 걸음 물러난 크기를 숫자로(Fable 이미지콘티 P1-1)
    job("C16",
        "IN THE YARD OF A JEJU BLACK-PORK BARBECUE RESTAURANT IN THE EVENING, 9:16: seen from a neighboring table at seated eye height, a few steps away. "
        "At the next table he sits facing the camera in the middle of the picture, his head at about 40 percent of the picture height and his face about "
        "one fourteenth of the picture width, with his two companions; the woman companion in the foreground sits with her back to the camera on the left (no face), and the man companion "
        "sits at the right side of the table seen in profile, looking at him. A round steel charcoal-grill table with thick black-pork slices in the middle, "
        "small side dishes, gravel ground. Warm string lights, green leaves and a black lava-stone wall behind; only a few other diners far behind with their "
        "backs to the camera.",
        W_CHAR, layout=False,
        light="LIGHT: warm evening light from string bulbs and the grill, plus a large soft frontal light on his face from the camera side; his face "
              "clearly lit."),
    # 16번 첫 1초 — 여행자 손의 폰(원본의 「다른 손님 폰 불빛」 자리, Fable 1차 P1-6 ③). 그는 아직 안 보여 얼굴 참고 없이.
    # 16a · 16b는 한 컷 안의 팬 · 줌이라 다시 구운 C16을 장소 참고로 넣는다(Fable 이미지콘티 P1-1 · P2-1 — 첫 판은 식당이 셋으로 갈라짐)
    {"id": "C16a", "ratio": "9:16", "refs": [C16_PLACE], "prompt": "\n\n".join([
        "IN THE YARD OF A JEJU BLACK-PORK BARBECUE RESTAURANT IN THE EVENING, 9:16: a real vertical smartphone photo taken at seated eye height. Image 1 is "
        "the same restaurant yard a moment later — keep exactly that place: the same round steel charcoal-grill tables, gravel ground, black lava-stone wall, "
        "green leaves and string bulbs (but do not show the people of Image 1). In the lower left foreground, our own hand (a woman's hand, seen from the "
        "camera side) holds a smartphone with its screen facing the camera — the screen is a flat, evenly bright chroma-key green rectangle with nothing on "
        "it; the phone is sharp and fills about a third of the picture width. Beyond it, softly out of focus: the warm-lit yard with smoke from the grills "
        "and only two or three adult diners with their backs to the camera. It is late October.",
        "LIGHT: warm evening light from string bulbs and grills.",
        "FINISH: a real photograph, natural colors, realistic lens perspective. No blurred, pixelated or mosaic faces. No text, no letters, no numbers, "
        "no logos, no signs with readable writing, no watermark."])},
    job("C16b",
        "THE SAME BLACK-PORK RESTAURANT TABLE IN THE EVENING, 9:16. Image {S} is this exact scene a second earlier — keep the same yard, the same round "
        "steel charcoal-grill table, the same black lava-stone wall, string bulbs and gravel, and the same two companions in the same seats and clothes "
        "(the woman in the foreground on the left with her back to the camera, the man at the right of the table in profile), but the camera is now about "
        "1.4 times closer, so he appears about 1.4 times bigger than in Image {S}; framing as in Image {L}. He now holds up his smartphone (dark-brown case) "
        "at chest height with its screen facing the camera — the screen is a flat, evenly bright chroma-key green rectangle with nothing on it. At the same "
        "moment, at the bottom center of the picture, our own hand (a woman's hand, from the camera side) holds up another smartphone whose screen also "
        "faces the camera and is the same flat chroma-key green.",
        W_CHAR,
        expression="calm and deadpan, lips closed, eyes on the lens, his chin lowered by a hair as if giving the smallest nod.",
        light="LIGHT: warm evening light from string bulbs and the grill, plus a large soft frontal light on his face from the camera side; his face "
              "clearly lit.",
        place=C16_PLACE),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for j in JOBS:
        for r in j["refs"]:
            assert os.path.exists(r) or r == C16_PLACE, r
        j["out"] = OUT + j["id"] + "_g{n}.png"
        assert len(j["prompt"]) < 4300, (j["id"], len(j["prompt"]))
        print(j["id"], len(j["refs"]), "장", len(j["prompt"]), "자")
    json.dump(JOBS, open(P + "ego/jobs.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
