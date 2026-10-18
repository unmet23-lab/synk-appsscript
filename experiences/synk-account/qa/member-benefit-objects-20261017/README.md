# 웹 플랫폼 회원 혜택 포스터 · 2026-10-17

PC 앱 회원 혜택 포스터 다시 굽기([기록](../../../../docs/디자인/플랫폼_시그널/README.md#member-benefit-objects-20261017), master `4f328e127`)를 웹 플랫폼(`platform.html#benefits`)에도 옮겼다. 같은 물건 일곱 개, 같은 놓는 규칙. 10-18 synk.im/account에 공개했다(아래 「공개」). 바꾼 점과 PC와 다르게 한 곳은 [디자인 기록 · 웹 플랫폼에 옮기기](../../../../docs/디자인/플랫폼_시그널/README.md#member-benefit-objects-web-20261017).

## 사진

- [PC 앱과 나란히](../../../../docs/디자인/플랫폼_시그널/화면/웹회원혜택-PC나란히.jpg) — 왼쪽 PC(부모 세션 캡처 `회원혜택포스터-전후.jpg`의 이후 절반), 오른쪽 웹 1440 밤.
- [소개 머리 여섯 · 1440 밤](../../../../docs/디자인/플랫폼_시그널/화면/웹회원혜택-소개머리.jpg) — PC [소개 머리 여섯](../../../../docs/디자인/플랫폼_시그널/화면/회원혜택포스터-소개머리.jpg)과 같은 배열.
- [개요 밤·낮 · 1440](../../../../docs/디자인/플랫폼_시그널/화면/웹회원혜택-밤낮.jpg), [휴대폰 390](../../../../docs/디자인/플랫폼_시그널/화면/웹회원혜택-휴대폰.jpg)(밤·낮 개요, 성향·구독·플레저·앨범 소개 머리).
- [혜택을 담았을 때](../../../../docs/디자인/플랫폼_시그널/화면/웹회원혜택-담음.jpg) — 기기 라이브러리에 혜택 넷을 담아 홈 바로가기·라이브러리 카드에 나오는 물건.

## 확인

`check.mjs`가 로컬 정적 서버의 작업본을 헤드리스 Chrome으로 열어 잰다. 창 10가지(2560×1440 2배 · 1920 · 1440×900 2배 · 1366×768 · 1280×720 · 1024 2배 · 900 2배 · 768 2배 · 390 3배 · 320 2배) × 회원 혜택·소개 여섯·홈·둘러보기, 1440·390은 낮과 「혜택을 담은」 홈·라이브러리까지 112화면.

- 물건과 큰 한글·상태 칩의 거리를 물건의 실제 그림 점(알파 40 넘는 칸을 −3° 회전·바닥선 맞춤까지 화면 좌표로 옮김)과 글리프 윗선으로 쟀다. 가장 좁은 곳 물건–큰 글자 13px(390 플레저 소개), 물건–칩 3px(1440 플레저 카드). 겹침 0.
- 가로 넘침 0, 회원 혜택 구역 한글 13px 미만 0, 빠진 파일·콘솔 오류 0(로컬 정적 서버에 없는 `config.json`·`desktop/releases/preview.json`은 뺐다). 결과 [report.json](report.json).
- 웹용 그림 크기는 같은 측정의 「그려진 크기 × 화면 배율」 최대값으로 정했다([웹그림](../../../../docs/디자인/플랫폼_시그널/웹그림/README.md)). 원본과 웹용 판을 같은 화면 36장으로 찍어 바뀐 칸 안 평균 차이 1.1/255 이하.
- 웹 시험 `node --test tests/*.test.mjs` 364/366 — 실패 2개(`shared-server.test.mjs`의 PATH 공유 서버 CSP `connect-src`)는 바꾸기 전에도 같다. 바꾸기 전 실패하던 회원 혜택 목록 시험(구독이 빠진 기대값)은 고쳤고, 웹이 그리는 혜택 그림이 모두 빌드·서버 허용 목록에 있는지와 성향 소개가 포스터 틀로 열리는지 보는 시험을 더했다.
- 웹 성향 점검 `qa/member-insight-smoke.cjs` 242/242(빠진 파일 0). PC 혜택 네이티브 점검 19/19, PC 성향 네이티브 점검 275/275(공유 `member-insight.css`를 바꿔서 같이 돌림). `node tools/build-synk-account.js --check` 통과.
- 학습 허브 서버 시험은 170/172 — 실패 2개는 이 워크트리에 없는 미추적 소리 파일(`word-magic/audio`)·`consult` 경로 404로 이번 변경과 무관하다.

Fable 검수 「가볍게 다듬기」(P2 1 · P3 5) — 카드 라벨 무게(450 → 550)와 구독 소개의 담기 단추, 이 스크립트의 Playwright 경로를 고친 뒤 다시 잰 값이 위 숫자다. [검수 전문](../../../../docs/디자인/플랫폼_시그널/Fable_검수_웹회원혜택포스터_20261017.md). 원본 캡처 41장은 공용 작업본 `.tmp/web-benefit-posters-20261017/shots-final/`(저장소 밖).

## 다시 돌리기

```bash
node tools/build-synk-account.js --talk-root ../SYNK-talk
node experiences/synk-account/qa/platform-weight-20261013/static-serve.mjs "$PWD/experiences" 4431
node experiences/synk-account/qa/member-benefit-objects-20261017/check.mjs http://127.0.0.1:4431/synk-account/platform.html <출력 폴더> --shots
python -X utf8 experiences/synk-account/qa/member-benefit-objects-20261017/compose.py <출력 폴더> docs/디자인/플랫폼_시그널/화면
```

정적 서버는 같은 날 끊긴 요청의 파일을 닫게 고쳤다 — 그 전 판은 점검 뒤 빌드가 그림을 못 바꿨다([현장 노트](../../../../docs/현장노트/시험_화면확인.md)).

## 공개 (2026-10-18, synk-policy `6aa13b8`)

공개본 `account/dist/platform.js`는 GPT 릴리스 판이라 master로 다시 묶지 않고 [`patch-live.cjs`](patch-live.cjs)로 회원 혜택 부분만 얹었다(옛 판 컴파일이 공개본과 바이트가 같은지 먼저 확인, 결과 [patch-report.json](patch-report.json)). 공개본에 있는 혜택 다섯만 그림·대체 글을 바꿨고 구독 카드는 넣지 않았다. 올린 파일: `dist/platform.js`·`benefits.css`·`member-insight.css`, `assets/member/benefit-{gift,insight,care,fortune,rehearsal,album}.webp`(추가 6 · 수정 3 · 지움 0).

- 올리기 전: 실제 `https://synk.im/account/platform.html`에 후보 아홉 개를 끼워(`SYNK_CANDIDATE_DIR`) 112화면 문제 0.
- 올린 뒤: curl 바이트 대조 9/9(HTTP 200), 공개본 112화면 문제 0, 「synk.im 배포 점검」 성공(run 39083260317). 캡처 [공개본 1440·390](../../../../docs/디자인/플랫폼_시그널/화면/웹회원혜택-공개본.jpg), 원본 41장은 공용 작업본 `.tmp/web-benefit-posters-20261017/live-after/`.

## 구독 카드 (2026-10-18, synk-policy `e9cf357`)

GPT 0.4.24(`b45319c`·`cb7005c`)가 리허설·앨범을 빼고 AI 구독 계정판 카드·소개를 공개본에 넣은 뒤, 그 위에 `9812277bd`의 웹 쪽 손질만 얹었다 — 구독 카드 단추 「내 기록 살펴보기」 → 「어떤 경험인가요?」(내 기록은 성향만), PC 앱 안 혜택 소개의 링크 「SYNK ID 알아보기」 → 「PC 앱 받기 →」(`#downloads`), 홈 바로가기 큰 글자를 화면 읽기에서 뺌(`platform.css` 한 줄). 번들은 [`patch-live-subscriptions.cjs`](patch-live-subscriptions.cjs)가 공개본에 정확히 한 번 있는 두 식만 바꿨고, `platform.html`의 `?v=`를 새 번들 sha256 앞 12자로 바꿨다.

- 올리기 전: 실제 주소에 후보 셋을 끼워 112화면 문제 0(이때 route가 HTML을 `text/html`로 돌려주게 `check.mjs`를 고쳤다).
- 올린 뒤: curl 바이트 대조 3/3(HTTP 200), 공개본 112화면 문제 0, 「synk.im 배포 점검」 성공(run 39115079171). 캡처 [공개본 구독 카드·소개](../../../../docs/디자인/플랫폼_시그널/화면/웹구독카드-공개본.jpg).
- 공개 소개 글은 GPT `cb7005c`에서 도구 이름을 뺀 판이다. 10-18 GPT 인수에서 두 문장을 공통 `desktop/renderer/benefits.mjs`에 반영했다. 다음 릴리스는 [원천·동결 포함 조건](../../../../docs/SYNK_플랫폼_계정과_연결_설계.md#member-benefits-next-release-20261018)을 따른다. 이 스크립트로 공개본을 부분 수정할 때도 최신 공개본 위에서만 바꾸고 HTML 캐시 번호를 함께 갱신한다.
