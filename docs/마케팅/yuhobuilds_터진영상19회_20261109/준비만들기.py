# yuhobuilds 11-10 Y33 게시/준비.json — 판 · 슬롯 · 표지를 한 곳에서. 검사 칸은 tools/올리기전검사.js가 채운다(다시 돌려도 지키도록 있으면 그대로 둔다).
# 사용: python -I -X utf8 docs/마케팅/yuhobuilds_터진영상19회_20261109/준비만들기.py [--등록] [--상태 "…"]
import json, sys
from pathlib import Path

D = Path(__file__).resolve().parent
폴더 = 'docs/마케팅/yuhobuilds_터진영상19회_20261109'
f = D / '게시' / '준비.json'
옛 = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
오 = json.loads((D / '오마주.json').read_text(encoding='utf-8'))['원본']
상태 = sys.argv[sys.argv.index('--상태') + 1] if '--상태' in sys.argv else 옛.get('상태', '제작 중')
시각 = '2026-11-10T21:00+09:00'
공통 = lambda 계정, 원고: {'계정': 계정, '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/게시글.md', '훅': 'A', '원고': f'{폴더}/게시/{원고}/원고.json', '표지': f'{폴더}/게시/표지_1080x1920.jpg', '표지시각': 1.5, 'AI표시': True}
j = {
  '브랜드': 'yuhobuilds', '날짜': '2026-11-09', '슬롯': '2026-11-10', '성격': '상시', '역할': '권위', '시한': None, '상태': 상태,
  '제목': 'AI가 찾아 준 「터진 영상」 22편, 재 보니 2편 — 조회 칸은 전부 「확인 못 함」, 따라 만들기 전 3단계',
  '기획': f'{폴더}/기획.md',
  '시험': {'이름': '판정편 11-03', '갈래': '판정편'},
  '원본': {'주소': 오['주소'], '갈래': '같은분야', '조회': 오.get('조회'), '배수': 13.2, '올린날': 오.get('올린날'), '오마주': f'{폴더}/오마주.json'},
  '목소리': f'{폴더}/음성/범수',
  '길이': '40초(판 모두 같은 영상)',
  '0초 훅': '맨 위 「AI가 찾아 준 요즘 터진 영상」 아래 큰 숫자가 1 → 22편으로 오르고 목록이 한 줄씩 올라간다 → 3.7초 「진짜 터진 건 2편」',
  '끝줄': '다시 재 달라고 할 땐, 이 한 줄을 꼭 붙이세요.',
  '최종본': [f'{폴더}/최종.mp4'],
  '판': [
    공통('yuhobuilds-instagram', '01-yuhobuilds-instagram'),
    공통('yuhobuilds-youtube', '02-yuhobuilds-youtube'),
    공통('yuhobuilds-x', '04-yuhobuilds-x'),
    공통('yuho-linkedin-primary', '05-yuho-linkedin'),
    {'계정': 'yuhobuilds-threads', '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/06-yuhobuilds-threads/원고.txt', 'AI표시': True},
    {'계정': 'shift-tistory', '파일': f'{폴더}/게시/티스토리.md', '시각': '2026-11-10T21:30+09:00', '게시글': f'{폴더}/게시/티스토리.md'},
  ],
  '빠진판': {'yuhobuilds-tiktok': '쉼 — 11-01 유호님 「쉬게 해」(계정 전체 조회 0, sns-계정.json dailyBlocked)'},
  '틱톡없음': None,
  '표지': f'{폴더}/게시/표지_1080x1920.jpg',
  'AI 표시': '켬(진행자 얼굴 · 목소리가 AI — 진행자 형식 S42)',
  '아동용': '아님', '유튜브 언어': 'ko', '미룰편': [],
  '프롬프트': {'id': 'recheck-ai-video-picks', '주소': 'https://synk.im/prompts/#recheck-ai-video-picks', '본문': 'docs/마케팅/맞춤도구/prompts/프롬프트.json'},
  '화면캡처': {'까닭': '그날 AI가 낸 실제 보고서 화면 한 컷 그대로 — 우리가 얹은 글이 아니다(제목 · 본문 글자 그대로, 진짜임을 보이는 칸)', '구간': [[5.0, 6.0], [29.2, 31.1]]},
  '남은위험': [
    '이해 시험(v26 다시) 재미 3 · 3 · 3 · 3 — 19회 반전은 좋고 가운데 목록 구간이 건조하다는 답이 넷. 같이 짚은 다섯 자리는 v27~v29에서 고쳤고 다시 시험하지 않았다(기획.md 「큰 목록으로 다시 짬」).',
    '「같아 보임」 둘(h · G) — 검은 바탕 머리 글과 진행자 컷(장부 「화면 결」 고정 요소). 올리기 전 검사 ⑯ 무대 · 끝 줄은 지난 두 편과 갈린다.',
    '진행자 얼굴 줄은 새 진행컷 없이 받아 둔 승인 얼굴 컷의 입이 실제로 한 말에 맞췄다(Flow 0크레딧).',
    '확인할 것 판단(v29): 슬롯이 오늘 — 11-09 유호님 말씀으로 새 방향이 11-10부터라 밤 회차 · 07:20 회차가 이어 만들었다. 5초 보고서 캡처의 왼쪽 가장자리 · 짧은 밝은 글자 · 흰 글자는 실제 보고서 화면 그대로(우리가 얹은 글이 아님).',
  ],
}
for k in ('검사', '맹검판단', '음악꺼짐판단'):
    if k in 옛: j[k] = 옛[k]
if '--등록' in sys.argv or 옛.get('작업실등록'): j['작업실등록'] = True
f.parent.mkdir(parents=True, exist_ok=True)
f.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('준비.json', j['상태'], '작업실등록' in j)
