# 「haha → 하하」 칠판판 원천 (2026-11-03 시험)

[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)(MIT, 받은 판 `bebbbe1`)의 「Chalkboard」 스타일 엔진으로 v7과 같은 목소리 · 같은 초를 다시 그렸다. 엔진은 저장소에 넣지 않고, 우리가 쓴 것과 고친 자리만 둔다.

| 파일 | 무엇 |
|---|---|
| `film.js` | 영상 전체(획 · 시각 · 카메라 · 소리 사건). 엔진의 `js/film.js` 자리 |
| `audio.py` | 소리 섞기 — v7과 같은 목소리 파일 · 배경음(목소리 0.8 : 배경음 0.11×0.8), 연필 대신 분필 녹음 조각 |
| `hz_추가.txt` | `js/hz.js` 끝에 넣은 하 · ! 획 자료(ㅎ 짧은 줄 · 긴 줄 · 12시에서 왼쪽으로 도는 동그라미, ㅏ) |
| `app_고침.diff` · `props_고침.diff` | 합성기에서 쓰지 않는 판 무늬 · 젖은 띠 · 지우개 · 자막 판 끄기, 분필 앞 빛무리 빼기(스타일 원문 §9) |

## 다시 만들기

```sh
git clone --depth 1 https://github.com/lemomo-ai/lemo-opuscar.git ~/lemo-opuscar && cd ~/lemo-opuscar
npm install && node node_modules/playwright-core/cli.js install chromium-headless-shell
uv venv --python 3.12 .venv && uv pip install --python .venv/Scripts/python.exe -r requirements.txt
mkdir -p films/haha-chalk && cp -r styles/chalkboard/demo/{js,tools,index.html} films/haha-chalk/   # 그 뒤 위 파일로 바꾸고 diff 적용
# 글꼴 EMS Delight · EMS Casual Hand(OFL, gitlab.com/oskay/svg-fonts) → fonts/, 분필 녹음(CC0 둘, 위키미디어 공용) → foley/raw → tools/foley_lib.py
# 목소리 g1 · m1 · m2 · m3 · k2 · g3.wav와 bgm.wav는 ../../remotion/public에서
node core/render/events.mjs films/haha-chalk --size 1080x1920
.venv/Scripts/python.exe films/haha-chalk/audio.py
node core/render/video.mjs films/haha-chalk --fps 30 --workers 4 --size 1080x1920 --out films/haha-chalk/out/video.mp4
LEMO_COLOR=bt709 sh core/render/mux.sh films/haha-chalk/out/video.mp4 films/haha-chalk/mix.wav out.mp4 30 1   # 그 뒤 12M · AAC 384k로 다시 담기
```

렌더는 15초에 약 25초(노트북, 일꾼 4). 결과 영상은 git 밖(`../haha_chalk_v3.mp4`).

## 출처

글씨 · 칠판 · 교실은 모두 코드로 그렸다(사진 · 생성 그림 없음). 분필 소리: 「chalk-on-chalkboard」 fattirewhitey · 「Chalkboard-writing.ogg」 Tomproberts(둘 다 CC0, 위키미디어 공용). 글꼴: EMS Delight · EMS Casual Hand(OFL 1.1). 엔진: LemoLab lemo-opuscar(MIT).
