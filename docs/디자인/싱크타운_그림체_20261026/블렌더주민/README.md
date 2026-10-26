# 블렌더 판 펠트 생물 주민 (2026-10-26)

유호님 「블렌더를 사용해서 주민을 아까 그 사진처럼 만들어볼래? 아르곤으로 블렌더작업해서말이야」 · 「다 만들어지면 지금이랑 전후차이좀 보여줘」 → 운영 원칙의 블렌더 칸대로 **아르곤이 모델링 스크립트를 쓰고, Claude가 블렌더 실행 · 굽기 · 압축 · 게임 얹기**를 했다.

## 어떻게 돌렸나

- 아르곤에게 블렌더를 직접 돌리게 하는 실행(`--dangerously-skip-permissions`)은 Claude Code 안전 장치가 「Create Unsafe Agents」로 막았다(현장 노트 AI_CLI의 그 절 그대로). 우회하지 않고, 아르곤은 **그림 읽기만 되는 sandbox 묻기**(`ask-argon.cjs`, `tools/lib/제미나이구독호출.js`의 `agy받기`)로 스크립트 전문을 답하고, Claude가 그 스크립트를 Blender 5.2.2로 돌려 미리보기를 다음 회차에 붙여 돌려줬다.
- 작업 폴더(`.tmp/townstyle-20261026/argon-residents/`, git 밖)에 `reference/`(시안 A · B 주민 확대, 연구원 · 몽글 정본 펠트, 낮 무대 사진, 지금 코드 판 앞뒤), `scripts/`(회차별 스크립트), `out/`(미리보기 · GLB), `review/`(시안 대조판).
- 회차: [1회차](요청문_1회차.md) 찐빵은 거의 시안, 콩은 뾰족, 찹쌀떡은 납작, 털은 검은 토막 · [2회차](요청문_2회차.md) 모양은 나아졌지만 결이 사라져 점토 · [3회차](요청문_3회차.md) 비율 · 자세가 시안에 가까워짐(채택, [build_residents.py](build_residents.py)) · [4회차](요청문_4회차.md) 요청 밖으로 크게 다시 써서(찐빵 주름 · 색 · 콩 색이 바뀌고 목수건 · 오류) 버림.
- Claude가 고친 것: 1회차 `bmesh.ops.subdivide_edges(use_smooth=True)` → 5.2의 `smooth=1.0`(2회차부터 아르곤이 반영). 3회차는 고친 곳 없이 돌았다.
- 두 번 틀린 쪽은 Claude가 준 규격이었다: ① 코드 판 치수를 줘서 찐빵 · 찹쌀떡이 시안보다 납작했다(3회차에서 시안 비율로) ② 펠트 털 치수를 실제 10 cm 인형 기준(0.5~1 mm)으로 줘서, 0.6~1.3 m 모델에서는 1픽셀보다 작아 결이 사라졌다.

## 굽기 · 게임 얹기 (Claude)

- [claude_bake_export.py](claude_bake_export.py): 높은 판(`<id>_<부위>_high`) → 낮은 판 UV `bake` 한 장에 색 · 법선 · 그늘을 1024²로 굽고(OptiX, 주민당 11~13초), 그늘을 색에 섞어 주민마다 GLB 하나(약 400 KB, 삼각형 1만~1만 2천). 눈은 유광 구슬 재질 그대로.
- 게임에서는([blender-residents.mjs](../시제품주민/blender-residents.mjs)) 블렌더 판의 모양 · 색 · 굽힌 그늘을 쓰고, 겉은 코드 판의 엉킨 양모 결(같은 옷감 도구의 `wool`)로 바꾸고, 코드 판의 펠트 마감(`feltFinish` — 얼룩 · 발 쪽 어둠 · 움직이는 그물마다 붙는 보풀, 보풀 색은 텍스처에서 읽음)을 입힌다. 블렌더 높은 판의 결은 끝내 굽기에 살아나지 않아서다.
- 움직임은 코드 판과 같은 손잡이(걷기 뒤뚱 · 팔 · 깜빡임 · 숨쉬기)로 GLB의 `<id>_arm_*` · `_eye_*` · `_foot_*` 마디를 돌린다.
- 아티팩트는 `.glb`를 내주지 않아 GLB를 base64로 담은 `residents-glb/<id>.json`으로 싣는다(`시제품주민/build.mjs`의 둘째 인자).

## 다시 만들기

```
blender.exe -b -P build_residents.py -- --previews        # 작업 폴더에서: work/residents.blend · out/preview_*.png
blender.exe -b work/residents.blend -P claude_bake_export.py -- out/glb 1024 64
node docs/디자인/싱크타운_그림체_20261026/시제품주민/build.mjs <나올 폴더> <작업 폴더>/out/glb
```

GLB는 git에 넣지 않는다(`*.glb`가 빠진다) — 위 두 줄로 다시 만든다.
