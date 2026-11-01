// 답 은행 시험 기준선(2026-11-01) — 다판 200줄에서 3판 · Gemini Live · 글 생성의 답을 A · B · C로 섞어(줄마다 순서가 다르다) 두 검수자에게 보인다.
// 은행 쪽만 매겨서는 엉뚱 5%가 어떤 잣대인지 모른다 — 같은 말 · 같은 기준 · 같은 블라인드로 세 프로그램을 나란히 잰다.
// 쓰는 법:
//   node 판정4.mjs 자료 <폴더>   → <폴더>/C<가|나|다>/자료.md (Fable 세 조)
//   node 판정4.mjs gpt           → 판정4_C_GPT.jsonl(git 밖)
//   node 판정4.mjs gpt구독       → 키 크레딧이 바닥나 빠진 줄만 Codex 구독 통로로 채운다
//   node 판정4.mjs 집계          → 판정4결과.md · .tmp/답은행시험-20261101/판정4요약.json
//   node 판정4.mjs 묶기          → 결과자료4.mjs(git 밖 기준선 · 판정 .jsonl을 커밋할 수 있게 하나로)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';
import { 앞대화 } from './기준선.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 작업 = path.resolve(여기, '../../../../.tmp/답은행시험-20261101');
const 기준 = fs.readFileSync(path.join(여기, '판정기준4.md'), 'utf8');
const 조들 = { 가: ['처음', '나라'], 나: ['좋아함', '사인'], 다: ['끝', '작별뒤'] };
const 팔들 = ['3판', '제미나이', '글'];
const 팔이름 = { '3판': '3판(답 은행)', 제미나이: 'Gemini Live', 글: '글 생성' };
const 글자들 = ['A', 'B', 'C'];
const 묶음자료 = fs.existsSync(path.join(여기, '결과자료4.mjs')) ? (await import(pathToFileURL(path.join(여기, '결과자료4.mjs')).href)).default : {};
const 묶음자료3 = fs.existsSync(path.join(여기, '결과자료3.mjs')) ? (await import(pathToFileURL(path.join(여기, '결과자료3.mjs')).href)).default : {};
const jsonl = (f) => (fs.existsSync(path.join(여기, f)) ? fs.readFileSync(path.join(여기, f), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : 묶음자료[f] || 묶음자료3[f] || null);
const 묶을파일 = ['기준선_제미나이_C.jsonl', '기준선_글_C.jsonl', '판정4_C_페이블.jsonl', '판정4_C_GPT.jsonl'];
const 자료 = (await import(pathToFileURL(path.join(여기, '학습자말C.mjs')).href)).default;

// 줄마다 A · B · C 순서가 다르다 — 해시 순으로 늘어놓고 여섯 순서를 돌려 맡겨 글자마다 세 프로그램이 같은 수로 온다
const 순서들 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const 줄지문 = (id) => createHash('sha1').update(`${id}|ABC4`).digest('hex');
const 차례표 = new Map(자료.map((m) => m.id).sort((a, b) => 줄지문(a).localeCompare(줄지문(b))).map((id, i) => [id, 순서들[i % 6]]));
/** 글자 → 팔 */
export function 차림(id) { return Object.fromEntries(글자들.map((g, i) => [g, 팔들[차례표.get(id)[i]]])); }
function 답표() {
  const 표 = {
    '3판': new Map(jsonl('고르기3_C.jsonl').map((r) => [r.id, { 글: r.글 || '', 길: r.판단 === '고름' ? '은행' : r.판단 }])),
    제미나이: new Map(jsonl('기준선_제미나이_C.jsonl').map((r) => [r.id, { 글: r.글 || '', 길: '생성' }])),
    글: new Map(jsonl('기준선_글_C.jsonl').map((r) => [r.id, { 글: r.글 || '', 길: '생성' }])),
  };
  for (const [팔, m] of Object.entries(표)) { const 빈 = 자료.filter((x) => !m.get(x.id)?.글).map((x) => x.id); if (빈.length) throw new Error(`${팔} 답이 빈 줄 ${빈.length}: ${빈.slice(0, 5).join(' ')}`); }
  return 표;
}
function 묶음() {
  const 표 = 답표();
  return 자료.map((m) => { const c = 차림(m.id); return { m, 차림: c, 답: Object.fromEntries(글자들.map((g) => [g, 표[c[g]].get(m.id)])) }; });
}
const 말글 = ({ m, 답 }) => `- id: ${m.id}\n  학습자말: 「${m.학습자말}」\n  뜻: ${m.뜻}\n  받아적기: 「${m.받아적기}」\n${글자들.map((g) => `  ${g}: 「${답[g].글}」`).join('\n')}`;
const 앞글 = (s) => 앞대화(s).map((t) => `${t.누가 === '나' ? '학습자' : '하온'}: ${t.글}`).join(' / ');
const 순간글 = (s) => `## 순간 「${s}」\n상황: ${단계[s].상황}\n앞 대화: ${앞글(s)}`;

function 자료만들기(폴더) {
  const 줄 = 묶음();
  for (const [조, 순간들] of Object.entries(조들)) {
    const 내 = 줄.filter((x) => 순간들.includes(x.m.단계));
    const 글 = [기준, '---', ...순간들.map((s) => `${순간글(s)}\n\n${내.filter((x) => x.m.단계 === s).map(말글).join('\n')}`)].join('\n\n');
    fs.mkdirSync(path.join(폴더, `C${조}`), { recursive: true });
    fs.writeFileSync(path.join(폴더, `C${조}`, '자료.md'), 글);
    console.log(`C${조}: ${내.length}줄`);
  }
}

async function gpt(동시 = 3) {
  const 줄 = 묶음(); const 결과 = new Array(줄.length); let 다음 = 0;
  const 칸 = { type: 'string', enum: ['자연', '어색'] };
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 줄.length) {
      const i = 다음++; const x = 줄[i];
      const 본문 = {
        model: 'gpt-6.1-terra', reasoning: { effort: 'medium' }, max_output_tokens: 3000,
        input: [{ role: 'developer', content: [{ type: 'input_text', text: 기준 }] }, { role: 'user', content: [{ type: 'input_text', text: `${순간글(x.m.단계)}\n\n${말글(x)}` }] }],
        text: { format: { type: 'json_schema', name: 'blind_judge4', strict: true, schema: { type: 'object', additionalProperties: false, required: ['A', 'B', 'C', '평범', '받아적기로뜻앎', '메모'], properties: { A: 칸, B: 칸, C: 칸, 평범: { type: 'boolean' }, 받아적기로뜻앎: { type: 'boolean' }, 메모: { type: 'string' } } } } },
      };
      for (let 회 = 1; ; 회++) {
        try { const { 답 } = await 응답부르기(본문); const o = JSON.parse(출력글(답) || '{}'); if (!o.A || !o.B || !o.C) throw new Error('A · B · C 없음'); 결과[i] = { id: x.m.id, ...o, USD: 글값('gpt-6.1-terra', 답.usage) }; break; }
        catch (e) { if (회 >= 4 || e.상태 === 400) { 결과[i] = { id: x.m.id, 오류: String(e.message).slice(0, 160) }; break; } await new Promise((r) => setTimeout(r, 4000 * 회)); }
      }
    }
  }));
  fs.writeFileSync(path.join(여기, '판정4_C_GPT.jsonl'), 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(JSON.stringify({ 줄: 결과.length, 오류: 결과.filter((r) => r.오류).length, USD: Number(결과.reduce((s, r) => s + (r.USD || 0), 0).toFixed(3)) }));
}

/** 키 크레딧이 바닥나 빠진 줄만 구독 통로(Codex CLI)의 같은 모델로 매겨 채운다 — 값이 따로 나가지 않는 길. 같은 기준 · 같은 글이고 묶어서 한 번에 부른다 */
function gpt구독() {
  const 파일 = path.join(여기, '판정4_C_GPT.jsonl');
  const 앞 = jsonl('판정4_C_GPT.jsonl');
  const 빠진 = new Set(앞.filter((r) => r.오류).map((r) => r.id));
  const 줄 = 묶음().filter((x) => 빠진.has(x.m.id));
  if (!줄.length) { console.log('빠진 줄 없음'); return; }
  const 순간들 = [...new Set(줄.map((x) => x.m.단계))];
  const 지시 = [기준, '---', '아래 모든 id를 매겨 「판정」 배열로 낸다. 파일을 읽거나 쓰지 말고 이 글만 본다.', ...순간들.map((s) => `${순간글(s)}\n\n${줄.filter((x) => x.m.단계 === s).map(말글).join('\n')}`)].join('\n\n');
  const 칸 = { type: 'string', enum: ['자연', '어색'] };
  const 꼴 = { type: 'object', additionalProperties: false, required: ['판정'], properties: { 판정: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'A', 'B', 'C', '평범', '받아적기로뜻앎', '메모'], properties: { id: { type: 'string' }, A: 칸, B: 칸, C: 칸, 평범: { type: 'boolean' }, 받아적기로뜻앎: { type: 'boolean' }, 메모: { type: 'string' } } } } } };
  const 빈 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-판정4-'));
  const 꼴파일 = path.join(빈, '꼴.json'); const 답파일 = path.join(빈, '답.json');
  fs.writeFileSync(꼴파일, JSON.stringify(꼴));
  const r = spawnSync(process.execPath, [path.resolve(여기, '../../../../tools/codex계정.js'), 'exec', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only', '-C', 빈, '--output-schema', 꼴파일, '-o', 답파일, '-m', 'gpt-6.1-terra', '-c', 'model_reasoning_effort="medium"', '-'], { input: 지시, encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  if (!fs.existsSync(답파일)) { console.error(String(r.stderr || r.stdout).slice(-1500)); throw new Error(`Codex 답 파일이 없다(종료 ${r.status})`); }
  const 답 = new Map(JSON.parse(fs.readFileSync(답파일, 'utf8')).판정.map((o) => [o.id, o]));
  const 없음 = [...빠진].filter((id) => !답.get(id));
  if (없음.length) throw new Error(`답에 없는 id ${없음.length}: ${없음.slice(0, 5).join(' ')}`);
  fs.writeFileSync(파일, `${앞.map((x) => JSON.stringify(빠진.has(x.id) ? { ...답.get(x.id), 통로: 'Codex 구독' } : x)).join('\n')}\n`);
  console.log(JSON.stringify({ 채움: 빠진.size }));
}

function 집계() {
  const 줄 = 묶음();
  const 페 = new Map((jsonl('판정4_C_페이블.jsonl') || []).map((r) => [r.id, r]));
  const 지 = new Map((jsonl('판정4_C_GPT.jsonl') || []).filter((r) => !r.오류).map((r) => [r.id, r]));
  const 글자 = (x, 팔) => 글자들.find((g) => x.차림[g] === 팔);
  const 값 = (검, x, 팔) => 검.get(x.m.id)?.[글자(x, 팔)] ?? null;
  const 합 = (a, b, 판) => { if (!a || !b) return null; if (판 === '엄격') return a === '자연' && b === '자연' ? '자연' : '어색'; return a === '자연' || b === '자연' ? '자연' : '어색'; };
  const 판정 = (x, 팔, 검판) => { const a = 값(페, x, 팔); const b = 값(지, x, 팔); return 검판 === '페이블' ? a : 검판 === 'GPT' ? b : 합(a, b, 검판); };
  const 표 = (팔, 걸름 = () => true) => Object.fromEntries(['페이블', 'GPT', '엄격', '너그러움'].map((검판) => {
    const c = { 자연: 0, 어색: 0, n: 0 };
    for (const x of 줄.filter(걸름)) { const v = 판정(x, 팔, 검판); if (!v) continue; c[v]++; c.n++; }
    return [검판, c];
  }));
  const 퍼 = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
  const 출력 = []; const 쓰기 = (s = '') => 출력.push(s);
  const 요약 = { 때: new Date().toISOString(), 팔: {} };
  쓰기(`# 답 은행 시험 기준선 블라인드 판정 결과 (${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)} 한국 시각)\n`);
  쓰기('다판 200줄. 3판(답 은행) · Gemini Live(매 차례 생성, 입력은 받아 적은 글) · 글 생성(GPT-6.1 Terra 생각 끔, 같은 지시문)의 답을 A · B · C로 섞어 매겼다. 셈: 자연 = 맞게 받음, 어색 = 엉뚱. 기준: 맞게 받음 80% 이상 · 엉뚱 5% 이하.\n');
  쓰기('| 프로그램 · 정답 판 | 줄 | 맞게 받음 | 엉뚱 |\n|---|---|---|---|');
  for (const 팔 of 팔들) {
    const t = 표(팔);
    for (const [검판, c] of Object.entries(t)) 쓰기(`| ${팔이름[팔]} · ${검판} | ${c.n} | **${퍼(c.자연, c.n)}** | **${퍼(c.어색, c.n)}** |`);
    요약.팔[팔] = { 전체: t, 평범: 표(팔, (x) => 페.get(x.m.id)?.평범 === true), 예외: 표(팔, (x) => 페.get(x.m.id)?.평범 === false),
      순간별: Object.fromEntries(['처음', '나라', '좋아함', '사인', '끝', '작별뒤'].map((s) => [s, 표(팔, (x) => x.m.단계 === s)])),
      오류별: Object.fromEntries(['없음', '가벼움', '심함'].map((e) => [e, 표(팔, (x) => x.m.오류정도 === e)])) };
  }
  쓰기('\n갈래별 엉뚱(Fable · GPT)\n');
  쓰기(`| 갈래 | ${팔들.map((팔) => 팔이름[팔]).join(' | ')} |\n|---|${팔들.map(() => '---').join('|')}|`);
  const 갈래줄 = (이름, f) => 쓰기(`| ${이름} | ${팔들.map((팔) => { const c = f(요약.팔[팔]); return `${퍼(c.페이블.어색, c.페이블.n)} · ${퍼(c.GPT.어색, c.GPT.n)}`; }).join(' | ')} |`);
  갈래줄(`평범한 답(${요약.팔['3판'].평범.페이블.n}줄)`, (p) => p.평범);
  갈래줄(`예외인 말(${요약.팔['3판'].예외.페이블.n}줄)`, (p) => p.예외);
  for (const e of ['없음', '가벼움', '심함']) 갈래줄(`받아 적기 오류 ${e}(${요약.팔['3판'].오류별[e].페이블.n}줄)`, (p) => p.오류별[e]);
  for (const s of ['처음', '나라', '좋아함', '사인', '끝', '작별뒤']) 갈래줄(`순간 ${s}(${요약.팔['3판'].순간별[s].페이블.n}줄)`, (p) => p.순간별[s]);
  // 조건을 맞춘 견줌 — 생성 쪽만 불리한 두 가지(입력이 틀린 받아 적기 · 작별 줄 되풀이)를 뺀다. 실제 Live는 소리를 직접 듣고, 되풀이는 지시문 한 줄의 문제다
  const 조건들 = { '작별뒤 뺌': (x) => x.m.단계 !== '작별뒤', '오류 없음': (x) => x.m.오류정도 === '없음', '오류 없음 + 작별뒤 뺌': (x) => x.m.오류정도 === '없음' && x.m.단계 !== '작별뒤' };
  요약.조건 = Object.fromEntries(Object.entries(조건들).map(([이름, f]) => [이름, Object.fromEntries(팔들.map((팔) => [팔, 표(팔, f)]))]));
  쓰기('\n조건을 맞춘 견줌 — 엉뚱(Fable · GPT)\n');
  쓰기(`| 조건 | ${팔들.map((팔) => 팔이름[팔]).join(' | ')} |\n|---|${팔들.map(() => '---').join('|')}|`);
  for (const [이름, t] of Object.entries(요약.조건)) 쓰기(`| ${이름}(${t['3판'].페이블.n}줄) | ${팔들.map((팔) => `${퍼(t[팔].페이블.어색, t[팔].페이블.n)} · ${퍼(t[팔].GPT.어색, t[팔].GPT.n)}`).join(' | ')} |`);
  // 어떤 쪽이 어색했는가 — 같은 줄끼리 견준다(둘 다 어색이면 은행 탓이 아니라 말이 어려운 줄)
  const 견줌 = (팔, 검) => { const o = { 은행만어색: 0, 상대만어색: 0, 둘다어색: 0 }; for (const x of 줄) { const a = 값(검, x, '3판'); const b = 값(검, x, 팔); if (!a || !b) continue; if (a === '어색' && b === '어색') o.둘다어색++; else if (a === '어색') o.은행만어색++; else if (b === '어색') o.상대만어색++; } return o; };
  요약.견줌 = Object.fromEntries(['제미나이', '글'].map((팔) => [팔, { 페이블: 견줌(팔, 페), GPT: 견줌(팔, 지) }]));
  쓰기('\n같은 줄끼리 3판과 견줌(줄 수) — 3판만 어색 · 상대만 어색 · 둘 다 어색\n');
  for (const 팔 of ['제미나이', '글']) { const j = 요약.견줌[팔]; 쓰기(`- ${팔이름[팔]}: Fable ${j.페이블.은행만어색} · ${j.페이블.상대만어색} · ${j.페이블.둘다어색} / GPT ${j.GPT.은행만어색} · ${j.GPT.상대만어색} · ${j.GPT.둘다어색}`); }
  const 어색목록 = (팔) => 줄.filter((x) => 값(페, x, 팔) === '어색' || 값(지, x, 팔) === '어색').map((x) => { const g = 글자(x, 팔); return { id: x.m.id, 학습자말: x.m.학습자말, 받아적기: x.m.받아적기, 오류정도: x.m.오류정도, 답: x.답[g].글, 길: x.답[g].길, F: 값(페, x, 팔), G: 값(지, x, 팔), 메모F: 페.get(x.m.id)?.메모 || '', 메모G: 지.get(x.m.id)?.메모 || '' }; });
  요약.어색 = Object.fromEntries(팔들.map((팔) => [팔, 어색목록(팔)]));
  for (const 팔 of 팔들) {
    쓰기(`\n${팔이름[팔]} 답을 하나라도 어색하다고 본 줄 ${요약.어색[팔].length}개\n`);
    쓰기('| id | 받아적기(오류) | 답 | Fable | GPT |\n|---|---|---|---|---|');
    for (const e of 요약.어색[팔]) 쓰기(`| ${e.id} | ${e.받아적기} (${e.오류정도}) | ${e.답} | ${e.F} | ${e.G} |`);
  }
  let 같음 = 0; let 둘 = 0;
  for (const x of 줄) for (const 팔 of 팔들) { const a = 값(페, x, 팔); const b = 값(지, x, 팔); if (a && b) { 둘++; if (a === b) 같음++; } }
  쓰기(`\n두 검수자 판정이 같음: ${퍼(같음, 둘)} (${같음}/${둘})`);
  요약.일치 = { 같음, 둘 };
  fs.writeFileSync(path.join(여기, '판정4결과.md'), `${출력.join('\n')}\n`);
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(path.join(작업, '판정4요약.json'), JSON.stringify(요약, null, 1));
  console.log(출력.slice(0, 36).join('\n'));
}

if (process.argv[1] && path.basename(process.argv[1]) === '판정4.mjs') {
  const [명령, 인자1] = process.argv.slice(2);
  if (명령 === '자료') 자료만들기(인자1);
  else if (명령 === 'gpt') await gpt();
  else if (명령 === 'gpt구독') gpt구독();
  else if (명령 === '집계') 집계();
  else if (명령 === '묶기') {
    const 자료들 = Object.fromEntries(묶을파일.map((f) => [f, (jsonl(f) || []).map(({ USD, ...나머지 }) => 나머지)]));
    fs.writeFileSync(path.join(여기, '결과자료4.mjs'), `// 답 은행 시험 기준선(2026-11-01) 원자료 — 판정4.mjs 묶기가 git 밖 .jsonl을 묶었다(손대지 않는다). 학생 정보 없음.\nexport default ${JSON.stringify(자료들)};\n`);
    console.log('결과자료4.mjs', 묶을파일.map((f) => `${f}:${(자료들[f] || []).length}`).join(' '));
  } else { console.error('명령: 자료 <폴더> | gpt | 집계 | 묶기'); process.exit(1); }
}
