// 팬사인회 상황극 화면(2026-10-30 시제품) — 준비 → 대화(자막 · 힌트 · 시계) → 돌아보기. 공급사 차이는 연결층.mjs가 맡는다.
// ?길=gemini-live|gpt-live|realtime-mini|글 은 예산 계량기 대신 길을 고정하고(시험용), ?시험=1 은 마이크 대신 견본 학습자 소리 3줄을 넣는다(재생은 음소거).
// ?반이중=1 은 Gemini 길에서 하온이 말하는 동안 마이크를 쉰다(헤드폰 없이 스피커로 할 때), ?시험=1&상한=40 은 시계를 줄여 마무리 · 자동 끝까지 본다.
import { 열기, 글열기 } from './연결층.mjs';

const $ = (id) => document.getElementById(id);
const 쿼리 = new URLSearchParams(location.search);
const 시험 = 쿼리.get('시험') === '1';
const 강제길 = ['gemini-live', 'gpt-live', 'realtime-mini', '글'].includes(쿼리.get('길')) ? 쿼리.get('길') : undefined;
const 반이중 = 쿼리.get('반이중') === '1';
const 상한덮기 = 시험 ? Math.max(0, Math.round(Number(쿼리.get('상한')) || 0)) : 0;
const 길이름 = { 'gemini-live': '음성(Gemini Kore · 무료)', 'gpt-live': '음성(GPT-Live · 유료)', 'realtime-mini': '가벼운 음성(mini · 유료)', 글: '글 상황극' };
const 넘김까닭 = { 'Gemini 무료 몫': 'Gemini 무료 몫이 차서', 'Gemini 연결 실패': 'Gemini 연결이 안 돼서' };
let 장면 = null;
let 연결 = null;
let 시계타이머 = null;
let 남은초 = 0;
let 힌트번호 = 0;
let 끝내는중 = false;
let 마무리보냄 = false;
let 마무리전줄 = new Set(); // 마무리 지시 때 있던 줄 — 그 뒤 새로 시작한 상대 답이 끝나야 자동으로 끝낸다
let 마무리뒤말함 = false;
let 마지막상대 = 0;
let 마지막내소리 = 0; // 마이크(견본 트랙)에 말소리가 마지막으로 있던 시각 — 작별에 답하는 동안은 끝내지 않는다
let 상대말함 = false;
let 마이크타이머 = null;
let 마이크문맥 = null;

const 받침 = (글) => { const c = String(글).charCodeAt(String(글).length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const 이가 = (이름) => `${이름}${받침(이름) ? '이' : '가'}`;
const 상태 = (글) => { $('상태').textContent = 글; };
const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
async function 기다리기(조건, 시한) { const 시작 = performance.now(); while (!조건() && performance.now() - 시작 < 시한) await 쉼(100); }

function 예산표시(계) {
  if (!계) return;
  const 퍼 = 계.비율 == null ? '–' : `${Math.round(계.비율 * 100)}%`;
  const 몫쉼 = 계.제미나이?.몫막힘까지 ? ` · Gemini 무료 몫 쉼(${new Date(계.제미나이.몫막힘까지).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지)` : '';
  $('예산').textContent = `이번 달 $${계.쓴값.toFixed(2)} / $${계.예산USD} (${퍼}) · 지금 길: ${길이름[강제길 || 계.길]}${몫쉼}`;
}

function 미션그리기(곳, 판정) {
  곳.textContent = '';
  for (const m of 장면.미션) {
    const li = document.createElement('li');
    const 몸 = document.createElement('span');
    몸.textContent = m.할일;
    const 판 = 판정?.find((x) => x.id === m.id);
    if (판) {
      li.className = 판.해냄 ? '됨' : '';
      const 표 = document.createElement('span');
      표.className = `표 ${판.해냄 ? '됨' : '아직'}`;
      표.textContent = 판.해냄 ? '해냄' : '다음에';
      몸.append(표);
      if (판.근거) { const g = document.createElement('span'); g.className = '근거'; g.textContent = `「${판.근거}」`; 몸.append(g); }
    }
    if (!판정 && m.뜻) { const t = document.createElement('span'); t.className = '뜻'; t.lang = 'en'; t.textContent = m.뜻; 몸.append(t); }
    li.append(몸);
    곳.append(li);
  }
}

function 자막그리기(줄들, 곳) {
  곳.textContent = '';
  for (const [i, l] of 줄들.entries()) {
    // 말 시작에 놓은 빈 자리는 맨 끝 줄일 때만 「…」(지금 듣는 중) — 받아쓰기가 끝내 안 온 자리(바탕 소리 등)는 감춘다
    const 글 = l.글.trim() || (l.자리 && i === 줄들.length - 1 ? '…' : '');
    if (!글) continue;
    const li = document.createElement('li');
    li.className = l.누가 === '나' ? '나' : '상대';
    const 누가 = document.createElement('span');
    누가.className = '누가';
    누가.textContent = l.누가 === '나' ? '나' : 장면.상대.이름;
    li.append(누가, document.createTextNode(글));
    곳.append(li);
  }
  곳.scrollTop = 곳.scrollHeight;
}

function 시계시작() {
  남은초 = 상한덮기 || 장면.상한초;
  const 그리기 = () => { const s = Math.max(0, 남은초); $('시계').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  그리기();
  시계타이머 = setInterval(() => {
    남은초 -= 1;
    그리기();
    if (남은초 <= 20 && !마무리보냄 && 연결?.마무리) { 마무리보냄 = true; 마무리전줄 = new Set(연결.자막.줄들); 연결.마무리(); }
    // 마무리를 시킨 뒤 새로 시작한 하온 답(작별)이 끝나고 2.5초 조용하면 저절로 끝낸다(하온이 스스로 작별 인사를 한 답도 같다). 4:15에는 무조건 끝낸다.
    // 마무리 지시를 보낸 그 초에 끝내지 않게 「마무리 뒤 새 답」을 기다린다(Fable 설계 검토 10-30). Gemini는 자막 글이 소리보다
    // 몇 초 먼저 오므로 소리가 다 들리는 시각(상대소리끝)까지 본다. 작별에 학습자가 답하면(「끝인사」 미션은 대개 여기서 나온다)
    // 그 말이 멎고 받아쓰기가 올 때까지 기다린다 — 하온 소리 끝 1.3초로 끊으면 그 말이 전사에서 빠졌다(10-30 검수)
    const 상대끝 = Math.max(마지막상대, 연결?.상대소리끝?.() || 0);
    if (마무리보냄 && 마무리뒤말함 && performance.now() - Math.max(상대끝, 마지막내소리) > 2500) 끝내기();
    if (남은초 <= -15) 끝내기();
  }, 1000);
}

function 되돌리기() {
  $('시작').disabled = false;
  $('견본').disabled = false;
  $('장면').hidden = false;
  $('대화').hidden = true;
}

async function 상태읽기() {
  const j = await (await fetch('/api/상태')).json();
  장면 = j.장면;
  $('상황').textContent = 장면.상황;
  $('상황뜻').textContent = 장면.상황뜻 || '';
  $('상대누구').textContent = `${장면.상대.이름} · ${장면.상대.누구.replace(/\(.*\)/, '').trim()}`;
  미션그리기($('미션'));
  예산표시(j.계량);
  $('시작').disabled = false;
  if (시험) $('견본').hidden = false;
}

async function 견본준비() {
  const ctx = new AudioContext();
  await ctx.resume();
  const 목적지 = ctx.createMediaStreamDestination();
  // 진짜 마이크처럼 아주 작은 바탕 소리를 늘 흘린다 — 완전한 무음 트랙은 공급사 쪽 시간이 흐르지 않아 첫 인사가 안 나왔다(10-30 실측)
  const 바탕 = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const 칸 = 바탕.getChannelData(0);
  for (let i = 0; i < 칸.length; i++) 칸[i] = (Math.random() * 2 - 1) * 0.002;
  const 바탕소리 = ctx.createBufferSource();
  바탕소리.buffer = 바탕;
  바탕소리.loop = true;
  바탕소리.connect(목적지);
  바탕소리.start();
  globalThis.__상황극기록?.push?.({ 종류: `ctx:${ctx.state}`, t: Math.round(performance.now()) });
  const 소리들 = await Promise.all([1, 2, 3].map(async (i) => ctx.decodeAudioData(await (await fetch(`견본/학습자_${i}.mp3`)).arrayBuffer())));
  return { ctx, 목적지, 트랙: 목적지.stream.getAudioTracks()[0], 소리들 };
}

/** 시험: 상대 소리가 1.6초 조용하면 다음 학습자 줄을 튼다(받은 소리 크기 + 자막 둘 다 봄). 마지막 답 뒤 3초면 끝낸다. */
async function 견본돌리기(견본) {
  let 마지막소리 = 0;
  let 상대말함 = false;
  const 재기 = 견본.ctx.createAnalyser();
  재기.fftSize = 1024;
  const 칸 = new Float32Array(재기.fftSize);
  await 기다리기(() => $('소리').srcObject, 15000);
  if ($('소리').srcObject) 견본.ctx.createMediaStreamSource($('소리').srcObject).connect(재기);
  const 보기 = setInterval(() => {
    재기.getFloatTimeDomainData(칸);
    const 크기 = Math.sqrt(칸.reduce((n, v) => n + v * v, 0) / 칸.length);
    if (크기 > 0.01) { 마지막소리 = performance.now(); 상대말함 = true; }
  }, 100);
  연결.on('자막', ({ 누가 }) => { if (누가 === '상대') { 마지막소리 = performance.now(); 상대말함 = true; } });
  const 틀기 = (버퍼) => new Promise((r) => { const s = 견본.ctx.createBufferSource(); s.buffer = 버퍼; s.connect(견본.목적지); s.onended = r; s.start(); });
  for (const [i, 버퍼] of 견본.소리들.entries()) {
    await 기다리기(() => 상대말함 && performance.now() - 마지막소리 > 1600, 30000);
    상대말함 = false;
    $('시험글').hidden = false;
    $('시험글').textContent = `시험: 학습자 ${i + 1}번 줄을 넣는 중`;
    await 틀기(버퍼);
  }
  await 기다리기(() => 상대말함 && performance.now() - 마지막소리 > 3000, 30000);
  clearInterval(보기);
  const 통 = await 연결.통계();
  $('시험글').textContent = `시험: 받은 소리 ${통.받은} 바이트 · 보낸 소리 ${통.보낸} 바이트`;
  window.__시험 = { 통, 길: 연결.길, 줄들: 연결.자막.보낼것() };
  await 끝내기();
}

async function 시작(견본모드) {
  $('시작').disabled = true;
  $('견본').disabled = true;
  $('장면').hidden = true;
  $('대화').hidden = false;
  끝내는중 = false;
  마무리보냄 = false;
  마무리전줄 = new Set();
  마무리뒤말함 = false;
  마지막내소리 = 0;
  상대말함 = false;
  힌트번호 = 0;
  $('자막').textContent = '';
  $('힌트').hidden = true;
  상태('연결하는 중…');
  if (강제길 === '글') return 글시작();
  let 트랙;
  let 견본 = null;
  try {
    if (견본모드) {
      견본 = await 견본준비();
      트랙 = 견본.트랙;
      $('소리').muted = true;
    } else {
      $('소리').muted = false;
      const 마이크 = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      트랙 = 마이크.getAudioTracks()[0];
    }
  } catch (e) {
    상태(e?.name === 'NotFoundError' ? '마이크를 찾지 못했어요 — 마이크를 꽂거나 윈도우 소리 설정에서 입력 장치를 확인해 주세요'
      : '마이크를 쓸 수 없어요 — 주소창 옆 마이크 허락과 윈도우 설정(개인 정보 → 마이크)을 확인한 뒤 다시 눌러 주세요');
    되돌리기();
    return;
  }
  마이크재기(트랙);
  try {
    연결 = await 열기({ 길: 강제길, 입력트랙: 트랙, 출력: $('소리'), 반이중 });
  } catch (e) {
    트랙.stop();
    상태(`연결하지 못했어요: ${e.message}`);
    되돌리기();
    return;
  }
  if (연결.길 === '글') { 트랙.stop(); return 글시작(연결.계량); }
  예산표시(연결.계량);
  // Gemini가 막혀 다른 길로 넘어왔으면 목소리가 바뀌는 까닭을 먼저 알린다
  const 넘김글 = 연결.넘김 ? `지금은 ${넘김까닭[연결.넘김] || 'Gemini를 쓸 수 없어서'} ${길이름[연결.길] || '다른 길'}로 이어가요(목소리가 달라요). ` : '';
  연결.on('준비', () => { 상태(`${넘김글}${이가(장면.상대.이름)} 먼저 인사해요 — 편하게 대답해 보세요`); 시계시작(); });
  // 대화 중 연결이 끊기면(Gemini 소켓) 그때까지의 대화로 돌아보기를 만든다
  연결.on('끊김', () => 끝내기());
  연결.on('자막', (z) => {
    자막그리기(연결.자막.줄들, $('자막'));
    if (z.누가 === '상대') {
      마지막상대 = performance.now();
      상대말함 = true;
      if (마무리보냄 && !마무리전줄.has(연결.자막.줄들[z.번호])) 마무리뒤말함 = true;
      if (!마무리보냄 && 연결.자막.줄들.some((l) => l.누가 === '상대' && l.글.includes('다음에 또 만나요'))) { 마무리보냄 = true; 마무리뒤말함 = true; }
    }
  });
  연결.on('상태', 상태);
  연결.on('오류', (글) => 상태(`문제가 생겼어요: ${글}`));
  if (견본) 견본돌리기(견본);
}

async function 글시작(계량) {
  연결 = 글열기();
  if (계량) 예산표시(계량);
  $('대화제목').textContent = `${장면.상대.이름}와 글로 이야기하는 중`;
  $('글입력').hidden = false;
  $('힌트단추').hidden = false;
  연결.on('자막', () => 자막그리기(연결.자막.줄들, $('자막')));
  상태('이번 달 음성 예산을 거의 다 써서 오늘은 글로 이야기해요');
  try {
    const r = await 연결.시작();
    예산표시(r.계량);
    시계시작();
    $('글칸').focus();
  } catch (e) {
    상태(`글 상황극을 열지 못했어요: ${e.message}`);
  }
}

$('글입력').addEventListener('submit', async (e) => {
  e.preventDefault();
  const 글 = $('글칸').value.trim();
  if (!글 || !연결?.보내기) return;
  $('글칸').value = '';
  try { const r = await 연결.보내기(글); 예산표시(r.계량); } catch (err) { 상태(`보내지 못했어요: ${err.message}`); }
});

$('힌트단추').addEventListener('click', () => {
  const m = 장면.미션[힌트번호 % 장면.미션.length];
  힌트번호 += 1;
  const 힌트 = $('힌트');
  힌트.textContent = '';
  const b = document.createElement('b');
  b.textContent = `할 일 ${장면.미션.indexOf(m) + 1} · ${m.할일}`;
  힌트.append(b, document.createTextNode(m.예문));
  힌트.hidden = false;
});

function 마이크재기(트랙) {
  try {
    const ctx = new AudioContext();
    마이크문맥 = ctx; // 판마다 새로 만드니 끝내기에서 닫는다(Fable 설계 검토 10-30 — 다시 하기를 거듭하면 쌓인다)
    const 재기 = ctx.createAnalyser();
    재기.fftSize = 512;
    ctx.createMediaStreamSource(new MediaStream([트랙])).connect(재기);
    const 칸 = new Float32Array(재기.fftSize);
    $('마이크').hidden = false;
    마이크타이머 = setInterval(() => {
      재기.getFloatTimeDomainData(칸);
      const 크기 = Math.sqrt(칸.reduce((n, v) => n + v * v, 0) / 칸.length);
      if (크기 > 0.02) 마지막내소리 = performance.now(); // 연결 층 Gemini 침묵 재기와 같은 문턱(바탕 소리 0.002는 안 넘는다)
      $('마이크막대').style.width = `${Math.min(100, Math.round(크기 * 400))}%`;
    }, 100);
  } catch { /* 재기는 덤 — 못 해도 대화는 된다 */ }
}

// 탭을 닫거나 새로 고치면 끝 보고만 남긴다(장부가 15초 선과금만 들고 비지 않게)
addEventListener('pagehide', () => {
  const 보고 = !끝내는중 && 연결?.비상보고?.();
  if (보고) navigator.sendBeacon('/api/끝', new Blob([JSON.stringify(보고)], { type: 'application/json' }));
});

async function 끝내기() {
  if (끝내는중 || !연결) return;
  끝내는중 = true;
  clearInterval(시계타이머);
  clearInterval(마이크타이머);
  마이크문맥?.close().catch(() => {});
  마이크문맥 = null;
  $('마이크').hidden = true;
  $('끝내기').disabled = true;
  상태('마무리하는 중…');
  $('피드백').hidden = false;
  $('피드백몸').hidden = true;
  $('피드백상태').textContent = '돌아보기를 만드는 중…';
  let r = null;
  try { r = await 연결.끝내기(); } catch { r = null; }
  $('대화').hidden = true;
  $('글입력').hidden = true;
  $('끝내기').disabled = false;
  자막그리기(연결.자막.줄들, $('전사'));
  if (r?.계량) 예산표시(r.계량);
  const 피 = r?.피드백;
  if (!r || r.상태 !== 200) { $('피드백상태').textContent = '돌아보기를 만들지 못했어요. 대화 전체는 아래에 있어요.'; return; }
  if (!피) { $('피드백상태').textContent = '이번에는 내가 한 말이 들리지 않아 돌아볼 것이 없어요. 다시 해 볼까요?'; return; }
  if (피.실패) { $('피드백상태').textContent = '돌아보기를 만들지 못했어요. 대화 전체는 아래에 있어요.'; return; }
  $('피드백상태').textContent = '';
  $('한마디').textContent = 피.한마디 || '';
  미션그리기($('판정'), 피.미션);
  const 목록 = (곳, 항목들, 그리기) => { 곳.textContent = ''; for (const x of 항목들) { const li = document.createElement('li'); 그리기(li, x); 곳.append(li); } if (!항목들.length) { const li = document.createElement('li'); li.textContent = '이번에는 없어요'; 곳.append(li); } };
  목록($('잘한말'), 피.잘한말, (li, x) => { li.append(`「${x.말}」`); const w = document.createElement('span'); w.className = '왜'; w.textContent = x.왜; li.append(w); });
  목록($('고칠말'), 피.고칠말, (li, x) => { const a = document.createElement('span'); a.className = '내말'; a.textContent = x.내말; li.append(a, ` → ${x.고친말}`); const w = document.createElement('span'); w.className = '왜'; w.textContent = x.왜; li.append(w); });
  목록($('써볼말'), 피.써볼말, (li, x) => { li.textContent = x; });
  $('피드백몸').hidden = false;
  window.__돌아보기 = 피;
}

$('시작').addEventListener('click', () => 시작(false));
$('견본').addEventListener('click', () => 시작(true));
$('끝내기').addEventListener('click', 끝내기);
$('다시').addEventListener('click', () => { $('피드백').hidden = true; 연결 = null; 되돌리기(); 상태읽기(); });
상태읽기().catch(() => { $('예산').textContent = '서버에 닿지 않아요 — 시제품 서버가 켜져 있는지 확인해 주세요'; });
