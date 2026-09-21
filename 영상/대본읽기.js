#!/usr/bin/env node
'use strict';

/**
 * 옛 리드크루·카운트다운 원고의 자동 변환은 2026-09-22에 폐기했다.
 * 새 콘텐츠는 해당 프로젝트 원문과 Remotion entry에서 관리한다.
 * --빈목록은 기존 도구의 타입 호환에 필요한 빈 생성물만 유지한다.
 */
const fs = require('fs');
const path = require('path');

const 인자 = process.argv.slice(2);
const 폐기안내 = '옛 리드크루·카운트다운 대본 변환은 폐기되었습니다. 새 콘텐츠의 원문과 entry를 사용하세요(영상/README.md).';

if (!인자.includes('--빈목록') || 인자.some((값) => !['--빈목록', '--검사'].includes(값))) {
  console.error(폐기안내);
  console.error('콘텐츠 검사·생성·렌더는 실행하지 않았습니다. 호환용 빈 목록만 관리하려면 --빈목록 [--검사]를 사용하세요.');
  process.exit(2);
}

const 생성방 = path.join(__dirname, 'src', '클립', '생성');
const 목록 = [
  { 파일: '대본클립들.ts', 이름: '대본클립들', 타입: '클립' },
  { 파일: '카운트다운들.ts', 이름: '카운트다운들', 타입: '카운트다운' },
];
let 불일치 = false;
for (const { 파일, 이름, 타입 } of 목록) {
  const 경로 = path.join(생성방, 파일);
  const 본문 = `/* 옛 리드크루·카운트다운은 폐기되었다(2026-09-22).
 * 호환용 빈 목록이며 콘텐츠 검증·렌더 결과가 아니다.
 * 유지보수: node 영상/대본읽기.js --빈목록
 */
import type { ${타입} } from "../타입";

export const ${이름}: ${타입}[] = [];
`;
  const 기존 = fs.existsSync(경로) ? fs.readFileSync(경로, 'utf8').replace(/\r\n/g, '\n') : null;
  if (인자.includes('--검사')) {
    if (기존 !== 본문) {
      불일치 = true;
      console.error(`${파일}: 호환용 빈 목록과 다릅니다. --빈목록으로 갱신하세요.`);
    }
  } else if (기존 !== 본문) {
    fs.mkdirSync(생성방, { recursive: true });
    fs.writeFileSync(경로, 본문, 'utf8');
  }
}

console.log(폐기안내);
console.log(`호환용 빈 목록 ${인자.includes('--검사') ? '확인' : '유지보수'}${불일치 ? ' 실패' : ' 완료'}. 콘텐츠 검사·렌더는 실행하지 않았습니다.`);
process.exit(불일치 ? 1 : 0);
