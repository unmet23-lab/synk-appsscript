// 하위 에이전트 기록(jsonl)에서 API 호출마다 입력 합과 출력을 읽는다.
// 쓰는 법: node usage.mjs <agentId> [<agentId>…]
import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:/Users/q1212/.claude/projects/D--SYNK-worktrees-SYNK-appsscript-gracious-bassi-ff9035/e953afaf-6f35-4677-8d5d-104b696d63eb/subagents';
for (const id of process.argv.slice(2)) {
  const f = path.join(dir, `agent-${id}.jsonl`);
  if (!fs.existsSync(f)) { console.log(id, '기록 없음'); continue; }
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
  const seen = new Map();
  let lastUser = '';
  const rows = [];
  for (const l of lines) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'user' && o.message) {
      const c = o.message.content;
      const t = typeof c === 'string' ? c : (Array.isArray(c) ? c.map(x => x.text || (x.type === 'tool_result' ? '[도구결과]' : '')).join(' ') : '');
      if (t.trim()) lastUser = t.replace(/\s+/g, ' ').slice(0, 40);
    }
    if (o.type === 'assistant' && o.message && o.message.usage) {
      const m = o.message; const u = m.usage;
      if (seen.has(m.id)) { seen.get(m.id).out = Math.max(seen.get(m.id).out, u.output_tokens || 0); continue; }
      const r = { id: m.id, model: m.model, inp: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), raw: u.input_tokens || 0, cw: u.cache_creation_input_tokens || 0, cr: u.cache_read_input_tokens || 0, out: u.output_tokens || 0, user: lastUser, ts: o.timestamp };
      seen.set(m.id, r); rows.push(r);
    }
  }
  console.log(`== ${id} (${rows.length}회 호출)`);
  rows.forEach((r, i) => console.log(`${i + 1}\t${r.model}\t입력합 ${r.inp}\t(새 ${r.raw} · 캐시쓰기 ${r.cw} · 캐시읽기 ${r.cr})\t출력 ${r.out}\t${r.ts}\t${r.user}`));
}
