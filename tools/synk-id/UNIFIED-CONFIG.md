# SYNK ID 공통 등록 목록과 로컬 설정

등록 도구의 계약과 10-06~09 실행 이력을 함께 보존한 문서다. 현재 등록 수·환경·적용 여부는 `registry.cjs`, `state/provision-환경.json` 및 제품별 최신 적용 기록으로 확인한다. 아래 최초 준비 단계의 미적용 설명을 이후 운영 상태로 읽지 않는다. 여행의 후속 등록·v23·공개 확인은 [10-09 운영 결과](qa/path-travel-production-20261009/README.md)에 있다. 당시 검수 담당·단계는 실행 이력이며 현재 공통 검수 절차를 새로 만들지 않는다.

## 2026-10-09 여행 전용 로컬 준비

`path-travel-browser`는 기존 VR `path`와 다른 `platform` public client다. 개발 callback은 `http://127.0.0.1:4303/`이며 native 등록/포트는 추가하지 않는다. `provision-apply.cjs --only path-travel-browser`는 해당 등록과 제품 매핑만 계획하고, `--apply`가 없는 실행은 읽기다. 지정하지 않으면 기존 전체 계획/적용 동작을 유지한다. 범위 지정 적용은 다른 미등록/미매핑 항목을 보류하고 공통 runtime 설정 파일을 쓰지 않는다. 알 수 없는 ID·다른 pending mapping·다른 등록의 재시도는 거절한다.

전용 등록·매핑이 확인된 뒤 `personal-public-provision.cjs --운영 --product path-travel --out <새-.tmp-폴더>`로 정확한 공개 callback `https://synk.im/try/travel/`과 포털/설정 후보를 준비한다. 이 명령도 `--apply`가 없으면 읽기이며, 옵션 없는 기존 운세·리허설 선택은 유지한다. `prepare-personal-public.mjs path-travel <새-.tmp-폴더> <여행설정.json>`은 앱을 복제하지 않고 `config.json`과 `build-manifest.json`만 만든다. 실제 여행 앱은 기존 홈페이지 여행 빌드가 담당한다.

아래 최초 로컬 준비 단계에서는 여행 등록·callback·매핑·DB/function 적용과 공개 동기화를 실행하지 않았다. [당시 준비 검증](../../experiences/path-travel/qa/expansion-20261009/ACCOUNT-RELEASE-READINESS.md)과 위 후속 운영 결과를 구분한다.

`registry.cjs`가 서비스, 실행 환경, API 제품, 정확한 개발 콜백의 공통 목록이다. 플랫폼·WORLD·메신저·교사·운세·플레저는 각자의 OAuth client와 저장소를 사용하면서 기존 중앙 SYNK ID에 연결한다. 기존 WORLD 앱과 맞춤 도구의 등록 ID도 같은 목록에서 관리한다. 등록 ID나 비밀번호를 서비스 사이에 복사하지 않는다.

PATH·대화 리허설·가족 앨범의 native·브라우저 어댑터는 로컬 구현과 합성 시험을 마쳤다. 교사의 브라우저 직접 로그인은 `pending-adapter`다. 목록에 이름이 있다는 것은 실제 앱 어댑터·원격 데이터 API·OAuth 등록이 모두 운영 중이라는 뜻이 아니다. 공통 생성기는 인증 방식이나 데이터 API를 새로 만들지 않는다.

소개팅은 `dating-browser` 전용 public client로 기존 `platform` 제품 계약을 쓴다. 개발 콜백은 `http://127.0.0.1:4300/atlas-lab/dating.html`이며 native 등록을 추가하거나 기존 native 포트를 옮기지 않는다. 계정 모드 서버도 해당 포트와 전용 공개 설정으로 실행해야 한다. 이 목록 추가 자체는 공급자 등록·포털 동의 목록 게시·실제 로그인 확인을 뜻하지 않는다.

2026-10-08 소개팅은 **리허설에만** 실제 등록·매핑을 추가했다(기존18개 보존, 총19개). `state/provision-rehearsal.json`이 현재 근거이며 전용 공개 설정만 저장하고 공통3개 설정과 운영 환경은 유지했다. 실제 제공자 인증 HTTP/로컬 제품 왕복10개를 확인했다. 공개 동의 포털의 소개팅 추가 후보는 준비했으나 게시하지 않았고, 브라우저 포털·물리 기기·운영 로그인 완료를 뜻하지 않는다. [상세 기록](../../docs/_ops/qa/atlas-dating-provider-20261008/report.json). 계정 실행 설정은 `SYNK_DATING_MODE=account`와 `SYNK_DATING_ACCOUNT_CONFIG`를 명시하고 `node experiences/atlas-lab/dating-server.mjs --check-config`로 외부 호출 없이 점검한다. 포트는 등록된 콜백에서 선택하며 임의 포트로 바꾸지 않는다.

## 공개 등록 결과 입력

`generate-public-config.cjs`는 네트워크 요청도 운영 자격증명 읽기도 하지 않는다. 공급자에서 **실제로 조회하거나 등록한 결과**의 공개 필드만 JSON으로 받아 처리한다.

```json
{
  "version": 1,
  "environment": "production",
  "supabaseUrl": "https://PROJECT.supabase.co",
  "supabasePublishableKey": "공개 publishable 또는 anon 키",
  "portalUrl": "https://synk.im/id/",
  "clients": [
    {
      "registration": "care-browser",
      "client_id": "공급자가 실제 반환한 public client ID",
      "client_type": "public",
      "redirect_uris": ["http://127.0.0.1:4296/"]
    }
  ]
}
```

위 예시는 입력 구조 설명이며 실제 등록 결과가 아니다. 실제 ID를 추정하거나 예시 문자열을 운영 파일에 채우지 않는다. `clients`는 공급자의 public 목록을 그대로 넣을 수 있다. 그때는 `bindings: {"care-browser":"실제 ID"}`로 공통 목록과 연결한다. 여러 공개 브라우저 콜백 중 하나를 선택할 때는 `bindings: {"care-browser":{"clientId":"실제 ID","redirectUri":"실제 등록된 주소"}}`를 쓴다. 기존 legacy ID는 현재 입력 목록에서도 확인되는 경우에만 자동 연결한다.

등록 목록에 없는 ID, 중복된 실행 환경의 ID, 비밀 키, 잘못된 native 콜백은 거부한다. native·legacy 필수 콜백은 유지하며 공급자에 실제 추가된 HTTPS 콜백도 보존한다. 다른 loopback 포트나 인증 응답 query를 추가하는 것은 허용하지 않는다. 알 수 없는 등록은 삭제하지 않고 `unmapped`로 분리하며 새 ID를 만들지 않는다. 준비 중인 어댑터의 등록이 확인되어도 실행 설정에 로그인 기능이 준비된 것처럼 넣지 않는다.

## 실행

```powershell
node tools/synk-id/generate-public-config.cjs --input=공개등록결과.json
node tools/synk-id/generate-public-config.cjs --input=공개등록결과.json --write
node --test tools/synk-id/public-config.test.cjs
```

기본 실행은 dry-run이다. `--write`도 원격 변경 없이 다음 고정된 로컬 파일만 쓴다.

- `desktop/auth-config.json`: 현재 등록된 native 9종 중 확인된 항목만.
- `experiences/synk-account/config.json`: 브라우저 플랫폼·WORLD·메신저·플레저·PATH·대화 리허설·가족 앨범 및 등록된 전체 동의 콜백 목록.
- `experiences/daily-fortune/account.config.json`: 운세 전용 browser client를 기존 운세 어댑터의 `clients.platform` 필드로 제공.
- `experiences/atlas-lab/account.config.json`: 입력에서 실제 `dating-browser` 등록이 확인된 경우에만 생성한다. 소개팅 전용 client를 `clients.platform`으로 제공하고 공통 브라우저 `clients`에는 `dating` 키를 넣지 않는다. 전체 등록의 `authorizationClients`에는 소개팅도 포함한다. 등록이 없는 입력은 이 파일을 생성·교체·삭제하지 않는다.

설정이 의미상 같으면 파일을 건드리지 않는다. 바뀌는 파일은 같은 디렉터리에 기존 내용을 `.backup-시각-난수`로 보관하고 임시 파일을 원자적으로 교체한다. 각 파일별 원자 교체이며 여러 파일 전체가 하나의 트랜잭션인 것은 아니다. 저장소 밖으로 연결된 junction·symlink는 거부한다. 출력에는 공개 키 값이나 토큰을 출력하지 않는다.

개발용 desktop main·teacher·product preview는 기본 `desktop/auth-config.json`을 확인한다. 명시한 `--auth-config=경로`가 우선이며 해당 파일이 없으면 다른 설정으로 몰래 넘어가지 않는다. 패키징된 앱의 `runtime.json` 설정 경로는 유지한다. 특정 앱 등록이 없으면 그 앱의 로그인은 준비 상태로 남는다.

`buildConfigPlan`이 돌려주는 `products`는 확인된 등록의 API 제품 매핑 **후보**다. 기존 서버 `SYNK_OAUTH_CLIENT_PRODUCTS`를 덮어쓸 권한이나 계획이 아니다. 원격 등록, 서버 매핑 병합, 동의 포털 배포, DB/function 배포, 실제 로그인 왕복은 별도 검증 단계다. 옛 `oauth-clients.js --register`·`--products` 쓰기 옵션은 이제 실행 전에 거부한다.

## 검토 가능한 등록 적용 도구

`provision-plan.cjs`는 읽기 계획만 만든다. `provision-apply.cjs`도 기본은 읽기이며 **`--apply`를 지정한 실행만** 새 public OAuth 등록과 기존 제품 매핑 병합을 수행한다. 구현 중에는 합성 API로 시험했으며 실제 원격 쓰기를 실행한 증거가 아니다.

```powershell
node tools/synk-id/provision-apply.cjs --운영 --public 공개설정.json --mapping 현재전체매핑.json --bindings 현재연결.json
# 다음 명령은 실제 원격 설정을 변경한다. 실행 범위가 승인된 경우에만 사용한다.
node tools/synk-id/provision-apply.cjs --운영 --public 공개설정.json --mapping 현재전체매핑.json --bindings 현재연결.json --apply
node --test tests/synk-id-provision-plan.test.cjs tests/synk-id-provision-apply.test.cjs
```

`--운영`이 없으면 기존 리허설 프로젝트다. 공개 설정 파일은 위 v1 공개 설정 구조이며 `supabaseUrl`이 선택한 기존 프로젝트와 일치해야 한다. 공급자 목록은 적용 도구가 새로 조회하므로 입력 파일의 client ID를 등록 근거로 쓰지 않는다. 현재 두 환경의 최초 통합에는 운세가 포함된 `--mapping 기존전체매핑.json`과 `--bindings 현재연결.json`이 필요하다. 이후 journal이 있으면 그 확정 원문으로 재개할 수 있다. 기존 전체 원본의 SHA256이 현재 서버의 secret 지문과 일치할 때만 다음 단계로 간다. 명시한 매핑에도 기존 WORLD·맞춤 도구 연결이 그대로 있어야 한다.

기존 SYNK-talk 자격증명 보호 조건도 실제 실행 모드로 호출한다. 운영 dry-run은 선택한 운영 REF에 `읽기: true`를 선언하며, 운영 적용은 `읽기: false`와 `--운영`을 전달한다. 리허설 적용은 `읽기: false`이며 운영 승인 인자를 전달하지 않는다. 보호 조건이 확인한 REF가 요청 대상과 다르면 중단한다. 읽기 전용 공급자 객체는 등록·매핑 변경 메서드도 네트워크 요청 전에 거부한다.

공급자 등록에는 [Supabase Auth 공식 OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml)의 `client_name`, `client_type: public`, `token_endpoint_auth_method: none`, `redirect_uris`를 사용한다. 기존 등록을 수정·삭제하지 않으며 같은 콜백으로 등록된 앱을 발견하면 연결을 명시할 때까지 중단한다. 도구가 생성한 정확한 이름과 콜백이 다시 확인되는 경우에는 실제 ID를 재사용한다.

재실행 기록은 임시 산출물이 아닌 `tools/synk-id/state/provision-환경.json`에 원자 교체한다. 이 공개 원문은 삭제·정리 대상이 아니다. 토큰·공개키·server key는 저장하지 않으며 public client ID, 키 순서가 유지된 전체 매핑, 시도와 응답 ID·HTTP 상태, 매핑 확인 상태만 보관한다. 이전 `.tmp/synk-id/provision-환경.json`은 읽기 호환하며 다음 저장부터 새 위치를 사용한다. 실행 중 같은 파일의 `.lock`을 만들며 기존 잠금을 자동 삭제하지 않는다. 자격증명 보호 조건 확인 뒤 잠금을 잡는다. 잠금이 남으면 해당 PID의 실행 상태를 확인한다.

각 등록 직전과 제품 매핑을 쓰기 직전에 현재 secret 지문을 다시 읽는다. 매핑 POST 직후에도 지문을 확인한다. 공급자 secret API는 조건부 쓰기/CAS를 제공하지 않으므로 마지막 읽기와 POST 사이에 다른 관리자가 동시에 변경하는 경우까지 원자적으로 방지하지는 못한다. 같은 시간에 다른 매핑 변경을 실행하지 않는다. 지문이 달라지면 현재 원본 확인 없이 덮어쓰지 않는다.

등록 응답이 끊기면 공급자 목록을 다시 조회한다. 반환받은 실제 ID가 있으면 이름 필드 없이도 콜백·public 유형을 대조해 복구한다. 결과가 계속 불명확하면 같은 등록을 재요청하지 않는다. 이전 요청이 종료됐고 실제 등록이 없음을 운영자가 확인한 경우에만 `--apply --retry-confirmed-absent care-native`처럼 그 등록 하나를 명시해 재시도한다. 도구도 직전 지문과 공급자 목록을 다시 확인하고 일치하는 등록이 있으면 재사용한다. 반환 ID가 기록돼 있는데 목록에 없으면 재시도를 거부하므로 공급자 상태를 먼저 확인해야 한다. 확정 HTTP 거절도 임의 자동 재시도하지 않는다.

제품 매핑 쓰기 응답이 끊겨도 지문을 먼저 대조하며, 확인된 쓰기를 다시 POST하지 않는다. 전체 등록과 매핑이 확인된 뒤에만 실제 ID로 로컬 설정 파일을 생성한다. 매핑 병합 후 재개할 때는 오래된 `--mapping`을 다시 넘기지 않고 보존한 journal의 최신 매핑을 사용한다. 입력 원본이 journal과 다르면 중단한다. 동의 화면 배포, DB/function 배포, 역할·권한 변경, 유료 서비스, 사용자 로그인은 이 도구의 기능에 포함되지 않는다.

## 2026-10-06 최초 적용 기준과 포털 보존

운세가 먼저 등록되어 운영은 기존 WORLD·도구·운세 4개, 리허설은 WORLD·운세 3개다. 두 환경 모두 새 등록은 15개이며 teacher-browser는 제외한다. 운세 native/browser는 현재 원문과 명시 bindings로 재사용한다. 기존 `SYNK_FORTUNE_CLIENT_IDS` 배열 지문은 정본 운세 provisioner처럼 실제 binding ID 집합을 사전순 정렬해 대조하며 이 secret은 쓰지 않는다. native/browser 역할의 올바름은 각각 실제 콜백과 별도 대조한다. 제품 매핑은 `SYNK_OAUTH_CLIENT_PRODUCTS` 한 항목만 병합한다. 현재 확정 원문은 `state/*-before-unified.json`에도 보관한다.

목록 API는 [공식 구현](https://github.com/supabase/auth/blob/719db0b75c79168fd2d75046fa48c09cacf7780b/internal/api/oauthserver/handlers.go#L231)의 `OAuthServerClientList`가 pagination TODO이며 전체 `All()` 조회다. OpenAPI에는 page/per_page가 있지만 실제 두 환경의 page 2도 같은 전체 목록을 반환했다. 도구는 전체 목록을 한 번 읽고 중복·미지의 페이지 필드·페이지 헤더를 거부한다. OpenAPI 기본 페이지 크기 50개에 도달하면 보수적으로 중단하여 공급자 계약을 다시 확인한다. 이 제한은 현재 완료 후 19개/18개 범위에 영향을 주지 않는다.

두 환경이 같은 로컬 설정 세 파일을 사용한다. 리허설 적용·검증·산출물 준비 후 운영 설정을 생성하고 최종 issuer를 다시 확인한다. 기존 파일은 각 환경에서 백업되지만 여러 환경의 실행 설정을 동시에 활성화하지 않는다.

포털에는 현재 live `config.json`의 fresh 공개 스냅샷을 `--current`, 등록 후 생성한 공개 설정을 `--config`로 제공한다. 누락하면 거부한다. `prepare-portal.mjs`는 현재 설정의 모든 필드를 보존하고 `authorizationClients`에만 새 항목/추가 콜백을 합친다. 기존 클라이언트의 product 변경은 거부하고 오래된 후보로 기존 항목을 제거하지 않는다.

```powershell
node tools/synk-id/prepare-portal.mjs production 새출력폴더 --current=현재게시본.json --config=experiences/synk-account/config.json --config-only
```

이번 최소 게시 후보는 `--config-only`의 `config.json` 하나다. 이 모드는 기존 게시 번들의 platform/world/messenger 제품과 네 native scheme 계약도 검사하므로, 로컬 소스에만 추가된 제품·scheme은 별도 포털 배포 검수 없이 끼워 넣을 수 없다. root가 synk-policy origin/main 기준 격리 작업본의 `id/config.json`·`id-rehearsal/config.json`만 교체하여 검수하며 기존 앱 번들/자산/다른 공개 설정은 유지한다. 준비 명령은 원격 게시를 하지 않는다. 현재 스냅샷이 실제 live와 같은지는 준비 직전/게시 직전 별도 GET·diff로 확인한다.

## 2026-10-07 운영 반영

사용자 명시 승인 후 리허설 18개와 별도로 운영 기존 4개를 보존하고 신규 15개를 등록했다(총 19개). 최종 공개 ID 원문은 `state/mapping-production-20261007-confirmed.json`·`state/bindings-production-20261007-confirmed.json`, 재개 journal은 `state/provision-production.json`이다. 로컬 세 공개 설정은 운영을 가리키며, synk.im/id/config.json의 동의 등록도 19개로 게시됐다. care/personal 저장 migration 2개·서버 함수 3개·flag 2개를 운영에 적용했다. [적용 결과·검증·복구 절차](qa/운영적용-최종준비-20261007.md)에서 리허설 인증 왕복과 운영 배포 증거를 구분한다. teacher-browser adapter·일반 신규 가입 메일 발송·실사용자의 물리 두 기기 왕복은 완료하지 않았다.
