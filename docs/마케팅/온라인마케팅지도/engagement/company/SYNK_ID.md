# 사내 메신저의 SYNK ID 연결

2026-10-02 로컬 구현. 운영 인증 제공자 설정·배포·실계정 연결은 미실시다. SYNK 플랫폼은 설치형 런처, 메신저와 WORLD는 별도 클라이언트다. PC와 모바일 브라우저도 같은 회사 서버 계약을 사용한다.

## 직원 연결

기존 회사 계정의 **내 워크스페이스 → SYNK ID 연결**에서 현재 회사 비밀번호와 직접 확인을 거친다. 다음으로 SYNK ID 인증을 완료한다. 중앙 서버가 검증한 `account.synk_user_id`와 현재 회사 직원 ID를 일대일로 연결한다. 같은 이메일, 이름, 학원 교사 역할로 직원을 만들거나 연결하지 않는다. 관리자도 현재 비밀번호를 확인한다. 비밀번호가 없는 로컬 시작 계정은 먼저 회사 비밀번호를 설정해야 한다.

이후 **SYNK ID로 로그인**하면 연결된 활성 직원에게만 회사 세션을 발급한다. 이미 다른 회사 계정에 로그인한 상태에서는 계정 전환을 거부한다. 연결 해제도 회사 비밀번호와 현재 연결된 SYNK ID를 모두 확인한다. 회사 기록·직원 권한은 보존한다.

## 서버 계약

| 요청 | 동작 |
|---|---|
| `GET /api/synk-id/status` | 설정 여부와 현재 회사 계정의 연결 여부 |
| `POST /api/synk-id/challenge` | `{action:login/link/unlink,currentPassword?,confirm?}`로 5분·1회 challenge와 HttpOnly flow 쿠키 발급 |
| `POST /api/synk-id/exchange` | `{challenge,confirm:true}` + `Authorization: Bearer` 검증 후 회사 HttpOnly 세션 발급 |
| `POST /api/synk-id/renew` | 현재 회사 쿠키·CSRF와 새 Bearer로 같은 SYNK ID의 만료 토큰만 교체 |
| `POST /api/synk-id/start` | 브라우저/모바일용 challenge와 서버 PKCE를 준비하고 `authorizationUrl` 반환 |
| `GET /api/synk-id/callback` | flow 쿠키·state·PKCE를 검증하고 서버에서 코드 교환 후 메신저로 이동 |
| `POST /api/logout` | 회사 로컬 세션 폐기 후 브라우저 중앙 종료 결과 반환; desktop 기기 종료는 main이 담당 |

POST는 회사 origin을 요구한다. link/unlink/renew/logout은 회사 CSRF도 검사한다. 상태 확인·renew·logout은 만료된 중앙 access로 먼저 막지 않고 회사 쿠키와 CSRF를 확인한다. 이 경로는 회사 자료를 반환하지 않으며, renew는 새 Bearer와 기존 연결·세션을 별도로 검증한다. challenge는 브라우저 proof, 회사 세션 hash, 현재 비밀번호 hash, 역할에 묶이며 코드 교환 뒤에도 현재 상태를 다시 확인한다. 다른 브라우저·이중 사용·중간 로그아웃·이용 중지·역할 변경은 연결하지 않는다. 데스크톱은 메신저의 전용 Electron session에서 고정 요청을 수행하며 renderer에 Bearer를 주지 않는다.

중앙 `synk-account`의 messenger 제품 조회만 사용한다. `account.status === active`와 안정된 ID를 확인하며 학습 기록·학원 소속·이용권을 직원 권한에 사용하지 않는다. 중앙 OAuth client ID를 messenger 제품으로 등록해야 한다.

## 세션·설정

`synk-id.env.example`은 공개 설정의 예시다. 적용되지 않은 기본 상태에서는 SYNK ID 로그인이 닫히고 기존 회사 로그인이 유지된다. 중앙 endpoint는 명시적으로 설정한 HTTPS 주소만 호출한다. 서비스 역할 키는 받지 않는다. 브라우저 콜백은 정확한 회사 origin의 `/api/synk-id/callback`을 인증 제공자에 등록한다.

Bearer·refresh token·PKCE verifier는 서버 메모리에만 둔다. SQLite에는 SYNK ID와 회사 직원 ID의 명시적 연결, 기존 회사 세션 및 SYNK 유래 표시만 저장한다. 서버 재시작 시 SYNK 유래 세션은 다시 로그인해야 하며 기존 회사 비밀번호 세션은 유지한다. 중앙 검증 결과의 유효 시간은 최대 30초이고 열린 메신저 연결도 주기적으로 재검증한다. 중앙 429·서버 오류·네트워크 장애에서는 회사 자료 접근을 닫되 복구 가능한 세션과 메모리 자격 정보를 보존한다. 실제 인증 거부·직원 비활성·연결 해제는 회사 세션을 폐기한다.

브라우저·모바일 BFF는 콜백에서 받은 refresh token으로 access 만료 60초 전부터 서버에서 갱신한다. 같은 회사 세션에서 갱신은 한 번만 진행하며 같은 SYNK ID와 연결 revision을 다시 확인한다. 회전한 refresh token은 중앙 검증에 앞서 메모리에 보존한다. 검증이 일시 실패하면 회사 자료를 열지 않고 새 access 후보를 재검증하며, 후보까지 만료되면 보존한 최신 refresh로 다시 갱신한다. 제공자가 새 refresh를 생략하면 기존 값을 유지한다. refresh가 없는 기존 응답은 access 만료 후 다시 로그인한다. 회사 세션 자체의 7일 만료는 연장하지 않는다.

데스크톱은 브라우저 BFF 갱신과 별도로 활성 창에서 20초마다, 다시 활성화될 때 즉시 main에서 확인·갱신한 토큰을 동일 ID로만 renew한다. 정상 restoring/signing-in 상태는 기다리고 일시 오류 상태는 다음 요청에서 재시도한다. 숨김·비활성·페이지 종료 때 중단하며 중복 요청과 로그아웃·계정 변경 전의 늦은 응답을 적용하지 않는다. 창이 비활성인 동안 access가 만료돼 회사 세션이 폐기되면 **SYNK ID로 로그인**을 다시 눌러 회사 세션을 발급받아야 한다. main에 유효한 기기 로그인이 남아 있으면 그 계정으로 이어지지만 회사 세션의 자동 복원은 보장하지 않는다.

회사 로그아웃은 회사 쿠키와 서버 메모리 자격 정보를 즉시 폐기한다. 브라우저는 중앙의 현재 메신저 세션 철회와 인증 제공자의 `scope=local` 종료를 시도하며 다른 제품 전체 로그아웃은 호출하지 않는다. 서버 종료 확인이 실패해도 회사에서 나갈 수 있고 미완료 사실을 표시한다. 데스크톱의 SYNK 유래 세션은 회사 로그아웃과 함께 main의 기기 자격 정보 삭제를 요청하며 삭제 실패·중앙 종료 미확인도 완료로 표시하지 않는다. 기존 회사 비밀번호 세션의 로그아웃은 별도 SYNK 기기 계정을 건드리지 않는다. 로그아웃 중 계정이 바뀌면 새 계정에 이전 종료 응답을 적용하지 않는다.

## 모바일 입구

회사 페이지에 메신저만의 web manifest와 iOS 홈 화면 메타를 연결했다. 승인된 `desktop/assets/messenger.png`를 그대로 사용한다. 모바일 브라우저의 홈 화면 추가 기능을 사용하며, 오프라인 대화·네이티브 스토어 배포·푸시 지원을 뜻하지 않는다. service worker를 등록하거나 회사 API·메시지를 캐시하지 않는다.

## 확인 범위

`server-synk-identity.test.mjs`는 임시 SQLite와 합성 인증 제공자로 명시적 연결·재로그인·계정 충돌·CSRF·재사용 거부·비활성 경합·중앙 철회·재시작·갱신·해제·서버 PKCE를 검사한다. 회전·만료·중앙 일시 오류·로그아웃 경합도 실제 회사 HTTP 요청으로 검사한다. `synk-id-client.test.mjs`는 실제 desktop main 인증 서비스의 signed-out → signing-in → restoring → signed-in 이벤트와 로컬 콜백을 회사 UI에 연결해 첫 로그인을 확인한다. 기존 회사 인증 경합, 메신저 권한·기록 보존, 워크스페이스 이동 검사도 함께 통과했다. 실제 인증 제공자 로그인, 운영4191 반영, 휴대폰 홈 화면 설치는 별도 검증이 필요하다.
