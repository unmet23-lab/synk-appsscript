// 공개본 account/dist/platform.js에 회원 혜택 변경만 얹는다(GPT 릴리스가 앞 회원 성향 묶음만 갈아 끼운 것과 같은 방식).
// 1) 바깥 플랫폼 코드의 member-benefits 모듈 부분: 공개본과 같은 이름 충돌 환경에서 옛 판(OLD_REV)을 컴파일해 공개본과 바이트가
//    같은지 확인한 뒤, 같은 환경에서 새 판(NEW_REV)을 컴파일해 그 자리를 바꾼다.
// 2) 바깥 MEMBER_BENEFITS 자료: 공개본에 있는 혜택(다섯)의 asset·alt만 새 판 benefits.mjs 값으로 바꾼다(혜택은 빼지 않고, 환경 변수
//    ADD_BENEFITS에 적은 것만 새 판 그대로 더한다 — 10-18 구독 카드 후보에 썼고, 실제 공개는 GPT 0.4.24가 먼저 넣어 patch-live-subscriptions.cjs로 했다).
// 3) 앞 회원 성향 묶음의 renderMemberInsight: 같은 방식으로 옛 판 일치를 확인한 뒤 새 판(poster 받는 판)으로 바꾼다.
// 사용: node patch-live.cjs <공개본 platform.js> <출력 platform.js> <보고 json>
// 2026-10-18 synk-policy 6aa13b8에 쓴 판. 옛 판이 공개본과 바이트로 같지 않으면 아무것도 쓰지 않고 멈춘다 — 그때는 공개본 쪽 이름
// 바뀜(예: id → id2)을 차이에서 찾아 충돌 목록에 더한다(INSIGHT_COLLIDE 환경 변수, 바깥 쪽은 아래 collide).
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../../..');
const esbuild = require(repo + '/experiences/synk-account/node_modules/esbuild');
const OLD_REV = process.env.OLD_REV || 'bbe66e0d5', NEW_REV = process.env.NEW_REV || '2601f01a2', GLOBAL = 'SYNK_MEMBER_INSIGHT_20261014';
// 회원 성향 묶음 안에서 esbuild가 member-insight-view 모듈의 이름을 바꾼 것(10-18 공개본 대조로 찾음)
const INSIGHT_COLLIDE = (process.env.INSIGHT_COLLIDE || 'count,text,facet,id').split(',').filter(Boolean);
const [livePath, outPath, reportPath] = process.argv.slice(2);
const show = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: repo, maxBuffer: 1 << 27 }).toString('utf8');
const live = fs.readFileSync(livePath, 'utf8');
const END = `return __toCommonJS(member_statement_entry_exports);})();`;
if (!live.startsWith('(()=>{')) throw Error('unexpected live head');
const cut = live.indexOf(END) + END.length; if (cut < END.length) throw Error('insight IIFE end not found');
let insight = live.slice(0, cut), platform = live.slice(cut);
const report = { liveBytes: Buffer.byteLength(live), steps: [] };

// 공개본 플랫폼 코드에 선언된 이름들(충돌 환경) — 겹쳐 선언해도 해가 없도록 넓게 모은다.
const declared = src => new Set([...src.matchAll(/(?:^|[^\w$.])(?:var|let|const|function|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));
async function compileModule({ rev, file, collide, stubs }) {
  const src = show(rev, file);
  const result = await esbuild.build({
    stdin: { contents: `import * as C from "collide";import * as M from ${JSON.stringify('./' + path.basename(file))};globalThis.__keep=[C,M];`, resolveDir: path.join(repo, path.dirname(file)), loader: 'js' },
    bundle: true, write: false, format: 'iife', target: ['es2022'], charset: 'utf8', minifyWhitespace: true,
    plugins: [{ name: 'stubs', setup(b) {
      b.onResolve({ filter: /^collide$/ }, () => ({ path: 'collide', namespace: 'stub' }));
      b.onLoad({ filter: /^collide$/, namespace: 'stub' }, () => ({ contents: [...collide].map(n => `export var ${n}=1;`).join(''), loader: 'js' }));
      b.onResolve({ filter: /.*/ }, a => (a.importer && a.importer !== '<stdin>' && stubs[path.basename(a.path)] !== undefined) ? { path: path.basename(a.path), namespace: 'stub' } : (a.path === './' + path.basename(file) ? { path: path.join(repo, file), namespace: 'file' } : undefined));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: stubs[a.path], loader: 'js' }));
      b.onLoad({ filter: /.*/, namespace: 'file' }, () => ({ contents: src, loader: 'js', resolveDir: path.join(repo, path.dirname(file)) }));
    } }],
  });
  return result.outputFiles[0].text;
}
const between = (text, start, end) => { const i = text.indexOf(start); if (i < 0) throw Error('start not found: ' + start.slice(0, 40)); const j = text.indexOf(end, i); if (j < 0) throw Error('end not found: ' + end.slice(0, 40)); return text.slice(i, j); };

(async () => {
// 1) member-benefits 모듈
{
  const file = 'experiences/synk-account/src/member-benefits.mjs';
  const stubs = { 'benefits.mjs': 'export var MEMBER_BENEFITS=[];export function memberBenefit(){}', 'member-insight-view.mjs': 'export function renderMemberInsight(){}' };
  const own = declared(show(OLD_REV, file)), newOwn = declared(show(NEW_REV, file));
  // 공개본에서 esbuild가 실제로 바꾼 이름은 id·query·library·publicEntry 넷(옛 판 대조로 확인). 새 판에 새로 생긴 최상위 이름은 공개본 어디에도 선언이 없는지 따로 본다.
  const collide = ['id', 'query', 'library', 'publicEntry', 'state'];
  const region = text => between(text, 'var esc=value=>', 'globalThis.__keep').replace(/\s+$/, '');
  const fix = text => text.replaceAll('renderMemberInsight(', GLOBAL + '.renderMemberInsight(');
  // esbuild는 모듈 끝(benefitDetail 다음)에 다른 것을 두지 않는다 — 공개본에서 같은 시작점부터 옛 판 길이만큼이 정확히 같아야 한다.
  const oldText = fix(region(await compileModule({ rev: OLD_REV, file, collide, stubs })));
  const at = platform.indexOf(oldText.slice(0, 60));
  const same = at >= 0 && platform.slice(at, at + oldText.length) === oldText;
  report.steps.push({ step: 'member-benefits old compile equals live', same, at, length: oldText.length, newOwnNamesCollide: [...newOwn].filter(n => !own.has(n) && declared(platform).has(n)) });
  if (!same) { fs.writeFileSync(reportPath + '.old.txt', oldText); throw Error('old member-benefits does not match live byte for byte'); }
  const newText = fix(region(await compileModule({ rev: NEW_REV, file, collide, stubs })));
  platform = platform.slice(0, at) + newText + platform.slice(at + oldText.length);
  report.steps.push({ step: 'member-benefits replaced', oldLength: oldText.length, newLength: newText.length });
}
// 2) MEMBER_BENEFITS 자료: 공개본에 있는 혜택의 asset·alt만 새 판 값으로(혜택 수·순서·다른 글은 그대로)
{
  const tmp = path.join(path.dirname(outPath), 'benefits-new.mjs');
  fs.writeFileSync(tmp, show(NEW_REV, 'desktop/renderer/benefits.mjs'));
  const { MEMBER_BENEFITS } = await import(require('node:url').pathToFileURL(path.resolve(tmp)).href + '?v=' + Date.now());
  const changed = [];
  for (const item of MEMBER_BENEFITS) {
    const head = `{"id":${JSON.stringify(item.id)},`;
    const at = platform.indexOf(head);
    if (at < 0) {
      // ADD_BENEFITS에 적은 혜택만 새로 더한다(새 판 순서에서 바로 앞 혜택의 객체 뒤에, JSON 그대로). 나머지는 공개본에 없으면 건너뛴다.
      if (!(process.env.ADD_BENEFITS || '').split(',').includes(item.id)) { changed.push({ id: item.id, skipped: 'not in live' }); continue; }
      const prev = MEMBER_BENEFITS[MEMBER_BENEFITS.indexOf(item) - 1], prevAt = prev ? platform.indexOf(`{"id":${JSON.stringify(prev.id)},`) : -1;
      if (prevAt < 0) throw Error('no anchor before ' + item.id);
      let depth = 0, end = -1, inStr = false; // 앞 혜택 객체의 끝(짝 맞는 })을 문자열을 건너뛰며 찾는다
      for (let k = prevAt; k < platform.length; k++) { const ch = platform[k];
        if (inStr) { if (ch === '\\') k++; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { end = k + 1; break; } } }
      if (end < 0 || platform[end] !== ',') throw Error('anchor object end not found for ' + item.id);
      platform = platform.slice(0, end) + ',' + JSON.stringify(item) + platform.slice(end);
      changed.push({ id: item.id, added: true, after: prev.id });
      continue;
    }
    const m = /"asset":("(?:[^"\\]|\\.)*"),"alt":("(?:[^"\\]|\\.)*")/.exec(platform.slice(at, at + 4000));
    if (!m) throw Error('asset/alt not found for ' + item.id);
    const from = m[0], to = `"asset":${JSON.stringify(item.asset)},"alt":${JSON.stringify(item.alt)}`;
    const start = at + m.index; if (platform.slice(start, start + from.length) !== from) throw Error('offset');
    platform = platform.slice(0, start) + to + platform.slice(start + from.length);
    changed.push({ id: item.id, from: JSON.parse(m[1]), to: item.asset });
  }
  report.steps.push({ step: 'benefit data asset/alt', changed });
}
// 3) 회원 성향 묶음의 member-insight-view 모듈(renderMemberInsight가 poster를 받게)
{
  const file = 'desktop/renderer/member-insight-view.mjs';
  const region = text => { const i = text.indexOf('var escape=value=>String(value??'); const j = text.indexOf('globalThis.__keep'); if (i < 0 || j < 0) throw Error('module region'); return text.slice(i, j).replace(/\s+$/, ''); };
  const oldText = region(await compileModule({ rev: OLD_REV, file, collide: INSIGHT_COLLIDE, stubs: {} }));
  const at = insight.indexOf(oldText.slice(0, 80));
  const same = at >= 0 && insight.slice(at, at + oldText.length) === oldText;
  report.steps.push({ step: 'member-insight-view old compile equals live', same, at, length: oldText.length });
  if (!same) { fs.writeFileSync(reportPath + '.insight-old.txt', oldText); throw Error('old member-insight-view does not match live byte for byte'); }
  const newText = region(await compileModule({ rev: NEW_REV, file, collide: INSIGHT_COLLIDE, stubs: {} }));
  insight = insight.slice(0, at) + newText + insight.slice(at + oldText.length);
  report.steps.push({ step: 'member-insight-view replaced', oldLength: oldText.length, newLength: newText.length });
}
fs.writeFileSync(outPath, insight + platform);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
})().catch(e => { console.error(e.stack || e); process.exit(1); });
