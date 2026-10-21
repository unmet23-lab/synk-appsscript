# Google 가입 서버 소비처 — 2026-10-09

이 문서는 `C:/Users/q1212/Documents/SYNK-talk`의 현재 로컬 원문·동봉표·생성 도구를 읽어 만든 운영 인계다. 서버 빌드·동봉 생성·운영 접속·배포·Google/SMS 활성화는 실행하지 않았다. 아래 경로와 명령의 기준 작업 폴더는 이 TALK 저장소다.

> **2026-10-09 후속 확정:** 이번 작업 범위는 Google 로그인·가입·기존 회원 연결의 로컬 로직 구현·검증이다. SMS 서비스 연결은 출시 직전으로 미룬다. Google 키 설정·provider 활성화, 서버 런타임 빌드·배포도 실행하지 않았다. 최신 작업 기록은 [Google 로직 작업 기록](../google-only-20261009/README.md)을 따른다. 아래 12개 함수의 동봉·생성 경로 조사와 운영 확인 목록은 향후 공개 반영을 위한 인계이며, 이번 범위에서 실행할 작업 목록이 아니다.

## 10-09 당시 반영 대상으로 조사한 계약

아래 12개 소비처 조사와 실패 가능성은 고유 기술 근거다. 실제 Google 공개·가입 결과는 [후속 Google 공개·실사용 결과](../google-followups-20261009/README.md)을 따르며 이 초기 후보의 재배포 지시로 적용하지 않는다.

- `lib/synk-auth.js:53–63`: 인증 서버의 실제 Google identity와 Auth의 Google 가입 marker, 휴대폰 확인 결과로 `registrationRequired`, `phoneVerified`, 실제 확인 시각의 `phoneVerifiedAt`을 만든다. 클라이언트가 보낸 전화번호나 인증 여부를 신뢰하지 않는다.
- `lib/synk-store.js:15–41`: 등록 상태 조회는 계정을 생성하지 않는다. Google 신규 가입은 `ONBOARDING_REQUIRED`로 일반 `withAccount` 진입을 막고, 서버 정책을 통과한 가입완료 요청에서만 기존 계정 생성 트랜잭션과 함께 `profile.__registration`을 저장한다.
- `lib/synk-server.js`의 `createService`: `googlePhoneVerificationRequired`는 기본 true다. 중앙 `supabase/functions/synk-account/index.ts`의 서버 환경값 `SYNK_GOOGLE_PHONE_VERIFICATION`이 정확히 `deferred`일 때만 false가 되며, 값이 없거나 알 수 없는 값이면 strict를 유지한다. 이번 작업에서 운영 환경값은 변경하지 않았다.
- 중앙 `synk-account`의 등록 상태 `GET`은 `registration.phoneVerificationRequired` boolean을 반환한다. 클라이언트는 정확한 false만 유예로 처리한다. `complete-google-registration`의 기존 국가·나이·성별·개인정보 동의·학습 여부 POST 계약은 유지하며, 클라이언트의 정책값·휴대폰 인증 주장·확인 시각은 받지 않는다. 실제 Google identity와 Auth 가입 marker 검증은 유예 상태에서도 유지한다. `synk-learning`도 같은 server 모듈을 동봉하므로 향후 공개 반영 시 함께 확인한다.
- 실제 서버 확인 결과가 있으면 `phoneVerified:true`와 실제 `phoneVerifiedAt`을 저장한다. 확인 결과 없이 유예 가입하면 `phoneVerified:false`, `phoneVerificationDeferred:true`를 저장하고 `phoneVerifiedAt`은 만들지 않는다.
- `lib/synk-store.js:9,54,100`: 공개 프로필은 `display_name`, `locale`, `time_zone`만 내보내고, 일반 프로필 수정은 서버 소유 `__registration`을 보존한다.

**이미 유예 가입한 계정의 출시 전 휴대폰 인증 보강과 모든 앱의 접근 gate는 미래 작업이다.** 환경값만 strict로 변경해도 기존 계정이 자동으로 차단되지는 않는다. 출시 정책·기존 계정 보강 경로를 별도로 구현하고 검증해야 한다.

**당시 Google 공개 준비에는 아래 기존 런타임의 갱신과 배포 대조가 필요했다.** 이번 로컬 로직 작업에서는 빌드·배포·provider 활성화를 실행하지 않는다. 새 auth와 새 store는 같은 함수 산출물에 함께 들어가야 한다. 이전 auth 또는 store를 가진 앱 API가 먼저 SYNK 계정을 만들면, 이후 중앙 사전 조회가 그 계정을 기존 회원으로 판단해 신규 가입 절차를 요구하지 않을 수 있다. FE 화면만 바꾸거나 `synk-account`만 갱신하는 것으로는 운영 서버 계약이 완성되지 않는다.

## 직접 동봉하는 함수 6개

각 함수의 `supabase/functions/<함수>/동봉.json`이 실제 매핑 원문이다. 별도 esbuild 생성 단계 없이, 기존 `tools/원격배포.js`의 동봉 처리에서 CJS 원문을 `.mjs` 모듈로 감싼다.

| 함수 | 변경 원문의 소비 경로 | 동봉표·진입점 근거 |
| --- | --- | --- |
| `synk-account` | `synk-auth.js` + `synk-store.js` + `synk-server.js`; 중앙 가입·내 계정 API | `동봉.json:2,6,8`; `index.ts:2–4,12–18` |
| `synk-learning` | 위 세 모듈; 학습 API도 같은 `createPgStore` 경계를 사용 | `동봉.json:2,6,8`; `index.ts:2–4,12–17` |
| `synk-fortune` | `synk-auth.js`; `fortune-store.js:2,5–8` → `synk-store.js` | `동봉.json:2–3`; `index.ts:2–4,10` |
| `synk-wardrobe` | `synk-auth.js`; `wardrobe-store.js:2,7–10` → `synk-store.js` | `동봉.json:2–3`; `index.ts:2–4,8` |
| `tutor` | `synk-auth.js`; `tutor-auth.js:2,6,11` → `synk-store.js` → 자격 확인 | `동봉.json:7–8`; `index.ts:2–3,15–17` |
| `tutor-media-cleanup` | `tutor-media-cleanup.js:2`가 `synk-auth.js`의 `UUID`만 사용. 회원 가입 API는 아니지만 변경 모듈의 동봉 소비처 | `동봉.json:2–3`; `index.ts:12–13` |

동봉 경로의 정본은 `tools/원격배포.js:191–208`의 `동봉읽기`·`동봉목록`, `217–235`의 `동봉묶기`, `251–261`의 `배포묶음`이다. `머리에서`는 커밋된 HEAD를 읽고 미커밋 차이를 검사한다. 작업본만 고친 상태에서 이전 HEAD를 포장하면 이번 수정이 반영되지 않는다. `tools/동봉신호.js:54–74`는 동봉 파일 변경의 함수 영향 범위를 알리는 기존 보조 도구이며, 배포나 자동 빌드를 수행하지 않는다.

## 생성 런타임을 소비하는 함수 6개

이 경로는 lib 수정만으로 기존 산출물이 바뀌지 않는다. 아래 기존 생성기를 사용해 런타임을 다시 만든 뒤 해당 함수의 동봉 또는 본체 산출물까지 같은 승인 대상에 포함해야 한다.

| 함수 | 현재 소비 모듈 | 생성 원문과 전이 의존성 |
| --- | --- | --- |
| `synk-care` | `동봉.json` → `_shared/synk-care-runtime.js` → `synk-care-runtime.mjs` | `tools/synk-care-build.js:5–8`; `synk-care-store.js:3,16` → `synk-store.js`; 생성 entry가 `synk-auth.js`도 포함 |
| `synk-classroom` | `동봉.json` → `_shared/synk-classroom-runtime.js` → `synk-classroom-runtime.mjs` | `tools/synk-classroom-build.js:5–8`; `synk-classroom-store.js:2–4,50` → store/auth/server; 생성 entry가 auth도 포함 |
| `synk-play` | `동봉.json` → `_shared/synk-play-runtime.js` → `synk-play-runtime.mjs` | `tools/synk-play-build.js:5–8`; `synk-play-store.js:2,7–9` → `synk-store.js`; 생성 entry가 auth도 포함 |
| `synk-personal` | `동봉.json` → `_shared/synk-personal-runtime.js` → `synk-personal-runtime.mjs` | `tools/synk-personal-build.js:2–3`; `synk-personal-store.js:2,20` → `synk-store.js`; 생성 entry가 auth도 포함 |
| `personal-media-cleanup` | `synk-personal`과 같은 `_shared/synk-personal-runtime.js`를 별도로 동봉 | `동봉.json:1`, `index.ts:2,8–11`; service credential 전용 정리 함수이며 회원 가입 API는 아님 |
| `synk-world-v1` | 함수 폴더의 `world-v1-runtime.mjs`를 본체 파일로 직접 포함. 동봉표 없음 | `tools/world-v1-build.js:5–9`; `world-v1-store.js:2,7–9` → `synk-store.js`; 생성 entry가 auth도 포함; `index.ts:2,5` |

기존 로컬 생성 명령은 다음과 같다. **인계 문서에 기록만 했으며 실행하지 않았다.** 각 명령 뒤에 `--check`를 붙이면 원문으로 재계산한 결과와 저장된 산출물을 비교한다.

```text
node tools/synk-care-build.js
node tools/synk-classroom-build.js
node tools/synk-play-build.js
node tools/synk-personal-build.js
node tools/world-v1-build.js
```

앞의 네 생성기는 TALK 옆의 `SYNK-appsscript` 제품 모델과 `experiences/synk-account`의 esbuild 의존성도 읽는다. WORLD 생성기는 TALK lib를 묶고 기존 esbuild 탐색 경로를 사용한다. 따라서 실행 시 원문·생성물·제품 모델의 범위를 먼저 고정해야 하며, 공유 작업본의 다른 변경을 일괄 반영하면 안 된다.

## 비공개 등록정보의 응답 경계 확인

현재 TALK의 API handler와 store 소비처를 좁게 읽은 결과, 새 `profile.__registration`을 다른 앱의 응답에 원문 그대로 싣는 실재 경로는 찾지 못했다.

| 소비처 | 외부 응답에서 사용하는 계정 정보 |
| --- | --- |
| 중앙 계정·학습 | `synk-server.js:79,131,134,149`의 공개 projection 또는 `accountView`. 가입완료 응답과 본인 내보내기의 별도 `registration` 필드는 의도된 본인 조회 계약 |
| Fortune | `fortune-server.js:40`은 `synk_user_id`만 반환 |
| Wardrobe | `wardrobe-server.js:48–50`은 옷장과 진행 상태만 반환; 계정의 학습 여부는 판정에만 사용 |
| Care·Personal·Play·WORLD | 각각 `synk-care-server.js:73`, `synk-personal-server.js:48`, `synk-play-server.js:56`, `world-v1-domain.js:42–45`에서 계정 ID와 제품 상태를 구성. 계정 profile 원문은 응답하지 않음 |
| Tutor | `tutor-auth.js:16–17`에서 자격·계정 ID·학습 revision만 구성. `tutor-runtime.js:65–66`의 비자격 응답에도 profile 없음 |
| Classroom | `synk-classroom-store.js:80–82`는 계정에서 `display_name`과 계정 ID·학습 상태만 학습자 상태로 추출. handler의 반 목록 응답에도 account 원문 없음(`synk-classroom-server.js:28`). 현재 TALK 생성물의 `handleClassroom`은 account 원문 인자를 받지 않고, `/api/world/account`의 profile도 `display_name`만 구성(`_shared/synk-classroom-runtime.js:13983,13992`). 옆 저장소 모델 전체를 별도로 검토한 결과는 아님 |

현재 저장된 생성 런타임들에는 이전 `accountView`의 raw `profile` 반환 코드가 남아 있다. 위 앱 handler에서 그것을 그대로 내보내는 경로는 발견하지 못했지만, 중앙 원문의 새 공개 projection과 비공개 정보 보존 계약을 맞추기 위해서도 런타임 재생성이 필요하다. 생성 산출물을 직접 손으로 패치하면 안 된다.

## 마이그레이션·운영 인계 상태

이번 Google 가입 변경 자체에는 **새 운영 SQL 마이그레이션이 없다.** 기존 `engine.synk_accounts.profile` JSONB 내부의 서버 소유 `__registration` 슬롯을 사용한다. 기존 계정·auth link·session 스키마를 유지하며, 기존 계정 삭제 SQL `supabase/migrations/20261003000000_synk_account_purge_c16.sql:75`가 profile 전체를 비워 이 슬롯도 삭제한다. 이 사실은 운영 DB에 기존 선행 마이그레이션이 이미 적용돼 있다는 확인을 대신하지 않는다.

회원 API 10개와 동봉 소비 cleanup 2개, 총 **12개 함수**가 이 source graph에 포함된다. 이 문서의 소비처 조사는 로컬 원문 확인이며, 이번 후속 작업도 로컬 Google 로직 구현·검증까지만 진행한다. 생성기 실행·산출물 검증·승인된 배포·운영 바이트 대조·Google 운영 연결·SMS 공급자 설정·실제 로그인 및 문자 수신 확인은 각각 별도 단계다. SMS 공급자 준비는 출시 직전까지 보류한다. 향후 운영 Google 활성화 전에는 이전 런타임의 갱신을 확인해야 한다.

## Google·SMS 운영 설정의 경계

앞선 운영 준비 조사는 [GOOGLE-SMS-SETUP.md](GOOGLE-SMS-SETUP.md)에 보존한다. 이번 작업에서 Google의 Client ID·Secret, 명시적 기존 회원 연결 설정, SMS 공급자 자격증명·발신 수단을 설정하지 않는다. 향후 연결 시에도 **전화번호 단독 로그인 provider는 `external_phone_enabled=false`로 유지**하고 `sms_autoconfirm=false`를 보존한다. 문자 서비스 준비와 국가·예산 선택은 출시 직전으로 미뤘으며, 조사 후보 KR·MN을 확정된 허용 목록으로 취급하지 않는다.

공식 Supabase Auth 원문 `ce9a8eee0cc042be8c7a42981a7ddae631e41d91`의 인증된 `updateUser({phone})` → `verifyOtp({type:'phone_change'})`는 Phone provider 활성 flag와 독립적이다. 재전송은 `resend` 대신 같은 `updateUser({phone})` 경로를 사용해야 한다. 이는 upstream 함수 분기 확인으로, **현재 Hosted Auth에서 이 구성의 실제 문자 발송·인증 성공은 별도 확인이 필요**하다. [사용자 변경 분기](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/user.go#L278-L290), [OTP 검증 분기](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/verify.go#L711-L779), [resend 제한](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/resend.go#L55-L57).

공개 Auth settings의 `external.phone`은 단독 로그인 제공자 상태이므로 번호 변경 인증 준비 여부로 사용하지 않는다. 중앙 포털의 Google 로그인 진입은 공개 Auth settings의 `external.google`를 따르고, **가입 중 휴대폰 인증 요구 여부는 서버 등록 상태 응답의 `registration.phoneVerificationRequired`를 따른다.** 클라이언트는 정확한 false만 유예로 처리한다. SMS 공급자와 현재 Hosted Auth의 실제 전송·검증·재전송 왕복은 출시 직전 별도로 준비·검증하며, 이번 로직 작업의 선행 조건이 아니다. 전체 12개 서버 소비처와 중앙 포털·개인정보 안내의 공개 반영은 당시 운영 활성화 절차였으며 후속 결과와 구분한다. Phone 로그인 provider는 false로 유지한다.

공개 공유 `config.json`은 새 키를 추가하지 않고 기존 계약을 보존한다. 기존 일반 client·platform 번들을 모두 다시 묶는 작업은 이번 준비의 선행 조건이 아니다. `external.google`는 UI 표시 조건이며 **서버 인증·가입 권한·OTP 확인 증명으로 사용하지 않는다.** 휴대폰 인증 필수 여부는 중앙 서버의 정책으로 정하고, 실제 인증 여부는 Auth의 서버 확인 결과로만 기록한다. 코드 준비, 서버·포털 공개 반영, Hosted Auth 실문자 검증, Google 활성화는 각각 별도 완료 상태다.

현재 이메일 UI에는 `captchaToken` 전달이 없어 **전역 CAPTCHA를 즉시 켜면 기존 이메일 인증이 실패할 수 있다.** CAPTCHA UI·토큰 전달·기존 로그인·가입·복구 회귀 확인 전에는 국가 허용, SMS 발송 rate limit, 승인된 소액 선불 잔액, 자동충전 끄기로 제한한다. 잔액·사용량 알림은 강제 과금 차단이 아니다. 이번 문서 보완에서도 운영 설정 변경·외부 POST·실문자 발송·배포는 실행하지 않았다.
