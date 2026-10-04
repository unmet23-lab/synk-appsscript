# yuhobuilds 「AI한테 한 줄 시켰더니」 · 초안(2026-10-03)

[기획](기획.md) · [원고](원고.md) · 컴포지션 [index.html](index.html) · 표지 [표지.html](표지.html) → `out/01_cover916_cover.png` · 게시 문구 [게시/](게시/)

2026-10-03 유호님 요청 「ep01도 gpt로 만든거라 좀 별로같아. 니 스타일데로 아까 알려준 방식 잘 적용해서 하나 만들어봐줄래? 그리고 목소리는 타입캐스트에 내 목소리 학습시킨거있어 그걸 사용해줘봐」로 만들었다. **렌더함 · 유호님 시청·청취 전 · 게시 전.**

- 렌더: `renders/yuhobuilds_한줄시켰더니_A_인스타.mp4`(0초 훅 A 질문형), `renders/yuhobuilds_한줄시켰더니_B_유튜브.mp4`(B 결과 먼저). 둘 다 45.0초, 1080×1920·30fps, H.264 + AAC 48kHz 스테레오, 15.0MB. 바탕화면 `yuhobuilds_한줄시켰더니` 폴더에 영상·표지·게시 문구 사본.
- HyperFrames `0.8.114`(10-03 0.8.111에서 올림), `npm run check` 오류 0, 글자 대비 44/44.

## 목소리 · 타입캐스트 「유호」(새로 학습)

- 10-03 유호님 「힉스필드로 학습하면 안되는데. 타입캐스트로 재학습시켜서 알려줄래?」, 「바탕화면에 있는 이 두개를 사용하면 될거야」(`음성 260922_230839.m4a`·`음성 260923_231130.m4a`), 「ㅅ발음이 약간 씹히는 특성이있는데 음색만 내 음색이면 되고 발음은 좋아졌으면 좋겠어」.
- 그 계정에는 학습 목소리가 없었다(`/v1/custom-voices`·`/v3/voices?voice_type=custom` 모두 0개). 그래서 타입캐스트 **퀵 클로닝**(5~150초)으로 새로 만들었다: `uc_6ac101aa0b6986f24a687878`「유호」, ssfm-v30, completed(`음성/clone-result.json`). 요금제 lite, 연결 때 월 제공 크레딧 잔량 193,802.
- 학습 파일 `음성/학습/yuho_typecast_train.wav`(142.3초, git 밖)는 [학습파일_만들기.py](음성/학습파일_만들기.py)가 두 녹음에서 유호님 혼자 말한 깨끗한 문장 26개를 골라 만든다. 9/22 녹음은 잡음 바닥이 −38.8dB(9/23은 −51.6dB)라 깨끗한 창이 하나뿐이어서 세 문장(10.8초)만 들어갔다.
- **ㅅ 발음:** 문장을 고를 때 ㅅ·ㅆ가 소리 나는 자리(첫소리, 받침 연음)가 적은 문장을 앞에 둬서 ㅅ 비율을 후보 평균 0.139 → 0.09로 낮췄다. 음색은 유호님, ㅅ 발음은 타입캐스트 기본 쪽에 가깝게 남기려는 것이다. 귀로는 확인하지 못했다.
- 대사 12개: `음성/audio/<id>.wav·json`(Typecast 낱말 시각 포함, smart 감정). [받아쓰기_확인.json](음성/받아쓰기_확인.json)(로컬 faster-whisper small)에서 평균 일치 0.918, 평균 초당 5.6음절, 말 합계 37.7초. 귀로 확인할 곳: h2·s1의 「몽골어」(받아쓰기 「문고로」·「옹거러」), s1의 「검수」(「광수」).
- 연결 화면 [voice-connection.cjs](음성/voice-connection.cjs)(127.0.0.1:5213)는 키를 메모리에만 4시간 둔다. 학습·생성은 [생성.cjs](음성/생성.cjs)(`--clone`, `--force id,…`).
- 10-03 힉스필드 Seed Audio로 h1 한 줄을 시험 생성했다(0.5크레딧, `음성/hf/`, git 밖). 유호님이 힉스필드는 쓰지 않기로 해서 영상에 쓰지 않았다.

## 시각을 정하는 법

장면·자막·효과음 시각은 초로 적지 않고 대사에 붙어 있다. 목소리를 바꾸면:

```bash
node 음성/생성.cjs --force h2,s1          # (연결 화면에 키를 넣은 뒤) 다시 만들 대사
node 음성/넣기.cjs --carve ~/.claude/skills/hyperframes-audio/scripts/carve.mjs --core <@hyperframes/core 0.8.114 설치 폴더>
npx --yes hyperframes@0.8.114 check
npx --yes hyperframes@0.8.114 render --quality delivery --output renders/yuhobuilds_한줄시켰더니_A_인스타.mp4
npx --yes hyperframes@0.8.114 render --quality delivery --variables '{"hook":"B"}' --output renders/yuhobuilds_한줄시켰더니_B_유튜브.mp4
```

- `넣기.cjs`는 첫 말소리를 0.3초에, 다음 대사를 앞 말끝 + `gapBefore`에 두고, 파일 앞 무음이 길면 `data-media-start`로 자른다(h1 0.14초). `음성/timing.js`(window.VO)와 `data-anchor`가 달린 효과음·영상의 시각, 영상 길이(마지막 말끝 + 1.6초)를 다시 쓴다.
- 음악(시티팝_147, 48초 지점부터)은 carve(세기 0.6)로 목소리 대역을 비키고, 말하는 동안 −8dB duck. 대사 사이가 1초보다 짧아 0.3~43.4초 내내 낮춘 상태다.
- 측정(A안): 통합 −15.2 LUFS(렌더가 −1dBTP를 넘지 않게 1.1dB 낮춤), 말 구간 −14.7 LUFS, 끝 음악만 −17.9 LUFS.

## 화면 재료

- 실제 캡처: Business Suite 예약 목록(`assets/media/shots/bs_scheduled.png`, 10-03 크롬 unmet23), LAB 릴스 렌더본(`lab_reel.mp4`, git 밖 — LAB 폴더 `renders/…_MN_v2.mp4` 사본), 맞춤 도구 화면(`assets/media/tool/01~06`, 로컬 빌드를 390×844@3으로 캡처, `녹화기록.json`).
- 키트: `node tools/SNS키트_영상연결.js <이 폴더>`로 `assets/synk-kit/`을 다시 넣는다(LAB처럼 `motion.js`만 저장소에 둔다).
- 효과음: 브랜드 사운드킷 + Pixabay(상업 이용 가능, [CREDITS](assets/media/sound/CREDITS_pixabay.md)).

## 맞춤 도구 · synk.im/builds

`docs/마케팅/맞춤도구/manual/`(빌드 산출 `dist/builds/manual/` + `dist/builds/index.html`). 질문 5개 → 프로젝트 지침에 붙여 넣을 「내 AI 직원 매뉴얼」, 한 줄 명령, 사람 차례 확인표. `node --test manual/rules.test.js` 18/18, `node build.mjs manual` 통과. **synk.im 배포 전**(유호님 승인 뒤). 근거 보강 중 작업이 멈춰 [탐색노트](../맞춤도구/manual/탐색노트.md)의 마지막 근거(퍼블리시티·개인정보·번역 정확성·AI 표시·에이전트 보안) 대조는 끝까지 확인하지 못했다.

## 남은 것

1. 유호님 시청·청취: 음색, ㅅ 발음, 「몽골어」 두 곳.
2. synk.im/builds 배포 승인 → 배포 뒤 영상 끝 화면을 공개 주소 캡처로 바꿀지 결정(지금은 로컬 빌드 캡처).
3. 게시 승인: 10/7(수) 저녁 8~9시, yuhobuilds 인스타(A안)·유튜브 쇼츠(B안), AI 표시 켬.
