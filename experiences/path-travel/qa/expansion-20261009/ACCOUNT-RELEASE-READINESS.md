# PATH 계정·공개 준비 점검 · 2026-10-09

> 10월 9일 운영 반영 전의 준비·제한 응답 기록이다. 아래 활성화 값·미완료 항목·출시 순서는 당시 후보 기준이다. 같은 날 사용자 요청에 따른 실제 계정 연결·공개 완료와 남은 물리 기기 검증은 [운영 계정·공개 배포 결과](../production-20261009/README.md)를 따른다. 당시 고정 검수 절차는 현재 공통 지침이 아니다.

이 문서는 여행 전용 등록·공개 설정 도구와 계정 UI의 로컬 구현 상태를 정리한다. 로컬 담당의 점검·시험은 원격 API·DB·실계정에 접근하지 않았다. 이후 root가 운영 **메타데이터 읽기 계획**만 실행한 결과를 아래에 별도로 추가했다. 실제 등록·권한 변경·배포·공개·유료 호출은 실행하지 않았다. 합성 공급자에 대한 쓰기 시험은 원격 적용이 아니다. 다른 제품의 과거 운영 기록을 여행 계정 운영 증거로 사용하지 않는다. 전체 여행·공개 빌드·서버의 최종 검사 결과는 담당 결과 기록에서 확인하며 이 문서에서 진행 중인 수치를 확정하지 않는다.

## 준비된 것과 남은 연결

| 대상 | 로컬에서 확인한 사실 | 아직 확인/구현할 것 |
|---|---|---|
| 여행 계정 어댑터·UI | [planner-account.mjs](../../planner-account.mjs)의 별도 `clientKey/resource=path-travel`와 공식 계정 노트북, [planner-account-session.mjs](../../planner-account-session.mjs)의 게스트/계정 전환을 UI에 연결했다. `available:false`, `productionRegistered:false`를 유지한다 | 실제 전용 등록·설정·인증 왕복이 확인되기 전에는 두 활성화 값을 켜지 않는다. 현재 기본 실행은 계정 factory·설정·인증을 읽기 전에 준비 상태로 반환한다 |
| 개인자료 | [personal-data.mjs](../../../synk-account/src/personal-data.mjs)의 여행 validator·512 KiB 한도. 계정 문서에는 기기 저장 동의를 싣지 않는다 | 최종 확장 소스로 다시 생성·회귀 검사하고 원격 함수와 실제 왕복을 별도로 검증한다 |
| 기존 PATH | `path`는 PATH VR. 여행은 `path-travel`로 분리 | 기존 VR client·자료를 여행의 등록/기록으로 재사용하지 않는다 |
| 등록 목록 | [registry.cjs](../../../../tools/synk-id/registry.cjs)에 `path-travel-browser`, `configKey:path-travel`, 개발 callback `http://127.0.0.1:4303/`를 추가했다. 기존 PATH VR·native 9개 callback은 보존한다 | 실제 등록은 미실행. 공통 provision의 `--only path-travel-browser`로 범위를 한정한다 |
| 공개 설정 | [public-config.cjs](../../../../tools/synk-id/public-config.cjs)는 여행 전용 실제 public client를 별도 키로 처리한다. VR ID 중복 거절·기존 client/port 보존을 합성 시험했다 | 실제 전용 ID와 정확한 callback을 원격에서 확인해야 한다. 예시 ID로 대체하지 않는다 |
| 공개 callback 도구 | [personal-public-provision.cjs](../../../../tools/synk-id/personal-public-provision.cjs)의 `--product path-travel`은 확인된 여행 등록에 `https://synk.im/try/travel/`만 추가하고 여행 설정·포털 후보를 만든다. 옵션 없는 기존 운세·리허설 동작은 유지한다 | 새 client 생성은 이 도구가 하지 않는다. 공통 provision이 먼저 전용 등록/매핑을 확인해야 한다. 공개 포털에 여행이 아직 없어도 검증된 전용 등록만 새 동의 항목으로 추가할 수 있다 |
| 공개 앱 빌드 | [prepare-personal-public.mjs](../../../../tools/prepare-personal-public.mjs)의 `path-travel`은 정확한 공개 callback과 별도 client를 검사해 `config.json`·`build-manifest.json` 두 파일만 만든다. `artifact:account-config-only`, `appBuilt:false`를 명시한다. [UI](../../planner-ui.mjs)는 `notebookOptions.configUrl`에 현재 모듈 옆 `./config.json`을 명시했다 | 실제 앱은 기존 [sync-travel-experience.mjs](../../../../../SYNK-website/sync-travel-experience.mjs)에서 빌드한다. 검증된 config-only 산출물을 이 빌드에 넣고 정확한 인증/API 연결 출처를 CSP에 허용하는 후속이 남아 있다. 상대 설정 URL 지정만으로 공개 계정 연결이 완료되지는 않는다 |
| 여행 게스트 공개 | 기존 여행 전용 빌드와 72파일 복사는 로컬 확인돼 있다([진행 검증](../progress-20261009/README.md)) | 이번 확장 최종 소스로 다시 sync/build 후 검수·게시·공개 주소 확인이 필요하다. 게스트 게시와 계정 활성화는 완료 조건이 다르다 |

## 서버와 DB

[SYNK-talk 개인자료 계약](../../../../../SYNK-talk/docs/개인자료_계정보관_API.md)은 여행을 별도 resource로 명시한다. [synk-personal-server.js](../../../../../SYNK-talk/lib/synk-personal-server.js)는 인증한 사용자 범위, `platform` 제품, resource validator, revision 기반 충돌·삭제 계약을 공통으로 처리한다. 여행만을 위한 새 서버나 유료 AI 엔드포인트는 요구하지 않는다.

[새 migration](../../../../../SYNK-talk/supabase/migrations/20261009010000_synk_path_travel_c16.sql)은 `engine.synk_personal_state`의 resource 체크에 `path-travel`만 추가한다. 기존 행·소유권·grant·미디어를 바꾸지 않는다. 직전 `20261008130000`과 명시된 checksum, 기존 네 resource 체크가 정확히 맞아야 적용된다. 운영에 이 선행판이 있다고 이번에 확인한 것은 아니다. 선행 상태가 다르면 관련 없는 migration 전체를 밀어 해결하지 말고 실제 차이를 먼저 확인한다.

[synk-personal-build.js](../../../../../SYNK-talk/tools/synk-personal-build.js)는 appsscript 공통 validator와 여행 종속 모듈을 `_shared/synk-personal-runtime.js`로 생성한다. 서버 [동봉.json](../../../../../SYNK-talk/supabase/functions/synk-personal/동봉.json)이 이를 `synk-personal-runtime.mjs`로 배포 묶음에 연결한다. 해당 `.mjs`가 작업 디렉터리에 따로 없는 것은 이 동봉 계약이며 누락 증거가 아니다.

기존 [synk-personal-api-rehearsal.js](../../../../../SYNK-talk/tools/synk-personal-api-rehearsal.js)는 기본 준비 모드이며 `--run`에서 리허설의 새 합성 Auth 사용자 두 명을 생성·삭제한다. 현재 원문은 VR `path`·리허설·가족 앨범 등을 검사하고 여행 왕복을 포함하지 않는다. 비밀번호 로그인 시험이라 실제 OAuth PKCE와 물리 두 기기 시험도 대신하지 못한다. 여행을 추가한 별도 검증 범위가 필요하며 이 점검에서는 실행하지 않았다.

## 최소 출시 순서와 실제 변경 경계

1. **완성된 로컬 연결을 최종 산출물과 대조한다.** 여행 등록 목록·공개 설정 처리·UI 노트북/session 구현은 완료했다. 게스트 유지·명시 동의·VR 분리·다른 계정 분리·충돌·삭제·오프라인 복구·큰/잘못된 문서 거절 검사를 유지하고, 실제 config 후보와 CSP를 기존 공개 빌드에 연결한다. 최종 모델/자료와 서버 생성본의 `--check`·관련 검사를 함께 확인한다.
2. **정확한 출시 후보를 공식 Claude로 검수한다.** 아래 지정 모델과 추론 수준으로 source·생성본·검사·실행 경계를 검토하며 실제 모델과 완료 결과를 보관한다. 수정하면 그 변경도 검토 범위에 포함한다.
3. **등록/매핑 계획을 현재 원격 메타데이터와 대조한다.** 기존 [provision-plan/apply](../../../../tools/synk-id/UNIFIED-CONFIG.md)는 현재 전체 매핑 지문·기존 등록·journal을 보존하도록 설계돼 있다. 여행 browser 하나의 새 public/none OAuth client와 정확한 callback, 기존 `platform` 제품 매핑만 추가하는 계획이어야 한다. 다른 준비 중인 catalogue 항목까지 등록하는 계획이면 그대로 적용하지 않는다. 개인자료 내용 조회는 필요하지 않다.
4. **확정한 원격 변경만 실행한다.** Auth Admin 등록과 `SYNK_OAUTH_CLIENT_PRODUCTS` 병합, 정확한 여행 migration, 검수한 `synk-personal` 함수가 각각 별도 변경이다. 각 단계의 실제 반영을 재확인한다. `auth` 내부 테이블 직접 편집, 전체 스키마 일괄 적용, 관련 없는 함수 재배포는 필요하지 않다.
5. **현재 공개 포털 동의 목록을 보존하며 여행만 추가한다.** [prepare-portal의 config-only 절차](../../../../tools/synk-id/README.md)를 사용한다. 포털 전체 UI나 다른 서비스 callback을 과거 파일로 덮지 않는다. 서버 secret 변경 자체 때문에 예전 함수 소스를 다시 배포하지 않는다.
6. **실제 인증 왕복을 증명한 다음 계정 기능을 켠다.** 전용 client의 PKCE·거절/취소·갱신·로그아웃과 동의 후 저장/복원/삭제, 다른 계정 분리·두 기기 충돌을 승인된 시험 계정/자료만으로 확인한다. 합성 공급자 시험, 실제 브라우저 로그인, 물리 두 기기는 따로 기록한다. 여행 파일 이동 성공만으로 계정 동기화를 완료했다고 적지 않는다.
7. **공개 파일과 공개 동작을 확인한다.** [SYNK-website README](../../../../../SYNK-website/README.md)의 현재 경로는 `synk-policy`의 GitHub Pages main/루트다. 검수한 여행 영향 파일만 반영하고 기존 하위 페이지·다른 작업을 보존한다. Pages 완료, 공개 URL의 파일 지문/실행·모바일·저장/복원·로그인 진입을 각각 확인한다. 내부 docs/qa/지문·자격증명은 공개 루트로 복사하지 않는다.

### 이번 로컬 도구 검증과 명령

여행 도구와 기존 등록·공개 설정 관련 **94/94**, 공유 catalogue를 소비하는 Care·회사·플랫폼·포털·WORLD 공개 준비 회귀 **66/66**을 통과했다. [실행 요약·원본 지문](account-tooling-tests.json). 합성 API/파일만 사용했으며 실제 운영 자료를 읽지 않았다. `--only` 생략 시 기존 전체 계획/검증 동작을 유지하고, 지정 시 다른 미등록 항목과 미매핑 제품은 보류한다. scoped 적용은 공통 runtime 설정 파일을 쓰지 않는다. 알 수 없는 등록 이름·다른 진행 중 매핑·다른 등록 재시도는 거절한다. 자기 범위의 매핑 응답 유실은 지문으로 확인해 중복 쓰기 없이 재개한다.

계정 UI 연결은 신규 [session 검사](../../../../tests/path-travel-account-session.test.mjs) 10개, [계정 검사](../../../../tests/path-travel-account.test.mjs) 5개, [UI 컨트롤러 검사](../../../../tests/path-travel-planner-ui.test.mjs) 20개, 합계 **35/35** 합성 시험을 통과했다. 두 활성화 값이 모두 true일 때만 노트북을 만들며, 게스트 초안 보존·계정 기록의 브라우저 동의 분리·전환 중 편집 잠금·설정 URL 연결을 구현했다. 이는 실계정 로그인이나 물리 두 기기 동기화 증거가 아니다. 전체 여행·홈페이지 빌드·서버 검사의 최종 수치는 이 35개에 합산하지 않는다.

아래 첫 두 명령은 **원격 메타데이터를 읽는 dry-run**이다. 첫 명령은 root가 후속 실행했고, 현재 매핑 지문 일치·여행 신규 등록 필요·소개팅 등록 보류를 확인했다. 요약은 [등록 계획 결과](registration-dry-run-summary.json)에 두며 토큰·client ID·계정자료는 포함하지 않는다. `registered:0`은 선택한 여행 범위의 등록 수이며 운영 전체 등록이 0개라는 뜻이 아니다. 쓰기와 개인 계정자료 조회는 없었다. 두 번째 명령은 아직 실행하지 않았고, 여행 전용 등록이 필요한 현재 상태에서는 실행 조건이 충족되지 않는다. 출력 폴더는 존재하지 않는 새 `.tmp` 경로를 고른다.

```powershell
node tools/synk-id/provision-apply.cjs --운영 --only path-travel-browser
node tools/synk-id/personal-public-provision.cjs --운영 --product path-travel --out .tmp/path-travel-public-plan-NEW
```

각 명령에 `--apply`를 추가하면 실제 등록/매핑 또는 callback이 바뀐다. 공통 등록 적용에는 검증된 `--public <공개설정.json>`도 필요하다. 실제 적용 후에만 등록 결과와 최신 포털을 다시 읽어 후보를 만들며, `--only` 없는 전체 적용으로 대체하지 않는다. 등록·callback 응답이 불확실할 때 자동 재전송하지 않는 기존 journal 보호를 유지한다.

검증된 여행 설정 후보를 받은 뒤 아래 명령은 **로컬 파일 두 개만** 준비한다. 새 후보 폴더를 사용하고 그 안의 `config.json`을 최종 여행 공개 빌드의 입력으로 삼는다. 이 결과만으로 로그인 UI를 켜거나 등록 확인을 완료하지 않는다.

```powershell
node tools/prepare-personal-public.mjs path-travel .tmp/path-travel-config-NEW .tmp/path-travel-public-plan-NEW/path-travel-config.json
```

### 운영 도구에서 주의할 실제 계약

- [원격배포.js](../../../../../SYNK-talk/tools/원격배포.js)는 작업본이 아니라 **커밋된 HEAD**에서 읽고 배포 대상의 미커밋 차이를 거부한다. 자기 변경의 정확한 파일과 동봉 생성본을 검수·커밋한 뒤 준비한다. 읽기 모드도 자격증명과 프로젝트 조회를 사용하므로 “로컬 검사”로 취급하지 않는다. 이번 점검에서는 호출하지 않았다.
- 적용 전 저장소 최신 migration과 대상 DB 판을 대조한다. 무관한 작업이 저장소 최신판을 올렸다면 실제 여행 필요 스키마와 운영 상태를 확인해야 한다. 단순히 진행하기 위해 `--판무시`를 기본값으로 넣지 않는다.
- [원격SQL.js](../../../../../SYNK-talk/tools/원격SQL.js)는 쓰기 SQL을 `--적용` 없이는 보내지 않는다. 명령 문자열의 환경 선택과 실제 대상 프로젝트를 일치시켜야 한다. [자격증명.js](../../../../../SYNK-talk/lib/자격증명.js)는 관리 토큰을 출력하지 않고 만료/운영 대상 조건을 확인하는 기존 통로다.
- 등록 도구의 `--apply`, SQL·함수 도구의 `--적용`, 공개 저장소 push는 실제 변경이다. API 제품 매핑 secret은 다른 서비스도 사용하는 민감한 공통 설정이며 현재 원문 지문과 동시 변경을 확인해야 한다. 자격증명 자체를 출력하거나 명령줄 인자로 전달하지 않는다.
- 여행 계산은 현재 정적 자료와 로컬 코드이며 새 유료 AI·지도 API 결제는 이 연결의 필수 단계가 아니다. Supabase 운영 용량·호출·메일 비용과 잔여 한도는 이번에 확인하지 않았다. 신규 결제·구독·자동충전이나 유료 AI 검증으로 범위를 넓히지 않는다.

## 공식 Claude 최종 검수 · 사용량 제한으로 미완료

공식 **Claude Code 2.1.292**에서 `--model claude-opus-5-5 --effort max`를 명시해 최종 검수를 시도했다. 그러나 `You've hit your session limit · resets 5:30am (Asia/Seoul)` 제한 응답으로 종료됐다. [실행 결과](release-review.json)는 `isError:true`, `completed:false`, `actualModelVerified:false`, 빈 `modelUsage`를 기록한다. 실제 모델 실행과 소스 검토 완료는 확인되지 않았으며, CLI 프로세스 종료를 검수 통과로 보지 않는다.

당시에는 고정 모델의 최종 검수 완료를 기다리는 계획이었다. 제한 응답의 05:30 안내는 성공을 보장하는 시간이 아니었으며, 미완성 후보의 시도는 최종 검수 근거가 아니다. 이후 사용자가 최종 검수를 후행으로 남기고 배포하도록 요청한 경위는 [운영 반영 기록](../production-20261009/README.md)에 있다. 현재 역할·검증 방식은 [공통 운영 원칙](../../../../docs/AI_운영원칙.md)을 따른다.

## 운영 반영 전 점검의 결론

여행 계정의 validator·저장 어댑터·노트북/session UI·전용 등록/설정 도구와 DB 증분은 로컬 준비됐다. 활성화 값 두 개는 false다. 검증된 config-only 산출물의 기존 공개 빌드 반영·CSP 연결, 공식 Claude 최종 검수, 실제 원격 등록/적용, 실계정과 물리 두 기기 검증이 남아 있다. **운영 로그인·계정 동기화·최신판 공개·실제 여행자 만족도는 이번 점검으로 확인되지 않았다.** 실제 사람 검증은 [별도 준비 문서](FIELD-TEST.md)에 미실시로 둔다.
