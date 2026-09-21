#!/usr/bin/env node
'use strict';

// 2026-09-21: 자체 실행/검수 러너와 함께 네 역할의 강제 프롬프트 주입 검사를 은퇴했다.
// 이 파일은 옛 호출자에게 미검증 상태를 명시하는 호환 입구다. 원문·모델·자식 프로세스를 읽거나 실행하지 않는다.
// 현재 제품 검증은 실제 변경의 관련 시험과 공식 앱/CLI 검토로 수행한다.
const 이유 = '자체 러너의 네 역할 프롬프트 주입 검사는 은퇴했다. 공식 앱/CLI는 필요한 공통 원문을 직접 읽는다. 이 결과는 제품 품질이나 철학 반영을 검증하지 않았다.';
const 역할정의 = [['실행자', '자식프로세스'], ['발주검토자', '자식프로세스'], ['검수자', '함수호출'], ['심문자', '함수호출']];

function 대조() {
  return {
    결과: {
      status: 'retired', 측정: false, 이유,
      역할들: 역할정의.map(([이름, 잰법]) => ({ 이름, 잰법, 글자수: null, 실렸나: null, 쟀나: false, 까닭: 이유 })),
      모두실렸나: null, 모두쟀나: false,
    },
    종료코드: 2, 검수경로들: [], 반쪽: null,
  };
}

function main(argv = process.argv.slice(2)) {
  const 결과 = 대조().결과;
  if (argv.some((인자) => 인자 !== '--json')) {
    결과.status = 'invalid-arguments';
    결과.이유 = '지원하지 않는 인자다. 사용법: node tools/GPT철학대조.js [--json]. 이 검사는 은퇴했으며 실행을 다시 여는 옵션은 없다.';
  }
  console.log(argv.includes('--json') ? JSON.stringify(결과) : `은퇴한 진단 · 미검증\n${결과.이유}`);
  return 2;
}

module.exports = { 대조, main };
if (require.main === module) process.exitCode = main();
