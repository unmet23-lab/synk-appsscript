// 답 은행 3판의 녹음 줄 전체를 하온 목소리 Zoe(일레븐 v4)로 굽는다(2026-11-02, 유호님 「응, Zoe로 구워」).
// 평범한 판 시험에서 Zoe 통째판 · 조각을 이은 판 둘 다 「되게 좋은데」(결정 11-02) — 은행은 조각을 구워 이어 붙이는 방식으로 간다.
// - 줄: 은행3.mjs의 녹음 줄(반응 · 질문 · 이끔 · 되묻기 · 한국어로) + 첫인사. 줄마다 연기 꼬리표 하나(반응 id · 이끔 종류로 정한다).
// - 굽기: 18줄 안팎씩 묶어 한 번에 이어 읽히고(10-29 「AI티」 고침) 묶음마다 두 판. 힉스필드 founder CLI `elevenlabs_v4` · stability 0.5.
//   값은 접수 전에 묻고 50크레딧을 넘으면 멈춘다. 이미 받은 판은 다시 굽지 않는다.
// - 자르기 · 고르기: 드라마 목소리후보 나누기.py(받아쓰기 낱말 시각)로 줄마다 자르고, 판들 가운데 다시 받아 적은 글이 대본과 더 맞는 판 →
//   같으면 tools/목소리엉킴.py의 엉킨 프레임이 적고 최고 음높이 560Hz 아래인 판. 맞음이 낮은 줄은 「다시」로 그 줄만 새 묶음으로 굽는다.
// - 내보내기: 고른 줄을 −18 LUFS로 맞춰 experiences/realtime-roleplay/소리/하온_zoe/에 번호 파일 + 목록.json(글 → 파일)으로 둔다.
// 쓰는 법: node 은행굽기.mjs <목록|값|굽기|자르기|고르기|다시 <번호,…>|내보내기|엮기>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as 은행 from './은행3.mjs';
import { 차례들 } from './이어붙이기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 폴더 = path.join(작업, '은행소리_Zoe');
const 기록파일 = path.join(폴더, '기록.json');
const 내보낼곳 = path.join(저장소, 'experiences', 'realtime-roleplay', '소리', '하온_zoe');
const 힉스집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
const 힉스실행 = path.join(process.env.APPDATA, 'npm', 'higgsfield.exe');
const 목소리 = { 이름: 'Zoe', id: 'd0374db1-44b9-4f05-939e-0a9ae9dbbe6a' };
const 판수 = 2; const 묶음크기 = 18; const 상한 = 50;
const 첫인사 = '안녕하세요! 와, 와 주셔서 고마워요. 이름이 뭐예요?';

// 반응 id → 연기 꼬리표(팬을 만나 반갑고 들뜬 20대 아이돌). 「헤헤 · 하하」로 시작하는 줄은 [laughs], 「어, 벌써」는 [surprised]
const 반응꼬리표 = {
  이름: '[delighted]', 인사: '[cheerful]', 이름망설임: '[gently]', '나라.몽골': '[amazed]', '나라.다른외국': '[amazed]', '나라.한국에삶': '[cheerful]',
  '좋아함.노래': '[excited]', '좋아함.무대': '[happy]', '좋아함.다': '[happy]', '좋아함.하온': '[happy]', '좋아함.모름': '[gently]', '좋아함.다른것': '[cheerful]',
  '부탁.사인': '[cheerful]', '부탁.사인덧붙임': '[cheerful]', '부탁.사진': '[excited]', '부탁.동작': '[playfully]', '부탁.포옹': '[playfully]', '부탁.선물': '[happy]',
  '부탁.노래애교': '[playfully]', '부탁.모름': '[friendly]', '부탁.고침': '[apologetic]', '부탁.더있기': '[warmly]',
  '공통.칭찬': '[happy]', '공통.팬심': '[warmly]', '공통.사랑': '[happy]', '공통.농담': '[playfully]', '공통.기쁨': '[happy]', '공통.긴장': '[gently]',
  '공통.기다림': '[warmly]', '공통.밥안부': '[cheerful]', '공통.안부': '[warmly]', '공통.개인질문': '[playfully]', '공통.연락요청': '[playfully]',
  '공통.일정질문': '[playfully]', '공통.몽골질문': '[excited]', '공통.되물음': '[cheerful]', '공통.다른가수': '[cheerful]', '공통.응원': '[warmly]',
  '공통.선넘음': '[playfully]', '공통.맞장구': '[curious]', '공통.짧은대답': '[happy]', '공통.한국어섞임': '[happy]',
  '끝.고마워': '[warmly]', '끝.작별': '[warmly]', '끝.감탄': '[happy]', '작별뒤.약속': '[cheerful]', '작별뒤.약속오해': '[playfully]',
};
const 이끔꼬리표 = { 이름: '[curious]', 나라: '[curious]', 좋아함: '[curious]', 사인: '[friendly]', 사인끝: '[proud]', 마무리짧게: '[cheerful]', 마무리길게: '[warmly]', 작별: '[warmly]' };
const 글꼬리표 = (글, 기본) => (/^(헤헤|하하)/.test(글) ? '[laughs]' : /^어, 벌써/.test(글) ? '[surprised]' : 기본);

/** 녹음 줄 전체(은행3 녹음줄수와 같은 출처) + 첫인사 — [{번호, 말, 꼬리표, 출처}] */
export function 목록() {
  const 줄 = new Map();
  const 넣기 = (말, 꼬리표, 출처) => { if (말 && !줄.has(말)) 줄.set(말, { 말, 꼬리표: 글꼬리표(말, 꼬리표), 출처 }); };
  넣기(첫인사, '[excited]', '첫인사');
  for (const [k, v] of Object.entries(은행.이끔)) v.forEach((t) => 넣기(t, 이끔꼬리표[k], `이끔.${k}`));
  for (const r of 은행.반응들) {
    const 기본 = 반응꼬리표[r.id] || '[cheerful]';
    (r.말 || []).forEach((t) => 넣기(t, 기본, r.id));
    Object.values(r.순간별 || {}).flat().forEach((t) => 넣기(t, 기본, r.id));
    const 질문 = Array.isArray(r.질문) ? r.질문 : Object.values(r.질문 || {}).flat();
    질문.forEach((t) => 넣기(t, '[curious]', `${r.id}.질문`));
  }
  for (const [s, v] of Object.entries(은행.순간)) { v.되묻기.forEach((t) => 넣기(t, '[gently]', `되묻기.${s}`)); v.한국어로.forEach((t) => 넣기(t, '[gently]', `한국어로.${s}`)); }
  return [...줄.values()].map((l, i) => ({ 번호: i + 1, ...l }));
}
const 묶음들 = () => { const 줄 = 목록(); const 묶 = []; for (let i = 0; i < 줄.length; i += 묶음크기) 묶.push(줄.slice(i, i + 묶음크기)); return 묶.map((줄들, k) => ({ 이름: `묶음${String(k + 1).padStart(2, '0')}`, 줄: 줄들 })); };
const 대화 = (줄) => JSON.stringify(줄.map((l) => ({ text: `${l.꼬리표} ${l.말}`, voice_id: 목소리.id, voice_type: 'preset' })));

function 힉스(인자) {
  const r = spawnSync(힉스실행, [...인자, '--json'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 }, timeout: 15 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
  try { return JSON.parse((r.stdout || '').trim()); } catch { throw new Error(`힉스필드 답을 못 읽었다: ${(r.stdout || r.stderr || '').slice(0, 300)}`); }
}
const 잔액 = () => (spawnSync(힉스실행, ['account', 'status'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 } }).stdout || '').trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 번호찾기 = (o) => { if (!o || typeof o !== 'object') return null; for (const k of ['id', 'job_id']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; } return null; };
const 주소찾기 = (o) => { if (!o || typeof o !== 'object') return null; if (typeof o.result_url === 'string') return o.result_url; if (typeof o.url === 'string' && /^https?:/.test(o.url)) return o.url; for (const v of Object.values(o)) { const x = 주소찾기(v); if (x) return x; } return null; };
const 기록 = () => (fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : { 판: {}, 묶음: {} });
const 저장 = (b) => { fs.mkdirSync(폴더, { recursive: true }); fs.writeFileSync(기록파일, JSON.stringify(b, null, 1)); };

/** 묶음 하나를 나누기.py가 읽는 꼴로 둔다(역 = 묶음 이름) */
function 묶음쓰기(묶음) {
  fs.mkdirSync(폴더, { recursive: true });
  fs.writeFileSync(path.join(폴더, `${묶음.이름}_줄.json`), JSON.stringify(묶음.줄.map((l) => ({ ...l, 되묻기: false })), null, 1));
  const b = 기록(); b.묶음[묶음.이름] = 묶음.줄.map((l) => l.말); 저장(b);
}

function 값(묶음목록 = 묶음들()) {
  let 합 = 0;
  for (const m of 묶음목록) { const c = Number(힉스(['generate', 'cost', 'elevenlabs_v4', '--dialogue', 대화(m.줄), '--stability', '0.5'])?.credits ?? NaN); if (!Number.isFinite(c)) throw new Error(`값을 못 받았다: ${m.이름}`); 합 += c * 판수; console.log(`${m.이름} ${m.줄.length}줄 한 판 ${c}`); }
  console.log(`합(두 판씩) ${합.toFixed(2)}크레딧 · ${잔액()}`);
  return 합;
}

async function 굽기(묶음목록 = 묶음들()) {
  const 합 = 값(묶음목록);
  if (합 > 상한) throw new Error(`값이 ${합.toFixed(2)}크레딧으로 ${상한}을 넘는다 — 여쭌 뒤에 굽는다`);
  const b = 기록(); b.잔액전 ??= 잔액(); 저장(b);
  for (const m of 묶음목록) 묶음쓰기(m);
  const 할일 = 묶음목록.flatMap((m) => Array.from({ length: 판수 }, (_, k) => ({ m, 열쇠: `${m.이름}_${k + 1}` })));
  for (let i = 0; i < 할일.length; i += 4) { // 한 번에 넷씩 내고 받는다(영상은 많이 내면 거절된 적이 있다 — 현장노트 higgsfield)
    const 이번 = 할일.slice(i, i + 4);
    for (const 일 of 이번) {
      const 지금 = 기록(); if (지금.판[일.열쇠]?.작업) continue;
      const 이전 = Date.now();
      let id = 번호찾기(힉스(['generate', 'create', 'elevenlabs_v4', '--dialogue', 대화(일.m.줄), '--stability', '0.5']));
      if (!id) { const 목록들 = 힉스(['generate', 'list', '--size', '6']); const a = Array.isArray(목록들) ? 목록들 : 목록들.jobs || 목록들.items || 목록들.data || []; id = a.find((x) => x.job_type === 'elevenlabs_v4' && Date.parse(x.created_at) >= 이전 - 5000)?.id; }
      if (!id) throw new Error(`접수 번호를 못 받았다: ${일.열쇠}`);
      지금.판[일.열쇠] = { 묶음: 일.m.이름, 작업: id }; 저장(지금); console.log(`접수 ${일.열쇠} → ${id}`);
    }
    for (const 일 of 이번) {
      const 지금 = 기록(); const 판 = 지금.판[일.열쇠];
      if (판.판 && fs.existsSync(path.join(폴더, 판.판))) continue;
      const 주소 = 주소찾기(힉스(['generate', 'wait', 판.작업]));
      if (!주소) throw new Error(`결과 주소가 없다: ${일.열쇠}`);
      판.판 = `${일.열쇠}${path.extname(new URL(주소).pathname) || '.mp3'}`;
      fs.writeFileSync(path.join(폴더, 판.판), Buffer.from(await (await fetch(주소)).arrayBuffer()));
      저장(지금); console.log(`받음 ${판.판}`);
    }
  }
  const 끝 = 기록(); 끝.잔액뒤 = 잔액(); 저장(끝); console.log(`잔액 ${끝.잔액전} → ${끝.잔액뒤}`);
}

function 자르기() {
  const b = 기록();
  const 나누기 = path.resolve(저장소, 'experiences/drama/qa/목소리후보-20261030/나누기.py');
  for (const [열쇠, 판] of Object.entries(b.판)) {
    const 나감 = path.join(폴더, '줄', 열쇠);
    if (fs.existsSync(path.join(나감, `${열쇠}.json`))) continue;
    // 한 줄짜리 묶음(「헤헤.」처럼 받아쓰기에 안 남는 웃음 줄)은 맞출 글이 없어 나누기.py가 줄 경계를 뒤집는다 — 앞뒤 무음만 잘라 그대로 쓴다
    if ((b.묶음[판.묶음] || []).length === 1) {
      fs.mkdirSync(나감, { recursive: true });
      const 파일 = `${열쇠}-01.mp3`;
      const x = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(폴더, 판.판), '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,afade=t=in:d=0.01,areverse,afade=t=in:d=0.04,areverse', '-ar', '24000', '-ac', '1', '-b:a', '96k', path.join(나감, 파일)], { encoding: 'utf8' });
      if (x.status !== 0) { console.log(`자르기 못함 ${열쇠} — ${x.stderr.slice(0, 160)}`); continue; }
      const 말 = b.묶음[판.묶음][0];
      fs.writeFileSync(path.join(나감, `${열쇠}.json`), JSON.stringify({ 역: 판.묶음, 목소리판: 열쇠, 줄: [{ 번호: 1, 말, 되묻기: false, 파일, 초: null, 받아쓰기: '', 맞음: 짧은줄(말) ? 1 : 0 }] }, null, 1));
      console.log(`자름 ${열쇠}(한 줄 · 무음만 자름)`); continue;
    }
    const r = spawnSync('py', ['-3', '-I', 나누기, 폴더, 판.묶음, 열쇠, 나감, 열쇠, '0.2'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    // 한 판의 받아쓰기 맞춤이 어긋나면(줄을 건너뛰어 읽은 판 — 끝이 시작보다 앞) 그 판만 건너뛰고 다른 판으로 고른다
    if (r.status !== 0) { console.log(`자르기 못함 ${열쇠} — ${(r.stderr || '').trim().split('\n').pop().slice(0, 160)}`); continue; }
    console.log(`자름 ${열쇠}`);
  }
}

function 엉킴표() {
  const 파일들 = fs.readdirSync(path.join(폴더, '줄')).flatMap((d) => fs.readdirSync(path.join(폴더, '줄', d)).filter((f) => f.endsWith('.mp3')).map((f) => path.join(폴더, '줄', d, f)));
  const r = spawnSync('python', ['-X', 'utf8', path.join(저장소, 'tools', '목소리엉킴.py'), ...파일들], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`엉킴 재기 실패 ${(r.stderr || '').slice(-300)}`);
  const 표 = new Map();
  for (const l of r.stdout.split('\n')) { const m = l.match(/([^\\/\s]+\.mp3)\s+엉킨 프레임\s+([\d.]+)%.*최고 음높이\s*([\d.]+)Hz/); if (m) 표.set(m[1], { 엉킴: Number(m[2]), 높이: Number(m[3]) }); }
  return 표;
}
// 짧은 웃음 · 감탄 줄은 받아쓰기가 비거나 달라도 결함이 아니다(「헤헤.」는 웃음으로 나온다)
const 짧은줄 = (말) => 말.replace(/[^가-힣]/g, '').replace(/헤|하/g, '').length <= 2;
// 맞음은 웃음 낱말(헤헤 · 하하)을 빼고 다시 잰다 — 연기 꼬리표대로 웃음으로 나오면 받아쓰기에 안 남는다
const 웃음뺀 = (s) => String(s || '').replace(/헤헤|하하/g, '').replace(/[^가-힣0-9]/g, '');
function 닮음(a, b) {
  const x = 웃음뺀(a); const y = 웃음뺀(b); if (!x && !y) return 1; if (!x || !y) return 0;
  const 표 = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) 표[i][j] = x[i - 1] === y[j - 1] ? 표[i - 1][j - 1] + 1 : Math.max(표[i - 1][j], 표[i][j - 1]);
  return Math.round((2 * 표[x.length][y.length] / (x.length + y.length)) * 1000) / 1000;
}

/** 글마다 모든 판의 후보 → 고른 판 */
export function 고르기() {
  const b = 기록(); const 엉 = 엉킴표(); const 후보 = new Map();
  for (const [열쇠, 판] of Object.entries(b.판)) {
    const 표파일 = path.join(폴더, '줄', 열쇠, `${열쇠}.json`); if (!fs.existsSync(표파일)) continue;
    for (const l of JSON.parse(fs.readFileSync(표파일, 'utf8')).줄) {
      const 잼 = 엉.get(l.파일) || { 엉킴: 99, 높이: 0 };
      if (!후보.has(l.말)) 후보.set(l.말, []);
      후보.get(l.말).push({ 열쇠, 파일: path.join(폴더, '줄', 열쇠, l.파일), 맞음: 닮음(l.말, l.받아쓰기), 받아쓰기: l.받아쓰기, 초: l.초, 엉킴: 잼.엉킴, 높이: 잼.높이, 점: 잼.엉킴 + (잼.높이 > 560 ? 100 : 0) });
    }
  }
  // 귀 대신 받아쓰기로 본 손 고름 — 53은 2판이 「브이」를 빠뜨렸고 1판은 「V!」로 받아 적혀(한글만 견주는 맞음이 같게 나옴) 1판을 쓴다
  const 고정 = { 53: '묶음03_1' };
  const 결과 = 목록().map((l) => {
    const c = 후보.get(l.말) || [];
    if (!c.length) return { ...l, 없음: true };
    const 최고 = Math.max(...c.map((x) => x.맞음));
    const 고름 = c.find((x) => x.열쇠 === 고정[l.번호]) || c.filter((x) => x.맞음 >= 최고 - 0.02).sort((a, b) => a.점 - b.점)[0];
    return { ...l, ...고름, 판수: c.length, 다시: !짧은줄(l.말) && 고름.맞음 < 0.9 };
  });
  fs.writeFileSync(path.join(폴더, '고른줄.json'), JSON.stringify(결과, null, 1));
  const 다시 = 결과.filter((r) => r.다시 || r.없음);
  console.log(`줄 ${결과.length} · 고름 ${결과.filter((r) => !r.없음).length} · 다시 구울 줄 ${다시.length}${다시.length ? ` — ${다시.map((r) => `${r.번호}「${r.말}」(${r.맞음 ?? '없음'} · ${r.받아쓰기 ?? ''})`).join(' / ')}` : ''}`);
  return 결과;
}

/** 고른 줄을 −18 LUFS로 맞춰 내보낸다 */
function 내보내기() {
  const 결과 = JSON.parse(fs.readFileSync(path.join(폴더, '고른줄.json'), 'utf8'));
  if (결과.some((r) => r.없음)) throw new Error('고르지 못한 줄이 있다 — 다시 굽는다');
  fs.mkdirSync(내보낼곳, { recursive: true });
  const 줄 = [];
  for (const r of 결과) {
    const 파일 = `${String(r.번호).padStart(3, '0')}.mp3`;
    const 잼 = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-i', r.파일, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const 크기 = Number((잼.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0] ?? -18);
    const x = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', r.파일, '-af', `volume=${(-18 - 크기).toFixed(2)}dB,alimiter=limit=0.89`, '-ar', '24000', '-ac', '1', '-b:a', '96k', path.join(내보낼곳, 파일)], { encoding: 'utf8' });
    if (x.status !== 0) throw new Error(`내보내기 실패 ${파일}: ${x.stderr.slice(0, 200)}`);
    줄.push({ 번호: r.번호, 말: r.말, 파일, 꼬리표: r.꼬리표, 출처: r.출처, 고른판: r.열쇠, 맞음: r.맞음, 엉킴: r.엉킴 });
  }
  fs.writeFileSync(path.join(내보낼곳, '목록.json'), `${JSON.stringify({ 은행: 은행.판, 목소리: `일레븐 v4 ${목소리.이름}(${목소리.id}, 힉스필드 프리셋)`, 만든날: '2026-11-02', 소리: '−18 LUFS · 24kHz 모노 mp3', 줄 }, null, 1)}\n`);
  console.log(`내보냄 ${줄.length}줄 → ${내보낼곳}`);
}

/** 내보낸 은행 소리로 두 대화를 은행처럼 잇는다 — 같은 차례 조각은 0.2초, 차례 사이 0.45초, 「짠!」 앞은 사인하는 1.2초 */
function 엮기() {
  const 표 = new Map(JSON.parse(fs.readFileSync(path.join(내보낼곳, '목록.json'), 'utf8')).줄.map((l) => [l.말, path.join(내보낼곳, l.파일)]));
  const 표본율 = 24000; const 무음 = (초) => Buffer.alloc(Math.round(표본율 * 초) * 2);
  const pcm = (파일) => spawnSync('ffmpeg', ['-v', 'error', '-i', 파일, '-ac', '1', '-ar', String(표본율), '-f', 's16le', '-'], { maxBuffer: 256 * 1024 * 1024 }).stdout;
  const 소리 = (글) => { const f = 표.get(글); if (!f) throw new Error(`은행 소리에 없는 조각: ${글}`); return pcm(f); };
  const 나감폴더 = path.join(폴더, '대화'); fs.mkdirSync(나감폴더, { recursive: true });
  for (const [대, 이름] of [['A', '평범한판'], ['B', '까다로운판']]) {
    const 칸 = [소리(첫인사), 무음(0.45)];
    for (const t of 차례들(대)) {
      칸.push(pcm(path.join(작업, '학습자', `${대}_${t.번호 + 1}.wav`)), 무음(0.45));
      t.조각.forEach((g, i) => { if (i) 칸.push(무음(g.startsWith('짠!') ? 1.2 : 0.2)); 칸.push(소리(g)); });
      칸.push(무음(0.45));
    }
    const 몸 = Buffer.concat(칸); const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + 몸.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(표본율, 24); h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(몸.length, 40);
    const 임시 = path.join(나감폴더, `${이름}.wav`); fs.writeFileSync(임시, Buffer.concat([h, 몸]));
    const 나감 = path.join(나감폴더, `하온Zoe_${이름}.mp3`);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', 임시, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '96k', 나감], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`ffmpeg 실패 ${나감}`);
    console.log(`엮음 ${path.basename(나감)} ${(몸.length / 2 / 표본율).toFixed(1)}초`);
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === '은행굽기.mjs') {
  const 명령 = process.argv[2];
  if (명령 === '목록') { const 줄 = 목록(); console.log(`${줄.length}줄 · ${줄.reduce((n, l) => n + l.말.length, 0)}글자 · 묶음 ${묶음들().length}`); for (const l of 줄) console.log(`${l.번호} ${l.꼬리표} ${l.말} (${l.출처})`); }
  else if (명령 === '값') 값();
  else if (명령 === '굽기') await 굽기();
  else if (명령 === '자르기') 자르기();
  else if (명령 === '고르기') 고르기();
  else if (명령 === '다시') { // 고른 줄 가운데 다시 구울 줄만 새 묶음으로(두 판)
    const 번호 = new Set(process.argv[3].split(',').map(Number)); const 남은 = 목록().filter((l) => 번호.has(l.번호));
    // 끝이 같은 줄(「…이름이 뭐예요?」 · 「이름이 뭐예요?」)이 이웃하면 받아쓰기 맞춤이 엉켜 줄 경계가 밀린다 — 끝 네 글자가 다른 줄끼리 잇는다
    const 끝 = (l) => l.말.replace(/[^가-힣]/g, '').slice(-4); const 줄 = [];
    while (남은.length) { const i = Math.max(0, 남은.findIndex((l) => !줄.length || 끝(l) !== 끝(줄.at(-1)))); 줄.push(...남은.splice(i, 1)); }
    const k = Object.keys(기록().묶음).filter((n) => n.startsWith('다시')).length + 1;
    await 굽기([{ 이름: `다시${String(k).padStart(2, '0')}`, 줄 }]); 자르기(); 고르기();
  }
  else if (명령 === '내보내기') 내보내기();
  else if (명령 === '엮기') 엮기();
  else { console.error('명령: 목록 | 값 | 굽기 | 자르기 | 고르기 | 다시 <번호,…> | 내보내기 | 엮기'); process.exit(1); }
}
