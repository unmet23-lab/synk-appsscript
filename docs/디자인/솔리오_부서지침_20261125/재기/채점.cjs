'use strict';
// 맹검 채점 꾸러미를 만들고(준비), 채점 답을 풀어 두 팔을 견준다(집계).
//   node 채점.cjs 준비 <결과 폴더>   → <결과 폴더>/채점/<과제>-<회>.md 와 열쇠(채점/열쇠.json, 채점자에게 주지 않는다)
//   node 채점.cjs 카본 <결과 폴더>   → 꾸러미를 하나씩 카본(Gemini 구독)에 보내 채점/채점결과-카본.json을 쓴다(직원과 다른 회사 모델)
//   node 채점.cjs 집계 <결과 폴더> [채점 파일 이름]   → 채점/채점결과-카본.json을 열쇠로 풀어 표를 찍고 채점/집계.json을 쓴다
// 열쇠는 채점자가 못 보게 <결과 폴더>/열쇠.json에 둔다(채점 폴더 밖).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const 과제들 = require('./과제.cjs');
const [, , 할일, dir, 파일] = process.argv;
const out = path.resolve(dir || 'out'), box = path.join(out, '채점');
const read = (p, max = Infinity) => { try { const s = fs.readFileSync(p, 'utf8'); return s.length > max ? s.slice(0, max) + `\n…(${s.length - max}자 줄임)` : s; } catch { return ''; } };
const ARMS = ['plain', 'pack'];
// 맹검을 깨는 자국을 지운다: diff 머리의 결과 폴더 경로(…/T1/plain-1/files/)와 답에 찍힌 임시 폴더 이름(solio-dev-T1-pack-…)
const scrub = s => s
  .replace(/[^\s"']*?[\\/]+T\d[\\/]+seed[\\/]+/g, '처음/')
  .replace(/[^\s"']*?[\\/]+T\d[\\/]+(?:plain|pack)-\d+[\\/]+files[\\/]+/g, '끝/')
  .replace(/[A-Za-z]:[\\/][^\s`'")\]]*?solio-dev-T\d-(?:plain|pack)-[A-Za-z0-9]+/g, '(작업 폴더)')
  .replace(/solio-dev-T\d-(?:plain|pack)-[A-Za-z0-9]+/g, '작업폴더')
  .replace(/[A-Za-z]:[\\/][^\s`'")\]]*?solio-dev-[A-Za-z0-9]+/g, '(작업 폴더)');
const 홈 = require('node:os').homedir().replace(/\\/g, '/').split('/').pop();
const home = s => s.replace(/(?:[A-Za-z]:[\\/]+|\/[a-z]\/)Users[\\/]+[^\\/\s`'")]+/gi, '(홈)');
// 못 쓰는 판: 오류, 시간 초과, 답 없음(한도 글 포함), 거절. 쌍의 한쪽이라도 그러면 그 쌍을 뺀다
const 못씀 = m => (m.isError !== false && '오류') || (m.timedOut && '시간 초과') || (!m.costUsdEquivalent && '답 없음') || ((m.denials || []).length && '거절 ' + m.denials.length) || '';
const leaks = s => /(?:plain|pack)-\d|solio-dev-T\d-(?:plain|pack)|[\\/](?:plain|pack)[\\/-]/i.test(s);

function reps(task) {
  const d = path.join(out, task.id);
  if (!fs.existsSync(d)) return [];
  return [...new Set(fs.readdirSync(d).map(n => /^(?:plain|pack)-(\d+)$/.exec(n)?.[1]).filter(Boolean))].filter(r => ARMS.every(a => fs.existsSync(path.join(d, `${a}-${r}`, 'meta.json'))));
}

if (할일 === '준비') {
  fs.mkdirSync(box, { recursive: true });
  const key = {};
  const 뺀쌍 = [];
  for (const t of 과제들) for (const r of reps(t)) {
    const why = ARMS.map(a => [a, 못씀(JSON.parse(read(path.join(out, t.id, `${a}-${r}`, 'meta.json'))))]).filter(x => x[1]);
    if (why.length) { 뺀쌍.push(`${t.id}-${r}(${why.map(x => x.join(' ')).join(', ')})`); continue; }
    const swap = crypto.randomInt(2) === 1, side = swap ? { A: 'pack', B: 'plain' } : { A: 'plain', B: 'pack' };
    key[`${t.id}-${r}`] = side;
    const seed = Object.keys(t.seed).map(f => '- `' + f + '`').join('\n');
    const part = s => {
      const w = path.join(out, t.id, `${side[s]}-${r}`), checks = JSON.parse(read(path.join(w, 'checks.json')) || '[]');
      return [`## ${s}`, '', '### 자동 검사', '', ...checks.map(c => `- ${c.ok ? '통과' : '실패'}: ${c.name}${c.detail ? ' (' + JSON.stringify(c.detail) + ')' : ''}`), '',
        '### 직원의 마지막 답(회원에게 보인 글)', '', '````markdown', read(path.join(w, 'answer.md'), 12000) || '(답 없음)', '````', '',
        '### 바뀐 파일(처음 폴더와의 차이)', '', '````diff', read(path.join(w, 'diff.patch'), 14000) || '(바뀐 것 없음)', '````', ''].join('\n');
    };
    const body = home(scrub([`# ${t.id} ${t.이름} (${r}회)`, '', '## 회원의 요청', '', '> ' + t.요청, '', '## 처음 폴더', '', seed, '', part('A'), part('B')].join('\n')));
    if (body.toLowerCase().includes('/' + 홈.toLowerCase() + '/') || body.toLowerCase().includes('\\' + 홈.toLowerCase() + '\\')) throw new Error(`${t.id}-${r}: 꾸러미에 이 PC 사용자 폴더가 남았다`);
    if (leaks(body)) throw new Error(`${t.id}-${r}: 꾸러미에 어느 팔인지 드러나는 자국이 남았다`);
    fs.writeFileSync(path.join(box, `${t.id}-${r}.md`), body);
  }
  fs.writeFileSync(path.join(out, '열쇠.json'), JSON.stringify(key, null, 2));
  fs.writeFileSync(path.join(out, '뺀쌍.json'), JSON.stringify(뺀쌍, null, 2));
  console.log(`꾸러미 ${Object.keys(key).length}개 → ${box} · 뺀 쌍 ${뺀쌍.length}개 ${뺀쌍.join(' · ')}`);
} else if (할일 === '카본') {
  const { 부르기 } = require('../../../../tools/lib/제미나이구독호출.js');
  const 점수 = { type: 'object', properties: { 맞음: { type: 'integer' }, 안전: { type: 'integer' }, 보고: { type: 'integer' }, 범위: { type: 'integer' } }, required: ['맞음', '안전', '보고', '범위'] };
  const schema = { type: 'object', properties: { A: 점수, B: 점수, 나은쪽: { type: 'string', enum: ['A', 'B', '같음'] }, 까닭: { type: 'string' } }, required: ['A', 'B', '나은쪽', '까닭'] };
  const 안내 = read(path.join(__dirname, '채점.md')).replace(/## 답의 꼴[\s\S]*$/, '');
  const 이름들 = fs.readdirSync(box).filter(f => /^T\d-\d+\.md$/.test(f)).sort(), 판정 = [];
  (async () => {
    for (const f of 이름들) {
      const [과제, 회] = f.replace('.md', '').split('-');
      const r = await 부르기({ model: 'gemini-4-carbon', thinking: 'high', schema, timeoutMs: 600000, prompt: 안내 + '\n\n아래 꾸러미 하나만 채점한다. 답은 JSON 하나다.\n\n' + read(path.join(box, f)) });
      const 글 = typeof r === 'string' ? r : r.text ?? r.글 ?? r.답 ?? JSON.stringify(r);
      const j = JSON.parse(글.match(/\{[\s\S]*\}/)[0]);
      판정.push({ 과제, 회, ...j });
      console.log(f, j.나은쪽);
      fs.writeFileSync(path.join(box, '채점결과-카본.json'), JSON.stringify({ 채점자: 'gemini-4-carbon high', 판정 }, null, 2));
    }
  })().catch(e => { console.error('멈춤:', e.message); process.exit(1); });
} else if (할일 === '집계') {
  const key = JSON.parse(read(path.join(out, '열쇠.json')));
  const got = JSON.parse(read(path.join(box, 파일 || '채점결과-카본.json')));
  const AX = ['맞음', '안전', '보고', '범위'];
  const sum = Object.fromEntries(ARMS.map(a => [a, { 검사통과: 0, 검사전체: 0, 이김: 0, ...Object.fromEntries(AX.map(x => [x, 0])), 판: 0 }]));
  let 같음 = 0;
  const rows = [];
  for (const g of got.판정 || got) {
    const k = `${g.과제}-${g.회}`, side = key[k];
    if (!side) continue;
    for (const s of ['A', 'B']) {
      const arm = side[s], m = JSON.parse(read(path.join(out, g.과제, `${arm}-${g.회}`, 'meta.json')));
      sum[arm].검사통과 += m.passed; sum[arm].검사전체 += m.total; sum[arm].판 += 1;
      for (const x of AX) sum[arm][x] += Number(g[s]?.[x] || 0);
    }
    if (g.나은쪽 === 'A' || g.나은쪽 === 'B') sum[side[g.나은쪽]].이김 += 1; else 같음 += 1;
    rows.push({ 과제: k, 나은쪽: g.나은쪽 === '같음' ? '같음' : side[g.나은쪽], 까닭: g.까닭 });
  }
  const avg = a => Object.fromEntries(AX.map(x => [x, +(sum[a][x] / Math.max(1, sum[a].판)).toFixed(2)]));
  const 집계 = { 판: sum.plain.판, 같음, plain: { 검사: `${sum.plain.검사통과}/${sum.plain.검사전체}`, 이김: sum.plain.이김, 평균: avg('plain') }, pack: { 검사: `${sum.pack.검사통과}/${sum.pack.검사전체}`, 이김: sum.pack.이김, 평균: avg('pack') }, 과제별: rows };
  fs.writeFileSync(path.join(box, '집계.json'), JSON.stringify(집계, null, 2));
  console.log(JSON.stringify(집계, null, 2));
} else {
  console.log('node 채점.cjs 준비|카본|집계 <결과 폴더>');
}
