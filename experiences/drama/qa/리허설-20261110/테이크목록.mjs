#!/usr/bin/env node
/**
 * 드라마 코치 판정 합성 기준선 다시 재기(2026-11-10) — 지금 판(판정 drama-judge-7 · 지금 대사 은행, 결정 표 11-04 기록으로 운영 v21과 같은 지문)의 테이크 목록.
 *   node experiences/drama/qa/리허설-20261110/테이크목록.mjs [--굽기]
 * 앞 기준선(../리허설-20261031, 판정 drama-judge-5 · 22개)의 목록에서 바꾼 것과 까닭은 아래 「목록」 주석과 README에 있다.
 * · 기대는 돌리기 전에 설계(기획 §3-4 · §3-5 · §4-1 · §4-2, 결정 표 10-31 · 11-01 · 11-03)에서 적었다 — 테이크마다 「근거」 칸.
 *   이 스크립트는 받아 적기 없이 「글 그대로의 판정」이 그 기대와 같은지만 본다. 다르면 멈춘다(기대를 결과에 맞추지 않는다 — 설계와 판정이 어긋난 것).
 * · 목록의 대사는 모두 지금 운영에서 열리는 줄(칸 명세 AI 2중 검수 통과 — review.status passed)이어야 한다. 아니면 멈춘다.
 * · 소리: 모범 읽기 9는 저장소의 일레븐 v4 Hana(experiences/drama/s1/소리/), 앞 목록에서 그대로 온 테이크는 그때 구운 소리
 *   (공용 작업본 .tmp/drama-rehearsal-20261031/wrong-NN.wav — OpenAI Realtime 2.1 marin)를 사본으로 다시 쓴다. 새 테이크만 `--굽기`로 굽는다
 *   — 일레븐랩스 공식 eleven_v4(구독 크레딧, 키 ~/SYNK_보안/elevenlabs.txt). OpenAI 월 API 크레딧은 받아 적기 몫이라(결정 11-03 · 11-05) 소리 굽기에 쓰지 않는다.
 * · 소리 · 목록 · 결과는 git 밖(공용 작업본 .tmp/drama-rehearsal-20261110/)에 둔다. 합성 소리다 — 학습자 녹음이 아니다. 키 값은 찍지 않는다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { judgeLine, DRAMA_JUDGE_VERSION } from '../../../../tools/lib/드라마판정.mjs';
import { dramaLines, linesHash, readEpisodes } from '../../../../tools/build-world-speaking-talk.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '../../../..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools/lib/공용작업본.js'));
const 공용 = 공용작업본(뿌리);
const 밖 = path.join(공용, '.tmp/drama-rehearsal-20261110');
const 옛밖 = path.join(공용, '.tmp/drama-rehearsal-20261031');
const 굽기 = process.argv.includes('--굽기');
const 멈춤 = (말) => { console.error(`[테이크목록] ${말}`); process.exit(1); };

// 지금 대사 은행 — talk 사본을 만드는 빌더와 같은 함수로 읽는다(판정 명세 · 처음 보는 대사의 free · 검수 상태가 서버 사본과 같다).
const 은행 = dramaLines(await readEpisodes());
const 은행지문 = linesHash(은행);
const 줄 = (id) => 은행.find((l) => l.id === id) || 멈춤(`대사 은행에 없는 대사 ${id}`);

/**
 * 목록 — 모범 읽기 9(장면 대사 9줄, 아래에서 만든다) + 아래 16 = 25.
 * 「옛」은 앞 목록(리허설-20261031/테이크목록.mjs)의 틀린 테이크 번호다 — 대사 · 읽힐 글 · 기대 · 소리가 그때와 같다(12개).
 * 바꾼 것 넷:
 *  ① 앞 9번(s1e01-t5 반말)은 뺐다 — t5는 11-03 다시 검수에서 초안으로 내려가 운영에서 열리지 않는다(결정 11-03 drama-judge-6).
 *     같은 것을 재던 자리(처음 보는 대사에서 반말 → 끝맺음 노트)는 지금 공개 줄 t7로 바꿨다.
 *  ② · ③ drama-judge-6(11-03)이 더한 부정 어긋남 규칙을 재는 테이크 둘(「-지 않-」 · 홀로 선 「안」) — 앞 목록에는 이 규칙이 없던 때라 테이크가 없다.
 *  ④ 11-02에 대본에 든 공개 줄 t9(talk 은행 사본은 11-03 — WORLD 공개 강의의 새 상황)와, judge-5 판에 함께 든 「허용 변형을 글자 그대로 말하면 통과 · 확실」을 재는 테이크 하나.
 * drama-judge-7(11-04)의 숫자 덩이 규칙은 넣지 않았다 — 지금 talk 대사 은행(1화 18줄)에 숫자가 든 대사가 없다(숫자 줄인 TOPIK U14 원고는
 * 은행에 아직 안 실음 — 결정 11-04). 이 목록으로는 그 규칙이 1화 판정을 바꾸지 않는지만 본다.
 */
const 말테이크 = [
  { 옛: 1, name: '요 빠짐', line: 's1e01-2', say: '아직 낯설지만 조금씩 익숙해지고 있어.', expect: { verdict: 'note', note: 'ending' }, 근거: '기획 §4-1 끝맺음·높임 — 교수님께 대사 끝말에서 「요」만 뺀 꼴' },
  { 옛: 2, name: '요 빠짐', line: 's1e01-6', say: '응, 맞아. 길을 잃어서 한참 헤맸어.', expect: { verdict: 'note', note: 'ending' }, 근거: '기획 §4-1 끝맺음·높임 — 선배께 「요」만 뺀 꼴' },
  { 옛: 3, name: '요 빠짐', line: 's1e01-4', say: '제출 기한이 언제까지인지 궁금해서.', expect: { verdict: 'note', note: 'ending' }, 근거: '기획 §4-2 — 반말 꼴 목록에 없는 끝(「-서」)도 「요」만 뺀 꼴이면 확신' },
  { 옛: 4, name: '반말 덩어리', line: 's1e01-5', say: '응, 알았어. 고마워.', expect: { verdict: 'note', note: 'ending' }, 근거: '기획 §4-2 — 홀로 선 반말 덩어리(「고마워」)' },
  { 옛: 5, name: '한 낱말', line: 's1e01-1', say: '안녕하세요.', expect: { verdict: 'note', note: 'length' }, 근거: '기획 §4-1 길이(한 낱말로 끝냄) — 끝맺음은 맞아 2순위 노트' },
  { 옛: 6, name: '한 낱말', line: 's1e01-3', say: '과제요.', expect: { verdict: 'note', note: 'length' }, 근거: '기획 §4-1 길이 — 짧은 대답의 들은 언어는 믿지 않는다(drama-judge-2)' },
  { 옛: 7, name: '핵심 말 빠짐', line: 's1e01-7', say: '네, 선배님! 그런데 혹시 화장실이 어디에 있는지 아세요?', expect: { verdict: 'note', note: 'missing' }, 근거: '기획 §4-1 빠진 핵심 말 — 장면 대사, 3음절 「도서관」이 MISS 아래' },
  { 옛: 8, name: '처음 보는 대사 — 맞게', line: 's1e01-t1', say: '수강 신청에 대해 여쭤볼 게 있어서 왔어요.', expect: { verdict: 'pass', sure: true }, 근거: '기획 §3-5 다른 상황 B — 핵심 말이 모두 들린 통과만 확실' },
  { 옛: 10, name: '확신 없음 — 비슷한 핵심 말', line: 's1e01-t4', say: '선생님, 혹시 화장실이 어디에 있는지 아세요?', expect: { verdict: 'pass', sure: false }, 근거: '기획 §3-5 명세 밖 표현 → 판정 보류 · 처음 보는 대사는 빠진 말 노트 없음(결정 10-31 drama-judge-4)' },
  { 옛: 11, name: '한국어 아님', line: 's1e01-1', say: 'Hello professor, I am a new international student this semester.', expect: { status: 'not_korean' }, 근거: '기획 §3-4 소리 관문 — 한국어 아님은 판정하지 않고 세지 않는다' },
  { 옛: 12, name: '반말 — 허용 표현 끝말(「어디에 있어요」 → 「어디 있어?」)', line: 's1e01-7', say: '선배, 도서관 어디 있어?', expect: { verdict: 'note', note: 'ending' }, 근거: '결정 11-01 drama-judge-5 — 허용 표현 끝말의 「요」 뺀 꼴도 반말 확신' },
  { 옛: 13, name: '확신 없음 — 「…알아?」로 끝냄', line: 's1e01-7', say: '선배님, 도서관이 어디에 있는지 알아?', expect: { verdict: 'pass', sure: false }, 근거: '결정 11-01 — 닿는 꼴이 없는 반말은 애매(노트 없음 · 확실한 통과 아님)' },
  // ① t5 자리 — 조교 선생님께 반말: 첫 문장 끝말 「살았어요」에서 「요」만 뺀 꼴 + 홀로 선 「고마워」. 처음 보는 대사의 노트는 끝맺음 · 길이뿐이고 끝맺음이 1순위다.
  { 새: 'new-01', name: '반말 — 처음 보는 대사(조교 선생님께)', line: 's1e01-t7', say: '선생님 덕분에 살았어. 정말 고마워.', expect: { verdict: 'note', note: 'ending' }, 근거: '기획 §4-2 · 결정 10-31 drama-judge-4(처음 보는 대사의 노트는 끝맺음 · 길이) · 11-01 drama-judge-5(문장마다 끝말)' },
  // ② 뜻을 뒤집은 긴 부정 — 끝맺음 · 길이 · 핵심 말이 모두 맞아 부정 규칙이 없으면 확실한 통과가 되는 말. 결정 11-03: 확실한 통과로 세지 않는다, 노트는 주지 않는다.
  //   (11-10 고침: 처음에 「자모로는 모범과 0.9 넘게 닮는다」고 적었는데 재 보니 0.86이다 — 통째 통과 선 0.9 아래라 ③과 같은 낱낱 검사 길을 잰다.
  //    0.9 이상에서 통째 통과를 끄는 쪽은 tests/드라마판정.test.mjs가 잰다. 주석만 고쳤고 읽힐 글 · 기대는 받아 적기 전에 올린 판 641544c65 그대로다.)
  { 새: 'new-02', name: '부정 어긋남 — 「-지 않아요」', line: 's1e01-2', say: '아직 낯설지만 조금씩 익숙해지고 있지 않아요.', expect: { verdict: 'pass', sure: false }, 근거: '결정 11-03 drama-judge-6 — 들은 말의 부정이 모범 · 허용 변형에 없으면 확실한 통과 아님 · 노트 없음' },
  // ③ 홀로 선 「안」 — 끝맺음 · 길이 · 핵심 말(「살게요」)은 모두 맞아, 부정 규칙이 없으면 확실한 통과가 되는 말.
  { 새: 'new-03', name: '부정 어긋남 — 홀로 선 「안」', line: 's1e01-9', say: '네, 안 살게요!', expect: { verdict: 'pass', sure: false }, 근거: '결정 11-03 drama-judge-6 — 같은 규칙의 「안」 꼴' },
  // ④ t9의 허용 변형을 글자 그대로 — 핵심 말 「어디에 있는지」 쪽 표현이 없는 변형이라, 글자 그대로일 때만 확실한 통과다(받아 적기가 한 글자라도 다르면 확신 없음).
  { 새: 'new-04', name: '처음 보는 대사 — 허용 변형 그대로(새 공개 줄 t9)', line: 's1e01-t9', say: '선배님, 이 근처에 편의점 있어요?', expect: { verdict: 'pass', sure: true }, 근거: '결정 11-01(허용 변형을 글자 그대로 말하면 통과 · 확실, exactVariant) · 대본 t9 variants(검수 drama-ep01-r12 · r13)' },
];

// 운영에서 열리는 줄인가 — 초안 줄은 목록에 둘 수 없다.
for (const t of 말테이크) if (줄(t.line).review.status !== 'passed') 멈춤(`${t.line}은 검수 통과 줄이 아니다(운영에서 안 열림) — 목록에서 빼거나 공개 줄로 바꾼다`);

// 글 그대로의 판정이 설계에서 적은 기대와 같은가(받아 적기 전 — 글이 기대를 못 내면 소리로도 못 낸다).
const 꼴 = (r) => (r.status && r.status !== 'ok' ? r.status : `${r.verdict}${r.note ? `:${r.note.kind ?? r.note}` : ''}${r.sure ? '·확신' : ''}`);
const 기대꼴 = (e) => e.status || `${e.verdict}${e.note ? `:${e.note}` : ''}${e.sure ? '·확신' : ''}`;
let 어긋남 = 0;
for (const [i, t] of 말테이크.entries()) {
  if (t.expect.status) { console.log(`· ${String(i + 1).padStart(2)} ${t.line.padEnd(10)} 글 판정 건너뜀(소리 관문은 받아 적기가 정한다) — 기대 ${기대꼴(t.expect)}`); continue; }
  const r = judgeLine(줄(t.line).spec, { transcript: t.say, seconds: 8 });
  const 같음 = r.status === 'ok' && r.verdict === t.expect.verdict && (r.note?.kind ?? null) === (t.expect.note ?? null) && (t.expect.sure === undefined || r.sure === t.expect.sure);
  if (!같음) 어긋남++;
  console.log(`${같음 ? '✅' : '❌'} ${String(i + 1).padStart(2)} ${t.line.padEnd(10)} 기대 ${기대꼴(t.expect).padEnd(14)} 글 판정 ${꼴(r)} — ${t.name}`);
}
if (어긋남) 멈춤(`글 그대로의 판정이 설계에서 적은 기대와 다른 테이크 ${어긋남}개 — 기대를 고치지 말고 설계 · 판정 어느 쪽이 어긋났는지 본다`);

// ── 소리 ──
fs.mkdirSync(밖, { recursive: true });
const 표본율 = 24000;
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(표본율, 24);
  h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const 초 = (file) => Number((((fs.statSync(file).size - 44) / 2) / 표본율).toFixed(2));
const 지문 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
const 소리파일 = (t) => path.join(밖, t.옛 ? `wrong-${String(t.옛).padStart(2, '0')}.wav` : `${t.새}.wav`);
// 앞 목록에서 온 소리는 사본으로 — 앞 회차 폴더의 파일은 건드리지 않는다.
for (const t of 말테이크.filter((x) => x.옛)) {
  const 원본 = path.join(옛밖, path.basename(소리파일(t)));
  if (!fs.existsSync(원본)) 멈춤(`앞 회차 소리가 없다: ${원본}`);
  if (!fs.existsSync(소리파일(t))) fs.copyFileSync(원본, 소리파일(t));
  if (지문(원본) !== 지문(소리파일(t))) 멈춤(`사본이 앞 회차 소리와 다르다: ${소리파일(t)}`);
}
// 새 테이크 — 일레븐랩스 공식 eleven_v4(주문 폭주 「유학생 손님」과 같은 공유 목소리 Jjeong, experiences/order-rush/qa/world-voice-cast.json g6).
const 목소리 = { 이름: 'Jjeong', id: 'DMkRitQrfpiddSQT5adl', 꼬리표: '[carefully]' };
if (굽기) {
  const 굽을 = 말테이크.filter((t) => t.새 && !fs.existsSync(소리파일(t)));
  if (!굽을.length) console.log('[테이크목록] 구울 소리가 없다(모두 있음)');
  else {
    const 키 = fs.readFileSync(path.join(os.homedir(), 'SYNK_보안', 'elevenlabs.txt'), 'utf8').trim().split(/\s+/).pop();
    let 크레딧 = 0;
    for (const t of 굽을) {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${목소리.id}?output_format=pcm_24000`, { method: 'POST', headers: { 'xi-api-key': 키, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${목소리.꼬리표} ${t.say}`, model_id: 'eleven_v4', language_code: 'ko', voice_settings: { stability: 0.75 } }) });
      const b = Buffer.from(await r.arrayBuffer());
      if (!r.ok) 멈춤(`${t.새} 굽기 실패 ${r.status}: ${b.toString('utf8').slice(0, 200)}`);
      fs.writeFileSync(소리파일(t), wav(b));
      크레딧 += Number(r.headers.get('character-cost') || 0);
      console.log(`[테이크목록] 구움 ${t.새} ${초(소리파일(t))}초`);
    }
    fs.writeFileSync(path.join(밖, 'new-usage.json'), `${JSON.stringify({ at: new Date().toISOString(), model: 'eleven_v4', voice: 목소리.이름, takes: 굽을.map((t) => t.새), credits: 크레딧 }, null, 2)}\n`);
    console.log(`[테이크목록] 새 테이크 ${굽을.length}개 · 일레븐랩스 ${크레딧}크레딧`);
  }
}
// 모범 읽기 mp3의 길이는 받아 적기 JSON(ep01-model.json)의 줄 초를 쓴다.
const 모범표 = JSON.parse(fs.readFileSync(path.join(뿌리, 'experiences/drama/s1/소리/ep01-model.json'), 'utf8'));
const 모범 = 은행.filter((l) => l.kind === 'scene').map((l, i) => {
  const file = path.join(뿌리, `experiences/drama/s1/소리/ep01-model-${String(i + 1).padStart(2, '0')}.mp3`);
  if (!fs.existsSync(file)) 멈춤(`모범 읽기 소리가 없다: ${file}`);
  if (l.review.status !== 'passed') 멈춤(`${l.id}은 검수 통과 줄이 아니다`);
  const 표줄 = (모범표.줄 || [])[i];
  if (표줄?.말 !== l.line) 멈춤(`모범 읽기 ${i + 1}번의 글이 지금 대사와 다르다: ${표줄?.말} ↔ ${l.line}`);
  return { name: '모범 읽기(Hana)', line: l.id, file, mime: 'audio/mpeg', seconds: Number(표줄.초) > 0 ? Number(표줄.초) : 6, expect: { verdict: 'pass' }, said: l.line, 근거: '모범 대사 그대로 — 통과(확신 여부는 받아 적기에 달려 기대에 넣지 않고 따로 적는다)', 소리: `저장소 ${path.basename(file)} ${지문(file)}` };
});
const 틀림 = 말테이크.map((t) => {
  if (!fs.existsSync(소리파일(t))) 멈춤(`구운 소리가 없다 — --굽기로 먼저 굽는다: ${소리파일(t)}`);
  return { name: t.name, line: t.line, file: 소리파일(t), mime: 'audio/wav', seconds: Math.max(1, 초(소리파일(t))), expect: t.expect, said: t.say, 근거: t.근거,
    소리: t.옛 ? `앞 목록 ${t.옛}번 그대로(Realtime 2.1 marin) ${지문(소리파일(t))}` : `새로 구움(일레븐 v4 ${목소리.이름}) ${지문(소리파일(t))}` };
});
const 목록 = path.join(밖, 'takes.json');
fs.writeFileSync(목록, `${JSON.stringify({ at: new Date().toISOString(), judge: DRAMA_JUDGE_VERSION, linesHash: 은행지문, lines: 은행.length, passed: 은행.filter((l) => l.review.status === 'passed').length, takes: [...모범, ...틀림] }, null, 2)}\n`);
console.log(`[테이크목록] 판정 ${DRAMA_JUDGE_VERSION} · 대사 은행 ${은행.length}줄(통과 ${은행.filter((l) => l.review.status === 'passed').length}) · LINES_HASH ${은행지문}`);
console.log(`[테이크목록] ${모범.length + 틀림.length}개(모범 읽기 ${모범.length} · 그 밖 ${틀림.length}) → ${목록}`);

// 계약 한 줄 — 초안 줄 t5는 운영(초안 닫힘)에서 받아 적기 전에 거절돼야 한다. 판정 테이크로 세지 않는다. 소리는 앞 목록 9번(받아 적기까지 가지 않는다).
const t5 = 줄('s1e01-t5');
if (t5.review.status === 'passed') 멈춤('t5가 검수 통과 줄이다 — 이 목록의 전제(초안)와 다르다');
const t5소리 = path.join(옛밖, 'wrong-09.wav');
if (fs.existsSync(t5소리)) {
  const 계약 = path.join(밖, 'contract.json');
  fs.writeFileSync(계약, `${JSON.stringify({ at: new Date().toISOString(), takes: [{ name: '계약 — 초안 줄은 안 열림', line: 's1e01-t5', file: t5소리, mime: 'audio/wav', seconds: Math.max(1, 초(t5소리)), expect: { code: 'ITEM_NOT_OPEN' }, said: null, 근거: 'talk world-speaking readRequest — 검수 전 대사는 WORLD_SPEAKING_DRAFT_ITEMS(리허설)일 때만 연다' }] }, null, 2)}\n`);
  console.log(`[테이크목록] 계약 1개 → ${계약}`);
}
