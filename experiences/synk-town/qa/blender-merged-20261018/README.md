# 싱크타운 합친 판 — 아르곤 모델링 + Claude 굽기 (2026-10-18)

**10-19 master·공개:** 유호님 「고치고나서 마스터에 합치고 배포하고 종료해줘」로 동네 전체 판(`townwide-merged`)이 WORLD 안 Town의 기본이 됐다 — master `1292f670e`, synk.im `523d7fa`(`world/town/` 29개). `?district=v20`이면 이전 마을, 불러오기 실패·시간 초과(가운데 120초·바깥 고리 180초)면 저절로 v20. 공개 빌드는 이 판과 Basis 해독기만 싣고, Git 밖 GLB는 원본 창고 `town-합친판3-20261019`에서 export에 넣는다(도구 `experiences/synk-town/qa/blender-merged-20261018/publish-town.cjs`). 로컬 미리보기는 지금처럼 `?district=`가 있을 때만 구운 판.

10-18 가운데 동네 비교([blender-town-20261018](../blender-town-20261018/README.md))에서 유호님이 「아르곤이랑 클로드판 둘 다 괜찮네」, 합친 방식 제안에 「웅 합친 방향으로 해보자. 좋아」라고 하셔서(부모 세션 경유), 형상은 아르곤이 남긴 스크립트로, 굽기·후처리는 Claude 판 길로 만든 판이다. 공개 배포 없음, master에 합치지 않음. 단계별 기록은 [진행.md](진행.md).

- Town에서 보기(로컬 미리보기 서버 `node experiences/synk-town/server.mjs --preview`): `/day.html?play=walk&district=town-merged`(가운데 동네), `…=townwide-merged`(바깥 고리까지 — 이웃집 8채·큰길·뒷길·둘레길). GLB는 Git 밖(아래 「Git 밖 원본」).
- 비교 페이지: 이 폴더의 `extra.json` + `../blender-town-20261018/assemble.cjs`·`build-page.cjs`.

## 만드는 길

1. 참고 형상: `../blender-town-20261018/export-town.cjs <dir>`(가운데만) / `… --outer`(바깥 고리까지 — `neighbours`, `ring` 부품). v20이 카메라 앞에서 흐리게 지우는 뿌리(길가 의자·화분·나무)는 `faded`로 떼어 굽기 차폐물에 넣지 않는다.
2. 형상(아르곤 스크립트, 새 대화 없음): `blender/merged_build.py`가 아르곤의 `build_all_*_meshes()`를 한 장면에서 부른다 — 집·공방·온실·바닥은 `../blender-town-20261018/argon/scripts/`(10-18), 찻집은 `../blender-district-20261017/argon/geo_builder.py`(10-17), 바깥 고리는 `--ring <폴더>`의 `neighbours_geo.py`·`ring_geo.py`(10-18 아르곤 2차, 사본은 이 폴더 `argon-ring/` — 요청문·실행 기록·보고서 포함, 실행기 `argon-ring.cjs`). 부품마다 재질 묶음을 새로 만들어 이름에 `<부품>:`을 붙인다(아르곤 재질 함수가 같은 이름 재질을 다시 써서 덮어쓰기 때문). 짓는 단계에서 덧댄 것: 돌마당 테두리 돌 4 mm 올림(흰 점선), 바깥 고리가 있으면 안쪽 바닥의 잔디·흙·자갈을 가운데 사각형에서 자름, 이웃집은 집마다 나눔.
3. 굽기·내보내기: `../blender-town-20261018/blender/town_bake.py --variant merged|wide`(Claude 판과 같은 빛·두 번 굽기·해 몫 알파). 이웃집은 여백 2 px(`--group-margin`), 길은 lightmap pack(`--group-method`). 멈추면 `--resume 1`로 끝난 지도는 건너뛴다. 이웃집(10-18 밤): 굽기 전 면 청소(`blender/clean_faces.py` — 안쪽을 향한 면 뒤집기, 묻힌 면·바닥에 닿은 밑면 지우기, 면마다 여러 점으로 판정), 텍셀보다 얇은 섬 넓히기(`--min-island neighbours_wall=2.5`), 이웃집 지도 2장 2048표본(`--group-samples`). 굽기 여백은 모든 지도에서 0이다 — Blender가 물체마다 여백을 늘려 같은 지도의 다른 물체 섬을 덮어썼다(`blender/margin_overwrite_check.py`, `results/margin-overwrite.json`). 이미 구운 `bake.blend`의 한 부품을 다시 할 때는 그 부품 지도마다 `bake.json` 항목이나 PNG를 지우고(둘 다 있어야 끝난 지도로 본다) `--resume 1 --refresh <부품> --clean <부품>` — 지도가 하나라도 끝난 부품이면 둘 다 건너뛰고 기록에 남긴다.
4. 묶기: `../blender-town-20261018/build-set.mjs`(KTX2 ETC1S PC 2048·휴대폰 1024, meshopt `--level=high`, 잔디 지도 배율 `--gain=ground-soft:0.997,1.022,0.97`). 동네 전체 판은 `--name=townwide-merged --size-neighbours=2048,1024 --size-ring=1024,512 --uastc=neighbours_wall`(이웃집 벽 지도만 UASTC — ETC1S가 회벽에 회녹색 얼룩을 냈다), 바깥 두 부품은 목록에 `defer`가 붙어 가운데가 뜬 뒤 받는다(`day-district.mjs`).

실행 묶음은 `.tmp/town-merged-20261018/run-merged.sh`·`run-wide.sh`(단계마다 기록, 끝난 단계는 건너뜀).

## 결과 (MB = 10⁶ 바이트, 이 PC 헤드리스 Edge)

| | 합친 판 `town-merged` | 동네 전체 판 `townwide-merged` |
|---|---|---|
| 부품 · 지도 | 5 · 12장 | 7 · 16장 |
| 구운 삼각형 · 메시 | 220,465 · 16 | 294,662 · 42 |
| 첫 진입 추가 내려받기 PC · 390폭(한도 12 · 6) | +11.77 · +5.53 | +10.67 · +5.33 (바깥 고리 6.04 · 2.69는 첫 화면 뒤, PC 0.51초 · 390폭 0.12초에 붙음 — 10-19 0시 가운데 집들을 다시 구운 판) |
| 늘어난 GPU 텍스처 PC · 390폭(한도 96 · 32) | 67.1 · 16.8 | 81.1 · 20.3 |
| 그리기 호출 PC 따라가기(v20 1,340) | 931 | 917 |

- 의자 그림자: 가까이 보기에서 v20처럼 의자와 함께 사라진다(Claude 판 의자 다리 톱니도 없음).
- 돌마당 가장자리: 이어진 밝은 테두리(아르곤 판 흰 점선 없음).
- 바닥 판 테두리 잔디: 서쪽 네 지점 평균 v20 대비 R +0.2%·G −0.1%·B −1.6%(Claude 판 G −4.5%).
- 바깥 고리 아르곤 2차(모델링만): 이웃집 21.2분(입력 36만·출력 10만·생각 4만 토큰) → 57,356삼각형, 바닥 고리 39.5분(입력 39만·출력 12만·생각 6만) → 24,256삼각형, 고리 덮기 빈틈 0(`blender/ring_cover_check.py`, 결과 `results/ring-cover-check.json` — 0.25 m 격자 16,184점). 구독 몫(추가 결제 없음).
- 이웃집 가까이 흠(10-18 밤 고침, 전후 그림 `.tmp/town-blender-20261018/nb-close-compare.png` → 비교 페이지 「이웃집 가까이」): 벽 아래 검은 띠(안쪽을 향한 면·묻힌 면 → 면 청소), 황갈색 문 판자(다른 집 나무 문 섬의 굽기 여백이 덮어씀 → 여백 0), 덧문 가로대 검은 줄(0.7 px 섬이 안 구워짐 → 섬 넓히기), 회벽 회녹색 얼룩(ETC1S → 벽 지도 UASTC). 그 사이 첫 면 청소가 앞 벽 하나와 박공 하나를 통째로 지웠던 것도 여러 점 판정으로 고쳤다. 대가: 이웃집 벽 밀도 미터당 34.7 → 30.6텍셀, 이웃집 GLB PC 2.87 → 5.28 · 휴대폰 1.52 → 2.19 MB(첫 화면 뒤 몫, `results/build-set-townwide-merged.json`). 첫 진입 추가가 +11.72 · +5.51에서 +11.73 · +5.53이 된 0.02 MB는 첫 화면 GLB가 바이트까지 그대로라 다시 잰 요청 합계의 차이다(출처는 따로 쫓지 않았다). 이웃집 삼각형 57,356 → 50,663.
- 가운데 집들 지도(같은 여백 덮어쓰기 0.9~5.3%, 1024로 줄여 잰 값)도 10-19 0시에 여백 0으로 다시 구웠다(유호님 「가운데 집들 다시 굽고」, 14장 23:49~00:28, 다른 세션 ComfyUI와 GPU를 나눠 씀). 같은 시점 캡처에서 바뀐 것은 조각 가장자리 몇 픽셀이고(움직인 픽셀 대부분은 캐릭터 동작), 새로 생긴 흠은 찾지 못했다. 동네 전체 판 묶음 PC 16.85 → 15.81 · 휴대폰 7.33 → 7.14 MB.

fps는 이웃집·가운데 집들을 고친 뒤 다섯 판(v20·Claude·아르곤·합친 판·동네 전체 판)을 겹치지 않게 다시 잰 `../blender-town-20261018/results/perf-town5b-igpu-dpr2.json`(10-19 00:50~01:27, 5회전, 200칸 실패 0, 블렌더·agy 없이 혼자, PC CPU 1분 평균 중앙값 16%). PC 따라가기 중앙값(회전 사이 최저–최고) v20 43.8(39–45) · Claude 41.8(35–45) · 아르곤 38.6(34–43) · 합친 판 37.2(36–44) · 동네 전체 판 41.0(40–44). 390폭은 다섯 판 모두 60 상한. 구운 판들이 PC에서 v20보다 2~7 fps 낮게 나오지만 흔들림이 판 사이 차이만큼 커서 구운 판끼리 순위는 매기지 않는다. 앞선 측정(`perf-town5-igpu-dpr2.json`, 10-18 18:02~18:55)은 다른 세션 작업으로 CPU 중앙값 72%라 흔들렸다.

비교 페이지(비공개): https://claude.ai/artifact/5okyuxXCSYcKDLzCK9xJpE (unmet25 계정, 10-18 밤 이웃집 고침과 Fable 검수 반영). 세션이 잠시 unmet27 계정으로 이어졌을 때 올린 사본 https://claude.ai/artifact/WCc8iRdqot3Wiei9mMnTor 은 검수 전 글이다 — 아티팩트는 올린 계정에서만 열린다.

## 휴대폰 확인(같은 와이파이)

`node experiences/synk-town/qa/blender-merged-20261018/phone-preview.mjs`가 PC 와이파이 주소(10-18 `192.168.0.14:4389`)에 QA 중계를 띄운다. 주소는 `http://<IP>:4389/day.html?play=walk`(v20), `…&district=town-merged`, `…&district=townwide-merged`. 중계는 제품 파일을 바꾸지 않고 보내는 응답만 고친다(같은 /24만 받음, `crypto.randomUUID` 대체, `day-app.mjs` 복사본에 주소 추가, CSP 넓힘). 화면 위 두 줄(`phone-hud.js`, 터치는 통과)이 fps·첫 화면 시간·구운 판 받기 시간·GPU 텍스처·JS 메모리(안드로이드 크롬만)를 보여 주고, 5초마다 `.tmp/town-merged-20261018/phone-reports.jsonl`로 보낸다. 이 PC는 `node.exe` 들어오는 연결이 공용 네트워크에서 이미 허용돼 있어 방화벽 작업은 없었다. PC에서 휴대폰 크기로 세 주소를 열어 확인하는 것은 `phone-check.cjs`.

CSP: Town 서버의 옛 CSP로는 구운 판이 뜨지 않았다(KTX2 해독기의 WebAssembly·문자열 실행, blob 주소가 막혀 v20으로 돌아감). 그때까지의 QA는 `bypassCSP`로 열어 몰랐다. 10-18 밤 유호님 결정으로 `server.mjs` CSP에 그 출처들을 허용했고(결정 표), QA 하네스도 CSP를 켠 채로 연다. `csp-check.cjs`로 CSP를 켠 채 불러오기 성공을 확인했다. 공개 WORLD 빌드에는 구운 판·해독기가 아직 빠져 있다.

## Git 밖 원본

GLB·.blend·캡처는 Git에 넣지 않는다. 10-18 19:00 올리고 다시 읽어 대조했다(70개, 그중 37개는 앞 묶음과 같은 내용이라 재사용, 어긋남 0). 원본 창고 77yuhbs `SYNK_원본창고/town-합친판-20261018/<경로>`(목록·SHA-256 영수증은 `~/Documents/SYNK_원본창고/상태/town-합친판-20261018/목록.json`). 이웃집 가까이 흠을 고친 뒤의 묶음 GLB는 `town-합친판2-20261018`(10-18 22:23, 63개 중 3개 새로·60개는 같은 내용 재사용, verify 어긋남 0) . 가운데 집들을 다시 구운 뒤의 묶음 GLB는 `town-합친판3-20261019`(10-19 00:45, 63개 중 13개 새로·50개 재사용, verify 어긋남 0) — Town에 넣을 `townwide-merged` GLB는 이쪽이 정본이다.
