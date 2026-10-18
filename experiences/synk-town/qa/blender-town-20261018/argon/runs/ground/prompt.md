# 아르곤 요청문 · 싱크타운 가운데 동네 — 이번 실행: ground

> 이 글을 그대로 아르곤(agy `gemini-4-argon-high`)에 준다. 작업 폴더는 `argon/`이다.

너는 10-17에 이 PC의 Blender 5.2.2로 웹 게임 「싱크타운」의 찻집 한 채를 다시 만들고 빛을 구워 GLB로 냈다(`prev/`). 지금은 가운데 동네(집·공방·온실 세 채 + 네 채를 잇는 바닥 한 판)를 같은 방식으로 만드는 중이고, **이번 실행에서는 아래 하나만** 한다. 다른 부품은 다른 실행이 맡는다. 목표는 지금 게임 판(v20, three.js 코드로 쌓은 상자)과 같은 디자인을 지키면서 훨씬 좋아 보이게 만드는 것이다.

## 규칙 (먼저 읽기)

- 모든 파일은 이 폴더 안에만 만든다. **이 폴더 밖의 파일은 읽지도 않는다.** git 명령은 쓰지 않는다. 인터넷에서 자산을 내려받지 않는다.
- 문맥을 아낀다: 큰 파일을 통째로 읽지 말고 필요한 줄 범위만 본다. 같은 파일을 여러 번 다시 읽지 않는다. 지난 실행이 문맥이 커져 멈췄다.
- 스크립트 이름은 `scripts/ground_*.py`, 중간 .blend는 `work/ground_*.blend`로 붙인다(다른 실행이 같은 폴더를 함께 쓴다). `prev/scripts/`·`scripts/mat_builder.py`의 함수는 가져다 써도 된다(필요한 함수만 찾아 읽기).
- 블렌더: `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`(PATH에 없음), `-b <파일.blend> -P scripts/<스크립트>.py`. 스크립트가 예외로 죽어도 종료코드는 0 — 마지막에 결과 파일이 생겼는지 확인하고 로그에서 `Traceback`을 찾는다.
- Cycles는 GPU(OptiX)로 굽는다. 같은 GPU를 다른 실행이 동시에 쓸 수 있다.
- `자산규격.md`(규격)가 이 글보다 우선이다. 규격의 `<판>`은 `argon`.

## 자료

- `자산규격.md` — 좌표(블렌더 (x, y, z) = Town (x, −z, y)), 빛, 재질 약속(`bake_*`, baseColor = 구운 확산 복사휘도 × 0.5 sRGB, `synk_bake_scale = 2.0`, 알파 = 해 몫이면 `synk_sun_alpha = 1`, 유리는 `live_glass`), 예산(부품마다 2048² 지도 3장 이내, 삼각형 60,000 이하 — 바닥은 80,000, 메시 24개 이하).
- `reference/` — 지금 게임 형상(제자리, 재질 이름 = `<재질>_<색hex>_…`): `v20_home.glb`·`v20_workshop.glb`·`v20_greenhouse.glb`·`v20_cafe.glb`·`v20_town_ground.glb`, 굽지 않는 나머지 마을 `v20_live.glb`(풀·나무·의자 — 차폐물로만).
- `ref-code/day-environment.mjs` — v20 코드(치수·색의 원본). 줄 범위만 본다.
- `prev/` — 10-17 찻집 작업(scripts, cafe-argon.blend, cafe-argon.glb). 해 몫 알파 최솟값을 2/255로 묶은 방식은 그대로 쓴다.
- `sky/azure-sky-v3.jpg`, `screens/v20-1280x900-*.png`(지금 게임 화면).

## 이번 실행: 바닥 한 판 `town-ground`

1. `reference/v20_town_ground.glb`를 가져와 살펴본다: 돌마당(곡선 테두리, 줄눈 곡선 띠), 찻집→온실 자갈길과 디딤돌, 둘레 산책길, 앞 자갈띠, 꽃밭 흙띠, 잔디 땅. 코드는 `ref-code/day-environment.mjs` 794–880(땅 높이·색·돌마당·띠), 1007–1025(groundRibbon), `ref-code/town-layout.mjs`(길).
2. 규격 2절 사각형(Town x −13.6~13.6, z −12.2~8.7)을 빈틈없이 덮는 바닥을 새로 만든다. 높이와 정점 색은 참고 형상을 따르고, 테두리에서 v20 바닥과 이어진다. 돌마당 판석 줄눈은 10-17 찻집 때처럼 살린다. 풀잎·꽃·나무는 만들지 않는다(게임이 실시간으로 그린다). 건물 마루 밑은 만들지 않아도 된다.
3. 굽기: 차폐물로 이번에 만든 건물 `out/town-argon-home.glb`·`out/town-argon-workshop.glb`·`out/town-argon-greenhouse.glb`(없으면 `reference/v20_<부품>.glb`), 찻집 `prev/cafe-argon.glb`(그 안의 `cafe_ground` 메시는 빼고), `reference/v20_live.glb`를 함께 넣는다. 지도 3장 이내 2048² — 길·돌마당에 텍셀을 몰아주고 잔디는 성기게. 샘플 512 이상.
4. 내보내기: `out/town-argon-ground.glb`(메시 이름 `ground_<부위>`)와 원본 PNG `out/town-argon-ground-<지도>.png`.
5. 검증 미리보기 `out/preview-ground-<시점>.png`(건물 GLB와 v20_live도 함께):
   - core: 블렌더 위치 (0, −12.4, 8.2), 바라보는 점 (0, 2.6, 0.2), 세로 시야각 42°
   - follow: 블렌더 위치 (−0.066, −16.186, 12.359), 바라보는 점 (−0.066, −1.186, 1.559), 세로 시야각 44°
6. `out/report-ground.json`.

마지막 답에 만든 파일 목록과 report 요약, 아쉬운 점을 한국어로 짧게 적는다.
