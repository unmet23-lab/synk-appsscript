# PATH 실사 면접실 화면 다시 그리기 · 2026-10-12

유호님 「오늘 synk path에 vr기능 추가했는데 프론트가 엉망이야. gpt로 만들어서그런지 완전 불만족스러워. synk path 쪽 프론트 트렌디하게 잘 꾸며줘. 기존에 플렛폼 디자인 니가 다시 해줬던것처럼」에 따라 면접실 웹 화면과 웹 플랫폼의 PATH 상세를 플랫폼 「싱ㅋ 시그널」 문법으로 다시 그렸다. **로컬 반영이며 공개(synk.im)는 하지 않았다.**

디자인 규칙은 [플랫폼 시그널](../../../../docs/디자인/플랫폼_시그널/README.md#path-room-20261012), 사용 흐름 조사는 [PATH 설계](../../../../docs/SHIFT/VR직업체험_설계_v1.md#path-room-redesign-20261012)에 있다.

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `interview/film/rehearsal.html` | 유리 캡슐 머리글, 두 줄 제목·계기판, 영상 + 준비 패널(PATH 포스터), 결과 판·안내 카드를 같은 격자에. 모든 ID·`input[name=mode]`는 그대로 |
| `interview/film/rehearsal.css` | 새로 씀. 플랫폼 밤 토큰, 분할 캡슐, 알약 단추, 상태 점, 면접 중·휴대폰 배치 |
| `interview/film/rehearsal.mjs` | `render()`에 표시용 `body[data-phase/mode/mic/urgent]`, 결과를 내 답변·질문 의도·후속 질문 행으로 그림. 면접 진행 코드는 그대로 |
| `interview/film/strict-vr.mjs` | 방 둘러보기 단추를 클래스로(모양은 CSS), 창 테두리·그늘, VR 책상 안내판을 `paintStrictVRHUD`로 꺼내 다시 칠함. `BUTTONS` 좌표·카메라 수치·창 크기(92vw·80dvh)는 그대로 |
| `assets/path-vr-felt.webp` | synk.im PATH 첫 화면의 펠트 VR 고글 누끼와 같은 바이트 |
| `server.mjs`, `../../tools/package-path-interview.mjs`, `asset-sources.json` | 새 그림을 공개 파일 목록에 추가. 공개 머리글을 새 구조로(변환 이름 `…-v2`) |
| 웹 플랫폼 `experiences/synk-account/` | `platform.css`에 PATH 색·큰 「패스」 한 줄, `src/applications.mjs` 그림 이름, `src/platform.mjs` 첫 음성 준비 89MB→103MB(+시험 기대값), `tools/build-synk-account.js`에 그림 복사 한 줄. 같은 파일들의 다른 미커밋 변경(PATH 연결·Workspace 이름)은 다른 세션의 것이며 그대로 두었다 |

## 확인

- PATH 시험 `node --test "experiences/path-vr/tests/*.test.mjs"` 267/267. 웹 플랫폼 `platform-lifecycle`·`platform`·`core` 45/45.
- 로컬 4293에서 1440·1280·1024·390·320px 시작 화면: 가로 넘침 0, 시작 단추 윗선 1440×900 672px · 1280×720 657px · 390×844 704px(모두 첫 화면 안, 휴대폰은 바꾸기 전 공개판의 시작 단추보다 위).
- 글 입력으로 시작→첫 질문→답변→후속 질문→둘째 답변→완료를 1440·390에서 끝까지 진행, 콘솔 오류 0. 결과 판에 내 답변·질문 의도·후속 질문 세 행.
- 공개 후보(`node tools/package-path-interview.mjs --pages`의 출력)를 synk.im 주소 위에 덧씌워 같은 흐름 완주(공개 CSP 아래, 콘솔 오류 0). 공개본과 다른 파일은 `rehearsal.html`·`rehearsal.css`·`rehearsal.mjs`·`strict-vr.mjs`·`assets/path-vr-felt.webp` 다섯 개이고 나머지는 공개본과 바이트가 같다.
- 방 둘러보기(오른쪽 30°, 드래그 켜기, Esc 닫기)와 VR 책상 안내판 다섯 상태를 브라우저에서 그려 확인. 실제 Quest 착용은 하지 않았다.
- 웹 플랫폼은 공개 `account/platform.css`·`dist/platform.js`에 같은 세 가지만 바꾼 후보와 새 그림을 synk.im 위에 덧씌워 PATH 상세·카드 확인(콘솔 오류 0).

## Fable 검수(2026-10-12)

판정 「다듬기 필요」, P1 없음. 반영: 휴대폰 시작 단추를 첫 화면으로(600px 이하 장식 포스터 숨김·첫머리 압축), 음성 준비 전 비활성 주 단추를 조용한 선 알약으로, 면접 중 오른쪽 판을 영상 높이에 맞춤(한 줄 격자), 초록 면 위 작은 글자 흰색 88%(4.9:1 이상), 펠트 고글을 플랫폼 누끼 규칙대로 통째로 −3°, 첫머리 장식 점을 선으로, 상태 점을 플랫폼 값(#7E828A·#F96859)으로, 모노 라벨 최소 11px, 본문 판 반경 22, VR 입장 단추는 채움 대신 초록 점 + 옅은 실 테, 완료 꼬리표 문구 단순화. 그대로 둔 것: 면접 중 방 둘러보기·Quest 입장(10-12에 의도해 넣고 검증한 기능), 방 3D 배경색·VR 안내판 초록 주 단추(기기 화면이라 실착용 확인 뒤), 계기판 숫자 서체(취향). 검수 메모는 세션 scratchpad에만 있다.

## 전후 화면

- [시작 전 1440](01-첫화면-1440.jpg) · [답변 중 1440](02-답변중-1440.jpg) · [완료 1440](03-완료-1440.jpg) · [휴대폰 390](04-휴대폰-390.jpg) · [플랫폼 PATH 상세](05-플랫폼-PATH상세.jpg) · [방 둘러보기](06-방둘러보기.jpg)

## 공개 반영 — 2026-10-12 23:10 KST

유호님 「PATH 공개 진행해」. 공개 저장소 `unmet23-lab/synk-policy`의 `origin/main`(`4d11178`) 위에 8개 파일만 얹은 `071f40f`를 올렸다(별도 인덱스, 로컬 main·작업본 안 건드림). [Pages](https://github.com/unmet23-lab/synk-policy/actions/runs/38260897056)·[synk.im 배포 점검](https://github.com/unmet23-lab/synk-policy/actions/runs/38260897837) 모두 성공.

- 바이트: synk.im에서 8/8 파일의 sha256이 올린 파일과 같다(`public/live-bytes.txt`, `public/published-files.txt`). 새 브라우저가 실제로 불러온 8개 파일 SHA도 같고 콘솔 오류 0(`public/loaded-source.json`).
- 공개 면접실(글 입력): 4K 시작 → 첫 답변 → 경험 후속 질문 → 둘째 답변 → 완료 35.8초(`public/flow-4k-1440.txt`, `public/complete-4k-1440.png`), 720p 48.3초(`public/flow-720p-1440.txt`). 결과 판 세 행 정상.
- 첫 4K 시도는 배포 직후 후속 4K 영상(11MB)이 늦게 와 2.05초에서 멈추고 「영상 재생이 멈췄습니다」로 끝났다(`public/flow-4k-1440-first-stall.txt`). 같은 망에서 바꾸기 전 판(4d11178의 네 파일을 덧씌움)은 끝까지 갔고(`public/flow-4k-1440-previous-version.txt`), 새 판도 다시 돌리니 끝까지 갔다. 재생기·영상은 바꾸지 않았으므로 일시적인 영상 수신 지연으로 보지만, 느린 망에서 4K가 멈출 수 있는 위험은 예전부터 있던 것이라 아래 최적화에서 다룬다.
- 웹 플랫폼 PATH 상세: 초록 면·「패스」·펠트 고글로 공개(`public/platform-path-1440.png`).

## 남은 것

- 공개 완료(위 절). 최적화는 10-13 `18c0363`으로 공개했다([최적화 기록](../optimize-20261013/README.md)). 아래 경로 안내는 그 전 기준이다. 면접실은 `node tools/package-path-interview.mjs --pages` 출력에서 다섯 파일만, 웹 플랫폼은 `.tmp/path-signal-redesign-20261012/platform-candidate/`(공개본에 세 가지만 바꾼 후보와 만든 스크립트)를 쓴다. 올리기 직전 공개 `origin/main`을 다시 받아 기준이 그대로인지 확인한다.
- 실제 Quest 브라우저에서 준비 패널·VR 책상 안내판 가독성, 실제 마이크 흐름의 사람 확인.
