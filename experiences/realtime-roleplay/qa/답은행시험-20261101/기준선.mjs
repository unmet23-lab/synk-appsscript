// 답 은행 시험 기준선(2026-11-01) — 다판 200줄에 「매 차례 생성」 답을 만든다. 지금까지 은행 쪽만 매겨 엉뚱 5%가 어떤 잣대인지 몰랐다(유호님 「기준선부터 재 봐」).
// 두 길: 제미나이 = 시제품 기본 길 Gemini 3.8 Live(같은 지시문 · 같은 설정) · 글 = GPT-6.1 Terra 생각 끔(같은 지시문, 받아 적기 → 글 → 목소리 길).
// 입력은 은행과 같은 「받아 적은 글」이다 — 실제 Live는 소리를 직접 듣지만 몽골 학습자 소리는 아직 없다. 오류 없는 줄끼리 견주면 입력 차이가 빠진다.
// 줄마다 세션을 새로 열고, 앞 대화는 순간마다 정해 둔 모범 대화(장면 미션의 예문 + 그 순간까지의 앞말)로 넣어 실제로 이어 온 대화처럼 만든다.
// 쓰는 법: node 기준선.mjs <제미나이|글> [--자료 C] [--표본 6] [--동시 2] [--이어서]   → 기준선_<길>_<판>.jsonl(git 밖) — {id, 글, ms, 오류?}
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { 응답부르기, 제미나이설정 } from '../../lib/공급사.mjs';
import { 출력글 } from '../../lib/피드백.mjs';
import { 글값 } from '../../lib/예산.mjs';
import { 팬사인회, 지시문, 첫인사지시 } from '../../lib/장면.mjs';
import { 단계 } from './단계.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 인자 = (이름, 기본) => { const i = process.argv.indexOf(이름); return i > 0 ? process.argv[i + 1] : 기본; };
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 제미나이주소 = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const 글모델 = 'gpt-6.1-terra';
const 순서 = ['처음', '나라', '좋아함', '사인', '끝', '작별뒤'];
// 그 순간에 오기까지 학습자가 한 말 — 장면 미션의 예문
const 예문 = Object.fromEntries(팬사인회.미션.map((m) => [m.id, m.예문]));
const 앞학습자 = { 나라: 예문.이름, 좋아함: 예문.나라, 사인: 예문.좋아함, 끝: 예문.사인, 작별뒤: 예문.끝인사 };

/** 그 순간까지의 모범 대화 — [{누가: '상대'|'나', 글}], 끝은 하온의 앞말 */
export function 앞대화(단계id) {
  const 차례 = [{ 누가: '상대', 글: 단계.처음.앞말 }];
  for (const s of 순서.slice(1, 순서.indexOf(단계id) + 1)) 차례.push({ 누가: '나', 글: 앞학습자[s] }, { 누가: '상대', 글: 단계[s].앞말 });
  return 차례;
}

async function 글로(말) {
  const 본문 = {
    model: 글모델, reasoning: { effort: 'none' }, max_output_tokens: 300,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: `${지시문(팬사인회)}\n하온의 말만 쓴다.` }] },
      ...앞대화(말.단계).map((t) => ({ role: t.누가 === '나' ? 'user' : 'assistant', content: [{ type: t.누가 === '나' ? 'input_text' : 'output_text', text: t.글 }] })),
      { role: 'user', content: [{ type: 'input_text', text: 말.받아적기 }] },
    ],
  };
  const 시작 = Date.now();
  const { 답 } = await 응답부르기(본문);
  return { 글: 출력글(답).trim().replace(/^하온\s*:\s*/, ''), ms: Date.now() - 시작, USD: 글값(글모델, 답.usage) };
}

function 소켓열기(주소, 머리) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(주소, { headers: 머리 });
    ws.binaryType = 'arraybuffer'; // Gemini Live는 JSON을 이진 틀로 보낸다(현장 노트)
    ws.addEventListener('error', (e) => rej(new Error(`연결 실패 ${e?.message || ''}`)), { once: true });
    ws.addEventListener('open', () => res(ws), { once: true });
  });
}

/** 세션 하나 — 앞 대화를 글 차례로 넣고 받아 적은 말을 보낸 뒤 하온 차례가 끝날 때까지 자막을 모은다 */
async function 제미나이로(말, 키값) {
  const ws = await 소켓열기(제미나이주소, { 'x-goog-api-key': 키값 });
  let 글 = ''; let 첫소리 = null; let 시작 = 0; let 끝남 = false; let 준비 = false; let 오류 = null; let 닫힘 = null;
  ws.addEventListener('message', (ev) => {
    const e = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
    if (e.error) 오류 = JSON.stringify(e.error).slice(0, 200);
    if (e.setupComplete) 준비 = true;
    const sc = e.serverContent; if (!sc) return;
    if (sc.modelTurn?.parts?.some((p) => p.inlineData?.data)) 첫소리 ??= performance.now();
    if (sc.outputTranscription?.text) 글 += sc.outputTranscription.text;
    // 자막은 소리보다 먼저 다 온다(현장 노트) — 재생 속도로 흐르는 소리 끝(turnComplete)까지 기다리지 않고 생성이 끝나면 닫는다
    if (sc.turnComplete || sc.generationComplete) setTimeout(() => { 끝남 = true; }, 300);
  });
  ws.addEventListener('close', (ev) => { 닫힘 = `${ev.code} ${ev.reason || ''}`.trim(); });
  try {
    ws.send(JSON.stringify({ setup: 제미나이설정(팬사인회) }));
    for (const 기한 = performance.now() + 15000; !준비 && !오류 && !닫힘 && performance.now() < 기한;) await 쉼(20);
    if (!준비) throw new Error(`시작 안 됨: ${오류 || 닫힘 || '시간 초과'}`);
    const turns = [
      { role: 'user', parts: [{ text: 첫인사지시(팬사인회) }] },
      ...앞대화(말.단계).map((t) => ({ role: t.누가 === '나' ? 'user' : 'model', parts: [{ text: t.글 }] })),
      { role: 'user', parts: [{ text: 말.받아적기 }] },
    ];
    시작 = performance.now();
    ws.send(JSON.stringify({ clientContent: { turns, turnComplete: true } }));
    for (const 기한 = performance.now() + 30000; !끝남 && !오류 && !닫힘 && performance.now() < 기한;) await 쉼(20);
    if (!끝남) throw new Error(`답 끝 없음: ${오류 || 닫힘 || '시간 초과'}`);
    return { 글: 글.trim(), ms: 첫소리 ? Math.round(첫소리 - 시작) : null };
  } finally { try { ws.close(); } catch {} }
}

if (process.argv[1] && path.basename(process.argv[1]) === '기준선.mjs') {
  const 길 = process.argv[2];
  if (!['제미나이', '글'].includes(길)) { console.error('쓰는 법: node 기준선.mjs <제미나이|글> [--자료 C] [--표본 N] [--동시 N] [--이어서]'); process.exit(1); }
  const 판 = 인자('--자료', 'C');
  const 전체 = (await import(pathToFileURL(path.join(여기, `학습자말${판 === 'A' ? '' : 판}.mjs`)).href)).default;
  const 표본 = Number(인자('--표본', 0));
  const 자료 = 표본 ? 전체.filter((_, i) => i % Math.ceil(전체.length / 표본) === 0) : 전체;
  const 파일 = path.join(여기, `기준선_${길}_${판}${표본 ? '_표본' : ''}.jsonl`);
  const 앞 = process.argv.includes('--이어서') && fs.existsSync(파일) ? new Map(fs.readFileSync(파일, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => !r.오류 && r.글).map((r) => [r.id, r])) : new Map();
  const 키값 = 길 === '제미나이' ? createRequire(import.meta.url)(path.resolve(여기, '../../../../tools/모델정책.js')).제미나이키('글') : null;
  const 대상 = 자료.filter((m) => !앞.has(m.id)); const 새 = new Map(); let 다음 = 0;
  await Promise.all(Array.from({ length: Number(인자('--동시', 길 === '제미나이' ? 2 : 3)) }, async () => {
    while (다음 < 대상.length) {
      const m = 대상[다음++];
      let r;
      for (let 회 = 1; ; 회++) {
        try { r = { id: m.id, ...(await (길 === '글' ? 글로(m) : 제미나이로(m, 키값))) }; if (!r.글) throw new Error('빈 답'); break; }
        catch (e) { if (회 >= 5) { r = { id: m.id, 오류: String(e.message).slice(0, 200) }; break; } await 쉼(3000 * 회); }
      }
      새.set(m.id, r);
      console.log(`${r.id} ${r.오류 ? `오류 ${r.오류}` : `${r.ms}ms 「${r.글.slice(0, 70)}」`}`);
      fs.writeFileSync(파일, `${자료.map((x) => 앞.get(x.id) || 새.get(x.id)).filter(Boolean).map((x) => JSON.stringify(x)).join('\n')}\n`);
    }
  }));
  const 됨 = [...앞.values(), ...새.values()];
  console.log(JSON.stringify({ 길, 판, 줄: 됨.length, 오류: 됨.filter((r) => r.오류).length, USD: Number(됨.reduce((s, r) => s + (r.USD || 0), 0).toFixed(3)) }));
}
