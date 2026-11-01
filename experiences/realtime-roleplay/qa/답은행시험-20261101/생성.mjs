// 답 은행 시험 3판(2026-11-01) — 고르기가 「생성」으로 넘긴 차례에 실제 하온 답을 만든다(2판 · 3판이 같이 쓴다).
// 2판까지는 생성 차례를 「필요 · 불필요」로만 셌다. 3판은 구체적인 질문 · 덧붙인 부탁을 일부러 생성으로 넘기므로, 학습자가 실제로 듣는 답 전체를
// 판정하려고 넘긴 차례도 답을 만들어 같이 매긴다. 말투는 시제품 지시문(../../lib/장면.mjs)과 같고, 끝에는 은행과 같은 규칙의 다음 질문을 붙이게 한다.
// 쓰는 법: node 생성.mjs <고르기 결과 .jsonl> <은행 판본 2|3> [--자료 C]   → 같은 파일의 생성 줄에 글 · 생성ms · 생성USD를 채운다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 응답부르기 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 팬사인회, 지시문 } from '../../lib/장면.mjs';
import { 단계 } from './단계.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 생성모델 = 'gpt-6.1-terra';
const 이끔순서 = ['이름', '나라', '좋아함', '사인'];

/** 은행 판본의 미션 규칙으로 다음에 물을 말 — 끝 · 작별뒤는 마무리 · 작별, 다 들었으면 사인 끝 */
export function 다음질문(은행, 단계id, 들은 = []) {
  if (단계id === '끝') return 은행.이끔.마무리짧게[0];
  if (단계id === '작별뒤') return 은행.이끔.작별[0];
  const 끝난 = new Set([...은행.끝난미션[단계id], ...들은]);
  const 다음 = 이끔순서.find((m) => !끝난.has(m));
  return 다음 ? 은행.이끔[다음][0] : 은행.이끔.사인끝[0];
}

export async function 생성답(은행, 말, 들은 = []) {
  const d = 단계[말.단계];
  const 이을말 = 다음질문(은행, 말.단계, 들은);
  const 본문 = {
    model: 생성모델, reasoning: { effort: 'none' }, max_output_tokens: 300,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: `${지시문(팬사인회)}\n이번 차례는 학습자 말에 맞게 한두 문장으로 짧게 받고, 끝에 「${이을말}」로 이어 간다(뜻이 같으면 조금 바꿔 말해도 된다). 학습자가 이미 말한 것은 다시 묻지 않는다. 하온의 말만 쓴다.` }] },
      { role: 'user', content: [{ type: 'input_text', text: `지금 순간: ${d.상황}\n하온이 방금 한 말: 「${d.앞말}」\n학습자가 방금 한 말(자동 받아쓰기): 「${말.받아적기}」` }] },
    ],
  };
  const 시작 = Date.now();
  const { 답 } = await 응답부르기({ ...본문 });
  return { 글: 출력글(답).trim().replace(/^하온\s*:\s*/, '').replace(/^「|」$/g, ''), 생성ms: Date.now() - 시작, 생성USD: 글값(생성모델, 답.usage) };
}

if (process.argv[1] && path.basename(process.argv[1]) === '생성.mjs') {
  const [파일, 판본] = process.argv.slice(2);
  const 판 = process.argv.includes('--자료') ? process.argv[process.argv.indexOf('--자료') + 1] : 'C';
  const 은행 = await import(pathToFileURL(path.join(여기, 판본 === '3' ? '은행3.mjs' : '은행2.mjs')).href);
  const 자료 = (await import(pathToFileURL(path.join(여기, `학습자말${판}.mjs`)).href)).default;
  const 말들 = new Map(자료.map((m) => [m.id, m]));
  const 줄 = fs.readFileSync(path.join(여기, 파일), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  let n = 0;
  for (const r of 줄) {
    if (r.판단 !== '생성' || r.글) continue;
    for (let 회 = 1; ; 회++) {
      try { Object.assign(r, await 생성답(은행, 말들.get(r.id), r.들은것 || []), { 생성: true }); n++; break; }
      catch (e) { if (회 >= 4) { r.생성오류 = String(e.message).slice(0, 120); break; } await new Promise((ok) => setTimeout(ok, 3000 * 회)); }
    }
  }
  fs.writeFileSync(path.join(여기, 파일), 줄.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(JSON.stringify({ 파일, 판본, 생성채움: n, 생성줄: 줄.filter((r) => r.판단 === '생성').length, 오류: 줄.filter((r) => r.생성오류).length }));
}
