#!/usr/bin/env node
'use strict';
/** Vertex 명시 계정 조회. 자격 파일 이동으로 다른 결제 계정을 켜지 않는다.
 * node tools/굽기계정.js [--json] [--확인]
 * 계정 변경은 SYNK_VERTEX_OAUTH + SYNK_VERTEX_PROJECT를 명시하거나 공식 계정 연결 도구를 쓴다. */
const fs = require('node:fs');
const 정책 = require('./모델정책.js');
function 설정읽기() {
  const 파일 = 정책.붙인자격();
  if (!fs.existsSync(파일)) throw new Error(`명시한 Vertex 자격 파일이 없다: ${파일}. 배포(clasp) 계정으로 자동 이동하지 않는다.`);
  const j = JSON.parse(fs.readFileSync(파일, 'utf8'));
  const 프로젝트 = 정책.벌텍스프로젝트();
  정책.벌텍스자격확인(j, 프로젝트);
  let 계정 = j.계정 || null;
  const t = (j.tokens && j.tokens.default) || j;
  if (!계정 && t.id_token) {
    try { 계정 = JSON.parse(Buffer.from(t.id_token.split('.')[1], 'base64url').toString()).email || null; } catch { /* 식별정보 미확인 */ }
  }
  return { 자격파일: 파일, 프로젝트, 계정: 계정 || '확인 불가', 자동계정대체: false,
    캐시: '명시 자격·프로젝트·자격 회전별 분리', 현재청구액: null, 현재크레딧: null };
}
async function main(argv = process.argv.slice(2)) {
  if (['--옛', '--새', '--unmet23', '--77yuhbs'].some((flag) => argv.includes(flag))) {
    throw new Error('파일 이동 방식의 계정 전환은 폐기됐다. 자격을 이동하지 않았다. SYNK_VERTEX_OAUTH와 SYNK_VERTEX_PROJECT로 실제 사용 계정을 명시한다.');
  }
  const r = 설정읽기();
  if (argv.includes('--확인')) {
    const 조회 = require('./구글크레딧.js');
    const 선택 = Object.entries(조회.지갑들).find(([, g]) => g.프로 === r.프로젝트);
    if (!선택) throw new Error('현재 프로젝트는 기존 사용량 조회 목록에 없다. 다른 프로젝트로 자동 조회하지 않는다.');
    return 조회.main([`--${선택[0]}`, '--시간', '1', ...(argv.includes('--json') ? ['--json'] : [])]);
  }
  if (argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`Vertex 명시 계정: ${r.계정} / ${r.프로젝트}`);
    console.log(`자격: ${r.자격파일}`);
    console.log(`토큰 캐시: ${r.캐시}`);
    console.log('자격/프로젝트가 없거나 서로 다르면 멈춘다. 계정·결제·자격 파일을 바꾸지 않았다.');
    console.log('현재 비용·크레딧·무료 체험 여부는 Cloud Billing에서 확인한다. 최근 모델별 사용량: --확인');
  }
  return r;
}
module.exports = { 설정읽기, main };
if (require.main === module) main().catch((e) => { console.error(`확인 불가: ${e.message}`); process.exitCode = 1; });
