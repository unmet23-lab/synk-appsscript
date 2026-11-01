// 답 은행 2판 고르기(2026-11-01) — 받아 적은 글만 보고 반응(최대 둘)을 고르고 은행2.조립으로 하온 답을 만든다.
// 두 길: ① AI 고르기 — GPT-6.1 Terra 생각 끔(1판과 같은 모델 · 같은 OpenAI) ② 빠른 길 — 임베딩(text-embedding-3-large)으로 가장 가까운
// 반응 예시를 찾아, 확실할 때만(문턱은 가판에서 AI 고르기와 맞춰 정함 — 빠른길.mjs) 바로 쓰고, 아니면 AI 고르기로 넘긴다.
// 시간(ms)은 성공한 요청 하나만 잰다 — 키 차례가 크레딧이 바닥난 앞 조직을 두드리고 넘어가는 헛걸음은 뺀다(1판 고르기.mjs의 ms에는 섞여 있었다).
// 쓰는 법:
//   node 고르기2.mjs --자료 A|B --길 AI|빠른 [--동시 3] [--이어서]   → 고르기2_<자료>_<길>.jsonl(git 밖)
//   node 고르기2.mjs --재기            → 가판 AI 결과와 빠른 길을 맞춰 문턱을 정하고 빠른길.mjs를 쓴다(나판은 보지 않는다)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 키로부르기 } from '../../lib/오픈AI키.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 단계 } from './단계.mjs';
import { 반응들, 고를반응, 조립, 되묻기, 최대반응, 들을미션 } from './은행2.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 작업 = path.resolve(여기, '../../../../.tmp/답은행시험-20261101');
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : 기본; };
const 바탕 = (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 고르기모델 = 'gpt-6.1-terra';
const 임베딩모델 = 'text-embedding-3-large';
const 임베딩값 = 0.13e-6; // USD / 토큰(공개 값표 — 차례당 10토큰 안팎이라 0.000002 USD 아래)

export const 자료읽기 = async (판) => (await import(pathToFileURL(path.join(여기, 판 === 'B' ? '학습자말B.mjs' : '학습자말.mjs')).href)).default;
export const 변형번호 = (id) => createHash('sha1').update(id).digest()[0];

/** 성공한 요청 하나의 시간을 잰다 — 키로부르기가 앞 키를 넘기는 동안의 시간은 빼고 마지막 시도만 */
async function 잰부르기(만들기) {
  let 시작 = 0; let 끝 = 0;
  const { res, 키 } = await 키로부르기(async (v) => { 시작 = Date.now(); const r = await fetch(...만들기(v)); 끝 = Date.now(); return r; });
  const 답 = await res.json();
  return { 답, 키, ms: 끝 - 시작 };
}

// ── AI 고르기 ──
export const 고르기지시2 = [
  '너는 한국어 말하기 상황극 앱의 「답 고르기」 담당이다. 학습자(한국어를 배우는 외국인 초보, 대부분 몽골 사람)가 팬사인회에서 가상 아이돌 하온과 이야기한다.',
  '하온의 말은 미리 녹음해 둔 짧은 「반응」들을 이어 붙이고, 끝에 아직 못 들은 것을 묻는 질문을 프로그램이 붙여 만든다(이미 들은 것은 다시 묻지 않는다).',
  '학습자 말은 자동 받아쓰기를 거친 글이다. 외국인 억양 때문에 비슷한 소리의 다른 낱말로 바뀌거나(네 → 매, 볼로르 → 볼러), 받침 · 모음이 틀리거나, 일부가 빠질 수 있다. 소리가 비슷한 낱말을 떠올려 뜻을 짐작하되, 짐작이 서지 않으면 고르지 않는다. 문법 실수는 신경 쓰지 말고 뜻만 본다.',
  '할 일: 학습자 말에 담긴 것마다 그것을 받는 반응을 하나씩, 가장 중심인 것부터 최대 두 개 고른다(예: 이름을 말하고 칭찬도 했으면 [이름, 공통.칭찬], 노래를 말하고 사인을 부탁했으면 [좋아함.노래, 부탁.사인]).',
  '- 학습자의 질문이나 부탁은 꼭 그것을 받는 반응을 넣는다. 무시하면 안 된다. 셋 이상이 섞였으면 질문 · 부탁과 중심 대답을 먼저 고른다.',
  '- 외국어와 한국어가 섞였으면 한국어 부분의 뜻으로 고르고, 「공통.한국어섞임」은 덧붙임으로만 쓴다. 「공통.한국어아님」은 한국어가 전혀 없을 때만, 혼자 쓴다.',
  '판단: 「고름」(반응을 골랐다) · 「되묻기」(학습자가 다시 말해 달라고 했거나, 받아 적은 글로는 뜻을 알 수 없음) · 「생성」(뜻은 분명한데 어느 반응으로도 자연스럽게 받을 수 없어 실시간 생성으로 넘김). 맞지 않는 반응이 나가는 것이 가장 나쁘다. 그래도 맞는 반응이 분명하면 망설이지 말고 고른다.',
  '들은것: 학습자 말에 들어 있는 미션(이름 · 나라 · 좋아함(좋아하는 노래 · 무대) · 사인(사인 부탁) · 끝인사(고맙다 · 잘 있어요)). 반응을 고르지 않았어도 말했으면 넣는다 — 하온이 다시 묻지 않게.',
  '확신: 네 판단이 맞을 가능성(0~1). 판단이 고름이 아니면 반응은 빈 배열.',
].join('\n');

export function 고르기본문2(말) {
  const d = 단계[말.단계];
  const 목록 = 고를반응(말.단계);
  const 줄 = 목록.map((r) => `- ${r.id} — ${r.뜻} / 예: ${r.예시.join(' · ')} / 하온 반응 예: 「${r.예}」`).join('\n');
  return {
    model: 고르기모델, max_output_tokens: 600, reasoning: { effort: 'none' },
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: 고르기지시2 }] },
      { role: 'user', content: [{ type: 'input_text', text: `지금 순간: ${d.상황}\n하온이 방금 한 말: 「${d.앞말}」\n\n반응(id — 학습자 말의 뜻 / 학습자 말 예 / 하온 반응 예):\n${줄}\n\n받아 적은 학습자 말: 「${말.받아적기}」` }] },
    ],
    text: { format: { type: 'json_schema', name: 'reply_pick_v2', strict: true, schema: {
      type: 'object', additionalProperties: false, required: ['판단', '반응', '들은것', '확신'],
      properties: { 판단: { type: 'string', enum: ['고름', '되묻기', '생성'] }, 반응: { type: 'array', items: { type: 'string', enum: 목록.map((r) => r.id) } }, 들은것: { type: 'array', items: { type: 'string', enum: 들을미션 } }, 확신: { type: 'number' } },
    } } },
  };
}

export async function AI고르기(말) {
  for (let 회 = 1; ; 회++) {
    try {
      const { 답, 키, ms } = await 잰부르기((v) => [`${바탕}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...고르기본문2(말), safety_identifier: 'synk-roleplay-banktest' }) }]);
      const o = JSON.parse(출력글(답) || '{}');
      if (!['고름', '되묻기', '생성'].includes(o.판단)) throw new Error(`판단 없음 ${JSON.stringify(o).slice(0, 80)}`);
      const 반응 = o.판단 === '고름' ? [...new Set(o.반응 || [])].slice(0, 최대반응) : [];
      return { 판단: 반응.length || o.판단 !== '고름' ? o.판단 : '생성', 반응, 들은것: [...new Set(o.들은것 || [])], 확신: o.확신, ms, 사용: 답.usage || null, USD: 글값(고르기모델, 답.usage), 키 };
    } catch (e) {
      const 초 = /try again in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/.exec(e.본문 || '');
      const 기다림 = 초 ? (Number(초[1] || 0) * 3600 + Number(초[2] || 0) * 60 + Number(초[3] || 0)) : 2 * 회;
      if (회 >= 6 || e.상태 === 400 || 기다림 > 120) return { 오류: String(e.message).slice(0, 160) };
      await new Promise((r) => setTimeout(r, 기다림 * 1000 + 500));
    }
  }
}

// ── 빠른 길: 임베딩 이웃 ──
export async function 임베딩(글들) {
  const { 답, ms } = await 잰부르기((v) => [`${바탕}/embeddings`, { method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 임베딩모델, input: 글들 }) }]);
  if (!답.data) throw new Error(`임베딩 실패 ${JSON.stringify(답).slice(0, 160)}`);
  return { 벡터: 답.data.sort((a, b) => a.index - b.index).map((d) => d.embedding), ms, 토큰: 답.usage?.total_tokens || 0 };
}
const 코사인 = (a, b) => { let s = 0; let na = 0; let nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / Math.sqrt(na * nb); };

// 예시 늘림(11-01): 은행2의 반응 예시는 3~6개라 이웃 찾기가 AI 고르기와 87~90%만 같았다 → 반응마다 학습자 말을 15개 더 만든다.
// 만드는 쪽은 은행 정의(뜻 · 예시 · 쓰는 순간)만 보고 시험 말(가판 · 나판)은 보지 않는다. 결과는 예시늘림_은행2.mjs(커밋).
export async function 예시늘리기(동시 = 3) {
  const 대상 = 반응들.filter((r) => !r.완결);
  const 결과 = {};
  let 다음 = 0;
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 대상.length) {
      const r = 대상[다음++];
      const 본문 = {
        model: 고르기모델, max_output_tokens: 1500, reasoning: { effort: 'low' },
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: '한국어를 배우는 외국인 초보(대부분 몽골 사람, TOPIK 1~2급)가 팬사인회에서 가상 아이돌 하온에게 할 법한 말을 만든다. 주어진 뜻 하나에 맞는 학습자 말을 15개, 서로 다르게 쓴다: 한두 낱말부터 한 문장까지, 문법이 조금 틀린 말 · 존댓말과 반말 · 머뭇거림을 섞는다. 다른 뜻(다른 부탁 · 질문 · 이름 · 나라)을 섞지 않는다. 실존 가수 이름은 그 뜻일 때만 쓴다.' }] },
          { role: 'user', content: [{ type: 'input_text', text: `뜻: ${r.뜻}\n예: ${r.예시.join(' · ')}\n쓰는 순간: ${(r.순간 || ['처음', '나라', '좋아함', '사인', '끝', '작별뒤']).join(' · ')}` }] },
        ],
        text: { format: { type: 'json_schema', name: 'paraphrases', strict: true, schema: { type: 'object', additionalProperties: false, required: ['말들'], properties: { 말들: { type: 'array', items: { type: 'string' } } } } } },
      };
      for (let 회 = 1; ; 회++) {
        try { const { 답 } = await 잰부르기((v) => [`${바탕}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...본문, safety_identifier: 'synk-roleplay-banktest' }) }]); 결과[r.id] = [...new Set(JSON.parse(출력글(답)).말들.map((t) => String(t).trim()).filter(Boolean))].slice(0, 15); break; }
        catch (e) { if (회 >= 4) { 결과[r.id] = []; console.error(r.id, e.message); break; } await new Promise((ok) => setTimeout(ok, 3000 * 회)); }
      }
    }
  }));
  const 글 = `// 고르기2.mjs --예시늘리기가 썼다(GPT-6.1 Terra, 은행2 정의만 보고 · 시험 말은 보지 않음). 빠른 길의 이웃 찾기 예시. 손대지 않는다.\nexport default ${JSON.stringify(결과, null, 1)};\n`;
  fs.writeFileSync(path.join(여기, '예시늘림_은행2.mjs'), 글);
  console.log('반응', Object.keys(결과).length, '예시', Object.values(결과).flat().length);
}

export async function 예시벡터() {
  const 파일 = path.join(작업, '임베딩_은행2.json');
  const 늘림파일 = path.join(여기, '예시늘림_은행2.mjs');
  const 늘림 = fs.existsSync(늘림파일) ? (await import(pathToFileURL(늘림파일).href)).default : {};
  const 쌍 = 반응들.flatMap((r) => [...r.예시, ...(늘림[r.id] || [])].map((t) => ({ id: r.id, 글: t })));
  const 지문 = createHash('sha1').update(JSON.stringify(쌍)).digest('hex');
  if (fs.existsSync(파일)) { const c = JSON.parse(fs.readFileSync(파일, 'utf8')); if (c.지문 === 지문) return c.예시; }
  const 벡터 = [];
  for (let i = 0; i < 쌍.length; i += 200) 벡터.push(...(await 임베딩(쌍.slice(i, i + 200).map((p) => p.글))).벡터);
  const 예시 = 쌍.map((p, i) => ({ ...p, v: 벡터[i] }));
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(파일, JSON.stringify({ 지문, 모델: 임베딩모델, 예시 }));
  return 예시;
}

/** 이웃 표 모으기 — 그 순간에 고를 수 있는 반응의 예시 가운데 가장 가까운 k개가 반응마다 낸 코사인 합. {첫째, 몫(첫째 합 / 전체 합), 첫점(첫째의 가장 큰 코사인), 둘째} */
export function 이웃(벡, 단계id, 예시, k = 8) {
  const 쓸 = new Set(고를반응(단계id).map((r) => r.id));
  const 가까움 = 예시.filter((e) => 쓸.has(e.id) && e.id !== '공통.한국어아님').map((e) => ({ id: e.id, s: 코사인(벡, e.v) })).sort((a, b) => b.s - a.s).slice(0, k);
  const 합 = {}; for (const g of 가까움) 합[g.id] = (합[g.id] || 0) + g.s;
  const 순 = Object.entries(합).sort((a, b) => b[1] - a[1]);
  const 전체 = 순.reduce((x, [, v]) => x + v, 0);
  return { 첫째: 순[0][0], 몫: 순[0][1] / 전체, 첫점: Math.max(...가까움.filter((g) => g.id === 순[0][0]).map((g) => g.s)), 둘째: 순[1]?.[0] || null };
}
export const 빠른가 = (n, 글, 문턱) => n.몫 >= 문턱.몫 && n.첫점 >= 문턱.점 && [...글].length <= 문턱.길이;

function 답글(말, 판단, 반응, 들은것 = []) {
  const 변 = 변형번호(말.id);
  if (판단 === '고름') return 조립(말.단계, 반응, 변, 들은것).글;
  if (판단 === '되묻기') { const 줄 = 되묻기(말.단계); return 줄[변 % 줄.length]; }
  return null;
}

async function 돌리기(판, 길, 동시, 이어서) {
  const 자료 = await 자료읽기(판);
  const 파일 = path.join(여기, `고르기2_${판}_${길}.jsonl`);
  const 앞 = 이어서 && fs.existsSync(파일) ? new Map(fs.readFileSync(파일, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => !r.오류).map((r) => [r.id, r])) : new Map();
  const 문턱 = 길 === '빠른' ? (await import(pathToFileURL(path.join(여기, '빠른길.mjs')).href)).default.문턱 : null; // qa의 .json은 git 밖이라 문턱은 모듈로 남긴다
  const 예시 = 길 === '빠른' ? await 예시벡터() : null;
  // 빠른 길이 못 받은 줄은 AI 고르기로 — 같은 판의 AI 결과(고르기2_<판>_AI.jsonl)가 있으면 그 판단을 그대로 쓴다(가판: 같은 판단을 두 번 사지 않게)
  const AI앞 = 길 === '빠른' && fs.existsSync(path.join(여기, `고르기2_${판}_AI.jsonl`))
    ? new Map(fs.readFileSync(path.join(여기, `고르기2_${판}_AI.jsonl`), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => !r.오류).map((r) => [r.id, r]))
    : new Map();
  const 진행 = path.join(여기, `고르기2_${판}_${길}.진행.jsonl`);
  fs.writeFileSync(진행, '');
  const 새 = new Map();
  const 대상 = 자료.filter((m) => !앞.has(m.id));
  let 다음 = 0;
  await Promise.all(Array.from({ length: 동시 }, async () => {
    while (다음 < 대상.length) {
      const m = 대상[다음++];
      let r;
      if (길 === '빠른') {
        try {
          const { 벡터: [벡], ms, 토큰 } = await 임베딩([m.받아적기]);
          const n = 이웃(벡, m.단계, 예시);
          if (빠른가(n, m.받아적기, 문턱)) r = { 경로: '빠른', 판단: '고름', 반응: [n.첫째], 확신: Number(n.첫점.toFixed(3)), 이웃: n, ms, USD: 토큰 * 임베딩값 };
          else {
            const 앞판단 = AI앞.get(m.id);
            const a = 앞판단 ? { 판단: 앞판단.판단, 반응: 앞판단.반응, 들은것: 앞판단.들은것, 확신: 앞판단.확신, ms: 앞판단.ms, 사용: 앞판단.사용, USD: 앞판단.USD, 키: 앞판단.키, 앞판단씀: true } : await AI고르기(m);
            r = { 경로: 'AI', ...a, 빠른ms: ms, 이웃: n, ms: a.ms != null ? a.ms + ms : undefined, USD: (a.USD || 0) + 토큰 * 임베딩값 };
          }
        } catch (e) { r = { 오류: String(e.message).slice(0, 160) }; }
      } else {
        r = { 경로: 'AI', ...(await AI고르기(m)) };
      }
      if (!r.오류) r.글 = 답글(m, r.판단, r.반응, r.들은것);
      r = { id: m.id, ...r };
      새.set(m.id, r);
      fs.appendFileSync(진행, `${JSON.stringify(r)}\n`);
    }
  }));
  const 결과 = 자료.map((m) => 앞.get(m.id) || 새.get(m.id));
  fs.writeFileSync(파일, 결과.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const 됨 = 결과.filter((r) => !r.오류);
  const ms = (f) => { const a = 됨.filter(f).map((r) => r.ms).filter((x) => x != null).sort((x, y) => x - y); return a.length ? { 중앙: a[Math.floor(a.length / 2)], 위10: a[Math.floor(a.length * 0.9)], n: a.length } : null; };
  console.log(JSON.stringify({ 판, 길, 줄: 결과.length, 오류: 결과.length - 됨.length, 빠른: 됨.filter((r) => r.경로 === '빠른').length,
    판단: 됨.reduce((o, r) => (o[r.판단] = (o[r.판단] || 0) + 1, o), {}), 시간: { 전체: ms(() => true), 빠른: ms((r) => r.경로 === '빠른'), AI: ms((r) => r.경로 === 'AI') },
    차례당USD: Number((됨.reduce((s, r) => s + (r.USD || 0), 0) / 됨.length).toFixed(6)), 키: [...new Set(됨.map((r) => r.키).filter(Boolean))] }, null, 1));
}

// ── 문턱 재기: 가판에서 AI 고르기가 반응 하나를 고른 줄과 빠른 길의 첫째가 같은지 ──
async function 재기() {
  const 자료 = await 자료읽기('A');
  const ai = new Map(fs.readFileSync(path.join(여기, '고르기2_A_AI.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).map((r) => [r.id, r]));
  const 예시 = await 예시벡터();
  const 줄 = [];
  for (let i = 0; i < 자료.length; i += 50) {
    const 묶 = 자료.slice(i, i + 50);
    const { 벡터 } = await 임베딩(묶.map((m) => m.받아적기));
    묶.forEach((m, j) => { const n = 이웃(벡터[j], m.단계, 예시); const a = ai.get(m.id); 줄.push({ id: m.id, 글: m.받아적기, n, ai: a }); });
  }
  // 안전: AI의 첫 반응과 같고, AI가 고른 둘째 반응이 없거나 빠져도 되는 덧붙임(칭찬 · 팬심 · 기쁨 · 사랑 · 긴장 · 한국어섞임)일 때.
  // AI가 되묻기 · 생성을 골랐거나, 둘째가 질문 · 부탁 · 대답이면 빠른 길이 받으면 안 되는 줄(틀림으로 셈).
  const 빠져도됨 = new Set(['공통.칭찬', '공통.팬심', '공통.기쁨', '공통.사랑', '공통.긴장', '공통.한국어섞임']);
  const 판정 = (x) => x.ai && x.ai.판단 === '고름' && x.ai.반응[0] === x.n.첫째 && (x.ai.반응.length === 1 || 빠져도됨.has(x.ai.반응[1]));
  const 후보 = [];
  for (const 몫 of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) for (const 점 of [0.4, 0.5, 0.55, 0.6, 0.65, 0.7]) for (const 길이 of [12, 20, 30, 999]) {
    const 받음 = 줄.filter((x) => 빠른가(x.n, x.글, { 몫, 점, 길이 }));
    const 맞음 = 받음.filter(판정).length;
    후보.push({ 문턱: { 몫, 점, 길이 }, 받음: 받음.length, 맞음, 정확: 받음.length ? 맞음 / 받음.length : 1 });
  }
  const 좋은 = 후보.filter((h) => h.정확 >= 0.97 && h.받음 >= 20).sort((a, b) => b.받음 - a.받음 || b.정확 - a.정확);
  const 고른 = 좋은[0] || 후보.sort((a, b) => b.정확 - a.정확 || b.받음 - a.받음)[0];
  fs.writeFileSync(path.join(여기, '빠른길.mjs'), `// 고르기2.mjs --재기가 썼다(손대지 않는다)
export default ${JSON.stringify({ 때: new Date().toISOString(), 기준: '가판에서 AI 고르기와 같은 비율 97% 이상 · 그중 가장 많이 받는 문턱', 문턱: 고른.문턱, 가판: { 받음: 고른.받음, 맞음: 고른.맞음, 정확: Number(고른.정확.toFixed(3)) }, 임베딩모델 }, null, 1)}\n`);
  console.log(JSON.stringify({ 고른, 다음후보: 좋은.slice(1, 6) }, null, 1));
}

if (process.argv[1] && path.basename(process.argv[1]) === '고르기2.mjs') {
  if (process.argv.includes('--재기')) await 재기();
  else if (process.argv.includes('--예시늘리기')) await 예시늘리기();
  else await 돌리기(인자('--자료', 'A'), 인자('--길', 'AI'), Number(인자('--동시', 3)), process.argv.includes('--이어서'));
}
