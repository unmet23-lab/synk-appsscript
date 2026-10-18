# 싱크타운 합친 판 — 아르곤 모델링 + Claude 굽기 (2026-10-18)

10-18 가운데 동네 비교([blender-town-20261018](../blender-town-20261018/README.md))에서 유호님이 「아르곤이랑 클로드판 둘 다 괜찮네」, 합친 방식 제안에 「웅 합친 방향으로 해보자. 좋아」라고 하셔서(부모 세션 경유), 형상은 아르곤이 남긴 스크립트로, 굽기·후처리는 Claude 판 길로 만든 판이다. 공개 배포 없음, master에 합치지 않음. 단계별 기록은 [진행.md](진행.md).

- Town에서 보기(로컬 미리보기 서버 `node experiences/synk-town/server.mjs --preview`): `/day.html?play=walk&district=town-merged`(가운데 동네), `…=townwide-merged`(바깥 고리까지 — 이웃집 8채·큰길·뒷길·둘레길). GLB는 Git 밖(아래 「Git 밖 원본」).
- 비교 페이지: 이 폴더의 `extra.json` + `../blender-town-20261018/assemble.cjs`·`build-page.cjs`.

## 만드는 길

1. 참고 형상: `../blender-town-20261018/export-town.cjs <dir>`(가운데만) / `… --outer`(바깥 고리까지 — `neighbours`, `ring` 부품). v20이 카메라 앞에서 흐리게 지우는 뿌리(길가 의자·화분·나무)는 `faded`로 떼어 굽기 차폐물에 넣지 않는다.
2. 형상(아르곤 스크립트, 새 대화 없음): `blender/merged_build.py`가 아르곤의 `build_all_*_meshes()`를 한 장면에서 부른다 — 집·공방·온실·바닥은 `../blender-town-20261018/argon/scripts/`(10-18), 찻집은 `../blender-district-20261017/argon/geo_builder.py`(10-17), 바깥 고리는 `--ring <폴더>`의 `neighbours_geo.py`·`ring_geo.py`(10-18 아르곤 2차, 사본은 이 폴더 `argon-ring/` — 요청문·실행 기록·보고서 포함, 실행기 `argon-ring.cjs`). 부품마다 재질 묶음을 새로 만들어 이름에 `<부품>:`을 붙인다(아르곤 재질 함수가 같은 이름 재질을 다시 써서 덮어쓰기 때문). 짓는 단계에서 덧댄 것: 돌마당 테두리 돌 4 mm 올림(흰 점선), 바깥 고리가 있으면 안쪽 바닥의 잔디·흙·자갈을 가운데 사각형에서 자름, 이웃집은 집마다 나눔.
3. 굽기·내보내기: `../blender-town-20261018/blender/town_bake.py --variant merged|wide`(Claude 판과 같은 빛·두 번 굽기·해 몫 알파). 이웃집은 여백 2 px(`--group-margin`), 길은 lightmap pack(`--group-method`). 멈추면 `--resume 1`로 끝난 지도는 건너뛴다. 이웃집(10-18 밤): 굽기 전 면 청소(`blender/clean_faces.py` — 안쪽을 향한 면 뒤집기, 묻힌 면·바닥에 닿은 밑면 지우기, 면마다 여러 점으로 판정), 텍셀보다 얇은 섬 넓히기(`--min-island neighbours_wall=2.5`), 이웃집 지도 2장 2048표본(`--group-samples`). 굽기 여백은 모든 지도에서 0이다 — Blender가 물체마다 여백을 늘려 같은 지도의 다른 물체 섬을 덮어썼다(`blender/margin_overwrite_check.py`, `results/margin-overwrite.json`). 이미 구운 `bake.blend`의 한 부품을 다시 할 때는 그 부품 지도를 모두 지우고 `--refresh <부품> --clean <부품>`.
4. 묶기: `../blender-town-20261018/build-set.mjs`(KTX2 ETC1S PC 2048·휴대폰 1024, meshopt `--level=high`, 잔디 지도 배율 `--gain=ground-soft:0.997,1.022,0.97`). 동네 전체 판은 `--name=townwide-merged --size-neighbours=2048,1024 --size-ring=1024,512 --uastc=neighbours_wall`(이웃집 벽 지도만 UASTC — ETC1S가 회벽에 회녹색 얼룩을 냈다), 바깥 두 부품은 목록에 `defer`가 붙어 가운데가 뜬 뒤 받는다(`day-district.mjs`).

실행 묶음은 `.tmp/town-merged-20261018/run-merged.sh`·`run-wide.sh`(단계마다 기록, 끝난 단계는 건너뜀).

## 결과 (MB = 10⁶ 바이트, 이 PC 헤드리스 Edge)

| | 합친 판 `town-merged` | 동네 전체 판 `townwide-merged` |
|---|---|---|
| 부품 · 지도 | 5 · 12장 | 7 · 16장 |
| 구운 삼각형 · 메시 | 220,465 · 16 | 294,662 · 42 |
| 첫 진입 추가 내려받기 PC · 390폭(한도 12 · 6) | +11.77 · +5.53 | +11.73 · +5.53 (바깥 고리 6.01 · 2.68은 첫 화면 뒤, PC 0.90초 · 390폭 0.45초에 붙음) |
| 늘어난 GPU 텍스처 PC · 390폭(한도 96 · 32) | 67.1 · 16.8 | 81.1 · 20.3 |
| 그리기 호출 PC 따라가기(v20 1,340) | 931 | 917 |

- 의자 그림자: 가까이 보기에서 v20처럼 의자와 함께 사라진다(Claude 판 의자 다리 톱니도 없음).
- 돌마당 가장자리: 이어진 밝은 테두리(아르곤 판 흰 점선 없음).
- 바닥 판 테두리 잔디: 서쪽 네 지점 평균 v20 대비 R +0.2%·G −0.1%·B −1.6%(Claude 판 G −4.5%).
- 바깥 고리 아르곤 2차(모델링만): 이웃집 21.2분(입력 36만·출력 10만·생각 4만 토큰) → 57,356삼각형, 바닥 고리 39.5분(입력 39만·출력 12만·생각 6만) → 24,256삼각형, 고리 덮기 빈틈 0(`blender/ring_cover_check.py`, 결과 `results/ring-cover-check.json` — 0.25 m 격자 16,184점). 구독 몫(추가 결제 없음).
- 이웃집 가까이 흠(10-18 밤 고침, 전후 그림 `.tmp/town-blender-20261018/nb-close-compare.png` → 비교 페이지 「이웃집 가까이」): 벽 아래 검은 띠(안쪽을 향한 면·묻힌 면 → 면 청소), 황갈색 문 판자(다른 집 나무 문 섬의 굽기 여백이 덮어씀 → 여백 0), 덧문 가로대 검은 줄(0.7 px 섬이 안 구워짐 → 섬 넓히기), 회벽 회녹색 얼룩(ETC1S → 벽 지도 UASTC). 그 사이 첫 면 청소가 앞 벽 하나와 박공 하나를 통째로 지웠던 것도 여러 점 판정으로 고쳤다. 대가: 이웃집 벽 밀도 미터당 34.7 → 30.6텍셀, 이웃집 GLB PC 2.88 → 5.28 · 휴대폰 1.44 → 2.19 MB(첫 화면 뒤 몫). 이웃집 삼각형 57,356 → 50,663.
- 가운데 집들 지도에도 같은 여백 덮어쓰기가 칠한 텍셀의 0~5.3%(1024로 줄여 잰 값) 있다. 아직 다시 굽지 않았다.

fps는 다섯 판(v20·Claude·아르곤·합친 판·동네 전체 판)을 겹치지 않게 잰 `../blender-town-20261018/results/perf-town5-igpu-dpr2.json`(7회전). PC 따라가기 중앙값 v20 38.1 · Claude 34.3 · 아르곤 30.8 · 합친 판 36.4 · 동네 전체 판 35.0. 다만 측정 동안 다른 세션의 작업(18:08부터 서버 백업 내려받기, 18:02~18:56 talk 시험)과 초반 윈도우 디펜더 검사로 PC CPU 1분 평균 중앙값이 72%여서 390폭도 60 상한 밑으로 내려오고 흔들림이 커, 판 사이 차이는 가르지 않는다. 동네 전체 판 fps는 이웃집을 고치기 전(301,355삼각형)에 잰 값이다.

비교 페이지(비공개): https://claude.ai/artifact/WCc8iRdqot3Wiei9mMnTor (unmet27 계정, 10-18 밤 이웃집 고침 반영). 앞 판은 https://claude.ai/artifact/5okyuxXCSYcKDLzCK9xJpE (unmet25 계정, 이웃집 고치기 전) — 아티팩트는 올린 계정에서만 열린다.

## Git 밖 원본

GLB·.blend·캡처는 Git에 넣지 않는다. 10-18 19:00 올리고 다시 읽어 대조했다(70개, 그중 37개는 앞 묶음과 같은 내용이라 재사용, 어긋남 0). 원본 창고 77yuhbs `SYNK_원본창고/town-합친판-20261018/<경로>`(목록·SHA-256 영수증은 `~/Documents/SYNK_원본창고/상태/town-합친판-20261018/목록.json`).
