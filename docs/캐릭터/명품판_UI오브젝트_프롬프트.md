# 명품판 UI 오브젝트 렌더 — 생성 프롬프트 패키지 (v1 · 2026-08-14)

> **목적**: 앱 UI 를 「CSS 스킨」이 아니라 **렌더 그래픽 세계**로 올린다 — 마스코트 13컷과 같은 재질·조명으로
> UI 속 오브젝트(녹음 오브·진행 구슬·아이콘·보상 연출)를 실제 3D 렌더로 뽑는다.
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

## 생성 후 파이프라인 (수령 시 AI 가 처리)
1. `node tools/마스코트누끼.js` 계열로 누끼(채도 기반 — 배경 규격이 같아 그대로 물린다)
2. 상태별 크기·앵글 정합 검수(녹음 오브 3상태는 실루엣 일치 필수 — 안 맞으면 그 상태만 재생성)
3. talk 반입 규격 = 512² WebP(`마스코트변환.py` 통로 재사용)

## 모션 명세 (렌더와 한 벌 — 이게 없으면 그림은 다시 「스킨」이 된다)
- 눌림 = 스프링 물리(쫀득 눌렸다 복원 · scale+squash · 300ms 내)
- **녹음 중 = 목소리 진폭에 젤리가 실시간 출렁인다**(expo-av 진폭 미터 → 오브 워블 강도) — 놀라움 1호 후보
- 라이브 블러 0 · 전부 프리베이크(저가 안드로이드 게이트 — 분위기 판정 재료의 조건 그대로)
- 절제 규칙: 한 화면에 «살아 있는» 오브젝트는 1개(표현 예산 — 전부 살아 있으면 전부 죽는다)

## 펠트 세계로 픽이 나는 경우
같은 목록·같은 규격에서 공통 스타일 블록만 펠트로 교체(`hand-felted wool material, visible soft fibers,
stitched seams` 등) — 패키지 구조는 재질과 독립이라 다시 쓰지 않는다.
