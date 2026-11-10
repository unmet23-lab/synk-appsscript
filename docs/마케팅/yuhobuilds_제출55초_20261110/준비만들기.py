# yuhobuilds 11-11 Y42 게시/준비.json — 판 · 슬롯 · 표지를 한 곳에서(Y33 준비만들기.py 본뜸). 검사 칸은 tools/올리기전검사.js가 채운다(다시 돌려도 지키도록 있으면 그대로 둔다).
# 사용: python -I -X utf8 docs/마케팅/yuhobuilds_제출55초_20261110/준비만들기.py [--등록] [--상태 "…"] [--위험 파일.json]
import json, sys
from pathlib import Path

D = Path(__file__).resolve().parent
폴더 = 'docs/마케팅/yuhobuilds_제출55초_20261110'
f = D / '게시' / '준비.json'
옛 = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
오 = json.loads((D / '오마주.json').read_text(encoding='utf-8'))['원본']
상태 = sys.argv[sys.argv.index('--상태') + 1] if '--상태' in sys.argv else 옛.get('상태', '제작 중')
위험 = json.loads(Path(sys.argv[sys.argv.index('--위험') + 1]).read_text(encoding='utf-8')) if '--위험' in sys.argv else 옛.get('남은위험', [])
시각 = '2026-11-11T21:00+09:00'
공통 = lambda 계정, 원고: {'계정': 계정, '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/게시글.md', '훅': 'A', '원고': f'{폴더}/게시/{원고}/원고.json', '표지': f'{폴더}/게시/표지_1080x1920.jpg', '표지시각': 1.0, 'AI표시': True}
j = {
  '브랜드': 'yuhobuilds', '날짜': '2026-11-10', '슬롯': '2026-11-11', '성격': '상시', '역할': '유입', '시한': None, '상태': 상태,
  '제목': '공모전 영상, 55초 늦어서 못 냈다 — AI가 폼을 연 게 마감 13분 전, 낼 수 있는 판은 저녁에 이미 있었다',
  '기획': f'{폴더}/기획.md',
  '시험': {'이름': '관문 시험', '갈래': '11-09~22 synkbrief · yuhobuilds 가벼운 관문(제작 절차 「관문 시험」) + 새 방향 둘째 편(진행자 + 실제 화면) — 72시간 저장 · 공유 · 좋아요를 앞 편들과 견줌'},
  '원본': {'주소': 오['주소'], '갈래': '형식만', '조회': 오.get('조회'), '배수': 34.45, '올린날': 오.get('올린날'), '오마주': f'{폴더}/오마주.json'},
  '목소리': f'{폴더}/음성/범수',
  '길이': '38.2초(판 모두 같은 영상)',
  '0초 훅': '0프레임부터 밤, 입을 가린 진행자 위 큰 글자 「공모전 영상, / 55초 늦어서 못 냈어요」 → 2.15초 같은 폼의 실제 종료 화면 「설문이 종료되었습니다.」로 다가감',
  '끝줄': ['AI 탓 아니에요. 미리 열어 보라고 안 시킨, 제 탓이에요.', '그래서 이제 마감 있는 일은, 미리 이렇게 시켜요.'],
  '최종본': [f'{폴더}/최종.mp4'],
  '판': [
    공통('yuhobuilds-instagram', '01-yuhobuilds-instagram'),
    공통('yuhobuilds-youtube', '02-yuhobuilds-youtube'),
    공통('yuhobuilds-x', '04-yuhobuilds-x'),
    공통('yuho-linkedin-primary', '05-yuho-linkedin'),
    {'계정': 'yuhobuilds-threads', '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/06-yuhobuilds-threads/원고.txt', 'AI표시': True},
    {'계정': 'shift-tistory', '파일': f'{폴더}/게시/티스토리.md', '시각': '2026-11-11T21:30+09:00', '게시글': f'{폴더}/게시/티스토리.md'},
  ],
  '빠진판': {'yuhobuilds-tiktok': '쉼 — 11-01 유호님 「쉬게 해」(계정 전체 조회 0, sns-계정.json dailyBlocked)'},
  '틱톡없음': None,
  '표지': f'{폴더}/게시/표지_1080x1920.jpg',
  'AI 표시': '켬(진행자 얼굴 · 목소리가 AI — 진행자 형식 S42)',
  '아동용': '아님', '유튜브 언어': 'ko', '미룰편': [],
  '프롬프트': {'id': 'deadline-submit-check', '주소': 'https://synk.im/prompts/#deadline-submit-check', '본문': 'docs/마케팅/맞춤도구/prompts/프롬프트.json'},
  '화면캡처': {'까닭': '같은 폼 주소를 2026-11-10에 다시 연 실제 종료 화면 「설문이 종료되었습니다.」(휴대폰 폭 · PC 폭) 그대로 — 우리가 얹은 글이 아니다(진짜임을 보이는 칸). 그날 뜬 문구와 달라 캡션에 「다음 날 같은 폼을 다시 열어 찍은 것」이라 적었다', '구간': [[2.15, 4.33], [21.1, 21.9]]},
  '남은위험': 위험,
}
for k in ('검사', '맹검판단', '맹검못함', '음악꺼짐판단'):
    if k in 옛: j[k] = 옛[k]
if '--등록' in sys.argv or 옛.get('작업실등록'): j['작업실등록'] = True
f.parent.mkdir(parents=True, exist_ok=True)
f.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('준비.json', j['상태'], '작업실등록' in j)
