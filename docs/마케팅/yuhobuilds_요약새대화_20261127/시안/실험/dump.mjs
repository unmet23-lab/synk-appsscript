// 하위 에이전트 기록에서 말(보낸 글)과 답(SubagentHandback 보고)을 차례대로 뽑아 JSON으로 쓴다.
// 쓰는 법: node dump.mjs <agentId> <out.json>
import fs from 'node:fs';
import path from 'node:path';

const dir = 'C:/Users/q1212/.claude/projects/D--SYNK-worktrees-SYNK-appsscript-gracious-bassi-ff9035/e953afaf-6f35-4677-8d5d-104b696d63eb/subagents';
const [id, out] = process.argv.slice(2);
const lines = fs.readFileSync(path.join(dir, `agent-${id}.jsonl`), 'utf8').split('\n').filter(Boolean);
const turns = [];
const strip = (t) => t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').replace(/^The coordinator sent a message while you were working:\s*/m, '').trim();
for (const l of lines) {
  let o; try { o = JSON.parse(l); } catch { continue; }
  if (o.type === 'user' && o.message) {
    const c = o.message.content;
    const parts = typeof c === 'string' ? [c] : (Array.isArray(c) ? c.filter((x) => x.type === 'text').map((x) => x.text) : []);
    const t = strip(parts.join('\n'));
    if (t) turns.push({ who: 'user', text: t, ts: o.timestamp });
  }
  if (o.type === 'assistant' && o.message && Array.isArray(o.message.content)) {
    for (const x of o.message.content) {
      if (x.type === 'tool_use' && /Handback/i.test(x.name || '')) {
        const v = x.input || {};
        const t = v.report || v.result || v.message || v.text || JSON.stringify(v);
        turns.push({ who: 'claude', text: String(t).trim(), ts: o.timestamp, msg: o.message.id });
      }
    }
  }
}
fs.writeFileSync(out, JSON.stringify(turns, null, 2));
console.log(turns.length, '개 ·', turns.map((t) => t.who[0]).join(''));
