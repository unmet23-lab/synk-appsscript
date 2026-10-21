# SYNK Workspace · 담당 반과 학생 케어 검증

2026-10-09 로컬 구현. 실제 운영 학생·교사 계정이나 공개 서버를 이용하지 않았다. 합성 계정·임시 SQLite·메모리 PostgreSQL(PGlite)에서 현재 소스와 브라우저 동작을 확인한다. 사용자 화면 이름은 SYNK Workspace이며 `messenger`·`teacher`의 권한·OAuth·저장 식별자는 호환을 유지한다.

## 구현과 근거

후속 검수: [WORLD·TOWN·Workspace 공통 데이터 감사](../workspace-data-audit-20261009/README.md). 그 후속 감사 시점에는 최신 3D 전체 경로와 공개 적용이 미완료였다. 이후 결과는 [운영 연결 후속 결과](../workspace-connect-20261009/README.md)와 [연결 마감 기록](../workspace-connect-close-20261010/README.md)에 있다. 아래 계정 회귀의 당시 6개 실패는 이력으로 보존하며, 후속 감사 시점의 현재 체크아웃에서는 해당 범위 104/104가 통과했다.

| 범위 | 확인한 동작 | 결과 위치 |
|---|---|---|
| 담당 반 전체 | 기본 2반×16명, 실제 배정 명부를 모두 반환. 33번째 학생도 누락하지 않음 | `SYNK-talk/tests/synk-teaching-overview.test.js` |
| 반과 마을 | 서버가 학원 반마다 공식 마을·실제 학생 membership을 연결. 공개 마을과 구분 | 동일 PostgreSQL 시험 |
| 학생별 케어 | 담당자·기한·메모·예정/처리 중/완료, 중복 제출·수정 revision·다른 반 거부 | 동일 PostgreSQL 시험 및 교사 브라우저 결과 |
| 공유·권한 | 실제 담당교사 변경·학생 이동·계정 소유 변경·공유 철회·재동의 경계 | 동일 PostgreSQL 시험, 교사 UI 회귀 |
| 교사의 실제 처리 동선 | 32명 카드·이름순 정렬·첫 학생 선택·같은 반/다른 반 전환·실제 케어 생성/수정/완료·검색·권한 철회 | [실제 Chromium 50/50](browser/report.json) |
| 학생의 실제 공유 동선 | WORLD 학습 공유와 별도의 Town 동의, 실제 Town 입장·버튼 활동, 교사 API 확인, 철회·재동의·재접속 | [실제 Chromium 18항목](student/report.json) |

최종 교사 화면은 1440·1280·390·320px에서 가로 넘침이 없고, 개요 글자는 11px 이상이다. 첫 학생 선택은 QA가 스크롤하기 전에 앱이 직접 학생 상세로 이동하는 것을 확인했다. 케어 입력창도 PC·휴대폰의 실제 viewport 안에서 촬영했다. 페이지·콘솔·자산 오류와 예상 밖 외부 요청은 0이며, 15개 관련 소스의 실행 전후 해시와 최종 파일이 일치한다.

실제 화면: [담당 2반·32명](browser/overview-first-viewport-1440.png), [휴대폰 학생 상세](browser/first-student-selection-390.png), [휴대폰 케어 입력](browser/care-dialog-viewport-390.png), [학생의 선택 공유](student/student-sharing-390.png). 화면의 이름·기록은 합성 검증 자료다.

관련 자동 검증은 새 PostgreSQL 7항목, 학생 공유·호스트 8항목, 학습 호스트 6항목, 교사 클라이언트·개요·브리지 28항목을 통과했다. 생성물은 교사 호스트·계정 portal·수업 runtime·PC continuity의 현재 소스 대조를 통과했다. 개별 실행의 겹치는 검사를 합산한 총점으로 표시하지 않는다.

범위를 넓힌 계정 회귀에는 **6개 실패가 남아 있다**([82/88 로그](regression/account-broader-regression.tap)): 계정 전체 로그아웃의 처리 순서·새 계정 보호 기대 2개, WORLD 공개 입구 기대 1개, 플랫폼 링크/계정 상태와 단순 DOM fixture 기대 3개다. 이번 명칭 변경은 해당 계정 처리 동작을 수정하지 않았고, 복구한 `core.mjs`의 함수·exports도 이전 원문과 byte 단위로 일치한다([범위 확인](regression/broader-failure-scope.json)). 이 기록만으로 기존 계정 전체 검증이 통과했다고 판단하지 않는다. [이름 관련 112항목](regression/naming-related.tap), [해당 시점 PC 전체 402항목](regression/desktop-full.tap)은 통과했다.

명칭 치환 과정에서 발생한 9개 파일의 문자 치환 손상은 변경 전 원문·생성물·이 세션의 패치를 대조해 복구했다. 초기 대상 18개를 재검사했고 제품 이름·manifest·호환 식별자를 확인했다([최종 이름 검사](regression/naming-audit.json)). 복구 자료는 `.tmp/workspace-name-repair-20261009/`에 보존하며 자동 삭제하지 않았다.

학생 브라우저 검증은 기존 학원 Town(FT10/FT51)을 실제로 열어 실행한다. 최초 입장은 `client-reported` 방문이며 실제 Town 명령 수락은 `server-command` 활동이다. 생활 활동량은 언어 학습 근거가 아니며, 기록 없음·미공유·계정 미연결을 학습의 약점으로 바꾸지 않는다. 학생 개인정보·대화·취향은 활동 요약에 담지 않는다.

별도 최신 3D TOWN의 모든 생활 경로와 16명 동시 접속은 아직 이 연결의 검증 범위가 아니다. 현재 마을 소속·학생·공유 버전·활동 수신 계약을 그 경로에도 사용할 수 있도록 준비했다. 실제 3D 경로를 운영 계정에 붙인 뒤 별도 왕복 검증이 필요하다.

## 재현

- 학생 UI: `node experiences/synk-account/qa/verify-town-sharing-care.mjs`
- 교사 UI: `node docs/마케팅/온라인마케팅지도/engagement/company/qa/verify-workspace-care-browser.mjs`
- 학생 공유·호스트: `node --test experiences/synk-account/tests/town-sharing.test.mjs`
- 교사 개요·연결·전송: `node --test experiences/teacher-world/workspace-overview.test.mjs experiences/synk-account/tests/teacher-client.test.mjs experiences/synk-account/tests/messenger-teacher.test.mjs experiences/synk-account/tests/classroom-client.test.mjs`
- 정적 호스트: `node --test experiences/learning-hub/server.test.mjs`
- 서버: SYNK-talk에서 `node --test tests/synk-teaching-overview.test.js`
- 생성물: `node tools/build-messenger-teaching.cjs --check`, `node tools/build-synk-account.js --check`, SYNK-talk에서 `node tools/synk-classroom-build.js --check`.

실행 시점이 다른 보고서의 소스 해시·시간을 최종 배포 증거로 사용하지 않는다. 학생 QA의 play migration 선행 마커는 기존 fixture의 계정 schema bootstrap을 나타내는 합성 표식이며 운영 선행 migration의 실행 증거가 아니다.

## 10-09 당시 운영 반영 준비

기존 운영 이력 확인 → 선행 migration 확인 후 `20261009230000_synk_teaching_care_towns_c16.sql` 적용 → 수업 서버 runtime/function 반영 → 교사 OAuth 클라이언트·콜백과 Workspace 서버 설정 확인 → 브라우저·PC 설치본 갱신 → 실제 교사/학생 공유·철회·케어 왕복 순서로 진행한다. 이는 당시 준비한 순서다. 실제 운영 반영은 위 후속 결과로 확인하며 이 후보의 migration·등록을 반복 적용하지 않는다. 실제 교사·학생 공유/철회·케어 왕복의 미확인 범위는 그대로 구분한다.

최대 보관은 학생/동의 범위당 Town 활동 2만 건, 반당 케어 5천 건이다. Town 상한에서도 개인 생활 명령은 계속 동작하고, 케어 상한에서도 기존 할 일 수정은 가능하다. 2반32명 조회의 단일 PGlite 실행 0.30~0.51초는 합성 로컬 관찰값이며 운영 성능을 보장하지 않는다.

원문: [Workspace 사용법·범위](../../../마케팅/온라인마케팅지도/engagement/company/WORKSPACE.md#workspace-care-20261009), [교사 UI](../../../../experiences/teacher-world/README.md).
