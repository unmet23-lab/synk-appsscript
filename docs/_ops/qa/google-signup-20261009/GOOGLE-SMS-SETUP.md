# Google 로그인·휴대폰 인증 운영 설정안

2026-10-09 · 앞선 준비 기록: 기존 SMS 서비스가 없어 새 서비스 연결안과 비용을 조사했다.

> **같은 날 후속 요청으로 범위 변경:** 이번 작업은 Google 로그인·가입·기존 회원 연결의 로컬 로직 구현과 검증만 진행한다. SMS 서비스 연결은 출시 직전으로 미룬다. Google 키 설정·provider 활성화, SMS 가입·결제·설정·발송, 서버 런타임 빌드·배포는 이번 작업에서 실행하지 않았다. 최신 결과와 범위는 [Google 로직 작업 기록](../google-only-20261009/README.md)을 따른다. 아래 국가·공급자·비용 조사는 출시 운영을 위한 이전 준비 자료이며, 지금 실행할 선행 작업이나 서비스 선정 결과가 아니다.

## 10-09 로컬 구현 당시 상태와 완료 기준

Google 공개·실계정 확인은 이후 [후속 Google 공개·실사용 결과](../google-followups-20261009/README.md)로 이어졌다. 아래 provider=false와 로컬만 완료 상태는 준비 시점의 관찰이다. SMS 공급자 조사·가격은 당시 자료이며 새 서비스 선택이나 발송 승인이 아니다.

이 문서는 앞선 운영 준비 조사와 후속 로컬 가입 정책을 함께 남긴 인계 자료다. Google OAuth 앱 생성, SMS 가입·결제, 운영 설정 변경, 문자 발송은 실행하지 않았다. **로컬 로직 검증, 운영 로그인 활성화, 실제 로그인·문자 수신 성공은 각각 별개**다. 운영 자격증명이 없어도 이번 로직 구현·검증은 진행할 수 있으며, 이를 실사용 성공으로 표시하지 않는다.

같은 날 기존 공식 내부 reader(`tools/synk-id/lib.js`)로 운영 `/config/auth`를 GET하고 공개 `/auth/v1/settings`를 조회했다. 모두 HTTP 200이었으며 자격증명 값·응답 원문은 출력하지 않았다. 최초 문서 작성 시점에는 별도 설정 증거 JSON이 없었으며, 이후 남긴 읽기 전용 확인 기록은 [external-readiness.json](external-readiness.json)과 [auth-otp-readiness.json](auth-otp-readiness.json)에 있다. 이번 후속 문서 보완에서는 운영 설정을 다시 조회하지 않았다.

| 확인 항목 | 읽기 결과 |
| --- | --- |
| Google 로그인 | `external_google_enabled=false`; 공개 settings의 Google도 false |
| Google Client ID·Secret | 운영 Auth 설정에 둘 다 없음 |
| 기존 회원의 수동 로그인 수단 연결 | `security_manual_linking_enabled=false` |
| 중앙 포털 복귀 허용 | `https://synk.im/id/**` 존재; `/id/?authorization_id=…&google_flow=…` 형태 포함 |
| 휴대폰 로그인 | `external_phone_enabled=false`; 공개 phone 제공자도 비활성. 기존 계정의 번호 변경 인증 준비 여부와는 별개 |
| 휴대폰 자동 인증 | `sms_autoconfirm=false` |
| SMS 공급자 | 기본 선택값만 있음; 공급자 연결 완료를 뜻하지 않음 |
| SMS 자격증명 | Twilio·Twilio Verify·MessageBird·Textlocal·Vonage 관련 자격증명 없음 |
| 내부 운영 API 접근 | 기존 Supabase 관리 자격증명 reader 사용 가능; 값은 기록하지 않음 |

현재 구현한 가입 흐름은 **Google 인증 → 국가·나이·성별·개인정보 동의·학습 여부 입력 → 서버 가입 정책 확인 → 내부 SYNK 가입 완료 → 런처와 앱 이용**이다. 휴대폰 인증은 서버가 필수로 정한 경우에만 가입 완료 전에 요구한다. 문자 서비스 출시 전 개발용 유예 정책에서는 휴대폰 확인 없이 가입할 수 있지만, 확인되지 않은 번호를 인증 완료로 기록하지 않는다. 휴대폰 인증 때문에 별도 계정을 만들지 않는다. 기존 회원은 기존 SYNK 계정에서 Google을 연결해 ID와 기록을 유지하는 경로를 확인한다. 이메일만 보고 SYNK가 계정을 임의로 합치는 처리는 하지 않는다.

### 로컬 서버 가입 정책

- `createService`의 `googlePhoneVerificationRequired`는 기본 `true`다. 중앙 `synk-account` edge의 서버 환경값 `SYNK_GOOGLE_PHONE_VERIFICATION`이 정확히 `deferred`인 경우에만 `false`가 된다. 환경값이 없거나 다른 값이면 휴대폰 인증을 요구하는 정책을 유지한다. 이번 작업에서 운영 환경값은 변경하지 않았다.
- `GET` 등록 상태의 `registration.phoneVerificationRequired`가 클라이언트의 가입 화면을 결정하는 서버 응답이다. 클라이언트는 값이 정확히 `false`일 때만 유예하며, 값이 없거나 다른 값이면 휴대폰 인증을 요구한다.
- 가입 완료 `POST`는 기존 `country`, `age`, `gender`, `genderText`, `privacyAccepted`, `privacyVersion`, `learning` 입력 계약을 유지한다. 클라이언트가 보낸 정책값·휴대폰 인증 주장·확인 시각은 받지 않는다. 실제 Google identity와 Auth의 Google 가입 marker 검증은 유예 정책에서도 유지한다.
- 실제 서버 확인 결과가 있으면 `phoneVerified:true`와 실제 `phoneVerifiedAt`을 저장한다. 확인 결과 없이 유예 가입하면 `phoneVerified:false`, `phoneVerificationDeferred:true`를 저장하고 `phoneVerifiedAt`은 만들지 않는다.
- **이미 유예 가입한 계정의 출시 전 휴대폰 인증 보강과 모든 앱의 접근 gate는 미래 작업이다.** 환경값만 strict로 돌려도 기존 계정이 자동으로 차단되지는 않는다. 출시 정책·기존 계정 보강 경로를 별도로 구현하고 검증해야 한다.

## 1. Google 관리자 콘솔 준비

기존 SYNK 운영 프로젝트를 관리할 수 있는 Google 계정으로 [Google Auth Platform](https://console.cloud.google.com/auth/overview)을 연다. 기존 프로젝트·OAuth 클라이언트가 있는지 먼저 확인하고, 새 프로젝트나 중복 클라이언트는 필요한 경우에만 만든다. 이번 문서 작성에서는 관리자 콘솔에 접속하거나 생성하지 않았다.

| 입력 위치 | 설정할 내용 |
| --- | --- |
| Branding / 앱 이름 | `SYNK` |
| 사용자 지원·개발자 연락 이메일 | 실제 수신·관리 가능한 SYNK 관리자 주소 |
| 홈페이지 | `https://synk.im/` |
| 개인정보 처리 안내 | `https://synk.im/privacy/` |
| 서비스 이용약관 | `https://synk.im/terms/` |
| 승인 도메인 | `synk.im` |
| Audience | 일반 고객이 가입하는 외부 앱 기준. 테스트 상태이면 허용된 테스트 사용자에게만 먼저 검증하고 공개 범위를 별도로 확인 |
| Data Access / 로그인 범위 | `openid`, 이메일, 기본 프로필. Gmail·Drive 등 추가 권한은 요청하지 않음 |
| Clients / 앱 유형 | **Web application** |
| Authorized JavaScript origins | `https://synk.im` |
| Authorized redirect URIs | **`https://qiwxeddwwnzkwalpsuty.supabase.co/auth/v1/callback`** |

Google에 등록하는 redirect URI는 SYNK 포털 주소가 아니라 **Supabase의 Google callback**이다. Google 인증 후 Supabase가 중앙 포털로 돌려보내는 주소는 기존 Auth redirect allowlist가 담당한다. 중앙 웹 로그인으로 PC 앱도 연결하므로 네이티브 Google 클라이언트를 무조건 추가할 필요는 없다.

Google Client ID와 Secret은 콘솔의 안전한 입력 경로에서 운영 Supabase 설정으로 연결한다. **채팅에 붙여 넣거나 저장소·QA 파일·스크린샷·브라우저 번들·공개 config.json에 넣지 않는다.** 앱 이름·로고의 Google 검증 여부와 테스트/공개 상태는 실제 콘솔 결과로 확인하며 검증 완료를 미리 약속하지 않는다.

공식 근거: [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google), [Google OAuth 웹 서버 흐름](https://developers.google.com/identity/protocols/oauth2/web-server).

## 2. Supabase Google 설정

이 절은 당시 운영 연결을 준비한 설정안이며, 이번 로직 작업에서 Google 키를 설정하거나 provider를 활성화하지 않는다. 공개 로그인 활성화 전에는 [12개 서버 소비처](SERVER-CONSUMERS.md)의 새 계약 반영·운영 대조, 중앙 포털의 새 코드와 개인정보 안내 공개를 확인해야 한다. SMS 공급자와 Hosted Auth의 실제 전송·검증·재전송 왕복은 출시 직전 휴대폰 인증 정책을 적용할 때 별도로 준비·검증한다. 기존 이메일 로그인과 등록된 앱·복귀 주소는 보존한다.

| 설정 | 적용 목표 |
| --- | --- |
| `external_google_enabled` | 이번 작업에서 false 유지·미변경. 향후 운영 활성화 범위와 검증을 확정한 뒤 별도로 변경 |
| `external_google_client_id` | 준비한 Web application Client ID; 문서에 값 기록 금지 |
| `external_google_secret` | 준비한 Secret; 서버 설정에만 보관 |
| `external_google_skip_nonce_check` | false 유지 |
| `security_manual_linking_enabled` | 기존 로그인 회원이 Google을 명시적으로 연결할 수 있도록 활성화 |
| `uri_allow_list` | 기존 `https://synk.im/id/**` 및 앱 복귀 주소 보존. 이번 목적만으로 목록 전체 교체 금지 |

운영 변경은 기존 공식 관리 API의 `/config/auth` 또는 Supabase Dashboard에서 필요한 필드만 적용한다. Client ID·Secret이 없는데 활성 flag만 먼저 켜지 않는다. Google 연결 전후 내부 SYNK ID가 같고 기존 학습·옷장·메모 등 기록이 유지되는지 확인해야 한다.

공식 근거: [Google provider 관리 API 설정](https://supabase.com/docs/guides/auth/social-login/auth-google), [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## 3. SMS 후보와 최소 연결안

이 절부터 국가·가격·지출 제한은 **문자 서비스 출시 직전 다시 확인할 앞선 조사 기록**이다. 이번 범위에서 SMS 계정·국가·예산을 선택하거나 연결하지 않는다.

**우선 검토 후보는 Twilio Programmable Messaging + Supabase 자체 OTP**다. 현재 Supabase의 기본 공급자 선택값과 연결할 수 있지만 공급자 선정·계약을 확정한 것은 아니다. Supabase는 Twilio·Vonage·MessageBird를 지원하며 Textlocal은 커뮤니티 지원이다. 실제 발신 준비·양국 통신사 수신 결과·최종 비용을 보고 확정한다.

지원 국가에 대한 사용자 선택은 아직 없다. 아래 한국·몽골은 발신 조건과 비용을 조사한 후보 예시이며, 두 국가를 실제로 허용하거나 가입 국가 목록으로 확정한 결과가 아니다.

출시 직전 검토할 연결 방식은 Supabase가 인증번호를 발급·검증하고 Twilio가 문자 전송을 맡는 기본 SMS 경로다. **별도 Twilio Verify를 자동으로 추가하지 않는다.** Verify는 성공 인증당 기본 $0.05와 채널 비용이 추가되는 다른 상품이다.

| 필요한 운영 준비 | 연결 위치 |
| --- | --- |
| 관리할 수 있는 Twilio 계정 | 새 가입·실사용 전환 여부와 비용 승인 필요 |
| Account SID·Auth Token | Supabase SMS 공급자의 서버 설정에만 입력 |
| Messaging Service SID | Supabase의 `sms_twilio_message_service_sid`에 연결 |
| 국제 SMS 가능한 숫자 발신번호 | 한국용으로 Messaging Service의 sender pool에 연결; 번호 임대비 확인 |
| 브랜드 Alpha Sender `SYNK` | 몽골용으로 같은 sender pool에 연결; 유료계정 필요 |
| 국가 허용 | 사용자가 확정한 국가만 Messaging Geographic Permissions에 허용; KR·MN은 조사 후보 |
| Supabase SMS 공급자 | 자격증명·sender만 준비하고 `external_phone_enabled=false`, `sms_autoconfirm=false` 유지 |

Google로 로그인한 사용자의 **기존 인증 계정에 휴대폰을 추가하고 인증**하는 경로를 사용한다. 문자 코드 입력만으로 별도 phone 계정을 새로 만들거나 기존 회원 기록을 옮기지 않는다. 인증 성공은 서버의 휴대폰 확인 상태로 판정한다. SMS 인증은 해당 번호를 받을 수 있음을 확인하는 절차이며 국가·나이·성별의 사실이나 법적 본인확인을 증명하는 절차가 아니다. 가입자가 입력한 국가·나이·성별과 서버가 확인한 휴대폰 인증 상태를 구분한다.

**전화번호 단독 가입·로그인을 열기 위해 Phone provider를 켜지 않는다.** 공식 Supabase Auth 소스 `ce9a8eee0cc042be8c7a42981a7ddae631e41d91`에서 인증된 `updateUser({phone})` → `verifyOtp({type:'phone_change'})` 경로는 `external_phone_enabled`를 검사하지 않고 SMS 공급자를 사용한다. 반면 별도 phone 가입·OTP 로그인과 `resend({type:'phone_change'})`는 이 flag가 false이면 거절된다. 따라서 재전송도 인증된 `updateUser({phone})` 경로를 유지한다. 이 결과는 공식 upstream 소스의 분기 확인이며, **현재 Hosted Auth 버전·관리 설정에서의 실제 발송·검증 성공을 뜻하지 않는다.** 승인된 최소 실문자 확인으로 검증해야 한다.

공개 settings의 `external.phone`은 전화번호 단독 로그인 flag다. 이 값을 번호 변경 인증의 준비 여부로 사용하지 않는다. 중앙 포털의 Google 로그인 진입은 공개 Auth settings의 `external.google`를 따르고, **가입 중 휴대폰 인증 요구 여부는 인증된 등록 상태 응답의 `registration.phoneVerificationRequired`를 따른다.** 값이 정확히 false인 유예 상태에서는 문자 서비스를 준비하지 않고도 로컬 가입 로직을 검증할 수 있다. Phone 로그인 provider는 false로 유지하며, 이번 작업에서 Google·Phone provider를 변경하지 않았다.

공개 공유 `config.json`에는 새 키를 추가하지 않고 기존 계약을 유지한다. 이 작업을 위해 기존 일반 client·platform 소비자의 번들을 모두 다시 묶을 필요는 없다. `external.google`는 UI 표시 조건이며 **서버 인증·가입 허가나 OTP 확인 증명이 아니다.** 휴대폰 인증 필수 여부는 서버 소유 정책이며 실제 확인 결과도 서버가 검증한다. 코드 준비, 서버·포털 공개 반영, 실문자 검증, Google 활성화는 각각 별도 완료 상태다.

공식 근거: [Supabase Phone 로그인·공급자](https://supabase.com/docs/guides/auth/phone-login), [기존 사용자 정보 변경](https://supabase.com/docs/reference/javascript/auth-updateuser), [Twilio Messaging Services](https://www.twilio.com/docs/messaging/services), [Twilio Verify 가격](https://www.twilio.com/en-us/verify/pricing).

분기 근거: [인증된 사용자 변경](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/user.go#L278-L290), [번호 변경 OTP 검증](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/verify.go#L711-L779), [별도 phone 가입 차단](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/signup.go#L150-L152), [resend 제한](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/resend.go#L55-L57).

## 4. 한국·몽골 발신 조건

| 대상 | 공식 조건과 준비 |
| --- | --- |
| 한국 `+82` | 국제 숫자 long code 지원. Alpha Sender는 미지원. 숫자 발신자는 `006`·`009` 등으로 바뀌며 국제발신 또는 웹발신 표시가 붙을 수 있음. 긴 문자가 여러 개로 보일 수 있으므로 OTP 문구를 짧게 유지하고 실제 한글 수신 확인 필요 |
| 몽골 `+976` | Alpha Sender 지원, 사전등록 불필요. Mobicom·G-Mobile은 국제 숫자 long code 미지원이므로 브랜드 이름을 반영한 Alpha Sender 사용 필요 |

한 개의 국제 숫자 번호만 붙인 상태를 양국 연결 완료로 판단하지 않는다. Messaging Service는 지원 국가에 Alpha Sender를 자동 선택할 수 있으므로 KR용 숫자 발신자와 MN용 Alpha Sender를 같이 준비한다. Alpha Sender는 유료계정에서만 쓸 수 있다. 한국용 숫자와 몽골용 Alpha Sender 양쪽의 실제 수신 결과가 필요하다.

공식 근거: [한국 SMS 기준](https://www.twilio.com/en-us/guidelines/kr/sms), [몽골 SMS 기준](https://www.twilio.com/en-us/guidelines/mn/sms), [Messaging Service의 Alpha Sender](https://www.twilio.com/docs/messaging/services/alphanumeric-sender-ids-in-messaging-services).

## 5. 비용 예시와 제한

2026-10-09에 읽은 공식 공개 표준가이며 **USD 기준**이다. 환율로 원화나 투그릭으로 변환하지 않는다. 계약 가격·향후 가격 변경·통신사 추가비·세금·번호 임대·부가 기능·재전송은 별도다.

| 대상·방식 | 공개 단가 | 문자 100회 예시 |
| --- | --- | --- |
| Twilio 기본 SMS → 한국 | $0.0524 / 세그먼트 | 모두 1세그먼트면 **$5.24** |
| Twilio 기본 SMS → 몽골 | $0.2957 / 세그먼트 | 모두 1세그먼트면 **$29.57** |
| 양국 각각 100회 | 위 단가 합산 | 전송료만 **$34.81** |
| 국제 숫자 발신번호 임대 | 공개 페이지상 월 $1.15부터 | 실제 선택 번호·기능별 임대료 확인 필요 |
| Twilio Verify를 별도로 선택하는 경우 | 성공 인증당 기본 $0.05 + 전송료 | 성공 인증 100회면 전송료 외 기본 **$5.00 추가** |

100회는 가입자 100명 보장이 아니라 **실제 전송 100회, 각 1세그먼트** 가정이다. 재전송·긴 문구는 과금을 늘릴 수 있고, Failed 상태 처리비 등도 별도일 수 있다. 공급자·번호·국가별 실제 계정 견적은 아직 확정하지 않았다.

공식 근거: [한국 전송·번호 가격](https://www.twilio.com/en-us/sms/pricing/kr), [몽골 전송·번호 공식 가격](https://www.twilio.com/de-de/sms/pricing/mn), [Verify 가격](https://www.twilio.com/en-us/verify/pricing).

신규 Twilio 체험계정은 **가입국가 한정, 검증된 수신번호 최대 5개, 제공 템플릿 사용, 30일 제한**이 있다. 기존 legacy 체험의 국제 발송 설명을 신규 체험에 그대로 적용하지 않는다. 체험계정의 Alpha Sender 제한도 있으므로 무료 체험만으로 한국·몽골의 일반 회원용 인증 운영이 완성된다고 안내하지 않는다. 테스트 자격증명은 실제 전화망에 연결하지 않으므로 실문자 수신 증거로 사용하지 않는다.

공식 근거: [현재 체험 제한](https://www.twilio.com/docs/usage/trials), [테스트 자격증명](https://www.twilio.com/docs/iam/test-credentials).

## 6. 지출을 최소화하는 운영 조건

- 사용자가 확정한 국가만 허용하고 필요 없는 국가 발송은 막는다. 국가 코드 선택 목록과 실제 공급자 허용 국가를 함께 확인한다. KR·MN은 아직 확정된 허용 목록이 아니다.
- Supabase의 SMS 발송 rate limit과 재전송 대기·횟수 제한을 확인한다. 기본 제한을 무제한으로 풀지 않는다. 문자 발송을 동반하는 자동 테스트는 사용하지 않는다.
- **전역 CAPTCHA를 지금 바로 켜지 않는다.** 현재 이메일 인증 UI에는 `captchaToken` 전달이 구현되지 않아 즉시 활성화하면 기존 이메일 로그인·가입·복구가 실패할 수 있다. CAPTCHA UI와 토큰 전달, 적용 대상 경로, 기존 인증 회귀 확인이 준비된 뒤 별도로 켠다. 그 전에는 국가 허용·발송 rate limit·소액 선불 잔액·자동충전 끄기로 지출 범위를 제한한다.
- 짧은 OTP 문구를 사용하고 실제 인코딩·세그먼트 수를 확인한다. 국가·통신사별 실물 수신 확인은 사전에 합의한 최소 횟수만 수행한다.
- 월 시험 예산과 1일 발송 상한을 사용자가 정한 뒤 운영한다. Twilio의 잔액·사용량 알림을 설정하되 **알림을 강제 과금 차단으로 설명하지 않는다.** 최초에는 승인된 소액 선불 잔액으로 준비하고 자동충전은 끈다. 유료 부가기능은 별도 승인 없이 켜지 않는다.
- OTP 원문·Auth Token·Google Secret·사용자 전체 전화번호를 로그·QA 결과·채팅에 남기지 않는다. 필요한 확인은 성공 여부·건수·마스킹·설정 존재 여부로 남긴다.

공식 근거: [Supabase Auth 제한](https://supabase.com/docs/guides/auth/rate-limits), [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha), [Twilio 국가 허용](https://help.twilio.com/articles/223181108-How-International-SMS-Permissions-work), [Twilio 사용량 알림](https://www.twilio.com/docs/usage/api/usage-trigger).

## 앞선 운영 준비 체크리스트 — 보존 기록

아래 목록은 2026-10-09 후속 범위 변경 **이전**의 Google·SMS 동시 운영 활성화 계획이다. 당시 준비 항목을 보존하며, 현재 로직 작업의 선행 조건으로 적용하지 않는다. 이 초기 작업에서는 Google 운영 연결도 실행하지 않았고, 문자 서비스 준비는 출시 직전으로 미룬다. 향후 활성화 계획은 위 서버 정책과 기존 유예 계정의 인증 보강·앱 gate까지 반영해 다시 확정해야 한다.

1. Google 관리자 콘솔 접근과 OAuth 앱·자격증명 생성 절차 완료.
2. SMS 계정 관리자 접근, 지원 국가 선택과 해당 국가에 맞는 발신 수단 준비. KR·MN을 선택하는 경우 한국용 숫자·몽골용 Alpha Sender가 필요.
3. SMS 공급자·최종 단가·번호 임대·시험 발송 횟수·예산에 대한 사용자 비용 승인.
4. 동결한 코드 후보의 검사·검수, 전체 12개 서버 소비처 업데이트·운영 대조, 중앙 포털 새 코드·개인정보 안내 공개 완료. 공개 공유 config에는 새 키를 넣지 않음.
5. `external_phone_enabled=false`를 유지한 현재 Hosted Auth에서 승인된 번호 변경 OTP 전송·검증·재전송, 잘못된·만료된 OTP 거절, 선택한 국가의 실물 문자 수신 확인. Google 운영 활성화 전 SMS 준비를 검증하는 단계이며 아직 실제 Google 가입 성공을 뜻하지 않음.
6. 위 준비·실검증을 마친 뒤 마지막으로 Google provider 활성화. 새 중앙 포털의 Google·휴대폰 가입 UI가 `external.google`에 따라 함께 열린 뒤, 실제 신규 Google 회원 가입·기존 회원 Google 연결·재로그인 후 같은 SYNK ID와 기록 유지까지 확인해야 최종 실사용 완료.

위의 자격증명·비용·실문자 검증 항목은 당시 운영 계획의 조건이며, 이번 로컬 로직 구현·검증을 막는 조건이 아니다. 운영 연결과 출시는 별도 작업으로 남아 있다. 실패한 문자 전송이나 비활성 설정을 성공으로 대신 표시하지 않는다.
