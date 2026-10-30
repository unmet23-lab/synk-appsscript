// 페이지의 dash.calc를 받은 자료로 그대로 돌려 보고, 「v」 표시 칸이 모두 값을 찾는지 본다(화면은 그리지 않음).
const fs = require('node:fs'), path = require('node:path');
const [page, up] = process.argv.slice(2);
const html = fs.readFileSync(page, 'utf8');
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const calcs = {};
const data = {};
for (const f of fs.readdirSync(up)) if (f.endsWith('.json')) data[f.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(up, f), 'utf8'));
const dash = { calc: (id, o) => { calcs[id] = o; }, draw: () => {}, data: () => ({ status: 'loading' }), colors: [] };
new Function('dash', 'd3', js.split('const BR =')[0])(dash, {});
const get = (id) => { if (id in data) return data[id]; const c = calcs[id]; return (data[id] = c.fn(...c.inputs.map(get))); };
for (const id of Object.keys(calcs)) get(id);
const out = [];
for (const id of ['peaks', 'peak_range', 'age_share', 'device_share', 'theme_share', 'lengths', 'ad_topics', 'ad_summary']) out.push(id + ' ' + JSON.stringify(data[id]));
out.push('angles ' + JSON.stringify(data.angles.map((r) => [r.angle, r.videos, r.rate, r.median_multiple])));
out.push('top ' + JSON.stringify(data.top_videos.map((r) => [r.id, r.multiple])));
const marks = [...html.matchAll(/data-draw="v" ([^>]*)>/g)].map((m) => m[1]);
let bad = 0;
for (const m of marks) {
  const a = Object.fromEntries([...m.matchAll(/data-([a-z]+)="([^"]*)"/g)].map((x) => [x[1], x[2].replace(/&amp;/g, '&')]));
  const rows = data[a.source];
  const row = a.where ? rows.find((r) => a.where.split('&').every((p) => { const [k, v] = p.split('='); return String(r[k]) === v; })) : rows[0];
  const v = row ? row[a.field] : undefined;
  if (v === undefined || v === null) { bad++; out.push('못 찾음 ' + JSON.stringify(a)); }
}
out.push(`v 표시 ${marks.length}개 · 못 찾음 ${bad}`);
fs.writeFileSync(path.join(path.dirname(page), 'calc_check.txt'), out.join('\n'));
