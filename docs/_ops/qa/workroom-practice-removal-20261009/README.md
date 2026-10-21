# 작업실 AI 업무 연습 제거 — 2026-10-09

사용자 「빼줘」에 따라 내 작업실의 AI 업무 연습 메뉴·화면 진입·실습 모듈과 CSS 로딩을 제거했다. 기존 `?tab=workroom&section=practice` 주소는 제작 데스크로 돌아간다. 실습 원본·기기/회사 계정 기록·저장 API는 보존했다. 대체 기능은 추가하지 않았다.

## 확인한 범위

- 현재 작업본 관련 자동시험 57/57 통과: `workroom-client.test.mjs`, `workspace-navigation.test.mjs`, `workroom-practice.test.mjs`, `workspace-review-client.test.mjs`.
- 현재 작업본 실제 Chromium 확인 17/17 통과. 1280/390/320px 메뉴·가로 넘침, 기존 주소의 제작 데스크 이동, 제작 도구 진입, 기존 기기 기록 보존, 실습 모듈·API 요청 없음과 JS 오류 없음 확인.
- 운영 부모 `3a2f537a37d9`의 고정 444파일을 복제하고 `public/index.html`, `public/workroom.js`, `public/workspace.js` 3파일의 실습 관련 코드만 제거한 공개 후보 준비. 다른 현재 작업본 변경은 포함하지 않았다. 부모·후보·정확한 3파일 차분의 해시 불변 확인.
- 정확 공개 후보의 Chromium 확인도 17/17 통과. [실제 PC 화면](../../../../.tmp/workroom-practice-removal-20261009/candidate-ui/workroom-1280.png), [확인 결과](../../../../.tmp/workroom-practice-removal-20261009/candidate-ui/report.json), [차분](../../../../.tmp/workroom-practice-removal-20261009/release/delta.json).

후보 manifest SHA-256: `2204c3bf213385008733ecf6d698c968c96d3218ca6100940ed47e1f48efff88`.

## 현재 설치 앱과 공개 반영

실제 설치 Messenger의 `runtime.json`은 `https://workspace.synk.im/?tab=messenger`와 `messengerCloudPreview:true`다. 소스 변경만으로 현재 앱 화면에 반영되지는 않는다. 운영 VM은 RUNNING이나 현재 운영자 IP와 SSH 허용 IP가 달라 접속이 제한돼 있으며, 읽기 전용 진단만 했다.

공식 Claude Code에 `claude-opus-5-5 --effort max`로 읽기 전용 최종 검수를 요청했으나 HTTP429 `usage_limit_reached`, 종료 코드1, `is_error:true`, `modelUsage:{}`로 미완료다. 오늘 21:30 KST 제한 해제 안내이며 검수 완료·PASS로 기록하지 않는다. [원시 결과](../../../../.tmp/workroom-practice-removal-20261009/review/claude-review.json), [검수 요약](../../../../.tmp/workroom-practice-removal-20261009/review/claude-review-summary.json).

## 공개 반영 완료 — 20:51 KST

사용자가 이번 메뉴 제거의 검수 생략·공개 반영 질문에 **「웅 반영해」**로 직접 승인했다. 이번 UI 3파일에만 적용하며 일반 검수 원칙은 유지한다. 공식 검수는 위 기록의 429·미완료 상태이고 PASS로 바꾸지 않았다.

운영 릴리스는 `/opt/synk/releases/2204c3bf2133`, 최종 이미지 `sha256:5c79dacb01685bfe560c7d19caff0aacee7f68455e2d653c7236f6a5402e82f6`(`synk-company-candidate:2204c3bf2133-r2`)다. 고정 444파일 중 공개 UI 3파일만 달라졌으며 서버·설정·Caddy·실습 원본·저장 API는 부모와 같다. 설치 바이너리를 교체하지 않고 기존 앱이 연결하는 운영 화면에 반영했다.

- 동일 실행 귀속의 반영 전 백업 1회·업로드 완료 확인. 기존 데이터 volume·원키/VAPID·환경 30개 중 이미지 외 값·7개 unit·협동 Caddy 경로를 보존했다. main·3개 timer active, container healthy와 공개 health ready 확인.
- 정지 사본 대조에서 schema 변경0·기존 업무/파일/키 보존을 확인했다. 이미 기동 전에 만료된 고객 세션1개는 기존 생성자의 정상 청소로 삭제됐고, 기존 직원 암호문1개는 평문 전체가 같은 재암호화였다. 유효한 고객 세션은0이므로 이번 고객 로그인 유지 검증 대상이 없으며 과거 고객 인수를 이번 결과로 확대하지 않는다.
- 최종 이미지 재시작 후 직원 세션5개의 CSRF·만료·바인딩, 원키·VAPID·업무 자료·첨부의 동일성을 확인했다. [최종 보존 검사](../../../../.tmp/workroom-practice-removal-20261009/final-proof-result.json).
- 공개 HTML·JS3파일 HTTP200·MIME·SHA-256 일치와 health ready 확인. [최종 공개 대조](../../../../.tmp/workroom-practice-removal-20261009/public-final-verification.json).
- 기존 실계정 IAB 탭에서 새 로그인 없이 새로고침: `section=practice`가 `section=desk`로 변경되고 **제작 데스크 / 트렌드·레퍼런스 / 제작 도구 / 고객 관리 / 내 관리 페이지**만 표시됐다. AI 업무 연습 단추0개다. [반영된 실제 화면](../../../../.tmp/workroom-practice-removal-20261009/public-workroom.png).
- 운영자 IP는 작업 동안만 SSH 규칙에 추가했고 완료 후 원래 단일IP 제한으로 복원했다. 다른 방화벽 필드·SSH 키는 바꾸지 않았다.

첫 인수 절차는 오래된 고객 만료 상태를 활성 세션으로 가정해 쓰기 없이 거절됐다. v2는 모든 고객 바인딩·8시간 계약을 검증하며 active/expired를 분리하고 기동 전 만료된 정확한 행 삭제만 허용한다. 합성 보호 검사49/49 통과했다. 첫 이미지의 COPY 파일 모드0600으로 공개 root가500인 실패도 보존했다. 해당3파일의 바이트를 유지하며0644로 고친 이미지를 기본 사용자에서 실제 읽기 확인한 뒤 지속 반영·재시작·공개 대조를 다시 마쳤다. 최초 실패를 최종 성공으로 덮어쓰지 않았다. [권한 수정](../../../../.tmp/workroom-practice-removal-20261009/image-mode-fix-result.json), [지속 이미지 적용](../../../../.tmp/workroom-practice-removal-20261009/readable-image-activation-execution.json).

현재는 **공개 반영·실계정 화면 확인 완료**다. 기존 앱은 새로고침하면 반영된 화면을 사용한다. 전체 Linux843시험·실물 두 기기·새로운 학습/업무 효과·현재 릴리스의 전체 VM 재부팅은 이번 검증으로 주장하지 않는다.
