# 코스튬 방 22개 기능 구현과 두 회차 인수

> 이 문서는 22개 구현과 두 회차 완료 시점의 검사 기록이다. 이후 「이어서 해」 요청의 저장·편집·첫 의상 노출 수정과 최신 원문 대조는 [2026-10-10 편의성 후속 마감](../costume-usability-20261010/README.md)에 있다. 아래 소스 해시는 당시 스냅샷이며 후속 수정의 현재 해시로 읽지 않는다.

사용자가 승인한 [22개 개선안](../../../../docs/디자인/코스튬방_Steam10종_편의성조사_20261009.md)을 로컬 코스튬 방에 구현했다. **1차는 21개 시나리오·91개 조건, 2차 기본 검사는 22개 시나리오·101개 조건을 통과했다.** 독립 복구 검사는 20개 시나리오·71개 조건을 통과했다. 준비 차단의 변경분 검사 3개 시나리오·29개 조건까지 통과했고, [22개 완료 감사](completion-audit.json)를 마쳤다.

[현재 PC 옷장](http://127.0.0.1:4296/desktop.html?wardrobe=1&opening=off&atelier=7) · [휴대폰 배치](http://127.0.0.1:4296/mobile.html?wardrobe=1&opening=off&atelier=7). 합성 테스트 계정이며 기존 A/B 기록은 보존했다. 운영 DB·공개 배포·Unity/네이티브·실물 휴대폰/컨트롤러·학생 효과의 검증과 구분한다.

## 기능 22개와 검증 범위

아래 core는 [최종 통합 검사](browser-r2-core-result.json), fault는 [독립 복구 검사](browser-round2-result.json)를 뜻한다. 실제 시나리오와 체크는 각 JSON에 있다. [항목별 연결표](completion-matrix-round2.json)와 [요구 목록](requirements.json)에서 구현 원문과 근거를 확인한다.

| 번호 | 구현 | 근거 |
|---:|---|---|
| 1 | Undo·Redo·원래 차림 | core 02/18; workbench history tests |
| 2 | 코디 빠른 착용 | core 03; fault home-hanger |
| 3 | 내 옷·즐겨찾기 | core 01/06; owned intersection tests |
| 4 | 검색·필터·스크롤 유지 | core 04; fault storage-account |
| 5 | 최근·새 획득 | core 02/13; authoritative acquiredAt tests |
| 6 | 촬영 중 코디 교체 | core 15 |
| 7 | 초안 복구·저장 상태 | core 04/20; fault storage-account and conflict |
| 8 | 연속 확대·기본 보기 | core 14; stage WebGL pointer/pinch tests |
| 9 | 코디 복제·이름·삭제 복구 | core 10/12; fault full-duplicate-editor/look-undo |
| 10 | 시착·확정·요청 결과 | core 02/16; fault response-loss/conflict |
| 11 | 썸네일·첫 표시 | core 04/21; pure and browser performance |
| 12 | 사진 모아보기·찍고 저장 | core 16/17; native IndexedDB; fault album-full-quota |
| 13 | 복수 필터·별칭 | core 05; filter/alias tests |
| 14 | 사용자 그룹 | core 07 |
| 15 | 부위 잠금·랜덤 | core 08; random tests |
| 16 | 후보 비교 | core 09; target-angle PNG/cache tests |
| 17 | 여러 코디 부위 복사 | core 11; fault frozen batch/revision |
| 18 | 획득 경로·복귀 | core 13/04; old first-steps participation grant |
| 19 | 입력·작은 화면·접근성 | core 18/19; fault mobile-layout |
| 20 | 실제 염색·서버 보존 | core 00/02/03; dye defaults preflight; ready delta; C18 and consumer tests |
| 21 | 홈의 행거 전시·바로 입기 | fault home-hanger; actual captureLook/consumer |
| 22 | 장소·포즈·배경 확장 | core 15/16; stage 18; target-angle/cache tests |

코디는 이름·순서·body/neck·원단/마감 두 색을 서버에 보관한다. 즐겨찾기·모음·초안·검색·조작 설정과 사진 앨범은 계정별로 이 기기에 보관한다. 사진은 IndexedDB에 최대 40장·40MB이며 자동 삭제하지 않는다. 저장을 사용할 수 없으면 제한된 세션 보관과 PNG 저장·재시도를 제공한다. 초안 보관과 실제 착용 확정은 별도 동작이다.

[완료 감사 실행기](completion-audit.mjs)는 각 요구의 실제 시나리오, 최신 원문/HTTP, 성능 원자료와 기존 두 계정의 보존을 다시 대조한다. [소스 호환성](source-compatibility-round2.json)은 전체 복구 검사 뒤 준비 차단 3곳과 CSS EOF 정리만 달라졌음을 원문으로 증명하고, 그 변경은 최종 통합 101조건과 [변경분 29조건](browser-round2-ready-delta-result.json)으로 확인했다. persistence/network/DB 원문은 복구 검사와 동일하다.

복구 검사 원문 23개 중 21개는 현재와 바이트가 같고, 나머지는 위 준비 차단과 CSS EOF 정리다. 통합 검사 원문 13개 중 12개는 같고 CSS EOF만 다르다. 변경분 검사에서는 23개 원문과 실제 HTTP 17개가 일치했으며, [브라우저·시험 서버 종료](browser-round2-ready-delta-confirmation.json)도 확인했다.

## 첫 회차 구현과 확인

[첫 회차 91조건](browser-r1-result.json)은 검색·보유·즐겨찾기·최근/신규·그룹·Undo/Redo·잠금 랜덤·후보 비교·코디 관리·12개 교체·부위 복사·획득 동선·사진·키보드/모의 패드·계정 분리·1440/390/320px를 확인했다.

처음 발견한 랜덤 편집 상태 중첩, pending 복구 차단, 확인 후 배치 대상 변경, 서버 갱신 뒤 Undo 기준, 코디 순서 Undo, 숨김 필터, 후보 버튼의 pointerup 재렌더를 고쳤다. 최초 실패는 browser-first-action-results.json·browser-second-action-results.json·browser-startup-failure.json에 보존했다.

## 두 번째 회차 수정과 확인

두 번째 회차에서는 실제 화면과 상태를 다시 점검했다. 휴대폰 룩북에서 첫 코디가 편집 폼에 가려지던 배치를 접는 편집 영역으로 바꾸고, 사진 탭은 모델·코디 선택을 먼저 보이게 했다. 확대 글자 줄바꿈·홈 행거 폭·즐겨찾기와 보유 필터의 교집합도 보강했다.

최근 획득 정렬은 실제 서버 ISO/null 시각을 사용하며 신규 읽음 배지와 분리했다. 회전 중 촬영·후보 비교는 목표 각도와 PNG가 일치하게 고쳤다. 시착 옷의 기본색은 이전 착용 옷과 분리하고, 정확한 기본색을 준비하기 전에는 색 입력만 잠근다.

- [통합 101조건·22시나리오](browser-r2-core-result.json), [종료와 소스 확인](browser-r2-core-confirmation.json): 런타임 오류·누락 응답 0, 13개 원문의 검사 시작/종료 SHA256과 HTTP 응답 일치.
- [복구 71조건·20시나리오](browser-round2-result.json): 실제 서버 commit 후 응답 유실의 동일 요청 재시도, 다른 화면의 revision 충돌, 최신 차림·Undo, 12개 교체·복제, 확인 대상 고정, GPU context loss·복구, 사진 한도·용량 실패·같은 ID 재보관, 계정 전환 중 늦은 촬영, 저장 차단, 실제 홈 행거 한 클릭을 확인.
- [기본색 경계 검사](browser-round2-dye-preflight-result.json): 선택 직후·확정 차림 비교 중에도 니트 원단/마감 값이 정확하고, 마감만 편집하면 원단과 서버 차림을 보존.
- [준비·GPU 변경분 29조건](browser-round2-ready-delta-result.json): 로딩 중 색 입력 차단·강제 이벤트 무효·준비 후 정확한 두 색, GPU loss 중 차단·기존 초안 보존·복구 후 활성화를 실제 DOM으로 확인했다. 초기 변경분 검사의 닫힌 details 가시성/실패 후 gate 정리 오류는 원본을 남기고 수정하여 정상 exit0으로 마쳤다.
- [CSS 마감 차이](css-format-delta.json): 통합 검사 뒤 EOF 빈 줄만 정리했으며 선언·선택자 내용은 동일. 기능 변경으로 합산하지 않는다.

최초 실패 및 잘못된 검사도 남겼다. 전체 페이지 load와 실제 기능 준비를 구분했고, JSONB 객체 키 순서 비교·별도 URL 모듈 인스턴스·검색 입력의 Escape 처리·닫힌 details의 가시성 요구로 생긴 검사 오류는 수정 후 실제 조작으로 다시 확인했다. 성공한 기록으로 이전 실패를 덮어 해석하지 않는다.

## 저장 계약과 같은 차림

[염색 서버 C18·실제 HTTP](../../../../../SYNK-talk/qa/world-v1-dyes-c18-20261009/README.md)는 실제 JSONB 직렬화, 소유권, 잘못된 색/부위, revision, requestId, 구형 데이터, 이름/복제/순서/삭제/내보내기, 계정 분리를 검증했다. C18은 로컬에만 적용했다.

[무대](../costume-stage-20261009/README.md)와 [홈·타운 소비](../costume-consumer-20261009/README.md)는 기준 몸·눈 보존, 원단/마감의 실제 재질 색, 포즈/배경, 캡처 성공/실패 후 원복, 홈/타운의 같은 착용 상태를 확인했다. 무대 순수 검사 4개·WebGL 18개, 소비 실제 왕복 16개의 범위는 각 기록에 있다.

모델 Node 17개와 실제 IndexedDB 4개는 계정별 초안·사진, undo branching, 검색/필터, 실제 획득 시각, 저장 차단·용량 부족·같은 ID 재시도를 확인한다. 브라우저 동시 부하의 타임아웃과 후속 성공은 별도 기록이다.

## 성능과 현재 제공 소스

[성능 원자료와 설명](../costume-performance-20261009/README.md)은 합성 metadata 8/50/200행과 실제 자산 8종을 구분한다. 실제 PC/390px에서 첫 관측 렌더 프레임, 썸네일 완성, PNG·기기 앨범 처리, 재열기 8키의 재생성 0회를 측정했다. 탭/스크롤·관측 비용이 달라 시간 비율을 순수한 개선 효과로 해석하지 않았다.

캐시는 최대 96개·16MB의 문자열 내부 계산 상한을 지킨다. 전체 heap/GPU 메모리나 실제 200개 제작 자산의 성능 증명은 아니다. 움직이지 않는 무대는 계속 렌더하지 않고 휴대폰의 가벼운 재질/그림자 경로를 유지한다.

[현재 4296 제공 원문](served-source.json)은 실제 HTTP 14개와 로컬 원문을 대조한다. 이전 C17 서버를 같은 db-v1로 새로 실행한 뒤 기존 A/B의 전체 응답은 새 dyes 필드만 제외하고 해시가 같았다. [이전 상태](local-continuity-before.json) · [이후 상태](local-continuity-after.json). 현재 4296은 숨겨진 로컬 서비스로 유지하며 다른 시험 서버는 종료했다.

## 재현

기본: node experiences/synk-world-app/qa/costume-convenience-20261009/browser.cjs

독립 복구: node experiences/synk-world-app/qa/costume-convenience-20261009/browser-round2.cjs

모델: node --test tests/wardrobe-workbench.test.mjs tests/wardrobe-album-browser.test.mjs

현재 제공 대조: node experiences/synk-world-app/qa/costume-convenience-20261009/served-source.mjs

각 브라우저 검사기는 본인 전용 빈 포트와 새로운 합성 DB를 사용한다. 기존 4296·사용자 기록을 초기화하거나 다른 서버를 종료하지 않는다.

