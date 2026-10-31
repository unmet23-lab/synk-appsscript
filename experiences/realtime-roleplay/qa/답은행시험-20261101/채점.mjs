// 답 은행 시험(2026-11-01) — 고르기 결과를 정답(Fable 주 · GPT 대조)과 맞춰 본다.
// 쓰는 법: node 채점.mjs [--모델 gpt-6-luna] [--묶기]
//   자료는 git 밖 .jsonl(정답_페이블 · 정답_GPT · 고르기_<모델>)을 먼저 읽고, 없으면 커밋된 결과자료.mjs를 읽는다.
//   --묶기: 지금 .jsonl들을 결과자료.mjs 하나로 묶어 커밋할 수 있게 한다.
// 셈(한 줄마다): 고름 → 정답 묶음 안이면 맞음, 밖이면 엉뚱 · 되묻기 → (되묻기허용 또는 받아적기로 뜻을 못 앎)이면 맞게 넘김, 아니면 놓침 ·
//   생성 → (자연스러운 묶음 없음 또는 뜻을 못 앎)이면 맞게 넘김, 아니면 놓침. 기준: 맞게 받음 ≥ 80% · 엉뚱 ≤ 5%(설계 제안 · AI 감독 기준과 같은 꼴).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 묶음들 } from './은행.mjs';
import 학습자말 from './학습자말.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : 기본; };
const jsonl = (f) => fs.existsSync(path.join(여기, f)) ? fs.readFileSync(path.join(여기, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : null;
const 묶음자료 = fs.existsSync(path.join(여기, '결과자료.mjs')) ? (await import(pathToFileURL(path.join(여기, '결과자료.mjs')).href)).default : {};

// 고르기 판 = 고르기_<모델>[_<생각>].jsonl(진행 파일 빼고). 오류가 10%를 넘는 판은 표에서 빼고 까닭만 적는다(11-01 luna — 조직 토큰 상한).
const 판이름들 = fs.readdirSync(여기).map((f) => /^고르기_(.+)\.jsonl$/.exec(f)?.[1]).filter((n) => n && !n.endsWith('.진행'));
const 모든고르기 = { ...(묶음자료.고르기 || {}), ...Object.fromEntries(판이름들.map((n) => [n, jsonl(`고르기_${n}.jsonl`)])) };
const 뺀판 = [];
const 자료 = {
  정답_페이블: jsonl('정답_페이블.jsonl') || 묶음자료.정답_페이블,
  정답_GPT: jsonl('정답_GPT.jsonl') || 묶음자료.정답_GPT,
  고르기: Object.fromEntries(Object.entries(모든고르기).filter(([n, v]) => {
    const 오류 = v.filter((r) => r.오류).length;
    if (오류 > v.length * 0.1) { 뺀판.push(`${n}: ${v.length}줄 중 오류 ${오류}(${[...new Set(v.filter((r) => r.오류).map((r) => r.오류))].slice(0, 2).join(' / ')})`); return false; }
    return true;
  })),
};

if (process.argv.includes('--묶기')) {
  const 머리 = `// 답 은행 시험(2026-11-01) 결과 자료 — 채점.mjs --묶기가 git 밖 .jsonl을 묶었다(손대지 않는다). 학생 정보 없음.\n`;
  fs.writeFileSync(path.join(여기, '결과자료.mjs'), `${머리}export default ${JSON.stringify(자료)};\n`);
  console.log('결과자료.mjs 묶음 끝');
  process.exit(0);
}

const 줄로 = (arr) => new Map((arr || []).filter((r) => r && !r.오류).map((r) => [r.id, r]));
const 페 = 줄로(자료.정답_페이블);
const 지 = 줄로(자료.정답_GPT);

function 정답(id, 판) {
  const f = 페.get(id); const g = 지.get(id);
  const 집 = (r) => new Set(r?.자연스러운 || []);
  if (판 === '페이블') return f && { 자연: 집(f), 허용: f.되묻기허용, 앎: f.받아적기로뜻앎 };
  if (판 === 'GPT') return g && { 자연: 집(g), 허용: g.되묻기허용, 앎: g.받아적기로뜻앎 };
  if (!f || !g) return null;
  const a = 집(f); const b = 집(g);
  if (판 === '엄격') return { 자연: new Set([...a].filter((x) => b.has(x))), 허용: f.되묻기허용 && g.되묻기허용, 앎: f.받아적기로뜻앎 || g.받아적기로뜻앎 };
  if (판 === '너그러움') return { 자연: new Set([...a, ...b]), 허용: f.되묻기허용 || g.되묻기허용, 앎: f.받아적기로뜻앎 && g.받아적기로뜻앎 };
  return null;
}

function 셈(p, g, 문턱 = 0) {
  if (!p || p.오류) return '오류';
  let 판단 = p.판단;
  if (판단 === '고름' && (Number(p.확신) || 0) < 문턱) 판단 = '되묻기';
  if (판단 === '고름') return g.자연.has(p.묶음) ? '맞음' : '엉뚱';
  if (판단 === '되묻기') return g.허용 || !g.앎 ? '맞게넘김' : '놓침';
  return g.자연.size === 0 || !g.앎 ? '맞게넘김' : '놓침';
}

const 퍼 = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
function 표(고르기, 판, 문턱 = 0, 거름 = () => true) {
  const p = 줄로(고르기);
  const 칸 = { 맞음: 0, 맞게넘김: 0, 엉뚱: 0, 놓침: 0, 오류: 0 };
  let n = 0; let 생성 = 0; let 은행품 = 0;
  for (const m of 학습자말.filter(거름)) {
    const g = 정답(m.id, 판); if (!g) continue;
    n++; const r = p.get(m.id);
    칸[셈(r, g, 문턱)]++;
    if (r?.판단 === '생성') 생성++;
    if (g.자연.size) 은행품++;
  }
  return { n, ...칸, 맞게받음: 칸.맞음 + 칸.맞게넘김, 생성, 은행품 };
}
const 줄 = (이름, t) => `| ${이름} | ${t.n} | **${퍼(t.맞게받음, t.n)}** | ${퍼(t.맞음, t.n)} | ${퍼(t.맞게넘김, t.n)} | **${퍼(t.엉뚱, t.n)}** | ${퍼(t.놓침, t.n)} | ${퍼(t.생성, t.n)} | ${퍼(t.은행품, t.n)} |`;
const 머리줄 = '| | 줄 | 맞게 받음 | ↳ 묶음 맞음 | ↳ 맞게 넘김 | 엉뚱 | 놓침 | 생성으로 감 | 은행에 맞는 답 있음 |\n|---|---|---|---|---|---|---|---|---|';

const 출력 = [];
const 쓰기 = (s = '') => 출력.push(s);
쓰기(`# 답 은행 시험 채점 결과 (${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)} 한국 시각)\n`);
쓰기(`정답 판: 페이블 ${페.size}줄 · GPT ${지.size}줄. 고르기 판: ${Object.keys(자료.고르기).join(', ') || '없음'}\n`);
if (뺀판.length) 쓰기(`표에서 뺀 고르기 판(오류 10% 넘음): ${뺀판.join(' · ')}\n`);

for (const [모델, 고] of Object.entries(자료.고르기)) {
  쓰기(`## ${모델}\n`);
  쓰기(머리줄);
  for (const 판 of ['페이블', 'GPT', '엄격', '너그러움']) 쓰기(줄(`정답 ${판}`, 표(고, 판)));
  쓰기('\n확신 문턱(이 값 아래 「고름」은 되묻기로) — 정답 페이블\n');
  쓰기(머리줄);
  for (const t of [0, 0.5, 0.7, 0.8, 0.9]) 쓰기(줄(`문턱 ${t}`, 표(고, '페이블', t)));
  쓰기('\n확신 문턱 0.9 — 정답 판마다\n');
  쓰기(머리줄);
  for (const 판 of ['페이블', 'GPT', '엄격', '너그러움']) 쓰기(줄(`정답 ${판} · 문턱 0.9`, 표(고, 판, 0.9)));
  쓰기('\n순간별 — 정답 페이블\n');
  쓰기(머리줄);
  for (const s of ['처음', '나라', '좋아함', '사인', '끝', '작별뒤']) 쓰기(줄(s, 표(고, '페이블', 0, (m) => m.단계 === s)));
  쓰기('\n받아쓰기 오류 정도별 — 정답 페이블\n');
  쓰기(머리줄);
  for (const e of ['없음', '가벼움', '심함']) 쓰기(줄(e, 표(고, '페이블', 0, (m) => m.오류정도 === e)));
  쓰기('\n평범한 답 / 그 밖 — 정답 페이블(평범 여부도 Fable 판단)\n');
  쓰기(머리줄);
  쓰기(줄('평범한 답', 표(고, '페이블', 0, (m) => 페.get(m.id)?.평범 === true)));
  쓰기(줄('그 밖', 표(고, '페이블', 0, (m) => 페.get(m.id)?.평범 === false)));

  const p = 줄로(고);
  const 엉뚱들 = 학습자말.filter((m) => { const g = 정답(m.id, '페이블'); return g && 셈(p.get(m.id), g) === '엉뚱'; });
  쓰기(`\n엉뚱하게 고른 줄 ${엉뚱들.length}개 — 정답 페이블\n`);
  쓰기('| id | 학습자말 | 받아적기(오류) | 고른 묶음 → 하온 답 | 정답 묶음 | GPT 정답 묶음 |\n|---|---|---|---|---|---|');
  for (const m of 엉뚱들) {
    const r = p.get(m.id);
    const 답 = 묶음들(m.단계).find((b) => b.id === r.묶음)?.답[0] || '';
    쓰기(`| ${m.id} | ${m.학습자말} | ${m.받아적기} (${m.오류정도}) | ${r.묶음} (확신 ${r.확신}) → 「${답}」 | ${[...정답(m.id, '페이블').자연].join(', ') || '없음(생성)'} | ${[...(정답(m.id, 'GPT')?.자연 || [])].join(', ') || '없음(생성)'} |`);
  }
  const 놓침들 = 학습자말.filter((m) => { const g = 정답(m.id, '페이블'); return g && 셈(p.get(m.id), g) === '놓침'; });
  쓰기(`\n놓친 줄 ${놓침들.length}개(은행에 맞는 답이 있는데 되묻기 · 생성으로 보냄) — 정답 페이블\n`);
  쓰기('| id | 학습자말 | 받아적기(오류) | 판단 | 정답 묶음 |\n|---|---|---|---|---|');
  for (const m of 놓침들) { const r = p.get(m.id); 쓰기(`| ${m.id} | ${m.학습자말} | ${m.받아적기} (${m.오류정도}) | ${r?.판단 || '오류'} | ${[...정답(m.id, '페이블').자연].join(', ')} |`); }
  쓰기('');
}

// 두 검수자 일치 — 「최선」이 같은 비율, 자연스러운 묶음이 있다/없다가 같은 비율
let 같음 = 0; let 있없같음 = 0; let 둘 = 0;
for (const m of 학습자말) {
  const f = 페.get(m.id); const g = 지.get(m.id); if (!f || !g) continue;
  둘++; if (f.최선 === g.최선) 같음++;
  if ((f.자연스러운.length > 0) === (g.자연스러운.length > 0)) 있없같음++;
}
쓰기(`## 두 검수자(Fable · GPT) 일치\n\n- 최선이 같음: ${퍼(같음, 둘)} (${같음}/${둘})\n- 「은행에 맞는 답이 있다/없다」가 같음: ${퍼(있없같음, 둘)} (${있없같음}/${둘})`);

const 글 = 출력.join('\n');
fs.writeFileSync(path.join(여기, '채점결과.md'), `${글}\n`);
console.log(글);

// 듣기 페이지가 숫자를 손으로 옮기지 않게 요약을 git 밖에 둔다
const 요약 = { 때: new Date().toISOString(), 정답줄: { 페이블: 페.size, GPT: 지.size }, 뺀판, 판: {} };
for (const [모델, 고] of Object.entries(자료.고르기)) {
  const p = 줄로(고);
  요약.판[모델] = {
    정답별: Object.fromEntries(['페이블', 'GPT', '엄격', '너그러움'].map((판) => [판, 표(고, 판)])),
    문턱09: Object.fromEntries(['페이블', 'GPT', '엄격', '너그러움'].map((판) => [판, 표(고, 판, 0.9)])),
    순간별: Object.fromEntries(['처음', '나라', '좋아함', '사인', '끝', '작별뒤'].map((s) => [s, 표(고, '페이블', 0, (m) => m.단계 === s)])),
    오류별: Object.fromEntries(['없음', '가벼움', '심함'].map((e) => [e, 표(고, '페이블', 0, (m) => m.오류정도 === e)])),
    평범: 표(고, '페이블', 0, (m) => 페.get(m.id)?.평범 === true),
    그밖: 표(고, '페이블', 0, (m) => 페.get(m.id)?.평범 === false),
    엉뚱: 학습자말.filter((m) => { const g = 정답(m.id, '페이블'); return g && 셈(p.get(m.id), g) === '엉뚱'; }).map((m) => {
      const r = p.get(m.id);
      return { id: m.id, 학습자말: m.학습자말, 받아적기: m.받아적기, 오류정도: m.오류정도, 묶음: r.묶음, 확신: r.확신, 답: 묶음들(m.단계).find((b) => b.id === r.묶음)?.답[0] || '', 정답: [...정답(m.id, '페이블').자연], GPT정답: [...(정답(m.id, 'GPT')?.자연 || [])] };
    }),
    ms: (() => { const a = 고.filter((r) => !r.오류).map((r) => r.ms).sort((x, y) => x - y); return { 중앙: a[Math.floor(a.length / 2)], 위10: a[Math.floor(a.length * 0.9)] }; })(),
    차례당USD: 고.filter((r) => !r.오류).reduce((s, r) => s + (r.USD || 0), 0) / Math.max(1, 고.filter((r) => !r.오류).length),
  };
}
const 요약파일 = path.resolve(여기, '../../../../.tmp/답은행시험-20261101/채점요약.json');
fs.mkdirSync(path.dirname(요약파일), { recursive: true });
fs.writeFileSync(요약파일, JSON.stringify(요약, null, 1));
