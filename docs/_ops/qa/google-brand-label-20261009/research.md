# Google 로그인 브랜드 표시 조사

조사일: 2026-10-09. 공식 Google·Supabase 문서만 사용했다. 콘솔 설정·비밀키·계정·결제는 변경하지 않았다. SYNK 실제 콘솔 및 로그인 화면의 현재 상태는 root가 별도로 확인한다.

## 결론

현재 Google 화면에 무작위 Supabase 프로젝트 도메인이 표시되는 문제의 무료 최소 수정 경로는 Google Auth Platform의 **앱 이름 SYNK → 브랜드 검증 완료 → Publish branding**이다. 앱 이름 저장과 Audience의 production 공개만으로는 검증된 브랜드가 공개되지 않는다. Supabase의 인증 콜백 도메인을 바꾸거나 새 OAuth 키를 발급할 필요는 없다.

앱 이름은 `SYNK`로 두고, ‘로그인’ 등의 문장은 Google이 한국어 UI로 조합하게 한다. `SYNK에 로그인` 전체 문장을 앱 이름에 넣으면 Google이 덧붙이는 문장과 중복될 수 있다. SYNK 사이트의 HTML/CSS는 Google 소유의 로그인 화면 문구를 직접 바꾸지 못한다. 브랜드 공개 뒤 실제 계정 선택 화면과 동의 화면에서 SYNK 이름이 보이는지 확인해야 완료다. 정확한 한국어 조사·문장 구성까지 직접 설정할 수 있다고 약속하지 않는다.

## 공식 근거

- [Google — Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049?hl=en): 브랜딩 설정은 sign-in 및 consent screens에 표시되는 앱 이름·로고 등을 제어한다. 미검증 상태에서는 앱 도메인만 보인다. Draft Branding은 검증·공개 전에는 사용자에게 보이지 않는다. 성공 상태가 Ready to publish가 되면 Publish branding을 눌러야 하며, 검증 결과는 7일 동안 유효하다.
- [Google — Submit for brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification): External + Published 앱이 이름/로고 표시를 원하면 브랜드 검증이 필요하다. 자동 검증은 보통 수분, 수동 검증은 보통 2~3영업일이다. 앱 이름·홈페이지·개인정보처리방침·도메인 등의 변경은 Draft로 저장되며 검증과 Publish가 필요하다.
- [Google — OAuth App Verification Help Center](https://support.google.com/cloud/answer/13463073?hl=en): 기본적인 비민감 로그인 범위만 쓰더라도 앱 이름/로고를 표시하려면 별도의 가벼운 brand verification을 완료해야 한다. 민감·제한 범위의 data access 검증과 구별한다.
- [Supabase — Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google#setup-consent-screen-branding): Google Branding과 Verification으로 Supabase 프로젝트 ID 대신 이름·로고를 표시한다고 설명한다. 브랜드 검증과 custom domain을 두 가지 표시 개선 방법으로 제시한다. 이 문서가 custom domain을 강하게 권장한다는 사실은 그것이 이름 표시를 위한 필수 조건이라는 뜻은 아니다.
- [Google — OAuth policy compliance](https://developers.google.com/identity/verification/authentication-policy-compliance): 공유 서비스 도메인을 사용하는 경우 자신이 소유한 도메인으로 매핑하는 설정을 권장한다. 소유하지 않아 검증할 수 없는 도메인을 식별하라고 안내한다. Google의 자동 검증 실패 항목이 있는 경우 실제 항목에 근거해 보완하거나 추가 검증을 신청한다. 제3자 인증 제공업체의 도메인이라는 설명으로 수동 검증을 준비하는 것은 이 문서에서 직접 보장한 해결책이 아니라 현재 구조에 대한 실무 추론이다.

## 유료 도메인 대안

[Supabase Custom Domains](https://supabase.com/docs/guides/platform/custom-domains)는 custom domain이 **유료 플랜의 유료 추가 기능**이라고 명시한다. [Supabase 가격표](https://supabase.com/pricing)는 월 $10 / 도메인 / 프로젝트 추가 요금을 표시한다. 무료 플랜에는 제공하지 않는다. Vanity subdomain도 유료 플랜에 속한다. 이번 무료 최소 수정 범위에서는 활성화하지 않는다.

도메인을 `auth.synk.im`으로 바꾸는 대안을 나중에 선택한다면, 활성화 전 Google OAuth 클라이언트에 새 `/auth/v1/callback` URI를 기존 URI와 함께 등록해야 한다. Supabase 문서는 도메인 활성화 즉시 Auth가 새 도메인을 콜백에 사용한다고 설명한다. 단순 DNS CNAME 추가만으로 기존 Supabase Auth 콜백을 옮길 수 있다고 가정하지 않는다.

## 현재 작업에 적용

root에서 받은 상태: 프로젝트 `synk-id-unmet23`, draft 이름 SYNK, production audience, callback은 현재 Supabase 주소, SYNK 사이트 소유권 확인 뒤 Google UI가 24시간 대기를 안내했다. 이 보고서는 그 상태를 독립 확인한 결과가 아니다. 공개 완료 여부와 현재 검증 실패 항목은 콘솔에서 다시 확인하고, 준비된 이름을 검증·공개하는 경로를 우선한다. Google이 표시한 24시간 대기는 이 프로젝트의 실제 UI 안내이며 일반 공식 문서의 보편 규칙으로 확대하지 않는다.
