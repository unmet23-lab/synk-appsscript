# SYNK · 말의 리듬

2026-10-01 · 한국어 듣기 학습 리듬 게임. 나레이션과 두 버튼 O/X로 구성한 공개 플레이 시제품.

2026-10-02 공통 목표: [TOPIK I 1~2급 준비](../../docs/미니게임_TOPIK_I_학습기준.md). 말의 리듬은 짧은 발화의 시간·장소·변경 정보·이유·대조·조건을 듣고 내용 일치를 판단하는 연습을 맡는다. 문제 나레이션이 학습 입력이며, 음악 연주 점수·곡 난이도·O/X 정답률을 공식 급수·합격 판정으로 사용하지 않는다.

사용자 요청: 오투잼처럼 타이밍을 맞추는 재미를 유지하면서 한국어·TOPIK 학습을 돕고, 인기 리듬 게임의 특성과 높은 그래픽 품질을 적용한다.

## SYNK LAB PLAY 펠트 판 — 2026-10-07

2026-10-06 유호님이 예전 화면(검은 우주 무대)을 싫어해 「니 방식대로 싹다 리디자인 및 재설계 해도 좋으니까 제대로 부탁해」 → 말 랠리·이야기 교실과 같은 [SYNK LAB PLAY 키트](kit/README.md)(`kit/`, 원본 `experiences/play-common/kit/`) 한 벌로 다시 짰다. 판정·보면·듣기 문항·학습 기록·판정 폭 맞춤·공통 코인의 동작은 그대로다(기존 시험 37개 그대로 통과).

- **입구**(`#lobby`): 키트 구조 그대로 — 위 막대(로고 꼬리표·`LAB · LISTEN & PLAY`·배경 음악 단추) → 코랄 펠트 머리 면(제목·두 줄 lede·입구 그림) → 종이 카드 둘(오늘의 한 곡 · 하는 방법 셋) → TOPIK 안내. 입구 그림은 게임과 같은 펠트 레인·판정선·O/X 배지를 멈춘 채 그린 캔버스(`stage.mjs` preview) + 몽글. 곡 셋은 도톰한 펠트 쿠션 타일(초록 분홍·해안선 라피스·네 시 버터, 고른 곡은 들뜨고 크림 칼선 + 펠트 체크, Atlas 추천 곡은 「추천」 꼬리표), 그 아래 추천 이유 한 줄, 코랄 펠트 `무대 열기`, 박자 난이도 칩 셋, `소리·박자 설정` 칩, 공통 코인 줄. 플레이 전 사용법 창은 없앴다(하는 방법 카드가 맡는다). 무대 열기 단추는 320×568~1440×900의 첫 화면에 든다.
- **무대**(`#game`, 한 화면 고정·페이지 스크롤 없음): 키트 게임 바(로고·`말의 리듬`·점수·콤보·문제 `n / 5` 알약·멈춤) + 캔버스 무대. 크림 펠트 벽(`wide-cream`) 아래 코랄 펠트 바닥(`tex-coral`)을 깊이에 맞춰 원근으로 깔고, 쿠션 띠(`cushion-lapis-strip` O · `cushion-blush-strip` X)를 세워 화면 줄마다 그 깊이의 조각으로 그린 레인 둘이 아래 두 단추 가운데로 모인다(레인이 띠보다 길어 둥근 두 끝은 그대로, 가운데 결만 거울로 홀수 번 이음). 판정선은 크림 펠트 결로 채운 띠, 노트는 크림 펠트 배지에 O·X 글자, 긴 노트 몸통은 크림 펠트 띠, 듣기 문제의 답 노트는 큰 배지 + 둘레의 빛(고른 답은 크림 칼선). 몽글은 레인이 시작하는 먼 끝에 서서 표정만 바뀐다(듣기 → 집중, 맞힘 → 활짝, 그 밖 → 웃음·갸웃, 움직이지 않음). 판정 글자는 딱! · 좋아요 · 아쉬워요(놓친 노트에는 글자 없음). 흔들림·화면 흔들기 없음, 효과 줄이기(또는 움직임 줄이기 설정)에서는 반짝이·번쩍임을 줄이고 글자는 움직이지 않는다.
- **듣기 문제 카드**(종이, 위쪽): 듣기 n / 5 꼬리표 → 「잘 들어 보세요」 → 「맞는 내용일까요?」 → 「들은 내용과 맞으면 O, 아니면 X」 → 답한 뒤 「잘 들었어요!」(펠트 체크) 또는 「다시 들어 봐요」(빨간 X 없음) + 정답. 듣는 동안 O·X 단추는 색은 그대로 두고 글자만 옅게·「듣는 중」으로 쉰다(그때 누른 것은 답이 아니다). 답한 뒤에는 바로 다음 노트를 칠 수 있다(예전에는 카드가 사라질 때까지 터치 단추가 잠겨 답 뒤 1초쯤의 노트를 칠 수 없었다). **글로 보기**: 문장은 평소 글로 보이지 않고, 누르면 들은 문장과 질문을 보여 준다. 그 문제는 Atlas에 `help('text')`로 남아 혼자 해낸 응답으로 세지 않는다.
- **O·X 단추**: 도톰한 펠트 쿠션(O 라피스 · X 분홍, 넓은 화면은 2.4:1 판), 큰 글자 + 맞아요/아니에요, 모서리에 F·J 크림 단추. 누르면 3px 내려앉고, 고른 답은 크림 칼선, 맞는 답에는 펠트 체크 배지.
- **결과**(`#results`): 키트 구조 — `무대 끝!`, 큰 숫자 = 맞힌 문장 n / 5, 별(5개 → 3, 4개 → 2, 3개 이상 → 1), 박자 점수·정확도·최대 콤보 알약, 공통 코인 줄(`#r-coins`, 곡을 자연스럽게 끝까지 마쳤을 때만 받는다) → 이번 곡의 문장(문장·질문·정답·해설, 맞힘 펠트 체크 / 다시 볼 문장은 크림 원에 번호, 문장마다 `다시 듣기`) · 듣기 기록(이번 곡의 능력별 맞힘, Atlas 문구: 새 응답 수·판정 폭 맞춤, 새 문장 확인) · 다음 곡(추천 이유 · `다시 하기` · `다른 곡 고르기` · `처음으로`). 결과의 다시 듣기가 새 문장 확인 소리를 끊으면 그 새 문장은 끝까지 들은 것으로 치지 않는다.
- **설정·멈춤**: 입구의 `소리·박자 설정`(배경 음악 — 문장 소리는 늘 들림 · 판정 폭 맞춤 · 효과 줄이기 · 박자 보정 −/+ 10ms, ±200ms). 멈춤 창(`dialog.lab-dialog`): 이어 하기 · 배경 음악 · 효과 줄이기 · 박자 보정 · 처음으로. 배경 음악·박자 보정은 이 브라우저에 기억한다. Space·Esc로 멈추고 다시 Space·Esc로 이어 한다.
- 키트가 대신하는 예전 글꼴·로고·펠트 사본(`assets/*.ttf`·SUIT·`logo-*.svg`·`sticker-book`·`thread`·`assets/felt/`)은 지웠다. `assets/signal-stage.webp`(와 원본 PNG)는 게임이 더 쓰지 않지만 `desktop/tools/build-renderer-assets.cjs`가 WORLD 표지로 복사하므로 남겼다. 가져오기의 `?v=` 꼬리는 걷었다.
- 확인용 훅 `?qa` → `window.__rhythm`(state · autoplay · plan · seek). 실제 입력 함수로 노트를 치고 문제마다 맞게/틀리게 답하며, 기다림만 줄인다(문장은 끝까지 듣는다). `window.synkRhythm`(읽기 전용 확인 창)은 예전 확인 도구를 위해 같은 모양으로 둔다.
- 확인: `qa/play.cjs`(헤드리스 크롬, 1440×900 · 390×844 터치 · 320×568 · 움직임 줄이기 1280×800) — 한 곡을 처음부터 결과까지(맞힘·틀림·글로 보기·멈춤·결과의 다시 듣기·새 문장 확인·코인 `공통 코인 +23 · 보유 23`), 게임 화면 스크롤·가로 넘침·확대 없음, 단추·HUD가 화면 안, 캔버스가 실제로 그려짐, 콘솔 오류 0. 결과는 [`qa/play-results.json`](qa/play-results.json), 장면은 `qa/shots/`(git 제외). 실제 휴대폰의 다중 터치·지연·발열과 귀로 듣는 확인은 아직이다.

## 음악 제작 기준 — 사용자 확정

2026-10-01 후속 요청: **리듬게임은 우리가 만든 Suno 노래로 구성한다.** 곡 선정과 보면·무대·학습 구간 설계의 기준이다.

- 후속 교체 요청으로 [음악자산 장부](../../docs/음악자산_장부.md)의 현행 한국어 시티팝 세 곡을 사용한다. 원본 WAV의 지문을 라디오 제작 manifest와 대조하고, 원곡 전체를 160kbps MP3로 인코딩했다. 원본과 라디오 재생 목록은 보존했다.
- **초록** — 3:22.68, 약 111.1 BPM, Suno `94e8eeb8-fcba-4434-a0ba-cd1490d8c6d3`.
- **해안선** — 3:51.60, 약 112.1 BPM, Suno `c2835bc7-6963-4503-95bd-781b55e20b88`.
- **네 시** — 3:42.80, 약 107.0 BPM, Suno `ed3ac4b9-0386-4f47-8c1f-eb61cbd11f52`.
- 임시 배경 음악 생성 코드를 제거했다. 실제 배포 음원의 저역 온셋·주기·위상을 분석한 박자 시각으로 보면을 새로 만들고, AudioContext의 재생 시간을 음악·노트·입력의 공통 시계로 사용한다. BPM과 박자 분석은 자동 추정이며 사람의 전곡 청취·수동 보면 검수는 별도다.
- 문항은 짧은 한국어 문장과 질문을 나레이션으로 들려준다. Suno 노래와 별도로 만든 듣기 문항이며, 가사 받아쓰기나 가사 이해 문항으로 표시하지 않는다. 노래의 도입·벌스·후렴을 사람이 구분한 연출은 후속 개선 범위다.

## 실행

```powershell
node experiences/korean-rhythm/server.mjs
```

게임: **http://127.0.0.1:5201/**

다시 켤 때는 이 폴더의 `Start-Game.ps1`도 사용할 수 있다. Node가 설치된 현재 컴퓨터에서 로컬 서버만 실행한다. 외부 서버·계정·API·유료 호출은 필요하지 않는다. ES 모듈과 로컬 폰트를 쓰므로 `index.html`을 더블클릭하는 file URL 실행을 배포 방법으로 삼지 않는다.

- 키보드: **F · J / ← · →**, 일시 정지: **Space / Escape**.
- 터치: 아래의 O·X 펠트 단추 둘. 롱노트는 계속 누른다.
- 듣기 구간: 문장과 질문을 끝까지 듣고, 맞으면 왼쪽 O, 아니면 오른쪽 X를 박자에 맞춰 누른다. 듣는 동안 일반 노트를 비우고 배경 음악을 낮춘다. 문항 내용은 플레이 중 글자로 보여주지 않고, ‘글로 보기’를 누를 때만 보여 준다(도움으로 기록, 2026-10-07).
- 3곡, 곡마다 리듬 난이도 3단계. 한국어 내용은 곡으로, 노트 밀도와 판정 폭은 리듬 난이도로 고른다.
- 배경 음악은 우리가 만든 Suno 한국어 노래 원곡이다. 시작 카운트와 작은 키 사운드만 Web Audio로 만든다. 현재 학습 방식은 한국어 **듣기·내용 판단**이다. 배경 음악을 꺼도 문제 나레이션은 들린다.

## 인기작을 참고한 범위

2026-10-01에 공식 소개·배포 페이지와 현재 평가 지표를 확인했다. 플랫폼과 시장을 합친 공식 1위로 단정하지 않는다. 아래의 적용은 이번 게임의 설계 해석이다.

| 참고작 | 확인한 근거 | 이 시제품에 적용한 특성 |
|---|---|---|
| [DJMAX RESPECT V](https://store.steampowered.com/app/960170/DJMAX_RESPECT_V/?l=koreana) | 확인 시점 최근 Steam 평가 ‘매우 긍정적’, 긍정 86%. 곡 팩과 음악 중심 구성을 제공하는 현행 리듬 게임 | 곡 선택 → 연주 → 결과 흐름, 레인 타이밍 조작, 콤보, 롱노트, 타격 반응 |
| [Arcaea](https://play.google.com/store/apps/details?id=moe.low.arc&hl=en) | 개발사 배포 페이지 기준 다운로드 5M+, 평점 4.8. 곡별 3난이도, 아케이드식 성장, 음악·이야기의 결합을 명시 | 원근감 있는 노트 무대, 한 곡의 3난이도, 분위기가 있는 배경과 단계적 연주 |
| [프로젝트 세카이 · SEGA의 2026 공연 보고](https://www.sega.co.jp/segaway/articles/260915_2/) | 2026-09-15 공식 보고에서 CG 무대의 시각적 발전과 음악·캐릭터별 공연 연출을 소개 | 음악을 중심에 놓고 곡의 분위기를 화면에 일관되게 적용하는 방향 참고. 공연의 Unreal Engine을 이 게임에 사용한 것은 아님 |

위 게임의 음악·캐릭터·스크린샷·UI 이미지는 게임 자산으로 반입하지 않았다.

## 한국어 학습 구조

- 곡당 5번의 듣기 판단. 시간·장소·바뀐 정보, 원인·대조·목적, 조건·같은 뜻을 짧은 문장과 질문으로 들려준다. 기존 읽기 방식은 2026-10-01 사용자 요청으로 교체했다.
- 같은 문장에도 참·거짓 질문을 번갈아 배정한다. 왼쪽 O·오른쪽 X 위치는 고정해 조작을 단순하게 하고 정답 레인을 예고하지 않는다.
- 실제 길이를 확인한 녹음 파일을 판정 박자 최소 12초 전에 시작한다. 나레이션 종료 뒤 생각할 시간과 약 2초의 답 입력 구간을 둔다. 듣는 동안 입력은 답으로 인정하지 않는다.
- 리듬 점수는 타이밍과 롱노트 완주만 센다. 듣기 정답과 오답·무응답은 별도로 기록한다. 두 키를 동시에 눌러 두 답을 제출할 수 없다.
- 종료 후 문장·질문·해설을 글로 확인한다. 복습은 내용을 바꾼 새 문장을 먼저 음성으로 듣고 O/X로 답하며, 답한 뒤 글을 공개한다. 이 확인은 정답·해설 직후 수나 시간만 바꾸는 연습이며, 원문과 같은 문항군으로 기록한다. 새 독립 수행·다음 날 기억·TOPIK 점수 향상의 증거가 아니다.
- 2026-10-02 로컬 소스는 아래 Atlas 맞춤 추천을 연결한다. 서버·학생 계정으로 전송하지 않으며, 기존 공개판의 최신 반영 여부는 별도다.

[공식 TOPIK 영역 안내](https://www.niied.go.kr/web/niied/contents/niied_topik), 2026-10-01 재확인: TOPIK I 듣기·읽기, TOPIK II 듣기·읽기·쓰기. 이 시제품은 TOPIK 듣기에 필요한 짧은 발화의 정보 파악과 내용 일치 판단을 연습하도록 구성했다. 공식 시험 문항·급수 판정·긴 담화·발음 평가·작문 훈련은 구현하지 않았다. 문항의 난도 표시는 제작용 분류이며 강사 검수와 학생 검증 전이다.

## 그래픽과 소리의 실제 구현

> 2026-10-07부터 화면은 위의 「SYNK LAB PLAY 펠트 판」이다. 아래 무대 그림·로비 설명 네 줄은 예전 판의 기록이다(`signal-stage` 그림은 WORLD 표지 때문에 파일만 남았다). 소리 구현(아래 두 줄)은 그대로다.

- `assets/signal-stage-original.png`: 내장 **image_gen**으로 새로 생성한 1672×941 무대 원본. 아래에 실제 제출 프롬프트를 보존했다.
- `assets/signal-stage.webp`: 같은 원본의 WebP 배포용 인코딩, 269,190바이트. 원본 보존.
- 배경은 생성한 정지 그림, 노트·롱노트·판정선·입자·박자에 반응하는 빛은 **Canvas 2D 실시간 렌더링**이다. 실제 3D 메시나 PBR 게임 엔진은 아니다.
- 세 Suno 곡은 같은 무대 계열의 색 변주를 사용하며, 실제 음원 박자·길이와 문장 주제가 다르다.
- SUIT Variable·Inter Tight·DM Mono의 로컬 파일과 OFL을 포함한다. 현재 승인된 정밀 SYNK 로고 두 개를 비례 그대로 사용한다.
- 로비·결과는 흰 바탕·아치 그림·펠트 스티커를 따르고, 연주 화면은 검은 무대에 집중한다. 2026-10-04부터 누르는 부품은 [펠트 부품](../../docs/디자인/펠트부품/README.md)의 실제 펠트다: 이 곡으로 시작·한 번 더 연주는 코랄 긴 판, 추천 곡·다른 문장 듣기·보기·난이도 칸은 크림 판(고른 것은 블러시), 곡 카드는 크림 판이고 고른 곡은 블러시 판 + 펠트 체크 배지, F·J와 닫기는 크림 원판. 마감 점검표대로 납작한 CSS 체크 원·검은 윤곽·밀린 그림자·기운 테이프·제목 위 실땀 줄은 걷었다.
- 음악과 나레이션 MP3를 실제 AudioBuffer로 해독하고, 같은 AudioContext 시계에 미리 예약한다. 음악·나레이션·노트가 함께 정지하고 같은 지점부터 재개된다. 나레이션 동안 음악 볼륨은 6%로 낮췄다가 복원한다. 음원 오류를 임시 음악이나 읽기 문항으로 대체하지 않고 재시작 안내를 표시한다.
- 나레이션 45개: 본 게임 15문항×참·거짓 두 변형, 새로운 복습 문항 15개. `ko-KR-SunHiNeural` 합성 음성, 발화 속도 -8%, -16 LUFS 정규화, 24kHz 모노 64kbps MP3. 실행 시 TTS 호출 없이 동봉 파일을 재생한다. 대본·길이·SHA는 `assets/narration/manifest.json`, 재생 경로는 `narration.mjs`, 생성 도구는 `scripts/`에 보존했다.

## 생성 프롬프트 원문

도구: 내장 `image_gen.imagegen`, `transparent_background: false`, 신규 이미지 생성. 외부 CLI·API 키 사용 없음.

```text
Use case: stylized-concept. Asset type: premium original environment background for a Korean-language learning rhythm game named SYNK, to be used behind a real interactive note highway. Create one spectacular landscape 16:9 cinematic image, very high craft and visual richness. A surreal midnight music stage suspended above a dark ocean, an enormous sculptural looping ribbon made of coral pink felt and lapis blue felt twisting around a distant circular black portal, close-up tactile wool fibers and sewn edges, a few sculptural folded paper and felt islands at the left and right edges. Crisp directional stage lighting, controlled coral highlights and blue rim lights, convincing shadow and material depth, refined contemporary art installation, almost photoreal rendered tactile miniatures, mature and elegant rather than childish. Main surfaces are charcoal black; accents coral #F36F63, lapis #3D6BC9, pale cool blue, small warm butter highlights. Composition: generous dark empty vertical region through the center and lower center for an overlay of gameplay lanes; main sculptural ribbon frames the center without crossing its bottom half; details concentrated at extreme sides and upper third; dramatic vanishing point near upper center. Beautiful atmospheric black sky and distant low horizon, subtle fog, no people, no mascots, no instruments, no text, no logos, no letters, no interface, no notes or lane graphics, no watermark, no busy center, no generic neon cyberpunk city, no beige or cream tint.
```

## 파일과 검증

`index.html` · `style.css` = 화면(키트 `kit/lab.css` 다음에 게임 고유 규칙만), `listening.mjs` = 듣기 문항·변형·복습, `narration.mjs` = 음성 길이·경로, `core.mjs` = 보면·독립 판정, `audio.mjs` = 음악·나레이션과 공통 시계(확인용 `seek`), `stage.mjs` = 펠트 캔버스 무대(게임·입구 그림), `app.mjs` = 입력·화면 흐름·학습 기록 연결, `personalization.mjs` = 문항↔능력·판정 폭 맞춤, `kit/` = SYNK LAB PLAY 키트 사본(직접 고치지 않음), `server.mjs` = 이 컴퓨터 전용 정적 서버.

실행에 필요한 파일(공개 묶음): `index.html` `style.css` `app.mjs` `core.mjs` `audio.mjs` `stage.mjs` `suno-tracks.mjs` `listening.mjs` `narration.mjs` `personalization.mjs` `atlas-learning.js` `collection.js` `assets/`(music·narration) `kit/`(lab.css·lab.mjs·felt·brand·fonts).

```powershell
node --test experiences/korean-rhythm/core.test.mjs experiences/korean-rhythm/audio.test.mjs experiences/korean-rhythm/flow.test.mjs experiences/korean-rhythm/app-learning.test.mjs experiences/korean-rhythm/assignment-target.test.mjs experiences/korean-rhythm/grammar-links.test.mjs experiences/korean-rhythm/personalization.test.mjs
node experiences/korean-rhythm/qa/play.cjs            # experiences 폴더를 정적 서버로 띄운 뒤(RHYTHM_URL, 기본 http://127.0.0.1:5261/korean-rhythm/)
```

[검증 기록](qa/RESULTS.md), [실제 브라우저 근거](qa/browser-evidence.json).

최초 시제품 검증은 위 기록에 있다. 현재 교체 검증은 [Suno 교체 기록](qa/suno-20261001/RESULTS.md)에 구분한다. 실제 휴대폰의 다중 터치·발열·프레임, 출력음의 직접 청취, 교육 효과와 지연 기억 검증은 남아 있다.

## 홈페이지와 공개 플레이

2026-10-01 사용자 요청으로 https://synk.im/lab/#work 소개와 https://synk.im/try/rhythm/ 플레이를 게시했다. 원천 연결은 SYNK-website의 rhythm-overview.mjs·sync-rhythm-experience.mjs. 한국어·영어 소개와 실제 캡처3장, 공개 질문 답변을 함께 변경했다. 공개검증: SYNK-website/qa/rhythm-homepage-20261001/RESULTS.md. 이전의 ‘공개 게시 수행하지 않음’은 최초 로컬 제작 시점의 기록이며 현재는 공개 플레이 가능하다.

같은 날 후속 교체 요청으로 현행 Suno 한국어 원곡 세 곡과 새 보면을 공개했다. 공개 `59741ae`·Pages `36846311936` 성공, 14변경 파일 SHA 일치와 공개 음원 출력을 확인했다. 홈페이지의 실제 캡처3장과 한국어/영어 음악 소개도 갱신했다. [Suno 교체 검증](qa/suno-20261001/RESULTS.md).


## 나레이션 듣기 개편 — 2026-10-01

사용자 요청으로 읽기·네 레인 선택을 나레이션·두 레인 O/X로 교체했다. 자동21검사와 홈페이지278검사 통과. 로컬 실제 세 곡 완주, 음성 출력, 나레이션 중 정지·재개, 키보드 정답 입력, 390×844 화면·음성 복습 터치를 확인했다. 공개 `263d75b`·Pages `36860120740` 성공, 관련74파일의 HTTP200·Git SHA 일치. 현재 홈페이지 원천은 `SYNK-website/games-overview.mjs`·`public-games.json`이며, `sync-rhythm-experience.mjs`가 게임 모듈과 음성을 게시용으로 동기화한다. [이번 검증](qa/listening-20261001/RESULTS.md).

## Atlas 맞춤 추천 · 2026-10-02 로컬 구현

- 공통 `atlas-learning.js`의 기록으로 추천 곡을 고르고 실제 다음 플레이의 곡 선택에 반영한다. 직접 곡 선택은 유지한다. `personalization.mjs`에는 문항과 능력의 대응만 두며 추천 정책을 복제하지 않는다. 리듬 난이도는 언어 난이도와 별개다.
- 문제 음성이 끝난 뒤의 최초 O/X 의미 응답과 즉시 새 문장 확인을 공통 기록에 남긴다. 박자 점수는 능력 근거에 넣지 않으며 무응답과 미완료 음성은 오답으로 단정하지 않는다.
- 문항 ID는 곡·문항·변형을 포함한다. 같은 원문의 O/X 질문만 바뀐 경우 같은 문항군으로 묶어 반복 정답을 새 독립 근거로 세지 않는다. 본편과 새 문장 확인 모두 실제 O/X 두 보기이므로 `binary-choice`로 전달하며 세 보기 선택 근거와 합치지 않는다. 새 문장 확인은 원문의 정답·해설 직후 수나 시간만 바꾸므로 원문과 같은 문항군으로 기록하고, 새 독립 수행 근거로 세지 않는다. 추천 곡도 포함된 문항군을 전달하여 이미 연주한 곡보다 아직 첫 응답을 얻을 수 있는 곡을 우선한다.
- 기록은 해당 브라우저·origin 범위다. 공용 허브에서 실행한 게임끼리 이어지고 다른 포트의 단독 서버끼리는 공유되지 않는다. '이 기기의 공통 학습 기록 지우기'는 같은 origin의 게임 공통 기록을 초기화한다. 학생 로그인·다른 기기 동기화·교사 보고는 연결하지 않았다.
- 2026-10-03: 문항마다 들려주는 지문의 TOPIK I 문형(Strata `grammarIn`이 읽은 것, 다시 확인 문항은 그 지문)을 `conceptIds`로 남기고, 곡 후보는 지문 문형의 합을 가진다(`RHYTHM_GRAMMAR`, `grammar-links.test.mjs`가 같은지 본다). 놓친 문형이 공통 기록의 연습할 내용에 나오고 그 문형이 있는 곡을 조금 앞세운다. WORLD 안에서는 범위 문구를 계정으로 바꾸고 지우기 단추를 숨긴다.
- 읽기는 이 곡에서 측정하지 않는다. 추천 이유와 근거 수는 연습 선택을 돕는 운영 기준이며 TOPIK 점수·급수·학습 효과의 증거가 아니다. 공개 홈페이지에 배포하지 않았다. 검증은 [맞춤 추천 확인 기록](qa/PERSONALIZATION-20261002.md)에 구분한다.
- 2026-10-02 초기화 보완: 실제 저장 성공 뒤에만 학습 기록을 지웠다고 안내한다. 저장 실패·엔진 누락은 실패로 알리고, 계정 기록의 게임 내 초기화 거절은 WORLD 관리 안내로 구분한다. `app-learning.test.mjs`가 실제 화면 진입 코드의 버튼 핸들러와 공통 엔진을 함께 실행해 실패·재시도·재접속 기록을 확인한다. 음성·무대·DOM 표현은 시험 대역이며 브라우저 실기기 확인과는 구분한다.

## 판정 폭 맞춤 · Atlas 순간 맞춤 (2026-10-02)

고른 난이도(편하게·리드미컬·도전) 안에서 판정 폭만 0.85~1.35배로 움직인다(`personalization.mjs`의 `FLOW_RHYTHM`). 노트를 놓치면 조금 넓어지고, 계속 정확히 치면 조금 좁아진다. 길게 누르는 노트를 일찍 떼거나 누른 채 일시정지한 것은 판정 폭과 관계가 없어 근거로 쓰지 않는다. 곡·노트 배치·O/X 듣기 문제와 그 채점은 바꾸지 않는다. 설정의 "판정 폭 맞춤"을 끄면 난이도 본래의 판정 폭으로 연주한다. 결과 화면에 이번 곡에서 맞춘 내용을 한 줄로 적고, 다음 곡은 이어서 맞춘다. 리듬 결과는 한국어 실력의 근거로 쓰지 않는다. 확인: `flow.test.mjs`, 실제 Chrome `qa/atlas-timing-smoke.cjs`([결과](qa/atlas-timing-smoke.json)).
