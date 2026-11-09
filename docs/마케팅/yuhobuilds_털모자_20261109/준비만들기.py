# yuhobuilds 11-13 「벗은 모자」 게시/준비.json — 판 · 슬롯 · 표지를 한 곳에서. 검사 칸은 tools/올리기전검사.js가 채운다(다시 돌려도 지키도록 있으면 그대로 둔다).
# 사용: python -I -X utf8 docs/마케팅/yuhobuilds_털모자_20261109/준비만들기.py [--등록] [--상태 "…"]
import json, sys
from pathlib import Path

D = Path(__file__).resolve().parent
폴더 = 'docs/마케팅/yuhobuilds_털모자_20261109'
f = D / '게시' / '준비.json'
옛 = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
오 = json.loads((D / '오마주.json').read_text(encoding='utf-8'))['원본']
상태 = sys.argv[sys.argv.index('--상태') + 1] if '--상태' in sys.argv else 옛.get('상태', '제작 중')
시각 = '2026-11-13T21:00+09:00'
공통 = lambda 계정, 원고: {'계정': 계정, '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/게시글.md', '훅': 'A', '원고': f'{폴더}/게시/{원고}/원고.json', '표지': f'{폴더}/게시/표지_1080x1920.jpg', '표지시각': 1.5, 'AI표시': True}
j = {
  '브랜드': 'yuhobuilds', '날짜': '2026-11-09', '슬롯': '2026-11-13', '성격': '상시', '역할': '유입', '시한': None, '상태': 상태,
  '제목': '벗은 모자를 AI가 네 컷 내리 다시 씌웠다 — 컷마다 프롬프트에 바뀐 상태 + 앞 컷 그림',
  '기획': f'{폴더}/기획.md',
  '원본': {'주소': 오['주소'], '갈래': '같은분야', '조회': 오.get('조회'), '배수': 3.34, '올린날': 오.get('올린날'), '오마주': f'{폴더}/오마주.json'},
  '형식시험': {'짝': 3, '꼴': '진행자'},
  '목소리': f'{폴더}/음성/범수',
  '길이': '28.4초(판 모두 같은 영상)',
  '0초 훅': '벗어서 손에 쥔 컷 · 국수 먹으며 다시 쓴 컷 나란히 + 「벗은 모자를, 또 썼다」',
  '끝줄': '모자는 이제, 나갈 때만 씁니다.',
  '최종본': [f'{폴더}/최종.mp4'],
  '판': [
    공통('yuhobuilds-instagram', '01-yuhobuilds-instagram'),
    공통('yuhobuilds-youtube', '02-yuhobuilds-youtube'),
    공통('yuhobuilds-x', '04-yuhobuilds-x'),
    공통('yuho-linkedin-primary', '05-yuho-linkedin'),
    {'계정': 'yuhobuilds-threads', '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/06-yuhobuilds-threads/원고.txt', 'AI표시': True},
    {'계정': 'shift-tistory', '파일': f'{폴더}/게시/티스토리.md', '시각': '2026-11-13T21:30+09:00', '게시글': f'{폴더}/게시/티스토리.md'},
  ],
  '빠진판': {'yuhobuilds-tiktok': '쉼 — 11-01 유호님 「쉬게 해」(계정 전체 조회 0, sns-계정.json dailyBlocked)'},
  '틱톡없음': None,
  '표지': f'{폴더}/게시/표지_1080x1920.jpg',
  'AI 표시': '켬(진행자 얼굴 · 목소리 · 컷 그림이 AI — 진행자 형식 S42)',
  '아동용': '아님', '유튜브 언어': 'ko', '미룰편': [],
  '프롬프트': {'id': 'state-change-line', '주소': 'https://synk.im/prompts/#state-change-line', '본문': 'docs/마케팅/맞춤도구/prompts/프롬프트.json'},
  '남은위험': 옛.get('남은위험', []),
}
for k in ('검사', '맹검판단', '맹검못함', '음악꺼짐판단', '화면캡처'):
    if k in 옛: j[k] = 옛[k]
if '--등록' in sys.argv or 옛.get('작업실등록'): j['작업실등록'] = True
f.parent.mkdir(parents=True, exist_ok=True)
f.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('준비.json', j['상태'], '작업실등록' in j)
