// 답 은행 시험 3판(2026-11-01) — 속도: 학습자 말이 끝난 뒤 하온의 첫 소리까지 어디서 시간이 드는지 나눠 잰다.
// 2판까지의 「받아 적기 1.5초」는 말이 끝난 뒤 파일을 통째로 올린 시간만이라, 말 끝을 알아채는 시간(실시간판은 그 안에 들어 있다)이 빠져 있었다.
// 여기서는 나란히듣기의 학습자 소리 14개를 실제 속도로 흘려 보내며 잰다 — 시각은 모두 「학습자 소리 마지막 표본을 보낸 때」부터.
//   ① 흘려 받기: Realtime 받아쓰기 세션(서버 VAD 침묵 300 · 500ms, 그리고 말 끝에 바로 커밋 = 아래 한계)에서 받아 적은 글이 끝나는 때
//   ② 통째로: gpt-transcribe 파일 올리기(성공한 요청만) — 말 끝 알아채기 시간은 따로 더해야 한다
//   ③ 생성 차례: 생성 답의 첫 글자 · 첫 문장(흘려 받기, 성공한 요청만) · ④ 목소리 읽기 첫 소리(gpt-4o-mini-tts 흘려 받기)
//   ⑤ 고르기를 흘려 받을 때 첫 반응 id가 닫히는 때(그때부터 녹음을 틀 수 있다)
// 쓰는 법: node 받아적기속도.mjs [흘려|통째|생성|목소리|고르기|전부]   → .tmp/답은행시험-20261101/받아적기속도.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 키차례, 키읽기, 키로부르기 } from '../../lib/오픈AI키.mjs';
import { 팬사인회, 지시문 } from '../../lib/장면.mjs';
import { 단계 } from './단계.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 작업 = path.resolve(여기, '../../../../.tmp/답은행시험-20261101');
const 결과파일 = path.join(작업, '받아적기속도.json');
const 바탕 = (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const 표본율 = 24000;
const 조각ms = 100;
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
const 중앙 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const 위10 = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * 0.9))] : null; };
const 소리들 = fs.readdirSync(path.join(작업, '학습자')).filter((f) => /^[AB]_\d+\.wav$/.test(f)).sort()
  .map((f) => ({ 이름: f.replace('.wav', ''), pcm: fs.readFileSync(path.join(작업, '학습자', f)).subarray(44) }));
const 결과 = fs.existsSync(결과파일) ? JSON.parse(fs.readFileSync(결과파일, 'utf8')) : {};
const 저장 = () => { fs.mkdirSync(작업, { recursive: true }); fs.writeFileSync(결과파일, JSON.stringify(결과, null, 1)); };

// 실제 속도로 100ms 조각을 보낸다(나란히듣기의 소리펌프와 같은 셈) — 소리를 다 보낸 때를 돌려준다
class 소리펌프 {
  constructor(보내기) { this.보내기 = 보내기; this.조각바이트 = (표본율 * 2 * 조각ms) / 1000; this.대기 = []; this.지금 = null; this.보낸조각 = 0; this.침묵 = Buffer.alloc(this.조각바이트); }
  시작하기() { this.시작 = performance.now(); this.돌기(); }
  넣기(pcm) { return new Promise((res) => this.대기.push({ pcm, res, 자리: 0 })); }
  돌기() {
    if (this.꺼짐) return;
    const 목표 = Math.floor((performance.now() - this.시작) / 조각ms) + 1;
    while (this.보낸조각 < 목표) {
      if (!this.지금 && this.대기.length) this.지금 = this.대기.shift();
      let 조각 = this.침묵;
      if (this.지금) {
        const 줄 = this.지금;
        조각 = 줄.pcm.subarray(줄.자리, 줄.자리 + this.조각바이트);
        const 실제 = 조각.length; 줄.자리 += 실제;
        if (실제 < this.조각바이트) 조각 = Buffer.concat([조각, Buffer.alloc(this.조각바이트 - 실제)]);
        this.보내기(조각); this.보낸조각++;
        if (줄.자리 >= 줄.pcm.length) { this.지금 = null; 줄.res(performance.now()); }
        continue;
      }
      this.보내기(조각); this.보낸조각++;
    }
    this.타이머 = setTimeout(() => this.돌기(), 10);
  }
  끄기() { this.꺼짐 = true; clearTimeout(this.타이머); }
}

function 열기(주소, 머리) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(주소, { headers: 머리 });
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('error', (e) => rej(new Error(`연결 실패 ${e?.message || ''}`)), { once: true });
    ws.addEventListener('open', () => res(ws), { once: true });
  });
}

/** 받아쓰기 세션 하나로 소리 14개를 차례로 흘려 보낸다. 설정.침묵 = 서버 VAD 침묵 ms, null이면 말 끝에 바로 커밋 */
async function 흘려한판(모델, 침묵, 키) {
  const ws = await 열기(`${바탕.replace(/^http/, 'ws')}/realtime?intent=transcription`, { Authorization: `Bearer ${키읽기(키)}` });
  const 사건 = []; let 오류 = null;
  ws.addEventListener('message', (ev) => {
    const e = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
    e.받은 = performance.now(); 사건.push(e);
    if (e.type === 'error') { 오류 = e.error?.message || JSON.stringify(e).slice(0, 200); }
  });
  const 보내기 = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
  보내기({ type: 'session.update', session: { type: 'transcription', audio: { input: {
    format: { type: 'audio/pcm', rate: 표본율 },
    transcription: { model: 모델, language: 'ko' },
    turn_detection: 침묵.vad,
  } } } });
  await 쉼(800);
  if (오류) { ws.close(); throw new Error(`세션 설정 거절: ${오류}`); }
  const 펌프 = new 소리펌프((조각) => 보내기({ type: 'input_audio_buffer.append', audio: 조각.toString('base64') }));
  펌프.시작하기();
  await 쉼(600);
  const 줄 = [];
  const 끝남 = (e) => e.type === 'conversation.item.input_audio_transcription.completed' || e.type === 'conversation.item.input_audio_transcription.failed';
  for (const s of 소리들) {
    const 앞 = 사건.length;
    const 끝 = await 펌프.넣기(s.pcm);
    if (!침묵.vad) 보내기({ type: 'input_audio_buffer.commit' });
    // 머뭇거림(「저는… 볼로르예요」)에서 말이 둘로 갈려 커밋될 수 있다 — 이 말 동안 커밋된 조각이 모두 받아 적힌 때를 잰다
    const 기한 = performance.now() + 9000;
    let 조각들 = []; let 다됨 = false;
    while (performance.now() < 기한) {
      const 뒤 = 사건.slice(앞);
      조각들 = 뒤.filter((e) => e.type === 'input_audio_buffer.committed').map((e) => e.item_id);
      const 마지막커밋 = 뒤.filter((e) => e.type === 'input_audio_buffer.committed').at(-1);
      const 완 = new Map(뒤.filter(끝남).map((e) => [e.item_id, e]));
      if (뒤.some((e) => e.type === 'conversation.item.input_audio_transcription.failed' && /credit|quota/i.test(JSON.stringify(e.error || {})))) { 펌프.끄기(); ws.close(); throw new Error('credit_balance_exhausted'); }
      // 소리를 다 보낸 뒤 커밋이 하나라도 있고, 그 뒤 0.8초 동안 새 말이 시작되지 않았고, 커밋된 조각이 다 끝났으면
      if (마지막커밋 && 마지막커밋.받은 >= 끝 - 50 && 조각들.every((id) => 완.has(id)) && performance.now() - 마지막커밋.받은 > 300) { 다됨 = true; break; }
      await 쉼(20);
    }
    const 뒤 = 사건.slice(앞);
    const 완 = 뒤.filter(끝남);
    const 마지막완 = 완.filter((e) => 조각들.includes(e.item_id)).at(-1);
    const 커밋 = 뒤.filter((e) => e.type === 'input_audio_buffer.committed' && e.받은 >= 끝 - 50)[0];
    const 첫조각 = 뒤.find((e) => e.type === 'conversation.item.input_audio_transcription.delta' && e.받은 >= 끝 - 50);
    const 글 = 조각들.map((id) => 완.find((e) => e.item_id === id)?.transcript?.trim()).filter(Boolean).join(' ');
    줄.push({ 소리: s.이름, 초: Number((s.pcm.length / 2 / 표본율).toFixed(2)), 글: 글 || null, 갈림: 조각들.length,
      말끝알아챔ms: 커밋 ? Math.round(커밋.받은 - 끝) : null, 첫조각ms: 첫조각 ? Math.round(첫조각.받은 - 끝) : null, 완료ms: 다됨 && 마지막완 ? Math.round(마지막완.받은 - 끝) : null });
    console.log(`  ${모델} ${침묵.이름} ${s.이름} 갈림 ${조각들.length} · 말 끝 알아챔 ${줄.at(-1).말끝알아챔ms}ms · 완료 ${줄.at(-1).완료ms}ms 「${줄.at(-1).글 || '-'}」`);
    await 쉼(1500); // 다음 말 전 침묵(펌프가 계속 무음을 보낸다)
  }
  펌프.끄기(); ws.close();
  const 값 = (k) => 줄.map((r) => r[k]);
  return { 모델, 설정: 침묵.이름, 키: 키.이름, 줄, 완료중앙ms: 중앙(값('완료ms')), 완료위10ms: 위10(값('완료ms')), 알아챔중앙ms: 중앙(값('말끝알아챔ms')), 갈린말: 줄.filter((r) => r.갈림 > 1).length, 빠짐: 줄.filter((r) => r.완료ms == null).length };
}

// 말 끝 알아채기 설정 — 서버 VAD(소리 크기, 침묵 ms) · 의미 VAD(말이 끝났는지 뜻으로 — 실시간 미니 길이 쓰는 것) · 말 끝에 바로 커밋(앱이 끝을 안다고 친 아래 한계)
const 설정들 = [
  { 이름: '서버 VAD 500ms', vad: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 } },
  { 이름: '서버 VAD 300ms', vad: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 300 } },
  { 이름: '의미 VAD 보통', vad: { type: 'semantic_vad', eagerness: 'auto' } },
  { 이름: '바로 커밋(아래 한계)', vad: null },
];
async function 흘려() {
  결과.흘려 = [];
  for (const 모델 of ['gpt-4o-mini-transcribe', 'gpt-transcribe']) {
    for (const 설정 of 설정들) {
      // 키 차례는 키로부르기와 같다 — 크레딧 바닥 · 권한 오류일 때만 다음 키(돈 드는 길이 아니다)
      const 흘려키 = async () => { let 마지막; for (const 키 of 키차례()) { try { return await 흘려한판(모델, 설정, 키); } catch (e) { 마지막 = e; if (!/quota|credit|401|403|auth|permission|연결 실패/i.test(e.message)) throw e; } } throw 마지막; };
      try { const r = await 흘려키(); 결과.흘려.push(r); console.log(`[흘려] ${모델} ${r.설정}: 완료 중앙 ${r.완료중앙ms}ms · 위 10% ${r.완료위10ms}ms · 알아챔 중앙 ${r.알아챔중앙ms}ms · 갈린 말 ${r.갈린말} · 빠짐 ${r.빠짐}`); }
      catch (e) { 결과.흘려.push({ 모델, 설정: 설정.이름, 오류: String(e.message).slice(0, 200) }); console.log(`[흘려] ${모델} ${설정.이름} 실패: ${e.message}`); if (/model/i.test(e.message)) break; }
      저장();
    }
  }
}

async function 잰부르기(만들기) {
  let 시작 = 0; let 끝 = 0;
  const { res, 키 } = await 키로부르기(async (v) => { 시작 = performance.now(); const r = await fetch(...만들기(v)); 끝 = performance.now(); return r; });
  return { res, 키, ms: Math.round(끝 - 시작) };
}
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(표본율, 24);
  h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
async function 통째() {
  const 줄 = [];
  for (const s of 소리들) {
    const { res, ms, 키 } = await 잰부르기((v) => { const form = new FormData(); form.set('file', new Blob([wav(s.pcm)], { type: 'audio/wav' }), 'speech.wav'); form.set('model', 'gpt-transcribe'); return [`${바탕}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${v}` }, body: form }]; });
    const j = await res.json(); 줄.push({ 소리: s.이름, 글: String(j.text || '').trim(), ms, 키 });
    console.log(`  통째 ${s.이름} ${ms}ms 「${줄.at(-1).글}」`);
  }
  결과.통째 = { 모델: 'gpt-transcribe', 줄, 중앙ms: 중앙(줄.map((r) => r.ms)), 위10ms: 위10(줄.map((r) => r.ms)) };
  console.log(`[통째] 중앙 ${결과.통째.중앙ms}ms · 위 10% ${결과.통째.위10ms}ms`); 저장();
}

/** 흘려 받는 Responses 한 번 — 크레딧이 바닥난 키도 HTTP 200으로 답하고 스트림 안에서 response.failed를 내므로(키로부르기가 못 넘긴다) 여기서 다음 키로 넘긴다. 시간은 성공한 키의 요청만 잰다 */
async function 흘려생성(본문, 조각마다 = () => {}) {
  let 마지막 = '';
  for (const 키 of 키차례()) {
    const 시작 = performance.now();
    const res = await fetch(`${바탕}/responses`, { method: 'POST', headers: { Authorization: `Bearer ${키읽기(키)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(본문) });
    if (!res.ok) { 마지막 = `${키.이름} ${res.status}`; if ([401, 403].includes(res.status)) continue; throw new Error(마지막); }
    const 머리ms = Math.round(performance.now() - 시작);
    let 글 = ''; let 첫글자 = null; let 첫문장 = null; let 남은 = ''; let 실패 = null;
    const 읽개 = res.body.getReader(); const 풀개 = new TextDecoder();
    for (;;) {
      const { value, done } = await 읽개.read(); if (done) break;
      남은 += 풀개.decode(value, { stream: true });
      let i; while ((i = 남은.indexOf('\n')) >= 0) {
        const l = 남은.slice(0, i).trim(); 남은 = 남은.slice(i + 1);
        if (!l.startsWith('data:')) continue;
        let e; try { e = JSON.parse(l.slice(5)); } catch { continue; }
        if (e.type === 'response.failed' || e.type === 'error') 실패 = JSON.stringify(e).slice(0, 300);
        if (e.type === 'response.output_text.delta') { 글 += e.delta; 첫글자 ??= performance.now(); if (첫문장 == null && /[.!?~]\s|[.!?~]$/.test(글.trim().slice(1)) && 글.trim().length > 4) 첫문장 = performance.now(); 조각마다(글, Math.round(performance.now() - 시작)); }
      }
    }
    if (실패) { 마지막 = `${키.이름}: ${실패}`; if (/credit|quota/i.test(실패)) continue; throw new Error(마지막); }
    return { 글: 글.trim(), 키: 키.이름, 머리ms, 첫글자ms: 첫글자 ? Math.round(첫글자 - 시작) : null, 첫문장ms: 첫문장 ? Math.round(첫문장 - 시작) : null, 전체ms: Math.round(performance.now() - 시작) };
  }
  throw new Error(`쓸 키가 없다 — ${마지막}`);
}

/** 생성 차례 — 3판이 생성으로 넘긴 다판 줄에서 20개, 흘려 받기로 첫 글자 · 첫 문장 끝 · 전체 */
async function 생성() {
  const 줄3 = fs.readFileSync(path.join(여기, '고르기3_C.jsonl'), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((r) => r.판단 === '생성' && r.글);
  const 자료 = new Map((await import('./학습자말C.mjs')).default.map((m) => [m.id, m]));
  const 은행 = await import('./은행3.mjs');
  const { 다음질문 } = await import('./생성.mjs');
  const 고른 = 줄3.filter((_, i) => i % Math.max(1, Math.floor(줄3.length / 20)) === 0).slice(0, 20);
  const 줄 = [];
  for (const r of 고른) {
    const 말 = 자료.get(r.id); const d = 단계[말.단계];
    const 본문 = { model: 'gpt-6.1-terra', reasoning: { effort: 'none' }, max_output_tokens: 300, stream: true, safety_identifier: 'synk-roleplay-banktest',
      input: [{ role: 'developer', content: [{ type: 'input_text', text: `${지시문(팬사인회)}\n이번 차례는 학습자 말에 맞게 한두 문장으로 짧게 받고, 끝에 「${다음질문(은행, 말.단계, r.들은것 || [])}」로 이어 간다(뜻이 같으면 조금 바꿔 말해도 된다). 학습자가 이미 말한 것은 다시 묻지 않는다. 하온의 말만 쓴다.` }] },
        { role: 'user', content: [{ type: 'input_text', text: `지금 순간: ${d.상황}\n하온이 방금 한 말: 「${d.앞말}」\n학습자가 방금 한 말(자동 받아쓰기): 「${말.받아적기}」` }] }] };
    const 잰 = await 흘려생성(본문);
    줄.push({ id: r.id, ...잰 });
    console.log(`  생성 ${r.id} 첫 글자 ${줄.at(-1).첫글자ms}ms · 첫 문장 ${줄.at(-1).첫문장ms}ms · 전체 ${줄.at(-1).전체ms}ms 「${줄.at(-1).글.slice(0, 50)}」`);
  }
  결과.생성 = { 모델: 'gpt-6.1-terra(생각 끔, 흘려 받기)', 줄, 첫글자중앙ms: 중앙(줄.map((r) => r.첫글자ms)), 첫문장중앙ms: 중앙(줄.map((r) => r.첫문장ms)), 전체중앙ms: 중앙(줄.map((r) => r.전체ms)), 첫문장위10ms: 위10(줄.map((r) => r.첫문장ms)) };
  console.log(`[생성] 첫 글자 중앙 ${결과.생성.첫글자중앙ms}ms · 첫 문장 중앙 ${결과.생성.첫문장중앙ms}ms · 전체 중앙 ${결과.생성.전체중앙ms}ms`); 저장();
}

/** 고르기를 흘려 받으면 첫 반응 id를 언제 아는가 — 다판 40줄(5줄마다). 답은 판단 → 반응 차례로 나오니 첫 반응이 닫히는 때부터 녹음을 틀 수 있다 */
async function 고르기흘려() {
  const { 고르기본문3 } = await import('./고르기3.mjs');
  const 자료 = (await import('./학습자말C.mjs')).default.filter((_, i) => i % 5 === 0);
  const 줄 = [];
  for (const 말 of 자료) {
    const 본문 = { ...고르기본문3(말), stream: true, safety_identifier: 'synk-roleplay-banktest' };
    let 첫판단 = null; let 첫반응 = null; let 글 = '';
    const 잰 = await 흘려생성(본문, (누적, 지금) => {
      글 = 누적;
      if (첫판단 == null && /"판단"\s*:\s*"[^"]+"/.test(누적)) 첫판단 = 지금;
      if (첫반응 == null && /"반응"\s*:\s*\[\s*"[^"]+"/.test(누적)) 첫반응 = 지금;
    });
    const o = JSON.parse(글 || '{}');
    줄.push({ id: 말.id, 판단: o.판단, 첫판단ms: 첫판단, 첫반응ms: 첫반응, 전체ms: 잰.전체ms, 키: 잰.키 });
    console.log(`  고르기 ${말.id} ${o.판단} 판단 ${첫판단}ms · 첫 반응 ${첫반응}ms · 전체 ${잰.전체ms}ms`);
  }
  결과.고르기흘려 = { 모델: 'gpt-6.1-terra(생각 끔, 흘려 받기)', 줄, 첫판단중앙ms: 중앙(줄.map((r) => r.첫판단ms)), 첫반응중앙ms: 중앙(줄.map((r) => r.첫반응ms)), 첫반응위10ms: 위10(줄.map((r) => r.첫반응ms)), 전체중앙ms: 중앙(줄.map((r) => r.전체ms)) };
  console.log(`[고르기] 첫 판단 중앙 ${결과.고르기흘려.첫판단중앙ms}ms · 첫 반응 중앙 ${결과.고르기흘려.첫반응중앙ms}ms · 전체 중앙 ${결과.고르기흘려.전체중앙ms}ms`); 저장();
}

/** 생성한 첫 문장을 목소리로 읽을 때 첫 소리까지 — gpt-4o-mini-tts 흘려 받기(pcm) */
async function 목소리() {
  const 문장들 = (결과.생성?.줄 || []).map((r) => (r.글.match(/^.+?[.!?~](?=\s|$)/) || [r.글])[0]).filter(Boolean).slice(0, 12);
  const 줄 = [];
  for (const 말 of 문장들) {
    let 시작 = 0;
    const { res } = await 키로부르기(async (v) => { 시작 = performance.now(); return fetch(`${바탕}/audio/speech`, { method: 'POST', headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'coral', input: 말, response_format: 'pcm', stream_format: 'audio' }) }); });
    const 읽개 = res.body.getReader(); let 첫소리 = null; let 바이트 = 0;
    for (;;) { const { value, done } = await 읽개.read(); if (done) break; if (value?.length) { 첫소리 ??= performance.now(); 바이트 += value.length; } }
    줄.push({ 말, 첫소리ms: 첫소리 ? Math.round(첫소리 - 시작) : null, 초: Number((바이트 / 2 / 표본율).toFixed(2)) });
    console.log(`  목소리 첫 소리 ${줄.at(-1).첫소리ms}ms 「${말}」`);
  }
  결과.목소리 = { 모델: 'gpt-4o-mini-tts', 줄, 첫소리중앙ms: 중앙(줄.map((r) => r.첫소리ms)), 첫소리위10ms: 위10(줄.map((r) => r.첫소리ms)) };
  console.log(`[목소리] 첫 소리 중앙 ${결과.목소리.첫소리중앙ms}ms`); 저장();
}

if (process.argv[1] && path.basename(process.argv[1]) === '받아적기속도.mjs') {
  const 할일 = process.argv[2] || '전부';
  if (할일 === '흘려' || 할일 === '전부') await 흘려();
  if (할일 === '통째' || 할일 === '전부') await 통째();
  if (할일 === '생성' || 할일 === '전부') await 생성();
  if (할일 === '목소리' || 할일 === '전부') await 목소리();
  if (할일 === '고르기' || 할일 === '전부') await 고르기흘려();
  결과.때 = new Date().toISOString(); 저장();
}
