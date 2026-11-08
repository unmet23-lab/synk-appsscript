# 컷 연속성 검사 — 콘티 · 지시문 · 편집 단계에서 「사람이 기억하지 않아도 걸리게」(2026-11-09, 고립·은둔 공모 「문 앞」 지적 9건에서).
#
# 왜 있나: 11-08 「문 앞」 마감 직전에 유호님이 아홉 가지를 짚으셨다 — 실내인데 눈이 떨어짐 · 노크에 쪽지가 떨림 · 문이 혼자 닫힘 · 열린 문의 쪽지가
#   지도와 다름 · 화면 밖 글자 「1월」 · 접사마다 이웃 쪽지가 제각각 · 쪽지 붙인 손 뒤에 봉투가 갑자기 생김 · 노크 소리 전에 놀란 얼굴 · 두드리려다 참는 손
#   클로즈 누락. 모두 사람이 기억해야 잡히던 것이라, 표(컷순서.json) → 기계 검사 → 눈으로 볼 시트로 옮겼다. 정본 규칙은
#   docs/마케팅/제작양식/광고영상_슬롭점검표.md 33 · 35~42, 적용 기록은 docs/마케팅/제작양식/문앞_지적9건_관문_20261108.md.
#
#   python -I -X utf8 tools/컷연속성검사.py <컷순서.json> [--영상 <최종.mp4>] [--받음 <판 폴더> [--앞 <파일 앞머리, 예: siryc->]]
#                                           [--그림 <정지 그림 폴더>] [--지시문 <꾸러미 폴더 | 지시문.txt …>] [--지도 <소품 지도.json>]
#                                           [--항목 소품,사건,소리,지시문,점,고요,지도] [--출력 <폴더>] [--json] [--간격 0.6,1.0]
#   python -I -X utf8 tools/컷연속성검사.py 지시문 <꾸러미 폴더 | 지시문.txt …> [--실내 <컷,…>] [--json]
#
#   표만 주면(영상 · 그림 없이) 콘티 단계 검사 — 소품 상태 표 · 사건 네 박 표 · 소리 사건 ↔ 반응 간격 · 표의 물건 반응 메모.
#   --지시문: 굽기 전 — 물건이 소리 · 바람에 반응 · 큰 물건의 자율 움직임 · 실내 컷의 눈 · 먼지 낱말(시댄스 꾸러미 폴더나 지시문 글 파일).
#   --그림: 이미지 콘티 단계 — 상태가 적힌 컷의 정지 그림(<폴더>/<컷>.png|jpg)을 소품 지도와 대조하고, 실내 컷의 떠다니는 점 후보 시트를 만든다.
#   --받음 · --영상: 편집 단계 — 받은 판(쓰는 구간)이나 최종 판(그 컷의 자리)에서 소품 자리 · 소품 고요 · 큰 물건 고요 · 소리 사건 · 점을 잰다.
#
# 컷순서.json에 더 적는 칸(모두 선택 — 없으면 그 검사는 「표 없음 · 확인」으로만 남는다):
#   detail[] 항목: "실내": true                      — 실내 컷(공중에 떨어지는 점이 있으면 안 된다 — 점 시트를 만든다)
#                  "상태": "5b1" | "없음"             — 쌓이는 소품(쪽지)의 지도 상태 이름(지도.json 「상태」) · 「없음」은 아직 하나도 없음
#                  "가림": ["Y3"]                      — 그 컷에서 손 · 봉투가 가린 소품(대조 · 고요에서 뺀다) · "지도검사": "눈" — 낮 · 햇빛 · 손이 면을 가려 셈이 못 재는 컷(시트만 만들고 확인)
#                  "고요": true                        — 이 컷에서는 소품에 손이 닿지 않고 문도 안 움직인다 → 소품 자리의 장 사이 차이를 잰다(상태 · 지도 필요)
#                  "고정": [x0, y0, x1, y1]           — 사람이 들어오지 않는 동안 움직이면 안 되는 큰 물건(문 · 창) 영역, 화면 비율(0~1) — 사람이 지나는 영역에는 쓰지 않는다
#                  "소품": {"봉투": "손에"}            — 컷마다 소품 상태(화면에 없으면 "화면밖") · "소품행동": {"봉투": "문고리에 건다"} — 이 컷에서 그 소품을 옮기는 동작이 보인다
#                  "시간건너뜀": true                 — 계절 · 날이 바뀌는 컷(소품이 달라져도 된다)
#                  "판": "A14"                         — 받은 판 파일이 컷 이름과 다를 때(A14e → A14)
#   맨 위: "소리사건": [{"이름": "안쪽 노크", "t": 35.5, "반응": "A11c"}]  — 반응은 컷 이름(그 컷의 첫 토막 시작) 또는 "반응t": 초
#          "사건": [{"이름": "첫 쪽지", "넓게": "A1", "감정": "A1c", "행동": "A1h", "결과": "A3"}]  — 점검표 33의 네 박(압축 몽타주는 "압축": true, 둘째 토막은 "A11#2")
#          "점제외": [[x0, y0, x1, y1], …] · "점위까지": 0.72 · "공중": [x0, y0, x1, y1]  — 점 세기에서 뺄 곳(창문 · 표시등) · 바닥 시작 · 공중으로 볼 곳(비율)
#          "지도": "쪽지지도.json"                     — --지도 대신
# 소품 지도.json: {"src", "size": [w, h], "notes": [{"id", "color", "box": [x0, y0, x1, y1], "cx", "cy"}], "상태": {"이름": ["Y1", …]},
#                  "영역": [0.40, 0.20, 0.84, 0.60](선택 — 소품이 붙는 면, 비율), "따뜻한색": "노랑"(선택 — 두 색일 때 R−B가 큰 쪽)}
#   .tmp/contests-20261019/siryc/쪽지지도.py가 만든 꼴 그대로다(색은 둘까지 — 밤 · 햇빛 컷은 검출이 흔들려 「확인」으로 남기고 시트를 본다).
#
# 끝 코드: 0 걸림 · 확인 없음 / 1 걸림 있음 / 2 걸림은 없고 눈으로 볼 것(확인)이 있음 — 통과로 치지 않는다. 결과는 <출력>/결과.json과 시트 그림.
# 한계(11-08 실측): 공중의 점은 픽셀만으로 장면 사이를 가르지 못한다(알갱이 · 벽 질감이 장면마다 달라 옛 A5 419 · 고친 A5 50인데 다른 컷도 200~440) —
#   그래서 점은 수와 확대 시트(「확인」)로 내고 판정은 눈 · 아르곤 맹검(점검표 37)이 한다. 같은 컷의 전 · 후 비교에는 수가 그대로 쓸모 있다.
# 시험: node --test tests/컷연속성검사.test.js
import json, re, subprocess, sys
from pathlib import Path

# ───────── 지시문 낱말 규칙(물건 반응 · 큰 물건 자율 움직임 · 실내 눈) — 꾸러미점검.py도 이 함수를 쓴다 ─────────
# 붙어 있는 종이류(쪽지 · 사진 · 포스터)가 저 혼자 떨리면 걸림. 잎 · 꽃잎 · 커튼 · 리본 · 깃발은 바깥 바람이면 자연스러워 주의만(실내 · 소리 반응이면 사람이 뺀다)
붙은물건 = r"(?:sticky[- ]notes?|notes?|post-?its?|papers?|pages?|photos?|polaroids?|letters?|envelopes?|posters?|stickers?|cards?|memos?)"
부드러운물건 = r"(?:leaves|petals?|curtains?|blinds?|flags?|ribbons?|towels?|tassels?|banners?|laundry|hair ties)"
반응물건 = rf"(?:{붙은물건}|{부드러운물건})"
소리원인 = re.compile(r"\b(?:knocks?|knocking|bangs?|thuds?|sounds?|noises?|vibrations?|footsteps|slam(?:s|med)?|rings?)\b", re.I)
반응동사 = (r"(?:flutters?|fluttering|trembles?|trembling|shivers?|shivering|quivers?|quivering|sways?|swaying|rustles?|rustling|shakes?|shaking|"
           r"vibrates?|vibrating|stirs?|stirring|flaps?|flapping|ripples?|rippling|wobbles?|wobbling|rattles?|rattling|twitches?|twitching|lifting and settling|lifts? and settles?)")
반응 = re.compile(rf"\b{반응물건}\b[^.;,()—–]{{0,45}}?\b{반응동사}\b", re.I)
반응_역 = re.compile(rf"\b(?:shaking|rattling|fluttering|stirring|lifting|rustling|ruffling|trembling|flapping)\b[^.;,()—–]{{0,30}}?\b{반응물건}\b", re.I)   # 「a knock … shaking the sticky notes」
신체 = re.compile(r"\b(?:hands?|fingers?|fingertips?|shoulders?|lips?|voice|chin|knees?|arms?|legs?|head|eyelids?|lashes|breath)\b", re.I)   # 「the letter … her hands tremble」은 사람이 떤다
반응_바람 = re.compile(rf"\b(?:wind|breeze|draft|draught|gust)s?\b[^.;]{{0,60}}?\b{반응물건}\b", re.I)
반응_한 = re.compile(r"(쪽지|종이|포스트잇|커튼|블라인드|낙엽|잎|꽃잎|깃발|사진|편지|포스터|리본)[은는이가의들]?[^.;,()]{0,20}(떨(?!어)|흔들|나부|펄럭|들썩|흩날|팔랑|파르르)")   # 「떨어짐」(떨어지다)은 떨림이 아니다
따옴 = re.compile(r"「[^」]*」|“[^”]*”|\"[^\"]*\"|'[^']*'")
큰물건 = r"(?:doors?|gates?|windows?|drawers?|cupboards?|cabinets?|lids?|shutters?|hatch(?:es)?|panels?)"
자율동사 = (r"(?:opens?|opening|closes?|closing|shuts?|shutting|swings?|swinging|drifts?|drifting|creaks?|creaking|slides?|sliding|moves?|moving|"
           r"begins? to (?:swing|open|close|move)|starts? to (?:swing|open|close|move)|falls? (?:open|shut)|eases? (?:open|shut)|inches? (?:open|shut)|wider|more open|further open)")
# 동사는 물건 바로 뒤(부사 몇 개까지)에 와야 한다 — 「the floor under the door darkens as a shadow moves」처럼 다른 주어의 동사는 잡지 않는다(A7 오탐)
부사 = r"(?: (?:slowly|gently|quietly|suddenly|silently|slightly|again|then|now|finally|softly|itself|a little|a bit|further|more|wider|behind (?:her|him|them)|in front of (?:her|him|them)|beside (?:her|him|them)|to (?:her|his|their) (?:left|right)))*"
자율 = re.compile(rf"\b{큰물건}\b(?: (?:with|of|to|in|at|on|behind|beside|next to) [a-z' -]{{1,30}}?)?{부사}\s+{자율동사}\b", re.I)   # 「the door with the sticky notes drifts open」도
자율_한 = re.compile(r"(문|창문|창|서랍|뚜껑|셔터|대문|덧문)[이가은는]?\s*(?:조금 |살짝 |더 |천천히 )*(열|닫|움직|밀리|흔들|돌아)")
명시자율 = re.compile(r"\b(?:on its own|by itself|all by itself|of its own accord)\b|저절로|혼자서?\s*(?:열|닫|움직)|스스로", re.I)
자동문 = re.compile(r"\b(?:elevator|lift|subway|train|bus|automatic|sliding|revolving|garage|shutter|gate of the|turnstile)\b|엘리베이터|지하철|자동문|전철|버스", re.I)
지킴 = re.compile(rf"\b{큰물건}\b\s+(?:is|are|was|were|stays?|stayed|remains?|remained|hangs?|stands?|sits?|left|kept)\b[^.;,]{{0,24}}?\b(?:open|ajar|shut|closed|still|fixed|as it is|where it is|put|in place)\b"
                r"|\b(?:leaves?|leaving|holds?|holding|keeps?|keeping|props?|propping)\s+(?:the|it|a)?\s*" + 큰물건 + r"\b[^.;,]{0,10}\b(?:open|shut|closed|ajar)\b", re.I)
# 움직임을 부정하는 말에만 건다 — 「the door never opens」 · 「nothing on the door moves」 · 「stay perfectly still」은 지키는 말이고, 「opens without warning」의 without · 「still tremble」의 still은 아니다(11-09 Astra)
움직임부정 = re.compile(
    r"\b(?:never|not|no|nothing|none|neither|nor|doesn'?t|don'?t|won'?t|can'?t|cannot|without)\b[^.;,]{0,25}?\b(?:opens?|opening|closes?|closing|shuts?|swings?|swinging|drifts?|drifting|moves?|moving|movement|budges?|trembles?|trembling|flutters?|fluttering|shakes?|shaking|sways?|swaying|stirs?|stirring|rustles?|rustling|quivers?|shivers?|flaps?|ripples?|wobbles?|rattles?|falls?|lifts?)\b"
    r"|\b(?:stays?|stayed|remains?|remained|keeps?|kept|holds?|held|is|are|hangs?|hanging|sits?|lies?)\b[^.;,]{0,20}?\b(?:still|flat|fixed|in place|put|motionless|shut|closed|as it is|as they are|where it is|where they are|untouched|unmoved)\b"
    r"|움직이지 않|열리지 않|닫히지 않|흔들리지 않|떨리지 않|그대로|정지|고정|멈춰", re.I)
부정_한 = re.compile(r"않|안 |정지|고정|그대로|멈춰|움직이지|없")   # 한국어 메모(남길 것)용
# 행위자 — 손 · 사람이 실제로 문을 움직이는 말만(「her hand to knock」 · 「a hand's width」 같은 손 낱말만으로는 아니다, 11-09 Astra)
행위자 = re.compile(
    r"\bhand in\b|\bhands? (?:reach|reaches|push|pushes|pull|pulls|grip|grips|grab|grabs|hold|holds|open|opens|close|closes|come|comes|slip|slips|slide|slides|rest|rests|catch|catches|draw|draws|swing|swings|nudge|nudges)\b"
    r"|\b(?:fingers?|fingertips?|palms?|elbows?|shoulders?|knees?|foot|feet|boots?|sneakers?)\b[^.;]{0,20}\b(?:push|pull|nudge|kick|hold|press|catch|open|close|shove)"
    r"|\bhandle (?:turns?|turning|is turned|dips?|moves?|clicks?)\b|\b(?:latch|lock|bolt) (?:clicks?|turns?|slides?)\b"
    r"|\b(?:someone|a person|the person|the man|the woman|the child|the friend|the neighbou?r|the owner)\b[^.;]{0,40}\b(?:open|close|pull|push|shut|swing|slide)"
    r"|\b(?:she|he|they|[A-Z][a-z]+)\b[^.;]{0,50}?\b(?:opens?|closes?|shuts?|pulls?|pushes?|nudges?|kicks?|swings?|slides?|props?|holds?|draws?|tugs?)\b[^.;]{0,30}\b" + 큰물건
    + r"|\b(?:pulled|pushed|drawn|tugged|kicked|nudged|held|swung|slid|opened|closed|shut) (?:open|shut|closed|ajar|by|back|wide|inward|outward|aside)\b|\b(?:opened|closed|pushed|pulled) by\b"
    r"|손이|손으로|밀어|밀면|당겨|당기|잡아|잡고|누가|사람이|안에서 (?:열|밀|당)", re.I | re.M)
창밖 = re.compile(r"\b(?:outside|out the window|through the (?:window|glass|pane)|beyond the (?:glass|window)|past the window|outdoors|out there|on the street|in the street|across the street|rooftops?|sky|off (?:her|his|their|the) (?:coat|shoulders?|hair|sleeves?|hat|scarf|bag))\b|창밖|밖에|바깥|하늘|털어", re.I)
소리줄표식 = re.compile(r"^\s*(?:SOUND|VOICE|AUDIO|MUSIC|SFX|AMBIENCE|CAMERA)\s*:", re.I)   # CAMERA 줄도 — 「a drone flies at the window in one unbroken move」는 창이 움직이는 게 아니다
명시실내 = re.compile(r"\bindoors?\b\s*[:：—-]|^\s*indoors?\b|^\s*(?:interior|inside the (?:flat|apartment|house|room|stairwell))\b\s*[:：—-]|실내\s*[:：]", re.I | re.M)   # 글이 스스로 「Indoors:」라고 밝힌 컷은 밝힌 실내


def 행위자있나(문맥, 물건):
    """그 물건(door · gate …)을 실제로 움직이는 손 · 사람 · 손잡이가 문맥(이 문장 + 앞 문장)에 있나 — 다른 물건을 당기는 손(「she pulls the drawer; the door swings shut」) ·
    문 아닌 데 쓴 손(「her hand pats the note」)은 행위자가 아니다(11-09 Astra · 아르곤)."""
    o = rf"(?:{물건}s?|it|them|handle|knob|latch|lock|bolt)"
    pats = [r"\bhand in\b", r"\bhands? (?:reach|reaches|come|comes|slip|slips|emerge|emerges)\b",
            rf"\b(?:hands?|fingers?|fingertips?|palms?|foot|feet|shoulders?|elbows?|knees?)\b[^.;]{{0,25}}?\b(?:push|pushes|pull|pulls|nudge|nudges|kick|kicks|hold|holds|press|presses|catch|catches|open|opens|close|closes|shove|shoves|swing|swings|draw|draws|grip|grips|grab|grabs)\b[^.;]{{0,20}}?\b{o}\b",
            r"\b(?:handle|knob|latch|lock|bolt)s? (?:turns?|turning|is turned|dips?|moves?|clicks?|rattles?)\b",
            rf"\b(?:she|he|they|someone|a person|the person|the man|the woman|the child|the friend|the neighbou?r|the owner|[A-Z][a-z]+)\b[^.;]{{0,50}}?\b(?:opens?|closes?|shuts?|pulls?|pushes?|nudges?|kicks?|swings?|slides?|props?|holds?|draws?|tugs?|turns?)\b[^.;]{{0,30}}?\b{o}\b",
            rf"\b{o}\b[^.;]{{0,20}}?\b(?:is|are|was|were|gets?) (?:pulled|pushed|drawn|tugged|kicked|nudged|held|swung|slid|opened|closed|shut)\b",
            r"\b(?:opened|closed|pushed|pulled|swung) by\b", r"손이|손으로|밀어|밀면|당겨|당기|잡아|잡고|누가|사람이|안에서 (?:열|밀|당)"]
    return any(re.search(p, 문맥, re.I) for p in pats)
실내낱말 = re.compile(r"\b(?:indoors?|inside the (?:flat|apartment|house|building|room|stairwell)|interior|stairwell|hallway|corridor|landing|apartment|living[- ]room|bed[- ]room|kitchen|office|classroom|lobby|elevator|basement|studio apartment|dorm[- ]room)\b"
                  r"|실내|계단참|복도|아파트 안|방 안|거실|부엌|사무실|교실|로비|엘리베이터|지하", re.I)
알갱이 = re.compile(r"\b(?:snow\w*|flakes?|sleet|hail(?:stones?)?|dust motes?|motes|particles?|petals?|confetti|embers?|ash(?:es)?|sparkles?|glitter|pollen|feathers?|fireflies|raindrops?)\b"
                 r"|\b(?:falls?|falling|drifts?|drifting|floats?|floating|swirls?|swirling|flutters?|fluttering|rains?|raining|snows?|snowing)\b[^.;,]{0,20}\b(?:down|through the air|in the air|around her|around him|from above|past)\b"
                 r"|눈송이|눈이 (?:내|날|떨어|흩)|먼지가? (?:날|떠)|꽃잎이 (?:떨어|날)|재가 날|비가 (?:내|오)", re.I)
알갱이부정 = re.compile(r"\b(?:no|nothing|never|not|without|free of|clear of|none)\b|\b(?:snow|rain|snowfall|rainfall|it) (?:has |had )?stop(?:s|ped)\b|없|않|안 |멈", re.I)   # 「she stops mid-step and snow falls」의 stops는 눈을 멈추는 말이 아니다(아르곤)
# 「Indoors: … nothing falls or drifts anywhere」처럼 실내에 떨어지는 것이 없다고 못 박은 줄
알갱이부정줄 = re.compile(r"\b(?:nothing|no|never|not|without|none)\b[^.;]{0,40}\b(?:falls?|falling|drifts?|drifting|floats?|floating|flakes?|snow\w*|dust|particles?|debris|in the air)\b"
                      r"|\b(?:air|stairwell|room|hallway)\b[^.;]{0,20}\b(?:clear|still|empty|clean)\b|아무것도 (?:떨어지지|날리지|떠다니지)|눈(?:이|은) (?:없|오지 않|내리지 않)", re.I)


def 문장들(글):
    """마침표 · 물음표 · 줄바꿈으로 문장을 나눈다(지시문은 ACTION 한 줄에 세미콜론으로 사건을 잇는다 — 그래서 절은 따로 나눈다)."""
    return [s.strip() for s in re.split(r"(?<=[.!?。])\s+|\n+", 글) if s.strip()]


def 절들(문장):
    return [c.strip() for c in re.split(r"[;—–,()]| - ", 문장) if c.strip()]


def 지시문검사(글, 실내=None):
    """지시문 글 하나 → [(등급, 항목, 글)]. 실내: True · False · None(글에서 실내 낱말로 판단).
    물건(걸림): 쪽지 · 종이 · 커튼이 노크 · 바람에 반응(떨림 · 펄럭임)하거나, 문 · 창 · 서랍이 손 없이 열리고 닫힌다.
    실내(걸림): 실내 컷인데 눈 · 먼지 · 꽃잎이 떨어진다 · 떠다닌다. 실내(주의): 실내 컷인데 「아무것도 떨어지지 않는다」 한 줄이 없다."""
    out = []
    문장목록 = 문장들(글)
    # 실내: 컷순서 · --실내로 밝힌 컷과 글이 스스로 「Indoors:」라 밝힌 컷은 걸림. 낱말(corridor · apartment)로 짐작한 실내는 반쯤 열린 복도 · 옥상일 수 있어 주의만(11-09 시즌1 옆집 비 · 눈 컷 오탐)
    밝힌실내 = 실내 is True or (실내 is None and bool(명시실내.search(글)))
    짐작실내 = not 밝힌실내 and 실내 is None and bool(실내낱말.search(글))
    # 물건 규칙은 소리 · 목소리 줄(SOUND: · VOICE: — 줄 단위로 뺀다, 문장을 나눈 뒤가 아니라)에는 걸지 않는다 — 「the soft thud of the door shutting」은 소리 묘사다
    물건글 = "\n".join(l for l in 글.split("\n") if not 소리줄표식.match(l))
    물건문장 = 문장들(물건글)
    for si, s in enumerate(물건문장):
        문맥 = (물건문장[si - 1] + " " if si > 0 else "") + s   # 행위자는 이 문장과 바로 앞 문장에서(「she turns the brass knob. At 1.0 s the door swings open」)
        절목록 = 절들(s)
        for k, c in enumerate(절목록):
            if 지킴.search(c) or 움직임부정.search(c): continue
            물건m = re.search(rf"\b{큰물건}\b", c, re.I); 큰물건절 = bool(물건m or re.search(r"문|창|서랍|뚜껑", c))
            if 명시자율.search(c) and 큰물건절:
                out.append(("걸림", "물건", f"큰 물건이 저 혼자 움직인다 — 「{c[:90]}」(문 · 창은 손으로만 움직이고 그 뒤로 그대로 · 점검표 35 · 38)")); continue
            if 큰물건절 and (자동문.search(c) or (k > 0 and 자동문.search(절목록[k - 1]))): continue   # 엘리베이터 · 지하철 · 자동문은 저 혼자 닫히는 것이 맞다 — 그 절이나 바로 앞 절에 그 낱말이 있을 때만
            m = 반응.search(c) or 반응_역.search(c) or 반응_한.search(c) or 반응_바람.search(c)
            if m and 신체.search(c[m.start():m.end() + 14]): m = None   # 「the letter … her hands tremble」 · 「envelope from her shaking hand」는 사람
            if m:
                붙은 = bool(re.search(rf"\b{붙은물건}\b", c, re.I) or re.search(r"쪽지|종이|포스트잇|사진|편지|포스터", c))
                소리곁 = bool(소리원인.search(c) or (k > 0 and 소리원인.search(절목록[k - 1])))   # 소리 원인은 그 절이나 바로 앞 절에
                실내커튼 = bool(re.search(r"\b(?:curtains?|blinds?)\b|커튼|블라인드", c, re.I)) and (밝힌실내 or 짐작실내)
                if 붙은 or 소리곁 or 밝힌실내 or 실내커튼:
                    out.append(("걸림", "물건", f"물건이 소리 · 바람에 반응한다 — 「{c[:90]}」(반응은 사람으로만 · 물건은 정지 · 점검표 38)"))
                else:
                    out.append(("주의", "물건", f"잎 · 커튼 · 리본이 바람에 움직인다 — 「{c[:90]}」(바깥 바람이면 자연스럽다 · 실내거나 소리에 반응하는 것이면 뺀다 · 점검표 38)"))
                continue
            if 자율.search(c) or 자율_한.search(c):
                물건 = (물건m.group(0).lower().rstrip("s") if 물건m else "door")
                if not 행위자있나(문맥, 물건):
                    out.append(("걸림", "물건", f"큰 물건이 손 없이 움직인다 — 「{c[:90]}」(「몇 초에 어느 손이 잡아 당긴다」로 쓰거나 「문은 그대로」 · 점검표 35 · 38)"))
    if 밝힌실내 or 짐작실내:
        부정줄 = bool(알갱이부정줄.search(글))
        for s in 문장목록:
            for c in 절들(s):
                if not 알갱이.search(c): continue
                if 알갱이부정.search(c): 부정줄 = True; continue
                if 창밖.search(c): continue   # 창밖 · 바깥의 눈은 실내 공중이 아니다
                if 밝힌실내: out.append(("걸림", "실내", f"실내 컷에 떨어지는 · 떠다니는 것 — 「{c[:90]}」(실내는 「nothing falls or drifts」 · 그림의 공중 점도 지운다 · 점검표 37)"))
                else: out.append(("주의", "실내", f"실내 낱말이 있는 컷에 떨어지는 · 떠다니는 것 — 「{c[:90]}」(실내가 맞으면 뺀다 · 컷순서에 실내: true를 적으면 걸림으로 센다 · 점검표 37)"))
        if not 부정줄:
            out.append(("주의", "실내", "실내 컷인데 「Indoors: nothing falls or drifts anywhere」 같은 한 줄이 없다 — 그림의 작은 점을 모델이 눈 · 먼지로 움직인다(점검표 37)"))
    return out


def 남길것검사(글):
    """컷순서의 「남길 것 · line」처럼 한국어 메모에 물건 반응이 적혀 있으면 주의(「쪽지가 두 번 떨림」 — 옛 설계가 표에 남는다). 따옴표 안(쪽지 글 · 대사)은 보지 않는다."""
    글 = 따옴.sub(" ", 글)
    if (반응_한.search(글) or 자율_한.search(글)) and not 부정_한.search(글):
        return [("주의", "물건", f"표에 물건 반응이 적혀 있다 — 「{글[:60]}」(사람 반응으로 바꾸거나 지운다)")]
    return []


def 지시문파일들(경로들):
    """꾸러미 폴더(_순서.json 또는 */지시문.txt) · 글 파일 → [(컷 이름, 파일, 글, 남길 것)]"""
    out = []
    for p in map(Path, 경로들):
        if p.is_dir():
            순서 = p / "_순서.json"
            if 순서.exists():
                for x in json.loads(순서.read_text(encoding="utf-8")):
                    f = p / x["폴더"] / "지시문.txt"
                    sid = str(x.get("id", ""))
                    cut = sid.rsplit("-", 1)[-1] if "-" in sid else re.sub(r"^\d+_", "", x["폴더"])
                    out.append((cut, f, f.read_text(encoding="utf-8") if f.exists() else "", x.get("남길 것", "")))
            else:
                for f in sorted(p.glob("*/지시문.txt")) + sorted(p.glob("*.txt")):
                    out.append((re.sub(r"^\d+_", "", f.parent.name if f.name == "지시문.txt" else f.stem), f, f.read_text(encoding="utf-8"), ""))
        else:
            out.append((re.sub(r"^\d+_", "", p.stem), p, p.read_text(encoding="utf-8"), ""))
    return out


# ───────── 결과 모으기 ─────────
class 결과:
    def __init__(self):
        self.항목들 = []

    def 더함(self, 항목, 컷, 등급, 글, **값):
        x = dict(항목=항목, 컷=컷, 등급=등급, 글=글)
        if 값: x["값"] = 값
        self.항목들.append(x)

    def 코드(self):
        if any(x["등급"] == "걸림" for x in self.항목들): return 1
        if any(x["등급"] == "확인" for x in self.항목들): return 2
        return 0

    def 보고(self):
        표시 = {"걸림": "✗", "확인": "?", "주의": "~", "통과": "✓"}
        for 항목 in ("소품", "사건", "소리", "지시문", "점", "고요", "지도"):
            xs = [x for x in self.항목들 if x["항목"] == 항목]
            if not xs: continue
            n = {g: sum(1 for x in xs if x["등급"] == g) for g in 표시}
            print(f"[{항목}] 걸림 {n['걸림']} · 확인 {n['확인']} · 주의 {n['주의']} · 통과 {n['통과']}")
            for x in xs:
                if x["등급"] == "통과" and 항목 == "지시문": continue
                print(f"  {표시[x['등급']]} {x['컷']}: {x['글']}")
        코드 = self.코드()
        print({0: "끝: 걸림 · 확인 없음", 1: "끝: 걸림 있음 — 고치기 전에는 다음 단계로 가지 않는다", 2: "끝: 걸림은 없고 눈으로 볼 것(확인)이 있다 — 시트를 본 뒤 넘긴다"}[코드])
        return 코드


# ───────── 표 검사(콘티 단계) ─────────
def 표빈칸(seq, r):
    """실내 · 실외 어느 쪽도 안 적은 컷을 센다 — 한 컷에만 적고 나머지를 깜빡하면 아무 말 없이 지나가던 구멍(11-09 아르곤). 막지 않고 알린다."""
    det = seq.get("detail", [])
    빈 = [d["cut"] for d in det if not d.get("실내") and not d.get("실외")]
    if det and 빈 and len(빈) < len(det):
        r.더함("소품", "표", "주의", f"실내 · 실외 표시가 없는 컷 {len(빈)}개({' · '.join(dict.fromkeys(빈))}) — 실내면 실내: true, 바깥이면 실외: true를 적는다(점 시트 · 지시문 실내 걸림이 그 칸을 본다)")


def 소품표검사(seq, r):
    det = seq.get("detail", [])
    props = sorted({k for d in det for k in (d.get("소품") or {})})
    if not props:
        if seq.get("소품") == []: r.더함("소품", "표", "통과", "이 편에는 이어 볼 소품이 없다고 표에 밝혔다(소품: [])"); return
        r.더함("소품", "표", "확인", "소품 상태 표가 없다 — 컷마다 「소품」 칸(봉투 · 가방 · 컵 … 상태, 화면에 없으면 화면밖)을 적는다(없으면 맨 위에 소품: [] · 점검표 41)"); return
    걸림전 = len([x for x in r.항목들 if x["항목"] == "소품"])
    for prop in props:
        last = None; last_i = None; 쓴행동 = set()   # 한 동작은 한 번의 변화만 설명한다(11-09 Astra — 「건다」가 다음 「사라짐」까지 통과시켰다)
        for i, d in enumerate(det):
            cut = d["cut"]; st = (d.get("소품") or {}).get(prop)
            if st is None:
                r.더함("소품", cut, "걸림", f"소품 「{prop}」 칸이 비었다 — 상태를 적는다(없음 · 손에 · 문고리에 · 화면밖 …)"); continue
            if st == "화면밖": continue
            if last is not None and st != last:
                # 동작은 이 컷에서부터 앞 관측 컷까지(앞 컷에서 동작 · 다음 컷에서 결과도 받는다) 거슬러 찾되, 이미 다른 변화를 설명한 동작은 다시 쓰지 않는다
                행동j = next((j for j in range(i, last_i - 1, -1) if (det[j].get("소품행동") or {}).get(prop) and j not in 쓴행동), None)
                건너뜀 = any(det[j].get("시간건너뜀") for j in range(last_i + 1, i + 1))   # 두 관측 사이 어디든(화면밖 컷에 적혀도)
                if 행동j is not None:
                    쓴행동.add(행동j); r.더함("소품", cut, "통과", f"소품 「{prop}」 {last} → {st} ({det[행동j]['소품행동'][prop]})")
                elif 건너뜀:
                    r.더함("소품", cut, "통과", f"소품 「{prop}」 {last} → {st} (시간 건너뜀)")
                else:
                    r.더함("소품", cut, "걸림", f"소품 「{prop}」 {last} → {st} ({det[last_i]['cut']} → {cut}) 사이에 그 소품을 옮기는 동작 컷이 없다 — 동작 컷을 넣거나 그 토막을 뺀다(점검표 41)")
            last, last_i = st, i
    if len([x for x in r.항목들 if x["항목"] == "소품" and x["등급"] != "통과"]) == 걸림전:
        r.더함("소품", "표", "통과", f"소품 {len(props)}가지 · 빈 칸 없음 · 동작 없는 변화 없음")


def 사건표검사(seq, r):
    det = seq.get("detail", []); 사건들 = seq.get("사건")
    if not 사건들:
        if 사건들 == []: r.더함("사건", "표", "통과", "이 편에는 쪼갤 사건이 없다고 표에 밝혔다(사건: [])"); return
        r.더함("사건", "표", "확인", "사건 표가 없다 — 사건(처음 하는 일 · 망설임 · 놀람 · 건넴 · 발견)마다 넓게 · 감정 · 행동 · 결과 컷을 적는다(없으면 사건: [] · 점검표 33)"); return
    시각 = {}   # 「A11」은 첫 토막, 「A11#2」는 둘째 토막
    for d in det:
        n = sum(1 for k in 시각 if k.startswith(d["cut"] + "#")) + 1
        시각.setdefault(d["cut"], d["t"]); 시각[f"{d['cut']}#{n}"] = d["t"]
    for ev in 사건들:
        이름 = ev.get("이름", "?")
        if ev.get("압축"):
            r.더함("사건", 이름, "통과", "압축 몽타주 — 네 박을 묻지 않는다"); continue
        빠짐 = [k for k in ("넓게", "감정", "행동", "결과") if not ev.get(k)]
        없는컷 = [f"{k}={ev[k]}" for k in ("넓게", "감정", "행동", "결과") if ev.get(k) and ev[k] not in 시각]
        if 빠짐: r.더함("사건", 이름, "걸림", f"네 박 가운데 {' · '.join(빠짐)} 컷이 없다 — 넓게 → 감정 클로즈 → 행동 클로즈 → 결과(점검표 33)")
        if 없는컷: r.더함("사건", 이름, "걸림", f"컷순서에 없는 컷을 가리킨다: {' · '.join(없는컷)}")
        if not 빠짐 and not 없는컷:
            ts = [시각[ev[k]] for k in ("넓게", "감정", "행동", "결과")]   # 결과까지 순서를 본다(11-09 Astra)
            if ts != sorted(ts): r.더함("사건", 이름, "걸림", f"순서가 넓게 → 감정 → 행동 → 결과가 아니다({ev['넓게']} {ts[0]}s · {ev['감정']} {ts[1]}s · {ev['행동']} {ts[2]}s · {ev['결과']} {ts[3]}s)")
            else: r.더함("사건", 이름, "통과", f"넓게 {ev['넓게']} → 감정 {ev['감정']} → 행동 {ev['행동']} → 결과 {ev['결과']}")


def 반응시각(seq, ev):
    if ev.get("반응t") is not None: return float(ev["반응t"]), f"{ev['반응t']}s"
    cut = ev.get("반응"); n = int(ev.get("반응번째", 1))
    tokes = [d for d in seq.get("detail", []) if d["cut"] == cut]
    if not tokes or n > len(tokes): return None, f"컷 {cut} 없음"
    return float(tokes[n - 1]["t"]), f"{cut} 시작 {tokes[n - 1]['t']}s"


def 소리표검사(seq, r, 간격=(0.6, 1.0), 영상=None):
    사건들 = seq.get("소리사건")
    if not 사건들:
        if 사건들 == []: r.더함("소리", "표", "통과", "이 편에는 반응을 부르는 소리 사건이 없다고 표에 밝혔다(소리사건: [])"); return
        r.더함("소리", "표", "확인", "소리 사건 표가 없다 — 노크 · 초인종 · 전화처럼 반응을 부르는 소리마다 t와 반응 컷을 적는다(없으면 소리사건: [] · 점검표 42)"); return
    def 간격판정(이름, t, rt, 어디, 출처):
        d = round(rt - t, 3)   # 0.6 − 1e-16 같은 소수 오차로 정상 간격이 걸리지 않게(11-09 Astra)
        if d < 0: r.더함("소리", 이름, "걸림", f"{출처}반응({어디})이 소리({t:.2f}s)보다 {-d:.2f}초 먼저다 — 소리를 반응보다 {간격[0]}~{간격[1]}초 먼저 둔다(점검표 42)")
        elif d < 간격[0]: r.더함("소리", 이름, "걸림", f"{출처}소리({t:.2f}s) → 반응({어디}) 간격 {d:.2f}초 — {간격[0]}초보다 짧다, 소리를 앞당긴다(점검표 42)")
        elif d > 간격[1]: r.더함("소리", 이름, "확인", f"{출처}소리({t:.2f}s) → 반응({어디}) 간격 {d:.2f}초 — {간격[1]}초보다 길다, 반응이 늦어 보이지 않는지 본다")
        else: r.더함("소리", 이름, "통과", f"{출처}소리 {t:.2f}s → 반응 {어디} 간격 {d:.2f}초")
    for ev in 사건들:
        이름 = ev.get("이름", "?"); t = float(ev["t"]); rt, 어디 = 반응시각(seq, ev)
        if rt is None: r.더함("소리", 이름, "걸림", f"반응 자리를 못 찾음 — {어디}"); continue
        간격판정(이름, t, rt, 어디, "표: ")
        if 영상 is not None and not ev.get("소리없음"):
            봉 = 소리봉우리(영상, t)
            if 봉 is None: r.더함("소리", 이름, "확인", "소리 줄을 못 읽음")
            elif 봉["차이dB"] < 6: r.더함("소리", 이름, "걸림", f"{t}s 둘레에서 소리가 안 튄다(봉우리 {봉['봉우리dB']:.1f} dBFS · 바탕 {봉['바탕dB']:.1f} dBFS · 차이 {봉['차이dB']:.1f} dB) — 소리 사건이 섞음에 없거나 다른 시각이다")
            else:
                r.더함("소리", 이름, "통과", f"{t}s 소리 봉우리 {봉['봉우리dB']:.1f} dBFS(바탕보다 {봉['차이dB']:.1f} dB 위, 봉우리 {봉['봉우리t']:.2f}s · 시작 {봉['시작t']:.2f}s)")
                if abs(봉["시작t"] - t) > 0.05: 간격판정(이름, 봉["시작t"], rt, 어디, "실제 소리로: ")   # 표의 시각이 아니라 실제로 소리가 시작한 시각으로 다시 잰다(11-09 Astra)


def 지시문항목(seq, r, 경로들, 실내목록=None):
    실내 = {d["cut"] for d in (seq or {}).get("detail", []) if d.get("실내")} | set(실내목록 or [])
    파일들 = 지시문파일들(경로들)
    if not 파일들: r.더함("지시문", "파일", "확인", "지시문 파일을 못 찾음"); return
    for cut, f, 글, 남길것 in 파일들:
        if not 글: r.더함("지시문", cut, "확인", f"지시문이 비었다: {f}"); continue
        hits = 지시문검사(글, True if cut in 실내 else None)
        for 등급, 항목, 말 in hits: r.더함("지시문", cut, 등급, f"({항목}) {말}")
        for 등급, 항목, 말 in 남길것검사(남길것 or ""): r.더함("지시문", cut, 등급, f"({항목}) {말}")
        if not hits: r.더함("지시문", cut, "통과", "물건 · 실내 낱말 없음")
    if seq:
        for d in seq.get("detail", []):
            for 등급, 항목, 말 in 남길것검사(" ".join(str(d.get(k, "")) for k in ("keep", "남길 것", "line"))): r.더함("지시문", d["cut"], 등급, f"({항목}) {말}")


# ───────── 그림 · 영상 재기 ─────────
def _np():
    import numpy as np
    return np


def 크기(path):
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    parts = pr.stdout.strip().split(",")
    if len(parts) < 2 or not parts[0]: raise RuntimeError(f"ffprobe가 크기를 못 읽음: {path}")
    return int(parts[0]), int(parts[1]), (float(parts[2]) if len(parts) > 2 and parts[2] not in ("", "N/A") else None)


def 프레임들(path, fps=None, t0=None, t1=None, width=None, gray=True):
    """ffmpeg로 프레임을 rawvideo로 받아 numpy (n, h, w[, 3])로. -ss는 -i 앞(빠른 찾기)."""
    np = _np(); w, h, _ = 크기(path)
    if width and width < w: h = int(round(h * width / w / 2)) * 2; w = width
    vf = ([f"fps={fps}"] if fps else []) + [f"scale={w}:{h}", "format=gray" if gray else "format=rgb24"]
    cmd = ["ffmpeg", "-v", "error", "-nostdin"] + (["-ss", f"{t0:.3f}"] if t0 else []) + ["-i", str(path)] + (["-t", f"{(t1 - (t0 or 0)):.3f}"] if t1 is not None else []) + ["-vf", ",".join(vf), "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    ch = 1 if gray else 3; n = len(raw) // (w * h * ch)
    arr = np.frombuffer(raw[: n * w * h * ch], np.uint8)
    return arr.reshape((n, h, w) if gray else (n, h, w, 3))


def 한장(path, t):
    """t초의 한 장(RGB numpy)."""
    fr = 프레임들(path, t0=t, t1=t + 0.05, gray=False)
    if len(fr) == 0: fr = 프레임들(path, t0=max(0.0, t - 0.1), gray=False)   # 끝에 닿았으면 그 앞
    if len(fr) == 0: raise RuntimeError(f"{path} {t}s 프레임 없음")
    return fr[0]


def 그림읽기(path):
    from PIL import Image
    np = _np()
    return np.array(Image.open(path).convert("RGB"))


def 상태소품(지도, 상태, 가림=None):
    """그 상태에 있어야 할 소품 id — 「없음」은 빈 목록, 「all」은 전부, 가림(손 · 봉투에 가린 자리)은 뺀다."""
    keep = [] if 상태 == "없음" else (지도["상태"].get(상태) if 상태 != "all" else [n["id"] for n in 지도["notes"]])
    if keep is None: raise KeyError(f"지도에 상태 {상태} 없음 — {list(지도['상태'])} · all · 없음")
    return [k for k in keep if k not in set(가림 or [])]


def 지도대조(rgb, 지도, 상태, 가림=None):
    """쪽지대조.py(11-08)의 셈 그대로 — 소품이 붙는 면에서 면 색보다 뚜렷이 밝은 네모를 찾아 지도의 그 상태 자리와 견준다. 색은 둘까지."""
    np = _np(); from scipy import ndimage
    h, w = rgb.shape[:2]; sx, sy = w / 지도["size"][0], h / 지도["size"][1]
    keep = 상태소품(지도, 상태, 가림)
    fx0, fy0, fx1, fy1 = 지도.get("영역", [0.40, 0.20, 0.84, 0.60])
    arr = rgb.astype(int)
    V = np.max(arr, axis=2)
    door = np.zeros((h, w), bool); door[int(h * fy0):int(h * fy1), int(w * fx0):int(w * fx1)] = True
    dv = V[door]; hist = np.bincount(dv, minlength=256); mode = int(np.argmax(hist[20:235]) + 20); thr = mode + 45
    # 햇빛에 씻긴 밝은 면(A3 · A4)은 밝기 문턱이 소용없다 — 따뜻한 색 종이의 노랑기(R+G 평균 − B)로도 찾는다(쪽지합성.py와 같은 길)
    yellowness = (arr[..., 0] + arr[..., 1]) / 2 - arr[..., 2]; ylim = 60 if thr > 250 else 85
    살색 = (arr[..., 0] - arr[..., 1]) > 26   # 손 · 얼굴은 R이 G보다 뚜렷이 크다 — 노란 종이는 R ≈ G(낮 컷 A4에서 손이 쪽지로 잡혔다)
    bright = door & ((V >= thr) | ((yellowness > ylim) & (V > 140) & ~살색))
    면픽셀 = door & (np.abs(V - mode) < 12)
    door_rb = float(np.median((arr[..., 0] - arr[..., 2])[면픽셀])) if 면픽셀.any() else 0.0
    colors = []
    for n in 지도["notes"]:
        if n["color"] not in colors: colors.append(n["color"])
    warm = 지도.get("따뜻한색") or next((c for c in colors if c in ("노랑", "주황", "빨강", "분홍", "베이지", "살구")), colors[0] if colors else "")
    cool = next((c for c in colors if c != warm), warm)
    side = float(np.median([n["box"][2] - n["box"][0] for n in 지도["notes"]])) * sx
    lab, n = ndimage.label(bright); found = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(ys) < (side * 0.45) ** 2: continue
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max(); bw, bh = x1 - x0, y1 - y0
        if not (side * 0.5 <= bw <= side * 1.7 and side * 0.5 <= bh <= side * 1.7) or bw > 1.6 * bh or bh > 1.6 * bw: continue
        inner = arr[y0 + 6:y1 - 6, x0 + 6:x1 - 6] if (y1 - y0 > 12 and x1 - x0 > 12) else arr[y0:y1 + 1, x0:x1 + 1]
        patch = inner.reshape(-1, 3).mean(axis=0)
        color = warm if (patch[0] - patch[2]) - door_rb > 12 else cool
        found.append(dict(color=color, cx=(x0 + x1) / 2, cy=(y0 + y1) / 2, box=(int(x0), int(y0), int(x1), int(y1))))
    exp = [dict(e, ex=e["cx"] * sx, ey=e["cy"] * sy) for e in 지도["notes"] if e["id"] in keep]
    used = set(); rows = {}; ok = 0; 색불명 = 0
    # 1) 같은 색끼리 자리 맞추기 → 2) 남은 자리는 색을 묻지 않고(밤 · 색 조명은 노랑이 파랑으로 읽힌다 — A6 실측) 자리만으로.
    # 짝짓기는 차례대로 가장 가까운 것을 먹지 않고 0.6변 안 후보끼리 한 쌍씩 최소 비용(헝가리안)으로 — 차례 짝짓기는 둘 다 0.55변 안인 배치를 걸었다(11-09 Astra)
    from scipy.optimize import linear_sum_assignment
    for 색본다 in (True, False):
        남은e = [e for e in exp if not (e["id"] in rows and "맞음" in rows[e["id"]])]
        남은k = [k for k in range(len(found)) if k not in used]
        if 남은e and 남은k:
            cost = np.full((len(남은e), len(남은k)), 1e6)
            for a, e in enumerate(남은e):
                for b, k in enumerate(남은k):
                    f = found[k]; dist = float(np.hypot(f["cx"] - e["ex"], f["cy"] - e["ey"]) / side)
                    if dist <= 0.6 and (f["color"] == e["color"] or not 색본다): cost[a, b] = dist
            ra, cb = linear_sum_assignment(cost)
            for a, b in zip(ra, cb):
                if cost[a, b] < 1e6:
                    e = 남은e[a]; used.add(남은k[b]); ok += 1
                    rows[e["id"]] = f"{e['id']} 맞음({cost[a, b]:.2f}변{'' if 색본다 else ' · 색 못 가림'})"
                    if not 색본다: 색불명 += 1
        for e in exp:
            if e["id"] in rows and "맞음" in rows[e["id"]]: continue
            cands = [float(np.hypot(f["cx"] - e["ex"], f["cy"] - e["ey"]) / side) for k, f in enumerate(found) if (f["color"] == e["color"] or not 색본다) and k not in used]
            rows[e["id"]] = f"{e['id']} 어긋남(가장 가까운 것 {min(cands):.2f}변)" if cands else f"{e['id']} 빠짐"
    extra = [f for k, f in enumerate(found) if k not in used]
    # 지도에는 있지만 이 상태에는 아직 없어야 할 쪽지 자리에 뭔가 붙어 있으면 — 미리 붙은 쪽지(손 · 얼굴이 아니다) → 걸림(11-09 아르곤)
    나중것 = [dict(n, ex=n["cx"] * sx, ey=n["cy"] * sy) for n in 지도["notes"] if n["id"] not in keep and n["id"] not in set(가림 or [])]
    미리붙음 = [n["id"] for n in 나중것 if any(np.hypot(f["cx"] - n["ex"], f["cy"] - n["ey"]) / side <= 0.6 for f in extra)]
    return dict(지도=len(exp), 맞음=ok, 어긋남빠짐=len(exp) - ok, 여분=len(extra), 찾음=len(found), 문밝기=mode, 문턱=thr, 줄=[rows[e["id"]] for e in exp], 색불명=색불명,
                여분자리=[(int(f["cx"]), int(f["cy"]), f["color"]) for f in extra], 미리붙음=미리붙음, exp=exp, found=found, side=side)


def 지도그림(rgb, 대조, 지도, out):
    from PIL import Image, ImageDraw
    im = Image.fromarray(rgb); d = ImageDraw.Draw(im); r = 대조["side"] * 0.55
    warm = 지도.get("따뜻한색") or "노랑"
    for e in 대조["exp"]:
        d.rectangle((e["ex"] - r, e["ey"] - r, e["ex"] + r, e["ey"] + r), outline="red" if e["color"] == warm else "blue", width=4)
    for f in 대조["found"]: d.ellipse((f["cx"] - 7, f["cy"] - 7, f["cx"] + 7, f["cy"] + 7), fill="white")
    fx0, fy0, fx1, fy1 = 지도.get("영역", [0.40, 0.20, 0.84, 0.60]); w, h = im.size
    im.crop((int(w * max(0, fx0 - 0.07)), int(h * max(0, fy0 - 0.03)), int(w * min(1, fx1 + 0.02)), int(h * min(1, fy1 + 0.06)))).save(out, quality=90)


def 정지그림(그림폴더, cut):
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = Path(그림폴더) / f"{cut}.{ext}"
        if p.exists(): return p
    return None


def 지도항목(seq, r, 지도, 출력, 그림폴더=None, 영상=None, 받음=None, 앞=""):
    det = seq.get("detail", []); 본것 = 0
    for d in det:
        st = d.get("상태")
        if not st: continue
        cut = d["cut"]; 본것 += 1
        몇째 = sum(1 for x in det[:det.index(d) + 1] if x["cut"] == cut)   # 같은 컷의 토막마다 시트 이름을 달리(앞 토막 시트를 뒤 토막이 덮지 않게)
        try:
            if 영상 is not None:
                t = d["t"] + min(0.4, d["dur"] / 2); rgb = 한장(영상, t); 어디 = f"최종 {t:.1f}s"
            elif 받음 is not None:
                clip = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
                if not clip.exists(): r.더함("지도", cut, "확인", f"받은 판 없음: {clip.name}"); continue
                t = float(d.get("in", 0)) + min(0.4, d["dur"] / 2); rgb = 한장(clip, t); 어디 = f"{clip.name} {t:.1f}s"
            else:
                p = 정지그림(그림폴더, cut)
                if not p: r.더함("지도", cut, "확인", f"정지 그림 없음: {그림폴더}/{cut}.png"); continue
                rgb = 그림읽기(p); 어디 = p.name
            대조 = 지도대조(rgb, 지도, st, d.get("가림"))
        except Exception as e:
            r.더함("지도", cut, "확인", f"대조 못 함 — {e}"); continue
        시트 = Path(출력) / (f"지도_{cut}.jpg" if 몇째 == 1 else f"지도_{cut}_{몇째}.jpg"); 지도그림(rgb, 대조, 지도, 시트)
        요약 = f"상태 {st} · 지도 {대조['지도']}장 중 맞음 {대조['맞음']}{f'(색 못 가림 {대조['색불명']})' if 대조['색불명'] else ''} · 어긋남/빠짐 {대조['어긋남빠짐']} · 여분 {대조['여분']} (찾음 {대조['찾음']} · 면 밝기 {대조['문밝기']}) · {어디} · 시트 {시트.name}"
        값 = {k: 대조[k] for k in ("지도", "맞음", "어긋남빠짐", "여분", "찾음")}
        if d.get("지도검사") == "눈":
            r.더함("지도", cut, "확인", f"「지도검사: 눈」 컷 — 낮 컷 · 손이 면을 가려 셈이 못 재는 컷이라 시트를 눈으로 본다. {요약}", **값)
        elif 대조["지도"] and 대조["찾음"] == 0:
            r.더함("지도", cut, "확인", f"검출 0 — 밤 · 햇빛 컷은 이 셈이 못 센다, 시트를 눈으로 본다. {요약}", **값)
        elif 대조["지도"] and 대조["맞음"] == 0 and 대조["찾음"] < 대조["지도"]:
            r.더함("지도", cut, "확인", f"하나도 못 맞추고 찾은 수도 모자람 — 검출이 흔들리는 프레임이다, 시트를 눈으로 본다. {요약}", **값)
        elif 대조["어긋남빠짐"]:
            r.더함("지도", cut, "걸림", f"{요약} — {' · '.join(x for x in 대조['줄'] if '맞음' not in x)}{(' · 여분 ' + str(대조['여분자리'])) if 대조['여분'] else ''}(손 · 봉투가 가린 자리면 그 컷에 「가림」을 적는다)", **값)
        elif 대조["미리붙음"]:
            r.더함("지도", cut, "걸림", f"{요약} — 이 상태에는 아직 없어야 할 자리 {대조['미리붙음']}에 쪽지가 벌써 붙어 있다(미리 붙은 쪽지 — 그림을 고치거나 상태를 바로잡는다)", **값)
        elif 대조["여분"]:
            r.더함("지도", cut, "확인", f"{요약} — 지도에 없는 자리 {대조['여분자리']}: 새 쪽지면 걸림, 손 · 얼굴(살색)이면 넘긴다 — 시트로 본다", **값)
        else:
            r.더함("지도", cut, "통과", 요약, **값)
    if not 본것: r.더함("지도", "표", "확인", "「상태」가 적힌 컷이 없다 — 쌓이는 소품(쪽지 · 스티커)이 있는 편이면 와이드 컷마다 지도 상태를 적는다(점검표 39)")


def 소품움직임(frames, 지도, 상태, 가림=None, pad=3):
    """지도 소품 자리마다 이웃 장과의 평균 차이(20fps) — 소품이 떨리면 수십, 고요하면 1 안팎(11-08 실측: 떨림 판 36~84 · 고요 판 ≤ 1.05 · 압축 잡음 ≤ 3.4)."""
    np = _np(); n, h, w = frames.shape; sx, sy = w / 지도["size"][0], h / 지도["size"][1]
    try: keep = 상태소품(지도, 상태, 가림)
    except KeyError: keep = []
    out = {}
    for nn in 지도["notes"]:
        if nn["id"] not in keep: continue
        x0, y0, x1, y1 = [int(round(v * s)) for v, s in zip(nn["box"], (sx, sy, sx, sy))]
        a = frames[:, max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad].astype(int)
        if a.shape[1] < 2 or a.shape[2] < 2 or n < 2: continue
        d = [float(np.abs(a[i] - a[i - 1]).mean()) for i in range(1, n)]
        # 바탕: 소품 네 쪽(위 · 아래 · 왼 · 오른)의 같은 크기 조각 — 장마다 네 쪽 가운데 가장 고요한 값을 쓰고(사람이 한쪽을 지나가도 다른 쪽이 남는다),
        # 문턱에는 소품이 가장 크게 움직인 그 장의 값을 쓴다(패치마다 전체 최대를 먼저 내면 사람이 네 쪽을 차례로 스칠 때 문턱이 치솟아 떨림을 놓친다 — 11-09 아르곤)
        bh, bw = y1 - y0, x1 - x0; gap = 30
        patches = [frames[:, max(0, y0 - gap - bh):max(0, y0 - gap), x0:x1], frames[:, y1 + gap:y1 + gap + bh, x0:x1],
                   frames[:, y0:y1, max(0, x0 - gap - bw):max(0, x0 - gap)], frames[:, y0:y1, x1 + gap:x1 + gap + bw]]
        장별 = []
        for bg in patches:
            if bg.shape[1] > 2 and bg.shape[2] > 2:
                bg = bg.astype(int); 장별.append([float(np.abs(bg[i] - bg[i - 1]).mean()) for i in range(1, n)])
        k = int(np.argmax(d))
        장바탕 = [min(p[i] for p in 장별) for i in range(n - 1)] if 장별 else [0.0] * (n - 1)
        out[nn["id"]] = dict(최대=round(max(d), 2), 중앙=round(float(np.median(d)), 2), 최대시각=round((k + 1) / 20, 2), 바탕최대=round(장바탕[k], 2), 바탕중앙=round(float(np.median(장바탕)), 2))
    return out


def 영역움직임(frames, region):
    """큰 물건 영역의 이웃 장 차이(10fps · 480폭): 95% 값과 20 넘는 픽셀 비율 — 문이 움직이면 95% 42 · 7%, 고요하면 3 · 0.9%(11-08 A15 실측)."""
    np = _np(); n, h, w = frames.shape
    x0, y0, x1, y1 = int(region[0] * w), int(region[1] * h), int(region[2] * w), int(region[3] * h)
    reg = frames[:, y0:y1, x0:x1].astype(int)
    p95, frac, 누적p95, 누적frac = [], [], [], []
    for i in range(1, n):
        d = np.abs(reg[i] - reg[i - 1]); p95.append(float(np.percentile(d, 95))); frac.append(float((d > 20).mean() * 100))
        c = np.abs(reg[i] - reg[0]); 누적p95.append(float(np.percentile(c, 95))); 누적frac.append(float((c > 20).mean() * 100))   # 첫 장과의 차이 — 1px씩 천천히 미는 문도 쌓이면 보인다(11-09 Astra)
    if not p95: return None
    k = int(np.argmax(p95)); kc = int(np.argmax(누적p95))
    return dict(p95최대=round(max(p95), 1), p95중앙=round(float(np.median(p95)), 1), 비율최대=round(max(frac), 2), 최대시각=round((k + 1) / 10, 1),
                누적p95최대=round(max(누적p95), 1), 누적비율최대=round(max(누적frac), 2), 누적최대시각=round((kc + 1) / 10, 1))


def 고요항목(seq, r, 지도, 영상=None, 받음=None, 앞=""):
    det = seq.get("detail", []); 본것 = 0
    for d in det:
        cut = d["cut"]; st = d.get("상태") if d.get("고요") else None; 고정 = d.get("고정")   # 소품 고요는 「고요: true」인 컷만(손이 닿거나 문이 열리는 컷은 움직여도 된다)
        if not (st and 지도) and not 고정: continue
        if 영상 is not None:
            # 컷 경계 안쪽으로 두 장쯤 여백 — -ss 찾기가 한두 장 밀려 앞 · 뒤 컷 장이 섞이면 장면 전환 차이가 거짓 걸림이 된다(11-09 아르곤)
            src, t0, t1, 어디 = 영상, d["t"] + 0.08, d["t"] + d["dur"] - 0.08, f"최종 {d['t'] + 0.08:.2f}~{d['t'] + d['dur'] - 0.08:.2f}s"
        elif 받음 is not None:
            src = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
            if not src.exists(): r.더함("고요", cut, "확인", f"받은 판 없음: {src.name}"); continue
            t0, t1 = float(d.get("in", 0)), float(d.get("out", d.get("in", 0) + d["dur"])); 어디 = f"{src.name} {t0:.1f}~{t1:.1f}s"
        else:
            continue
        본것 += 1
        if st and 지도 and st != "없음":
            try: fr = 프레임들(src, fps=20, t0=t0, t1=t1, width=720)
            except Exception as e: r.더함("고요", cut, "확인", f"프레임 못 읽음 — {e}"); continue
            mv = 소품움직임(fr, 지도, st, d.get("가림"))
            if not mv: r.더함("고요", cut, "확인", f"상태 {st}에 잴 소품이 없다")
            else:
                # 소품마다 판정하고 가장 센 등급을 쓴다(최대값이 큰 소품만 보면 바탕이 작은 다른 소품의 걸림을 놓친다 — 11-09 Astra)
                def 등급(v): return 2 if v["최대"] > max(5.0, 3 * v["바탕최대"]) else (1 if v["최대"] > 3.5 else 0)
                worst_id, v = max(mv.items(), key=lambda kv: (등급(kv[1]), kv[1]["최대"]))
                글 = f"소품 자리 움직임 최대 {v['최대']}({worst_id} · {v['최대시각']}s) · 바탕 {v['바탕최대']} · {어디}"
                값 = {k: mv[k]["최대"] for k in mv}
                if 등급(v) == 2: r.더함("고요", cut, "걸림", f"{글} — 소품이 떨리거나 움직인다(지시문에서 물건 반응을 빼고 다시 굽는다 · 점검표 38)", **값)
                elif 등급(v) == 1: r.더함("고요", cut, "확인", f"{글} — 살짝 움직였을 수 있다, 1/8초 띠로 본다", **값)
                else: r.더함("고요", cut, "통과", 글, **값)
        if 고정:
            try: fr = 프레임들(src, fps=10, t0=t0, t1=t1, width=480)
            except Exception as e: r.더함("고요", cut, "확인", f"프레임 못 읽음 — {e}"); continue
            m = 영역움직임(fr, 고정)
            if not m: r.더함("고요", cut, "확인", "고정 영역 프레임이 둘 미만")
            else:
                글 = f"고정 영역 95% 차이 최대 {m['p95최대']}(중앙 {m['p95중앙']}) · 20 넘는 비율 최대 {m['비율최대']}% · {m['최대시각']}s · 첫 장 대비 누적 95% {m['누적p95최대']} · 비율 {m['누적비율최대']}%({m['누적최대시각']}s) · {어디}"
                센움직임 = m["p95최대"] >= 15 or m["비율최대"] >= 5.0 or m["누적p95최대"] >= 15 or m["누적비율최대"] >= 5.0
                살짝 = m["p95최대"] >= 8 or m["비율최대"] >= 2.5 or m["누적p95최대"] >= 8 or m["누적비율최대"] >= 2.5
                if 센움직임: r.더함("고요", cut, "걸림", f"{글} — 큰 물건이 움직인다(문 · 창은 손으로만, 그 구간을 자르거나 다시 굽는다 · 점검표 35). 사람이 이 영역을 지나는 컷이면 고정 대신 「고요」(소품 자리)로 본다", **m)
                elif 살짝: r.더함("고요", cut, "확인", f"{글} — 사람이 영역에 들어왔거나 살짝 움직였다(천천히 밀리는 문 포함), 띠로 본다", **m)
                else: r.더함("고요", cut, "통과", 글, **m)
    if not 본것: r.더함("고요", "표", "확인", "「고요: true」(소품 자리) · 「고정」(큰 물건 영역)이 적힌 컷이 없다 — 소품 · 문 · 창이 가만히 있어야 하는 컷에 적는다(점검표 35 · 38)")


def 점후보(rgb, 제외=(), 위까지=None, 공중=None):
    """밝고 작은 점 후보 — 바탕(중앙값 흐림)보다 40 넘게 밝고 작은(≤24px@2752) 덩어리. 어두운 바탕 위 고립된 것만 따로 센다."""
    np = _np(); import cv2; from scipy import ndimage
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY); h, w = g.shape; s = h / 2752
    k = max(5, int(round(21 * s)) | 1); bg = cv2.medianBlur(g, k); diff = g.astype(int) - bg.astype(int); cand = diff > 40
    for (x0, y0, x1, y1) in 제외: cand[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = False
    if 위까지 is not None: cand[int(위까지 * h):, :] = False
    if 공중:
        m = np.zeros((h, w), bool); m[int(공중[1] * h):int(공중[3] * h), int(공중[0] * w):int(공중[2] * w)] = True; cand &= m
    lab, n = ndimage.label(cand); objs = ndimage.find_objects(lab); sizes = ndimage.sum(cand, lab, range(1, n + 1))
    out = []; amin, amax, smax = max(2, 3 * s * s), 260 * s * s, 24 * s
    for i, sl in enumerate(objs):
        a = sizes[i]; bh = sl[0].stop - sl[0].start; bw = sl[1].stop - sl[1].start
        if not (amin <= a <= amax) or max(bh, bw) > smax or min(bh, bw) < 2 or a < 0.35 * bh * bw: continue
        pad = max(3, int(7 * s)); y0, y1, x0, x1 = max(0, sl[0].start - pad), min(h, sl[0].stop + pad), max(0, sl[1].start - pad), min(w, sl[1].stop + pad)
        out.append(dict(x=(sl[1].start + sl[1].stop) / 2, y=(sl[0].start + sl[0].stop) / 2, 대비=int(diff[sl].max()), 바탕=int(np.median(g[y0:y1, x0:x1]))))
    xs = np.array([c["x"] for c in out]); ys = np.array([c["y"] for c in out]); rr = 30 * s
    for c in out: c["이웃"] = int(((np.hypot(xs - c["x"], ys - c["y"]) < rr).sum()) - 1)
    고립 = [c for c in out if c["이웃"] == 0 and c["바탕"] < 160]
    return out, 고립


def 점시트(rgb, 고립, out, n=12):
    from PIL import Image, ImageDraw
    h, w = rgb.shape[:2]; s = h / 2752; half = max(16, int(32 * s)); tile = 96
    top = sorted(고립, key=lambda c: -c["대비"])[:n]
    im = Image.fromarray(rgb); sheet = Image.new("RGB", (tile * max(1, len(top)), tile + 18), "black"); d = ImageDraw.Draw(sheet)
    for i, c in enumerate(top):
        crop = im.crop((int(c["x"] - half), int(c["y"] - half), int(c["x"] + half), int(c["y"] + half))).resize((tile, tile), Image.NEAREST)
        sheet.paste(crop, (i * tile, 18)); d.text((i * tile + 3, 2), f"{int(c['x'])},{int(c['y'])} +{c['대비']}", fill=(255, 255, 80))
    sheet.save(out, quality=90)


def 점항목(seq, r, 출력, 그림폴더=None, 영상=None, 받음=None, 앞=""):
    det = seq.get("detail", []); 제외 = seq.get("점제외", []); 위까지 = seq.get("점위까지"); 공중 = seq.get("공중"); 본것 = 0; 시트수 = 0
    for d in det:
        if not d.get("실내"): continue
        cut = d["cut"]; 장들 = []
        try:
            if 영상 is not None:
                for lab, t in (("첫", d["t"] + 0.1), ("끝", d["t"] + d["dur"] - 0.1)): 장들.append((f"최종 {t:.1f}s({lab})", 한장(영상, t)))
            elif 받음 is not None:
                clip = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
                if not clip.exists(): r.더함("점", cut, "확인", f"받은 판 없음: {clip.name}"); continue
                a, b = float(d.get("in", 0)), float(d.get("out", d.get("in", 0) + d["dur"]))
                for lab, t in (("첫", a + 0.1), ("끝", b - 0.1)): 장들.append((f"{clip.name} {t:.1f}s({lab})", 한장(clip, t)))
            else:
                p = 정지그림(그림폴더, cut)
                if not p: r.더함("점", cut, "확인", f"정지 그림 없음: {그림폴더}/{cut}.png"); continue
                장들.append((p.name, 그림읽기(p)))
        except Exception as e:
            r.더함("점", cut, "확인", f"프레임 못 읽음 — {e}"); continue
        본것 += 1
        조각 = []; 값 = {}; 몇째 = sum(1 for x in det[:det.index(d) + 1] if x["cut"] == cut)
        for 번, (어디, rgb) in enumerate(장들):
            후보, 고립 = 점후보(rgb, 제외, 위까지, 공중)
            시트 = Path(출력) / (f"점_{cut}.jpg" if len(장들) == 1 and 몇째 == 1 else f"점_{cut}_{몇째}_{'첫' if 번 == 0 else '끝'}.jpg")   # 토막 · 첫끝으로 이름을 가른다(긴 이름 자르기로 겹치지 않게)
            if 고립: 점시트(rgb, 고립, 시트)
            조각.append(f"{어디} 후보 {len(후보)} · 어두운 바탕 고립 {len(고립)}" + (f" · 시트 {시트.name}" if 고립 else "")); 값[어디] = len(고립)
        # 수는 판정이 아니다(11-08 실측 — 장면마다 알갱이 · 질감이 달라 눈과 먼지만 가려내지 못한다) — 시트를 눈 · 아르곤 맹검(점검표 37)이 본다. 같은 컷 전 · 후 비교에만 수를 쓴다
        r.더함("점", cut, "주의", "실내 · " + " / ".join(조각) + " — 시트에 눈 · 먼지 같은 점이 보이면 그림에서 지우고 지시문에 「nothing falls」", **값)
        시트수 += sum(1 for 어디 in 값 if 값[어디])
    if not 본것: r.더함("점", "표", "확인", "「실내」가 적힌 컷이 없다 — 실내 장면이면 컷에 실내: true를 적는다(점검표 37)")
    elif 시트수: r.더함("점", "시트", "확인", f"실내 컷 {본것}개 · 점 시트 {시트수}장({출력}) — 사람이 눈으로 본 뒤에 넘긴다(수로는 판정하지 않는다 · 점검표 37)")   # 사람 확인이 필요한 결과는 끝 코드에 남긴다(11-09 Astra)


_소리캐시 = {}


def 소리줄(path):
    """소리 전체를 16kHz 모노로 한 번 풀어 20ms 창 dBFS 줄로(-ss 찾기는 AAC에서 반 초쯤 어긋나 쓰지 않는다 — 11-09 실측)."""
    np = _np()
    if str(path) in _소리캐시: return _소리캐시[str(path)]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    if len(raw) < 3200: _소리캐시[str(path)] = None; return None
    x = np.frombuffer(raw, np.int16).astype(float) / 32768.0; win = 320
    n = len(x) // win; rms = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1)) + 1e-9
    _소리캐시[str(path)] = (20 * np.log10(rms), (np.arange(n) + 0.5) * win / 16000)
    return _소리캐시[str(path)]


def 소리봉우리(path, t, 앞=1.5, 뒤=0.4):
    """t 둘레 소리 봉우리(20ms RMS) — 바탕은 t−앞~t−0.3의 중앙값(디지털 무음은 −70 dBFS로 본다). 차이 6dB 아래면 소리 사건이 안 들리는 것."""
    np = _np(); 줄 = 소리줄(path)
    if 줄 is None: return None
    db, tt = 줄
    base = db[(tt >= max(0.0, t - 앞)) & (tt <= t - 0.3)]; peak_zone = (tt >= t - 0.5) & (tt <= t + 뒤)
    if not len(base): base = db[(tt >= t + 0.6) & (tt <= t + 2.0)]   # 영상 첫머리(t < 0.3초)의 소리는 사건 뒤 조용한 자리를 바탕으로(아르곤)
    if not len(base) or not peak_zone.any(): return None
    k = int(np.argmax(np.where(peak_zone, db, -999))); 바탕 = max(float(np.median(base)), -70.0)
    # 시작: 봉우리에서 거슬러 올라가 바탕 + 6dB를 처음 넘은 창(두 번 노크면 큰 둘째가 아니라 첫째 앞머리)
    위 = np.where(peak_zone & (db >= 바탕 + 6))[0]; 시작 = float(tt[위[0]]) if len(위) else float(tt[k])
    return dict(봉우리dB=float(db[k]), 봉우리t=float(tt[k]), 바탕dB=바탕, 차이dB=float(db[k] - 바탕), 시작t=시작)


# ───────── 입구 ─────────
def 인자(argv):
    o = {"_": [], "항목": None, "간격": (0.6, 1.0), "앞": "", "실내": [], "json": False}
    i = 0

    def 값(a):
        if i + 1 >= len(argv) or argv[i + 1].startswith("--"): raise SystemExit(f"{a} 뒤에 값이 없다")
        return argv[i + 1]
    while i < len(argv):
        a = argv[i]
        if a in ("--영상", "--받음", "--그림", "--지도", "--출력", "--앞"): o[a[2:]] = 값(a); i += 2
        elif a == "--지시문":
            o["지시문"] = []; i += 1
            while i < len(argv) and not argv[i].startswith("--"): o["지시문"].append(argv[i]); i += 1
        elif a == "--항목": o["항목"] = [s.strip() for s in 값(a).split(",") if s.strip()]; i += 2
        elif a == "--간격":
            parts = [float(s) for s in 값(a).split(",") if s.strip()]
            if len(parts) != 2 or parts[0] > parts[1]: raise SystemExit("--간격은 「0.6,1.0」처럼 짧은 쪽,긴 쪽 둘이다")
            o["간격"] = (parts[0], parts[1]); i += 2
        elif a == "--실내": o["실내"] = [s.strip() for s in 값(a).split(",") if s.strip()]; i += 2
        elif a == "--json": o["json"] = True; i += 1
        elif a.startswith("--"): raise SystemExit(f"모르는 선택: {a}")
        else: o["_"].append(a); i += 1
    return o


def main(argv):
    o = 인자(argv)
    if not o["_"]:
        print(Path(__file__).read_text(encoding="utf-8").split("import json")[0]); return 2
    r = 결과()
    if o["_"][0] == "지시문":
        지시문항목(None, r, o["_"][1:], o["실내"])
        if o["json"]: print(json.dumps(r.항목들, ensure_ascii=False, indent=1)); return r.코드()
        return r.보고()
    seq_path = Path(o["_"][0]); seq = json.loads(seq_path.read_text(encoding="utf-8"))
    출력 = Path(o.get("출력") or seq_path.parent / "검사_연속성"); 출력.mkdir(parents=True, exist_ok=True)
    지도 = None
    지도경로 = o.get("지도") or seq.get("지도")
    if 지도경로:
        p = Path(지도경로); p = p if p.is_absolute() or p.exists() else seq_path.parent / p
        지도 = json.loads(p.read_text(encoding="utf-8"))
    항목 = set(o["항목"] or ["소품", "사건", "소리", "지시문", "점", "고요", "지도"])
    영상 = o.get("영상"); 받음 = o.get("받음"); 그림 = o.get("그림")
    표빈칸(seq, r)
    if "소품" in 항목: 소품표검사(seq, r)
    if "사건" in 항목: 사건표검사(seq, r)
    if "소리" in 항목: 소리표검사(seq, r, o["간격"], 영상)
    if "지시문" in 항목 and o.get("지시문"): 지시문항목(seq, r, o["지시문"], o["실내"])
    elif "지시문" in 항목:
        for d in seq.get("detail", []):
            for 등급, 항, 말 in 남길것검사(" ".join(str(d.get(k, "")) for k in ("keep", "남길 것", "line"))): r.더함("지시문", d["cut"], 등급, f"({항}) {말}")
    매체 = 영상 or 받음 or 그림
    if 매체:
        if "점" in 항목: 점항목(seq, r, 출력, 그림, 영상, 받음, o["앞"])
        if "지도" in 항목:
            if 지도: 지도항목(seq, r, 지도, 출력, 그림, 영상, 받음, o["앞"])
            else: r.더함("지도", "표", "확인", "소품 지도가 없다(--지도 · 컷순서 「지도」) — 쌓이는 소품이 있는 편이면 첫 콘티에서 지도를 만든다(점검표 39)")
        if "고요" in 항목 and (영상 or 받음): 고요항목(seq, r, 지도, 영상, 받음, o["앞"])
    (출력 / "결과.json").write_text(json.dumps(dict(컷순서=str(seq_path), 영상=영상, 받음=받음, 그림=그림, 항목=r.항목들, 코드=r.코드()), ensure_ascii=False, indent=1), encoding="utf-8")
    if o["json"]: print(json.dumps(r.항목들, ensure_ascii=False, indent=1)); return r.코드()
    코드 = r.보고(); print(f"결과 {출력 / '결과.json'}"); return 코드


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
