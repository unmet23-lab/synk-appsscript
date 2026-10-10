# 로컬 화면·계약 확인 · 2026-10-02

- Core 회귀 7개 통과: 공개 설정 제한, PKCE S256/state, 일회 콜백, 만료/제품/주소 불일치 거절, 동의 redirect allowlist, 계정/revision 저장소 격리, 공개 token POST.
- 신규 headless Chrome context에서 로컬 파일만 제공한 fixture 시나리오 14개 통과. 외부 인증 요청 없음. 별도 개인 브라우저 프로필을 읽지 않음.
- 390×844 모바일과 1440×1000 데스크톱 확인. 모바일 가로 넘침 없음. 승인 펠트 판/책/서체의 실제 파일 적용을 캡처에서 확인.
- 화면 검증: 설정 없음 안내, 가입/복구 모드, 합성 로그인 + SDK auth event 중복, 동의 거절, 플랫폼/WORLD 구분, 실제 host를 시작하지 않는 합성 게임, 학습 toggle, 서버 응답의 account.providers 및 entitlements.key/product/valid_until, rollout 잠금/동의 철회 허용, 삭제 UUID와 접수 상태, 전체 세션 종료의 부분 실패 문구, 인증 확인 실패 뒤 재로그인 입구.
- `--check`는 최신 root account-client/host 복사본과 생성 번들·자산·SHA-256 manifest를 대조한다.

이 기록은 실제 Supabase 인증 성공, 복구 메일 수신, 운영 동의/동기화, 공개 서비스 배포의 증거가 아니다. 운영 설정을 만들거나 읽지 않았다. 실제 설정 후 두 제품/Native의 redirect와 로그인·동의·철회·계정 전환을 별도 확인해야 한다. WORLD의 계정 저장소 host 통합은 root에서 실제 공용 로컬 게임 서버에 붙여 추가 검증한다.

캡처: `preview-login-desktop.png`, `preview-world-mobile.png`. 두 파일 모두 합성 화면임을 상단에 명시한다.
