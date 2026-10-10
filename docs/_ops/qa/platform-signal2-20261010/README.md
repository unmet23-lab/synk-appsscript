# 싱ㅋ 시그널 2 · PC 설치본 반영·웹 공개 기록 (2026-10-10)

유호님 「PC 설치본에 반영해줘 그리고 푸시해줘」에 따라 현재 PC의 **SYNK Platform Preview 0.4.0** 설치본에 2차 화면을 넣었다.

## 한 일

- 설치된 `%LOCALAPPDATA%\Programs\SYNKPlatformPreview\resources\app.asar`를 풀어, 화면 파일 다섯 개만 2차 판으로 바꾸고 다시 묶어 갈아 끼웠다: `renderer/launcher.css`·`member-home.css`·`convenience.css`·`member-home.mjs`·`index.html`.
- 다른 파일은 손대지 않았다. 묶음 안 파일 73개 중 다섯 개만 달라졌고, 나머지 68개는 바이트까지 같다(`install.json`의 `differingPaths`).
- 바꾸기 전 설치본이 그때의 작업본 원본과 같은지 먼저 봤다. 화면 파일 다섯 개와 패키징 때 생기는 `package.json`·`runtime.json`만 달랐다. 곧 직전 설치(v4)의 코드 위에 화면만 얹은 것이다.
- 교체할 때 SYNK 앱은 실행 중이 아니었다. 설치기(NSIS)·등록·바로가기·WORLD·Workspace 설치는 건드리지 않았고, 버전도 0.4.0 그대로다.

| 항목 | 값 |
|---|---|
| 바꾸기 전 app.asar SHA-256 | `eaa006fec10921cbb2681fd52f791fa1ac3ceb008097a951be684209160cf45e`(직전 재설치 기록과 같음) |
| 바꾼 뒤 app.asar SHA-256 | `c715de9ed040dc974127ef95ba6d629ed574a47a3c104b0b10a5182849f200a5` |
| 원래 묶음 백업 | `%LOCALAPPDATA%\SYNK\platform-signal2-backup-20261010\app.asar`(SHA 같음 확인) |
| 바꾼 뒤 대조 | 설치본 ↔ 공용 작업본 `desktop/` 71개 같음, `package.json`(패키징 값)·`runtime.json`(설치 때 생성)만 다름 |

## 확인

- 바꾼 묶음을 풀어 숨김 Electron(합성 계정·외부 요청 차단)으로 열어 첫 화면이 새 디자인으로 뜨고 글꼴·그림이 모두 불러와지는 것을 봤다.
- 데스크톱 시험 `node --test desktop/tests/*.test.cjs` **507/507**, 웹 계정 시험 `experiences/synk-account` **559/559**(바꾸기 전과 같은 수).
- 숨김 Electron 화면 점검 도구 10개 통과(renderer-responsive · member-home · convenience · convenience-home · benefits · platform-library · platform-input · platform-note-management · connection · desktop-preferences). 다른 5개(app-compaction · development-catalog · experience · fortune-platform · continuity-exit)는 **바꾸기 전 원본에서도 같은 항목에서 실패**한다(앱 9→8개 통합·Ctrl+K 동작 변경 뒤의 옛 기대값). 2개(personal · world-play)는 점검용 작업본에 없는 폴더를 읽어 돌지 않았다.
- 실제 계정으로 로그인한 화면, 설치본을 직접 켠 화면은 확인하지 않았다. 다음에 앱을 켜면 새 화면으로 열린다.

## 되돌리기와 주의

- 되돌리려면 앱을 끈 뒤 백업 `app.asar`를 같은 자리에 다시 복사한다.
- `desktop/artifacts/platform-reinstall-20261010/`의 Platform 재설치 파일은 **바꾸기 전(v4) 화면**을 담고 있다. 그 파일로 다시 설치하면 2차 화면이 사라진다. 최신 재설치 파일은 WORLD 펠트 책까지 넣은 `desktop/artifacts/platform-reinstall-worldbook-20261010/`이다([기록](../platform-reinstall-worldbook-20261010/README.md)).

## 웹 공개(synk.im)

유호님 「synk.im에 웹 플랫폼 공개해줘」에 따라 [공개 플랫폼](https://synk.im/account/platform.html#home)에 2차 화면을 올렸다(synk-policy `a4c8f92`, 2026-10-10 10:21).

- 바꾼 공개 파일은 `account/platform.css`·`account/benefits.css` 두 개다. 페이지·스크립트·설정·그림은 공개본 그대로 두었고, 새 CSS가 쓰는 글꼴은 공개본 `account/assets/`에 이미 있다.
- 공개본의 `dist/platform.js`·`src/platform-library.css`·`client.html`·`platform.webmanifest`·`config.json`은 로컬 작업본과 다르다(스크립트는 공개본이 이전 판). 그래서 화면 확인은 공개본 `account/` 트리(synk-policy `1a57977`)에서 두 CSS만 바꾼 후보로 했다.
- 공개 전 최종 검수에서 두 가지를 고쳤다(SYNK-appsscript `a68372596`): 760px 이하에서 라이브러리 분류·컬렉션 알약 묶음이 두 줄로 접히던 것을 위쪽 메뉴처럼 한 줄 가로 흐름으로 바꿨고, 공개 파일 머리 주석의 제작 도구 이름을 뺐다.

| 확인 | 결과 |
|---|---|
| 후보 화면: 비회원·합성 회원, 12개 화면 × 1440·390, 라이브러리·내 홈·혜택·앱 상세 × 320·760 | 콘솔 오류·실패 요청·가로 넘침 0, 글꼴(SUIT·Inter Tight·DM Mono) 불러옴 |
| 공개 파일의 제작 도구 이름 | 배포 점검과 같은 목록으로 두 파일 0건 |
| 공개 반영(바이트) | synk.im의 두 파일이 올린 파일과 같음(10:23) |
| 공개 뒤 실제 주소: 비회원, 7개 화면 × 1440·390 | 새 CSS 적용, 콘솔 오류·실패 요청·가로 넘침 0 |
| synk.im 배포 점검 | 통과 |

- 실제 계정으로 로그인한 화면은 보지 않았다(비회원·합성 회원만).
- 되돌리려면 synk-policy에서 `a4c8f92`를 되돌리는 커밋을 올린다(두 파일만 바뀐다).

### 웹 낮 테마·검색 축소 공개 (2026-10-10 19:06)

유호님 「웅 synk.im에 공개해줘」에 따라 웹 낮 테마와 검색 축소(원본 `e70312502`)를 공개했다(synk-policy `4a5d20d`).

- 바꾼 공개 파일은 `account/platform.html`(공개본에 같은 바꾸기를 얹음)·`account/platform.css`·새 `account/theme.js` 셋이다. 화면 스크립트 `dist/platform.js`는 그대로라 원본 쪽의 아직 공개 안 된 기능은 나가지 않았다.
- 공개 전: 공개본 트리(`a9af8be`)에 세 파일만 바꾼 후보로 합성 회원·비회원, 밤·낮·기기 설정(밝음), 1440·390에서 넘침·콘솔 오류·실패 요청 0, Ctrl+K 펼침(380px)·Esc 접힘(42px). 세 파일에 제작 도구 이름 0건.
- 공개 뒤: synk.im 세 파일이 올린 파일과 바이트로 같음(19:07). 실제 주소(비회원)에서 밤·낮이 바뀌고 테마 단추·검색 아이콘·Ctrl+K가 동작, 콘솔 오류·실패 요청 0. 배포 점검 통과.

### 꺾쇠 → 화살표 공개 (2026-10-10 19:18)

유호님 「웅 synk.im에 공개해줘」에 따라 꺾쇠→화살표(원본 `f2b492adc`)를 공개했다(synk-policy `4069726`). 바꾼 공개 파일은 `account/platform.css` 하나다: 화살표 글자(U+2190–2193)만 Inter Tight Medium(130%)으로 그리는 `SYNK Arrow` 글꼴 규칙.

- 공개 전: 공개본 트리(`4a5d20d`)에 이 CSS만 바꾼 후보로 비회원(밤)·합성 회원(낮) 1440·390 넘침·콘솔 오류·실패 요청 0, 단추 높이 그대로.
- 공개 뒤: synk.im의 파일이 올린 파일과 바이트로 같음(19:20). 실제 주소에서 「→」가 들어간 링크를 브라우저가 Inter Tight(`SYNK Arrow`)로 그리는 것을 글꼴 정보로 확인, 콘솔 오류·실패 요청 0. 배포 점검 통과.

### 공개 그림의 생성 도구 표시 빼기

공개 전 검수 때 공개본 그림·영상 4,255개를 훑어보니 세 장에 생성 도구 출처 표시(C2PA, OpenAI·ChatGPT·gpt-image 이름)가 들어 있었다: `account/assets/member/teacher-cover.png`, 같은 그림인 `rehearsal/assets/teacher-cover.png`, 어디서도 부르지 않는 `world/korean-rhythm/assets/signal-stage-original.png`. 유호님 「그리고 저거 지워줘 GPT」에 따라 뺐다.

- PNG의 C2PA 조각(caBX, 23,654바이트)만 걷어 냈다. IHDR·IDAT·IEND는 바이트 그대로이고, 풀어 본 픽셀도 같다.
- 공개본(synk-policy `0498aa6`): 그림 3장과 `rehearsal/build-manifest.json`의 크기·해시. 공개본 4,255개를 다시 훑어 0건.
- 원본(SYNK-appsscript `e6f55504a`): 정본 `docs/디자인/웹_단락이미지/20260919/lab-presentation.png`과 사본 `desktop/assets/launcher/teacher-cover.png`·`experiences/synk-account/assets/member/teacher-cover.png`, `experiences/korean-rhythm/assets/signal-stage-original.png`, 해시 기록 `정본.json`·`desktop/assets/launcher/sources.json`·`experiences/synk-account/build-manifest.json`. 다음에 다시 묶어 올려도 표시가 되살아나지 않는다. 데스크톱 「정본 바이트와 같은 사본」 시험 통과.
- 원래 표시가 든 파일은 git 기록에 남아 있다(교사 그림 blob `8157dc3f69`, 무대 원본 `94e8e9c47c`).
- 반영: synk.im 바이트 10:37, 배포 점검 통과. 설치된 PC 앱과 재설치 파일 속 교사 그림은 다음 재설치 파일을 만들 때 바뀐다.
