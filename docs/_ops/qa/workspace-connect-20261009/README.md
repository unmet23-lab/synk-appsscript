# WORLD · TOWN · Workspace 운영 연결

2026-10-10 KST. 사용자 요청: 세 제품을 같은 계정·반·학생·학습 데이터에 연결한다. 아래는 진행 기록이며, 준비와 운영 적용을 구분한다.

## 데이터 연결

- 공통 SYNK ID와 서버가 확인한 학생·교사 신원을 사용한다. 화면이 보낸 학생 ID나 반 ID만으로 접근을 허용하지 않는다.
- 교사 화면은 담당 반, 반별 최대 16명, 기본 두 반을 기준으로 보여 준다. 운영 명부에 없는 반이나 학생을 예시 데이터로 채우지 않는다.
- WORLD의 채점·학습 결과, TOWN의 계정별 상태와 활동, 교사의 과제·돌봄 기록을 공통 서버에서 다룬다.
- 개인 학습 저장, 반에 학습 공유, TOWN 활동 공유는 별도 동의다. 위치 이동이나 접속 시간을 학습 성취로 표시하지 않는다.
- 명부의 미연결 학생은 담당 교사가 발급한 일회용 코드를 본인 계정에서 미리 보고 명시적으로 확인한다. 이 과정에서 교사 권한이나 학습 공유 동의를 자동 부여하지 않는다.
- TOWN 진입은 기존 서버 권한인 TOPIK 입장 조건과 체험/구독 권한을 확인한다. 이번 연결 작업에서 학생의 학습 수준이나 이용 권한을 임의로 만들지 않는다.

## 현재 확인된 적용

- **운영 OAuth 적용 완료**: 2026-10-10 00:16 KST. WORLD `https://synk.im/world/` 콜백 추가, Workspace `https://workspace.synk.im/api/teaching/callback` 전용 교사 등록 및 WORLD 제품 매핑.
- 공급자 등록 23개, 포털 등록 23개, 제품 매핑 23개를 다시 조회하여 전체 콜백 집합 일치와 기존 22개 보존을 확인했다.
- OAuth 공식 최종 검수: `claude-opus-5-5 --effort max`, 정상 완료. P0/P1/P2 없음. P3의 적용 순서·동시 변경 위험은 WORLD 선적용, 적용 산출물 전달, 최종 전체 목록 재대조로 확인했다.
- **운영 DB 구조 적용 완료**: 검수된 신규 8개 migration의 이름·checksum을 각각 확인했다. 새 14개 표의 RLS·클라이언트 권한·트리거·인덱스 검사를 통과했고, 기존 명부 9개 집계는 동일하며 새 표는 모두 0행이다. 기존 `20261009210000_classroom_sync_order_c16.sql` 이력은 보존했고 WORLD wardrobe는 충돌 없는 `20261009220000`을 사용했다. `.tmp/workspace-connect-20261009/operations-read/migration-application.json`, `migration-postflight.json`이 실제 운영 증거다.
- **운영 공통 API 적용·기능 활성화 완료**: `synk-classroom`, `synk-world-v1`, `synk-town`, `synk-account`의 실제 배포 모듈 21개가 검수한 커밋과 일치했다. JWT 보호와 익명 요청 401을 확인했다. 수업·WORLD·TOWN의 전용 기능 설정 세 개만 활성화했고 나머지 설정 지문은 모두 동일하다. 설정 반영으로 공급자가 판번호를 올린 뒤 현재는 앞의 세 함수 v2, account v55다. 브라우저 사전 요청도 세 경로 모두 204와 필요한 헤더를 반환한다. 기존 account의 8개 모듈과 진입 파일은 보존했다.
- **Workspace 서버 운영 적용 완료**: 03:15 KST v6(`e01fe60531bc`)로 전환했다. 기존 업무 자료·암호화 키·직원 로그인 세션 5개와 CSRF·만료를 보존했고, 원래 타이머 3개와 정상 상태를 확인했다. 공개 파일 11개가 검수본과 일치하며 교사 연결 설정이 활성이다. [배포·보존 증거](company-live-cutover.json).
- **공개 WORLD·수업 TOWN·중앙 계정 적용 완료**: `synk-policy`의 연결 커밋 `16e602a`와 공개 제작 메타데이터 정리 `4c6a365`를 반영했다. Pages와 전체 사이트 CI 모두 성공했다. 최초 612개 파일 전체를 대조한 뒤, 수리에서 그대로인 601개와 변경 10개의 공개 SHA, 삭제 2경로의 404를 확인해 최종 611개 공개 파일을 검증했다. 대용량 영상 3개의 최초 읽기 시간 초과는 재시도로 정확한 해시를 확인했다. 오디오 프레임은 동일하고 동시 LAB 음성 변경도 보존했다. [공개 최종 인수](public-final-acceptance.json).
- **PC 앱 세 개 복구 안내 수정·설치 완료**: 05:02 KST WORLD·Workspace·Platform에 정확 v4 패키지를 적용했다. 저장된 연결의 재확인과 새 로그인 안내를 구분하고, 정상 복구·계정 전환 뒤에는 이전 안내를 지운다. 공식 Opus5.5/max 최종 검수 정상 완료, 안내 관련 P3 세 건 해소 및 확인 범위 지적 없음. 관련138·공통507·실제 패키지3개·격리 Electron 화면12개 검사가 통과했다. 같은 계정의 미완성 메모 보존, 다른 계정의 이전 메모 숨김, 390px 안내 및 실제 계정 대화상자 표시를 확인했다. 설치 후6개 파일 SHA 일치와 기존 실행파일3개 보존을 재확인했으며 실제 프로필·로그인 보관소에 접근하지 않았다. [현재 PC 인수](native-recovery-acceptance-v4.json), [복구 화면 검사](recovery-ui-v4/result.json). 이전 v3 설치·복구 및 설치 WORLD 실제 입구 확인 이력은 [기존 인수](native-final-acceptance.json)에 보존했다.

## 검증 자료

- OAuth 적용 후 전체 대조: `.tmp/workspace-connect-20261009/oauth-applied-verification.json`
- OAuth 공식 검수 원문·완료 요약: `.tmp/workspace-connect-20261009/oauth-review/`
- 최초 공개 후보의 대조 기록은 `.tmp/workspace-connect-20261009/public-candidate-final.json`, `public-index-verification.json`에 보존했다. 이 후보는 재검수에서 공개 제외 파일과 복귀 경로 문제가 발견되어 **최종 배포 대상으로 사용하지 않았다**. 배포한 `.tmp/workspace-connect-20261009/public-candidate-v4.json`은 WORLD 537개·수업 Town 27개·중앙 계정 47개·포털 설정 1개, 총 612개다. 한글 학습의 최상위 창 이동과 Town 초기화 안내의 두 수리는 공식 Opus 5.5/max 최종 검수를 정상 통과했다. 실제 WORLD 안의 한글 iframe에서 개인 학습으로 최상위 이동을 확인했으며, 졸업 장면 자체를 플레이한 증거는 아니다.
- 중앙 계정 최종 후보 v4: `.tmp/workspace-connect-20261009/account-candidate-v4/manifest.json` SHA256 `a783b30a278b1815a6aa5ff8f821d98fbfbbc30d4ebaed732bf3498637dd6a97`. 반 학생의 개인 게임 시작과 공개 교사 Workspace 연결 시험 5/5 통과.
- WORLD 실제 Chromium 흐름과 모바일 화면: `../workspace-operating-connect-20261009/world-browser/`
- Workspace 최신 서버 후보는 `.tmp/workspace-connect-20261009/company-candidate-v6/`다. 현 운영 부모 `92e7854bc156`의 직접 할 일 기능을 보존했다. Windows·Linux 각각 126/126, 정확한 서버·화면의 Chromium 50/50 검사가 통과했다. 실제 508개 파일의 전후 해시는 모두 같으며, 두 반·32명의 합성 명부, 담당 반 경계, WORLD/Town 기록 구분, 케어 등록·수정·완료, 담당 반 철회, 320/390/1280/1440 폭을 확인했다. `ui-proof.json`과 `ui/report.json`이 근거이며 실제 학생의 운영 로그인 증거는 아니다.
- 백엔드 최종 검수·적용 증거: `.tmp/workspace-connect-20261009/backend-v3-opus-review.json`, `backend-v3-review-command-proof.json`, `backend-deploy-v3/postflight.json`, `operations-read/flags-activation.json`, `operations-read/live-cors-after-flags.json`. 공식 Opus 5.5/max 검수 정상 완료이며 최종 v3 변경에서 남은 결함은 없었다.
- 설치된 PC 앱의 읽기 전용 대조: `../workspace-operating-connect-20261009/desktop/installed-read-audit.json`
- PC 연결 보완: 학생 연결 코드만 허용된 발급 응답에서 전달하고 일반 인증 토큰은 계속 가린다. 실제 합성 HTTP 왕복 1/1, 관련 검사 75/75와 고정 교사용 바로가기 검사 통과. `.tmp/workspace-connect-20261009/root-review-fixes-verification.json`.
- PC 최종 v4: `.tmp/workspace-connect-20261009/native-final-verification-v4.json`, `native-install-gate-v4.json`, `native-install-result-v4.json`. 기존 v3에서 검수된 renderer 두 파일만 바꾸고 WORLD URL 보안 수정·제품 식별자·인증 설정·실행파일·로그인 저장 경로를 보존했다. 앱별102개 파일을 ASAR와 전수 대조하고 Platform의 자식 앱 해시도 갱신했다. v3의 복구 안내 P3 두 건과 후속 안내 잔류 P3는 모두 해소했다. 실제 학생·실물폰 검증으로 확대하지 않는다.
- 배포 복구 경계: 운영 접속 없는 보호 검사 13/13, 실패한 서비스·부모 이미지 누락·원키 변경을 주입한 복구 함수 실행 3/3. 실제 운영 장애 복구를 수행한 증거는 아니다.
- 공개 전체 파일 대조: `.tmp/workspace-connect-20261009/operations-read/public-live-1791569197994.json`, `public-large-files-retry.json`. 제외한 미리보기 두 경로는 실제 404다.
- 공개 수리의 재발 방지: `tools/build-world-app-public.mjs`는 기존 사이트 CI와 같은 제작 도구명 검사를 출력물 전체에 적용하고, 실패 시 `ok:false`와 종료 코드1을 반환한다. 24개 경계 사례·총27검사, 같은 공식 Opus5.5/max 세션의 후속 검수 PASS. `.tmp/workspace-connect-20261009/world-metadata-builder-guard-v1/handoff.json`. 기존 공개536파일은 모두 불변이며 이 확인을 새 전체 원본 빌드 실행으로 확대하지 않는다.
- 배포 후 공용 소스 동기화: `.tmp/workspace-connect-20261009/company-primary-sync.json`. 검수된 `synk-id.js`(`dd699970`)와 세대 경계 시험(`e6b534fe`)만 기존 원본 해시를 확인한 뒤 반영했다.
- 마지막 운영 입구 확인: `.tmp/workspace-connect-20261009/operations-read/final-entry-check.json`. 04:13 KST 공개 health ready, 교사 설정 활성, 관련4개 파일 SHA 일치를 다시 확인했다.
- 최종 운영 읽기·격리 왕복 확인: [2026-10-10 최종 인수](final-live-readonly-acceptance-20261010.json). 운영 4함수 본문 SHA·3설정·8migration·14표 보호와 명부 집계를 다시 확인했고, 동일 계정·담당 반·초대·동의·케어·Town·Workspace 세션 경계의 선별 합성 검사 15개가 통과했다. 운영 데이터·실제 계정 세션·메시지는 변경하지 않았다. 사용자가 실제 계정 연결은 이번 범위에서 제외했으며, 실사용 인수는 별도로 남는다.

로컬·격리 시험은 운영 학생의 실제 수업 사용을 증명하지 않는다. 사용자는 2026-10-10 후속 확인에서 **기존 연결·설치 검증까지 먼저 마무리**하도록 선택했다. 해당 범위는 완료했고, 실제 교사 발급 → 학생 본인 연결 → 공유 설정 → 학습·TOWN 활동 → 교사 확인 과정은 별도 인수로 남긴다. 운영 학생 계정이나 공유 동의는 이번 검증에서 만들거나 변경하지 않았다. 개인정보·토큰·원본 학생 기록은 이 보고서에 포함하지 않는다.

## 운영 반영 후 실사용 확인 순서

1. 교사가 Workspace의 `내 수업`에서 본인 SYNK ID로 연결하고 담당 반·학생을 확인한다. 미연결 학생의 연결 코드를 발급해 해당 학생에게 전달한다. 이 작업에서는 메시지를 대신 발송하지 않았다.
2. 학생은 본인 SYNK ID로 WORLD에 로그인하고 `내 반 연결`에서 코드를 입력한다. 표시된 학생·반을 확인하고 연결을 확정한다. 다른 학생 또는 교사 계정을 대신 연결하지 않는다.
3. 학생이 원하는 공유 범위를 직접 선택한다. 개인 학습 저장, 담당 교사에게 학습 공유, TOWN 활동 공유는 서로 구분된다. 같은 학생의 연습·활동 뒤 교사 화면에서 기록과 케어 후속 일을 확인한다.

2026-10-10 운영 읽기 기준 실제 명부는 반 1개·학생 1명·직원 2명이며 학생 SYNK ID 연결은 0명이다. 활성 직원 2명의 `staff.auth_user_id`는 유효한 인증 계정에 연결되어 있지만, 최종 읽기에서 이 직원들의 공통 `synk_auth_links → synk_accounts` 연결은 0명이었다. 앞선 [백엔드 운영 요약](backend-live-summary.json)의 직원 연결 2명은 인증 계정 연결 수이며 실제 교사 SYNK ID 로그인 완료를 뜻하지 않는다. 실제 계정 연결·동의·학습 사용은 이번 최종 검증 범위에서 제외했다. 화면의 두 반·32명 검사는 합성 자료로 수행했다. 기본 규모는 표시·관리 기준이며 실제 명부를 생성한 결과가 아니다.
