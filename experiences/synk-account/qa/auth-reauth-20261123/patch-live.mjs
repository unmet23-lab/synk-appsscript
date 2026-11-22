#!/usr/bin/env node
// SYNK ID 「로그인과 보안」 비밀번호 변경의 확인 번호 단계(2026-11-23, 유호님 「Alerts + re-auth」) 공개 후보를 짓는다.
// 방법은 reauth-20261121/patch-live.mjs와 같다. 공개본 id/dist/app.js는 master 빌드와 구성이 달라 통째로 덮지 않고,
// 앞 판 master 빌드와 새 빌드의 바뀐 조각만 공개본에서 딱 한 번 맞는 자리에 얹는다.
// id/index.html에는 확인 번호 줄 하나, id/id.css에는 그 줄의 규칙 둘을 정해진 자리 뒤에 넣는다.
//   node patch-live.mjs <공개본 폴더> <앞 판 빌드(HEAD dist/app.js)> <새 빌드> <후보 폴더>
//   공개본 폴더에는 id__dist__app.js · id__index.html · id__id.css가 있다. 후보 폴더에 id/dist/app.js · id/index.html · id/id.css를 쓴다.
// 단언: ① 모든 조각이 공개본에서 정확히 한 번 맞는다 ② 되돌리면 공개본 바이트가 그대로 돌아온다 ③ 후보가 문법상 읽힌다
//       ④ 새 판 표식(「메일로 받은 확인 번호를 넣어 주세요.」)이 후보에 한 번 있다 ⑤ html · css 넣을 자리가 한 번씩 맞는다.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const [liveDir, oldPath, newPath, outDir] = process.argv.slice(2);
if (!outDir) { console.error('쓰기: node patch-live.mjs <공개본 폴더> <앞 판 빌드> <새 빌드> <후보 폴더>'); process.exit(2); }
const live = readFileSync(join(liveDir, 'id__dist__app.js'), 'utf8'), before = readFileSync(oldPath, 'utf8'), after = readFileSync(newPath, 'utf8');
const put = (name, text) => { const p = join(outDir, name);mkdirSync(dirname(p), { recursive: true });writeFileSync(p, text); };

// 문장 조각: ; { } 와 줄바꿈 뒤에서 자른다(빌드는 minifyWhitespace라 한 줄이 길다).
const chunks = text => text.split(/(?<=[;{}\n])/);
const A = chunks(before), B = chunks(after);
const dir = mkdtempSync(join(tmpdir(), 'pwcode-live-'));
let patch = '';
try {
  const enc = list => list.map(chunk => JSON.stringify(chunk)).join('\n') + '\n';
  writeFileSync(join(dir, 'a'), enc(A)); writeFileSync(join(dir, 'b'), enc(B));
  try { execFileSync('git', ['diff', '--no-index', '-U0', '--no-color', 'a', 'b'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 }); }
  catch (error) { patch = error.stdout; }
} finally { rmSync(dir, { recursive: true, force: true }); }
const rawHunks = [...patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(m => {
  const oldStart = +m[1], oldCount = m[2] === undefined ? 1 : +m[2], newStart = +m[3], newCount = m[4] === undefined ? 1 : +m[4];
  // 개수 0이면 그 줄 「뒤」에 넣는다(git 꼴): 시작 번호가 앞 줄을 가리킨다.
  return { o: oldCount ? oldStart - 1 : oldStart, oldCount, n: newCount ? newStart - 1 : newStart, newCount };
});
assert.ok(rawHunks.length > 0, '바뀐 조각이 없다');
// 가까운 조각은 하나로 묶는다. 앞 조각을 얹은 뒤에는 뒤 조각의 문맥이 바뀌어 맞출 수 없다(사이 조각은 앞뒤 판이 같다)
const GAP = 16, hunks = [];
for (const h of rawHunks) {
  const last = hunks.at(-1);
  if (last && h.o - (last.o + last.oldCount) <= GAP) {
    last.oldCount = h.o + h.oldCount - last.o;
    last.newCount = h.n + h.newCount - last.n;
  } else hunks.push({ ...h });
}
for (const h of hunks) assert.equal(A.slice(h.o, h.o + h.oldCount).join('') === B.slice(h.n, h.n + h.newCount).join(''), false, '묶은 조각이 앞뒤 판에서 같다');

// 조각마다 앞뒤 문맥 조각을 붙여 공개본에서 한 번만 맞는 글을 찾는다. 맞지 않으면 문맥을 늘린다(최대 8조각).
const count = (text, needle) => { let n = 0, i = -1; while ((i = text.indexOf(needle, i + 1)) >= 0) n++; return n; };
let candidate = live;
const applied = [];
for (const h of hunks) {
  let done = false;
  for (let ctx = 1; ctx <= 8 && !done; ctx++) {
    const pre = A.slice(Math.max(0, h.o - ctx), h.o).join(''), post = A.slice(h.o + h.oldCount, h.o + h.oldCount + ctx).join('');
    const oldText = pre + A.slice(h.o, h.o + h.oldCount).join('') + post;
    const newText = pre + B.slice(h.n, h.n + h.newCount).join('') + post;
    // 바꾼 뒤의 글도 후보에서 한 번만 보여야 한다(같은 글이 두 곳에 생기면 되돌리기 검사가 어느 쪽인지 모른다).
    if (count(candidate, oldText) !== 1) continue;
    const next = candidate.replace(oldText, () => newText);
    if (count(next, newText) === 1) { candidate = next; applied.push({ oldText, newText, ctx }); done = true; }
  }
  assert.ok(done, `조각 하나를 공개본에서 한 번만 맞추지 못했다: ${JSON.stringify(A.slice(h.o, h.o + h.oldCount).join('')).slice(0, 200)}`);
}

// ② 되돌리기: 뒤에서부터 새 글을 옛 글로 되돌리면 공개본 바이트가 그대로여야 한다
let reverted = candidate;
for (const a of [...applied].reverse()) { assert.equal(count(reverted, a.newText), 1, '되돌릴 조각이 후보에서 한 번만 맞지 않는다'); reverted = reverted.replace(a.newText, () => a.oldText); }
assert.equal(reverted, live, '되돌린 후보가 공개본과 다르다');
// ③ 문법
new Function(candidate);
// ④ 표식
assert.equal(count(candidate, '메일로 받은 확인 번호를 넣어 주세요.'), 1, '새 판 글이 후보에 한 번 있어야 한다');
assert.equal(count(live, '메일로 받은 확인 번호'), 0, '공개본에 이미 새 판 글이 있다');
put('id/dist/app.js', candidate);

// ⑤ id/index.html · id/id.css: 정해진 자리 뒤에 한 번만 넣는다. 줄끝은 공개본 것을 따른다.
const NL = String.fromCharCode(10), CRLF = String.fromCharCode(13, 10);
const insertAfter = (text, anchor, addition, label) => {
  assert.equal(count(text, anchor), 1, `${label}: 넣을 자리가 한 번 맞지 않는다`);assert.equal(count(text, addition.trim()), 0, `${label}: 이미 들어 있다`);
  const nl = text.includes(CRLF) ? CRLF : NL, at = text.indexOf(anchor) + anchor.length;
  return text.slice(0, at) + addition.split(NL).join(nl) + text.slice(at);
};
const html = readFileSync(join(liveDir, 'id__index.html'), 'utf8');
const confirmLabel = '<label>새 비밀번호 확인<input id="new-password-confirm" type="password" autocomplete="new-password" minlength="8" required></label>';
const at = html.indexOf(confirmLabel), indent = html.slice(html.lastIndexOf(NL, at) + 1, at);
assert.match(indent, /^[ \t]*$/, 'index.html: 새 비밀번호 확인 줄의 들여쓰기를 못 읽었다');
const row = '<div id="password-code-row" class="security-code" hidden><label>메일로 받은 확인 번호<input id="password-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" spellcheck="false"></label><button id="password-code-resend" class="link-button" type="button">번호 다시 받기</button></div>';
put('id/index.html', insertAfter(html, confirmLabel, NL + indent + row, 'index.html'));
const css = readFileSync(join(liveDir, 'id__id.css'), 'utf8');
put('id/id.css', insertAfter(css, '.sid .security-form>.sb-btn{justify-self:start}', [NL + '.sid .security-code{display:flex;flex-wrap:wrap;align-items:flex-end;gap:4px 16px}', '.sid .security-code label{flex:1 1 220px;min-width:0}'].join(NL), 'id.css'));
console.log(JSON.stringify({ hunks: hunks.length, applied: applied.map(a => ({ ctx: a.ctx, old: a.oldText.length, new: a.newText.length })), liveBytes: Buffer.byteLength(live), candidateBytes: Buffer.byteLength(candidate) }));
