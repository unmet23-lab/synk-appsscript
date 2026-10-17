# 작업실 동기화 연결 패치 보존 이력 — 2026-10-08

`pending-integration.patch`는 이번 Atlas 보완에서 수행했지만 최소 푸시에서 분리한 두 변경만 보존한다. HEAD 전체 차이가 아니라, 기존 미커밋 작업실 동기화 구현에 이번 변경을 적용하기 직전 상태를 기준으로 만든 패치다.

- `company/server.mjs`: 기존 `workroom-practice-sync-service.mjs` 정적 import를 실행판 관찰이 끝난 뒤의 동적 import로 바꾼다. 현재 최소 Atlas 커밋에는 그 동기화 서비스/import 자체가 없으므로 이 패치를 바로 적용하지 않는다.
- `company/workroom-practice-client.test.mjs`: 기존 동기화 UI 시험의 100회 `setImmediate` 폴링을 실제 `sync.enable()` Promise 대기로 바꾸고 10초 상한을 둔다. 해시 완료를 보류한 합성 회귀 1개도 포함한다.

당시 패치의 적용 전제는 별도 작업실 동기화 구현(`workroom-practice-sync-service.mjs`, `public/workroom-practice-sync.js`, 서버의 설정·경로 연결, UI와 기존 동기화 시험)이 준비돼 있어야 한다. 그 구현이 사용하는 SHIFT 모델 및 저장 이관 모듈도 함께 확인한다. 이 패치는 해당 기능 전체를 제공하지 않는다.

이 패치는 같은 날 `a43bf2b12`에 포함됐다([보존 커밋 결과](../../아틀라스검토_인계_20261008.md)). 더 이상 적용 대기 작업이 아니다. 10-09에는 [AI 업무 연습 메뉴·진입 제거](../workroom-practice-removal-20261009/README.md)가 공개 반영됐고 저장 원본·API는 보존됐다. 이 패치를 재적용하거나 실습 입구를 복구하는 지시로 사용하지 않는다.

검증 근거: 일반 서버 시작·캡처·실행판 증명·작업실 서버 동기화 73/73, 대기 수정 후 클라이언트 관련 35/35. 실제 사전 로드된 캐시의 증명 거절은 유지한다. 당시에는 기능 통합 뒤 관련 시험 재실행을 계획했다. 유료 호출·외부 요청·배포는 수행하지 않았다.
