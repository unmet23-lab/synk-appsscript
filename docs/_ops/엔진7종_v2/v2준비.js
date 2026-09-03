// v2 재료 준비 — 정본(Fable 판)·Opus 판을 절로 나누고, 심사가 절마다 적은 「갑에서 가져올 것」·「틀림」·«합칠 것» 줄을 절 파일로 모은다.
const fs = require('fs');
const path = require('path');
const REPO = 'C:/Users/q1212/Documents/SYNK-appsscript';
const S = 'C:/Users/q1212/AppData/Local/Temp/claude/C--Users-q1212-Documents-SYNK-appsscript/1894d42f-9ac3-484b-8648-8efce87440ac/scratchpad';
const W = REPO + '/docs/_ops/엔진7종_v2';
const R = W + '/재료';
for (const d of [W, R, R + '/을', R + '/갑', W + '/v2']) fs.mkdirSync(d, { recursive: true });

const norm = (s) => s.split('\r\n').join('\n');
const fable = norm(fs.readFileSync(REPO + '/docs/엔진7종_상향설계_v1.md', 'utf8'));
const opus = norm(fs.readFileSync(S + '/opus_v1.md', 'utf8'));

function split(doc) {
  const lines = doc.split('\n');
  const idx = [];
  lines.forEach((l, i) => { const m = l.match(/^## §(\d+)\./); if (m) idx.push({ n: +m[1], i }); });
  const out = { 머리: lines.slice(0, idx[0].i).join('\n') + '\n' };
  idx.forEach((s, k) => { const end = k + 1 < idx.length ? idx[k + 1].i : lines.length; out['§' + s.n] = lines.slice(s.i, end).join('\n').replace(/\n+$/, '') + '\n'; });
  return out;
}
const F = split(fable), O = split(opus);
// 정본 머리에서 «합칠 것» 절은 v2 재료로 쓰되, 을/머리 에서는 뺀다(v2 머리는 새로 쓴다)
const mergeStart = F.머리.indexOf('## «합칠 것»');
const mergeText = mergeStart >= 0 ? F.머리.slice(mergeStart) : '';
const headWithoutMerge = mergeStart >= 0 ? F.머리.slice(0, mergeStart) : F.머리;
fs.writeFileSync(R + '/을/머리.md', headWithoutMerge);
fs.writeFileSync(R + '/갑/머리.md', O.머리);
fs.writeFileSync(R + '/합칠것_전문.md', mergeText);
for (let n = 0; n <= 16; n++) { fs.writeFileSync(R + '/을/§' + n + '.md', F['§' + n]); fs.writeFileSync(R + '/갑/§' + n + '.md', O['§' + n]); }

// 심사 — 절마다 갑에서 가져올 것 · 틀림(갑·을) · why
const V = JSON.parse(fs.readFileSync(REPO + '/docs/_ops/엔진7종_상향_비교_0903/심사.json', 'utf8'));
const mergeLines = mergeText.split('\n');
for (let n = 0; n <= 16; n++) {
  const sec = '§' + n;
  const rows = V.filter((r) => r.section === sec);
  let md = `# 심사가 ${sec} 에 적은 것 (눈가림 · 갑 = Opus 판 · 을 = Fable 판 = 지금 정본)\n\n`;
  const ml = mergeLines.find((l) => l.startsWith('- **' + sec + '**:'));
  md += `## «합칠 것» 절의 이 절 줄(정본 머리)\n${ml || '(없음)'}\n\n`;
  md += `## 렌즈별 판정과 까닭\n`;
  for (const r of rows) md += `- **${r.lens}** better=${r.better}: ${r.why}\n`;
  md += `\n## 합친다면 — 갑에서 가져올 것 · 을에서 가져올 것(렌즈 셋 원문)\n`;
  for (const r of rows) md += `- **${r.lens}**: ${r.best_of_each}\n`;
  md += `\n## 실물 대조에서 「틀림」으로 잡힌 것 — v2 에서 고친다(을 = 이 몸통 · 갑 = 가져올 문장에 섞이지 않게)\n`;
  for (const r of rows) for (const f of r.factual_errors) if (f.verdict === '틀림') md += `- [${f.doc} · ${r.lens}] 주장: ${f.claim}\n  → 근거: ${f.evidence}\n`;
  md += `\n## 축별 근거 요약(⑤읽힘 · ③깊이 — 무엇이 읽히고 무엇이 깊었나)\n`;
  for (const r of rows) for (const a of r.axes) if (/⑤|③/.test(a.axis)) md += `- [${r.lens} · ${a.axis}] 갑 ${a.gap} / 을 ${a.eul} — 갑: ${a.evidence_gap} | 을: ${a.evidence_eul}\n`;
  fs.writeFileSync(R + '/심사_' + sec + '.md', md);
}
// 크기 표
const sizes = [];
for (let n = 0; n <= 16; n++) sizes.push(`§${n}: 을 ${Buffer.byteLength(F['§' + n])} · 갑 ${Buffer.byteLength(O['§' + n])} · 심사 ${fs.statSync(R + '/심사_§' + n + '.md').size}`);
console.log(sizes.join('\n'));
console.log('머리 을', Buffer.byteLength(headWithoutMerge), '갑', Buffer.byteLength(O.머리), '합칠것', Buffer.byteLength(mergeText));
