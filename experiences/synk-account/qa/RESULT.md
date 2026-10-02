# 로컬 화면·계약 확인 · 2026-10-02

- Core 회귀 7개 통과: 공개 설정 제한, PKCE S256/state, 일회 콜백, 만료/제품/주소 불일치 거절, 동의 redirect allowlist, 계정/revision 저장소 격리, 공개 token POST.
- 신규 headless Chrome context에서 로컬 파일만 제공한 fixture 시나리오 14개 통과. 외부 인증 요청 없음. 별도 개인 브라우저 프로필을 읽지 않음.
- 390×844 모바일과 1440×1000 데스크톱 확인. 모바일 가로 넘침 없음. 승인 펠트 판/책/서체의 실제 파일 적용을 캡처에서 확인.
- 화면 검증: 설정 없음 안내, 가입/복구 모드, 합성 로그인 + SDK auth event 중복, 동의 거절, 플랫폼/WORLD 구분, 실제 host를 시작하지 않는 합성 게임, 학습 toggle, 서버 응답의 account.providers 및 entitlements.key/product/valid_until, rollout 잠금/동의 철회 허용, 삭제 UUID와 접수 상태, 전체 세션 종료의 부분 실패 문구, 인증 확인 실패 뒤 재로그인 입구.
- `--check`는 최신 root account-client/host 복사본과 생성 번들·자산·SHA-256 manifest를 대조한다.

이 기록은 실제 Supabase 인증 성공, 복구 메일 수신, 운영 동의/동기화, 공개 서비스 배포의 증거가 아니다. 운영 설정을 만들거나 읽지 않았다. 실제 설정 후 두 제품/Native의 redirect와 로그인·동의·철회·계정 전환을 별도 확인해야 한다. WORLD의 계정 저장소 host 통합은 root에서 실제 공용 로컬 게임 서버에 붙여 추가 검증한다.

캡처: `preview-login-desktop.png`, `preview-world-mobile.png`. 두 파일 모두 합성 화면임을 상단에 명시한다.


## 원작업본 통합 뒤 직접 확인

2026-10-02 CUA 실제 로컬 브라우저, 합성 계정. `client.html?product=world`는 config 미설정 안내와 기본 학습 링크를 표시했다. `preview.html?account=world`는 실제 인증·서버 저장·권한 변경이 없는 합성 화면이라고 표시한다.

- 390×844 / 1280×900에서 가로 넘침 없음. 이미지 누락 없음.
- 학습 연결 끄기 → 이 계정의 기기 전용 기록 안내, 삭제 요청 dialog → 취소, `disabled&rollout-off`의 연결 checkbox 비활성 확인.
- 계정 첫 화면의 큰 소개를 줄여 계정/학습 연결이 먼저 보이도록 정리하고, 역할을 한국어로 표시했다. 체크도 승인된 실제 펠트 `badge-check`/`badge-cream` 부품으로 마감했다.
- `world-account-390.png`, `world-account-1280.png`는 최종 화면 캡처다.
- 네이티브 계정 화면은 기존 다크 테마 유지. 별도 실제 RN 미리보기에서도 연결 전환·삭제 확인 취소 및 console 오류0을 확인했다.
- `atlas-integration-final.txt`: 공통/동기화/저장실패/호스트/정적 서버45개 통과. 앱 원작업본의 `artifacts/synk-account-20261002/related-tests-final.txt`:242개 통과. portal core7개 통과.

실제 로그인·메일·실계정 동의·삭제·두 기기 왕복·공개 배포 검증이 아니다. 기존에 열려 있던 오래된 브라우저 탭의 재선택은 URL 프로토콜 정책으로 차단되어 수정하지 않았고, 허용된 HTTP의 별도 계정 예시 탭에서 결과를 확인했다.
