// 답 은행 3판 고르기(2026-11-01) — 2판 고르기(고르기2.mjs)에 「생성으로 넘길 말」의 기준을 더하고, 넘긴 차례는 그 자리에서 답을 만든다(생성.mjs).
// 은행은 은행3.mjs(다판을 보기 전에 확정). 고르기 모델 · 설정은 2판과 같다(GPT-6.1 Terra, 생각 끔). 시간은 성공한 요청만 잰다.
// 쓰는 법: node 고르기3.mjs --자료 C [--동시 3] [--이어서]   → 고르기3_<판>.jsonl(git 밖) — {id, 판단, 반응, 들은것, 확신, 글, ms, 생성ms?, USD}
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 키로부르기 } from '../../lib/오픈AI키.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';
import * as 은행 from './은행3.mjs';
import { 생성답 } from './생성.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : 기본; };
const 바탕 = (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 고르기모델 = 'gpt-6.1-terra';
const 변형번호 = (id) => createHash('sha1').update(id).digest()[0];

export const 고르기지시3 = [
  '너는 한국어 말하기 상황극 앱의 「답 고르기」 담당이다. 학습자(한국어를 배우는 외국인 초보, 대부분 몽골 사람)가 팬사인회에서 가상 아이돌 하온과 이야기한다.',
  '하온의 말은 미리 녹음해 둔 짧은 「반응」들을 이어 붙이고, 끝에 아직 못 들은 것을 묻는 질문을 프로그램이 붙여 만든다(이미 들은 것은 다시 묻지 않는다). 반응으로 자연스럽게 받기 어려운 말은 실시간 생성으로 넘긴다.',
  '학습자 말은 자동 받아쓰기를 거친 글이다. 외국인 억양 때문에 비슷한 소리의 다른 낱말로 바뀌거나(네 → 매, 볼로르 → 볼러), 받침 · 모음이 틀리거나, 일부가 빠질 수 있다. 소리가 비슷한 낱말을 떠올려 뜻을 짐작하되, 짐작이 서지 않으면 고르지 않는다. 문법 실수는 신경 쓰지 말고 뜻만 본다.',
  '할 일: 학습자 말에 담긴 것마다 그것을 받는 반응을 하나씩, 가장 중심인 것부터 최대 두 개 고른다(예: 이름을 말하고 칭찬도 했으면 [이름, 공통.칭찬]). 학습자의 질문이나 부탁은 꼭 그것을 받는 반응을 넣는다.',
  '판단은 셋 가운데 하나다.',
  '- 「고름」: 고른 반응만으로 학습자 말을 빠짐없이 자연스럽게 받을 수 있을 때.',
  '- 「생성」: 아래 경우에는 반응을 고르지 말고 생성으로 넘긴다. ① 구체적인 사실을 묻는 질문이라 반응의 일반적인 말로는 답이 안 될 때(이름을 맞게 썼는지 · 성형했는지 · 몇 시인지 · 무엇을 먹었는지 · 하온의 특정 노래 이야기처럼). ② 반응 목록에 없는 구체적인 부탁이 있을 때(부탁.사인덧붙임으로 받을 수 있는 하트 · 응원 문구 · 그림은 반응으로 받는다). ③ 맥락 밖 농담 · 엉뚱한 이야기 · 길고 복잡한 사연이라 두루뭉술한 반응이 어색해질 때. ④ 셋 이상이 섞여 반응 둘로는 중요한 것을 빠뜨리게 될 때.',
  '- 「되묻기」: 학습자가 다시 말해 달라고 했거나, 받아 적은 글로는 뜻을 알 수 없을 때. 학습자가 당황해 말을 잇지 못하는 것(어… 저기… 어떡해)은 되묻기 말고 공통.긴장으로 받는다.',
  '- 외국어와 한국어가 섞였으면 한국어 부분의 뜻으로 고른다. 「공통.한국어섞임」은 외국어와 같은 뜻을 한국어로도 말했을 때만 덧붙이고, 한국어가 이름 하나뿐이면 쓰지 않는다. 「공통.한국어아님」은 한국어가 전혀 없을 때만, 혼자 쓴다.',
  '- 「공통.맞장구」는 학습자가 새 이야기를 들려줬을 때만 쓴다.',
  '들은것: 학습자 말에 들어 있는 미션(이름 · 나라 · 좋아함(좋아하는 노래 · 무대) · 사인(사인 부탁) · 끝인사(고맙다 · 잘 있어요)). 반응을 고르지 않았어도 말했으면 넣는다 — 하온이 다시 묻지 않게. 생성으로 넘길 때도 채운다.',
  '확신: 네 판단이 맞을 가능성(0~1). 판단이 고름이 아니면 반응은 빈 배열.',
].join('\n');

export function 고르기본문3(말) {
  const d = 단계[말.단계];
  const 목록 = 은행.고를반응(말.단계);
  const 줄 = 목록.map((r) => `- ${r.id} — ${r.뜻} / 예: ${r.예시.join(' · ')} / 하온 반응 예: 「${r.예}」`).join('\n');
  return {
    model: 고르기모델, max_output_tokens: 600, reasoning: { effort: 'none' },
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: 고르기지시3 }] },
      { role: 'user', content: [{ type: 'input_text', text: `지금 순간: ${d.상황}\n하온이 방금 한 말: 「${d.앞말}」\n\n반응(id — 학습자 말의 뜻 / 학습자 말 예 / 하온 반응 예):\n${줄}\n\n받아 적은 학습자 말: 「${말.받아적기}」` }] },
    ],
    text: { format: { type: 'json_schema', name: 'reply_pick_v3', strict: true, schema: {
      type: 'object', additionalProperties: false, required: ['판단', '반응', '들은것', '확신'],
      properties: { 판단: { type: 'string', enum: ['고름', '되묻기', '생성'] }, 반응: { type: 'array', items: { type: 'string', enum: 목록.map((r) => r.id) } }, 들은것: { type: 'array', items: { type: 'string', enum: 은행.들을미션 } }, 확신: { type: 'number' } },
    } } },
  };
}

async function 잰부르기(만들기) {
  let 시작 = 0; let 끝 = 0;
  const { res, 키 } = await 키로부르기(async (v) => { 시작 = Date.now(); const r = await fetch(...만들기(v)); 끝 = Date.now(); return r; });
  return { 답: await res.json(), 키, ms: 끝 - 시작 };
}

export async function AI고르기3(말) {
  for (let 회 = 1; ; 회++) {
    try {
      const { 답, 키, ms } = await 잰부르기((v) => [`${바탕}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...고르기본문3(말), safety_identifier: 'synk-roleplay-banktest' }) }]);
      const o = JSON.parse(출력글(답) || '{}');
      if (!['고름', '되묻기', '생성'].includes(o.판단)) throw new Error(`판단 없음 ${JSON.stringify(o).slice(0, 80)}`);
      const 반응 = o.판단 === '고름' ? [...new Set(o.반응 || [])].slice(0, 은행.최대반응) : [];
      return { 판단: 반응.length || o.판단 !== '고름' ? o.판단 : '생성', 반응, 들은것: [...new Set(o.들은것 || [])], 확신: o.확신, ms, USD: 글값(고르기모델, 답.usage), 키 };
    } catch (e) {
      const 초 = /try again in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/.exec(e.본문 || '');
      const 기다림 = 초 ? (Number(초[1] || 0) * 3600 + Number(초[2] || 0) * 60 + Number(초[3] || 0)) : 2 * 회;
      if (회 >= 6 || e.상태 === 400 || 기다림 > 120) return { 오류: String(e.message).slice(0, 160) };
      await new Promise((r) => setTimeout(r, 기다림 * 1000 + 500));
    }
  }
}

/** 한 차례 끝까지 — 고르기 → (고름) 조립 · (되묻기) 되묻기 줄 · (생성) 생성.mjs */
export async function 한차례3(말, 변형 = 변형번호(말.id)) {
  const r = await AI고르기3(말);
  if (r.오류) return r;
  if (r.판단 === '고름') return { ...r, 글: 은행.조립(말.단계, r.반응, 변형, r.들은것).글 };
  if (r.판단 === '되묻기') { const 줄 = 은행.되묻기(말.단계); return { ...r, 글: 줄[변형 % 줄.length] }; }
  for (let 회 = 1; ; 회++) {
    try { const g = await 생성답(은행, 말, r.들은것); return { ...r, ...g, 생성: true, USD: (r.USD || 0) + (g.생성USD || 0) }; }
    catch (e) { if (회 >= 4) return { ...r, 생성오류: String(e.message).slice(0, 120) }; await new Promise((ok) => setTimeout(ok, 3000 * 회)); }
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === '고르기3.mjs') {
  const 판 = 인자('--자료', 'C');
  const 자료 = (await import(pathToFileURL(path.join(여기, `학습자말${판 === 'A' ? '' : 판}.mjs`)).href)).default;
  const 파일 = path.join(여기, `고르기3_${판}.jsonl`);
  const 앞 = process.argv.includes('--이어서') && fs.existsSync(파일) ? new Map(fs.readFileSync(파일, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => !r.오류 && !r.생성오류).map((r) => [r.id, r])) : new Map();
  const 진행 = path.join(여기, `고르기3_${판}.진행.jsonl`);
  fs.writeFileSync(진행, '');
  const 새 = new Map(); const 대상 = 자료.filter((m) => !앞.has(m.id)); let 다음 = 0;
  await Promise.all(Array.from({ length: Number(인자('--동시', 3)) }, async () => {
    while (다음 < 대상.length) { const m = 대상[다음++]; const r = { id: m.id, ...(await 한차례3(m)) }; 새.set(m.id, r); fs.appendFileSync(진행, `${JSON.stringify(r)}\n`); }
  }));
  const 결과 = 자료.map((m) => 앞.get(m.id) || 새.get(m.id));
  fs.writeFileSync(파일, 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const 됨 = 결과.filter((r) => !r.오류);
  const 중앙 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  console.log(JSON.stringify({ 판, 줄: 결과.length, 오류: 결과.length - 됨.length, 생성오류: 결과.filter((r) => r.생성오류).length,
    판단: 됨.reduce((o, r) => (o[r.판단] = (o[r.판단] || 0) + 1, o), {}), 고르기ms중앙: 중앙(됨.map((r) => r.ms)), 생성ms중앙: 중앙(됨.map((r) => r.생성ms)),
    차례당USD: Number((됨.reduce((s, r) => s + (r.USD || 0), 0) / 됨.length).toFixed(6)), 키: [...new Set(됨.map((r) => r.키).filter(Boolean))] }, null, 1));
}
