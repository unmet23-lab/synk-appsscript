# 플레저 HTTPS 접속용 등록

2026-10-07. PC 로컬 앱과 휴대폰 공개 웹이 같은 SYNK ID 자료를 읽도록 `https://synk.im/care/` 전용 **운영 OAuth 등록과 제품 매핑 추가를 완료**했다. 공식 Opus 5.5/max 검수 통과 뒤 실제 ID `84da5218-9e25-4ee9-a18b-e215895e182f`를 등록했고 기존 19개를 보존해 총 20개가 됐다. policy `7bd9b70`로 공개39파일과 포털20개를 게시하고 정규주소SHA·MIME·375px·실제로그인입구를 확인했다([공개판 QA](../../experiences/relationship-care/qa/PUBLIC-WEB.md)). 새 ID의 인증된 실사용자 로그인·PC/휴대폰 자료 왕복은 별도 확인이다. 함수 재배포는 공급자 현행 규약상 불필요해 실행하지 않았다.

## 고정 계약

- 등록 descriptor는 `registry.cjs`의 `PUBLIC_CARE_CLIENT`다. `care-public-browser`, production, `client_type: public`, `token_endpoint_auth_method: none`, callback은 `https://synk.im/care/` 한 개이며 API 제품은 `platform`이다.
- 기존 `care-browser`의 `http://127.0.0.1:4296/`와 Care native의 callback/ID를 수정하지 않는다. 기존 19개 등록과 매핑·Fortune 허용 목록을 모두 보존하고 새 ID 한 개만 매핑에 추가한다. 실제 공급자 응답과 재조회에서 확인된 ID만 사용한다.
- 공개 descriptor는 일반 `CLIENTS` 배열에 넣지 않는다. 동일 `configKey: care` 때문에 로컬 생성 결과가 HTTPS 주소로 바뀌는 것을 피한다. `desktop/auth-config.json`, `experiences/synk-account/config.json`, `experiences/daily-fortune/account.config.json`은 읽고 바이트 보존을 확인할 뿐 쓰지 않는다.
- 공개 Care 설정은 `clients.care`에 전용 ID와 HTTPS callback을 넣으며 정적 앱은 same-origin `/care/config.json`을 읽는다. 기존 PKCE·계정 transport와 `X-SYNK-Product: platform`을 재사용한다.

## 등록 실행기와 복구

이 문서의 모델별 검수·root 신호·19개에서 20개로의 등록 수는 2026-10-07 적용 기록이다. 다음 변경은 현재 journal·공급자 목록·포털과 현재 요청의 승인 범위를 기준으로 한다. 과거 모델 검수 절차를 새 필수 관문으로 적용하지 않는다([AI 운영 원칙](../../docs/AI_운영원칙.md)).

`care-public-provision.cjs`는 이번 등록 하나만 처리한다. 인증/API 구현을 복제하지 않고 기존 `createProvider`의 canonical credential guard·공급자 목록·등록·secret 매핑 메서드를 호출한다. 기본은 dry-run이며 `--운영`, `--public`, `--portal`이 필수다. `--apply`가 있을 때만 등록·매핑 쓰기와 공개 산출물 생성이 가능하다.

다중 journal 간 완료 상태가 어긋나지 않도록 기존 `journalStore` 및 `state/provision-production.json.lock`을 사용한다. lock을 잡은 후 journal을 다시 읽는다. 기존 journal의 `bindings`와 `attempted`를 보존하고, `publicCare`에 이 한 등록의 시도·실제 ID·완료를 기록한다. 전체 `mapping`과 `pendingMapping`은 같은 journal의 정본을 사용하므로 다음 일반 provision dry-run도 20개 매핑을 인지한다. generic 설정 생성 경로는 여전히 기존 19개만 사용한다.

등록 응답이 끊기면 실제 ID 또는 도구의 정확한 등록 이름·단일 callback으로 재조회한다. 결과가 불명확하면 같은 등록을 다시 요청하지 않는다. 기존 callback을 다른 ID/이름으로 발견해도 임의로 연결하지 않는다. 매핑은 매번 쓰기 직전에 현재 전체 원문 SHA256과 대조하고, 응답 유실 시 원격 지문으로 확인한다. Fortune allowlist는 읽기로 대조만 한다. 원격 secret API에는 CAS가 없으므로 같은 매핑의 다른 변경과 동시에 실행하지 않는다.

고정 산출물은 저장소 안 `.tmp/synk-id/care-public-production/config.json`과 `portal-config.json` 두 파일이다. junction/symlink를 거부하고 이전 출력은 백업 후 원자 교체한다. 전자는 Care 정적 빌드 입력, 후자는 현재 포털의 모든 필드·기존 등록·callback을 보존하고 새 `platform` 동의 항목 하나를 추가한 후보이다. 도구가 파일을 쓰는 것으로 웹 게시가 되지는 않는다.

```powershell
# SYNK-appsscript에서. portal 파일은 적용/게시 직전에 공개 원문으로 새로 대조한다.
node tools/synk-id/care-public-provision.cjs --운영 --public .tmp/synk-id/public-production.json --portal .tmp/synk-id/care-public-current-portal.json

# 현재 요청에서 원격 적용이 승인되고 변경 관련 검증을 마친 범위에서만 실행.
node tools/synk-id/care-public-provision.cjs --운영 --public .tmp/synk-id/public-production.json --portal .tmp/synk-id/care-public-current-portal.json --apply
```

## 경로·CORS 확인

`synk-policy` latest main `7af3679d295a8b18d55cec0b4ac22ed53f3fc90c`에서 care 경로는 없으며, `/care`, `/care/`, `/care/index.html`은 공개 404였다. 이 작업본·SYNK-worktrees·Documents 상위 폴더에는 별도 AGENTS/CLAUDE가 없었다. 정책 저장소 README에 따라 GitHub Pages main-root에 검수한 산출물만 미러하며 CNAME·기존 경로·다른 작업을 보존한다. 내부 검수 TXT·자격증명·운영 기록은 공개하지 않는다.

운영 `synk-care`에 Origin=`https://synk.im` OPTIONS를 보내 204, allow-origin=`*`, GET/POST/OPTIONS 및 authorization/apikey/content-type/x-synk-product/x-synk-contract를 확인했다. `/auth/v1/oauth/token`은 OPTIONS 200, allow-origin=`*`, POST와 apikey/content-type 허용이다. 인증·토큰 발급·자료 저장 요청은 보내지 않았다. 이 preflight는 실제 로그인 후 저장 성공의 증거가 아니다.

## 새 매핑 반영과 기존 함수 보존

`lib/synk-auth.js`의 `createAuthVerifier`는 생성 시 제품 매핑을 읽지만, 2026-10-07 확인한 [Supabase 공식 환경변수 문서](https://supabase.com/docs/guides/functions/secrets)는 운영 secret 변경을 함수가 즉시 읽으며 재배포가 필요하지 않다고 명시한다. 따라서 이번 `SYNK_OAUTH_CLIENT_PRODUCTS` 변경에는 **account/learning/care/personal 네 함수 모두 재배포하지 않았다**. 예전의 항상 재배포 순서는 현행 공급자 규약에 맞춰 생략했다. 새 ID로 인증한 실제 API 호출까지 확인했다는 뜻은 아니다.

최종 읽기 조회에서 `synk-account` v30, `synk-learning` v26, `synk-care` v4, `synk-personal` v4는 모두 ACTIVE·verify_jwt=true였다. 재배포 검토 전후 버전과 updated_at이 같으며 비인증 요청은 네 함수 모두 401이다. account OPTIONS는 204, `/auth/v1/logout` OPTIONS는 200이고 `https://synk.im`과 요청 헤더를 허용한다. 앞서 확인한 care/token CORS와 함께 공개 앱의 인증 통로 조건을 확인했다.

release HEAD `adbcfa3cb1b9a7cc795ab1c33b159fe0240155ec`는 이전 배포 제품 commit `285bf919fe5273d2a0b40f339bfd26d4e5e530b8`와 제품·함수 소스가 같다. 다만 읽기 대조에서 운영 account의 `synk-atlas-summary.mjs`는 더 최신인 기존 commit `0019dd922d195c50dded9186d56076c914cc63ea`의 전체 wrapper와 일치했다. 이 운영 소스를 옛 release로 덮지 않고 보존했다. 비교용으로 만든 깨끗한 detached worktree는 사용하지 않아 제거했으며 원래 release·배포장부는 수정하지 않았다. 자격증명은 canonical reader가 메모리에서 읽었고 `.env` 복사나 값 출력은 없었다.

`personal-media-cleanup`은 서비스 키를 확인하고 OAuth 제품 매핑을 사용하지 않아 재배포 대상이 아니다. `synk-classroom`·`tutor`에도 매핑 소비 코드가 있으나 공개 Care가 사용하는 API 경로가 아니므로 이번에 수정·재배포하지 않는다. Fortune의 별도 허용 목록 역시 변경하지 않는다. migration·새 사용자·자료 생성/삭제·전역 cleanup 실행은 이 절차에 없다.

## 검수 및 게시 확인

새 단위 시험 18개와 기존 등록/설정/포털 회귀 48개, 합계 66/66이 통과했다. dry-run의 실제 운영 조회에서 기존 19개, 추가 1개, 매핑·Fortune 보존을 확인했고 로컬 설정 3개와 journal이 전후 동일했다. 근거는 `qa/care-public-candidate-preflight-20261007.json`이다.

적용 직전 공식 검수 메타의 completed·filesUnchanged=true와 15개 소스 SHA를 다시 대조했다. 실제 적용 뒤 공급자 등록 20개와 전체 매핑 SHA256 `c0b21c177b0ffa7fc30c899da23e9a5ac05d9a7a7ad3822bbc152b4f053f3e97`을 재조회했고 Fortune 허용 목록·기존 bindings·로컬 설정 3개가 그대로임을 확인했다. `state/mapping-production-20261007-confirmed.json`은 완료 journal.mapping과 같은 20개 원문으로 갱신했다. 공개 설정 두 파일은 `.tmp/synk-id/care-public-production/`에 있으며 게시 담당에게 전달했다.

운영 근거는 `qa/care-public-production-preflight-20261007.json`, `care-public-production-applied-20261007.json`, `care-public-production-functions-preflight-20261007.json`, `care-public-account-source-drift-20261007.json`, `care-public-production-verified-20261007.json`이다. migration·사용자·개인 자료 생성/삭제는 수행하지 않았다.

검수 범위는 `registry.cjs`의 새 descriptor, `care-public-provision.cjs`, `tests/synk-id-care-public.test.cjs`, 본 문서와 UI 담당 정적 빌드다. UI 빌드 입력은 실제 등록이 끝난 뒤의 public config이며 미리 ID를 추정하지 않는다.

게시 담당은 최신 main을 fresh fetch하고 root가 준비한 `.tmp/synk-care-public-20261007`의 `/care/**` 산출물과 포털 동의 목록을 검수한 범위로 반영한다. 계정 설정/콜백 동시 작업과 충돌하지 않도록 `portal-config.json`은 게시 직전 현재 원문에 다시 병합한다. 최소 확인은 기존 19개 ID·callback 불변, 공개 20번째 동의 항목, /care와 /care/ 정규화, 공개 파일 SHA·import/CSP·375px 화면, 로그인 버튼→운영 동의 화면→동일 HTTPS callback, 그 뒤 PC와 휴대폰에서 같은 계정의 실제 저장/조회다. 합성 브라우저 시험은 마지막 실사용자 두 기기 결과를 대신하지 않는다.
