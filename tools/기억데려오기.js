#!/usr/bin/env node
/**
 * 기억데려오기 — 세션이 켜질 때 기억이 제자리에 없으면 GitHub 에서 끌어온다.
 *
 * 🔴 왜 필요한가(08-26 실측 · 유호 지시 「노트북 없이도 지금 이대로의 너와 대화하고 싶다」)
 *   기억이 놓이는 폴더 «이름»은 작업 폴더의 «경로»에서 만들어진다:
 *     C:/Users/q1212/Documents/SYNK-appsscript
 *       -> ~/.claude/projects/C--Users-q1212-Documents-SYNK-appsscript/memory/
 *   그래서 기계가 바뀌거나 브라우저 세션(claude.ai/code)에서 열면 «이름이 달라지고»,
 *   GitHub(unmet23-lab/synk-memory)에 기억 296벌이 멀쩡히 있어도 빈 폴더를 보고 백지에서 시작한다.
 *   즉 막힌 곳은 «저장»이 아니라 «데려오기»였다 — 잃은 것은 0인데 못 찾는 것이다.
 *
 * ⚠ 이 파일의 «정규식»에는 역슬래시를 쓰지 않는다 — 첫 판이 그것 때문에 죽었다.
 *   heredoc 으로 써 넣을 때 정규식의 역슬래시 문자 클래스가 «조용히 사라져»
 *   `[역슬래시/:.]` 가 `[/:.]` 가 됐다. 그러면 경로의 역슬래시가 안 바뀌고 path.join 이
 *   그것을 구분자로 먹어, 기억이 `projects/C-/Users/q1212/...` 라는 «폴더 트리»로 클론됐다.
 *   구문검사(node --check)는 통과했다 — 정규식이 여전히 유효했기 때문이다.
 *   👉 그래서 규칙을 «남길 문자»로 뒤집었다: 영문·숫자·하이픈만 남기고 나머지는 전부 하이픈.
 *      역슬래시를 쓸 일이 없어지므로 같은 사고가 원리상 안 난다. 회귀 = tests/기억데려오기.test.js
 *
 * 🔑 규율 셋
 *   ① 이미 있으면 아무것도 안 한다. 있는 기억을 덮지 않는다(미커밋 기억을 날리는 통로가 된다).
 *      지금 노트북에서는 매 세션 «폴더 하나 확인»으로 끝난다 — 실측 0.055초.
 *   ② 실패해도 세션을 막지 않는다. 훅에서 도는 것이라 종료코드는 «항상» 0 이다.
 *   ③ 데려온 그 세션부터 바로 붙게, MEMORY.md 색인을 훅 출력으로 뿜는다.
 *      (Claude Code 의 기억 주입은 세션 시작에 «이미» 끝났을 수 있다 — ⚠새 기계가 없어
 *       그 시점 관계는 안 재봤다. 그래서 이번 세션 몫은 이 출력이 책임진다.)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const 원격 = 'https://github.com/unmet23-lab/synk-memory.git';

/** 작업 폴더 경로 -> Claude Code 가 쓰는 프로젝트 폴더 이름.
 *  영문·숫자·하이픈만 남기고 나머지(콜론·구분자·점)는 전부 하이픈으로 바꾼다.
 *  실측 대조(08-26): `C:/Users/q1212/Documents/SYNK-appsscript`
 *                 -> `C--Users-q1212-Documents-SYNK-appsscript` (실물과 일치) */
function 폴더이름(p) {
  return path.resolve(p).replace(/[^A-Za-z0-9-]/g, '-');
}

function 기억자리() {
  const proj = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.join(os.homedir(), '.claude', 'projects', 폴더이름(proj), 'memory');
}

function 이미있나(dir) {
  try { return fs.existsSync(path.join(dir, 'MEMORY.md')); } catch { return false; }
}

function main() {
  const 훅 = process.argv.includes('--훅');
  const 자리 = 기억자리();

  if (이미있나(자리)) {
    if (!훅) console.log(`기억은 이미 제자리에 있다 — ${자리}`);
    return;                                    // 규율① — 덮지 않는다
  }

  try {
    fs.mkdirSync(path.dirname(자리), { recursive: true });
    execFileSync('git', ['clone', '--quiet', 원격, 자리], {
      stdio: ['ignore', 'ignore', 'pipe'], timeout: 90_000,
    });
  } catch (e) {
    const 사유 = String(e.stderr || e.message || e).trim().split('\n').pop();
    console.log(
      '🧠 기억을 데려오지 못했다 — 이 세션은 «백지»다(기억이 없는 게 아니라 못 찾은 것이다).\n' +
      `   자리 : ${자리}\n` +
      `   사유 : ${사유}\n` +
      '   👉 private 저장소다. `gh auth login` 한 번이면 다음 세션부터 스스로 온다.'
    );
    return;                                    // 규율② — 막지 않는다
  }

  const 색인 = path.join(자리, 'MEMORY.md');
  let 본문 = '';
  try { 본문 = fs.readFileSync(색인, 'utf8'); } catch { /* 아래에서 벌수만 낸다 */ }

  let 벌수 = 0;
  try { 벌수 = fs.readdirSync(자리).filter(f => f.endsWith('.md')).length; } catch { /* 무시 */ }

  console.log(`🧠 기억 ${벌수}벌을 GitHub 에서 데려왔다 — 이 기계는 처음이었다.`);
  if (본문) {
    console.log('   아래는 색인이다. 상세는 토픽 파일이 쥔다.\n');
    console.log(본문);
  }
}

/* 시험이 require 해도 «클론이 일어나면 안 된다» — 그래서 실행은 이 가드 안에서만 한다. */
if (require.main === module) {
  try { main(); } catch (e) {
    console.log(`🧠 기억데려오기가 스스로 넘어졌다 — 세션은 계속된다. (${String(e.message || e)})`);
  }
  process.exitCode = 0;                        // 규율② — 항상 0
}

module.exports = { 폴더이름, 기억자리 };        // 회귀시험이 부르는 자리
