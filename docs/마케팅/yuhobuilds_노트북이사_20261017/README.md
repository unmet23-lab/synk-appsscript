# yuhobuilds 「노트북 이사, AI한테 통째로 맡겨 봤어요」 · 2026-10-17

[기획](기획.md)(트리거·사실 대조·유호님 결정) · 영상 [remotion/](remotion/)(공개본) · 게시 문구 [게시/](게시/) · 맞춤 도구 `docs/마케팅/맞춤도구/move/`(synk.im/builds/move/)

**영상 도구(10-17):** 같은 날 결정 표 「영상 제작 도구」(새 영상은 만족한 결과물의 방식, HyperFrames는 기존 영상 수정만)에 따라 유호님 「Remotion으로 다시」. 만족 사례 S16(Remotion 4.0.535 모션그래픽)·S20(실제 화면 정보 영상 구성)과 같은 날 synkbrief 「AI 구독 계정판」 모션 v5 규칙(무대 하나·떠 있는 실제 화면·위로 밀어 넘기기 하나·장면당 펀치 하나·튕김/글로/크로스페이드 없음)을 builds 테마(검정 펠트·버터)로 옮겼다. 목소리·대본·낱말 시각·그림·로그 발췌·도구 캡처는 그대로 쓰고 움직임만 새로 짰다. 처음 만든 HyperFrames 판(`index.html`·`렌더.cjs`·`renders/*_draft.mp4`)은 그 규칙 전 초안으로 남겨 둔다(공개하지 않음).

10-17 유호님 「yuhobuilds 에 올릴 컨텐츠 하나 지금 같이 준비하자」 → 후보 셋 중 「② 노트북 이사 통째로 맡기기」. 훅 A(인스타)·C(유튜브), 목소리는 「최대한 재밌고 전달에 장점이 있는거 니가 알아서 판단해서」, 두 노트북은 「gpt image 2.5로 생성해서 써줘. 그리고 화면기록도 같이 사용해줘」, 프로그램 질문은 「더 짧게(질문 셋)」.

## 목소리 · Typecast 범수

- 10-17 유호님 「나레이션이 너무 별론데? 이 나레이션 뭐야 ?」(처음 판은 Gemini TTS Achird — 후보 9개를 귀로 안 듣고 받아쓰기 수치로만 고른 Claude 실수, 결정 표 10-10 「나레이션은 범수」를 어김) → 「앞으로 이거 쓰지 마. 범수로 하자.」(결정 표 10-17).
- `음성/범수_굽기.mjs`: 범수(`tc_5c3c52cb5827e00008dd7f3b`) · ssfm-v30 · 보통 감정 · 1.12배로 대사 14줄 + 훅 C 첫 줄을 굽고, 쉼 0.35초(화제가 바뀌는 대사 앞 0.5초)로 이었다. 384크레딧(125,252 → 124,868). 들려 드린 판(`음성/듣기/범수_A.mp3`)에 「좋아 이걸로 영상 다시 맞춰줘」.
- 시각은 받아쓰기 정렬 대신 Typecast가 준 낱말 시각으로 잡았다(`음성/범수_시각.py`). 받아쓰기 정렬은 숫자가 많은 문장 경계(p1→p2, f1→f2, f2→k1)에서 실제 무음과 0.3~0.7초 어긋났다. 이 단계가 `take/take.wav·take.json`을 만들고, `테이크_다듬기.py`는 이 판에서 쓰지 않는다.
- 훅 C 첫 줄은 범수가 3.53초로 읽어 A 첫 줄 자리(3.64초)에 꽉 차서, 그 줄만 1.06배(음높이 그대로)로 줄여 `C안_잇기.py`로 끼웠다(다음 문장까지 쉼 0.48초).
- 옛 Gemini 판의 스크립트(`한번에_생성.cjs`·`한번에_맞추기.py`·`테이크_다듬기.py`)와 후보는 기록으로 남긴다(나레이션에 다시 쓰지 않음).

## 화면 재료

| 재료 | 출처 | 진짜/만든 것 |
|---|---|---|
| 받기 로그 줄(훅 A, 7장면) | 새 PC `~/SYNK이전_로그/받기_log.txt` → `assets/media/log/받기_로그_발췌.json`·`log-lines.js` | 원문 그대로(시계가 맞은 뒤의 줄만) |
| 조각 39개·오류 0 | `받기_상태.json` parts_done | 기록값 |
| 원드라이브 5GB·바탕화면 11.25GB·1,515개 | `.tmp/노트북교체_20261015/인계.md` §0 | 기록 원문(메일 주소는 「…」로 줄임) |
| 첫 규칙 넷·이유, 10.16 08:06 | 인계 §0 | 기록 원문 |
| 지킴 2.7만 개·`1차-지킴.txt.zst`·주석 | 인계 §0, `6_드라이브올리기.py` 482·529행 | 기록 원문(주석 앞부분) |
| 결정 인용 | 인계 §0 유호님 10-16 아침 | 원문 그대로 |
| 두 노트북 나란히 | GPT 이미지 2.5(구독, `tools/codex계정.js`, bake1) 2장 중 2번 · 지시문 `assets/media/gen/노트북_나란히.txt` | AI 이미지 — 화면에 「AI 이미지」 |
| 맞춤 도구 화면·세 사람 결과 | `assets/media/tool/`(로컬 빌드 390×844@3 캡처, 결과 글은 도구가 낸 그대로) | 실제 화면 |
| 얼굴 | 지난 편과 같은 캐스팅북 모델컷 | 확정 얼굴 |
| 음악·효과음 | 지난 편과 같은 시티팝_147 + 브랜드 사운드킷 + Pixabay([CREDITS](assets/media/sound/CREDITS_pixabay.md)) | — |

말하지 않는 것: 노트북 값·판매처, 키·토큰·계정 이름. 「AI가 다 했다」고 하지 않는다(첫 설정·로그인·앱 닫기는 유호님).

## Remotion 판(공개본)

- 코드: `remotion/src/`(`Film.tsx` 무대·전환·소리, `scenes.tsx` 장면 열, `lib/cine.tsx` 부품, `t.ts` 낱말 시각 → 프레임). 컴포지션 `move-A`(인스타)·`move-C`(유튜브, 목소리 `take_C.wav`).
- 재료: `node 준비.mjs`가 이 폴더의 목소리·그림·로그·도구 결과·키트를 `remotion/public/`과 `src/data.json`으로 모은다(둘 다 git 밖).
- 렌더: `node 렌더.mjs AC` → `renders/yuhobuilds_노트북이사_A_인스타.mp4`·`…_C_유튜브.mp4`. Remotion 믹스는 봉우리가 0dBFS를 넘어 소리만 volume −1.5dB + alimiter 0.84로 마감한다(범수 판 A·C: −14.2 LUFS · −1.4/−1.5 dBFS, 53.6초).
- 자막 아래끝 1356(키트 기본 180 대신 120 내림, HyperFrames 초안 검수 지적).

## 다시 만드는 법(목소리·HyperFrames 초안)

```bash
# 목소리(음성 폴더 기준 경로는 각 스크립트 머리말)
node 음성/한번에_생성.cjs --유료-api --voices Achird --tag r1
HF_HUB_OFFLINE=1 STT_MODEL=small python 음성/한번에_맞추기.py 음성/후보/3.8-flash__Achird_r1.wav
python 음성/테이크_다듬기.py 음성/후보/3.8-flash__Achird_r1.wav          # → 음성/take/take.wav
python 음성/C안_잇기.py 음성/후보/3.8-flash__Achird_h1c_2.wav           # → 음성/take/take_C.wav
node 음성/넣기.cjs --carve ~/.claude/skills/hyperframes-audio/scripts/carve.mjs --core <@hyperframes/core 0.8.167 설치 폴더>
# 점검·렌더
npx --yes hyperframes@0.8.167 check
node 렌더.cjs AC                       # renders/…_A_인스타.mp4 · …_C_유튜브.mp4
```

- `렌더.cjs`의 C는 index.html의 목소리 src를 잠깐 `take_C.wav`로 바꿨다가 바이트 그대로 되돌린다(미디어 src를 변수로 바꾸면 렌더 소리에 안 들어간다).
- 그림 굽기: `node assets/media/gen/굽기.cjs <지시문> <이름>` — 한 번에 한 장, 보조 계정부터 돌린다.
- 키트: `node tools/SNS키트_영상연결.js <이 폴더>`로 `assets/synk-kit/`를 다시 넣는다(`motion.js`만 저장소에 둔다).
