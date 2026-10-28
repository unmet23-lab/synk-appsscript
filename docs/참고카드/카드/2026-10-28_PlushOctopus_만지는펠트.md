---
제목: Plush Octopus — 만지면 대답하는 털 인형, 「어떤 엔진?」의 답과 세 친구 「누르면 말랑」
공유일: 2026-10-28
종류: 디자인 참고
대상: WORLD 앱 · 싱크타운
언제: 지금
상태: 새로
한줄: 「이 그래픽은 어떤 엔진으로 만들수있을까?」에 대한 답 — 게임 엔진이 아니라 브라우저 WebGPU 페이지 한 장(사면체 그물로 된 말랑한 몸 + 겹 털로 보인다)이고, 이 손맛은 우리가 이미 쓰는 Three.js로 닿는다. 털은 가져오지 않고(10-27 까몽 겹 털이 수건처럼 보여 뺀 방식) 손맛만 — WORLD 집 세 친구를 누르면 그 자리가 들어갔다 말랑하게 출렁이고, 까몽 꼬리 · 날개 끝과 몽글 밑단이 한 박자 늦게 따라오고, 세기는 성격대로. 지금 기우뚱 인사와 나란히 놓은 비교 페이지부터
링크: https://www.instagram.com/reel/DeGkI7ptD8K/
게시물ID: DeGkI7ptD8K
장부: 32행
---

## 무엇인가

- AI Arena의 릴스(18.1초, 말소리 없음). 같은 프롬프트로 Claude Opus 5.5(위, 15.21$)와 GPT-6.1 Sol(아래, 18.03$)이 「처음부터」 만든 브라우저 WebGPU 체험 「Plush Octopus.」를 위아래로 나란히 보여 준다. 본문: 「soft-body physics, floppy tentacles, realistic deformation, and browser interaction」 · 「Opus came out fluffier and more lively」.
- 유호님 메모: 「이 그래픽은 어떤 엔진으로 만들수있을까?」
- 화면(위 Claude 판): 밝은 회백색 바닥 위 털 문어 인형 하나(빨판 쪽은 흰 털, 구슬 눈 · 볼터치). 왼쪽 위 「MATERIAL STUDIES」와 세리프 이탤릭 제목, 「Eight soft arms in a coat of mohair. Floppy, clingy, heavy in the head. Offer it a finger.」 왼쪽 아래는 도구 설명(FINGER: 「Hold a finger out over an arm and it reaches up for it; press to put the finger down and the arms wrap round and hold on. Move it, lift it — they come along.」)과 숫자 칸 MASS 480 g · VOLUME 98.0 % of rest · KINETIC 0.03 mJ · HOLDING ON 4 arms, 그 밑 작은 글 「Volume and energy are summed live over every tetrahedron and particle」. 오른쪽 「THE SPECIMEN · fig. 12」 판: TOOL Hand · Finger · Comb, FUR Coral · Lilac · Lagoon, STUFFING 0.42(loose ↔ packed) · PILE 7 mm(cropped ↔ shaggy) · INTERNAL DAMPING 0.48(bouncy ↔ damp), Shake it · Squish · Toss · Smooth fur · Reset, ½ speed · Mesh · Pause. 30행 Dolphin Jelly와 같은 「Material Studies」 꼴이다.
- 1초 · 0.5초 간격으로 더 뽑아 본 움직임(위 판):
  - 0~1초: 들어 올리면 그림자는 바닥에 남고 몸이 뜬다.
  - 2~3초 Toss: 뒤집혀 날아가는 동안 다리 여덟이 몸보다 늦게 휘며 따라온다.
  - 4~5초: 내려앉아 출렁이다 멈춘다.
  - 7~12초 Comb: 가까이 당겨 머리를 빗자 빗은 길이 결 반대로 서며 어두운 자국으로 남는다(벨벳을 손가락으로 쓴 것처럼). 색을 바꿔도 자국은 그대로다.
  - 14~17초 Finger: 막대를 대자 다리가 감기고, 들어 올리면 거꾸로 매달린 채 흔들린다.
- 프롬프트 전문은 「PROMPT」 댓글 뒤에 있다. 공개된 곳은 찾지 못했다(아래 근거).

## 어떤 엔진으로 만드나

코드가 공개되지 않아, 아래는 화면 글자와 움직임으로 미루어 본 것이다.

- **게임 엔진이 아니라 웹 페이지 한 장이다.** 본문이 「WebGPU 체험을 처음부터」라고 적었다. WebGPU는 브라우저가 그래픽 카드로 그림과 계산을 함께 하는 새 통로(WebGL의 다음 판)다. 이런 장면은 보통 Three.js의 WebGPU 판(셰이더를 TSL로 씀)이나 WebGPU를 바로 써서 만든다.
- **말랑한 몸 = 사면체 그물 물리.** 몸 안을 작은 사면체 수백~수천 개로 채우고, 모서리 길이와 부피를 지키게 하는 방식(XPBD 같은 위치 기반 물리)이다. 화면 아래 「사면체와 입자마다 부피 · 에너지를 실시간으로 더한다」는 글과 VOLUME 「98 % of rest」(눌러도 부피가 거의 그대로)가 그 표시다. STUFFING(속 채움)은 부피를 지키는 세기, INTERNAL DAMPING은 출렁임이 가라앉는 빠르기다. 다리는 같은 그물의 긴 가지라 들면 늘어지고, 손가락에 닿은 마디를 붙잡아 두면 감긴다(HOLDING ON 4 arms).
- **털 = 겹 털 + 결 방향 그림.** 몸을 바깥으로 수십 겹 다시 그리고 겹마다 털 단면만 남기는 겹 털(shell)에, 털이 누운 방향을 적은 그림 한 장을 빗이 고쳐 쓴다. 결 반대로 쓸면 털이 서며 그늘이 져 자국이 남고, Smooth fur는 그 그림을 지운다. PILE이 겹의 높이(털 길이)다.
- **우리에게는 엔진을 바꿀 일이 아니다.**
  - 세 친구(몽글 · 까몽 · 마린)는 이미 Three.js(WebGL)로 실시간 펠트를 그린다(`experiences/synk-world-home/avatar-v3.mjs` · `home-kkamong-avatar.mjs` · `home-marin-avatar.mjs`). 아래 「가져올 것」은 친구 하나에 용수철 몇 개라 지금 코드에서 된다.
  - WebGPU가 값을 하는 것은 이 영상처럼 점 수천 개의 물리와 털을 매 프레임 계산할 때다. 옮기려면 우리 펠트 재질의 셰이더 고침(`onBeforeCompile` — 예: `home-kkamong-avatar.mjs` 278행)과 그림자 · SSAO 후처리(`SSAOPass` · `OutputPass`)를 새 방식(TSL · 노드 후처리)으로 다시 써야 한다. three.js 공식 설명서는 WebGPURenderer에서 `ShaderMaterial` · `onBeforeCompile` · `EffectComposer`를 지원하지 않는다고 적었고, 렌더러 자체도 「아직 실험 단계」라고 한다. WebGPU가 안 되는 기기에서는 WebGL 2로 저절로 돌아간다.
  - 기기: 아이폰은 iOS 26부터, 안드로이드 크롬은 121부터(안드로이드 12 이상 · 퀄컴/ARM 그래픽) WebGPU가 되고, 안드로이드 파이어폭스는 아직이다(web.dev 2025-11-25). 휴대폰이 주 플랫폼이라 지금은 WebGL 판이 더 넓게 닿는다.
  - Unity · Godot 같은 게임 엔진도 이 장면을 만들 수 있다. 하지만 웹에서는 엔진을 통째로 내려받아 첫 화면이 무거워지고, WORLD의 3D 코드를 모두 옮겨야 한다. 3D 방향 원문(10-09)은 「Three.js를 본 제작 엔진으로 확정한 것은 아니다」라고 남겨 두었고, 싱크타운 세로 조각은 「렌더러는 웹 three.js 그대로」로 정했다(Unity 전환안은 실물 휴대폰 근거가 0건, 실물 측정에서 기준 기기가 크게 못 미치면 다시 본다 — [세로 조각 §2-1](../../디자인/싱크타운_찻집골목의하루_세로조각설계_20261022.md)). 이 장면 수준의 손맛은 지금 엔진으로 닿는다는 것이 이 카드의 판단이다.

## 가져올 것

1. **누른 자리가 들어갔다가 몸 전체가 말랑하게 출렁인다.** 놓으면 1초 안에 두세 번, 점점 작아지며 가라앉는다(INTERNAL DAMPING). 「만지고 싶은 재질」(3D 방향 10-09)을 손끝으로 확인하게 하는 가장 짧은 길이다.
2. **늘어진 부위는 한 박자 늦게 따라온다.** Toss · Shake에서 몸이 먼저 움직이고 다리가 늦게 휘며 따라온다. 우리 친구들에게는 까몽 꼬리 · 날개 끝, 몽글 밑단 물결, 마린의 수첩 든 팔이 그 자리다.
3. **쓰다듬은 자리에 결 자국이 남았다가 돌아온다.** 빗질한 길이 결 반대로 서며 어두워진다. 우리 펠트는 눌린 결이라 긴 털은 안 맞지만(아래), 몸에 두른 잔털(몽글 6,500올 · 까몽 약 1만 가닥)이 손길을 따라 눕고 2초쯤에 걸쳐 일어나는 것은 같은 재미다.

## SYNK 적용

- **지금 모습.** WORLD 집에서 친구를 누르면 `greet`가 불려 몸 전체가 1.2초 동안 기우뚱한다(`living-home-scene.mjs` 202 · 234~235행).
  - 몽글: 좌우로 숙인다(`avatar-v3.mjs` 170~174행, rotation.z).
  - 까몽: 앞뒤 · 좌우로 기운다(`home-kkamong-avatar.mjs` 343~345행).
  - 마린: 기울면서 경례 팔만 조금 든다(`home-marin-avatar.mjs` 282~289행).
  - 셋 다 몸은 단단한 장난감처럼 움직이고, 숨쉬기도 세로 0.2~0.3%뿐이다. 2D 튜터 띠 · 튜터 고르기는 10-17부터 「누르면 말랑」인데([월드 시그널 · 움직임](../../디자인/월드_시그널/README.md#움직임-2026-10-17)) 3D 집에서만 말랑하지 않다. 싱크타운 펠트 생물 주민도 같다 — 걸을 때 통통 뛰지만 닿을 때 눌리지 않는다(`experiences/synk-town/day-residents.mjs` 596~600행).
- **털은 가져오지 않는다.** 10-27 WORLD 집 까몽에 겹 털(22겹)을 썼다가 「곧게 선 올이라 수건 · 카펫처럼 보였다(펠트는 눌린 결이다)」로 빼고, 펠트 사진 결 + 잔털로 바꿨다([그림체 README](../../디자인/싱크타운_그림체_20261026/README.md) 「WORLD 집 까몽 다시」). 문어의 모헤어는 긴 털 인형이라 맞고 우리 펠트에는 안 맞는다. 세리프 제목 · 밝은 표본 판도 월드 시그널(어두운 유리 캡슐 · SUIT)과 말씨가 달라 들이지 않는다.
- **넣는 곳 — WORLD 집 세 친구:**
  - **1 → 누르면 말랑.** 누른 자리(빛살이 맞은 점) 둘레가 짧게 들어간다 — 정점 셰이더에 누른 점 · 깊이 값 둘로, 지금 펠트 재질이 이미 쓰는 `onBeforeCompile` 꼴이다. 몸 전체는 감쇠 용수철로 세로가 눌렸다 늘었다 두세 번 출렁이며 1초 안에 멈춘다. 지금 `greet`의 기우뚱을 대신하거나 그 앞에 붙는다.
  - **2 → 한 박자 늦은 부위.** 몸이 출렁이는 동안 까몽 꼬리 끝 · 날개 끝, 몽글 밑단 물결, 마린의 수첩 든 팔이 0.1~0.15초 늦게 같은 쪽으로 휘었다 돌아온다(부위마다 용수철 하나).
  - **3 → 성격대로.** 몽글(다정)은 크게 두 번 말랑하고 밑단이 살랑인다. 까몽(장난꾸러기)은 눌렸다 통 튀어 오르며 꼬리를 휙 친다. 마린(시큰둥)은 헬멧은 단단하게 두고 몸만 짧게 한 번 — 「…」. 10-27 성격 결정([결정](../../_ops/결정.md) 10-27 행)을 손맛으로도 보인다.
  - 옷: 몽글 옷은 몸과 따로 된 메시라(10-27 뚫림 0% 확인), 몸 전체 출렁은 무리(group) 크기로 줘서 옷도 같이 움직이게 하고, 누른 자리 들어감은 몸 메시에만 준다. 옷 위를 누르면 출렁만 한다.
  - 기기 「동작 줄이기」 · WORLD 「움직임 줄이기」에서는 지금처럼 멈추고, 「친구들의 반응」을 끄면 기우뚱 인사만 둔다.
- **다음 단계(이번에는 안 함):** 가져올 것 3의 쓰다듬기(몸 위를 천천히 끌면 그 길의 잔털이 끈 방향으로 눕고 2초에 걸쳐 일어남) — 집 장면은 지금 누름(`pointerup`)만 받아서 끌기 처리를 새로 넣어야 한다. 같은 용수철은 싱크타운 시제품의 「몽글 누르면 한 번 뛰기」와 펠트 생물 주민의 착지에도 쓴다(30행 카드).

## 확인할 것

- 비교 페이지: 같은 집 장면에서 지금(기우뚱) | 말랑을 나란히, PC 1280 · 휴대폰 390, 친구마다 누르는 10초 영상. 세기 · 가라앉는 빠르기는 화면 위 손잡이로 유호님 눈으로 고른다.
- 펠트로 보이는지: 세기를 키울수록 고무 · 젤리처럼 보인다. 펠트로 읽히는 최대 세기를 함께 고른다.
- 무게: 그리기 수 · 삼각형 수가 그대로인지(용수철은 CPU 몇 줄, 누른 자리는 셰이더 값 둘), 휴대폰 390 fps가 지금과 같은지.
- 기존 시험: 집 · 친구 고르기 · 옷장 시험 통과, 움직임 줄이기에서 화소 바뀜 0.

## 적용 요청문

> 팁 장부 32행 적용: WORLD 집 장면의 세 친구(몽글 · 까몽 · 마린)에 「누르면 말랑」 반응 시안을 만들어 줘(공개 안 함, 로컬 비교만). 친구를 누르면 ① 누른 자리 둘레가 짧게 들어가고(정점 셰이더에 누른 점 · 깊이) ② 몸 전체가 감쇠 용수철로 세로가 눌렸다 늘며 1초 안에 두세 번 출렁이고 ③ 까몽 꼬리 끝 · 날개 끝, 몽글 밑단, 마린 수첩 든 팔이 한 박자 늦게 따라 휘게 해 줘. 세기는 성격대로 — 몽글은 크게 두 번, 까몽은 통 튀며 꼬리 휙, 마린은 헬멧은 단단하게 두고 몸만 짧게 한 번. 움직임 줄이기에서는 멈추고, 친구들의 반응을 끄면 지금 인사만 둔다. 지금 기우뚱 인사와 나란히 놓은 비교 페이지(PC 1280 · 휴대폰 390, 세기 · 가라앉는 빠르기 손잡이)로 보여 줘.

- 다 된 기준: 친구마다 전후 10초 영상과 그리기 수 · fps 표. 집 · 친구 고르기 · 옷장 시험 통과. 선택지를 끄면 지금 코드와 구조 · 화소가 같다.
- 작업량: 반나절. 그림 생성 없음, 새 그림 파일 없음.
- 위험: 세게 출렁이면 펠트가 고무처럼 보인다 — 펠트로 읽히는 세기까지만 쓴다. 옷 입은 몽글은 들어감이 옷에 가려 안 보일 수 있다(그때는 출렁만). 공개는 유호님이 비교를 보고 고른 뒤 따로 한다.

## 근거

- 재료: `%LOCALAPPDATA%/hermes/cache/synk-tips/DeGkI7ptD8K/` — intake.json, caption.txt, frames 01 · 04 · 08 · 09, 이번에 뽑은 more_001(위 판 1초 간격 18장) · more_002(빗질 8.5~11.5초, 0.5초 간격) · more_003(왼쪽 아래 설명 · 숫자 칸 확대) · more_004(조작판 확대).
- 읽은 파일: `experiences/synk-world-home/living-home-scene.mjs`(202 · 234~235행), `avatar-v3.mjs`(170~174행), `home-kkamong-avatar.mjs`(266~289 · 343~345행), `home-marin-avatar.mjs`(282~289행), `wardrobe-stage.mjs`(127~129행 — 옷장은 끌면 돌리기), `experiences/synk-town/day-residents.mjs`(593~617행), `docs/디자인/싱크타운_그림체_20261026/README.md`(진짜 3D 몽글 얹기 · 몽글 펠트 판 · WORLD 옷장 · 집 몽글 · WORLD 집 까몽 다시), `docs/디자인/게임_풍경과_재질.md`(10-09 방향 · 50행), `docs/디자인/싱크타운_찻집골목의하루_세로조각설계_20261022.md`(§2-1 렌더러), `docs/디자인/월드_시그널/README.md`(소리 69행 · 움직임 10-17), `DESIGN.md`(22 · 42행), `docs/_ops/결정.md` 맨 위(10-27 마스코트 손 쓰기 · 까몽 날개 · 성격 행), `docs/_ops/트랙.md`(싱크타운 194~195행), `docs/참고카드/카드/2026-10-26_GeyserJelly_디오라마블록.md`, `docs/참고카드/카드/2026-10-28_PolyWeather_날씨섬.md`.
- `onBeforeCompile` · `ShaderMaterial`을 쓰는 곳: `synk-world-home`의 `home-kkamong-avatar.mjs` · `environment-v4.mjs` · `garden-breeze-v5.mjs` 등, `synk-town`의 `day-scene.mjs` · `day-light.mjs` · `day-materials.mjs` 등(검색 10-28). WebGPU로 옮기면 모두 다시 써야 하는 범위다.
- 웹(10-28 확인):
  - three.js 설명서 「WebGPURenderer」(https://threejs.org/manual/pages/webgpurenderer.html) — WebGL 2 자동 대체, TSL, `ShaderMaterial` · `onBeforeCompile` · `EffectComposer` 미지원, 「still in an experimental state」.
  - web.dev 「WebGPU is now supported in major browsers」(2025-11-25, https://web.dev/blog/webgpu-supported-major-browsers) — Chrome · Edge 데스크톱 113, 안드로이드 크롬 121(안드로이드 12 이상 · 퀄컴/ARM), Safari iOS · iPadOS · macOS 26, Firefox 윈도 141 · ARM 맥 145, 안드로이드 파이어폭스는 진행 중.
  - 「Plush Octopus WebGPU prompt」 · 「AI Arena Opus 5.5 vs GPT-6.1 Sol octopus」 검색 — 공개된 프롬프트 · 코드를 찾지 못했다. 엔진 판단은 화면 글자로 했고, 프롬프트를 받으면 쓴 도구를 확인한다.
- 자료 속 지시: 본문의 「Comment "PROMPT" and I'll send you the complete prompt」 — 따르지 않음(댓글 안 함).
