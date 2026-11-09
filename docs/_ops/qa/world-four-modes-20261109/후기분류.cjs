// 받은 후기에서 「오늘 뭘 하지 · 맞춤 · 고를 자유 · 콘텐츠 양」을 말한 글을 낱말로 묶어 세고 표본을 찍는다. 낱말 수는 어림이고 뜻은 표본을 읽어 확인한다.
const fs = require('node:fs'), path = require('node:path');
const DIR = process.argv[2]; if (!DIR) throw Error('후기 폴더를 첫 인자로 주세요');
const cats = {
  '길 안내가 좋다(뭘 할지 고민 안 함)': /(tells? me what|don'?t have to (think|decide|figure|plan)|no need to (think|decide)|takes? the guess|guides? (me|you)|clear (path|structure|plan)|well.?structured|very structured|daily (plan|lesson|routine)|know(s)? what (to|i should)|what to (do|learn|study|practice) next|next lesson|lesson plan|study plan|learning plan|roadmap)/i,
  '뭘 할지 모르겠다 · 어렵게 찾는다': /(don'?t know (what|where|how) to|not sure (what|where)|no idea (what|where)|where to (start|begin)|confus(ing|ed)|overwhelm|hard to (navigate|find)|can'?t find|difficult to (navigate|find)|no (clear )?structure|disorgani[sz]ed|lost|cluttered|too many (menus|options|buttons|screens|pop))/i,
  '맞춤이 좋다(약점 · 실수를 잡아 준다)': /(personali[sz]ed|tailored|adapts?|adaptive|customi[sz]ed|my (weak|mistake|error)|weak (spot|point|area)|focus(es)? on (what|my|where)|mistakes? (review|practice|section)|review(s)? (my|the) mistakes|remembers? (what|my)|spaced repetition|srs|knows what i)/i,
  '맞춤이 가짜다 · 수준이 안 맞다': /(not (really )?(personali[sz]ed|tailored|adaptive)|isn'?t (really )?(personali[sz]ed|tailored)|one size|generic|too (easy|basic|simple)|doesn'?t (adapt|adjust|remember)|ignores?|same (thing|lessons?|words?|questions?) (over|again)|wrong level|not my level)/i,
  '고를 자유를 빼앗겼다': /(can'?t (choose|pick|skip|select|go back|jump)|cannot (choose|pick|skip|select|jump)|unable to (choose|pick|skip|select)|no (choice|freedom|option to)|let me (choose|pick|skip)|forced|forces? (me|you)|linear|locked|old (tree|version)|freedom|want to (choose|pick|skip)|choose what)/i,
  '콘텐츠가 모자라다 · 되풀이': /(ran? out|not enough (content|lessons|material)|run out of|few lessons|limited (content|lessons|material)|repetitive|repeats?( the same)?|repeating|same (content|lessons?|sentences?|phrases?)|lack of (content|lessons)|more (content|lessons))/i,
};
const files = fs.readdirSync(DIR).filter(n => n.endsWith('.json'));
const rows = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).map(r => ({...r, app: f.replace('.json', '')})));
console.log('전체', rows.length, '건 ·', files.length, '앱');
const sample = {};
for (const [cat, re] of Object.entries(cats)) {
  const hit = rows.filter(r => re.test(`${r.title} ${r.text}`));
  const by = {}; for (const r of hit) by[r.app] = (by[r.app] || 0) + 1;
  const avg = (hit.reduce((a, b) => a + b.rating, 0) / (hit.length || 1)).toFixed(2);
  console.log(`\n■ ${cat}: ${hit.length}건 · 평균 별점 ${avg} · ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  sample[cat] = hit;
  const seen = new Set();
  const take = [...hit].sort((a, b) => (a.text.length - b.text.length)).filter(r => r.text.length > 60).filter(r => { if (seen.has(r.app)) return false; seen.add(r.app); return true; }).slice(0, 5);
  for (const r of take) { const m = (`${r.title}. ${r.text}`).replace(/\s+/g, ' '); const i = m.search(re); console.log(`  [${r.app} ★${r.rating}] ${m.slice(Math.max(0, i - 70), i + 130)}`); }
}
