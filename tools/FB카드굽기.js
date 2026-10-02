#!/usr/bin/env node
'use strict';

// 2026-10-01: SNS 콘텐츠 판은 SNS 제작 키트(docs/디자인/SNS키트)로 바꿨다.
// 사용자 확정 「니가 바꿔준게 정말 훨씬 나아. 전에 쓰던 양식 이걸로 전부 다 교체해줄래?」(docs/_ops/결정.md).
// 이 도구가 만들던 페이스북 첫 게시물 표지 카드(09-07)은 더 만들지 않는다. 옛 코드와 그 안의 사용자 지적은 git 기록에 있고,
// 지금도 지켜야 할 지적(장식은 표지에만·색이 가까운 부품 확인·알파 손실 변환 금지·몽골어가 주인공)은 키트 README §6으로 옮겼다.
if (require.main === module) {
  console.error('옛 페이스북 첫 게시물 표지 카드(09-07) 굽기 도구는 폐기했습니다. 새 판은 docs/디자인/SNS키트/README.md에서 견본을 복사해 쓰고 node tools/SNS키트굽기.js <원고.html> --sheet로 굽습니다(원고 md 캐러셀은 node 캐러셀/굽기.js). 파일 생성은 하지 않았습니다.');
  process.exitCode = 2;
}
