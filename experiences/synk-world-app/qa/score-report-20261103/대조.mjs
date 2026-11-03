#!/usr/bin/env node
// 성적표 대조(README 「시험 ③」) — 참가자가 적어 보낸 실제 TOPIK II 성적과 앱의 짧은 연습(시험 형식 연습 20문항 + 53번 한 편)을
// README의 미리 정한 규칙으로 견준다. 참가자 자료는 저장소 밖(SYNK-보관함)에만 두고, 이 도구는 묶은 값만 찍는다.
//
// 참가자.json — 회신 하나를 한 줄로 옮긴 배열:
//   [{ "code": "P01", "nick": "…", "age14": true, "consent": true,
//      "exam": { "round": "…", "date": "2026-10-19", "pbt": true, "L": 62, "W": 41, "R": 58, "total": 161, "level": 4 },
//      "mock": { "date": "2026-11-05", "L": 7, "R": 6 },
//      "essay53": "…" }]
//
//   node 대조.mjs --data <참가자.json> --글 <essays.mjs>        53번 글을 채점 실행기(../score-path-20261103/채점일치.mjs)가 읽는 꼴로 꺼낸다
//   node 대조.mjs --data <참가자.json> --scores <결과.jsonl> [--자세히]   기준 1~3과 판정(--자세히: 사람마다의 줄을 화면에만)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const ITEM = 'w53-exchange';
const CATS = ['content', 'structure', 'language'];
const WEIGHT_53 = { content: 7, structure: 7, language: 16 };
const VALUE = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
const DAY = 86400000;
const NAME = { L: '듣기', R: '읽기', W: '쓰기' };

const dataFile = opt('--data');
if (!dataFile) { console.error('--data <참가자.json>이 필요하다'); process.exit(2); }
const people = JSON.parse(fs.readFileSync(path.resolve(dataFile), 'utf8'));

// 53번 글을 채점 실행기의 글 꼴로 — 실행기는 같은 은행 문항(w53-exchange)과 제품 요청 몸통으로 채점한다.
if (opt('--글')) {
  const essays = people.filter((p) => p.consent && p.age14 && typeof p.essay53 === 'string' && p.essay53.trim())
    .map((p) => ({ id: `${p.code}.w53`, item: ITEM, version: 'P', target: 'participant', text: p.essay53.trim(),
      chars: [...p.essay53.trim().normalize('NFC').replace(/\n/g, '')].length }));
  const out = path.resolve(opt('--글'));
  fs.writeFileSync(out, `// 성적표 대조 참가자의 53번 글 — 저장소 밖에만 둔다.\nexport const ESSAYS = ${JSON.stringify(essays, null, 1)};\n`);
  console.log(`글 ${essays.length}편 → ${out}`);
  process.exit(0);
}

// 채점 결과(채점일치.mjs의 결과.jsonl)에서 글마다 채점(run)별 53번 가정 점수(30점 만점).
const scores = {};
if (opt('--scores')) {
  for (const row of fs.readFileSync(path.resolve(opt('--scores')), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))) {
    if (!row.ok) continue;
    const pts = CATS.reduce((sum, cat) => {
      const c = row.parsed.categories.find((x) => x.id === cat);
      return sum + WEIGHT_53[cat] * (((VALUE[c.high] + VALUE[c.low]) / 2) / 5);
    }, 0);
    (scores[row.essayId] ||= {})[row.run] = pts;
  }
}

const usable = [], dropped = [];
for (const p of people) {
  const why = !p.consent ? '동의 없음' : !p.age14 ? '만 14세 미만' : !p.exam?.pbt ? 'PBT 아님' : null;
  if (why) { dropped.push({ code: p.code, why }); continue; }
  const gap = Math.round((Date.parse(p.mock.date) - Date.parse(p.exam.date)) / DAY);
  const w53 = scores[`${p.code}.w53`] ?? {};
  usable.push({ ...p, gap, inWindow: Number.isFinite(gap) && gap >= 0 && gap <= 90,
    est: { L: p.mock.L * 10, R: p.mock.R * 10, W53: w53.S1 ?? null, W53o: w53.O ?? null } });
}
const judged = usable.filter((p) => p.inWindow);

// 기준 1 — 가장 약한 영역. 우리 쪽은 듣기/100 · 읽기/100 · 53번/30, 실제는 듣기 · 읽기 · 쓰기/100. 같은 값이 여럿이면 겹치면 맞음.
const lowest = (map) => { const min = Math.min(...Object.values(map)); return Object.keys(map).filter((k) => Math.abs(map[k] - min) < 1e-9); };
const c1rows = judged.filter((p) => p.est.W53 !== null).map((p) => {
  const ours = lowest({ L: p.est.L / 100, R: p.est.R / 100, W: p.est.W53 / 30 });
  const real = lowest({ L: p.exam.L / 100, R: p.exam.R / 100, W: p.exam.W / 100 });
  return { code: p.code, ours, real, match: ours.some((k) => real.includes(k)) };
});
const c1need = c1rows.length >= 3 ? c1rows.length - 1 : null;
const c1hit = c1rows.filter((r) => r.match).length;

// 기준 2 — 듣기 · 읽기 어림이 ±20 안인 칸의 비율. 기준 3 — 듣기 + 읽기 합이 40점 넘게 어긋난 사람이 없음.
const cells = judged.flatMap((p) => ['L', 'R'].map((k) => Math.abs(p.est[k] - p.exam[k])));
const c2hit = cells.filter((d) => d <= 20).length;
const c3worst = judged.map((p) => ({ code: p.code, diff: (p.est.L + p.est.R) - (p.exam.L + p.exam.R) }));
const c3bad = c3worst.filter((r) => Math.abs(r.diff) > 40);

const pass1 = c1need !== null && c1hit >= c1need, pass2 = cells.length > 0 && c2hit / cells.length >= 0.7, pass3 = judged.length > 0 && c3bad.length === 0;
const lines = [
  `참가 ${people.length} · 뺌 ${dropped.length}${dropped.length ? `(${dropped.map((d) => d.why).join(', ')})` : ''} · 90일 밖 ${usable.length - judged.length} · 판정에 쓰는 사람 ${judged.length}`,
  `기준 1 가장 약한 영역 일치: ${c1rows.length ? `${c1hit}/${c1rows.length}` : '—'}${c1need === null ? ' (3명 미만 · 판정 안 함)' : ` · 선 ${c1need} → ${pass1 ? '넘음' : '못 넘음'}`}`,
  `기준 2 듣기 · 읽기 ±20 안: ${cells.length ? `${c2hit}/${cells.length} (${Math.round((c2hit / cells.length) * 100)}%)` : '—'} · 선 70% → ${pass2 ? '넘음' : '못 넘음'}`,
  `기준 3 듣기 + 읽기 합 40점 넘는 어긋남: ${c3bad.length}명 → ${pass3 ? '넘음' : '못 넘음'}`,
  `오차 평균(절대): 듣기 ${mean(judged.map((p) => Math.abs(p.est.L - p.exam.L)))} · 읽기 ${mean(judged.map((p) => Math.abs(p.est.R - p.exam.R)))} · 듣기 + 읽기 합의 치우침 ${mean(c3worst.map((r) => r.diff))}`,
  `(적기만) 53번 비율 − 실제 쓰기 비율: ${mean(judged.filter((p) => p.est.W53 !== null).map((p) => Math.round((p.est.W53 / 30 - p.exam.W / 100) * 100)))}%p · Sonnet · Opus 53번 점수 차 ${mean(judged.filter((p) => p.est.W53 !== null && p.est.W53o !== null).map((p) => Math.abs(p.est.W53 - p.est.W53o)))}점`,
  `판정: ${verdict()}`,
];
console.log(lines.join('\n'));
if (args.includes('--자세히')) {
  // 사람마다의 줄은 화면에만 — 파일 · 저장소에 쓰지 않는다.
  for (const p of usable) console.log(`${p.code} · ${p.gap}일 · 실제 듣기 ${p.exam.L} 쓰기 ${p.exam.W} 읽기 ${p.exam.R}(${p.exam.level}급) · 어림 듣기 ${p.est.L} 읽기 ${p.est.R} 53번 ${p.est.W53?.toFixed(1) ?? '—'}/30 · 약한 영역 ${c1rows.find((r) => r.code === p.code)?.ours.map((k) => NAME[k]).join('·') ?? '—'} 대 ${c1rows.find((r) => r.code === p.code)?.real.map((k) => NAME[k]).join('·') ?? '—'}`);
}

function mean(list) { return list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : '—'; }
function verdict() {
  if (judged.length < 3) return '판정에 쓸 사람이 3명이 안 된다 — 더 모은다';
  if (pass1 && pass2 && pass3) return '설계에 넣는다(범위는 근거 수와 함께, 예상 급수 문턱 그대로)';
  const out = [];
  if (!pass3) out.push('큰 어긋남이 있다 — 그 사람의 기록부터 본다');
  if (!pass2) out.push('20문항 한 번으로는 범위가 너무 넓다 — 범위는 모의 두 번(40문항) 뒤, 그 전 화면은 딸 곳과 근거 수만');
  if (!pass1) out.push('「가장 약한 곳」이라는 말을 빼고 유형별로 본 것만 보인다');
  return out.join(' / ');
}
