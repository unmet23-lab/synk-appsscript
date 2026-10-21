# PATH 운영 계정·공개 배포 완료 · 2026-10-09

최신 여행 v4와 SYNK ID 연결을 [공개 주소](https://synk.im/try/travel/)에 배포했다. 공개 commit `7b749a647c5ce385e0f89406e67909fc44843569`, Pages 37856679649 성공, 전체 사이트 CI 37856679674 성공. 여행 78파일의 HTTP 200·MIME·크기·SHA256·정규 URL이 모두 일치한다. 운영 서버 synk-personal v23의 전체 배포 바이트·JWT와 비인가 접근 차단을 확인했고, 최종 운영 합성 로그인·저장 왕복 13/13 및 여행 회귀 338/338을 통과했다.

사용자가 **“검수는 나중에 클로드로 직접할게 배포해”**라고 지시해 이번 최종 Claude 검수는 후행으로 남기고 배포했다. 앞선 A/B/D 검수 통과와 마지막 C 검수의 사용량 제한 종료 기록을 보존하며, 마지막 C 검수까지 통과했다고 표시하지 않는다. 공통 운영 원칙을 변경한 것은 아니다.

## 배포와 근거

- 전용 OAuth browser client 및 개발 4303/공개 callback 등록 완료. 기존 21개 client와 PATH VR 자료 경계 보존. [등록 결과](../../../../tools/synk-id/qa/path-travel-production-20261009/registration-applied.json).
- 공개 여행은 최신 main `744e9f28`의 WORLD 변경 위에 합쳤다. 78개 파일 중 52개 변경이며 원래 후보 `8e1c8ab`의 여행 트리와 바이트가 같다. 포털의 여행 항목 및 다른 제품 항목도 보존했다. [공개 파일 대조](../../../../../SYNK-website/qa/travel-production-20261009/live-http.json), [소스·동시 작업 대조](../../../../../SYNK-website/qa/travel-production-20261009/deployment-source-audit.json).
- backend commit `7a7343f5295edc92cf0eb5dda45379a2741db857`은 `codex/path-travel-account-release-20261009` 원격 브랜치에 보존했다. v23 runtime SHA `b54e1c17e70c98805f93ac1f30d06f480f2bea30e32bc3d11aadf0fdc3566b03`, JWT true, OPTIONS 204, 비인가 GET 401. [전체 배포 대조](../../../../tools/synk-id/qa/path-travel-production-20261009/backend-enabled-deployed-verification.json).
- 여행 migration `20261009010000_synk_path_travel_c16` 적용·봉인·resource 5개·authenticated 직접 권한 0 확인. 공유 SYNK-talk의 다른 WORLD 변경은 배포에 넣지 않았다.
- 활성화 최종 원본 [여행 338/338](tests-deploy-final.log), backend 39/39, 공개 빌드·HTTP 도구 13/13, 운영 프로브 도구 로컬 12/12 통과.
- 최종 v23 [운영 프로브 13/13](../../../../tools/synk-id/qa/path-travel-production-20261009/production-probe-final-result.json): 실제 제공자 PKCE·동의 거절·갱신·다른 세션 복원·계정 분리·저장 충돌·PATH VR 분리·삭제 후 되살림 차단·세션 철회. 합성 여행 문서 2개 제거, 정상 계정 삭제 요청/대기 2개 확인. Auth 계정은 정상 7일 유예 동안 남을 수 있으며 즉시 purge는 검증하지 않았다.
- 공개 브라우저 1280/390px에서 10월 10일 카페·역사 일정 생성, 지도 전환, 로그인 callback, 계정/게스트 분리 및 로그아웃 후 원래 3곳 일정 복원을 확인했다. 가로 넘침·깨진 이미지·콘솔 경고/오류 0. 기기 보관 동의·계정으로 옮기기는 누르지 않았다. 임시 화면 크기를 복구하고 테스트 초안을 새로고침으로 정리했다. [브라우저 결과](../../../../../SYNK-website/qa/travel-production-20261009/browser-smoke.json), [공개 화면](../../../../../SYNK-website/qa/travel-production-20261009/public-final.png).
- [Pages·전체 CI 상태](../../../../../SYNK-website/qa/travel-production-20261009/pages-ci.json). 물리 두 기기와 현장 여행·실제 만족도 검증은 별도다.

## Claude 후행 검수 참고

마지막 수정 범위는 로그인 초안 보관/복원, 날짜와 기록 시계 분리, 현재·미래 일정 조정 단추, 계정 활성화 값이다. 이전 검수 원문과 지적 대응은 이 폴더의 review-*.json 및 REVIEW-FINAL-DELTA.txt를 따른다.

공개 smoke에서 공통 notebook의 빈 계정 불러오기에도 “계정에 저장했어요”가 표시됨을 확인했다. 공통 `account-notebook.mjs:7`의 synced 라벨이 불러오기와 저장을 구분하지 않기 때문이다. `document-sync.mjs:213,250`의 GET/empty state 처리이며 게스트 자동 저장을 뜻하지 않는다. 원래 게스트 여행의 로그아웃 복원은 실제 확인했다. 데이터 손실은 없으며 후행 검수에서 상태 문구를 다듬을 수 있다. 이번 배포 범위를 공통 계정 UI 변경으로 확대하지 않았다.

## 보관한 여행의 호환성

공개한 장소 ID는 삭제하거나 다른 장소에 재사용하지 않는다. 추천을 중단할 장소는 기존 자료와 좌표를 보존하고 `dayPlannerEligible:false`로 신규 계획에서만 제외한다. 장소의 좌표·필수 조건을 바꾸는 배포는 기존 여행 파일의 읽기 회귀도 검사한다. 현재 validator는 등록된 장소 자료를 사용하므로, 읽기 계약을 바꾸려면 먼저 별도 마이그레이션·복구 경로를 준비해야 한다. 서버가 거절한 자료를 자동 삭제하거나 새 일정으로 덮지 않는다.

기록 시각은 동기화 권한이나 최신판 판정에 사용하지 않는다. 서버 revision/CAS가 쓰기 충돌을 판정한다. 기기 간 시계 차이는 읽기·저장을 막지 않으며 문서 안의 사건 순서는 보존한다. 지난 날짜의 계획은 저장 당시 시각·가격 추정치를 유지하고 현재 영업이나 비용을 다시 확인한 결과로 표시하지 않는다.
