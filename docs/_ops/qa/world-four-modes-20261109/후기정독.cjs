// 좁힌 낱말로 다시 뽑아 한 줄씩 읽는다(뜻을 사람이 확인하려고). 인자: 묶음 이름.
const fs = require('node:fs'), path = require('node:path');
const DIR = process.argv[2]; if (!DIR) throw Error('후기 폴더를 첫 인자로 주세요');
const rows = fs.readdirSync(DIR).filter(n => n.endsWith('.json')).flatMap(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).map(r => ({...r, app: f.replace('.json', '')})));
const groups = {
  수준: /(placement|too (easy|basic|simple)|wrong level|my level|not my level|advanced|beginner (vocab|words|lessons))/i,
  안내: /(tells? me what|don'?t have to (think|decide|figure|plan)|takes? the guess|clear (path|structure|plan)|well.?structured|very structured|daily (plan|lesson|routine)|what to (do|learn|study|practice)( next)?|lesson plan|study plan|learning plan|roadmap|personali[sz]ed|tailored|my (weak|mistake)|weak (spot|point|area)|mistakes? (review|practice|section)|review(s)? (my|the) mistakes|focus(es)? on (what|my|where))/i,
  찾기: /(don'?t know (what|where) to|not sure (what|where)|no idea (what|where)|where to (start|begin)|hard to (navigate|find)|can'?t find|difficult to (navigate|find)|no (clear )?structure|disorgani[sz]ed|cluttered|too many (menus|options|buttons|screens)|navigat|scroll (and|to))/i,
  자유: /(can'?t (choose|pick|skip|select|jump)|cannot (choose|pick|skip|select|jump)|unable to (choose|pick|skip|select)|let me (choose|pick|skip)|forces? (me|you) (to|into)|linear|old (tree|version)|want to (choose|pick|skip)|choose what|test out|skip (ahead|lessons?)|in order)/i,
};
const key = process.argv[3];
const hit = rows.filter(r => groups[key].test(`${r.title} ${r.text}`));
const by = {}; for (const r of hit) by[r.app] = (by[r.app] || 0) + 1;
console.log(key, hit.length, '건 · 평균', (hit.reduce((a, b) => a + b.rating, 0) / (hit.length || 1)).toFixed(2), JSON.stringify(by));
const dist = [1, 2, 3, 4, 5].map(n => `★${n} ${hit.filter(r => r.rating === n).length}`).join(' ');
console.log(dist);
for (const r of hit.slice(0, Number(process.argv[4] || 60))) {
  const m = `${r.title}. ${r.text}`.replace(/\s+/g, ' '), i = m.search(groups[key]);
  console.log(`[${r.app}★${r.rating}] ${m.slice(Math.max(0, i - 60), i + 110)}`);
}
