# 플랫폼 계정·기록 연결 반영 결과 · 2026-10-08~09

**10-09 최신 후속:** 설치 PC 3종은 `22b4c7`, 공개 웹은 `f10cf8e`다. 실제 PC에서 계정 완료 메모 5개와 복구 기록 1개를 확인했고, Platform→Messenger가 기존 계정으로 자동 연결되어 실시간 상태·기존 메모·첨부가 표시됐다. [실계정·PC 복원](../platform-unified-followup-20261009/actual-account-pc-restoration.json). 아래 03:17 결과와 후보 보류 설명은 당시 이력이다.

계정 라이브러리와 개인 앱 보강을 서버·공개 웹·PC 앱에 반영했다. **10-09 03:17 KST 현재 공개 웹은 `917faae`, 설치 PC는 `f9d482`다.** 플랫폼은 서버 기록을 바로 열고 이전 미저장 복구본을 별도로 남긴다. 계정 기록 선택의 반복 native confirm을 제거했고 메모 수정·완료 목록 접기·삭제 직후 되돌리기를 함께 반영했다. 실제 설치 PC·공개 웹에서 선행 A 저장→오래된 PC B 저장 충돌→확인창 없는 계정 기록 선택·B 복구본 보존→B 재선택 CAS 차단→A·B·기존3개 보존→웹 완료 표시·PC 완료5개 복구까지 확인했다. 삭제·전체 덮어쓰기·자격증명 입력은 0이다. [최신 실제 검수](../platform-pc-web-conflict-20261009/result.json), [PC 화면](../platform-pc-web-conflict-20261009/pc-final-completed.jpg). **직원 로그인·실물 휴대폰 왕복·별도 계정 전환·앱 종료 뒤 OS 알림 수신·클릭은 미확인**이다. 사용자는 현재 휴대폰을 사용할 수 없다고 답했다. 통합 로그인 SSO는 조율한 별도 작업이며 이번 고정본에 포함하지 않았다. 후속v5는 f9d 기준으로 SSO만 분리해 전체322 검사를 통과했으나, 공식 검수가 사용량 제한으로 중단되어 설치하지 않았다. [통합 로그인 검수](../platform-unified-followup-20261009/README.md).

사용자 직접 지시 「최종검수는 지금 안해도 되 나머지 이어서 해」를 확인하여 이번 동기화 출시의 Claude 최종 검수를 후행으로 두었다. [지시 확인 기록](user-review-deferral.json). 공식 Opus 5.5·max 검수는 이전 HTTP429 이후 완료되지 않았고 다른 모델로 대체하지 않았다.

## 실제 반영과 검증

최신 PC는 기존1bcd의204개 입력에 승인 renderer JS/CSS2개만 합쳤다. 3앱 설치exit0·runtime88개씩·인증/fingerprint9종·등록3·바로가기6·설치/격리 QA까지 프로필67/127/105 SHA보존·부팅16·Messenger 익명8을 확인했다. 첫 숨김 부팅 UnknownVizError와 같은 설치 바이트에서 추가1회 통과한 근거를 함께 남긴다. [최신 설치](../../../../desktop/artifacts/platform-recovery-notes-candidate-2026-10-08T17-57-01-428Z/INSTALLATION.md). 공개 Pages와 canonical JS/CSS 대조는 성공했다. 기존917faae 전체 CI는 첫회 talk-rally 음성1개, 두 번째 rhythm personalization.js의503으로 각각 실패했고 이력은 그대로 보존한다. 후속 CI 전용 커밋 `a171b5b`는 10-09 04:06 KST 전체 공개 검사·회귀69·Pages 모두 성공했다. 정적 GET의 일시502/503/504만 시나리오 전체를 최대1회 재검사하고 최초실패를 보존하도록 보강했으며, 이번 실행은 재검사0·오류0이었다. 제품 JS/CSS는917과 동일하다. [최신 CI](../platform-site-check-recovery-20261009/site-ci.json). [최종 CI 진단](../platform-note-management-20261009/site-ci-diagnostics.json). 아래 표는 이전 출시 이력을 보존한다.

| 대상 | 결과 | 근거 |
|---|---|---|
| 개인 기록 DB | 리허설→운영에 신규 `20261008130000` 한 파일 적용, 양쪽 applied_verified. platform-library 자원 추가, RLS·권한·계정 삭제 연결 유지 | [DB 반영](completion-db-release.md) |
| 개인 기록 함수 | synk-personal 리허설 v4·운영 v19, ACTIVE·JWT 유지, 전체 배포 원문 일치, 익명 GET401/OPTIONS204 | [함수 반영](completion-personal-runtime-release.md) |
| OAuth | fortune/rehearsal 정확한 공개 callback2개 등록. 새 client·제품 매핑·운세 허용목록 변경0, 기존 platform callback 보존 | [적용 결과](completion-personal-callback-applied.json) |
| 공개 웹 | f859eaa7f87e2b952a37529c6abc9b45c6ee1384 반영. Care49·운세17·리허설21·플랫폼37·ID각14, 전체152파일 HTTP200/SHA/MIME 일치. 폐기 Care파일404 | [배포](completion-web-release.json), [공개 대조](completion-web-live.json) |
| 실제 회원 계정 | 명시 동의 후 QA메모 저장→새로고침 복구→별도 로그인 세션 복구→완료 표시 왕복→로그아웃 뒤 미노출. 기존 기록 삭제0·콘솔 오류0 | [회원 기록](../platform-continuity-exit-20261008/live-library-account.json) |
| PC 3종 최초 반영 이력 | 8a87… WORLD·Messenger·Platform 설치 종료 코드0. ASAR86파일씩·EXE·자식 앱 pin·등록3·바로가기6 일치. 기존 프로필 보존, 설치된 Platform 격리 부팅 및 기존 프로필 정상 창 표시 확인 | [설치 기록](../../../../desktop/artifacts/platform-continuity-candidate-2026-10-08T14-12-34-974Z/INSTALLATION.md) |
| PC Messenger 연결 반영 이력 | 6f6702… 3앱 설치 완료. 사용자 정상 종료 후 적용, 프로필3종 전후 동일. 실제 설치 Messenger HTTPS 익명8/8·Platform 부팅·정상 창 표시 확인 | [당시 설치](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/INSTALLATION.md) |
| PC 3종 직전 통합 이력 | 4738b908… WORLD·Messenger·Platform 설치 exit0. 앱 목록10개 및 계정 UX 포함, runtime87파일씩·인증·자식 installer pin·등록3·바로가기6 일치. 설치/격리 QA 전후 기존 프로필 동일, Platform16/16·Messenger HTTPS 익명8/8, 10-09 00:43 KST 원래 프로필 정상 창1회 표시 | [당시 설치](../../../../desktop/artifacts/platform-integrated-candidate-2026-10-08T15-27-45-012Z/INSTALLATION.md), [완료 증거](../../../../desktop/artifacts/platform-integrated-candidate-2026-10-08T15-27-45-012Z/artifacts/integrated-install-completion.json) |
| 리허설 문구 후속 | 61a1465e7673094a7c45c36506a2581f536d9627에 index.html·build-manifest.json만 변경. Pages 성공, 공개21파일 새 후보와 일치 | [문구 후속](completion-rehearsal-copy-release.json) |
| 공개 메모 입력 후속 | d05ab11b060dc9de45d7943f1d210b37433b4088로 JS1파일 반영. Pages·전체 site-check 모두 성공, JS와 유지한 CSS2파일 HTTP200/MIME/SHA 일치. 10-09 02:02 KST canonical2파일 재확인도 일치 | [공개 반영](../platform-input-continuity-20261009/public-release.json), [최종 공개 대조](../platform-live-roundtrip-20261009/public-final-byte-check.json) |
| 실제 웹 충돌 | 같은 계정의 두 독립 로그인에서 선행 A 저장 뒤 오래된 B 저장이 충돌로 거절됨. 계정 기록 선택 후 A·기존 메모 보존, B는 로컬 복구본 보존, 삭제0. 입력 UX 배포 전 로드된 코드에서 수행 | [웹 충돌](../platform-live-roundtrip-20261009/web-real-conflict.json) |
| PC 3종 계정 연결 수정 | 9c276629… 3앱 설치 exit0, runtime88파일씩·공개 인증9개·기존 fingerprint9개·installer pin·등록3·바로가기6 확인. 프로필67/83/105파일은 설치/격리 QA까지 동일. 격리 Platform16/16·Messenger 익명8/8 통과 | [당시 설치](../../../../desktop/artifacts/platform-account-fix-candidate-2026-10-08T16-32-01-047Z/INSTALLATION.md), [완료 증거](../../../../desktop/artifacts/platform-account-fix-candidate-2026-10-08T16-32-01-047Z/artifacts/account-fix-install-completion.json) |
| 실제 설치 PC↔웹 | 기존 PC 로그인 유지·웹의 기존 메모 읽기→PC 새 QA메모 저장→웹에서 완료 표시 저장→PC에서 완료 상태 복구. 기존2메모·웹 미선택 충돌 복구본 보존, 삭제0 | [왕복 결과](../platform-live-roundtrip-20261009/pc-web-roundtrip.json) |
| PC 3종 ASAR 설치 판별 수정 | 1bcd81c9… 3앱 설치 exit0. 204입력·runtime88파일씩·인증9개·fingerprint9개·pin·등록3·바로가기6 확인. 프로필67/127/105파일은 설치/격리 QA까지 동일. 실제 Electron 설치본 모듈과 원래 UI에서 WORLD/Messenger 설치됨 확인, Platform 버튼으로 Messenger 회사 HTTPS 로그인 입구 실행 | [최신 설치](../../../../desktop/artifacts/platform-asar-fix-candidate-2026-10-08T16-51-58-352Z/INSTALLATION.md), [완료 증거](../../../../desktop/artifacts/platform-asar-fix-candidate-2026-10-08T16-51-58-352Z/artifacts/asar-fix-install-completion.json) |

최초 PC sourceHash는 `8a87e0386fff7f1db5a88e86cf183c90b0177ebdb06f43f1c4a1ac556d8db8f7`이다. 후보 생성 시점 기록과 실제 후속 설치 증거는 시점이 다르다. 설치 여부는 INSTALLATION.md와 install 결과를 따른다.

초기 공개 커밋의 Pages와 전체 site-check는 성공했다. 문구 후속 커밋의 Pages와 공개21파일 대조도 성공했다. 다만 전체 site-check는 기존 LAB게임 정적 자산3개의 HTTP503으로 실패했다. 즉시 재조회에서 세 파일 모두200·Git SHA 일치로 회복했으나 CI실패를 통과로 바꾸지 않았다. [후속 기록](completion-rehearsal-copy-release.json). [종합 검증 목록](completion-release-summary.json)은 실제 반영과 미확인 항목을 나눈다.

## 이용할 수 있는 보강

- 계정 라이브러리: 명시적으로 연결하고 저장을 켠 뒤 즐겨찾기·최근 열기·직접 적은 이어쓰기 메모를 같은 SYNK ID로 이어간다. 기존 기기 기록은 별도 확인 후 옮긴다. 앱 원문·이용 권한·학습 동의를 자동으로 가져오지 않는다.
- 기록 보호: 두 세션 충돌 안내, 계정별 미저장 입력 격리, 늦은 응답 폐기, 다시 불러오기 뒤 입력 활성화, 삭제 후 저장 끄기. PC 종료·로그아웃 때 미제출 메모와 기존 홈 초안을 함께 보호하고 pagehide 중 재렌더를 멈춘다.
- Care: CSV/Care JSON에서 이름·관계·그룹을 미리 보고 선택한 연락처만 가져온다. 기본은 모두 미선택이고 동명이름·기존 항목은 건너뛴다. 전화번호·이메일·대화·일정은 가져오지 않는다.
- 대화 리허설: 면접·부탁·거절의 상대/목표12조합과 연습 방향36경로. 선택한 분기를 결과·재시도·작품집·JSON·계정 기록에 보존하며 이전 기록도 읽는다. 입력문을 AI로 분석하거나 채점하는 기능은 아니다.
- 운세: 한국 날짜 기준 오늘부터6일 전까지 저장한 메모·완료 행동을 모아 본다. 기록을 다시 보고 수정한 뒤 명시적으로 저장한다.
- 플랫폼 이동: Care·운세·리허설의 정확한 공개 주소로 연결한다. 웹 링크를 설치 권한이나 네이티브 앱 실행 기록으로 처리하지 않는다.
- PC 개발판 앱 목록: 비로그인·로그인·불러오는 중에도 등록된10개 앱을 보여 준다. WORLD/Messenger는 설치 앱으로, Care·운세·리허설은 공개 웹으로 연결한다. 준비 중인 앱은 준비 상태를 표시하며 실제 인증·자료 권한은 그대로 검사한다.
- 계정 화면: 상세 계정 설정을 접어 홈에서 이어할 항목에 집중한다. 첫 연결 클릭은 설정 준비를 기다리고, 제출하지 않은 메모와 계정에 저장된 메모를 다른 문구로 안내한다. 접었다 돌아와도 입력과 포커스를 보존한다.
- 메모 입력 후속: 저장 상태 갱신 때 입력 폼을 유지하고, 원격 기록을 읽는 동안 새 입력을 막아 응답으로 초안이 사라지는 문제를 고쳤다. 불확실한 웹 세션은 로그인 이동 전에 계정 연결을 재확인한다. 합성 조합 이벤트 검증을 실제 Windows 한글 IME 검증으로 해석하지 않는다.

## 실제 화면에서 확인한 범위

- **실제 공개 계정**: 최초 두 브라우저 로그인 세션 왕복 뒤 실제 서버 충돌도 확인했다. 오래된 세션 B의 쓰기는 거절되고, 계정 기록 선택 후 A·기존 메모와 미선택 B 복구본이 보존됐다. 충돌 시험은 d05ab11 입력 UX 배포 전에 로드된 코드에서 수행했으므로 새 입력 UX의 실계정 검증으로 확대하지 않는다. [웹 충돌](../platform-live-roundtrip-20261009/web-real-conflict.json).
- **실제 설치 PC↔웹**: 설치9c276의 기존 로그인으로 공개d05ab11과 메모 저장·완료 상태를 왕복했다. 왕복 확인 당시 QA메모3개 중 완료2개·충돌A 미완료1개였고, 후속 웹 정리에서 A도 완료 표시해 현재 검수메모3개를 완료 상태로 보존했다. 미선택 B 복구본은 별도로 남았으며 메모·복구본 삭제0. 같은 물리 PC의 설치 앱과 IAB 사이 검증이며 휴대폰·다른 계정 전환·PC가 포함된 동시 충돌 검증은 아니다. [왕복·정리 근거](../platform-live-roundtrip-20261009/pc-web-roundtrip.json).
- **실제 공개 리허설**: 390px에서 비로그인 합성 문장으로 부탁→상사→일정 조정→부담스러운 반응3턴→결과를 확인했다. 가로 넘침·깨진 이미지·콘솔 경고/오류0, 계정 기록 쓰기0. [근거](completion-live-personal-ui.json), [결과 화면](completion-live-rehearsal-390.png). 이 시나리오는 문구 후속 전 공개 버전이며 후속은 동일 동작의 HTML 문구2곳만 고쳤다. 후속 공개 버전의 새 상·하단 문구와390px 화면도 확인했다([UI 근거](completion-rehearsal-copy-ui.json), [화면](completion-live-rehearsal-copy-390.png)).
- **실제 공개 운세**: 390px에서 비로그인 회고 화면·로그인 입구·넘침 없음·콘솔 경고/오류0을 확인했다. [화면](completion-live-fortune-390.png). 실계정 운세 기록 작성 시험은 아니다.
- **합성 계정 UI**: IAB의 두 native adapter와 공유 Map으로 동의 전 쓰기0, 저장·충돌·계정 분리·로그아웃을 확인했다. 390/320px 넘침0·경고/오류0. `completion-platform-390.png`, `completion-platform-1280.png`.
- **Care 선택 가져오기**: 합성 CSV4명 중 선택 가능3/중복1, 한 명만 선택해1명 추가, 다시 읽으면 선택 가능2/중복2. 390/320px 넘침0. `experiences/relationship-care/qa/contacts-20261008/`.
- **리허설 재작성·운세 저장**: 로컬 공개 후보와 합성 계정으로 분기·원문·다시 쓰기 유지, 7일 회고 수정·명시 저장을 확인했다. 실제 공개 계정 왕복과 구분한다.

최초 출시 검수 때 사용한 탭·임시 서버 정리와 화면 크기 복원 기록은 당시 범위다. 이후 실계정 충돌·PC↔웹 왕복은 별도 근거와 시점으로 기록한다.

## 회귀 검사와 DB 제한

| 검사 | 결과 | 근거 |
|---|---|---|
| 계정·플랫폼 | 280/280 | completion-portal-current-tests.txt |
| 최초 설치 PC 고정본 | 265/265 | 8a87 후보 qa-tests.log |
| 앱 목록·계정 UX 통합 PC 고정본 | 기능287/287·종료 보호38/38·앱 목록59/59 | 4738 후보 CANDIDATE.md 및 artifacts |
| 계정 연결·입력 후속 PC 고정본 | 기능299/299·앱 목록59/59·종료 보호38/38·입력 유지38/38 | 9c276 후보 CANDIDATE.md 및 artifacts |
| ASAR 설치 판별 최신 PC 고정본 | 기능300/300(Electron ASAR 회귀 포함)·앱 목록59/59·종료 보호38/38·입력 유지38/38·설치 격리16/16·Messenger 익명8/8 | 1bcd 후보 INSTALLATION.md 및 artifacts |
| 공개 입력 흐름 후속 | 계정293/293·공통 notebook52/52 | platform-input-continuity-20261009의 account-tests.tap·notebook-tests.tap |
| Care | 440/440 | completion-care-tests.txt |
| 운세+개인 앱 공개 builder | 107/107 | completion-fortune-final-tests.txt |
| 리허설·가족 앨범·공통 노트북 | 161/161 | completion-personal-tests.txt |
| 이동 연결 회귀 | 75/75 | completion-final-links-tests.txt |
| OAuth 적용 도구 | 72/72 | completion-provision-tests.txt |
| 개인 자료/플랫폼 DB 기능 | 41/41 | collision-feature-tests.txt |
| 과거 전체 스키마 후보 | 39/40 | collision-schema-tests.txt |

겹치는 검사는 합산하지 않는다. 오래된 스키마 후보에는 기존 선형 체인 불일치3개와 후보 밖의 실제 Drive 선행 이력 참조 차이1개가 있어 전체 스키마 검사 통과로 보고하지 않는다. 이번 증분의 실제 gate는 정확한4개 자원 CHECK·신규 이력·RLS·정책0·권한 누출0·계정 삭제 연결·FK다.

이미 적용된 Drive `20261008120000`과 충돌하던 미적용 플랫폼 SQL을130000으로 옮겼다. 최종 checksum은 `ce1cef2cf41107a182d78a232f66b605a5651347aa9d8655a8749fef4f8879b3`다. 과거 적용 SQL·이력은 바꾸지 않았고 **전체 합본을 재적용하지 않았다**. [증분 감사](collision-audit.md), [원격 적용 원본 목록](collision-applied-set-manifest.json).

## 추가 후속과 남은 확인

최신 통합 로그인 후속은 [별도 검수 기록](../platform-unified-followup-20261009/README.md)을 따른다. 이 후속 준비 시점에는 설치f9d를 유지했고, 교체22b는 전체326·종료38·3앱 패키지 대조·격리 부팅16을 통과했다. 공개02c9 후보도 준비됐지만 회사 계정 전환 경합 수정본의 실제 반영 후 웹→PC 순서로 마무리한다. 그 준비 시점에는 새 설치·배포 전이었다. 이후 22b 설치·Messenger 자동 연결 완료는 문서 첫머리의 10-09 후속 기록에 있다. 아래 목록도 각 단계의 당시 이력이다.

1. **Messenger 회사 서버 연결**: 사용자가 「전달해서 함께 반영」으로 승인한7파일을 최소 패치로 합쳤다. 고정 후보는 `desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z`, sourceHash는 `6f6702e3824fc1d853da4525ed1d57c8fcc3307eb641c02099e7ced017d35e39`다. 전체275/275와3앱 패키지·실제 HTTPS 익명 읽기8/8을 확인했다. 사용자가 Platform 창을 직접 닫은 뒤3앱 설치를 완료했다. 설치본 bytes·pin·프로필 보존을 확인했고, 설치된 Messenger의 HTTPS 익명8/8 및 Platform 격리 부팅을 확인했다. 23:48 원래 Platform 프로필 정상 창을 한 번 열어 두었다. 실제 직원 로그인·회사 계정 연결은 별도 미확인이다. 서버 재배포·설치 파일 공개는 이 후속에 포함하지 않는다.
2. **직전 계정 화면·앱 목록 통합 이력**: 홈 계정영역 접기·첫 연결 로딩 대기·버튼/저장 안내·미저장 메모 복귀를 보강했다. 웹은 담당이 account JS/CSS2파일만 baa4fa542cfca7ddc2021fc42791e441fc23a7d4로 반영했다. Pages 성공·공개2파일200/MIME/SHA 일치, 실제 회원의 첫 연결1회·기본 접힘·계정 관리 버튼·기존 완료 메모 보존을 읽기 전용으로 확인했다([공개 근거](../platform-ux-refinement-20261008/public-release.json), [회원 UI](../platform-ux-refinement-20261008/public-ui.json)). 전체 site-check는 기존12URL의 HTTP503으로 실패했으며, 후속 재조회에서12URL과수정2파일 모두200·GitSHA 일치로 회복했다. CI실패는 그대로 보존한다([진단](../platform-ux-refinement-20261008/site-check-followup.json)). PC05cd 후보는 사용자 정상 종료 뒤 WORLD exit2에서 멈췄고, 동시에 다른 승인 작업이 개발용 앱 목록82eb를 설치한 것을 확인했다. 후속앱 설치·롤백·강제 종료 없이 프로필을 보존하고 설치 담당을 한 명으로 조율했다. 당시4738은82eb의8개 변경을 보존한195입력·지원14개에 승인 UX2파일만 합친 고정본이다. 기능287/287·정확후보 종료보호38/38·카탈로그59/59 및3패키지 검증 뒤 WORLD·Messenger·Platform 설치를 모두 마쳤다. 설치된87파일씩·인증·pin·등록·바로가기를 대조했고, 설치/격리 QA 전후 프로필67/83/104파일이 동일했다. 설치 Platform 첫 격리검사는 숨김 화면 캡처를 포함한 검사에서 UnknownVizError로 실패했다. 내부 원인은 확정하지 못했고 원본 기록을 보존했다. 코드/설치 변경 없는 같은 조건 재실행은16/16·요청0·콘솔0으로 통과했다. 설치 Messenger의 HTTPS 익명 읽기8/8도 통과했다. 10-09 00:43 KST 원래 프로필의 Platform을 한 번 정상 실행해 창을 열어 두었다. 프로필 해시 동일 판정은 이 정상 실행 전까지의 범위다. 공유 SDK/중앙 ID 링크의 다른 변경은 제외했다. [범위·사용자 지시·해시](completion-ux-coordination.json), [최종 설치](../../../../desktop/artifacts/platform-integrated-candidate-2026-10-08T15-27-45-012Z/INSTALLATION.md). 실제 직원 로그인·PC↔웹 계정 왕복은 이번 익명/격리 검사로 대체하지 않는다.
3. **계정 연결·입력 후속 설치 완료**: 4738의 Platform 설정에 clientKey가 빠져 계정 라이브러리 요청이 전송 전 INVALID_REQUEST로 거절되는 문제를 실제 UI에서 확인했다. 9c276은 승인 runtime6개만 반영해 이 오류와 입력 유지·Windows 설치 경로·회사 요청 형식을 보강했다. 기존 로그인 fingerprint9개는 유지했고, 실제 설치 PC↔웹 메모 왕복까지 확인했다. 첫16-23 후보의 VM fixture7개 실패를 보존하고 합성 home 경로만 고친16-32 후보에서299/299를 통과했다. 설치 Platform 첫 격리 부팅 UnknownVizError도 보존했으며 같은 코드·조건·설치 bytes로 추가1회만 실행해16/16 통과했다. 프로필 해시 동일성은 실제 계정 UI를 연 이후까지의 주장이 아니다. [현재 설치](../../../../desktop/artifacts/platform-account-fix-candidate-2026-10-08T16-32-01-047Z/INSTALLATION.md), [실제 왕복](../platform-live-roundtrip-20261009/pc-web-roundtrip.json).
4. **WORLD·Messenger 설치 판별 수정 설치 완료**: 9c276의 실제 화면은 두 앱을 미설치로 표시했다. Node 검사 통과와 실제 Electron 동작의 차이를 분리해 패치된 fs의 app.asar 원본 읽기 ENOENT를 재현했다. 1bcd는 승인된 installations.cjs의 original-fs 수정과 Electron 회귀만 반영해3앱 설치를 마쳤다. 설치된 모듈을 실제 Electron44.5.1에서 읽어 두 앱의 installed·canLaunch=true, 패키지 bytes 불변을 확인했으며 원래 프로필·창·네트워크·앱 실행은 이 검사에서0이다. 별도 원래 프로필 UI에서 두 앱의 설치됨·기존 로그인 유지·완료 QA메모3개 복원을 확인하고 Platform 실행 버튼으로 Messenger 새 창의 회사 HTTPS 로그인 입구를 열었다. 직원 로그인은 직접 입력을 요청했지만 완료를 확인하지 못했다. 후속 재개 시 두 앱의 창은 닫혀 있었으며 계정 연결·메시지 전송은 하지 않았다. 통합 로그인 구현은 조율한 별도 담당이 이어간다. [최종 실제 UI](../platform-live-roundtrip-20261009/pc-final-ui.json). 기능300·native59/38/38·설치 격리16·Messenger익명8을 통과했다. 첫 숨김 부팅 UnknownVizError는 원본과 함께 보존하고 동일 코드/설치 bytes로 승인된 추가1회만 실행했다. 프로필67/127/105 보존은 정상 UI 확인 전까지다. [최신 설치](../../../../desktop/artifacts/platform-asar-fix-candidate-2026-10-08T16-51-58-352Z/INSTALLATION.md).
5. **이 단계에서는 PC↔휴대폰 왕복·별도 실제 계정 전환·Messenger 직원 로그인/계정 연결·앱 종료 뒤 OS 알림 수신·클릭이 남아 있었다.** Messenger 연결은 위 후속 완료와 구분한다. PC가 포함된 동시 충돌은 최신 f9d482/917faae 실제 검수로 완료했다. 같은 물리 PC의 설치 앱·웹 검사이며 휴대폰 증거는 아니다.
6. 이번 공개 출시의 Claude Opus5.5·max 최종 검수는 사용자 지시로 후행이다. 이전429 기록은 [completion-claude-review.json](completion-claude-review.json)에 보존했다.

## 실기기를 사용할 때 이어갈 순서

아래는 미실행 절차다. 사용 가능한 휴대폰과 승인된 계정을 확인한 뒤 진행한다.

1. 설치된 PC Platform과 휴대폰 공개 플랫폼에서 같은 SYNK ID로 로그인한다. 계정 보관함 연결·저장 동의를 화면에서 확인하고 다른 콘텐츠의 동의를 자동으로 켜지 않는다.
2. 분명한 검수용 메모와 즐겨찾기 한 개를 PC에서 저장한다. 휴대폰에서 복구한 뒤 메모를 완료하고, PC에서 다시 읽어 완료 상태를 확인한다. 확인 시각·각 앱 버전·기기 종류만 기록하고 토큰이나 개인 내용을 남기지 않는다.
3. 같은 최신 라이브러리를 양쪽에서 읽은 뒤 한쪽에서 QA메모 A를 저장하고, 다른 쪽은 다시 읽지 않은 상태로 QA메모 B를 제출한다. 두 번째 저장의 충돌 안내·A와 기존 기록 보존·B의 로컬 복구본 보존을 확인한다. 충돌은 전체 라이브러리 단위다. 최신 버전에는 메모 수정이 있지만 실기기 검수에서는 새 QA메모를 사용하고 전체 기록 덮어쓰기를 누르지 않는다.
4. 제품 로그아웃 뒤 메모가 사라지고 늦은 응답으로 다시 나타나지 않는지, 다시 로그인했을 때 같은 계정에만 복구되는지 확인한다. 다른 계정 경계는 별도로 사용이 승인된 두 번째 계정이 있을 때만 시험한다.
5. Care의 실제 기기 알림을 등록하고 검수용 예약을 만든 뒤 앱을 닫는다. OS에 알림이 도착한 시각과 클릭했을 때 맞는 앱/항목으로 이동하는지 확인한다. 전송 API 성공과 OS 수신·클릭을 각각 기록한다. 운영체제·브라우저·일반 웹/설치형 여부도 남긴다.

출시 전 상태는 [이전 기록](COMPLETION-before-release.md)에 보존했다. `completion-candidates.json`은 당시152파일·8a87 후보의 정확한 배포 전 검증 기록이다. 이후 공유 원문이 별도 작업으로 바뀔 수 있으므로 현재 소스와 과거 고정 후보를 동일 버전이라고 주장하지 않는다. 이 문서는 예약·자동 배포를 설정했다는 뜻이 아니다.
