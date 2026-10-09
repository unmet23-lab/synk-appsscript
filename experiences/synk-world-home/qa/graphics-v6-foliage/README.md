# v6 가까운 식물 형상 검수

`foliage-v6.mjs`의 독립 브라우저 검수다. 최종 홈의 재질·조명·카메라 검수는 부모 작업의 v6 통합 캡처를 따른다.

- 잎: 비대칭 어깨, 좁은 끝, 도톰하게 올라온 중맥과 말린 가장자리. UV.y=0은 붙는 뿌리, UV.y=1은 끝이므로 기존 바람·그림자 셰이더의 고정점 유지.
- 나무: 굽고 가늘어지는 줄기, 줄기에서 갈라지는 가지와 잔가지, 잔가지의 실제 좌표에 연결되는 잎. 잎 수로 덩어리를 채우던 v5 방식에서 변경했다.
- 잎은 InstancedMesh 한 개, 줄기·가지는 병합 메시 한 개. 재질·조명·텍스처 소유권은 호출자에게 있고 새 루프나 별도 재질은 생성하지 않는다.
- PC 나무 25,350 triangles / 잎 352장, 모바일 설정 11,916 triangles / 잎 216장. v5의 소스에 따른 비교값 42,672 / 24,192보다 각각 약 41%, 51% 감소했다. 나무 렌더 메시 17개에서 2개로 감소했다. 이는 기하량과 메시 수이며 실제 기기의 FPS·발열 검증은 아니다.

`node experiences/synk-world-home/qa/graphics-v6-foliage/capture.cjs`로 실행한다. 현재 로컬 서버 4296의 Three.js 및 바람 모듈을 사용하며, 새 잎 모듈과 검수 HTML만 Playwright 라우트로 제공한다. 사용자 탭·계정·저장 상태를 변경하지 않는다.

`capture.json`은 소스 SHA-256과 PC·390px의 12개씩 총 24개 기하/UV/예산 검사 결과를 보존한다. `desktop.png`·`mobile.png`는 나무 전체, `*-leaf.png`는 곡면 확인용 가까운 잎이다. 실제 캡처를 열어 가지 연결·끝 형태·수관을 확인했고 1차의 지나치게 규칙적인 잎 배열과 노출된 줄기 끝을 수정한 뒤 다시 캡처했다. 단독 미리보기는 텍스처 없는 기본 재질로 기하만 확인한다.

통합 방법: `scene-v3-garden.mjs`에서 `createLeafGeometry, buildTerraceTree`를 가져오고, `leafGeometry` 본문을 `return createLeafGeometry(mobile)`로 바꾼다. 기존 위치의 `tree` 그룹 안에 `buildTerraceTree(tree, m, { mobile })`를 호출하고 예전 줄기·잎 생성 루프를 제거한다. `foliageCount`에는 반환된 `foliageCount`를 합한다. 생성된 모든 geometry는 기존 장면 순회 dispose 대상이다.
