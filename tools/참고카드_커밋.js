#!/usr/bin/env node
'use strict';
/**
 * 참고카드 커밋 — 공용 작업본에서 docs/참고카드/ 아래 바뀐 파일만 커밋한다.
 *
 *   node tools/참고카드_커밋.js                    미리 보기(커밋할 파일만 보여 준다)
 *   node tools/참고카드_커밋.js --커밋             커밋한다
 *   node tools/참고카드_커밋.js --커밋 --메시지 "docs(참고카드): …"
 *   node tools/참고카드_커밋.js --커밋 --json      결과를 기계 판독용으로
 *
 * 꼬리 없는 작업본(HEAD가 받아 둔 origin 같은 이름 가지의 조상, 2026-10-20 공용 작업본 꼬리 정리 뒤)에서는 로컬 가지에 커밋을
 * 쌓지 않는다 — 쌓으면 꼬리가 다시 생긴다. tools/바로올리기.js(docs/참고카드 --폴더)로 막 받은 origin 위에 카드만 커밋해 곧바로
 * push하고 작업본을 따라가게 한다(결과 「커밋함」에 올림: true). 예약 작업이 도는 운영 사본(tools/운영사본.js — 분리된 HEAD가
 * origin/master의 조상)도 같은 길로 올리고, 못 올리면 운영 사본 갱신이 다시 올리게 적어 둔다(10-22). 그 밖에는 아래처럼 로컬에만
 * 커밋하고 push는 하지 않는다.
 *
 * 공용 작업본은 여러 세션이 같은 git 인덱스를 쓴다. 그래서
 *  1. 잠금이 풀리지 않거나, 병합·리베이스가 진행 중이거나, 공용 인덱스에 카드 변경이 올라가 있으면 아무것도 하지 않는다.
 *  2. 별도 인덱스(GIT_INDEX_FILE)를 HEAD로 만들고 docs/참고카드/만 얹어 commit-tree로 커밋을 만든다(훅은 없다).
 *  3. update-ref로 HEAD가 그대로일 때만 가지를 옮긴다(CAS). 그사이 HEAD가 움직였으면 처음부터 다시 한다(3번까지).
 *  4. 곧바로 공용 인덱스의 그 경로만 새 HEAD에 맞춘다(git reset -q -- 경로). 맞추지 못하면 가지를 원래대로
 *     되돌린다(CAS). 공용 인덱스가 옛 판인 채 다른 세션이 커밋하면 카드가 지워지기 때문이다.
 * 다른 세션 커밋이 끼어들어 카드가 빠져도 작업본 파일은 남으므로 다음 실행이 다시 커밋한다.
 * 텔레그램 팁 봇의 Claude 검토(예약 작업 synk-tip-claude-review-2)가 카드를 쓴 뒤 부른다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { 살피기 } = require('./git잠금.js');

const 저장소 = path.resolve(__dirname, '..');
const 경로 = 'docs/참고카드';
const 서명 = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';

function git(args, { env, input } = {}) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: 저장소, encoding: 'utf8', input, windowsHide: true,
    env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function 잠깐(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** status -z 출력의 경로 목록. 「XY 경로」 꼴이고, 이름 바꿈·복사는 다음 칸이 옛 경로다. 앞 공백을 자르지 않는다. */
function 상태경로(출력) {
  const 칸 = 출력.split('\0').filter(Boolean);
  const 경로들 = [];
  for (let i = 0; i < 칸.length; i++) {
    const 코드 = 칸[i].slice(0, 2);
    경로들.push(칸[i].slice(3));
    if (코드[0] === 'R' || 코드[0] === 'C') i++;
  }
  return 경로들;
}

function 바뀐파일() {
  return 상태경로(git(['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', 경로]));
}

/** 커밋하면 안 되는 상태면 그 이유. 잠금은 잠깐 기다려 본다. 분리허용: 바로올리기로 올릴 분리된 HEAD(운영 사본)는 막지 않는다. */
function 막힘이유({ 분리허용 = false } = {}) {
  let 잠금 = 살피기(저장소);
  for (let i = 0; 잠금.상태 !== '없음' && i < 10; i++) {
    잠깐(1500);
    잠금 = 살피기(저장소);
  }
  if (잠금.상태 !== '없음') return `index.lock ${잠금.상태} — ${잠금.이유} (주인 없는 잠금이면 node tools/git잠금.js --정리)`;
  const gitdir = path.resolve(저장소, git(['rev-parse', '--git-dir']).trim());
  for (const f of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG']) {
    if (fs.existsSync(path.join(gitdir, f))) return `진행 중인 git 작업이 있다(${f})`;
  }
  let 가지 = '';
  try { 가지 = git(['symbolic-ref', '-q', 'HEAD']).trim(); } catch (_) {}
  if (!가지.startsWith('refs/heads/') && !(분리허용 && !가지)) return 'HEAD가 가지에 있지 않다(분리된 HEAD)';
  const 올라간 = git(['diff', '--cached', '--name-only', '-z', '--', 경로]).split('\0').filter(Boolean);
  if (올라간.length) return `공용 인덱스에 카드 변경이 이미 올라가 있다(${올라간.length}개) — 다른 세션이 다루는 중일 수 있다`;
  return null;
}

function 기본메시지(파일) {
  const 카드 = 파일.filter(f => f.startsWith(`${경로}/카드/`)).length;
  return 카드 ? `docs(참고카드): 팁 적용안 카드 ${카드}장` : 'docs(참고카드): 목록 갱신';
}

/** HEAD가 받아 둔 origin 같은 이름 가지의 조상이면(꼬리 없음) 그 추적 가지, 아니면 null. 분리된 HEAD(운영 사본)는 origin/master와 견준다. */
function 꼬리없는원격() {
  let 가지 = '';
  try { 가지 = git(['symbolic-ref', '-q', 'HEAD']).trim(); } catch (_) { /* 분리된 HEAD */ }
  if (가지 && !가지.startsWith('refs/heads/')) return null;
  const 추적 = 가지 ? `refs/remotes/origin/${가지.slice('refs/heads/'.length)}` : 'refs/remotes/origin/master';
  try { git(['rev-parse', '-q', '--verify', `${추적}^{commit}`]); } catch (_) { return null; }
  try { git(['merge-base', '--is-ancestor', 'HEAD', 추적]); return 추적; } catch (_) { return null; }
}

/** 운영 사본에서 못 올린 카드는 운영 사본 갱신이 다음 회차에 다시 올린다(남은장부) */
function 운영사본에남기기(파일, 결과) {
  try {
    const 운영 = require('./운영사본.js');
    if (운영.운영사본인가(저장소)) 운영.남은장부적기(파일, 결과);
  } catch (_) { /* 운영사본.js가 없는 옛 사본 */ }
}

/** 꼬리 없는 작업본: 바로올리기로 카드만 커밋·push한다. 결과는 로컬 커밋 때와 같은 꼴(커밋함·커밋할 것 없음·멈춤·실패). */
function 바로올리기로(메시지, 파일) {
  const 글 = `${메시지 || 기본메시지(파일)}\n\n${파일.map(f => `- ${f}`).join('\n')}\n\n${서명}\n`;
  const 글파일 = path.join(os.tmpdir(), `synk-cards-msg-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(글파일, 글);
  try {
    const r = spawnSync(process.execPath, [path.join(저장소, 'tools', '바로올리기.js'), 경로, '--폴더', '-F', 글파일, '--실행', '--json'],
      { cwd: 저장소, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    let 결과;
    try { 결과 = JSON.parse(r.stdout); } catch (_) {
      return { 결과: '실패', 이유: `바로올리기 출력을 읽지 못했다(종료 ${r.status}) — ${String(r.stderr || r.stdout).trim().slice(0, 400)}` };
    }
    const 따라감 = 결과.따라가기 && 결과.따라가기.결과;
    if (결과.결과 === '올림') {
      return {
        결과: '커밋함', 커밋: 결과.머리, 올림: true, 원격: 결과.원격, 파일: (결과.수 || []).map((x) => x.경로),
        ...(따라감 && 따라감 !== '따라감' ? { 주의: `push는 됐다 — 작업본 따라가기: ${따라감}${결과.따라가기.이유 ? ` (${결과.따라가기.이유})` : ''}` } : {}),
      };
    }
    if (결과.결과 === '올릴 것 없음') return { 결과: '커밋할 것 없음', 이유: 결과.이유 };
    운영사본에남기기(파일, 결과);
    return { 결과: 결과.결과 === '멈춤' ? '멈춤' : '실패', 이유: `바로올리기: ${결과.이유 || 결과.결과}(카드는 작업본에 그대로)` };
  } finally {
    fs.rmSync(글파일, { force: true });
  }
}

/** 한 번 시도. 결과: 커밋함 / 커밋할 것 없음 / 다시(HEAD가 움직임) / 실패 */
function 한번(메시지) {
  const 옛 = git(['rev-parse', 'HEAD']).trim();
  const 가지 = git(['symbolic-ref', '-q', 'HEAD']).trim();
  const 인덱스 = path.join(os.tmpdir(), `synk-cards-${process.pid}-${Date.now()}.index`);
  const env = { GIT_INDEX_FILE: 인덱스 };
  try {
    git(['read-tree', 옛], { env });
    git(['add', '-A', '--', 경로], { env });
    const 트리 = git(['write-tree'], { env }).trim();
    const 옛트리 = git(['rev-parse', `${옛}^{tree}`]).trim();
    if (트리 === 옛트리) return { 결과: '커밋할 것 없음' };
    const 파일 = git(['diff', '--name-only', '-z', 옛트리, 트리]).split('\0').filter(Boolean);
    const 밖 = 파일.filter(f => !f.startsWith(`${경로}/`));
    if (밖.length) return { 결과: '실패', 이유: `카드 폴더 밖 경로가 섞였다: ${밖.join(', ')}` };
    const 글 = `${메시지 || 기본메시지(파일)}\n\n${파일.map(f => `- ${f}`).join('\n')}\n\n${서명}\n`;
    const 새 = git(['commit-tree', 트리, '-p', 옛, '-F', '-'], { input: 글 }).trim();
    try {
      git(['update-ref', '-m', 'docs(참고카드): 카드 커밋', 가지, 새, 옛]);
    } catch (_) {
      return { 결과: '다시', 이유: 'HEAD가 그사이 움직였다' };
    }
    let 맞춤오류 = null;
    for (let i = 0; i < 8; i++) {
      try {
        git(['reset', '-q', '--pathspec-from-file=-', '--pathspec-file-nul'], { input: `${파일.join('\0')}\0` });
        맞춤오류 = null;
        break;
      } catch (e) {
        맞춤오류 = e;
        잠깐(1500);
      }
    }
    if (맞춤오류) {
      let 되돌림 = '가지를 원래대로 되돌렸다(카드는 작업본에 그대로)';
      try {
        git(['update-ref', '-m', 'docs(참고카드): 공용 인덱스를 못 맞춰 되돌림', 가지, 옛, 새]);
      } catch (_) {
        되돌림 = '주의: 가지를 되돌리지 못했다(그사이 다른 커밋이 올라감). `git reset -q -- docs/참고카드`로 공용 인덱스를 맞춰야 한다';
      }
      return { 결과: '실패', 이유: `공용 인덱스를 새 HEAD에 맞추지 못했다 — ${되돌림}`, 커밋: 새 };
    }
    const 남은 = git(['diff', '--cached', '--name-only', '-z', '--', 경로]).split('\0').filter(Boolean);
    return { 결과: '커밋함', 커밋: 새, 파일, ...(남은.length ? { 주의: `공용 인덱스에 카드 경로 ${남은.length}개가 아직 다르다` } : {}) };
  } finally {
    fs.rmSync(인덱스, { force: true });
    fs.rmSync(`${인덱스}.lock`, { force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const 메시지자리 = args.indexOf('--메시지');
  const 메시지 = 메시지자리 >= 0 ? args[메시지자리 + 1] : '';
  const 아는 = new Set(['--커밋', '--json', '--메시지']);
  const 모르는 = args.filter((a, i) => !아는.has(a) && i !== 메시지자리 + 1);
  if (모르는.length || (메시지자리 >= 0 && !메시지)) {
    console.error(`모르는 인자: ${모르는.join(' ') || '--메시지 뒤 글'} (아는 것: --커밋 --메시지 "…" --json)`);
    process.exit(1);
  }
  const 출력 = (r) => console.log(args.includes('--json') ? JSON.stringify(r, null, 2)
    : `${r.결과}${r.이유 ? ` — ${r.이유}` : ''}${r.커밋 ? ` ${r.커밋.slice(0, 9)}` : ''}${r.파일 ? `\n${r.파일.map(f => `  ${f}`).join('\n')}` : ''}${r.주의 ? `\n주의: ${r.주의}` : ''}`);

  const 파일 = 바뀐파일();
  if (!args.includes('--커밋')) {
    출력({ 결과: '미리 보기', 이유: 파일.length ? `커밋할 파일 ${파일.length}개(--커밋으로 커밋)` : '바뀐 카드 없음', 파일 });
    return;
  }
  if (!파일.length) { 출력({ 결과: '커밋할 것 없음' }); return; }
  if (꼬리없는원격()) {
    const 이유 = 막힘이유({ 분리허용: true });
    // 운영 사본이면 못 올린 카드로 적어 둔다 — 잠금이 풀리면 운영 사본 갱신이 다시 올린다
    if (이유) { 운영사본에남기기(파일, { 결과: '멈춤', 이유 }); 출력({ 결과: '멈춤', 이유 }); process.exitCode = 2; return; }
    const r = 바로올리기로(메시지, 파일);
    출력(r);
    if (r.결과 === '실패') process.exitCode = 1;
    else if (r.결과 === '멈춤') process.exitCode = 2;
    return;
  }
  for (let 차례 = 1; 차례 <= 3; 차례++) {
    const 이유 = 막힘이유();
    if (이유) { 운영사본에남기기(파일, { 결과: '멈춤', 이유 }); 출력({ 결과: '멈춤', 이유 }); process.exitCode = 2; return; }
    const r = 한번(메시지);
    if (r.결과 !== '다시') {
      출력(r);
      if (r.결과 === '실패') process.exitCode = 1;
      return;
    }
  }
  운영사본에남기기(파일, { 결과: '멈춤', 이유: 'HEAD가 계속 움직였다' });
  출력({ 결과: '멈춤', 이유: 'HEAD가 계속 움직여 세 번 모두 커밋하지 못했다(카드는 작업본에 그대로)' });
  process.exitCode = 2;
}

if (require.main === module) main();

module.exports = { 상태경로 };
