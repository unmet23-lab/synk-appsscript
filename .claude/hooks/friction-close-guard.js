#!/usr/bin/env node
// friction-close-guard — 마찰 번호를 단 커밋이 들어갔는데 **그 장부 행이 아직 열려 있는** 경우를 알린다.
//
// 왜 있나 (F096 · 2026-08-05):
//   1bb186e 가 F096 을 실제로 고쳤고 세션보드에도 ✅종결로 적혔는데, 장부의 해소 칸만 비어 있었다.
//   장부는 `/evolve` 의 **연료**라, 열린 채 남은 행은 다음 세션이 **이미 끝난 일을 다시 집게** 만든다.
//
//   🔑 이 저장소가 이 축에서 미끄러진 건 두 번이고 **방향이 반대였다** —
//      F092: 안 고쳤는데 닫았다(정정을 각주로 달아 원문이 살아남음).
//      F096: 고쳤는데 안 닫았다(이 훅).
//      공통 원인은 하나다 — **장부와 저장소가 일치하는지 아무도 안 본다.** 사람이 기억으로 잇고 있었다.
//      CLAUDE.md 신뢰성: 같은 절차에서 2번째는 실수가 아니라 시스템 결함이다.
//
//   ⚠ 왜 PreToolUse 로 못 막나 — 커밋이 **들어갔는지**는 돌려봐야 안다(commit-noop-guard 와 같은 이유).
//      이 훅은 그 「결과를 보는 층」의 두 번째 입주자다.
//
// 무엇을 보나 — 성공한 커밋의 **실제 메시지**(명령 문자열이 아니라 git 이 가진 것)에서 F0NN 을 뽑아
//   장부의 해소 칸이 빈 행을 고른다.
//   ⚠ 명령 문자열에서 찾지 않는 이유: 메시지는 인용·heredoc·`-F 파일` 안에 있어서
//      shell-text 로 산문을 걷어내면 **F0NN 도 같이 사라진다**(가드가 자기 전처리에 눈머는 형태 · CLAUDE.md 가드 맹점 ④).
//
// 언제 침묵하나 — **이 커밋이 그 행을 만들었거나 고친 경우.** 신호를 「신고」하는 커밋
//   (`docs: 마찰 F0NN — …`)은 당연히 해소가 비어 있다. 그걸 벌주면 가드가 정상 작업을 벌주고
//   사람은 가드를 끈다(F049 실측). 그래서 커밋이 장부의 그 행을 건드렸으면 조용히 넘긴다.
//   세션당 같은 번호는 **한 번만** 말한다 — 한 트랙에서 고침 커밋이 여러 개면 매번 짖는 게 소음이다.
//
//   ⚠ 그 면제에 **예외 둘** — 둘 다 「고치고 신고를 한 커밋에서 했다」는 같은 사고의 다른 얼굴이다.
//      ①(F107 · 2026-08-05) 신호문이 스스로 해소를 지목한 경우 — **신호문**을 읽는다.
//      ②(F132 · 2026-08-07) 신설 커밋이 장부·보드 밖 파일도 고친 경우 — **커밋이 무엇을 고쳤는지**를 읽는다.
//         F132 는 수리를 같은 커밋에 싣고 신호문엔 해소를 안 적어 ① 로도 안 잡혔다(08-06→08-07 열린 채).
//
//      ① (F107 · 2026-08-05): 신설한 행이 **스스로 해소를 지목**하면 면제하지 않는다.
//      이 저장소의 정상 순서는 「고치고 → 신고」다. 그러면 수리 커밋에는 아직 없는 번호가 못 들어가고
//      (행이 없으니까), 번호를 다는 유일한 커밋이 신고 커밋이라 — 면제가 무조건 이기면
//      **번호를 단 커밋과 행을 안 건드린 커밋이 영원히 겹치지 않아** 가드가 원리상 한 번도 못 짖는다.
//      F107 은 신고 제목에 「해소 장치 동반: b7a2a18·fff91f0」이라 적고도 칸이 빈 채 남았다.
//      🔑 본체 처방은 이 훅이 아니라 `tools/friction.js --해소` 통로다(원인을 쓸 수 없게 만든다).
//         이 예외는 손으로 장부를 편집한 경우를 받는 **두 번째 층**이다.
//
// ⚠ 절대 차단하지 않는다 — 커밋은 이미 들어갔고, 열린 행 자체가 손상은 아니다.
//   위험한 건 **그 상태로 세션이 끝나는 것**이다. 정보만 준다.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { stripNonExecutedText } = require(path.join(__dirname, 'lib', 'shell-text.js'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('./lib/board-id.js');

let input;
try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (_) { process.exit(0); }

const tool = String(input.tool_name || '');
if (!/^(Bash|PowerShell)$/.test(tool)) process.exit(0);

const cmd = String((input.tool_input && input.tool_input.command) || '');
if (!cmd) process.exit(0);

/* 인용 안 산문을 걷어낸 뒤에 **명령 모양만** 본다 — 여기서 보는 건 「git commit 을 돌렸나」뿐이고,
 * F0NN 은 아래에서 git 한테 직접 묻는다(머리말 ⚠). */
const exec = stripNonExecutedText(cmd);
if (!/\bgit\b[^|;&\n]*?\bcommit\b/.test(exec)) process.exit(0);
if (/\bgit\b[^|;&\n]*?\bcommit\b[^|;&\n]*?(--dry-run|--porcelain)/.test(exec)) process.exit(0);

const res = input.tool_response;
const 출력 = [
  typeof res === 'string' ? res : '',
  res && typeof res === 'object' ? String(res.stdout || '') : '',
  res && typeof res === 'object' ? String(res.stderr || '') : '',
].join('\n');

/* 성공한 커밋만 본다. git 은 성공하면 `[master 2b5e7af] <제목>` 을 되뱉는다.
 * no-op 이면 이 줄이 없다 — 그건 commit-noop-guard 의 몫이라 여기선 조용히 빠진다. */
const 착지 = /^\s*\[[^\]\n]*?\b([0-9a-f]{7,40})\]/m.exec(출력);
if (!착지) process.exit(0);
const sha = 착지[1];

const cwd = String(input.cwd || process.cwd());
function git(args) {
  // 실패 안전을 외부 명령에 기대지 않는다 — git 이 없거나 죽어도 훅은 조용히 통과한다(가드 맹점 ②).
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 });
  } catch (_) { return null; }
}

const 메시지 = git(['log', '-1', '--format=%B', sha]);
if (!메시지) process.exit(0);

const 번호들 = [...new Set((메시지.match(/\bF\d{3}\b/g) || []))];
if (!번호들.length) process.exit(0);

// 장부 판정은 friction.js 하나에서 파생시킨다 — 같은 판정을 두 곳에 적으면 갈라진다(가드 맹점 ④).
let 장부;
try { 장부 = require(path.join(__dirname, '..', '..', 'tools', 'friction.js')); } catch (_) { process.exit(0); }
let rows;
try { rows = 장부.read().rows; } catch (_) { process.exit(0); }

const 행 = new Map(rows.map((r) => [r.id, r]));

/* 이 커밋이 장부의 그 행을 건드렸으면 침묵 — 신고 커밋(행 신설)과 해소 커밋(행 갱신) 둘 다 여기서 걸러진다. */
/* 경로는 **커밋이 일어난 저장소(cwd) 기준**으로 잡는다 — 훅 자신의 뿌리로 잡으면
 * 격리 픽스처에서 저장소 밖을 가리켜 git 이 거절하고, 그럼 「행을 안 건드렸다」로 읽혀
 * 신고 커밋까지 짖는다. 가드가 자기 시험 환경에서만 다르게 도는 형태를 만들지 않는다. */
const 장부경로 = path.relative(cwd, 장부.LEDGER).replace(/\\/g, '/');
/* 행은 조각 파일(장부/F0NN.md)로도 산다(F250 후반) — 조각 커밋을 못 보면 평범한 신고 커밋마다 짖는다.
 * FOLDER 가 없는 옛 판이 섞여도 훅이 죽지 않게 한다(가드는 자기 사정으로 크래시하지 않는다). */
const 조각폴더 = 장부.FOLDER ? path.relative(cwd, 장부.FOLDER).replace(/\\/g, '/') : null;
const 장부diff = git(['show', '--format=', '--unified=0', sha, '--',
  장부경로, ...(조각폴더 ? [조각폴더] : [])]) || '';
const 더한행 = new Set([...장부diff.matchAll(/^\+\|\s*(F\d+)\s*\|/gm)].map((m) => m[1]));
const 지운행 = new Set([...장부diff.matchAll(/^-\|\s*(F\d+)\s*\|/gm)].map((m) => m[1]));
const 이번에건드림 = new Set([...더한행, ...지운행]);
/* 신설 = 더하기만 있고 지우기가 없는 행. 갱신(-/+ 둘 다)과 갈라 둔다. */
const 신설행 = new Set([...더한행].filter((id) => !지운행.has(id)));

/* 신설 면제의 **두 번째 예외** (F132 · 2026-08-07) — 신설 커밋이 **장부 밖 파일도 고쳤으면**
 * 그건 「신고」가 아니라 「고치고 신고」다. 실물: 3199240 이 F132 행을 신설하면서 같은 커밋에
 * 수리(codex-review.js)와 회귀(tests/이종검수.test.js)를 실었는데, 신호문이 해소를 안 지목해
 * F107 예외에도 안 걸렸다 — 두 면제 사이로 새서 **08-06 부터 열린 채** 남았고 아무도 못 봤다.
 * 🔑 F107 예외와 축이 다르다: 저건 **신호문**을 읽고, 이건 **커밋이 실제로 무엇을 고쳤는지**를 읽는다.
 * 기록물(장부·보드·인계문)은 뺀다 — 실측 78bd7c8 은 신고하면서 보드 줄을 같이 고쳤고 그건 정상 신고다.
 * ⚠ `-z` 로 받는 이유: repo quotepath 가 켜져 있어 한글 경로가 `"docs/_ops/\353\247..."` 로 나온다.
 *   그대로 비교하면 장부·보드가 **전부 「장부 밖」으로 읽혀** 평범한 신고 커밋마다 짖는다
 *   (재는 층이 값을 깨뜨리는 형태 · CLAUDE.md 원인 판정 전제 ②). */
/* 보드 정본(docs/_ops/보드/)·장부 조각(docs/_ops/장부/)도 기록물이다 — 보드가 폴더로 갈린 F250 때
 * 여기가 안 따라와, 신고하며 자기 보드 줄을 같이 고치는 정상 커밋(78bd7c8 형)이 「수리 동반」으로 읽혔다. */
const 기록물 = (p) => p === 장부경로 || (조각폴더 && p.startsWith(조각폴더 + '/'))
  || /^docs\/(세션보드|_ops\/(인계문|보드))/.test(p);
let _수리동반;
const 수리동반 = () => {
  if (_수리동반 === undefined) {
    const 파일들 = (git(['show', '--format=', '--name-only', '-z', sha]) || '').split('\0').filter(Boolean);
    _수리동반 = 파일들.some((p) => !기록물(p));
  }
  return _수리동반;
};

// 세션당 같은 번호는 한 번만 — 한 트랙의 고침 커밋마다 짖으면 소음이 되고, 소음은 가드를 꺼지게 한다.
const STATE_DIR = process.env.SYNK_FRICTION_GUARD_DIR || path.join(os.tmpdir(), 'synk-friction-guard');
const sid = String(보드id.세션id() || 'unknown').replace(/[^\w.-]/g, '_');
const 말한적 = path.join(STATE_DIR, `said-${sid}.json`);
let 이미 = [];
try { 이미 = JSON.parse(fs.readFileSync(말한적, 'utf8')); } catch (_) { 이미 = []; }
if (!Array.isArray(이미)) 이미 = [];

/* 신고 커밋 면제의 **예외** (F107) — 신설한 행이 스스로 「해소=…」를 지목하면 면제하지 않는다.
 * 이 저장소의 정상 순서가 「고치고 → 신고」라, 그 경우 번호를 단 커밋은 신고 커밋 하나뿐이고
 * 면제가 무조건 이기면 가드는 **원리상** 한 번도 못 짖는다. 실제로 F107 이 그 자리로 샜다.
 * 판별식은 friction.js 하나에서 온다(같은 판정을 두 곳에 적으면 갈라진다 · 맹점 ④). */
const 자기해소주장 = (id) => 신설행.has(id) && !!(장부.해소주장 && 장부.해소주장(행.get(id).signal));

/* 열림·보류·해소 판정은 friction.js 하나에서 온다 — 여기서 `!r.resolved` 를 다시 적으면
 * 보류가 「열림」으로 새서, 이미 판정된 12건이 커밋마다 이 가드를 울린다(그게 F386 의 포화다).
 * 옛 통로 폴백은 둔다: 형제·구판에서 술어가 없으면 조용히 죽는 대신 예전 동작으로 돈다. */
const 살아있나 = 장부.살아있나 || ((r) => !r.resolved);
const 보류인가 = 장부.보류인가 || (() => false);

const 열린행 = 번호들
  .filter((id) => 행.has(id))
  .filter((id) => 살아있나(행.get(id)))
  .filter((id) => !이번에건드림.has(id) || 자기해소주장(id) || (신설행.has(id) && 수리동반()))
  .filter((id) => !이미.includes(id));

if (!열린행.length) process.exit(0);

try {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(말한적, JSON.stringify([...이미, ...열린행]));
} catch (_) { /* 기록 못 해도 알리는 건 한다 — 신호 유실이 소음보다 나쁘다 */ }

/* 보류(판정하고 열어둔 것)는 **다시 판정을 요구하지 않는다** — 이미 누가 판을 지났다.
 * 그래도 목록에서 빼지는 않는다: 그 행을 실제로 고친 커밋이면 여기서 닫자고 찔러야 한다
 * (F092 = 고침과 닫음은 별개 동작). 그래서 «빼기»가 아니라 «갈라 라벨»이 답이다 — 요구가
 * 두 갈래인데 문장이 하나면 읽는 쪽은 둘 다 안 한다(F386 포화의 형태). */
const 열림만 = 열린행.filter((id) => !보류인가(행.get(id)));
const 보류분 = 열린행.filter((id) => 보류인가(행.get(id)));

const 본문 =
  (열림만.length
    ? `[friction-close-guard] 이 커밋은 **${열림만.join('·')}** 를 달고 들어갔는데, 장부의 그 행은 **아직 열려 있다.**\n`
    : `[friction-close-guard] 이 커밋이 단 **${보류분.join('·')}** 는 **이미 판정된 보류**다 — 새로 판정하지 않아도 된다.\n`)
  /* 열림을 «먼저» 낸다 — 머리글이 말한 번호가 목록 첫 줄과 맞아야 읽힌다.
   * 보류를 앞에 두면 요구가 없는 줄 열 개를 지나야 요구가 있는 줄에 닿는다(그게 포화다). */
  + 열림만.map((id) => {
    if (자기해소주장(id)) {
      return `  · ${id} — **방금 신설하면서 스스로 해소를 지목했다**("${장부.해소주장(행.get(id).signal)}") — 그런데 칸은 비었다 (F107 이 샌 자리)`;
    }
    if (신설행.has(id) && 수리동반()) {
      return `  · ${id} — **방금 신설하면서 같은 커밋에 수리를 실었다**(장부·보드 밖 파일이 함께 들어갔다) — 「고치고 신고」인데 칸은 비었다 (F132 가 샌 자리)`;
    }
    return `  · ${id} — ${String(행.get(id).signal || '').slice(0, 90)}…`;
  }).join('\n')
  + (열림만.length && 보류분.length ? '\n' : '')
  + 보류분.map((id) => `  · ⏸ ${id} — 보류: ${String(행.get(id).resolved || '').replace(/^⏸\s*/, '').slice(0, 110)}…\n`
    + `       (고쳤으면 그때 닫는다: node tools/friction.js resolve ${id} "무엇이 실제로 막았나")`).join('\n')
  + '\n\n'
  + (열림만.length
    ? '왜 알리나 (F096): 실물을 고치고 보드에 ✅종결까지 적고도 **장부만 안 닫힌 채** 세션이 끝났다.\n'
      + '장부는 `/evolve` 의 연료라, 열린 행은 다음 세션이 **이미 끝난 일을 다시 집게** 만든다.\n'
      + '반대 방향도 실측됐다(F092: 안 고쳤는데 닫았다) — **고침과 닫음은 별개 동작이다.**\n\n'
      + '→ 지금 판정한다 (셋 중 하나이지 「나중에」가 아니다):\n'
      + '   1) **다 고쳤다** → 닫기 전에 F083 대로 **신고 원문 그대로 다시 넣어 본다**(격리 사본에서 변이).\n'
      + '      통과하면 `node tools/friction.js resolve ' + 열림만[0] + ' "무엇이 실제로 막았나"`.\n'
      + '      ⚠ 문구 하나 고친 것과 그 사실이 사라진 것은 다르다 — 닫기 전 저장소 전체를 grep 한다(F092).\n'
      + '   2) **안 고쳤지만 지금은 안 닫기로 판정했다** → 그 «판정»을 장부에 적는다(F386 — 적을 자리가\n'
      + '      없어서 같은 대조를 세션마다 다시 하던 자리다):\n'
      + '      `node tools/friction.js defer ' + 열림만[0] + ' "왜 지금 안 닫나 · 어디서 판정했나"`\n'
      + '   3) **아직 판정 못 한다** → 보드 줄 상태에 남은 것을 적어라. 장부가 열려 있는 건 정상이다.\n\n'
    : '왜 알리나: 보류는 **결함이 서 있는 채로 판정만 끝난 상태**다 — 고쳤으면 그때 닫아야 하고,\n'
      + '안 고쳤으면 그냥 지나가면 된다. 다시 판정하지 않는다(그 재판정이 F386 이 신고한 낭비다).\n\n')
  + '(같은 번호는 이 세션에서 다시 말하지 않는다 — 판정은 지금 한다.)';

process.stdout.write(JSON.stringify({
  systemMessage: 열림만.length
    ? `⚠ 장부 미종결 ${열림만.length}건 — ${열림만.join('·')} 를 단 커밋인데 해소 칸이 비었다`
    : `⏸ 장부 보류 ${보류분.length}건 — ${보류분.join('·')} 는 이미 판정됐다(재판정 불필요)`,
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 본문 },
}));
process.exit(0);
