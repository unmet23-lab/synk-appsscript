#!/usr/bin/env node
/**
 * 세션 환경 파일 줄이기
 *
 * Claude Code는 세션마다 ~/.claude/session-env/<CLI 세션 id>/*.sh 를 두고 Bash 도구 명령과 함께 넘긴다.
 * codex 플러그인 시작 훅이 세션이 다시 켜질 때마다 같은 export 세 줄을 덧붙여, 파일이 8KB 안팎을 넘으면
 * Bash 명령 문자열이 그 자리에서 잘려 `line 76/77: unexpected EOF`로 아무것도 돌지 않는다
 * (현장 노트 docs/현장노트/윈도우_셸.md 「앱을 다시 켠 뒤 Claude Bash 도구가 …」, 10-19 확인).
 *
 * 모든 줄이 export NAME='값' 꼴인 파일만, 같은 줄을 처음 것 하나만 남긴다. 값이 같은 줄만 지우므로 동작은 그대로다.
 * 세션은 시작할 때 이 파일을 읽으므로, 줄인 뒤 그 세션이 다시 켜져야 Bash가 돌아온다.
 *
 *   node tools/세션환경_줄이기.cjs              미리 보기(바꾸지 않는다)
 *   node tools/세션환경_줄이기.cjs --실행        줄인다(임시 파일에 쓰고 바꿔 넣는다)
 *   --조용히                                     아무것도 찍지 않는다(훅에서 부를 때)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const 인자 = new Set(process.argv.slice(2));
const 실행 = 인자.has('--실행');
const 조용히 = 인자.has('--조용히');
const 뿌리 = path.join(os.homedir(), '.claude', 'session-env');
const 꼴 = /^export [A-Za-z_][A-Za-z0-9_]*='[^']*'$/;
const 찍기 = (글) => { if (!조용히) console.log(글); };

function 파일들(폴더) {
  const 결과 = [];
  let 항목들 = [];
  try { 항목들 = fs.readdirSync(폴더, { withFileTypes: true }); } catch (_) { return 결과; }
  for (const e of 항목들) {
    const p = path.join(폴더, e.name);
    if (e.isDirectory()) 결과.push(...파일들(p));
    else if (e.isFile() && e.name.endsWith('.sh')) 결과.push(p);
  }
  return 결과;
}

function 바꿔넣기(파일, 글) {
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, 글, 'utf8');
  try {
    fs.renameSync(임시, 파일);
  } catch (err) {
    // Windows가 교체를 거절하면(EPERM) 작은 파일이라 그 자리에 쓴다.
    fs.writeFileSync(파일, 글, 'utf8');
    try { fs.unlinkSync(임시); } catch (_) {}
  }
}

let 줄인수 = 0, 건너뜀 = 0, 전체 = 0;
for (const 파일 of 파일들(뿌리)) {
  전체++;
  let 글;
  try { 글 = fs.readFileSync(파일, 'utf8'); } catch (_) { continue; }
  const 줄들 = 글.split('\n').filter((l) => l !== '');
  if (줄들.some((l) => !꼴.test(l))) { 건너뜀++; continue; } // 쓰는 중이거나 다른 꼴이면 손대지 않는다
  const 남길 = [...new Set(줄들)];
  if (남길.length === 줄들.length) continue;
  줄인수++;
  찍기(`${path.relative(뿌리, 파일)}  ${줄들.length}줄 → ${남길.length}줄 (${Buffer.byteLength(글)}바이트)`);
  if (실행) 바꿔넣기(파일, `${남길.join('\n')}\n`);
}
찍기(`${실행 ? '줄임' : '미리 보기'} — 파일 ${전체}개 중 ${줄인수}개${실행 ? '를 줄였다' : '를 줄일 수 있다(--실행)'}${건너뜀 ? ` · export 꼴이 아니라 건너뜀 ${건너뜀}개` : ''}`);
