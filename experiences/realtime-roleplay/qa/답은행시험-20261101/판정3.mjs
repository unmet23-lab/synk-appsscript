// 답 은행 시험 3판(2026-11-01) — 다판(학습자말C.mjs, 3판 은행이 본 적 없는 새 200줄)에서 2판 · 3판 답을 X · Y로 섞어 두 검수자에게 보인다.
// 이번에는 생성으로 넘긴 차례도 실제 답을 만들어(생성.mjs) 같이 매긴다 — 학습자가 실제로 듣는 답 전체가 기준(맞게 받음 80% 이상 · 엉뚱 5% 이하)을 넘는지.
// 쓰는 법:
//   node 판정3.mjs 자료 <폴더>   → <폴더>/C<가|나|다>/자료.md (Fable 세 조)
//   node 판정3.mjs gpt           → 판정3_C_GPT.jsonl(git 밖)
//   node 판정3.mjs 집계          → 판정3결과.md · .tmp/답은행시험-20261101/판정3요약.json
//   node 판정3.mjs 묶기          → 결과자료3.mjs(git 밖 고르기 · 판정 .jsonl을 커밋할 수 있게 하나로)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 작업 = path.resolve(여기, '../../../../.tmp/답은행시험-20261101');
const 기준 = fs.readFileSync(path.join(여기, '판정기준3.md'), 'utf8');
const 조들 = { 가: ['처음', '나라'], 나: ['좋아함', '사인'], 다: ['끝', '작별뒤'] };
const 묶음자료3 = fs.existsSync(path.join(여기, '결과자료3.mjs')) ? (await import(pathToFileURL(path.join(여기, '결과자료3.mjs')).href)).default : {};
const jsonl = (f) => (fs.existsSync(path.join(여기, f)) ? fs.readFileSync(path.join(여기, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : 묶음자료3[f] || null);
const 묶을파일 = ['고르기2_C_AI.jsonl', '고르기3_C.jsonl', '판정3_C_페이블.jsonl', '판정3_C_GPT.jsonl'];
const 자료 = (await import(pathToFileURL(path.join(여기, '학습자말C.mjs')).href)).default;
export const X는3판 = (id) => (createHash('sha1').update(`${id}|XY3`).digest()[0] & 1) === 1;

/** 판본(2|3) → id별 {글, 길: '은행'|'되묻기'|'생성'} */
export function 후보(판본) {
  const 줄 = jsonl(판본 === 2 ? '고르기2_C_AI.jsonl' : '고르기3_C.jsonl');
  if (!줄) throw new Error(`${판본}판 고르기 결과가 없다`);
  return new Map(줄.map((r) => [r.id, { 글: r.글 || '', 길: r.판단 === '고름' ? '은행' : r.판단 }]));
}
function 묶음() {
  const 이 = 후보(2); const 삼 = 후보(3);
  return 자료.map((m) => { const 셋X = X는3판(m.id); return { m, 셋X, X: 셋X ? 삼.get(m.id) : 이.get(m.id), Y: 셋X ? 이.get(m.id) : 삼.get(m.id) }; });
}
const 말글 = ({ m, X, Y }) => `- id: ${m.id}\n  학습자말: 「${m.학습자말}」\n  뜻: ${m.뜻}\n  받아적기: 「${m.받아적기}」\n  X: 「${X.글}」\n  Y: 「${Y.글}」`;

function 자료만들기(폴더) {
  const 줄 = 묶음();
  for (const [조, 순간들] of Object.entries(조들)) {
    const 내 = 줄.filter((x) => 순간들.includes(x.m.단계));
    const 글 = [기준, '---', ...순간들.map((s) => `## 순간 「${s}」\n상황: ${단계[s].상황}\n하온이 방금 한 말: 「${단계[s].앞말}」\n\n${내.filter((x) => x.m.단계 === s).map(말글).join('\n')}`)].join('\n\n');
    fs.mkdirSync(path.join(폴더, `C${조}`), { recursive: true });
    fs.writeFileSync(path.join(폴더, `C${조}`, '자료.md'), 글);
    console.log(`C${조}: ${내.length}줄`);
  }
}

async function gpt(동시 = 3) {
  const 줄 = 묶음(); const 결과 = new Array(줄.length); let 다음 = 0;
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 줄.length) {
      const i = 다음++; const x = 줄[i];
      const 본문 = {
        model: 'gpt-6.1-terra', reasoning: { effort: 'medium' }, max_output_tokens: 3000,
        input: [{ role: 'developer', content: [{ type: 'input_text', text: 기준 }] }, { role: 'user', content: [{ type: 'input_text', text: `## 순간 「${x.m.단계}」\n상황: ${단계[x.m.단계].상황}\n하온이 방금 한 말: 「${단계[x.m.단계].앞말}」\n\n${말글(x)}` }] }],
        text: { format: { type: 'json_schema', name: 'blind_judge3', strict: true, schema: { type: 'object', additionalProperties: false, required: ['X', 'Y', '평범', '받아적기로뜻앎', '메모'], properties: { X: { type: 'string', enum: ['자연', '어색'] }, Y: { type: 'string', enum: ['자연', '어색'] }, 평범: { type: 'boolean' }, 받아적기로뜻앎: { type: 'boolean' }, 메모: { type: 'string' } } } } },
      };
      for (let 회 = 1; ; 회++) {
        try { const { 답 } = await 응답부르기(본문); const o = JSON.parse(출력글(답) || '{}'); if (!o.X || !o.Y) throw new Error('X · Y 없음'); 결과[i] = { id: x.m.id, ...o, USD: 글값('gpt-6.1-terra', 답.usage) }; break; }
        catch (e) { if (회 >= 4 || e.상태 === 400) { 결과[i] = { id: x.m.id, 오류: String(e.message).slice(0, 160) }; break; } await new Promise((r) => setTimeout(r, 4000 * 회)); }
      }
    }
  }));
  fs.writeFileSync(path.join(여기, '판정3_C_GPT.jsonl'), 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(JSON.stringify({ 줄: 결과.length, 오류: 결과.filter((r) => r.오류).length, USD: Number(결과.reduce((s, r) => s + (r.USD || 0), 0).toFixed(3)) }));
}

function 집계() {
  const 줄 = 묶음();
  const 페 = new Map((jsonl('판정3_C_페이블.jsonl') || []).map((r) => [r.id, r]));
  const 지 = new Map((jsonl('판정3_C_GPT.jsonl') || []).filter((r) => !r.오류).map((r) => [r.id, r]));
  const 값 = (검, x, 판본) => { const r = 검.get(x.m.id); if (!r) return null; return (판본 === 3) === x.셋X ? r.X : r.Y; };
  const 합 = (a, b, 판) => { if (!a || !b) return null; if (판 === '엄격') return a === '자연' && b === '자연' ? '자연' : '어색'; return a === '자연' || b === '자연' ? '자연' : '어색'; };
  const 판정 = (x, 판본, 검판) => { const a = 값(페, x, 판본); const b = 값(지, x, 판본); return 검판 === '페이블' ? a : 검판 === 'GPT' ? b : 합(a, b, 검판); };
  const 표 = (판본, 걸름 = () => true) => Object.fromEntries(['페이블', 'GPT', '엄격', '너그러움'].map((검판) => {
    const c = { 자연: 0, 어색: 0, n: 0 };
    for (const x of 줄.filter(걸름)) { const v = 판정(x, 판본, 검판); if (!v) continue; c[v]++; c.n++; }
    return [검판, c];
  }));
  const 퍼 = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
  const 길 = (x, 판본) => ((판본 === 3) === x.셋X ? x.X : x.Y).길;
  const 출력 = []; const 쓰기 = (s = '') => 출력.push(s);
  const 요약 = { 때: new Date().toISOString(), 판본: {} };
  쓰기(`# 답 은행 시험 3판 블라인드 판정 결과 (${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)} 한국 시각)\n`);
  쓰기('다판(학습자말C.mjs — 3판 은행이 본 적 없는 새 200줄). 생성으로 넘긴 차례도 실제 답을 매겼다. 셈: 자연 = 맞게 받음, 어색 = 엉뚱. 기준: 맞게 받음 80% 이상 · 엉뚱 5% 이하.\n');
  쓰기('| 판본 · 정답 판 | 줄 | 맞게 받음 | 엉뚱 |\n|---|---|---|---|');
  for (const 판본 of [2, 3]) {
    const t = 표(판본);
    for (const [검판, c] of Object.entries(t)) 쓰기(`| ${판본}판 · ${검판} | ${c.n} | **${퍼(c.자연, c.n)}** | **${퍼(c.어색, c.n)}** |`);
    const 길별 = Object.fromEntries(['은행', '되묻기', '생성'].map((g) => [g, 표(판본, (x) => 길(x, 판본) === g)]));
    요약.판본[판본] = { 전체: t, 길별, 평범: 표(판본, (x) => 페.get(x.m.id)?.평범 === true), 예외: 표(판본, (x) => 페.get(x.m.id)?.평범 === false),
      순간별: Object.fromEntries(['처음', '나라', '좋아함', '사인', '끝', '작별뒤'].map((s) => [s, 표(판본, (x) => x.m.단계 === s)])),
      오류별: Object.fromEntries(['없음', '가벼움', '심함'].map((e) => [e, 표(판본, (x) => x.m.오류정도 === e)])) };
  }
  쓰기('\n답이 나온 길별(은행 답 · 되묻기 · 생성 답) — 줄 수 · 엉뚱 Fable · GPT\n');
  쓰기('| 판본 | 은행 답 | 되묻기 | 생성 답 |\n|---|---|---|---|');
  for (const 판본 of [2, 3]) { const g = 요약.판본[판본].길별; 쓰기(`| ${판본}판 | ${['은행', '되묻기', '생성'].map((k) => `${g[k].페이블.n}줄 · ${퍼(g[k].페이블.어색, g[k].페이블.n)} · ${퍼(g[k].GPT.어색, g[k].GPT.n)}`).join(' | ')} |`); }
  쓰기('\n평범한 답 / 예외(평범 여부는 Fable 판단) — 엉뚱 Fable · GPT\n');
  for (const 판본 of [2, 3]) { const p = 요약.판본[판본]; 쓰기(`- ${판본}판: 평범 ${p.평범.페이블.n}줄 ${퍼(p.평범.페이블.어색, p.평범.페이블.n)} · ${퍼(p.평범.GPT.어색, p.평범.GPT.n)} / 예외 ${p.예외.페이블.n}줄 ${퍼(p.예외.페이블.어색, p.예외.페이블.n)} · ${퍼(p.예외.GPT.어색, p.예외.GPT.n)}`); }
  const 엉 = 줄.filter((x) => 값(페, x, 3) === '어색' || 값(지, x, 3) === '어색');
  요약.엉뚱3 = 엉.map((x) => { const c = x.셋X ? x.X : x.Y; return { id: x.m.id, 학습자말: x.m.학습자말, 받아적기: x.m.받아적기, 오류정도: x.m.오류정도, 답: c.글, 길: c.길, F: 값(페, x, 3), G: 값(지, x, 3), 메모F: 페.get(x.m.id)?.메모 || '', 메모G: 지.get(x.m.id)?.메모 || '' }; });
  쓰기(`\n3판 답을 하나라도 어색하다고 본 줄 ${엉.length}개\n`);
  쓰기('| id | 학습자말 | 받아적기(오류) | 3판 답 | 길 | Fable | GPT |\n|---|---|---|---|---|---|---|');
  for (const e of 요약.엉뚱3) 쓰기(`| ${e.id} | ${e.학습자말} | ${e.받아적기} (${e.오류정도}) | ${e.답} | ${e.길} | ${e.F} | ${e.G} |`);
  let 같음 = 0; let 둘 = 0;
  for (const x of 줄) for (const 판본 of [2, 3]) { const a = 값(페, x, 판본); const b = 값(지, x, 판본); if (a && b) { 둘++; if (a === b) 같음++; } }
  쓰기(`\n두 검수자 판정이 같음: ${퍼(같음, 둘)} (${같음}/${둘})`);
  요약.일치 = { 같음, 둘 };
  fs.writeFileSync(path.join(여기, '판정3결과.md'), `${출력.join('\n')}\n`);
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(path.join(작업, '판정3요약.json'), JSON.stringify(요약, null, 1));
  console.log(출력.join('\n'));
}

const [명령, 인자1] = process.argv.slice(2);
if (명령 === '자료') 자료만들기(인자1);
else if (명령 === 'gpt') await gpt();
else if (명령 === '집계') 집계();
else if (명령 === '묶기') {
  const 자료들 = Object.fromEntries(묶을파일.map((f) => [f, (jsonl(f) || []).map(({ 사용, 이웃, ...나머지 }) => 나머지)]));
  fs.writeFileSync(path.join(여기, '결과자료3.mjs'), `// 답 은행 시험 3판(2026-11-01) 원자료 — 판정3.mjs 묶기가 git 밖 .jsonl을 묶었다(손대지 않는다). 학생 정보 없음.\nexport default ${JSON.stringify(자료들)};\n`);
  console.log('결과자료3.mjs', 묶을파일.map((f) => `${f}:${(자료들[f] || []).length}`).join(' '));
}
else if (명령) { console.error('명령: 자료 <폴더> | gpt | 집계 | 묶기'); process.exit(1); }
