'use strict';
// app-shell.mjs 셋째 후보 = 검수한 앞 후보(옛 라이브 f2aae0a26 + 새 길 조각) 위에 그 뒤 라이브에 들어온 변경(드라마 말하기 초대장 ad9723d)을
// 3방향으로 얹고, 원천의 주석 이름 지우기(e8155e947 — 「4-5 Opus 대체」 두 줄)를 같은 규칙으로 건다(본 검수 Fable F1 · F2).
// 내 판에서 앞면 커밋을 되돌리는 길은 드라마 초대장 커밋(f1723628b6)이 앞면 줄과 얽혀 겹침 4가 난다 — 이 길은 그 얽힘을 타지 않는다.
//   node rebase-shell.cjs            → 겹침 블록을 찍는다(쓰지 않음)
//   node rebase-shell.cjs --쓰기     → <새 export>/.tmp/cand-step1-resolved/app-shell.mjs (겹침이 남으면 쓰지 않는다)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const OLD = 'D:/SYNK-worktrees/world-export-atlas-20261120/.tmp/cand-step1';
const NEW = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/cand-step1';
const lf = s => s.replace(/\r\n/g, '\n');
const oldCand = lf(fs.readFileSync(path.join(OLD, 'new/world/app-shell.mjs'), 'utf8'));
const oldLive = lf(fs.readFileSync(path.join(OLD, 'pubbase/world/app-shell.mjs'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(NEW, 'report.json'), 'utf8'));
const cache = 'D:/SYNK-worktrees/world-export-atlas-20261120b/.tmp/world-public-atlas-20261120/live-blobs';
// 새 라이브 바이트: cand.cjs가 받아 둔 blob(report.files의 liveBytes와 같은 크기)
const tree = JSON.parse(require('node:child_process').execFileSync('gh', ['api', 'repos/unmet23-lab/synk-policy/git/trees/main?recursive=1'], { maxBuffer: 1 << 28, env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).toString('utf8'));
const liveSha = tree.tree.find(t => t.path === 'world/app-shell.mjs').sha;
const newLive = lf(fs.readFileSync(path.join(cache, liveSha), 'utf8'));
const want = report.files.find(f => f.p === 'app-shell.mjs').liveBytes;
if (Buffer.byteLength(fs.readFileSync(path.join(cache, liveSha))) !== want) throw Error('라이브 app-shell이 cand.cjs가 본 것과 다르다 — cand.cjs부터 다시');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));
const c = path.join(tmp, 'c'), b = path.join(tmp, 'b'), o = path.join(tmp, 'o');
fs.writeFileSync(c, newLive); fs.writeFileSync(b, oldLive); fs.writeFileSync(o, oldCand);
const r = spawnSync('git', ['merge-file', '-p', '-L', '새 라이브', '-L', '옛 라이브', '-L', '앞 후보', c, b, o], { encoding: 'utf8', maxBuffer: 1 << 28 });
let text = r.stdout;
console.log('겹침', r.status);
const re = /^<{7} [^\n]*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7} [^\n]*\n/gm;
let m, i = 0;
while ((m = re.exec(text))) {
  i++;
  const line = text.slice(0, m.index).split('\n').length;
  console.log(`-- #${i} ${line}행 [새 라이브]\n${m[1].split('\n').map(l => '   ' + l.slice(0, 260)).join('\n')}\n   [앞 후보]\n${m[2].split('\n').map(l => '   ' + l.slice(0, 260)).join('\n')}`);
}
// 겹침 셋 = 드라마 초대장이 라이브에 더한 줄과 새 길 조각이 맞닿은 곳(Fable F1이 짚은 셋). 둘 다 남기고 차례는 master(e8155e947)와 같게 한다.
// 라이브 쪽이 「옛 라이브 + 초대장 줄」과 꼭 같은지 먼저 본다 — 아니면 멈춘다.
const blocks = [];
text.replace(re, (all, live, cand) => { blocks.push({ all, live, cand }); return all; });
if (blocks.length !== 3) throw Error(`겹침 ${blocks.length}개 — 셋을 기대했다`);
const must = (s, frag, label) => { if (!s.includes(frag)) throw Error(`${label}: 없는 조각 ${frag.slice(0, 70)}`); return s; };
const fixes = [
  // ① world-lang import: 라이브의 setLang(초대장 언어) + 새 길의 hasString · situationName · meText(둘째로 먼저 올라간 world-lang에 있다).
  ({ live, cand }) => {
    if (live !== "import {t,tMessage,currentLang,setLang} from './brand-opening/world-lang.mjs';\n") throw Error('① 라이브 줄');
    if (cand !== "import {t,tMessage,currentLang,hasString,situationName,meText} from './brand-opening/world-lang.mjs';\n") throw Error('① 후보 줄');
    must(oldLive, "import {t,tMessage,currentLang} from './brand-opening/world-lang.mjs';\n", '①');
    return "import {t,tMessage,currentLang,setLang,hasString,situationName,meText} from './brand-opening/world-lang.mjs';\n";
  },
  // ② launchGame 머리: 라이브의 초대장 로그인 줄 다음에 새 길의 게임 문 치우기(closeDoor).
  ({ live, cand }) => {
    if (live !== " if(id==='drama'&&dramaInvite.language&&operating&&!client.snapshot)return signInForDramaInvite();\n") throw Error('② 라이브 줄');
    must(cand, ' const closeDoor=door=>', '②');
    if (cand.split('\n').length !== 3) throw Error('② 후보 줄 수');
    return live + cand;
  },
  // ③ 로그아웃: 새 길 조각(로그아웃 표지 · clearMonthAnswer) 그대로, 맨 앞에 라이브의 초대장 끝내기 한 마디.
  ({ live, cand }) => {
    const head = ' logout:async()=>{', insert = 'if(dramaInvite.language)finishDramaInvite();';
    const oldLine = oldLive.split('\n').find(l => l.startsWith(head));
    if (live !== oldLine.replace(head, head + insert) + '\n') throw Error('③ 라이브 줄이 옛 라이브 + 초대장 한 마디가 아니다');
    must(cand, head + 'accountActionPending=true;', '③');
    return cand.replace(head, head + insert);
  },
];
blocks.forEach((block, n) => { text = text.replace(block.all, () => fixes[n](block)); });
if (/^(<{7}|={7}|>{7})/m.test(text)) throw Error('표식이 남았다');
// 원천의 주석 이름 지우기(e8155e947)와 같은 규칙
const scrubbed = (text.match(/4-5 Opus 대체/g) || []).length;
if (scrubbed !== 2) throw Error(`「4-5 Opus 대체」 ${scrubbed}곳 — 둘을 기대했다`);
text = text.replace(/4-5 Opus 대체/g, '4-5 대체');
// 셋째 검수 카본 C3(1ebc932569와 같은 규칙): 주석의 검수 모델 이름 「카본 」을 지운다 — 앞 후보의 여섯 자리 모두 주석 안이다.
const karbon = (text.match(/카본 /g) || []).length;
if (karbon !== 6 || (text.match(/카본/g) || []).length !== 6) throw Error(`「카본」 ${karbon}곳 — 여섯을 기대했다`);
text = text.replace(/카본 /g, '');
console.log('푼 판: 겹침 3 풂 · 주석 이름 2 + 6곳 지움 · 바이트', Buffer.byteLength(text));
if (process.argv.includes('--쓰기')) {
  const out = path.join(NEW, '..', 'cand-step1-resolved', 'app-shell.mjs');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log('씀', out);
}
module.exports = { text, status: r.status };
