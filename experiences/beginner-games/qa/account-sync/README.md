# WORLD 게임 계정 저장 · 공개 운영 결과

2026-10-09. 입문 3종·상점과 기존 게임의 공통 코인·구매품·장착·목표·지원되는 진도를 기존 SYNK ID/WORLD 계정에 연결하고 운영 반영했다. 비회원 기록은 자동 합치지 않으며 사용자가 선택한 가져오기만 허용한다.

## 확인한 결과

- 운영 DB migration과 RLS·계정 삭제 연결 등 **13/13**: [사후 확인](production-postflight-result.json).
- synk-play v1 ACTIVE, 기능 활성화. [배포 코드 전체 대조](production-exact-bundle-result.json), [플래그 확인](production-flag-result.json). 일반 배포 대조기의 한국어 주석 앵커는 index를 측정하지 못해 별도 실제 ESZIP의 runtime 전체·정규화한 전체 index로 대조했다.
- WORLD 공개 OAuth 복귀 주소 등록 완료, 기존 22개 등록 보존. Platform SSO r2의 75검사를 거쳐 정확한 분리 모듈로 묶었다.
- 공개 커밋 **744e9f28ff5f742f7740b22a7533bee932476bdc**, Pages 완료. 게임 r9·계정 r6·합동 v6: **359파일, 변경331, 원본검사398**. [공개 파일 359/359 SHA·MIME](../../../../.tmp/world-public-release-20261009-v6/public-file-verification.json), [출판 기록](../../../../.tmp/world-public-release-20261009-v6/published-result.json).
- 실제 계정 Platform→WORLD OAuth, 게임 저장 완료, 상점 목표 저장→새 WORLD 탭 복원→목표 해제를 UI로 확인했다. 코인·구매품·게임 진도는 변경하지 않았다. [실제 계정 증거](actual-public-account.json), [복원 화면](actual-public-account-goal-restored.png). 같은 브라우저의 새 탭이므로 물리 두 기기 검증으로 간주하지 않는다.
- 공개 협동 HTTPS에서 독립 두 Chrome 문맥의 승인 음성·18수리·공동 이륙·상점·별지도 PNG·재접속·320px **96검사**, 미처리 오류0. [공개 브라우저 결과](coop-release/r4/public-browser/ui-results.json). 실제 AudioContext 완료23/32회이며 사람이 직접 들은 품질 평가나 실제 두 사람의 외부망 플레이 증거는 아니다. 처음 실패한 검사는 POST/SSE 전환 전에 다음 튜토리얼 상태를 읽었으며, 실제 화면 round 변경을 기다리도록 검사만 수정했다. [첫 실행](coop-release/r4/public-browser/ui-failure-first-attempt.json).
- 최종 후보의 합성 계정/PGlite 실제 Chrome **12/12**, 레이싱 맞춤 문제 앱22·서버40·Chrome7 확인. [게임 묶음](public-games/last-run.json), [레이싱](../../../korean-racing/qa/account-rewards-personalized/results.json).

## PC와 별도 확인 범위

PC는 조율된 「SYNK 플랫폼 기능 보강」 채팅이 a26 판의 WORLD·Platform·Messenger를 설치했다. 설치 파일/기존 데이터275개 보존과 실제 Platform·Messenger 로그인은 [담당 결과](../../../../docs/_ops/qa/platform-unified-followup-20261009/installed-result.json), [실제 UI 인수](../../../../docs/_ops/qa/platform-unified-followup-20261009/actual-account-r2.json)를 따른다. 이 채팅은 설치·프로필 조작을 하지 않았다. 보존 지문은 정상 사용자 UI를 열기 전 경계다.

남은 것은 PC↔휴대폰 물리 기기 왕복, 실제 두 사람의 네트워크/청취 체험, 학생 재미·재방문·지연 학습효과 평가다. 학습 가치는 TOPIK I의 기초 어휘/짧은 지시 듣기와 의미 연결 연습 범위이며 TOPIK 점수 향상을 입증한 것은 아니다.

옷장 후속은 10-09 08:25 KST 읽기 전용 점검에서 테이블·정확한 migration·함수·flag 부재를 확인하고 별도 반영했다. 사전 점검 당시 계정 행 조회·옷장 GET·보상 지급·원격 변경은 모두 0이었다. 기존 Play의 DB 13조건과 공개 runtime·entrypoint는 통과했다. [당시 운영 사전 점검](wardrobe-candidate-20261009/production-preflight.json), [기존 게임 코드 대조](wardrobe-candidate-20261009/play-live-baseline.json).

옷장 서버 후보는 별도 `SYNK-talk-wardrobe-release-20261009` 작업본의 커밋 `7489e0a55803773f8136a713b6af1be505333e13`에 고정했다. 원본 동작/인증29·DB 사후 점검14·실제 묶음 기동/복원7, **50/50** 통과 뒤 정확한 SQL·함수 11개 전체 대조·flag를 운영에 반영했다. 성공한 두 번째 flag 변경 전후 기존 함수 29개 전체 코드·보안 설정·기존 secret·삭제 함수를 보존했다. 공개 `2eb8cb98`의 클라이언트 한 파일만 FF 반영하고 Pages·일반 공개 URL bytes/SHA/MIME 일치 및 별도 공개 CI 성공을 확인했다. 첫 활성화 검사 실패→false 닫기와 초기 빌드 실패는 별도 보존한다. 실제 기존 계정의 목도리 저장→새 WORLD 탭 복원→기본 차림 원복→첫 탭 재조회 복원까지 플랫폼 담당이 단독 확인했다. 하얀 종이·원본 그림·저장 차림0·사진0을 유지했으며 첫 GET의 기본 지급 상태 저장 가능성은 읽기 전용과 구분한다. 같은 프로필의 두 탭이므로 물리 두 기기와 공식 최종 검수는 미완료다. [후보 원본](wardrobe-candidate-20261009/release-candidate.json), [현재 운영 반영·실패·확인 범위](wardrobe-production-20261009/README.md), [최종 완료 기록](wardrobe-production-20261009/completion.json).

## 검토 상태

초기 공식 검수와 수정 검수·협동 r4 검토의 근거는 보존했다. 맞춤 문항 추가 수정의 Opus5.5/max 검토는 사용량 한도로 **미완료**다. 사용자의 실제 원문 “최종검수는 지금 안해도 되 나머지 이어서 해”를 확인해 기능 검증 후 반영했다. [인간 지시 근거](review-deferral-evidence.json), [정확한 검토 상태](release-review-status.json). 검수 통과로 표시하거나 자동 재시도를 예약하지 않았다.

## 재개 자료

[현재 상태 JSON](release-readiness.json) · [전체 검증](../verification.json) · [출판 절차](../../../../../SYNK-website/qa/world-play-20261009/PUBLISH.md) · [이전 준비 이력](preparation-history-before-publication-20261009.md). 이전 후보 r7/v4·account-r4/v5·PC r3를 설치하거나 공개하지 않는다. DB/함수/콜백·협동 적용 명령을 반복 실행하지 않는다. 새 변경은 현재 원격을 읽고 영향 경로만 대조한다.
