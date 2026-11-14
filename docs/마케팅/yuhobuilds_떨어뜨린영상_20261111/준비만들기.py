# yuhobuilds Y41(11-12 칸 비움 → 11-15 칸) 게시/준비.json — 판 · 슬롯 · 표지를 한 곳에서(Y42 준비만들기.py 본뜸). 검사 칸은 tools/올리기전검사.js가 채운다.
# 사용: python -I -X utf8 docs/마케팅/yuhobuilds_떨어뜨린영상_20261111/준비만들기.py [--등록] [--상태 "…"] [--위험 파일.json]
import json, sys
from pathlib import Path

D = Path(__file__).resolve().parent
폴더 = 'docs/마케팅/yuhobuilds_떨어뜨린영상_20261111'
f = D / '게시' / '준비.json'
옛 = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
오 = json.loads((D / '오마주.json').read_text(encoding='utf-8'))['원본']
상태 = sys.argv[sys.argv.index('--상태') + 1] if '--상태' in sys.argv else 옛.get('상태', '제작 중')
위험 = json.loads(Path(sys.argv[sys.argv.index('--위험') + 1]).read_text(encoding='utf-8')) if '--위험' in sys.argv else 옛.get('남은위험', [])
시각 = '2026-11-15T21:00+09:00'  # 11-12 칸은 비움(미흡) → 11-12 「미학 맹검은 권고」 뒤 w7로 마감해 다음 빈 칸으로
공통 = lambda 계정, 원고: {'계정': 계정, '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/게시글.md', '훅': 'A', '원고': f'{폴더}/게시/{원고}/원고.json', '표지': f'{폴더}/게시/표지_1080x1920.jpg', '표지시각': 4.6, 'AI표시': True}
j = {
  '브랜드': 'yuhobuilds', '날짜': '2026-11-11', '슬롯': '2026-11-15', '성격': '상시', '역할': '권위', '시한': None, '상태': 상태,
  '제목': '내 AI 심사위원이 떨어뜨린 영상이 5만 7천 회 — 합격 12편 중 터진 건 1편, 불합격 30편 중 12편',
  '기획': f'{폴더}/기획.md',
  '시험': {'이름': '관문 시험', '갈래': '11-09~22 synkbrief · yuhobuilds 가벼운 관문(제작 절차 「관문 시험」) + 새 방향 셋째 편 — 72시간 저장 · 공유 · 좋아요를 앞 편들과 견줌'},
  '원본': {'주소': 오['주소'], '갈래': '같은분야', '조회': 오.get('조회'), '올린날': 오.get('올린날'), '오마주': f'{폴더}/오마주.json'},
  '목소리': f'{폴더}/음성/범수',
  '길이': '42.0초(판 모두 같은 영상)',
  '0초 훅': "0프레임부터 실제로 올라간 그 영상의 첫 장면(김이 오르는 화난 인형)이 화면 가득, 위쪽 그늘 위로 종이 쪽지 「불합격 — AI 심사 · 지난 편과 같아 보임」이 크게 「쾅」 찍혀 0.2초에 자리를 잡고(몽골어 제목 말풍선을 덮음), 그 아래 첫마디 자막 「제 AI 심사위원이 / 떨어뜨린 영상」. 카메라가 천천히 다가가며 조금 흔들린다 → 2.55초 같은 영상의 다른 장면 위에서 실제 재생 수가 57,372회까지(아래 작은 줄 「페이스북 · 올린 지 72시간 / 몽골 학생용 한국어 영상 / 이 계정 평소 재생은 223」)",
  '끝줄': ["이 표 만드는 글, 아래에 그대로 있어요.", "틀린 곳은 AI한테, 잘될지는 사람 반응으로", "이 표를 만드는 AI 요청문 — 아래에 그대로"],
  '최종본': [f'{폴더}/최종.mp4'],
  '판': [
    공통('yuhobuilds-instagram', '01-yuhobuilds-instagram'),
    공통('yuhobuilds-youtube', '02-yuhobuilds-youtube'),
    공통('yuhobuilds-x', '04-yuhobuilds-x'),
    공통('yuho-linkedin-primary', '05-yuho-linkedin'),
    {'계정': 'yuhobuilds-threads', '파일': f'{폴더}/최종.mp4', '시각': 시각, '게시글': f'{폴더}/게시/06-yuhobuilds-threads/원고.txt', 'AI표시': True},
  ],
  '빠진판': {'yuhobuilds-tiktok': '쉼 — 11-01 유호님 「쉬게 해」(계정 전체 조회 0, sns-계정.json dailyBlocked)', 'shift-tistory': '티스토리.md는 영상이 나간 뒤 유튜브 주소를 넣어 올린다(장부 머리말 「티스토리 적용기」)'},
  '틱톡없음': None,
  '표지': f'{폴더}/게시/표지_1080x1920.jpg',
  'AI 표시': "켬(목소리가 AI · 화면은 우리가 올린 AI 영상과 표지 — 진행자 컷 없음)",
  '아동용': '아님', '유튜브 언어': 'ko', '미룰편': [],
  '화면캡처': {"까닭": "배경 영상과 표지 칸은 우리가 실제로 올린 영상 · 표지 그대로다(몽골어 화면 글 · 말풍선 · 표지 속 글은 그 영상 · 표지에 든 글 — 우리가 이 편에 얹은 글이 아니다). 14.1~16초 막대 · 37.9초부터 끝 표의 바탕도 흐리게 깐 같은 영상 · 표지다", "구간": [[0, 42]]},
  '남은위험': 위험,
}
for k in ('검사', '맹검판단', '맹검못함', '음악꺼짐판단'):
    if k in 옛: j[k] = 옛[k]
if '--등록' in sys.argv or 옛.get('작업실등록'): j['작업실등록'] = True
f.parent.mkdir(parents=True, exist_ok=True)
f.write_text(json.dumps(j, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('준비.json', j['상태'], '작업실등록' in j)
