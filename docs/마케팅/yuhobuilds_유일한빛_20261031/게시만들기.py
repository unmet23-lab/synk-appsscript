# Y25 게시 묶음을 한 번에 쓴다: python 게시만들기.py  → 게시/ 판 폴더 원고 · 게시글.md · 준비.json
# 글을 고치면 여기서 고치고 다시 돌린다(판마다 같은 글을 손으로 맞추지 않으려고).
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, '게시')
ROOT = 'docs/마케팅/yuhobuilds_유일한빛_20261031'
SLOT = '2026-11-02'
FINAL = f'{ROOT}/remotion/out/y25_final.mp4'
UPLOAD = f'{ROOT}/remotion/out/y25_upload.mp4'
COVER = f'{ROOT}/게시/표지_1080x1920.jpg'
PROMPT_ID = 'only-light-night'
URL = f'https://synk.im/prompts/#{PROMPT_ID}'
TITLE = 'AI한테 「밤처럼 어둡게」 시켰더니 저녁 — 「○○가 유일한 빛」으로 바꾸니 진짜 밤'
PROMPT = '휴대폰 화면이 유일한 빛이야. 그 밖은 거의 검은 형체로 해 줘. 구도와 사람은 그대로 두고.'
ASK = '여러분 사진엔, 뭐가 빛이 될까요?'
NOTE = '올라가는 글의 정본. 사람이 읽는 판은 ../게시글.md. 키워드 DM · 첫 댓글 약속 없음. 영상은 판 모두 y25_final.mp4 하나(끝 말은 질문이라 어느 판에도 없는 길을 가리키지 않음).'


def body(link):
    return (
        '낮 사진을 밤으로 바꾸고 싶었어요. 사람 사진에 「밤처럼 어둡게 해 줘」를 시켰더니 방이 아직 환한 저녁이 나왔고요.\n\n'
        '「어둡게」란 말을 빼고 사진 속 빛을 정해 줬어요 👇\n'
        f'「{PROMPT}」\n'
        '→ 같은 사진의 밝기가 80에서 34로 내려가고, 얼굴에 폰 불빛만 남았어요. 스탠드 · 초 · 가게 전구 · 헤드라이트 사진도 같은 꼴의 글로 밤이 됐어요.\n\n'
        f'요청문 전문: {link}\n\n'
        '해 본 조건: 구글 제미나이 웹에서 10월 31일, 지시마다 새 대화로 한 번씩. 사진은 AI로 만든 예시 그림이고(실제 촬영 · 실제 인물 아님), 낮 · 밤 사진은 AI가 낸 그대로예요. 낮에서 밤으로 덮이는 움직임은 두 사진을 겹친 편집이고, 화면에서 움직이는 밤은 그 밤 사진으로 동영상을 한 번 더 만든 거예요(카메라 고정 · 빛은 그대로). 10월 26일에 먼저 겪은 일을 새 그림으로 다시 해 본 기록이에요. '
        '밝기는 사진 전체의 회색 중앙값(0 검정~255 흰색)이에요.\n'
        '「어둡게」가 안 먹히는 건 아니에요 — 사람 사진은 「어둡게 해 줘」만 써도 71까지 내려갔고(파란 저녁빛), 헤드라이트가 켜진 자동차 사진은 「밤처럼 어둡게」만으로 밤이 됐어요. 사진에 뚜렷한 빛이 없을 때 차이가 컸어요. '
        '먼 풍경은 어둠에 묻혀 안 보이게 되니, 풍경을 살릴 사진엔 안 맞아요.\n\n'
        f'{ASK}'
    )


TAGS = '#AI사진 #AI이미지 #프롬프트 #AI활용 #1인크리에이터'
ig = body('synk.im/prompts') + '\n\n' + TAGS
yt = body(URL)
tt = body(URL) + '\n\n' + TAGS
# 첫 125자는 훅 자리 — 링크는 그 뒤에(올리기 전 검사 · v2 §2-4).
x = (f'낮 사진을 밤으로 바꾸려고 AI한테 「밤처럼 어둡게 해 줘」를 시켰더니, 방이 아직 환한 저녁(밝기 80)에서 멈췄어요.\n'
     f'「휴대폰 화면이 유일한 빛이야. 그 밖은 거의 검은 형체로」로 바꾸니 진짜 밤(34).\n요청문은 여기에 👇 {URL}')
li = (
    '낮 사진을 밤으로 바꿀 때 「어둡게」 「밤처럼」이라고 시키는 경우가 많습니다.\n\n'
    '사람 사진으로 직접 해 보니 「밤처럼 어둡게 해 줘」는 방이 아직 환한 저녁(밝기 80)에서 멈췄습니다. 말을 바꿔 「휴대폰 화면이 유일한 빛이야. 그 밖은 거의 검은 형체로 해 줘.」라고 빛의 자리를 정하자 밝기 34, 방 전체가 어두워지고 얼굴에 폰 불빛만 남았습니다. 스탠드 · 초 · 가게 전구 · 헤드라이트 사진도 같은 꼴의 글로 밤이 됐습니다.\n\n'
    '배운 것은 하나입니다. 얼마나 어둡게 할지를 말하는 대신, 무엇이 빛인지를 말하면 결과가 더 일정했습니다. 다만 헤드라이트처럼 뚜렷한 빛이 이미 있는 사진은 「밤처럼」만으로도 밤이 됐고, 먼 풍경은 어둠에 묻힙니다. 예시 그림 다섯 장, 지시마다 한 번씩 돌린 결과입니다.\n\n'
    f'요청문: {URL}'
)
th = (
    '낮 사진을 밤으로 바꾸려고 「밤처럼 어둡게 해 줘」를 시켰더니 저녁(밝기 80)에서 멈췄어요.\n\n'
    f'「{PROMPT}」로 바꾸니 34, 얼굴에 폰 불빛만 남았어요. 스탠드 · 초 · 가게 전구 · 헤드라이트 사진도 같은 꼴로 밤이 됐고요.\n\n'
    f'요청문: {URL}\n\n'
    '사진은 AI로 만든 예시 그림, 지시마다 한 번씩. 헤드라이트가 켜진 사진은 「밤처럼」만으로도 밤이 됐어요.\n\n'
    f'{ASK}'
)

common = {'brand': 'yuhobuilds', 'language': 'ko', 'audioLanguage': 'ko', 'alteredContent': True, 'madeForKids': False, '_비고': NOTE}
panels = [
    ('01-yuhobuilds-instagram', {'platform': 'instagram', 'account': '@yuhobuilds', 'format': 'reels', 'caption': ig}),
    ('02-yuhobuilds-youtube', {'platform': 'youtube', 'account': '@yuhobuilds', 'format': 'shorts', 'title': 'AI 사진 「밤처럼 어둡게」는 저녁, 「○○가 유일한 빛」은 밤 #Shorts', 'caption': yt, 'pinnedComment': f'요청문 전문: {URL}\n{ASK}'}),
    ('03-yuhobuilds-tiktok', {'platform': 'tiktok', 'account': '@yuhobuilds', 'format': 'video', 'caption': tt}),
    ('04-yuhobuilds-x', {'platform': 'x', 'account': '@yuhobuilds', 'format': 'video-post', 'caption': x}),
    ('05-yuho-linkedin', {'platform': 'linkedin', 'account': '양유호', 'format': 'video-post', 'caption': li}),
]
for d, v in panels:
    os.makedirs(os.path.join(PUB, d), exist_ok=True)
    j = {'id': d, 'brand': common['brand'], 'language': 'ko', 'audioLanguage': 'ko', **v, 'alteredContent': True, 'madeForKids': False, '_비고': NOTE}
    json.dump(j, open(os.path.join(PUB, d, '원고.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
os.makedirs(os.path.join(PUB, '06-yuhobuilds-threads'), exist_ok=True)
open(os.path.join(PUB, '06-yuhobuilds-threads', '원고.txt'), 'w', encoding='utf-8').write(th)
open(os.path.join(PUB, '06-yuhobuilds-threads', 'README.md'), 'w', encoding='utf-8').write(
    '# 스레드 @yuhobuilds 판(yuhobuilds-threads) · Y25\n\n- 영상: `../../remotion/out/y25_final.mp4`(다른 판과 같은 최종본), 글: `원고.txt`(스레드 500자 안).\n- 올리기: 유호님 승인 뒤, 로그인돼 있을 때(장부 머리말 「스레드는 로그인되면 같은 꼴로 더한다」). Claude는 비밀번호를 넣지 않는다.\n')
open(os.path.join(PUB, '게시글.md'), 'w', encoding='utf-8').write(
    '# 게시글 · yuhobuilds Y25(사람이 읽는 판 — 올라가는 글의 정본은 판마다 원고.json · 원고.txt)\n\n'
    f'## yuhobuilds-instagram\n\n{ig}\n\n## yuhobuilds-youtube\n\n제목: {panels[1][1]["title"]}\n\n{yt}\n\n고정 댓글: {panels[1][1]["pinnedComment"]}\n\n'
    f'## yuhobuilds-tiktok\n\n{tt}\n\n## yuhobuilds-x\n\n{x}\n\n## yuho-linkedin-primary\n\n{li}\n\n## yuhobuilds-threads\n\n{th}\n')

accounts = [('yuhobuilds-instagram', '01-yuhobuilds-instagram'), ('yuhobuilds-youtube', '02-yuhobuilds-youtube'), ('yuhobuilds-tiktok', '03-yuhobuilds-tiktok'), ('yuhobuilds-x', '04-yuhobuilds-x'), ('yuho-linkedin-primary', '05-yuho-linkedin')]
plates = [{'계정': a, '파일': FINAL, '올리기판': UPLOAD, '시각': f'{SLOT}T21:00+09:00', '게시글': f'{ROOT}/게시/게시글.md', '훅': 'A', '원고': f'{ROOT}/게시/{d}/원고.json', '표지': COVER, '표지시각': 1.2} for a, d in accounts]
plates.append({'계정': 'yuhobuilds-threads', '파일': FINAL, '시각': f'{SLOT}T21:00+09:00', '게시글': f'{ROOT}/게시/06-yuhobuilds-threads/원고.txt', '_비고': '로그인돼 있을 때만(장부 머리말)'})
plates.append({'계정': 'shift-tistory', '파일': f'{ROOT}/게시/티스토리.md', '시각': f'{SLOT}T21:30+09:00', '게시글': f'{ROOT}/게시/티스토리.md'})

path = os.path.join(PUB, '준비.json')
old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
ready = {
    '브랜드': 'yuhobuilds', '날짜': '2026-10-31', '슬롯': SLOT, '성격': '상시', '역할': '권위', '시한': None, '상태': '완성', '제목': TITLE,
    '기획': f'{ROOT}/기획.md',
    '원본': {'주소': 'https://www.youtube.com/shorts/Ls0r557jclc', '갈래': '같은분야', '조회': 15388, '배수': 14.25, '올린날': '2026-10-18', '오마주': f'{ROOT}/오마주.json'},
    '목소리': f'{ROOT}/음성/범수', '길이': '42.5초(판 모두 같은 영상)',
    '0초 훅': '낮 바닷길의 자동차 → 0.3초부터 어둠이 헤드라이트 쪽으로 조여 들어 1.2초에 밤, 자막 「낮 사진이 밤이 됐어요」',
    '끝줄': '여러분 사진엔, 뭐가 빛이 될까요?',
    '최종본': [FINAL], '판': plates, '빠진판': {}, '틱톡없음': None, '표지': COVER,
    'AI 표시': '켬(내레이션 AI 음성 · 사진 · 움직이는 컷은 AI가 만든 것 · 낮에서 밤으로 덮이는 움직임은 편집)', '아동용': '아님', '유튜브 언어': 'ko', '끝 행동 링크': URL, '미룰편': [],
    '남은위험': old.get('남은위험', []),
    '프롬프트': {'id': PROMPT_ID, '주소': URL, '본문': 'docs/마케팅/맞춤도구/prompts/프롬프트.json'},
    '이해시험': old.get('이해시험', {}),
}
for k in ('검사', '작업실등록'):
    if k in old:
        ready[k] = old[k]
json.dump(ready, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('게시 묶음 씀 ·', len(plates), '판')
