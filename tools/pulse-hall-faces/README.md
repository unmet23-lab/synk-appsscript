# synk.im/pulse 첫 화면 — 글이 쇼릴 얼굴을 덮는지 재는 도구

쇼릴 규칙은 「첫 화면 글이 얼굴을 덮지 않는 프레임만」이다(결정 11-09). 이 도구는 첫 화면의 글(머리글 · 제목 · 오른쪽 칸)이 쇼릴의 진짜 얼굴(눈 · 입 · 턱)에 닿는 프레임이 있는지 모든 프레임에서 잰다. 2026-11-17에 공용 작업본 `.tmp`의 일회 스크립트(11-10)를 모아 여기로 옮겼다.

**언제 쓰나.** 쇼릴을 바꾸거나 다시 잘랐을 때, 첫 화면에 줄을 더하거나 글을 바꿨을 때, `pulse-v12.css`의 첫 화면 배치(①-2 · ①-3)를 고쳤을 때. CSS의 얼굴 자리 값(`--pv-z*`, `--pv-face`)은 이 도구로 읽은 값이다(SYNK-website `site-v10/README.md` 「PULSE 첫 화면 가로 배치 하나」).

## 기준

- **얼굴:** 쇼릴 모든 프레임의 YuNet 얼굴 상자에 턱 여유(아래로 상자 높이의 6%)를 더한 것. 화면에서 폭 12px 미만이면 세지 않는다. 쇼릴 상자 밖과 첫 화면 밖은 잘라 낸다.
- **진짜 얼굴만:** YuNet은 팔 · 기계 · 뒤통수도 얼굴로 잡는다. 프레임마다 잡힌 상자를 자국(track)으로 묶고, 자국마다 가운데 프레임을 잘라 보고 눈 · 입 · 턱이 보이는 것만 `data/real-faces-<판>.json`에 적는다.
- **글:** 글자 잉크. 쇼릴 · 그늘 · 글 그림자를 끈 검은 바탕에서 글 칸 상자 안의 밝은 화소(밝기 > 60)다. 단추는 바탕까지 잉크로 센다. 글 칸은 머리글 · 제목 · 소개 줄 · 작품 줄 · 단추 · 값 안내 · 번호 줄을 하나씩 잰다. 오른쪽 칸 상자(`.pv-side`)는 `display:contents`가 걸리면 크기가 0이라 쓰지 않는다. 보이는데 크기가 0인 칸이 있으면 경고를 낸다. 작품 줄은 작품 넷의 이름을 차례로 넣어 따로 찍고, 그 작품 컷의 프레임하고만 견준다. 찍는 동안 쇼릴을 멈춰 둔다. 줄 상자(`Range.getClientRects`)는 글자 위아래 여백까지 들어가 실제보다 크게 걸린다.
- **판:** 화면 비율이 4:5 이하면 세로 판(`tall`), 아니면 가로 판(`wide`)이다. 영상 `src` · `poster`가 그 판인지도 함께 본다(돌린 뒤 다시 고르기 확인).

## 차례

1. 얼굴 상자: `python -X utf8 tools/pulse-hall-faces/faces.py <쇼릴.mp4> tools/pulse-hall-faces/data/faces-wide-<판>.json`(세로 판도 같게). YuNet 모델은 `~/.rembg/models/yunet/face_detection_yunet_2023mar.onnx`다.
2. 자국 묶기와 고르기: `python -X utf8 tools/pulse-hall-faces/tracks.py data/faces-wide-<판>.json <쇼릴.mp4> data/tracks-wide-<판>.json 그림표.png` → 그림표를 보고 `data/real-faces-<판>.json`을 쓴다.
3. 글 잉크 찍기: `node tools/pulse-hall-faces/ink.cjs https://synk.im <out 폴더> <desktop|mobile> tools/pulse-hall-faces/data/sizes-wide.txt`. 후보 CSS는 `CSS=<경로>`로 끼운다. 한 쪽을 열고 목록의 크기로 차례로 바꾸므로, `sizes-rot.txt`(가로 → 세로 짝)는 그대로 돌리기 시험이다. 넓은 화면은 `desktop`, 폭 900 아래와 돌리기는 `mobile`로 찍는다.
4. 겹침 세기: `python -X utf8 tools/pulse-hall-faces/inkhit.py <out 폴더>`. 줄마다 크기 · 쪽 · 판과, 닿은 자국 번호[닿은 글: l 머리글 · t 제목 · d 소개 줄 · n 작품 줄 · c 단추 · p 값 안내 · i 번호 줄]와 초 · 깊이를 낸다. 맨 아래가 합계와 판 엇갈림이다. 자국을 모두 넣어 세려면 번호 목록 둘을 직접 준다.
5. 나머지 조건: `node tools/pulse-hall-faces/sweep.cjs https://synk.im out.json <desktop|mobile> <크기 목록>` → `python -X utf8 tools/pulse-hall-faces/checks.py out.json [라이브 out.json]`(단추 첫 화면 안 · 글끼리 겹침 · 가로 넘침 · 제목 세 줄 · 제목 크기 전후).
6. 눈으로 보기: `node tools/pulse-hall-faces/shot.cjs https://synk.im shots <desktop|mobile> <ko|en> 1920x1080 2.25 4.9` → `python -X utf8 tools/pulse-hall-faces/overlay.py shots ko-1920x1080.json 그림.png`(진짜 얼굴 초록, 헛잡이 주황).
7. 글자 대비: `node tools/pulse-hall-faces/contrast.cjs https://synk.im pulse/ 1920x1080 out.json desktop 0.5 2.3 4.9 …` → `python -X utf8 tools/pulse-hall-faces/contrast.py out.json`(글을 숨긴 쇼릴 + 그늘에서 글 상자 밑 배경의 아래 10% 대비, 글 그림자는 셈하지 않는다).
8. 엔진 견주기: `node tools/pulse-hall-faces/engines.cjs <후보 CSS>` — 크롬과 WebKit이 같은 제목 크기 · 단추 자리를 내는지(11-17에 18크기 모두 같았다).

## 크기 목록(`data/`)

- `sizes-wide.txt`: 폭 901~3840 × 높이 600~1600 격자 532크기와 폭 900 넘는 세로 7크기.
- `sizes-short-wide.txt`: 폭 901~3840 × 높이 320~899 격자 309크기. 낮고 넓은 창과, 폭 1540 이상에서 오른쪽 칸 · 단추를 미는 구간을 잰다. 높이 500 아래에서는 오른쪽 칸이 풀린다. 경계 높이 499 · 500 · 599 · 600과 경계 폭 1540 · 1999 · 2000을 넣었다.
- `sizes-mid.txt`: 폭 540~900 × 높이 320~1100 격자 276크기(가로로 든 휴대폰 · 태블릿, 펼친 접는 폰, 정사각형에 가까운 창).
- `sizes-rot.txt`: 휴대폰 · 태블릿 27기기의 가로 → 세로 짝 54크기.

## 11-17에 잰 값(쇼릴 c판)

- 처음에는 오른쪽 칸을 상자 하나로 쟀다. 높이 500 아래에서 그 상자가 풀려 크기 0이 되자 단추와 값 안내를 세지 못했다(11-17 검수 F3). 그래서 글 칸을 하나씩 재도록 고쳤고, 작품 줄도 작품마다 재게 했다(F4). 아래는 고친 도구로 다시 잰 값이다.
- 라이브(그때 공개본)는 넓은 화면 1,078 가운데 272, 낮고 넓은 창 618 가운데 479, 폭 540~900 552 가운데 113, 돌리기 108 가운데 26에서 글 잉크가 진짜 얼굴에 닿았다.
- 고친 판(SYNK-website `claude/pulse-hero-wide-chin-20261117`)은 네 묶음 모두 0이다. 판 엇갈림은 둘 다 0이다.
