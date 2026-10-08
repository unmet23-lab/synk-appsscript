# 상황별 내 문구 보관함 검증 · 2026-10-08

서버와 공개 웹에 반영했다. 최종 공개 커밋은 `63146086d68a20b965a18937be7777609e229bca`이며 같은 커밋의 Pages 배포와 전체 사이트 CI 모두 성공했다.

- 기능 회귀: [Care291/291](tests-care.txt), [서버55/55](tests-server.txt), [desktop·공통 계정49/49](tests-desktop.txt). 새 모델13·동기화10·UI VM20, 계정 연결기의 실제 capability 전달·오프라인 옛 수첩 복구·조회 실패 경계를 포함한다. JSONB4MiB/최대공백·1000문구 경계 유지.
- 본체 검수: 공식 Claude CLI **claude-opus-5-5 / max**, 실제 모델·exit0·end_turn과 최종18파일 SHA를 확인했다. [검수 증거](claude-model-proof.json). 검수에서 발견한 capability 누락·옛 임시 수첩 덮어쓰기·조회 실패 뒤 재확인·철회 문구 수·한도에서 옛 문구 삭제를 수정했다. 확인한 범위에서 남은 P0~P2 없음.
- 운영: 서버 커밋 `3cc020030c1c75ffe1cdc7a626c001eed4d9daee`, care v9·push/push-send v7 모두 ACTIVE, JWT 검증 유지. [배포](release-deploy.json), [대조](release-verify.json). 생성 런타임3개 일치·무인증401을 확인했다. entrypoint의 정적 앵커 대조는 앵커0개로 미측정이며 전체 entrypoint 바이트 일치로 주장하지 않는다.
- [운영 왕복45개](production-roundtrip.json): 실제 Auth의 독립 두 세션과 다른 합성 계정, 실제 `account.start → sync.open → change → flush → onSaved` 저장1회·capability 전달·다른 세션 정확한 조회. 즐겨찾기·이전 문구 복원·stale409·구버전426·계정 격리·원문 철회·명시적 빈 배열·삭제 tombstone을 확인했다. 합성 계정2개와 연결 자료 정리 완료, 오류0. 물리 두 기기나 실제 브라우저 OAuth 시험은 아니다.
- 공개: 본체 `4919aad` 이후 캐시 보완 `6314608`. [release](release.json), [48개 SHA/MIME 일치](public-verification.json). 캐시 후속은 index.html/build-manifest.json만 게시하고 다른46파일 바이트를 유지했다. 루트 원본은 공용 작업본에 있으며 별도 원본 git 커밋을 만들었다고 주장하지 않는다.
- 화면: [합성 계정 UI](browser-verification.json), [공개 예시의 다중 문구/즐겨찾기/복원과375·320px](public-browser-v5.json), [최종 일반 새로고침·저장](public-browser.json). preview/select16px·단추52px, 가로 넘침 없음. 실제 사용자 자료와 알림 권한은 바꾸지 않았고 시험 탭·서버·화면 크기 override를 정리했다.
- 캐시 후속: 배포 전 app.mjs 캐시와 새 HTML 혼합을 실제 재현했다. 공개 빌더가 모든 모듈·CSS를 파일 SHA query URL로 연결하고 CSP에는 import map 본문의 정확한 hash만 허용한다. [빌드4/4](tests-public-cache.txt)(기존2개 포함), [로컬 브라우저](cache-browser-v6.json), 공개 기존 탭의 일반 새로고침에서 모듈24개+CSS1개가 새 버전 URL로 로드되고 오류0을 확인했다. 영구 보관된 옛 HTML이나 모든 배포 중간 상태의 원자성을 보장하는 검사는 아니다.
- **캐시 후속 검수 예외**: 추가 공식 검수는 `usage_limit_reached`로 실패했다([응답](claude-cache-review.json)). 통과로 간주하지 않았고 모델을 바꾸지 않았다. 사용자가 “추가 캐시 수정만 검수 예외 승인·배포”라고 직접 승인한 두 원본 파일에 한해 게시했다. [승인 범위·해시](cache-release-gate.json). 문구 보관함 본체의 완료된 검수와 구분한다.
- CI: [최종 커밋 상태](ci.json). 최초 본체 실행은 care-account-view.mjs와 다른 앱 이미지의503 응답으로 실패했다([당시 로그](site-ci-failure.txt)); 이력을 삭제하지 않는다. 최종 커밋의 첫 CI 실행은 Ubuntu Azure 미러 연결 지연으로 브라우저 설치가 10분 넘게 멈춰 취소하고, 같은 워크플로·커밋을 새 runner에서 한 번 재실행했다([재시도 기록](ci-retry-note.json), [설치 로그](site-ci-final-attempt1.txt)). 코드나 배포 설정은 바꾸지 않았다. 최종 커밋의 Pages 배포와 전체 사이트 점검 모두 성공했다.
- 제한: 실물 휴대폰 동기화와 OS 푸시 수신은 사용자 보류. 유료 제품 AI·의미추론·관계개선 효과 검증이 아니다. 기존 문장 틀·Vellum 표현 검사·SYNK 계정 계약을 재사용했다.
