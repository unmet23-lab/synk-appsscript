# PULSE 포트폴리오 시댄스 2.5 1일 무제한 — 여러 편을 한 순서표로 묶는 웹 꾸러미(2026-10-28).
#   python -X utf8 웹꾸러미.py          → synk-vendor/pulse-seedance-day-20261028/웹올리기/<순번>_<판>/ · 순서표.html · _순서.json
#   python -X utf8 웹꾸러미.py --보기 p11-07-08   → 그 판의 지시문만 찍는다
#   python -X utf8 웹꾸러미.py --둘째날 <A|B> [--보기 <판>]   → 7번 숏드라마만 웹올리기_둘째날/에(첫날 폴더는 건드리지 않음, 방식은 목소리 시험에서 고른 것)
#   python -X utf8 웹꾸러미.py --프리비즈   → 5번 8행 프리비즈 시험 두 판만 웹올리기_프리비즈/에(팁 장부 36행 — 맨 끝 선택 판, 다른 꾸러미는 건드리지 않음)
#   python -X utf8 웹꾸러미.py --로맨스 [B|A|없음] [--보기 <판>]   → 로맨스 단편 「다 비침」만 웹올리기_로맨스/에(따로 꾸러미 — 다른 꾸러미는 건드리지 않음, 방식은 결정 10-29대로 B)
#   python -X utf8 웹꾸러미.py --여섯편 [--보기 <판>]   → 6 · 8 · 10번 · 블프 두 편 · 1번만 웹올리기_여섯편/에(10-31 밤 — 다른 꾸러미는 건드리지 않음)
# 편마다 지시문 원천은 video/<편>/지시문/영상_시댄스웹.json(아래 「편」 표). 매진 임박은 이미 만든 웹올리기_v5 폴더를 그대로 옮긴다.
# 무제한은 웹에서 사람이 한 판씩 누르는 것만 허용된다(자동화 금지 — 결정 10-26) — 이 도구는 폴더와 순서표만 만들고 누르지 않는다.
import copy, html, json, os, re, shutil, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.join(os.path.dirname(HERE), "video")
OUT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기"
HS = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/영상/웹올리기_v5"
HS_PLAN = os.path.join(VIDEO, "homeshopping-horror-20261021", "목소리", "계획_v5.json")   # 대사 줄마다 배역(메모 「#컷 · …」)
TOKEN1, TOKEN2 = "@이미지 1", "@이미지 2"   # 한국어 화면의 업로드 이름(영어 화면은 @Image 1) — LAB 굽기 시트와 같다
AUDIO1 = "@오디오 1"   # 소리 꼬리표 — 화면에서 글자가 꼬리표로 안 바뀌면 지우고 @로 올린 소리를 고른다

# 대사 목소리(10-29 유호님 — 결정 표 10-29 두 행): 대사는 시댄스가 직접 연기한 목소리를 그대로 쓰고(「목소리는 일단 기본적으로 시댄스가 직접 연기한
#   목소리를 그대로 쓰자」), 목소리는 처음 시댄스가 내 준 것으로 정한다(「기본은 처음 시댄스가 제공해주는걸로」). 타입캐스트는 광고 배우 목소리에 쓰지 않고
#   (「너무 부자연스럽다」), 시댄스 목소리가 어색할 때의 대안은 일레븐 v4다.
#   그래서 배역마다 맨 앞에 「목소리 판」 하나 — 견본 없이 일상 문장 한 줄을 말하게 해 시댄스가 처음 낸 목소리를 그 배역 목소리로 삼고, 받은 판에서 소리를
#   떼어(견본떼기.py) 그 배역 대사 판마다 3_목소리견본.mp3로 넣는다(새 방식 B — 목소리 결만 따르고 대사는 지시문의 한국어를 시댄스가 연기).
#   견본은 목소리 판을 받은 뒤 생기므로 대사 판 폴더는 그때 이 도구를 다시 돌려 채운다. 목소리 시험(지유 #7 · #12의 B 둘)은 시험 여섯 뒤에 둬서
#   그동안 견본을 떼어 넣는다 — 같은 견본으로 낸 두 컷이 같은 사람으로 들리는지 · 입과 소리가 맞는지 먼저 본다.
SEED_SAMPLES = "C:/Users/q1212/Documents/synk-vendor/homeshopping-horror-20261021/목소리/시댄스견본"   # 목소리 판에서 뗀 견본(견본떼기.py가 만듦)
SAMPLE_FILE = {"지유": "jiyu.mp3", "리4": "ri4.mp3", "통2": "tong2.mp3", "강도": "gangdo.mp3"}
HS_CASTING = [   # (배역, 시작 그림을 빌릴 컷, 화면 속 사람, 대명사, 말할 글 — 5~6초, 대사가 아닌 일상 말)
    ("지유", 7, "The young woman in the white lace veil", "her", "내일이 결혼식이라, 오늘은 친구들이랑 조촐하게 모였어요. 다들 와 줘서 고마워요."),
    ("리4", 8, "The young woman with round glasses, a black bob and red ribbon bows in her hair", "her", "이번에 나온 핑크 에디션, 제가 제일 먼저 샀어요. 색이 너무 예뻐서 매일 들고 다녀요."),
    ("통2", 16, "The curly-haired woman with the rose crown", "her", "오늘 저녁 메뉴는 제가 골랐어요. 치즈랑 계란은 꼭 넣어 달라고 했어요."),
    ("강도", 23, "The man in the black balaclava", "his", "택배는 문 앞에 두고 갈게요. 상자가 좀 무거우니까, 들 때 조심하세요."),
]
CASTING_LEN = 7   # 가장 긴 판(7초)과 같게 — 1일권 길이 상한을 넘지 않게
VOICE_TESTS = ["hs-S07-B", "hs-S12-B"]
# 화면 밖 대사 판(10-31 검수) — 광고 카드 위에서 읊는 줄과 화면 밖 외침은 화면 컷 대사 판(B)에 없어, 10-29 타입캐스트를 뺀 뒤 낼 길이 없었다.
#   배역마다 그 배역 그림으로 소리만 쓰는 판 하나(B — 그 배역 견본의 결로 시댄스가 연기). 줄과 자리는 04_콘티 3절 「말 · 소리」 칸 그대로
#   (#24 「안 돼!」 둘은 콘티가 배역을 정하지 않아 지유 판 끝에 둘을 둠 — 편집에서 다른 배역 판의 외침으로 바꿔 써도 된다).
HS_LINES = [   # (판 꼬리, 배역, 그림을 빌릴 컷, 화면 속 사람, 대명사, 길이, 쓰는 컷, 연기 · 줄)
    ("지유", "지유", 7, "The young woman in the white lace veil", "her", 8, ["11", "24"],
     'wails in Korean in one breath, pleading and close to tears: "안 돼, 내 금장 한정판 꽉 미니! 홈쇼핑 단독 구성이란 말이에요!" — then, after '
     'one shaky breath, she cries out twice, a beat apart: "안 돼!" … "안 돼!"'),
    ("리4", "리4", 8, "The young woman with round glasses, a black bob and red ribbon bows in her hair", "her", 8, ["21"],
     'rattles off in Korean in one desperate breath, faster and faster, close to tears: '
     '"안 돼, 내 핑크 에디션! 진공 4중 잠금 6종 세트 뚜껑 색 다른 버전! 라벨 스티커 포함! 제발요!"'),
    ("통2", "통2", 16, "The curly-haired woman with the rose crown", "her", 8, ["3", "15", "29"],
     'says a few short Korean lines with clear pauses between them: first, timidly holding something out, "여기요!"; after a pause, a sharp cry, '
     '"안 돼!"; after another pause, two cries a beat apart, "안 돼!" … "안 돼!"; and last, starting to sob, "그거 내 저녁인데!"'),
    ("강도", "강도", 23, "The man in the black balaclava", "his", 4, ["25", "27"],
     'first lets out one short startled grunt, "으!", and after a pause asks flatly under his breath, baffled: "…왜?"'),
]
VOICE_LINES = (f"VOICE: {AUDIO1} is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, "
               "but never play it and never say its words; perform only the Korean lines written above, the way this moment demands.")
# 다른 편 판의 목소리 견본 — 판의 「목소리견본」 칸은 견본을 뗄 목소리 판 id를 적고, 파일 자리는 여기(견본떼기.py가 같은 자리에 만든다)
OM_SAMPLE = "C:/Users/q1212/Documents/synk-vendor/pulse-rehearsal-20261029/새판/목소리/hangyeol.mp3"
VOICE_FROM = {"om2-2": (OM_SAMPLE, "아… 목 타 죽겠다.")}
# 여섯 편 배역 목소리 판(10-31 밤) — 6번 입 보이는 대사 둘(7 엄마 · 11 딸)의 견본. 글은 6번 지시문 「목소리판」 칸과 같다(견본떼기.py 받아쓰기 대조)
P6_SAMPLES = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/소리/p6/시댄스견본"
VOICE_FROM.update({
    "p6-목소리-엄마": (P6_SAMPLES + "/eomma.mp3", "냉장고에 수박 썰어 놨어. 공부하다 출출하면 나와서 먹어."),
    "p6-목소리-딸": (P6_SAMPLES + "/ttal.mp3", "역 앞에 새로 생긴 국숫집, 생각보다 맛있더라."),   # 11-01 Fable — 25음절은 7초 판에 빠듯해 줄임
})

# 굽는 차례 — 짧은 편부터 끝까지 마쳐 하루가 모자라도 완성 편이 남게 한다. 「시험」은 맨 앞에서 길을 확인하는 판.
PIECES = [  # (편, 원천 폴더) — 매진 임박(hs)은 따로
    ("p11", "pet-ad-20261026"),
    ("p2", "mens-fragrance-20261026"),
    ("p12", "comedy-montage-20261026"),
    ("p5", "sports-manifesto-20261026"),
    ("p4", "fashion-film-20261026"),
    ("s1", "xmas-neighbors-20261025"),   # 시즌1 옆집의 크리스마스(10-29 붙임) — 14 · 36은 옛 판 그대로(늘켬 글자는 후반), 고친 여섯 컷은 10-29 확정
    ("om", "omitok-20261029"),   # 오미톡 15초 — 10-30 옛 콘티 다섯 판은 뺐고(유호님 「이거는 슬롭이야」), 같은 날 「치익톡」 2판 일곱(+대안 둘)으로 다시 붙임(유호님 「무제한 날에 붙여」) · 맨 끝이라 앞 편 판 번호는 그대로
]
# 목소리 시험 다음 판: 두 샷 묶음 · 끝 그림 판 · 첫 화면 뒤 비켜 돌았다 찾는 카메라(12번 2 — 10은 10-29부터 다가가기라 2로) · 거꾸로 뒤집힌 얼굴(5번 9행)
TESTS = ["p11-07-08", "p11-09", "p12-02", "p5-09", "s1-30", "s1-19"]   # 옆집 30 큰 아크 · 19 어깨 너머 느린 다가감(10-29 바꾼 카메라)

RATIO_EN = {"9:16": "vertical 9:16", "16:9": "horizontal 16:9"}

# 둘째 날 — 7번 숏드라마(다 붙이면 하루를 넘어 따로 낸다 — 굽기 시트 「둘째 날 전」 3번, 7번 콘티 8절, 곁 세션 인계 메모 p7_시댄스지시문_인계.md).
#   7번만의 칸: 판 「소리」 켬 · 「B만 켬」(방식 B일 때만 켬) · 끔, 「소리줄」 {A, B, 없음}은 prompt()의 마지막 SOUND 줄로, 「소리참고」(비었으면 아래
#   P7_SOUND 자리), 「B길이」(방식 B에서 말이 끝날 때까지 받는 길이). 7번에는 voice_b()를 걸지 않는다 — B 줄에 같은 VOICE 줄이 이미 있다.
#   「후보판」(첫 걸이 2-1p · 1-1p)은 쓰지 않기로 해서(10-29) 넣지 않는다.
DAY2 = ("p7", "short-drama-20261026")
OUT2 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_둘째날"
P7_SOUND = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/소리/p7/소리참고"   # A/<판 id>.mp3(입 맞춤 대사) · B/<배역>.mp3(목소리 견본)
P7_ROLE = {"IAN": "ian", "SEOJIN": "seojin", "MINJAE": "minjae", "SOYEON": "soyeon"}
OUT3 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_7번비교"
CMP = ["p7-1-5", "p7-2-45", "p7-2-40", "p7-1-38", "p7-1-16", "p7-1-32", "p7-1-26-27", "p7-2-10"]   # 얼굴 가까이 · 두 사람 · 우는 얼굴 · 사무실 · 카페 · 소품 두 샷 · 끝 그림
CMP_ROUTES = [("얼굴흐림", "선버스트_얼굴흐림"), ("새로", "선버스트_새로")]   # video/short-drama-20261026/이미지콘티_선버스트.py --길
# 프리비즈 시험(팁 장부 36행 · 10-31) — 블렌더 없이 원본 컷을 시댄스로 회색 마네킹 판(①)으로 바꾸고, 시작 그림 없이 ① + 정지컷 · 배역 · 배경 참고로 마지막 판(②).
#   ① 참고 = 원본 8행 컷만(11.84–14.02초 — 앞뒤 여유를 붙이면 앞 컷 · 뒤 컷의 원본 얼굴이 들어와 컷만 자름), ② 참고 = ①의 받은 영상 + S08 · R3 · R2.
#   ②의 1_프리비즈.mp4는 ①을 받은 뒤 이 자리에 두고 다시 돌린다(없으면 「파일 아직」). 원본 조각 · 프리비즈는 git 밖에만.
OUT4 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_프리비즈"
PV_DIR = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/콘티/p5/프리비즈"
PV_SRC = PV_DIR + "/원본_8행_컷만_11.84-14.02초.mp4"
PV_OUT1 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음/pv5-08-1.mp4"   # 받기.py가 받는 자리 — 받은 뒤 원본 생김새 0을 눈으로 보고 --프리비즈를 다시 돌린다
VIDEO1 = "@영상 1"   # 영상 꼬리표(확인 전) — 화면에서 꼬리표로 안 바뀌면 지우고 @로 올린 영상을 고른다
DAY2_BUFFER = ["p7-1-1", "p7-1-7", "p7-1-12", "p7-1-22", "p7-1-24", "p7-1-26-27"]   # 소리 끔 판 — 목소리 판 뒤 견본이 들어올 때까지(10-30)
DAY2_TESTS = ["p7-1-16", "p7-2-28"]   # 두 방식을 같은 컷으로(02_콘티 8-4) — 고른 방식 판이 그 컷의 주판을 겸한다
CAMERA_ALT = {   # 카메라 줄을 「기법 이름 + 끝 모습만」 꼴로 나란히(02_콘티 8-4 · 시댄스 도움말이 바로 알아듣는 낱말 「truck」)
    "p7-1-35": "slow truck right with a handheld feel, easing to a stop — it ends with Soyeon a little left of center.",
}
P7_CASTING = [   # 배역 목소리 판(위 매진 임박과 같은 길) — (견본 파일 이름, 그림을 빌릴 컷, 화면 속 이름, 대명사, 말할 글 5초 안팎)
    ("ian", "2-15", "Ian", "his", "퇴근길에 서점에 들렀어. 읽고 싶던 책이 있었거든. 오늘은 일찍 잘 것 같아."),
    ("seojin", "1-25", "Seojin", "her", "이번 주 일정은 제가 미리 정리해 뒀어요. 회의 끝나고 바로 자료 공유할게요."),
    ("minjae", "1-16", "Minjae", "his", "점심 뭐 먹을지 정했어? 회사 앞 국밥집 괜찮다던데. 오늘은 내가 살게."),
    ("soyeon", "1-32", "Soyeon", "her", "요즘은 애 재우고 나면 그제야 하루가 끝나. 그래도 주말엔 좀 쉬어."),
]
# 로맨스 단편 「다 비침」(10-31 붙임) — 따로 낸다(웹올리기_로맨스/ — 첫날 · 둘째 날 꾸러미와 차례는 건드리지 않음, 굽기 시트 「로맨스 단편」 절).
#   지시문은 로맨스 생성기의 preview()를 그대로 불러 「지시문_시댄스웹.py --보기 <판> B」 렌더와 글자까지 같게 한다 — 첫 줄(사람도 끝 구도로 들어옴)과
#   고속 슬로 머리가 다른 편과 달라 prompt()로는 같아지지 않는다. 생성기 JSON이 생성기 코드와 다르면(JSON을 안 다시 만든 채) 멈춘다.
#   로맨스만의 칸: 샷 「말」이 목록이다(C14 · C41 · C47 · C53a는 두 사람 — 견본 둘을 말하는 차례대로 3_ · 4_로 올려 @오디오 1 · 2), 판 「소리」 켬 ·
#   「B만 켬」(방식 B일 때만 켬) · 끔, 「소리참고」 {A, B, 없음}(비면 RS_SOUND 자리), 끝 그림 일곱(2_끝.jpg), rs-C53b는 rs-C53a 받은 영상의 끝
#   프레임으로 시작(받은 뒤 다시 돌려 채움 — 그 전엔 「파일 아직」). 회상 · 후반 · 여유 칸은 순서표 메모로만 보인다(굽지 않음 — 회상 띠 · 속말 ·
#   손글씨 · 화면 글은 편집).
RS = ("rs", "romance-short-20261030")
OUT5 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_로맨스"
RS_SOUND = "C:/Users/q1212/Documents/synk-vendor/pulse-portfolio12-20261024/소리/romance/소리참고"   # A/<판 id>.mp3(입 맞춤 대사) · B/<배역>.mp3(목소리 견본)
RS_GOT = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/받음"   # 받기.py가 받는 자리
RS_ROLE = {"Yuna": ("yuna", "유나"), "Taejun": ("taejun", "태준"), "Minjae": ("minjae", "민재")}   # 생성기 이름 → (견본 파일, 파일 이름에 붙일 배역)
RS_TAIL = {"rs-C53b": "rs-C53a"}   # 앞 토막 받은 영상의 끝 프레임으로 시작하는 판 → 앞 토막(14.39초 롱테이크 C53)
RS_CASTING = [   # 배역 목소리 판(7번 P7_CASTING과 같은 길) — (견본 파일, 그림 컷, 누구 키, 대명사, 말할 글 5초 안팎 — 대사가 아닌 일상 말)
    # 유나는 조용한 실내(엘리베이터) 큰 얼굴, 태준은 움직임 시험에서 얼굴이 지켜진 유호님 얼굴 C03(처마 밑 비가 보여 빗소리가 섞이면 견본떼기 --demucs),
    # 민재는 얼굴이 크고 닮음이 가장 높은 C17(0.443 — 02_콘티 6절)
    ("yuna", "C44", "YUNA (white blouse)", "her", "이번 주말에는 집에서 푹 쉬려고요. 밀린 드라마도 보고, 장도 좀 보고요."),
    ("taejun", "C03", "TAEJUN (shirt, no tie)", "his", "아침에 커피를 못 마셨더니 하루가 길었네요. 오늘은 일찍 들어가서 쉬려고요."),
    ("minjae", "C17", "MINJAE (beige vest)", "his", "어제 본 영화가 생각보다 재밌더라고요. 주말에 한 번 더 보러 갈까 봐요."),
]
# 목소리 판 뒤 견본을 떼는 동안 낼 소리 끔 판 — 그 자체가 로맨스 길 시험(끝 구도로 사람이 들어옴 · 물러나며 끝 구도 · 두 샷 · 고속 슬로 · 초점 옮김)
RS_BUFFER = ["rs-C01", "rs-C18", "rs-C15-16", "rs-C32", "rs-C42"]
# 견본이 들어온 뒤 먼저 낼 목소리 시험 — 한 사람(유나) · 두 사람 견본 둘(민재 → 태준 · 태준 → 유나). rs-C53a가 앞에 오면 rs-C53b 첫 그림도 일찍 생긴다
RS_TESTS = ["rs-C02", "rs-C14", "rs-C53a"]
# 여섯 편(10-31 밤) — 10-29 「포트폴리오는 시댄스」(결정 표) 뒤에도 Omni 계획이던 6 · 8 · 10번 · 블프 두 편 · 1번. 첫날 · 둘째 날과 따로 묶는다
#   (첫날 192판 순서는 그대로 — 하루에 다 안 들어가면 이 꾸러미가 다음 날 몫). 판의 칸(그림 · 끝그림 · 두 샷 · 참고그림 · 소리 · 소리줄)은 첫날 다른 편과 같다.
OUT6 = "C:/Users/q1212/Documents/synk-vendor/pulse-seedance-day-20261028/웹올리기_여섯편"
PIECES6 = [   # (편, 원천 폴더, 지시문 파일) — 짧은 편부터 끝까지 마쳐 중간에 멈춰도 완성 편이 남게(첫날과 같은 까닭)
    ("p1", "product-hero-20261024", "영상_시댄스웹.json"),
    ("s3", "bf-sale-20261025", "영상_시댄스웹.json"),
    ("p8", "castingbook-app-20261024", "영상_시댄스웹.json"),
    ("s4", "bf-sniper-20261025", "영상_시댄스웹.json"),
    ("p6", "yearend-family-20261024", "영상_시댄스웹.json"),
    ("p10", "b2b-factory-20261026", "영상_시댄스웹.json"),
]
# 편마다 가장 불확실한 길 하나 — 맨 앞에서 내고 받아 본 뒤 편 차례로(시험 판이 그 컷의 주판을 겸함): 1번 붓기 슬로 + 시작 · 끝 그림 2.2초 도착 ·
#   블프 세일 6 돌리 줌 · 8번 3 초록 폰 화면과 흰 십자 지킴(폰 컷 여섯이 이 길) · 블프 스나이퍼 19 끝 그림까지 0.9초 큰 이동 · 6번 22 8.31초 컷을
#   8초 판에 당겨 넣음(끝 박) · 10번 19 크레인 5초 + 참고 그림(옴니 레퍼런스)
#   블프 스나이퍼 19는 19a · 19b(이동 0.83초 + 잠든 얼굴 4.11초 하드 컷 길)와 같은 묶음에서 굽고 고른다(10-31 Fable P1 — S19a 담요 자리와 S19b가
#   한 카메라 길로 안 이어져 끝 그림 판이 녹을 위험)
TESTS6 = ["p1-04", "s3-06", "p8-03", "s4-19", "s4-19a", "s4-19b", "p6-22", "p10-19"]


def first_line(has_end):
    s = (f"{TOKEN1} is the exact first frame of this video: start from it unchanged — same framing, same place, same light, colors and "
         "white balance, same people and animals, faces, hair and clothes.")
    if has_end:
        s += f" {TOKEN2} is the exact last frame: the camera arrives at exactly that framing at the very end."
    return s


def who_lines(spec, keys):
    return [f"{k}: {spec['공통']['누구'][k]}" for k in keys]


def prompt(spec, p, mode=None):
    # mode: 7번의 목소리 방식(A · B · 없음) — 판에 「소리줄」이 있을 때만 끝 SOUND 줄을 바꾼다(다른 편은 그대로 공통 「소리」)
    c = spec["공통"]
    ratio = RATIO_EN[spec["비율"]]
    shots = p["샷"]
    L = []
    if len(shots) == 1:
        s = shots[0]
        L.append(first_line(bool(s.get("끝그림"))))
        if p.get("참고말"):   # 10-31 검수: 판의 「참고그림」(도착 구도 등)이 몇 번 그림인지 · 무엇인지 — 판에 이 칸이 없으면 지시문은 그대로
            L.append(p["참고말"])
        slow = s.get("슬로")
        L.append(f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, {ratio} — no cuts, no camera switch, "
                 + ("in smooth slow motion for the whole shot, no speed ramp, no end card." if slow else "no slow motion, no speed ramp, no end card."))
        L += who_lines(spec, s.get("누구", []))
        L.append("ACTION: " + s["동작"])
        L.append("CAMERA: " + s["카메라"])
        if s.get("기운"):
            L.append("ENERGY: " + s["기운"])
    else:
        t = p["자르는초"]
        L.append(f"This video is TWO SHOTS of {c['장르']}, {ratio}, joined by ONE hard cut at {t:g} s — the same moment in the same place "
                 "under the same light; any person or object seen in both shots looks exactly the same in both; nobody is added who is not "
                 "described for that shot; no other cuts, no slow motion, no speed ramp, no end card.")
        if p.get("참고말"):
            L.append(p["참고말"])
        keys = []
        for s in shots:
            for k in s.get("누구", []):
                if k not in keys:
                    keys.append(k)
        L += who_lines(spec, keys)
        for i, s in enumerate(shots):
            a, b = (0, t) if i == 0 else (t, None)
            tok = TOKEN1 if i == 0 else TOKEN2
            span = f"{a:g}–{b:g} s" if b else f"{a:g} s to the end"
            L.append(f"SHOT {i + 1} ({span}) begins exactly on {tok} — same framing, light and colors. ACTION: {s['동작']} CAMERA: {s['카메라']}")
    L.append(c["보기"])
    L.append((p.get("소리줄") or {}).get(mode) or c["소리"])
    if p.get("목소리견본"):   # 10-31 오미톡 끝 두 줄 — 그 배역 목소리 판에서 뗀 견본의 결만 따르고 말은 지시문의 한국어대로
        L.append(VOICE_LINES)
    return "\n".join(L)


def voice_b(text):
    # 새 방식: 입은 지시문 속 한국어 대사대로(웹올리기_v5의 「소리 참고 없이」와 같은 바꿈) + 목소리 견본은 결만
    out = text.replace("in sync with the reference audio", "clearly forming the Korean words")
    assert out != text, "대사 컷 지시문에 「in sync with the reference audio」가 없다"
    return out + (f"\nVOICE: {AUDIO1} is only a sample of the speaking person's voice — copy its timbre, age, pitch and Korean accent exactly, "
                  "but never play it and never say its words; perform only the Korean line written above, the way this moment demands. "
                  "Only that dialogue and quiet room sound — no music, no other voices.")


def hs_casting_prompt(who, pos, text):
    # 매진 임박 목소리 판 — 견본 없이 말하게 해 시댄스가 처음 내는 목소리를 받는다(입은 보여도 되지만 이 판은 소리만 쓴다)
    lips = "the lips seen through the mask opening" if "balaclava" in who else f"{pos} lips"
    return "\n".join([
        first_line(False),
        "ONE SINGLE CONTINUOUS SHOT of a live-action Korean horror-comedy short film, horizontal 16:9 — no cuts, no camera switch, no slow motion, "
        "no speed ramp, no end card.",
        # 시작 그림이 겁먹거나 우는 얼굴이라 울음 · 훌쩍임이 견본에 섞이지 않게 먼저 조용히 가라앉힌다(10-30 Fable — 견본떼기는 무음만 자른다)
        f"ACTION: {who} closes {pos} mouth, swallows and calms down in silence — no crying sound, no sob, no sniff — then looks just past the "
        f"camera and says in Korean, in {pos} own natural everyday speaking voice — relaxed and "
        f"conversational, as if chatting with a friend; not shouting, not crying, not whispering, not announcing: \"{text}\" {lips[0].upper() + lips[1:]} "
        "clearly form the Korean words. Everyone else in the frame keeps still with lips closed.",
        "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.",
        "LOOK: keep the first frame's faces, hair, outfits, the room and its dim, warm tungsten lamp light and colors to the very end; no new light, "
        "no color shift; no added on-screen text, captions or logos.",
        f"SOUND: only {pos} natural speaking voice saying this one Korean line, over quiet room tone — no music, no other voices, no sound effects, "
        "no crying or sobbing sounds at any point.",
    ])


def hs_line_prompt(who, pos, act):
    # 매진 임박 화면 밖 대사 판 — 그 배역 그림 · 견본으로 소리만 쓴다(입은 보여도 되고 화면은 쓰지 않음)
    lips = "the lips seen through the mask opening" if "balaclava" in who else f"{pos} lips"
    return "\n".join([
        first_line(False),
        "ONE SINGLE CONTINUOUS SHOT of a live-action Korean horror-comedy short film, horizontal 16:9 — no cuts, no camera switch, no slow motion, "
        "no speed ramp, no end card.",
        f"ACTION: {who}, looking just past the camera, {act} {lips[0].upper() + lips[1:]} clearly form the Korean words. "
        "Everyone else in the frame keeps still with lips closed.",
        "CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.",
        "LOOK: keep the first frame's faces, hair, outfits, the room and its dim, warm tungsten lamp light and colors to the very end; no new light, "
        "no color shift; no added on-screen text, captions or logos.",
        f"SOUND: only {pos} voice saying these Korean lines, over quiet room tone — no music, no other voices, no sound effects.",
        VOICE_LINES,
    ])


def hs_roles():
    roles = {}
    for line in json.load(open(HS_PLAN, encoding="utf-8"))["lines"]:
        m = re.match(r"#(\d+)", line.get("메모", ""))
        if m:
            roles[int(m.group(1))] = line["role"]
    return roles


def load_specs():
    specs = {}
    for key, folder in PIECES:
        f = os.path.join(VIDEO, folder, "지시문", "영상_시댄스웹.json")
        if os.path.exists(f):
            specs[key] = json.load(open(f, encoding="utf-8"))
    return specs


def save_jpg(src, dst):
    im = Image.open(src).convert("RGB")
    im.save(dst, quality=95)
    return im.size


def p7_sound(p, mode):
    # 판의 소리 켬 · 끔과 올릴 소리 참고(방식 A = 그 판의 입 맞춤 대사 mp3, 방식 B = 말하는 배역의 목소리 견본)
    if not (p["소리"] == "켬" or (p["소리"] == "B만 켬" and mode == "B")):
        return "끔", None
    ref = (p.get("소리참고") or {}).get(mode)
    if not ref:
        if mode == "A":
            ref = os.path.join(P7_SOUND, "A", p["id"] + ".mp3")
        else:
            who = next(s["말"]["누가"] for s in p["샷"] if s.get("말"))
            ref = os.path.join(P7_SOUND, "B", P7_ROLE[who.split(" ")[0]] + ".mp3")
    return "켬", ref


def p7_item(spec, p, mode):
    shots = p["샷"]
    files = []
    if len(shots) == 1:
        files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
        if shots[0].get("끝그림"):
            files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
    else:
        for i, s in enumerate(shots):
            files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
    snd, ref = p7_sound(p, mode)
    if ref:
        files.append(("3_소리.mp3", ref, "소리") if mode == "A" else ("3_목소리견본.mp3", ref, "목소리 견본"))
    return {"id": p["id"], "편": DAY2[0], "편이름": spec["이름"], "컷": p["컷"], "길이": (p.get("B길이") if mode == "B" else None) or p["길이"],
            "비율": spec["비율"], "소리": snd, "설명": p["설명"], "파일": files, "지시문": prompt(spec, p, mode), "묶음": len(shots) > 1,
            "대안": bool(p.get("대안")), "낱판": p.get("낱판", []), "쓰는초": [s.get("쓰는초") for s in shots], "방식": mode if snd == "켬" else None}


def p7_casting(spec, role, cut, name, pos, text):
    shot = next(s for p in spec["판"] for s in p["샷"] if s["컷"] == cut)
    c = spec["공통"]
    L = [first_line(False), f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, vertical 9:16 — no cuts, no camera switch, no slow motion, no speed ramp, no end card."]
    L += who_lines(spec, [shot["말"]["누가"]])   # 말하는 사람만 — 화면 밖 사람 줄(「첫 프레임의 그 사람」)이 사람을 더하지 않게(10-30 Fable)
    L.append(f"ACTION: {name} looks just past the camera and says in Korean, in {pos} own natural everyday speaking voice — relaxed and conversational, "
             f"as if talking to a friend; not shouting, not whispering, not announcing: \"{text}\" {pos.capitalize()} lips clearly form the Korean words. "
             "No one else speaks; anyone else in the frame keeps still with lips closed.")
    L.append("CAMERA: static frame — the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.")
    L.append(c["보기"])
    L.append(f"SOUND: only {name}'s natural speaking voice saying this one Korean line, over quiet room tone — no music, no narration, no other voices.")
    return {"id": f"p7-목소리-{role}", "편": DAY2[0], "편이름": spec["이름"], "컷": [cut], "길이": CASTING_LEN, "비율": spec["비율"], "소리": "켬",
            "설명": f"{name} 목소리 판 — 견본 없이 일상 문장 한 줄({cut} 그림), 시댄스가 처음 낸 목소리를 {name} 목소리로 삼는다",
            "파일": [("1_시작.jpg", os.path.join(spec["그림"], shot["그림"]), "시작")], "지시문": "\n".join(L), "묶음": False, "대안": False,
            "방식": "목소리 판"}


def sunburst(p):
    # 10-31 검수 — 선버스트 두 길 그림에만 맞는 글(7번 2-10: 옆모습 퇴장 대신 정면으로 걸어와 카메라를 스침)을 바꿔 쓴다. 그 칸이 없는 판은 그대로
    q = copy.deepcopy(p)
    for s in q["샷"]:
        s["동작"] = s.get("선버스트동작") or s["동작"]
        s["카메라"] = s.get("선버스트카메라") or s["카메라"]
    return q


def build_day2(mode):
    assert mode in ("A", "B"), "--둘째날 다음에 목소리 방식 A 또는 B"
    spec = json.load(open(os.path.join(VIDEO, DAY2[1], "지시문", "영상_시댄스웹.json"), encoding="utf-8"))
    if "--선버스트" in sys.argv:   # 7번 비교에서 선버스트 길을 골라 정지컷/을 바꾼 뒤 — 그 그림에 맞는 글(2-10)로
        spec["판"] = [sunburst(p) for p in spec["판"]]
    by = {p["id"]: p for p in spec["판"]}   # 「후보판」은 넣지 않는다
    tests = [p7_casting(spec, *row) for row in P7_CASTING] if mode == "B" else []   # 목소리 판이 맨 앞(견본은 받은 뒤 견본떼기.py로)
    for tid in DAY2_TESTS:   # 10-29 방식 B로 정함 — 고른 방식 한 판씩(두 방식 견주기는 매진 목소리 시험 몫)
        it = p7_item(spec, by[tid], mode)
        it.update({"id": f"{tid}-{mode}", "설명": it["설명"] + (" · 지금 방식" if mode == "A" else " · 새 방식(시댄스가 연기)"), "시험": True})
        tests.append(it)
    for tid, cam in CAMERA_ALT.items():
        now = p7_item(spec, by[tid], mode)
        now.update({"id": f"{tid}-지금꼴", "설명": now["설명"] + " · 카메라 줄 지금 꼴(원본 실측 숫자)", "시험": True})
        q = copy.deepcopy(by[tid])
        q["샷"][0]["카메라"] = cam
        alt = p7_item(spec, q, mode)
        alt.update({"id": f"{tid}-기법꼴", "설명": alt["설명"] + " · 카메라 줄 「기법 이름 + 끝 모습만」", "시험": True})
        tests += [now, alt]
    done = set(DAY2_TESTS) | set(CAMERA_ALT)
    n = len(P7_CASTING) if mode == "B" else 0
    buf = [p7_item(spec, by[k], mode) for k in DAY2_BUFFER] if n else []   # 목소리 판을 받아 견본을 떼는 동안 낼 소리 끔 판(10-30 Fable)
    done |= {it["id"] for it in buf}
    order = tests[:n] + buf + tests[n:] + [p7_item(spec, p, mode) for p in spec["판"] if p["id"] not in done and not p.get("대안")]
    order += [p7_item(spec, p, mode) for p in spec["판"] if p.get("대안")]
    by_item = {it["id"]: it for it in order}
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_item[k]["지시문"])
        print(f"\n({len(by_item[k]['지시문'])}자 · {by_item[k]['길이']}초 · 소리 {by_item[k]['소리']} · 올릴 것 {[f[0] for f in by_item[k]['파일']]})")
        return
    missing = write_pack(order, OUT2, mode)
    n_test = sum(1 for it in order if it.get("시험"))
    n_alt = sum(1 for it in order if it["대안"])
    print(f"둘째 날 · 7번 · 방식 {mode}: 판 {len(order)}개(시험 {n_test} · 주판 {len(order) - n_test - n_alt} · 대안 {n_alt}) → {OUT2}")
    print(f"  길이 합 — 시험 · 주판 {sum(it['길이'] for it in order if not it['대안'])}초 · 소리 켬 {sum(1 for it in order if it['소리'] == '켬')}판")
    if missing:
        print(f"  ⚠ 아직 없는 파일 {len(missing)}개(그 판 폴더엔 빠짐 — 목소리를 고르고 굽은 뒤 다시 돌린다): {missing[:4]}{' …' if len(missing) > 4 else ''}")


def build_compare():
    # 7번 그림 두 길 견주기(10-30 유호님 「이번만 둘 다 구워서 내일 시댄스로 뽑아서 비교해보자」) — 같은 판을 얼굴흐림 · 새로 그림으로 하나씩,
    # 소리 끔(그림만 견줌 — 목소리는 둘째 날 목소리 판 뒤). 지시문은 소리줄 「없음」 꼴(소리 참고 없이 입은 지시문의 한국어대로).
    spec = json.load(open(os.path.join(VIDEO, DAY2[1], "지시문", "영상_시댄스웹.json"), encoding="utf-8"))
    by = {p["id"]: p for p in spec["판"]}
    order = []
    for pid in CMP:
        for tag, folder in CMP_ROUTES:
            it = p7_item(dict(spec, 그림=os.path.join(os.path.dirname(spec["그림"]), folder, "정지컷")), sunburst(by[pid]), "없음")
            it.update({"id": f"{pid}-{tag}", "소리": "끔", "파일": [f for f in it["파일"] if not f[0].endswith(".mp3")], "방식": None, "시험": True,
                       "설명": it["설명"] + f" · 그림 {tag}"})
            order.append(it)
    missing = write_pack(order, OUT3, "비교")
    print(f"7번 비교: 판 {len(order)}개({len(CMP)}판 × {[t for t, _ in CMP_ROUTES]}) → {OUT3}" + (f" · ⚠ 없는 그림 {missing}" if missing else ""))


def build_previz():
    # 팁 장부 36행 프리비즈 시험 두 판 — 5번 8행(땅 높이 슬로모션 한 걸음). 지시문 틀은 참고카드 2026-10-30_프리비즈_마네킹참고영상.md, 카메라 · 신발은 5번 지시문 그대로.
    spec = json.load(open(os.path.join(VIDEO, "sports-manifesto-20261026", "지시문", "영상_시댄스웹.json"), encoding="utf-8"))
    p8 = next(p for p in spec["판"] if p["id"] == "p5-08")["샷"][0]   # 카메라 줄만 빌린다 — 동작 줄은 「이미 딛은 발」에서 시작해 프리비즈 동작(위에서 내려와 딛음)과 다르다
    shoes = spec["공통"]["누구"]["SHOES"]
    pv1 = (f"Re-create {VIDEO1} as a previz. Keep every motion, pose, timing and camera move exactly as in {VIDEO1}, from its first frame — "
           "the foot plants, the weight rolls forward and the heel slowly lifts while the toe stays down, in the same slow motion; when the "
           f"motion of {VIDEO1} ends, the foot holds still. The camera stays exactly as in {VIDEO1}: fixed low on the ground, no push-in, no zoom, "
           "no pan, no tilt, no shake. Replace the runner's lower leg and foot with a smooth, faceless artist mannequin in orange; any other "
           "person in blue; background people in plain gray. No faces, no hair, no clothes, no shoe details, no laces, no logos, no text. "
           "Replace the place with a plain gray studio of the same layout — a flat gray ground with one lighter gray lane line in the same place. "
           "Soft, even studio light from above with soft contact shadows under the feet. Neutral gray tones everywhere except the two "
           "mannequin colors. No sound.")
    pv2 = (f"{VIDEO1} is a gray mannequin previz — take ONLY its motion, poses, timing and camera. Never show a mannequin or a gray studio. "
           f"Her lower leg and running shoe look exactly like {TOKEN1}, and the shoe exactly like @이미지 2 — {shoes} "
           f"The place looks exactly like @이미지 3: the near-black smoky night track, red rubber surface, white lane lines, lit only by the "
           "distant white light pillar behind, which rims the shoe. ONE SINGLE CONTINUOUS SHOT. "
           f"ACTION: exactly the motion and timing of {VIDEO1} — in slow motion her foot in the white running shoe comes down from the upper "
           "right, plants on the red rubber track near the centre with the toe angled toward the lower left, then her weight rolls forward and "
           "the heel slowly lifts as the sole flexes; the toe is still on the ground at the end. Only her lower leg and the shoe are in frame; "
           f"a hard white backlight from far behind rims the shoe. CAMERA: {p8['카메라']} "
           + spec["공통"]["보기"].replace("first frame's own light", f"light of {TOKEN1}") + " " + spec["공통"]["소리"])
    base = {"편": "p5", "편이름": "5번 프리비즈 시험(팁 장부 36행)", "컷": ["8"], "길이": 4, "비율": "16:9", "소리": "끔", "묶음": False,
            "대안": False, "시험": True}
    order = [
        dict(base, id="pv5-08-1", 설명="판 ① 프리비즈 — 원본 8행 컷을 회색 스튜디오 · 주황 마네킹 발로(화면에 안 나가는 중간물)",
             파일=[("1_원본8행.mp4", PV_SRC, "영상")], 지시문=pv1),
        dict(base, id="pv5-08-2", 설명="판 ② 마지막 — 시작 그림 칸은 비우고 ① + S08 · R3 · R2를 모두 참고로(옴니 레퍼런스). p5-08 시작 그림 판과 나란히 봄",
             파일=[("1_프리비즈.mp4", PV_OUT1, "영상"), ("2_S08.jpg", os.path.join(spec["그림"], "S08.png"), "참고"),
                  ("3_R3.jpg", os.path.join(spec["그림"], "R3.png"), "참고"), ("4_R2.jpg", os.path.join(spec["그림"], "R2.png"), "참고")],
             지시문=pv2),
    ]
    missing = write_pack(order, OUT4, "프리비즈")
    print(f"프리비즈 시험: 판 {len(order)}개 → {OUT4}" + (f" · 파일 아직 {[os.path.basename(m) for m in missing]}(① 받은 뒤 다시 돌림)" if missing else ""))


def rs_gen():
    # 로맨스 생성기 모듈 — preview() · build() · first_line() · still()을 빌린다(불러올 때 git 밖 컷목록 · 원본 실측만 읽고 아무것도 쓰지 않는다)
    import importlib.util
    sp = importlib.util.spec_from_file_location("rs_gen", os.path.join(VIDEO, RS[1], "지시문_시댄스웹.py"))
    g = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(g)
    return g


def rs_speakers(p):
    # 말하는 차례(처음 나온 차례) — 생성기 sound_lines()가 VOICE 줄의 @오디오 1 · 2를 매기는 차례와 같다
    out = []
    for s in p["샷"]:
        for m in s.get("말", []):
            n = m["누가"].split(" ")[0].title()
            if n not in out:
                out.append(n)
    return out


def rs_sound(p, mode):
    # 판의 소리 켬 · 끔과 올릴 소리 — A = 그 판의 입 맞춤 대사 mp3, B = 말하는 배역의 견본(두 사람이면 3_ · 4_ = @오디오 1 · 2), 없음 = 참고 없이 켬
    if not (p["소리"] == "켬" or (p["소리"] == "B만 켬" and mode == "B")):
        return "끔", []
    if mode == "없음":
        return "켬", []
    ref = (p.get("소리참고") or {}).get(mode)
    if mode == "A":
        return "켬", [("3_소리.mp3", ref or os.path.join(RS_SOUND, "A", p["id"] + ".mp3"), "소리")]
    who = rs_speakers(p)
    refs = ref if isinstance(ref, list) else [ref] if ref else [os.path.join(RS_SOUND, "B", RS_ROLE[n][0] + ".mp3") for n in who]
    assert len(refs) == len(who), f"{p['id']}: 소리참고 B {len(refs)}개 · 말하는 사람 {len(who)}"
    if len(who) == 1:
        return "켬", [("3_목소리견본.mp3", refs[0], "목소리 견본")]
    return "켬", [(f"{i + 3}_목소리견본_{RS_ROLE[n][1]}.mp3", r, f"목소리 견본 @오디오 {i + 1}") for i, (n, r) in enumerate(zip(who, refs))]


def rs_tail_frame(pid):
    # 앞 토막을 받은 뒤 그 영상의 끝 프레임(받기.py 장부에서 가장 나중에 받은 판) → 받음/_끝프레임/<앞 토막>.jpg. 받기 전엔 없는 자리라 「파일 아직」.
    # 다른 판을 고르면 그 판에서 같은 자리로 뽑아 둔다(가장 나중 판보다 새 jpg는 덮지 않음). 끝 프레임이 망가졌으면 C53.jpg를 그 자리에 둔다.
    dst = os.path.join(RS_GOT, "_끝프레임", pid + ".jpg")
    led = os.path.join(RS_GOT, "_받음.json")
    got = sorted((v for v in (json.load(open(led, encoding="utf-8")) if os.path.exists(led) else {}).values() if v["판"] == pid),
                 key=lambda v: v["만든때"])
    clip = os.path.join(RS_GOT, got[-1]["파일"]) if got else None
    if clip and os.path.exists(clip) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(clip)):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-sseof", "-0.5", "-i", clip, "-update", "1", "-q:v", "1", dst], check=True)
    return dst


def rs_item(spec, G, p, mode):
    shots = p["샷"]
    files, memo = [], []
    if p["id"] in RS_TAIL:
        files.append(("1_시작.jpg", rs_tail_frame(RS_TAIL[p["id"]]), "시작"))
    elif len(shots) == 1:
        files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
        if shots[0].get("끝그림"):
            files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
    else:
        for i, s in enumerate(shots):
            files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
    snd, refs = rs_sound(p, mode)
    files += refs
    txt = G.preview(spec, p, mode)
    named = re.findall(r"@오디오 (\d+) is only a sample of (\w+)'s voice", txt)
    if named:   # 두 사람 판 — VOICE 줄이 부르는 차례와 올리는 견본 차례가 같아야 한다
        assert [n for _, n in named] == rs_speakers(p) and len(refs) == len(named), f"{p['id']}: VOICE 줄 {named} · 견본 {[f[0] for f in refs]}"
    if p["소리"] == "B만 켬":
        memo.append("화면 밖 · 입 가림 말 — 방식 B일 때만 소리 켬")
    if len(refs) > 1:
        memo.append("견본 둘(말하는 차례) — " + " → ".join(f"{f[0]} = @오디오 {i + 1}" for i, f in enumerate(refs)))
    if any(s.get("회상") for s in shots):
        memo.append("회상 — 16:9 그대로 받고 좌우 검은 띠는 편집")
    memo += [f"후반(굽지 않음): {s['후반']}" for s in shots if s.get("후반")]
    if p.get("여유"):
        memo.append(p["여유"])
    it = {"id": p["id"], "편": RS[0], "편이름": spec["이름"], "컷": p["컷"], "길이": (p.get("B길이") if mode == "B" else None) or p["길이"],
          "비율": spec["비율"], "소리": snd, "설명": p["설명"], "파일": files, "지시문": txt, "묶음": len(shots) > 1, "대안": bool(p.get("대안")),
          "낱판": [], "쓰는초": [s.get("쓰는초") for s in shots], "방식": mode if snd == "켬" else None, "메모": memo}
    if p["id"] in RS_TAIL:
        it.update({"기다림": ["1_시작.jpg"], "기다림글": f"파일 아직 — {RS_TAIL[p['id']]}를 받은 뒤 다시 만듦",
                   "설명": p["설명"] + f" · 첫 그림 = {RS_TAIL[p['id']]} 받은 영상의 끝 프레임"})
    return it


def rs_casting(spec, G, role, cut, key, pos, text):
    # 로맨스 목소리 판 — 견본 없이 말하게 해 시댄스가 처음 내는 목소리를 받는다(입은 보여도 되지만 이 판은 소리만 쓴다)
    name = key.split(" ")[0].title()
    kr = RS_ROLE[name][1]
    c = spec["공통"]
    L = [G.first_line(False),
         f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, horizontal 16:9 — no cuts, no camera switch, no slow motion, no speed ramp, no end card.",
         f"{key}: {c['누구'][key]}",   # 말하는 사람만 — 다른 사람 줄이 사람을 더하지 않게(7번 10-30 Fable)
         f"ACTION: {name} lets {pos} face settle into a calm, easy expression, then looks just past the camera and says in Korean, in {pos} own "
         "natural everyday speaking voice — relaxed and conversational, as if talking to a friend; not shouting, not whispering, not crying, not "
         f"announcing: \"{text}\" {pos.capitalize()} lips clearly form the Korean words. No one else speaks; anyone else in the frame keeps still "
         "with lips closed.",
         "CAMERA: " + G.still(),
         c["보기"],
         f"SOUND: only {name}'s natural speaking voice saying this one Korean line, over quiet room tone — no music, no narration, no other voices, "
         "no rain or street noise."]
    return {"id": f"rs-목소리-{role}", "편": RS[0], "편이름": spec["이름"], "컷": [cut], "길이": CASTING_LEN, "비율": spec["비율"], "소리": "켬",
            "설명": f"{kr} 목소리 판 — 견본 없이 일상 문장 한 줄({cut} 그림), 시댄스가 처음 낸 목소리를 {kr} 목소리로 삼는다",
            "파일": [("1_시작.jpg", os.path.join(spec["그림"], cut + ".jpg"), "시작")], "지시문": "\n".join(L), "묶음": False, "대안": False,
            "방식": "목소리 판", "구역": "목소리 판 — 배역마다 시댄스가 처음 내는 목소리",
            "메모": [f"받으면 견본떼기.py rs-목소리-{role} → 소리/romance/소리참고/B/{role}.mp3, 그 뒤 웹꾸러미.py --로맨스를 다시 돌린다"]}


def build_romance(mode):
    assert mode in ("A", "B", "없음"), "--로맨스 다음 목소리 방식은 A · B · 없음(기본 B — 결정 10-29)"
    spec = json.load(open(os.path.join(VIDEO, RS[1], "지시문", "영상_시댄스웹.json"), encoding="utf-8"))
    G = rs_gen()
    fresh = json.loads(json.dumps({"공통": {"장르": G.GENRE, "누구": G.WHO, "보기": G.LOOK, "소리": G.SILENT}, "판": G.build()}, ensure_ascii=False))
    if fresh["판"] != spec["판"] or fresh["공통"] != spec["공통"]:
        raise SystemExit("로맨스 지시문 JSON이 생성기 코드와 다르다 — 먼저 python -X utf8 지시문_시댄스웹.py로 JSON을 다시 만든다")
    items = {p["id"]: rs_item(spec, G, p, mode) for p in spec["판"]}
    cast = [rs_casting(spec, G, *row) for row in RS_CASTING] if mode == "B" else []   # 목소리 판은 방식 B에만(견본을 뗄 판)
    buf = [dict(items[k], 시험=True, 구역="길 시험 — 소리 끔(목소리 판 견본을 떼는 동안)") for k in RS_BUFFER] if cast else []
    tests = [dict(items[k], 시험=True, 구역="목소리 시험 — 견본이 들어온 뒤(한 사람 · 두 사람)") for k in RS_TESTS]
    first = {it["id"] for it in buf + tests}
    order = cast + buf + tests + [it for k, it in items.items() if k not in first and not it["대안"]]
    order += [dict(it, 구역="원본 카메라 판 — 요즘 기법 판(C30 · C59 · C60 느린 다가감)과 나란히 보고 고름") for it in items.values() if it["대안"]]
    by_item = {it["id"]: it for it in order}
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_item[k]["지시문"])
        print(f"\n({len(by_item[k]['지시문'])}자 · {by_item[k]['길이']}초 · 소리 {by_item[k]['소리']} · 올릴 것 {[f[0] for f in by_item[k]['파일']]})")
        return
    missing = write_pack(order, OUT5, "로맨스")
    n_alt = sum(1 for it in order if it["대안"])
    n_story = len(order) - len(cast) - len(buf) - len(tests) - n_alt
    print(f"로맨스 · 방식 {mode}: 판 {len(order)}개(목소리 판 {len(cast)} · 길 시험 {len(buf)} · 목소리 시험 {len(tests)} · 이야기 차례 {n_story} · "
          f"원본 카메라 판 {n_alt}) → {OUT5}")
    print(f"  길이 합 — 대안 뺀 {sum(it['길이'] for it in order if not it['대안'])}초 · 대안 {sum(it['길이'] for it in order if it['대안'])}초 · "
          f"소리 켬 {sum(1 for it in order if it['소리'] == '켬')}판 · 두 샷 {sum(it['묶음'] for it in order)}판 · "
          f"끝 그림 {sum(1 for it in order if any(f[0] == '2_끝.jpg' for f in it['파일']))}판 · 견본 둘 {sum(1 for it in order if len([f for f in it['파일'] if '목소리견본' in f[0]]) > 1)}판")
    if missing:
        print(f"  파일 아직 {len(missing)}개(목소리 판 · 앞 토막을 받은 뒤 다시 돌린다): {sorted({os.path.basename(m) for m in missing})}")


def six_item(key, spec, p):
    # 여섯 편 판 하나 — 첫날 build()의 다른 편 판과 같은 꼴(build()는 건드리지 않으려고 따로 둠)
    shots = p["샷"]
    files = []
    if len(shots) == 1:
        files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
        if shots[0].get("끝그림"):
            files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
    else:
        for i, s in enumerate(shots):
            files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
    if p.get("참고그림"):
        files.append((f"{len(files) + 1}_참고.jpg", os.path.join(spec["그림"], p["참고그림"]), "참고"))
    if p.get("목소리견본"):   # 입 보이는 대사 · 화면 밖 대사 판(B) — 견본은 그 배역 목소리 판을 받은 뒤 견본떼기.py가 만든다(그 전엔 「파일 아직」)
        files.append(("3_목소리견본.mp3", VOICE_FROM[p["목소리견본"]][0], "목소리 견본"))
    txt = prompt(spec, p, p.get("소리"))
    if p.get("끝그림말"):   # 판마다 끝 그림 문장(1번 4 · 5 — 2.2초에 일찍 닿고 멈춤, 10-31 Fable) — 공통 prompt()는 건드리지 않는다
        d = first_line(True)[len(first_line(False)) + 1:]
        assert txt.count(d) == 1, f"{p['id']}: 끝 그림 첫 줄 없음"
        txt = txt.replace(d, p["끝그림말"])
    if p.get("같은때말"):   # 두 샷 머리의 「같은 빛」 구절을 판마다(10번 8+9 — 두 샷의 빛이 다름, 10-31 Fable) — 공통 prompt()는 건드리지 않는다
        d = "the same moment in the same place under the same light;"
        assert txt.count(d) == 1, f"{p['id']}: 두 샷 머리 구절 없음"
        txt = txt.replace(d, p["같은때말"])
    return {"id": p["id"], "편": key, "편이름": spec["이름"], "컷": p["컷"], "길이": p["길이"], "비율": spec["비율"],
            "소리": p.get("소리", "끔"), "설명": p["설명"], "파일": files, "지시문": txt,
            "묶음": len(shots) > 1, "대안": bool(p.get("대안")), "낱판": p.get("낱판", []), "쓰는초": [s.get("쓰는초") for s in shots],
            **({"방식": "B"} if p.get("목소리견본") else {}), "메모": six_memo(p)}


def six_memo(p):
    # 순서표 카드에 보일 할 일(로맨스가 만든 「메모」 칸) — 판 칸에서만 나온다
    memo = []
    if p.get("참고그림"):
        memo.append("_참고 그림은 끝 그림이 아님 — 옴니 레퍼런스(참조) 모드로 1_시작 다음에 올리고, 시작 / 끝 프레임 칸의 끝 칸에 넣지 않는다")
    if p.get("목소리견본"):
        memo.append(f"3_목소리견본 = {p['목소리견본']}를 받아 견본떼기.py로 뗀 목소리(그 전엔 「파일 아직」) — 대사는 지시문의 한국어대로 시댄스가 연기")
    elif p.get("소리") == "켬":
        memo.append("소리 켬 — 얼굴이 안 보이는 한 줄을 시댄스가 지어내는 목소리로(견본 없음)")
    return memo


def six_casting(key, spec, r):
    # 여섯 편 배역 목소리 판 — 견본 없이 일상 문장 한 줄, 시댄스가 처음 낸 목소리를 그 배역 목소리로(매진 · 7번과 같은 길, 결정 10-29). 소리만 쓴다
    c = spec["공통"]
    L = [first_line(False), f"ONE SINGLE CONTINUOUS SHOT of {c['장르']}, {RATIO_EN[spec['비율']]} — no cuts, no camera switch, no slow motion, "
         "no speed ramp, no end card."]
    L += who_lines(spec, r["누구"])
    L.append(f"ACTION: {r['동작']} \"{r['글']}\" {r['입']} No one else speaks; anyone else in the frame keeps still with lips closed.")
    L.append("CAMERA: the frame stays exactly where it is from the first frame to the last: no push-in, no zoom, no pan, no shake.")
    L.append(c["보기"])
    L.append(f"SOUND: only {r['소리']} saying this one Korean line, over quiet room tone — no music, no narration, no other voices, no sound effects.")
    pid = f"{key}-목소리-{r['배역']}"
    assert pid in VOICE_FROM, f"{pid}의 견본 자리가 VOICE_FROM에 없다"
    return {"id": pid, "편": key, "편이름": spec["이름"], "컷": [r["컷"]], "길이": CASTING_LEN, "비율": spec["비율"], "소리": "켬",
            "설명": f"{r['배역']} 목소리 판 — 견본 없이 일상 문장 한 줄({r['컷']} 그림), 시댄스가 처음 낸 목소리를 {r['배역']} 목소리로 삼는다(소리만 씀)",
            "파일": [("1_시작.jpg", os.path.join(spec["그림"], r["그림"]), "시작")], "지시문": "\n".join(L), "묶음": False, "대안": False,
            "방식": "목소리 판", "메모": [f"받으면 견본떼기.py {pid} → {VOICE_FROM[pid][0].split('/synk-vendor/')[-1]}, 그 뒤 웹꾸러미.py --여섯편을 다시 돌린다"]}


def build_six():
    # 여섯 편 꾸러미 — 시험(편마다 가장 불확실한 길) → 짧은 편부터 주판 → 대안(묶음 · 끝 그림 · 블렌더 길이 안 될 때만)
    items, casts, absent = [], [], []
    for key, folder, name in PIECES6:
        f = os.path.join(VIDEO, folder, "지시문", name)
        if not os.path.exists(f):
            absent.append(key)
            continue
        spec = json.load(open(f, encoding="utf-8"))
        casts += [six_casting(key, spec, r) for r in spec.get("목소리판", [])]
        items += [six_item(key, spec, p) for p in spec["판"]]
    by_id = {it["id"]: it for it in casts + items}
    assert len(by_id) == len(casts + items), "여섯 편 판 id 겹침"
    tests = [by_id[i] for i in TESTS6 if i in by_id]
    for it in tests:
        it["시험"] = True
    first = {it["id"] for it in tests}
    # 차례: 배역 목소리 판(견본을 떼는 동안 시험 · 앞 편이 돈다) → 시험 → 짧은 편부터 주판(목소리 견본을 쓰는 B 판은 그 편 차례 안) → 대안
    order = casts + tests + [it for it in items if it["id"] not in first and not it["대안"]] + [it for it in items if it["id"] not in first and it["대안"]]
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_id[k]["지시문"])
        print(f"\n({len(by_id[k]['지시문'])}자 · {by_id[k]['길이']}초 · {by_id[k]['비율']} · 소리 {by_id[k]['소리']} · 올릴 것 {[f[0] for f in by_id[k]['파일']]})")
        return
    missing = write_pack(order, OUT6, "여섯편")
    n_alt = sum(1 for it in order if it["대안"])
    print(f"여섯 편: 판 {len(order)}개(시험 {len(tests)} · 주판 {len(order) - n_alt} · 대안 {n_alt}) → {OUT6}"
          + (f" · ⚠ 지시문 아직 없는 편 {absent}" if absent else ""))
    for key, _, _ in PIECES6:
        sel = [it for it in order if it["편"] == key and not it["대안"]]
        if sel:
            print(f"  {key}: 주판 {len(sel)} · 컷 {sum(len(it['컷']) for it in sel)} · 묶음 {sum(it['묶음'] for it in sel)} · "
                  f"{sum(it['길이'] for it in sel)}초 · 대안 {sum(1 for it in order if it['편'] == key and it['대안'])}")
    if missing:
        print(f"  ⚠ 없는 파일 {len(missing)}개: {missing[:4]}{' …' if len(missing) > 4 else ''}")
    too_long = [it["id"] for it in order if len(it["지시문"]) > 3800]
    if too_long:
        print("  지시문이 3,800자를 넘는 판:", too_long)


def write_pack(order, out, day2):
    missing = sorted({src for it in order for _, src, _ in it["파일"] if not os.path.exists(src)})
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)
    rows = []
    for n, it in enumerate(order, 1):
        d = os.path.join(out, f"{n:03d}_{it['id']}")
        os.makedirs(d)
        for name, src, _ in it["파일"]:
            if not os.path.exists(src):
                continue
            if name.endswith((".mp3", ".mp4")):
                shutil.copy2(src, os.path.join(d, name))
            else:
                save_jpg(src, os.path.join(d, name))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(it["지시문"])
        rows.append({"순서": n, "id": it["id"], "편": it["편"], "컷": it["컷"], "폴더": os.path.basename(d), "길이": it["길이"], "비율": it["비율"],
                     "소리": it["소리"], "묶음": it["묶음"], "대안": it["대안"], "방식": it.get("방식"), "시험": bool(it.get("시험")),
                     "낱판": it.get("낱판", []), "쓰는초": it.get("쓰는초"), "파일": [f[0] for f in it["파일"]],
                     "빠진 파일": [f[0] for f in it["파일"] if not os.path.exists(f[1])], "지시문 머리": it["지시문"][:160], "지시문 글자 수": len(it["지시문"]),
                     **({"기다림": it["기다림"]} if it.get("기다림") else {})})   # 받은 뒤에야 생기는 그림(로맨스 rs-C53b — 꾸러미점검이 기다림으로 셈)
    json.dump(rows, open(os.path.join(out, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(out, "순서표.html"), "w", encoding="utf-8").write(page(order, day2=day2))
    return missing


def build():
    if "--여섯편" in sys.argv:
        return build_six()
    if "--로맨스" in sys.argv:
        nxt = sys.argv[sys.argv.index("--로맨스") + 1:sys.argv.index("--로맨스") + 2]
        return build_romance(nxt[0] if nxt and nxt[0] in ("A", "B", "없음") else "B")
    if "--둘째날" in sys.argv:
        return build_day2(sys.argv[sys.argv.index("--둘째날") + 1])
    if "--7번비교" in sys.argv:
        return build_compare()
    if "--프리비즈" in sys.argv:
        return build_previz()
    specs = load_specs()
    items = []   # 순서표 한 줄 = 한 판
    # 매진 임박 — 이미 만든 웹올리기_v5를 그대로(첫 줄만 웹 꼬리표로)
    hs = json.load(open(os.path.join(HS, "_순서.json"), encoding="utf-8"))
    roles = hs_roles()
    by_cut = {r["컷"]: r for r in hs}
    for role, cut, who, pos, text in HS_CASTING:   # 배역 목소리 판 — 맨 앞
        d = os.path.join(HS, by_cut[cut]["폴더"])
        items.append({"id": f"hs-목소리-{role}", "편": "hs", "편이름": "매진 임박", "컷": [str(cut)], "길이": CASTING_LEN, "비율": "16:9", "소리": "켬",
                      "설명": f"{role} 목소리 판 — 견본 없이 일상 문장 한 줄(#{cut} 그림), 시댄스가 처음 낸 목소리를 {role} 목소리로 삼는다",
                      "파일": [("1_시작.jpg", os.path.join(d, "1_시작.jpg"), "시작")], "지시문": hs_casting_prompt(who, pos, text),
                      "묶음": False, "대안": False, "방식": "목소리 판"})
    for r in hs:
        d = os.path.join(HS, r["폴더"])
        body = open(os.path.join(d, "지시문.txt"), encoding="utf-8").read().strip()
        a = {"id": f"hs-{r['id']}", "편": "hs", "편이름": "매진 임박", "컷": [str(r["컷"])], "길이": r["길이"], "비율": "16:9",
             "소리": "켬" if r["소리 생성"] else "끔", "설명": f"매진 임박 #{r['컷']}",
             "파일": [("1_시작.jpg", os.path.join(d, "1_시작.jpg"), "시작")]
             + ([("2_끝.jpg", os.path.join(d, "2_끝.jpg"), "끝")] if r["끝 그림"] else [])
             + ([("3_소리.mp3", os.path.join(d, "3_소리.mp3"), "소리")] if r["소리 참고"] else []),
             "지시문": first_line(r["끝 그림"]) + "\n" + body, "묶음": False, "대안": False}
        if not r["소리 참고"]:
            items.append(a)
            continue
        # 대사 컷 — 새 방식(B)만: 목소리 판에서 뗀 시댄스 견본을 넣고 시댄스가 연기한다. 타입캐스트 대사를 넣던 지금 방식(A)은 10-29부터 내지 않는다
        role = roles[r["컷"]]
        items.append({**a, "id": f"{a['id']}-B", "방식": "B", "설명": f"매진 임박 #{r['컷']} · {role} 목소리(목소리 판에서 뗀 견본) — 시댄스가 연기",
                      "파일": a["파일"][:-1] + [("3_목소리견본.mp3", os.path.join(SEED_SAMPLES, SAMPLE_FILE[role]), "목소리 견본")],
                      "지시문": first_line(r["끝 그림"]) + "\n" + voice_b(body)})
    for tail, role, cut, who, pos, n, used, act in HS_LINES:   # 화면 밖 대사 판(10-31) — 대사(B) 판 무리 끝에 선다
        d = os.path.join(HS, by_cut[cut]["폴더"])
        items.append({"id": f"hs-말-{tail}", "편": "hs", "편이름": "매진 임박", "컷": used, "길이": n, "비율": "16:9", "소리": "켬",
                      "설명": f"{role} 화면 밖 대사(광고 카드 위 읊기 · 외침) — 소리만 씀, #{cut} 그림 · {role} 견본으로 시댄스가 연기",
                      "파일": [("1_시작.jpg", os.path.join(d, "1_시작.jpg"), "시작"),
                               ("3_목소리견본.mp3", os.path.join(SEED_SAMPLES, SAMPLE_FILE[role]), "목소리 견본")],
                      "지시문": hs_line_prompt(who, pos, act), "묶음": False, "대안": False, "방식": "B"})
    for key, folder in PIECES:
        spec = specs.get(key)
        if not spec:
            continue
        for p in spec["판"]:
            shots = p["샷"]
            files = []
            if len(shots) == 1:
                files.append(("1_시작.jpg", os.path.join(spec["그림"], shots[0]["그림"]), "시작"))
                if shots[0].get("끝그림"):
                    files.append(("2_끝.jpg", os.path.join(spec["그림"], shots[0]["끝그림"]), "끝"))
            else:
                for i, s in enumerate(shots):
                    files.append((f"{i + 1}_샷{i + 1}.jpg", os.path.join(spec["그림"], s["그림"]), f"샷{i + 1}"))
            if p.get("참고그림"):   # 10-31 검수 — 글로만 못 박는 구도(12번 16 도착 구도)를 그림 참고로. 지시문의 「참고말」이 이 번호를 부른다
                files.append((f"{len(files) + 1}_참고.jpg", os.path.join(spec["그림"], p["참고그림"]), "참고"))
            if p.get("목소리견본"):   # 10-31 오미톡 끝 두 줄 — 견본은 그 목소리 판을 받은 뒤 견본떼기.py가 만든다(그 전엔 「파일 아직」)
                files.append(("3_목소리견본.mp3", VOICE_FROM[p["목소리견본"]][0], "목소리 견본"))
            items.append({"id": p["id"], "편": key, "편이름": spec["이름"], "컷": p["컷"], "길이": p["길이"], "비율": spec["비율"],
                          "소리": p.get("소리", "끔"), "설명": p["설명"], "파일": files, "지시문": prompt(spec, p, p.get("소리")),
                          "묶음": len(shots) > 1, "대안": bool(p.get("대안")), "낱판": p.get("낱판", []), "쓰는초": [s.get("쓰는초") for s in shots],
                          **({"방식": "B"} if p.get("목소리견본") else {})})
    # 차례: 배역 목소리 판 → 시험 여섯(그동안 목소리 판에서 견본을 뗌) → 목소리 시험 → 매진 말 없는 판 → 매진 대사 판 → 다른 편 차례
    # (대안 판은 맨 뒤 — 묶음이 안 될 때만)
    by_id = {it["id"]: it for it in items}
    first = [it["id"] for it in items if it.get("방식") == "목소리 판"] + TESTS + VOICE_TESTS
    order = [by_id[i] for i in first if i in by_id]
    rest = [it for it in items if it["id"] not in first and not it["대안"]]
    # 목소리 시험 둘을 받아 판정할 틈 — 매진은 말 없는 판을 먼저, 대사(B) 판을 뒤에(10-30 Fable: 바로 뒤에 오면 시험이 틀릴 때 열한 판이 헛돈다)
    talk = [it for it in rest if it["편"] == "hs" and it.get("방식") == "B"]
    order += [it for it in rest if it["편"] == "hs" and it not in talk] + talk + [it for it in rest if it["편"] != "hs"]
    order += [it for it in items if it["대안"]]
    if "--보기" in sys.argv:
        k = sys.argv[sys.argv.index("--보기") + 1]
        print(by_id[k]["지시문"])
        print(f"\n({len(by_id[k]['지시문'])}자)")
        return
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    rows = []
    for n, it in enumerate(order, 1):
        d = os.path.join(OUT, f"{n:03d}_{it['id']}")
        os.makedirs(d)
        for name, src, _ in it["파일"]:
            if not os.path.exists(src):   # 목소리 판에서 뗄 견본 — 받은 뒤 다시 돌려 채운다
                continue
            if name.endswith(".mp3"):
                shutil.copy2(src, os.path.join(d, name))
            else:
                save_jpg(src, os.path.join(d, name))
        open(os.path.join(d, "지시문.txt"), "w", encoding="utf-8").write(it["지시문"])
        rows.append({"순서": n, "id": it["id"], "편": it["편"], "컷": it["컷"], "폴더": os.path.basename(d), "길이": it["길이"], "비율": it["비율"],
                     "소리": it["소리"], "묶음": it["묶음"], "대안": it["대안"], "방식": it.get("방식"), "낱판": it.get("낱판", []),
                     "쓰는초": it.get("쓰는초"), "파일": [f[0] for f in it["파일"]], "빠진 파일": [f[0] for f in it["파일"] if not os.path.exists(f[1])],
                     "지시문 머리": it["지시문"][:160], "지시문 글자 수": len(it["지시문"])})
    json.dump(rows, open(os.path.join(OUT, "_순서.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, "순서표.html"), "w", encoding="utf-8").write(page(order))
    n_main = sum(1 for it in order if not it["대안"])
    n_cast = sum(1 for it in order if it.get("방식") == "목소리 판")
    missing = sorted({src for it in order for _, src, _ in it["파일"] if not os.path.exists(src)})
    print(f"판 {len(order)}개(주판 {n_main} — 목소리 판 {n_cast} 포함 · 대안 {len(order) - n_main}) → {OUT}")
    if missing:
        print(f"  아직 없는 견본 {len(missing)}개(목소리 판을 받아 견본떼기.py 뒤 다시 돌린다): {[os.path.basename(m) for m in missing]}")
    for key in ["hs"] + [k for k, _ in PIECES]:
        sel = [it for it in order if it["편"] == key and not it["대안"]]
        if sel:
            print(f"  {key}: 판 {len(sel)} · 컷 {sum(len(it['컷']) for it in sel)} · 묶음 {sum(it['묶음'] for it in sel)}")
    too_long = [it["id"] for it in order if len(it["지시문"]) > 3800]
    if too_long:
        print("지시문이 3,800자를 넘는 판:", too_long)


DAY2_HEAD = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PULSE 시댄스 둘째 날 순서표</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1c1a;--mute:#6b6760;--line:#e2ddd3;--acc:#2f5bd3;--warn:#b4532a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--warn:#f0a07a}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}.note{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.card.done{opacity:.45}.row{display:flex;gap:10px;align-items:flex-start}
.n{font-weight:700;min-width:44px}.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-right:4px}
.tag.b{border-color:var(--acc);color:var(--acc)}.tag.w{border-color:var(--warn);color:var(--warn)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border-radius:8px;padding:8px;font-size:12.5px;max-height:220px;overflow:auto}
button{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
h2{font-size:18px;margin:24px 0 6px}
</style></head><body><main>
<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 둘째 날 — 7번 숏드라마 「사랑 한 칸」</h1>
<div class="card"><b>시작 전에</b><ol>
<li>첫날과 같습니다 — 모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b> · 화질 720p · 비율 9:16 · 소리는 판마다 적힌 대로(「소리 켬」 판만 켭니다).</li>
<li>판마다 미디어 칸을 비우고 폴더의 파일을 <b>이름 차례대로</b> 올립니다 — 그림(1_ · 2_) 다음에 소리(<b>3_소리.mp3</b> 지금 방식 · <b>3_목소리견본.mp3</b> 새 방식). 「@이미지 1」 · 「@오디오 1」 글자가 꼬리표로 안 바뀌면 지우고 @로 올린 파일을 고릅니다.</li>
<li>「두 샷」 판은 옴니 레퍼런스 모드에서 그림 둘을 참조로 올립니다 — 안 되면 맨 아래 「대안」의 낱판 둘로 냅니다.</li>
<li>맨 앞 <b>목소리 판 넷</b>(이안 · 서진 · 민재 · 소연 — 견본 없이 일상 문장 한 줄, 시댄스가 처음 낸 목소리를 그 배역 목소리로)을 내고 「목소리 판 냈어」라고 해 주세요. Claude가 목소리를 떼어 대사 판마다 <b>3_목소리견본.mp3</b>로 넣어 드립니다.</li>
<li>견본을 떼는 동안(20분쯤) 바로 뒤 <b>소리 끔 판 여섯</b>(1-1 · 1-7 · 1-12 · 1-22 · 1-24 · 1-26+27 — 견본이 필요 없는 판)을 이어서 내 주세요.</li>
<li>이어서 <b>7번 시험 넷</b>(1-16 민재 · 2-28 이안 — 견본이 들어온 뒤, 1-35를 카메라 줄 두 꼴로)을 내고 「7번 시험 냈어」 — 시험 판은 그 컷의 주판을 겸합니다. 「파일 아직」 표시가 있는 판은 순서표를 새로 고쳐 견본이 들어온 것을 보고 내 주세요.</li>
</ol></div>
"""


CMP_HEAD = DAY2_HEAD[:DAY2_HEAD.index("<h1>")] + """<h1>PULSE 포트폴리오 · 7번 그림 두 길 견주기(10-30)</h1>
<div class="card"><b>시작 전에</b><ol>
<li>7번 「사랑 한 칸」 여덟 판을 그림 두 길로 하나씩 냅니다 — <b>얼굴흐림</b>(확정 판의 구도 · 소품 그대로, 얼굴만 선버스트가 새로 그림)과 <b>새로</b>(선버스트로 처음부터 — 더 화려하지만 구도가 원본보다 가까움). 같은 판의 두 길을 이어서 내 주세요.</li>
<li>모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b> · 화질 720p · 비율 9:16 · <b>소리는 모두 끔</b>(그림만 견줍니다 — 대사 목소리는 둘째 날 목소리 판 뒤).</li>
<li>판마다 미디어 칸을 비우고 폴더의 그림을 <b>이름 차례대로</b> 올립니다. 「두 샷」 판은 옴니 레퍼런스 모드에서 그림 둘을 참조로 올립니다.</li>
<li>다 내시면 Claude에게 「7번 비교 냈어」라고 해 주세요 — 판마다 두 길을 나란히 놓은 비교판(얼굴 닮음 · 움직임)을 드리고, 고르신 길로 둘째 날 꾸러미를 다시 만듭니다.</li>
</ol></div>
"""


PV_HEAD = DAY2_HEAD[:DAY2_HEAD.index("<h1>")] + """<h1>PULSE 포트폴리오 · 5번 프리비즈 시험(팁 장부 36행 · 10-31)</h1>
<div class="card"><b>시작 전에</b><ol>
<li>무제한 날 첫날 꾸러미의 <b>맨 끝 선택 판</b>입니다 — 첫날 순서 · 판 수는 그대로이고, 자리가 없으면 둘째 날 맨 앞으로 옮깁니다.</li>
<li>모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b>(생성 단추에 「Unlimited」가 보일 때만 — 안 보이면 내지 않습니다. 크레딧 길은 480p 4초 한 판 12크레딧) · 720p · 16:9 · 소리 끔 · <b>옴니 레퍼런스(참조) 모드</b> — 시작 프레임 칸은 비웁니다.</li>
<li><b>판 ①</b>: 1_원본8행.mp4 하나만 영상 참조로 올리고 지시문을 붙여 냅니다. 받으면 Claude가 원본 생김새(얼굴 · 신발 무늬 · 글자)가 0인지 보고 1_프리비즈.mp4로 판 ② 폴더에 넣습니다 — 「순서표를 새로 고쳐 주세요」라고 알려 드리면 그때 판 ②를 냅니다.</li>
<li><b>판 ②</b>: 영상 1 · 그림 셋을 이름 차례대로 올립니다(「@영상 1」 · 「@이미지 1~3」이 꼬리표로 안 바뀌면 지우고 @로 고릅니다).</li>
</ol></div>
"""


RS_HEAD = DAY2_HEAD[:DAY2_HEAD.index("<h1>")].replace("둘째 날 순서표", "로맨스 순서표") + """<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 — 로맨스 단편 「다 비침」(따로 꾸러미)</h1>
<div class="card"><b>시작 전에</b><ol>
<li>첫날 · 둘째 날과 같습니다 — 모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b>(생성 단추에 「Unlimited」) · 화질 720p · 비율 16:9 · 소리는 판마다 적힌 대로(「소리 켬」 판만 켭니다).</li>
<li>판마다 미디어 칸을 비우고 폴더의 파일을 <b>이름 차례대로</b> 올립니다 — 그림(1_ · 2_) 다음에 소리. 두 사람이 말하는 판 넷(C14 · C41 · C47 · C53a)은 견본이 둘입니다 — <b>3_목소리견본_…</b>이 「@오디오 1」, <b>4_목소리견본_…</b>이 「@오디오 2」(말하는 차례, 파일 이름에 배역). 「@이미지 1」 · 「@오디오 1」 글자가 꼬리표로 안 바뀌면 지우고 @로 올린 파일을 고릅니다.</li>
<li>「두 샷」 판 일곱은 옴니 레퍼런스 모드에서 그림 둘을 참조로 올립니다 — 첫날 시험(11번 7+8)에서 두 샷이 안 됐으면 이 일곱은 내지 않고 생성기에 낱판을 더해 꾸러미를 다시 만듭니다.</li>
<li>맨 앞 <b>목소리 판 셋</b>(유나 · 태준 · 민재 — 견본 없이 일상 문장 한 줄, 시댄스가 처음 낸 목소리를 그 배역 목소리로)을 내고 받습니다. 견본떼기.py로 목소리를 떼어 웹꾸러미.py --로맨스를 다시 돌리면 대사 판마다 <b>3_목소리견본</b>이 들어갑니다(태준 C03 그림은 처마 밑 비가 보여 빗소리가 섞이면 --demucs).</li>
<li>견본을 떼는 동안(20분쯤) 바로 뒤 <b>길 시험 다섯</b>(소리 끔 — 끝 구도로 사람이 들어옴 · 물러나며 끝 구도 · 두 샷 · 고속 슬로 · 초점 옮김)을 이어서 냅니다.</li>
<li>「파일 아직」이 사라지면(견본이 들어옴) <b>목소리 시험 셋</b>(C02 유나 한 사람 · C14 민재 → 태준 · C53a 태준 → 유나)을 내고, 판마다 같은 사람 목소리인지 · 견본 둘이 제 사람에게 갔는지 · 입과 소리가 맞는지 들은 뒤 이야기 차례로 잇습니다. 견본 둘이 섞이면 두 사람 판 넷은 굽기 시트 「새 방식(B)이 안 될 때」의 길로 갑니다.</li>
<li><b>rs-C53b</b>는 rs-C53a를 받은 뒤 그 영상의 끝 프레임으로 시작합니다 — 받기.py 뒤 웹꾸러미.py --로맨스를 다시 돌리면 「파일 아직」이 사라집니다(끝 프레임이 망가졌으면 C53.jpg로).</li>
<li>회상 31컷(C07–23 · C41–54)은 16:9 그대로 받고 좌우 검은 띠는 편집에서 씌웁니다. 카드의 「후반」(속말 · 손글씨 · 앞 가림 · 휴대폰 사진 · 화면 글 · 노래 표기)은 굽지 않습니다.</li>
<li>맨 끝 <b>원본 카메라 판 셋</b>(id 끝 o)은 요즘 기법 판(C30 · C59 · C60 느린 다가감)과 나란히 보고 고르는 판입니다.</li>
</ol></div>
"""


SIX_HEAD = DAY2_HEAD[:DAY2_HEAD.index("<h1>")].replace("둘째 날 순서표", "여섯 편 순서표") + """<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 — 여섯 편(1번 · 블프 세일 · 8번 · 블프 스나이퍼 · 6번 · 10번)</h1>
<div class="card"><b>시작 전에</b><ol>
<li>첫날 · 둘째 날 꾸러미와 따로 묶은 판입니다 — 첫날 순서 · 판 수는 그대로이고, 하루에 다 안 들어가면 이 꾸러미가 다음 날 몫입니다. 짧은 편부터 끝까지 마쳐 중간에 멈춰도 완성 편이 남게 했습니다.</li>
<li>모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b>(생성 단추에 「Unlimited」가 보일 때만) · 화질 720p · <b>비율은 판마다</b>(1번 · 블프 세일 9:16, 8번 · 블프 스나이퍼 · 6번 · 10번 16:9) · 소리는 판마다 적힌 대로(「소리 켬」 판만 켭니다).</li>
<li>판마다 미디어 칸을 비우고 폴더의 그림을 <b>이름 차례대로</b> 올립니다 — 칸이 「시작 / 끝 프레임」이면 1_시작 → 시작, 2_끝 → 끝. 칸이 하나면 올린 차례대로 「@이미지 1 · 2」가 되고, 글자 「@이미지 1」이 꼬리표로 안 바뀌면 지우고 @로 올린 그림을 고릅니다.</li>
<li>「두 샷」 판은 옴니 레퍼런스(참조) 모드에서 그림 둘을 참조로 올려 한 판에 두 컷을 냅니다 — 안 되면 맨 아래 「대안」의 낱판 둘로 냅니다.</li>
<li><b>「_참고」 그림이 있는 판</b>(10번 19 — 2_참고.jpg)은 끝 그림이 아닙니다 — 옴니 레퍼런스(참조) 모드에서 1_시작 다음 참고로 올리고, 시작 / 끝 프레임 칸의 끝 칸에 넣지 않습니다.</li>
<li>맨 앞 <b>목소리 판 둘</b>(6번 엄마 · 딸 — 소리 켬, 견본 없이 일상 문장 한 줄)을 먼저 내고, 받은 목소리를 견본으로 떼어 6번 대사 판(7 · 11 — 「새 방식」 표시)에 <b>3_목소리견본.mp3</b>로 넣습니다. 견본이 들어오기 전 그 두 판에는 「파일 아직」이 붙어 있습니다 — 6번은 맨 뒤 편이라 그때까지 시간이 넉넉합니다.</li>
<li>이어서 <b>시험</b> 판(편마다 가장 불확실한 길)을 내고 받아 봅니다 — 되면 그 편 차례로, 안 되면 지시문을 고쳐 꾸러미를 다시 만든 뒤 잇습니다. 시험 판은 그 컷의 주판을 겸합니다.</li>
<li>입이 보이는 대사(6번 7 · 11)와 8번 19 손님 한 줄만 판에서 소리를 냅니다. 그 밖의 대사 · 내레이션 · 폰 화면 녹화(8번 초록 화면) · 화면 글자 · 가격 · 로고는 모두 후반에서 얹습니다 — 판에는 없습니다.</li>
</ol></div>
"""


def page(order, day2=None):
    def esc(s):
        return html.escape(s)
    head = SIX_HEAD if day2 == "여섯편" else RS_HEAD if day2 == "로맨스" else PV_HEAD if day2 == "프리비즈" else CMP_HEAD if day2 == "비교" else DAY2_HEAD if day2 else """<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>PULSE 시댄스 순서표</title><style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d1c1a;--mute:#6b6760;--line:#e2ddd3;--acc:#2f5bd3;--warn:#b4532a}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#17171a;--card:#212125;--ink:#ecebe8;--mute:#a19d95;--line:#33333a;--acc:#8aa6ff;--warn:#f0a07a}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,'Malgun Gothic',sans-serif}
main{max-width:980px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:8px 0}.note{color:var(--mute)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.card.done{opacity:.45}.row{display:flex;gap:10px;align-items:flex-start}
.n{font-weight:700;min-width:44px}.tag{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:0 6px;margin-right:4px}
.tag.b{border-color:var(--acc);color:var(--acc)}.tag.w{border-color:var(--warn);color:var(--warn)}
pre{white-space:pre-wrap;word-break:break-word;background:var(--bg);border-radius:8px;padding:8px;font-size:12.5px;max-height:220px;overflow:auto}
button{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}
h2{font-size:18px;margin:24px 0 6px}
</style></head><body><main>
<h1>PULSE 포트폴리오 · 시댄스 2.5 무제한 순서표</h1>
<div class="card"><b>시작 전에</b><ol>
<li>사기 전에 상품 카드에서 모델(Seedance 2.5) · 화질(720p) · 한 판 길이 상한 · 동시에 돌릴 수 있는 수를 봐 주세요. Claude가 받을 수 있게 MCP가 붙은 계정에서 삽니다. 그리고 만들기 칸에 가장 긴 지시문(110번 판 옆집 07+08, 3,685자)을 미디어 없이 붙여 넣어 끝 줄 「SOUND: silent clip …」까지 들어가는지 봐 주세요(생성은 누르지 않음) — 잘리면 사지 말고 Claude에게 알려 주세요.</li>
<li>higgsfield.ai → 비디오 만들기 → 모델 Seedance 2.5 · <b>Unlimited 스위치 켬</b>(생성 단추에 「Unlimited」가 보여야 크레딧이 안 나갑니다) · 화질 720p · 소리는 판마다 적힌 대로 · 비율은 판마다 적힌 대로.</li>
<li>판마다 앞 판에서 올린 그림을 지우고 미디어 칸을 비운 뒤, 판 폴더의 그림을 <b>파일 이름 차례대로</b> 올립니다.
 <br>· 그림 칸이 「시작 프레임 / 끝 프레임」으로 나뉘면: 1_시작 → 시작, 2_끝 → 끝.
 <br>· 칸이 하나(「미디어 업로드」)뿐이면: 올린 차례대로 「@이미지 1」 · 「@이미지 2」가 됩니다. 지시문을 붙여 넣은 뒤 글자 「@이미지 1」이 꼬리표로 안 바뀌면 그 글자를 지우고 @를 쳐서 올린 그림을 고릅니다.
 <br>· 소리 파일은 그림 다음에 올립니다 — <b>3_소리.mp3</b>(지금 방식) · <b>3_목소리견본.mp3</b>(새 방식). 새 방식 지시문의 글자 「@오디오 1」이 꼬리표로 안 바뀌면 지우고 @를 쳐서 올린 소리를 고릅니다.</li>
<li><b>「두 샷」 판</b>(파란 표시)은 <b>옴니 레퍼런스(참조) 모드</b>에서 그림 둘을 참조로 올려 한 판에 두 컷을 냅니다 — 시댄스 2.5에는 이 모드가 있습니다(10-28 MCP 모델 정보: 문장만 · 옴니 레퍼런스 · 시작/끝 프레임 · 한 판 4~30초). 화면이 두 그림을 시작 · 끝 프레임으로만 받으면 이 판은 내지 말고 아래 「대안」의 낱판 둘로 냅니다.</li>
<li>「지시문 복사」로 글을 붙여 넣고 생성합니다. 프리셋을 권하면 거절합니다. 앞 판이 다 만들어진 뒤 다음 판을 냅니다. 처음 보는 동의 창은 직접 읽고 눌러 주세요.</li>
<li>대사는 시댄스가 직접 연기한 목소리를 쓰고, 목소리는 처음 시댄스가 내 준 것으로 정합니다(10-29). 그래서 맨 앞 <b>목소리 판 넷</b>(매진 임박 지유 · 리4 · 통2 · 강도 — 소리 켬, 견본 없이 일상 문장 한 줄)을 먼저 내고 Claude에게 「목소리 판 냈어」라고 해 주세요. Claude가 그 목소리를 떼어 배역마다 대사 판에 <b>3_목소리견본.mp3</b>로 넣어 드립니다.</li>
<li>기다리지 말고 이어서 <b>시험 여섯</b>을 내시고 「시험 냈어」 — 묶음 · 끝 그림 · 카메라 길이 되는지 알려 드립니다. 그다음 <b>목소리 시험 둘</b>(지유 #7 · #12)은 순서표를 새로 고쳐 견본이 들어온 것(「파일 아직」 표시가 사라짐)을 보고 내 주세요 — 두 컷이 같은 사람 목소리로 들리는지 · 입과 소리가 맞는지 들어 보는 판을 만들어 드립니다. 목소리 시험 뒤에는 매진 <b>말 없는 판</b>부터 이어서 내 주시고, 매진 <b>대사 판</b>(새 방식 열한 판)은 목소리 시험 판정을 들은 뒤에 내 주세요 — 그 사이에 말 없는 판이 한 시간쯤 있습니다.</li>
</ol></div>
"""
    out = [head]
    cur = None
    for n, it in enumerate(order, 1):
        sec = it.get("구역") or ("목소리 판 — 배역마다 시댄스가 처음 내는 목소리" if it.get("방식") == "목소리 판"
               else "목소리 시험 — 시댄스가 연기한 목소리가 컷마다 같은가" if it["id"] in VOICE_TESTS else "시험" if it["id"] in TESTS or it.get("시험")
               else "대안 — 묶음 판 · 새 방식이 안 될 때만" if it["대안"] else it["편이름"])
        if sec != cur:
            out.append(f"<h2>{esc(sec)}</h2>")
            cur = sec
        tags = f'<span class="tag">{esc(it["비율"])}</span><span class="tag">{it["길이"]}초</span><span class="tag">소리 {esc(it["소리"])}</span>'
        if it.get("방식") == "A":
            tags += '<span class="tag">지금 방식</span>'
        if it.get("방식") == "B":
            tags += '<span class="tag b">새 방식</span>'
        if it["묶음"]:
            tags += '<span class="tag b">두 샷</span>'
        if it.get("방식") == "목소리 판":
            tags += '<span class="tag b">목소리 판</span>'
        if it["대안"]:
            tags += '<span class="tag w">대안</span>'
        miss = [f[0] for f in it["파일"] if not os.path.exists(f[1])]
        if any(m in it.get("기다림", []) for m in miss):   # 로맨스 rs-C53b — 앞 토막을 받아야 생기는 첫 그림
            tags += f'<span class="tag w">{esc(it["기다림글"])}</span>'
        if any(m not in it.get("기다림", []) for m in miss):
            tags += '<span class="tag w">파일 아직 — 목소리를 고른 뒤 다시 만듦</span>'
        files = " · ".join(f"{esc(f[0])}" for f in it["파일"])
        memo = "".join(f'<br><span class="note">· {esc(m)}</span>' for m in it.get("메모", []))   # 로맨스 — 회상 · 후반 · 견본 둘 · 여유(다른 편은 칸 없음)
        out.append(f'<div class="card" id="c{n}"><div class="row"><input type="checkbox" data-k="{esc(it["id"])}"><div class="n">{n}</div><div>'
                   f'<b>{esc(it["편이름"])}</b> 컷 {esc(", ".join(it["컷"]))} — {esc(it["설명"])}<br>{tags}<br>'
                   f'<span class="note">폴더 {n:03d}_{esc(it["id"])} · 올릴 것: {files}</span>{memo}'
                   f'<pre id="p{n}">{esc(it["지시문"])}</pre><button data-p="p{n}">지시문 복사</button></div></div></div>')
    out.append("""<script>
const K='pulse-seedance-day-20261028';let s={};try{s=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
document.querySelectorAll('input[type=checkbox]').forEach(b=>{const c=b.closest('.card');if(s[b.dataset.k]){b.checked=true;c.classList.add('done')}
b.onchange=()=>{s[b.dataset.k]=b.checked;c.classList.toggle('done',b.checked);try{localStorage.setItem(K,JSON.stringify(s))}catch(e){}}});
document.querySelectorAll('button[data-p]').forEach(x=>x.onclick=()=>{const t=document.getElementById(x.dataset.p).innerText;
navigator.clipboard.writeText(t).then(()=>{x.textContent='복사함';setTimeout(()=>x.textContent='지시문 복사',1200)})});
</script></main></body></html>""")
    return "\n".join(out)


if __name__ == "__main__":
    build()
