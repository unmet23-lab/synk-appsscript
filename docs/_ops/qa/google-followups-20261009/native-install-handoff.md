사용자님이 로그아웃 수정안을 이 채팅에 전달해 최신 설치본에 반영하도록 직접 승인했습니다. 보내는 채팅 ID는 01a11ab6-4364-7993-aeed-23efc03be028이고, 최신 질문 답변 원문은 ‘전달해서 최신 설치본에 반영’입니다. 승인된 기존 채팅을 다시 열어 전달하는 요청입니다. 오래된 설치 후보로 되돌리지 말고 현재 설치·원문·담당 작업을 확인해 최신본 위에 수정해 주세요.

대상은 native auth-service의 로그아웃 한 파일 수정입니다. 정확한 입구는 C:/Users/q1212/Documents/SYNK-appsscript/docs/_ops/qa/google-release-20261009/desktop/native-logout-fix-r2/README.md와 candidate-manifest-v4.json입니다. 최신 d136 기반 source100개 중99개를 보존했고 auth-service.cjs만 바꿨습니다. 후보 class SHA256은 833905c16387ae6781d34bb7d8786b31a213220724a8e04fca7b7c5e809ec13e, 기반 class는 d2b97ccdb468fce8ecc26ebc44d88a9f2f996c3e1fb9d989b9a3ae28509a1ffd입니다. private source는 C:/Users/q1212/.codex/tmp/native-logout-fix-20261009-r2/product-readback/src/auth-service.cjs에 있습니다. 원문이 더 바뀌었으면 해당 signOut 변화만 최신 class에 적용하고 필요한 검수 범위를 판단하세요. source 전체를 덮어쓰지 마세요.

중앙 revoke-session이 provider localLogout까지 성공한 뒤에도 client가 같은 요청을 다시 보내 거짓 ‘미확인’을 표시할 수 있습니다. 후보는 HTTP 성공·ok/current/refreshRevoked가 모두 true일 때만 명시적 성공을 보존하고 중복 요청을 하지 않습니다. 실패·flag 누락·잘못된 값·다른 session·offline·일반403 fallback은 유지했습니다. 새9개 포함456/456, API adapter6/6이 통과했습니다.

실제 own-account PKCE API 시험에서도 같은 SYNK ID로 로그인했고, 현재 시험 세션만 종료하여 serverSessionRevoked/refreshRevoked/confirmed 모두 true를 확인했습니다. actual-oauth-result.json SHA256 cdf8a73f147d8d24c9cd3b1b0faed3629f841061f91f095572b2f668b046a552. 시험 종료·temporary tab 정리 후 주 계정 브라우저의 Google 연결·로그인·학습 저장 선택을 재로드로 확인했습니다. 이 API 시험은 Windows EXE·UI·IPC·DPAPI·기존 설치 프로필 검증이 아닙니다.

공식 Claude 검수는 C:/Users/q1212/Documents/SYNK-appsscript/docs/_ops/qa/google-followups-20261009/combined-official-review.json과 combined-review-command.json에 있습니다. 실제 Opus5.5 단일 모델·max 요청·완료·is_error false·permission denial0이며 native 지적은 없었습니다. 전체 시험에서 있었던 fixture 경로 오류는 최종456/456으로 해소했습니다. 검수의 적용 조건 중 설치 후 실제 종료 확인은 계속 지켜 주세요. 다른 ops helper의 P2/P3 보완은 별도이므로 이 설치와 섞지 마세요.

보내는 채팅은 공용 제품 source나 설치본을 바꾸지 않았습니다. 최신 편의 기능·메모·트레이와 기존 프로필·계정·자식 앱 pin을 보존해 설치본 준비, 필요한 검증, 반영을 진행해 주세요. 설치 후 실제 logout의 serverRevoked=true와 중복 /auth/v1/logout 요청0을 가능한 범위에서 확인하세요. 작성 중인 앱은 강제 종료하지 마세요. 현재 다른 설치 담당이 활동 중이면 먼저 공식 작업 현황으로 확인해 중복 설치를 피하세요. Google 비밀키·콘솔·브랜드·SMS·운영 회원 자료는 변경하지 마세요. 이 전달 승인을 다른 채팅에 메시지를 보내는 승인으로 확대하지 마세요.
