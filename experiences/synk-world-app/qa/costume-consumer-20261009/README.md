# 홈·타운 염색 소비 검증 — 2026-10-10

기존 4296 서버를 건드리지 않고 4308·별도 임시 DB의 고정 합성 계정으로 확인했다. 운영 계정·권한·배포는 변경하지 않았다.

- `node --test experiences/synk-world-app/qa/wardrobe-consumer.test.mjs experiences/synk-world-app/qa/wardrobe-client.test.mjs experiences/synk-world-app/qa/town-host.test.mjs experiences/synk-world-app/qa/town-bridge.test.mjs`: 18개 통과.
- `node --test experiences/synk-town/server.test.mjs`: 타운 입장·개발 명령·경로 노출의 기존 권한 시험 2개 통과.
- `node experiences/synk-world-app/qa/costume-consumer-20261009/verify.cjs`: Edge headless 실제 WebGL/UI/로컬 서버 왕복 16개 통과. 최신 결과는 `verification.json`.

홈 미리보기의 저장된 옷/코디 염색, 실제 UI의 코디 저장·기본색 착용, WORLD 저장 응답과 홈 실제 renderer, 서버 코디 색 저장, WORLD snapshot → appearance bridge → 실제 타운 playerAvatar, 같은 카메라의 실시간 기본색 복원을 확인했다. PNG 행거 촬영은 기존 state·caption·storage·차림·색을 보존하며 PNG 변환 실패 때도 복원된다.

`preview-home.png`, `home-hanger-thumbnail.png`, `world-home-dyed.png`, `world-town-dyed.png`, `world-town-default.png`는 실제 렌더 출력이다. 타운은 WebGL 버퍼를 유지하지 않으므로 픽셀 비교에는 `canvas.toDataURL()` 대신 실제 브라우저 canvas screenshot을 사용했다. 관련 이미지들은 직접 눈으로 확인했다.

이번 범위는 `app.mjs`, `world-town-client.mjs`, `day-scene.mjs` 소비 연결이다. 몸·눈 원문과 타운의 기존 이동·장소·주민·그래픽 설정은 바꾸지 않았다. 실물 휴대폰과 공개 서비스 검증은 별도다.
