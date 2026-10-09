# WORLD · TOWN · Workspace 검수와 소스 보존

2026-10-10. 지금까지 연결·설치한 소스를 검수하고 필요한 수리와 푸시를 마쳤다. 공개 데모 수업 진입 핫픽스도 06:30 KST에 운영 적용과 공개 화면 확인을 완료했다. 개인 계정으로 진행하는 최종 인수는 아래 별도 범위로 남긴다.

## 소스 푸시와 원격 검증

| 저장소 | 원격 master 커밋 | 확인 결과 |
| --- | --- | --- |
| SYNK-appsscript | `7b2318e5c50145af05c37d62317820b9f56f381f` | 검수된 연동 소스와 직접 빌드 의존 324개 파일 푸시. [syntax-check 37989237468](https://github.com/unmet23-lab/synk-appsscript/actions/runs/37989237468)는 `skipped`. 비공개 저장소의 self-hosted 실행 조건에 따른 미실행이며 원격 시험 통과로 세지 않는다. |
| SYNK-talk | `2a69aba126c2cf25bffffe9e4fd2e5d4c2c65486` | [CI 37990850653](https://github.com/unmet23-lab/SYNK-talk/actions/runs/37990850653) 성공. 3,334개 중 3,317 통과·실패 0·건너뜀 17. |
| SYNK-talk DB | `6ca62432f6eab8856dfdb28883aff4480bde30c8` | [DB 37990775904](https://github.com/unmet23-lab/SYNK-talk/actions/runs/37990775904) 성공. 이후 `2a69aba`는 WORLD 빌더 한 파일만 바뀌어 DB 검증 입력은 동일하다. |

백엔드 CI의 건너뜀 17개는 CI에 없는 형제 저장소·특정 Git 이력·시험 재료의 대조다. 정확한 시험 이름과 사유는 [최종 CI 기록](backend-final-ci.json)에 있다. 교정 엔진 평가는 저장된 출력이 있는 **26개 중 26개 통과**이며, 전체 102개 중 출력이 없는 **76개는 미측정**이다. Expo 빌드 작업은 push 실행 조건상 건너뛰었으므로 앱 빌드 성공으로 세지 않는다.

## 변경과 검증

- WORLD 주소를 허용하는 검수된 한 줄이 공용 원본에서 빠져 있어 설치 v4와 동일하게 맞췄다. native runtime 100개는 설치 v4와 같은 source hash `e5e29cac7499f1bd6480190e1fd3385a473673161b9158efe14bb1dfe382f179`다. native/account 조립 293개와 검수된 source/test/tool 201개를 해시로 확인했고 관련 시험 224개가 통과했다.
- Workspace는 반 관리·학생 케어·공통 계정에 필요한 소스와 직접 의존만 최신 원격 기준으로 합쳤다. 기존 고객·제작·업무실 변경을 유지했다. 관련 Node 시험 97개와 교사 화면 번들 대조가 통과했다.
- WORLD 계정 원문은 후행 별도 게임 작업을 제외하여 이번 공개본의 번들과 바이트 단위로 일치하게 보존했다. 계정/학생 연결 11개 및 OAuth 공개 등록 41개 시험을 통과했다. 후행 공유 원본은 덮어쓰지 않았다.
- 백엔드 4함수의 생성 모듈 21개는 이미 배포한 검수본과 동일하다. 최신 원격 lifecycle migration 2개와 fixture를 보존했다. 관련 합성 회귀 178개는 최초 177개 통과 후 기존 Google 응답 필드 기대값을 갱신한 파일의 27개 시험 재검증으로 전부 통과했다.
- 누락됐던 누적 DB 사후 검사를 고쳤다. 기존 전체 검사·계정 lifecycle 검사를 유지하고 교실/WORLD/Town의 **추가 표 14개를 이름으로 등록**해 존재·RLS·정책 0·익명/인증/service 역할 권한 0을 확인한다. 전체 표와 RLS 기대값은 66이다. **운영 migration 84개는 바이트 불변**이고, 합본은 신규 조각 1,299줄만 추가했다. 관련 시험 **77개**, 각 표의 RLS 끄기·같은 개수의 다른 표로 교체·역할별/PUBLIC 권한·정책 추가 **98개 변이 검사**가 통과했다. 실제 Supabase CI에서도 빈 DB 적용, 동일 재실행, checksum 불일치 차단, 롤백, c3/c4 부트스트랩 데이터 보존, reset, 합성 Auth/JWT의 RLS·쓰기 차단을 통과했다. [SQL 수리 기록](backend-postcheck-repair.json)
- CI가 형제 저장소를 요구하지 않도록 이미 보존된 로컬 Atlas와 배포된 교사/Town 모델을 사용했다. 브라우저 QA 의존성은 실제 브라우저 사용 때만 읽으며, WORLD 클라이언트 시험 원본은 승인 공개본과 해시가 같다. 시험 단언은 유지했고, **세 런타임 번들 대조가 모두 통과**했다. [독립 검토](backend-portability-independent-review.json)
- `2a69aba`의 WORLD 진단 레이블 구성 변경은 정적 검사기가 문자열을 실제 import로 오인하던 문제를 고쳤다. 후속 Atlas·소스·CLI 검사 **38개 통과**, 독립 변경 검토 지적 0, WORLD 번들 바이트 동일을 확인했다. [후속 검토](backend-build-label-independent-review.json)
- 빌드 누락을 막기 위해 승인 브랜드 오프닝 13개와 화면의 직접 의존을 보존했다. 공개 빌드는 참조 누락·소스 변동·제작 메타데이터 누출 없이 성공했다. 최신 원격 게임을 보존한 출력 1,663개는 이전 공개 537개와 동일한 릴리스가 아니며, 이 소스 보존 빌드를 새로 공개 배포하지 않았다.

공용 작업본의 다른 변경과 로컬 미푸시 커밋 11개는 보존했다. 운영 DB·적용된 migration·사용자 프로필을 이 종료 검증에서 변경하지 않았다. 보고서 원본과 복사 해시는 [증거 목록](closure-evidence.json)에 기록했다.

## 공개 데모 핫픽스 — 운영 확인 완료

2026-10-10 **06:30 KST**(2026-10-09 21:30 UTC)에 적용과 독립 운영 검증을 완료했다. 공개 데모 수업 진입에서 보이던 누락 함수 안내를 `demo-ui.js` 한 파일의 3줄 추가·2줄 변경으로 고쳤다. 기존 4개 탭을 포함한 로컬 9개 검사와 공개 파일의 실제 핸들러 7개 검사가 통과했다.

- 최초 공식 검수는 런타임 변경 지적 없이 배포 도구에서 P2 세 건을 발견했다. 정지 전 교사 설정·실행 계약 검사, 부모 릴리스의 권한·소유자 보존, 실제 PASS 검수 내용과 입력 해시 검증을 운영 전에 수정했다. Python 16개·Node 8개 회귀 검사를 통과한 뒤 **Opus 5.5 / max 재검수가 정상 완료되어 PASS·지적 0개**였다. [최초 FAIL 기록](demo-teaching-hotfix/official-review/summary.json)과 [재검수 PASS 기록](demo-teaching-hotfix/official-review-r2/summary.json), 각각의 원문 결과를 함께 보존했다.
- 최신 부모 릴리스 558개 중 557개를 그대로 보존했다. 후보 이미지 전체 7,586개 항목 비교에서도 `demo-ui.js` 한 파일만 변경됐고, 준비 단계에는 운영 볼륨을 연결하지 않았다. 이미지는 `sha256:18c7a86cacbe06d259fa972c843e6675194cdf7f4dc03f55bf30ab2569940402`, 릴리스 manifest는 `d6579a536bdc8ae8a10dfcaa7c60dee2b82aa910a288920a84cea9eea60089de`다.
- 06:29 KST에 새 외부 백업의 업로드 완료를 확인하고 서비스를 한 번 정지·기동했다. 이후 읽기 전용 비교에서 **데이터 보존·스키마 변경 0·문제 0**을 확인했다. 만료 토큰/고객 세션 삭제와 직원 세션 재암호화도 각각 0이며, 복호화·운영 DB 쓰기·추가 재시작은 없었다. 06:31:53 KST 최종 상태에서도 새 이미지가 `healthy`였다. [데이터 보존 요약](demo-teaching-hotfix/data-preservation-summary.json)과 stage·backup·apply·verify·status 기록을 보존했다.
- 공개 `/demo-ui.js`와 `/app.js`는 HTTP 200이었다. `demo-ui.js`는 승인 해시 `7f73c1f3389348b20819afebd3d64466e880e2bf54db349d865b14e21c66779c`와 일치하고 `app.js`는 변경 전과 같았다. 격리 브라우저에서 `/?demo=1&tab=teaching`의 누락 함수 안내가 사라지고 **`/?tab=teaching`의 SYNK ID 로그인 화면**으로 이동했으며 페이지 오류는 없었다. [수정 전 화면](demo-teaching-hotfix/browser-before.png) · [수정 후 화면](demo-teaching-hotfix/browser-after.png)

공식 검수는 운영 실행 전에 마쳤으며 운영 성공은 이후의 영수증·공개 파일·브라우저 증거로 구분해 확인했다. 기존 사용자 프로필과 실제 사용자 세션에는 접근하지 않았다. 로그인 화면 도달 확인은 학생 본인 계정 로그인이나 수업 데이터 인수를 완료했다는 뜻이 아니다. [최종 핫픽스 인수 기록](demo-teaching-hotfix/final-acceptance.json)

## 별도 인수와 제외 범위

기존 연결·설치 검증은 완료했다. **실제 교사 발급 → 학생 본인 계정 연결 → 개인 학습/반 공유/TOWN 공유 선택 → 학생 활동 → 교사 확인**은 사용자가 별도로 진행하기로 한 실제 계정 인수다. 운영 학생이나 공유 동의를 대신 만들지 않았다. 라이브 송출과 16명 동시접속 시험도 이번 종료 검증에 포함하지 않았다.

이전 [운영·PC 적용 기록](../workspace-connect-20261009/README.md)과 이 폴더의 source assembly JSON에서 원본·해시·시험·보존 경계를 확인할 수 있다.
