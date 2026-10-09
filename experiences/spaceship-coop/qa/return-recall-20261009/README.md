# 우주선 재방문 복습·별지도 마감 · 2026-10-09

로컬 구현과 검증 기록이다. 공개 배포·실계정 왕복 저장·실제 휴대폰·사람 학습 효과를 확인한 결과가 아니다. 음성·이미지 생성과 공식 모델 검토를 호출하지 않았다.

- 별지도: 사진 준비와 기기 저장을 구분하고 실제 1200×1050 PNG를 내려받는 링크와 미리보기를 제공한다. 미리보기는 기존 CSP의 data: 이미지를 사용하고 다운로드 Blob URL은 교체·기록 선택 변경·닫기 때 폐기한다. 늦은 생성이 다른 기록·닫았다 다시 연 화면에 안내·링크·초점을 남기지 않는다. 자동 저장 시도 없이 사용자가 직접 PNG 링크를 누른다.
- 짧은 기억 놀이: 로비·무료 탐험 기록에서 선택 가능하다. 검증된 완주 기록에서 실제 사용한 색·위치·횟수 표현 3개만 고르고 기존 승인 MP3의 끝까지 재생 뒤 그림 선택을 연다. 첫 답 뒤 뜻·교정을 보여 주고 틀린 표현은 한 번 더 행동한다. 첫 답과 재시도를 구분하고 코인·완주·개인 학습 숙달로 합산하지 않는다.
- 탐험 보존: 복습은 overlay이며 만들기·종료·보상 요청을 하지 않는다. 닫고 다시 열면 같은 문서의 위치·답을 유지한다. 친구와 시작하면 열린 overlay만 닫고 소리를 중단한다. 기존 완주 직후 단독 회상을 유지한다.
- 목표: 부족 코인·미달 목표에 공통 beginnerRewardRoute의 다음 입문 연습과 설명을 표시한다. 구 API는 무료 허브 fallback이며 보상을 약속하지 않는다. 활성 방에서 다른 게임 이동은 기존 종료 확인을 거친다.

## 검증

Node 기존 회귀와 신규 선택·overlay 경계 36개, 서버·운영 기존 16개 통과. 격리 Chrome의 신규 흐름 31조건, 마지막 새 완주/최근6개 정리 PNG 경계 4조건, 기존 전체 협동 UI 95체크를 통과했다. 마지막 guard 뒤 전체 95개를 불필요하게 반복하지 않고 관련 4조건과 Node 회귀로 확인했다. 실제 승인 음성 7개와 manifest 파일 1개 SHA가 준비 전과 같다. SUIT·Inter Tight 실제 사용 글리프는 font-proof.json에 남겼다.

브라우저 흐름은 합성 완주 기록·게스트 지갑의 별도 컨텍스트이며, 실제 사람은 0명이고 물리 휴대폰은 0대다. 전체 협동 UI는 두 별도 Chrome 컨텍스트에서 18개 수리·이륙·음성 정상 재생·양쪽 15코인·중복 방지·기존 단독 회상을 확인했다. QA의 소유 Node 프로세스 4개가 성공 JSON 저장 뒤 정리 단계에서 남아 Ctrl-C로 종료했다. **조건 통과와 정상 종료 코드는 구분한다. 이 UI 명령들은 exit-0 완료로 보고하지 않는다.** cleanup-limitation.json을 따른다.

## 자료

- browser-result.json / browser-proof.cjs: 신규 31조건과 로컬 HTTP/SSE 요청 범위
- png-before.json / png-before-390.png: 자동 저장이 막혀도 저장됐다고 안내하던 원문 기준
- png-link-dialog-390.png / downloaded-starbook.png: 직접 저장 링크와 실제 내려받은 PNG
- recall-dialog-390.png / recall-count-320.png / recall-finish-320.png: 그림 선택·횟수 선택·첫 답 2/3와 재시도 구분
- png-rotation-result.json / png-rotation.cjs: 새 완주가 선택 기록을 밀어낸 뒤 늦은 PNG 생성 처리
- full-coop/ui-results.json: 기존 전체 95체크
- node-regression.txt / server-regression.txt: 36+16 회귀 결과
- source-change.json / completion.json / artifact-manifest.json: 최종 파일 SHA와 수행·미수행 구분

처음 편집의 중괄호 오류, 신규 module의 로컬 allowlist 차단, 빈 기록 PNG null 오류, 전체 UI의 load-event 새로고침 시간초과 자료는 지우지 않고 보존했다. 신규 복습을 기존 허용 starbook.mjs에 합쳤고 서버/CSP/DB/auth 계약은 바꾸지 않았다. 전체 UI의 재시도는 DOMContentLoaded와 실제 화면 준비를 각각 확인하며, 원래 시간초과 기록을 통과로 바꾸지 않았다.
