# Google 로그인·가입과 휴대폰 인증 · 2026-10-09

**후속 범위 변경:** 사용자가 Google 로그인·가입 로직을 먼저 완성하고 문자 서비스를 출시 직전으로 미뤘다. 이 폴더는 이전 문자 인증 필수 후보와 당시 검증을 보존한다. 최신 개발 가입은 서버가 명시한 경우에만 문자를 연기하며, [Google-only 구현·검증](../google-only-20261009/README.md)을 따른다.

당시 문자 필수 후보 상태: **로컬 구현과 합성 검증 완료, 운영 활성화·공개 미완료**. 실제 문자 발송·Google 인증·사용자 계정 변경은 하지 않았다. 기존 배포된 Platform SSO와 구분한다.

## 구현한 동작

- 중앙 `/id/`에서 Google 로그인과 최초 가입, 기존 회원의 Google 연결을 준비했다. 같은 Google/Auth 계정의 번호 변경 OTP를 사용해 별도 phone 계정을 만들지 않는다.
- 신규 가입은 수집·이용 안내 선확인 → 전화 인증 → 국가·만 나이·성별 → 내부 SYNK 계정 생성 순서다. 별도 ID/비밀번호를 받지 않는다. 나이14~120와 서버 기준일, 국가249개 코드, 성별 직접 입력·응답하지 않음을 지원한다.
- 서버는 실제 Auth `/user`의 Google identity와 휴대폰 확인 시각·대기 번호 상태를 확인한다. 클라이언트가 보내는 ‘인증됨’, 전화번호·OTP·계정 ID는 가입 POST로 받지 않는다.
- 비공개 가입 정보는 일반 프로필·Atlas 요약에서 제외한다. 본인 내보내기에 포함하고 프로필 변경에도 유지하며 기존 계정 삭제 처리로 제거한다. 학습 기록 저장은 별도 선택이고 기존 철회를 다시 켜지 않는다.
- 콜백 nonce의10분 만료·1회 사용, 기존 앱 authorization 보존, 계정 전환 후 늦은 응답 차단, 로그아웃 대기 중 새 요청 차단을 유지했다. 인증 후 새로고침하면 서버에서 이미 확인한 번호로 가입을 이어간다.
- Google 설정 조회가 늦어져도 기존 이메일 로그인과 PKCE 콜백은 기다리지 않는다. 저장소가 차단되면 Google만 시작을 막고 이메일 로그인은 유지한다.
- Google 연결을 취소해도 서버가 확인한 기존 로그인은 유지하되 원래 앱을 자동 승인하지 않는다. 이미 인증한 휴대폰 번호의 재요청·형식만 바뀐 입력·느린 PC 시계가 다시 문자 인증을 요구하지 않는다.
- **공유 공개 설정에 새 키를 추가하지 않는다.** 이 초기 후보는 Google 활성화 전에 SMS 실검증·서버 소비처·중앙 포털·안내를 준비하고 마지막 Google provider 활성화로 가입 UI를 여는 순서를 제안했다. 후속 Google-only 공개의 선행조건으로 적용하지 않는다. 별도 Phone 로그인 provider는 false로 유지할 수 있다. ‘나중에 하기’의 Auth 정보 보관과 가입 대기 정보 삭제 문의 경로를 화면에 표시했다.

## 검증

| 범위 | 결과와 근거 |
| --- | --- |
| Google FE·계정 전환/콜백·기존 이메일 제한/로그아웃·OAuth 복귀·공개 설정 | **138/138** · [auth-final.tap](auth-final.tap). Google39개 포함 |
| Backend10파일 | **109/109** · 실제 마이그레이션을 적용한 PGlite PostgreSQL·실제 postgres JSON 직렬화·운영 release-policy의 최소 앱 버전 경계 포함. [동결 manifest](candidate-manifest.json)의 backend-evidence/validation.tap |
| 실제 Chromium, 합성 SDK/HTTP | **7시나리오·9화면**,320/390/1280px. 실제 인증 버튼·OTP 입력 후 native form validation·가입 완료 클릭·계정 화면 진입, storage getter 오류에서도 이메일 로그인. [브라우저 결과](browser/result.json)·[재현](browser/README.md) |
| 실제 app 진입점·설치 Supabase SDK2.117.2, 합성 HTTP | PKCE authorize·verifier/challenge·callback → `updateUser` → `phone_change` → `getUser` → 가입 POST1회 → 내 계정 왕복. Phone provider=false·공유 설정 신규키 없음, 버전헤더0.2.0 확인. [결과](sdk-browser/result.json)·[재현](sdk-browser/README.md) |
| 독립 코드 검토 | 재현한3건(인증 후 reload 정체, email/Google 동시 요청, 기존 PKCE 콜백 중 새 OAuth 시작)을 수정하고 회귀시험 추가. 해당 범위 추가 재현 없음 |
| 전체 공용 account 검사, 중간 실행 | **411/416**,5실패. 이번 변경과 연결되지 않는 platform-entry/home/lifecycle의 기존 URL 기대값이 현재 WORLD/메신저 입구와 다름. [원문](account-all.tap). 전체 통과로 표시하지 않는다 |

브라우저 요청을 모두 로컬 바이트 또는 합성 응답으로 처리했다. 운영 Auth·SMS·서버 쓰기는0이며 실문자/Google 실로그인/물리 휴대폰 증거가 아니다. 최신 화면11장을 직접 확인했다. [최종 r3 바이트 대조](final-integrity-v3.json)에서 파일·원본119/119, bundle입력62/62, 브라우저 입력11/11, 화면·시각검수 기록11/11, core·예시 설정·core시험의 원복 사본3/3이 일치했다. 초기 [r1](final-integrity.json)·[r2](final-integrity-v2.json) 대조도 보존했다. 운영 공개 설정은 GET만 조회해 [Google/Phone 비활성](external-readiness.json)을 확인했으며 그 뒤 공급자 설정을 변경하지 않았다.

02:34Z에 운영 관리 API를 GET으로 다시 확인해 문자 OTP 길이가 화면과 같은6자리, 만료60초이며 Google·전화번호 로그인·수동 연결이 꺼져 있음을 확인했다. 자동인증도false다. [비밀값을 제외한 읽기 결과](auth-otp-readiness.json). 실제 문자 발송이나 설정 변경은 없었다.

## 동결과 보존

[freeze.cjs](freeze.cjs)는 소스·시험·기존 dirty 원본·Backend 증거를 PC의 별도 임시 후보에 복사하고 중앙 app만 메모리에서 묶는다. 공유 dist·기존 설치 앱·공개 파일은 변경하지 않는다. 최신 후보의 복사 파일·62개 bundle 입력 SHA와 app 해시는 [candidate-manifest.json](candidate-manifest.json)에 있다. r1·r2 후보와 공식 검수 결과를 보존했다.

이 후보의 공유 입력에는 이전 미공개 변경이 포함될 수 있어 **그대로 공개하는 후보가 아니다**. 실제 공개 때는 최신 synk-policy 공개 기준과 이번 승인 변경을 분리해 정확한 후보를 다시 만든다. 조사 당시 공개 main은 `2eb8cb983663b7c1b7149e9790382882222b23b9`; 공개 `/id/index.html`, `/id/dist/app.js`, `/id/style.css`3개가 해당 커밋과 일치했다. 이 값으로 이후 배포 상태를 추정하지 않는다.

## 문자 필수 후보에서 계획했던 운영 단계

아래는 당시 계획이며 현재 실행 대기 목록이 아니다. Google-only 공개·실제 가입 결과는 [최종 릴리스](../google-release-20261009/README.md)와 [후속 실사용 검증](../google-followups-20261009/README.md)에 있다. 문자 서비스 유예를 새 비용·설정 실행 승인으로 확대하지 않는다.

1. Google 콘솔에서 웹 OAuth Client ID/Secret을 마련하고 기존 회원의 명시적 identity linking을 설정한다. 비밀값은 콘솔·서버 설정에만 입력한다.
2. 새 SMS 사업자·발신 수단·예산을 확정하고 가입·결제에 필요한 사용자 절차를 마친다. [Google·SMS 설정안](GOOGLE-SMS-SETUP.md)에 콘솔 입력값, Twilio 기본 SMS 후보, 한국·몽골 조건과100회 비용 예시를 정리했다. 공급자 선정·결제·자동충전은 미실행이다.
3. 실제 공급자 정보로 [가입 안내 추가 문안](GOOGLE-REGISTRATION-NOTICE.md)과 공개 개인정보 안내를 맞춘다.
4. 최신 운영본 기준으로 중앙 계정 및 canonical Auth/store를 포함하는 **모든 서버 소비처**를 다시 묶고 검수·반영한다. [직접 동봉6개·생성 런타임6개와 기존 생성 명령](SERVER-CONSUMERS.md)을 조사했다. 회원 API10개와 cleanup2개, 총12개이며 새SQL 마이그레이션은 없다. 계정 함수 하나만 바꾸고 전체 앱 가입 제한 완료로 보고하지 않는다.
5. 공개 중앙 포털을 반영하고 신규 Google 가입, 기존 계정 연결, 실문자 수신·오답/만료, 재로그인 후 동일 SYNK ID·기록을 확인한다.

첫 공식 Claude Opus5.5/max 검수는 P1 1건·P2 4건을 발견했고, 같은 모델·추론으로 완료한 r2 재검수에서 앞선5건의 수정이 적절함을 확인했다. [재검수 원문](claude-delta-review.md)·[실제 모델/CLI 실행 상태](review-status.json). r2의 새 P2는 공유 config 키를 구버전 client/platform 번들이 거절하는 호환성 문제였다. r3는 그 키 자체를 제거해 core·예시 설정·core 시험을 변경 전 원문과 바이트까지 동일하게 복원했다. 번호 입력을 지웠다 되돌리는 경우·대기 번호가 있는 no-op 응답·다른 계정에 연결된 Google 안내도 보완했다. 이 마지막 수정은 FE138/138과 최신 브라우저 검증을 통과했고 별도의 Opus 재검수 완료로 표시하지 않는다. **이 문자 필수 후보 시점에는 실제 공개본 기준 릴리스 생성과 최종 공개 검수가 남아 있었다.** 사용량 제한이나 미완료를 검수 통과로 바꾸지 않는다.
