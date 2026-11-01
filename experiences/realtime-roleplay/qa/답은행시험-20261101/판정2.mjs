// 답 은행 시험 2판(2026-11-01) — 1판 · 2판 답을 X · Y로 섞어 두 검수자에게 보이고(블라인드), 판마다 자연 · 어색 · 필요 · 불필요를 센다.
// 2판은 반응 + 이끔을 이어 붙여 만들어 1판처럼 「맞는 묶음 목록」을 미리 매길 수 없다 → 실제로 나간 답을 매긴다(기준: 판정기준2.md).
// 같은 방법으로 1판도 다시 매겨 두 판을 같은 잣대로 견준다. 가판(학습자말.mjs) = 1판 시험과 같은 200줄(2판은 이 판의 실패를 보고 고쳤다),
// 나판(학습자말B.mjs) = 같은 지시로 새로 받은 200줄(2판이 본 적 없는 말 — 기준 통과는 이 판으로 본다).
// 쓰는 법:
//   node 판정2.mjs 자료 <폴더> [A|B] → <폴더>/<A|B><가|나|다>/자료.md (Fable 여섯 조, 판을 주면 그 판만)
//   node 판정2.mjs gpt <A|B>        → 판정2_<판>_GPT.jsonl(git 밖)
//   node 판정2.mjs 집계             → 판정2결과.md · .tmp/답은행시험-20261101/판정2요약.json
//   node 판정2.mjs 묶기             → 결과자료2.mjs(git 밖 고르기 · 판정 .jsonl을 커밋할 수 있게 하나로)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';
import { 묶음들 as 묶음들1, 되묻기 as 되묻기1 } from './은행.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 작업 = path.resolve(여기, '../../../../.tmp/답은행시험-20261101');
const 기준 = fs.readFileSync(path.join(여기, '판정기준2.md'), 'utf8');
const 조들 = { 가: ['처음', '나라'], 나: ['좋아함', '사인'], 다: ['끝', '작별뒤'] };
const 생성글 = '(실시간 생성으로 넘김)';
// git 밖 .jsonl이 없으면 커밋된 결과자료2.mjs(node 판정2.mjs 묶기)에서 읽는다
const 묶음자료2 = fs.existsSync(path.join(여기, '결과자료2.mjs')) ? (await import(pathToFileURL(path.join(여기, '결과자료2.mjs')).href)).default : {};
const jsonl = (f) => (fs.existsSync(path.join(여기, f)) ? fs.readFileSync(path.join(여기, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : 묶음자료2[f] || null);
const 묶을파일 = ['고르기_gpt-6.1-terra_none.jsonl', '고르기B_gpt-6.1-terra_none.jsonl', '고르기2_A_AI.jsonl', '고르기2_B_AI.jsonl', '판정2_A_페이블.jsonl', '판정2_B_페이블.jsonl', '판정2_A_GPT.jsonl', '판정2_B_GPT.jsonl'];
const 자료읽기 = async (판) => (await import(pathToFileURL(path.join(여기, 판 === 'B' ? '학습자말B.mjs' : '학습자말.mjs')).href)).default;
const 변형번호 = (id) => createHash('sha1').update(id).digest()[0];
export const X는2판 = (id) => (createHash('sha1').update(`${id}|XY`).digest()[0] & 1) === 1;

/** 판(A|B) · 판본(1|2) → id별 {종류: '말'|'생성', 글} */
export function 후보(판, 판본) {
  if (판본 === 1) {
    const 줄 = jsonl(판 === 'B' ? '고르기B_gpt-6.1-terra_none.jsonl' : '고르기_gpt-6.1-terra_none.jsonl');
    if (!줄) throw new Error(`1판 고르기 결과가 없다(${판})`);
    return new Map(줄.map((r) => {
      const 단 = r.id.replace(/^B\./, '').split('-')[0];
      const 변 = 변형번호(r.id);
      if (r.판단 === '고름') { const 답 = 묶음들1(단).find((b) => b.id === r.묶음)?.답 || []; return [r.id, { 종류: '말', 글: 답[변 % 답.length] }]; }
      if (r.판단 === '되묻기') { const 답 = 되묻기1(단); return [r.id, { 종류: '말', 글: 답[변 % 답.length] }]; }
      return [r.id, { 종류: '생성', 글: 생성글 }];
    }));
  }
  // 2판은 AI 고르기 결과로 판정한다 — 빠른 길(임베딩 이웃)은 가판에서 AI와 같은 판단 비율이 안전선(97%)에 못 미쳐 쓰지 않았다(README)
  const 줄 = jsonl(`고르기2_${판}_AI.jsonl`);
  if (!줄) throw new Error(`2판 고르기 결과가 없다(${판})`);
  return new Map(줄.map((r) => [r.id, r.판단 === '생성' || !r.글 ? { 종류: '생성', 글: 생성글 } : { 종류: '말', 글: r.글 }]));
}

async function 묶음(판) {
  const 자료 = await 자료읽기(판);
  const 일 = 후보(판, 1); const 이 = 후보(판, 2);
  return 자료.map((m) => {
    const 둘X = X는2판(m.id);
    const X = 둘X ? 이.get(m.id) : 일.get(m.id); const Y = 둘X ? 일.get(m.id) : 이.get(m.id);
    return { m, X, Y, 둘X };
  });
}
const 말글 = ({ m, X, Y }) => `- id: ${m.id}\n  학습자말: 「${m.학습자말}」\n  뜻: ${m.뜻}\n  받아적기: 「${m.받아적기}」\n  X: ${X.종류 === '생성' ? X.글 : `「${X.글}」`}\n  Y: ${Y.종류 === '생성' ? Y.글 : `「${Y.글}」`}`;

async function 자료(폴더, 판들 = ['A', 'B']) {
  for (const 판 of 판들) {
    const 줄 = await 묶음(판);
    for (const [조, 순간들] of Object.entries(조들)) {
      const 내 = 줄.filter((x) => 순간들.includes(x.m.단계));
      const 글 = [기준, '---', ...순간들.map((s) => `## 순간 「${s}」\n상황: ${단계[s].상황}\n하온이 방금 한 말: 「${단계[s].앞말}」\n\n${내.filter((x) => x.m.단계 === s).map(말글).join('\n')}`)].join('\n\n');
      fs.mkdirSync(path.join(폴더, `${판}${조}`), { recursive: true });
      fs.writeFileSync(path.join(폴더, `${판}${조}`, '자료.md'), 글);
      console.log(`${판}${조}: ${내.length}줄`);
    }
  }
}

function 검수본문(x) {
  const 칸 = (c) => (c.종류 === '생성' ? ['필요', '불필요'] : ['자연', '어색']);
  return {
    model: 'gpt-6.1-terra', reasoning: { effort: 'medium' }, max_output_tokens: 3000,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: 기준 }] },
      { role: 'user', content: [{ type: 'input_text', text: `## 순간 「${x.m.단계}」\n상황: ${단계[x.m.단계].상황}\n하온이 방금 한 말: 「${단계[x.m.단계].앞말}」\n\n${말글(x)}` }] },
    ],
    text: { format: { type: 'json_schema', name: 'blind_judge', strict: true, schema: {
      type: 'object', additionalProperties: false, required: ['X', 'Y', '평범', '받아적기로뜻앎', '메모'],
      properties: { X: { type: 'string', enum: 칸(x.X) }, Y: { type: 'string', enum: 칸(x.Y) }, 평범: { type: 'boolean' }, 받아적기로뜻앎: { type: 'boolean' }, 메모: { type: 'string' } },
    } } },
  };
}

async function gpt(판, 동시 = 3) {
  const 줄 = await 묶음(판);
  const 결과 = new Array(줄.length);
  let 다음 = 0;
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 줄.length) {
      const i = 다음++; const x = 줄[i];
      for (let 회 = 1; ; 회++) {
        try {
          const { 답 } = await 응답부르기(검수본문(x));
          const o = JSON.parse(출력글(답) || '{}');
          if (!o.X || !o.Y) throw new Error('X · Y 없음');
          결과[i] = { id: x.m.id, ...o, USD: 글값('gpt-6.1-terra', 답.usage) };
          break;
        } catch (e) {
          if (회 >= 4 || e.상태 === 400) { 결과[i] = { id: x.m.id, 오류: String(e.message).slice(0, 160) }; break; }
          await new Promise((r) => setTimeout(r, 4000 * 회));
        }
      }
    }
  }));
  fs.writeFileSync(path.join(여기, `판정2_${판}_GPT.jsonl`), 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(JSON.stringify({ 판, 줄: 결과.length, 오류: 결과.filter((r) => r.오류).length, USD: Number(결과.reduce((s, r) => s + (r.USD || 0), 0).toFixed(3)) }));
}

// ── 집계 ──
function 셈(값) { return 값 === '자연' || 값 === '필요' ? '맞게받음' : 값 === '어색' ? '엉뚱' : 값 === '불필요' ? '놓침' : null; }
/** 두 검수자 판 합치기 — 엄격: 둘 다 자연/필요일 때만 맞게받음, 하나라도 어색이면 엉뚱 · 너그러움: 하나라도 자연/필요면 맞게받음, 둘 다 어색일 때만 엉뚱 */
function 합침(a, b, 판) {
  if (!a || !b) return null;
  const sa = 셈(a); const sb = 셈(b);
  if (판 === '엄격') return sa === '엉뚱' || sb === '엉뚱' ? '엉뚱' : sa === '맞게받음' && sb === '맞게받음' ? '맞게받음' : '놓침';
  return sa === '맞게받음' || sb === '맞게받음' ? '맞게받음' : sa === '엉뚱' && sb === '엉뚱' ? '엉뚱' : '놓침';
}

async function 집계() {
  const 출력 = []; const 쓰기 = (s = '') => 출력.push(s);
  const 요약 = { 때: new Date().toISOString(), 판: {} };
  const 퍼 = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
  쓰기(`# 답 은행 시험 2판 블라인드 판정 결과 (${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)} 한국 시각)\n`);
  쓰기('셈: 자연 · 필요 = 맞게 받음, 어색 = 엉뚱, 불필요 = 놓침(생성으로 넘길 필요가 없었음). 기준: 맞게 받음 80% 이상 · 엉뚱 5% 이하.\n');
  for (const 판 of ['A', 'B']) {
    const 줄 = await 묶음(판);
    const 페 = new Map((jsonl(`판정2_${판}_페이블.jsonl`) || []).map((r) => [r.id, r]));
    const 지 = new Map((jsonl(`판정2_${판}_GPT.jsonl`) || []).filter((r) => !r.오류).map((r) => [r.id, r]));
    const 고2 = new Map((jsonl(`고르기2_${판}_AI.jsonl`) || []).map((r) => [r.id, r]));
    const 값 = (검, x, 판본) => { const r = 검.get(x.m.id); if (!r) return null; return (판본 === 2) === x.둘X ? r.X : r.Y; };
    const 표 = (판본, 걸름 = () => true) => {
      const 결 = {};
      for (const 검판 of ['페이블', 'GPT', '엄격', '너그러움']) {
        const 칸 = { 맞게받음: 0, 엉뚱: 0, 놓침: 0, n: 0 };
        for (const x of 줄.filter(걸름)) {
          const a = 값(페, x, 판본); const b = 값(지, x, 판본);
          const s = 검판 === '페이블' ? 셈(a) : 검판 === 'GPT' ? 셈(b) : 합침(a, b, 검판);
          if (!s) continue; 칸[s]++; 칸.n++;
        }
        결[검판] = 칸;
      }
      return 결;
    };
    const 이름 = 판 === 'A' ? '가판(1판 시험과 같은 200줄 — 2판이 이 실패를 보고 고침)' : '나판(새로 받은 200줄 — 2판이 본 적 없는 말)';
    쓰기(`## ${이름}\n`);
    쓰기('| 판본 · 정답 판 | 줄 | 맞게 받음 | 엉뚱 | 놓침 |\n|---|---|---|---|---|');
    요약.판[판] = { 판본: {} };
    for (const 판본 of [1, 2]) {
      const t = 표(판본);
      요약.판[판].판본[판본] = { 전체: t, 평범: 표(판본, (x) => 페.get(x.m.id)?.평범 === true), 예외: 표(판본, (x) => 페.get(x.m.id)?.평범 === false),
        순간별: Object.fromEntries(['처음', '나라', '좋아함', '사인', '끝', '작별뒤'].map((s) => [s, 표(판본, (x) => x.m.단계 === s)])),
        오류별: Object.fromEntries(['없음', '가벼움', '심함'].map((e) => [e, 표(판본, (x) => x.m.오류정도 === e)])) };
      for (const [검판, c] of Object.entries(t)) 쓰기(`| ${판본}판 · ${검판} | ${c.n} | **${퍼(c.맞게받음, c.n)}** | **${퍼(c.엉뚱, c.n)}** | ${퍼(c.놓침, c.n)} |`);
    }
    쓰기('\n평범한 답 / 예외(평범 여부는 Fable 판단) — Fable · GPT\n');
    쓰기('| | 1판 맞게 · 엉뚱(F) | 2판 맞게 · 엉뚱(F) | 1판 맞게 · 엉뚱(G) | 2판 맞게 · 엉뚱(G) |\n|---|---|---|---|---|');
    for (const 칸이름 of ['평범', '예외']) {
      const a = 요약.판[판].판본[1][칸이름]; const b = 요약.판[판].판본[2][칸이름];
      쓰기(`| ${칸이름}(${a.페이블.n}줄) | ${퍼(a.페이블.맞게받음, a.페이블.n)} · ${퍼(a.페이블.엉뚱, a.페이블.n)} | ${퍼(b.페이블.맞게받음, b.페이블.n)} · ${퍼(b.페이블.엉뚱, b.페이블.n)} | ${퍼(a.GPT.맞게받음, a.GPT.n)} · ${퍼(a.GPT.엉뚱, a.GPT.n)} | ${퍼(b.GPT.맞게받음, b.GPT.n)} · ${퍼(b.GPT.엉뚱, b.GPT.n)} |`);
    }
    // 2판 빠른 길 · AI 길
    const 빠른 = 줄.filter((x) => 고2.get(x.m.id)?.경로 === '빠른');
    const 빠른엉뚱 = (검) => 빠른.filter((x) => 셈(값(검, x, 2)) === '엉뚱').length;
    쓰기(`\n2판 빠른 길이 받은 줄 ${빠른.length}개 — 엉뚱 Fable ${빠른엉뚱(페)} · GPT ${빠른엉뚱(지)}\n`);
    요약.판[판].빠른 = { n: 빠른.length, 엉뚱F: 빠른엉뚱(페), 엉뚱G: 빠른엉뚱(지) };
    // 2판 엉뚱 목록
    const 엉 = 줄.filter((x) => 셈(값(페, x, 2)) === '엉뚱' || 셈(값(지, x, 2)) === '엉뚱');
    쓰기(`2판 답을 하나라도 어색하다고 본 줄 ${엉.length}개\n`);
    쓰기('| id | 학습자말 | 받아적기(오류) | 2판 답 | Fable | GPT | 길 |\n|---|---|---|---|---|---|---|');
    요약.판[판].엉뚱2 = 엉.map((x) => ({ id: x.m.id, 학습자말: x.m.학습자말, 받아적기: x.m.받아적기, 오류정도: x.m.오류정도, 답: (x.둘X ? x.X : x.Y).글, F: 값(페, x, 2), G: 값(지, x, 2), 길: 고2.get(x.m.id)?.경로, 메모F: 페.get(x.m.id)?.메모 || '' }));
    for (const e of 요약.판[판].엉뚱2) 쓰기(`| ${e.id} | ${e.학습자말} | ${e.받아적기} (${e.오류정도}) | ${e.답} | ${e.F} | ${e.G} | ${e.길} |`);
    // 두 검수자 일치
    let 같음 = 0; let 둘 = 0;
    for (const x of 줄) for (const 판본 of [1, 2]) { const a = 셈(값(페, x, 판본)); const b = 셈(값(지, x, 판본)); if (a && b) { 둘++; if (a === b) 같음++; } }
    쓰기(`\n두 검수자 판정이 같음: ${퍼(같음, 둘)} (${같음}/${둘})\n`);
    요약.판[판].일치 = { 같음, 둘 };
  }
  fs.writeFileSync(path.join(여기, '판정2결과.md'), `${출력.join('\n')}\n`);
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(path.join(작업, '판정2요약.json'), JSON.stringify(요약, null, 1));
  console.log(출력.join('\n'));
}

const [명령, 판인자, 셋째] = process.argv.slice(2);
if (명령 === '자료') await 자료(판인자, 셋째 ? [셋째] : undefined);
else if (명령 === 'gpt') await gpt(판인자);
else if (명령 === '집계') await 집계();
else if (명령 === '묶기') {
  // 채점에 쓰지 않는 칸(요청마다 붙은 사용량 · 이웃 점수)은 빼고 묶는다 — 차례당 값(USD) · 시간(ms)은 남긴다
  const 자료들 = Object.fromEntries(묶을파일.map((f) => [f, (jsonl(f) || []).map(({ 사용, 이웃, ...나머지 }) => 나머지)]));
  fs.writeFileSync(path.join(여기, '결과자료2.mjs'), `// 답 은행 시험 2판(2026-11-01) 원자료 — 판정2.mjs 묶기가 git 밖 .jsonl을 묶었다(손대지 않는다). 학생 정보 없음.\nexport default ${JSON.stringify(자료들)};\n`);
  console.log('결과자료2.mjs', 묶을파일.map((f) => `${f}:${(자료들[f] || []).length}`).join(' '));
}
else if (명령) { console.error('명령: 자료 <폴더> [A|B] | gpt <A|B> | 집계 | 묶기'); process.exit(1); }
