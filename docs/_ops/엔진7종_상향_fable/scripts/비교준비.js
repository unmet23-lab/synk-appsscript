// 두 판(Opus · Fable)을 눈가림 비교 폴더로 자른다. 용법: node 비교준비.js <opus.md> <fable.md> <비교폴더> <재료_opus폴더> <재료_fable폴더>
// 산출: <비교폴더>/갑/§N.md · 을/§N.md · 재료_공통/ · 재료_갑/ · 재료_을/ · 기계자.json · 짝.json(어느 판이 갑인지 — 워크플로는 안 읽는다)
const fs = require('fs');
const p = require('path');
const { execSync } = require('child_process');
const [OPUS, FABLE, OUT, MAT_OPUS, MAT_FABLE] = process.argv.slice(2);
if (!OPUS || !FABLE || !OUT || !MAT_OPUS || !MAT_FABLE) { console.error('인자 다섯이 필요하다'); process.exit(1); }

const SECTIONS = Array.from({ length: 17 }, (_, i) => `§${i}`);

function split(md) {
  const lines = md.split(/\r?\n/);
  const idx = [];
  lines.forEach((l, i) => { const m = l.match(/^## §(\d+)\b/); if (m) idx.push({ n: +m[1], i }); });
  const out = {};
  for (let k = 0; k < idx.length; k++) {
    const start = k === 0 ? 0 : idx[k].i; // §0 은 머리(주석·제목·상태 줄)까지 품는다
    const end = k + 1 < idx.length ? idx[k + 1].i : lines.length;
    out[`§${idx[k].n}`] = lines.slice(start, end).join('\n');
  }
  return out;
}

function measure(md, label, path) {
  const c = (re) => (md.match(re) || []).length;
  const dTitles = c(/^### (🆕 )?D\d+/gm) + c(/^\*\*D\d+ \[/gm); // 두 판의 D 제목 꼴이 다르다(### D1 · **D1 [키]**)
  let graph = '안 재봄';
  try {
    const g = execSync('node tools/doc-graph.js 2>&1', { cwd: 'C:/Users/q1212/Documents/SYNK-appsscript', encoding: 'utf8' });
    const base = p.basename(path);
    graph = g.includes(base) ? (g.split('\n').filter((l) => l.includes(base)).length + '줄 언급(빨강/경고 후보 · 원문은 doc-graph 출력)') : '언급 0(초록)';
  } catch (e) { graph = 'doc-graph 실행 실패: ' + String(e.message).slice(0, 80); }
  return {
    판: label,
    바이트: Buffer.byteLength(md, 'utf8'),
    줄: md.split(/\r?\n/).length,
    절_헤딩: c(/^## §\d+/gm),
    상향_항목_U: c(/^#### U\d+\./gm),
    유호_판정_D: dTitles,
    안_재봤다: c(/안 재봤/g),
    영건: c(/0건/g),
    URL: c(/https?:\/\//g),
    표_행: c(/^\|/gm),
    문서그래프: graph,
  };
}

fs.mkdirSync(OUT, { recursive: true });
const opus = fs.readFileSync(OPUS, 'utf8');
const fable = fs.readFileSync(FABLE, 'utf8');
// 짝 — 시각의 나노초 홀짝으로 정한다(사람 편향 배제 · 워크플로는 이 파일을 안 읽는다)
const coin = Number(process.hrtime.bigint() % 2n);
const 짝 = coin === 0 ? { 갑: 'opus', 을: 'fable' } : { 갑: 'fable', 을: 'opus' };
const docs = { opus, fable };
const mats = { opus: MAT_OPUS, fable: MAT_FABLE };
for (const side of ['갑', '을']) {
  const which = 짝[side];
  const parts = split(docs[which]);
  fs.mkdirSync(p.join(OUT, side), { recursive: true });
  for (const s of SECTIONS) fs.writeFileSync(p.join(OUT, side, `${s}.md`), parts[s] || `(이 판에는 ${s} 절이 없다)`);
  const md = p.join(OUT, `재료_${side}`);
  fs.mkdirSync(md, { recursive: true });
  for (const f of ['수리_Loom.json', '통합.json']) fs.copyFileSync(p.join(mats[which], f), p.join(md, f));
  console.log(side, '=', Object.keys(parts).length, '절 · 재료 둘 복사');
}
// 공통 재료 = Fable 재료 폴더에서 Loom 수리·통합을 뺀 전부(두 판이 같은 것을 읽었다)
const cm = p.join(OUT, '재료_공통');
fs.mkdirSync(cm, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(MAT_FABLE)) { if (!f.endsWith('.json') || f === '수리_Loom.json' || f === '통합.json') continue; fs.copyFileSync(p.join(MAT_FABLE, f), p.join(cm, f)); n++; }
console.log('재료_공통', n, '벌');
const measured = { 갑: measure(docs[짝.갑], '갑', 짝.갑 === 'opus' ? OPUS : FABLE), 을: measure(docs[짝.을], '을', 짝.을 === 'opus' ? OPUS : FABLE) };
fs.writeFileSync(p.join(OUT, '기계자.json'), JSON.stringify(measured, null, 2));
fs.writeFileSync(p.join(OUT, '짝.json'), JSON.stringify(짝, null, 2));
console.log(JSON.stringify(measured, null, 1));
console.log('짝은 짝.json 에만(눈가림) — 비교가 끝난 뒤 연다');
