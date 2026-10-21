# 코스튬 방 배포·종료 기록 — 2026-10-10

사용자가 승인한 편의성 22개와 의상·재질 14종(몸9·목5, 미착용 포함60조합)을 웹에 반영했다. 신규 6종은 린넨 셔츠·코듀로이 멜빵·퀼팅 베스트·벨벳 케이프·실크 타이·울 머플러다. [공개 코스튬 방](https://synk.im/world/index.html?wardrobe=1&opening=off). **서버·Pages·공개 파일·익명 화면·전체 배포 CI 확인 완료. 배포·종료를 마쳤다.**

| 반영과 검증 | 실제 결과와 근거 |
|---|---|
| 서버 | Synk Core `qiwxeddwwnzkwalpsuty`, `synk-world-v1` v2→v3, ACTIVE·verify_jwt=true. commit `115b1d5cedcc961d942787d4ab562489ebae585d`. [공식 배포](backend-deploy.stdout.txt), [최종 대조](backend-postflight.json). |
| 서버 본문 | runtime 전체 정규화 본문 SHA `77afa4a6…` 일치. TypeScript 진입 파일은 타입 제거 뒤 비공백 JavaScript 토큰 전체와 일치하며 기존 운영 v2 변환본과도 동일하다. 익명 bootstrap 401, 운영 계정 요청0·원격 DB/secret/ledger 변경0. |
| 화면 | 공개 `002cf9d2…` 기준 8수정+1추가·삭제0. commit `a017221d59b9afd1a6dbcf84bf7fd9f76954c429`. 검수한 raw blob9개 일치·기존 world528개 보존·공용 index 쓰기0·force push0. [발행 기록](frontend-publication.json), [최종 pointer](frontend-plan/candidate-pointer.json). |
| 공개 파일 | Pages가 해당 commit으로 built. 변경9개와 entry·계정·홈·타운·원래 avatar·native GLB 등을 포함한 **26개 HTTP200·SHA 일치**. [공개 대조](frontend-live-verification.json). |
| 공개 화면 | 실제 공개 호스트의 새 익명 브라우저: 문서200·SYNK ID 안내/계정 snapshot 없음·JS예외0의 **3조건 통과**, 계정 API/쓰기0. [결과](frontend-public-guest.json), [화면](frontend-public-guest.png), [임시 브라우저 정리](frontend-public-guest-cleanup.json). |
| 공식 검수 | backend·frontend 전체·네 줄 수리 모두 실제 `claude-opus-5-5 --effort max`, exit0·success·is_error=false. 최종 P0/P1/P2 없음. [서버](backend-opus-review.json), [화면](frontend-opus-review.json), [수리](frontend-opus-repair-review.json), [최종 승인 근거](frontend-review-approval.json). |
| 수리 회귀 | 행거 캐시 재사용, 삭제된 편집 이름 보존/새ID 저장, 39자 이름 복제의 서버 정규화·Undo와 일반 새코디 초기화 확인. 실제 DOM3시나리오·source SHA 포함 **10/10조건**, 오류0·계정 API0. [최종 결과](frontend-repair-tests.json). |
| 후보 계약 | v1의10/10은 당시 증거로 보존. v2는9 overlay·보호11·52모듈/102참조·콜백 **4/4 재확인**, 누락0. studio 이외536파일은 v1과 동일. [v2 계약](frontend-contract-v2-result.json), [9개 SHA](frontend-contract-freeze-v2.json). |
| CI | Pages run `37999848947` 성공. 전체 배포 점검 run `37999849849`도 성공. [최종 CI](deployment-ci-final.json), [Pages CI](pages-ci-final.json), [종료 인수](release-acceptance.json). |

서버 배포는 한 번만 했다. 최초 인수 코드가 변환 전 TypeScript 문자열을 배포된 JavaScript에 직접 비교해 실패한 기록을 보존했다. 제품 수정·재배포 없이 타입 제거 뒤 토큰 전체 및 기존 운영 변환본 일치로 검사 방식을 바로잡았다. 원격 body SHA는 `c21eb50369d653ea03ee495984c5f351ec681004191dfcb4955ae8e69b382a0d`다.

화면 검수의 P3 세 건을 studio 네 줄로 고친 뒤 같은 공식 세션에서 수리 범위만 재검수했다. v1·검수 원본을 보존했고 v2 manifest SHA는 `2896aedd00026fa4fede1a49a0cf23e88aa709f809fc3a80b767f6b62e26299f`, studio는 `300bf03fed1f04038adab07c35aad6b0e3f46171061d376144c91a63d945dca7`다.

로컬 [편의성22개](../costume-convenience-20261009/README.md), [저장·편집 마감](../costume-usability-20261010/README.md), [14종 의상·재질](../costume-materials-20261010/README.md)은 각 당시 소스의 별도 증거다. 과거 통합101·복구71·준비29, 초기180프레임과 최종 재질 검사 등을 이번 공개 전수 재실행으로 합산하지 않는다. v1 후보의 공개 SDK localhost 검사는 [미완료/성공0](frontend-plan/browser-incomplete.json)으로 보존했다. 수리 DOM의 최초 close timeout도 [원본](frontend-repair-tests-cleanup-timeout.json)을 보존하고 [본인 프로세스·포트 정리](frontend-repair-cleanup.json)를 별도 확인했다. [배포 전 기록](README-pre-deploy.md)도 남겼다.

[서버 P3 운영 메모](backend-operations-note.md): 새 무료6종으로 revision이 증가한 기존 화면은 첫 저장409가 날 수 있어 초안을 유지하고 최신 기록을 확인한다. 새 ID 사용 뒤에는 8종 카탈로그로 되돌리지 않으며 복구 후보도14종 저장 호환을 유지한다. 운영 C16/C17/C18·RLS는 이미 적용된 상태를 보존했고 재적용0이다.

실제 운영 SYNK ID 로그인·재로그인·두 기기 착용/룩북 왕복, 실물 휴대폰 지속 성능, 최종 리깅·천 시뮬레이션·네이티브 의상 모델은 이번에 확인하지 않았다. 사진·초안·취향은 계정별 기기 보관이다. 원래 avatar-v3·native GLB2개와 다른 채팅의 life/Maru/현재 공유 app-shell·OAuth 변경을 보존하고 전체 앱 빌드는 제외했다. 로컬4296 서비스도 보존한다.

재개 시 최종 pointer·공개 commit·backend-postflight·공개 HTTP/guest·CI 기록을 먼저 확인한다. 실기기·실계정 인수는 남은 검증 항목이다.
