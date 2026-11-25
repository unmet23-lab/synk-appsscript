# 컷 연속성 검사 — 콘티 · 지시문 · 편집 단계에서 「사람이 기억하지 않아도 걸리게」(2026-11-09, 고립·은둔 공모 「문 앞」 지적 9건에서).
#
# 왜 있나: 11-08 「문 앞」 마감 직전에 유호님이 아홉 가지를 짚으셨다 — 실내인데 눈이 떨어짐 · 노크에 쪽지가 떨림 · 문이 혼자 닫힘 · 열린 문의 쪽지가
#   지도와 다름 · 화면 밖 글자 「1월」 · 접사마다 이웃 쪽지가 제각각 · 쪽지 붙인 손 뒤에 봉투가 갑자기 생김 · 노크 소리 전에 놀란 얼굴 · 두드리려다 참는 손
#   클로즈 누락. 모두 사람이 기억해야 잡히던 것이라, 표(컷순서.json) → 기계 검사 → 눈으로 볼 시트로 옮겼다. 정본 규칙은
#   docs/마케팅/제작양식/광고영상_슬롭점검표.md 33 · 35~42, 적용 기록은 docs/마케팅/제작양식/문앞_지적9건_관문_20261108.md.
#
#   python -I -X utf8 tools/컷연속성검사.py <컷순서.json> [--영상 <최종.mp4>] [--받음 <판 폴더> [--앞 <파일 앞머리, 예: siryc->]]
#                                           [--그림 <정지 그림 폴더>] [--지시문 <꾸러미 폴더 | 지시문.txt …>] [--그림지시문 <폴더 | <컷>.txt …>] [--지도 <소품 지도.json>]
#                                           [--항목 틀,소품,사건,소리,지시문,그림지시문,점,고요,지도,빛,색감,얼굴] [--출력 <폴더>] [--json] [--간격 0.6,1.0] [--지시문검수]
#   python -I -X utf8 tools/컷연속성검사.py 지시문 <꾸러미 폴더 | 지시문.txt …> [--실내 <컷,…>] [--json]
#
#   표만 주면(영상 · 그림 없이) 콘티 단계 검사 — 소품 상태 표 · 사건 네 박 표 · 소리 사건 ↔ 반응 간격 · 표의 물건 반응 메모 · (틀 2) 장면 · 인물 · 연기 · 구도 · 끝 · 글자 칸.
#   --지시문: 굽기 전 — 물건이 소리 · 바람에 반응 · 큰 물건의 자율 움직임 · 실내 컷의 눈 · 먼지 낱말(시댄스 꾸러미 폴더나 지시문 글 파일)
#             + 사람 연기(항목 「연기」 — 사람을 멈추는 말 · ACTION에 시간 박자 없음 · 사람이 나오는데 ACTION 칸 없음은 걸림, 「start from it unchanged」는 주의 · 점검표 26).
#               정지 말은 어느 칸에서든 본다(연기 글에서는 주어가 아는 물건일 때만 지나가고, CAMERA · LOOK · PHYSICS 같은 칸에서는 사람 주어가 드러난 것만 건다).
#               사람이 나오는 판인지(ACTION 칸 · 박자를 요구할지)는 컷표 그 컷의 「인물」이 먼저 정하고 글의 증거가 더한다 — []인데 글에 사람이 나오면 걸림.
#               틀 2면 판마다 그 컷 장면의 빛 문장이 글자 그대로 들었는지도 본다(51). 판을 컷에 잇는 법: 판 id = 컷 이름 · <편>-<컷> · 컷의 「판」 · 판 폴더 이름 · _순서.json 판의 "컷": ["C2"](대안 판).
#               소리만 쓰는 판(_순서.json "방식": "목소리 판" · "소리만": true)과 프리비즈 판(id pv…)은 사람 연기 · 컷표 대조를 건너뛴다. 내기 도구의 굽기전()과 같은 판정 · 같은 등급이고, 걸림은 판 id로 적는다.
#   --지시문검수: --지시문과 함께 — 지시문 검수 결과(<편>/검수/지시문검수_*/결과.json)가 판마다 지금 글을 「그대로」로 봤는지도 본다(웹에서 손으로 내는 판의 관문 · 11-25).
#   --그림지시문: 이미지 콘티 지시문(<폴더>/<컷>.txt) — 틀 2일 때 그 컷 장면의 장소 · 빛, 고른 색감의 뼈대(GRADE 줄), 인물의 묘사 · 옷 문장이 글자 그대로 들었는지(G11 · 51).
#               맨 위 「소품」 표의 줄은 그 소품이 나오는 컷에 생김새 문장이 글자 그대로 들었는지(걸림), 그 낱말에 표에 없는 색이 붙었는지(확인 — 「vermilion bus」),
#               표에 줄이 없는 탈것 낱말(bus · tram · taxi …)의 색이 컷마다 다른지(확인)도 본다(51 — 11-12 서울로 애니).
#   굽기전검사(글, 실내, 인물, 소리만, 박자최소)는 내기 도구(크레딧내기.py · 드리미나내기.py)가 내기 전에 부른다 — 걸림이면 내지 않는다.
#   --그림: 이미지 콘티 단계 — 상태가 적힌 컷의 정지 그림(<폴더>/<컷>.png|jpg)을 소품 지도와 대조하고, 실내 컷의 떠다니는 점 후보 시트를 만든다.
#   --받음 · --영상: 편집 단계 — 받은 판(쓰는 구간)이나 최종 판(그 컷의 자리)에서 소품 자리 · 소품 고요 · 큰 물건 고요 · 소리 사건 · 점을 잰다.
#   (틀 2) --그림 · --받음 · --영상에서는 사람 컷마다 얼굴 빛(좌우 · 위아래 · 색 · 역광)도 재어 그 장면의 빛 이름과 견준다(항목 「빛」 · 60) —
#          옆빛 이름이고 빛 문장에 왼쪽 · 오른쪽이 적혔는데 좌우빛이 문턱(빛이름.json 0.2) 아래면 「확인」, 그 밖의 값은 알림으로만 적는다.
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
# 컷표 「틀 2」(맨 위 "틀": 2 — 예시 docs/마케팅/제작양식/영상양식/컷표_틀.json, 틀이 없거나 1이면 아래 검사는 돌지 않고 알림 한 줄만 남는다):
#   맨 위: "색감": 색감이름.json의 이름 하나(편 날짜 2026-11-19부터 비면 걸림 — 이미지 지시문 GRADE 줄 · 영상 지시문 LOOK 줄에 그 문장 그대로, T22)
#          "최상급": [{"제목", "브랜드", "해", "주소"|"파일", "까닭"}] 같은 분야 실제 최상급 광고 둘 이상(주의만 — tools/최상급대조.py, T23)
#          "감정흐름": {"기"|"승"|"전"|"결": {"감정", "갈래": 희|노|애|락|긴장, "세기": 1~5}, "한결"?: 까닭} — 갈래 · 세기가 넷 다 같으면 걸림(편 날짜 2026-11-19부터 비면 걸림, T24)
#   (틀 2) --그림 · --받음 · --영상에서는 컷마다 화면 전체의 색감 값도 재어 적고(항목 「색감」), 같은 장면에서 튀는 컷 · 받은 영상이 시작 그림 색감에서 벗어난 컷을 「확인」으로 낸다.
#   맨 위: "이기는것" · "한문장" · "가까운사례" · "엔진": {"그림", "영상"}(하나씩) · "장면": {이름: {"장소", "빛", "빛이름": [빛이름.json의 이름 한둘], "시간대", "실내", "기준그림"}} · "인물": {이름: {"묘사", "옷", "기준그림"}}
#          "글자": [{"글", "종류": 말자막|강조|이름|끝로고|장면속|정보 또는 글자 · CG 사전(영상양식/글자CG.json)의 이름, "어디", "만드는법"}](없는 편은 []) · "소리": {"목소리", "첫말초", "초반을끄는것", …}
#          글자 줄의 "시안": [그림 경로…](편 폴더 기준 · 절대 경로) — 강조 · 이름 · 끝로고 · 장면속은 실제 장면 위 시안 파일이 둘 이상(편 날짜 2026-11-17부터, 표만 보면 주의 · --영상이면 걸림,
#          못 만드는 까닭이 있으면 "시안없음": 까닭 → 주의). 편 날짜는 편 폴더 이름 끝 _YYYYMMDD, 없으면(.tmp 공모 폴더) "편": {"만든날": "YYYY-MM-DD"}
#          "끝": {"컷"(마지막 컷), "가장센그림", "제품보임"|"브랜드보임", "로고멈춤초"(2 이상 · 로고 없는 편은 null + "로고없음": 까닭), "소리한방"} · "seq"의 띠에 기 · 승 · 전 · 결
#   detail[] 항목: "장면" · "인물": [이름…](사람 없는 컷은 []) · "구도" · "카메라" · "연기": [{"t": 초, "무엇"}](사람 컷은 둘 이상) · "움직임"(사람 없는 컷) · "넘어옴" · "소리" · "타당성"(두 사람 이상인 컷 — T27)
#                  "앵글": {"크기": 극접|클로즈|가슴 위|허리 위|무릎 위|전신|넓게, "높이": 로우|눈높이|하이|위에서, "방향": 정면|비스듬히|옆|뒤|어깨 너머|시점|물건 너머, "까닭"} —
#                  "렌즈": mm(맨 위 "렌즈": [mm…] 편의 렌즈 묶음 가운데 하나 — 편 날짜 2026-11-25부터 비면 걸림 · 이미지 지시문 FRAME 줄이 그 mm를 쓴다 · 렌즈 계획) ·
#                  "기법": 카메라 기법 사전(영상양식/카메라기법.json)의 이름 하나 · 목록(사전 밖은 편 날짜 2026-11-25부터 걸림 · 지시문에 사전의 낱말 · 큰 움직임은 잇달아 두지 않는다) ·
#                  이웃 컷과 세 칸이 모두 같으면 걸림(T29 · 편 날짜 2026-11-20부터, 앞선 편은 주의). 사람 컷의 3분의 1 넘게가 허리 위 · 눈높이 · 정면이면 주의(33). 낱말 뒤에 풀이를 붙여도 된다(「시점 — 아이의 눈」)
#                  "감정자리": "누가 — 무엇을 느끼나" — 감정이 보여야 하는 컷(사건 표의 「감정」 컷은 적지 않아도 감정 자리다). 얼굴이 아니라 손 · 숨으로 보이는 자리는 "감정부위": "손"(얼굴 · 눈 · 입은 얼굴 폭을 재고 손 · 숨 · 몸 · 어깨 · 발 · 등은 재지 않는다 — 풀이는 낱말 뒤에 「손 — 입가를 가린다」).
#                  감정 자리의 시작 그림은 얼굴 폭 ÷ 그림 폭이 가로 그림 25% · 세로 그림 35%에 닿아야 한다(T28 · 항목 「얼굴」 — 컷의 시작그림 파일을 잰다(관문 판 도구와 같은 풀이 — 첫 장 · ~ · 편 폴더 기준). 칸이 비었을 때만 --그림 폴더의 <컷>.png를 잰다. --영상 · --받음과 함께는 --항목에 얼굴을 밝혔을 때만 잰다)
#                  "이어찍기": true — 앞 컷과 장면 · 인물 · 구도가 같아도 되는 컷 · "시간건너뜀": true — 앞 컷과 시간대가 달라도 되는 컷
#                  "시작그림": "정지/C1.png" — 그 컷의 영상을 뽑을 시작 그림(편 폴더 기준). 서로 다른 두 컷이 같은 시작 그림 · 같은 「판」을 쓰면 걸림(50) —
#                  "같은판": "<까닭>" — 한 판을 일부러 이어 쓰는 컷(한 방을 둘로 자른 컷 · 한 판에 두 샷)
#                  "시늉까닭": "<말 · 소품 없이도 뜻이 읽히는 까닭>" — 연기 박자가 시늉 · 흉내 · 손짓에 뜻을 맡겼는데 같은 컷에 대사 · 화면 소품이 없는 걸림(T30 · 29)을 주의로 낮춘다
#                  "둘레": [{"t": 초, "누가": "<무리 이름>", "무엇": "<몸짓>"}, …] — 둘레에 무리가 있는 컷(무리 낱말이 있으면 비울 수 없다 · 둘 이상 · 누가 둘 이상 · 첫 t 1.0초 안),
#                  무리 낱말이 걸렸지만 무리가 없으면 "없음: <까닭>" · "끝그림까닭": "<까닭>" — 무리 컷이 끝 그림을 쓰는 까닭(T31 · 26)
#   맨 위 "소품": {이름: {"종류": 탈것|소품, "낱말": ["bus"](지시문에서 부르는 영어 이름씨), "색", "생김새"(이미지 지시문에 글자 그대로 들어가는 영어 문장), "기준그림"}} —
#          컷의 「소품」 칸에서 두 컷(탈것) · 세 컷(그 밖의 소품) 넘게 나오는 것은 이 줄이 있어야 한다(51). 이어 볼 소품이 없는 편은 전처럼 "소품": []
# 소품 지도.json: {"src", "size": [w, h], "notes": [{"id", "color", "box": [x0, y0, x1, y1], "cx", "cy"}], "상태": {"이름": ["Y1", …]},
#                  "영역": [0.40, 0.20, 0.84, 0.60](선택 — 소품이 붙는 면, 비율), "따뜻한색": "노랑"(선택 — 두 색일 때 R−B가 큰 쪽)}
#   .tmp/contests-20261019/siryc/쪽지지도.py가 만든 꼴 그대로다(색은 둘까지 — 밤 · 햇빛 컷은 검출이 흔들려 「확인」으로 남기고 시트를 본다).
#
# 끝 코드: 0 걸림 · 확인 없음 / 1 걸림 있음 / 2 걸림은 없고 눈으로 볼 것(확인)이 있음 — 통과로 치지 않는다. 결과는 <출력>/결과.json과 시트 그림.
# 흠 장부(11-15 설계 2단계): docs/마케팅 아래 편의 컷표를 글 출력으로 돌리면 맨 끝에 「[흠 장부] …」 — 그 길에서 검사가 아직 못 잡는 흠 셋 이하
#   (tools/흠장부.js 시작)를 알림으로 붙인다. 항목 목록 · 결과.json · --json · 끝 코드에는 들어가지 않는다. 끄기 SYNK_FLAW_LEDGER=off.
# 한계(11-08 실측): 공중의 점은 픽셀만으로 장면 사이를 가르지 못한다(알갱이 · 벽 질감이 장면마다 달라 옛 A5 419 · 고친 A5 50인데 다른 컷도 200~440) —
#   그래서 점은 수와 확대 시트(「확인」)로 내고 판정은 눈 · 아르곤 맹검(점검표 37)이 한다. 같은 컷의 전 · 후 비교에는 수가 그대로 쓸모 있다.
# 시험: node --test tests/컷연속성검사.test.js
import json, os, re, subprocess, sys
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
# 11-13 B43 V9 「휴대폰이 자기 혼자 들썩이는거」: 진동은 영상 모델이 폰째 튀는 동작으로 그린다 — 폰 진동 · 울림은 소리 줄과 사람 반응으로만(점검표 38 · 원칙 4)
폰낱말 = r"(?:휴대폰|핸드폰|스마트폰|(?<!헤드)(?<!이어)폰)"   # 헤드폰 · 이어폰은 아니다
폰진동_한 = re.compile(폰낱말 + r"[은는이가의도]?[^.;,()]{0,20}?(부르르|진동(?:하|이 ?울|이 ?오)|떨(?!어)|들썩|덜덜|드르르)")
# 영어: 「the phone vibrates · buzzes · hops on the table」
폰진동 = re.compile(r"\b(?:phones?|smartphones?|cell ?phones?|mobiles?)\b[^.;,()—–]{0,40}?\b(?:vibrat\w*|buzz(?:es|ing)?|judders?|juddering|jitters?|jittering|trembles?|trembling|shakes?|shaking|rattles?|rattling|hops?|hopping|jumps?|jumping)\b", re.I)
소리줄_한 = re.compile(r"^\s*(?:소리|효과음|목소리)\s*[:：]")   # 한국어 소리 줄(「소리: 폰 진동 두 번」)은 화면 동작이 아니다
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
창밖 = re.compile(r"\b(?:outside|out the window|through the (?:window|glass|pane)|beyond the (?:glass|window)|past the window|outdoors|out there|on the street|in the street|across the street|roof(?:top)?s?|sky|off (?:her|his|their|the) (?:coat|shoulders?|hair|sleeves?|hat|scarf|bag))\b|창밖|밖에|바깥|하늘|털어", re.I)
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
                      r"|\b(?:air|stairwell|room|hallway)\b[^.;]{0,20}\b(?:clear|still|empty|clean)\b|아무것도 (?:떨어지|날리|떠다니)(?:지|거나)|공기(?:는|가)? 맑|눈(?:이|은) (?:없|오지 않|내리지 않)", re.I)
# 한국어 지시문(제미나이 앱 · Flow): 「실내이고 공기는 맑다, 아무것도 떠다니거나 떨어지지 않는다」도 그 한 줄이다(11-16 synkbrief 원생명단 동영상.json 13판 — 「떠다니지」만 받아 13판 모두 헛 주의)


# ───────── 켜진 불(점검표 61) · 닦는 컷(17) — 11-13 서울로 애니에서 둘 다 다시 굽게 만든 자리 ─────────
# 61: 「the blue deck lights twinkle」 한 줄에 Omni가 난간 등 열한 개를 한꺼번에 1초씩 두 번 껐다 켰다(3.9초에 바뀜 73번).
#     「once lit, no lamp ever goes dark, blinks or dims」로 다시 내자 바뀜 1번. 켜진 불은 켜진 채로 두고, 빛의 변화는 컷을 갈아서 만든다.
불빛 = (r"(?:lamps?|lights?|lighting|bulbs?|lanterns?|lamp[- ]?posts?|street ?lamps?|street ?lights?|neon(?: signs?| tubes?)?|LEDs?|"
       r"fairy lights?|deck lights?|railing lights?|window lights?|headlights?|tail ?lights?|candles?)")
깜빡동사 = (r"(?:twinkl(?:e|es|ing)|flicker(?:s|ing)?|blink(?:s|ing)?|wink(?:s|ing)?|puls(?:e|es|ing)|strobe[sd]?|"
          r"flash(?:es|ing)?|glimmer(?:s|ing)?|shimmer(?:s|ing)?|sputter(?:s|ing)?|gutter(?:s|ing)?|wax(?:es)? and wane[sd]?)")
깜빡 = re.compile(rf"\b{불빛}\b[^.;,()—–]{{0,45}}?\b{깜빡동사}\b", re.I)
깜빡_역 = re.compile(rf"\b{깜빡동사}\b[^.;,()—–]{{0,35}}?\b{불빛}\b", re.I)
깜빡_한 = re.compile(r"(등|불빛|가로등|조명|전구|네온|촛불)[은는이가들]?[^.;,()]{0,20}(반짝|깜빡|깜박|명멸|껐다 ?켜|꺼졌다 ?켜)")
깜빡부정 = re.compile(r"\b(?:no|never|nothing|without|none)\b[^.;]{0,40}\b(?:goes? dark|dims?|blinks?|flickers?|twinkles?|turns? off|switch(?:es)? off)\b"
                  r"|\b(?:steady|steadily|constant|constantly|unchanging|evenly|stays? lit|stay lit|remains? lit|hold(?:s)? (?:the )?same brightness)\b"
                  r"|꺼지지 않|반짝이지 않|깜빡이지 않|그대로 켜", re.I)
# 17: 시작 그림에 구운 물방울 · 얼룩은 와이퍼가 지나가도 그대로 남는다 — 닦인 자리가 맑아진다고 써야 모델이 지운다(11-13 유호님 「와이퍼에 물기가 안지워지고 그냥 통과하거든」).
닦기 = re.compile(r"\b(?:wipers?|windscreen wipers?|windshield wipers?|squeegees?|wipes? (?:across|over|away|clean)|rubs? (?:away|clean)|brushes? (?:away|off))\b|와이퍼|닦아|훔쳐", re.I)
닦인결과 = re.compile(r"\b(?:clear|clears?|cleared|clearing|clean|cleans?|cleaned|spotless|streak[- ]free|crystal|transparent|unobstructed)\b"
                  r"|\b(?:leav(?:es|ing)|reveal(?:s|ing)|open(?:s|ing) up)\b[^.;]{0,45}\b(?:band|arc|swath|strip|patch|view|glass|pane)\b"
                  r"|맑아|말끔|깨끗", re.I)


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
    물건글 = "\n".join(l for l in 글.split("\n") if not 소리줄표식.match(l) and not 소리줄_한.match(l))
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
            pm = 폰진동_한.search(c) or 폰진동.search(c)
            if pm and not 신체.search(c[pm.start():pm.end() + 14]):
                out.append(("걸림", "물건", f"휴대폰이 진동으로 떨린다 — 「{c[:90]}」(영상 모델은 폰째 들썩이게 그린다 · 진동은 소리 줄과 손 · 눈의 반응으로만, 화면 줄엔 「폰은 납작하게 붙어 한 번도 들리거나 흔들리지 않는다」 · 점검표 38)")); continue
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
    # 불빛(걸림): 켜진 등 · 불빛이 반짝인다 · 깜빡인다 — 모델이 등을 한꺼번에 껐다 켠다(점검표 61)
    for s in 문장목록:
        for c in 절들(s):
            if 깜빡부정.search(c):
                continue
            if 깜빡.search(c) or 깜빡_역.search(c) or 깜빡_한.search(c):
                out.append(("걸림", "불빛", f"켜진 불이 깜빡인다 — 「{c[:90]}」(켜진 불은 켜진 채로 — 「once lit, no lamp ever goes dark, blinks or dims」 · 점검표 61)"))
    # 닦기(주의): 와이퍼 · 손이 유리를 닦는데 닦인 자리가 맑아진다는 말이 없다 — 시작 그림에 구운 물방울이 그대로 남는다(점검표 17)
    if 닦기.search(글) and not 닦인결과.search(글):
        out.append(("주의", "닦기", "닦는 컷인데 닦인 자리가 맑아진다는 말이 없다 — 「each swing wipes the glass clear, leaving a clean band right behind the blade」처럼 결과를 쓴다(점검표 17)"))
    return out


def 남길것검사(글):
    """컷순서의 「남길 것 · line」처럼 한국어 메모에 물건 반응이 적혀 있으면 주의(「쪽지가 두 번 떨림」 — 옛 설계가 표에 남는다). 따옴표 안(쪽지 글 · 대사)은 보지 않는다."""
    글 = 따옴.sub(" ", 글)
    if (반응_한.search(글) or 자율_한.search(글)) and not 부정_한.search(글):
        return [("주의", "물건", f"표에 물건 반응이 적혀 있다 — 「{글[:60]}」(사람 반응으로 바꾸거나 지운다)")]
    return []


# ───────── 사람 연기 규칙(점검표 26) — 꾸러미점검.py도 사람지시문검사 · 판정보를 그대로 부른다(두 벌을 두지 않는다) ─────────
# 왜 여기: 11-07~10 영상 굽기 제출 115번 가운데 지시문 검사가 같은 문맥에서 돈 것은 많아야 10번이었다 — 어느 꾸러미에나 걸고 내기 도구가 스스로 부르게 한곳에 둔다.
# 11-10 네 번 다시 짬 — 이 자리에서 독립 검수 다섯 회차 연달아 큰 지적이 나왔다. 낱말을 더하면 미탐 · 오탐이 자리를 옮겼고(둘째 회), 「건너뛰는 갈래」를 두면 그 갈래로 샜고(셋째 회),
#   오탐을 줄이려고 넣은 「풀어 주는 갈래」가 곧 미탐 구멍이 됐다(넷째 · 다섯째 회 — 앞 절의 물건 따라가기 · 잠깐 예외 · 꾸밈 자리의 still · 「too … to」 부정 · 줄 잇기 · 소문자 줄 안 라벨 ·
#   물건의 부분 · 증거 좁히기). 실물에 없는 오탐을 고치려던 갈래는 모두 걷었다. 계약은 이렇다:
#   ① 정지 말(정지낱말 목록)은 어느 판 · 어느 칸에서든 걸린다. 지나가는 것은 ②의 목록뿐이다.
#   ② 풀어 주는 갈래(더하지 않는다 — 실물 지시문이 잘못 걸릴 때만, tests의 「걸려야」 묶음과 사본 변이 시험을 함께 돌려 더한다):
#      가. 바로 부정한 말(never holds still · nothing in the frame is ever perfectly still — 부정어와 정지 낱말 사이에 다른 동사가 끼면 부정이 아니다)
#      나. 그 절에 드러난 주어가 아는 물건 덩이(the can and every sticky note stay still) — 쉼표 나열에 사람이 끼면 사람이다
#      다. 동사가 있는 절 뒤에 접속사로 이은 물건 주어(she lifts the cup and the can stays still) · 「with + 물건」
#      라. it이 가리키는 물건(동물 · 아기 · 캐릭터가 가까이 없을 때)
#      마. 아는 물건 이름씨를 꾸미는 frozen · motionless(a frozen dumpling) — 뒤에 「of + 사람」이 오면 사람이고, 장면 낱말이면 장면 전체다
#      바. 입술의 barely moving(말하는 결) · 따옴표 안의 한국어(대사) · freezing + 날씨
#      사. 사람 없는 판(인물 []이거나, 표가 없고 사람 기척이 전혀 없는 판)에서만: 장면 전체를 멈추는 말(Nothing moves · everything is still · the whole scene …) ·
#          앞 절의 물건을 받는 주어 없는 절과 they
#   ③ 칸: 연기 글(ACTION · WHO · SHOT 줄의 글 · 모르는 라벨 줄 · ACTION 칸 없는 글의 본문)은 ②대로 — 모르는 낱말 · 이름 · they · 주어 없는 절은 사람이다.
#      곁 칸(LOOK · NOTE · PHYSICS · PROPS · 머리 글 …)은 드러난 모르는 주어만 물건으로 봐 준다(PHYSICS: the odd gizmo stays still) — 사람 주어 · 주어 없는 절 · they · 장면 전체는 건다.
#      카메라 칸(CAMERA · FRAME)은 주어 없는 정지 말(almost still)과 「no other movement」까지 카메라의 것으로 본다. 칸은 라벨에서 다음 라벨까지다(줄 머리 라벨과 대문자 줄 안 라벨).
#   ④ 사람 판(→ ACTION 칸 · 사람의 박자를 요구): 컷표 그 컷의 「인물」이 먼저 정한다. 인물이 []여도 확실한 증거(she · he · 확실한 사람 낱말 · they/model + 산 것만 하는 동사)가 있으면
#      「표 어긋남」으로 걸고 사람 판으로 본다. 표가 없는 판은 약한 증거(model · speaker 같은 낱말 · 이름 + 연기 동사 · WHO 칸)도 본다 — 틀리면 인물 []로 밝힌다.
#      증거는 없고 기척(이름일 수 있는 낱말 · 몸 낱말 · model 같은 낱말)만 있는 판은 박자를 요구하지 않을 뿐, 정지 말은 사람 판처럼 본다(이름만 쓴 판이 새지 않게).
#   ⑤ 박자는 「몇 초에 누가」 — 범위는 한 박자, 길이 · 판 길이 · 나이와 물건 · 날씨가 주어인 문장의 박자는 세지 않는다. 컷표에 이어진 인물 판은 둘 이상.
#   ⑥ 소리만 쓰는 판(_순서.json 「방식」: 「목소리 판」 · 「소리만」: true)과 프리비즈 판만 통째로 건너뛴다 — 둘 다 판 목록에 밝힌 판이다.
#   자리 · 자세 · 모양을 지키라는 말(stay where they are · stays seated … she does not stand up · stays rigid)은 정지 말이 아니다(넣었다가 실물이 잘못 걸려 뺐다).
#   정지 말 목록은 닫힌 목록이 아니다 — 못 잡는 말은 정지낱말에, 물건으로 읽혀야 할 낱말은 _물건에 더한다. 알려진 한계는 docs/마케팅/제작양식/영상작업_진단_20261110.md.
아는라벨 = ("ACTION", "CAMERA", "LOOK", "SOUND", "VOICE", "WHO", "LIGHT", "SETTING", "PLACE", "PROPS", "PHYSICS", "NOT", "OUTFIT", "PRODUCT", "TEXT", "MOMENT", "FRAME", "PALETTE",
            "GRADE", "INDOORS", "OUTDOORS", "AUDIO", "MUSIC", "SFX", "AMBIENCE", "NOTE")
# 줄 머리 라벨: 대문자 낱말 하나~넷(「ACTION:」 · 「CLEAR UMBRELLA:」 · 「YUNA:」 · 「HARIN_FACE:」 · 「MOM50:」)이나 아는 낱말(「Indoors:」 · 「Camera:」 · 「Action:」), 「SHOT 1 (0–2 s)」, 한글 이름 줄(「유나:」)
_줄라벨 = re.compile(r"^[ \t]*(?:(SHOT \d+)\b|((?:[A-Z][A-Z0-9_'’\-]*(?: [A-Z][A-Z0-9_'’\-]*){0,3})|(?i:action|camera|look|sound|voice|who|light|setting|place|props|physics|indoors|outdoors|note)|[가-힣]{1,8})"
                   r"[ \t]*(?:\([^)\n]{0,40}\))?[ \t]*:)", re.M)
# 줄 안 라벨: 두 샷을 한 줄에 쓴 판(「SHOT 1 (0–2 s) begins … ACTION: … CAMERA: …」). 대문자 라벨만 읽는다 — 문장 끝 뒤의 「Camera:」 · 「Note:」까지 읽으면
#   ACTION 안의 정지 말이 그 뒤로 숨는다(다섯째 검수: 「… she looks up. Sound: a soft click. Then stands perfectly still to the end.」)
_줄안라벨 = re.compile(r"(?<![A-Za-z])(?:(SHOT \d+)(?=[ \t]*\()|(ACTION|CAMERA|LOOK|SOUND|VOICE|WHO|PHYSICS|PROPS|NOTE|INDOORS|Indoors)[ \t]*:)")
첫장줄 = re.compile(r"@이미지 \d+ is the exact (?:first|last) frame[^.\n]*(?:\.|\n|$)")   # 첫 장 · 끝 장 고정 줄(「… same people and animals …」은 사람이 나온다는 말이 아니다)
시작그대로 = re.compile(r"start(?:s|ing)? from it unchanged", re.I)   # 「@이미지 1 is the exact first frame … start from it unchanged」가 사람을 붙들었다(11-07 m2v 실측 0.04 · 0.07)


def 칸들(글):
    """지시문 → [(라벨, 글)] 차례대로. 첫 라벨 앞(머리)의 라벨은 ""이다. 라벨은 대문자로 맞춘다(「Indoors」 → 「INDOORS」, 「SHOT 2」)."""
    자리 = {}
    for m in _줄라벨.finditer(글):
        g = 1 if m.group(1) else 2
        자리[m.start(g)] = (m.group(g).upper(), m.end())
    for m in _줄안라벨.finditer(글):
        g = 1 if m.group(1) else 2
        자리.setdefault(m.start(g), (m.group(g).upper(), m.end()))
    out, 이름, 끝 = [], "", 0
    for s in sorted(자리):
        if s < 끝: continue
        out.append((이름, 글[끝:s])); 이름, 끝 = 자리[s]
    out.append((이름, 글[끝:]))
    return [(a, b) for a, b in out if a or b.strip()]


def 연기글(글, 칸=None):
    """ACTION 칸의 글(여러 샷이면 SHOT마다의 ACTION을 이어서) — 다음 라벨(줄 머리 · 줄 안)에서 끊는다."""
    return " ".join(t.strip() for l, t in (칸들(글) if 칸 is None else 칸) if l == "ACTION")


# ── 낱말 묶음 ──
_사람명사 = (r"(?:wom[ae]n|m[ae]n|girls?|boys?|persons?|people|models?|actors?|actress(?:es)?|child(?:ren)?|kids?|bab(?:y|ies)|toddlers?|teen(?:ager)?s?|adults?|mothers?|fathers?|mom|mum|dad|parents?|"
          r"couples?|famil(?:y|ies)|workers?|customers?|students?|friends?|neighbou?rs?|crowds?|staff|clerks?|drivers?|passers?-?by|guests?|idols?|runners?|dancers?|singers?|teachers?|chefs?|baristas?|"
          r"employees?|colleagues?|boss(?:es)?|cashiers?|strangers?|lady|ladies|gentlem[ae]n|guys?|husbands?|wife|wives|sons?|daughters?|brothers?|sisters?|grand(?:ma|pa|mother|father|parents?)|"
          r"officers?|soldiers?|doctors?|nurses?|everyone|everybody|anyone|anybody|someone|somebody|companions?|interviewers?|presenters?|diners?|commuters?|passengers?|pedestrians?|"
          r"athletes?|cyclists?|shoppers?|bystanders?|onlookers?|twins?|teammates?|crew|speakers?|listeners?|visitors?|performers?|riders?|skaters?|assistants?|owners?|guards?|vloggers?|barbers?|"
          r"receptionists?|waiters?|waitress(?:es)?|monks?|photographers?|cooks?|vendors?|couriers?|bartenders?|managers?|engineers?|technicians?|farmers?|painters?|musicians?|drummers?|guitarists?|"
          r"pianists?|operators?|hosts?|hostess(?:es)?|pilots?|sailors?|firefighters?|villagers?|tourists?|travell?ers?|hikers?|swimmers?|surfers?|climbers?|"
          r"brides?|grooms?|florists?|bakers?|butchers?|tailors?|janitors?|gardeners?|fisherm[ae]n|shopkeepers?|librarians?|lifeguards?|referees?|gamers?|streamers?|influencers?|stylists?|hairdressers?|"
          r"pharmacists?|scientists?|researchers?|programmers?|interns?|trainees?|elders?|aunts?|uncles?|cousins?|nieces?|nephews?|boyfriends?|girlfriends?|roommates?|classmates?|schoolgirls?|schoolboys?|"
          r"professors?|tutors?|priests?|nuns?|detectives?|thie(?:f|ves)|lawyers?|reporters?|journalists?|writers?|artists?|carpenters?|plumbers?|electricians?|mechanic|welders?|builders?|maids?|"
          r"nann(?:y|ies)|caregivers?|skiers?|golfers?|divers?|announcers?|infants?|newborns?|youths?|widows?|orphans?|citizens?|protesters?|volunteers?|spectators?|designers?|humans?|"
          r"salesm[ae]n|businessm[ae]n|businesswom[ae]n|policem[ae]n|policewom[ae]n|postm[ae]n|firem[ae]n|cameram[ae]n|craftsm[ae]n)")
# 물건으로도 읽히는 사람 낱말 — 물건을 꾸미거나(「passenger door」) 물건의 이름(「wheel guard」 · 「portable speaker」 · 「the new model」)으로도 쓴다.
#   표가 없는 판의 약한 증거로만 본다(인물 []의 표 어긋남은 걸지 않는다)
_약한명사 = r"(?:models?|speakers?|guards?|passengers?|assistants?|hosts?|operators?|pilots?|cooks?)"
# 사람을 가리키는 촬영 말 — 주어 판정에서만 사람으로 본다(「Keep the subject perfectly still」 · 「the talent holds still」). 사람이 나온다는 증거로는 쓰지 않는다
_가리킴명사 = r"(?:subjects?|talents?|protagonists?|mascots?)"
_동물명사 = r"(?:dogs?|cats?|pupp(?:y|ies)|kittens?|pets?|animals?|birds?)"
_몸명사 = (r"(?:hands?|fingers?|fingertips?|thumbs?|palms?|fists?|faces?|eyes?|eyelids?|heads?|bod(?:y|ies)|lips|mouths?|shoulders?|arms?|elbows?|wrists?|legs?|knees?|feet|foot|toes?|hair|backs?|"
         r"chests?|necks?|cheeks?|chins?|jaws?|(?:eye)?brows?|foreheads?|torsos?|hips?|waists?|expressions?|gazes?|smiles?|stares?|poses?|postures?|figures?|silhouettes?)")
_대명사 = r"(?:she|he|her|hers|his|him|they|them|their|theirs|herself|himself|we|us|our|you|your)"
# 판의 상태는 셋이다(11-10 다섯째 검수 뒤):
#   사람 판(→ ACTION 칸 · 박자를 요구한다) — 확실한 증거(she · he · her · his · him · 확실한 사람 낱말 · they/model + 산 것만 하는 동사), 표가 없으면 약한 증거(model · 이름 + 동사 · WHO 칸)도.
#   사람 없는 판(→ 장면 전체를 멈추는 말 · 주어 없는 정지 말을 물건의 것으로 푼다) — 인물 []이거나, 표가 없고 사람을 가리킬 수 있는 말(_기척 — 넓게)이 하나도 없는 판.
#   그 밖(기척은 있는데 증거는 없는 판) — 박자는 요구하지 않지만 정지 말은 사람이 있는 판처럼 본다.
_센대명사 = re.compile(r"\b(?:she|he|her|hers|his|him|herself|himself)\b", re.I)
_센주어 = re.compile(r"\b(?:she|he|him|herself|himself)\b", re.I)   # 이름 줄에서의 증거 — 소유격(her · his)만으로는 아니다
_사람꼴 = re.compile(r"(?<![\w-])" + _사람명사 + r"\b", re.I)
# 산 것만 하는 동사 — 「they walk」 · 「the model smiles」는 사람이다(「they cool」 · 「the new model sits on the turntable」은 물건일 수 있다)
_산동사 = (r"(?:walks?|smiles?|laughs?|nods?|glances?|talks?|chats?|whispers?|giggles?|hugs?|kneels?|jogs?|sprints?|frowns?|shrugs?|sighs?|winks?|squints?|gasps?|sips?|chews?|breathes?|exhales?|inhales?|"
        r"listens?|stares?|grins?|hesitates?|flinch(?:es)?|swallows?|crouch(?:es)?|speaks?|shouts?|cr(?:y|ies))")
_산주어 = re.compile(r"\b(?:they(?:\s+(?:both|all))?|both|the two|" + _약한명사 + r")\s+(?:(?:[a-z]+ly|then|just|now|also)\s+)?" + _산동사 + r"\b", re.I)
생물낱말 = re.compile(r"\b(?:" + _대명사 + "|" + _사람명사 + "|" + _가리킴명사 + "|" + _동물명사 + "|" + _몸명사 + r")\b", re.I)   # 정지 낱말의 주어 판정 — 사람 · 동물 · 몸
_그것사람 = re.compile(r"\b(?:" + _동물명사 + "|bab(?:y|ies)|toddlers?|" + _몸명사 + r")\b", re.I)   # 「it」이 가리킬 수 있는 산 것 — 동물 · 아기 · 몸
# 사람 기척의 몸 낱말 — 뜻이 하나인 것만. back · face · head · arm · leg · foot · body · neck · chest · palm · mouth는 부사 · 동사 · 물건의 부분으로도 쓴다(「tips back」 · 「faces the camera」 · 「its front face」)
_몸확실 = (r"(?:hands?|fingers?|fingertips?|thumbs?|fists?|eyes?|eyelids?|lips|shoulders?|elbows?|wrists?|knees?|toes?|hair|cheeks?|chins?|jaws?|(?:eye)?brows?|foreheads?|torsos?|hips?|waists?|"
         r"gazes?|smiles?|stares?|poses?|postures?|figures?)")   # silhouette는 뺀다 — 나무 · 건물의 것이 흔하다
_기척말 = re.compile(r"\b(?:she|he|her|hers|his|him|herself|himself|we|us|our|you|your|" + _가리킴명사 + "|" + _동물명사 + "|" + _몸확실 + r")\b(?!-)", re.I)
# 박자의 주체 — 주어 자리에 올 수 있는 말만(「behind her」의 her는 주체가 아니다)
_주체말 = re.compile(r"\b(?:she|he|they|we|you|herself|himself|" + _사람명사 + "|" + _가리킴명사 + "|" + _동물명사 + "|" + _몸명사 + r")\b", re.I)
# 「No new people」 · 「no extra people or animals」 · 「No one else speaks」는 사람이 나온다는 말이 아니다 — 증거를 찾기 전에 지운다
사람부정구 = re.compile(r"\b(?:no|without|not any|zero|never any)\s+(?:(?:other|new|extra|more|additional|background|second|third)\s+)?"
                    r"(?:people|persons?|humans?|human beings?|men|women|man|woman|one|animals?|pets?|faces?|crowds?|bystanders?|passers?-?by|extras|hands?|figures?)\b"
                    r"(?:\s+or\s+(?:animals?|people|pets|faces|hands))?(?:\s+else)?", re.I)
_연기동사원 = ("stand sit look turn walk hold stay keep face smile say speak lift raise lean step run take put open close reach nod blink breathe wait watch lie kneel glance stare grin laugh sigh pause "
           "stop shift pick set pull push wear enter leave come go bow wave point drink eat sip bite chew type read write listen hear see notice freeze jump dance sing whisper shout cry sprint jog "
           "crouch bend straighten tilt lower grab touch hug carry throw catch place give show check tap press wipe brush adjust tie pour stir cook taste swallow exhale inhale gasp frown squint wink "
           "shrug flinch hesitate remain").split()


def _삼인칭(w):
    return w + "es" if w.endswith(("s", "x", "z", "ch", "sh", "o")) else (w[:-1] + "ies" if w.endswith("y") and w[-2] not in "aeiou" else w + "s")


_연기동사집 = {_삼인칭(w) for w in _연기동사원} | set(_연기동사원)
_연기동사 = "(?:" + "|".join(sorted(_연기동사집, key=len, reverse=True)) + ")"
# 이름씨로도 쓰는 동사 꼴 — 「Autumn leaves drift」 · 「Luxury watches gleam」의 leaves · watches는 이름씨다. 「Sua steps forward」 · 「Minjae stops short」는 동사다(_동사꼬리)
_겹치는꼴 = set("leaves waves brushes rings lights drinks points steps places shows checks sets picks bites types ties pours stirs cooks tastes close open stops watches faces".split())
# 겹치는 꼴이 동사로 쓰였다는 표시 — 바로 뒤가 구두점 · 전치사 · 한정사 · 수 · 방향 말 · -ly 부사(「Sua steps forward」 · 「Sua waves happily」 · 「Minjae stops short」).
#   「Energy drinks line the shelf」 · 「Autumn leaves drift」처럼 뒤가 다른 낱말이면 이름씨다
_동사꼬리 = re.compile(r"\s*(?:$|[.,;:!?]|(?:at|to|toward|towards|back|her|his|their|the|a|an|once|twice|in|on|with|up|down|over|and|then|goodbye|hello|by|from|into|out|forward|short|away|off|around|aside|ahead|"
                    r"closer|past|through|across|along|inside|outside|behind|beside|near|onto|one|two|three|both|each|all|some|[a-z]+ly)\b)", re.I)
_연기기본 = set(_연기동사원) - {_삼인칭(w) for w in _연기동사원}   # 기본형 — 한 사람 이름 뒤에는 오지 않는다(「Sua looks」 · 「Sua and Minjae look」)
_이름 = r"[A-Z][a-z]+(?:-[A-Za-z]+)?"
# 대명사 없이 이름으로만 쓴 사람(표가 없을 때의 짐작) — 「Sua stands」 · 「Sua and Minjae walk」 · 「Sua in a grey hoodie stands」 · 「Sua, tired, stands」 · 「Sua is standing」 · 「Seojin's eyes widen」
이름주어 = re.compile(
    r"(?<![A-Za-z'’-])(" + _이름 + r")(?:[’']s\s+(?:[a-z-]+\s+){0,2}?" + _몸명사 + r"\b"
    r"|(?:\s+and\s+" + _이름 + r")?(?:\s*,[^,.;:\n]{1,30},)?(?:\s+(?:in|at|by|with|on|near|beside|behind|under|inside|outside|across|from)\s+(?:[a-z0-9][a-z0-9'’-]*\s+){1,5}?)?"
    r"\s*(?:(?:already|then|just|slowly|quickly|now|still|also|gently|quietly|suddenly|finally)\s+)?(?:" + _연기동사 + r"|(?:is|are|was|were)\s+(?:[a-z]+ly\s+)?[a-z]+ing)\b)")
_이름아님 = set("""the a an it its this that these those there then now here nothing everything all both each every only camera steam light rain snow water smoke wind dust fog mist sunlight
 daylight moonlight time one two three four five another other something what which who when while as if after before until behind inside outside above below macro close wide extreme medium low
 high top front back side their his her she he they we you i indoors outdoors shot frame picture image video clip scene background foreground condensation moisture vapor vapour spray powder flour
 sugar salt seasoning glow sparkle glitter confetti nobody shadow reflection breeze music silence darkness morning evening night day dawn dusk midday noon right left just even still soon later once
 again almost some any no not but and or so yet also slowly quickly suddenly finally first second third last next final new old young in on at by with from under over across through near between
 into onto toward towards around along past beyond during insert product title silent korean korea seoul jeju busan han river east west north south sea christmas eve english japanese led
 autumn spring summer winter gentle gently softly quietly calmly barely nearly really tiny golden overhead ahead detail details luxury meanwhile somewhere everywhere nearby tonight today
 thunder lightning traffic upstairs downstairs slow fast quick seen lit mid head handheld natural""".split())


def _이름연기(t):
    """글에 「이름 + 연기 동사」(Sua stands · Sua and Minjae walk · Sua is standing · lets Sua smile)나 「이름's + 몸」(Seojin's eyes)이 있나 — 표가 없는 판에서 대명사 없이 이름으로만 쓴 사람을 찾는다.
    문장 첫머리의 보통 낱말(Blue waves · Extremely close · Overhead look at …) · 동물(Birds sing) · 여럿을 가리키는 보통 낱말(Snowflakes dance — -s로 끝나는 낱말 + 기본형) ·
    이름씨로 쓴 동사 꼴(Autumn leaves drift · Energy drinks line the shelf — 뒤가 동사의 꼬리가 아니다)은 아니다. 상품 · 음식 이름(Omitok sits …)은 이름과 가를 수 없다 — 사람 없는 판이면 인물 []로 밝힌다."""
    for m in 이름주어.finditer(t):
        이름 = m.group(1).lower()
        if 이름 not in _이름꼴(m.group(1)) or re.fullmatch(_동물명사, 이름) or (len(이름) >= 7 and 이름.endswith("ly")): continue
        if m.group(0)[len(m.group(1)):len(m.group(1)) + 2] in ("'s", "’s"): return True   # 「Seojin's eyes」
        끝 = m.group(0).split()[-1].lower()
        if 끝 in _연기기본 and 이름.endswith("s") and not re.search(r"\sand\s", m.group(0)): continue
        if 끝 in _겹치는꼴 and not _동사꼬리.match(t[m.end():m.end() + 16]): continue
        return True
    return False


def _물건줄(l):
    """이름 줄의 라벨이 물건 이름인가 — 「CUP」 · 「CLEAR UMBRELLA」 · 「CAN_REVEAL」 · 「컵」. 사람 · 몸 낱말이 섞이면(「JUNHO_HAND」 · 「PHONE HAND」) 아니다."""
    부 = [x for x in re.split(r"[ _]+", l.lower()) if x]
    return l in _한물건 or (any(x in _물건 for x in 부) and not any(생물낱말.fullmatch(x) for x in 부))


def _이름있음(t):
    """글에 사람 이름일 수 있는 낱말(대문자로 시작하는 모르는 낱말)이 있나. 바로 뒤가 아는 물건이면 상품 이름으로 본다(「Omitok can」).
    문장 가운데의 낱말은 이름으로 보고, 문장 첫머리의 낱말은 뒤가 쉼표 · & · and · 전치사 · 동사 꼴일 때만 이름으로 본다(「Yuna standing by the window」 · 「Yuna, seated …」 —
    「Phantom high-frame-rate product shot」 · 「Natural water physics」는 아니다)."""
    for m in re.finditer(r"(?<![A-Za-z'’-])([A-Z][A-Za-z'’-]*)(\s*[,&])?(?:\s+([A-Za-z-]+))?", t):
        if m.group(1).lower() not in _이름꼴(m.group(1)): continue
        다음 = (m.group(3) or "").lower()
        if 다음 in _물건 and not m.group(2): continue
        if re.search(r"[A-Za-z0-9,)’'\"”][ \t]*$", t[:m.start()]): return True   # 문장 가운데
        if m.group(2) or 다음 == "and" or 다음 in _전치사 or 다음.endswith(("s", "ing", "ed")) or 다음 in _물건동사 or 다음 in _이음동사 or 다음 in _연기동사집: return True
    return False


def _기척(t):
    """글에 사람 · 동물 · 몸을 가리키는 말이 있나 — she · he · her · his · we · you · 사람 낱말(model · guard까지, 사람 자리에 있을 때) · 동물 · 뜻이 하나인 몸 낱말 · 이름일 수 있는 낱말.
    하나도 없어야 사람 없는 판이다(표가 없을 때). 「no people」 · 「no hand」와, 물건도 받는 they · their, 물건에 딸린 「wheel guard」는 기척이 아니다."""
    t = 사람부정구.sub(" ", t)
    return bool(_기척말.search(t)) or _낱말증거(t) or _낱말증거(t, 약한=True) or _이름있음(t)


# 그림 속 사람 — 인쇄물임이 드러난 것만: 「a printed photo of a smiling young ▁woman」 · 「a poster of a ▁man」 · 「a photo sticker on the glass door shows a smiling young ▁woman」.
#   「The photo shows a woman …」 · 「A photo of a woman at a café」는 장면을 그렇게 부른 것일 수 있고, 화면(「the phone shows a man waving」) 속 사람은 움직인다 — 넘기지 않는다
_그림속 = re.compile(
    r"\b(?:(?:printed|framed|taped|pinned|pasted|hanging)\s+(?:photo|photograph|picture|image)|poster|portrait|painting|drawing|illustration|print|sticker|cut-?out|statue|figurine|billboard|mural)s?"
    r"\s+of\s+(?:[a-z-]+\s+){0,4}$"
    r"|\b(?:sticker|poster|sign|billboard|print|label|card|page|magazine|cover|banner|mural|painting|portrait)s?\b"
    r"[^.;:]{0,60}?\bshow(?:s|ing)?\s+(?:only\s+)?(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,4}$", re.I)
_곳낱말 = set("shop store cafe kitchen office classroom studio station stage court stadium bathroom bedroom garden park yard beach forest city village town harbor harbour pier platform street road alley "
            "bridge hallway corridor room building house".split())


def _낱말증거(t, 약한=False):
    """글에 사람 낱말이 사람 자리에 있나. 약한=False: 확실한 사람 낱말(woman · customer · rider …), 약한=True: 물건으로도 읽히는 낱말(model · speaker · guard …).
    증거가 아닌 자리: 붙임표 낱말(「baby-blue」 · 「twin-bell」) · 「a couple of」 · 「driver seat」 · 「driver side」 · 물건을 꾸미는 자리(「the driver mirror folds in」 · 「passenger door」 —
    뒤 낱말이 동사로도 읽히면 증거다: 「the woman signs the paper」 · 「the men pack the bags」) · 소유격(「the driver's seat」 — 뒤가 몸이면 증거다: 「the woman's eyes open」) ·
    인쇄물 속 사람(「a sign that shows only a baby's face」 · 「a printed photo of a woman」). 약한 낱말은 물건에 딸린 자리(「wheel guard」)도 증거가 아니다 — 곳 이름 뒤(「shop assistant」)는 사람이다."""
    for m in _사람꼴.finditer(t):
        if bool(re.fullmatch(_약한명사, m.group(0), re.I)) != 약한: continue
        뒤 = t[m.end():m.end() + 48]
        if m.group(0).lower() == "twin": continue   # 「twin burners」 · 「twin beds」 — 홑꼴은 꾸밈말이다(「the twins run」은 증거다)
        if 뒤[:1] == "-" or re.match(r"\s+(?:of|seat|neck)\b|\s+side\b(?!\s+by\b)", 뒤) or _그림속.search(t[max(0, m.start() - 140):m.start()]): continue
        if 뒤[:1] in ("'", "’"):
            if re.match(r"[’']s?\s+(?:[a-z-]+\s+){0,2}?" + _몸명사 + r"\b", 뒤, re.I): return True
            continue
        다음 = re.match(r"\s+([A-Za-z][A-Za-z-]*)(?:\s+([A-Za-z]+))?", 뒤)
        w, 그뒤 = (다음.group(1).lower(), (다음.group(2) or "").lower()) if 다음 else ("", "")
        if w in _물건 and w not in _연기동사집 and w not in _물건동사 and not w.endswith("s") and 그뒤 not in _한정사 and 그뒤 not in _수량사: continue
        if 약한:
            앞낱 = re.search(r"([A-Za-z][A-Za-z-]*)[ \t]+$", t[:m.start()])
            if 앞낱 and 앞낱.group(1).lower() in _물건 and 앞낱.group(1).lower() not in _곳낱말: continue
        return True
    return False


def _센증거(t, 주어만=False):
    """글에 확실한 사람 증거가 있나 — she · he · her · his · him(주어만=True면 her · his는 빼고) · 확실한 사람 낱말(_낱말증거) · 「they/model + 산 것만 하는 동사」(they walk · the model smiles)."""
    return bool((_센주어 if 주어만 else _센대명사).search(t)) or _낱말증거(t) or bool(_산주어.search(t))


# 아는 물건 — 정지 낱말의 주어가 이 가운데 하나일 때만 물건으로 친다. 사람 · 몸으로도 읽히는 낱말(figure · model · subject · speaker · shadow · reflection · row · rest · fan)은 넣지 않는다
_물건, _복수물건 = set(), {"tongs", "glasses", "sunglasses", "goggles", "leaves", "shelves", "knives"}
for _w in ("""camera lens tripod gimbal frame framing picture image shot view scene screen display monitor background backdrop horizon skyline composition focus exposure light lighting lamp bulb lantern
 spotlight floodlight door gate window pane wall floor ceiling roof room corridor hallway staircase stairwell building house street road alley bridge tower fence railing pillar column post sign
 signboard billboard banner flag curtain blind shutter handle knob lock latch hinge drawer cupboard cabinet shelf shelves table desk counter chair stool bench sofa couch bed pillow blanket cushion rug
 carpet mat mirror clock vase pot plant tree branch twig leaf leaves flower petal grass bush stone rock pebble sand soil ground mountain hill field lake river sea ocean wave water puddle pool ice
 snow frost rain raindrop drop droplet splash crown bubble foam steam smoke mist fog haze cloud sky sun moon air dust flame fire candle spark ember
 product package packaging pack box carton case casing crate can tin bottle jar tube pouch sachet bag sack backpack tote purse wallet cup mug glass tumbler bowl plate dish tray pan kettle lid cap tab
 cork straw spoon fork knife knives chopstick ladle tongs label logo sticker tag text letter word title caption subtitle print poster photo photograph polaroid card note memo paper page sheet book
 notebook magazine newspaper envelope pen pencil brush phone smartphone tablet laptop computer keyboard remote headphone earbud watch ring necklace bracelet glasses sunglasses goggles hat scarf coat
 jacket shirt hoodie sweater dress skirt shoe sneaker boot sock glove umbrella canopy ribbon bow fabric cloth satin silk towel napkin tissue vest mask strap buckle zipper button
 food noodle ramen rice soup broth egg meat vegetable fruit apple orange tangerine lemon tomato bread cake cookie candy chocolate cheese butter sauce oil liquid drink beverage coffee tea milk juice
 beer wine soda cola syrup cream dumpling kimchi pizza burger sandwich snack chip cereal serum lotion lipstick balm perfume soap shampoo
 car bus truck trailer van taxi train subway tram bike bicycle scooter motorcycle boat ship plane drone quadcopter wheel tire engine blade propeller turbine machine conveyor belt elevator escalator
 treadmill ball toy doll mannequin statue sculpture figurine trophy medal key coin bill ticket receipt tape string rope wire cable chain needle pin thing object item prop stack pile surface edge
 corner ledge close-up closeup macro alarm siren bell radio television knit yarn thread fiber fibre loop fold crease bead pearl gem jewel crystal diamond flap arrow pointer cursor icon bar line dot
 shape pattern texture grain pixel number digit pedal saddle seat dashboard windshield wiper racket net hoop track lane court stadium stage studio store shop cafe kitchen office classroom bathroom
 bedroom garden park yard beach forest city village town harbor harbour pier station platform tunnel highway crosswalk sidewalk pavement asphalt gravel cone popsicle ice-cream skewer grill barrel
 basket bucket ladder hook hanger rack rail magnet tile brick plank beam pipe valve switch socket plug charger battery cord doorway archway cube block slice chunk shard sliver crumb puff plume
 ripple swirl stream trickle drip pad patch capsule pill stick chicken pork beef fish shrimp tofu stew controller console tagline slogan price panel board sleeve collar cuff hem pocket lapel hood
 stair step slope cliff waterfall fountain sunbeam ray glare flare sparkle glitter confetti balloon kite pull-tab sprig needle pine shadow reflection
 tent menu dropper pipette pump nozzle earphone headset fridge refrigerator oven microwave stove toaster blender dishwasher vacuum diffuser humidifier heater pendulum
 cooler vapor vapour lunchbox calendar keyhole wind breeze gust thunder lightning storm sunlight daylight moonlight""").split():
    _물건.update((_w, _w + "s", _w + "es")); _복수물건.update((_w + "s", _w + "es"))
# 물건 앞에 올 수 있는 꾸밈말(색 · 크기 · 재질 · 상태) — 여기 없는 모르는 낱말은 한정사가 있고 수가 맞을 때만, 하나만 받는다(「Sua waves」 · 「the interviewer watches」의 waves · watches는 동사다)
_꾸밈씨 = set("""white black grey gray red blue green yellow orange pink purple brown beige ivory navy silver gold golden bronze copper ruby amber crimson turquoise pastel pale dark light bright dim
 warm cold cool hot wet dry clear clean dirty old new big small large little tiny huge tall short long wide narrow thick thin heavy flat round square open closed empty full whole single double front
 back rear side top bottom upper lower left right inner outer main same plain bare soft hard smooth rough sharp blunt wooden metal steel iron brass plastic leather cotton linen wool ceramic concrete
 brick clay kraft cardboard rubber chrome matte glossy shiny dusty misty frosty icy sticky blank frozen broken woven hidden fallen molten see-through transparent translucent opaque fresh raw
 ripe sweet spicy fizzy iced steamy neon fluorescent tungsten electric digital analog mini giant premium real fake low high far near distant nearby next last first second third final only very
 felt paper glass deep""".split())
_한정사 = set("the a an its this that these those every each her his their my your our".split())
_수량사 = set("both all any no some several many one two three four five six other another more".split())
_주어대명사 = set("she he they we you i who".split())
_전치사 = set("on in at by under behind beside near of with above below inside outside from against around across along over between beneath atop onto into next to through within without toward "
           "towards upon off past beyond among".split())
_꼬리표 = _전치사 | set("that which where itself themselves too also alone".split())
_분사 = set("stuck hung left set held kept put laid worn shut open closed".split())
_정도말 = set("perfectly completely absolutely totally very quite almost exactly nearly entirely utterly so too just simply always also now there here calmly quietly upright flat again "
           "forever ever really even extremely never".split())
_이음동사 = set("stays stay stayed remains remain remained is are was were be been being keeps keep kept hangs hang hung sits sit sat lies lie lay stands stand stood rests rest rested holds hold held "
            "looks seems seem appears appear floats float hovers hover waits wait continues continue will would must should shall may might could does do did has have had to goes go went becomes "
            "become grows grow falls fall".split())
_기본형 = set("stay remain be keep hang sit lie stand rest hold float hover wait continue go become grow fall".split())
_조동사 = set("can could will would must should shall may might cannot can't can’t won't won’t to".split())
_단수꼴 = set("stays remains is was keeps hangs sits lies stands rests holds looks seems appears floats hovers waits continues does doesn't doesn’t has goes becomes grows falls".split())
_복수꼴 = set("stay remain are were keep hang sit lie stand rest hold look seem appear float hover wait continue do don't don’t have go become grow fall".split())
_여럿말 = set("two three four five six both several many these those".split())
_딸린것 = {"shadow", "shadows", "reflection", "reflections"}   # 사람에 딸린 것 — 사람 소유격(her shadow · Minjae's shadow)이 붙으면 물건 주어로 치지 않는다
_사람소유 = ("her", "his", "their", "my", "your", "our")
_묶음말 = set("pair pairs row rows bunch bunches set sets couple handful cluster clusters heap heaps bundle bundles stack stacks pile piles line lines".split())   # 「a pair of chopsticks」 — 머리는 of 뒤다
# 모르는 꾸밈말로 받지 않는 꼴 — 사람을 가리키는 낱말의 꼬리(「the janitor light」의 janitor)
_사람꼴뒤 = re.compile(r"(?:er|or|ist|ian|ant|ent|man|men|ess|ee|eer|ier)$")


def _꼴들(낱말들):
    out = set()
    for w in 낱말들.split():
        out.update((w, _삼인칭(w)))
        out.update((w + "d", w[:-1] + "ing") if w.endswith("e") else (w + "ed", w + "ing"))
    return out


# 물건이 주어일 때 뒤따르는 아는 동사 — 「the shop assistants wait」처럼 물건 뒤에 모르는 낱말이 오면 그 낱말이 주어다(물건 주어가 아니다)
_물건동사 = _꼴들("""stay remain keep hang sit lie stand rest hold float hover wait continue become grow fall rise roll spin rotate turn slide glide drift move stop start begin open close swing tilt
 tip wobble shake vibrate rattle jitter ring buzz beep flash blink flicker glow shine gleam glint glitter sparkle shimmer reflect light dim brighten fade darken appear disappear vanish emerge steam
 smoke burn melt freeze thaw crack pop burst break snap bend stretch shrink fill empty pour drip drop splash spray spill flow run stream trickle bubble boil fizz foam simmer sizzle settle land bounce
 hit touch cross pass follow lead enter leave arrive reach cover hide show reveal face point lean sway flutter flap ripple rustle stir swirl whirl circle orbit tumble topple collapse slip sink climb
 lift lower click lock unlock tick play pause loop end cut switch change come go pull push carry catch read display""") | set(
    "is are was were be been has have had does do did goes went stood sat lay hung held kept fell rose spun slid swung shook rang shone lit hid broke bent shrank sank ran led left froze began came".split())
_장면꼬리 = {"frame", "scene", "shot", "room", "picture", "image", "view", "background"}
_장면낱말 = {"scene", "frame", "picture", "image", "shot", "view", "room", "tableau", "world", "moment"}
_카메라낱말 = {"frame", "shot"}   # 「the frame holds still」은 카메라다 — whole · entire가 붙을 때만 장면 전체로 본다


def _장면주어(toks, 낱말도=True):
    """장면 전체를 가리키는 주어인가 — everything (else) · all (else · of it) (+ in the frame) · the rest of the frame · (낱말도) the (whole · entire) scene · frame · picture · image · shot · view · room.
    사람 없는 판이 아니면 사람도 멈춘다. 카메라 칸에서는 낱말 꼴을 보지 않는다(「the frame holds still」은 카메라다)."""
    t = list(toks)
    if t[:4] == ["the", "rest", "of", "the"]: return len(t) == 5 and t[4] in _장면꼬리
    if 낱말도 and t[:1] in (["the"], ["this"], ["that"]):
        온통 = t[1:2] in (["whole"], ["entire"]); u = t[2:] if 온통 else t[1:]
        return len(u) == 1 and u[0] in _장면낱말 and (온통 or u[0] not in _카메라낱말)
    if not t or t[0] not in ("everything", "all"): return False
    t = t[1:]
    if t[:1] == ["else"]: t = t[1:]
    if t[:2] == ["of", "it"]: t = t[2:]
    if len(t) == 3 and t[:2] == ["in", "the"] and t[2] in _장면꼬리: t = []
    return not t


_그것산것 = re.compile(r"\b(?:" + _동물명사 + r"|bab(?:y|ies)|toddlers?|mascots?|creatures?|characters?|robots?|puppets?|sharks?|magpies?|monsters?)\b", re.I)   # 가까이 있으면 it이 누구인지 모른다
_그것주어 = (["it"], ["it", "itself"], ["this"], ["that"])
_그들주어 = (["they"], ["they", "all"], ["they", "both"], ["these"], ["those"], ["both"])
_머리말 = re.compile(
    r"^\s*(?:(?:and|but|so|then|meanwhile|now|only|also|yet|afterwards?|after that|all the while|the whole time|throughout|as before|again|once more|even|at first|at last|at the end|"
    r"at the start|in the end|by then|by now|finally|suddenly|slowly|gently|once open|once closed)\b[\s,]*"
    r"|(?:at|by|from|until|till|after|before|within|for|over|around|during|in)\s+(?:about\s+|around\s+|roughly\s+|the\s+(?:first|last|whole|entire|final)\s+)?\d+(?:\.\d+)?"
    r"(?:\s*(?:[–-]|to)\s*\d+(?:\.\d+)?)?\s*s(?:ec(?:ond)?s?)?\b(?:\s+(?:to|and|until|through)\s+(?:about\s+)?\d+(?:\.\d+)?\s*s\b)?(?:\s+on(?:wards?)?)?[\s,]*"
    r"|(?:for|during|throughout|over|in|from|to|until|across)\s+(?:the\s+|this\s+|every\s+|each\s+)?(?:whole\s+|entire\s+|rest of the\s+|very\s+|first\s+|last\s+)?"
    r"(?:clip|shot|video|take|scene|time|end|frames?|first frame to the last(?: frame)?)\b[\s,]*"
    r"|(?:behind|beside|above|below|under|inside|around|near|next to|in front of|on top of|on|in|at)\s+(?:it|them|this|that|her|him|(?:the|a|an|its|her|his|their)\s+(?:[a-z'’-]+\s+){0,3}?[a-z'’-]+)"
    r"\s*,?\s+(?=(?:the|a|an|its|every|each|both|all|this|that|these|those|her|his|their)\s))", re.I)
# 절 경계 — 구두점(소수점 「1.2 s」의 점은 아니다) · 따옴표 · 줄표, 새 절을 여는 접속사, 「and it …」 · 「and they …」(주어가 바뀐다)
_절끝 = re.compile(r"[;:!?\n—–(),\"“”]|\.(?!\d)|\s-\s|\b(?:while|as|when|whereas|because|although|though|unless|so that|who|whose|which)\b"
                 r"|\band\s+(?=(?:it|they|everything|nothing|all)\b)", re.I)
_문장끝 = re.compile(r"[;!?\n]|\.(?!\d)")
_조각끝 = re.compile(r"[,—–()]|\s-\s")
# 정지를 부정하는 말 — 부정어가 정지 낱말(이나 그 동사)을 바로 다스릴 때만: 「never holds still」 · 「not perfectly still」 · 「rather than staying frozen」 · 「never lets her stand still」.
#   「she never blinks standing perfectly still」 · 「she says nothing and stands still」처럼 다른 동사 · 접속사가 끼면 정지 지시다.
#   「unable to keep still」 · 「too excited to stand still」은 부정으로 보지 않는다 — 넣었다가 「she too stands perfectly still」이 풀려 뺐다(다섯째 검수). 「not able to keep still」은 not이 있어 부정이다
_부정뒤 = (r"(?:\s+(?:ever|longer|really|quite|once|just|simply|even|fully|truly|able))*(?:\s+let(?:s|ting)?\s+(?:her|him|them|it|anyone|anybody))?"
         r"(?:\s+(?:to\s+)?(?:be|being|been|is|are|hold|holds|holding|keep|keeps|keeping|stay|stays|staying|stand|stands|standing|sit|sits|sitting|lie|lies|lying|remain|remains|remaining|go|goes|going|"
         r"become|becomes|becoming|get|gets|getting|look|looks|looking|seem|seems|strike|strikes|striking|turn|turns|turning|fall|falls|falling))?(?:\s+to)?(?:\s+(?:ever|really|quite|just|simply|even|fully|truly))*"
         r"(?:\s+(?:a|an|the|any|her|his|their|that|this|one|single))?(?:\s+(?:completely|perfectly|absolutely|totally|entirely|utterly|fully|quite|too|so|very|almost|stiff,?|rigid,?|fixed,?))*\s*$")
정지부정_부사 = re.compile(r"(?:\b(?:never|not|no|without|nor|neither|hardly|barely|rather than|instead of|avoid(?:s|ing)?|cannot)\b|n[’']t\b)" + _부정뒤, re.I)
# 부정 주어 — 「nobody holds a frozen pose」 · 「nothing in the frame is ever perfectly still」 · 「no one stands still」. 사이에는 자리 말(in the frame · of them)과 위의 꼬리만 올 수 있다 —
#   다른 동사가 끼면 부정이 아니다(「Nothing distracts the woman standing perfectly still」 · 「nothing breaks the perfectly still pose」)
정지부정_주어 = re.compile(r"\b(?:nobody|no one|no-one|nothing|none|neither)\b(?:\s+(?:of them|else|at all|in the [a-z]+|on (?:the|her|his|its) [a-z]+))*" + _부정뒤, re.I)
# 정지 낱말 — 「동사 + still」 · 「부사 + still」 · 몸 + still · 자세 · 표정을 붙드는 말 · 낱말 자체가 정지 · 움직이지 않는다 · 굳는다
_세게 = r"(?:very|quite|completely|perfectly|absolutely|totally|almost|nearly|utterly|entirely|fully|so|too|rock|stock|dead|deathly|extremely|really|remarkably|eerily|unnaturally|stone)"
_자세잡기 = r"(?:hold|holds|held|holding|keep|keeps|kept|keeping|maintain|maintains|maintained|maintaining)"
_머무름 = r"(?:stay|stays|stayed|staying|remain|remains|remained|remaining)"
_몸칸 = r"(?:head|body|hands?|face|gaze|eyes|shoulders?|arms?|legs?|feet|fingers?|expression|features|posture|torso|chin|lips|mouth)"
정지낱말 = re.compile("|".join((
    r"\b(?:stay|stays|stayed|staying|stand|stands|stood|standing|sit|sits|sat|sitting|hold|holds|held|holding|keep|keeps|kept|keeping|remain|remains|remained|remaining|lie|lies|lay|lying|"
    r"rest|rests|rested|resting|hang|hangs|hung|hanging|wait|waits|waiting|hover|hovers|hovered|hovering|float|floats|floated|floating)\s+still\b",
    r"\b" + _세게 + r"(?:[\s-]+" + _세게 + r")*[\s-]+still\b",   # 낱말 사이의 탭 · 줄바꿈 · 줄바꿈 없는 빈칸도(「perfectly⏎still」)
    r"\b(?:calm|quiet|silent|relaxed|exhausted|composed|poised|serene|tense|rigid|stiff|upright|steady|deadpan|serious|blank),? and still\b(?!\s+(?:[a-z]+ing|has|have|is|are|was|were|does|do|can|will|on|in)\b)",
    r"\bstill and (?:silent|quiet|calm|deadpan|serious|composed|expressionless|blank|upright|tense|rigid|stiff|steady)\b",
    r"\b(?:is|are|was|were)\s+still(?=\s*(?:[.,;:!?—–)\n]|$|(?:for|until|throughout|to the end|the whole)\b))",   # 「is still in the room」의 still은 「아직」이다
    r"\b(?:goes|go|went|going|becomes?|falls?|fell)\s+still\b",   # 「she goes still and waits」
    r"(?<=[,—–])\s*still\s*(?=[,.;—–]|$)",   # 「…, still, …」 · 「… with his back to the camera, still.」 · 「she waits — still — until the cut」
    r"\bstill as (?:a|an|the) [a-z]+\b|\bas still as\b",
    r"\bstill (?:face|figure|body|pose|posture|features|expression|gaze|silhouette)\b",
    r"\b" + _자세잡기 + r"\s+(?:it|them|(?:her|his|their|the|its)\s+(?:[a-z]+\s+){0,2}?[a-z]+)\s+(?:perfectly\s+|completely\s+|absolutely\s+|very\s+)?still\b",   # keeps her head still · hold it still
    r"\b" + _자세잡기 + r"\s+(?:him|herself|himself|themselves|everyone|everybody)\s+(?:perfectly\s+|completely\s+|absolutely\s+|very\s+)?still\b",   # keeps him still · holds herself still · keeps everyone still
    r"\b" + _자세잡기 + r"\s+her\s+still(?=\s*(?:[.,;:!?—–)\n]|$|(?:for|until|throughout|to|the whole|while|as|and|or|but|in|on|at|by|so|then|with)\b))",   # keep her still(「her still-warm cup」 · 「her still wet hair」의 still은 「아직」이다)
    r"\b(?:her|his|their)\s+(?:[a-z]+\s+)?" + _몸칸 + r"\s+still(?=\s*[,.;:—–)]|\s+and\b|\s*$)",   # 「she waits, her body still, …」
    r"\b" + _자세잡기 + r"\s+(?:(?:the|her|his|their|this|that|a|an|one)\s+)?(?:(?:exact|same|opening|starting|first|final|last|frozen|fixed|rigid|static|still|single)\s+)*(?:pose|position|posture|stance)\b",
    r"\b" + _자세잡기 + r"\s+(?:that|the|this|her|his|their)\s+(?:[a-z]+\s+){0,2}?(?:look|stare|expression)\b(?!\s+(?:of|and feel)\b)",   # holds that (quiet) look(「keep the look of a TV drama」는 화면 결이다. 「keeps that smile」은 넣지 않는다 — 실물 p6-22c)
    r"\b" + _자세잡기 + r"\s+there\s+(?:to the (?:very )?end|until the (?:very )?end|to the last frame)\b",
    r"\b" + _자세잡기 + r"\s+(?:it|that|the|this|her|his|their)\s*(?:(?:same|exact|steady|fixed)\s+)*(?:gaze|smile|grin|face|look|stare|expression|pose)?\s*"
    r"(?:to the (?:very )?end|until the (?:very )?end|to the last frame|for the rest)\b",   # holds it to the end
    r"\b(?:motionless|unmoving|immobile|stock-?still|statue-?like|expressionless|stationary|unblinking)\b",
    r"\b(?:like|as) an? (?:[a-z]+ ){0,2}?(?:statue|mannequin|wax figure|photograph|photo|freeze-frame)\b",   # 「like a statue」 · 「like a perfectly still statue」
    r"\b(?:does not|doesn[’']t|do not|don[’']t|did not|didn[’']t|cannot|can[’']t|won[’']t|never|not|without|no longer|barely|hardly|scarcely)\s+(?:ever\s+)?mov(?:e|es|ing)\b(?!\s+(?:like|as if|in sync)\b)",
    r"\b(?:is|are|was|were)(?:n[’']t|\s+not)\s+moving\b|\bstops? moving\b",
    r"\bwithout (?:any |a single |the slightest )?(?:movement|motion)\b|\b(?:makes?|making|with) no (?:movement|motion)\b(?!\s+blur)|\bno (?:other|further|more) (?:movement|motion)s?\b",
    r"\bnothing (?:moves|changes|stirs) (?:on|in|across) (?:her|his|their) (?:face|expression|features|body)\b",
    r"\b(?:nobody|no one|no-one|neither(?: of them)?|none of them)(?:\s+else)?(?:\s+in the (?:frame|shot|room|scene|picture|background))?\s+(?:moves|stirs)\b",
    r"\bnothing(?: else| at all)?(?: in the (?:frame|shot|room|scene|picture|background))? (?:moves|stirs)\b|\bnot a (?:single )?thing (?:moves|stirs)\b",   # 장면 전체 — 「Nothing moves.」 · 「nothing else moves.」(「nothing on the door moves」는 물건 문장이라 이 꼴이 아니다)
    r"\b(?:never|does not|doesn[’']t|do not|don[’']t|did not|didn[’']t) reacts?\b",   # 「stares straight ahead … and never reacts」
    r"\b(?:face|expression)\s+(?:stays?|remains?)\s+(?:completely\s+|totally\s+|perfectly\s+)?blank\b",   # 「His face stays blank」
    # 표정 · 시선 · 자세가 주어이고 목적어 없이 끝나는 hold — 「The snarl holds as …」 · 「The revolted expression holds.」(11-14 참고 카드 41행: 남의 연기 견본의 끝 문장 꼴, 실물 9,278파일에 0번).
    #   face · smile · look은 넣지 않는다(「the close-up of her face holds」는 카메라 말, 「keeps that smile」은 실물 p6-22c라 풀어 두었고, 「The warm cinematic look holds」는 화면 결이다 — GPT 검수 GA1).
    #   끝 모습은 「… stays, lips together, while she breathes」로 쓴다
    r"\b(?:stares?|expressions?|snarls?|glares?|scowls?|frowns?|grimaces?|poses?|postures?)\s+(?:holds|hold|held)\b"
    r"(?=\s*(?:[.,;:!?—–)\n]|$|(?:as|while|until|for|through|throughout|to|there)\b))",
    r"\bfrozen\b",
    r"\bfr(?:eezes?|eezing|oze)\b(?![- ]frame)(?!(?<=freezing)\s+(?:rain|cold|wind|air|fog|mist|drizzle|temperatures?|weather|night|morning|point)\b)",
    # 자리 · 자세 · 모양을 지키라는 말은 정지 말이 아니다(실물): 「the guests stay where they are」 · 「she stays seated … to the last frame — she does not stand up」 · 「the dog does not budge」 ·
    #   「the lattice stays rigid」 · 「her lips stay exactly as they are」 · 「the same wide, fixed smile」 — 넣었다가 실물 스물몇 판이 잘못 걸려 뺐다
    r"\b" + _머무름 + r"\s+(?:put|like that|(?:exactly\s+)?as (?:she|he) is|as they are)\b|\brooted to the (?:spot|floor|ground)\b",   # 「exactly as they are」는 모양을 지키라는 말이다(실물)
    r"\b(?:at|to) a (?:complete |total |dead )?standstill\b",
    r"\bno (?:movement|motion) (?:at all|whatsoever)\b|\bzero (?:movement|motion)\b(?!\s+blur)",
    r"\b(?:stays?|remains?|is|are|stands?|sits?)\s+paused\b",
    r"\b" + _머무름 + r"\s+(?:exactly\s+|firmly\s+)?in place\b",
    r"\b(?:stay|stays|stayed|remain|remains|remained|is|are|sit|sits|stand|stands|lie|lies|wait|waits)\s+in\s+(?:the|that|this|her|his|their)\s+(?:(?:exact|same|opening|starting|first|final|last)\s+)*"
    r"(?:pose|posture|stance|position)\b",
    r"\b(?:pose|posture|expression|stance|face|gaze|look)\b[^.;,]{0,24}?\b(?:never|does not|doesn[’']t)\s+(?:shifts?|changes?)\b",
    r"\b(?:does not|doesn[’']t|do not|don[’']t|never|not|without)\s+chang(?:e|es|ing)\s+(?:her|his|their|the|its)\s+(?:pose|posture|stance|position|expression)\b",
    r"\b(?:in|holds?|keeps?|maintains?)\s+(?:a\s+)?(?:complete|total|perfect|absolute|utter)\s+stillness\b",
    r"\bstatic (?:figure|pose|posture|body|face)\b|\b(?:remain|remains|stay|stays|stand|stands|sit|sits)\s+(?:completely\s+|perfectly\s+)?static\b",
)), re.I)
_대사 = re.compile(r"\"[^\"\n;]{0,300}\"|“[^”\n;]{0,300}”|「[^」\n;]{0,300}」")   # 쌍반점이 낀 것은 대사가 아니다(짝이 어긋난 따옴표)
_꾸밈말 = ("frozen", "motionless", "unmoving", "immobile", "expressionless", "statue-like", "statuelike", "stationary", "unblinking")
_늘사람꾸밈 = ("expressionless", "unblinking", "statue-like", "statuelike")   # 사람에게만 쓰는 꾸밈말 — 물건 이름씨 앞에 와도 사람이다(「an expressionless close-up of her face」)
_서술뒤 = _전치사 | set("and or but until while as like stiff solid there here still again now then forever before after she he they it for during throughout when".split())
_사람것 = set("pose position posture stance expression face smile stare gaze look grin figure body silhouette features eyes hand hands".split())
# 주어를 볼 것 없이 사람인 말(표정 · 자세 · 「아무도 안 움직인다」) / 장면 전체를 멈추는 말(사람이 나오는 판에서만 건다)
_늘사람 = re.compile(r"^(?:nothing (?:moves|changes|stirs) |(?:nobody|no one|no-one|neither|none of them)\b|still (?:face|figure|body|pose|posture|features|expression|gaze|silhouette)|static (?:figure|pose|posture|body|face)"
                   r"|(?:pose|posture|expression|stance|face|gaze|look)\b)", re.I)
_장면말 = re.compile(r"^(?:no (?:other|further|more) (?:movement|motion)|nothing(?: else| at all)?(?: in the [a-z]+)? (?:moves|stirs)$|not a (?:single )?thing (?:moves|stirs)$)", re.I)
# 사람에게만 쓰는 말 — 자세 · 표정을 붙드는 말과 조각상 비유는 주어를 볼 것 없이 사람이고, 정지 구 안에 her · him · his가 있으면 그 사람을 멈추는 말이다(「Keep her perfectly still」).
#   look은 넣지 않는다 — LOOK 줄의 「keep the same look to the end」는 화면 결이다(연기 글에서는 주어를 몰라도 걸린다)
_사람말 = re.compile(r"\b(?:pose|posture|stance|expression|expressionless|statue|statuelike|stare|gaze|smile|grin|face|her|him|his|herself|himself|themselves|everyone|everybody)\b", re.I)
_초 = r"\d{1,3}(?:\.\d+)?[\s-]?s(?:ec(?:ond)?s?)?\b"
# 시간 박자 — 「몇 초에」: 시각을 가리키는 말(at · by · from · until · after · first · last …) 뒤의 초(「at about 0.6 s」 · 「at ~0.5 s」 · 「at t=0.5 s」 · 「at the 2-second mark」), 「(0.5 s)」 · 「[0.5 s]」,
#   「1.2 s after the cut」 · 「0.4 s:」, 나열 가운데 수(「at about 1.5 s, 2.6 s and 3.8 s」). 범위(「from 0.8 s to 1.6 s」 · 「0.3–0.8 s」 · 「0.5~1.0 s」)는 한 박자.
#   길이(「for 4 seconds」 · 「for about 2 s」) · 판 길이(「the 4 s clip」) · 나이(「in her 20s」) · 그 밖의 「15s」는 박자가 아니다
_박자범위 = re.compile(r"\b(?:from|between)\s+(?:about\s+|around\s+)?\d{1,3}(?:\.\d+)?(?:\s?s(?:ec(?:ond)?s?)?)?\s*(?:to|and|until|through|[–~-])\s*(?:about\s+|around\s+)?" + _초
                    + r"|(?<![\w.])\d{1,3}(?:\.\d+)?\s?(?:s\s?)?[–~-]\s?" + _초, re.I)
_박자점 = re.compile(r"(?<!\bfor\s)(?:\b(?:at|by|from|until|till|after|before|around|about|within|to|and|first|last|starting|over|past|near|toward|towards|roughly|approximately)\s+"
                   r"(?:(?:about|around|roughly|approximately|approx\.?|nearly|almost|just|exactly|only)\s+)*(?:t\s?=\s?)?[~≈]?|[(\[]\s*|(?<=\d s, )|(?<=\ds, ))" + _초
                   + r"(?!\s*-?\s*(?:long|clip|shot|video|take|loop|film|spot|ad|reel|cut|version|edit)\b)"   # 「about 4 s long」 · 「the 4 s clip」 · 「about 4 s cut」은 길이다
                   r"|\b(?:at|by|near|around|about)\s+(?:(?:about|around)\s+)?the\s+" + _초 + r"\s+(?:mark|point)\b"   # 「at the 2-second mark」 — 「over the 4 s of the take」는 길이다
                   r"|(?<![\w.])" + _초 + r"\s*(?:[:—–]|(?:after|later|into)\b)", re.I)


def 박자수(글):
    """시간 박자(몇 초에)의 수 — 범위는 한 박자로 세고, 길이 · 판 길이 · 나이는 세지 않는다."""
    범위 = []
    글 = _박자범위.sub(lambda m: 범위.append(1) or " " * len(m.group(0)), 글)
    return len(범위) + sum(1 for _ in _박자점.finditer(글))


def 사람박자수(글):
    """사람 연기의 시간 박자 수 — 물건 · 날씨가 주어로 드러난 문장 조각(「at about 0.5 s rain pours off the awning behind her」 · 「at about 1.6 s the kettle clicks off」)의 박자는 세지 않는다.
    주체(she · 사람 · 몸 낱말 · 이름)가 든 조각 · 주어를 줄인 조각(「1.5 s: turns to the window」) · 모르는 주어(「the magpie pecks twice (about 1.5 s)」)의 박자는 센다 —
    덜 세면 사람 판을 막으니 물건 주어가 분명할 때만 뺀다. 「behind her」의 her는 주체가 아니다. 범위는 줄을 넘겨 써도 한 박자다(「from 0.5 s⏎to 2.0 s」)."""
    n = 0
    for 조각 in re.split(r"[;!?\n]|\.(?!\d)", _박자범위.sub(" § ", 글)):
        k = 조각.count("§") + sum(1 for _ in _박자점.finditer(조각))
        if k and not _주체말.search(조각) and not _이름꼴(조각):
            맨 = _박자점.sub(" ", 조각).replace("§", " ").strip(" ,:—–-()[]")   # 초를 지운 나머지가 물건 주어로 시작하나
            if _물건으로시작(_낱말들(_머리말뗌(맨))): k = 0
        n += k
    return n


def _낱말들(s):
    return re.findall(r"[a-z0-9][a-z0-9'’-]*", s.lower())


def _보통낱말(w):
    return w in _이름아님 or w in _물건 or w in _꾸밈씨 or w in _한정사 or w in _수량사 or w in _전치사 or w in _이음동사


def _이름꼴(s):
    """글에서 대문자로 시작하는 모르는 낱말(소문자로) — 이름일 수 있다. 문장 첫머리의 보통 낱말(The · At · Close-up · Top-down …)과 온통 대문자 낱말은 뺀다."""
    return frozenset(w.lower() for w in re.findall(r"(?<![A-Za-z'’-])[A-Z][A-Za-z'’-]*", s)
                     if not w.isupper() and not _보통낱말(w.lower()) and not _보통낱말(w.lower().split("-")[0]) and not (len(w) > 5 and w.lower().endswith(("ing", "ed"))))


def _머리말뗌(s):
    while True:
        m = _머리말.match(s)
        if not m or not m.end(): return s
        s = s[m.end():]


def _꼬리뗌(toks, 구=""):
    """절에서 정지 낱말 바로 앞의 이음 동사 · 정도 부사 · 「calm and」를 떼어 주어만 남긴다 → (낱말들, 주어 곁 동사의 수 "단" · "복" · None, 동사가 있었나).
    정지 낱말이 동사로 시작하면(「stays still」 · 「does not move」) 그 동사가 주어 곁 동사다. 조동사가 끼면(「the can can stay」 · 「will stay」) 수를 알 수 없다."""
    toks = list(toks); 동사 = None; 모름 = False; 있었나 = False
    첫 = (구.split() or [""])[0]
    if 첫 in _단수꼴 or re.match(r"(?:never|no longer|barely|hardly|scarcely) moves\b", 구): 동사, 있었나 = "단", True
    elif 첫 in _복수꼴 or re.match(r"(?:never|no longer|barely|hardly|scarcely) move\b", 구): 동사, 있었나 = "복", True
    elif 첫 in _이음동사 or 첫 in ("stops", "stop", "freezes", "freeze", "froze", "makes", "make"): 있었나 = True
    if (첫 in _기본형 or 첫 in ("move", "freeze")) and toks and toks[-1] in _조동사: toks.pop(); 모름 = True
    while toks:
        t = toks[-1]
        if t in _정도말: toks.pop()
        elif t in _이음동사:
            toks.pop(); 있었나 = True
            if t in _조동사: 모름 = True
            else: 동사 = "단" if t in _단수꼴 else "복" if t in _복수꼴 else None
            if t in _기본형 and toks and toks[-1] in _조동사: toks.pop(); 모름 = True
        elif t in ("and", "but", "yet", "or"):
            toks.pop()
            if toks and toks[-1] not in _물건 and toks[-1] not in _이음동사 and toks[-1] not in _한정사: toks.pop()   # 「stays calm and ▁」의 calm
        else: break
    return toks, (None if 모름 else 동사), 있었나


def _꼬리시작(t):
    return t in _꼬리표 or t in _분사 or (len(t) > 4 and t.endswith(("ed", "ing")) and t not in _물건)


def _꾸밈되나(t):
    """물건 앞 꾸밈말로 받는 낱말 — 아는 물건(「door handle」) · 꾸밈씨 · 수량사 · 숫자 · 소유격(「Minjae's」) · 분사(「folded」 · 「sliding」) · 아는 낱말이 든 붙임표 말(「pale-blue」)."""
    if t in _물건 or t in _꾸밈씨 or t in _수량사 or t[0].isdigit() or t.endswith(("'s", "’s")): return True
    if 생물낱말.fullmatch(t): return False
    if "-" in t: return any(x in _꾸밈씨 or x in _물건 for x in t.split("-"))
    return len(t) > 4 and t.endswith(("ed", "ing"))


def _물건덩이(toks, 수=None, 이름꼴=frozenset()):
    """낱말들이 통째로 「물건 주어」인가 — (한정사) 꾸밈말 + 아는 물건 (+ 전치사구 · 분사구) [and 같은 꼴 …]. 머리 낱말이 모르는 낱말이면 물건이 아니다.
    수: 주어 곁 동사의 수 — 덩이가 하나일 때 머리 낱말의 수와 다르면 물건 주어가 아니다(「the other waves and ▁stays still」의 waves는 동사).
    모르는 꾸밈말(「the pull tab」의 pull)은 하나만, 바로 뒤가 머리 낱말일 때만 받는다 — 그 나열이 한정사로 시작하고, 수가 맞고, 동사 꼴(-s · -ing · -ed)도 사람 꼴(-er · -or · -ist …)도 아닐 때.
    「the waiter pours water and ▁stays still」 · 「the director watches monitor and ▁stays still」 · 「the janitor light ▁stays still」 · 「then grabs cup and ▁stands still」은 그래서 물건 주어가 아니다.
    이름꼴(대문자로 시작한 낱말)은 꾸밈말로 받지 않는다. 「a pair of chopsticks」 · 「a row of bottles」는 of 뒤가 머리다.
    그림자 · 비친 모습은 사람의 것(her shadow · Minjae's shadow · the shadow of the man)이면 그 사람이 멈춘 것이다."""
    i, n, 덩이, 모름쓴, 한정있음 = 0, len(toks), [], False, False
    while True:
        여럿 = 소유 = 묶음 = False
        if i < n and (toks[i] in _한정사 or toks[i] in _수량사):
            여럿 = toks[i] in _여럿말; 소유 = toks[i] in _사람소유; 한정있음 = True; i += 1
            if i < n and toks[i] == "of": i += 1
            if i < n and toks[i] in _한정사: 소유 = toks[i] in _사람소유; i += 1
        if i + 1 < n and toks[i] in _묶음말 and toks[i + 1] == "of":
            묶음 = True; i += 2
            if i < n and toks[i] in _한정사: 소유 = toks[i] in _사람소유; i += 1
        먹음, 모름뒤 = [], -1
        while i < n and toks[i] not in ("and", "or"):
            t = toks[i]
            if _꼬리시작(t):
                if 먹음 and 먹음[-1] in _물건: break
                if t in _꼬리표: return False   # 머리 낱말 없이 전치사가 왔다 — 「everyone else in the frame」 · 「Seojin in the foreground」
            if t in _주어대명사 or t in _한정사 or len(먹음) >= 6: return False
            if t.endswith(("'s", "’s")) and t[:-2] not in _물건: 소유 = True   # 「the building's shadow」는 물건의 그림자다
            if 모름뒤 >= 0: 모름뒤 += 1
            if not _꾸밈되나(t):
                if (모름쓴 or not 한정있음 or 수 is None or t in 이름꼴 or 생물낱말.fullmatch(t) or t in _이음동사 or t in _조동사
                        or not re.fullmatch(r"[a-z][a-z-]*", t) or t.endswith(("s", "ing", "ed")) or _사람꼴뒤.search(t)): return False
                모름쓴 = True; 모름뒤 = 0
            elif 모름뒤 > 1: return False   # 모르는 낱말 뒤에는 머리 낱말 하나만 — 「the director watches monitor」는 이름씨 나열이 아니다
            먹음.append(t); i += 1
        if not 먹음 or 먹음[-1] not in _물건: return False
        j = i
        while i < n and toks[i] not in ("and", "or"):
            i += 1
            if i - j > 14: return False
        if 먹음[-1] in _딸린것 and (소유 or any(생물낱말.fullmatch(t) or t in 이름꼴 for t in toks[j:i])): return False
        덩이.append((먹음[-1] in _복수물건, 여럿 or any(t in _여럿말 for t in 먹음[:-1]), 묶음))
        if i >= n: break
        i += 1
        if i >= n: return False
    if len(덩이) == 1:
        복, 여럿, 묶음 = 덩이[0]; 머리수 = "복" if 복 else "단"
        if not 묶음 and ((여럿 and 머리수 == "단") or (수 and 수 != 머리수)): return False
    elif 모름쓴 and 수 != "복": return False
    return True


def _물건머리(toks):
    """낱말들이 물건 주어로 시작하는 절인가 → None(아니다) | "단" | "복"(머리가 복수거나 and로 이은 나열) — (한정사) 꾸밈말 + 아는 물건 [and 같은 꼴] 바로 뒤가 끝 · 아는 동사 · 전치사일 때만.
    물건 뒤에 모르는 낱말이 오면 그 낱말이 주어다(「the shop assistants wait」 · 「the camera operator stands」) — 물건 주어가 아니다."""
    i, n, 복, 덩이수 = 0, len(toks), False, 0
    if not n: return None
    while True:
        if i < n and (toks[i] in _한정사 or toks[i] in _수량사):
            복 = 복 or toks[i] in _여럿말; i += 1
            if i < n and toks[i] == "of": i += 1
            if i < n and toks[i] in _한정사: i += 1
        먹음 = []
        while i < n and len(먹음) < 6 and _꾸밈되나(toks[i]) and not (먹음 and 먹음[-1] in _물건 and toks[i] in _물건동사): 먹음.append(toks[i]); i += 1
        if not 먹음 or 먹음[-1] not in _물건: return None
        덩이수 += 1; 복 = 복 or 먹음[-1] in _복수물건
        if i >= n: break
        if toks[i] in ("and", "or"): i += 1; continue   # 나열 — 다음 것도 물건이어야 한다
        if not (toks[i] in _물건동사 or toks[i] in _이음동사 or toks[i] in _꼬리표 or toks[i] in _조동사): return None
        break
    return "복" if 복 or 덩이수 > 1 else "단"


def _물건으로시작(toks):
    return _물건머리(toks) is not None


def _산것으로시작(조각, toks, 사람만=False):
    """절이 사람 · 동물 · 몸 · 이름 주어로 시작하나 — 첫 동사 앞(낱말 다섯까지)을 본다. 사람만=True면 사람(대명사 · 사람 낱말 · 이름)만 — 동물 · 몸은 빼고 본다."""
    if toks[0] in ("she", "he", "we", "you", "i"): return True
    이름 = _이름꼴(조각)
    for t in toks[:5]:
        if t in _이음동사 or t in _물건동사: break
        if t in 이름 or re.fullmatch(_사람명사, t): return True
        if not 사람만 and (re.fullmatch(_동물명사, t) or re.fullmatch(_몸명사, t)): return True
    return False


def _앞주어(문장들, 그것=False, 여럿만=False):
    """주어가 없는 절 · 대명사 주어(it · they …)가 가리키는 것 — 가까운 절부터 거슬러 본다 → "물건" | "사람" | None(모름).
    물건 주어로 시작하는 절(「the cup lands …」)을 만나면 물건, 사람 · 동물 · 몸 · 이름으로 시작하는 절을 만나면 사람. 「calm」 · 「once open」 같은 짧은 토막은 건너뛴다.
    그것=True(「it」): 사람(she · the woman · Sua)은 「it」으로 받지 않으니 그 절은 물건을 다루는 절로 보고, 동물 · 아기 · 몸으로 시작하는 절만 사람으로 본다.
    여럿만=True(「they」): 복수 머리나 and로 이은 물건 주어만 물건으로 본다 — 「Rain pours off the awning. They barely move.」의 They는 비가 아니다."""
    for 문장 in 문장들:
        for 조각 in reversed(_조각끝.split(문장)):
            toks = _낱말들(_머리말뗌(조각))
            if not toks or toks[0] in ("it", "they", "this", "that", "these", "those", "both"): continue   # 그 대명사의 앞말은 더 앞에 있다
            머리 = _물건머리(toks)
            if 머리: return "물건" if not 여럿만 or 머리 == "복" else None
            if 그것:
                if _그것사람.search(" ".join(toks[:5])): return "사람"   # 「the dog hangs calmly and it ▁stays still」 · 「she lifts her hand and it …」
                if _산것으로시작(조각, toks, 사람만=True): return "물건"   # 「she sets the can down and it ▁stays still」의 it은 사람이 아니다
            elif _산것으로시작(조각, toks): return "사람"
            if len(toks) <= 3 and not (set(toks) & _한정사): continue
            return None   # 주어를 모르는 절
    return None


def _나열에사람(이문장):
    """「The woman, the cup and the bottles ▁stay still」 — 절 앞의 쉼표 토막이 사람 · 몸 · 이름으로 끝나는 짧은 이름씨구(동사 · 전치사 없음)면 나란한 주어다.
    「Behind her, the lamp …」 · 「she lifts the cup, the can …」 · 「one hand on his chest, the can …」은 아니다."""
    for 조각 in reversed(이문장.split(",")):
        toks = _낱말들(조각)
        if not toks: continue
        if len(toks) > 4 or any(t in _전치사 or t in _물건동사 or t in _이음동사 or t in _연기동사집 for t in toks): return False
        if re.fullmatch(_사람명사 + "|" + _가리킴명사 + "|" + _몸명사, toks[-1]) or toks[-1] in _이름꼴(조각): return True
    return False


def _주어판정(절, 앞, 구="", 종류="연기", 사람없음=False):
    """정지 낱말 앞 절의 주어 → "물건" | "사람" | "모름"(드러난 모르는 주어) | "빈"(주어 없는 절) | "그들"(they · both) | "장면"(장면 전체).
    물건: 주어가 아는 물건 덩이(「the door and every sticky note」)거나, 「she lifts the cup and the can ▁stays still」처럼 동사가 있는 절 뒤에 접속사로 이은 물건 주어거나, it이 물건 절을 가리킨다.
      사람 없는 판(사람없음)에서는 주어 없는 절 · they도 앞 절의 물건을 따라간다. 곁 · 카메라 칸의 it과, 같은 칸의 복수 물건을 받는 they도 물건이다.
    사람: 주어에 사람 · 동물 · 몸 낱말이나 이름이 드러나 있다. 물건 나열 앞 쉼표 토막이 사람이어도 사람이다(「The woman, the cup and the bottles ▁stay still」).
    무엇을 걸지는 사람정지낱말이 칸 종류와 판의 상태로 정한다 — 연기 글에서는 물건이 아니면 모두 걸린다."""
    몸통 = _머리말뗌(절)
    toks, 수, 동사있음 = _꼬리뗌(_낱말들(몸통), 구)
    끝들 = [m.end() for m in _문장끝.finditer(앞)]
    이문장 = 앞[(끝들[-1] if 끝들 else 0):len(앞) - len(절)]   # 같은 문장에서 이 절 앞까지
    앞문장 = 앞[(끝들[-2] if len(끝들) > 1 else 0):(끝들[-1] if 끝들 else 0)]
    연기 = 종류 == "연기"
    if not toks:   # 주어 없는 절(「…, perfectly still」 · 문장 첫머리의 「Perfectly still.」 · 「Hold still.」)
        return "물건" if 연기 and 사람없음 and _앞주어([이문장, 앞문장]) == "물건" else "빈"
    if _장면주어(toks, 낱말도=종류 != "카메라"):   # 「then all is still」은 장면, 「all stay still」은 사람들이다
        return "사람" if toks[0] == "all" and 수 != "단" else "장면"
    이름꼴 = _이름꼴(몸통)
    if toks in _그것주어 or (toks[0] == "it" and len(toks) > 1 and (toks[1] in _물건동사 or toks[1] in _이음동사)   # 「it keeps exactly the shape of the first frame and ▁stays still」
                          and not 생물낱말.search(" ".join(toks)) and not (set(toks) & 이름꼴)):
        if not 연기: return "물건"
        가리킴 = _앞주어([이문장, 앞문장], 그것=True)
        return "모름" if 가리킴 != "사람" and _그것산것.search(앞) else (가리킴 or "물건")
    if toks in _그들주어:
        return "물건" if (사람없음 or not 연기) and _앞주어([이문장, 앞문장], 여럿만=True) == "물건" else "그들"
    쉼표뒤 = len(앞) > len(절) and 앞[len(앞) - len(절) - 1] == ","
    if _물건덩이(toks, 수, 이름꼴):
        return "사람" if 쉼표뒤 and _나열에사람(이문장) else "물건"
    for 사이 in ("and", "then", "with"):
        if 사이 not in toks: continue
        k = len(toks) - 1 - toks[::-1].index(사이)
        앞쪽, 뒤쪽 = toks[:k], toks[k + 1:]
        if not 뒤쪽 or not _물건덩이(뒤쪽, 수, 이름꼴): continue
        # 접속사 뒤의 물건이 그 동사의 주어이려면 앞쪽이 절이어야 한다(동사가 있다) — 「she and the bottles ▁stay still」의 she는 나란한 주어다
        if 동사있음 and 사이 != "with" and any(t in _물건동사 or t in _이음동사 or t in _연기동사집 for t in 앞쪽): return "물건"
        if not 생물낱말.search(" ".join(앞쪽)) and not (set(앞쪽) & 이름꼴) and _물건으로시작(앞쪽): return "물건"   # 「the turbine stands with its blades ▁completely still」
    return "사람" if 생물낱말.search(" ".join(toks)) or (set(toks) & 이름꼴) else "모름"


def _꾸밈자리(글, m):
    """「a frozen dumpling」 · 「the frozen pine needles」처럼 이름씨를 꾸미는 자리 → "물건"(걸지 않는다) · "사람"(「an expressionless face」 · 「a motionless portrait shot of the woman」) ·
    "장면"(「a frozen scene」) · None(서술 자리이거나 모르는 이름씨 — 주어를 본다).
    꾸밈 자리는 앞이 한정사 · 꾸밈말 · 전치사거나 절의 첫머리일 때뿐이다 — 「she stands frozen staring at the door」 · 「he stays expressionless the whole shot」처럼 앞이 동사면 서술 자리다.
    「perfectly still」 같은 still 구는 꾸밈 자리로 풀지 않는다(「a perfectly still lake」도 걸린다 — 넣었다가 「she is a perfectly still statue」가 풀려 뺐다)."""
    w = m.group(0).lower()
    if w not in _꾸밈말: return None
    뒤 = re.match(r"[ \t]+((?:[A-Za-z][A-Za-z'’-]*[ \t]*){1,7})", 글[m.end():])
    if not 뒤: return None
    온 = 뒤.group(1).lower().split(); 낱 = 온[:3]
    if 낱[0] in _서술뒤 or 낱[0] in _한정사 or 낱[0].startswith("mid"): return None
    앞낱 = re.search(r"([A-Za-z][A-Za-z'’-]*)[ \t]+$", 글[:m.start()])   # 바로 앞 낱말(사이에 구두점이 없을 때)
    if not 앞낱 and 낱[0].endswith("ing") and 낱[0] not in _물건: return None   # 절 첫머리의 「Frozen staring at the door, she …」
    if 앞낱:
        앞 = 앞낱.group(1).lower()
        if not (앞 in _한정사 or 앞 in _수량사 or 앞 in _꾸밈씨 or 앞 in _전치사 or 앞 in ("and", "or")): return None
    끝 = len(낱)
    for i, t in enumerate(낱):   # 꾸밈받는 이름씨는 전치사 · 접속사 앞까지다 — 「the frozen lake behind her」의 her는 호수를 꾸미는 말이 아니다
        if t in _서술뒤 or t in _꼬리표: 끝 = i; break
    머리, 나머지, 이름들 = 낱[:끝], 온[끝:], _이름꼴(뒤.group(1))
    if w in _늘사람꾸밈 or any(t in _사람것 or 생물낱말.fullmatch(t) for t in 머리) or (set(머리) & 이름들): return "사람"   # 「an expressionless face」 · 「a frozen Sua」
    if 나머지[:1] == ["of"] and (생물낱말.search(" ".join(나머지[1:5])) or (set(나머지[1:5]) & 이름들)): return "사람"   # 「a frozen tableau of the family」
    if any(t in _장면낱말 for t in 머리): return "장면"
    if any(t in _물건 for t in 머리): return "물건"
    # 모르는 이름씨 — 얼린 것은 음식이 흔하다(「frozen yogurt」 · 「frozen berries」), 사람 꼴(「a frozen florist」)이나 다른 꾸밈말이면 주어를 본다
    return "물건" if w == "frozen" and 머리 and not any(_사람꼴뒤.search(t) for t in 머리) else None


def 사람정지낱말(글, 종류="연기", 사람없음=False):
    """글에서 사람에게 정지를 시키는 낱말(소문자 · 겹침 없이 가나다순). 풀어 주는 갈래는 머리 주석 ②의 목록뿐이다.
    종류 "연기"(ACTION · WHO · SHOT 줄 · 모르는 라벨 줄 · 컷표 연기 칸): 주어가 아는 물건이 아니면 모두 건다 — 모르는 낱말 · 이름 · they · 주어 없는 절 · 장면 전체.
    종류 "곁"(LOOK · NOTE · PHYSICS · 머리 글 …): 드러난 모르는 주어만 물건으로 봐 준다. 종류 "카메라"(CAMERA · FRAME): 주어 없는 정지 말도 카메라의 것으로 본다.
    사람없음(사람 없는 판 — 인물 []이거나 사람 기척이 전혀 없는 판): 장면 전체를 멈추는 말과, 곁 칸의 주어 없는 정지 말, 앞 절의 물건을 받는 주어 없는 절 · they를 물건의 것으로 푼다."""
    out = set()
    글 = _대사.sub(lambda q: " " * len(q.group(0)) if re.search(r"[가-힣]", q.group(0)) else q.group(0), 글)   # 따옴표 안 한국어(대사 · 화면 글)는 연기 지시가 아니다 — 길이는 그대로 두고 비운다
    for m in 정지낱말.finditer(글):
        w = re.sub(r"\s+", " ", m.group(0).lower()).strip(" ,")
        앞 = 글[max(0, m.start() - 400):m.start()]
        끝들 = [x.end() for x in _절끝.finditer(앞)]
        절 = 앞[(끝들[-1] if 끝들 else 0):]
        if 정지부정_부사.search(절) or 정지부정_주어.search(절): continue
        if re.match(r"(?:barely|hardly|scarcely) mov", w) and re.search(r"\b(?:lips|mouth)\s*$", 절, re.I): continue   # 「his lips barely moving: "네."」는 말하는 결이다
        꾸밈 = _꾸밈자리(글, m)
        if 꾸밈 == "물건": continue
        if _장면말.match(w) or 꾸밈 == "장면": 주어 = "장면"
        elif 꾸밈 == "사람" or _늘사람.match(w) or _사람말.search(w): 주어 = "사람"
        else: 주어 = _주어판정(절, 앞, w, 종류, 사람없음)
        if 주어 == "물건": continue
        if 주어 == "장면" and (사람없음 or 종류 == "카메라"): continue   # 사람 없는 판의 장면 전체 말은 물건의 것이고, 카메라 칸의 「no other movement」는 카메라의 것이다
        if 주어 == "모름" and 종류 != "연기": continue   # 곁 · 카메라 칸의 드러난 모르는 주어(「PHYSICS: the odd gizmo stays still」)
        if 주어 == "빈" and (종류 == "카메라" or (종류 == "곁" and 사람없음)): continue   # 카메라 칸의 주어 없는 정지 말은 카메라의 것이다
        out.add(w)
    return sorted(out)


def 사람글(글, 칸=None):
    """정지 말을 볼 글 [(이름, 글, 종류)] — "연기": ACTION(샷마다 따로) · WHO · SHOT 줄의 글 · 모르는 라벨 줄(「YUNA:」 · 「END:」), ACTION 칸이 없는 풀어 쓴 지시문의 본문.
    "카메라": CAMERA · FRAME 칸. "곁": 그 밖의 아는 라벨 칸(LOOK · PHYSICS · NOTE …)과 ACTION 칸이 있는 지시문의 머리 글(첫 장 줄 「@이미지 1 is the exact first frame …」도 본다)."""
    칸 = 칸들(글) if 칸 is None else 칸
    act = 연기글(글, 칸)
    out = [("ACTION", t, "연기") for l, t in 칸 if l == "ACTION" and t.strip()]   # 샷마다 따로 — 앞 샷의 절이 뒤 샷 대명사의 앞말이 되지 않는다
    for l, t in 칸:
        if l == "ACTION" or not t.strip(): continue
        if not l: out.append(("본문", t, "곁" if act.strip() else "연기"))
        elif l in ("CAMERA", "FRAME"): out.append((l, t, "카메라"))
        elif l == "WHO" or l.startswith("SHOT") or l not in 아는라벨: out.append((l, t, "연기"))
        else: out.append((l, t, "곁"))
    return out


def 사람판단(글, 인물=None, 칸=None):
    """이 판에 사람이 나오나 → (사람 판인가, 표와 어긋남, 사람 없는 판인가).
    사람 판(→ ACTION 칸 · 사람의 박자를 요구한다): 컷표 그 컷의 「인물」(이나 _순서.json 판의 「인물」)에 이름이 있거나, 글에 확실한 증거(_센증거)가 있다 — ACTION · WHO · SHOT 줄 ·
      사람 이름 줄 · (ACTION 칸 없는 글의) 본문에서. 표가 없는 판은 약한 증거(model · speaker 같은 낱말 · 「이름 + 연기 동사」 · WHO 칸의 글)도 본다.
    표와 어긋남: 인물이 []인데 확실한 증거가 있다(손님 · 행인만 나오는 컷을 []로 적기 쉽다). 약한 증거로는 걸지 않는다 — []라고 밝힌 판을 상품 이름 · 「the new model」로 막지 않게.
    사람 없는 판(→ 장면 전체를 멈추는 말 · 주어 없는 정지 말을 물건의 것으로 푼다): 인물이 []이고 사람 증거(확실한 것 · model 같은 낱말)가 없거나, 표가 없는 판에 사람 증거도
      사람을 가리킬 수 있는 말(_기척 — 대명사 · 사람 낱말 · 몸 낱말 · 이름일 수 있는 낱말)도 하나도 없다. 기척만 있는 판은 박자는 요구하지 않되 정지 말은 사람 판처럼 본다."""
    if isinstance(인물, (list, tuple)) and len(인물): return True, False, False
    칸 = 칸들(글) if 칸 is None else 칸
    부분 = [(l, 사람부정구.sub(" ", t)) for l, t in 칸]
    act = " ".join(t for l, t in 부분 if l == "ACTION")
    who = " ".join(t for l, t in 부분 if l == "WHO")
    샷글 = " ".join(t for l, t in 부분 if l.startswith("SHOT"))
    모르는줄 = [(l, t) for l, t in 부분 if l and l != "ACTION" and l not in 아는라벨 and not l.startswith("SHOT")]
    # 사람 이름 줄(YUNA: · MAN: · SHARK:)만 — 물건 이름 줄(SHIP: · KNIT: · CLEAR UMBRELLA: · CAN_REVEAL:)은 사람을 말해도 그 판에 사람이 나온다는 증거가 아니다
    이름줄 = " ".join(t for l, t in 모르는줄 if not _물건줄(l))
    본문 = "" if act.strip() else 첫장줄.sub(" ", " ".join(t for l, t in 부분 if not l))
    연기 = " ".join((act, 샷글, 본문))
    who없음 = bool(re.search(r"\b(?:no|none|nobody|not any|without|n/a)\b", " ".join(t for l, t in 칸 if l == "WHO"), re.I))   # 「WHO: no people in this shot.」
    센 = _센증거(연기) or _센증거(who) or _센증거(이름줄, 주어만=True)
    if isinstance(인물, (list, tuple)): return 센, 센, not 센 and not _낱말증거(연기, 약한=True)   # 인물 [] — 확실한 증거가 있을 때만 사람 판 · 어긋남, 「the model sits …」가 있으면 사람 없는 판으로 믿지는 않는다
    있음 = 센 or _낱말증거(연기, 약한=True) or _이름연기(연기) or bool(_이름꼴(who)) or (bool(re.search(r"[A-Za-z]", who)) and not who없음)
    return 있음, False, not 있음 and not _기척(" ".join((연기, who, 이름줄)))


def 사람지시문검사(글, 낼판=False, 인물=None, 소리만=False, 박자최소=1):
    """지시문 글 하나 → [(등급, "연기", 글)].
    걸림: 사람을 멈추는 말(still · holds the pose · motionless · frozen · expressionless …) — 어느 칸에서든(사람글 · 사람정지낱말) / 사람이 나오는 판의 ACTION에 사람의 시간 박자
          (몇 초에 · 누가 무엇을)가 없거나 모자란다 / 표는 사람 없는 컷(인물 [])인데 지시문에 사람이 나온다.
    낼판=True(내기 도구 · 이 도구의 --지시문): 사람이 나오는데 ACTION: 칸이 없으면 걸림 — 박자를 볼 칸이 없어 굳은 사람을 낳은 풀어 쓴 지시문이 그대로 나간다. False(꾸러미점검)면 주의.
    주의: 「start from it unchanged」 첫 줄 + 사람 — 시작 자세 첫 줄로 바꾼다(m2v에서 사람을 붙든다).
    인물: 그 판 컷의 인물 목록(컷표 · _순서.json). 소리만=True(목소리 판)는 그림을 쓰지 않으니 보지 않는다.
    박자최소: ACTION에 있어야 할 사람의 시간 박자 수 — 컷표(틀 2)의 인물 컷에 이어진 판은 2(컷표 「연기」가 둘 이상이고 지시문은 그것을 그대로 옮긴다), 그 밖의 사람 판은 1."""
    if 소리만: return []
    칸 = 칸들(글); out = []
    있음, 어긋남, 없음 = 사람판단(글, 인물, 칸)
    if 어긋남: out.append(("걸림", "연기", "컷표에는 사람 없는 컷(인물: [])인데 지시문에 사람이 나온다 — 표의 「인물」 칸을 채우거나 지시문에서 사람을 뺀다(점검표 26)"))
    본 = set()
    for 누구, 부분, 종류 in 사람글(글, 칸):
        for w in 사람정지낱말(부분, 종류, 없음):
            if (w, 누구) in 본: continue
            본.add((w, 누구))
            out.append(("걸림", "연기", f"사람 정지 낱말 「{w}」({누구}) — 숨 · 눈 · 무게 · 손 · 머리칼의 연기 박자로 바꾼다(점검표 26). 물건을 멈추는 말이면 주어(the can · the door)를 밝혀 PHYSICS: 줄에 쓰고, "
                        "사람 없는 판이면 인물을 []로 밝힌다(컷표 · 컷표 없는 편은 _순서.json 그 판)"))
    if not 있음: return out
    act = 연기글(글, 칸)
    if act.strip():   # 박자는 ACTION 칸 안에서, 사람의 것만 센다 — 샷 머리의 「SHOT 1 (0–2 s)」 · CAMERA 줄의 초 · 물건의 박자는 사람 연기의 박자가 아니다
        n = 사람박자수(act)
        if not n:
            out.append(("걸림", "연기", "사람 연기에 시간 박자 없음 — ACTION에 「at about 0.6 s she …」처럼 몇 초에 누가 무엇을 하는지(점검표 26). 사람 없는 컷이면 인물을 []로 밝힌다(컷표 · 컷표 없는 편은 _순서.json 그 판)"))
        elif n < 박자최소:
            out.append(("걸림", "연기", f"사람 연기 박자가 {n}개뿐 — 컷표 「연기」의 박자(둘 이상)를 ACTION에 초와 함께 그대로 옮긴다(범위 「from 0.8 s to 1.6 s」는 한 박자 · 점검표 26)"))
    else:   # ACTION 칸 없이 풀어 쓴 지시문 — 박자를 볼 칸이 없다
        out.append(("걸림" if 낼판 else "주의", "연기", "사람이 나오는데 ACTION: 칸이 없다 — 사람 연기의 시간 박자를 보지 못했다, 지시문 틀대로 ACTION: 줄에 박자를 적는다(점검표 26)"))
    if 시작그대로.search(글):
        out.append(("주의", "연기", "「start from it unchanged」가 사람을 붙든다 — 시작 자세 첫 줄로(26 — 굽기 시트 지시문 틀: 「@이미지 1 shows her starting pose … the picture never holds still」)"))
    return out


# 대사 빠르기(2026-11-18 · 7번 「사랑 한 칸」 1화 앞 30초) — 시댄스는 대사를 초당 4~5자로, 지시한 박자보다 0.5~1.5초 늦게 말한다.
#   원본 컷 길이(평균 1.3초)로 옮긴 콘티는 받은 판을 컷표 구간대로 이으면 대사가 중간에 잘리고(30.5초), 말을 다 들리게 이으면 37.8초가 됐다.
#   11-06 한강 편의 고침(끝나는 초 + 말 빠르기 줄 — 3.9 → 2.3초)이 현장 노트에만 있어 1화 대사 판 37개가 그 줄 없이 나갔다. 그래서 내기 전에 보인다.
#   주의로 둔다 — 이미 빠른 줄은 더 빨라지지 않고, 진행 중인 다른 편의 판을 막지 않으려고. 따옴표 안 한글 8자(약 1.1초)부터 본다. 목소리 판(소리만)은 보지 않는다.
대사따옴 = re.compile(r'["“]([^"”]*[가-힣][^"”]*)["”]')
빠르기줄 = re.compile(r"syllables? (?:per|a) second|in one (?:quick |single )?breath|^\s*PACE\s*:"
                  r"|(?:line|words?|sentence|speaking|speech)\s+(?:is\s+|are\s+)?(?:all\s+|fully\s+)?(?:finished|done|over|ends?|ended)\s+by"
                  r"|finish(?:es|ed)?\s+(?:the\s+(?:whole\s+)?(?:line|sentence)|speaking|the\s+last\s+word)\s+by", re.I | re.M)


def 대사빠르기검사(글, 소리만=False):
    """지시문 글 하나 → [(등급, "대사", 글)]. ACTION 칸(없으면 글 전체)의 따옴표 안 한국어 대사가 8자 이상인데 말 빠르기 줄이 없으면 주의."""
    if 소리만: return []
    act = 연기글(글) or 글
    자 = sum(len(re.findall(r"[가-힣]", m.group(1))) for m in 대사따옴.finditer(act))
    if 자 < 8 or 빠르기줄.search(글): return []
    return [("주의", "대사", f"대사 {자}자에 말 빠르기 줄이 없다 — 시댄스는 초당 4~5자로 늘여 말해 원본 컷보다 길어진다(7번 1화 앞 30초: 컷표 구간 30.5초 → 말을 다 들리게 이으면 37.8초). "
                           "ACTION에 「the whole line finished by 2.2 s」처럼 끝나는 초를, PACE: 줄에 「about seven syllables per second, in one breath, no pause between sentences」를 적는다"
                           "(현장 노트 영상_ffmpeg_자막 「시댄스(드리미나)가 낸 대사가 초당 3~4자로 늘어지고」)")]


# ───────── 컷 사이 순간이동(점검표 41 · 2026-11-18 7번 「사랑 한 칸」) ─────────
# 왜: 「문 앞」 뒤 소품 검사는 상태가 바뀌면 「소품행동」 글이 있는지만 봤다. 7번 컷표는 「내려놓는다」 · 「컷 사이에 든 것으로 본다」를 적어 걸림 0이 됐고,
#   받은 영상에는 그 동작이 없었다(도시락이 손 → 책상 → 손으로 순간이동). 유호님 「반찬통이 갑자기 계속 컷 전환될떄마다 순간이동하고」.
#   그리고 「짧은 시험 판」이라며 굽기 전 검수를 건너뛰고 1,892크레딧을 냈다(진단 사례 short-drama-20261026/검수/진단사례_컷사이_20261118).
# ① 화면 밖에서 일어난다고 적은 소품 동작은 동작이 아니다 — 걸림. ② 광고 · 공모전 · 포트폴리오 편은 판 셋부터 굽기 전 검수 결과가 그 컷을 「그대로」로 본 뒤에만 낸다.
#   편 날짜가 경계부터 이후인 편과 편.경계확인 = "필수"인 편은 걸림, 앞선 편은 주의(진행 중인 다른 편의 판을 막지 않으려고 — T20과 같은 문).
경계부터 = "20261118"
관문분야 = ("광고", "공모전", "포트폴리오")
화면밖동작 = re.compile(r"컷 ?사이에|화면 ?밖에서|(?:한|든|놓은|옮긴|내려놓은|집은|가져온|치운) ?것으로 본다|첫 장에 이미")


def _경계등급(seq, 폴더=None):
    편 = seq.get("편") if isinstance(seq.get("편"), dict) else {}
    날 = 편날짜(seq, 폴더)
    return "걸림" if 편.get("경계확인") == "필수" or (날 is not None and 날 >= 경계부터) else "주의"


def 화면밖소품동작(seq, 폴더=None):
    """컷표 「소품행동」에 화면 밖 · 컷 사이에서 한 것으로 적은 동작 → [(등급, 컷, 글)]."""
    등급 = _경계등급(seq, 폴더); out = []
    for d in seq.get("detail") or []:
        if not isinstance(d, dict): continue
        for prop, 글 in (d.get("소품행동") or {}).items():
            m = 화면밖동작.search(str(글))
            if m:
                out.append((등급, d.get("cut", "?"), f"소품 「{prop}」을 옮기는 동작을 화면 밖에서 한 것으로 적었다(「{m.group(0)}」) — 보이지 않는 동작은 순간이동이다. "
                                                    "그 동작이 보이는 컷을 넣거나, 앞 판 안에서 동작을 끝내 다음 컷이 그 끝에서 시작하게 하거나, 소품 상태를 앞 컷과 같게 둔다(점검표 41)"))
    return out


def 관문결과검사(seq, 표경로, 컷들, 판수):
    """광고 · 공모전 · 포트폴리오 편(편.분야)의 판을 내기 전에 굽기 전 검수(/굽기전검수) 결과가 그 컷을 「그대로」로 봤는지 → [(등급, 글)].
    결과는 <편>/검수/굽기전_*/결과.json(나중 결과가 앞 결과를 덮는다 · 「다시」 포함). 검수 뒤에 그 컷의 시작 그림이 바뀌었으면 본 것이 아니다.
    판 둘 이하(첫 시험 · 다시 낸 한두 판)는 주의, 셋부터 걸림(편 날짜 문은 _경계등급)."""
    편 = seq.get("편") if isinstance(seq.get("편"), dict) else {}
    폴더 = Path(표경로).resolve().parent
    분야 = str(편.get("분야") or "").strip()
    if 분야 not in 관문분야:
        if not 분야 and _경계등급(seq, 폴더) == "걸림":
            return [("주의", f"컷표 「편」에 「분야」가 없다 — {' · '.join(관문분야)} · SNS · 기타 가운데 하나를 적는다(광고 · 공모전 · 포트폴리오는 굽기 전 검수를 거친 뒤에 낸다)")]
        return []
    컷들 = [c for c in dict.fromkeys(컷들) if c]
    if not 컷들: return []
    판정, 때 = {}, {}
    for f in sorted(폴더.glob("검수/굽기전_*/결과.json")):   # 폴더 이름(굽기전_YYYYMMDD-HHmm) 순서 = 시각 순서 — 나중 것이 덮는다
        try:
            r = json.loads(f.read_text(encoding="utf-8-sig"))
        except Exception:
            continue
        for x in r.get("컷별") or []:
            if isinstance(x, dict) and x.get("cut"):
                판정[x["cut"]] = str(x.get("판정") or ""); 때[x["cut"]] = f.stat().st_mtime
    det = {d.get("cut"): d for d in seq.get("detail") or [] if isinstance(d, dict)}
    못봄, 고칠것, 바뀜 = [], [], []
    for c in 컷들:
        if c not in 판정:
            못봄.append(c); continue
        if 판정[c] != "그대로":
            고칠것.append(f"{c}({판정[c]})"); continue
        그림 = str((det.get(c) or {}).get("시작그림") or "")
        p = Path(그림) if 그림 and Path(그림).is_absolute() else 폴더 / 그림
        if 그림 and p.exists() and p.stat().st_mtime > 때[c]:
            바뀜.append(c)
    if not (못봄 or 고칠것 or 바뀜): return []
    등급 = "주의" if 판수 <= 2 else _경계등급(seq, 폴더)
    말 = []
    if 못봄: 말.append(f"굽기 전 검수가 보지 않은 컷 {' · '.join(못봄)}")
    if 고칠것: 말.append(f"검수가 고치라고 한 컷 {' · '.join(고칠것)}")
    if 바뀜: 말.append(f"검수 뒤에 시작 그림이 바뀐 컷 {' · '.join(바뀜)}")
    return [(등급, f"{분야} 편은 굽기 전 검수가 「그대로」로 본 컷만 판 셋 이상으로 낸다 — {' / '.join(말)}. "
                  "제작 세션이 검수 세션에 「/굽기전검수 [다시] <편> <컷…>」을 넘기고 고칠 표를 고친 뒤 낸다(판 둘 이하 첫 시험은 주의로 지나간다 · 11-18 7번 「사랑 한 칸」)")]


# ───────── 지시문 검수(11-25 유호님 「지시문도 자체 검수자가 있어야할것같아 … 그래야 영상만들때 토큰을 낭비하지않을테니까」) ─────────
# 왜: 받은 뒤 · 마감에서 다시 구운 까닭의 절반은 굽기 전에 지시문 글에서 이미 보였다(youthup C03 「other felt children」 한 마디 → 배경 아이가 바뀜,
#   C05 「노란 모자가 튀어나온다」 → 다른 사람이 나옴, C07 「his left」 → 고개가 반대로). 뜻을 읽어야 보이는 자리라 정규식으로 가르지 않고
#   맥락 없는 검수자(.claude/agents/video-prompt-review.md)가 지시문 흠 표(docs/마케팅/제작양식/영상양식/지시문_흠표.md)로 판마다 본다. 이 검사는 그 결과가 있는지만 본다.
# 결과: <편>/검수/지시문검수_*/결과.json(tools/지시문검수판.py 적기가 쓴다). 지금 글과 지문이 같은 가장 나중 기록의 판정이 「그대로」인 판만 낸다.
# 편 날짜가 지시문검수부터 이후인 편과 편.경계확인 = "필수"인 편은 걸림, 앞선 편은 주의(진행 중인 편의 판을 막지 않는다), 날짜를 못 읽는 편은 보지 않는다.
지시문검수부터 = "20261125"


def 지시문지문(글):
    """지시문 글 → 열여섯 자 지문. 줄끝(CRLF · LF) · 줄 끝 빈칸 · 앞뒤 빈 줄은 지문에 넣지 않는다 — 검수가 본 글과 낼 글이 같은지만 본다."""
    import hashlib
    줄 = [l.rstrip() for l in str(글 or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return hashlib.sha256("\n".join(줄).strip().encode("utf-8")).hexdigest()[:16]


def 지시문검수기록(폴더):
    """편 폴더 → {판 id: [(지문, 판정, 결과 파일 시각)]} — 폴더 이름(지시문검수_YYYYMMDD-HHmm) 순서가 시각 순서라 나중 기록이 앞에 온다. 못 읽은 결과는 건너뛴다."""
    기록 = {}
    for f in sorted(Path(폴더).glob("검수/지시문검수_*/결과.json"), key=lambda p: p.parent.name, reverse=True):
        try: r = json.loads(f.read_text(encoding="utf-8-sig")); 때 = f.stat().st_mtime
        except (OSError, ValueError): continue
        판 = r.get("판") if isinstance(r, dict) else None
        if not isinstance(판, dict): continue
        for 이름, x in 판.items():
            if isinstance(x, dict) and isinstance(x.get("지문"), str):
                기록.setdefault(str(이름), []).append((x["지문"], str(x.get("판정") or ""), 때))
    return 기록


def 지시문검수결과검사(seq, 폴더, 판들):
    """판들: [(판 id, 지시문 글, 컷들)] — 틀 2 컷표에 이어진 판(소리만 · 프리비즈는 넣지 않는다). → [(등급, 판 id, 글)].
    판마다 지금 글과 지문이 같은 가장 나중 기록의 판정이 「그대로」이고 그 뒤에 컷의 시작 · 끝 그림이 바뀌지 않았으면 지나간다.
    그런 기록이 없으면 「검수 안 받음」, 다른 지문만 있으면 「검수 뒤 글이 바뀜」 — 검수자는 그 글과 그 그림을 함께 보고 판정했다."""
    if not 판들: return []
    편 = seq.get("편") if isinstance(seq.get("편"), dict) else {}
    날 = 편날짜(seq, 폴더)
    if 편.get("경계확인") == "필수" or (날 is not None and 날 >= 지시문검수부터): 등급 = "걸림"
    elif 날 is not None: 등급 = "주의"   # 11-24까지 시작해 진행 중인 편 — 막지 않고 알린다
    else: return []   # 날짜를 못 읽는 편(편 폴더 이름 끝 _YYYYMMDD도 「편.만든날」도 없는 옛 편 · 시험 표)은 보지 않는다
    기록 = 지시문검수기록(폴더)
    det = {d.get("cut"): d for d in seq.get("detail") or [] if isinstance(d, dict)}

    def 바뀐그림(컷들, 때):
        out = []
        for c in 컷들:
            for 칸 in ("시작그림", "끝그림"):
                v = (det.get(c) or {}).get(칸)
                if 빈칸(v): continue
                p = Path(str(v)); p = p if p.is_absolute() else Path(폴더) / p
                if p.is_file() and p.stat().st_mtime > 때: out.append(f"{c} {칸}")
        return out
    out = []
    for 이름, 글, 컷들 in 판들:
        지문 = 지시문지문(글); 있음 = 기록.get(str(이름)) or []
        맞음 = next(((g, t) for f지문, g, t in 있음 if f지문 == 지문), None)
        if 맞음 and 맞음[0] == "그대로":
            바뀐 = 바뀐그림(컷들 or [], 맞음[1])
            if not 바뀐: continue
            왜 = f"지시문 검수 뒤에 그림이 바뀌었다({' · '.join(바뀐)}) — 그 판만 다시 받는다(tools/지시문검수판.py 판 <편> --판 {이름})"
        elif 맞음: 왜 = f"지시문 검수가 「{맞음[0]}」으로 봤다 — 결과.json의 고칠 문장대로 고친 뒤 그 판만 다시 받는다"
        elif 있음: 왜 = f"지시문 검수 뒤에 글이 바뀌었다 — 바뀐 판만 다시 받는다(tools/지시문검수판.py 판 <편> --판 {이름})"
        else: 왜 = "지시문 검수를 받지 않았다"
        out.append((등급, str(이름), f"{왜}. 굽기 전에는 지시문 검수자(에이전트 video-prompt-review)가 「그대로」로 본 판만 낸다 — docs/마케팅/제작양식/영상양식/지시문_흠표.md(11-25)"))
    return out


def 굽기전검사(지시문글, 실내=None, 인물=None, 소리만=False, 박자최소=1):
    """내기 도구(크레딧내기.py · 드리미나내기.py)가 내기 전에 부른다 — 지시문검사(물건 · 실내) + 사람지시문검사(정지 낱말 · 박자 · ACTION 칸 · 시작 첫 줄) + 대사빠르기검사.
    → [(등급, 글)], 등급은 "걸림" · "주의". 컷표가 없어도 돈다. 걸림이 하나라도 있으면 내지 않는다. 인물 · 소리만 · 박자최소는 사람지시문검사와 같다(판정보가 판마다 정한다)."""
    if not 지시문글.strip(): return [("걸림", "지시문이 비었다")]
    return [(등급, f"({항목}) {말}") for 등급, 항목, 말 in 지시문검사(지시문글, 실내) + 사람지시문검사(지시문글, 낼판=True, 인물=인물, 소리만=소리만, 박자최소=박자최소)
            + 대사빠르기검사(지시문글, 소리만=소리만)]


def 판정보(판, seq=None):
    """_순서.json 판 한 줄(+ 컷표) → 그 판의 컷 이름들 · 인물 · 소리만 · 실내 · 프리비즈 · 박자최소. 내기 도구 · --지시문 · 꾸러미점검이 같은 함수를 쓴다.
    컷들: 판의 「컷」(이름이나 목록 — 대안 판 C2b는 "컷": ["C2"])이 컷표의 컷 이름이면 그것, 아니면 판 id(판 id = 컷 이름 · <편>-<컷> · 컷의 「판」)나 판 폴더 이름(001_C1 → C1)으로 찾는다.
    인물: 틀 2 컷표에서 그 컷들의 「인물」을 모은 것, 컷을 못 찾았으면 판의 「인물」(목록 — 컷표 없는 편에서 사람이 나오는 판 · 안 나오는 판을 밝힐 때), 둘 다 없으면 None(글에서 짐작).
    소리만: 「방식」이 「목소리 판」이거나 「소리만」: true — 그림을 쓰지 않는 판이라 컷표에 없어도 되고 사람 연기도 보지 않는다.
    프리비즈: 판 id가 pv + 숫자 · 붙임표로 시작(pv5-08-1) — 움직임을 참고 영상에서 받는 판이라 지시문 검사를 건너뛴다.
    박자최소: ACTION에 있어야 할 시간 박자 수 — 틀 2 컷표의 사람 컷에 이어진 판은 2, 그 밖은 1."""
    판id = 판.get("id")
    소리만 = 판.get("방식") == "목소리 판" or 판.get("소리만") is True
    폴더 = re.sub(r"^\d+_", "", str(판.get("폴더") or ""))
    컷들 = (판의컷(seq, 판id, 판.get("컷")) or (판의컷(seq, 폴더) if 폴더 else [])) if seq else []
    인물 = 판.get("인물") if isinstance(판.get("인물"), list) else None
    실내컷 = {d["cut"] for d in (seq or {}).get("detail", []) if d.get("실내")}
    if 컷들 and 틀둘(seq):
        목록 = [d.get("인물") for d in seq.get("detail") or [] if d.get("cut") in 컷들]
        if 목록 and all(isinstance(x, list) for x in 목록): 인물 = list(dict.fromkeys(n for x in 목록 for n in x if isinstance(n, str)))
    실내 = True if (판.get("실내") is True or any(c in 실내컷 for c in 컷들)) else (False if 판.get("실내") is False else None)
    박자최소 = 2 if (컷들 and 틀둘(seq) and 인물) else 1   # 컷표에 이어진 사람 판 — 표의 「연기」 박자(둘 이상)가 ACTION에 옮겨졌는지
    return dict(컷들=컷들, 인물=인물, 소리만=소리만, 실내=실내, 프리비즈=bool(re.match(r"pv[\d-]", str(판id or ""))), 박자최소=박자최소)


def 지시문판들(경로들):
    """꾸러미 폴더(_순서.json 또는 */지시문.txt) · 글 파일 → [{"id": 판 id, "컷": 컷 이름, "파일", "글", "남길것", "판": _순서.json의 그 판 줄(없으면 {"id"})}]"""
    out = []
    for p in map(Path, 경로들):
        if p.is_dir():
            순서 = p / "_순서.json"
            if 순서.exists():
                for x in json.loads(순서.read_text(encoding="utf-8")):
                    f = p / x["폴더"] / "지시문.txt"
                    sid = str(x.get("id", ""))
                    cut = sid.rsplit("-", 1)[-1] if "-" in sid else re.sub(r"^\d+_", "", x["폴더"])
                    out.append(dict(id=sid or cut, 컷=cut, 파일=f, 글=f.read_text(encoding="utf-8") if f.exists() else "", 남길것=x.get("남길 것", ""), 판={**x, "id": sid or cut}))
            else:
                for f in sorted(p.glob("*/지시문.txt")) + sorted(p.glob("*.txt")):
                    cut = re.sub(r"^\d+_", "", f.parent.name if f.name == "지시문.txt" else f.stem)
                    out.append(dict(id=cut, 컷=cut, 파일=f, 글=f.read_text(encoding="utf-8"), 남길것="", 판={"id": cut}))
        else:
            cut = re.sub(r"^\d+_", "", p.stem)
            out.append(dict(id=cut, 컷=cut, 파일=p, 글=p.read_text(encoding="utf-8"), 남길것="", 판={"id": cut}))
    return out


def 지시문파일들(경로들):
    """꾸러미 폴더(_순서.json 또는 */지시문.txt) · 글 파일 → [(컷 이름, 파일, 글, 남길 것)]"""
    return [(x["컷"], x["파일"], x["글"], x["남길것"]) for x in 지시문판들(경로들)]


# ───────── 결과 모으기 ─────────
항목순서 = ("틀", "편집", "소품", "사건", "소리", "지시문", "연기", "그림지시문", "방향", "점", "고요", "지도", "빛", "색감", "얼굴")   # 「연기」는 --지시문이 함께 내는 사람 연기 줄(따로 고르지 않는다) · 「편집」은 옛 틀 표의 같은 판 잇달아 자르기(틀 항목이 함께 낸다) · 「방향」은 --그림지시문이 함께 낸다(점검표 43)
기본항목 = ("틀", "소품", "사건", "소리", "지시문", "그림지시문", "점", "고요", "지도", "빛", "색감", "얼굴")


class 결과:
    def __init__(self):
        self.항목들 = []

    def 더함(self, 항목, 컷, 등급, 글, **값):
        x = dict(항목=항목, 컷=컷, 등급=등급, 글=글)
        if 값: x["값"] = 값
        self.항목들.append(x)

    def 코드(self):
        # 주의 · 알림은 끝 코드를 바꾸지 않는다(알림: 옛 틀 컷표처럼 「이 검사는 돌지 않았다」를 알리는 줄)
        if any(x["등급"] == "걸림" for x in self.항목들): return 1
        if any(x["등급"] == "확인" for x in self.항목들): return 2
        return 0

    def 보고(self):
        표시 = {"걸림": "✗", "확인": "?", "주의": "~", "통과": "✓", "알림": "·"}
        for 항목 in 항목순서:
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
    if 사건들 == []: r.더함("사건", "표", "통과", "이 편에는 쪼갤 사건이 없다고 표에 밝혔다(사건: [])"); return
    if 사건들 is None:   # 칸이 없을 때만 「표가 없다」다 — 목록이 아닌 값은 비어 보여도({} · false · 0 · "") 아래에서 걸린다(11-21 GPT 다시 검수)
        r.더함("사건", "표", "확인", "사건 표가 없다 — 사건(처음 하는 일 · 망설임 · 놀람 · 건넴 · 발견)마다 넓게 · 감정 · 행동 · 결과 컷을 적는다(없으면 사건: [] · 점검표 33)"); return
    if not isinstance(사건들, list):   # 꼴 관문 없이 도는 실행(--항목 사건)에서도 말없이 지나가지 않는다(11-21 GPT 다시 검수 GA3)
        r.더함("사건", "표", "걸림", f"「사건」은 목록으로 적는다 — 지금은 {컷표읽기().꼴이름(사건들)}이다(없으면 사건: [])"); return
    시각, 적힌 = {}, {}   # 「A11」은 첫 토막, 「A11#2」는 둘째 토막. 시각은 수로 읽은 값(못 읽으면 None), 적힌은 표에 적힌 그대로(보이는 글)
    for d in det:
        if not isinstance(d, dict) or not isinstance(d.get("cut"), str): continue
        n = sum(1 for k in 시각 if k.startswith(d["cut"] + "#")) + 1
        t = 유한수(d.get("t"))   # 숫자를 적은 글도 수로 견준다 — 날것을 견주면 글 순서로 정렬하거나 죽는다(11-21 GPT 검수 GA4 · GA5)
        for k in (d["cut"], f"{d['cut']}#{n}"):
            if k not in 시각: 시각[k] = t; 적힌[k] = d.get("t")
    for i, ev in enumerate(사건들):
        if not isinstance(ev, dict):   # 틀린 줄은 걸림으로 남기고 읽을 수 있는 줄은 계속 본다
            r.더함("사건", "표", "걸림", f"사건 {i + 1}번째 줄이 객체({{\"이름\": …}})가 아니다 — 지금은 {컷표읽기().꼴이름(ev)}이다"); continue
        이름 = ev.get("이름", "?")
        if ev.get("압축"):
            r.더함("사건", 이름, "통과", "압축 몽타주 — 네 박을 묻지 않는다"); continue
        박 = {k: ev.get(k) for k in ("넓게", "감정", "행동", "결과")}
        빠짐 = [k for k, v in 박.items() if not (isinstance(v, str) and v)]
        없는컷 = [f"{k}={v}" for k, v in 박.items() if k not in 빠짐 and v not in 시각]
        못읽음 = [f"{k}={v}" for k, v in 박.items() if k not in 빠짐 and v in 시각 and 시각[v] is None]
        if 빠짐: r.더함("사건", 이름, "걸림", f"네 박 가운데 {' · '.join(빠짐)} 컷이 없다 — 넓게 → 감정 클로즈 → 행동 클로즈 → 결과(점검표 33)")
        if 없는컷: r.더함("사건", 이름, "걸림", f"컷순서에 없는 컷을 가리킨다: {' · '.join(없는컷)}")
        if 못읽음: r.더함("사건", 이름, "걸림", f"{' · '.join(못읽음)} — 이 컷의 「t」(시작 시각)를 읽을 수 없어 네 박의 순서를 못 본다. 「t」를 초(수)로 적는다")
        if not 빠짐 and not 없는컷 and not 못읽음:
            ts = [시각[박[k]] for k in ("넓게", "감정", "행동", "결과")]   # 결과까지 순서를 본다(11-09 Astra)
            if ts != sorted(ts): r.더함("사건", 이름, "걸림", "순서가 넓게 → 감정 → 행동 → 결과가 아니다(" + " · ".join(f"{박[k]} {적힌[박[k]]}s" for k in ("넓게", "감정", "행동", "결과")) + ")")
            else: r.더함("사건", 이름, "통과", f"넓게 {박['넓게']} → 감정 {박['감정']} → 행동 {박['행동']} → 결과 {박['결과']}")


def 유한수(v):
    """숫자()로 읽은 값이 유한한 수면 그 수, 아니면 None(NaN · Infinity는 시각이 아니다)"""
    x = 숫자(v)
    return x if x is not None and x == x and x not in (float("inf"), float("-inf")) else None


def 컷시각(d, 칸, 기본=None):
    """컷 줄의 시각 칸(t · dur · in · out)을 수로 읽는다 — 영상 · 받은 판을 재는 항목이 쓴다. 칸이 없고 기본이 있으면 기본.
    읽을 수 없으면(참 · 거짓 · 글 · NaN · 아주 큰 수 · 없음) ValueError — 재는 자리의 except가 그 컷의 「확인」으로 낸다.
    날것으로 셈하면 false가 0초로 읽혀 엉뚱한 프레임을 그 컷의 값으로 적는다(11-21 GPT 다시 검수 — 꼴 관문이 돌지 않는 실행에서도 막는다)."""
    v = d.get(칸)
    if v is None and 기본 is not None: return 기본
    x = 유한수(v)
    if x is None: raise ValueError(f"컷 줄의 「{칸}」를 읽을 수 없다({'없음' if v is None else repr(v)[:20]}) — 초(수)로 적는다")
    return x


def 컷구간(d):
    """받은 판에서 그 컷이 쓰는 구간 (in, out) — 「in」이 없으면 0, 「out」이 없으면 in + dur. 읽을 수 없으면 ValueError(컷시각)"""
    a = 컷시각(d, "in", 0.0)
    return a, (컷시각(d, "out") if d.get("out") is not None else a + 컷시각(d, "dur"))


def 반응시각(seq, ev):
    if ev.get("반응t") is not None:   # 적어 둔 값은 그대로 읽는다 — 읽을 수 없으면 반응 컷으로 바꿔 읽지 않고 걸림이다(11-21 GPT 다시 검수 GA2)
        rt = 유한수(ev.get("반응t"))
        return (rt, f"{ev['반응t']}s") if rt is not None else (None, "「반응t」를 읽을 수 없다 — 초(수)로 적는다")
    cut = ev.get("반응"); n = 1
    if ev.get("반응번째") is not None:   # 안 적었을 때만 첫 토막이다. 적었으면 1부터 세는 정수이고 그 토막이 있어야 한다
        x = 유한수(ev.get("반응번째"))
        if x is None or x < 1 or x != int(x): return None, f"「반응번째」는 1부터 세는 정수로 적는다 — 지금은 {ev.get('반응번째')!r}"
        n = int(x)
    tokes = [d for d in seq.get("detail") or [] if isinstance(d, dict) and d.get("cut") == cut]
    if not tokes or n > len(tokes): return None, f"컷 {cut} 없음" + (f"(토막 {len(tokes)}개 — {n}번째 토막이 없다)" if tokes else "")
    t = 유한수(tokes[n - 1].get("t"))
    if t is None: return None, f"컷 {cut}의 「t」(시작 시각)를 읽을 수 없다"
    return t, f"{cut} 시작 {tokes[n - 1]['t']}s"


def 소리표검사(seq, r, 간격=(0.6, 1.0), 영상=None):
    사건들 = seq.get("소리사건")
    if 사건들 == []: r.더함("소리", "표", "통과", "이 편에는 반응을 부르는 소리 사건이 없다고 표에 밝혔다(소리사건: [])"); return
    if 사건들 is None:   # 칸이 없을 때만 「표가 없다」다 — 목록이 아닌 값은 비어 보여도 아래에서 걸린다
        r.더함("소리", "표", "확인", "소리 사건 표가 없다 — 노크 · 초인종 · 전화처럼 반응을 부르는 소리마다 t와 반응 컷을 적는다(없으면 소리사건: [] · 점검표 42)"); return
    if not isinstance(사건들, list):   # 꼴 관문 없이 도는 실행(--항목 소리)에서도 말없이 지나가지 않는다(11-21 GPT 다시 검수 GA3)
        r.더함("소리", "표", "걸림", f"「소리사건」은 목록으로 적는다 — 지금은 {컷표읽기().꼴이름(사건들)}이다(없으면 소리사건: [])"); return
    def 간격판정(이름, t, rt, 어디, 출처):
        d = round(rt - t, 3)   # 0.6 − 1e-16 같은 소수 오차로 정상 간격이 걸리지 않게(11-09 Astra)
        if d < 0: r.더함("소리", 이름, "걸림", f"{출처}반응({어디})이 소리({t:.2f}s)보다 {-d:.2f}초 먼저다 — 소리를 반응보다 {간격[0]}~{간격[1]}초 먼저 둔다(점검표 42)")
        elif d < 간격[0]: r.더함("소리", 이름, "걸림", f"{출처}소리({t:.2f}s) → 반응({어디}) 간격 {d:.2f}초 — {간격[0]}초보다 짧다, 소리를 앞당긴다(점검표 42)")
        elif d > 간격[1]: r.더함("소리", 이름, "확인", f"{출처}소리({t:.2f}s) → 반응({어디}) 간격 {d:.2f}초 — {간격[1]}초보다 길다, 반응이 늦어 보이지 않는지 본다")
        else: r.더함("소리", 이름, "통과", f"{출처}소리 {t:.2f}s → 반응 {어디} 간격 {d:.2f}초")
    for i, ev in enumerate(사건들):
        if not isinstance(ev, dict):   # 틀린 줄은 걸림으로 남기고 읽을 수 있는 줄은 계속 본다
            r.더함("소리", "표", "걸림", f"소리사건 {i + 1}번째 줄이 객체({{\"이름\": …}})가 아니다 — 지금은 {컷표읽기().꼴이름(ev)}이다"); continue
        이름 = ev.get("이름", "?"); t = 유한수(ev.get("t"))
        if t is None:   # 꼴이 틀려 지워졌거나 안 적은 시각 — 대괄호로 읽다 죽지 않고 그 줄의 걸림으로 낸다(11-21 GPT 검수 GA5)
            r.더함("소리", 이름, "걸림", "소리 사건의 「t」(소리가 나는 시각)를 읽을 수 없다 — 초(수)로 적는다(점검표 42)"); continue
        rt, 어디 = 반응시각(seq, ev)
        if rt is None: r.더함("소리", 이름, "걸림", f"반응 자리를 못 찾음 — {어디}"); continue
        간격판정(이름, t, rt, 어디, "표: ")
        if 영상 is not None and not ev.get("소리없음"):
            봉 = 소리봉우리(영상, t)
            if 봉 is None: r.더함("소리", 이름, "확인", "소리 줄을 못 읽음")
            elif 봉["차이dB"] < 6: r.더함("소리", 이름, "걸림", f"{t}s 둘레에서 소리가 안 튄다(봉우리 {봉['봉우리dB']:.1f} dBFS · 바탕 {봉['바탕dB']:.1f} dBFS · 차이 {봉['차이dB']:.1f} dB) — 소리 사건이 섞음에 없거나 다른 시각이다")
            else:
                r.더함("소리", 이름, "통과", f"{t}s 소리 봉우리 {봉['봉우리dB']:.1f} dBFS(바탕보다 {봉['차이dB']:.1f} dB 위, 봉우리 {봉['봉우리t']:.2f}s · 시작 {봉['시작t']:.2f}s)")
                if abs(봉["시작t"] - t) > 0.05: 간격판정(이름, 봉["시작t"], rt, 어디, "실제 소리로: ")   # 표의 시각이 아니라 실제로 소리가 시작한 시각으로 다시 잰다(11-09 Astra)


# ───────── 컷표 「틀 2」 표 검사(콘티 단계 · 2026-11-10) ─────────
# 왜 있나: 되풀이된 지적(사람이 굳음 · 컷마다 빛 · 배경이 바뀜 · 같은 구도 컷을 잇달아 붙임 · 끝에 제품이 안 보임 · 글자가 기본 글꼴)은 규칙 문서가 안 읽혀서가 아니라
#   콘티에 그 칸이 없어서 샜다 — 칸을 표로 적게 하고 비면 걸리게 한다. 괄호 번호는 docs/마케팅/제작양식/광고영상_슬롭점검표.md의 줄 번호다.
글자종류 = ("말자막", "강조", "이름", "끝로고", "장면속", "정보")
글꼴로침 = re.compile(r"기본 ?글꼴|화면 ?글꼴|회사 ?글꼴|글꼴로 ?(?:침|친|쳐|쳤)|(?<![A-Za-z])(?:SUIT|Inter)(?![A-Za-z])")
# 글꼴 이름을 안 썼어도 화면 위에 조판해 얹은 글(11-11 서울로 끝 제목 「서울남산체로 조판해 원근 합성」 · 연도 꼬리표 HTML)은 글꼴로 친 것과 같다(점검표 7 · 46).
# 같은 글에서 얹는 말 뒤에 장면과 한 장으로 구웠다는 말이 오면 지나간다 — 「글꼴 윤곽으로 조판한 원고를 참고로 넣어 굽는다」(점검표 46의 막는 법)는 걸지 않는다.
얹어침 = re.compile(r"조판|얹|합성|오버레이|자막 ?도구|텍스트로|(?<![A-Za-z])(?:HTML|overlay)(?![A-Za-z])", re.I)   # 「텍스트로」 앞에 낱말 경계를 두지 않는다 — 「일반텍스트로 입력」도 얹은 것이다(다섯째 회차 GA1). 「컨텍스트로」가 걸리는 것은 걸림 쪽이라 둔다
정보얹어침 = re.compile(r"조판|얹|합성|오버레이|(?<![A-Za-z])(?:HTML|overlay)(?![A-Za-z])", re.I)   # 정보 글은 자막 도구로 치는 것이 제자리다 — 화면 위에 조판 · 합성해 얹는 것만 주의로 알린다
# 부정 판정은 두 쪽 다 걸림 쪽으로 기운다(11-16 GPT 검수 세 회차 뒤 Fable 설계 검토로 바꿈 — 한 가지 부정 규칙을 두 쪽에 같이 쓰니 고칠 때마다 다른 쪽이 샜다).
#   ① 얹는 말(조판 · 얹 · 합성 · HTML · 자막 도구 · 텍스트로)과 글꼴 말은 그 말에 바로 붙은 부정만 부정으로 센다 —
#      그 말 + (글자 · 것 · 작업 같은 이름씨) + (조사) + (하다 · 쓰다 · 넣다 · 치다 같은 풀이씨 + 는) + 부정, 또는 앞의 「안 · 못」.
#      「합성하지 않음」 · 「합성 없이」 · 「합성은 하지 않고」 · 「HTML을 사용하지 않고」 · 「얹지 않고」 · 「HTML 대신」 · 「기본 글꼴로 치지 않는다」는 부정이고,
#      「HTML로 합성해 그림자 없이」 · 「합성, 그림자 없이」의 「없이」는 다른 것의 부정, 「말고는 · 없이는 · 않으면 · 않고는 · 아니면」은 조건이라 부정이 아니다.
#      「HTML 오버레이는 쓰지 않는다」처럼 얹는 말이 잇달아 오면 앞 말은 뒤 말의 부정을 물려받는다.
#   ② 굽는 말(굽 · 그린 · 장면과 한 장)은 그 말부터 절 끝(쉼표 · 마침표 · 줄표)까지 부정이 없고, 앞에 「안 · 못」이 없을 때만 센다 —
#      「굽지 않고 HTML로 합성」 · 「그려 넣는 대신 HTML로 합성」은 구운 것이 아니다.
#      편 날짜가 「시안부터」 이후인 컷표(엄격)는 굽는 말이 마지막으로 살아 있는 얹는 말보다 뒤에 와야 센다 — 「구운 그림 위에 조판해 합성」도 건다
#      (한국어는 풀이씨가 끝에 와서, 굽는 말이 끝에 와야 그 글의 만드는 법이다). 이미 만든 컷표(서울로 「…으로 굽는다. 화면에 얹은 꼬리표는 버림」)는 이 순서를 보지 않는다.
#   두 쪽 모두 애매하면 걸린다. 걸린 글은 참고 원고를 앞에, 「장면과 한 장으로 굽는다」를 끝에 두어 고쳐 쓰면 지나간다(시안 칸이 따로 실제 파일을 본다).
#   멈춤 기준(Fable 설계 검토 11-16): 이 고침 뒤에도 자유 글 판정에서 P1이 또 나오면 정규식을 넓히지 말고 만드는법을 정해진 낱말 칸으로 바꾼다(날짜 문은 「시안부터」를 같이 쓴다).
_바로부정끝 = (r"(?:지\s*(?:는|도|를)?\s*(?:않(?!으면|고는)|말|마|못)"
          r"|\s*(?:않(?!으면|고는)|못|없이(?!는)|없음|없다|말고(?!는)|대신|금지|아님|아니(?!면)|빼고|뺀|버림|버린|안 ?(?:씀|쓴|쓰|함|한|해|하)))")
얹음부정 = re.compile(r"(?:는|은|을)?(?:\s*(?:글자|글씨|로고|것|게|작업|방식))?(?:\s*(?:을|를|은|는|도|이|가|로|으로|에))?(?:\s*(?:사용|이용|작업)?(?:하|되|쓰|써|넣|올리|치)(?:는|은)?)?" + _바로부정끝)
글꼴부정 = 얹음부정   # 「화면 글꼴 대신 그린 글자」 · 「SUIT 말고」 · 「기본 글꼴로 치지 않는다」는 글꼴로 친 것이 아니다(11-16부터 10자 창 대신 바로 붙은 부정 — 「SUIT로 쳐서 테두리 없이」가 새던 것)
얹음이음 = re.compile(r"\s*(?:로|으로|과|와|및|·|이나|나|또는)?\s*$")   # 얹는 말 둘 사이가 이것뿐이면 한 덩이(「HTML 오버레이」 · 「HTML로 합성」 · 「HTML이나 합성 없이」)
# 「안 · 못」은 홑낱말일 때만 부정이다 — 「시안 합성본」의 「시안 」, 「잘못 구운」의 「잘못」은 부정이 아니다(11-16 GPT 검수 넷째 회차 GA1)
절안부정 = re.compile(r"[^,.;·—\n]*?(?:않|(?<![가-힣])못|아님|아니|말고|대신|금지|없이|없음|없다|빼고|뺀|버림|버린|(?<![가-힣])안 ?(?:씀|쓴|쓰|함|한|해|하))")
앞부정 = re.compile(r"(?<![가-힣A-Za-z0-9])(?:안|못)\s?$")
장면에구움 = re.compile(r"굽|구워|구움|구운|구웠|그린(?! ?스크린)|그려|그림 단계|장면과 한 ?장|세트 안")   # 「그린스크린 합성」은 그린 글자가 아니다
# 시안 칸(11-16 흠 장부 「자주 하신 지적」 7번): 강조 · 이름 · 끝로고 · 장면속 글자는 실제 장면 위에 얹은 시안 둘 이상을 먼저 만든다(점검표 7 · 22 · 24 · 46).
#   11-11 서울로 끝 제목은 「니 판단하에 정해서」를 듣고 시안을 건너뛰어 기각됐다. 그 걸음이 있었는지를 파일이 있는지로 본다.
#   편 날짜(편 폴더 이름 끝 _YYYYMMDD — tools/lib/음악층관문.js · 올리기 전 검사 ⑮의 선례, 없으면 컷표 「편.만든날」)가 시안부터 이후인 컷표에만 건다.
#   날짜를 못 읽으면 걸지 않는다(이미 만든 컷표를 덮지 않게). 표만 볼 때는 주의, --영상(편집 · 마감 관문판)으로 볼 때는 걸림이다.
시안종류 = ("강조", "이름", "끝로고", "장면속")
시안부터 = "20261117"
# 연기 박자의 한국어 정지 낱말 — 좁게: 「가만히 서 있다」 · 「멈춘 채(로) 바라본다」 · 「그대로 서 있다」 · 「그 자리에 서 있다」 · 「자세 · 포즈를 유지한다」 · 「꼼짝 않는다」 · 「멈춰 있다」 ·
#   「표정 없이 바라본다」 · 「미동이 없다」 · 「움직임이 없다」는 걸고, 「숨을 멈춘다」 · 「걸음을 멈추고 돌아본다」 · 「굳은 표정으로 고개를 든다」 · 「가만히 서 있다가 돌아선다」 ·
#   「그대로 서둘러 나간다」 · 「자세를 낮춘다」 · 「무표정하던 얼굴이 풀린다」는 걸지 않는다(뒤에 「…다가」 · 「…던」이 오면 이어지는 동작이다).
#   「움직이지 않는다」 · 「움직임이 없다」는 바로 앞의 주어(은 · 는 · 이 · 가가 붙은 낱말 — 사이에는 「조금도」 · 「전혀」 같은 부사만)가 아는 물건일 때만 걸지 않는다(「냄비는 조금도 움직이지 않고 수아가 젓가락을 든다」) —
#   주어가 없거나 모르는 낱말(「학생이」 · 「손님들은」) · 인물 이름이거나 사람과 나란히 놓였거나(「수아와 컵은」) 주어가 딴 절의 것이면(「문이 닫힌 뒤에도 움직이지 않는다」) 건다(11-10 넷째 · 다섯째 검수).
_이어짐 = r"(?![^.,;]{0,6}(?:다가|던 ))"
연기정지_한 = re.compile(r"(?:가만히|꼼짝(?:도)? ?(?:않고|없이)|멈춘 채|굳은 채|얼어붙은 채|정지한 채)(?:로)?(?: 그대로)? ?(?:서|앉|바라|있|누워|기다)" + _이어짐
                      + r"|(?:그대로|그 자리에) (?:서 ?있|앉아 ?있|누워 ?있|멈춰 ?있|굳어 ?있)" + _이어짐
                      + r"|멈춰 선 채|멈춰 ?(?:서 ?)?있" + _이어짐 + r"|(?:굳어|얼어붙어) ?있" + _이어짐
                      + r"|정지(?:한 채| 자세| 상태|해 있)|무표정(?!하던|이던|했던)|표정 ?없이|표정이 없다|표정 없는 얼굴로|미동(?:도|이)? ?없|움직임(?:이)? ?없(?:이|다|는)|움직이지 않(?:는다|고 |은 채)"
                      r"|꼼짝(?:도)? ?(?:않는|않은|안 ?한|안 ?하|하지 않)|(?:자세|포즈)(?:를|로)? ?(?:그대로 ?)?(?:유지|지킨|지키|버틴|버티)")
_한주어 = re.compile(r"((?:[가-힣A-Za-z]+(?:와|과|랑|이랑|하고)\s+)*)([가-힣A-Za-z]+?)(?:들)?(?:은|는|이|가)\s+(?:(?:조금도|전혀|여전히|그대로|끝까지|계속|아직|더는|더 이상|꼼짝도|아예|하나도|[가-힣A-Za-z]+\s+(?:위|안|옆|앞|뒤|밑|아래|속|곁|가운데)에(?:서)?|[가-힣A-Za-z]+에서)\s+)*$")   # 정지 말 바로 앞의 주어(나란히 놓인 낱말까지) — 사이에는 부사와 자리 말(「탁자 위에서」)만
# 아는 물건(한국어) — 사람 · 몸으로도 읽히는 낱말(눈 · 등 · 다리 · 배 · 머리 · 발 · 팬)은 넣지 않는다. 「…들」은 떼고 본다
_한물건 = set("""냄비 주전자 프라이팬 컵 잔 머그 병 캔 그릇 접시 쟁반 젓가락 숟가락 포크 칼 뚜껑 상자 박스 봉지 봉투 가방 우산 문 창문 창 커튼 블라인드 의자 탁자 테이블 책상 식탁 소파 침대
 책 공책 종이 메모 펜 연필 시계 램프 조명 전등 등불 불빛 빛 촛불 카메라 화면 배경 벽 바닥 천장 그림자 물 물방울 김 연기 증기 얼음 국물 면 라면 밥 음식 음료 커피 우유 주스 맥주 케이크 빵 과자
 사과 귤 달걀 자동차 차 버스 기차 지하철 자전거 바퀴 공 꽃 꽃잎 나무 나뭇잎 잎 돌 구름 하늘 바다 파도 비 빗방울 눈송이 간판 포스터 스티커 사진 액자 거울 휴대폰 폰 전화기 노트북 키보드 리모컨
 선풍기 인형 장난감 로고 글자 자막 제품 상품 패키지 포장 라벨 풍선 깃발 현수막 터빈 날개 기계 엘리베이터 에스컬레이터 신호등 가로등 건물 집 도로 길 다리미 냉장고 세탁기 텔레비전 모니터""".split())


def 빈칸(v):
    return v is None or (isinstance(v, str) and not v.strip())


def 숫자(v):
    """표의 초 칸 — 숫자(참 · 거짓은 아님)나 숫자 글이면 float, 아니면 None"""
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)):
        try: return float(v)
        except OverflowError: return None   # 실수로 옮기지 못하는 아주 큰 정수 — 읽을 수 없는 값으로 본다(11-21 GPT 다시 검수 GA5)
    if isinstance(v, str):
        try: return float(v.strip())
        except (ValueError, OverflowError): return None
    return None


def 한칸(s):
    """공백 여러 칸 · 줄바꿈을 한 칸으로 — 표의 문장이 지시문에 글자 그대로 들었는지 견줄 때"""
    return re.sub(r"\s+", " ", str(s)).strip()


def 구도정리(s):
    return re.sub(r"[\s·•ㆍ‧∙・,/]+", "", str(s)).lower()


def 틀둘(seq):
    return isinstance(seq, dict) and 숫자(seq.get("틀")) == 2


def 연기정지낱말(글, 이름들=()):
    """컷표 「연기」 박자 글에서 사람을 멈추는 낱말 — 한국어는 좁게(연기정지_한), 영어는 지시문과 같은 낱말(사람정지낱말).
    「움직이지 않는다」 · 「움직임이 없다」는 바로 앞의 주어가 아는 물건일 때만 넘긴다. 이름들: 그 편 인물 표의 이름 — 물건 낱말과 같은 이름(「구름」)도 사람이다."""
    out = []
    for m in 연기정지_한.finditer(글):
        w = m.group(0)
        if w.startswith(("움직이지 않", "움직임")):
            앞 = 글[:m.start()]
            주어 = _한주어.search(앞)
            낱들 = ([re.sub(r"(?:와|과|랑|이랑|하고)$", "", x) for x in 주어.group(1).split()] + [주어.group(2)]) if 주어 else []
            if 낱들 and all(re.sub(r"들$", "", x) in _한물건 and x not in 이름들 and re.sub(r"들$", "", x) not in 이름들 for x in 낱들): continue   # 바로 앞의 주어가 물건이다 — 사람 정지가 아니다
        out.append(w)
    return list(dict.fromkeys(out + 사람정지낱말(글)))   # 이 칸은 사람 컷의 연기다 — 연기 글 규칙 그대로


def 글꼴로쳤나(법, 엄격=False):
    if any(not 글꼴부정.match(법[m.end():]) for m in 글꼴로침.finditer(법)): return True
    return 얹었나(법, 엄격)


def 얹었나(법, 엄격=False, 말=None):
    """만드는법에 화면 위에 조판 · 합성해 얹었다는 말이 있고(부정문이 아니고), 장면과 한 장으로 구웠다는 말은 없나 — 두 판정 모두 애매하면 걸림 쪽(위 머리말 ① · ②).
    엄격(편 날짜가 시안부터 이후): 굽는 말이 마지막으로 살아 있는 얹는 말 뒤에 와야 센다."""
    얹는말 = list((말 or 얹어침).finditer(법))
    살았나 = [False] * len(얹는말)
    for i in range(len(얹는말) - 1, -1, -1):   # 뒤에서부터 — 잇달아 온 얹는 말은 뒤 말의 판정을 물려받는다
        m = 얹는말[i]
        if i + 1 < len(얹는말) and 얹음이음.match(법[m.end():얹는말[i + 1].start()]):
            살았나[i] = 살았나[i + 1]
        else:
            살았나[i] = not 얹음부정.match(법[m.end():]) and not 앞부정.search(법[:m.start()])
    산것 = [m for m, s in zip(얹는말, 살았나) if s]
    if not 산것: return False
    끝 = 산것[-1].end() if 엄격 else 0
    구움 = any(m.start() >= 끝 and not 절안부정.match(법[m.end():]) and not 앞부정.search(법[:m.start()]) for m in 장면에구움.finditer(법))
    return not 구움


def 편날짜(seq, 폴더=None):
    """컷표의 편 날짜(YYYYMMDD) — 편 폴더(컷표가 든 폴더와 그 위 두 층) 이름 끝의 _YYYYMMDD, 없으면 「편.만든날」(YYYY-MM-DD · YYYYMMDD). 못 읽으면 None"""
    if 폴더 is not None:
        d = Path(폴더)
        for _ in range(3):
            if d.name == "마케팅": break
            m = re.search(r"_(\d{8})$", d.name)
            if m: return m.group(1)
            if d.parent == d: break
            d = d.parent
    편 = seq.get("편") if isinstance(seq.get("편"), dict) else {}
    m = re.fullmatch(r"\s*(\d{4})-?(\d{2})-?(\d{2})\s*", str(편.get("만든날") or ""))
    return "".join(m.groups()) if m else None


def _파일내용열쇠(p):
    """시안 파일의 내용 열쇠(크기 + sha256) — 경로가 달라도 같은 그림이면 같은 열쇠다"""
    import hashlib
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for 조각 in iter(lambda: f.read(1 << 20), b""): h.update(조각)
    return (Path(p).stat().st_size, h.hexdigest())


def 시안목록(g):
    """글자 줄의 「시안」(글 하나 · 목록) → 경로 목록. 같은 그림을 두 번 적은 것(역슬래시 · 앞의 ./ · 대소문자만 다름)은 하나로 센다"""
    v = g.get("시안")
    v = [v] if isinstance(v, str) else v if isinstance(v, list) else []
    out, 본것 = [], set()
    for x in v:
        if not isinstance(x, str) or not x.strip() or _그림열쇠(x) in 본것: continue
        본것.add(_그림열쇠(x)); out.append(x.strip())
    return out


def 장면실내채움(seq):
    """틀 2 — 장면 표의 「실내」를 그 장면을 쓰는 컷에 옮겨 적는다(컷에 실내 · 실외를 따로 적었으면 그것을 따른다).
    기존 실내 검사(점 시트 · 지시문의 실내 눈 걸림 · 표빈칸)가 컷의 실내 칸을 보기 때문이다. 옛 틀 표는 건드리지 않는다."""
    if not 틀둘(seq) or not isinstance(seq.get("detail"), list): return seq
    장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    for d in seq["detail"]:
        if not isinstance(d, dict) or d.get("실내") is not None or d.get("실외") is not None: continue   # 객체가 아닌 줄은 표 검사의 뼈대 검사가 건다. null은 칸이 없는 것과 같다
        s = 장면표.get(d.get("장면")) if isinstance(d.get("장면"), str) else None
        if isinstance(s, dict) and s.get("실내") is True: d["실내"] = True
        elif isinstance(s, dict) and s.get("실내") is False: d["실외"] = True
    return seq


# ───────── 빛 이름(2026-11-11 — 팁 장부 47행 「조명효과 기억해」 · 점검표 60) ─────────
# 왜 있나: 장면의 「빛」 칸이 자유 글이라 「a large soft light falls on his face from the front」 같은 평평한 앞빛이 그대로 나갔다(로맨스 옛 시작 그림의 얼굴 좌우빛 0.131 · 원본 0.289).
#   장면마다 빛을 이름(docs/마케팅/제작양식/영상양식/빛이름.json의 34개 가운데 한둘)으로 부르고, 옆빛 이름이면 키 빛이 오는 쪽을 문장에 적게 한다.
#   앞에서 고르게 비추는 말은 앞빛 이름(High key · Butterfly · Flat light)을 고른 장면에서만 지나간다 — 부정문(「no fill from the front」)도 걸리니 그늘 쪽을 긍정문으로 쓴다.
#   사람 없는 컷도 장면의 빛 줄을 그대로 쓰니, 그런 컷이 있는 장면의 빛 줄에 사람 낱말(her · face)이 있으면 건다(몸이 들어온다 — 지시문 틀 이미지 7).
#   풀어 주는 갈래는 늘리지 않는다(영상작업_진단_20261110.md의 교훈 — 실물이 잘못 걸릴 때만, 시험 · 변이 시험과 함께).
빛이름표경로 = Path(__file__).resolve().parent.parent / "docs" / "마케팅" / "제작양식" / "영상양식" / "빛이름.json"
_빛표캐시 = None
# 키 빛이 오는 쪽을 적은 말 — 옆(왼쪽 · 오른쪽)과 뒤 · 위 · 아래
_빛쪽 = re.compile(r"\b(?:her|his|their|its|camera|frame|screen|stage|viewer(?:['’]s)?)[- ]+(?:left|right)\b|\b(?:left|right)(?:[- ]hand)?[- ]+(?:side|edge|half|of|window|wall|corner|third)\b"
                  r"|\b(?:from|to|on|at)\s+(?:the\s+|her\s+|his\s+|their\s+)?(?:far\s+|near\s+)?(?:left|right)\b|\b(?:front|back|rear|upper|lower|top|bottom)[- ](?:left|right)\b"
                  r"|\bfrom (?:the|one) side\b|\bto one side\b|\bside[- ]?lit\b|\b\d{2,3}\s*(?:degrees?|°)|왼쪽|오른쪽", re.I)
_빛뒤위 = re.compile(r"\bbehind\b|\bback[- ]?lit\b|\bbacklight(?:ing)?\b|\babove\b|\boverhead\b|\bbelow\b|\bbeneath\b|\bunderneath\b|뒤에서|위에서|아래에서|역광", re.I)
# 앞에서 고르게 비추는 말 — 표의 빛 문장은 통째로 빛 이야기라 「from the front」만으로 건다. 「from the front-left」는 비스듬한 옆빛이라 걸지 않는다(실물 3판 — 가쁨 p5-15 · 결채 p4-33)
_앞빛_표 = re.compile(r"\bfrom\s+(?:the\s+|directly\s+|straight\s+)?(?:in\s+)?front\b(?![- ](?:left|right))|\bfront(?:al)?[- ]?(?:light(?:ing|s)?|lit|fill|key)\b|\bfrontlit\b|\bevenly[- ]lit\b"
                     r"|\beven(?:ly)?\s+(?:light(?:ing|ed)?|illuminat(?:ed|ion))\b|\bflat,?\s+(?:even\s+)?light(?:ing)?\b|\bflatly[- ]lit\b", re.I)
# 지시문의 다른 줄(표의 빛 줄 밖) — 「from the front」는 카메라 자리로도 쓰이니 빛 낱말과 한 절에 있을 때만 건다
_앞빛_글 = re.compile(r"\bfront(?:al)?[- ]?(?:light(?:ing|s)?|lit|fill)\b|\bfrontlit\b|\bevenly[- ]lit\b|\beven(?:ly)?\s+(?:light(?:ing|ed)?|illuminat(?:ed|ion))\b|\bflat,?\s+(?:even\s+)?light(?:ing)?\b|\bflatly[- ]lit\b"
                     r"|\b(?:lights?|lighting|lit)\b[^.;:\n]{0,40}?\bfrom\s+(?:the\s+|directly\s+|straight\s+)?(?:in\s+)?front\b(?![- ](?:left|right))", re.I)
# 다시 얹을 화면 · 간판 자리를 고르게 칠한 초록 판(「a flat, evenly lit chroma-green panel」 — 점검표 27 · 39의 방법)은 얼굴 빛이 아니다(실물 12판 — 캐스팅북 p8 · 가쁨 p5-16)
_크로마뒤 = re.compile(r"[^.;:\n]{0,30}?\b(?:chroma|green[- ]?screen)", re.I)
_빛사람말 = re.compile(r"\b(?:she|he|her|hers|his|him)\b|\b(?:faces?|cheeks?|nose|chin|forehead)\b", re.I)


def 빛이름표():
    """빛 이름 표 → ({"이름": {소문자 이름: 줄}, "앞빛허용": {소문자 이름}, "좌우문턱": 0.2}, None). 못 읽으면 (None, 까닭)."""
    global _빛표캐시
    if _빛표캐시 is None:
        try:
            raw = json.loads(빛이름표경로.read_text(encoding="utf-8"))
            줄들 = {str(x["이름"]).strip().lower(): x for x in raw["이름"] if isinstance(x, dict) and not 빈칸(x.get("이름"))}
            if not 줄들: raise ValueError("이름이 하나도 없다")
            _빛표캐시 = ({"이름": 줄들, "앞빛허용": {str(n).strip().lower() for n in raw.get("앞빛허용") or []}, "좌우문턱": 숫자(raw.get("좌우문턱")) or 0.2}, None)
        except Exception as e:
            _빛표캐시 = (None, f"{빛이름표경로.name}: {e}")
    return _빛표캐시


def 빛이름들(장면):
    """장면 표 한 줄의 「빛이름」 → 이름 목록(글 하나로 적어도 받는다)."""
    v = 장면.get("빛이름") if isinstance(장면, dict) else None
    if isinstance(v, str): v = [v]
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def 빛이름검사(이름, 장면, 사람있음, 사람없는컷, 표):
    """T16 — 장면 한 줄의 빛 이름 · 빛 문장 → [(등급, 글)]. 빈 빛 문장은 T1이 건다."""
    import difflib
    out = []; 문장 = 장면.get("빛"); 이름들 = 빛이름들(장면); 줄들 = []
    if not 이름들:
        out.append(("걸림" if 사람있음 else "주의", f"장면 「{이름}」의 「빛이름」 칸이 비었다 — 빛 이름 표(영상양식/빛이름.json)에서 한둘을 골라 적는다(60)"))
    for n in 이름들:
        줄 = 표["이름"].get(n.lower())
        if 줄 is None:
            가까운 = difflib.get_close_matches(n.lower(), list(표["이름"]), n=2, cutoff=0.6)
            out.append(("걸림", f"장면 「{이름}」의 빛 이름 「{n}」이 빛 이름 표에 없다" + (f"(「{' · '.join(표['이름'][k]['이름'] for k in 가까운)}」?)" if 가까운 else "") + " — 영상양식/빛이름.json의 이름으로 적는다(60)"))
        elif 줄.get("대신"):
            out.append(("걸림", f"장면 「{이름}」의 빛 이름 「{줄['이름']}」은 지시문에 쓰지 않는다 — {' · '.join(줄['대신'])}로 적는다(60)"))
        else: 줄들.append(줄)
    if len(이름들) > 3: out.append(("주의", f"장면 「{이름}」의 빛 이름이 {len(이름들)}개다 — 한둘만 고른다(60)"))
    if 빈칸(문장) or not 줄들: return out
    문장 = str(문장)
    if 사람있음:
        허용 = any(줄["이름"].lower() in 표["앞빛허용"] for 줄 in 줄들)
        앞 = _앞빛_표.search(문장)
        if 앞 and not 허용:
            out.append(("걸림", f"장면 「{이름}」의 빛 문장에 앞에서 고르게 비추는 말 「{앞.group(0)}」 — 얼굴이 평평해진다(60). 키 빛을 옆 · 뒤에 두고, 일부러 고른 앞빛이면 빛이름에 High key · Butterfly · Flat light 가운데 하나를 적는다"))
        방향 = [줄["이름"] for 줄 in 줄들 if 줄.get("방향") is True]
        if 방향 and not 허용 and not (_빛쪽.search(문장) or _빛뒤위.search(문장)):
            out.append(("걸림", f"장면 「{이름}」의 빛 이름 「{' · '.join(방향)}」은 키 빛의 쪽이 있어야 한다 — 빛 문장에 어느 쪽에서 오는지(from the left of the frame · behind · above …) 적는다(60)"))
        if any(줄["이름"] == "Flat light" for 줄 in 줄들):
            out.append(("주의", f"장면 「{이름}」의 빛 이름이 Flat light다 — 일부러 고른 컷(정보 · 제품 기록 · 패러디)인지 본다(60)"))
    if 사람없는컷:
        m = _빛사람말.search(문장)
        if m: out.append(("걸림", f"장면 「{이름}」의 빛 문장에 사람 낱말 「{m.group(0)}」 — 사람 없는 컷({' · '.join(str(c) for c in 사람없는컷)})도 이 줄을 그대로 쓴다(몸이 들어온다). 쪽을 화면 기준(from the left of the frame)으로 쓰거나 장면을 나눈다(60)"))
    return out


def 빛판정(이름들, 문장, 값, 표):
    """잰 얼굴 빛 값과 장면의 빛 이름 · 문장 → (등급, 글). 옆빛 이름이고 문장에 옆쪽(왼쪽 · 오른쪽)이 적혔는데 좌우빛이 문턱 아래면 「확인」 — 평평한 앞빛으로 나왔는지 사람이 본다.
    위아래 · 색 · 역광은 값만 적는다(문턱은 받은 판 세 편으로 값을 모은 뒤 정한다 — 참고 카드 2026-11-07_조명34_빛이름)."""
    줄들 = [표["이름"][n.lower()] for n in 이름들 if n.lower() in 표["이름"]]
    허용 = any(줄["이름"].lower() in 표["앞빛허용"] for 줄 in 줄들)
    옆 = [줄["이름"] for 줄 in 줄들 if "좌우" in (줄.get("잣대") or [])]
    요약 = f"좌우 {값['좌우']:.3f} · 위아래 {값['위아래']:+.3f} · 색 {값['색']:.1f}" + (f" · 역광 {값['역광']:.2f}" if 값.get("역광") is not None else "")
    if 옆 and not 허용 and _빛쪽.search(str(문장 or "")):
        if 값["좌우"] < 표["좌우문턱"]:
            return "확인", f"얼굴 좌우빛 {값['좌우']:.3f} — 옆빛 이름({' · '.join(옆)})인데 문턱 {표['좌우문턱']:g} 아래다, 평평한 앞빛으로 나왔는지 본다(60 — 로맨스 옛 판 0.131 · 원본 0.289). {요약}"
        return "통과", f"옆빛 이름({' · '.join(옆)}) · {요약}"
    return "알림", f"빛 이름({' · '.join(이름들) or '없음'}) — 값만 적는다: {요약}"


# ───────── 같은 시작 그림(50) · 되풀이 탈것 · 소품 한 줄(51) — 2026-11-12 서울로 애니 보완 판 ─────────
# 왜 있나: 전 컷을 다시 구운 판에서 1970 버스가 컷마다 파랑 · 빨강으로 바뀌고(그림 지시문마다 버스 색을 따로 적었다), 같은 시작 그림에서 영상을 두 번 뽑은 컷이 두 군데 있었다
#   (잘 안 나온 컷을 이웃 컷의 다른 판으로 메웠다). 컷표 검사는 통과했다 — 이 둘을 보는 칸이 없었다(유호님 「버스 색이 달라 … 똑같은 장면이 반복되는부분이 몇장면 있어」).
#   ① T17: 컷마다 「시작그림」을 적는다. 서로 다른 두 컷이 같은 시작 그림(이름이 달라도 같은 파일) · 같은 받은 영상(「판」)을 쓰면 걸린다 — 한 판을 일부러 이어 쓰는 컷은 같은판: "<까닭>".
#      같은 컷 이름의 토막(A11 · A11#2)은 한 컷이라 보지 않는다. --그림 <폴더>를 주면 칸이 빈 컷은 <폴더>/<컷>.png로 견주고, --지시문 <꾸러미>를 주면 판 폴더의 시작 그림 파일(1_시작.*)도
#      견준다(같은 컷의 대안 판끼리는 지나간다).
#   ② T18: 되풀이해 나오는 탈것(두 컷부터) · 소품(세 컷부터)은 맨 위 「소품」 표에 한 줄(낱말 · 색 · 생김새 · 기준그림) — 없으면 걸린다. --그림지시문을 주면 그 소품이 나오는 컷의 지시문에
#      생김새 문장이 글자 그대로 들었는지(인물 옷과 같은 대조 · 걸림), 그 이름씨에 표에 없는 색이 붙었는지(확인 — 표는 cream and cobalt-blue인데 「vermilion bus」), 표에 줄이 없는 탈것 낱말의
#      색이 컷마다 다른지(확인) 본다. 색은 그 이름씨에 붙은 것만 센다(앞의 꾸밈말 · 바로 뒤 괄호 · 「painted …」 · 「with a … band」) — 같은 문장의 하늘 · 벽 색은 세지 않는다.
#   풀어 주는 갈래는 늘리지 않는다 — 실물 지시문이 잘못 걸릴 때만 시험(걸려야 할 옛 판 · 지나가야 할 새 판)과 함께 고친다.
_색목록 = ("red crimson scarlet vermilion vermillion maroon burgundy orange amber yellow gold golden mustard saffron lemon green olive lime emerald teal turquoise cyan aqua mint "
          "blue cobalt navy azure indigo purple violet lilac lavender magenta pink rose coral salmon peach brown tan beige khaki cream ivory white black grey gray silver charcoal bronze copper rust").split()
_색같음 = {"vermillion": "vermilion", "gray": "grey", "golden": "gold"}
_색한 = r"(?<![A-Za-z])(?:" + "|".join(sorted(_색목록, key=len, reverse=True)) + r")(?![A-Za-z])"
_색낱말 = re.compile(_색한, re.I)
_색꾸밈 = r"(?:(?:bright|dark|pale|light|deep|soft|faded|dull|glossy|matte|warm|cool|two-tone|solid|off)[\s-]+)*"
_색줄 = rf"{_색꾸밈}{_색한}(?:(?:\s*(?:,|/|&|-|and)\s*|\s+){_색꾸밈}{_색한})*"
# 이름씨 바로 뒤에 붙은 색 — 괄호(「bus (cream and cobalt blue, rounded roof)」) · 이은 말(「bus, cream and blue,」 · 「bus — vermilion red with one cream band」 · 「bus is red」 · 「bus painted cream」 ·
#   「bus in cream and blue livery」) · 그 뒤의 「with …」 줄에서 몸의 부분 앞에 놓인 색(「bus with a cream roof and cream window band and a cobalt-blue lower body」).
# 색 줄 뒤가 끊기는 자리일 때만 받는다 — 「the bus, red brick warehouses behind it」 · 「the bus in red light」 · 「the bus with a red-coated conductor」의 색은 버스의 색이 아니다
_뒤괄호 = re.compile(r"\s*\(([^)\n]{0,160})\)")
_뒤색 = re.compile(rf"(?:\s*,\s*|\s+[—–-]\s+|\s+(?:is|are|was|were)\s+(?:(?:painted|colou?red|sprayed)\s+)?(?:in\s+)?|\s+(?:painted|colou?red|sprayed)\s+(?:in\s+)?|\s+in\s+)({_색줄})(?=\s*(?:[,.;:)\n—–]|$|(?:with|and|livery|paint(?:work)?|colou?rs?)\b))", re.I)
_뒤와 = re.compile(r"\s*,?\s*with\s+([^,.;:()\n—–]{0,160})", re.I)
_몸색 = re.compile(rf"({_색줄})\s+(?:[\w-]+\s+){{0,2}}?(?:bands?|stripes?|body|bodywork|roof|livery|paint(?:work)?|panels?|trim|sides?|front|half|top|bottom|skirt|doors?|hood|fenders?|bumpers?)\b", re.I)
_색만 = re.compile(rf"\s*(?:(?:and|or)\s+)?{_색줄}\s*$", re.I)
_구멈춤 = set(("a an the one this that these those each every another its his her their our your my two three four five six several some many any both all no "
               "of on in at by with from to into onto under over behind beside below above near past through across toward towards along around between as like than while when where which who").split())
_없다앞 = re.compile(r"(?:\bno|\bwithout(?:\s+(?:any|a|an|the))?|\bnot\s+(?:a|an|any)|\bnever\s+(?:a|an|any))\s+(?:[\w'’-]+\s+){0,5}$", re.I)   # 「there is no red or vermilion bus anywhere」
_소품없음 = (None, "화면밖", "없음")
_탈것이름 = re.compile(r"버스|택시|기차|열차|전철|지하철|전차|트램|자동차|승용차|트럭|자전거|오토바이|스쿠터|킥보드|보트|비행기|마차|수레")
# 표에 줄이 없어도 그림 지시문에서 찾아보는 탈것 낱말 — 좁게(plane · ship · van · cab · cart처럼 다른 뜻이 흔한 낱말은 넣지 않는다)
_탈것낱말 = ("bus", "minibus", "tram", "streetcar", "trolleybus", "taxi", "car", "truck", "lorry", "jeep", "bicycle", "bike", "motorcycle", "motorbike", "scooter", "train", "boat", "ferry", "rickshaw")


def 낱말정규식(낱말들):
    """소품 줄의 「낱말」(지시문에서 그것을 부르는 영어 이름씨) → 정규식. 복수형(-s · -es)까지 읽고, 「bus stop」 · 「train station」 같은 시설 이름과 「minibus」 같은 다른 낱말은 뺀다."""
    alts = "|".join(re.escape(w) for w in sorted(낱말들, key=len, reverse=True))
    return re.compile(rf"(?<![A-Za-z-])(?:{alts})(?:e?s)?(?![A-Za-z])(?![ -](?:stops?|stations?|shelters?|lanes?|routes?|terminals?|depots?|tickets?|signs?|stands?|ranks?|parks?|racks?|tracks?|platforms?)\b)", re.I)


def _앞구(글, s):
    """이름씨 자리 s 앞의 꾸밈말 — 구두점을 넘지 않고 한정사 · 전치사에서 멈춘다(많아야 일곱 낱말): 「a vermilion and cream city bus」 → 「vermilion and cream city」.
    쉼표로 늘어놓은 색(「solid blue, solid red and solid green flat-fronted buses」)은 앞 토막이 색뿐일 때만 거슬러 올라가 받는다."""
    토막 = re.split(r"[.;:()\n—–!?\"“”「」]", 글[max(0, s - 120):s])[-1].split(",")
    out, 멈춤 = [], False
    for t in reversed(토막[-1].split()[-7:]):
        if t.lower().strip("'’") in _구멈춤: 멈춤 = True; break
        out.append(t)
    구 = " ".join(reversed(out))
    if not 멈춤:
        for 앞토막 in reversed(토막[:-1]):
            if not _색만.match(앞토막): break
            구 = f"{앞토막.strip()}, {구}"
    return 구


def 붙은색들(글, 정규식):
    """글에서 그 이름씨에 붙은 색 낱말 → (색 집합, [색이 붙은 구절], 그 이름씨가 나온 수). 「no bus」처럼 없다고 한 자리는 세지 않는다."""
    색, 구절, n = set(), [], 0
    for m in 정규식.finditer(글):
        if _없다앞.search(글[max(0, m.start() - 40):m.start()]): continue
        n += 1
        앞 = _앞구(글, m.start()); 뒤 = 글[m.end():m.end() + 240]; 조각 = [앞]; 뒤끝 = 0
        g = _뒤괄호.match(뒤) or _뒤색.match(뒤)
        if g: 조각.append(g.group(1)); 뒤끝 = g.end()
        w = _뒤와.match(뒤[뒤끝:])
        if w:
            몸 = [x.group(1) for x in _몸색.finditer(w.group(1))]
            if 몸: 조각 += 몸; 뒤끝 += w.end()
        찾음 = [_색같음.get(c.lower(), c.lower()) for 조 in 조각 for c in _색낱말.findall(조)]
        if 찾음:
            색.update(찾음); 구절.append(한칸(f"{앞} {m.group(0)}{뒤[:뒤끝]}")[:90])
    return 색, 구절, n


def 소품표줄(seq):
    """맨 위 「소품」 표 → {이름: 줄}. 「소품: []」(이어 볼 소품이 없다고 밝힌 편)와 표가 없는 편은 {}."""
    v = seq.get("소품") if isinstance(seq, dict) else None
    return {k: x for k, x in v.items() if isinstance(k, str)} if isinstance(v, dict) else {}


def 소품낱말(줄):
    """소품 줄의 「낱말」 → 목록(글 하나에 쉼표 · 가운뎃점으로 적어도 받는다)"""
    v = 줄.get("낱말") if isinstance(줄, dict) else None
    if isinstance(v, str): v = re.split(r"[,·/]+", v)
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def 색낱말들(글):
    return {_색같음.get(c.lower(), c.lower()) for c in _색낱말.findall(str(글 or ""))}


def 소품나오는컷(seq):
    """컷마다의 「소품」 칸 → {소품 이름: [그 소품이 화면에 나오는 컷 이름(차례대로 · 한 번씩)]}. 「화면밖」 · 「없음」은 나오지 않는 것이다."""
    out = {}
    for d in seq.get("detail") or []:
        for k, v in (d.get("소품").items() if isinstance(d.get("소품"), dict) else []):
            out.setdefault(k, [])
            if v not in _소품없음 and d.get("cut") not in out[k]: out[k].append(d.get("cut"))
    return out


def 소품줄검사(seq):
    """T18 — 맨 위 「소품」 표: 되풀이해 나오는 탈것 · 소품은 인물처럼 한 줄(51) → [(등급, 어디, 글)]."""
    out = []; 표 = 소품표줄(seq); 나옴 = 소품나오는컷(seq)
    for 이름, 줄 in 표.items():
        if not isinstance(줄, dict):
            out.append(("걸림", f"소품 {이름}", f"소품 「{이름}」 줄이 표 꼴({{종류, 낱말, 색, 생김새, 기준그림}})이 아니다(51)")); continue
        빠짐 = ([] if 소품낱말(줄) else ["낱말"]) + [k for k in ("색", "생김새", "기준그림") if 빈칸(줄.get(k))]
        if 빠짐: out.append(("걸림", f"소품 {이름}", f"소품 「{이름}」의 {' · '.join(빠짐)} 칸이 비었다 — 되풀이해 나오는 탈것 · 소품은 인물처럼 한 줄(지시문에서 부르는 영어 낱말 · 색 · 생김새 문장 · 기준 그림)로 적고 모든 컷이 그 줄을 쓴다(51)"))
        if not 빈칸(줄.get("색")) and not 빈칸(줄.get("생김새")):
            표색 = 색낱말들(줄.get("색")); 문장색 = 색낱말들(줄.get("생김새"))
            if not (표색 | 문장색): out.append(("주의", f"소품 {이름}", f"소품 「{이름}」 줄에 아는 색 이름이 없다 — 색을 영어 색 이름(cream · cobalt-blue …)으로 적어야 지시문의 색과 견준다(51)"))
            elif 표색 - 문장색: out.append(("주의", f"소품 {이름}", f"소품 「{이름}」의 색 「{' · '.join(sorted(표색 - 문장색))}」 — 생김새 문장에 없는 색이다. 지시문에 글자 그대로 들어가는 것은 생김새 문장이다(51)"))
        if 이름 not in 나옴: out.append(("주의", f"소품 {이름}", f"소품 「{이름}」 — 어느 컷의 「소품」 칸에도 없다. 컷마다 상태를 적는다(안 나오는 컷은 화면밖)"))
    for 이름, 컷들 in 나옴.items():
        탈것 = bool(_탈것이름.search(이름))
        if 이름 in 표 or len(컷들) < (2 if 탈것 else 3): continue
        out.append(("걸림", f"소품 {이름}", f"{'탈것' if 탈것 else '소품'} 「{이름}」 — {len(컷들)}컷({' · '.join(str(c) for c in 컷들[:6])}{' …' if len(컷들) > 6 else ''})에 나오는데 맨 위 「소품」 표에 줄이 없다. "
                    f"낱말 · 색 · 생김새 · 기준그림을 한 줄로 적고 모든 컷이 그 줄을 쓴다(컷마다 색을 따로 적으면 같은 {'탈것' if 탈것 else '소품'}이 컷마다 달라진다 · 51)"))
    return out


# ───────── T22 색감(51) ─────────
# 왜: 11-18 유호님 「이미지콘티 만들때 색보정같은걸 ( 영상 색감 ) 을 고를수있게 세팅하고싶은데」 · 「색감도 니 제안대로 해보자」.
#   10-12 한강2126 · 10-24 매진 임박은 「색감이 자꾸 바뀐다」를 들은 뒤에야 알았고, 후보정으로 맞춘 판은 「너무 이질적」이었다(10-24 결정 — 색은 처음 지시문에 쓴다).
#   한 편에 색감 하나(영상양식/색감이름.json)를 기획에서 골라 컷표 맨 위 「색감」에 적고, 이미지 지시문 GRADE 줄에 「뼈대」, 영상 지시문 LOOK 줄에 「영상뼈대」를
#   글자 그대로 쓴다. 칸이 비면 편 날짜 2026-11-19부터 걸림(앞선 편 · 날짜를 못 읽는 편은 주의 — 진행 중인 편을 막지 않으려고). 고른 색감의 「어긋빛」을 장면이 쓰면 주의.
색감이름표경로 = 빛이름표경로.parent / "색감이름.json"
_색감표캐시 = None
색감부터 = "20261119"
# 11-19 덧: 「세트」 · 인물 「옷」 — 색감 견본에서 흰 · 회색 벽과 검은 옷 방에 색감 줄만 바꾼 판은 유호님 「퀄리티가 떨어져보이네」였고 옷 · 벽을 원색 둘로 정한 팝만
#   「좋아보이는데」였다(만족 사례 S58). 그래서 색감을 고른 편은 맨 위 「세트」(옷 · 벽 · 소품 색 두세 개를 묶는 영어 한 문장)를 적고 이미지 지시문 PALETTE 줄에
#   그대로 쓴다. 또 Seedream 5.5(11-19 영상 그림 엔진 고정)는 옷을 적지 않으면 참고 사진의 옷을 그대로 입혔다(시드림시험_20261119) — 사람이 나오는 인물은 「옷」을 적는다.
#   둘 다 편 날짜 2026-11-20부터 걸림, 앞선 편 · 날짜를 못 읽는 편은 주의.
세트부터 = "20261120"


def 색감이름표():
    """색감 이름 표 → ({이름: 줄}, None). 못 읽으면 (None, 까닭)."""
    global _색감표캐시
    if _색감표캐시 is None:
        try:
            raw = json.loads(색감이름표경로.read_text(encoding="utf-8"))
            줄들 = {str(x["이름"]).strip(): x for x in raw["이름"] if isinstance(x, dict) and not 빈칸(x.get("이름"))}
            if not 줄들: raise ValueError("이름이 하나도 없다")
            for x in 줄들.values():
                빈 = [k for k in ("뼈대", "영상뼈대") if 빈칸(x.get(k))]
                if 빈: raise ValueError(f"「{x['이름']}」의 {' · '.join(빈)}가 비었다")
            _색감표캐시 = (줄들, None)
        except Exception as e:
            _색감표캐시 = (None, f"{색감이름표경로.name}: {e}")
    return _색감표캐시


def 고른색감(seq):
    """컷표 「색감」이 표에 있는 이름이면 그 줄, 아니면 None(빈 칸 · 틀린 이름은 색감검사가 건다)."""
    v = seq.get("색감") if isinstance(seq, dict) else None
    if not isinstance(v, str) or 빈칸(v): return None
    표, _ = 색감이름표()
    return (표 or {}).get(v.strip())


def 색감검사(seq, 폴더=None):
    """T22 — 컷표 맨 위 「색감」(한 편에 색감 하나 · 51) → [(등급, 어디, 글)]."""
    import difflib
    v = seq.get("색감"); 표, 까닭 = 색감이름표()
    if 표 is None: return [("걸림", "표", f"색감 이름 표를 못 읽었다 — {까닭}(51)")]
    이름들 = " · ".join(표)
    if 빈칸(v):
        날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 색감부터) else "주의"
        return [(등급, "표", f"「색감」 칸이 비었다 — 색감 이름 표(영상양식/색감이름.json)의 {이름들} 가운데 하나를 기획에서 고른다. "
                 f"이미지 지시문 GRADE 줄과 영상 지시문 LOOK 줄에 그 색감 문장이 그대로 들어간다(51)")]
    if not isinstance(v, str):
        return [("걸림", "표", f"「색감」에는 이름 하나만 적는다 — 한 편에 색감 하나(지금 {json.dumps(v, ensure_ascii=False)[:40]})(51)")]
    줄 = 표.get(v.strip())
    if 줄 is None:
        가까운 = difflib.get_close_matches(v.strip(), list(표), n=1, cutoff=0.4)
        return [("걸림", "표", f"색감 「{v.strip()}」이 색감 이름 표에 없다" + (f"(「{가까운[0]}」?)" if 가까운 else "") + f" — {이름들} 가운데 하나로 적는다(51)")]
    out = []; 어긋 = {str(n).lower(): str(n) for n in 줄.get("어긋빛") or []}
    장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    쓰는장면 = list(dict.fromkeys(d.get("장면") for d in seq.get("detail") or [] if isinstance(d, dict) and isinstance(d.get("장면"), str)))
    for 이름 in 쓰는장면:
        s = 장면표.get(이름)
        if not isinstance(s, dict): continue
        걸친 = [어긋[n.lower()] for n in 빛이름들(s) if n.lower() in 어긋]
        if 걸친:
            out.append(("주의", f"장면 {이름}", f"장면 「{이름}」의 빛 이름({' · '.join(걸친)})이 색감 「{줄['이름']}」에 어긋난다 — 어울리는 빛: "
                        f"{' · '.join(줄.get('어울빛') or [])}. 일부러 고른 빛이면 넘긴다(51)"))
    날짜 = 편날짜(seq, 폴더); 새편 = "걸림" if (날짜 and 날짜 >= 세트부터) else "주의"
    if 빈칸(seq.get("세트")):
        예 = f" — 이 색감의 세트: {줄['세트']}" if not 빈칸(줄.get("세트")) else ""
        out.append((새편, "표", f"「세트」 칸이 비었다 — 색감 「{줄['이름']}」에 맞춘 옷 · 벽 · 소품 색 두세 개를 영어 한 문장으로 적고 이미지 지시문 PALETTE 줄에 그대로 쓴다{예}. "
                    f"흰 · 회색 무지 벽에 검은 옷이면 색감 줄을 바꿔도 싸 보인다(60)"))
    elif not isinstance(seq.get("세트"), str):
        out.append(("걸림", "표", "「세트」는 영어 한 문장으로 적는다 — 이미지 지시문 PALETTE 줄에 글자 그대로 들어간다(60)"))
    인물표 = seq.get("인물") if isinstance(seq.get("인물"), dict) else {}
    # 영상에 나오는 사람뿐 아니라 시작 · 끝 그림에만 나오는 사람도 옷을 입고 나온다(「그림인물」 · 「끝그림인물」 — 11-21 GPT 검수)
    나오는 = list(dict.fromkeys(n for d in seq.get("detail") or [] if isinstance(d, dict) for 칸 in ("인물", "그림인물", "끝그림인물")
                             for n in (d.get(칸) if isinstance(d.get(칸), list) else []) if isinstance(n, str)))
    for n in 나오는:
        p = 인물표.get(n)
        if isinstance(p, dict) and not _글있음(p.get("옷")):
            out.append((새편, f"인물 {n}", f"인물 「{n}」의 「옷」 칸이 비었다 — 옷을 적지 않으면 Seedream이 참고 사진의 옷을 그대로 입힌다(시드림시험_20261119). "
                        f"세트 색에 맞춘 옷을 영어 한 문장으로 적는다(12 · 60)"))
    return out


def 색감대조(seq, 글, 종류="영상"):
    """고른 색감의 「영상뼈대」(영상 지시문) · 「뼈대」(이미지 지시문)가 글자 그대로(공백 · 줄바꿈만 한 칸으로) 들었나 → [(등급, 글)].
    색감을 안 고른 편 · 표에 없는 이름은 보지 않는다(칸은 T22가 건다)."""
    줄 = 고른색감(seq)
    if 줄 is None: return []
    k = "영상뼈대" if 종류 == "영상" else "뼈대"
    if 한칸(줄[k]) in 한칸(글): return []
    자리 = "LOOK 줄의 빛 문장 뒤" if 종류 == "영상" else "LIGHT 줄 바로 뒤 GRADE 줄"
    return [("걸림", f"색감 「{줄['이름']}」의 {k} 문장이 글자 그대로 들어 있지 않다 — {자리}에 색감 이름 표의 문장을 그대로 쓴다(51): 「{한칸(줄[k])[:60]}…」")]


# ───────── T23 최상급 기준 광고(3) ─────────
# 왜: 11-18 유호님 「최상급과 겨룰만한지 검수도 추가하자」 — 점검표 3번(「명품 광고 사이에 끼운 눈가림 시험으로 잰다」)에 적혀만 있고 도구 · 비교 광고가 없었다.
#   기획에서 같은 분야의 실제 최상급 광고 둘 이상을 컷표 맨 위 「최상급」에 적어 두면 그 광고가 만드는 내내 겨눌 기준이 되고,
#   이미지 콘티 대표 장 · 최종본을 그 광고 사이에 섞어 tools/최상급대조.py로 눈가림 순위를 받는다. SNS 편도 같은 컷표를 쓰니 주의로만 알린다 —
#   광고 · 공모전 · 포트폴리오는 /마감작업이 대조 기록을 본다.
최상급최소 = 2


def 최상급검사(seq):
    """T23 — 컷표 「최상급」: [{"제목", "브랜드", "해", "주소"(또는 "파일"), "까닭"}] 둘 이상(3) → [(등급, 어디, 글)]."""
    v = seq.get("최상급")
    줄들 = v if isinstance(v, list) else []
    좋은 = [x for x in 줄들 if isinstance(x, dict) and not 빈칸(x.get("제목")) and (not 빈칸(x.get("주소")) or not 빈칸(x.get("파일")))]
    out = []
    if len(좋은) < 최상급최소:
        out.append(("주의", "표", f"「최상급」에 같은 분야 실제 최상급 광고가 {len(좋은)}편이다 — 둘 이상(제목 · 브랜드 · 해 · 주소 · 까닭)을 기획에서 고른다. "
                    f"이미지 콘티 대표 장과 최종본을 그 광고 사이에 섞어 tools/최상급대조.py로 눈가림 순위를 받는다(3)"))
    for i, x in enumerate(줄들):
        if isinstance(x, dict) and x in 좋은 and 빈칸(x.get("까닭")):
            out.append(("주의", "표", f"「최상급」 {i + 1}번째 「{한칸(x.get('제목'))[:30]}」에 고른 까닭이 없다 — 무엇이 최상급인지(상 · 브랜드 · 만듦새) 한 줄(3)"))
    return out


# ───────── T24 감정흐름 — 희노애락의 굴곡(14) ─────────
# 왜: 11-18 유호님 「스토리에 희노애락이 있고 기승전결이 있나 이것도 잘 파악해주고 있지 ?」 → 「넣어줘」. 사건마다 감정 설계(T15)는 칸이 비면 걸렸지만,
#   편 전체에서 감정이 바뀌는지는 아무도 보지 않아 모든 사건이 같은 감정이어도 지나갔다. 11-08 결정 「넷이 같은 세기면 그리기 전에 다시 짠다」도
#   글로만 있었다. 컷표 맨 위 「감정흐름」에 기 · 승 · 전 · 결마다 감정(낱말) · 갈래 · 세기(1~5)를 적고 굴곡을 본다.
#   갈래가 넷 다 같으면 걸림(한 감정으로 가는 까닭이 있으면 「한결」: 까닭 → 주의), 세기가 넷 다 같으면 걸림, 전이 기보다 세지 않으면 주의,
#   처음과 끝의 감정 · 갈래가 같으면 주의. 칸이 비면 편 날짜 2026-11-19부터 걸림(앞선 편 · 날짜를 못 읽는 편은 주의).
감정갈래 = {"희": "기쁨 · 설렘 · 안도 · 따뜻함 · 뿌듯함", "노": "화 · 짜증 · 답답함 · 억울함", "애": "슬픔 · 외로움 · 그리움 · 미안함 · 아쉬움",
           "락": "즐거움 · 웃음 · 장난 · 신남 · 통쾌함", "긴장": "놀람 · 두려움 · 조마조마 · 궁금함 · 망설임"}
감정흐름부터 = "20261119"


def 감정흐름검사(seq, 폴더=None):
    """T24 — 컷표 「감정흐름」: {"기" | "승" | "전" | "결": {"감정", "갈래": 희|노|애|락|긴장, "세기": 1~5}, "한결"?: 까닭}(14) → [(등급, 어디, 글)]."""
    v = seq.get("감정흐름"); 갈래들 = " · ".join(감정갈래)
    if not isinstance(v, dict) or not any(k in v for k in "기승전결"):
        날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 감정흐름부터) else "주의"
        return [(등급, "표", f"「감정흐름」 칸이 비었다 — 기 · 승 · 전 · 결마다 감정(낱말) · 갈래({갈래들}) · 세기(1~5)를 적는다. "
                 f"갈래가 넷 다 같거나 세기가 넷 다 같으면 굴곡이 없는 편이다(14)")]
    out = []; 띠값 = {}
    for k in "기승전결":
        x = v.get(k)
        if not isinstance(x, dict):
            out.append(("걸림", "표", f"「감정흐름」에 「{k}」가 없다 — 기 · 승 · 전 · 결 넷 다 감정 · 갈래 · 세기를 적는다(14)")); continue
        빠짐 = [n for n in ("감정", "갈래", "세기") if 빈칸(x.get(n))]
        if 빠짐: out.append(("걸림", "표", f"「감정흐름.{k}」의 {' · '.join(빠짐)} 칸이 비었다(14)")); continue
        갈래 = str(x["갈래"]).strip(); 세기 = 숫자(x["세기"])
        if 갈래 not in 감정갈래: out.append(("걸림", "표", f"「감정흐름.{k}」의 갈래 「{갈래}」는 {갈래들} 가운데 하나가 아니다(14)")); continue
        if 세기 is None or not (1 <= 세기 <= 5): out.append(("걸림", "표", f"「감정흐름.{k}」의 세기 「{x['세기']}」는 1~5의 수가 아니다(14)")); continue
        띠값[k] = (한칸(x["감정"]), 갈래, 세기)
    if len(띠값) < 4: return out
    if len({g for _, g, _ in 띠값.values()}) == 1:
        g = 띠값["기"][1]
        if 빈칸(v.get("한결")):
            out.append(("걸림", "표", f"기 · 승 · 전 · 결의 감정 갈래가 모두 「{g}」이다 — 희노애락의 굴곡이 없다. 한 번은 다른 갈래로 꺾는다"
                        f"(웃김이면 전 앞에 긴장 · 여운이면 기의 애에서 결의 희로). 한 감정으로 가야 하는 까닭이 있으면 「한결」에 적는다(14)"))
        else: out.append(("주의", "표", f"감정 갈래가 모두 「{g}」이다 — 「한결」 까닭: {한칸(v['한결'])[:60]}(14)"))
    if len({s for _, _, s in 띠값.values()}) == 1:
        out.append(("걸림", "표", f"기 · 승 · 전 · 결의 세기가 모두 {띠값['기'][2]:g}이다 — 넷이 같은 세기면 그리기 전에 다시 짠다(11-08 결정 · 14)"))
    elif 띠값["전"][2] <= 띠값["기"][2]:
        out.append(("주의", "표", f"전의 세기({띠값['전'][2]:g})가 기({띠값['기'][2]:g})보다 세지 않다 — 전은 터지는 자리다(14)"))
    if 띠값["기"][0] == 띠값["결"][0]:
        out.append(("주의", "표", f"처음과 끝의 감정이 같다(「{띠값['기'][0]}」) — 이 편이 보는 사람의 마음을 무엇에서 무엇으로 바꾸나(14)"))
    # 굴곡부터 걸린 편은 그것부터 고친다 — 컨셉 모양은 굴곡이 선 뒤에 본다
    if not any(등급 == "걸림" for 등급, _, _ in out): out += 팩모양검사(seq, 띠값)
    return out


# 컨셉 팩의 기승전결 모양 — 11-24 유호님 「컨셉마다 전부 기승전결 적용해서 만드는거 적용 되어있어?」 → 「넣어줘」.
#   위 굴곡 검사는 아홉 컨셉에 같은 잣대다. 코믹은 끝의 반전이 가장 큰 웃음이고, 감동은 전에서 결로 갈래가 꺾이며 끝의 감정이 세다.
#   컷표 「컨셉」의 팩(docs/마케팅/제작양식/영상양식/컨셉팩/<컨셉>.json)에 「기승전결.검사」가 있으면 그 조건을 주의로 알린다(멈추지 않는다).
#   조건: 가장센(그 띠의 세기가 넷 가운데 가장 크거나 같다) · 갈래({띠: [허용 갈래]}) · 꺾임([띠, 띠] 두 띠의 갈래가 다르다) · 세기최소({띠: 수}).
#   팩 폴더는 시험을 위해 SYNK_CONCEPT_PACK_DIR로 바꿀 수 있다.
def 컨셉팩폴더():
    import os
    return Path(os.environ.get("SYNK_CONCEPT_PACK_DIR") or (Path(__file__).resolve().parent.parent / "docs" / "마케팅" / "제작양식" / "영상양식" / "컨셉팩"))


# 컨셉 팩의 앵글 견줄 값(T29) — 11-24 유호님 「컨셉별로 카메라 엥글 사용법이 다 재각각일텐데 … 각 카메라감독이 잘 배치되어있는지」 → 「재서 넣어 줘」.
#   팩의 「앵글」은 그 컨셉 본보기 둘의 컷마다 가운데 장을 위 앵글 낱말로 매겨 낸 비율이다(견줄 값 — 감독 줄이 아니다).
#   본보기를 20컷 넘게 잰 팩이고 이 편의 앵글을 세 칸 다 적은 컷이 6개 넘으면, 묶음마다 본보기 비율이 30% 넘는데 이 편이 그 절반에 못 미칠 때 주의(멈추지 않는다).
#   「앵글.만족」(유호님이 만족하신 우리 편을 같은 낱말로 잰 비율 — 11-24 「재서 올려 줘」)이 20컷 넘게 쟀으면 본보기 대신 그 값과 견준다.
앵글묶음 = {"가까이": ("크기", ("극접", "클로즈", "가슴 위"), "가까운 컷(극접 · 클로즈 · 가슴 위)"),
          "눈높이밖": ("높이", ("로우", "하이", "위에서"), "눈높이 밖 컷(로우 · 하이 · 위에서)"),
          "정면밖": ("방향", ("비스듬히", "옆", "뒤", "어깨 너머", "시점", "물건 너머"), "정면 밖 컷(비스듬히 · 옆 · 뒤 · 어깨 너머 · 시점 · 물건 너머)")}


def 팩앵글검사(seq, 값들):
    """값들: 컷마다 _앵글값()의 (크기, 높이, 방향) | None. 팩을 못 읽으면 조용히 넘긴다(읽기 실패는 T24와 영상기준이 알린다)."""
    컨셉 = str(seq.get("컨셉") or "").strip()
    if not re.fullmatch(r"[^\W_]{1,20}", 컨셉): return []
    try: 팩 = json.loads((컨셉팩폴더() / f"{컨셉}.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError): return []
    판 = 팩.get("앵글") if isinstance(팩, dict) else None
    수 = lambda n: isinstance(n, (int, float)) and not isinstance(n, bool) and 0 <= n <= 100
    충분 = lambda x: isinstance(x, dict) and isinstance(x.get("잰컷"), int) and not isinstance(x.get("잰컷"), bool) and x["잰컷"] >= 20
    if not isinstance(판, dict): return []
    기준, 누구 = (판["만족"], "만족하신 편은") if 충분(판.get("만족")) else ((판, "본보기는") if 충분(판) else (None, None))
    if 기준 is None: return []
    값 = [v for v in 값들 if v is not None]
    if len(값) < 6: return []
    out = []
    for 키, (칸, 낱말들, 이름) in 앵글묶음.items():
        c = 기준.get(키)
        if not 수(c) or c < 30: continue
        n = sum(1 for v in 값 if v[("크기", "높이", "방향").index(칸)] in 낱말들); p = round(100 * n / len(값))
        if p * 2 < c:
            out.append(("주의", "표", f"컨셉 「{컨셉}」 {누구} {이름}이 {c:g}%인데 이 편은 {p}%({n}/{len(값)}컷)다 — 컷표의 앵글을 다시 본다(팩 앵글)"))
    return out


def 팩모양검사(seq, 띠값):
    """띠값은 기 · 승 · 전 · 결 넷이 다 있을 때만 온다(감정흐름검사). 팩 파일이 없으면 조용히 넘기고, 있는데 못 읽거나
    「검사」의 꼴이 틀리면 건너뛴 것을 주의 한 줄로 남긴다(통과와 구별되게 — 11-24 Fable 설계 검토 P2-2)."""
    컨셉 = str(seq.get("컨셉") or "").strip()
    if not re.fullmatch(r"[^\W_]{1,20}", 컨셉): return []
    파일 = 컨셉팩폴더() / f"{컨셉}.json"
    if not 파일.is_file(): return []   # 팩이 없는 컨셉 — 영상기준이 「팩이 아직 없다」를 알린다
    머리 = f"컨셉 「{컨셉}」 팩의 기승전결"
    try: 팩 = json.loads(파일.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError): return [("주의", "표", f"컨셉 「{컨셉}」 팩 파일을 읽지 못해 기승전결 모양을 보지 않았다 — 팩 JSON을 고친다(팩 기승전결)")]
    판 = 팩.get("기승전결") if isinstance(팩, dict) else None
    if not isinstance(판, dict) or 판.get("검사") is None: return []
    조건 = 판["검사"]
    if not isinstance(조건, dict): return [("주의", "표", f"{머리} 검사가 조건 표가 아니라 건너뛰었다 — 팩 JSON을 고친다(팩 기승전결)")]
    모양 = 판.get("모양") if isinstance(판.get("모양"), dict) else {}
    받침 = lambda 낱말: "가" <= str(낱말)[-1:] <= "힣" and (ord(str(낱말)[-1]) - 0xAC00) % 28 != 0
    뜻 = lambda k: f"「{k}」{'은' if 받침(k) else '는'} {모양[k]}" if 모양.get(k) else f"「{k}」"
    띠 = lambda k: isinstance(k, str) and k in ("기", "승", "전", "결")
    수 = lambda n: isinstance(n, (int, float)) and not isinstance(n, bool) and n == n and abs(n) != float("inf")
    한결 = not 빈칸((seq.get("감정흐름") or {}).get("한결"))
    out = []; 틀린 = [str(키) for 키 in 조건 if 키 not in ("가장센", "갈래", "꺾임", "세기최소")]
    if "가장센" in 조건:
        k = 조건["가장센"]
        if not 띠(k): 틀린.append("가장센")
        else:
            더센 = [x for x in "기승전결" if x != k and 띠값[x][2] > 띠값[k][2]]
            if 더센: out.append(("주의", "표", f"{머리}에서 {뜻(k)} — 지금 {' · '.join(f'{x}({띠값[x][2]:g})' for x in 더센)}{'이' if 받침(더센[-1]) else '가'} {k}({띠값[k][2]:g})보다 세다(팩 기승전결)"))
    if "갈래" in 조건:
        표 = 조건["갈래"]
        if not (isinstance(표, dict) and 표 and all(띠(k) and isinstance(v, list) and v and all(isinstance(g, str) for g in v) for k, v in 표.items())): 틀린.append("갈래")
        else:
            for k, 허용 in 표.items():
                if 띠값[k][1] not in 허용:
                    out.append(("주의", "표", f"{머리}에서 {뜻(k)} — {k}의 갈래가 {' · '.join(허용)} 가운데 하나가 아니라 「{띠값[k][1]}」이다(팩 기승전결)"))
    if "꺾임" in 조건:
        꺾임 = 조건["꺾임"]
        if not (isinstance(꺾임, list) and len(꺾임) == 2 and all(띠(x) for x in 꺾임) and 꺾임[0] != 꺾임[1]): 틀린.append("꺾임")
        elif not 한결 and 띠값[꺾임[0]][1] == 띠값[꺾임[1]][1]:   # 「한결」 까닭을 적은 편은 위 굴곡 주의가 이미 말했다(P2-1)
            a, b = 꺾임
            out.append(("주의", "표", f"{머리}에서 {a}에서 {b}로 갈래가 꺾인다({뜻(b)}) — 지금 둘 다 「{띠값[a][1]}」이다(팩 기승전결)"))
    if "세기최소" in 조건:
        표 = 조건["세기최소"]
        if not (isinstance(표, dict) and 표 and all(띠(k) and 수(n) for k, n in 표.items())): 틀린.append("세기최소")
        else:
            for k, 최소 in 표.items():
                if 띠값[k][2] < 최소:
                    out.append(("주의", "표", f"{머리}에서 {뜻(k)} — {k}의 세기가 {최소:g}보다 낮은 {띠값[k][2]:g}이다(팩 기승전결)"))
    if 틀린: out.append(("주의", "표", f"{머리} 검사에서 꼴이 틀린 조건({' · '.join(틀린)})은 건너뛰었다 — 팩 JSON을 고친다(팩 기승전결)"))
    return out


키부터 = "20261118"   # T20 — 이 날 이후 편(편 날짜)은 걸림, 앞선 편 · 날짜를 못 읽는 편은 주의(진행 중인 다른 편의 판을 막지 않으려고)


def 인물키검사(seq, 폴더=None):
    """T20 — 사람과 탈것이 한 컷에 나오면 그 인물 줄에 「키」(그 탈것에 견준 키)가 있어야 한다(63) → [(등급, 어디, 글)].
    왜: 11-18 YOUTH UP 「잠깐」 — 인물 기준 그림부터 아빠와 차가 같은 키(장난감 크기 차)라, 「서서는 지붕 너머가 보이고 앉으면 안 보인다」는
    핵심 장면이 처음부터 서지 않았다. 유호님 「차 높이도 아이시선으로 강조해야하는부분도 크게 강조한것같지가않은데 ?」. 키를 표에 한 번 적고
    키 기준 그림을 하나 굽어 그 컷들의 참고로 넣어야 컷마다 사람과 차의 크기가 같아진다(원칙 3 한 편은 한 세계)."""
    out = []; 인물표 = seq.get("인물") if isinstance(seq.get("인물"), dict) else {}; 표 = 소품표줄(seq)
    def 탈것인가(이름):
        줄 = 표.get(이름)
        return (isinstance(줄, dict) and str(줄.get("종류") or "").strip() == "탈것") or bool(_탈것이름.search(str(이름)))
    빠진 = {}   # 인물 → [(컷, 탈것)]
    for d in seq.get("detail") or []:
        if not isinstance(d, dict): continue
        소품 = d.get("소품") if isinstance(d.get("소품"), dict) else {}
        차 = [n for n, v in 소품.items() if v not in _소품없음 and 탈것인가(n)]
        if not 차: continue
        사람 = []
        for 칸 in ("인물", "그림인물", "끝그림인물"):
            v = d.get(칸)
            if isinstance(v, list): 사람 += [x for x in v if isinstance(x, str) and x.strip() and x not in 사람]
        for 누구 in 사람:
            p = 인물표.get(누구)
            if isinstance(p, dict) and not 빈칸(p.get("키")): continue
            곳 = 빠진.setdefault(누구, [])
            if not any(c == d.get("cut") for c, _ in 곳): 곳.append((d.get("cut"), 차[0]))
    if not 빠진: return out
    날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 키부터) else "주의"
    for 누구, 곳 in 빠진.items():
        컷들 = " · ".join(f"{c}({t})" for c, t in 곳[:4]) + (" …" if len(곳) > 4 else "")
        out.append((등급, f"인물 {누구}", f"사람과 탈것이 한 컷에 나오는데({컷들}) 인물 「{누구}」 줄에 「키」 칸이 없다 — 그 탈것에 견준 키"
                    f"(해치백 지붕이 어깨에 온다 · 8살은 모자 꼭대기가 지붕보다 낮다)를 한 번 적고, 키 기준 그림을 하나 굽어 그 컷들의 참고 그림으로 넣는다. "
                    f"인물 기준 그림만 넣으면 모델은 사람 옆에 장난감 크기 차를 그린다(63)"))
    return out


타당성부터 = "20261120"   # T27 — 이 날 이후 편(편 날짜)은 걸림, 앞선 편 · 날짜를 못 읽는 편은 주의(진행 중인 다른 편의 판을 막지 않으려고)


def 타당성검사(seq, 폴더=None):
    """T27 — 두 사람 이상이 한 화면인 컷은 「타당성」 칸에 그 장소 · 주변 사람 수 · 관계에서 이 거리 · 자세 · 행동이 왜 말이 되는지 한 줄이 있어야 한다(65) → [(등급, 어디, 글)].
    왜: 11-19 공모전 편의 지하철 컷 — 두 사람이 바짝 붙어 선 것은 만원 지하철이어야 서는 설정인데, 다른 승객이 끼어드는 것을 막으려고 지시문에 「두 사람만」을 적어
    빈 좌석이 보이는 객차에서 남자가 여자 뒤에 바짝 붙은 그림이 됐다. 유호님 「자리가 이렇게 많은데 이렇게 이미지를 뽑은게 말이 안되잖아」 ·
    「앞으로 이미지 시안 뽑기전에 … 타당성에대한 검수」. 칸은 만든 사람이 까닭을 글로 세우는 자리이고, 판정은 콘티 검수(심사 지시문 4-4)의 다른 눈이 한다."""
    빠진 = []
    for d in seq.get("detail") or []:
        if not isinstance(d, dict): continue
        # 한 화면 = 한 목록이다 — 영상(「인물」) · 시작 그림(「그림인물」) · 끝 그림(「끝그림인물」)을 따로 세고, 어느 한 목록에 서로 다른 사람이 둘 이상이면 묻는다.
        # 세 목록을 합쳐 세면 시작 그림과 끝 그림에 따로 나오는 두 사람도 걸리고, 같은 이름을 두 번 적어도 둘로 센다(11-21 GPT 검수 — 11-20 GA2는 그림에만 함께 나오는 사람을 세게 했다)
        한화면 = max((len({x.strip() for x in d.get(칸) if isinstance(x, str) and x.strip()}) for 칸 in ("인물", "그림인물", "끝그림인물") if isinstance(d.get(칸), list)), default=0)
        if 한화면 >= 2 and not _글있음(d.get("타당성")): 빠진.append(d.get("cut"))   # 빈 배열 · 객체는 글이 아니다(GA1)
    if not 빠진: return []
    날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 타당성부터) else "주의"
    return [(등급, cut, "두 사람 이상이 한 화면인데 「타당성」 칸이 비었다 — 이 장소 · 주변 사람 수 · 관계에서 이 거리 · 자세 · 행동이 왜 말이 되는지 한 줄로 적는다"
             "(모르는 사이가 가까이 붙는 컷은 그럴 수밖에 없는 형편이 화면에 보여야 한다, 65)") for cut in 빠진]


# ───────── T28 감정 자리는 가깝게(33) · T29 이웃 컷의 앵글(50) ─────────
# 왜: 11-19 유호님 「너무 엥글이 와이드엥글이 대부분이고 감정표현이 (감정전달)이 너무너무 부족해 … 디테일한 감정표현을 제대로 했으면 좋겠어. 그냥 대충하지말고」.
#   사건 표의 「감정」 칸을 채워 검사는 지났는데 그 컷이 전신 · 허리 위였고, 그림 엔진은 미디엄을 주문해도 넓게 그려 얼굴 폭이 화면의 4~9%였다(공모 두 편의 굽기 전 관문).
#   이를 고치며 감정 컷을 모두 가슴 위 · 눈높이 클로즈로 바꾸자 11-20 「계속 엥글이 똑같아 … 상황에맞춰서 다양한 엥글을 써줘야해 … 개연성이랑 재미도 챙겨서
#   엥글을 맵시있게 구성해야해」. 감정 자리는 그림에서 얼굴 폭으로 재고(T28), 앵글은 크기 · 높이 · 방향 세 칸으로 적어 이웃 컷과 견준다(T29). 글 정본은 점검표 33 · 50.
# T28: 감정 자리 = 사건 표의 「감정」 컷(압축 사건은 뺌) + 컷에 「감정자리」를 적은 컷. 사람이 나오는 편에 하나도 없으면 걸림. 그 컷의 시작 그림에서 가장 큰 얼굴의 폭 ÷ 그림 폭이
#   아래선(가로 그림 25% · 세로 그림 35%)에 못 미치면 걸림(항목 「얼굴」). 아래선 숫자는 Claude가 정한 출발값이다 — 11-19 실측(YuNet 얼굴 상자 폭)에서 얼굴 클로즈로 주문한
#   가로 컷이 23~28%, 세로 컷이 33~58%로 나왔다. 손 · 숨으로 보이는 자리(「감정부위」)와 잘라 쓰는 컷(값이 있는 「창」)은 재지 않는다. 얼굴을 못 찾으면 확인.
#   얼굴이 여럿 잡혔는데 아래선에 못 미치는 얼굴이 섞였으면 확인이다 — 어느 얼굴이 감정을 맡았는지 기계는 모른다(11-20 GPT 검수 GA3). 잡힌 얼굴 수가 컷표의 사람 수와 달라도 확인이다. 잰 값은 반올림하지 않고 견준다.
#   감정 자리는 토막 단위로 본다 — 「감정자리」를 적은 토막과 사건 표의 「감정」이 가리키는 토막(「A11」은 첫 토막 · 「A11#2」는 둘째 토막)의 창 · 감정부위 · 사람 수를 쓴다.
#   재는 그림은 굽기 전 관문의 판 도구가 여는 그림이고, 창은 받은 뒤 검사가 읽는 창이다 — 두 도구의 원문과 같은지 tests/컷연속성검사.test.js가 견준다.
# T29: 컷마다 「앵글」 세 칸과 까닭. 이웃 컷과 세 칸이 모두 같으면 걸림(이어 찍은 컷과, 바로 앞 컷과 한 판을 나눠 쓰는 컷은 뺌), 세 컷이 잇달아 같은 두 칸을 쓰면 주의.
#   사람 컷 가운데 「허리 위 · 눈높이 · 정면」이 3분의 1을 넘으면 주의(33 — 11-19 유호님 「내가 원하는 느낌은 지금 엥글이 전혀 아니야. 클로즈업을 자주 활용해서 감정을 보여줬으면 좋겠어.
#   지금은 너무 뻔해 진짜 아니야」 · 제작 규칙 「감정은 가까운 컷과 여러 장치로」 3항). 「인물 가운데」는 앵글 칸에 없어 세지 못한다. 사람 컷 셋부터, 그런 컷이 둘부터 본다(Claude가 정한 출발값).
#   이 주의는 편 날짜 2026-11-20부터만 낸다(앞선 편 · 날짜를 못 읽는 편에는 내지 않는다).
# 둘 다 편 날짜 2026-11-20부터 걸림 — 앞선 편 · 날짜를 못 읽는 편은 주의(진행 중인 편의 판을 막지 않으려고). 얼굴 폭은 표만 넘기는 내기 도구의 굽기전에서는 재지 않는다.
감정앵글부터 = "20261120"
감정자리아래선 = {"가로": 25.0, "세로": 35.0}   # 얼굴 폭 ÷ 그림 폭(%) — Claude가 정한 출발값(위 머리말), 굽기 전 관문의 지적과 견줘 다시 본다
앵글낱말 = {"크기": ("극접", "클로즈", "가슴 위", "허리 위", "무릎 위", "전신", "넓게"), "높이": ("로우", "눈높이", "하이", "위에서"),
          "방향": ("정면", "비스듬히", "옆", "뒤", "어깨 너머", "시점", "물건 너머")}
뻔한앵글 = ("허리 위", "눈높이", "정면")   # 사람 컷의 3분의 1을 넘으면 주의(33) — 크기 · 높이 · 방향 차례
감정부위낱말 = {"얼굴": ("얼굴", "눈", "입"), "몸": ("손", "숨", "몸", "어깨", "발", "등")}   # 얼굴 갈래는 얼굴 폭을 재고, 몸 갈래는 재지 않는다(관문의 눈이 본다)
# T29 렌즈(11-25 유호님 「카메라감독한테 몇미리(렌즈mm) 이것도 설정하는게 있어야 좋으려나 … 색감 정할때 몇 mm로 장면 구성해갈지도」 → 「지금 해 줘」).
#   맨 위 「렌즈」는 편의 렌즈 묶음(mm 둘~넷 — 색감과 같이 고른다), 컷마다 「앵글.렌즈」는 그 가운데 하나다. 이미지 지시문 FRAME 줄이 그 mm를 그대로 쓴다(그림지시문항목).
#   칸이 비면 편 날짜 2026-11-25부터 걸림이고, 앞선 편 · 날짜를 못 읽는 편에는 묻지 않는다. 적은 값은 날짜와 상관없이 본다(2026-11-25부터 걸림, 그 밖은 주의).
#   얼굴 가까운 사람 컷(극접 · 클로즈)이 35mm 아래면 주의 — 카메라가 얼굴에 바짝 붙어 코 · 이마가 커진다(「앵글.까닭」에 「넓은 렌즈」를 적으면 일부러로 본다).
#   한 장면에서 같은 크기(클로즈 · 가슴 위)의 사람 컷이 렌즈 둘 이상으로 갈리면 주의 — 맞받는 얼굴과 같은 사람은 렌즈를 맞춘다. 까닭과 출발 묶음은 렌즈 계획.
렌즈부터 = "20261125"
렌즈범위 = (8, 400)
렌즈계획 = "docs/마케팅/제작양식/영상양식/렌즈_계획.md"
_초점mm = re.compile(r"(?<![\d.])(\d{1,3}(?:\.\d)?)\s?mm\b(?!\s*(?:film|format|grain|stock|negative|camera|compact|rangefinder|slr|kodak|portra|fuji|cinestill|vision|superia|필름|카메라|소형))", re.I)
# T29 카메라 기법(11-25 유호님 「카메라 감독 앵글 보니까 너무 부족한데? 불릿샷이나 이런거 카메라 앵글 효과가 이것보다 훨씬 많을텐데 너무 없는데?」).
#   컷마다 「앵글.기법」에 카메라 기법 사전(영상양식/카메라기법.json)의 이름을 적는다(여럿이면 목록). 사전에 없는 이름은 편 날짜 2026-11-25부터 걸림, 앞선 편은 주의.
#   큰 움직임 기법이 이웃 컷에 잇달아 오면 주의(멀미 — 11-20 유호님). 한 컷에 카메라 경로(「길」)가 둘이면 주의(모든 도구의 안내와 시험 글이 한 판에 움직임 하나 —
#   카메라기법_조사_20261125.md). 「한번」 기법(불릿 타임 · 돌리 줌 …)을 한 편에 두 번 넘게 쓰면 주의. 「시험먼저」 기법과 컨셉의 「피함」 기법은 주의로 알린다.
#   컨셉 편(편 날짜 2026-11-25부터 · 컷 여섯부터)은 「고정」 말고 다른 기법이 그 컨셉의 「최소」보다 적으면 주의.
#   지시문 대조(기법대조): 「만드는곳」이 영상인 기법은 영상 지시문(--지시문 · 내기 도구 굽기전)에, 그림인 기법은 이미지 지시문(--그림지시문)에 사전의 「낱말」 가운데
#   하나가 있어야 한다(편 날짜 2026-11-25부터 걸림, 그 밖은 주의). 편집에서 만드는 기법은 지시문에서 보지 않는다.
기법부터 = "20261125"
기법사전경로 = 빛이름표경로.parent / "카메라기법.json"
_기법사전캐시 = None


def _글있음(v):
    """칸에 글이 적혔나 — 글(문자열)이고 비지 않아야 한다. 배열 · 객체 · 참거짓 · 수는 안에 글이 들어 있어도 칸을 채운 것이 아니다
    (「감정자리」 · 「앵글.까닭」 · 11-20 GPT 검수 GA6, 다시 검수 GA8)."""
    return isinstance(v, str) and bool(v.strip())


def 시작그림경로(d, 폴더=None):
    """컷의 「시작그림」 칸이 가리키는 파일 → (경로 | None, 칸에 적혔나). 굽기 전 관문의 판 도구(tools/영상관문판.py 시작그림찾기)와 같은 풀이다 —
    목록이면 첫 장, ~는 홈 폴더, 상대 경로는 편 폴더 기준. 칸에 적었는데 그 파일이 없으면 (None, True)이고 다른 그림으로 넘어가지 않는다."""
    import os
    for v in 시작그림들(d)[:1]:
        q = Path(os.path.expanduser(v)); q = q if q.is_absolute() or 폴더 is None else Path(폴더) / q
        return (q.resolve() if q.is_file() else None), True
    return None, False


def _시작그림열쇠(d, 폴더=None):
    """두 컷이 같은 시작 그림을 쓰는지 견줄 열쇠 — 첫 장만 보고, 경로를 풀어 견준다(「정지/C1.png」와 그 절대 경로는 같은 그림이다). 칸이 비면 None."""
    import os
    for v in 시작그림들(d)[:1]:
        q = Path(os.path.expanduser(v))
        if q.is_absolute() or 폴더 is not None: return os.path.normcase(str((q if q.is_absolute() else Path(폴더) / q).resolve()))
        return _그림열쇠(v)
    return None


def _창있음(v):
    """컷의 「창」이 읽을 수 있는 창인가 — tools/받은뒤검사.py가 읽는 꼴만 창이다: 비지 않은 객체, 칸은 가로 · 세로 · 배율뿐,
    가로 · 세로는 0~1의 수 하나나 [처음, 끝], 배율은 1 이상의 수 하나나 [처음, 끝]. null · {} · {"세로": null} · 모르는 칸은 창이 아니다."""
    import math
    if not isinstance(v, dict) or not v or any(k not in ("가로", "세로", "배율") for k in v): return False
    수 = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)
    둘 = lambda x, 맞나: 맞나(x) if 수(x) else isinstance(x, list) and len(x) == 2 and all(수(y) and 맞나(y) for y in x)
    return all(둘(v.get(k, 0.5), lambda y: 0 <= y <= 1) for k in ("가로", "세로")) and 둘(v.get("배율", 1), lambda y: y >= 1)


def 감정부위(d):
    """컷의 「감정부위」 → "얼굴" | "몸" | None(정한 낱말이 아님). 비었으면 얼굴. 맨 앞 낱말이 정한 낱말과 꼭 같아야 한다 —
    「손 — 입가를 가린다」는 손이고, 「입가를 가린 손」은 정한 낱말이 아니다(글 속 낱말을 찾아 가르지 않는다 · 11-20 GPT 검수 GA5)."""
    v = d.get("감정부위")
    if v is None or v == "" or v == [] or v == {}: return "얼굴"
    if not isinstance(v, str) or not v.strip(): return None
    첫 = re.split(r"[\s·—–\-,(:]", v.strip(), maxsplit=1)[0]
    return next((갈래 for 갈래, 낱들 in 감정부위낱말.items() if 첫 in 낱들), None)


def _사람컷(seq):
    return [d for d in seq.get("detail") or [] if isinstance(d, dict) and isinstance(d.get("인물"), list) and any(isinstance(n, str) and n.strip() for n in d["인물"])]


def 감정자리컷(seq):
    """감정 자리 → {컷 이름: 무엇}. 사건 표의 「감정」 컷(「A11#2」는 A11 · 압축 사건은 뺌)과 컷에 「감정자리」를 적은 컷."""
    out = {}
    for ev in seq.get("사건") if isinstance(seq.get("사건"), list) else []:
        if isinstance(ev, dict) and ev.get("압축") is not True and isinstance(ev.get("감정"), str) and ev["감정"].strip():
            out.setdefault(ev["감정"].split("#")[0].strip(), f"사건 「{한칸(ev.get('이름') or '?')[:16]}」의 감정 컷")
    for d in seq.get("detail") or []:
        if isinstance(d, dict) and _글있음(d.get("감정자리")): out[str(d.get("cut"))] = 한칸(d["감정자리"])[:30]
    return out


def _감정토막(seq):
    """감정 자리인 토막 → {컷: [그 컷의 감정 토막 줄, …]}(컷표 순서 · 사람이 나오는 토막만). 「감정자리」를 적은 토막과 사건 표의 「감정」이 가리키는 토막이다 —
    「A11」은 첫 토막, 「A11#2」는 둘째 토막. 사건 표가 없는 토막 번호나 사람이 없는 토막을 가리키면 그 컷의 사람 토막을 다 본다."""
    자리 = 감정자리컷(seq); 가리킴 = {}
    for ev in seq.get("사건") if isinstance(seq.get("사건"), list) else []:
        if isinstance(ev, dict) and ev.get("압축") is not True and isinstance(ev.get("감정"), str) and ev["감정"].strip():
            이름, _, 번 = ev["감정"].partition("#")
            가리킴.setdefault(이름.strip(), set()).add(int(번) if 번.strip().isdecimal() else 1)
    토막 = {}
    for d in seq.get("detail") or []:
        if isinstance(d, dict): 토막.setdefault(str(d.get("cut")), []).append(d)
    사람 = {id(d) for d in _사람컷(seq)}; out = {}
    for cut, 줄들 in 토막.items():
        if cut not in 자리: continue
        고름 = [d for n, d in enumerate(줄들, 1) if _글있음(d.get("감정자리")) or n in 가리킴.get(cut, ())]
        고름 = [d for d in (고름 or 줄들) if id(d) in 사람] or [d for d in 줄들 if id(d) in 사람]   # 가리킨 토막에 사람이 없으면 그 컷의 사람 토막을 본다
        if 고름: out[cut] = 고름
    return out


def _감정잴토막(seq):
    """얼굴 폭을 잴 토막 → {컷: 토막 줄}. 그 컷의 감정 토막 가운데 읽을 수 있는 「창」으로 잘라 쓰지 않고(_창있음) 「감정부위」가 몸 갈래가 아닌 첫 토막.
    그런 토막이 없는 컷은 재지 않는다(감정 토막이 잘라 쓰는 토막뿐이면 옆 토막이 안 잘라도 재지 않는다)."""
    out = {}
    for cut, 줄들 in _감정토막(seq).items():
        for d in 줄들:
            if not _창있음(d.get("창")) and 감정부위(d) != "몸": out[cut] = d; break
    return out


def 감정자리검사(seq, 폴더=None):
    """T28(표) — 사람이 나오는 편에는 감정 자리가 하나는 있어야 한다(33) → [(등급, 어디, 글)]. 그 자리의 얼굴 폭은 감정자리항목()이 그림에서 잰다."""
    사람컷 = _사람컷(seq)
    if not 사람컷: return []
    자리 = 감정자리컷(seq)
    날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 감정앵글부터) else "주의"
    out = []; 본 = set()
    if not any(str(d.get("cut")) in 자리 for d in 사람컷):
        out.append((등급, "표", "사람이 나오는 편인데 감정 자리가 하나도 없다 — 감정이 보여야 하는 컷에 「감정자리」(누가 — 무엇을 느끼나)를 적거나 사건 표의 「감정」 칸에 그 컷을 적는다. "
                 "그 컷의 시작 그림은 얼굴이 가깝게 잡혀야 한다(얼굴 폭이 가로 그림 25% · 세로 그림 35%부터 — 손 · 숨으로 보이는 자리는 「감정부위」)(33)"))
    for d in seq.get("detail") or []:   # 글이 아닌 「감정자리」(배열 · 객체 · 수 · true)는 다른 감정 자리가 있어도 건다 — false는 「감정 자리가 아니다」로 읽는다
        if isinstance(d, dict) and d.get("감정자리") is not None and d.get("감정자리") is not False and not isinstance(d["감정자리"], str):
            out.append((등급, str(d.get("cut")), "「감정자리」는 글로 적는다(누가 — 무엇을 느끼나) — 배열 · 객체 · 수 · 참거짓은 칸을 채운 것이 아니다(33)"))
    for cut, d in ((cut, d) for cut, 줄들 in _감정토막(seq).items() for d in 줄들):   # 감정 토막마다 본다(둘째 토막도)
        if 감정부위(d) is None and (cut, 한칸(d.get("감정부위"))) not in 본:
            본.add((cut, 한칸(d.get("감정부위"))))
            out.append((등급, cut, f"「감정부위」의 「{한칸(d.get('감정부위'))[:20]}」은 정한 낱말이 아니다 — {' · '.join(감정부위낱말['얼굴'])}(얼굴 폭을 잰다) / {' · '.join(감정부위낱말['몸'])}(재지 않는다) "
                        f"가운데 하나로 시작한다. 풀이는 낱말 뒤에 붙인다(「손 — 입가를 가린다」)(33)"))
    return out


def _앵글값(d):
    """컷의 「앵글」 → (값: (크기, 높이, 방향) 낱말 | None, 빠진 칸 목록, 낱말 밖 [(칸, 적은 글)]). 낱말 뒤의 풀이(「시점 — 아이의 눈」)는 떼고 견준다."""
    a = d.get("앵글") if isinstance(d.get("앵글"), dict) else {}
    값, 빠짐, 밖 = [], [], []
    for k in ("크기", "높이", "방향"):
        if 빈칸(a.get(k)): 빠짐.append(k); continue
        v = 구도정리(a[k]); 낱 = next((w for w in sorted(앵글낱말[k], key=len, reverse=True) if v.startswith(구도정리(w))), None)
        if 낱 is None: 밖.append((k, 한칸(a[k])[:14]))
        else: 값.append(낱)
    return (tuple(값) if len(값) == 3 else None), 빠짐, 밖


def 앵글검사(seq, 폴더=None):
    """T29 — 컷마다 「앵글」(크기 · 높이 · 방향 · 까닭)을 적고, 이웃 컷과 세 칸이 모두 같으면 걸림(50) → [(등급, 어디, 글)]. 까닭과 낱말은 위 머리말."""
    det = [d for d in seq.get("detail") or [] if isinstance(d, dict)]
    if not det: return []
    날짜 = 편날짜(seq, 폴더); 센 = "걸림" if (날짜 and 날짜 >= 감정앵글부터) else "주의"
    낱말글 = " / ".join(f"{k}: {' · '.join(v)}" for k, v in 앵글낱말.items())
    읽음 = [_앵글값(d) for d in det]; out = []
    없는 = [d.get("cut", "?") for d, (값, 빠짐, 밖) in zip(det, 읽음) if 빠짐]
    if 없는:
        out.append((센, "표", f"컷 {len(없는)}개({' · '.join(map(str, 없는[:6]))}{' …' if len(없는) > 6 else ''})에 「앵글」의 크기 · 높이 · 방향 칸이 없다 — 컷마다 세 칸과 「까닭」을 적는다"
                    f"({낱말글}). 이웃 컷과 세 칸이 모두 같으면 같은 앵글이 이어진다(50)"))
    for d, (값, 빠짐, 밖) in zip(det, 읽음):
        cut = d.get("cut", "?")
        for k, 글 in 밖: out.append((센, cut, f"「앵글.{k}」의 「{글}」은 정한 낱말이 아니다 — {' · '.join(앵글낱말[k])} 가운데 하나로 시작한다(뒤에 풀이를 붙여도 된다)(50)"))
        if 값 is not None and not _글있음((d.get("앵글") or {}).get("까닭")):
            out.append((센, cut, "「앵글.까닭」 칸이 비었다 — 왜 이 크기 · 높이 · 방향인지 한 줄로 적는다(누구의 눈으로 보나 · 앞뒤 컷과 무엇을 잇나 · 그 순간 무엇을 크게 보이나)(50)"))
    판 = lambda d: d["판"].strip() if isinstance(d.get("판"), str) and d["판"].strip() else str(d.get("cut"))
    한판 = lambda a, b: 판(a) == 판(b) or (_시작그림열쇠(a, 폴더) is not None and _시작그림열쇠(a, 폴더) == _시작그림열쇠(b, 폴더))
    # 이어 찍은 컷이거나, 「같은판」을 밝힌 컷이 바로 앞 컷과 한 판(같은 「판」 · 같은 첫 시작 그림 — 관문 판 도구가 여는 그림)을 나눠 쓸 때만 뺀다 — 떨어진 컷과 판을 나누는 것은 이웃 비교를 건너뛸 까닭이 아니다(GA2)
    이어 = lambda 앞, d: d.get("이어찍기") is True or (같은판밝힘(d) and 한판(앞, d))
    둘같음 = []
    for i in range(1, len(det)):
        a, b = 읽음[i - 1][0], 읽음[i][0]
        if a is None or b is None or 이어(det[i - 1], det[i]) or det[i].get("cut") == det[i - 1].get("cut"): continue
        if a == b:
            out.append((센, det[i].get("cut", "?"), f"앵글이 앞 컷 {det[i - 1].get('cut')}과 크기 · 높이 · 방향 모두 같다({' · '.join(b)}) — 셋 가운데 적어도 하나를 그 순간에 맞게 바꾼다"
                        f"(맞받는 두 사람은 로우 · 하이로, 보는 것과 보는 얼굴은 물건 너머로, 힘을 쓰는 순간은 아래에서). 이어 찍은 컷이면 이어찍기: true(50)"))
        elif i >= 2 and 읽음[i - 2][0] is not None and not 이어(det[i - 2], det[i - 1]):
            c = 읽음[i - 2][0]; 같은칸 = [k for n, k in enumerate(("크기", "높이", "방향")) if a[n] == b[n] == c[n]]
            if len(같은칸) == 2: 둘같음.append((det[i - 2].get("cut"), det[i].get("cut"), 같은칸))
    if 둘같음:
        x = 둘같음[0]
        out.append(("주의", "표", f"세 컷이 잇달아 같은 두 칸을 쓴다 — {x[0]}~{x[1]}({' · '.join(x[2])}){f' 외 {len(둘같음) - 1}곳' if len(둘같음) > 1 else ''}. 한 칸만 바꾼 앵글이 이어지면 같은 그림으로 읽힌다(50)"))
    if 날짜 and 날짜 >= 감정앵글부터:   # 뻔한 구도 비율(33) — 주의만. 까닭과 출발값은 위 머리말
        사람id = {id(d) for d in _사람컷(seq)}
        사람 = [(d.get("cut", "?"), 값) for d, (값, _빠짐, _밖) in zip(det, 읽음) if id(d) in 사람id and 값 is not None]
        뻔 = [c for c, 값 in 사람 if 값 == 뻔한앵글]
        if len(사람) >= 3 and len(뻔) >= 2 and len(뻔) * 3 > len(사람):
            out.append(("주의", "표", f"사람 컷 {len(사람)}개 가운데 {len(뻔)}개({' · '.join(map(str, 뻔[:6]))}{' …' if len(뻔) > 6 else ''})가 허리 위 · 눈높이 · 정면이다 — 3분의 1을 넘는다. "
                        "감정이 움직이는 컷은 그 부위가 화면을 채우게 가까이 잡고, 올려다봄 · 내려다봄 · 옆얼굴 · 어깨 너머 · 물건 너머를 섞는다(33 · 제작 규칙 「감정은 가까운 컷과 여러 장치로」)"))
    out += 팩앵글검사(seq, [값 for 값, _빠짐, _밖 in 읽음])
    out += 렌즈검사(seq, 폴더, det, 읽음)
    out += 기법검사(seq, 폴더, det)
    return out


def _렌즈값(v):
    """「렌즈」 값 → mm(수) | None. 수 칸이라 컷표읽기가 숫자 글을 수로 바꿔 넘긴다 — 참거짓 · 글 · 목록은 값이 아니다."""
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf") else None


def _mm(x):
    return f"{x:g}mm"


def 렌즈검사(seq, 폴더, det, 읽음):
    """T29 렌즈 → [(등급, 어디, 글)]. det · 읽음은 앵글검사의 컷 줄과 _앵글값(). 까닭은 렌즈부터 위 머리말."""
    날짜 = 편날짜(seq, 폴더); 센 = "걸림" if (날짜 and 날짜 >= 렌즈부터) else "주의"
    묶음 = [x for x in map(_렌즈값, seq["렌즈"]) if x is not None] if isinstance(seq.get("렌즈"), list) else []
    컷렌즈 = {id(d): _렌즈값((d.get("앵글") if isinstance(d.get("앵글"), dict) else {}).get("렌즈")) for d in det}
    out = []
    if 날짜 and 날짜 >= 렌즈부터:
        if not 묶음:
            out.append(("걸림", "표", f"맨 위 「렌즈」(편의 렌즈 묶음)가 없다 — 색감과 같이 mm 둘~넷을 고른다(예: [35, 50, 85]). 컷마다 「앵글.렌즈」는 이 가운데 하나다({렌즈계획})"))
        없는 = [d.get("cut", "?") for d in det if 컷렌즈[id(d)] is None]
        if 없는:
            out.append(("걸림", "표", f"컷 {len(없는)}개({' · '.join(map(str, 없는[:6]))}{' …' if len(없는) > 6 else ''})에 「앵글.렌즈」(mm 숫자)가 없다 — 컷마다 편의 렌즈 묶음 가운데 하나를 적는다. "
                        f"이미지 지시문 FRAME 줄이 그 mm를 그대로 쓴다({렌즈계획})"))
    밖 = [x for x in 묶음 if not 렌즈범위[0] <= x <= 렌즈범위[1]]
    if 밖: out.append((센, "표", f"맨 위 「렌즈」의 {' · '.join(map(_mm, 밖))}는 렌즈 값으로 읽히지 않는다 — {렌즈범위[0]}~{렌즈범위[1]} 사이 mm 숫자로 적는다"))
    if len(set(묶음)) > 4:
        out.append(("주의", "표", f"렌즈 묶음이 {len(set(묶음))}개다({' · '.join(map(_mm, sorted(set(묶음))))}) — 한 편은 둘~넷으로 찍는다. 렌즈가 많으면 컷마다 다른 세계로 보인다({렌즈계획})"))
    사람id = {id(d) for d in _사람컷(seq)}; 무리 = {}
    for d, (값, _빠짐, _밖) in zip(det, 읽음):
        mm = 컷렌즈[id(d)]; cut = d.get("cut", "?")
        if mm is None: continue
        if not 렌즈범위[0] <= mm <= 렌즈범위[1]:
            out.append((센, cut, f"「앵글.렌즈」 {_mm(mm)}는 렌즈 값으로 읽히지 않는다 — {렌즈범위[0]}~{렌즈범위[1]} 사이 mm 숫자로 적는다")); continue
        if 묶음 and mm not in 묶음:
            out.append((센, cut, f"「앵글.렌즈」 {_mm(mm)}가 편의 렌즈 묶음({' · '.join(map(_mm, 묶음))})에 없다 — 묶음 가운데 하나를 쓰거나, 꼭 필요한 렌즈면 묶음에 더한다({렌즈계획})"))
        if 값 is None or id(d) not in 사람id: continue
        까닭 = (d.get("앵글") or {}).get("까닭")
        if 값[0] in ("극접", "클로즈") and mm < 35 and not re.search(r"넓은 렌즈|광각", 까닭 if isinstance(까닭, str) else ""):
            out.append(("주의", cut, f"얼굴 가까운 컷({값[0]})을 {_mm(mm)}로 잡았다 — 35mm 아래로 얼굴에 다가가면 코 · 이마가 커지고 얼굴이 길어져 다른 사람처럼 보인다. "
                        f"일부러면(코믹 · B급의 넓은 렌즈 얼굴) 「앵글.까닭」에 「넓은 렌즈」를 적는다({렌즈계획})"))
        if 값[0] in ("클로즈", "가슴 위") and isinstance(d.get("장면"), str) and d["장면"].strip():
            무리.setdefault((d["장면"].strip(), 값[0]), {}).setdefault(mm, []).append(str(cut))
    for (장면, 크기), 갈래 in 무리.items():
        if len(갈래) > 1:
            out.append(("주의", "표", f"장면 「{장면}」의 {크기} 사람 컷이 렌즈 {len(갈래)}개로 갈린다({' / '.join(_mm(mm) + ' ' + ' · '.join(cs[:4]) for mm, cs in 갈래.items())}) — "
                        f"맞받는 얼굴과 같은 사람의 같은 크기는 렌즈를 맞춘다. 렌즈가 다르면 얼굴 비율이 달라져 다른 사람처럼 보인다({렌즈계획})"))
    return out


def 기법사전():
    """카메라 기법 사전 → ({이름: 줄}, {컨셉: 줄}, None). 못 읽으면 (None, None, 까닭)."""
    global _기법사전캐시
    if _기법사전캐시 is None:
        try:
            raw = json.loads(기법사전경로.read_text(encoding="utf-8"))
            표 = {x["이름"]: x for x in raw.get("기법", []) if isinstance(x, dict) and isinstance(x.get("이름"), str)}
            _기법사전캐시 = (표, raw.get("컨셉") if isinstance(raw.get("컨셉"), dict) else {}, None)
        except (OSError, ValueError, TypeError, AttributeError) as e:
            _기법사전캐시 = (None, None, f"{기법사전경로.name}: {e}")
    return _기법사전캐시


글자부터 = "20261126"   # T32 · 글자 · CG 사전의 컨셉 줄(피함 · 말자막 꼴 고르심)은 이날부터 시작한 편만 — 진행 중인 공모 네 편(11-24)을 덮지 않는다
글자사전경로 = Path(os.environ.get("SYNK_TEXT_CG_FILE") or (빛이름표경로.parent / "글자CG.json"))   # 시험은 사전을 바꿔 끼운다(SYNK_CONCEPT_PACK_DIR와 같은 길)
_글자사전캐시 = None


def 글자사전():
    """글자 · CG 사전(11-25 「자막 · CG 양식」) → ({이름: 줄}, {컨셉: 줄}, None). 못 읽으면 (None, None, 까닭) — 그때는 옛 여섯 이름만 받는다.
    「컨셉」 칸만 표가 아니면 ({이름: 줄}, None, 까닭)이다. 컨셉 줄을 못 읽으면 T32 범위 편에 그 까닭을 알린다(11-25 GPT 검수 2회차 GA1)."""
    global _글자사전캐시
    if _글자사전캐시 is None:
        try:
            raw = json.loads(글자사전경로.read_text(encoding="utf-8"))
            표 = {x["이름"]: x for x in raw.get("종류", []) if isinstance(x, dict) and isinstance(x.get("이름"), str) and x.get("컷표") in 글자종류}
            컨셉들 = raw.get("컨셉")
            _글자사전캐시 = (표, 컨셉들, None) if isinstance(컨셉들, dict) else (표, None, f"{글자사전경로.name}: 「컨셉」 칸이 표가 아니다")
        except (OSError, ValueError, TypeError, AttributeError) as e:
            _글자사전캐시 = (None, None, f"{글자사전경로.name}: {e}")
    return _글자사전캐시


def _기법들(d):
    """컷의 「앵글.기법」 → 이름 목록(글 하나 · 글 목록). 다른 꼴은 빈 목록이다(꼴 관문이 걸림으로 낸다)."""
    a = d.get("앵글") if isinstance(d.get("앵글"), dict) else {}
    v = a.get("기법")
    if isinstance(v, str): v = [v]
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def _가까운기법(n, 표):
    import difflib
    비슷 = difflib.get_close_matches(n, list(표), n=2, cutoff=0.5)
    return f"(「{'」 · 「'.join(비슷)}」?)" if 비슷 else ""


def 기법검사(seq, 폴더, det):
    """T29 카메라 기법 → [(등급, 어디, 글)]. det는 앵글검사의 컷 줄. 까닭은 기법부터 위 머리말."""
    표, 컨셉표, 탈 = 기법사전()
    날짜 = 편날짜(seq, 폴더); 새편 = bool(날짜 and 날짜 >= 기법부터); 센 = "걸림" if 새편 else "주의"
    if 표 is None:   # 사전을 못 읽으면 새 편은 막는다 — 이름도 낱말도 대조하지 못한 채 지나가지 않게(GA2)
        return [(센, "표", f"카메라 기법 사전을 못 읽어 「앵글.기법」을 보지 못했다 — {탈}")] if any(_기법들(d) for d in det) else []
    컨셉 = seq["컨셉"].strip() if isinstance(seq.get("컨셉"), str) else ""
    줄 = 컨셉표.get(컨셉) if isinstance(컨셉표.get(컨셉), dict) else {}
    피함 = set(줄.get("피함") or [])
    out = []; 큰 = []; 쓴 = []
    for d in det:
        cut = d.get("cut", "?"); 이름들 = _기법들(d)
        없음 = [n for n in 이름들 if n not in 표]
        if 없음:
            out.append((센, cut, f"「앵글.기법」의 {' · '.join('「' + n + '」' for n in 없음)}은 카메라 기법 사전에 없다 — 사전의 이름으로 적는다{_가까운기법(없음[0], 표)}(영상양식/카메라기법.json)"))
        아는 = [표[n] for n in dict.fromkeys(이름들) if n in 표]
        쓴 += [x["이름"] for x in 아는]
        큰.append([x["이름"] for x in 아는 if x.get("큰움직임")])
        for x in 아는:
            if x.get("시험먼저"):
                out.append(("주의", cut, f"「{x['이름']}」은 시험부터 — 그 판을 480p로 먼저 굽고 얼굴 · 몸 · 배경이 무너지지 않는지 본 뒤 키운다"
                            + (f". {x['조심']}" if isinstance(x.get("조심"), str) and x["조심"].strip() else "")))
            if x["이름"] in 피함:
                out.append(("주의", cut, f"「{x['이름']}」은 {컨셉} 컨셉이 피하는 기법이다 — {줄.get('피함까닭') or '영상양식/카메라기법.json의 컨셉 줄'}"))
        길 = [x["이름"] for x in 아는 if x.get("길")]
        if len(길) > 1:
            out.append(("주의", cut, f"한 컷에 카메라 경로가 둘이다({' · '.join(길)}) — 한 판에는 움직임을 하나만 쓴다(둘을 함께 걸면 모델이 하나를 버리거나 경로를 벗어난다). "
                        "둘 다 필요하면 컷을 나누거나 시간 구간(0–3s · 3–5s)으로 차례를 준다"))
    여러번 = [n for n in dict.fromkeys(쓴) if 표[n].get("한번") and 쓴.count(n) > 1]
    if 여러번:
        out.append(("주의", "표", f"{' · '.join('「' + n + '」 ' + str(쓴.count(n)) + '번' for n in 여러번)} — 한 편에 한 번만 쓰는 기법이다. 볼거리가 정점에 이르는 한 박에 남기고 나머지는 바꾼다"))
    for i in range(1, len(det)):
        if 큰[i] and 큰[i - 1] and det[i].get("이어찍기") is not True:
            out.append(("주의", det[i].get("cut", "?"), f"큰 움직임이 앞 컷 {det[i - 1].get('cut')}에 이어 또 온다({' · '.join(큰[i - 1])} → {' · '.join(큰[i])}) — "
                        "사이에 고정이나 느린 컷을 끼운다(멀미 — 11-20 유호님)"))
    if 새편 and 줄 and len(det) >= 6:
        다른 = sorted({n for n in 쓴 if n != "고정"})
        최소 = 줄["최소"] if isinstance(줄.get("최소"), int) and not isinstance(줄.get("최소"), bool) else 2
        if len(다른) < 최소:
            out.append(("주의", "표", f"카메라 기법이 {len(다른)}가지뿐이다({' · '.join(다른) or '없음'}) — {컨셉} 컨셉은 컷 {len(det)}개에 고정 말고 {최소}가지부터 쓴다. "
                        f"자주 쓰는 것: {' · '.join(줄.get('자주') or [])}(영상양식/카메라기법.json)"))
    return out


def _기법글(s):
    """낱말 대조용 — 소문자로 바꾸고 글자 · 숫자가 아닌 것은 띄어 쓴 한 칸으로(「whip-pan」 = 「whip pan」).
    문장 끝(. ; ! ? 줄바꿈 · 칸 경계 「|」)은 「||」, 쉼표 · 쌍점 · 줄표는 「|」로 남긴다. 둘 다 낱말이 건너 붙지 않게 막고(「… a time. Stops …」 → time stops · r2 GA3),
    부정은 「||」 사이 한 문장에서 본다(_낱말있음). 숫자 사이의 점(1.5 s)은 문장 끝이 아니다(Fable 설계 검토 11-25).
    줄임 부정(don't · can't)과 cannot은 「not」으로 푼다 — 낱자 t를 부정어로 두면 「t=1.5 s」의 t까지 부정으로 읽었다(r4 GA1)."""
    t = re.sub(r"(?<=\d)\.(?=\d)", " ", str(s).lower()).replace("|", "\n")
    t = re.sub(r"\bcannot\b", "can not", re.sub(r"n['’]t\b", " not", t))
    t = re.sub(r"[,:—–]+", " | ", re.sub(r"[.;!?\n]+", " || ", t))
    return " " + re.sub(r"[^0-9a-z가-힣|]+", " ", t).strip() + " "


_기법부정 = {"no", "not", "never", "without", "avoid", "avoids", "avoiding", "nor", "instead", "rather"}
_찾는칸 = {"카메라": ("CAMERA",), "그림": ("FRAME", ""), "연기": ("ACTION",), "머리": ("",), "샷": ("", "CAMERA")}   # 「전체」는 모든 칸 · ""는 첫 라벨 앞의 머리 글(샷 머리 · 매체 첫 문장)
_찾는자리말 = {"카메라": "CAMERA 줄", "그림": "FRAME 줄(이나 첫 문장)", "연기": "ACTION 줄", "머리": "샷 머리(첫 라벨 앞)", "샷": "샷 머리나 CAMERA 줄", "전체": "지시문"}


def _낱말있음(본글, w):
    """정리한 글(_기법글)에 낱말 w가 부정어 없는 문장에 나오나 — 낱말이 든 문장(「||」 사이)에 no · not · never · without · instead …가 하나라도 있으면
    낱말 앞이든 뒤든 그 자리는 세지 않는다(「No whip pan」 · 「No pans, including whip pans」 · 「Do not zoom but use a whip pan」 — GA5 · r3 · Fable 설계 검토 11-25).
    「No zoom. Whip pan right.」의 휩 팬은 센다(r2 GA2). 부정어 없이 금하는 문장(「Whip pans are forbidden」)은 보지 않는다 — 검수자 몫(지시문 흠 표 지17)."""
    키 = _기법글(w); i = 본글.find(키)
    while i != -1:
        앞, 뒤 = 본글[:i].split(), 본글[i + len(키):].split()
        a = max((j for j, x in enumerate(앞) if x == "||"), default=-1)
        b = next((j for j, x in enumerate(뒤) if x == "||"), len(뒤))
        if not set(앞[a + 1:] + 뒤[:b]) & _기법부정: return True
        i = 본글.find(키, i + 1)
    return False


def _기법샷들(글):
    """지시문 → (머리 칸들, [샷마다의 칸들]). 「SHOT n」 라벨이 없으면 샷 하나(빈 목록)다."""
    머리, 샷 = [], []
    for l, t in 칸들(글):
        if l.startswith("SHOT "): 샷.append([(l, t)])
        elif 샷: 샷[-1].append((l, t))
        else: 머리.append((l, t))
    return 머리, (샷 or [[]])


def 기법대조(seq, 컷들, 글, 폴더=None, 곳="영상"):
    """지시문에 컷표 「앵글.기법」의 낱말이 들었나(11-25 · 기법부터 위 머리말) → [(등급, 글)].
    곳: 「영상」이면 영상 지시문(만드는곳이 영상인 기법), 「그림」이면 이미지 지시문(만드는곳이 그림인 기법). 사전의 낱말 가운데 하나만 있으면 된다.
    찾는 자리는 기법의 「찾는곳」(없으면 영상은 CAMERA 칸, 그림은 FRAME 칸과 첫 문장)이다 — 지시문 어디든 보면 사람 동작(moves closer)이 카메라 기법으로 읽힌다(GA3).
    낱말은 부정어 없는 문장에 있어야 센다(_낱말있음). 사전을 못 읽으면 새 편은 걸림(GA2).
    컷이 여럿인 판은 SHOT 1 · SHOT 2로 나눠 컷마다 제 SHOT만 본다(SHOT 1 = 첫 컷 · GA4). SHOT을 썼으면 컷 수만큼 1부터 차례여야 하고(r4 GA2),
    컷마다 영상 기법이 다른데 나누지 않았으면 새 편은 걸림이다(r3 GA5) — 한 번에 이어 찍는 판(컷표 뒤 컷이 모두 이어찍기: true)만 나눌 수 없어 주의다.
    지시문 글의 continuous는 이어 찍는 표시로 믿지 않는다(「continuous room tone」 · r4 GA6).
    이 대조는 낱말의 꼴과 자리만 보는 형식 관문이다 — 부정어 없이 금하는 문장, 이어 찍는 판 안의 기법 차례, 낱말은 맞지만 다른 움직임을 그린 문장,
    약어의 점(e.g. · incl.)에서 끊긴 부정과 따옴표 없는 줄임(Dont)은 지시문 검수자가 흠 표 지17로 본다(GPT 검수 세 회차 뒤 Fable 설계 검토 11-25 · r4 덧붙임).
    약어 목록이나 부정어 목록을 늘려 닫지 않는다 — 늘릴 때마다 반대쪽이 샜다."""
    표, _컨셉표, 탈 = 기법사전()
    날짜 = 편날짜(seq, 폴더); 센 = "걸림" if (날짜 and 날짜 >= 기법부터) else "주의"
    줄들 = {d.get("cut"): d for d in (seq.get("detail") or []) if isinstance(d, dict)}
    if not any(_기법들(줄들[c]) for c in 컷들 if c in 줄들): return []
    if 표 is None: return [(센, f"카메라 기법 사전을 못 읽어 컷표 「앵글.기법」을 지시문과 대조하지 못했다 — {탈}")]
    머리, 샷 = _기법샷들(글)
    샷수 = sum(1 for s in 샷 if s)
    이름 = " · ".join(map(str, 컷들))
    이어 = len(컷들) > 1 and all((줄들.get(c) or {}).get("이어찍기") is True for c in 컷들[1:])   # 한 번에 이어 찍는 판 — 컷표 칸만 믿는다(r4 GA6)
    if len(컷들) > 1 and 샷수 and not (이어 and 샷수 == 1):   # SHOT을 썼으면 컷 수만큼 1부터 차례로 — 빠지거나 뒤집히면 나온 차례로 잘못 짝짓는다(Fable 설계 검토 · r4 GA2). 이어 찍는 판의 SHOT 하나는 나누지 않은 판이다(r5 GA1)
        번호 = [int(m.group(1)) for s in 샷 for m in [re.match(r"SHOT (\d+)", s[0][0])] if m]
        if 번호 != list(range(1, len(컷들) + 1)):
            return [(센, f"컷 {이름}의 판에서 SHOT 번호가 1부터 차례가 아니다({' · '.join(f'SHOT {k}' for k in 번호)}) — 컷 차례대로 SHOT 1부터 컷 수만큼 쓴다")]
    나눔 = len(컷들) > 1 and 샷수 == len(컷들)
    out = []
    if len(컷들) > 1 and not 나눔:   # SHOT 없이 컷 둘 이상을 한 판에 — 컷마다 영상 기법이 다르면 어느 샷의 것인지 가를 수 없다(r2 GA6 · r3 GA5)
        갈래 = {tuple(sorted(n for n in _기법들(줄들[c]) if (표.get(n) or {}).get("만드는곳") == 곳)) for c in 컷들 if c in 줄들}
        if len(갈래) > 1:
            if 이어:
                out.append(("주의", f"컷 {이름}의 판은 한 번에 이어 찍는 샷이라 컷마다 기법을 가를 수 없다 — 기법 차례는 지시문 검수자가 본다(지시문 흠 표 지17)"))
            else:
                return [(센, f"컷 {이름}의 판이 SHOT으로 나뉘지 않아 컷마다 기법을 가를 수 없다 — 샷 머리 아래를 SHOT 1 (0–2 s) · SHOT 2 (2–4 s)로 나눠 SHOT마다 ACTION · CAMERA를 쓴다. "
                            "한 번에 이어 찍어 컷 둘로 쓰는 판이면 컷표 뒤 컷에 이어찍기: true를 적는다")]
    for i, c in enumerate(컷들):
        d = 줄들.get(c)
        if d is None: continue
        칸목록 = 머리 + (샷[i] if 나눔 else [x for s in 샷 for x in s])
        for n in _기법들(d):
            x = 표.get(n)
            if not x or x.get("만드는곳") != 곳: continue
            낱말 = [w for w in x.get("낱말") or [] if isinstance(w, str) and w.strip()]
            찾는곳 = x.get("찾는곳") if x.get("찾는곳") in _찾는자리말 else ("카메라" if 곳 == "영상" else "그림")
            본글 = _기법글("\n".join(t for l, t in 칸목록 if 찾는곳 == "전체" or l in _찾는칸[찾는곳]))   # 칸 사이는 문장 끝이다(r2 GA3)
            if 낱말 and not any(_낱말있음(본글, w) for w in 낱말):
                자리 = _찾는자리말[찾는곳] + (f"(SHOT {i + 1})" if 나눔 else "")
                if any(_기법글(w) in 본글 for w in 낱말):
                    out.append((센, f"컷 {c}의 기법 「{n}」 낱말이 {자리}에서 부정어(no · not · never · without · instead)가 든 문장에만 있다 — "
                                "기법은 부정어 없는 한 문장으로 쓰고 금지는 다른 문장으로 뗀다(「Locked-off. No zoom.」 · 지시문 흠 표 지17)"))
                else:
                    out.append((센, f"컷 {c}의 기법 「{n}」이 {자리}에 없다 — 「{낱말[0]}」{('(또는 ' + ' · '.join(낱말[1:3]) + ')') if len(낱말) > 1 else ''}를 쓴다(영상양식/카메라기법.json)"))
    return out


def 렌즈지시문검사(seq, d, cut, 원문, 폴더=None):
    """이미지 지시문의 렌즈 mm가 컷표 「앵글.렌즈」와 같은가(11-25 · 렌즈부터 위 머리말) → [(등급, 글)].
    FRAME 줄에 그 mm가 있어야 하고 지시문 어디에도 다른 mm가 없어야 한다 — 첫 문장의 카메라 줄에 렌즈를 박으면 컷마다 다른 FRAME과 부딪친다(지시문 흠 표 지16).
    필름 · 카메라 판형을 뜻하는 mm(「35mm film」 · 「35mm compact camera」)는 렌즈로 세지 않는다. 끝 · 가운데 그림은 줌으로 렌즈가 바뀌는 컷이 있어 주의로 낮춘다."""
    mm = _렌즈값((d.get("앵글") if isinstance(d.get("앵글"), dict) else {}).get("렌즈"))
    if mm is None: return []   # 칸이 빈 것은 T29가 묻는다
    날짜 = 편날짜(seq, 폴더); 센 = "걸림" if (날짜 and 날짜 >= 렌즈부터 and not cut.endswith(("_끝", "_가운데"))) else "주의"
    틀에 = {float(x) for l, t in 칸들(원문) if l == "FRAME" for x in _초점mm.findall(t)}
    다른 = sorted({float(x) for x in _초점mm.findall(원문)} - {mm})
    if mm not in 틀에 and 다른:
        return [(센, f"지시문의 렌즈 {' · '.join(map(_mm, 다른))}가 컷표 렌즈 {_mm(mm)}와 다르다 — FRAME 줄에 「{_mm(mm)} lens」 하나만 쓰고 다른 mm는 지운다(지시문 흠 표 지16)")]
    if mm not in 틀에: return [(센, f"FRAME 줄에 컷표 렌즈 {_mm(mm)}가 없다 — FRAME 줄에 「{_mm(mm)} lens」와 거리 · 화면 안 자리를 숫자로 적는다({렌즈계획})")]
    if 다른: return [(센, f"지시문에 컷표 렌즈 {_mm(mm)} 말고 {' · '.join(map(_mm, 다른))}가 있다 — 렌즈 숫자는 FRAME 줄에 하나만 쓴다. 둘이면 모델이 하나를 고른다(지시문 흠 표 지16)")]
    return []


def 감정자리판정(잰, 세로, 새편, 사람수=None):
    """T28(그림) — 감정 자리 시작 그림에서 잡힌 얼굴 폭들(% — 수 하나 · 목록, 못 찾았으면 None · 빈 목록) → (등급, 글).
    새편: 편 날짜가 감정앵글부터 이후인가(앞선 편은 걸림 → 주의, 확인 → 알림). 사람수: 컷표가 그 컷에 적은 사람 수(모르면 None).
    잰 값 그대로 아래선과 견준다 — 반올림해 넘기지 않는다(34.954%는 35%에 못 미친다). 적을 때는 소수 한 자리, 그 자리에서 판정과 어긋나 보이면 자릿수를 늘린다.
    가장 큰 얼굴도 아래선에 못 미치면 걸림. 얼굴이 여럿이고 못 미치는 얼굴이 섞였거나, 잡힌 얼굴 수가 사람 수와 다르면 확인 —
    감정을 맡은 얼굴이 어느 것인지, 안 잡힌 얼굴이 그 얼굴인지는 눈이 본다."""
    쪽 = "세로" if 세로 else "가로"; 선 = 감정자리아래선[쪽]; 무름 = "확인" if 새편 else "알림"
    폭들 = sorted((float(x) for x in (잰 if isinstance(잰, (list, tuple)) else [] if 잰 is None else [잰])), reverse=True)
    if not 폭들:
        return 무름, "감정 자리인데 얼굴을 못 찾았다 — 얼굴이 아주 작거나 돌아선 그림인지 눈으로 본다. 손 · 숨으로 보이는 자리면 컷에 「감정부위」를 적는다(33)"
    def 한(w):
        for 자리 in (1, 2, 3, 4):
            s = f"{w:.{자리}f}"
            if (float(s) < 선) == (w < 선): return s + "%"
        return f"{int(w * 10) / 10:.1f}%"   # 아래선에 아주 조금 못 미치는 값 — 올려 적지 않고 내려 적는다
    적음 = " · ".join(한(w) for w in 폭들)
    if 폭들[0] < 선:
        return ("걸림" if 새편 else "주의"), (f"감정 자리인데 얼굴 폭이 그림 폭의 {적음}다 — {쪽} 그림의 아래선 {선:g}%에 못 미쳐 표정이 안 읽힌다. 그림 엔진은 미디엄을 주문해도 넓게 그린다 — "
                                         f"이미지 지시문 FRAME 줄에 어디서 자르는지와 얼굴 폭을 적어 다시 굽거나 가깝게 잘라 쓴다(33)")
    if 폭들[-1] < 선:
        return 무름, (f"감정 자리에 얼굴이 {len(폭들)}개 잡혔다({적음}) — {쪽} 그림의 아래선 {선:g}%에 못 미치는 얼굴이 있다. 감정을 맡은 인물의 얼굴이 어느 것인지 눈으로 보고, "
                    f"그 얼굴이 작으면 다시 굽는다(33)")
    if isinstance(사람수, int) and not isinstance(사람수, bool) and len(폭들) < 사람수:
        return 무름, (f"감정 자리 컷의 사람은 {사람수}명인데 얼굴은 {len(폭들)}개만 잡혔다({적음}) — 안 잡힌 얼굴이 감정을 맡은 인물의 얼굴인지 눈으로 보고, "
                    f"그 얼굴이 작거나 가렸으면 다시 굽는다(33)")
    if isinstance(사람수, int) and not isinstance(사람수, bool) and len(폭들) > 사람수:
        return 무름, (f"감정 자리 컷의 사람은 {사람수}명인데 얼굴은 {len(폭들)}개가 잡혔다({적음}) — 감정을 맡은 인물의 얼굴이 어느 것인지 눈으로 보고, "
                    f"그 얼굴이 작으면 다시 굽는다(33)")
    return "통과", f"감정 자리 얼굴 폭 {적음} — {쪽} 그림의 아래선 {선:g}% 이상"


# ───────── T30 시늉 박자(29) — 11-20 경산 공모전 편 ─────────
# 왜: 인물의 물음 하나를 빈손 숟가락 시늉에만 맡겼다. 그 컷에는 대사도 숟가락도 없었고, 영상 모델은 그 손을 입 가리기로 그렸다.
#   유호님 「처음에 할머니가 왜 입 막고 호호 부는지 이해도 안가」. 시늉 · 흉내 · 손짓은 그 몸짓을 아는 사람만 읽고, 영상 모델은 비슷한 다른 손동작으로 바꿔 그리기 쉽다.
#   그래서 시늉에 맡긴 뜻은 같은 컷의 말이나 손에 든 진짜 소품이 함께 받쳐야 한다.
# 걸림: 사람 컷의 「연기」 박자(표)나 영상 지시문의 ACTION 글(--지시문 · 크레딧내기의 굽기전)에 시늉 낱말이 있는데 같은 컷에 받침이 없다.
#   받침 ① 말: 맨 위 「소리.원고」에 그 컷 줄이 있다 · 컷 「소리」 칸이나 그 박자의 따옴표 속에 말이 있다. 「허」 · 「호호」처럼 감탄 소리 음절만 있으면 말이 아니다.
#           지시문은 SOUND · VOICE · DIALOGUE 칸과 ACTION 속 따옴표의 말도 본다. 「as if to say "this"」처럼 시늉이 대신 말하는 따옴표는 말이 아니다.
#        ② 소품: 시늉 박자(문장)에 이름이 나오고, 그 컷 「소품」 칸에서 화면에 있는 소품(화면밖 · 없음이 아님). 소품 표의 「낱말」(영어 이름)도 이름으로 친다.
#           「숟가락처럼」 · 「like a spoon」처럼 흉내 내는 대상으로만 나온 이름은 받침이 아니다.
# 낱말: 기존 지시문 523개를 재 보니 「as if」는 「as if reading」 · 「as if deciding」처럼 몸짓을 꾸미는 데 흔히 쓴다. 그래서 「as if to say」만 시늉으로 본다.
# 풀어 주는 칸: 컷의 "시늉까닭": "<말 · 소품 없이도 뜻이 읽히는 까닭>" — 걸림을 주의로 낮춘다(누구나 아는 손 흔들기 · 쉿 손가락처럼).
# 손 모양 시늉은 손을 무엇처럼 만드는 말만 — 「손을 숟가락처럼 오므려」 · 「cups her hand like a spoon」. 「손이 떨리는 것처럼」 · 「hands shake like a leaf」 같은 비유는 아니다
_시늉_한 = re.compile(r"시늉|흉내|손짓|(?:손|손가락|손바닥|주먹)[을를]\s+(?:\S+\s+)?\S+처럼\s*(?:오므|모아|모으|펴|펼|만들|쥐|구부|말아)")
_시늉_영 = re.compile(r"\b(?:panto)?mim(?:e|es|ed|ing)\b|\bpretend(?:s|ed|ing)?\b|\bimitat(?:e|es|ed|ing)\b|\bas (?:if|though) (?:to say|saying)\b"
                    r"|\b(?:cup|cups|cupped|cupping|shape|shapes|shaped|shaping|curl|curls|curled|curling|form|forms|formed|forming|make|makes|making|hold|holds|held|holding)\b"
                    r"[^.;:\n]{0,25}?\b(?:hand|hands|fingers?|fist|palm)\b[^.;:\n]{0,20}?\b(?:like|into) an?\b", re.I)
_흉내대상 = re.compile(r"\S+처럼|\blike an? [\w-]+(?: [\w-]+)?", re.I)
_따옴표 = re.compile(r"[「『“\"]([^」』”\"\n]{1,80})[」』”\"]")
_대신말 = re.compile(r"(?:as (?:if|though) (?:to say|saying)|like saying)\W{0,3}$", re.I)
_감탄음절 = set("허흠음아어오응헉휴하호히후에으엇앗쯧쳇흥핫헤읏윽악와엉잉")
_말칸 = ("SOUND", "VOICE", "DIALOGUE", "LINE", "LINES", "SPEECH", "NARRATION", "VO")


def _말인가(s):
    """따옴표 속 글이 말인가 — 글자(한글 · 로마자)가 둘 이상이고, 한글만이면 감탄 소리 음절로만 되지 않았다(「허」 · 「호호」 · 「아아」는 말이 아니다)."""
    글자 = re.sub(r"[^가-힣A-Za-zÀ-ỹ]", "", str(s))
    if len(글자) < 2: return False
    return not (re.fullmatch(r"[가-힣]+", 글자) and set(글자) <= _감탄음절)


def _따옴말(글):
    """글 속 따옴표의 말 하나(없으면 None). 시늉이 대신 말하는 따옴표(「as if to say "this"」)는 뺀다."""
    글 = str(글 or "")
    for m in _따옴표.finditer(글):
        if _대신말.search(글[max(0, m.start() - 24):m.start()]): continue
        if _말인가(m.group(1)): return m.group(1)
    return None


def _원고줄(seq, 컷):
    소리 = seq.get("소리") if isinstance(seq.get("소리"), dict) else {}
    for x in 소리.get("원고") if isinstance(소리.get("원고"), list) else []:
        c, 글 = (x[0], x[-1]) if isinstance(x, (list, tuple)) and len(x) >= 2 else ((x.get("컷"), x.get("글")) if isinstance(x, dict) else (None, None))
        if c == 컷 and isinstance(글, str) and _말인가(글): return 글
    return None


def _소품받침(seq, d, 글):
    """그 컷에서 화면에 있는 소품 가운데 시늉 글에 이름이 나오는 것(흉내 대상으로만 나온 이름은 뺀다) — 없으면 None"""
    상태 = d.get("소품") if isinstance(d.get("소품"), dict) else {}
    표 = seq.get("소품") if isinstance(seq.get("소품"), dict) else {}
    본글 = _흉내대상.sub(" ", str(글 or ""))
    for 이름, s in 상태.items():
        if not (isinstance(이름, str) and isinstance(s, str) and s.strip()) or 한칸(s) in ("화면밖", "없음"): continue
        줄 = 표.get(이름) if isinstance(표.get(이름), dict) else {}
        # 「로지휴지」 · 「찜쪽지」처럼 임자를 앞에 붙인 이름은 연기 글에 뒷부분(「휴지」)만 쓴다 — 두 글자 이상의 꼬리도 이름으로 친다
        꼬리 = [이름[i:] for i in range(1, len(이름) - 1)] if re.fullmatch(r"[가-힣]{3,}", 이름) else []
        for w in [이름, *꼬리, *[x for x in (줄.get("낱말") or []) if isinstance(x, str) and x.strip()]]:
            if (re.search(r"[가-힣]", w) and w in 본글) or re.search(r"\b" + re.escape(w) + r"\b", 본글, re.I): return 이름
    return None


def 시늉받침(seq, d, 글=""):
    """컷 d에서 시늉 글의 뜻을 받치는 것 — 「원고 …」 · 「소리 칸 …」 · 「따옴표 …」 · 「소품 …」 글 하나, 없으면 None"""
    if not isinstance(d, dict): return None
    줄 = _원고줄(seq, d.get("cut"))
    if 줄: return f"원고 「{줄}」"
    for 어디, 값 in (("소리 칸", d.get("소리")), ("박자 속 말", 글)):
        말 = _따옴말(값)
        if 말: return f"{어디} 「{말}」"
    소품 = _소품받침(seq, d, 글)
    return f"소품 「{소품}」" if 소품 else None


def _시늉글(무엇, 까닭=None):
    if not 빈칸(까닭):
        return "주의", f"시늉에 뜻을 맡긴 박자 {무엇} — 말 · 소품 받침은 없고 「시늉까닭」: {한칸(까닭)[:60]}(29 · T30)"
    return "걸림", (f"시늉에 뜻을 맡긴 박자 {무엇} — 같은 컷에 그 뜻을 받치는 말(소리.원고 · 「소리」 칸의 대사)도, 화면에 든 진짜 소품도 없다(29 · T30). "
                  "영상 모델은 시늉을 다른 손동작으로 그리기 쉽다(11-20 숟가락 시늉이 입 가리기로 나옴). 대사 한 줄을 넣거나 진짜 소품을 쥐여 주고, "
                  "말 · 소품 없이도 누구나 읽는 몸짓이면 컷에 「시늉까닭」을 적는다")


def 시늉검사(seq, 폴더=None):
    """T30 — 사람 컷의 「연기」 박자가 시늉 · 흉내 · 손짓에 뜻을 맡겼는데 같은 컷에 말 · 소품 받침이 없으면 걸림(29) → [(등급, 어디, 글)]. 까닭과 낱말은 위 머리말."""
    out = []
    for d in seq.get("detail") or []:
        if not isinstance(d, dict) or not (isinstance(d.get("인물"), list) and d["인물"]): continue
        for b in d.get("연기") if isinstance(d.get("연기"), list) else []:
            무엇 = str(b.get("무엇") or "") if isinstance(b, dict) else ""
            if not (_시늉_한.search(무엇) or _시늉_영.search(무엇)) or 시늉받침(seq, d, 무엇): continue
            t = 숫자(b.get("t"))
            등급, 말 = _시늉글(f"{'' if t is None else f'{t:g}초 '}「{한칸(무엇)[:50]}」", d.get("시늉까닭"))
            out.append((등급, d.get("cut", "?"), 말))
            break   # 컷마다 한 줄
    return out


def 시늉대조(seq, 컷들, 글):
    """T30 — 영상 지시문의 연기 글(ACTION, 없으면 카메라 · 빛 · 소리 칸 밖의 글)이 시늉에 뜻을 맡겼는데, 지시문의 말(SOUND · VOICE 칸 · 따옴표 속 대사)에도
    컷표 그 컷의 원고 · 소리 칸 · 화면 소품에도 받침이 없으면 걸림(29) → [(등급, 글)]. --지시문(지시문항목)과 크레딧내기.py의 굽기전이 같은 함수를 부른다."""
    칸 = 칸들(글)
    연기 = 연기글(글, 칸) or " ".join(t for l, t in 칸 if l not in ("CAMERA", "FRAME", "LOOK", "LIGHT", "PHYSICS", "NOTE", "PROPS", "INDOORS", "OUTDOORS", "SETTING", "PLACE", *_말칸))
    시늉문장 = [s for s in 문장들(연기) if _시늉_영.search(s) or _시늉_한.search(s)]
    if not 시늉문장: return []
    for l, t in 칸:
        if l in _말칸 and _따옴말(t): return []
    if _따옴말(연기): return []
    det = [d for d in (seq or {}).get("detail") or [] if isinstance(d, dict) and d.get("cut") in (컷들 or [])]
    if any(시늉받침(seq, d, " ".join(시늉문장)) for d in det): return []
    까닭 = next((d.get("시늉까닭") for d in det if not 빈칸(d.get("시늉까닭"))), None)
    등급, 말 = _시늉글(f"「{한칸(시늉문장[0])[:70]}」", 까닭)
    return [(등급, 말.replace("시늉에 뜻을 맡긴 박자", "ACTION이 시늉에 뜻을 맡겼다", 1))]


# ───────── T31 둘레 무리(26) — 11-21 공모전 편(제출 전이라 작품 내용은 적지 않는다) ─────────
# 왜: 둘레에 무리가 있는 장면을 720p로 다섯 번 구웠고(드리미나 660크레딧) 주인공 컷 세 판 모두 둘레 무리가 굳었다. 받은 뒤에야 알았고, 앞선 지적(26 · 11-14 · 11-18 「시작할 때 굳음」)은
#   점검표 글로만 있어 굽기 전에 아무것도 막지 않았다. 유호님 「저번에도 굳어있는거 지적했는데 여전히 또 굳어있네」 · 「근본적으로 이런 실수 안하게 고칠수없는거야?」.
#   까닭 셋: ① 컷표 · 지시문이 주인공 한 몸의 동작만 초 단위로 적고 둘레 무리는 한 줄뿐이었다. ② 끝 그림을 「둘레는 모두 같은 자리 그대로」로 구워
#   시작 · 끝 그림의 둘레가 같았다. ③ 끝 그림을 쓴 두 판이 모두 첫 1.5~2초를 시작 그림 그대로 붙들었다(받은 판의 그 구간 둘레 칸이 모두 굳음 — 받은뒤검사.py 「둘레」).
# 설계(11-22 GPT 검수 세 회차 뒤 Fable 5.2 설계 검토 — .tmp/검수/설계검토-둘레무리-20261122.md): 기계는 빠뜨림(빈 칸 · 표 꼴 · 까닭 없는 끝 그림 ·
#   AROUND 줄과 서로 다른 초 박자 수)만 막고 글의 뜻은 풀지 않는다 — 세 회차 지적 30건 가운데 되풀이된 것이 모두 자유 글의 뜻을 정규식으로 가르는 자리였다.
#   뜻은 Fable 굽기 전 관문(.claude/workflows/video-gate.js 컷 전수 ⑩)과 받은 뒤 실측(받은뒤검사.py 「둘레굳음」)이 맡는다.
#   Fable 관문이 필수가 아닌 편(광고 · 공모전 · 포트폴리오가 아니거나 판이 셋보다 적은 편)에서는 뜻을 보는 눈이 없다 — 그 편은 480p 빠른 첫 시험과 받은 뒤 실측만 받친다.
# 무리 컷: 「둘레」가 박자 표(또는 「없음」이 아닌 글)인 컷, 또는 「둘레」가 비었는데 구도 · 카메라 · 연기에 무리 낱말(군단 · 군중 · 사람들 · 수백 명 · crowd …)이 있는 컷.
#   무리 낱말은 알림일 뿐이다 — 잘못 걸리면(빈 광장 · 등불) 「둘레」: "없음: <까닭>" 한 줄로 풀고, 낱말 밖의 무리는 만드는 세션이 「둘레」를 적는다.
# 걸림(편 날짜가 둘레부터 이후인 편 — 앞선 편 · 날짜를 못 읽는 편은 주의):
#   ① 무리 낱말이 있는데 「둘레」가 비었다.
#   ② 「둘레」가 박자 표가 아니다 — [{"t": 초, "누가": "<무리 이름>", "무엇": "<몸짓>"}, …] 둘 이상, 「누가」가 둘 이상, t는 0 이상, 가장 이른 t가 1.0초 안(첫 장부터 움직인다).
#   ③ 무리 컷이 「끝그림」을 쓰는데 「끝그림까닭」이 없다 — 끝 그림 없이 끝 모습을 연기 · 둘레 글로 적거나, 꼭 써야 하면 까닭을 적고 첫 시험을 480p 빠른 판으로 낸다.
#   ④ 영상 지시문(--지시문 · 내기 도구의 굽기전 — 둘레대조): 무리 컷의 판에 AROUND(또는 CROWD) 줄이 없거나, 그 줄의 서로 다른 초(「at about 1.0 s」 · 「from 0.5 s」)가
#      둘보다 적거나, 무리를 한꺼번에 움직이게 적었다(in unison · all at once · simultaneously · in sync — 바로 앞이 never · not이면 뺀다).
# 풀어 주는 칸: 「둘레」: "없음: <까닭>"(① — 까닭이 비면 풀리지 않는다. 「없음」은 받은 뒤 실측도 끄니 관문 ⑩이 그 컷의 시작 그림에 무리가 없는지 본다) · 「끝그림까닭」(③).
# 선언한 한계(기계로 가르지 않는다 — 시험이 「이 입력은 지나간다」를 고정한다):
#   · 시작 · 끝 그림의 무리 자리가 같은지 — 끝 그림은 ③이 막고, 두 그림은 굽기 전 관문 ⑩의 눈이 나란히 연다(칸 상관은 무리 칸과 배경 칸을 가르지 못했다).
#   · AROUND 줄은 있나 · 서로 다른 초가 둘 이상인가만 본다 — 그 초에 무리가 움직이는지 서 있는지는 ⑩의 눈과 받은 뒤 둘레굳음이 본다.
#   · 박자 표의 「무엇」이 몸짓인지 정지인지는 풀지 않는다 — ⑩의 눈과 받은 뒤 둘레굳음이 본다.
#   · 무리 낱말은 알림이다 — 무리가 없는 컷에 걸리면(빈 광장 · 등불) 「없음: 까닭」 한 줄로 푼다. 낱말 밖의 무리는 만드는 세션이 「둘레」를 적는다.
#   · 날개가 한꺼번에 같은 박자로 치는지 — 첫컷검사 · ⑩의 눈이 본다.
둘레부터 = "20261119"
_무리_한 = re.compile(r"(?:군단|군중|관중|인파|대열|행렬|군대|병사들|구경꾼|행인들|사람들|손님들|관객|새\s?떼|떼를 지어|떼로|(?:한|큰|작은|사람|천사|악마|짐승|새)\s?무리"
                    r"|무리(?:가|를|의|는|들|\s속)|수(?:십|백|천|만)(?:만)?\s*(?:명|마리))(?![이은도가는]?\s*(?:없|하나 없|사라|떠나|떠난|빠지|빠진))")   # 「사람들이 없다」 · 「무리가 없다」는 무리가 아니다
_무리_영 = re.compile(r"\b(?:crowds?|arm(?:y|ies)|hordes?|swarms?|flocks?|legions?|throngs?|multitudes?|spectators|onlookers|passers-?by|soldiers"
                    r"|(?:hundreds|thousands|millions|dozens) of (?:\w+\s+){0,2}?(?:people|men|women|figures|soldiers|warriors|fans|birds|creatures|riders|horses"
                    r"|angels|demons|bodies|shoppers|students|villagers|citizens|pilgrims|workers))\b", re.I)
_무리부정_영 = re.compile(r"\b(?:no|without|zero|empty of|free of)\s+(?:(?:a|an|the|any)\s+)?$", re.I)   # 바로 앞의 부정만 — 「without crowds」 · 「no spectators」
_둘레라벨 = ("AROUND", "CROWD", "CROWDS")   # BACKGROUND · EXTRAS는 배경 묘사로 쓰여 둘레 줄로 치지 않는다
_초박자 = re.compile(r"(?<![\w.])(\d+(?:\.\d+)?|\.\d+)\s?(?:s|sec|secs|seconds?)\b", re.I)   # 「.30 seconds」도 0.3초다
_한꺼번에_영 = re.compile(r"\b(?:in unison|all at once|simultaneously|in sync)\b", re.I)
_한꺼번에부정 = re.compile(r"\b(?:never|not)\s+(?:\w+\s+)?$", re.I)


def 둘레없음(v):
    """「둘레」: "없음: <까닭>" — 무리 낱말이 걸렸지만 무리가 없는 컷. 까닭이 비면 풀리지 않는다(「없음」은 받은 뒤 실측도 끈다)"""
    return isinstance(v, str) and re.fullmatch(r"\s*없음\s*[:：]\s*\S.*", v, re.S) is not None


def _무리있음(글):
    """글에 무리 낱말이 있나 — 한국어는 뒤의 부정(「사람들이 없다」), 영어는 바로 앞의 부정(「without crowds」)을 뺀다"""
    글 = str(글 or "")
    if _무리_한.search(글): return True
    return any(not _무리부정_영.search(글[max(0, m.start() - 30):m.start()]) for m in _무리_영.finditer(글))


def _무리낱말(d):
    연기 = d.get("연기") if isinstance(d.get("연기"), list) else []
    글 = " ".join(str(d.get(k) or "") for k in ("구도", "카메라")) + " " + " ".join(str(b.get("무엇") or "") for b in 연기 if isinstance(b, dict))
    return _무리있음(글)


def 무리컷(d):
    """컷 줄이 둘레에 무리가 있는 컷인가(T31) — 「둘레」가 「없음: …」이면 아니고, 박자 표 · 글이면 그렇고, 비었으면 무리 낱말로 가른다"""
    if not isinstance(d, dict): return False
    v = d.get("둘레")
    if 둘레없음(v): return False
    if (isinstance(v, list) and v) or (isinstance(v, str) and v.strip()): return True
    return _무리낱말(d)


def 둘레표문제(v):
    """「둘레」 박자 표의 문제 → 글 | None(맞음). 표: [{"t": 초, "누가": 무리 이름, "무엇": 몸짓}, …]"""
    if not isinstance(v, list):
        return ("「둘레」는 박자 표로 적는다 — [{\"t\": 0.3, \"누가\": \"앞줄\", \"무엇\": \"…\"}, {\"t\": 0.8, \"누가\": \"뒷줄\", \"무엇\": \"…\"}]. "
                "무리가 없는 컷이면 「없음: <까닭>」(까닭까지)")
    줄 = [b for b in v if isinstance(b, dict) and 숫자(b.get("t")) is not None and not 빈칸(b.get("누가")) and not 빈칸(b.get("무엇"))]
    if len(줄) < 2 or len(줄) < len(v):
        return f"「둘레」 박자 {len(v)}개 가운데 t · 누가 · 무엇을 다 갖춘 것이 {len(줄)}개다 — 박자마다 셋을 다 적고 둘 이상 적는다"
    누가 = {한칸(b["누가"]) for b in 줄}
    if len(누가) < 2:
        return f"「둘레」의 「누가」가 하나뿐이다(「{next(iter(누가))}」) — 무리를 둘 이상으로 나눠 저마다 다른 몸짓과 초를 준다(한 덩어리로 적으면 같은 박자로 움직인다)"
    if any(숫자(b["t"]) < 0 for b in 줄):
        return "「둘레」 박자의 t가 0보다 작다 — 판 안의 초(0 이상)로 적는다"
    첫 = min(숫자(b["t"]) for b in 줄)
    if 첫 > 1.0:
        return f"「둘레」의 첫 박자가 {첫:g}초다 — 첫 1초 안에 움직이기 시작하게 적는다(모델이 첫 장을 붙드는 동안 둘레가 굳는다)"
    return None


def _둘레등급(seq, 폴더=None):
    날짜 = 편날짜(seq or {}, 폴더)
    return "걸림" if (날짜 and 날짜 >= 둘레부터) else "주의"


def _칸그림경로(v, 폴더=None):
    """「끝그림」 같은 그림 칸(글 · 목록의 첫 장) → (경로 | None, 칸에 적혔나). 상대 경로는 편 폴더 기준이다(시작그림경로와 같은 풀이)."""
    import os
    if isinstance(v, list): v = next((x for x in v if isinstance(x, str) and x.strip()), None)
    if not (isinstance(v, str) and v.strip()): return None, False
    q = Path(os.path.expanduser(v.strip())); q = q if q.is_absolute() or 폴더 is None else Path(폴더) / q
    return (q.resolve() if q.is_file() else None), True


def 둘레검사(seq, 폴더=None):
    """T31 — 둘레에 무리가 있는 컷의 「둘레」 박자 표 · 끝 그림(26) → [(등급, 어디, 글)]. 까닭 · 문턱은 위 머리말."""
    out = []
    등급 = _둘레등급(seq, 폴더)
    for d in seq.get("detail") or []:
        if not 무리컷(d): continue
        cut = d.get("cut", "?")
        v = d.get("둘레")
        if 빈칸(v) or v == []:
            out.append((등급, cut, "둘레에 무리 낱말이 있는데 「둘레」 칸이 비었다(26 · T31) — 주인공 동작만 적으면 영상 모델은 둘레 무리를 굳힌다(11-21 공모전 편 시험 세 판). "
                              "「둘레」에 무리마다 다른 몸짓과 초를 박자 표로 적고([{\"t\", \"누가\", \"무엇\"}, …]), 무리가 없는 컷이면 「둘레」: \"없음: <까닭>\"을 적는다"))
        else:
            문제 = 둘레표문제(v)
            if 문제: out.append((등급, cut, f"{문제}(26 · T31)"))
        _, 끝적힘 = _칸그림경로(d.get("끝그림"), 폴더)
        if 끝적힘 and 빈칸(d.get("끝그림까닭")):
            out.append((등급, cut, "둘레에 무리가 있는 컷이 「끝그림」을 쓴다(26 · T31) — 끝 그림을 쓴 무리 컷 두 판이 모두 첫 1.5~2초를 시작 그림 그대로 붙들어 둘레가 굳었다(11-21). "
                              "끝 그림을 빼고 끝 모습을 연기 · 둘레 글로 적거나, 꼭 써야 하면 「끝그림까닭」을 적고 첫 시험을 480p 빠른 판으로 내 첫 2초 둘레를 잰다"))
    return out


def 둘레대조(seq, 컷들, 글, 폴더=None):
    """T31 ④ — 둘레에 무리가 있는 컷의 영상 지시문에 AROUND 줄이 있고, 서로 다른 초 박자가 둘 이상이고, 무리를 한꺼번에 움직이게 적지 않았나(26) → [(등급, 글)].
    컷표가 그 컷을 갖고 있으면 컷표(무리컷)로 가르고, 없으면 지시문의 무리 낱말로 가른다(그때는 편 날짜를 못 읽어 주의다).
    --지시문(지시문항목)과 크레딧내기.py의 굽기전이 같은 함수를 부른다."""
    det = [d for d in (seq or {}).get("detail") or [] if isinstance(d, dict) and d.get("cut") in (컷들 or [])]
    무리 = any(무리컷(d) for d in det) if det else _무리있음(글)
    if not 무리: return []
    등급 = _둘레등급(seq, 폴더) if det else "주의"
    줄 = " ".join(t for l, t in 칸들(글) if l in _둘레라벨)
    if not 줄.strip():
        return [(등급, "둘레에 무리가 있는 컷인데 지시문에 AROUND 줄이 없다(26 · T31) — 컷표 「둘레」 박자 표를 옮겨 「AROUND: the … keep moving from the first frame to the last, "
                     "never in unison: at about 0.3 s the front row …; at about 0.8 s the back row …」처럼 무리마다 다른 몸짓과 초를 적는다(지시문 틀 4)")]
    박자 = len({round(float(x), 2) for x in _초박자.findall(줄)})   # 같은 초를 두 번 적어도 하나다(「0.3 s」 · 「0.30 seconds」)
    if 박자 < 2:
        return [(등급, f"AROUND 줄에 서로 다른 초 박자가 {박자}개뿐이다(「{한칸(줄)[:60]}」 · 26 · T31) — 컷표 「둘레」 박자 표대로 무리마다 몇 초에 무엇을 하는지 둘 이상 적는다")]
    m = next((x for x in _한꺼번에_영.finditer(줄) if not _한꺼번에부정.search(줄[max(0, x.start() - 30):x.start()])), None)
    if m:
        return [(등급, f"AROUND 줄이 둘레 무리를 한꺼번에 움직이게 적었다(「{m.group(0)}」 · 26 · T31) — 무리마다 다른 박자로 움직이게 적는다(never in unison)")]
    return []


간격부터 = "20261119"   # T25 · T26 — 이 날 이후 편(편 날짜)은 걸림, 앞선 편 · 날짜를 못 읽는 편은 주의(진행 중인 다른 편의 판을 막지 않으려고)


def 차간격검사(seq, 폴더=None):
    """T25 — 한 컷에 탈것이 둘 이상(줄지어 선 차) 나오면 그 컷이 쓰는 장면 줄에 「차간격」(차 길이에 견준 간격, 지시문에 그대로 쓸 문장)이 있어야 한다(63) → [(등급, 어디, 글)].
    왜: 11-18 YOUTH UP 「잠깐」 — 높은 부감(C03)에서는 줄지은 차 사이가 차 길이 3분의 1쯤 벌어졌는데, 바로 다음 아이 눈높이(C04)에서는 하늘색 차와
    미니밴이 손가락 몇 개만 한 틈으로 붙었다. 유호님 「지금 차 거리가 긴데 갑자기 다음장면에서 차 거리가 엄청 좁아지거든? 이것때문에 부자연스럽고 이해가 덜돼」.
    간격은 「차 사이 아이」 이야기의 뼈대인데 표 어디에도 적지 않아 컷마다 모델이 정했다(원칙 3 한 편은 한 세계)."""
    out = []; 표 = 소품표줄(seq); 장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    def 탈것인가(이름):
        줄 = 표.get(이름)
        return (isinstance(줄, dict) and str(줄.get("종류") or "").strip() == "탈것") or bool(_탈것이름.search(str(이름)))
    빠진 = {}   # 장면 → [(컷, 탈것들)]
    for d in seq.get("detail") or []:
        if not isinstance(d, dict): continue
        소품 = d.get("소품") if isinstance(d.get("소품"), dict) else {}
        차 = [n for n, v in 소품.items() if v not in _소품없음 and 탈것인가(n)]
        if len(차) < 2: continue
        이름 = d.get("장면") if isinstance(d.get("장면"), str) else "(장면 없음)"
        줄 = 장면표.get(이름)
        if isinstance(줄, dict) and not 빈칸(줄.get("차간격")): continue
        빠진.setdefault(이름, []).append((d.get("cut"), 차[:2]))
    if not 빠진: return out
    날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 간격부터) else "주의"
    for 이름, 곳 in 빠진.items():
        컷들 = " · ".join(f"{c}({'·'.join(t)})" for c, t in 곳[:4]) + (" …" if len(곳) > 4 else "")
        out.append((등급, f"장면 {이름}", f"한 컷에 탈것이 둘 이상인데({컷들}) 장면 「{이름}」 줄에 「차간격」 칸이 없다 — 줄지은 차 사이를 차 길이에 견준 말"
                    f"(「차 길이 3분의 1 — 아이 하나가 겨우 들어간다」)로 한 번 적고, 그 장면의 그림 · 영상 지시문에 그대로 쓴다. 넓은 컷과 가까운 컷이 서로 다른 간격으로 나온다(63)"))
    return out


def 자막크기검사(seq, 폴더=None):
    """T26 — 말자막 줄(글자 종류 「말자막」)에 「크기」(1080 폭 화면의 글자 크기 px)가 있어야 하고 64 아래면 안 된다(4) → [(등급, 어디, 글)].
    왜: 11-18 YOUTH UP 「잠깐」 — 말자막을 48px(화면 폭 4.4%)로 구웠다. 유호님 「자막이 너무 작은것같아」. 휴대폰에서 읽히려면 1080 폭에서 64px 넘게(72px 권장),
    한 줄에 안 들어가면 두 줄로 나눈다."""
    out = []; 글자 = seq.get("글자") if isinstance(seq.get("글자"), list) else []
    날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 간격부터) else "주의"
    for i, g in enumerate(글자):
        if not isinstance(g, dict) or str(g.get("종류") or "").strip() != "말자막": continue
        k = g.get("크기")
        try: n = float(k)
        except (TypeError, ValueError): n = None
        if n is None:
            out.append((등급, f"글자 {i + 1}", f"말자막 「{str(g.get('글') or '')[:20]}」에 「크기」 칸이 없다 — 1080 폭 화면의 글자 크기(px)를 적는다. 64 아래면 휴대폰에서 작다(72 권장, 4)"))
        elif n < 64:
            out.append((등급, f"글자 {i + 1}", f"말자막 「{str(g.get('글') or '')[:20]}」 크기 {k:g}px — 1080 폭에서 64px 아래는 휴대폰에서 작다(72 권장, 한 줄에 안 들어가면 두 줄, 4)" if isinstance(k, (int, float)) else f"말자막 크기 {k} — 64px 아래(4)"))
    return out


최근판정, 최근바로 = 6, 2   # T21 주의 — 최근 판정 여섯(두 회차) 가운데 「바로」가 둘 이하면 합친 셈이 지나가도 알린다(막지 않는다, 11-25 유호님 「넣기」)
원고시험부터 = "20261118"   # T21 — 이 날 이후 편(편 날짜)은 걸림, 앞선 편 · 날짜를 못 읽는 편은 주의(진행 중인 다른 편의 판을 막지 않으려고)


def 원고판정모음(z):
    """원고시험 줄 하나 → (판정, 셈). 「판정들」(회차마다 쌓은 판정)이 있으면 모두 세고, 없으면 「판정」 하나를 본다.
    「바로」가 모든 판정의 절반을 넘으면 「바로」, 아니면 바로가 아닌 판정 가운데 많은 쪽(같으면 「생각」)이다. 셈은 판정들일 때만 「바로 8 · 생각 4」 꼴, 판정이 없으면 (None, "")."""
    v = z.get("판정들")
    if isinstance(v, list):
        들 = [str(x).strip() for x in v if isinstance(x, str) and x.strip()]
        if not 들: return None, ""
        셈 = {}
        for x in 들: 셈[x] = 셈.get(x, 0) + 1
        셈글 = " · ".join(f"{k} {n}" for k, n in sorted(셈.items(), key=lambda kv: (kv[0] != "바로", -kv[1], kv[0])))
        if 셈.get("바로", 0) * 2 > len(들): return "바로", 셈글
        아닌 = sorted(((n, k) for k, n in 셈.items() if k != "바로"), key=lambda nk: (-nk[0], nk[1] != "생각", nk[1]))
        return (아닌[0][1] if 아닌 else "생각"), 셈글
    v = str(z.get("판정") or "").strip()
    return (v or None), ""


def 원고시험검사(seq, 폴더=None):
    """T21 — 내레이션 · 대사 원고(소리.원고)가 있으면 맥락 없는 눈이 줄마다 「한 번 듣고 바로 안다」고 판정한 기록(소리.원고시험)이
    지금 원고 글 그대로 있어야 한다(64) → [(등급, 어디, 글)].
    왜: 11-18 매경 정수리 — 자연 다큐 흉내로 정수리를 「땅」, 주인공을 「개체」에 빗댄 원고가 콘티 검수 두 번을 지나 내레이션까지 구워졌다.
    유호님 「대사가 너무 쓰레기인데 ? "정수리, 평생 볼수 없는다" 이게 도대체 무슨뜻이야 ?」. 검수는 그림과 짜임을 보고 원고 줄의 뜻은 따로 묻지 않았다.
    원고시험 꼴: {"누가": "<맥락 없는 눈>", "날짜": "YYYY-MM-DD", "줄": [{"글": "<원고 줄 그대로>", "판정들": ["바로", "생각", …], "뜻": "<그렇게 들린 뜻>"}]}
      줄은 원고 자리마다 하나다. 같은 글이 원고에 두 번 나오면 원고시험 줄도 두 번, 원고 차례대로 짝짓는다.
      「판정들」에는 회차마다 읽은 눈의 판정을 지우지 않고 쌓는다. 글이 그대로인 줄은 모든 회차를 합쳐 「바로」가 절반을 넘어야 지나간다(같으면 생각).
      글을 고친 줄은 새 줄로 다시 센다. 눈 하나의 옛 꼴 「판정」: "바로|생각|모름"도 받는다(판정들이 있으면 판정은 보지 않는다).
      합친 셈은 지나가는데 최근 판정 여섯(두 회차) 가운데 「바로」가 둘 이하인 줄은 막지 않고 주의로 알린다. 앞뒤 줄을 고쳐 뜻이 흐려진 줄은 쌓인 옛 「바로」가 가리기 때문이다(11-25).
    11-25 공모전 편: 판정을 글로 묶어 같은 글 두 자리에 마지막 판정이 함께 붙었고, 두 회차씩만 세자 「생각」이 회차마다 다른 줄로 옮겨 다녀 27회차까지 지나가지 못했다."""
    소리 = seq.get("소리") if isinstance(seq.get("소리"), dict) else {}
    원고 = 소리.get("원고")
    if not isinstance(원고, list) or not 원고: return []
    def 고름(t): return " ".join(str(t).split())
    자리 = []   # (원고 몇째 줄, 글, 컷) — 원고 차례
    for i, x in enumerate(원고):
        if isinstance(x, (list, tuple)) and x and isinstance(x[-1], str) and x[-1].strip():
            자리.append((i + 1, 고름(x[-1]), x[0].strip() if len(x) > 1 and isinstance(x[0], str) else ""))
        elif isinstance(x, dict) and str(x.get("글") or "").strip():
            자리.append((i + 1, 고름(x["글"]), str(x.get("컷") or "").strip()))
    if not 자리: return []
    날짜 = 편날짜(seq, 폴더); 등급 = "걸림" if (날짜 and 날짜 >= 원고시험부터) else "주의"
    시험 = 소리.get("원고시험")
    줄 = 시험.get("줄") if isinstance(시험, dict) else None
    if not isinstance(줄, list) or not 줄:
        return [(등급, "소리 원고", f"내레이션 · 대사 원고 {len(자리)}줄에 「원고시험」 칸이 없다 — 원고를 화면 없이 글로만 맥락 없는 눈에게 주고 "
                 f"줄마다 「바로 · 생각 · 모름」과 들린 뜻을 받아 소리.원고시험.줄의 「판정들」에 적는다. 빗댄 말(땅 · 개체 · 장비)은 한 번 듣고 뜻이 안 통한다(64)")]
    판정줄 = {}   # 글 → 원고시험 줄들(적힌 차례)
    for z in 줄:
        if isinstance(z, dict) and isinstance(z.get("글"), str) and z["글"].strip(): 판정줄.setdefault(고름(z["글"]), []).append(z)
    몇번 = {}
    for _, g, _ in 자리: 몇번[g] = 몇번.get(g, 0) + 1
    몇째 = {}; out = []
    for 몇줄, g, 컷 in 자리:
        k = 몇째.get(g, 0); 몇째[g] = k + 1
        곳 = f"「{g}」" + (f"(원고 {몇줄}번째 줄{' · ' + 컷 if 컷 else ''})" if 몇번[g] > 1 else "")
        zs = 판정줄.get(g, [])
        if k >= len(zs):
            if zs:
                out.append((등급, "소리 원고", f"{곳} — 이 글이 원고에 {몇번[g]}번 나오는데 원고시험 줄은 {len(zs)}번이다. 나오는 자리마다 원고 차례대로 줄을 하나씩 두고 판정을 적는다(64)"))
            else:
                out.append((등급, "소리 원고", f"{곳} — 원고시험에 이 글 그대로의 판정이 없다. 원고를 고쳤으면 고친 줄을 다시 시험한다(64)"))
            continue
        v, 셈 = 원고판정모음(zs[k])
        if v is None:
            out.append((등급, "소리 원고", f"{곳} — 원고시험 줄에 판정이 없다. 읽은 눈의 판정을 「판정들」에 적는다(64)"))
        elif v != "바로":
            본 = f"맥락 없는 눈의 판정을 모든 회차 합쳐도 「바로」가 절반을 넘지 않는다({셈})" if 셈 else f"맥락 없는 눈의 판정이 「{v}」으로 나왔다"
            out.append((등급, "소리 원고", f"{곳} — {본}. 빗대지 말고 쉬운 말로 한 줄에 한 가지를 말하게 고친 뒤 다시 시험한다(64)"))
        elif 셈:
            최근 = [x.strip() for x in zs[k]["판정들"] if isinstance(x, str) and x.strip()][-최근판정:]
            if len(최근) == 최근판정 and 최근.count("바로") <= 최근바로:
                out.append(("주의", "소리 원고", f"{곳} — 합친 셈은 지나가지만({셈}) 최근 판정 {최근판정}개 가운데 「바로」는 {최근.count('바로')}개뿐이다. "
                            f"앞뒤 줄을 고쳐 뜻이 흐려졌으면 이 줄도 고쳐 다시 시험한다(64)"))
    return out


def _파일지문(p):
    """파일 내용의 sha1(못 읽으면 None) — 이름이 달라도 같은 그림인지 본다"""
    import hashlib
    try:
        h = hashlib.sha1()
        with open(p, "rb") as f:
            for 덩이 in iter(lambda: f.read(1 << 20), b""): h.update(덩이)
        return h.hexdigest()
    except OSError:
        return None


def _그림열쇠(v):
    """「시작그림」 칸의 글 → 견줄 열쇠(역슬래시 · 앞의 ./ · 대소문자만 맞춘다)"""
    return re.sub(r"^(?:\./)+", "", str(v).strip().replace("\\", "/")).lower()


def 시작그림들(d):
    """컷 한 줄의 「시작그림」 → 목록(글 하나 · 목록 모두 받는다)"""
    v = d.get("시작그림") if isinstance(d, dict) else None
    if isinstance(v, str): v = [v]
    return [x.strip() for x in v if isinstance(x, str) and x.strip()] if isinstance(v, list) else []


def 같은판밝힘(d):
    """같은판: "<까닭>" — 한 판을 일부러 이어 쓰는 컷(한 방을 둘로 자른 컷 · 한 판에 두 샷). 까닭이 글이어야 밝힌 것이다(true · 빈 글은 아니다)."""
    v = d.get("같은판") if isinstance(d, dict) else None
    return isinstance(v, str) and bool(v.strip())


def 옛틀잇단같은판(seq):
    """옛 틀 컷순서(SNS 편 · detail에 「영상」이나 「판」) — 이웃한 두 컷이 같은 받은 영상을 잘라 붙였나(50) → [(컷, 글)].
    2026-11-13 synkbrief B44 최종 확인 미흡: V7 한 판을 1.0 → 1.2 → 1.4배로, V4 한 판을 전체 → 1.15 → 1.3배로 잘라 이어
    「같은 구도로 사람이 갑자기 커지는 점프컷」이 됐는데, 옛 틀은 T17(같은 시작 그림 · 같은 판)을 돌지 않아 걸림 0으로 지나갔다.
    사이에 다른 판(인서트)을 끼운 되쓰기(V1 → V2 → V1)는 막지 않는다. 일부러 이은 컷은 같은판: "<까닭>"이나 이어찍기: true로 밝힌다."""
    det = [d for d in seq.get("detail") or [] if isinstance(d, dict)]
    out = []
    for p, d in zip(det, det[1:]):
        판 = lambda x: next((x[k].strip() for k in ("영상", "판") if isinstance(x.get(k), str) and x[k].strip()), None)
        a, b = 판(p), 판(d)
        if not a or a != b or p.get("cut") == d.get("cut") or 같은판밝힘(d) or d.get("이어찍기") is True: continue
        out.append((d.get("cut", "?"), f"앞 컷 {p.get('cut', '?')}과 같은 받은 영상 「{b}」를 잇달아 잘라 붙였다(50) — 같은 판을 배율만 바꿔 이으면 "
                    "사람이 갑자기 커지는 점프컷이다. 한 배율로 길게 두고 천천히 다가가거나, 사이에 각도가 다른 판(손 · 화면 · 다른 각도 근접)을 끼운다. "
                    "한 방을 일부러 둘로 자른 컷이면 같은판: \"<까닭>\"을 적는다"))
    return out


def 시작그림검사(seq, 폴더=None, 그림폴더=None):
    """T17 — 서로 다른 두 컷이 같은 시작 그림 · 같은 받은 영상(판)을 쓰나(50) → [(등급, 컷, 글)].
    폴더(컷표가 있는 편 폴더)를 알면 칸에 적힌 파일을 읽어 이름이 달라도 같은 파일인지까지 보고, 그림폴더(--그림)를 주면 칸이 빈 컷은 <그림폴더>/<컷>.png로 견준다.
    같은 묶음에서 같은판으로 밝히지 않은 컷이 둘 이상이면 둘째부터 걸린다(누가 원래 컷인지는 묻지 않는다)."""
    det = [d for d in seq.get("detail") or [] if isinstance(d, dict)]
    컷들 = list(dict.fromkeys(d.get("cut") for d in det if isinstance(d.get("cut"), str) and d.get("cut")))
    줄 = {c: [d for d in det if d.get("cut") == c] for c in 컷들}
    밝힘 = {c: any(같은판밝힘(d) for d in 줄[c]) for c in 컷들}
    그림묶음, 판묶음, 빈 = {}, {}, []
    for c in 컷들:
        값 = list(dict.fromkeys(v for d in 줄[c] for v in 시작그림들(d)))
        후보 = []
        for v in 값:
            p = Path(v); p = p if p.is_absolute() or not 폴더 else Path(폴더) / p
            후보.append((p if (폴더 or p.is_absolute()) and p.is_file() else None, v))
        if not 값:
            if not 밝힘[c]: 빈.append(c)
            f = 정지그림(그림폴더, c) if 그림폴더 else None
            if f: 후보.append((f, f.name))
        for f, 이름 in 후보:
            지문 = _파일지문(f) if f else None
            쓴 = 그림묶음.setdefault(("지문", 지문) if 지문 else ("이름", _그림열쇠(이름)), [])
            if not any(x[0] == c for x in 쓴): 쓴.append((c, 이름))   # 한 컷이 같은 그림을 두 번 적어도(첫 장 · 끝 장) 제 자신과 겹치는 것은 아니다
        판 = next((d["판"].strip() for d in 줄[c] if isinstance(d.get("판"), str) and d["판"].strip()), c)
        판묶음.setdefault(판, []).append((c, 판))
    까닭 = {}
    for 묶음, 무엇 in ((그림묶음, "시작 그림"), (판묶음, "받은 영상(판)")):
        for 쓴 in 묶음.values():
            안밝힘 = [(c, 이름) for c, 이름 in 쓴 if not 밝힘[c]]
            if len({c for c, _ in 쓴}) < 2 or len(안밝힘) < 2: continue
            첫컷, 첫이름 = 안밝힘[0]
            for c, 이름 in 안밝힘[1:]:
                같음 = f"「{이름}」" if _그림열쇠(이름) == _그림열쇠(첫이름) else f"「{이름}」 = 「{첫이름}」(이름만 다른 같은 파일)"
                까닭.setdefault(c, []).append(f"{첫컷} 컷과 같은 {무엇} {같음}")
    out = []
    for c in 컷들:
        if c not in 까닭: continue
        글꼴 = "(같은판은 true가 아니라 까닭을 글로 적는다) " if any(d.get("같은판") is True for d in 줄[c]) else ""
        out.append(("걸림", c, f"같은 시작 그림을 두 컷이 쓴다(50) — {' · '.join(dict.fromkeys(까닭[c]))}. 관객에겐 같은 장면이 되풀이된다: 뜻이 다른 새 구도의 그림으로 굽거나, "
                    f"한 판을 일부러 이어 쓰는 컷(한 방을 둘로 자른 컷)이면 {글꼴}같은판: \"<까닭>\"을 적는다"))
    if 빈:
        out.append(("주의", "표", f"「시작그림」 칸이 빈 컷 {len(빈)}개({' · '.join(빈[:6])}{' …' if len(빈) > 6 else ''}) — 이미지 콘티를 고른 뒤 컷마다 시작 그림 파일을 적는다(같은 시작 그림을 두 컷이 쓰는지 이 칸으로 본다 · 50)"))
    return out


def 꾸러미시작그림(seq, 판들):
    """--지시문 <꾸러미> — 판 폴더의 시작 그림 파일(1_시작.png처럼 이름에 「시작」이 든 그림)이 서로 다른 컷의 판 사이에 같은가(50) → [(등급, 판 id, 글)].
    같은 컷의 대안 판(C2 · C2b)끼리는 같은 시작 그림이 맞다. 컷표 그 컷에 같은판을 밝혔으면 지나간다. 소리만 쓰는 판 · 프리비즈 판 · 컷표에 없는 판은 보지 않는다."""
    밝힘 = {d.get("cut") for d in seq.get("detail") or [] if 같은판밝힘(d)}
    본, out = {}, []
    for 판 in 판들:
        f = Path(판["파일"])
        if f.name != "지시문.txt" or not f.parent.is_dir(): continue   # 판 폴더가 따로 없는 글 파일
        정보 = 판정보(판["판"], seq)
        if 정보["소리만"] or 정보["프리비즈"] or not 정보["컷들"]: continue
        for g in sorted(f.parent.iterdir()):
            if not (g.is_file() and "시작" in g.stem and g.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")): continue
            지문 = _파일지문(g)
            if not 지문: continue
            for 앞id, 앞컷 in 본.get(지문, []):
                if set(앞컷) & set(정보["컷들"]) or 밝힘 & (set(앞컷) | set(정보["컷들"])): continue
                out.append(("걸림", 판["id"], f"(시작 그림) 판 {앞id}(컷 {' · '.join(앞컷)})와 시작 그림 파일이 같다({g.name}) — 같은 시작 그림에서 서로 다른 두 컷을 뽑으면 관객에겐 같은 장면이다(50). "
                            f"뜻이 다른 새 구도의 그림으로 굽거나, 한 판을 일부러 이어 쓰는 컷이면 컷표 그 컷에 같은판: \"<까닭>\""))
                break
            본.setdefault(지문, []).append((판["id"], 정보["컷들"]))
    return out


def 틀검사(seq, r, 폴더=None, 그림폴더=None, 영상=None):
    """컷표 틀 2의 칸 검사(T1~T24) — 걸림은 끝 코드 1, 주의는 알리기만 한다(끝 코드를 바꾸지 않는다 — 기존 규약).
    폴더: 컷표가 있는 편 폴더(시작 그림 · 글자 시안 파일을 읽어 견줄 때) · 그림폴더: --그림 폴더 — 둘 다 없어도 돈다(폴더를 안 넘기면 편 날짜를 「편.만든날」로만 읽는다 — 내기 도구의 굽기전은 11-20부터 편 폴더를 넘긴다).
    영상: --영상(편집 · 마감 관문판) — 글자 시안(T19)이 없으면 주의가 아니라 걸림이다."""
    def 걸림(컷, 글): r.더함("틀", 컷, "걸림", 글)
    def 주의(컷, 글): r.더함("틀", 컷, "주의", 글)
    전 = len(r.항목들)
    det = seq.get("detail") or []
    장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    인물표 = seq.get("인물") if isinstance(seq.get("인물"), dict) else {}
    # T10 볼 이유 · T13 가까운 사례 · T12 엔진
    for k, 뜻 in (("이기는것", "이 편이 무엇으로 이기는지(웃김 · 여운 · 공력)"), ("한문장", "처음 보는 사람이 한 문장으로 말할 내용을")):
        if 빈칸(seq.get(k)): 걸림("표", f"「{k}」 칸이 비었다 — {뜻} 적는다(3)")
    if 빈칸(seq.get("가까운사례")): 주의("표", "「가까운사례」 칸이 비었다 — 만족 사례 장부에서 가장 가까운 사례(S번호)를 적는다")
    엔진 = seq.get("엔진") if isinstance(seq.get("엔진"), dict) else {}
    for k in ("그림", "영상"):
        v = 엔진.get(k)
        if 빈칸(v) or v in ([], {}): 걸림("표", f"「엔진.{k}」 칸이 비었다 — 한 편은 그림 엔진 하나 · 영상 모델 하나(G11)")
        elif not isinstance(v, str) or re.search(r"[+,/]| 및 ", v): 걸림("표", f"「엔진.{k}」에 둘 이상이 적혔다(「{v}」) — 한 편은 그림 엔진 하나 · 영상 모델 하나(G11)")
    # T1 · T5 장면 표 / T2 인물 표 — 쓰는 줄마다 한 번씩
    쓰는장면 = list(dict.fromkeys(d.get("장면") for d in det if isinstance(d.get("장면"), str) and d.get("장면").strip()))
    for 이름 in 쓰는장면:
        s = 장면표.get(이름)
        if not isinstance(s, dict): continue   # 표에 없는 장면은 아래 컷 줄에서 건다
        빠짐 = [k for k in ("장소", "빛", "기준그림") if 빈칸(s.get(k))]
        if 빠짐: 걸림(f"장면 {이름}", f"장면 「{이름}」의 {' · '.join(빠짐)} 칸이 비었다 — 장면 · 빛을 표에 한 번 적는다(51)")
        if 빈칸(s.get("시간대")): 주의(f"장면 {이름}", f"장면 「{이름}」의 「시간대」 칸이 비었다 — 컷 사이 낮 · 밤이 바뀌는지 못 본다(51)")
    # T16 빛 이름(60) — 장면마다 빛을 이름으로 부르고, 사람이 나오는 장면의 옆빛은 키 빛의 쪽을 적는다
    빛표, 빛표까닭 = 빛이름표()
    if 빛표 is None:
        if 쓰는장면: 걸림("표", f"빛 이름 표를 못 읽었다 — {빛표까닭}(60)")
    else:
        for 이름 in 쓰는장면:
            s = 장면표.get(이름)
            if not isinstance(s, dict): continue
            쓰는컷 = [d for d in det if d.get("장면") == 이름]
            사람있음 = any(isinstance(d.get("인물"), list) and d["인물"] for d in 쓰는컷)
            사람없는컷 = list(dict.fromkeys(d.get("cut", "?") for d in 쓰는컷 if d.get("인물") == []))
            for 등급, 글 in 빛이름검사(이름, s, 사람있음, 사람없는컷, 빛표): (걸림 if 등급 == "걸림" else 주의)(f"장면 {이름}", 글)
    쓰는인물 =list(dict.fromkeys(n for d in det if isinstance(d.get("인물"), list) for n in d["인물"] if isinstance(n, str)))
    for 이름 in 쓰는인물:
        p = 인물표.get(이름)
        if not isinstance(p, dict): continue
        빠짐 = [k for k in ("묘사", "기준그림") if 빈칸(p.get(k))]
        if 빠짐: 걸림(f"인물 {이름}", f"인물 「{이름}」의 {' · '.join(빠짐)} 칸이 비었다 — 인물은 표에 한 번 적고 기준 그림을 고정한다(일관성 — 12 · G11)")
        # T14 인물 설정(11-08 유호님 「스토리보드가 설정되면 캐릭터들의 성격이나 이 씬에서 하는 역할을 먼저」 — 제작 규칙 순서 1-1)
        설정 = p.get("설정")
        if 빈칸(설정) or 설정 in ({}, []) or (isinstance(설정, dict) and all(빈칸(v) for v in 설정.values())):
            걸림(f"인물 {이름}", f"인물 「{이름}」의 「설정」 칸이 비었다 — 바닥의 믿음 · 버릇 · 바라는 것 · 두려운 것 · 이 편에서 맡는 일을 적는다(단역이면 「단역 — …」 한 줄, 제작 규칙 순서 1-1)")
    # T15 사건마다 감정 설계(목적 · 겹친 감정 · 보이는 장치) — 심사 4-3이 이 칸과 견준다(33). 사건의 「감정」 칸은 감정 클로즈 컷 이름이라 설계는 「감정설계」에 적는다
    for ev in seq.get("사건") if isinstance(seq.get("사건"), list) else []:
        if not isinstance(ev, dict) or ev.get("압축") is True: continue
        설계 = ev.get("감정설계")
        설계있음 = (isinstance(설계, str) and 설계.strip()) or (isinstance(설계, list) and any((isinstance(g, str) and g.strip()) or (isinstance(g, dict) and not 빈칸(g.get("감정"))) for g in 설계))
        빠짐 = [k for k, 없음 in (("목적", 빈칸(ev.get("목적"))), ("감정설계", not 설계있음)) if 없음]
        if 빠짐: 걸림(f"사건 {ev.get('이름', '?')}", f"사건 「{ev.get('이름', '?')}」의 {' · '.join(빠짐)} 칸이 비었다 — 왜 이걸 하는지(목적)와 겹친 감정마다 보이는 장치를 적는다(33 · 심사 4-3, 제작 규칙 순서 1-1)")
    if not det: 주의("표", "컷(detail)이 아직 없다 — 기획 단계 표다. 콘티 단계에서는 컷마다 장면 · 인물 · 구도 · 카메라 · 연기를 채운다(내기 도구는 컷표에 없는 판을 내지 않는다)")
    # 컷마다
    for i, d in enumerate(det):
        cut = d.get("cut", f"#{i + 1}"); 이름 = d.get("장면"); 인물 = d.get("인물"); 구도 = d.get("구도")
        if not isinstance(이름, str) or 빈칸(이름): 걸림(cut, "「장면」 칸이 비었다 — 장면 · 빛을 표에 한 번 적는다(51)"); 이름 = None
        elif not isinstance(장면표.get(이름), dict): 걸림(cut, f"장면 「{이름}」이 장면 표에 없다 — 장면 · 빛을 표에 한 번 적는다(51)")
        if not isinstance(인물, list) or not all(isinstance(n, str) for n in 인물):
            걸림(cut, "「인물」 칸이 없다 — 나오는 사람 이름을 적고 사람 없는 컷은 []로 밝힌다(일관성 — 12 · G11)"); 인물 = None
        else:
            for 누구 in 인물:
                if not isinstance(인물표.get(누구), dict): 걸림(cut, f"인물 「{누구}」가 인물 표에 없다 — 묘사 · 기준 그림을 표에 한 번 적는다(일관성 — 12 · G11)")
        if 인물:   # T3 사람 컷의 연기 박자
            연기 = [b for b in (d.get("연기") if isinstance(d.get("연기"), list) else []) if isinstance(b, dict)]
            박자수 = sum(1 for b in 연기 if 숫자(b.get("t")) is not None and not 빈칸(b.get("무엇")))
            if 박자수 < 2: 걸림(cut, f"사람 컷에 연기 박자(몇 초에 · 무엇을)가 없다(26) — t(초)와 무엇을 적은 박자가 {박자수}개다, 둘 이상 적는다")
            낱말 = list(dict.fromkeys(w for b in 연기 for w in 연기정지낱말(str(b.get("무엇") or ""), tuple(인물표))))
            if 낱말: 걸림(cut, f"연기 박자에 사람을 멈추는 낱말 「{' · '.join(낱말)}」 — 숨 · 눈 · 무게 · 손 · 머리칼의 움직임으로 바꾼다(26)")
        elif 인물 == [] and 빈칸(d.get("움직임")): 주의(cut, "사람 없는 컷 — 무엇이 움직이나(「움직임」 칸이 비었다)")
        if 빈칸(구도): 걸림(cut, "「구도」 칸이 비었다 — 크기 · 각도를 적는다(50)")
        if i == 0: continue
        p = det[i - 1]; 앞이름 = p.get("장면") if isinstance(p.get("장면"), str) else None; 앞인물 = p.get("인물")
        # T4 이웃한 두 컷이 장면 · 인물 · 구도가 모두 같다
        if (이름 and 이름 == 앞이름 and 인물 is not None and isinstance(앞인물, list) and all(isinstance(n, str) for n in 앞인물) and set(인물) == set(앞인물)
                and not 빈칸(구도) and not 빈칸(p.get("구도")) and 구도정리(구도) == 구도정리(p.get("구도")) and d.get("이어찍기") is not True):
            걸림(cut, f"같은 구도 컷을 잇달아 붙임(50) — 앞 컷 {p.get('cut')}과 장면 · 인물 · 구도(「{구도}」)가 같다(크기 · 각도를 바꾸거나, 이어 찍은 컷이면 이어찍기: true)")
        # T5 이웃한 두 컷의 시간대가 다르다
        a = (장면표.get(앞이름) or {}).get("시간대") if 앞이름 and isinstance(장면표.get(앞이름), dict) else None
        b = (장면표.get(이름) or {}).get("시간대") if 이름 and isinstance(장면표.get(이름), dict) else None
        if not 빈칸(a) and not 빈칸(b) and 한칸(a) != 한칸(b) and d.get("시간건너뜀") is not True:
            걸림(cut, f"컷 사이 낮 · 밤이 바뀜(51) — 앞 컷 {p.get('cut')} 「{a}」 → 이 컷 「{b}」(날 · 때가 바뀌는 컷이면 시간건너뜀: true)")
        # T6
        if 빈칸(d.get("넘어옴")): 주의(cut, "「넘어옴」 칸이 비었다 — 앞 컷에서 넘어올 까닭(29)")
    # T17 같은 시작 그림 · 같은 받은 영상을 두 컷이 쓴다(50) / T18 되풀이해 나오는 탈것 · 소품 한 줄(51) / T20 사람과 탈것이 한 컷이면 인물 키(63) / T25 탈것 둘 이상이면 장면 차간격(63) / T26 말자막 크기(4)
    # T21 내레이션 · 대사 원고는 맥락 없는 눈이 줄마다 「바로」로 판정한 기록이 지금 글 그대로 있어야 한다(64)
    # T22 한 편에 색감 하나(51) · T23 같은 분야 최상급 실제 광고 둘(3) · T24 감정흐름 — 희노애락의 굴곡과 세기(14)
    for 등급, 어디, 글 in 시작그림검사(seq, 폴더, 그림폴더) + 소품줄검사(seq) + 인물키검사(seq, 폴더) + 원고시험검사(seq, 폴더) + 색감검사(seq, 폴더) + 최상급검사(seq) + 감정흐름검사(seq, 폴더): (걸림 if 등급 == "걸림" else 주의)(어디, 글)
    for 등급, 어디, 글 in 차간격검사(seq, 폴더) + 자막크기검사(seq, 폴더) + 타당성검사(seq, 폴더): (걸림 if 등급 == "걸림" else 주의)(어디, 글)   # T25 · T26(11-18 YOUTH UP 「잠깐」)
    # T7 기승전결
    rows = [row for row in (seq.get("seq") or []) if isinstance(row, (list, tuple)) and row]
    띠 = {str(row[2]).strip() for row in rows if len(row) > 2}
    빠진띠 = [k for k in "기승전결" if not any(b.startswith(k) for b in 띠)]
    if 빠진띠: 걸림("표", f"seq의 띠에 {' · '.join(빠진띠)}이(가) 없다 — 기 · 승 · 전 · 결을 모두 채운다(14)")
    # T28 감정 자리가 있나(33 — 얼굴 폭은 항목 「얼굴」이 그림에서 잰다) · T29 컷마다 앵글 세 칸과 까닭, 이웃 컷과 모두 같으면 걸림(50)
    # T30 시늉에 맡긴 뜻은 같은 컷의 말이나 진짜 소품이 받친다(29 · 11-20)
    # T31 둘레에 무리가 있는 컷은 「둘레」 칸 · 끝 그림의 둘레 자리를 본다(26 · 11-21)
    for 등급, 어디, 글 in 감정자리검사(seq, 폴더) + 앵글검사(seq, 폴더) + 시늉검사(seq, 폴더) + 둘레검사(seq, 폴더): (걸림 if 등급 == "걸림" else 주의)(어디, 글)
    # T8 끝
    끝 = seq.get("끝")
    if not isinstance(끝, dict): 걸림("끝", "「끝」 표가 없다 — 끝 컷 · 가장 센 그림 · 제품(브랜드)이 보이는지 · 로고 멈춤 초를 적는다(2 · 45 · 53)")
    else:
        마지막 = rows[-1][0] if rows else (det[-1].get("cut") if det else None)
        if 빈칸(끝.get("컷")) or 끝.get("컷") != 마지막: 걸림("끝", f"「끝.컷」({끝.get('컷')})이 seq의 마지막 컷({마지막})이 아니다 — 끝 그림은 마지막 컷에 둔다(2 · 45 · 53)")
        if 빈칸(끝.get("가장센그림")): 걸림("끝", "「끝.가장센그림」 칸이 비었다 — 끝에 이 편에서 가장 센 그림을 둔다(2 · 45 · 53)")
        if 끝.get("제품보임") is not True and 끝.get("브랜드보임") is not True: 걸림("끝", "끝에 제품(브랜드)이 안 보인다 — 「끝.제품보임」이나 「끝.브랜드보임」이 true여야 한다(2 · 45 · 53)")
        멈춤 = 끝.get("로고멈춤초")
        if 멈춤 is None:
            if 빈칸(끝.get("로고없음")): 주의("끝", "「끝.로고멈춤초」가 없다 — 로고 없는 편이면 「끝.로고없음」에 까닭을 적는다(2 · 45 · 53)")
        elif 숫자(멈춤) is None: 걸림("끝", f"「끝.로고멈춤초」({멈춤})는 초 숫자로 적는다(2 · 45 · 53)")
        elif 숫자(멈춤) < 2: 걸림("끝", f"로고 멈춤 {숫자(멈춤):g}초 — 2초 이상 멈춘다(2 · 45 · 53)")
    # T9 글자
    글자 = seq.get("글자")
    if not isinstance(글자, list): 걸림("글자", "「글자」 칸이 없다 — 화면에 나오는 글자를 모두 적고 글자 없는 편은 []로 밝힌다(24 · 46 · 55)")
    else:
        날짜 = 편날짜(seq, 폴더); 엄격 = bool(날짜 and 날짜 >= 시안부터)   # 편 날짜가 시안부터 이후면 얹는 말 판정도 엄격(굽는 말이 끝에 와야 센다)과 T19를 함께 본다
        사전표, 사전컨셉, 사전탈 = 글자사전()
        컨셉 = str(seq.get("컨셉") or "").strip()
        T32범위 = bool(날짜 and 날짜 >= 글자부터 and 컨셉)   # T32는 글자부터(그날 포함) 시작한 컨셉 편만
        컨셉줄 = (사전컨셉 or {}).get(컨셉) if T32범위 else None
        컨셉줄 = 컨셉줄 if isinstance(컨셉줄, dict) else None
        if T32범위 and 사전컨셉 is None:   # 사전을 못 읽으면 T32를 건너뛰지 않고 알린다 — 마감(--영상)이면 걸림(2회차 GA1)
            (걸림 if 영상 else 주의)("글자", f"글자 · CG 사전을 못 읽어 {컨셉} 컨셉의 피하는 글자와 말자막 꼴을 보지 못했다 — {사전탈}(T32)")
        if os.environ.get("SYNK_TEXT_CG_FILE"):   # 시험이 바꿔 끼운 사전 — 시험 밖에 남은 변수가 보이게 한다
            주의("글자", f"글자 · CG 사전 자리가 SYNK_TEXT_CG_FILE({글자사전경로})로 바뀌어 있다 — 시험 밖에서는 이 변수를 지운다")
        # 사전의 컨셉 줄 꼴이 어긋나면(피함이 글 · 자막이 글) 빈 값으로 읽는다 — 자막 꼴은 「고르기 전」 쪽이다(11-25 GPT 검수 GA5)
        피함 = 컨셉줄.get("피함") if 컨셉줄 and isinstance(컨셉줄.get("피함"), list) else []
        요령 = 컨셉줄.get("요령") if 컨셉줄 and isinstance(컨셉줄.get("요령"), str) else ""
        자막줄 = 컨셉줄.get("자막") if 컨셉줄 and isinstance(컨셉줄.get("자막"), dict) else {}

        def 갈래(g):   # 사전 이름은 옛 여섯 갈래로 읽어 아래 검사를 그대로 탄다. 글이 아닌 종류(목록 등)는 그대로 돌려 종류 걸림으로 낸다(GA3)
            n = g.get("종류")
            return (사전표 or {}).get(n, {}).get("컷표", n) if isinstance(n, str) else n
        for k, g in enumerate(글자):
            if not isinstance(g, dict): 걸림("글자", f"글자 {k + 1}번이 표 꼴({{글, 종류, 어디, 만드는법}})이 아니다"); continue
            누구 = f"글자 「{한칸(g.get('글') or '')[:16] or k + 1}」"; 이름 = g.get("종류"); 종류 = 갈래(g); 법 = g.get("만드는법")
            if 종류 not in 글자종류:
                걸림("글자", f"{누구}의 종류(「{이름}」)가 글자 · CG 사전(영상양식/글자CG.json)의 이름이나 {' · '.join(글자종류)} 가운데 하나가 아니다"
                           + (f" — 사전을 못 읽었다: {사전탈}" if 사전표 is None else ""))
            if 빈칸(법): 걸림("글자", f"{누구}의 「만드는법」 칸이 비었다 — 그린 글자 · 장면과 한 장으로 구움(말자막 · 정보는 자막 도구)처럼 어떻게 만드는지 적는다(24 · 46 · 55)")
            elif 종류 in ("강조", "이름", "끝로고", "장면속") and 글꼴로쳤나(str(법), 엄격):
                걸림("글자", f"{누구}({이름}) 만드는법 「{한칸(법)[:40]}」 — 강조 · 이름 · 장면 속 글자는 글꼴로 치지 않는다(24 · 46 · 55). "
                           "장면에 굽는 글자면 참고 원고를 앞에, 「장면과 한 장으로 굽는다」를 끝에 쓰고, 화면에 얹지 않는다는 말은 「얹지 않는다」처럼 그 말에 붙여 쓴다")
            if 종류 == "정보" and re.search(r"구석|왼쪽 ?위|오른쪽 ?위", str(g.get("어디") or "")): 주의("글자", f"{누구}(정보)가 화면 구석 · 위쪽에 있다 — 읽히는 자리인지 본다(40)")
            if 컨셉줄 and isinstance(이름, str) and 이름 in 피함:
                주의("글자", f"{누구}({이름})는 {컨셉} 컨셉이 피하는 글자다 — {한칸(요령)[:80]}(영상양식/글자CG.json)")
            if 컨셉줄 and 사전표 and isinstance(이름, str) and 이름 in 글자종류 and 이름 not in 사전표:   # 옛 갈래 이름으로는 피함을 못 본다(GA4)
                후보 = [n for n, x in 사전표.items() if x.get("컷표") == 이름]
                주의("글자", f"{누구}의 종류를 옛 갈래 이름 「{이름}」으로 적었다 — 사전 이름({' · '.join(후보)})으로 적어야 {컨셉} 컨셉이 피하는 글자인지 본다(영상양식/글자CG.json)")
        # T19 글자 시안(11-16) — 편 날짜가 시안부터 이후인 컷표만(위 「시안부터」 머리말). 날짜를 못 읽으면 돌지 않는다
        # T32(11-25 「자막 · CG 양식」): 말자막 꼴을 아직 고르지 않은 컨셉(사전 「컨셉.<이름>.자막.상태」가 고르심이 아님)의 새 편은 말자막도 시안 둘을 먼저 만든다
        말자막시안 = bool(컨셉줄 and 자막줄.get("상태") != "고르심")
        if 엄격:
            for k, g in enumerate(글자):
                if not isinstance(g, dict) or not (갈래(g) in 시안종류 or (말자막시안 and 갈래(g) == "말자막")): continue
                누구 = f"글자 「{한칸(g.get('글') or '')[:16] or k + 1}」"; 종류 = g.get("종류")
                목록 = 시안목록(g)
                if 폴더 is not None:
                    # 같은 파일을 상대 · 절대 경로로 두 번 적거나 같은 그림을 이름만 바꿔 복사한 것은 하나로 센다 — 내용(바이트)이 같으면 같은 시안이다(11-16 GPT 검수 GA3)
                    있음, 없는것, 겹침, 본내용 = [], [], 0, set()
                    for x in 목록:
                        p = Path(x) if Path(x).is_absolute() else Path(폴더) / x
                        if not p.is_file(): 없는것.append(x); continue
                        try: 열쇠 = _파일내용열쇠(p)
                        except OSError: 없는것.append(x); continue
                        if 열쇠 in 본내용: 겹침 += 1; continue
                        본내용.add(열쇠); 있음.append(x)
                else:   # 편 폴더를 안 넘긴 실행 — 파일은 못 보고 적힌 수만 센다
                    있음, 없는것, 겹침 = 목록, [], 0
                if len(있음) >= 2: continue
                뺌 = g.get("시안없음")
                세기 = (f"「시안」에 {'있는 파일이' if 폴더 is not None else '적힌 그림이'} {len(있음)}개다" + (f"(없는 파일: {' · '.join(없는것[:3])})" if 없는것 else "")
                      + (f"(내용이 같은 그림 {겹침}개는 하나로 셌다)" if 겹침 else ""))
                말자막줄 = 말자막시안 and 갈래(g) == "말자막"   # T32 줄은 「시안없음」으로 넘기지 않는다 — 고르신 꼴을 사전에 적는 것만 이 줄을 푼다(GA1)
                if not 빈칸(뺌) and not 말자막줄:
                    주의("글자", f"{누구}({종류}) {세기} — 「시안없음」 까닭: {한칸(뺌)[:60]}"); continue
                글 = (f"{누구}({종류}) {세기} — 실제 장면 위에 얹은 시안을 둘 이상 만들어 그 그림 경로를 「시안」에 적는다"
                     + (f". {컨셉} 컨셉은 말자막 꼴을 아직 고르지 않았다 — 견본 둘을 보여 드려 고르시게 하고, 고르시면 사전 「컨셉.{컨셉}.자막」에 상태 고르심과 꼴을 적는다"
                        + ("(이 줄은 「시안없음」으로 넘기지 않는다)" if not 빈칸(뺌) else "") + "(영상양식/글자CG.json)"
                        if 말자막줄 else "(점검표 7 · 22 · 24 · 46 — 11-11 서울로 끝 제목은 시안 없이 얹어 기각됐다)"))
                (걸림 if 영상 else 주의)("글자", 글)
            # 정보 글을 화면 위에 조판 · 합성해 얹는 줄(11-11 서울로 연도 꼬리표 HTML) — 작품 편이면 딱지로 읽힌다. 앱 · 화면 시연처럼 일부러 얹는 편도 있어 주의 한 줄
            얹은정보 = [g for g in 글자 if isinstance(g, dict) and 갈래(g) == "정보" and 얹었나(str(g.get("만드는법") or ""), 엄격, 정보얹어침)]
            if 얹은정보:
                주의("글자", f"정보 글 {len(얹은정보)}줄을 화면에 얹는다(「{한칸(얹은정보[0].get('글') or '')[:16]}」{' 외' if len(얹은정보) > 1 else ''}) — "
                           "광고 · 공모 · 포트폴리오 작품이면 정보 글도 얹으면 딱지로 읽힌다. 장면에 굽거나 말로 하고, 앱 · 화면 시연처럼 일부러 얹는 편이면 그대로 둔다(점검표 7 · 40 — 11-11 서울로 연도 꼬리표)")
    # T11 소리
    소리 = seq.get("소리") if isinstance(seq.get("소리"), dict) else {}
    if 빈칸(소리.get("목소리")): 걸림("소리", "「소리.목소리」 칸이 비었다 — 누구 목소리인지(52), 목소리가 없는 편이면 「없음」이라고 적는다")
    첫말 = 소리.get("첫말초")
    if 숫자(첫말) is not None and 숫자(첫말) > 3: 주의("소리", f"첫 말이 {숫자(첫말):g}초 — 처음 3초 안에 말이나 끄는 소리가 나오는지 본다(30)")
    elif 첫말 is None and 빈칸(소리.get("초반을끄는것")): 주의("소리", "첫 말이 없는데 「소리.초반을끄는것」 칸이 비었다 — 처음 3초를 무엇이 끄는지 적는다(30)")
    if not any(x["등급"] in ("걸림", "주의") for x in r.항목들[전:]):
        r.더함("틀", "표", "통과", f"틀 2 — 컷 {len(det)} · 장면 {len(쓰는장면)} · 인물 {len(쓰는인물)} · 빈 칸 없음")


_컷표읽기 = None


def 컷표읽기():
    """tools/lib/컷표읽기.py — 칸 사전과 꼴 관문. -I로 돌 때는 import가 안 돼 경로로 불러온다(검사이력과 같은 방식)."""
    global _컷표읽기
    if _컷표읽기 is None:
        import importlib.util
        spec = importlib.util.spec_from_file_location("컷표읽기", str(Path(__file__).resolve().parent / "lib" / "컷표읽기.py"))
        m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); _컷표읽기 = m
    return _컷표읽기


def 표검사(seq, r, 항목=기본항목, 간격=(0.6, 1.0), 영상=None, 폴더=None, 그림폴더=None):
    """표만으로 도는 검사(콘티 단계) — main과 내기 도구(크레딧내기.py의 굽기전)가 같은 함수를 쓴다.
    폴더(컷표가 있는 편 폴더)는 편 날짜를 읽고 시작 그림 · 글자 시안 파일을 견줄 때 쓴다 — 내기 도구도 넘긴다(안 넘기면 날짜 문이 달린 검사가 모두 주의가 된다).
    그림폴더(--그림)는 시작 그림 파일을 읽어 견줄 때만 쓴다(T17) — 없으면 칸에 적힌 이름으로만 견준다.
    값 검사보다 먼저 꼴을 본다(tools/lib/컷표읽기.py — 11-20 설계 검토): 뼈대가 깨진 표(컷 줄을 읽을 수 없다)는 걸림만 내고 값 검사를 돌리지 않는다(항목과 상관없이).
    틀 2 표의 꼴이 틀린 칸(글 칸의 배열 · 객체 · 수 · 참거짓 …)은 「틀」 항목의 걸림이고, 그 칸은 seq에서 지워 값 검사가 빈칸으로 읽게 한다(면제 칸도 꼴이 틀리면 면제하지 않는다)."""
    읽기 = 컷표읽기()
    뼈대 = 읽기.뼈대검사(seq)
    r.뼈대탈 = bool(뼈대); r.꼴탈 = False   # 내기 도구가 읽는다 — 뼈대 탈 · 꼴 걸림이 있는 표로는 내지 못한다(--걸림무시로도 못 넘긴다)
    if 뼈대:
        for 어디, 글 in 뼈대: r.더함("틀", 어디, "걸림", 글)
        return
    if seq.get("detail") is None: seq.pop("detail", None)   # 「detail」: null은 칸이 없는 것과 같다 — 뒤의 검사가 빈 목록으로 읽는다(11-21 GPT 검수 GA6)
    꼴줄 = 읽기.꼴검사(seq, 비움=True) if "틀" in 항목 and 틀둘(seq) else []
    r.꼴탈 = bool(꼴줄)
    표빈칸(seq, r)
    if "틀" in 항목:
        if 틀둘(seq):
            for 어디, 글 in 꼴줄: r.더함("틀", 어디, "걸림", 글)
            틀검사(seq, r, 폴더, 그림폴더, 영상)
            if 꼴줄 and r.항목들[-1]["항목"] == "틀" and r.항목들[-1]["등급"] == "통과": r.항목들.pop()   # 꼴이 틀린 칸이 있으면 「빈 칸 없음」 통과 줄을 내지 않는다
        # 알림은 끝 코드를 바꾸지 않는다. 항목 이름은 표빈칸과 같은 자리(소품 · 표)에 둔다 — 표가 빈 컷순서의 항목 묶음(소품 · 사건 · 소리)을 고정한 기존 시험을 깨지 않으려고
        else:
            r.더함("소품", "표", "알림", "옛 틀 — 장면 · 구도 · 연기 · 끝 칸 검사 없음(틀 2로 옮기면 돈다)")
            # 같은 판 잇달아 자르기(50)만은 옛 틀에서도 본다 — 걸릴 때만 줄이 생겨 걸림 없는 옛 컷순서의 항목 수는 그대로다
            for 컷, 글 in 옛틀잇단같은판(seq): r.더함("편집", 컷, "걸림", 글)
    if "소품" in 항목:
        소품표검사(seq, r)
        for 등급, 컷, 글 in 화면밖소품동작(seq, 폴더): r.더함("소품", 컷, 등급, 글)   # 11-18 7번 — 글로 적은 화면 밖 동작은 통과가 아니다
    if "사건" in 항목: 사건표검사(seq, r)
    if "소리" in 항목: 소리표검사(seq, r, 간격, 영상)


컷표에없는판 = ('컷표에 이 판의 컷을 적고 판 id를 컷 이름으로 맞추거나 컷에 「판」을 적는다. 대안 판은 _순서.json 그 판에 "컷": ["<컷 이름>"], '
              '소리만 쓰는 판은 "소리만": true — 연기 · 구도 · 빛을 못 견줬다')


def 판의컷(seq, 판id, 판컷=None):
    """꾸러미 판 → 컷표의 컷 이름들. 판의 「컷」(이름 · 목록 — 대안 판 C2b의 "컷": ["C2"])이 컷표의 컷 이름이면 그것,
    아니면 detail의 cut이 판 id와 같거나, detail의 「판」이 그 id거나, 판 id가 <무엇>-<cut>으로 끝나면 그 컷."""
    det = (seq or {}).get("detail") or []
    이름들 = list(dict.fromkeys(d.get("cut") for d in det if isinstance(d.get("cut"), str) and d.get("cut")))
    원함 = [판컷] if isinstance(판컷, str) else [c for c in 판컷 if isinstance(c, str)] if isinstance(판컷, (list, tuple)) else []
    맞음 = list(dict.fromkeys(c for c in 원함 if c in 이름들))
    if 맞음: return 맞음
    컷들 = list(dict.fromkeys(d["cut"] for d in det if d.get("cut") == 판id or d.get("판") == 판id))
    if not 컷들:
        후보 = [c for c in 이름들 if str(판id).endswith("-" + c)]
        if 후보: 컷들 = [max(후보, key=len)]
    return 컷들


def 빛대조(seq, 컷들, 글):
    """틀 2 — 판의 지시문에 그 컷 장면의 「빛」 문장이 글자 그대로(공백 · 줄바꿈만 한 칸으로) 들었나, 표의 빛 줄 밖에 앞빛을 따로 적지 않았나(60) → [(등급, 글)].
    표의 빛 칸이 빈 것은 틀 검사(T1)가, 빛 이름이 빈 것은 틀 검사(T16)가 건다."""
    out = []; 장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}; 본 = set(); 정리글 = 한칸(글); det = seq.get("detail") or []
    out += 색감대조(seq, 글, "영상")   # T22 — 크레딧내기.py도 이 함수를 부르니 색감 줄도 여기서 본다
    for d in det:
        이름 = d.get("장면")
        if d.get("cut") not in 컷들 or not isinstance(이름, str) or 이름 in 본: continue
        본.add(이름)
        장면 = 장면표.get(이름) if isinstance(장면표.get(이름), dict) else None
        빛 = (장면 or {}).get("빛")
        if 빈칸(빛): continue
        if 한칸(빛) not in 정리글:
            out.append(("걸림", f"장면의 빛 문장이 표와 다르다 — 표의 빛 줄을 그대로 쓴다(51): 장면 「{이름}」 「{한칸(빛)[:70]}」"))
        # (60) 사람이 나오는 판 · 앞빛 이름을 고르지 않은 장면 — 표의 빛 줄 밖에 앞에서 고르게 비추는 빛을 따로 적으면 표의 빛 이름과 어긋난다
        표, _ = 빛이름표(); 이름들 = 빛이름들(장면)
        사람 = any(isinstance(x.get("인물"), list) and x["인물"] for x in det if x.get("cut") in 컷들 and x.get("장면") == 이름)
        if 표 and 사람 and 이름들 and not any(n.lower() in 표["앞빛허용"] for n in 이름들):
            나머지 = re.sub(r"\s+".join(re.escape(w) for w in 한칸(빛).split()), " ", str(글))   # 표의 빛 줄(공백 · 줄바꿈만 다른 꼴까지)을 걷고 본다
            m = next((x for x in _앞빛_글.finditer(나머지) if not _크로마뒤.match(나머지[x.end():])), None)
            if m: out.append(("걸림", f"지시문에 앞에서 고르게 비추는 빛 「{한칸(m.group(0))[:60]}」 — 장면 「{이름}」의 빛 이름({' · '.join(이름들)})과 어긋난다(60). 빛은 표의 빛 줄만 쓴다"))
    return out


def 지시문항목(seq, r, 경로들, 실내목록=None, 폴더=None, 검수=False):
    """꾸러미 · 지시문 글 검사 — 내기 도구의 굽기전()과 같은 판정 · 같은 등급이다(웹에서 손으로 내는 판은 이 검사가 관문이다). 걸림은 판 id로 적는다.
    검수(--지시문검수)면 지시문 검수 결과도 내기 도구처럼 판마다 본다(지시문검수결과검사). 꾸러미를 짓는 도구는 검수 없이 이 검사를 부른다 —
    검수자는 지은 꾸러미를 보니, 꾸러미를 짓는 단계에서 막으면 검수를 받을 판이 없다."""
    표실내 = {d["cut"] for d in (seq or {}).get("detail", []) if d.get("실내")}; 준실내 = set(실내목록 or [])
    틀2 = 틀둘(seq)
    판들 = 지시문판들(경로들)
    if not 판들: r.더함("지시문", "파일", "확인", "지시문 파일을 못 찾음"); return
    검수판 = []   # 지시문 검수를 받아야 하는 판 — 틀 2 컷표에 이어진, 그림을 쓰는 판
    for 판 in 판들:
        이름, cut, f, 글, 남길것 = 판["id"], 판["컷"], 판["파일"], 판["글"], 판["남길것"]
        정보 = 판정보(판["판"], seq)   # 판을 컷에 이어 그 컷의 실내 · 인물 · (틀 2) 장면의 빛을 본다
        if 정보["프리비즈"]: r.더함("지시문", 이름, "알림", "프리비즈 판 — 지시문 검사 건너뜀(움직임을 참고 영상에서 받는다)"); continue
        if not 글.strip(): r.더함("지시문", 이름, "걸림", f"지시문이 비었다: {f}"); continue
        컷들 = 정보["컷들"]
        실내 = True if ({cut, 이름} & 표실내 or {cut, 이름, *컷들} & 준실내) else 정보["실내"]
        hits = 지시문검사(글, 실내)
        for 등급, 항목, 말 in hits: r.더함("지시문", 이름, 등급, f"({항목}) {말}")
        for 등급, 항목, 말 in 남길것검사(남길것 or ""): r.더함("지시문", 이름, 등급, f"({항목}) {말}")
        for 등급, 항목, 말 in 사람지시문검사(글, 낼판=True, 인물=정보["인물"], 소리만=정보["소리만"], 박자최소=정보["박자최소"]): r.더함(항목, 이름, 등급, 말)   # 항목 「연기」 — 물건 · 실내 줄(지시문)과 섞지 않는다
        for 등급, 항목, 말 in 대사빠르기검사(글, 소리만=정보["소리만"]): r.더함(항목, 이름, 등급, 말)   # 항목 「대사」(11-18)
        if 정보["소리만"]: r.더함("지시문", 이름, "알림", "소리만 쓰는 판 — 사람 연기 · 컷표 대조 건너뜀")
        elif 틀2 and not 컷들: r.더함("지시문", 이름, "걸림", f"(컷표) 컷표에 없는 판 — {컷표에없는판}")
        elif 틀2:
            for 등급, 말 in 빛대조(seq, 컷들, 글): r.더함("지시문", 이름, 등급, f"(빛) {말}")
            for 등급, 말 in 시늉대조(seq, 컷들, 글): r.더함("지시문", 이름, 등급, f"(시늉) {말}")   # T30(29) — 크레딧내기.py의 굽기전도 같은 함수
            for 등급, 말 in 둘레대조(seq, 컷들, 글, 폴더): r.더함("지시문", 이름, 등급, f"(둘레) {말}")   # T31(26) — 크레딧내기.py의 굽기전도 같은 함수
            for 등급, 말 in 기법대조(seq, 컷들, 글, 폴더): r.더함("지시문", 이름, 등급, f"(기법) {말}")   # T29 기법(11-25) — 크레딧내기.py의 굽기전도 같은 함수
            검수판.append((이름, 글, 컷들))
        if not hits: r.더함("지시문", 이름, "통과", "물건 · 실내 낱말 없음")
    if 검수 and 검수판 and 폴더 is not None:   # 지시문 검수(11-25) — 내기 도구의 굽기전도 같은 함수
        for 등급, 이름, 말 in 지시문검수결과검사(seq, 폴더, 검수판): r.더함("지시문", 이름, 등급, f"(검수) {말}")
    if 틀2:   # (50) 서로 다른 컷의 판이 같은 시작 그림 파일을 쓴다
        for 등급, 이름, 말 in 꾸러미시작그림(seq, 판들): r.더함("지시문", 이름, 등급, 말)
    if seq:
        for d in seq.get("detail", []):
            for 등급, 항목, 말 in 남길것검사(" ".join(str(d.get(k, "")) for k in ("keep", "남길 것", "line"))): r.더함("지시문", d["cut"], 등급, f"({항목}) {말}")


# ───────── 방향(점검표 43) — 11-15 서울로 애니 네 지적(신발 · 유모차 · 거꾸로 걷는 사람)은 모두 시작 그림부터 반대쪽을 보고 있었고, 그림 글에 무엇이 어디를 보는지가 빠져 있었다 ─────────
# 컷표 그 컷의 구도 · 연기에 걷기 · 들고 남 · 탈것 · 밀고 끄는 물건이 있는데 그림 지시문(표의 장소 · 빛 · 생김새 문장을 걷어 낸 나머지)에 화면 기준 방향이 한 마디도 없으면 걸림.
# 방향을 부정문(「not backwards」 · 「neither foot is turned around」)으로 적으면 나노바나나가 그림을 거절했다(현장 노트 gemini_사진 11-15) — 주의.
_움직이는컷 = re.compile(r"걷|걸어|걸음|들어오|들어와|들어선|떠나|떠난|달려|달아나|뛰어|돌아서|밀고|밀어|끌고|끌어|지나가|지나간|지나친|유모차|승합차|페리|버스|자전거|택시|오토바이")
# 방향 말: 보는 쪽 · 가는 쪽을 뜻하는 말(facing · turned · toward · walking · pointing · from …) 뒤 서른 자 안의 화면 쪽, 또는 카메라 쪽.
# 「near the left of the frame」처럼 자리만 말하는 문장은 세지 않는다 — 표의 장소 문장이 늘 그렇게 쓰여 있어 옛 판이 그것으로 지나갔다.
_방향말 = re.compile(r"\b(fac(e|es|ing)|turn\w*|towards?|head(s|ed|ing)?|walk\w*|strid\w*|stroll\w*|mov(e|es|ing)|point\w*|look\w*|gaz\w*|eyes|glanc\w*|from|out\s+past|run\w*|slid\w*|roll\w*|swim\w*|lean\w*)\b"
                   r"[^.;]{0,30}?(\b(left|right)\s+((edge|side|half|corner|third)\s+)?of\s+the\s+(frame|picture|photo|image|shot)\b|\bframe's\s+(left|right)\s+(edge|side|corner|half)\b)"
                   r"|\btowards?\s+(the\s+camera|the\s+lens|us)\b|\baway\s+from\s+(the\s+camera|the\s+lens|us)\b"
                   r"|\bfrom\s+behind\b|\bbacks?\s+(is\s+|are\s+)?(turned\s+)?(to|toward|towards)\s+the\s+camera\b|\bfac(e|es|ing)\s+(the\s+camera|the\s+lens|us)\b"
                   r"|\bfrom\s+(the\s+)?(left|right)\s+to\s+(the\s+)?(left|right)\b|\b(left|right)-to-(left|right)\b"
                   r"|\bfacing\s+the\s+(way|direction)\s+(they|she|he|it)\s+(walk|walks|are\s+walking|is\s+walking|move|moves|go|goes|are\s+going|is\s+going)\b", re.I)
_방향부정 = re.compile(r"\b(not|never|no|neither|nor)\b[^.;]{0,40}?\b(backwards?|reversed|turned\s+around|upside[- ]down|the\s+wrong\s+way)\b", re.I)


# 문장마다 볼 것: 걷는 사람과 탈것 · 밀고 끄는 물건을 부르는 문장은 그 문장이나 바로 다음 문장에 방향 말이 있어야 한다(컷 전체에 한 마디만 있으면 나머지가 빠져도 지나갔다).
_움직이는것 = re.compile(r"\b(walk\w*|strid\w*|stroll\w*|march\w*|pram|prams|stroller|pushchair|buggy|ferry|bus|van|taxi|bicycle|bike|scooter|wheelchair|trolley)\b", re.I)
_방향예시 = ("「walking toward the left edge of the frame」 · 「seen from behind, walking away from the camera」 · "
          "「the pram's hood faces the left edge of the frame」처럼 화면 기준으로 보이는 대로 적는다(점검표 43)")


def 방향검사(d, 나머지, 원문, 걷어낼=()):
    """그림 지시문 한 장의 방향 줄 — [(등급, 글)]. d는 컷표 그 컷, 나머지는 표의 장소 · 빛 · 생김새 문장을 걷어 낸 지시문 글,
    걷어낼은 더 걷어 낼 표 문장(인물 묘사 · 옷 — 「leather shoes」 같은 옷 낱말은 방향을 물을 일이 아니다)."""
    out = []
    글 = 나머지
    for v in 걷어낼:
        if not 빈칸(v): 글 = re.sub(r"\s+".join(re.escape(w) for w in 한칸(v).split()), " ", 글)
    # 참고 그림 목록(REFS)과 금지(NOT) 줄은 이름을 늘어놓을 뿐이라 방향으로도 세지 않고 묻지도 않는다(「REFS: [IMG1] Sua facing the camera」는 장면의 방향이 아니다). 「inside the van」 · 「van interior」는 장소다.
    본문 = "\n".join(l for l in 글.splitlines() if not re.match(r"\s*(REFS|NOT)\s*:", l))
    움직임 = " ".join([str(d.get("구도") or "")] + [str(x.get("무엇") or "") for x in (d.get("연기") or []) if isinstance(x, dict)])
    m = _움직이는컷.search(움직임)
    if m and not _방향말.search(본문):
        out.append(("걸림", f"컷표에 「{m.group(0)}」(걷기 · 들고 남 · 탈것 · 밀고 끄는 물건)이 있는데 그림 지시문에 어디를 보고 어느 쪽으로 가는지가 없다 — 사람 · 신발 · 탈것 · 미는 물건마다 {_방향예시}"))
    else:
        문장들 = [s.strip() for s in re.split(r"(?<=[.;!?])\s+|\n+", 본문) if s.strip()]
        # 같은 것(걷는 사람 · 유모차 · 페리 …)은 지시문 어딘가에서 한 번 방향이 적히면 된다 — 다른 문장에서 자리만 다시 부를 때마다 묻지 않는다
        def 갈래(w):
            w = w.lower()
            if re.match(r"(walk|strid|stroll|march)", w): return "걷는 사람"
            if re.match(r"(pram|stroller|pushchair|buggy)", w): return "유모차"
            return w
        첫자리, 적힘 = {}, set()
        for i, s in enumerate(문장들):
            for x in _움직이는것.finditer(s):
                if re.search(r"\binside\s+(the\s+|a\s+|his\s+|her\s+)?$", s[:x.start()], re.I) or re.match(r"['’]?s?\s+(interior|stop|stops|shelter|lane|station|route|timetable|ticket|driver)\b", s[x.end():], re.I): continue
                g = 갈래(x.group(0)); 첫자리.setdefault(g, (x.group(0), s))
                if any(_방향말.search(문장들[k]) for k in (i - 1, i, i + 1) if 0 <= k < len(문장들)): 적힘.add(g)
        빠진 = [f"「{w}」 — 「{s[:70]}」" for g, (w, s) in 첫자리.items() if g not in 적힘]
        if 빠진:   # 낱말로 짐작하는 판정이라 확인 — 그 물건이 화면에서 정말 어느 쪽을 보는지 읽고, 빠졌으면 적는다
            out.append(("확인", f"걷는 사람 · 탈것 · 미는 물건 가운데 어디를 보고 어느 쪽으로 가는지가 한 번도 안 적힌 것: {' / '.join(빠진[:3])}{' …' if len(빠진) > 3 else ''} — {_방향예시}"))
    n = _방향부정.search(원문)
    if n:
        out.append(("주의", f"방향을 부정문으로 적었다 — 「{n.group(0)[:80]}」(그림 엔진이 거절하거나 오히려 그린다 · 「the rounded back of each boot faces the camera」처럼 보이는 대로 적는다 · 점검표 43)"))
    return out


def 그림지시문항목(seq, r, 경로들, 폴더=None):
    """이미지 콘티 지시문(<폴더>/<컷>.txt — 파일 이름이 컷 이름) — 틀 2일 때 그 컷 장면의 장소 · 빛, 인물마다 묘사 · 옷 문장이 글자 그대로 들었나(G11 · 51)."""
    if not 틀둘(seq):
        r.더함("그림지시문", "표", "알림", "옛 틀 컷표 — 이미지 지시문을 표와 견주지 않았다(틀 2로 옮기면 돈다)"); return
    파일 = {}
    for p in map(Path, 경로들):
        if not p.exists(): r.더함("그림지시문", p.name, "확인", f"경로를 못 찾음: {p}"); continue
        for f in (sorted(p.glob("*.txt")) if p.is_dir() else [p]):
            파일.setdefault(f.stem, f)
            파일.setdefault(re.sub(r"^\d+_", "", f.stem), f)   # 「01_C1.txt」처럼 순번을 붙인 이름도 받는다
    if not 파일: r.더함("그림지시문", "파일", "확인", "이미지 지시문 파일(<컷>.txt)을 못 찾음"); return
    det = seq.get("detail") or []
    장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    인물표 = seq.get("인물") if isinstance(seq.get("인물"), dict) else {}
    컷들 = list(dict.fromkeys(d["cut"] for d in det))
    쓴파일 = set()
    # (51) 되풀이해 나오는 탈것 · 소품 — 맨 위 「소품」 표의 줄(낱말이 적힌 줄)과 표에 줄이 없는 탈것 낱말
    나옴 = 소품나오는컷(seq)
    소품줄 = {이름: dict(낱말={w.lower() for w in 소품낱말(줄)}, 정규식=낱말정규식(소품낱말(줄)), 색=색낱말들(줄.get("색")) | 색낱말들(줄.get("생김새")), 생김새=줄.get("생김새"))
              for 이름, 줄 in 소품표줄(seq).items() if isinstance(줄, dict) and 소품낱말(줄)}
    생김새걷기 = [re.compile(r"\s+".join(re.escape(w) for w in 한칸(x["생김새"]).split())) for x in 소품줄.values() if not 빈칸(x["생김새"])]
    덮인낱말 = {w for x in 소품줄.values() for w in x["낱말"]}
    줄없는탈것 = {w: 낱말정규식([w]) for w in _탈것낱말 if w not in 덮인낱말}
    탈것색 = {}   # 표에 줄이 없는 탈것 낱말 → {컷: 그 컷의 지시문에서 그 낱말에 붙은 색}
    짝들 = []   # (견줄 이름, 컷 줄, 파일) — 시작 그림 <컷>.txt는 꼭 있어야 하고, 끝 · 가운데 그림 <컷>_끝.txt · <컷>_가운데.txt는 있으면 같은 규칙으로 본다
    for cut in 컷들:
        d = next(x for x in det if x["cut"] == cut); f = 파일.get(cut)
        짝들.append((cut, d, f if f is not None and f.exists() else None))
        for 꼬리 in ("_가운데", "_끝"):
            g = 파일.get(f"{cut}{꼬리}")
            if g is not None and g.exists(): 짝들.append((f"{cut}{꼬리}", d, g))
    for cut, d, f in 짝들:
        if f is None:
            r.더함("그림지시문", cut, "주의", f"이미지 지시문 파일이 없다: {cut}.txt"); continue
        원문 = f.read_text(encoding="utf-8")
        쓴파일.add(f); 글 = 한칸(원문); 빠짐 = []
        장면 = 장면표.get(d.get("장면")) if isinstance(d.get("장면"), str) else None
        for k in ("장소", "빛"):
            v = (장면 or {}).get(k) if isinstance(장면, dict) else None
            if not 빈칸(v) and 한칸(v) not in 글: 빠짐.append(f"장면 「{d.get('장면')}」의 {k}")
        for _, 말 in 색감대조(seq, 원문, "그림"): 빠짐.append(f"색감 「{seq.get('색감').strip()}」의 뼈대")   # T22 — GRADE 줄
        # T22 — 옷 · 벽 · 소품 색. PALETTE 줄의 글에서 찾는다 — 지시문 어디에든 있으면 지나가게 두면 PALETTE를 다른 색으로 적고 표의 문장을 NOTE에 남긴 지시문이 통과한다(11-21 GPT 검수)
        if isinstance(seq.get("세트"), str) and not 빈칸(seq.get("세트")) and not any(한칸(seq["세트"]) in 한칸(t) for l, t in 칸들(원문) if l == "PALETTE"): 빠짐.append("「세트」(PALETTE 줄)")
        맨얼굴 = d.get("그림단계") == "맨얼굴"   # 칠한 얼굴을 두 단계로 굽는 컷 — 1단계 판은 인물의 「맨얼굴묘사」로 견주고, 칠은 편 공통 편집 지시문(_로 시작하는 파일)이 맡는다
        # 그 그림에 실제로 나오는 사람 — 컷 도중에 들어오는 사람은 시작 그림에 없다(「그림인물」), 끝 그림은 「끝그림인물」. 없으면 컷의 「인물」
        칸 = "끝그림인물" if cut.endswith("_끝") else ("그림인물" if not cut.endswith("_가운데") else None)
        사람들 = d.get(칸) if 칸 and isinstance(d.get(칸), list) else d.get("인물")
        for 누구 in (사람들 if isinstance(사람들, list) else []):
            p = 인물표.get(누구) if isinstance(누구, str) else None
            for k in ("묘사", "옷"):
                kk = "맨얼굴묘사" if (k == "묘사" and 맨얼굴 and isinstance(p, dict) and not 빈칸(p.get("맨얼굴묘사"))) else k
                v = p.get(kk) if isinstance(p, dict) else None
                if not 빈칸(v) and 한칸(v) not in 글: 빠짐.append(f"인물 「{누구}」의 {kk}")
        # 소품: 표에 그 컷에 나온다고 적은 소품은 생김새 문장이 글자 그대로(인물 옷과 같은 대조). 색은 표의 생김새 줄을 걷어 낸 나머지 글에서 그 이름씨에 붙은 것만 본다
        나머지 = 원문
        for pat in 생김새걷기: 나머지 = pat.sub(" ", 나머지)
        for k in ("장소", "빛"):   # 표의 장소 · 빛 문장은 넓은 그림 기준이라 클로즈업에도 그대로 들어간다 — 그 안의 소품 낱말은 지시문을 쓴 사람의 말이 아니다
            v = (장면 or {}).get(k) if isinstance(장면, dict) else None
            if not 빈칸(v): 나머지 = re.sub(r"\s+".join(re.escape(w) for w in 한칸(v).split()), " ", 나머지)
        그대로 = {이름: not 빈칸(x["생김새"]) and 한칸(x["생김새"]) in 글 for 이름, x in 소품줄.items()}
        확인들 = []
        끝칸 = d.get("끝소품") if cut.endswith("_끝") and isinstance(d.get("끝소품"), dict) else {}   # 컷 도중에 화면을 떠나거나 들어오는 소품 — 끝 그림만 따로 적는다
        나오나 = lambda 이름: (끝칸[이름] not in _소품없음) if 이름 in 끝칸 else d["cut"] in 나옴.get(이름, [])
        for 이름, x in 소품줄.items():
            짝 = [n for n, y in 소품줄.items() if y["낱말"] & x["낱말"]]   # 같은 낱말로 부르는 줄(빨간 차 · 파란 차)은 색을 함께 받아 준다
            색, 구절, n = 붙은색들(나머지, x["정규식"])
            if 나오나(이름):   # 끝 · 가운데 그림도 그 컷의 소품 칸으로 본다(끝 그림은 「끝소품」이 있으면 그것으로)
                if not 그대로[이름] and not 빈칸(x["생김새"]): 빠짐.append(f"소품 「{이름}」의 생김새")
            elif n and not any(그대로[k] for k in 짝):
                확인들.append(f"지시문에 「{x['정규식'].search(나머지).group(0)}」이(가) 나오는데 소품 「{이름}」의 생김새 문장이 없다 — 이 컷에 나오면 표의 생김새 줄을 그대로 쓰고 컷의 「소품」 칸에도 적는다(51)")
            허용 = set().union(*(소품줄[k]["색"] for k in 짝))
            if 색 - 허용:
                확인들.append(f"소품 「{이름}」에 표에 없는 색 「{' · '.join(sorted(색 - 허용))}」 — 「{구절[0]}」(표의 색: {' · '.join(sorted(허용)) or '없음'}). 같은 {이름}이면 색을 따로 적지 않고 표의 생김새 줄만 쓴다(51)")
        for w, pat in 줄없는탈것.items():
            색, _, n = 붙은색들(나머지, pat)   # 장소 · 빛 문장 속 탈것은 모든 컷에 같은 글이라 색이 갈릴 수 없다
            if n: 탈것색.setdefault(w, {})[cut] = 색
        if 빠짐: r.더함("그림지시문", cut, "걸림", f"{' · '.join(빠짐)} 문장이 글자 그대로 들어 있지 않다 — 이미지 지시문은 표의 장소 · 빛 · 인물 · 소품 줄을 그대로 쓴다(G11 · 51)")
        else: r.더함("그림지시문", cut, "통과", "장소 · 빛 · 인물 줄이 표 그대로")
        for 말 in dict.fromkeys(확인들): r.더함("그림지시문", cut, "확인", 말)
        사람문장 = [p.get(k) for p in 인물표.values() if isinstance(p, dict) for k in ("묘사", "맨얼굴묘사", "옷", "기준그림구성")]
        for 등급, 말 in 방향검사(d, 나머지, 원문, 사람문장): r.더함("방향", cut, 등급, 말)
        for 등급, 말 in 렌즈지시문검사(seq, d, cut, 원문, 폴더): r.더함("그림지시문", cut, 등급, f"(렌즈) {말}")
        for 등급, 말 in 기법대조(seq, [d["cut"]], 원문, 폴더, 곳="그림"): r.더함("그림지시문", cut, 등급, f"(기법) {말}")
    for w, 컷색 in 탈것색.items():
        if len(컷색) < 2: continue
        색있는 = [s for s in 컷색.values() if s]
        한줄 = "맨 위 「소품」 표에 한 줄(낱말 · 색 · 생김새 · 기준그림)로 적고 그 생김새 문장을 모든 컷에 쓴다"
        if any(not (a <= b or b <= a) for a in 색있는 for b in 색있는):   # 한쪽이 다른 쪽에 다 들면(cream · blue ⊂ cream · cobalt · blue) 같은 색을 덜 적은 것이다
            컷별 = " / ".join(c + " " + " · ".join(sorted(s)) for c, s in 컷색.items() if s)
            r.더함("그림지시문", "표", "확인", f"탈것 「{w}」의 색이 그림 지시문마다 다르다(51) — {컷별}. 같은 탈것이면 {한줄}")
        else:
            r.더함("그림지시문", "표", "주의", f"탈것 「{w}」이(가) 그림 지시문 {len(컷색)}컷({' · '.join(list(컷색)[:6])}{' …' if len(컷색) > 6 else ''})에 나오는데 소품 표에 줄이 없다 — 같은 탈것이면 {한줄}(색을 안 적은 컷은 모델이 색을 지어낸다 · 51)")
    for f in dict.fromkeys(파일.values()):
        if f in 쓴파일 or not f.exists(): continue
        if f.stem.startswith("_"): r.더함("그림지시문", f.stem, "알림", f"편 공통 지시문(컷과 견주지 않는다): {f.name}")
        else: r.더함("그림지시문", f.stem, "주의", f"컷표에 없는 컷 이름의 지시문 파일: {f.name}")


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
                t = 컷시각(d, "t") + min(0.4, 컷시각(d, "dur") / 2); rgb = 한장(영상, t); 어디 = f"최종 {t:.1f}s"
            elif 받음 is not None:
                clip = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
                if not clip.exists(): r.더함("지도", cut, "확인", f"받은 판 없음: {clip.name}"); continue
                t = 컷시각(d, "in", 0.0) + min(0.4, 컷시각(d, "dur") / 2); rgb = 한장(clip, t); 어디 = f"{clip.name} {t:.1f}s"
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
            본것 += 1   # 대상 컷으로 먼저 센다 — 시각을 못 읽어 못 잰 컷도 대상이다(「대상 컷이 없다」 안내를 잘못 내지 않게, 11-21 GPT 다시 검수)
            try: t, dur = 컷시각(d, "t"), 컷시각(d, "dur")
            except ValueError as e: r.더함("고요", cut, "확인", f"컷 줄의 시각을 읽을 수 없어 못 쟀다 — {e}"); continue
            src, t0, t1, 어디 = 영상, t + 0.08, t + dur - 0.08, f"최종 {t + 0.08:.2f}~{t + dur - 0.08:.2f}s"
        elif 받음 is not None:
            src = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
            if not src.exists(): r.더함("고요", cut, "확인", f"받은 판 없음: {src.name}"); continue
            본것 += 1
            try: t0, t1 = 컷구간(d)
            except ValueError as e: r.더함("고요", cut, "확인", f"컷 줄의 시각을 읽을 수 없어 못 쟀다 — {e}"); continue
            어디 = f"{src.name} {t0:.1f}~{t1:.1f}s"
        else:
            continue
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
                for lab, t in (("첫", 컷시각(d, "t") + 0.1), ("끝", 컷시각(d, "t") + 컷시각(d, "dur") - 0.1)): 장들.append((f"최종 {t:.1f}s({lab})", 한장(영상, t)))
            elif 받음 is not None:
                clip = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
                if not clip.exists(): r.더함("점", cut, "확인", f"받은 판 없음: {clip.name}"); continue
                a, b = 컷구간(d)
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


# ───────── 얼굴 빛 재기(60) — 편집전점검.py의 face()와 같은 검출기(YuNet) · 같은 크기(긴 변 720) · 같은 좌우 셈 ─────────
_검출기 = None


def _얼굴검출기():
    global _검출기
    if _검출기 is None:
        import cv2
        모델 = Path.home() / ".rembg" / "models" / "yunet" / "face_detection_yunet_2023mar.onnx"
        if not 모델.exists(): raise RuntimeError(f"얼굴 검출 모델(YuNet)이 없다: {모델}")
        _검출기 = cv2.FaceDetectorYN.create(str(모델), "", (320, 320), 0.7, 0.3, 5000)
    return _검출기


def 얼굴상자들(rgb, 긴변=720):
    """잡힌 얼굴 상자 [(x0, y0, x1, y1) …](넓이 큰 차례)와 긴 변을 720으로 맞춘 그림(RGB) — 얼굴이 없으면 ([], 그림)."""
    import cv2
    np = _np(); h, w = rgb.shape[:2]; s = 긴변 / max(h, w)
    W, H = int(round(w * s / 2) * 2), int(round(h * s / 2) * 2)
    if (W, H) != (w, h): rgb = cv2.resize(rgb, (W, H), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_LINEAR)
    검출 = _얼굴검출기(); 검출.setInputSize((W, H))
    _, 얼굴들 = 검출.detect(np.ascontiguousarray(rgb[:, :, ::-1]))
    if 얼굴들 is None or not len(얼굴들): return [], rgb
    return [(int(max(0, x)), int(max(0, y)), int(min(W, x + fw)), int(min(H, y + fh))) for x, y, fw, fh in (f[:4] for f in sorted(얼굴들, key=lambda f: f[2] * f[3], reverse=True))], rgb


def 얼굴상자(rgb, 긴변=720):
    """가장 큰 얼굴의 상자 (x0, y0, x1, y1)와 긴 변을 720으로 맞춘 그림(RGB) — 얼굴이 없으면 (None, 그림)."""
    상자들, 줄인 = 얼굴상자들(rgb, 긴변)
    return (상자들[0] if 상자들 else None), 줄인


def 얼굴빛값(rgb, 상자):
    """얼굴 상자 안팎의 빛 값(빛이름.json 「잣대뜻」) — 좌우: 왼쪽 반 · 오른쪽 반 밝기 차 ÷ 얼굴 밝기(편집전점검.py face()의 lr과 같은 셈),
    위아래: 위 1/3 − 아래 1/3(÷ 얼굴 밝기, 위가 밝으면 +), 색: 왼쪽 반 · 오른쪽 반의 Lab a · b 거리, 역광: 얼굴 밝기 ÷ 얼굴 둘레(옆 · 위) 밝기. 상자가 너무 작으면 None."""
    import cv2
    np = _np(); x0, y0, x1, y1 = 상자; 조각 = np.ascontiguousarray(rgb[y0:y1, x0:x1])
    g = cv2.cvtColor(조각, cv2.COLOR_RGB2GRAY).astype(np.float32)
    if g.size < 64: return None
    평균 = max(1.0, float(g.mean())); 반 = g.shape[1] // 2; 셋 = max(1, g.shape[0] // 3)
    좌우 = abs(float(g[:, :반].mean()) - float(g[:, 반:].mean())) / 평균
    위아래 = (float(g[:셋].mean()) - float(g[-셋:].mean())) / 평균
    lab = cv2.cvtColor(조각, cv2.COLOR_RGB2LAB).astype(np.float32)
    색 = float(np.hypot(float(lab[:, :반, 1].mean()) - float(lab[:, 반:, 1].mean()), float(lab[:, :반, 2].mean()) - float(lab[:, 반:, 2].mean())))
    H, W = rgb.shape[:2]; fw, fh = x1 - x0, y1 - y0
    X0, X1, Y0 = max(0, x0 - fw), min(W, x1 + fw), max(0, int(y0 - 0.6 * fh))   # 둘레: 옆으로 얼굴 폭만큼 · 위로 얼굴 높이의 0.6배(턱 아래 몸은 넣지 않는다)
    둘레 = cv2.cvtColor(np.ascontiguousarray(rgb[Y0:y1, X0:X1]), cv2.COLOR_RGB2GRAY).astype(np.float32)
    수 = 둘레.size - g.size
    역광 = round(float(g.mean()) / max(1.0, (float(둘레.sum()) - float(g.sum())) / 수), 2) if 수 > 0 else None
    return {"좌우": round(좌우, 3), "위아래": round(위아래, 3), "색": round(색, 1), "역광": 역광}


def 빛항목(seq, r, 그림폴더=None, 영상=None, 받음=None, 앞=""):
    """틀 2 — 사람 컷의 정지 그림 · 받은 판 · 최종 판에서 가장 큰 얼굴의 빛을 재어 그 장면의 빛 이름과 견준다(60). 판정은 빛판정()."""
    if not 틀둘(seq): return
    det = seq.get("detail", []); 장면표 = seq.get("장면") if isinstance(seq.get("장면"), dict) else {}
    대상 = [d for d in det if isinstance(d.get("인물"), list) and d["인물"] and isinstance(d.get("장면"), str) and 빛이름들(장면표.get(d["장면"]))]
    if not 대상: return
    표, 까닭 = 빛이름표()
    if 표 is None: r.더함("빛", "표", "확인", f"빛 이름 표를 못 읽어 얼굴 빛을 못 쟀다 — {까닭}"); return
    try: _얼굴검출기()
    except Exception as e: r.더함("빛", "표", "확인", f"얼굴 검출기를 못 불러 사람 컷 {len(대상)}개의 얼굴 빛을 못 쟀다 — {e}"); return
    for d in 대상:
        cut = d["cut"]; 장면 = 장면표[d["장면"]]
        try:
            if 영상 is not None:
                t = 컷시각(d, "t") + 컷시각(d, "dur") / 2; rgb = 한장(영상, t); 어디 = f"최종 {t:.1f}s"
            elif 받음 is not None:
                clip = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
                if not clip.exists(): r.더함("빛", cut, "확인", f"받은 판 없음: {clip.name}"); continue
                a, b = 컷구간(d); t = (a + b) / 2; rgb = 한장(clip, t); 어디 = f"{clip.name} {t:.1f}s"
            else:
                p = 정지그림(그림폴더, cut)
                if not p: r.더함("빛", cut, "확인", f"정지 그림 없음: {그림폴더}/{cut}.png"); continue
                rgb = 그림읽기(p); 어디 = p.name
            상자, 줄인 = 얼굴상자(rgb)
        except Exception as e:
            r.더함("빛", cut, "확인", f"얼굴 빛을 못 쟀다 — {e}"); continue
        if 상자 is None: r.더함("빛", cut, "알림", f"얼굴을 못 찾음 — 손 · 뒷모습 · 먼 컷이면 넘긴다 · {어디}"); continue
        높이 = (상자[3] - 상자[1]) / 줄인.shape[0]; 값 = 얼굴빛값(줄인, 상자)
        if 값 is None or 높이 < 0.05: r.더함("빛", cut, "알림", f"얼굴이 작아(화면 높이의 {높이:.0%}) 빛을 재지 않았다 · {어디}"); continue
        등급, 글 = 빛판정(빛이름들(장면), 장면.get("빛"), 값, 표)
        r.더함("빛", cut, 등급, f"{글} · {어디}", **값)


def 감정자리그림(d, 그림폴더=None, 폴더=None):
    """그 토막에서 잴 그림 → (경로 | None, 「시작그림」 칸에 적혔나). 굽기 전 관문의 판 도구(tools/영상관문판.py 시작그림찾기)가 여는 그림과 같다 —
    칸에 적은 파일(시작그림경로 · 그 파일이 없으면 다른 그림으로 넘어가지 않는다), 칸이 비었으면 그림 폴더의 <컷>.png|jpg|jpeg|webp(컷 이름 그대로 · 파일 이름으로 바꾼 것),
    그것도 없으면 <컷>_… · <컷>-… 가운데 가장 새 판. 두 도구가 같은 그림을 고르는지는 tests/컷연속성검사.test.js가 판 도구의 원문과 견준다."""
    q, 적힘 = 시작그림경로(d, 폴더)
    if q is not None or 적힘: return q, 적힘
    곳 = Path(그림폴더) if 그림폴더 else None
    if 곳 is None or not 곳.is_dir(): return None, False
    cut = str(d.get("cut")); 이름 = re.sub(r'[\\/:*?"<>|\s]', "_", cut); 확장자 = (".png", ".jpg", ".jpeg", ".webp")
    for e in 확장자:
        for 후보 in (곳 / f"{cut}{e}", 곳 / f"{이름}{e}"):
            if 후보.exists(): return 후보, False
    판들 = sorted([x for x in 곳.iterdir() if x.suffix.lower() in 확장자 and re.match(rf"^{re.escape(이름)}[_\-].+", x.stem)], key=lambda x: x.stat().st_mtime)
    return (판들[-1] if 판들 else None), False


def 감정자리대상(seq, 그림폴더=None, 폴더=None):
    """T28 — 얼굴 폭을 잴 감정 자리 컷과 그 그림 → ([(컷, 그림 경로)], [그림이 아직 없는 컷]). 어느 토막을 재는지는 _감정잴토막(), 어느 그림인지는 감정자리그림()."""
    대상 = []; 없는 = []
    for cut, d in _감정잴토막(seq).items():
        q, _ = 감정자리그림(d, 그림폴더, 폴더)
        if q is None: 없는.append(cut)
        else: 대상.append((cut, q))
    return 대상, 없는


def 감정자리항목(seq, r, 그림폴더=None, 폴더=None):
    """T28(그림 · 항목 「얼굴」) — 감정 자리 컷의 시작 그림에서 잡힌 얼굴마다 폭 ÷ 그림 폭을 재어 아래선과 견준다(33). 고르기는 감정자리대상(), 판정은 감정자리판정().
    그림이 아직 없는 컷은 --그림을 준 때만 알린다(콘티 단계의 표 검사는 조용하다)."""
    if not 틀둘(seq): return
    자리 = 감정자리컷(seq); 잴 = _감정잴토막(seq); 대상, 없는 = 감정자리대상(seq, 그림폴더, 폴더)
    if 그림폴더:
        for cut in 없는:
            적힘 = 시작그림경로(잴[cut], 폴더)[1]
            r.더함("얼굴", cut, "알림", f"감정 자리({자리[cut]})의 시작 그림이 {'「시작그림」 칸에 적힌 자리에 없다' if 적힘 else '아직 없다'} — 굽고 나서 얼굴 폭을 잰다")
    if not 대상: return
    날짜 = 편날짜(seq, 폴더); 새편 = bool(날짜 and 날짜 >= 감정앵글부터)
    try: _얼굴검출기()
    except Exception as e: r.더함("얼굴", "표", "확인" if 새편 else "알림", f"얼굴 검출기를 못 불러 감정 자리 {len(대상)}컷의 얼굴 폭을 못 쟀다 — {e}"); return
    내림 = lambda w: int(w * 100) / 100   # 적는 값은 내려 적는다 — 아래선에 못 미친 값이 아래선으로 올라가 보이지 않게
    for cut, p in 대상:
        try: 상자들, 줄인 = 얼굴상자들(그림읽기(p))
        except Exception as e: r.더함("얼굴", cut, "확인" if 새편 else "알림", f"감정 자리의 얼굴 폭을 못 쟀다 — {e}"); continue
        H, W = 줄인.shape[:2]; 폭들 = [(x1 - x0) / W * 100 for x0, _, x1, _ in 상자들]   # 반올림하지 않은 값으로 견준다
        d = 잴[cut]; 사람 = d.get("그림인물") if isinstance(d.get("그림인물"), list) else d.get("인물")   # 재는 토막의 시작 그림에 나오는 사람
        사람수 = len([n for n in 사람 if isinstance(n, str) and n.strip()]) if isinstance(사람, list) else None
        등급, 글 = 감정자리판정(폭들, H > W, 새편, 사람수)
        r.더함("얼굴", cut, 등급, f"{글} · {p.name}", **({"얼굴폭": 내림(max(폭들)), "얼굴폭들": [내림(w) for w in 폭들]} if 폭들 else {}))


def 색감잰값(rgb):
    """화면 전체의 색감 잣대(색감이름.json 「잣대뜻」) — 긴 변 256px 안팎으로 솎아 sRGB → CIE Lab(D65)으로 잰다."""
    np = _np()
    a = np.asarray(rgb)[..., :3]
    s = max(1, int(max(a.shape[:2]) / 256))
    a = a[::s, ::s].astype(float).reshape(-1, 3) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[:, 1] - 16; A = 500 * (f[:, 0] - f[:, 1]); B = 200 * (f[:, 1] - f[:, 2])
    p2, p5, p30, p50, p70, p95 = (float(x) for x in np.percentile(L, [2, 5, 30, 50, 70, 95]))
    밝은 = L >= p70; 어두운 = L <= p30
    return dict(검정=round(p2, 1), 밝음=round(p50, 1), 대비=round(p95 - p5, 1), 채도=round(float(np.hypot(A, B).mean()), 1),
                따뜻함=round(float(B.mean()), 1), 나눔=round(float(B[밝은].mean() - B[어두운].mean()), 1) if 밝은.any() and 어두운.any() else 0.0)


# 문턱(잠정 — 색감이름.json 「잣대뜻」 「문턱」): 견본 그림과 첫 세 편의 값으로 다시 정한다. 그때까지 「확인」은 눈으로 볼 자리를 알리는 데만 쓴다.
색감튐 = dict(밝음=20.0, 검정=10.0, 따뜻함=10.0, 채도비=1.8)      # 같은 장면 컷끼리 — 클로즈업과 넓은 컷의 밝기 차는 넘기게 넉넉히
색감벗어남 = dict(밝음=8.0, 검정=6.0, 따뜻함=6.0, 채도비=1.33)    # 받은 영상 가운데 장 ↔ 그 컷의 시작 그림(현장 노트 higgsfield 「클립마다 색이 정지컷보다 어둡고 조금씩 다르다」)


def 색감차(값, 기준, 문턱):
    """두 잰값의 차 가운데 문턱을 넘은 것 → [글]."""
    out = []
    for k in ("밝음", "검정", "따뜻함"):
        d = 값[k] - 기준[k]
        if abs(d) > 문턱[k]: out.append(f"{k} {d:+.1f}")
    c1, c0 = max(값["채도"], 4.0), max(기준["채도"], 4.0)   # 거의 무채색끼리는 비를 보지 않는다
    if max(c1 / c0, c0 / c1) > 문턱["채도비"]: out.append(f"채도 {값['채도']:.1f} 대 {기준['채도']:.1f}")
    return out


def 색감항목(seq, r, 그림폴더=None, 영상=None, 받음=None, 앞="", 폴더=None):
    """틀 2 — 컷마다 화면 전체의 색감 값(검정 · 밝음 · 대비 · 채도 · 따뜻함 · 나눔)을 재어 적고(알림), 같은 장면에서 크게 튀는 컷과
    받은 영상이 시작 그림의 색감에서 크게 벗어난 컷을 「확인」으로 낸다(T22 · 51). 문턱은 잠정이다(위 색감튐 · 색감벗어남)."""
    if not 틀둘(seq): return
    np = _np(); det = [d for d in seq.get("detail", []) if isinstance(d, dict) and d.get("cut")]
    줄 = 고른색감(seq); 잰 = {}
    for d in det:
        cut = d["cut"]
        try:
            if 영상 is not None:
                t = 컷시각(d, "t") + 컷시각(d, "dur") / 2; rgb = 한장(영상, t); 어디 = f"최종 {t:.1f}s"
            elif 받음 is not None:
                clip = Path(받음) / f"{앞}{d.get('판', cut)}.mp4"
                if not clip.exists(): r.더함("색감", cut, "확인", f"받은 판 없음: {clip.name}"); continue
                a, b = 컷구간(d); t = (a + b) / 2; rgb = 한장(clip, t); 어디 = f"{clip.name} {t:.1f}s"
            else:
                p = 정지그림(그림폴더, cut)
                if not p: r.더함("색감", cut, "확인", f"정지 그림 없음: {그림폴더}/{cut}.png"); continue
                rgb = 그림읽기(p); 어디 = p.name
            값 = 색감잰값(rgb)
        except Exception as e:
            r.더함("색감", cut, "확인", f"색감 값을 못 쟀다 — {e}"); continue
        잰[cut] = 값
        r.더함("색감", cut, "알림", " · ".join(f"{k} {v:g}" for k, v in 값.items()) + f" · {어디}", **값)
        # 받은 영상 ↔ 그 컷의 시작 그림(컷표 「시작그림」, 편 폴더 기준)
        if 받음 is not None and 폴더 is not None and not 빈칸(d.get("시작그림")):
            sp = Path(폴더) / str(d["시작그림"])
            if sp.exists():
                try:
                    차 = 색감차(값, 색감잰값(그림읽기(sp)), 색감벗어남)
                    if 차: r.더함("색감", cut, "확인", f"받은 영상이 시작 그림({sp.name})의 색감에서 벗어났다 — {' · '.join(차)}. 영상 지시문 LOOK 줄"
                                   f"{'에 색감 「' + 줄['이름'] + '」의 영상뼈대가 있는지' if 줄 else ''} 보고, 튀면 후보정하지 말고 그 판을 다시 뽑는다(51)")
                except Exception as e:
                    r.더함("색감", cut, "확인", f"시작 그림 색감을 못 쟀다 — {e}")
    # 같은 장면 안에서 튀는 컷 — 셋 이상이면 가운데값과, 둘이면 서로 견준다
    장면별 = {}
    for d in det:
        if d["cut"] in 잰 and isinstance(d.get("장면"), str): 장면별.setdefault(d["장면"], []).append(d["cut"])
    for 이름, 컷들 in 장면별.items():
        if len(컷들) < 2: continue
        if len(컷들) == 2:
            차 = 색감차(잰[컷들[1]], 잰[컷들[0]], 색감튐)
            if 차: r.더함("색감", f"{컷들[0]} · {컷들[1]}", "확인", f"같은 장면 「{이름}」의 두 컷 색감이 다르다 — {' · '.join(차)}. 한 편은 한 세계 — 튀는 컷은 같은 빛 · 색감 줄로 다시 뽑는다(51)")
            continue
        기준 = {k: float(np.median([잰[c][k] for c in 컷들])) for k in ("밝음", "검정", "따뜻함", "채도")}
        for c in 컷들:
            차 = 색감차(잰[c], 기준, 색감튐)
            if 차: r.더함("색감", c, "확인", f"같은 장면 「{이름}」의 다른 컷과 색감이 튄다(장면 가운데값과) — {' · '.join(차)}. 튀는 컷은 같은 빛 · 색감 줄로 다시 뽑는다(51)")
    if 잰:
        가운데 = {k: round(float(np.median([v[k] for v in 잰.values()])), 1) for k in ("검정", "밝음", "대비", "채도", "따뜻함", "나눔")}
        방향 = (" — 색감 「" + 줄["이름"] + "」 방향: " + " · ".join(f"{k} {v}" for k, v in (줄.get("방향") or {}).items())) if 줄 else " — 색감을 고르지 않은 편"
        r.더함("색감", "편", "알림", "편 가운데값 " + " · ".join(f"{k} {v:g}" for k, v in 가운데.items()) + 방향 + "(문턱은 견본 · 첫 세 편 값으로 정한다)", **가운데)


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
        elif a in ("--지시문", "--그림지시문"):
            o[a[2:]] = []; i += 1
            while i < len(argv) and not argv[i].startswith("--"): o[a[2:]].append(argv[i]); i += 1
        elif a == "--항목": o["항목"] = [s.strip() for s in 값(a).split(",") if s.strip()]; i += 2
        elif a == "--간격":
            parts = [float(s) for s in 값(a).split(",") if s.strip()]
            if len(parts) != 2 or parts[0] > parts[1]: raise SystemExit("--간격은 「0.6,1.0」처럼 짧은 쪽,긴 쪽 둘이다")
            o["간격"] = (parts[0], parts[1]); i += 2
        elif a == "--실내": o["실내"] = [s.strip() for s in 값(a).split(",") if s.strip()]; i += 2
        elif a == "--json": o["json"] = True; i += 1
        elif a == "--지시문검수": o["지시문검수"] = True; i += 1
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
        if o["json"]: print(json.dumps(r.항목들, ensure_ascii=False, indent=1)); 코드 = r.코드()
        else: 코드 = r.보고()
        _검사이력(r, 코드, 시작=(o["_"][1:] or [None])[0], 단계="지시문", 판경로=o["_"][1:])
        return 코드
    seq_path = Path(o["_"][0]); seq = 장면실내채움(json.loads(seq_path.read_text(encoding="utf-8")))
    출력 = Path(o.get("출력") or seq_path.parent / "검사_연속성"); 출력.mkdir(parents=True, exist_ok=True)
    지도 = None
    지도경로 = o.get("지도") or (seq.get("지도") if isinstance(seq, dict) else None)
    if 지도경로:
        p = Path(지도경로); p = p if p.is_absolute() or p.exists() else seq_path.parent / p
        지도 = json.loads(p.read_text(encoding="utf-8"))
    항목 = set(o["항목"] or 기본항목)
    영상 = o.get("영상"); 받음 = o.get("받음"); 그림 = o.get("그림")
    표검사(seq, r, 항목, o["간격"], 영상, 폴더=seq_path.parent, 그림폴더=그림)
    if 컷표읽기().뼈대검사(seq): 항목 = set()   # 뼈대가 깨진 표 — 표 검사가 걸림을 냈다. 컷 줄을 읽는 나머지 항목은 돌지 않는다
    if "지시문" in 항목 and o.get("지시문"): 지시문항목(seq, r, o["지시문"], o["실내"], 폴더=seq_path.parent, 검수=o.get("지시문검수", False))   # 편 폴더 — 날짜 문이 달린 지시문 검사(T31)가 편 날짜를 읽는다
    elif "지시문" in 항목:
        for d in seq.get("detail", []):
            for 등급, 항, 말 in 남길것검사(" ".join(str(d.get(k, "")) for k in ("keep", "남길 것", "line"))): r.더함("지시문", d["cut"], 등급, f"({항}) {말}")
    if "그림지시문" in 항목 and o.get("그림지시문"): 그림지시문항목(seq, r, o["그림지시문"], 폴더=seq_path.parent)
    매체 = 영상 or 받음 or 그림
    if 매체:   # 컷 줄의 시각(t · dur · in · out)은 재는 자리마다 컷시각() · 컷구간()으로 읽는다 — 못 읽으면 그 컷만 「확인」으로 낸다(날것으로 셈하지 않는다)
        if "점" in 항목: 점항목(seq, r, 출력, 그림, 영상, 받음, o["앞"])
        if "지도" in 항목:
            if 지도: 지도항목(seq, r, 지도, 출력, 그림, 영상, 받음, o["앞"])
            else: r.더함("지도", "표", "확인", "소품 지도가 없다(--지도 · 컷순서 「지도」) — 쌓이는 소품이 있는 편이면 첫 콘티에서 지도를 만든다(점검표 39)")
        if "고요" in 항목 and (영상 or 받음): 고요항목(seq, r, 지도, 영상, 받음, o["앞"])
        if "빛" in 항목: 빛항목(seq, r, 그림, 영상, 받음, o["앞"])
        if "색감" in 항목: 색감항목(seq, r, 그림, 영상, 받음, o["앞"], 폴더=seq_path.parent)
    # T28 — 표만 돌려도 시작 그림 파일이 있으면 잰다. --영상 · --받음과 함께는 --항목에 얼굴을 밝혔을 때만(기본 실행의 편집 단계에 시작 그림 판정을 끼우지 않는다 — GA7)
    if "얼굴" in 항목 and ("얼굴" in (o["항목"] or []) or not (영상 or 받음)): 감정자리항목(seq, r, 그림, 폴더=seq_path.parent)
    if not o["json"]:
        # JSON은 미디어 검사기끼리 쓰는 계약이다. 사람이 콘티를 보는 명령은 현행 기준 로드도 판정한다.
        실패 = _영상기준(seq_path)
        if 실패:
            r.더함("영상기준", "표", "걸림", 실패)
    (출력 / "결과.json").write_text(json.dumps(dict(컷순서=str(seq_path), 영상=영상, 받음=받음, 그림=그림, 항목=r.항목들, 코드=r.코드()), ensure_ascii=False, indent=1), encoding="utf-8")
    단계 = "편집" if 영상 else "받은 뒤" if 받음 else "이미지 콘티" if 그림 else "지시문" if (o.get("지시문") or o.get("그림지시문")) else "콘티"
    판경로 = [str(seq_path), 영상, 받음, 그림, *(o.get("지시문") or []), *(o.get("그림지시문") or [])]
    if o["json"]:
        print(json.dumps(r.항목들, ensure_ascii=False, indent=1)); 코드 = r.코드()
    else:
        코드 = r.보고(); print(f"결과 {출력 / '결과.json'}")
    _검사이력(r, 코드, 시작=str(seq_path), 단계=단계, 판경로=판경로)
    return 코드


def _영상기준(seq_path):
    import os
    도구 = Path(__file__).resolve().with_name("영상기준.js")
    try:
        제한 = max(float(os.environ.get("SYNK_FLAW_LEDGER_TIMEOUT_MS") or 240000), 1.0) / 1000
        p = subprocess.run(["node", str(도구), str(seq_path.resolve())], capture_output=True,
                           text=True, encoding="utf-8", timeout=제한, stdin=subprocess.DEVNULL,
                           creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        if p.returncode == 0 and p.stdout.startswith("[영상 기준] "):
            print(p.stdout.rstrip(), file=sys.stderr)
            return None
        return f"현재 영상 기준을 읽지 못했다. {(p.stderr or '').strip()} 공용 작업본에서 영상기준.js를 다시 실행한다."
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        return f"현재 영상 기준을 확인할 수 없다. {exc}"


def _검사이력(r, 코드, 시작=None, 단계="", 판경로=None):
    """편 폴더 게시/검사이력.jsonl에 이 실행 한 줄(tools/lib/검사이력.py, 흠 장부 설계 1단계) — 걸림 · 확인 줄만 옮긴다.
    무엇이 실패해도 위 출력과 끝 코드는 그대로다. 편 폴더는 컷순서 · 지시문 파일에서 위로 찾는다(게시/준비.json · 컷표.json · 컷순서.json)."""
    try:
        import os
        if os.environ.get("SYNK_검사이력") == "끔":
            return
        import importlib.util
        spec = importlib.util.spec_from_file_location("검사이력", str(Path(__file__).resolve().parent / "lib" / "검사이력.py"))
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        걸림 = [{"규칙": x.get("항목"), "등급": x.get("등급"), "글": f"{x.get('컷')}: {x.get('글')}"} for x in r.항목들 if x.get("등급") in ("걸림", "확인")]
        m.도구에서남기기(시작=시작, 눈="컷연속성검사", 단계=단계, 결과={0: "통과", 1: "걸림", 2: "확인"}.get(코드, "못 잼"), 끝코드=코드,
                     판=m.경로지문(판경로) if 판경로 else None, 걸림=걸림)
    except BaseException:   # noqa: BLE001 — 이력은 검사 결과를 바꾸지 않는다
        pass


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
