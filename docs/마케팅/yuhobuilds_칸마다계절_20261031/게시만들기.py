# Y28 게시 묶음을 한 번에 쓴다: python 게시만들기.py  → 게시/ 판 폴더 원고 · 게시글.md · 준비.json
# 글을 고치면 여기서 고치고 다시 돌린다(판마다 같은 글을 손으로 맞추지 않으려고). Y25 게시만들기.py를 옮겼다.
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, '게시')
ROOT = 'docs/마케팅/yuhobuilds_칸마다계절_20261031'
SLOT = '2026-11-04'
FINAL = f'{ROOT}/remotion/out/y28_final.mp4'
UPLOAD = f'{ROOT}/remotion/out/y28_upload.mp4'
COVER = f'{ROOT}/게시/표지_1080x1920.jpg'
PROMPT_ID = 'webtoon-season-line'
URL = f'https://synk.im/prompts/#{PROMPT_ID}'
TITLE = 'AI 웹툰, 칸마다 따로 그렸더니 몇 분 사이에 계절이 바뀌었다 — 모든 칸 끝에 계절 한 줄'
LINE = '계절: 3월 첫 주 이른 봄. 나무는 아직 잎 없는 맨가지(창밖 나무도 똑같이). 초록 잎 · 벚꽃 없음.'
ASK = '몇 초 만에 찾으셨어요?'
NOTE = '올라가는 글의 정본. 사람이 읽는 판은 ../게시글.md. 키워드 DM · 첫 댓글 약속 없음. 영상은 판 모두 y28_final.mp4 하나(끝 말은 첫 질문으로 돌아가는 「몇 초 만에 찾으셨어요?」라 어느 판에도 없는 길을 가리키지 않음).'


def body(link):
    return (
        'AI로 웹툰 네 칸을 칸마다 따로 그리게 했어요. 같은 날 아침 몇 분 사이 이야기인데, 정문 나무는 거의 맨가지고 강의실 창밖은 초록 잎이 가득했어요.\n\n'
        '모든 칸 지시문 끝에 계절 한 줄을 붙였어요 👇\n'
        f'「{LINE}」\n'
        '→ 같은 네 칸을 다시 그리니 네 칸 다 창밖까지 맨가지가 됐어요.\n\n'
        f'빈칸 채워 쓰는 판: {link}\n\n'
        '해 본 조건: 10월 31일, 같은 인물 설정 그림 한 장을 참고로 넣고 그림 AI 하나에 칸마다 새 대화로 한 번씩. 계절 줄 없는 판은 칸 1에만 「이른 봄 아침」이라고 적었고, 칸 2~4는 계절을 적지 않았어요. 계절 줄 판 칸 3은 옆자리 남학생 옷이 바뀌어 나와, 옷을 한 줄 더 적어 다시 그렸어요. 그림은 이 실험을 위해 만든 예시 웹툰이에요.\n'
        '처음 겪은 건 제 웹툰 작업에서였어요 — 칸 1 맨가지, 칸 4 초록 잎, 칸 8 벚꽃. 그때는 계절 줄과 함께, 처음 나온 물건의 생김새도 다음 칸마다 같이 적어 다섯 칸이 다 맞았어요.\n\n'
        f'{ASK}'
    )


TAGS = '#AI웹툰 #인스타툰 #AI그림 #프롬프트 #1인크리에이터'
ig = body('synk.im/prompts') + '\n\n' + TAGS
yt = body(URL)
tt = body(URL) + '\n\n' + TAGS
# 첫 125자는 훅 자리 — 링크는 그 뒤에(올리기 전 검사 · v2 §2-4).
x = ('AI 웹툰 네 칸을 칸마다 따로 그렸더니, 같은 날 아침 몇 분 사이인데 정문 나무는 맨가지고 강의실 창밖은 초록 잎 가득이었어요.\n'
     f'모든 칸 끝에 계절 한 줄을 붙이니 네 칸 다 창밖까지 맨가지가 됐어요.\n그 한 줄은 여기에 👇 {URL}')
li = (
    'AI로 웹툰이나 카드뉴스를 칸마다 따로 그리면, 칸끼리 무언가가 조용히 바뀝니다.\n\n'
    '같은 날 아침 몇 분 사이 이야기인 네 칸을 칸마다 새로 그리게 하자, 계절을 적은 칸 1(정문)은 나무가 거의 맨가지였고 계절을 적지 않은 칸 2~4(강의실)는 창밖이 초록 잎으로 가득했습니다. 모든 칸 지시문 끝에 같은 계절 줄을 붙이자 네 칸 모두 창밖까지 맨가지가 됐습니다.\n\n'
    '배운 것은 하나입니다. 칸마다 따로 그리는 그림은 적지 않은 것을 칸마다 따로 채웁니다. 이어지는 장면이면 계절 · 날씨 · 처음 나온 물건처럼 같아야 할 것을 모든 칸에 같은 줄로 적어 둡니다. 예시 그림 네 칸, 지시마다 한 번씩 돌린 결과입니다.\n\n'
    f'계절 줄: {URL}'
)
th = (
    'AI 웹툰 네 칸을 칸마다 따로 그렸더니, 같은 날 아침인데 정문 나무는 거의 맨가지, 강의실 창밖은 초록 잎 가득이었어요.\n\n'
    f'모든 칸 끝에 「{LINE}」를 붙이니 네 칸 다 창밖까지 맨가지.\n\n'
    f'빈칸 채워 쓰는 판: {URL}\n\n'
    '그림은 예시로 만든 웹툰, 칸마다 새 대화로 한 번씩.\n\n'
    f'{ASK}'
)

common = {'brand': 'yuhobuilds', 'language': 'ko', 'audioLanguage': 'ko', 'alteredContent': True, 'madeForKids': False, '_비고': NOTE}
panels = [
    ('01-yuhobuilds-instagram', {'platform': 'instagram', 'account': '@yuhobuilds', 'format': 'reels', 'caption': ig}),
    ('02-yuhobuilds-youtube', {'platform': 'youtube', 'account': '@yuhobuilds', 'format': 'shorts', 'title': 'AI 웹툰, 칸마다 따로 그렸더니 몇 분 사이에 계절이 바뀌었다 #Shorts', 'caption': yt, 'pinnedComment': f'계절 한 줄 전문: {URL}\n{ASK}'}),
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
    '# 스레드 @yuhobuilds 판(yuhobuilds-threads) · Y28\n\n- 영상: `../../remotion/out/y28_final.mp4`(다른 판과 같은 최종본), 글: `원고.txt`(스레드 500자 안).\n- 올리기: 유호님 승인 뒤, 로그인돼 있을 때(장부 머리말 「스레드는 로그인되면 같은 꼴로 더한다」). Claude는 비밀번호를 넣지 않는다.\n')
open(os.path.join(PUB, '게시글.md'), 'w', encoding='utf-8').write(
    '# 게시글 · yuhobuilds Y28(사람이 읽는 판 — 올라가는 글의 정본은 판마다 원고.json · 원고.txt)\n\n'
    f'## yuhobuilds-instagram\n\n{ig}\n\n## yuhobuilds-youtube\n\n제목: {panels[1][1]["title"]}\n\n{yt}\n\n고정 댓글: {panels[1][1]["pinnedComment"]}\n\n'
    f'## yuhobuilds-tiktok\n\n{tt}\n\n## yuhobuilds-x\n\n{x}\n\n## yuho-linkedin-primary\n\n{li}\n\n## yuhobuilds-threads\n\n{th}\n')

accounts = [('yuhobuilds-instagram', '01-yuhobuilds-instagram'), ('yuhobuilds-youtube', '02-yuhobuilds-youtube'), ('yuhobuilds-tiktok', '03-yuhobuilds-tiktok'), ('yuhobuilds-x', '04-yuhobuilds-x'), ('yuho-linkedin-primary', '05-yuho-linkedin')]
plates = [{'계정': a, '파일': FINAL, '올리기판': UPLOAD, '시각': f'{SLOT}T21:00+09:00', '게시글': f'{ROOT}/게시/게시글.md', '훅': 'A', '원고': f'{ROOT}/게시/{d}/원고.json', '표지': COVER, '표지시각': 1.0} for a, d in accounts]
plates.append({'계정': 'yuhobuilds-threads', '파일': FINAL, '시각': f'{SLOT}T21:00+09:00', '게시글': f'{ROOT}/게시/06-yuhobuilds-threads/원고.txt', '_비고': '로그인돼 있을 때만(장부 머리말)'})
plates.append({'계정': 'shift-tistory', '파일': f'{ROOT}/게시/티스토리.md', '시각': f'{SLOT}T21:30+09:00', '게시글': f'{ROOT}/게시/티스토리.md'})

path = os.path.join(PUB, '준비.json')
old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
ready = {
    '브랜드': 'yuhobuilds', '날짜': '2026-10-31', '슬롯': SLOT, '성격': '상시', '역할': '유입', '시한': None, '상태': '완성', '제목': TITLE,
    '기획': f'{ROOT}/기획.md',
    '원본': {'주소': 'https://www.youtube.com/shorts/VMwrKqlumr4', '갈래': '같은분야', '조회': 9409, '배수': 7.36, '올린날': '2026-10-19', '오마주': f'{ROOT}/오마주.json'},
    '목소리': f'{ROOT}/음성/범수', '길이': '50.3초(판 모두 같은 영상)',
    '0초 훅': '크림색 종이 위 웹툰 네 칸(계절 줄 없이 실제로 구운 판) + 0.3초 큰 글 「이상한 데 하나, 보이세요?」 → 4.9~8.7초 3초 찾기',
    '끝줄': '처음에, 몇 초 만에 찾으셨어요?',
    '최종본': [FINAL], '판': plates, '빠진판': {}, '틱톡없음': None, '표지': COVER,
    'AI 표시': '켬(내레이션 AI 음성 · 웹툰 칸 그림과 인물 설정 그림은 AI가 만든 것)', '아동용': '아님', '유튜브 언어': 'ko', '끝 행동 링크': URL, '미룰편': [],
    '남은위험': old.get('남은위험', []),
    '프롬프트': {'id': PROMPT_ID, '주소': URL, '본문': 'docs/마케팅/맞춤도구/prompts/프롬프트.json'},
    '이해시험': old.get('이해시험', {}),
}
for k in ('검사', '작업실등록'):
    if k in old:
        ready[k] = old[k]
json.dump(ready, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('게시 묶음 씀 ·', len(plates), '판')
