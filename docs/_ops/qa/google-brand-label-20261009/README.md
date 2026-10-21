# Google 로그인에서 SYNK 이름 표시

2026-10-09 사용자 요청: Google 계정 선택 화면의 무작위 Supabase 주소 대신 SYNK에 로그인하는 것으로 알아볼 수 있어야 한다.

현재 사용자가 제공한 실제 화면은 인증 callback 도메인을 서비스 이름으로 표시한다. 기존 콘솔 기록에는 draft 앱 이름 SYNK, production audience, 홈페이지/개인정보/약관 URL 저장, unmet23의 synk.im 소유권 확인이 있으나 브랜드 검증·공개는 미완료다. [기존 콘솔 증거](../google-release-20261009/ops/google-console-actions.md). 해당 값들을 이번에 다시 변경했다고 표시하지 않는다.

[Google 공식 브랜딩 문서](https://support.google.com/cloud/answer/15549049?hl=en)는 브랜드 미검증 시 도메인만 표시하고, 검증 후 Ready to publish 상태에서 **Publish branding**을 해야 draft 이름이 실제 sign-in/consent 화면에 표시된다고 설명한다. [Supabase 공식 가이드](https://supabase.com/docs/guides/auth/social-login/auth-google#setup-consent-screen-branding)도 Google 브랜드 검증으로 project ID 대신 이름을 표시하는 방법을 안내한다. [공식 조사](research.md).

앱 이름은 기존 SYNK를 유지한다. Google이 로그인 문장과 한국어 조사를 생성하므로 사이트 HTML/CSS에서 전체 문구를 직접 바꾸지 않는다. 정확한 완료 기준은 실제 Google 계정 선택/동의 화면에서 서비스 이름이 SYNK로 보이는 것이다. 화면의 한국어 문장 전체를 아직 확인하지 않고 ‘SYNK에 로그인’으로 고정됐다고 보고하지 않는다.

## 이번 확인과 제한

- Google 콘솔 AX 읽기와 같은 프로젝트의 Branding 페이지 탐색이 시간 초과됐다. 브라우저 kernel 복구 후 inventory는 읽었지만 로그인 콘솔은 여전히 기존 client 상세 URL이었고, 이번 설정 쓰기·검증 제출·게시를 확인하지 못했다.
- 이전 Google UI가 홈페이지 소유권 변경 반영을24시간 기다린 뒤 재검증하라고 안내했다. 기준 시각은2026-10-09 19:56:02 KST이며 재검증은10-10 19:56이후다. 이를 모든 Google 프로젝트에 적용되는 보편 대기 규칙으로 표현하지 않는다.
- 기존10-10 20:00 한 번의 예약 `synk-google`을 검증→Publish branding→실제 로그인 이름 확인까지 명시하도록 보완한다. 새 반복 예약은 만들지 않는다. PC와 Codex가 실행 중이어야 하는 로컬 예약이다.
- 유료 Supabase custom domain, 키 교체, 새로운 권한·범위·회원 정보·결제 변경은 이 수정에 필요하지 않으며 실행하지 않는다. 특히 키 교체는 사용자가 취소했다.

## 실제 반영 절차

1. 같은 프로젝트의 현재 draft 이름 SYNK·기존3개 URL·현재 verification 상태를 읽는다. 새 credential이나 Google data access scope를 변경하지 않는다.
2. 안내된 반영 시간 뒤 Request re-verification을 제출한다. 실제 View issues를 읽어 남은 원인을 처리하며, 도메인/이름을 추측으로 바꾸거나 검증 실패를 성공으로 표시하지 않는다.
3. 공개를 재개할 때는 [현행 AI 운영 원칙](../../../AI_운영원칙.md)과 현재 사용자 요청을 따른다. 이 문서 작성 당시의 Opus5.5/max 별도 검수는 현재 필수 관문이 아니다. 실제 공개 후보 이름·기존 URL·변경 범위를 확인하고 키·회원 정보를 검토 입력에 넣지 않는다.
4. Ready to publish일 때 Publish branding을 완료하고 Published 상태를 저장한다. Audience production이나 draft 저장을 브랜드 공개와 혼동하지 않는다.
5. 승인된 기존 Google 계정의 실제 로그인에서 SYNK 이름이 표시된 Google 화면을 확인하고 개인정보가 보이지 않는 증거를 남긴다. 기존 내부 SYNK ID와 학습 선택을 보존하고 테스트용 새 가입·기존 기록 수정·전역 로그아웃을 하지 않는다.

현재 결과: **원인·무료 반영 경로 확인, 기존 재검증 예약 보완. 실제 Google 이름 변경 공개는 미완료.**
