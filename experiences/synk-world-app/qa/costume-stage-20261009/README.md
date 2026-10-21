# 코스튬 3D 무대·염색 API 검증 — 2026-10-09

이번 기록은 3D 무대·공통 아바타 범위의 로컬 검사다. 서버 저장, 홈/타운 소비 연결, 전체 코스튬 UI와 실물 휴대폰 성능·배포 검증은 별도다.

- `node --test experiences/synk-world-app/qa/wardrobe-stage-state.test.mjs`: 4개 통과. 0..1 카메라 확대 계약, 팔레트 형식·부위 제한, 실제 원단/마감 재질 변경·원색 복원, 새 옷으로 색이 잘못 이어지지 않는 동작.
- `node experiences/synk-world-app/qa/costume-stage-20261009/verify.cjs`: 로컬 4296에서 Edge headless WebGL 18개 통과. 결과는 `verification.json`.
- 실제 휠·키보드·CDP 두 손가락 핀치, PNG 크기·촬영 후 상태 복원, 실패한 PNG 변환의 상태 복원, 세 포즈·배경의 픽셀 변화, 염색/기본색 복원, idle 렌더 정지, 390px DPR/그림자/AO, 닫기 정리, 기준 몸·눈 원문 보존을 확인했다.
- `room.png`, `warm.png`, `garden.png`는 같은 코디·각도의 실제 캔버스다. `garden-tilt-dyed.png`는 근접 확대·천 자세히 보기에서 저장한 실제 PNG다. 이 이미지들은 직접 눈으로 확인했다.

API: `setDyes(dyes)`, `getDyes()`, `getDyeDefaults()`, `getView()/setView({angle,zoom,detail})`, `resetView()`, `setZoom(0..1)`, `setPose(neutral|wave|tilt)`, `setBackground(room|warm|garden)`, `getState()`, `capture({slots,dyes,width,height,thumbnail})`. `onView(view)`는 입력 변경 때 호출한다.

`dyes:{}`는 옷의 원래 재질색을 복원한다. 몽글의 몸·눈과 금속·음표 같은 고유 장식은 염색하지 않는다. 포즈는 팔 없는 기준 모델 전체의 작은 숙임·기울임이며 팔이나 별도 머리를 추가하지 않는다. warm/garden은 첫 사용 때 실제 3D 소품을 만들고 기존 조명·재질·정리 경로를 쓴다. 썸네일 촬영은 정해진 중립 구도로 찍고, 일반 사진은 현재 구도를 사용하며 두 촬영 모두 기존 작업 상태를 복원한다.
