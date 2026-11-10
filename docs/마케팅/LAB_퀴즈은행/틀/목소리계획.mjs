#!/usr/bin/env node
// 편 정본(remotion/src/episode.json) + 박자표(remotion/src/beats.json)에서 한국어 목소리 계획(<편>/목소리.json)을 만든다 — tools/나레이션굽기.mjs가 읽는 꼴.
//   node docs/마케팅/LAB_퀴즈은행/틀/목소리계획.mjs <편 폴더>
//   그다음: node tools/나레이션굽기.mjs <편>/목소리.json  (미리 보기) → --굽기(없는 줄만 산다, 1글자 1크레딧) 또는 --다듬기(사지 않고 자리만 다시)
// 목소리는 LAB 해설 소진(감정 세기 1.0 — LAB 장부 머리말 「목소리」, 10-28 유호님 「소진 세기 1.0으로」). 한국어 줄만 — 판본 공통이다.
// 줄: 문제마다 제목 · 셋 둘 하나(둘째 문제는 둘 하나) · 해요체, 끝에 질문 · 응원. 땡 · 딩동댕 · 따라 해 보세요는 넣지 않는다(현지 시청자가 못 알아들은 소리 — 퀴즈 #6 · #7).
// 이미 계획 파일이 있으면 줄마다 고쳐 둔 설정(seed · emotion · tempo — 음높이 경고로 다시 산 줄)은 그대로 두고 자리(at)와 구간만 박자표대로 고친다 —
// 글 · 설정이 같으면 캐시에서 그대로 쓴다(다시 사지 않는다). 박자표를 고친 뒤에는 이 도구 → 나레이션굽기 --다듬기.
import fs from 'node:fs';
import path from 'node:path';

const 편 = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!편) { console.error('사용: node 목소리계획.mjs <편 폴더>'); process.exit(2); }
const ep = JSON.parse(fs.readFileSync(path.join(편, 'remotion', 'src', 'episode.json'), 'utf8'));
const beats = JSON.parse(fs.readFileSync(path.join(편, 'remotion', 'src', 'beats.json'), 'utf8'));
const SPB = beats.beat / beats.fps;
const r2 = (n) => +n.toFixed(2);
const 숫자 = ['셋!', '둘!', '하나!'];
const 파일 = path.join(편, '목소리.json');
const 옛 = fs.existsSync(파일) ? JSON.parse(fs.readFileSync(파일, 'utf8')) : null;
const 옛줄 = new Map((옛?.lines || []).map((l) => [l.id, l]));
const 줄 = (id, text, at, 기본) => {
  const o = 옛줄.get(id);
  // 글이 같으면 옛 줄의 설정을 그대로(다시 사지 않게), 자리만 고친다
  return o && o.text === text ? { ...o, at: r2(at) } : { id, text, at: r2(at), ...기본 };
};
const lines = [];
const limits = [];
let t0 = 0;
ep.questions.forEach((q, i) => {
  const s = beats.questions[i];
  lines.push(줄(`q${i + 1}_title`, `${q.idiom}!`, t0 + 0.03, { tempo: 1.05 }));
  s.count.forEach((b, k) => { const n = 3 - s.count.length + k; lines.push(줄(`q${i + 1}_c${3 - n}`, 숫자[n], t0 + b * SPB, { tempo: 1.1 })); });
  lines.push(줄(`q${i + 1}_say`, q.say.endsWith('!') || q.say.endsWith('?') ? q.say : `${q.say}.`, t0 + s.say * SPB + 0.06, { tempo: 0.95 }));
  limits.push({ from: r2(t0), to: r2(t0 + s.len * SPB - 0.1) });
  t0 += s.len * SPB;
});
lines.push(줄('end_ask', ep.end.askKo, t0 + beats.end.ask * SPB + 0.06, {}));
lines.push(줄('end_cheer', ep.end.cheerKo, t0 + beats.end.cheer * SPB + 0.02, { tempo: 1.05 }));
limits.push({ from: r2(t0), to: r2(t0 + beats.end.len * SPB - 0.05) });
const plan = {
  note: `LAB 퀴즈 ${ep.id} — 한국어 줄만(판본 공통). 해설 소진 세기 1.0. 만든 도구: docs/마케팅/LAB_퀴즈은행/틀/목소리계획.mjs`,
  voice: 옛?.voice || { id: 'tc_666a9871abcf27a5169850d0', name: '소진' },
  defaults: 옛?.defaults || { model: 'ssfm-v30', lang: 'ko', emotion: 'happy', intensity: 1, tempo: 1, seed: 1110, lufs: -17 },
  out: 'remotion/public/vo',
  srcBase: 'remotion/public',
  ts: 'remotion/src/vo.generated.ts',
  trim: 'both',
  limits,
  lines,
};
fs.writeFileSync(파일, JSON.stringify(plan, null, 2) + '\n');
const 빠짐 = [...옛줄.keys()].filter((id) => !lines.some((l) => l.id === id));
console.log(`${파일} · ${lines.length}줄 · ${lines.reduce((n, l) => n + [...l.text].length, 0)}자${빠짐.length ? ` · 이제 안 쓰는 줄: ${빠짐.join(', ')}` : ''}`);
