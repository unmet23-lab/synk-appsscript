# 플랫폼 보관함 DB 번호 충돌 정리

2026-10-08 23:14 KST. **이 조사 시점에는 번호 충돌을 해소한 로컬 증분 후보였고 아직 원격 적용 전이었다.** 이후 실제 적용은 [반영 결과](COMPLETION.md)에 있다. 이 기록과 `collision-audit.json`이 앞선 `migration-platform-final.md`, `collision-renumber-result.json`의 번호·checksum·선행 이력 설명을 대신한다.

## 확정 후보

- 후보와 canonical 신규 SQL: `supabase/migrations/20261008130000_synk_platform_library_c16.sql`, 두 파일 바이트 동일.
- 크기 **26,306 bytes**, raw SHA-256 **d3b8c8a7800a5a2e6e2a02422a1316e7aac6d1e7eb0453aca610e8da29f10b17**.
- 선언/계산 checksum **ce1cef2cf41107a182d78a232f66b605a5651347aa9d8655a8749fef4f8879b3**, 슬롯 2개.
- 실제 양쪽 원격 직전 이력인 Drive sync `20261008120000` / `e6c51290b1ea40e19a78a3aea55277144c93f64a8e4f4386108f0a1b73ca01fb`를 선행 조건으로 검사한다.
- 기능 의존성인 personal `20261007010000` / `762c8150c1b087378d78c0c4c985830a01d272026f9677684df03e327754ad11`은 별도로 검사한다. Care push는 이 기능의 선행 조건에서 제외했다.
- 기존 `synk_personal_resource_c16`이 정확히 `path`, `rehearsal`, `family-album` 3개를 허용하는 검증된 CHECK인지 확인한 뒤 `platform-library`를 추가한다. 독립 작업에서 값을 추가하거나 바꿨으면 실패하여 그 값을 덮어쓰지 않는다. 정상 신규 이력이 있는 재실행은 기존처럼 즉시 반환한다.
- 사후 SELECT의 `판정`과 `플랫폼판정`이 실제 통과 조건이다. 개인 자료 RLS, 정책, 권한 누출, 계정 삭제 연결, 삭제 FK, 정확한 4개 자원 CHECK와 신규 checksum 이력을 확인한다. `후보스키마진단`은 오래된 전체 후보의 참고 진단이며 배포 통과 조건이 아니다.

## 원격 확인 결과

기존 관리 API 통로로 23:01–23:07 KST에 양 환경의 이력·카탈로그·SELECT 사후검사만 읽었다. 사용자 행·비밀·토큰을 출력하거나 읽지 않았으며 원격 mutation은 0회다.

| 항목 | 리허설 | 운영 |
|---|---:|---:|
| 적용 이력 | 88개 | 89개 |
| Drive sync `120000` 및 checksum 일치 | 확인 | 확인 |
| 신규 플랫폼 이력 없음 | 확인 | 확인 |
| `130000` 미사용 | 확인 | 확인 |
| 기존 3개 자원 CHECK 정의 일치 | 확인 | 확인 |
| engine 테이블 / RLS / 정책 수 | 57 / 57 / 7 | 58 / 58 / 7 |
| 개인 자료 RLS / 정책 / 권한 누출 | 1 / 0 / 0 | 1 / 0 / 0 |
| 개인 자료 삭제 연결 / 삭제 FK | 1 / 1 | 1 / 1 |
| Drive sync 자체 사후검사 | 전부 통과 | 전부 통과 |

기존 후보의 전체 기대와 원격 집합이 다르다. 양쪽에 `sunday_bundles` 열 9개, classroom 3개 표의 열 22개, `broadcast_segment_kind_c16`, classroom 트리거 3개가 후보 기대대로 존재하지 않는다. `sunday_bundles`와 방송 제약은 원격 `20261005020000_retired_tables_drop_c16.sql`의 제거 대상이며 classroom `20261003100000`은 원격 이력에 없다. 리허설은 Care push 이력도 없어 추가로 해당 표 14개 열·트리거 3개가 없다. **이는 후보와 실제 적용 집합 차이이며 DB 손상으로 판정하지 않는다.** 플랫폼 증분은 그 기능을 설치하거나 삭제하지 않는다.

원격 전체 적용 89개 SQL은 선언·계산 checksum이 일치하는 원본 경로와 raw SHA를 `collision-applied-set-manifest.json`에 기록했다. 기존 후보·main의 과거 SQL을 일괄 교체하지 않았다. 특히 main lifecycle/availability 파일은 원격 적용본과 다르다. 적용 원본은 `.tmp/atlas-eight-fix-20261008/talk-push-worktree/supabase/migrations/`에서 찾았다.

| 적용 원본 | 원격/계산 checksum | raw SHA-256 |
|---|---|---|
| `20261007020000_synk_account_lifecycle_c16.sql` (42,619 B) | `77fe3adae5c23133cd1ace4e98cf5ce664c5ced942a99cf06730b1748f78cff9` | `ee77b62b9b7bd2e56c0ba4ea45104ab86181f3a17233a4c1c429659eaa250932` |
| `20261007030000_synk_account_availability_c16.sql` (47,218 B) | `17887a3912492351056de750fa3892c9a4a593bfa7be0037d73e080e7a59c9e1` | `fce927a859a38883022dfdb0033fbee5082ab9873fe5c8f7e3b78bb62229b28a` |

## 로컬 검증

- `tests/synk-platform-library.test.js`, `synk-personal.test.js`, `synk-account-lifecycle.test.js`, `synk-account-availability.test.js`: **41/41 통과**. 실제 PGlite에서 기존 자료 보존, 소유자 분리, CAS·삭제 복구·권한 누출·변형 CHECK 거절을 확인했다. Drive 영수증만 합성한 fixture이며 Drive 실행이나 전체 운영 DB 복제를 뜻하지 않는다.
- 후보 `tests/마이그레이션_합본.test.js`, `tests/L0스키마.test.js`: **39/40**, 기존 선형 체인 검사 1개 실패. baseline `d4acb2931964727cd057596eec62b095be426b0a`의 Care/personal/care_push 불일치 3개는 그대로다. 이번 신규는 로컬 후보 밖의 실제 Drive 이력을 선행으로 삼으므로 파일순 검사 목록에 추가 1개가 표시된다. 따라서 예전의 “추가 체인 위반 0개”는 최종 후보에 적용하지 않는다. 검사를 약화하거나 건너뛰지 않았다.
- 후보 76개 checksum 검증 및 합본 생성/`--check` 통과: **2,395,237 B**, SHA `31ebfd6c4d26ba36bf37e896fbf5ca95b59cfdad7ce6e9a74c307a6e8a392b26`.
- main 합본 생성/`--check` 통과: **2,482,909 B**. main의 원격과 다른 과거 파일은 보존했다.
- 후보 `node tools/synk-personal-build.js --check`, 한정 `git diff --check` 통과.
- 기존 personal 원본 10,592 B / raw SHA `3415874eece5d8352bf3f80430d45eeadbfe1ec3ce76d477d8eed4a75fc592cf` / checksum `762c8150…` 그대로다.

**당시 배포 대상으로 검수한 것은 신규 `130000` 한 파일이었다. 후보 또는 main 전체 합본을 운영에 재적용하지 않는다.** 당시 준비에서는 직전 새 번호·선행 checksum·개인 자료 CHECK와 적용 후 feature 판정을 확인하도록 정했다. 이미 적용한 이 증분을 지금 다시 적용하는 지시가 아니다. 공식 Claude 최종 검수·신규 DB 적용·서버 배포는 이번 하위 작업에서 실행하지 않았다.

## 증거 및 수정 범위

- 원격: `collision-remote-history.json`, `collision-remote-compatibility.json`, `collision-history-sources.json`.
- 원본 위치·새 증분 선행조건: `collision-applied-set-manifest.json`.
- 최종 해시/체인/시험: `collision-audit.json`, `collision-feature-tests.txt`, `collision-schema-tests.txt`.
- 신규 SQL rename 및 보완: 후보·canonical `supabase/migrations/20261008130000_synk_platform_library_c16.sql`.
- canonical `tests/synk-platform-library.test.js`; 후보·canonical 생성 `supabase/L0_스키마.sql`, `supabase/확인_적용후상태.sql`.
- QA의 `collision-*` 스크립트·JSON·이 문서. 기존 적용 SQL 내용·자격증명·원격 데이터는 수정하지 않았다.
