# 아르곤 요청문 · 싱크타운 바깥 고리 — 이번 실행: neighbours

> 이 글을 그대로 아르곤(agy `gemini-4-argon-high`)에 준다. 작업 폴더는 지금 폴더다.

너는 10-17·10-18에 이 PC의 Blender 5.2.2로 웹 게임 「싱크타운」의 가운데 동네(집·찻집·공방·온실과 바닥 한 판)를 다시 모델링했다. 그 스크립트(`scripts/home_geo.py`, `scripts/ground_geo.py`, `scripts/mat_builder.py`, `prev/scripts/geo_builder.py`)가 지금 동네의 형상을 만든다. 이번에는 같은 동네의 **바깥 고리**를 같은 솜씨로 모델링한다. 이번 일은 **형상과 재질 노드까지만**이다. 빛 굽기·GLB 내보내기·압축은 다른 파이프라인(Claude 쪽)이 너의 스크립트를 불러서 한다.

## 규칙 (먼저 읽기)

- 모든 파일은 이 폴더 안에만 만든다. **이 폴더 밖의 파일은 읽지도 않는다.** git 명령은 쓰지 않는다. 인터넷에서 자산을 내려받지 않는다.
- 문맥을 아낀다: 큰 파일을 통째로 읽지 말고 필요한 줄 범위만 본다. 같은 파일을 여러 번 다시 읽지 않는다.
- 다른 실행이 같은 폴더를 함께 쓴다. 네 파일 이름은 `scripts/neighbours_*.py`, `work/neighbours_*`, `out/*-neighbours*`로만 만든다. `scripts/mat_builder.py`·`scripts/home_geo.py`·`scripts/ground_geo.py`·`prev/scripts/geo_builder.py`는 고치지 말고 가져다 쓴다.
- 블렌더: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`(PATH에 없음), `-b -P scripts/<스크립트>.py`. 스크립트가 예외로 죽어도 종료코드는 0 — 결과 파일과 로그의 `Traceback`을 확인한다.
- 좌표: 블렌더 (x, y, z) = Town (x, −z, y). 단위 미터. 모든 정점은 월드 위치(물체에 이동·회전·부모 없이).

## 너의 스크립트가 지킬 약속 (불러 쓰는 쪽과의 계약)

1. `scripts/neighbours_geo.py`에 `build_all_neighbours_meshes(mats)`를 둔다. `mats`는 `mat_builder.build_procedural_materials()`가 돌려준 dict다. 반환값은 `{'neighbours_<부위>': 블렌더 물체}` dict. 유리는 `neighbours_glass` 한 물체로.
2. 같은 파일에 `ATLAS_GROUPS = {'neighbours_<부위>': '<묶음>'}`를 둔다. 묶음은 **두 개**까지(굽기 지도 두 장에 나눠 담는다). 유리는 빼고 적는다.
3. 새 재질이 필요하면 함수 안에서 이름을 `neighbours_`로 시작하게 만들고 `mats`에 더한다. 굽기용이므로 Principled BSDF의 Metallic은 0. 정점 색·절차적 노드는 마음껏 쓴다.
4. 결정론적: 난수는 고정 씨앗(예: `geo_builder.make_rng`), 시각·환경에 따라 결과가 바뀌지 않는다. 빈 장면에서 60초 안에 끝난다. 참고 형상을 가져왔다면 다 쓴 뒤 지워 장면에 남기지 않는다.
5. 파일을 읽을 때는 모듈 전역 `ROOT`(이 폴더) 기준 `reference/`만 쓴다(부르는 쪽이 `ROOT`를 바꾼다).

## 자료

- `reference/` — 지금 게임(v20) 형상, 제자리(재질 이름 = `<재질>_<색hex>_…`): `v20_neighbours.glb`(이웃집 8채의 벽·나무·지붕·유리), `v20_ring_ground.glb`(바깥 고리 땅 — 잔디, 큰길·뒷길 자갈, 둘레길 포장, 이웃집 기초돌·마당 길), `v20_town_ground.glb`(안쪽 동네 바닥 — 이음 높이 확인용), `v20_live.glb`(풀·꽃·덤불·먼 들판 — 미리보기 배경), `map_*.png`(v20 색 지도).
- `ref-code/day-environment.mjs`(v20 코드, 줄 범위만), `ref-code/town-layout.mjs`(이웃집·길 좌표 정본).
- `sky/azure-sky-v3.jpg`, `screens/v20-1280x900-*.png`(지금 게임 화면).

## 검증 (굽기 없이)

- `scripts/neighbours_preview.py`: 빈 장면에서 `build_all_neighbours_meshes`를 부르고, `reference/v20_live.glb`·`reference/v20_town_ground.glb`를 배경으로 넣고, 해(색 #fff3de, 세기 3.15, 블렌더 방향 (−9, −7, 11)에서 비춤)와 하늘(`sky/azure-sky-v3.jpg` × 0.45)로 Cycles 64샘플, 1280×900, Standard 보기 변환으로 렌더해 `out/preview-neighbours-<시점>.png`로 낸다.
- `out/report-neighbours.json`: 물체별 삼각형 수, ATLAS_GROUPS, 짓는 데 걸린 초, v20 대비 바꾼 점, 지키지 못한 점.

## 이번 실행: 이웃집 8채 (`neighbours`)

1. `ref-code/town-layout.mjs`의 `houses` 8채(위치 x·z, 너비·깊이·높이, yaw, style 0/1/2, paint, yardFrontMargin, groundParts)와 `ref-code/day-environment.mjs` 1150–1265줄(neighbourHeight, neighbourRoofGeometry, neighbourGable, neighbourHouse)을 본다. 집의 원점 높이는 Town y = 0.075(rootY 0.20 + localY −0.125), 회전은 Town y축 yaw.
2. 같은 위치·치수·색으로 다시 모델링한다: 벽(paint 색), 세 가지 지붕 모양과 박공·용마루·처마, 문, 앞창(틀·유리·덧창), 옆창, style 0의 현관 지붕·기둥·마루 판재·계단·굴뚝, style 1의 높은 창, style 2의 곁채(pantry) 지붕과 판재 울타리, 마당 울타리(앞 두 토막 사이 대문 틈, 양옆 — style 1은 나무 살, 나머지는 회벽에 돌 갓), 돌 기초, 앞 디딤 포장과 마당 자갈길. 벽·지붕 크기와 울타리 위치는 충돌 판정과 맞물리니 그대로 둔다. 더 잘 만들 것: 모서리 다듬기, 판재 이음, 기와 줄, 회벽 결.
3. 바깥 고리 땅(잔디·큰길·뒷길·둘레길)은 다른 실행이 만든다. 너는 집과 그 마당(기초·포장·자갈·울타리)까지만.
4. 삼각형 합계 64,000 이하(한 채 8,000 안팎). 묶음 둘: 벽·울타리·기초·마당 쪽 하나, 지붕·용마루·처마·굴뚝 쪽 하나.
5. 미리보기 시점:
   - ring-wide: 블렌더 위치 (0, −10, 14), 바라보는 점 (0, 12, 0), 세로 시야각 50°
   - neighbour-left: 블렌더 위치 (−10, 11, 2.2), 바라보는 점 (−10, 16, 1.0), 세로 시야각 42°
   - neighbour-right: 블렌더 위치 (6, 11.5, 2.2), 바라보는 점 (5.4, 16.6, 1.0), 세로 시야각 42°

마지막 답에 만든 파일 목록, report 요약, 미리보기에서 스스로 본 아쉬운 점을 한국어로 짧게 적는다. 막히면 어디서 왜 막혔는지 적고 멈춘다.
