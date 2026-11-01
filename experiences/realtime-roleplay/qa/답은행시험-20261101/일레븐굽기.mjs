// 답 은행 시험 — 하온 목소리 일레븐 v4 후보(2026-11-02, 유호님 「응, 만들어 봐」). Kore가 실시간판 · 이어 붙인 판 모두 「감정이 AI 같다」(결정 11-02)라,
// 가장 가까운 만족 사례 S39(10-31 태오 선배, 일레븐 v4 — 「너무 자연스럽고 훌륭하다」)의 방법으로 평범한 판의 하온 줄을 다시 만든다.
// - 줄은 은행3길.json이 고른 답 그대로이고, 반응 + 질문을 따로 굽지 않고 한 차례를 통째로 읽힌다(이음새 없음). 사인 줄만 사인하는 동안 쉬도록 둘로 나눈다.
// - 목소리마다 여덟 줄을 한 번에 이어 읽혀(10-29 「AI티」 고침 — 줄마다 따로 구우면 억양이 줄마다 새로 시작한다) 받아쓰기 낱말 시각으로 자른다(드라마 목소리후보 나누기.py).
// - 하온은 성별이 아직 정해지지 않았다(시제품은 Kore 여성 · cedar 남성, 학습자 말 자료는 「오빠」) — 여성 둘 · 남성 둘. 태오 선배(Julian) · 교수(Elena)는 다른 배역이라 뺀다.
// - 힉스필드 founder 계정 CLI. 값은 접수 전에 묻고(목표 50크레딧 안), 이미 받은 판은 다시 굽지 않는다.
// 쓰는 법: node 일레븐굽기.mjs <줄|값|굽기|자르기|엮기|전부> [--판 2]   → .tmp/답은행시험-20261101/일레븐/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 차례들 } from './이어붙이기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '../../../..');
const 작업 = path.join(저장소, '.tmp', '답은행시험-20261101');
const 폴더 = path.join(작업, '일레븐');
const 기록파일 = path.join(폴더, '기록.json');
const 힉스집 = path.join(os.homedir(), '.ai-accounts', 'higgsfield-founder');
const 힉스실행 = path.join(process.env.APPDATA, 'npm', 'higgsfield.exe');
const 판수 = Number(process.argv.includes('--판') ? process.argv[process.argv.indexOf('--판') + 1] : 2);

// 일레븐 v4 힉스필드 프리셋(드라마 목소리후보 후보.mjs와 같은 id)
export const 목소리들 = {
  Hana: { id: 'c25f78a0-714e-42af-8da3-a399cef94968', 결: '여성 · 젊고 또박또박' },
  Zoe: { id: 'd0374db1-44b9-4f05-939e-0a9ae9dbbe6a', 결: '여성 · 젊음' },
  Kevin: { id: 'f1373f24-3b96-433f-9a68-e595810ef608', 결: '남성 · 20대' },
  Cillian: { id: 'd8ba9f14-8a24-44db-932b-99e16c45bd32', 결: '남성 · 20대' },
};
// 차례마다 연기 꼬리표 — 팬을 만나 반갑고 들뜬 20대 아이돌(장면.mjs 연기)
const 꼬리표 = ['[excited]', '[delighted]', '[amazed]', '[happy]', '[cheerful]', '[proud]', '[laughs]', '[warmly]'];

/** 평범한 판의 하온 줄 — 첫인사 + 차례마다 통째 한 줄(사인 줄은 「그럼요! 예쁘게 써 줄게요.」 · 「짠! …」 둘) */
export function 줄들() {
  const 길 = JSON.parse(fs.readFileSync(path.join(작업, '은행3길.json'), 'utf8'));
  const 줄 = [{ 차례: -1, 말: 길.A.첫인사 }];
  for (const t of 차례들('A')) {
    const 짠 = t.조각.findIndex((g) => g.startsWith('짠!'));
    if (짠 > 0) { 줄.push({ 차례: t.번호, 말: t.조각.slice(0, 짠).join(' ') }, { 차례: t.번호, 말: t.조각.slice(짠).join(' '), 쉼앞: 1.2 }); }
    else 줄.push({ 차례: t.번호, 말: t.조각.join(' ') });
  }
  if (줄.length !== 꼬리표.length) throw new Error(`줄 ${줄.length}개인데 꼬리표 ${꼬리표.length}개`);
  return 줄.map((l, i) => ({ ...l, 번호: i + 1, 꼬리표: 꼬리표[i] }));
}
const 대화 = (id) => JSON.stringify(줄들().map((l) => ({ text: `${l.꼬리표} ${l.말}`, voice_id: id, voice_type: 'preset' })));

function 힉스(인자) {
  const r = spawnSync(힉스실행, [...인자, '--json'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 }, timeout: 15 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 });
  try { return JSON.parse((r.stdout || '').trim()); } catch { throw new Error(`힉스필드 답을 못 읽었다: ${(r.stdout || r.stderr || '').slice(0, 300)}`); }
}
const 잔액 = () => (spawnSync(힉스실행, ['account', 'status'], { encoding: 'utf8', env: { ...process.env, HOME: 힉스집, USERPROFILE: 힉스집 } }).stdout || '').trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const 번호찾기 = (o) => { if (!o || typeof o !== 'object') return null; for (const k of ['id', 'job_id']) if (typeof o[k] === 'string' && UUID.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = 번호찾기(v); if (x) return x; } return null; };
const 주소찾기 = (o) => { if (!o || typeof o !== 'object') return null; if (typeof o.result_url === 'string') return o.result_url; if (typeof o.url === 'string' && /^https?:/.test(o.url)) return o.url; for (const v of Object.values(o)) { const x = 주소찾기(v); if (x) return x; } return null; };
const 기록 = () => (fs.existsSync(기록파일) ? JSON.parse(fs.readFileSync(기록파일, 'utf8')) : { 판: {} });
const 저장 = (b) => { fs.mkdirSync(폴더, { recursive: true }); fs.writeFileSync(기록파일, JSON.stringify(b, null, 1)); };
const 할일 = () => Object.keys(목소리들).flatMap((이름) => Array.from({ length: 판수 }, (_, k) => ({ 이름, 열쇠: `${이름}_${k + 1}` })));

function 값() {
  const 한판 = 힉스(['generate', 'cost', 'elevenlabs_v4', '--dialogue', 대화(목소리들.Hana.id), '--stability', '0.5']);
  const 크레딧 = Number(한판?.credits ?? 한판?.cost ?? 한판?.total_credits ?? NaN);
  console.log(JSON.stringify({ 한판: 한판, 판수: 할일().length, 합: Number.isFinite(크레딧) ? 크레딧 * 할일().length : null, 잔액: 잔액() }));
  return 크레딧 * 할일().length;
}

async function 굽기() {
  const b = 기록(); b.잔액전 ??= 잔액(); 저장(b);
  for (const 일 of 할일()) {
    if (b.판[일.열쇠]?.작업) continue;
    const 이전 = Date.now();
    let id = 번호찾기(힉스(['generate', 'create', 'elevenlabs_v4', '--dialogue', 대화(목소리들[일.이름].id), '--stability', '0.5']));
    if (!id) { const 목록 = 힉스(['generate', 'list', '--size', '5']); const a = Array.isArray(목록) ? 목록 : 목록.jobs || 목록.items || 목록.data || []; id = a.find((x) => x.job_type === 'elevenlabs_v4' && Date.parse(x.created_at) >= 이전 - 5000)?.id; }
    if (!id) throw new Error(`접수 번호를 못 받았다: ${일.열쇠}`);
    b.판[일.열쇠] = { 이름: 일.이름, 작업: id }; 저장(b);
    console.log(`접수 ${일.열쇠} → ${id}`);
  }
  for (const [열쇠, 판] of Object.entries(b.판)) {
    if (판.판 && fs.existsSync(path.join(폴더, 판.판))) continue;
    const 주소 = 주소찾기(힉스(['generate', 'wait', 판.작업]));
    if (!주소) throw new Error(`결과 주소가 없다: ${열쇠}`);
    판.판 = `${열쇠}${path.extname(new URL(주소).pathname) || '.mp3'}`;
    fs.writeFileSync(path.join(폴더, 판.판), Buffer.from(await (await fetch(주소)).arrayBuffer()));
    저장(b); console.log(`받음 ${판.판}`);
  }
  b.잔액뒤 = 잔액(); 저장(b);
  console.log(`잔액 ${b.잔액전} → ${b.잔액뒤}`);
}

/** 드라마 나누기.py가 읽는 꼴로 줄 목록을 둔다(역 = 하온, 「되묻기」 칸은 그 도구가 읽어서 둔다) */
function 줄쓰기() {
  fs.mkdirSync(폴더, { recursive: true });
  fs.writeFileSync(path.join(폴더, '하온_줄.json'), JSON.stringify(줄들().map((l) => ({ ...l, 되묻기: false })), null, 1));
  for (const l of 줄들()) console.log(`${l.번호} ${l.꼬리표} ${l.말}${l.쉼앞 ? ` (앞에 ${l.쉼앞}초 쉼)` : ''}`);
}

/** 판마다 받아쓰기 낱말 시각으로 여덟 줄을 자른다 — 드라마 목소리후보 나누기.py 그대로(자른 줄을 다시 받아 적어 「맞음」을 낸다) */
function 자르기() {
  const b = 기록();
  const 나누기 = path.resolve(저장소, 'experiences/drama/qa/목소리후보-20261030/나누기.py');
  for (const 열쇠 of Object.keys(b.판)) {
    const 나감 = path.join(폴더, '줄', 열쇠);
    if (fs.existsSync(path.join(나감, `${열쇠}.json`))) continue;
    const r = spawnSync('py', ['-3', '-I', 나누기, 폴더, '하온', 열쇠, 나감, 열쇠, '0.2'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    if (r.status !== 0) throw new Error(`자르기 실패 ${열쇠}\n${(r.stderr || '').slice(-800)}`);
    console.log(`자름 ${열쇠}\n${r.stdout.trim()}`);
  }
}

// ── 고르기 · 엮기: 줄마다 두 판 가운데 다시 받아 적은 글이 대본과 더 맞는 판(같으면 1판) → 평범한 판 대화로 잇는다 ──
const 표본율 = 24000;
const pcm읽기 = (파일) => spawnSync('ffmpeg', ['-v', 'error', '-i', 파일, '-ac', '1', '-ar', String(표본율), '-f', 's16le', '-'], { maxBuffer: 256 * 1024 * 1024 }).stdout;
function 크기(파일) { const 잼 = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-i', 파일, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr; return Number((잼.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)?.[0] ?? -18); }
function 맞춘pcm(파일, 목표 = -18) {
  const pcm = pcm읽기(파일); const 배 = 10 ** ((목표 - 크기(파일)) / 20); const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i += 2) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.readInt16LE(i) * 배))), i);
  return out;
}
const 무음 = (초) => Buffer.alloc(Math.round(표본율 * 초) * 2);
function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(표본율, 24);
  h.writeUInt32LE(표본율 * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
/** 줄마다 엉킨 프레임 비율(tools/목소리엉킴.py — 모음의 배음이 흩어져 지지직 깨지는 프레임). 같은 목소리 · 같은 글의 두 판끼리만 견준다 */
function 엉킴표() {
  const 파일 = path.join(폴더, '엉킴_전부.txt');
  const r = spawnSync('python', ['-X', 'utf8', path.join(저장소, 'tools', '목소리엉킴.py'), ...fs.readdirSync(path.join(폴더, '줄')).flatMap((d) => fs.readdirSync(path.join(폴더, '줄', d)).filter((f) => f.endsWith('.mp3')).map((f) => path.join(폴더, '줄', d, f)))], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status === 0) fs.writeFileSync(파일, r.stdout);
  const 표 = new Map();
  // 최고 음높이가 560Hz를 넘으면 목소리가 뒤집혀 깨진 자리일 수 있다(도구의 ⚠) — 그 판은 뒤로 미룬다
  for (const l of fs.readFileSync(파일, 'utf8').split('\n')) { const m = l.match(/([^\\/\s]+\.mp3)\s+엉킨 프레임\s+([\d.]+)%.*최고 음높이\s*([\d.]+)Hz/); if (m) 표.set(m[1], Number(m[2]) + (Number(m[3]) > 560 ? 100 : 0)); }
  return 표;
}
export function 고른줄(이름, 엉 = 엉킴표()) {
  const 판들 = Array.from({ length: 판수 }, (_, k) => `${이름}_${k + 1}`).filter((열쇠) => fs.existsSync(path.join(폴더, '줄', 열쇠, `${열쇠}.json`)));
  const 표 = 판들.map((열쇠) => ({ 열쇠, 줄: JSON.parse(fs.readFileSync(path.join(폴더, '줄', 열쇠, `${열쇠}.json`), 'utf8')).줄 }));
  return 줄들().map((l, i) => {
    // 받아 적은 글이 대본과 가장 맞는 판(0.02 안은 같다고 본다) 가운데 엉킨 프레임이 적은 판
    const 후보 = 표.map((p) => ({ 열쇠: p.열쇠, ...p.줄[i], 엉킴: 엉.get(p.줄[i].파일) ?? 99 }));
    const 최고 = Math.max(...후보.map((c) => c.맞음));
    const 고름 = 후보.filter((c) => c.맞음 >= 최고 - 0.02).sort((a, b) => a.엉킴 - b.엉킴)[0];
    return { ...l, 열쇠: 고름.열쇠, 파일: path.join(폴더, '줄', 고름.열쇠, 고름.파일), 맞음: 고름.맞음, 엉킴: 고름.엉킴, 받아쓰기: 고름.받아쓰기, 판별: 후보.map((c) => `${c.열쇠} 맞음 ${c.맞음} · 엉킴 ${c.엉킴}%`) };
  });
}
function 엮기() {
  const 나감폴더 = path.join(폴더, '대화'); fs.mkdirSync(나감폴더, { recursive: true });
  const 학습자 = (i) => 맞춘pcm(path.join(작업, '학습자', `A_${i + 1}.wav`));
  const 요약 = {}; const 엉 = 엉킴표();
  for (const 이름 of Object.keys(목소리들)) {
    const 줄 = 고른줄(이름, 엉);
    const 칸 = []; let 학습자차례 = 0;
    줄.forEach((l, i) => {
      if (l.쉼앞) 칸.push(무음(l.쉼앞));
      else if (i > 0) { 칸.push(학습자(학습자차례++), 무음(0.45)); }
      칸.push(맞춘pcm(l.파일), 무음(0.45));
    });
    const 임시 = path.join(나감폴더, `${이름}.wav`); fs.writeFileSync(임시, wav(Buffer.concat(칸)));
    const 나감 = path.join(나감폴더, `평범한판_일레븐_${이름}.mp3`);
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', 임시, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '96k', 나감], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`ffmpeg 실패 ${나감}\n${r.stderr.slice(-400)}`);
    요약[이름] = 줄.map((l) => ({ 번호: l.번호, 말: l.말, 고른판: l.열쇠, 맞음: l.맞음, 엉킴: l.엉킴, 받아쓰기: l.받아쓰기, 판별: l.판별 }));
    console.log(`엮음 ${path.basename(나감)} · 줄마다 판 ${줄.map((l) => l.열쇠.split('_')[1]).join('')} · 맞음 ${줄.map((l) => l.맞음).join(' ')} · 엉킴 ${줄.map((l) => l.엉킴).join(' ')}`);
  }
  fs.writeFileSync(path.join(나감폴더, '고른줄.json'), JSON.stringify(요약, null, 1));
}

if (process.argv[1] && path.basename(process.argv[1]) === '일레븐굽기.mjs') {
  const 명령 = process.argv[2];
  if (명령 === '줄') 줄쓰기();
  else if (명령 === '값') 값();
  else if (명령 === '굽기') { 줄쓰기(); await 굽기(); }
  else if (명령 === '자르기') { 줄쓰기(); 자르기(); }
  else if (명령 === '엮기') 엮기();
  else { console.error('명령: 줄 | 값 | 굽기 | 자르기 | 엮기'); process.exit(1); }
}
