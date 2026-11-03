#!/usr/bin/env node
/**
 * 「제2의 나」 사진 아바타 일괄 처리 모의 (2026-11-03) — 실제 OpenAI를 부르지 않고 설계(docs/제2의나_사진아바타_일괄처리_설계_20261103.md)의
 * 흐름을 끝까지 돌린다: 받기 → 기준 묶음(강 · 약 · 강+) → 출고 검사 → OpenAI 쪽 파일 지우기 → 추억 사진(장면 판 편집) · 룩 묶음 → 값 · 몫.
 *
 * - 가짜 OpenAI: 이 파일 안의 작은 http 서버(/files · /batches · /files/{id}/content · DELETE /files/{id}). 묶음 결과로는 사진시험 ·
 *   GPT 셀카 · 판 편집 · 옷장 시험에서 이미 구운 판을 돌려준다(공용 작업본 .tmp/me2-20261102/photo-gpt/, git 밖).
 * - 부르기는 tools/lib/오픈AI키.mjs 용도 '사진' — 받아 적기 몫을 남긴 만큼만(결정 11-03 「무료 크레딧 안에서」). 키 · 몫 · 장부는 임시 파일.
 * - 출고 검사는 같은 폴더 출고검사.py(SFace 숫자만, 학생 얼굴은 AI · 사람 눈에 보내지 않음).
 * - 몫이 넉넉한 판과 빠듯한 판을 둘 다 돌려, 빠듯하면 차례(기준 → 룩 → 추억 사진)대로 넣을 만큼만 내고 나머지는 「배송 지연」으로 남는지 본다.
 *
 *   node experiences/drama/qa/제2의나-20261102/일괄처리/일괄모의.mjs
 * 나오는 곳: .tmp/me2-20261102/일괄모의/(요청 JSONL · 받은 판 · 결과.json — 유호님 사진이 들어 있어 git 밖)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const 작업 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102');
const G = path.join(작업, 'photo-gpt');
const 밖 = path.join(작업, '일괄모의');
const 유호올림 = 'C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/기준그림/얼굴세트/ref_pro01_face.png';

// 값(토큰당 USD, 동기 정가 — tools/GPT콘티굽기.mjs 값표, OpenAI 모델 문서 10-29). 일괄 처리는 절반(Batch 안내 「50% cost discount」).
const 값 = { 글: 5e-6 / 2, 그림: 8e-6 / 2, 출력: 30e-6 / 2 };
const 크기 = '1152x1536';      // 3:4 — 시험 판(1086×1448)과 같은 결, 가로 · 세로 16의 배수
const 출력토큰 = 6300;         // 1024×1536 5,488 · 1280×1600 7,481(기록 실측) 사이를 넓이로 어림 — 시범 첫 묶음에서 실측으로 바꾼다
const 그림토큰 = 1500;         // 참고 그림 한 장(기록 실측 1,505~1,508)
const 어림 = (줄) => Math.round(줄.body.prompt.length / 4) * 값.글 + 줄.body.images.length * 그림토큰 * 값.그림 + 출력토큰 * 값.출력;

const 첫 = (폴더, 머리) => {
  const f = fs.readdirSync(폴더).filter((n) => n.startsWith(머리) && /\.png$/.test(n)).sort();
  if (!f.length) throw new Error(`판이 없다: ${폴더}/${머리}*`);
  return path.join(폴더, f[0]);
};
const 읽기 = (p) => fs.readFileSync(p, 'utf8').trim();

// 학생 여섯 — 유호님(실제 사진, 본인 동의) · 대역 다섯(지어낸 사람). 판 = 이 모의에서 가짜 OpenAI가 돌려줄 이미 구운 그림.
const 나이판 = path.join(G, '나이판', '판');
const 학생들 = [
  ...[['yuho', 유호올림], ['u1', path.join(G, 'u1-up.jpg')], ['u2', path.join(작업, 'photo-nb2', 'refs', 'u2-up.jpg')]].map(([id, 올림]) => ({ id, 올림,
    기준: { 강: 첫(path.join(G, '판'), `gpt2-${id}-강_`), 약: 첫(path.join(G, '판'), `gpt2-${id}-약_`), '강+': 첫(path.join(G, '강플편집판', '판'), `gpt2-${id}-강플_`) },
    글: (lv) => (lv === '강+' ? 읽기(path.join(G, '지시문', `base-${id}-강플.txt`)) : null) })),
  ...['a36', 'a45', 'a52'].map((a) => ({ id: a, 올림: 첫(나이판, `up-${a}_`), 기준: { 강: 첫(나이판, `base-${a}-강_`), 약: 첫(나이판, `base-${a}-약_`), '강+': 첫(나이판, `base-${a}-강플_`) }, 글: (lv) => 읽기(path.join(G, '나이', `base-${a}-${lv}.txt`)) })),
];
// 장면 판(1화 식당 김치) — 태오 · 식판 · 배경이 확정된 판. 학생 자리 대역이 남 · 여 둘이라 판도 둘(이 모의에서는 시험 판을 그대로 판으로 씀).
const 판 = { 여: path.join(G, '셀카판', '판', 'gsf-u1-kimchi_184032_1.png'), 남: path.join(G, '셀카판', '판', 'gsf-u2-kimchi_184309.png') };
const 셀카결과 = { yuho: ['남', 'pe-u2-to-yuho_'], u1: ['남', 'pe-u2-to-u1_'], u2: ['여', 'pe-u1-to-u2_'] };
// 룩마다 출고 검사 칸 — 얼굴 둘레를 건드리는 것(머리 모양 · 염색 · 안경 · 모자)은 「머리」, 옷 · 목걸이 · 귀걸이는 「옷」(옷장조립.mjs의 아이템)
const 룩들 = { hair1: '머리', hair2: '머리', outfit: '옷', acc: { yuho: '머리', u1: '옷', u2: '머리' } };
const 룩칸 = (who, k) => (typeof 룩들[k] === 'string' ? 룩들[k] : 룩들[k][who]);

function 검사(...인자) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', path.join(여기, '출고검사.py'), ...인자], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`출고검사.py ${인자[0]} 실패: ${r.stderr.split('\n').filter((l) => !/WARN/.test(l)).join(' ').slice(0, 400)}`);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

/* ---------- 가짜 OpenAI ---------- */
function 가짜OpenAI(답그림) {
  const 파일 = new Map(), 묶음 = new Map(), 기록 = [];
  let n = 0;
  const 새id = (머리) => `${머리}-mock${++n}`;
  const s = http.createServer((req, res) => {
    const 조각 = [];
    req.on('data', (d) => 조각.push(d));
    req.on('end', () => {
      const 몸 = Buffer.concat(조각), u = new URL(req.url, 'http://x'), 길 = u.pathname.replace(/^\/v1/, '');
      기록.push(`${req.method} ${길}`);
      const 답 = (상태, x, 글) => { res.writeHead(상태, { 'Content-Type': 'application/json', 'x-request-id': `req_${n}` }); res.end(글 ?? JSON.stringify(x)); };
      if (req.method === 'POST' && 길 === '/files') {
        const 머리글 = 몸.subarray(0, 2000).toString('latin1');
        const 목적 = /name="purpose"\r\n\r\n([^\r]+)/.exec(머리글)?.[1] || '?';
        const id = 새id('file');
        // 묶음 입력 JSONL은 내용을 남기고, 그림은 크기만 남긴다(학생 사진 바이트를 가짜 서버에도 붙들지 않음)
        const 글 = 목적 === 'batch' ? 몸.toString('utf8').split(/\r\n\r\n/).slice(-1)[0].split(/\r\n--/)[0] : null;
        파일.set(id, { 목적, 바이트: 몸.length, 글 });
        return 답(200, { id, object: 'file', purpose: 목적, bytes: 몸.length, expires_at: Math.floor(Date.now() / 1000) + 25 * 3600 });
      }
      if (req.method === 'POST' && 길 === '/batches') {
        const { input_file_id: 입력, endpoint } = JSON.parse(몸.toString('utf8'));
        const 줄들 = 파일.get(입력).글.trim().split('\n').map((l) => JSON.parse(l));
        const 나옴 = 줄들.map((l) => {
          const 그림 = 답그림(l.custom_id);
          const usage = { input_tokens: 0, input_tokens_details: { text_tokens: Math.round(l.body.prompt.length / 4), image_tokens: l.body.images.length * 그림토큰 }, output_tokens: 출력토큰 };
          usage.input_tokens = usage.input_tokens_details.text_tokens + usage.input_tokens_details.image_tokens;
          return { id: `batch_req_${l.custom_id}`, custom_id: l.custom_id, response: { status_code: 200, body: { created: 0, data: [{ b64_json: fs.readFileSync(그림).toString('base64') }], usage } }, error: null };
        });
        const 출력 = 새id('file');
        파일.set(출력, { 목적: 'batch_output', 글: 나옴.map((x) => JSON.stringify(x)).join('\n') + '\n' });
        const id = 새id('batch');
        묶음.set(id, { id, object: 'batch', endpoint, input_file_id: 입력, status: 'validating', output_file_id: 출력, request_counts: { total: 줄들.length, completed: 0, failed: 0 } });
        return 답(200, 묶음.get(id));
      }
      const 묶음길 = /^\/batches\/([\w-]+)$/.exec(길);
      if (req.method === 'GET' && 묶음길) {
        const b = 묶음.get(묶음길[1]);
        b.status = 'completed'; b.request_counts.completed = b.request_counts.total;  // 모의는 첫 확인에서 끝난 것으로
        return 답(200, b);
      }
      const 내용길 = /^\/files\/([\w-]+)\/content$/.exec(길);
      if (req.method === 'GET' && 내용길) return 답(200, null, 파일.get(내용길[1]).글);
      const 지움길 = /^\/files\/([\w-]+)$/.exec(길);
      if (req.method === 'DELETE' && 지움길) { const 있었나 = 파일.delete(지움길[1]); return 답(있었나 ? 200 : 404, { id: 지움길[1], object: 'file', deleted: 있었나 }); }
      답(404, { error: { code: 'not_found', message: 길 } });
    });
  });
  return new Promise((ok) => s.listen(0, '127.0.0.1', () => ok({ s, 파일, 기록, 바탕: `http://127.0.0.1:${s.address().port}/v1` })));
}

/* ---------- 일괄 처리 한 바퀴 ---------- */
async function 한바퀴(이름, 몫, 키통로) {
  const { 차례로부르기, 사진몫, 사진씀 } = 키통로;
  const 판정 = { 이름, 묶음: [], 학생: {}, 지연: [], 지운파일: 0, 남은파일: 0, 장부USD: 0, 실제USD: 0 };
  const 답그림 = (cid) => {
    const [종류, who, 더] = cid.split('.');
    const s = 학생들.find((x) => x.id === who);
    if (종류 === '기준') return s.기준[더];
    if (종류 === '추억') return 첫(path.join(G, '판편집판', '판'), 셀카결과[who][1]);
    const 옷장 = path.join(G, '옷장판', '판');
    return fs.readdirSync(옷장).some((n) => n.startsWith(`wd2-${who}-${더}_`)) ? 첫(옷장, `wd2-${who}-${더}_`) : 첫(옷장, `wd-${who}-${더}_`);
  };
  const 서버 = await 가짜OpenAI(답그림);
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-me2-batch-'));
  fs.writeFileSync(path.join(임시, 'k.txt'), 'sk-mock-photo-0123456789');
  fs.writeFileSync(path.join(임시, '목록.json'), JSON.stringify([{ 이름: '사진', 파일: 'k.txt' }]));
  fs.writeFileSync(path.join(임시, '몫.json'), JSON.stringify(몫));
  Object.assign(process.env, { SYNK_OPENAI_BASE: 서버.바탕, SYNK_OPENAI_KEYLIST: path.join(임시, '목록.json'), SYNK_OPENAI_PHOTO_BUDGET: path.join(임시, '몫.json'), SYNK_OPENAI_PHOTO_LEDGER: path.join(임시, '장부.jsonl') });
  const 부르기 = (만들기, 옵션) => 차례로부르기(만들기, { 용도: '사진', 키이름: '사진', ...옵션 });
  const 올리기 = async (바이트, 파일이름, 목적) => {
    const 몸 = () => { const f = new FormData(); f.append('purpose', 목적); f.append('expires_after[anchor]', 'created_at'); f.append('expires_after[seconds]', String(25 * 3600)); f.append('file', new Blob([바이트]), 파일이름); return f; };
    return (await 부르기(() => ({ 주소: `${서버.바탕}/files`, 몸: 몸() }), { 어림USD: 0 })).답.id;
  };
  const 지우기 = async (id) => { const r = await 부르기(() => ({ 주소: `${서버.바탕}/files/${id}` }), { 어림USD: 0, 방법: 'DELETE' }); if (r.답.deleted) 판정.지운파일++; };
  const 안전id = (who) => crypto.createHash('sha256').update(`me2:${who}`).digest('hex').slice(0, 32);
  const 줄 = (cid, who, 글, 그림id들) => ({ custom_id: cid, method: 'POST', url: '/v1/images/edits',
    body: { model: 'gpt-image-2.5-sunburst', prompt: 글, images: 그림id들.map((file_id) => ({ file_id })), size: 크기, quality: 'max', n: 1, output_format: 'jpeg', output_compression: 90, moderation: 'auto', safety_identifier: 안전id(who) } });

  // 1. 받기 — 막지 않는다(손보거나 물어봄, 11-03 유호님 「사진을 고르는건 자유」). 다만 기준 묶음(강 · 약 · 강+) 몫이 없으면 사진을 아예 받지 않는다(원본이 몫을 기다리며 남지 않게)
  const { 일감들 } = await import('../사진시험/지시문조립.mjs');
  const 기준글 = Object.fromEntries(일감들(path.join(작업, 'photo-nb')).filter((j) => j.id.startsWith('base-')).map((j) => [j.id, j.prompt]));
  const 기준판들 = ['강', '약', '강+'];  // 첫 묶음에 셋 — 원본은 이 묶음 뒤 지우므로 강+(「아직 나이 들어 보여요」)도 원본으로 함께 굽는다
  const 기준지시문 = (s, lv) => s.글?.(lv) ?? 기준글[`base-${s.id}-${lv}`];
  const 기준줄 = (s, lv) => 줄(`기준.${s.id}.${lv}`, s.id, 기준지시문(s, lv), ['file-?']);
  const 받음 = 검사('받기', ...학생들.map((s) => s.올림));
  const 올린id = {};
  { const { 시작, 끝, 상한 } = 사진몫(); let 남음 = 상한 - 사진씀(시작, 끝);
    for (const [i, s] of 학생들.entries()) {
      판정.학생[s.id] = { 받기: 받음[i].판정 };
      // 받기는 막지 않는다 — 「물어봄」(얼굴 여럿 · 못 찾음)은 학생이 고른 대로 이어 간다고 본다(모의의 올림은 모두 얼굴 하나)
      const 기준값 = 기준판들.reduce((a, lv) => a + 어림(기준줄(s, lv)), 0) * 1.3;
      if (기준값 > 남음) { 판정.학생[s.id].받기 = '받지 않음 — 이번 주기 사진 몫이 모자람(준비된 얼굴로 시작, 다음 주기에 다시 찍기)'; continue; }
      남음 -= 기준값;
      올린id[s.id] = await 올리기(fs.readFileSync(s.올림), `${s.id}.${path.extname(s.올림).slice(1)}`, 'vision');
    } }
  // 2. 일감 — 차례: 기준(새 학생) → 룩(학생이 고른 것) → 추억 사진(다음에 열어 볼 것)
  const { 판편집 } = await import('../사진시험/판편집조립.mjs');
  const { 대상 } = await import('../사진시험/지시문조립.mjs');
  const 차례 = [];
  for (const s of 학생들) if (올린id[s.id]) for (const lv of 기준판들) 차례.push({ 종류: '기준', who: s.id, 글: 기준지시문(s, lv), 그림: () => [올린id[s.id]], cid: `기준.${s.id}.${lv}` });
  // 3. 기준 묶음을 내고 받고 검사한 뒤 원본(우리 쪽 · OpenAI 쪽)을 지운다
  const 묶음돌리기 = async (일감, 이름표) => {
    if (!일감.length) return [];
    const { 시작, 끝, 상한 } = 사진몫();
    let 남음 = 상한 - 사진씀(시작, 끝);
    // 한 학생의 기준 강 · 약 · 강+는 함께 내거나 함께 미룬다(원본은 그 묶음 뒤 바로 지우므로 반쪽만 구우면 다시 못 굽는다)
    const 무리 = [];
    for (const j of 일감) {
      const 열쇠 = j.종류 === '기준' ? `기준.${j.who}` : j.cid;
      const 있던 = 무리.find((m) => m.열쇠 === 열쇠);
      const l = 줄(j.cid, j.who, j.글, j.그림());
      if (있던) 있던.줄.push({ j, l }); else 무리.push({ 열쇠, 줄: [{ j, l }] });
    }
    const 낼 = [];
    for (const m of 무리) {
      const usd = m.줄.reduce((a, x) => a + 어림(x.l) * 1.3, 0);
      if (usd <= 남음) { 낼.push(...m.줄); 남음 -= usd; } else for (const x of m.줄) 판정.지연.push({ 일감: x.j.cid, 까닭: `사진 몫 모자람 — 다음 주기(${몫.주기.끝})에 「배송 지연」 안내` });
    }
    if (!낼.length) return [];
    const 입력 = await 올리기(Buffer.from(낼.map((x) => JSON.stringify(x.l)).join('\n') + '\n'), `${이름표}.jsonl`, 'batch');
    fs.writeFileSync(path.join(밖, `${이름}_${이름표}_요청.jsonl`), 낼.map((x) => JSON.stringify(x.l)).join('\n') + '\n');
    const 어림합 = 낼.reduce((a, x) => a + 어림(x.l), 0);
    const b = (await 부르기(() => ({ 주소: `${서버.바탕}/batches`, 몸: JSON.stringify({ input_file_id: 입력, endpoint: '/v1/images/edits', completion_window: '24h' }), json: true }), { 어림USD: Number(어림합.toFixed(4)), 메모: `${이름표} ${낼.length}줄` })).답;
    const 상태 = (await 부르기(() => ({ 주소: `${서버.바탕}/batches/${b.id}` }), { 어림USD: 0, 방법: 'GET' })).답;
    const 글 = (await 부르기(() => ({ 주소: `${서버.바탕}/files/${상태.output_file_id}/content` }), { 어림USD: 0, 방법: 'GET', 날글: true })).글;
    for (const id of [입력, 상태.output_file_id]) await 지우기(id);
    판정.묶음.push({ 이름표, 줄: 낼.length, 어림USD: Number(어림합.toFixed(3)) });
    return 글.trim().split('\n').map((t) => JSON.parse(t)).map((o) => {
      const u = o.response.body.usage;
      판정.실제USD += u.input_tokens_details.text_tokens * 값.글 + u.input_tokens_details.image_tokens * 값.그림 + u.output_tokens * 값.출력;
      const p = path.join(밖, 이름, `${o.custom_id}.jpg`);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.from(o.response.body.data[0].b64_json, 'base64'));
      return { cid: o.custom_id, p };
    });
  };
  const 기준판 = await 묶음돌리기(차례, '기준');
  const 고른기준 = {};
  for (const s of 학생들) {
    if (!올린id[s.id]) continue;
    const 강 = 기준판.find((x) => x.cid === `기준.${s.id}.강`), 약 = 기준판.find((x) => x.cid === `기준.${s.id}.약`), 강플 = 기준판.find((x) => x.cid === `기준.${s.id}.강+`);
    if (강 && 약 && 강플) {
      const r = 검사('기준', s.올림, 강.p, 약.p, 강플.p);
      판정.학생[s.id].기준 = r.판들.map((x) => `${x.판} ${x['올린 사진과']}(${x.등급})`).join(' · ');
      판정.학생[s.id].기본 = r.다시굽기 ? `${r.기본}(셋 다 문턱 아래 — 원본이 있는 동안 동기로 한 번 더)` : r.기본;
      고른기준[s.id] = { 강: 강.p, 약: 약.p, '강+': 강플.p }[r.기본];
    } else 판정.학생[s.id].기본 = '배송 지연';
    await 지우기(올린id[s.id]);  // 기준 묶음이 끝나면 원본을 지운다 — 다시 굽기에 원본을 쓰지 않는다
  }
  // 4. 룩 · 추억 사진 묶음 — 고른 기준 한 장(과 장면 판)만 참고로
  const 기준id = {}, 판id = {};
  for (const [who, p] of Object.entries(고른기준)) 기준id[who] = await 올리기(fs.readFileSync(p), `${who}-기준.jpg`, 'vision');
  for (const [k, p] of Object.entries(판)) 판id[k] = await 올리기(fs.readFileSync(p), `판-${k}.png`, 'vision');
  const 둘째 = [];
  for (const who of ['yuho', 'u1', 'u2'].filter((w) => 기준id[w])) {
    for (const k of Object.keys(룩들)) 둘째.push({ 종류: '룩', who, 글: 읽기(path.join(G, '옷장', `${who}-${k}.txt`)), 그림: () => [기준id[who]], cid: `룩.${who}.${k}` });
  }
  for (const who of ['yuho', 'u1', 'u2'].filter((w) => 기준id[w])) {
    둘째.push({ 종류: '추억', who, 글: 판편집(대상.find((d) => d.id === who).옷), 그림: () => [판id[셀카결과[who][0]], 기준id[who]], cid: `추억.${who}.kimchi` });
  }
  const 둘째판 = await 묶음돌리기(둘째, '룩과추억');
  for (const x of 둘째판) {
    const [종류, who, k] = x.cid.split('.');
    const 학 = 판정.학생[who];
    if (종류 === '추억') {
      const r = 검사('셀카', 고른기준[who], 판[셀카결과[who][0]], x.p)[0];
      학.추억 = `학생 ${r['학생↔기준']} · 태오 ${r['태오↔판 태오']} → ${r.판정}`;
    } else {
      const r = 검사('룩', 고른기준[who], 룩칸(who, k), x.p)[0];
      (학.룩 ||= []).push(`${k} ${r.기준과}(${r.판정 === '통과' ? '통과' : '다시'})`);
    }
  }
  for (const id of [...Object.values(기준id), ...Object.values(판id)]) await 지우기(id);
  판정.남은파일 = 서버.파일.size;
  판정.장부USD = Number(사진씀(사진몫().시작, 사진몫().끝).toFixed(3));
  판정.실제USD = Number(판정.실제USD.toFixed(3));
  판정.부른길 = 서버.기록.reduce((a, l) => ((a[l.replace(/mock\d+/, '*')] = (a[l.replace(/mock\d+/, '*')] || 0) + 1), a), {});
  서버.s.close();
  return 판정;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  fs.mkdirSync(밖, { recursive: true });
  const 키통로 = await import('../../../../../tools/lib/오픈AI키.mjs');
  const 오늘 = new Date(), 날 = (d) => new Date(오늘.getTime() + d * 864e5).toISOString().slice(0, 10);
  const 주기 = { 시작: 날(-5), 끝: 날(25) };
  // 넉넉: synk.yuh Pro 월 $200 · 지난 주기 받아 적기 $4(어림) → 받아 적기 몫 $20 · 여유 $10 → 사진 상한 $170
  // 빠듯: 같은 주기 끝 무렵 남은 크레딧 $31.5 → 사진 상한 $1.5 — 기준은 들어가고 룩 · 추억 사진 일부는 「배송 지연」
  const 판들 = [];
  for (const [이름, 크레딧] of [['넉넉', 200], ['빠듯', 31.5]]) {
    판들.push(await 한바퀴(이름, { 주기, 월크레딧USD: 크레딧, 받아적기: { 지난주기실사용USD: 4 }, 여유USD: 10 }, 키통로));
  }
  fs.writeFileSync(path.join(밖, '결과.json'), JSON.stringify(판들, null, 1) + '\n');
  for (const p of 판들) {
    console.log(`\n## ${p.이름} — 묶음 ${p.묶음.map((b) => `${b.이름표} ${b.줄}줄 $${b.어림USD}`).join(' · ')} · 장부 $${p.장부USD}(1.3배) · 모의 실제 $${p.실제USD} · 지연 ${p.지연.length} · 지운 파일 ${p.지운파일} · 남은 파일 ${p.남은파일}`);
    for (const [who, r] of Object.entries(p.학생)) console.log(`- ${who}: 받기 ${r.받기} · 기준 ${r.기준 || '-'} → 기본 ${r.기본 || '-'}${r.룩 ? ` · 룩 ${r.룩.join(' · ')}` : ''}${r.추억 ? ` · 추억 ${r.추억}` : ''}`);
    if (p.지연.length) console.log(`- 배송 지연: ${p.지연.map((d) => d.일감).join(' · ')}`);
  }
  console.log(`\n[모의] → ${path.join(밖, '결과.json')}`);
}
