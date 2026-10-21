# Steam 생활형 게임 조사 원자료 (2026-10-21)

[싱크타운 — Steam 생활형 게임 전수 조사와 기능별 조사](../../싱크타운_Steam전수와_기능조사_20261021.md)의 표와 스크립트다. 수집은 2026-10-21 20:50~21:56 KST에 했다.

| 파일 | 내용 |
|---|---|
| `steam-life-universe-20261021.csv` | 태그 전수의 본 목록 3,847행(생활형 누적 리뷰 500개 이상 + 언어·교육 100개 이상) 가운데 성인 표시 524행을 뺀 3,323행. 상점 소개문 열도 뺐다. `cum_*`은 전체 경로 누적 리뷰, `metric_*`은 순위에 쓴 값(근사면 상점 표시값), `recent_*`은 최근 30일, `segments`는 분야 판정 |
| `tag-census-report.md` | 태그 전수 보고서 전체(태그 선택 이유·검색 매개변수·전체 순위 40·분야별 표·10-08 비교·실패 목록) |
| `tag-census-stats.json` | 범위 숫자(질의·쪽·고유 게임·걸러 낸 수) |
| `mechanics-games.csv` | 기능별 조사 76개 게임의 누적·최근 30일·리뷰 표본(영어·한국어) 지표 |
| `mechanics-terms.csv` | 게임·표본별 기능 낱말 언급 수와 그 리뷰의 추천률 |
| `mechanics-groups.csv` | 낱말 묶음(비었다·AI·반복 등)별 언급 수와 추천률 |
| `mechanics-questions.txt` | 조사 문서 §4 본문의 문장 속 숫자 — `scripts-mechanics/questions.json`의 하위 질의 67개를 원문 리뷰에 돌린 결과(질의 이름·표본 수·언급 수·추천률만, 리뷰 본문 없음) |
| `scripts-tags/` | 태그 전수 수집·계산 스크립트(`crawl_search.py`·`fetchers.py`·`build_universe.py`·`segments.py`·`make_tables_md.py` 등) |
| `scripts-mechanics/` | 기능별 리뷰 수집·집계 스크립트(`fetch_steam.py`·`analyze.py`·`mech_stats.py`·`aggregate.py`, 대상 목록 `games.json`, 기능 낱말 `mech.json`) |

리뷰 원문과 상점 페이지 원본은 넣지 않았다. **스크립트를 이 폴더에서 바로 돌리지 않는다.** `scripts-tags/`는 스크립트 폴더의 한 단계 위에 `raw/`를 만들어 내려받으므로(`common.py`의 `BASE`), 저장소 밖 새 빈 폴더에 `scripts-tags/`를 복사해 그 안에서 돌린다(지난 수집의 원자료는 약 3억 바이트였다). `scripts-mechanics/`는 대상 목록·원자료·결과 폴더를 인자로 받는다(`python -I -X utf8 analyze.py games.json <원자료 폴더> <결과 폴더>`). Steam 상점은 몰아 부르면 요청 과다(429)를 주니 호출 간격을 두고, 수집 함정은 [현장 노트 · 브라우저·게시](../../../현장노트/브라우저_게시.md)의 Steam 항목을 먼저 본다.
