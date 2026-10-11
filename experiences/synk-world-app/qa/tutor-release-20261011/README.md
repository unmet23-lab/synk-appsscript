# WORLD 튜터·표정 공개 반영 — 2026-10-12

[공개 WORLD 앱](https://synk.im/world/)에 튜터 선택, 조작 연습, 오답 힌트, 생활 한국어·카페 동행, 홈의 연습 기억과 세 마스코트 표정 교정을 반영했다. 공개 주소의 실제 파일과 새 게스트 브라우저에서 확인했다.

- 원천: `SYNK-appsscript` 커밋 `4e57536c0ee7db8747d840526e5dc09f47dc06ed`.
- 공개: `unmet23-lab/synk-policy`의 `0c042b59d29cea4f0356705bbc3e22c858eac110` 위에 `b21305b7afae74cbe726d797a12578dc78816e83`을 non-force push했다.
- [Pages 배포](https://github.com/unmet23-lab/synk-policy/actions/runs/38150671817)와 [기존 공개 검사](https://github.com/unmet23-lab/synk-policy/actions/runs/38150671836) 모두 성공. [호스팅 확인](hosting.json).
- 기존 공개 트리를 바탕으로 WORLD 관련 843개 파일만 반영했고 삭제는 0개다. 조작 연습에서 사용하는 기존 승인 한글 음성 713개를 포함한다. 계정·타운·옷장 핵심 런타임 9개는 기존 바이트 그대로 보존했다.
- 공유 공개 저장소의 작업 파일·index를 바꾸지 않고 별도 index로 공개 커밋을 만들었다. 다른 작업의 미커밋 파일은 배포하지 않았다.

마무리 중 다른 작업의 공개 `7e86605a`가 이어졌다. 이 후속 커밋은 홈페이지·공개 계정 진입 등 19개 파일만 바꾸고 `world/`는 변경하지 않았다. 튜터 공개 커밋이 조상으로 남고 검증한 WORLD 파일이 보존된 것을 다시 확인했다. [후속 공개 대조](hosting-followup.json).

## 공개 검증

| 범위 | 결과 | 증거 |
|---|---|---|
| 변경 파일 843개 + 보존 런타임 9개 HTTP·SHA-256 | 852/852 일치 | [public-http.json](public-http.json) |
| 기본 주소 → 실제 오프닝 → 첫 튜터 선택 → 홈 | 17/17 | [기본 진입](../tutor-switch-20261011/public-opening-20261012-r2/report.json) |
| 마린 → 까몽 → 몽글 → 마린 교체, 홈·생활·카페·재방문 | 141/141 | [교체 검수](../tutor-switch-20261011/public-20261012-r2/report.json) |
| 홈 표정·자연 깜빡임·연습·하루 정리·화면 크기 | 206/206 | [홈 표정](../home-expressions-20261011/public-final-20261012/report.json) |
| 실제 게스트 게임 입구 + 별도 독립 게임 구성요소 | 214/214 | [게임 검수](live-games/report.json) |

브라우저 오류·누락 자산·외부 요청·서버 쓰기는 각 최종 검사에서 모두 0이다. 모바일 390px·320px·가로 844px, 데스크톱 1440px에서 홈을 확인했다. 눈 62회 비교의 최대 차이는 RGB 2/255, 몸통은 0이었다. 실제 UI 캡처를 먼저 저장하고, 별도의 픽셀 대조에서만 흰 배경을 사용해 투명 털 뒤의 영상·반투명 카드 영향을 분리했다. 원래 허용 기준 `≤2`를 유지했다.

직접 확인한 대표 화면:

- [까몽이 마린과의 이전 연습을 기억하는 홈](../tutor-switch-20261011/public-20261012-r2/kkamong-next-day-remembers-marin.png)
- [마린의 연습 성공](../home-expressions-20261011/public-final-20261012/marin/390-home-success-settled.png)
- [몽글의 홈 인사](../home-expressions-20261011/public-final-20261012/mongle/390-welcome.png)
- [까몽의 오답 도움](../home-expressions-20261011/public-final-20261012/kkamong/390-practice-retry.png)
- [몽글의 게임 힌트](live-games/2-mongle-rhythm-hint.png)
- [까몽의 게임 성공](live-games/1-kkamong-runner-success.png)

## 검증 경계와 재시도 기록

공개 앱의 실제 게스트 게임 진입은 기존 SYNK ID 연결 안내까지 확인했다. 로그인은 실행하지 않았다. 게임 214개 검사는 그 입구 확인에 이어, 격리 브라우저에서만 `home.connectHost(null)`로 기존 독립 게임 구성요소를 설치해 실제 조작·문항 반응을 확인한 결과다. 운영 계정으로 로그인해 게임을 완료하거나 서버 진도를 저장한 검증으로 해석하지 않는다. 실제 계정 재로그인·다른 기기 동기화·실물 휴대폰은 미확인이다.

이번 배포는 공개 웹앱이다. PC의 WORLD Preview 설치 프로그램을 다시 만들거나 재설치한 것은 아니다. 확인 당시 설치된 Preview는 `127.0.0.1:4280` 개발 진입 주소를 사용했으므로 공개 웹 배포와 구별한다.

첫 공개 검사에서 캡처 시점이 이미지 디코드·오프닝 가림막 제거·새 게임 iframe 준비보다 빨랐던 검사기 문제를 수정했다. 홈 픽셀 비교는 투명 영역 뒤 배경 변화가 섞였으며 별도의 불투명 배경 대조로 분리했다. 제품 소스·정본 이미지·허용 오차를 바꾸지 않았다. 첫 실행과 중간 실패 보고서는 해당 `public-20261012`, `public-ready-20261012`, `public-stable-20261012`, `live-games/attempt1-report.json`에 보존했다. 최종 표의 보고서가 완료 근거다.

배포 전 동일 후보의 교체 141개·홈 206개·게임 214개도 통과했다. 공개 검사와 합산하지 않는다. 캐시가 이전 모듈을 섞지 않도록 변경 모듈·진입 HTML의 참조에 `tutor-4e57536c0` 버전을 붙였다. 카페 PNG 공개 사본의 `caBX` 제작 메타데이터만 제외했고 실제 픽셀 청크와 저장소 원본은 보존했다.

## 결과 파일과 재검사

[publication.json](publication.json)에 공개 커밋·파일별 해시·보존 대상이 있다. `prepare.mjs`, `cache-and-verify.mjs`, `publish.mjs`는 이번 공개 후보 준비·검증·push 과정의 기록이며 기존 `.tmp` 입력을 사용하는 일회성 스크립트다. 이미 공개했으므로 `publish.mjs --apply`를 다시 실행하지 않는다.

공개 파일의 읽기 전용 재대조는 저장소 루트에서 실행한다. 이후 배포로 파일이 바뀌면 이 릴리스와 불일치하는 것이 정상이다.

```powershell
node experiences/synk-world-app/qa/tutor-release-20261011/verify-live.mjs
```

브라우저 재검사에서는 기존 보고서를 덮어쓰지 않도록 새 출력 폴더를 지정한다.

```powershell
$env:SYNK_HOME_TUTOR_URL='https://synk.im/world'
$env:SYNK_TUTOR_SWITCH_RUN='new-public-check'
node experiences/synk-world-app/qa/tutor-switch-20261011/verify-switch.cjs
$env:SYNK_HOME_EXPRESSION_RUN='new-public-check'
node experiences/synk-world-app/qa/home-expressions-20261011/verify-home-expressions.cjs
$env:TUTOR_BASE='https://synk.im/world'
$env:TUTOR_OUTPUT='new-public-games'
node experiences/synk-world-app/qa/tutor-release-20261011/game-components.cjs
```
