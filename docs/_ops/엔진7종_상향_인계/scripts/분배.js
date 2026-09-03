const fs = require('fs');
const J = 'C:/Users/q1212/.claude/projects/C--Users-q1212-Documents-SYNK-appsscript/85b643a8-e8ff-4b7e-927b-e8fbdbfaa1bd/subagents/workflows/wf_efa03659-963/journal.jsonl';
const lines = fs.readFileSync(J, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const results = lines.filter(l => l.type === 'result');
console.log('lines', lines.length, 'results', results.length, 'keys', Object.keys(results[0] || {}));
const NAMES = ['Core','Loom','Vellum','Trail','Prism','Temper','Reed'];
const out = {};
for (const r of results) {
  const v = r.result ?? r.value ?? r.output;
  if (!v || typeof v !== 'object') { console.log('skip non-object', JSON.stringify(r).slice(0,120)); continue; }
  let name = null;
  if (v.rulers) name = '철학';
  else if (v.vertical_line_status) name = '횡단';
  else if (v.engine) {
    const e = String(v.engine);
    const hit = NAMES.find(n => e.includes(n));
    if (hit) name = hit + (v.findings ? '_정찰' : '_독해');
    else if (e.includes('공통')) name = '공통스택';
    else if (e.includes('세계')) name = '세계1등';
    else name = '기타_' + e.replace(/[^\w가-힣]/g,'_');
  }
  if (!name) { console.log('unmatched', Object.keys(v)); continue; }
  if (out[name]) console.log('DUP', name);
  out[name] = v;
  fs.writeFileSync(`재료/${name}.json`, JSON.stringify(v, null, 1));
}
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v).length);
