'use strict';
// 이 작업이 소유한 짧은 정본 연결만 적용한다. 기존 문서 전체를 복제하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const DOC = '사업발전_정본.md';
const changes = [
  ['docs/AI_운영원칙.md', '사업 발전의 세 방향', '| 사업·제품·교육 판단 | `docs/SYNK_철학.md` 관련 절, `docs/제품방향.md`, 관련 결정 |', '| 사업·제품·교육 판단 | `docs/SYNK_철학.md` 관련 절, `docs/제품방향.md`, 관련 결정. 사업 발전의 세 방향(실전 학습·협동 작품·접근성)은 `docs/사업발전_정본.md` |'],
  ['docs/제품방향.md', '## 실전 학습·협동 작품·접근성의 흡수', '## 엔진 로드맵', `## 실전 학습·협동 작품·접근성의 흡수\n\n2026-09-09 사용자 채택. 실전 리허설은 LAB·SHIFT의 교육과 상품을 발전시키고, 협동 이야기는 PULSE의 새 작품 사업으로 시작하며, 접근성은 전사 제작·검수에 적용한다. 역할·발전 순서·첫 실물·검증 경계는 [사업 발전 정본](${DOC})을 따른다. 기존 LAB 앱·개원 약속을 바꾸거나 첫 체험을 학생 엔진에 연결 완료했다고 뜻하지 않는다.\n\n## 엔진 로드맵`],
  ['docs/마케팅_정본.md', '**09-09 사업 발전 채택:**', '## 0. 처음에는 이 한 장', `> **09-09 사업 발전 채택:** 실전 리허설은 LAB·SHIFT의 상품 역량, 협동 이야기는 PULSE의 작품 사업, 접근성은 전사 제작 품질로 흡수한다. 앞으로 해당 기획·제작에 [사업 발전 정본](${DOC})을 함께 적용한다. 새 이름 세 개나 판매·효과 완료를 뜻하지 않는다.\n\n## 0. 처음에는 이 한 장`],
  ['docs/조직계보_정본_v1.md', '## 6-1. 실전 학습·협동 작품·접근성의 배치', '## 7. 판별 기준 — 뒤죽박죽 재발 방지', `## 6-1. 실전 학습·협동 작품·접근성의 배치\n\n2026-09-09 사용자 채택. 실전 리허설은 LAB·SHIFT, 협동 이야기 작품은 PULSE(계약·수익은 기존 SHIFT 분담), 접근성은 COMMON SYSTEM의 제작·검수 역량에 둔다. 기존 회사 구조에 흡수하며 새 법인·브랜드를 자동 신설하지 않는다. 공유 자산·개인 기록·고객 소유 납품물의 경계와 실행은 [사업 발전 정본](${DOC})에서 관리한다.\n\n## 7. 판별 기준 — 뒤죽박죽 재발 방지`],
  ['docs/명품_기준_v1.md', '### 4-1. 접근성을 제작에 함께 넣는다', '## 5. 아직 확인하지 않은 것', `### 4-1. 접근성을 제작에 함께 넣는다\n\n2026-09-09 사용자 채택. 접근성을 전사 제작 역량으로 흡수한다. 웹의 키보드·초점·입력 안내·움직임 감소, 장면의 동등한 설명, 영상·소리의 자막·필요한 음성 해설 중 해당 항목을 제작 때 적용한다. 종류별 적용과 자동 검사·실사용·전문 검수의 경계는 [사업 발전 정본 §4](${DOC}#4-접근성을-전사-제작에-적용하는-방법)를 따른다. 기존 검사기를 활용하고 새 강제 훅을 만들지 않는다. 자동 검사 통과로 접근성 전체를 인증하지 않는다.\n\n## 5. 아직 확인하지 않은 것`],
  ['docs/_ops/결정.md', '실전 리허설·협동 이야기·접근성 세 방향을', '|---|---|---|---|', '|---|---|---|---|\n| 2026-09-09 | 확정 | 실전 리허설·협동 이야기·접근성 세 방향을 기존 SYNK에 흡수한다. 1번은 LAB·SHIFT의 교육·상품 발전, 2번은 PULSE의 협동 작품 사업, 3번은 전사 제작·검수 역량으로 배치하고 정본에 연결한다. 각각의 첫 작동 결과물을 지금 제작한다. 2번은 펠트 그래픽에 영화적인 공간·조명·재질 완성도를 지향한다. 적용 = docs/사업발전_정본.md, experiences/20260909/. 작품명·에피소드·웹 3D 구현은 위임에 따른 제작 판단이며 Unreal/GTA와 동급 완성·외부 출시·매출의 확인은 아니다. | 유호 이번 요청: 세 방향을 현재 사업에 흡수, 새 정본 또는 기존 정본에 반영, 앞으로 적용, 각각 즉시 구현·결과 보고. 펠트 버전 언리얼5 GTA6 같은 그래픽 품질을 지향. |'],
  ['docs/_ops/트랙.md', '## 0-사업발전. 실전 학습·협동 작품·접근성', '## 0. 지금 도는 세션 — 남의 자리는 손대지 않는다', '## 0-사업발전. 실전 학습·협동 작품·접근성\n\n09-09 사용자 채택으로 LAB·SHIFT / PULSE / 공통 제작 역량에 흡수. 정본 = `docs/사업발전_정본.md`, 첫 실물·증거 = `experiences/20260909/README.md`.\n\n- [기계] PULSE 첫 3D 공간의 고유 모델·재질·빛을 미술 기준과 대조하며 발전시키고, 실제 기기별 성능을 확인. 기준·현재 차이 = `docs/사업발전_정본.md` §3, `experiences/20260909/README.md` §2.\n- [사람] 리허설의 새 상황 적용·강사 작업시간, 협동 작품의 실제 재미·재구매, 접근성 전문·당사자 검수는 실제 사용에서 확인.\n\n## 0. 지금 도는 세션 — 남의 자리는 손대지 않는다'],
];
function transform(input, marker, anchor, replacement) {
  const text = input.replace(/\r\n/g, '\n');
  if (text.includes(marker)) return { text, changed: false };
  if (text.indexOf(anchor) < 0 || text.indexOf(anchor) !== text.lastIndexOf(anchor)) throw new Error('정본 연결의 기준 문장이 유일하지 않습니다: ' + marker);
  return { text: text.replace(anchor, replacement), changed: true };
}
if (process.argv.includes('--apply')) {
  for (const [file, marker, anchor, replacement] of changes) {
    const abs = path.join(ROOT, file), before = fs.readFileSync(abs, 'utf8');
    const after = transform(before, marker, anchor, replacement);
    if (after.changed) fs.writeFileSync(abs, before.includes('\r\n') ? after.text.replace(/\n/g, '\r\n') : after.text);
    process.stdout.write(`${after.changed ? '연결' : '기존 연결 유지'} ${file}\n`);
  }
}
module.exports = { changes, transform };
