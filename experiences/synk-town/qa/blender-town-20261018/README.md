# 가운데 동네 블렌더 굽기 비교 (2026-10-18)

10-17 찻집 한 구역 비교([blender-district-20261017](../blender-district-20261017/README.md))를 싱크타운 가운데 동네로 넓혔다. 집·찻집·공방·온실과 네 채를 잇는 바닥 한 판(x −13.6~13.6, z −12.2~8.7)을 Claude 판(bpy 스크립트)과 아르곤 판(agy `gemini-4-argon-high`)으로 같은 규격에서 만들어 Town에 끼우고 v20과 비교했다. 유호님 「둘 다 진행해서 결과 비교해보자」(부모 세션 경유). 공개 배포 안 함, master에 합치지 않음, 어느 판으로 갈지는 유호님이 정한다.

- 규격: [자산규격.md](자산규격.md)(v2, 7절 텍스처 예산) · 아르곤에 준 글: [아르곤_요청문.md](아르곤_요청문.md) · 단계별 기록: [진행.md](진행.md)
- Town에서 보기: 로컬 미리보기 서버(`node experiences/synk-town/server.mjs --preview`)에서 `/day.html?play=walk&district=town-claude` 또는 `…=town-argon`. 묶음 GLB는 Git에 없으니 먼저 아래 「Git 밖 원본」에서 받는다. 없거나 실패하면 v20 그대로 뜬다.
- 비교 페이지: 이 폴더의 `page/`(만드는 법 `assemble.cjs` → `build-page.cjs`). 캡처는 Git에 넣지 않는다.

## 결과

비교 페이지(비공개): https://claude.ai/artifact/Uq225atUmbsaY2EfNZfujQ (unmet23 계정 · 10-18 가운데 동네 판). 부모 세션이 갱신을 부탁한 주소 7iYRuVwQfkUr8VXohWYF63(10-17 첫 판)와 아침에 올린 UqkR2PPFnK2Rn8SShTUJfB(77yuhbs, 찻집 fps 다시 잰 판)는 이 세션 계정에서 열리지 않아 고치지 못했다(아티팩트는 올린 계정에만 묶인다). 같은 시점 PNG 14쌍(PC 1280×900·390×844 × 가운데 위·따라가기·동네 전체·네 채 가까이), 겹쳐 보기, 수치·fps 표, 압축 비교, 판별 장단점 표.

| 항목 | v20 | Claude 판 | 아르곤 판 |
|---|---|---|---|
| 첫 진입 내려받기 PC · 390폭(캐시 없음) | 4.62 · 4.35 MB | 15.17 · 9.32 MB | 16.17 · 10.39 MB |
| 구운 묶음 PC · 휴대폰(GLB 5개) | — | 9.71 · 4.16 MB | 10.70 · 5.22 MB |
| 늘어난 GPU 텍스처 PC · 390폭(지도 수) | 0 | 69.3 · 17.3 MB(13장) | 74.7 · 18.7 MB(14장) |
| 구운 묶음 삼각형 · 메시 | — | 158,926 · 17 | 220,465 · 44 |
| 그리기 호출 · 삼각형(PC 따라가기, 그림자·AO 포함) | 1,340 · 1,871,888 | 933 · 1,914,718 | 1,014 · 2,099,633 |
| 그리기 호출(390폭 따라가기) | 748 | 514 | 565 |
| 정지 fps PC 따라가기(7회전 중앙값, 범위) | 35.6 (30–45) | 39.1 (31–43) | 39.8 (30–43) |
| 정지 fps PC 가운데 위 · 찻집 가까이 · 집 가까이 | 37.4 · 39.5 · 40.4 | 39.5 · 40.0 · 42.3 | 37.4 · 39.7 · 42.1 |
| 정지 fps 390폭(네 시점) | 60 상한 | 60 상한 | 60 상한 |

- 규격 한도(PC 추가 12 MB·GPU 96 MB, 휴대폰 추가 6 MB·GPU 32 MB) 안: Claude 판은 모두 안, 아르곤 판은 휴대폰 추가 내려받기가 6.04 MB로 조금 넘는다.
- fps는 세 판 모두 회전 사이 흔들림 안이라 「비슷하다」까지만 말할 수 있다. 측정(`results/perf-town-igpu-dpr2.json`)은 블렌더·agy·다른 측정 없이 혼자 돌렸고(13:41~14:12), 다른 세션의 내려받기·백업 업로드 때문에 PC 전체 CPU가 1분 평균 11~99%로 출렁였다(`.tmp/…/perf-cpu.log`). 세 판을 회전마다 순서를 돌려 쟀다. 이 PC 인텔 내장 GPU(0x7D67)의 헤드리스 Edge, 기기 배율 2.
- 화면: 아르곤 판이 세 채를 새로 모델링하고 네모 판석·테두리 돌·짙은 기와 골을 넣어 결이 더 또렷하다. Claude 판은 v20 형상 그대로에 빛·그늘·불규칙 판석 줄눈을 더해 차이가 작다. 흠은 Claude 판 공방 가까이 의자 다리 그림자 가장자리의 검은 톱니, 아르곤 판 돌마당 아래 가장자리의 흰 점선.
- 구역 경계: 바닥을 한 판으로 구워 10-17의 x ±3 이음(돌마당·잔디 결 차이)은 없어졌다. 바닥 판 바깥 테두리(x ±13.6) 안쪽 잔디는 v20보다 초록 약 4.5% 어둡다(같은 시점 sRGB G 155.8 대 163.2, 아르곤은 파랑도 −8.6) — 확대하면 옅은 선이 보이고, 맞추지 않았다.
- 두 판 공통 문제: v20은 카메라 앞에 온 길가 의자를 흐리게 지우는데, 구운 바닥에는 그 의자 그림자가 남는다(집·공방 가까이). 의자·화분을 굽기 차폐물에서 빼고 실시간 그림자에 맡기면 되지만 고치지 않았다.

아직 확인하지 못한 것: 실물 휴대폰(메모리·KTX2 풀기·fps), 걷는 중 fps, GPU 메모리 실측(지금 값은 풀린 텍스처 크기 계산), 휴대폰 망 첫 진입 시간, 아르곤 바닥은 꽃밭 정점 색 고치기 전 참고 형상으로 만든 점, 찻집 건물은 두 판 모두 10-17 판 재사용, 바깥 고리(이웃집 8채·뒷길·둘레길)는 범위 밖.

## 각 판

| | Claude 판 | 아르곤 판 |
|---|---|---|
| 만든 방법 | `blender/town_bake.py` — v20 형상을 부품마다 내보내(`export-town.cjs`) 블렌더에 제자리로 들이고, 재질 키별 절차적 결을 얹어 한 장면에서 Cycles 1024샘플로 굽는다 | 아르곤이 부품마다 새 대화에서 bpy 스크립트를 직접 쓰고 고쳤다(`argon/scripts/`, 실행 기록 `argon/runs/`, 보고서 `argon/reports/`) |
| 한 번 돌리기 | 짓기 7초 · 굽기 6.7분(RTX 5090 OptiX) · 내보내기 12초 + 묶기 약 10분 | 집 27.5분 · 공방 26.8분 · 온실 23.8분(동시) · 바닥 33.9분 → 벽시계 약 61분 + 묶기 약 6분. 입력 187만·출력 43만·생각 18만 토큰(구독 몫) |
| 처음 만드는 데 든 품 | 11:20~13:45, Town에서 보며 아래 9가지를 고치고 전체를 세 번 다시 구웠다 | 첫 시도(한 대화에 전부)는 문맥 15만 토큰에서 agy 5분 유휴 제한에 걸려 56분 만에 멈췄다(`.tmp/…/argon/run1-stuck/`). 부품별 새 대화로 다시 돌렸다 |
| 고치기 | 스크립트를 고쳐 그 부품만 다시 굽는다(바닥 1분 미만 + 묶기). 같은 입력이면 같은 결과 | 부품을 새 대화로 다시 맡기면 24~34분, 결과가 달라질 수 있다. 남긴 스크립트를 직접 고쳐 돌릴 수는 있다 |

두 판은 같은 후처리를 거친다: `build-set.mjs`가 부품마다 `compress-glb.mjs`로 KTX2 ETC1S(PC 2048·휴대폰 1024)·meshopt 묶음을 만들고 `assets/district/town-<판>.json` 목록을 쓴다. 텍스처 예산을 정한 찻집 압축 비교는 [진행.md](진행.md) ②와 페이지 「텍스처 예산」.

## Town에 끼우는 방식

`day-district.mjs`가 `?district=town-<판>`일 때 목록(`assets/district/town-<판>.json`)을 읽고 네 채와 바닥을 한꺼번에 바꾼다. 네 채의 v20 메시를 첫 프레임 전에 숨기고(151개), 바닥 사각형 안의 v20 땅 삼각형을 CPU에서 한 번 잘라낸다(바닥 메시 15개, `townGround` 표시가 붙은 재질만). 캔버스 폭 600 px 아래면 휴대폰 묶음을 받는다. KTX2Loader·meshopt 디코더는 이 주소값일 때만 받는다(`rendering/`에 three 0.180.0 원본을 그대로 두었다, 출처 `rendering/provenance.json`). 한 부품이라도 실패하면 v20으로 되돌린다.

## 만들면서 고친 것(Claude 판)

자세한 증상·원인·고침은 [현장 노트 블렌더_3D](../../../../docs/현장노트/블렌더_3D.md).

1. 참고 형상이 인덱스 없는 삼각형이라 펼치면 섬이 삼각형마다 쪼개져 지도가 2~9%만 찼다 → 용접 뒤 45~70%.
2. 숨은 면 검사가 중심점 하나만 봐서 잔디에 톱니 구멍 → 여러 점 + 넓은 덮개(마루·돌마당)만.
3. 참고 형상을 삼각형 중심으로 잘라 테두리에 구멍 → 걸치는 삼각형을 모두 내보내고 블렌더에서 자름(구멍 0/8,964, `holes.mjs`).
4. 「아래 향한 면 뒤집기」 규칙이 디딤돌 아래 면을 뒤집어 검게 구워짐 → 규칙 제거.
5. 온실 유리 재질 이름이 `live_glass.001`이 되어 흰 판으로 → 이름 고정, 온실은 얇은 유리.
6. 겹친 바닥 띠의 아래쪽이 검게 구워져 길 가장자리에 점 → 바닥 굽기 때 바닥끼리 안 가림.
7. 섬 여백 번짐이 옆 섬을 덮어 어두운 이음 → 여백 6 px, `ADJACENT_FACES`.
8. 재질이 안 쓰는 정점 색이 실려 꽃밭에 누런 쐐기 → `vertexColors`가 켜진 재질만 싣는다.
9. 테두리에 걸친 땅 삼각형이 차폐물(live) 쪽에도 남아 서쪽 잔디에 밝고 어두운 쐐기 → 굽기 전에 코어 안 평평한 live 땅 면을 뺀다(`drop_live_ground_in_core`, 1,848면).

1024로 줄일 때의 두 함정(sharp가 알파를 곱해 줄임, Lanczos 알파 출렁임)은 `compress-glb.mjs`에서 고쳤다.

## Git 밖 원본

10-17 Git 보관 규칙([docs/_ops/github-storage](../../../../docs/_ops/github-storage/README.md))대로 GLB·.blend·QA 캡처는 Git 이력에 넣지 않았다. 아래 파일과 아르곤 원본 지도·미리보기, 찻집 압축 시험 GLB(합쳐 42개 107 MB)는 원본 창고 77yuhbs Drive `SYNK_원본창고/town-블렌더동네-20261018/<아래 경로>`에 올린다(저장소 밖 도구 `~/Documents/SYNK_원본창고/창고.py plan|files|verify town-블렌더동네-20261018`, 경로마다 크기·md5·SHA-256 영수증은 `상태/town-블렌더동네-20261018/목록.json`). 받을 때는 77yuhbs로 같은 경로에 내려받고 SHA-256을 맞춰 본다.

| 경로 | 바이트 | SHA-256 |
|---|---:|---|
| `experiences/synk-town/assets/district/town-argon-cafe-phone.glb` | 989,720 | `4773abdffad4dfef9ca25db42a8b550db46828ca4faeb8857b3d99ae02e487cc` |
| `experiences/synk-town/assets/district/town-argon-cafe.glb` | 1,962,540 | `61d83aba6a7676b8434e5bc8b446af67d82cc893ae8ad9404466f5e9c4f173af` |
| `experiences/synk-town/assets/district/town-argon-greenhouse-phone.glb` | 1,042,836 | `14545bde806e04b020c0f6a871a49fc6ff9098de76e8fa0d3cbab134192cd4a7` |
| `experiences/synk-town/assets/district/town-argon-greenhouse.glb` | 2,284,404 | `6e6c95c5953352da78702d0dce91644d7bf60960a7eca81750a8943da3ab474e` |
| `experiences/synk-town/assets/district/town-argon-ground-phone.glb` | 1,018,872 | `9ced1b65c096d23937339db97876bf268e78a9f2ebd28602a7306177e2d5b170` |
| `experiences/synk-town/assets/district/town-argon-ground.glb` | 2,108,604 | `19639a105cf374a66e4d5aa29fc15bfae7578784fbaddde29367cfd4d7d89f61` |
| `experiences/synk-town/assets/district/town-argon-home-phone.glb` | 1,215,252 | `20434faa09a16f55d3abd26b7dcc2a830915f899f62e6bd2187357d2c38e689a` |
| `experiences/synk-town/assets/district/town-argon-home.glb` | 2,398,824 | `a7784fa489cca74f3586945e215cd259496b340289283abc76665e015c9a926d` |
| `experiences/synk-town/assets/district/town-argon-workshop-phone.glb` | 1,211,824 | `cdfef7dbb9728f79a6ad4c4f010b37ef6fe7fccb50aeb196571f66a88d5db9f8` |
| `experiences/synk-town/assets/district/town-argon-workshop.glb` | 2,464,672 | `cbef55a29875e048bf56fc09944f0e915b86521a57eb29f3bc4f04a24e475d94` |
| `experiences/synk-town/assets/district/town-argon.json` | 892 | `0a114645bcc459dd5e98c457c7bc864a1976cf1339f4779dcfdcb2c9612c2719` |
| `experiences/synk-town/assets/district/town-claude-cafe-phone.glb` | 1,006,504 | `a64dadf3d13fdc5df609ad807da5006f98383069bc39f286c08acd419e937b7e` |
| `experiences/synk-town/assets/district/town-claude-cafe.glb` | 2,344,912 | `a53608c52f1d22d480450f959f129d4f5e901dc749a38f274536e7214de7b68d` |
| `experiences/synk-town/assets/district/town-claude-greenhouse-phone.glb` | 587,384 | `eb9d82d0fdeb4da67b4324486d1ebfd6ed91f4de9cc6ce3daab096b1457d5106` |
| `experiences/synk-town/assets/district/town-claude-greenhouse.glb` | 1,570,440 | `46d4f16196c58a93c97542465f5f68339b772d3e409c218e573336551e571ffe` |
| `experiences/synk-town/assets/district/town-claude-ground-phone.glb` | 601,756 | `258a816fe31652a0b9b1181d8664a3eb54ff0c097e7cb72a336f6e79f29219d2` |
| `experiences/synk-town/assets/district/town-claude-ground.glb` | 1,456,628 | `57195f896137c697e3a2a98f294e27116037db7fde55f1ece11ad6bd87dec22b` |
| `experiences/synk-town/assets/district/town-claude-home-phone.glb` | 1,111,204 | `6bf15aeb56c9e48c6d2e8a37214bcdf9a42cdffb04ce1d471aed5224d40c1018` |
| `experiences/synk-town/assets/district/town-claude-home.glb` | 2,446,948 | `122be23add272b2f730a1079e57f9e65a5f9451d24f5fed67d53419f7f377811` |
| `experiences/synk-town/assets/district/town-claude-workshop-phone.glb` | 1,053,032 | `9cdc0ff66fba4c6b6252b6376958cc954b01130397571db0343188493fb50de8` |
| `experiences/synk-town/assets/district/town-claude-workshop.glb` | 2,361,468 | `77c2e911fda72c07e446bf3425cfe7e2986d5dcd82f72228d5b3dbcd009bf1a3` |
| `experiences/synk-town/assets/district/town-claude.json` | 903 | `6ea9238bc26a2a91c29ea4c50a76906e205663ae5c05de2cf1821c074e64debe` |
| `.tmp/town-blender-20261018/argon/out/town-argon-greenhouse.glb` | 2,879,860 | `1352a0c81f95b1a64f71b8a54c8dcea010bbdd0ea4aa9a70e3331cb7def849f3` |
| `.tmp/town-blender-20261018/argon/out/town-argon-ground.glb` | 4,658,852 | `7dec69488210db826900f6b8b0ceed71b5e59141318690c5f16e30903bcdc23c` |
| `.tmp/town-blender-20261018/argon/out/town-argon-home.glb` | 3,159,544 | `d71dac1a8526b9638cc0575acefc59039226c6de58e1f299a5cc2ec4779c6a81` |
| `.tmp/town-blender-20261018/argon/out/town-argon-workshop.glb` | 3,386,776 | `9eaf6f843c467a94f379a83dfdef56c993f68594bd878cfc1a8bb1ed616892cd` |
| `.tmp/town-blender-20261018/argon/work/greenhouse_baked.blend` | 10,412,147 | `b010fac044c9d407f24d076b07bd235db31105f527fc100ce678221c14655a66` |
| `.tmp/town-blender-20261018/argon/work/ground_baked.blend` | 11,647,282 | `fda6a51be30072ed4b060c66703ae5612568434197626c44cb9e3827d85eadb0` |
| `.tmp/town-blender-20261018/argon/work/home_baked.blend` | 10,348,883 | `8f7c7dcabf7657b687e40e96e18693bc116a0fe78d12b53adaafbc9b9ac7def3` |
| `.tmp/town-blender-20261018/argon/work/workshop_argon.blend` | 11,338,535 | `94d335c300f15f8baaa7df3848d8a7b426b6759d83a68e8974dd3be7b0546616` |

Claude 판 원본 지도·`.blend`·v20 참고 GLB는 아래 「다시 만들기」로 20분 안에 다시 나와 창고에 넣지 않았다. 아르곤 판은 `argon/scripts/`로 다시 돌릴 수 있지만 같은 결과가 나오는지는 확인하지 않았다.

## 다시 만들기

```
node experiences/synk-town/qa/blender-town-20261018/export-town.cjs .tmp/town-blender-20261018/reference
blender -b -P experiences/synk-town/qa/blender-town-20261018/blender/town_bake.py -- --stage build --work <dir> --ref <reference> --sky experiences/synk-world-home/scene-assets/graphics-v2/azure-sky-v3.jpg
blender -b -P …/town_bake.py -- --stage bake --work <dir> [--parts ground]
blender -b -P …/town_bake.py -- --stage export --work <dir> --out <dir>/out [--parts ground]
KTX_TOOLS=<ktx2-encoder·gltf-transform 설치 폴더>/node_modules NODE_PATH=desktop/node_modules node …/build-set.mjs claude <dir>/out <dir> experiences/synk-town/assets/district/cafe-claude.glb <10-17 Claude 지도 폴더> --mode=etc1s --pc=2048 --phone=1024
node …/capture-town.cjs town-claude --district=town-claude --poses=<poses.json> --out=<dir>
node …/perf-town.cjs --variants=v20,town-claude,town-argon --rounds=7 --dpr=2 --poses=<poses.json> --out=<json>
node …/assemble.cjs --captures=<dir> --perf=<json> --extra=experiences/synk-town/qa/blender-town-20261018/extra.json --out=<page-data.json>
node …/build-page.cjs --data=<page-data.json> --out=experiences/synk-town/qa/blender-town-20261018/page
```

Blender는 `C:/Program Files/Blender Foundation/Blender 5.2/blender.exe`(PATH에 없음), 브라우저 측정은 Playwright + 헤드리스 Edge다. 아르곤 실행은 `argon-parts.cjs`(부품마다 새 대화, 폴더 밖 읽기 금지).
