# 찻집 구역 블렌더 비교 (2026-10-17)

싱크타운 v20의 찻집 한 채와 앞마당을 블렌더로 다시 만들고 빛·그림자·접촉 음영을 텍스처에 구워, v20과 같은 카메라·같은 화질 설정으로 비교했다. 유호님이 「둘 다 실험해줘. 이번기회에 테스트해보자」고 해서 이 PC의 Blender로 Claude가 만든 판과, 같은 규격을 Gemini Ultra 계정의 아르곤(agy `gemini-4-argon-high`)에 맡긴 판을 함께 만들었다. 어느 쪽으로 갈지는 유호님이 정한다. 공개 배포는 하지 않았다.

- 규격: [자산규격.md](자산규격.md) · 아르곤에 준 글: [아르곤_요청문.md](아르곤_요청문.md)
- 비교 페이지: 이 폴더의 `page/`를 claude.ai 페이지로 올렸다(주소는 아래 「결과」). 캡처(`page/shots/`, `argon/preview-*.webp`)는 Git에 넣지 않는다 — 페이지에 올라가 있고, `capture.cjs`·`build-page.cjs`로 다시 찍는다.
- Town에서 보기: 로컬 미리보기 서버(`node experiences/synk-town/server.mjs --preview`)에서 `/day.html?play=walk&district=cafe-claude` 또는 `…=cafe-argon`. GLB는 Git에 없으니 먼저 아래 「Git 밖 원본」에서 받는다. 없으면 v20 그대로 뜬다.

## 결과

비교 페이지(비공개): https://claude.ai/artifact/UqkR2PPFnK2Rn8SShTUJfB (77yuhbs 계정 · 10-18 fps 다시 잰 판) — 10-17 첫 판 https://claude.ai/artifact/7iYRuVwQfkUr8VXohWYF63 은 올린 다른 계정에서만 열리고 고칠 수 있어 갱신하지 못했다. 같은 시점 PNG 6쌍(PC 1280×900·390×844 × 따라가기·가까이·동네 전체), 겹쳐 보기 슬라이더, 수치 표. 원본 측정은 `results/`, 페이지 원본은 `page/`.

| 항목 | v20 | Claude 판 | 아르곤 판 |
|---|---|---|---|
| 화면 전체 그리기 호출(PC 따라가기, 그림자·AO 포함) | 1,339 | 1,207 | 1,222 |
| 화면 전체 삼각형(같은 시점) | 1,871,750 | 1,880,463 | 1,902,770 |
| 첫 진입 내려받기(PC, 캐시 없음) | 4.62 MB | 7.66 MB | 7.92 MB |
| 구운 지도 GPU 메모리(추정, 밉맵 포함) | 0 | 약 85 MB | 약 64 MB |

정지 시점 fps는 이 노트북(인텔 내장 GPU 0x7D67·RTX 5090 Laptop)의 헤드리스 Edge에서 쟀다. 외장 GPU에서는 세 판 모두 60fps 상한이고, 390폭은 내장 GPU에서도 1배·고배율 모두 60 상한이다. PC 1280×900은 내장 GPU에서 상한 밑으로 내려온다 — 1배(한 회전) 따라가기 v20 44.8 · Claude 46.3 · 아르곤 41.5, 가까이 49.5 · 46.7 · 60.0, 동네 전체는 셋 다 60. 고배율(기기 배율 2 → Town이 PC 1.5배로 그림, 7회전 중앙값과 회전 사이 범위): 따라가기 v20 36.8(27~41) · Claude 33.0(18~43) · 아르곤 37.7(30~42), 가까이 38.5(29~50) · 34.0(21~42) · 38.5(29~42), 동네 전체 59.1 · 57.7 · 55.9. Claude 판이 중앙값으로 4fps쯤 낮지만 회전 사이 흔들림 안이라, 성능은 「비슷하다」까지만 말할 수 있다. 확실한 차이는 그리기 호출 −117~−132, 내려받기 +2.9~3.2 MB, GPU 메모리 +64~85 MB다.

고배율 값은 10-18에 다른 측정·굽기 없이 한 번에 다시 잰 것이다(`results/perf-igpu-dpr2.json`). 10-17에 처음 낸 값(따라가기 24.7 · 29.5 · 23.9 등)은 측정 두 개를 약 5분 겹쳐 돌려 낮게 나온 것이라 버렸다(`results/perf-igpu-dpr2-overlap.json`, Fable 검수에서 찾음).

화면에서 두 블렌더 판은 지붕 기와 골·판재 이음·접촉 음영이 v20보다 입체적이다. Claude 판은 물결 기와와 판재 결, 아르곤 판은 돌마당 판석 줄눈과 앞쪽 작은 돌까지 살렸다. 두 판 모두 구역 경계(x ±3)에서 돌마당 질감·잔디 결이 조금 달라 보이고, 창 안쪽은 v20보다 밝다(구운 반사광).

아직 확인하지 못한 것: 실물 휴대폰, 걷는 중 fps, GPU 메모리 실측, 다른 구역으로 넓혔을 때의 이음과 용량.

## 각 판

| | v20 | Claude 판 | 아르곤 판 |
|---|---|---|---|
| 만든 방법 | `day-environment.mjs` 코드 생성, 실시간 조명·VSM 그림자·SSAO | `blender/cafe_district.py`(940줄) — v20 치수를 옮겨 bpy로 모델링, Cycles 굽기 | 아르곤이 격리 폴더에서 스스로 스크립트 약 2,900줄을 쓰고 고침(`argon/`) |
| 걸린 시간 | — | 한 번 돌리는 데 약 4분(만들기 20초, 지도 4장 굽기 약 3분, 내보내기) | 1시간 20분, 320단계(입력 83만·출력 26만·생각 12만 토큰, 캐시 읽기 1,893만) |
| 찻집 구역 삼각형 | 40,057 + 바닥 약 1,000 | 43,095 | 50,496 |
| 메시 | 49(인스턴스 23·177개체) | 5 | 10 |
| 파일 | 없음 | 3.03 MB GLB(WebP 2048² × 4) | 3.30 MB GLB(WebP 2048² × 3) |

## Town에 끼우는 방식

`day-district.mjs`가 `?district=` 주소값이 있을 때만 움직인다.

1. v20 찻집 그룹의 메시를 첫 프레임 전에 숨긴다. 보행·충돌·바닥 높이·클릭 대상(숨긴 메시도 광선 판정에 남는다)·찻상 받침·이름표는 v20 것을 그대로 쓴다. 가림(지붕 걷어내기) 부피는 GLB를 붙인 뒤 다시 계산한다.
2. 구역 사각형(x −3~3, z −3.4~5.35) 안의 v20 바닥 삼각형을 CPU에서 한 번 잘라내고, 풀·꽃·돌 인스턴스는 그 자리만 숨긴다(16 ms, 바닥 메시 10개에서 425조각, 인스턴스 22개). 처음에는 바닥 셰이더에 `discard`를 넣었는데, 고배율 내장 GPU에서 약 3.5fps를 잃어(빠른 깊이 검사가 꺼짐) 이 방식으로 바꿨다. A/B 측정은 `results/ab-discard.json`(discard 판 — `current` = discard + GLB, `noClip` = GLB만, `clipOnly` = discard만 넣고 GLB는 숨김), `results/ab-cut.json`(잘라내기 판).
3. GLB 재질은 검정 확산 + 구운 방출(`MeshLambertMaterial`)이다. 텍스처 알파는 구운 빛 중 해의 몫이라, 캐릭터의 실시간 그림자는 해가 든 텍셀만 어둡게 하고 이미 구운 그늘은 두 번 어둡게 하지 않는다. 유리는 v20 유리 재질을 그대로 쓴다.
4. GLTFLoader는 주소값이 있을 때만 받는다(v20은 추가로 받는 것이 없다).

## 만들면서 고친 것

- 로컬 미리보기 서버가 옷장 모듈 `wardrobe-garments-v8.mjs`를 내주지 않아 Town 진입이 멈춰 있었다. 경로를 더했다(기존 문제).
- 아바타 직물 텍스처 9장(`/assets/avatar-textiles-v1/*.png`)은 저장소에 원본이 없어 로컬에서 404다. 세 판 모두 같은 대체 재질로 찍혔다.
- Blender glTF 내보내기의 WebP는 알파 0 텍셀의 RGB를 지키지 않는다. 굽기에서 알파는 해 몫이라 알파 0은 해가 전혀 안 드는 그늘이고, 그 색이 바뀌었다(바닥 지도 알파 0 텍셀 평균 G 8.0 → 28.7, 알파 1~255는 같음). Claude 판은 `blender/glb-repack.cjs`로 원본 PNG에서 WebP(sharp `exact`)를 다시 넣었다(8.1, `blender/alpha-check.cjs`로 확인). 아르곤 판은 해 몫 알파의 최솟값을 2/255로 묶어 이 문제를 미리 피했다(`argon/bake_and_export.py` 309행). 10-17에는 원인을 「곱해진 알파」로 적었는데 10-18 다시 재 보니 알파 0만의 문제였다.
- Claude 판에서 두 겹 천(처마 천·옆 가림막·커튼)의 면 방향이 안쪽을 향해 검게 구워진 것, 숨은 면 규칙이 앞쪽 자갈 어깨띠를 지운 것을 고쳤다.
- 아르곤 보고서의 「OpenImageDenoise」는 Cycles 렌더 설정이라 굽기에는 걸리지 않는다. 실제 노이즈 감소는 아르곤이 직접 짠 numpy 양방향 흐림과 검은 텍셀 메우기다.

## Git 밖 원본

10-17 Git 보관 규칙([docs/_ops/github-storage](../../../../docs/_ops/github-storage/README.md))대로 GLB·QA 캡처는 Git 이력에 넣지 않았다. GLB 두 개와 아르곤의 `.blend`는 원본 창고 77yuhbs Drive `SYNK_원본창고/town-블렌더구역-20261017/<아래 경로>`에 올리고 다시 읽어 대조했다(10-18, 저장소 밖 도구 `~/Documents/SYNK_원본창고/창고.py verify town-블렌더구역-20261017` 어긋남 0). 받을 때는 77yuhbs로 [district 폴더](https://drive.google.com/drive/folders/1uj0eCG8vmEtHxsKMLLUA7VP7s452jchm)에서 같은 경로에 내려받고 SHA-256을 맞춰 본다.

| 경로 | 바이트 | SHA-256 |
|---|---:|---|
| `experiences/synk-town/assets/district/cafe-claude.glb` | 3,030,324 | `987286625edf56399e1f9eabe9466561bf1954cbde0d28ccfe991d1d9d3c18d3` |
| `experiences/synk-town/assets/district/cafe-argon.glb` | 3,303,732 | `397bf6ee30d21d5852b5b1a03e4ec583700df893b12fa17c670fbfa4225b34e3` |
| `.tmp/town-blender-20261017/argon/work/cafe-argon.blend` | 9,772,778 | `3585c1527c044173804870b8e0de0f104791699efa837110b8456c2d7a9c416b` |

Claude 판 `.blend`와 v20 참고 GLB는 아래 「다시 만들기」로 몇 분 안에 다시 나와 창고에 넣지 않았다. 아르곤 판은 `argon/`의 스크립트로 다시 돌릴 수 있지만 같은 결과가 나오는지는 확인하지 않았다.

## 다시 만들기

```
node experiences/synk-town/qa/blender-district-20261017/export-ref.cjs .tmp/town-blender-20261017/reference
blender -b -P experiences/synk-town/qa/blender-district-20261017/blender/cafe_district.py -- --stage build --work <dir> --ref <reference> --sky experiences/synk-world-home/scene-assets/graphics-v2/azure-sky-v3.jpg
blender -b -P …/cafe_district.py -- --stage bake --work <dir> --samples 1024
blender -b -P …/cafe_district.py -- --stage export --work <dir> --out <dir>/cafe-claude-raw.glb
NODE_PATH=desktop/node_modules node …/blender/glb-repack.cjs <dir>/cafe-claude-raw.glb <dir> experiences/synk-town/assets/district/cafe-claude.glb 88
node …/capture.cjs <판> [--district=cafe-claude] --out=<dir> --poses=<poses.json>
node …/perf.cjs --variants=v20,cafe-claude,cafe-argon --rounds=7 --gpu=default --dpr=2 --poses=<poses.json> --out=<json>
```

Blender는 `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`(PATH에 없음)이고, 브라우저 측정은 Playwright + 헤드리스 Edge다.
