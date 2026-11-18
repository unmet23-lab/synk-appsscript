# 도담중공업 영어 판 컷표(틀 2) 만들기(2026-11-17, Claude) — 한국어 판은 컷표 체계(11-10) 전에 만든 편이라 컷표가 없다.
#   마감 관문(/마감작업 · tools/영상관문판.py · 컷연속성검사 --영상)이 컷표를 받으므로, 한국어 판의 실제 컷 경계(최종편집.py T · CUTS)와
#   글 콘티(b2b-factory-20261026/02_콘티.md 2절 37컷 표)에서 컷표를 지어 쓴다. 화면은 한국어 판 그대로라 장면 · 인물 문장은 검수용 요약이다(지시문에 쓰지 않는다).
#   연기 박자는 최종편집.py CUTS 설명(판 기록)의 박자를 컷 시각으로 옮겼고, 기록이 없는 컷은 한국어 판 화면을 컷마다 5장 띠로 보고 보이는 것만 적었다(11-17).
#   기준 그림(ref/)과 끝 로고 시안(시안/)은 한국어 판 화면.mp4와 영어 판 끝 장면에서 뽑는다.
#   python -X utf8 컷표_만들기.py [첫 판 영상] [검정 끝 화면 판 영상]   (끝 화면 시안 둘째 · 셋째 — 영상이 없으면 그 시안은 지난 것을 그대로 둔다)   → 이 폴더/컷표.json · ref/*.jpg · 시안/*.jpg
import io
import json
import os
import re
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
B2B = os.path.normpath(os.path.join(HERE, "..", "..", "PULSE_포트폴리오_제작준비_20261012", "video", "b2b-factory-20261026"))
sys.path.insert(0, B2B)
sys.path.insert(0, HERE)
import 최종편집 as E   # noqa: E402
import 영어판 as V      # noqa: E402

rows = {}
for line in open(os.path.join(B2B, "02_콘티.md"), encoding="utf-8"):
    m = re.match(r"\|\s*(\d+)\s*\|\s*[\d.–\- ()]+\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$", line)
    if m and 1 <= int(m.group(1)) <= 37 and int(m.group(1)) not in rows:
        rows[int(m.group(1))] = {"화면": m.group(2).replace("**", ""), "카메라": m.group(3)}

# 컷마다 (구도, 인물, 연기 [(컷 안 초, 무엇)] 또는 사람 없는 컷의 움직임 글)
CUT = {
    1: ("접사 · 얼굴(이마~코) · 3/4 정면", ["준호"], [(0.3, "얼굴 왼쪽에 차가운 도면 빛을 받은 채 아래를 본다"), (0.83, "한 번 깜빡이고 다시 뜬 눈으로 본다")]),
    2: ("접사 · 위에서 비스듬히 · 도면", [], "카메라가 오른쪽 아래로 미끄러지며 3° 기운다"),
    3: ("접사 · 바닥 높이", [], "어두운 바닥에 불꽃이 튄다"),
    4: ("접사 · 강판", [], "어둠에서 용접 불꽃이 켜지며 강판이 호박빛으로 밝아진다"),
    5: ("미디엄 · 옆 · 마스크로 얼굴을 가린 용접공", ["작업자"], [(0.1, "용접공이 고개를 숙이고 용접을 이어 가며 푸른 불꽃이 인다"), (0.7, "불꽃 빛 속에 연기가 위로 피어오른다")]),
    6: ("미디엄 · 배관 틈 너머 · 용접공", ["작업자"], [(0.1, "보안경과 마스크를 쓴 용접공이 이음매에 불꽃을 낸다"), (0.8, "불티가 앞으로 흩어지고 용접공의 손끝이 이음매를 따라간다")]),
    7: ("접사 · 배관 · 어깨 너머", ["작업자"], [(0.0, "장갑 낀 손이 렌치를 돌린다"), (1.75, "모자 쓴 작업자가 몸을 기울여 뒤통수가 화면에 들어온다")]),
    8: ("와이드 · 날개 원 너머 · 정면", ["작업자"], [(0.0, "날개 원 가운데 창 너머로 먼 작업자가 작업대에서 몸을 움직인다"), (0.47, "먼 작업자가 고개를 돌린다")]),
    9: ("접사 · 날개 원판 · 정면", [], "카메라가 원판 쪽으로 다가간다(1.1초에 약 11%)"),
    10: ("와이드 · 조립동 · 정면", ["작업자"], [(0.0, "오른쪽 작업자가 팔을 뻗어 터빈을 가리킨다"), (0.6, "가리킨 팔을 1.1초까지 내린다")]),
    11: ("미디엄 · 터빈 밑 · 안전모 뒤", ["작업자"], [(0.0, "안전모 쓴 작업자가 라쳇을 당기며 고개를 끄덕인다"), (0.5, "팔이 화면 안으로 들어와 라쳇을 다시 당긴다")]),
    12: ("미디엄 · 작업대 앞 · 뒤옆", ["작업자"], [(0.0, "작업대 앞 작업자가 몸을 비틀며 줄질한다"), (0.5, "다시 줄을 밀며 어깨가 앞으로 나간다"), (1.6, "줄질하는 자리에서 불티가 튄다")]),
    13: ("미디엄 · 덮개를 받친 작업자 · 뒤", ["작업자"], [(0.0, "두 팔로 받친 덮개를 고쳐 잡는다"), (0.2, "덮개를 다시 밀어 올리며 몸을 싣는다"), (0.5, "뒤쪽 작업자가 걸어 지나간다")]),
    14: ("미디엄 · 날개 이음새 · 어깨 너머", ["작업자"], [(0.0, "두 손이 날개 이음새를 누른다"), (0.6, "손을 이음새를 따라 옮겨 다시 누르고 두드린다")]),
    15: ("접사 · 검은 날개 사이", ["작업자"], [(0.0, "장갑 낀 팔이 날개 사이로 들어온다"), (0.5, "팔이 날개 안쪽으로 더 깊이 뻗는다")]),
    16: ("미디엄 · 옆얼굴 · 덮개 쓴 터빈 앞면", ["준호"], [(0.0, "준호가 덮개 쓴 터빈 앞면을 옆에서 들여다본다"), (0.6, "눈이 덮개 볼트를 따라 천천히 옮겨 간다")]),
    17: ("와이드 · 조립동 · 비껴 세운 터빈", ["작업자"], [(0.0, "왼쪽 두 사람이 덮개 볼트를 가리킨다"), (0.6, "한 사람이 볼트에 손을 대고 오른쪽 사람이 자리를 옮긴다")]),
    18: ("미디엄 · 아래에서 · 올려다보는 얼굴", ["준호"], [(0.0, "준호가 크레인 쪽을 올려다본다"), (0.5, "고개를 든 채 시선이 크레인을 따라간다")]),
    19: ("접사 → 와이드 · 흙받이 아기 표지에서 물러남", [], "카메라가 올라가며 물러나 트레일러 위 터빈 전체를 보인다(5.25초에 멈춤)"),
    20: ("접사 · 운전석 · 손", ["작업자"], [(0.0, "기어를 쥔 손이 레버를 놓는다"), (0.7, "손을 운전대로 옮겨 잡는다")]),
    21: ("접사 · 사이드미러", [], "거울 속에 실려 가는 터빈이 보이고 거울 밖 바닥이 카메라 쪽으로 다가온다"),
    22: ("와이드 · 한낮 시험대", [], "카메라가 시험대 틀로 아주 살짝 다가간다"),
    23: ("와이드 · 시험동 입구", ["작업자"], [(0.25, "작은 작업자가 안전모 챙에 손을 올린다"), (0.9, "터빈을 올려다보며 무게를 옮긴다")]),
    24: ("와이드 · 시험동 통로 · 뒷모습", ["작업자"], [(0.2, "터빈을 올려다보는 작업자가 숨을 들이쉰다"), (1.0, "고개를 더 젖히고 한 걸음 나선다")]),
    25: ("클로즈업 · 3/4 · 호박빛", ["준호"], [(0.0, "준호가 어둠 속에서 앞을 본다"), (0.8, "숨을 고르며 눈매가 조금 굳는다")]),
    26: ("미디엄 · 관제실 레버 · 어깨 너머", ["준호"], [(0.0, "손이 레버를 앞으로 민다"), (0.5, "레버를 끝까지 밀어 넣는다")]),
    27: ("클로즈업 · 눈 · 초점 이동", ["준호"], [(0.0, "준호가 앞을 응시한다"), (1.0, "초점이 뒤 동료의 어깨로 옮겨 간다")]),
    28: ("와이드 · 낮은 각도 · 시험동 터빈 옆", [], "0.5초에 벽 경광등이 켜지고 0.75초부터 연소기 관측창이 차례로 주황빛을 낸다"),
    29: ("접사 · 손바닥 · 옆", ["준호"], [(0.0, "준호의 손바닥이 흰 케이스에 닿아 있다"), (0.5, "손이 쓰다듬듯 살짝 옮겨 가 누른다")]),
    30: ("와이드 · 조립동 · 터빈 옆면과 작은 준호", ["준호"], [(0.0, "준호가 케이스에 손을 댄 채 터빈을 본다"), (0.7, "손을 내리고 올려다본다")]),
    31: ("미디엄 · 아래에서 · 올려다보는 얼굴", ["준호"], [(0.0, "준호가 위를 올려다본다"), (0.3, "시선을 천천히 내린다")]),
    32: ("미디엄 · 아래에서 · 올려다보는 얼굴", ["준호"], [(0.0, "시선을 마저 내린다"), (0.2, "내린 시선으로 앞을 본다")]),
    33: ("와이드 · 노을 발전소 터빈동 · 뒤옆", [], "노을빛이 터빈 몸통을 훑고 카메라가 2.5% 물러난다"),
    34: ("미디엄 · 걸어 나오는 세 사람 · 앞", ["준호", "작업자"], [(0.0, "세 사람이 걸어 나온다"), (0.6, "앞사람 뒤통수가 빠지며 준호의 얼굴이 드러난다")]),
    35: ("와이드 · 세 사람 뒷모습 너머 발전소", ["준호", "작업자"], [(0.0, "세 사람이 노을 쪽 발전소를 바라본다"), (0.5, "왼쪽 동료가 고개를 옆으로 돌린다")]),
    36: ("미디엄 클로즈업 · 3/4 · 노을빛", ["준호"], [(0.0, "준호가 멀리를 바라본다"), (0.4, "입가에 옅은 웃음이 핀다")]),
    37: ("와이드 · 송전탑 꼭대기 → 도시", [], "송전탑이 카메라 옆을 스쳐 멀어지고 도시의 불이 한 구역씩 켜진다 · 57.9초부터 DODAM 로고"),
}
# 글 콘티 표의 화면 줄 가운데 실제 그림과 다른 곳(카본 판 심사 11-17 ④ — 프레임으로 확인함)은 실제 그림대로 바로잡는다
LINE_FIX = {
    # 11-17 마감 관문 F5 · F13 · F22 · F30 · F42(컷표 글만 — 화면의 흠 아님)
    1: "준호 얼굴 접사(이마에서 코까지, 3/4) — 눈두덩과 코 밑에 도면의 푸른빛, 뒤는 흐린 작업장",
    7: "장갑 낀 손이 배관 사이에서 렌치를 돌림 — 카메라는 거의 고정, 끝 0.8초에 모자 쓴 작업자의 흐린 뒤통수가 오른쪽에서 들어와 화면 오른쪽 절반을 가림",
    16: "회색 운송 덮개를 쓴 터빈 앞면 옆에 선 준호 옆얼굴 — 덮개를 들여다봄(30 · 31과 같은 사람의 첫 등장)",
    17: "흰 조립동 — 회색 원판 덮개로 막은 터빈을 비껴 세운 와이드, 아래 작은 사람 셋",
    20: "기어를 쥔 손 → 레버를 놓고 운전대를 잡은 두 손에서 끝남(얼굴 없음)",
    26: "관제실 — 오른쪽 화면에 시험동 카메라로 본 터빈, 남색 소매의 맨손(준호)이 레버를 앞으로 밂",
    28: "시험동 터빈 옆모습 낮은 각도 — 0.5초에 벽 경광등, 0.75초부터 연소기 관측창이 차례로 주황빛(시동)",
    31: "준호가 아래에서 올려다봄(노란 크레인 · 흰 조명) → 시선을 천천히 내림, 밝기는 그대로",
    32: "31이 그대로 이어지는 한 방 — 내린 시선으로 앞을 봄(원본의 실루엣 장은 뺐다)",
    33: "해 질 녘 발전소 터빈동 — 큰 문 안에 놓인 우리 터빈을 비스듬히 옆에서, 문 너머 노을 · 젖은 바닥에 비침",
    34: "바깥 해 질 녘 — 앞 작업자 뒤통수 너머 오른쪽에 준호, 뒤에 한 명(안전모 없음) · 초점이 준호 얼굴로",
    35: "세 사람 뒷모습(가운데 준호, 오른쪽 사람은 어깨만) 너머 발전소 굴뚝 · 송전탑 · 노을",
    37: "노을 구름 아래 송전탑 꼭대기가 왼쪽 앞에 남은 채 카메라가 물러나고, 멀리 도시의 불이 한 구역씩 켜짐 · 57.9초부터 DODAM 로고, 61초부터 하늘이 가라앉고 그 하늘에 SYNK PULSE 서명",
}
# 글 콘티의 카메라 줄 가운데 실제 그림과 다른 곳 — 11-18 마감 관문 다시(C37) P3: 「58.3부터 거의 멈춤」이 아니라 60초쯤까지 송전탑 · 애자가 커지며 왼쪽 위로 빠진다
CAM_FIX = {
    37: "큰 것(송전탑 · 애자)이 카메라 옆을 스쳐 커지며 왼쪽 위로 빠짐(56.56 시작, 56.8~57.6이 가장 빠름, 60초쯤까지 천천히 이어짐) → 판 뒤로는 끝 화면이 끝날 때까지 배경이 4% 아주 천천히 다가감",
}
SCENE = {}
for cuts, name in (((1, 2), "설계실"), ((3, 4, 5, 6, 7, 12), "공장밤"), ((8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 29, 30, 31, 32), "조립동"),
                   ((19, 20, 21), "마당"), ((22, 23), "시험대"), ((24, 28), "시험동"), ((25, 26, 27), "관제실"),
                   ((33, 34, 35, 36), "노을발전소"), ((37,), "송전탑")):
    for c in cuts:
        SCENE[c] = name
SCENES = {
    "설계실": {"장소": "A dark design desk with a blue-lit turbine cross-section blueprint.", "빛": "Night. Cool blue glow from the blueprint below.", "시간대": "밤", "실내": True,
            "빛이름": ["Low key", "Screen glow"]},
    "공장밤": {"장소": "A dark heavy-industry workshop with welding, grinding sparks and pipework.", "빛": "Night. Hard amber welding light from one side in darkness.", "시간대": "밤", "실내": True,
            "빛이름": ["Low key", "Hard light"]},
    "조립동": {"장소": "A huge white turbine assembly hall with yellow overhead cranes.", "빛": "Day. Soft white overhead light with warm accents.", "시간대": "낮", "실내": True,
            "빛이름": ["High key", "Soft light"]},
    "마당": {"장소": "The factory yard; a heavy trailer carrying the covered turbine, and the truck cab.", "빛": "Overcast daylight from above, soft and even.", "시간대": "낮", "실내": False,
           "빛이름": ["Soft light"]},
    "시험대": {"장소": "An outdoor test stand frame and a large concrete test building entrance with wooded hills behind.", "빛": "Midday daylight from above and the right of the frame.", "시간대": "낮", "실내": False,
            "빛이름": ["Soft light"]},
    "시험동": {"장소": "A dark test cell lined with square acoustic panels, the turbine at the end of the corridor.", "빛": "Dim light; warm practical lamps on the side walls and the turbine lit from above.", "시간대": "밤",
            "실내": True, "빛이름": ["Low key", "Practical light"]},
    "관제실": {"장소": "A control room with screens showing the test cell and a throttle lever.", "빛": "Dark room, amber control-panel light on the face from the right of the frame.",
            "시간대": "밤", "실내": True, "빛이름": ["Low key", "Screen glow"]},
    "노을발전소": {"장소": "A power plant turbine hall and yard at sunset, chimneys and pylons beyond.", "빛": "Sunset. Low warm sun from behind and to the left of the frame.",
              "시간대": "노을", "실내": False, "빛이름": ["Golden hour", "Rim light"]},
    "송전탑": {"장소": "The top of a transmission tower passing the camera, a city below lighting up district by district.", "빛": "Dusk after sunset, orange clouds.",
            "시간대": "노을", "실내": False, "빛이름": ["Golden hour"]},
}
REF_AT = {"설계실": 2, "공장밤": 6, "조립동": 17, "마당": 20, "시험대": 22, "시험동": 24, "관제실": 26, "노을발전소": 33, "송전탑": 37}
for k in SCENES:
    SCENES[k]["기준그림"] = f"ref/장면_{k}.jpg"

detail, prev_time = [], None
for n in range(1, 38):
    t0, t1 = E.TF[n - 1], E.TF[n]
    r = rows.get(n, {"화면": "", "카메라": ""})
    comp, people, act = CUT[n]
    sc = SCENE[n]
    d = {"cut": f"C{n}", "t": round(t0, 3), "dur": round(t1 - t0, 3), "in": round(E.CUTS[n][1] / E.FPS, 3), "out": round(E.CUTS[n][1] / E.FPS + (t1 - t0), 3),
         "band": "기" if n <= 7 else "승" if n <= 18 else "전" if n <= 30 else "결",
         "판": E.CUTS[n][0], "line": LINE_FIX.get(n, r["화면"]), "장면": sc, "인물": people, "구도": comp, "카메라": CAM_FIX.get(n, r["카메라"]), "소리": ""}
    if n == 20 or SCENES[sc]["실내"]:
        d["실내"] = True            # 20번은 마당 장면 속 운전석
    else:
        d["실외"] = True
    if people:
        d["연기"] = [{"t": t, "무엇": w} for t, w in act]
    else:
        d["움직임"] = act
    if prev_time and SCENES[sc]["시간대"] != prev_time:
        d["시간건너뜀"] = True      # 공장 밤 · 조립동 낮 · 노을을 오가는 몽타주 — 한국어 판 그대로
    prev_time = SCENES[sc]["시간대"]
    if n == 32:
        d["같은판"] = "31이 그대로 이어지는 한 방(원본의 0.29초 실루엣을 뺀 자리 — 02_콘티 19절)"
        d["이어찍기"] = True
    detail.append(d)

seq = [[d["cut"], f'{d["t"]:.2f}', d["band"], d["line"][:40]] for d in detail]
end = round(E.TF[-1] + V.CARD / E.FPS, 3)
subs = json.load(open(os.path.join(E.ROOT, "최종", "p10_en", "timing_아이작.json"), encoding="utf-8"))["lines"]
cue = {
    "틀": 2,
    "읽는법": "마감 관문용으로 지은 컷표다. 화면은 한국어 판(유호님 「이대로 확정」) 그대로이고, 이 판에서 바뀐 것은 영어 내레이션 · 영어 자막 · 영문으로 그린 끝 로고(37) · SYNK PULSE 끝 화면(61.0~64.5초)이다.",
    "편": {"이름": "도담중공업 영어 판 — We send our baby out into the world", "비율": "16:9", "길이": end},
    "이기는것": "여운 — 3년을 손으로 키운 300톤 터빈을 사람들이 「아이」처럼 세상에 내보낸다",
    "한문장": "3년을 매일 들여다본 터빈을 오늘 처음 깨워 세상에 보낸다",
    "가까운사례": "S49 — 도담중공업 한국어 판(이 편의 원판, 같은 화면 · 같은 방법의 내레이션)",
    "엔진": {"그림": "GPT 이미지(한국어 판 그대로 — 다시 굽지 않음)", "영상": "Seedance 2.5(한국어 판 그대로 — 다시 굽지 않음)",
           "메모": "한국어 판 기록(02_콘티 · 결정 표 2026-11-07 「그림 엔진 · 원래 방식 유지」): 얼굴 없는 28컷은 GPT 이미지, 준호 얼굴 9컷(1 · 16 · 18 · 25 · 27 · 30 · 31 · 34 · 36)은 Gemini. 유호님이 그 나눔으로 마치기로 하신 편이다"},
    "장면": SCENES,
    "인물": {
        "준호": {"묘사": "Junho, a Korean engineer in his late 30s, short black hair, calm face, no glasses.", "옷": "A navy work jacket over a grey T-shirt.",
               "설정": "터빈을 3년 들여다본 엔지니어 — 마지막에 옅게 웃는다", "기준그림": "ref/인물_준호.jpg"},
        "작업자": {"묘사": "Factory workers seen as hands, backs and silhouettes, faces hidden by masks or framing.", "옷": "Grey work suits and gloves; white hard hats in the assembly and test cuts, bare heads at the plant at sunset.",
                "설정": "단역 — 얼굴 없이 손과 몸으로 일한다", "기준그림": "ref/인물_작업자.jpg"},
    },
    "소품": {"터빈": {"종류": "되풀이 소품", "낱말": ["터빈"], "색": "cream-white casing",
                   "생김새": "A large industrial gas turbine with a cream-white bolted casing; covered with a grey transport cover for the road.", "기준그림": "ref/소품_터빈.jpg"}},
    "글자": [{"글": x["s"], "종류": "말자막", "어디": f"{x['a']:.2f}–{x['b']:.2f}초", "만드는법": "Remotion 명조 50px 한 줄(한국어 판 자막 결에 글자 둘레 가는 그늘 — 밝은 바닥에서 묻히지 않게)"} for x in subs] + [
        {"글": "DODAM", "종류": "끝로고", "어디": "C37 57.9초부터 61.2초(화면 폭 55% 자리 — 왼쪽 송전탑을 비킴)",
         "만드는법": "그린 글자 — 한국어 판 로고와 같은 기하 획(로고_영어.py 시안 C: 획 15 · 가로획 없는 A · 소제목 없음), 시안 A · B · C를 실제 끝 장면 위에서 견줌",
         "시안": ["시안/끝로고_C.jpg", "시안/끝로고_A.jpg", "시안/끝로고_B.jpg"]},
        {"글": "Every person in this film is AI-generated", "종류": "정보", "어디": "61.08~64.75초(마지막 장면 하늘, 로고 아래)",
         "만드는법": "Inter Tight 600 56px 한 줄, 크림 #F2ECE2(폰 가로 360px에서 약 10px) — 로고 · 주소와 한 줄기로 0.4초 동안 12px 올라온다. 「가상 브랜드」 고지는 게시 글에 둔다"},
        {"글": "SYNK PULSE", "종류": "끝로고", "어디": "61.08~64.75초(61.48초에 앉음)",
         "만드는법": "평면 판 로고(11-18 유호님 「평면으로 바꿔」, 로고 정본의 예외) — 브랜드킷 배치용 SYNK-PULSE-Paper.png의 외곽선 그대로 synk 크림 · PULSE 베리 한 색으로 채워 투명 여백만 잘라 비례 그대로 700px, 마지막 장면의 가라앉힌 하늘 가운데 위(서명 뒤 무채색 타원), 로고 → 고지 → 주소 한 줄기. 앞 판(검정 · 장면 45% · 노을 위 · 하늘 좌우 두 단)은 카본 맹검 4 · 3 · 4 · 4점 기각, 이 판은 GPT 맹검 7점(쌍 비교에서 좌우 두 단 판을 이김)",
         "시안": ["시안/끝화면.jpg", "시안/끝화면_맹검/장면안_가운데줄기.jpg", "시안/끝화면_맹검/장면안_하늘묶음.jpg", "시안/끝화면_맹검/단색판_실제렌더.jpg", "시안/끝화면_맹검/가운데묶음_종이.jpg", "시안/끝화면_노을위판.jpg", "시안/끝화면_장면45판.jpg", "시안/끝화면_검정판.jpg", "시안/끝화면_첫판.jpg"]},
        {"글": "synk.im/en/pulse", "종류": "정보", "어디": "61.08~64.75초", "만드는법": "주소 한 줄 — Inter Tight 500 44px(폰에서 약 8px), 크림 90%, 고지 줄 아래 26px"},
    ],
    "소리": {"목소리": "내레이션 — 아이작(한국어 판과 같은 목소리)의 영어 판, 원고 전체를 한 번에 굽고 문장 사이 무음에서 자름", "첫말초": 1.70,
           "초반을끄는것": "1.7초 「When it's fully grown, it'll weigh three hundred tons」", "음악": "연주곡 한 곡(572b8b0b) 0초부터 이음 없이",
           "열쇠소리": "용접 · 라쳇 · 에어브레이크 · 시험동 웅 · 57.97초 마지막 화음"},
    "끝": {"컷": "C37", "가장센그림": "송전탑이 스쳐 지나고 노을 아래 도시의 불이 켜지는 위로 DODAM 로고", "제품보임": False, "브랜드보임": True, "로고멈춤초": 2.8, "끝화면": "SYNK PULSE 서명은 61.48초에 앉아 64.75초까지 3.27초",
          "소리한방": "57.97초 곡의 마지막 화음 +4 dB — 로고가 다 켜지는 순간"},
    "seq": seq,
    "end": end,
    "detail": detail,
    "소리사건": [],
    "사건": [],
}


def grab(t, path, w=960):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", os.path.join(E.OUT, "화면.mp4"), "-frames:v", "1", "-vf", f"crop=1920:960:0:60,scale={w}:-2",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    Image.open(io.BytesIO(raw)).convert("RGB").save(path, quality=82)


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "ref"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "시안"), exist_ok=True)
    mid = lambda n: (E.TF[n - 1] + E.TF[n]) / 2   # noqa: E731
    for k, n in REF_AT.items():
        grab(mid(n), os.path.join(HERE, "ref", f"장면_{k}.jpg"))
    grab(mid(36), os.path.join(HERE, "ref", "인물_준호.jpg"))
    grab(mid(13), os.path.join(HERE, "ref", "인물_작업자.jpg"))
    grab(mid(30), os.path.join(HERE, "ref", "소품_터빈.jpg"))
    for x in ("A", "B", "C"):
        Image.open(os.path.join(E.ROOT, "최종", "p10_en", "로고", f"끝장면_{x}.png")).convert("RGB").resize((960, 540), Image.LANCZOS).save(
            os.path.join(HERE, "시안", f"끝로고_{x}.jpg"), quality=85)
    # 끝 화면 시안 — 지금 판(가라앉힌 하늘 가운데 묶음 · 로고 600 · 고지 40 · 주소 30px)만 여기서 다시 뽑는다.
    #   지난 판 넷(노을 위 판 · 장면 45%로 내린 판 · 검정 판 · 첫 판)과 맹검 시안(시안/끝화면_맹검/)은 시안/에 남은 그림이 정본이다(그 판 영상은 지웠거나 덮였다).
    #   인자로 첫 판 · 검정 판 영상을 주면 그 둘도 다시 뽑는다.
    for name, fin in (("끝화면.jpg", os.path.join(E.ROOT, "최종", "p10_en", "도담_영어_C_아이작.mp4")),
                      ("끝화면_첫판.jpg", sys.argv[1] if len(sys.argv) > 1 else ""),
                      ("끝화면_검정판.jpg", sys.argv[2] if len(sys.argv) > 2 else "")):
        if fin and os.path.exists(fin):
            raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", "63.6", "-i", fin, "-frames:v", "1", "-vf", "scale=960:-2", "-f", "image2pipe", "-vcodec", "png", "-"],
                                 capture_output=True, check=True).stdout
            Image.open(io.BytesIO(raw)).convert("RGB").save(os.path.join(HERE, "시안", name), quality=85)
    json.dump(cue, open(os.path.join(HERE, "컷표.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(os.path.join(HERE, "컷표.json"), len(detail), "컷", end, "초")
