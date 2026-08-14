# 명품판 UI 오브젝트 렌더 — 생성 프롬프트 패키지 (v2 · 2026-08-14)

> **목적**: 앱 UI 를 「CSS 스킨」이 아니라 **렌더 그래픽 세계**로 올린다 — 마스코트 13컷과 같은 재질·조명으로
> UI 속 오브젝트(녹음 오브·진행 구슬·아이콘·보상 연출)를 실제 3D 렌더로 뽑는다.
>
> **v2(유호 확정 08-14 「전부 채택」)**: 레퍼런스 문법 5를 편입 — ①아이콘층도 재질로 굽는다(fluffy 실증 → §3 확정 승격)
> ②기능 계기(타이머·다이얼 눈금)가 세계 언어(rolling-dial → §7) ③**«안이 보인다»** — 오브 속에 그 학생의 수집물이
> 뜬다(encased-sweetness → §5 신설) ④살아있는 표정 = **마스코트 눈에만**(face-icon → 모션 명세 · 렌더 사물에는 눈 금지 유지)
> ⑤**전환 서사 층** — 제출이 「완료」 글자가 아니라 종이비행기 접힘 서사(paper-plane → §6 신설 · **재질 픽과 독립** — 유호
> 원문 「어떤 재질을 정하더라도 이런 식으로」). 입자 무대는 보류(유호 무언급 · 내 판정 유지). 재질 픽(ㄴ/ㄷ)은 여전히 열림.
> **통로**: ㉠Recraft(13컷을 만든 검증 통로 — 유호님 클릭) 또는 ㉡Gemini 이미지 생성(무료 · AI 직접).
> **규격(13컷 규약 그대로)**: 오브젝트 1개 · 중앙 · 밝은 무지 배경(회색 ~rgb 230 — `tools/마스코트누끼.js` 재사용) ·
> 같은 앵글·같은 조명 · 최대 해상도 · 그림자 없음(부유) · **SVG 변환 금지**(질감 사망).
> ⚠ 마스코트 본체는 재생성 금지(확정 렌더 유지 — 여기서 뽑는 건 «마스코트가 아닌 사물»뿐이라 충돌 없음).

## 공통 스타일 블록 (모든 프롬프트 앞에 붙인다)
```
Premium 3D render, translucent cherry-red jelly glass material, glossy wet surface
with soft internal glow, small bright specular highlights, studio product photography
lighting from upper left, floating object with no ground shadow, centered on a plain
light gray background (#E6E4E2), ultra high resolution, clean minimal luxury aesthetic,
same material family as a translucent cherry jelly glass figurine. No face, no eyes,
no mouth, no text, no logo.
```
(색은 가결 상태 — 색 재판정이 나면 `cherry-red` 낱말만 갈아끼운다. 재질·조명 규격은 색과 독립.)

## 오브젝트 목록 (우선순위순)

### 1. 녹음 오브 — 3상태 (앱의 신호 1점 · 첫 집행 대상)
- **대기**: `A perfect floating jelly glass orb, calm and still, one soft highlight`
- **녹음 중**: `The same jelly glass orb gently rippling, surface slightly wobbling as if reacting to sound waves, inner glow pulsing brighter`
- **처리 중**: `The same jelly glass orb compressed into a soft squashed shape, as if thinking, inner glow swirling`

### 2. 진행 구슬 (듣기·따라 말하기·답하기)
- **빈 구슬**: `A tiny clear glass bead, almost transparent, faint rim light`
- **찬 구슬**: `A tiny jelly glass bead filled with glowing liquid, bright and alive`

### 3. 3D 미니 아이콘 세트 (탭·기능 자리 — 토스 3D 아이콘 문법)
- 숙제: `A small closed notebook made of frosted jelly glass with a glowing bookmark ribbon`
- 기록: `A small jelly glass bar chart with three rounded rising bars, the tallest one glowing`
- 재생: `A small rounded triangle play button made of jelly glass, floating`
- 달력: `A small jelly glass calendar tile with one glowing rounded day cell`

### 4. 보상 연출 컷 (achieve 순간 배경)
- `Soft burst of tiny jelly glass droplets and light particles frozen mid-air, celebratory but restrained, no confetti, no text`

### 5. 성장 오브 — «안이 보인다» (encased 문법 · 유호 채택 08-14 · v2 신설)
> 오브 «안에» 그 학생의 오늘이 쌓인다 — 수집물(별·단어 구슬·작은 책)이 젤리 속 사탕처럼 떠서 저마다 은은히 발광.
> 개인화의 시각화: 화면의 오브 하나가 곧 «그 학생의 오늘»이 되는 자리(㉡사람 이해 층의 얼굴 후보).
- **다크 무대판(보드·앱 다크 화면용 — 누끼 불요)**: `The same floating jelly glass orb on a deep navy background, but inside the translucent jelly float tiny glowing collectibles — small stars, one tiny book, a few round word-beads — suspended like candies inside ice, each glowing softly with its own warm light, seen through the glass with gentle refraction`
- **밝은 배경판(앱 반입·누끼용)**: 같은 문장 + 공통 블록의 배경 규격(#E6E4E2)으로.
- ⚠수집물 개수는 3~7개(빽빽하면 「보관함」이 되고 성기면 「빈 병」이 된다 — 자라는 느낌이 급소).

### 6. 종이비행기 전환 컷 — 제출 서사 (⑤ 채택 08-14 · v2 신설 · **재질 픽과 독립**)
> 유호 원문: 「숙제를 보내면 그냥 "완료"가 아니라 종이접기 애니메이션 효과 이후 "완료" — 이용자에게 감동을」.
> 이 절은 ㄴ/ㄷ 어느 픽에서도 그대로 산다(전환 서사 층은 재질 축이 아니라 **모션 축**이다).
- **보드용 정지 1컷**: `A soft cream paper sheet frozen mid-fold, half-transformed into a paper plane, floating on a deep navy stage with warm light from upper left, delicate fold lines visible, quiet luxury, no text`
- 실구현은 렌더가 아니라 **프리베이크 시퀀스**(Lottie/스프라이트 · §모션 명세의 저가 게이트 동일) — 이 컷은 «세계 보드» 제시용.

### 7. 계기 링 — 렌더가 아니라 **벡터 합성** (rolling-dial 문법 · v2 명세)
> 녹음 링·진행 다이얼은 생성하지 않는다 — 렌더 오브 «위에» 코드 벡터(SVG)로 눈금 링(△○×+ 마커·가는 회전 링)을
> 얹는 합성이 정답이다(레퍼런스 실물도 그 구조·앱 구현과 동형 · 렌더에 링을 구우면 상태 변화마다 재생성 지옥).
- 링 문법: 가는 선 1.5px 내외 · 눈금 마커는 킷 크림 계열 틴트 · 회전은 상태(대기/녹음/처리)마다 속도만 다르게.
1. `node tools/마스코트누끼.js` 계열로 누끼(채도 기반 — 배경 규격이 같아 그대로 물린다)
2. 상태별 크기·앵글 정합 검수(녹음 오브 3상태는 실루엣 일치 필수 — 안 맞으면 그 상태만 재생성)
3. talk 반입 규격 = 512² WebP(`마스코트변환.py` 통로 재사용)

## 모션 명세 (렌더와 한 벌 — 이게 없으면 그림은 다시 「스킨」이 된다)
- 눌림 = 스프링 물리(쫀득 눌렸다 복원 · scale+squash · 300ms 내)
- **녹음 중 = 목소리 진폭에 젤리가 실시간 출렁인다**(expo-av 진폭 미터 → 오브 워블 강도) — 놀라움 1호 후보
- **마스코트 눈 = 마이크로 표정**(④ 채택 08-14 · face-icon 문법): 시선이 터치·진행을 따라오고, 깜빡이고, 완료 순간
  반달눈 — **입은 아낀다 확정 그대로**(기분은 눈·몸짓 · 렌더 «사물»에는 여전히 눈 금지 — 눈의 주인은 마스코트뿐).
- **전환 서사 층**(⑤ 채택 08-14): 제출·전송 같은 매듭 순간은 상태 글자 교체가 아니라 **짧은 서사**로 —
  1호 = 숙제 제출: 카드가 접혀 종이비행기 → 날아감 → 그 뒤에 「완료」(§6 · 800ms 내 · 스킵 가능해야 한다).
- 라이브 블러 0 · 전부 프리베이크(저가 안드로이드 게이트 — 분위기 판정 재료의 조건 그대로)
- 절제 규칙: 한 화면에 «살아 있는» 오브젝트는 1개(표현 예산 — 전부 살아 있으면 전부 죽는다) — 전환 서사도
  한 매듭에 1개(모든 버튼이 서사를 갖는 순간 전부 소음이 된다).

## 펠트 세계로 픽이 나는 경우
같은 목록·같은 규격에서 공통 스타일 블록만 펠트로 교체(`hand-felted wool material, visible soft fibers,
stitched seams` 등) — 패키지 구조는 재질과 독립이라 다시 쓰지 않는다.
